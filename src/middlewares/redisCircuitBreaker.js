// src/middlewares/redisCircuitBreaker.js
// Circuit-breaker wrapper around the Redis service.
//
// States:
//   closed    — normal operation, failures counted
//   open      — failures exceeded threshold, all calls fail fast
//   half-open — recovery probe; one call allowed through
//
// No external dependencies beyond what the project already uses.

const { logger } = require("../middlewares/activityLog");
const {
  getRedisConnection,
  get,
  set: redisSet,
  del: redisDel,
  delPattern,
  acquireLock,
  releaseLock,
  cacheKeys,
} = require("../services/redis.service");

// ------------------------------------------------------------------
// Configuration (override via env for fine-tuning)
// ------------------------------------------------------------------

const FAILURE_THRESHOLD = parseInt(process.env.REDIS_CB_FAILURE_THRESHOLD, 10) || 5;
const RECOVERY_TIMEOUT = parseInt(process.env.REDIS_CB_RECOVERY_TIMEOUT, 10) || 30000;

// ------------------------------------------------------------------
// In-memory state tracker
// ------------------------------------------------------------------

/** @type { { status: 'closed' | 'open' | 'half-open'; failureCount: number; lastFailureTime: number | null; lastStateChange: number } } */
let circuitState = {
  status: "closed",
  failureCount: 0,
  lastFailureTime: null,
  lastStateChange: Date.now(),
};

const CLOSED = "closed";
const OPEN = "open";
const HALF_OPEN = "half-open";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Log a circuit-state transition (only for closed/→ open and open → half-open). */
function logTransition(from, to) {
  const msg = `Circuit breaker: ${from} → ${to}`;
  if (to === OPEN) {
    logger.warn({ status: "CircuitBreaker", message: msg, failureCount: circuitState.failureCount });
  } else if (to === HALF_OPEN) {
    logger.info({ status: "CircuitBreaker", message: msg });
  } else {
    logger.info({ status: "CircuitBreaker", message: msg });
  }
}

/** Record a failure and evaluate state transitions. */
function recordFailure() {
  const now = Date.now();
  circuitState.failureCount += 1;
  circuitState.lastFailureTime = now;

  if (circuitState.status === HALF_OPEN) {
    // A failure in half-open means we go straight back to open.
    circuitState.status = OPEN;
    circuitState.lastStateChange = now;
    logTransition(HALF_OPEN, OPEN);
  } else if (circuitState.failureCount >= FAILURE_THRESHOLD && circuitState.status === CLOSED) {
    circuitState.status = OPEN;
    circuitState.lastStateChange = now;
    logTransition(CLOSED, OPEN);
  }
}

/** Called when a probe request in half-open succeeds. */
function recordSuccess() {
  if (circuitState.status === HALF_OPEN) {
    circuitState.status = CLOSED;
    circuitState.failureCount = 0;
    circuitState.lastFailureTime = null;
    circuitState.lastStateChange = Date.now();
    logTransition(HALF_OPEN, CLOSED);
  }
}

/** Check whether an OPEN circuit has recovered enough to try half-open. */
function shouldTryRecovery() {
  return circuitState.status === OPEN && Date.now() - circuitState.lastStateChange >= RECOVERY_TIMEOUT;
}

/**
 * Wrap an async redis call with circuit-breaker logic.
 * @param {() => Promise<any>} redisFn
 * @param {string} [fnName] Optional name for logging
 * @returns {Promise<any>}
 */
async function withCircuitBreaker(redisFn, fnName = "redis") {
  if (circuitState.status === OPEN) {
    if (shouldTryRecovery()) {
      // Transition to half-open and allow one probe.
      circuitState.status = HALF_OPEN;
      circuitState.lastStateChange = Date.now();
      logTransition(OPEN, HALF_OPEN);
    } else {
      // Still open — fail fast.
      const fallback = new Error(
        `Redis unavailable (circuit open, ${fnName}). Try again later.`,
      );
      fallback.status = 503; // Service Unavailable
      throw fallback;
    }
  }

  // CLOSED or HALF_OPEN: attempt the call.
  try {
    const result = await redisFn();
    recordSuccess();
    return result;
  } catch (error) {
    recordFailure();
    throw error;
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Wrap a single redis function with circuit-breaker protection.
 * @param {() => Promise<any>} fn — redis function to protect
 * @param {string} [name] — function name (for logging)
 * @returns {() => Promise<any>}
 */
function requireCircuitBreaker(fn, name = "redis") {
  return () => withCircuitBreaker(fn, name);
}

/**
 * Get the current circuit breaker state.
 * @returns {{ status: 'closed'|'open'|'half-open', failureCount: number, lastFailureTime: number | null }}
 */
function getCircuitState() {
  return {
    status: circuitState.status,
    failureCount: circuitState.failureCount,
    lastFailureTime: circuitState.lastFailureTime,
  };
}

/**
 * Manually reset the circuit breaker to a closed state.
 */
function resetCircuit() {
  const was = circuitState.status;
  circuitState = {
    status: CLOSED,
    failureCount: 0,
    lastFailureTime: null,
    lastStateChange: Date.now(),
  };
  if (was !== CLOSED) {
    logTransition(was, CLOSED);
  }
}

// ------------------------------------------------------------------
// Cached / wrapped redis functions (auto-wired)
// ------------------------------------------------------------------

const wrapped = {
  get: requireCircuitBreaker(() => get(null), "get"),
  set: requireCircuitBreaker(() => redisSet(null, null), "set"),
  del: requireCircuitBreaker(() => redisDel(null), "del"),
  delPattern: requireCircuitBreaker(() => delPattern(null), "delPattern"),
  acquireLock: requireCircuitBreaker(() => acquireLock(null), "acquireLock"),
  releaseLock: requireCircuitBreaker(() => releaseLock(null, null), "releaseLock"),
  getClient: requireCircuitBreaker(() => getRedisConnection(), "getClient"),
};

module.exports = {
  requireCircuitBreaker,
  getCircuitState,
  resetCircuit,
  withCircuitBreaker,
  wrapped,
  circuitState,
};
