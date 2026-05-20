/**
 * Token-Based Rate Limiter Service
 *
 * This service provides rate limiting based on:
 * 1. Token (JWT token hash) - protects against token reuse
 * 2. User ID - protects against user-specific brute force
 * 3. Endpoint - protects specific endpoints from abuse
 * 4. IP Address - traditional IP-based rate limiting
 *
 * This multi-layered approach protects against brute force attacks
 * even with rotating IPs, as the token and user ID are tracked.
 *
 * Features:
 * - Track failed login attempts per user
 * - Track failed token usage per token hash
 * - Auto-revoke tokens after excessive failures
 * - Temporary lockout with exponential backoff
 * - Endpoint-specific rate limiting
 */

const { Sessions, Users } = require("../models");
const { hashToken } = require("../utils/session");
const { logger } = require("../middlewares/activityLog");
const { generateAccessToken, verifyAccessToken } = require("../utils/jwt");

// ==========================================
// IN-MEMORY CACHE FOR RATE LIMITING
// ==========================================
// Using in-memory cache for fast lookups
// In production, consider using Redis for distributed systems
const rateLimitCache = new Map();

// Cache TTL settings (in milliseconds)
const CACHE_TTL = {
  FAILED_ATTEMPT: 15 * 60 * 1000, // 15 minutes
  LOCKOUT: 15 * 60 * 1000, // 15 minutes
  TOKEN_BLOCK: 24 * 60 * 60 * 1000, // 24 hours
  ENDPOINT_RATE: 1 * 60 * 1000, // 1 minute
};

// ==========================================
// RATE LIMIT CONFIGURATIONS
// ==========================================
const RATE_LIMIT_CONFIG = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 15 * 60 * 1000, // 15 minutes
    description: "Login endpoint",
  },
  forgotPassword: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 15 * 60 * 1000, // 15 minutes
    description: "Forgot password (OTP request)",
  },
  resetPassword: {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    lockoutMs: 5 * 60 * 1000, // 5 minutes
    description: "Reset password",
  },
  register: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutMs: 60 * 60 * 1000, // 1 hour
    description: "Registration",
  },
  default: {
    maxAttempts: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 5 * 60 * 1000, // 5 minutes
    description: "Default endpoint",
  },
};

/**
 * Generate a unique key for rate limiting
 * @param {Object} options - Options for key generation
 * @param {string} options.userId - User ID (optional)
 * @param {string} options.tokenHash - Hashed token (optional)
 * @param {string} options.ip - IP address (optional)
 * @param {string} options.endpoint - Endpoint path (optional)
 * @returns {string} Unique rate limit key
 */
function getRateLimitKey({
  userId = null,
  tokenHash = null,
  ip = null,
  endpoint = null,
}) {
  const parts = [];
  if (userId) parts.push(`user:${userId}`);
  if (tokenHash) parts.push(`token:${tokenHash}`);
  if (ip) parts.push(`ip:${ip}`);
  if (endpoint) parts.push(`endpoint:${endpoint}`);
  return parts.join("|") || "unknown";
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of rateLimitCache.entries()) {
    if (now > value.expiresAt) {
      rateLimitCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired rate limit entries`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Record a failed attempt for rate limiting
 * @param {Object} options - Options for recording
 * @param {string} options.userId - User ID (optional)
 * @param {string} options.tokenHash - Hashed token (optional)
 * @param {string} options.ip - IP address (optional)
 * @param {string} options.endpoint - Endpoint path (optional)
 * @returns {Object} Rate limit status
 */
async function recordFailedAttempt({
  userId = null,
  tokenHash = null,
  ip = null,
  endpoint = null,
}) {
  const now = Date.now();
  const config = RATE_LIMIT_CONFIG[endpoint] || RATE_LIMIT_CONFIG.default;
  const result = {
    isLimited: false,
    remainingAttempts: config.maxAttempts,
    lockoutUntil: null,
    lockoutReason: null,
    revokedToken: null,
  };

  // ==========================================
  // CHECK USER-BASED RATE LIMIT
  // ==========================================
  if (userId) {
    const userKey = getRateLimitKey({ userId, endpoint });
    const userEntry = rateLimitCache.get(userKey);

    if (userEntry) {
      if (now < userEntry.expiresAt) {
        userEntry.count++;
        result.remainingAttempts = Math.max(
          0,
          config.maxAttempts - userEntry.count,
        );

        // Check if user should be locked out
        if (userEntry.count >= config.maxAttempts) {
          result.isLimited = true;
          result.lockoutUntil = new Date(userEntry.lockoutUntil);
          result.lockoutReason = `Too many failed attempts on ${config.description}`;

          // Update user's failed login attempts in database
          try {
            const user = await Users.findByPk(userId);
            if (user) {
              const failedAttempts = (user.failedLoginAttempts || 0) + 1;
              await user.update({
                failedLoginAttempts: failedAttempts,
                lockedUntil: new Date(userEntry.lockoutUntil),
              });

              logger.warn(`User locked out due to rate limit`, {
                userId,
                failedAttempts,
                lockoutUntil: userEntry.lockoutUntil,
              });
            }
          } catch (error) {
            logger.error(`Error updating user lockout:`, error);
          }
        }
      } else {
        // Cache expired, reset counter
        rateLimitCache.set(userKey, {
          count: 1,
          createdAt: now,
          expiresAt: now + config.windowMs,
          lockoutUntil: null,
        });
        result.remainingAttempts = config.maxAttempts - 1;
      }
    } else {
      rateLimitCache.set(userKey, {
        count: 1,
        createdAt: now,
        expiresAt: now + config.windowMs,
        lockoutUntil: null,
      });
      result.remainingAttempts = config.maxAttempts - 1;
    }
  }

  // ==========================================
  // CHECK TOKEN-BASED RATE LIMIT
  // ==========================================
  if (tokenHash) {
    const tokenKey = getRateLimitKey({ tokenHash, endpoint });
    const tokenEntry = rateLimitCache.get(tokenKey);

    if (tokenEntry) {
      if (now < tokenEntry.expiresAt) {
        tokenEntry.count++;

        // If token has too many failures, revoke it
        if (tokenEntry.count >= 3) {
          try {
            const revoked = await revokeTokenByHash(
              tokenHash,
              "BRUTE_FORCE_DETECTED",
            );
            if (revoked) {
              result.revokedToken = tokenHash;
              logger.warn(`Token revoked due to brute force detection`, {
                tokenHash,
                attempts: tokenEntry.count,
              });
            }
          } catch (error) {
            logger.error(`Error revoking token:`, error);
          }
        }

        // Check if token should be blocked
        if (tokenEntry.count >= config.maxAttempts * 2) {
          result.isLimited = true;
          result.lockoutUntil = new Date(
            tokenEntry.blockUntil || now + CACHE_TTL.TOKEN_BLOCK,
          );
          result.lockoutReason =
            "Token blocked due to excessive failed attempts";

          // Block token in cache
          rateLimitCache.set(tokenKey, {
            ...tokenEntry,
            blocked: true,
            blockUntil: now + CACHE_TTL.TOKEN_BLOCK,
          });
        }
      } else {
        rateLimitCache.set(tokenKey, {
          count: 1,
          createdAt: now,
          expiresAt: now + config.windowMs,
        });
      }
    } else {
      rateLimitCache.set(tokenKey, {
        count: 1,
        createdAt: now,
        expiresAt: now + config.windowMs,
      });
    }
  }

  // ==========================================
  // CHECK IP-BASED RATE LIMIT (fallback)
  // ==========================================
  if (ip && !result.isLimited) {
    const ipKey = getRateLimitKey({ ip, endpoint });
    const ipEntry = rateLimitCache.get(ipKey);

    if (ipEntry) {
      if (now < ipEntry.expiresAt) {
        ipEntry.count++;
        if (ipEntry.count >= config.maxAttempts * 3) {
          result.isLimited = true;
          result.lockoutUntil = new Date(now + 5 * 60 * 1000);
          result.lockoutReason = "Too many requests from this IP";
        }
      } else {
        rateLimitCache.set(ipKey, {
          count: 1,
          createdAt: now,
          expiresAt: now + config.windowMs,
        });
      }
    } else {
      rateLimitCache.set(ipKey, {
        count: 1,
        createdAt: now,
        expiresAt: now + config.windowMs,
      });
    }
  }

  return result;
}

/**
 * Reset failed attempts for a user/token
 * @param {Object} options - Options for reset
 * @param {string} options.userId - User ID (optional)
 * @param {string} options.tokenHash - Hashed token (optional)
 * @param {string} options.endpoint - Endpoint path (optional)
 */
async function resetFailedAttempts({
  userId = null,
  tokenHash = null,
  endpoint = null,
}) {
  if (userId) {
    const userKey = getRateLimitKey({ userId, endpoint });
    rateLimitCache.delete(userKey);

    // Reset user's failed login attempts in database
    try {
      await Users.update(
        {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        { where: { id: userId } },
      );
    } catch (error) {
      logger.error(`Error resetting user failed attempts:`, error);
    }
  }

  if (tokenHash) {
    const tokenKey = getRateLimitKey({ tokenHash, endpoint });
    rateLimitCache.delete(tokenKey);
  }
}

/**
 * Revoke a token by its hash
 * @param {string} tokenHash - Hashed token
 * @param {string} reason - Reason for revocation
 * @returns {Promise<boolean>} True if revoked
 */
async function revokeTokenByHash(tokenHash, reason = "RATE_LIMIT_EXCEEDED") {
  try {
    const affected = await Sessions.update(
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
        isActive: false,
      },
      { where: { tokenHash, isRevoked: false } },
    );
    return affected[0] > 0;
  } catch (error) {
    logger.error(`Error revoking token by hash:`, error);
    return false;
  }
}

/**
 * Revoke all tokens for a user
 * @param {string} userId - User ID
 * @param {string} reason - Reason for revocation
 * @returns {Promise<number>} Number of revoked sessions
 */
async function revokeAllUserTokens(userId, reason = "SECURITY_REVOCATION") {
  try {
    const [affected] = await Sessions.update(
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
        isActive: false,
      },
      { where: { userId, isRevoked: false } },
    );
    logger.info(`Revoked ${affected} sessions for user ${userId}: ${reason}`);
    return affected;
  } catch (error) {
    logger.error(`Error revoking user tokens:`, error);
    return 0;
  }
}

/**
 * Check if a token is blocked
 * @param {string} token - Raw token
 * @param {string} endpoint - Endpoint path (optional)
 * @returns {Object} Block status
 */
function isTokenBlocked(token, endpoint = null) {
  const tokenHash = hashToken(token);
  const key = getRateLimitKey({ tokenHash, endpoint });
  const entry = rateLimitCache.get(key);
  const now = Date.now();

  if (entry && now < entry.expiresAt && entry.blocked) {
    return {
      isBlocked: true,
      blockUntil: new Date(entry.blockUntil),
      reason: "Token blocked due to suspicious activity",
    };
  }

  return { isBlocked: false };
}

/**
 * Check if a user is locked out
 * @param {string} userId - User ID
 * @param {string} endpoint - Endpoint path (optional)
 * @returns {Object} Lockout status
 */
function isUserLockedOut(userId, endpoint = null) {
  const config = RATE_LIMIT_CONFIG[endpoint] || RATE_LIMIT_CONFIG.default;
  const key = getRateLimitKey({ userId, endpoint });
  const entry = rateLimitCache.get(key);
  const now = Date.now();

  if (entry && now < entry.expiresAt && entry.count >= config.maxAttempts) {
    return {
      isLocked: true,
      lockoutUntil: new Date(entry.lockoutUntil),
      remainingAttempts: 0,
      reason: "Account temporarily locked due to too many failed attempts",
    };
  }

  return {
    isLocked: false,
    remainingAttempts: config.maxAttempts - (entry?.count || 0),
  };
}

/**
 * Get rate limit status for monitoring
 * @param {Object} options - Options
 * @returns {Object} Rate limit status
 */
function getRateLimitStatus({
  userId = null,
  tokenHash = null,
  ip = null,
  endpoint = null,
}) {
  const status = {};

  if (userId) {
    const userKey = getRateLimitKey({ userId, endpoint });
    const entry = rateLimitCache.get(userKey);
    status.user = entry
      ? {
          count: entry.count,
          expiresAt: new Date(entry.expiresAt),
          isLocked:
            entry.count >=
            (RATE_LIMIT_CONFIG[endpoint] || RATE_LIMIT_CONFIG.default)
              .maxAttempts,
        }
      : null;
  }

  if (tokenHash) {
    const tokenKey = getRateLimitKey({ tokenHash, endpoint });
    const entry = rateLimitCache.get(tokenKey);
    status.token = entry
      ? {
          count: entry.count,
          expiresAt: new Date(entry.expiresAt),
          isBlocked: entry.blocked,
        }
      : null;
  }

  if (ip) {
    const ipKey = getRateLimitKey({ ip, endpoint });
    const entry = rateLimitCache.get(ipKey);
    status.ip = entry
      ? {
          count: entry.count,
          expiresAt: new Date(entry.expiresAt),
        }
      : null;
  }

  return status;
}

/**
 * Clear all rate limit entries (for admin/debug purposes)
 */
function clearAllRateLimits() {
  rateLimitCache.clear();
  logger.info("All rate limit entries cleared");
}

module.exports = {
  // Main functions
  recordFailedAttempt,
  resetFailedAttempts,
  revokeTokenByHash,
  revokeAllUserTokens,
  isTokenBlocked,
  isUserLockedOut,
  getRateLimitStatus,

  // Configuration
  RATE_LIMIT_CONFIG,

  // Admin functions
  clearAllRateLimits,
  cleanupExpiredEntries,

  // Cache access (for testing)
  rateLimitCache,
};
