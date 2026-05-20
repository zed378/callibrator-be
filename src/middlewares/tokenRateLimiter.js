/**
 * Token-Based Rate Limiter Middleware
 *
 * This middleware provides multi-layered rate limiting to protect against
 * brute force attacks even with rotating IPs:
 *
 * 1. Token-level: Tracks failed attempts by JWT token hash
 * 2. User-level: Tracks failed attempts by user ID
 * 3. IP-level: Traditional IP-based rate limiting (fallback)
 *
 * When too many failed attempts are detected:
 * - User account is temporarily locked
 * - Token is revoked (all sessions for that token)
 * - Further requests are rejected with 429 Too Many Requests
 *
 * Usage:
 * - Protect login: authRateLimiter('login')
 * - Protect forgot password: authRateLimiter('forgotPassword')
 * - Protect registration: authRateLimiter('register')
 */

const { hashToken } = require("../utils/session");
const {
  recordFailedAttempt,
  resetFailedAttempts,
  isUserLockedOut,
  isTokenBlocked,
  RATE_LIMIT_CONFIG,
} = require("../services/rateLimiter.service");
const { verifyAccessToken } = require("../utils/jwt");
const { Users } = require("../models");

/**
 * Create a rate limiter middleware for a specific endpoint
 * @param {string} endpoint - Endpoint name (login, forgotPassword, register, etc.)
 * @returns {Function} Express middleware
 */
const authRateLimiter = (endpoint = "default") => {
  return async (req, res, next) => {
    try {
      const config = RATE_LIMIT_CONFIG[endpoint] || RATE_LIMIT_CONFIG.default;

      // Extract identifying information
      const token = req.headers.authorization?.replace("Bearer ", "");
      const tokenHash = token ? hashToken(token) : null;
      const ip =
        req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

      // Try to decode token to get user ID (if token is valid)
      let userId = null;
      let decoded = null;

      if (token) {
        try {
          decoded = verifyAccessToken(token);
          userId = decoded.id;
        } catch (error) {
          // Token is invalid or expired, userId remains null
        }
      }

      // ==========================================
      // CHECK IF USER IS LOCKED OUT
      // ==========================================
      if (userId) {
        const lockoutStatus = isUserLockedOut(userId, endpoint);

        if (lockoutStatus.isLocked) {
          const lockoutUntil = lockoutStatus.lockoutUntil;
          const retryAfter = Math.max(
            0,
            Math.ceil((lockoutUntil - Date.now()) / 1000),
          );

          return res.status(429).json({
            success: false,
            status: 429,
            message: lockoutStatus.reason,
            lockoutUntil: lockoutUntil.toISOString(),
            retryAfter: retryAfter,
          });
        }
      }

      // ==========================================
      // CHECK IF TOKEN IS BLOCKED
      // ==========================================
      if (token && tokenHash) {
        const tokenBlockStatus = isTokenBlocked(token, endpoint);

        if (tokenBlockStatus.isBlocked) {
          return res.status(429).json({
            success: false,
            status: 429,
            message: tokenBlockStatus.reason,
            blockUntil: tokenBlockStatus.blockUntil.toISOString(),
            retryAfter: Math.max(
              0,
              Math.ceil((tokenBlockStatus.blockUntil - Date.now()) / 1000),
            ),
          });
        }
      }

      // ==========================================
      // ATTACH RATE LIMIT INFO TO REQUEST
      // ==========================================
      req.rateLimit = {
        endpoint,
        userId,
        tokenHash,
        ip,
        maxAttempts: config.maxAttempts,
        windowMs: config.windowMs,
      };

      next();
    } catch (error) {
      console.error("Token rate limiter middleware error:", error);
      next(); // Continue even if rate limiter fails
    }
  };
};

/**
 * Middleware to record failed attempts after authentication fails
 * Should be used in error handling or after failed auth attempts
 * @param {string} endpoint - Endpoint name
 * @returns {Function} Express middleware
 */
const recordAuthFailure = (endpoint = "default") => {
  return async (req, res, next) => {
    try {
      if (req.rateLimit) {
        const { userId, tokenHash, ip } = req.rateLimit;

        await recordFailedAttempt({
          userId,
          tokenHash,
          ip,
          endpoint,
        });
      }
      next();
    } catch (error) {
      console.error("Record auth failure error:", error);
      next();
    }
  };
};

/**
 * Middleware to reset failed attempts on successful authentication
 * @param {string} endpoint - Endpoint name
 * @returns {Function} Express middleware
 */
const resetAuthAttempts = (endpoint = "default") => {
  return async (req, res, next) => {
    try {
      if (req.rateLimit && req.user) {
        await resetFailedAttempts({
          userId: req.user.id,
          endpoint,
        });
      }
      next();
    } catch (error) {
      console.error("Reset auth attempts error:", error);
      next();
    }
  };
};

/**
 * Middleware to add rate limit headers to response
 * @returns {Function} Express middleware
 */
const rateLimitHeaders = () => {
  return (req, res, next) => {
    // Store original json method to modify response
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Add rate limit headers if rate limit info is available
      if (req.rateLimit) {
        const { maxAttempts } = req.rateLimit;

        // Get current attempt count from cache
        const status =
          require("../services/rateLimiter.service").getRateLimitStatus({
            userId: req.rateLimit.userId,
            tokenHash: req.rateLimit.tokenHash,
            endpoint: req.rateLimit.endpoint,
          });

        const currentAttempts = status.user?.count || status.token?.count || 0;
        const remaining = Math.max(0, maxAttempts - currentAttempts);

        res.set({
          "X-RateLimit-Limit": String(maxAttempts),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(
            Math.floor((Date.now() + req.rateLimit.windowMs) / 1000),
          ),
        });
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * Middleware to check if request should be allowed based on rate limit
 * Can be used as a standalone check
 * @param {string} endpoint - Endpoint name
 * @returns {Function} Express middleware
 */
const checkRateLimit = (endpoint = "default") => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const tokenHash = token ? hashToken(token) : null;

      let userId = null;
      if (token) {
        try {
          const decoded = verifyAccessToken(token);
          userId = decoded.id;
        } catch (error) {
          // Token invalid
        }
      }

      const lockoutStatus = isUserLockedOut(userId, endpoint);
      const tokenBlockStatus =
        token && tokenHash
          ? isTokenBlocked(token, endpoint)
          : { isBlocked: false };

      if (lockoutStatus.isLocked || tokenBlockStatus.isBlocked) {
        return res.status(429).json({
          success: false,
          status: 429,
          message: lockoutStatus.isLocked
            ? lockoutStatus.reason
            : tokenBlockStatus.reason,
          retryAfter: lockoutStatus.isLocked
            ? Math.max(
                0,
                Math.ceil((lockoutStatus.lockoutUntil - Date.now()) / 1000),
              )
            : Math.max(
                0,
                Math.ceil((tokenBlockStatus.blockUntil - Date.now()) / 1000),
              ),
        });
      }

      next();
    } catch (error) {
      console.error("Check rate limit error:", error);
      next();
    }
  };
};

module.exports = {
  authRateLimiter,
  recordAuthFailure,
  resetAuthAttempts,
  rateLimitHeaders,
  checkRateLimit,
};
