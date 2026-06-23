/**
 * Tests for rate limiter service (coverage boost)
 *
 * Tests exported functions from rateLimiter.service.js.
 * Uses jest.mock() for external deps (models, session, jwt, activityLog).
 *
 * REDIS_URL is cleared to ensure rateLimitCache is a Map (not {}).
 */

// Override REDIS_URL BEFORE any modules load
const originalRedisUrl = process.env.REDIS_URL;
process.env.REDIS_URL = "";

let mockSessions = { update: jest.fn().mockResolvedValue([1]) };
let mockUsers = {
  findByPk: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({}),
};

jest.mock("../../services/emailQueue.service", () => ({
  processEmailQueue: jest.fn(),
  queueActivationEmail: jest.fn(),
  queueOtpEmail: jest.fn(),
  getQueueStats: jest.fn(),
  clearQueue: jest.fn(),
  closeRabbitMQ: jest.fn(),
}));

jest.mock("../../middlewares/activityLog", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../models", () => {
  mockSessions = {
    update: jest.fn().mockResolvedValue([1]),
  };
  mockUsers = {
    findByPk: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  };
  return {
    Users: mockUsers,
    Sessions: mockSessions,
  };
});

jest.mock("../../utils/session", () => ({
  hashToken: jest.fn((token) => `hash:${token}`),
}));

jest.mock("../../utils/jwt", () => ({
  generateAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

describe("rateLimiter.service - coverage boost", () => {
  let rl;

  beforeEach(() => {
    // Reset mock call history only — preserves mockResolvedValue / mockRejectedValue setup
    mockSessions.update.mockClear();
    mockUsers.findByPk.mockClear();
    mockUsers.update.mockClear();
    // Restore defaults
    mockSessions.update.mockResolvedValue([1]);
    mockUsers.findByPk.mockResolvedValue(null);

    // Clear the shared rate limit cache between tests
    rl = require("../../services/rateLimiter.service");
    if (rl.rateLimitCache) {
      rl.rateLimitCache.clear();
    }
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  describe("recordFailedAttempt", () => {
    it("should record a failed attempt for a user and return remaining attempts", async () => {
      const result = await rl.recordFailedAttempt({
        userId: "user-1",
        endpoint: "login",
      });
      expect(result.isLimited).toBe(false);
      expect(result.remainingAttempts).toBe(4);
    });

    it("should return a result with default config for unknown endpoint", async () => {
      const result = await rl.recordFailedAttempt({
        userId: "user-1",
        endpoint: "unknownEndpoint",
      });
      expect(result.isLimited).toBe(false);
      expect(result.remainingAttempts).toBe(9);
    });

    it("should not throw when called with no params", async () => {
      const result = await rl.recordFailedAttempt({});
      expect(result).toBeDefined();
      expect(result.isLimited).toBe(false);
    });

    it("should lock out user after exceeding max attempts", async () => {
      mockUsers.findByPk.mockResolvedValue({
        failedLoginAttempts: 0,
        update: jest.fn().mockResolvedValue({}),
      });
      for (let i = 0; i < 5; i++) {
        await rl.recordFailedAttempt({
          userId: "user-lock",
          endpoint: "login",
        });
      }
      const result = await rl.recordFailedAttempt({
        userId: "user-lock",
        endpoint: "login",
      });
      expect(result.isLimited).toBe(true);
      expect(result.lockoutReason).toBeDefined();
    });

    it("should handle error when updating user lockout", async () => {
      mockUsers.findByPk.mockResolvedValue({
        failedLoginAttempts: 0,
        update: jest.fn().mockRejectedValue(new Error("DB Update Failed")),
      });
      for (let i = 0; i < 6; i++) {
        await rl.recordFailedAttempt({
          userId: "user-lock-error",
          endpoint: "login",
        });
      }
      expect(require("../../middlewares/activityLog").logger.error).toHaveBeenCalled();
    });

    it("should handle token-based rate limiting", async () => {
      for (let i = 0; i < 10; i++) {
        await rl.recordFailedAttempt({
          tokenHash: "hash-token",
          endpoint: "login",
        });
      }
      const result = await rl.recordFailedAttempt({
        tokenHash: "hash-token",
        endpoint: "login",
      });
      expect(result.isLimited).toBe(true);
    });

    it("should handle error when revoking token due to brute force", async () => {
      mockSessions.update.mockRejectedValueOnce(new Error("Revoke Failed"));
      for (let i = 0; i < 4; i++) {
        await rl.recordFailedAttempt({
          tokenHash: "hash-token-error",
          endpoint: "login",
        });
      }
      expect(require("../../middlewares/activityLog").logger.error).toHaveBeenCalled();
    });

    it("should handle IP-based rate limiting", async () => {
      for (let i = 0; i < 10; i++) {
        await rl.recordFailedAttempt({
          ip: "10.0.0.1",
          endpoint: "register",
        });
      }
      const result = await rl.recordFailedAttempt({
        ip: "10.0.0.1",
        endpoint: "register",
      });
      expect(result.isLimited).toBe(true);
    });
  });

  describe("resetFailedAttempts", () => {
    it("should remove user rate limit entry from cache", async () => {
      await rl.recordFailedAttempt({ userId: "user-reset", endpoint: "login" });
      expect(rl.rateLimitCache.size).toBeGreaterThan(0);
      mockUsers.update.mockResolvedValue([1]);
      await rl.resetFailedAttempts({
        userId: "user-reset",
        endpoint: "login",
      });
      expect(rl.rateLimitCache.has("user:user-reset|endpoint:login")).toBe(false);
    });

    it("should handle error when resetting user failed attempts", async () => {
      mockUsers.update.mockRejectedValueOnce(new Error("Reset Failed"));
      await rl.resetFailedAttempts({
        userId: "user-reset-error",
        endpoint: "login",
      });
      expect(require("../../middlewares/activityLog").logger.error).toHaveBeenCalled();
    });

    it("should remove token rate limit entry from cache", async () => {
      await rl.recordFailedAttempt({
        tokenHash: "hash-token",
        endpoint: "login",
      });
      await rl.resetFailedAttempts({
        tokenHash: "hash-token",
        endpoint: "login",
      });
      expect(rl.rateLimitCache.has("token:hash-token|endpoint:login")).toBe(false);
    });

    it("should not throw when called with no params", async () => {
      await expect(rl.resetFailedAttempts({})).resolves.toBeUndefined();
    });
  });

  describe("revokeTokenByHash", () => {
    it("should update Sessions when token is revoked", async () => {
      mockSessions.update.mockResolvedValue([1]);
      const result = await rl.revokeTokenByHash("hash-abc", "TEST_REVOKE");
      expect(result).toBe(true);
      expect(mockSessions.update).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true }),
        expect.objectContaining({
          where: { tokenHash: "hash-abc", isRevoked: false },
        }),
      );
    });

    it("should return false when update throws", async () => {
      mockSessions.update.mockRejectedValueOnce(new Error("DB error"));
      const result = await rl.revokeTokenByHash("hash-xyz", "ERROR");
      expect(result).toBe(false);
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all sessions for a user", async () => {
      mockSessions.update.mockResolvedValue([1]);
      const result = await rl.revokeAllUserTokens(
        "user-123",
        "SECURITY_TEST",
      );
      expect(result).toBe(1);
      expect(mockSessions.update).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true }),
        expect.objectContaining({
          where: { userId: "user-123", isRevoked: false },
        }),
      );
    });

    it("should return 0 when update throws", async () => {
      // Note: beforeEach already sets up mockResolvedValue([1])
      // We need to set mockRejectedValueOnce on the SAME mock reference
      mockSessions.update.mockRejectedValueOnce(new Error("DB error"));
      const result = await rl.revokeAllUserTokens("user-bad", "ERROR");
      expect(result).toBe(0);
    });
  });

  describe("isTokenBlocked", () => {
    it("should return isBlocked false when no entry exists", () => {
      const result = rl.isTokenBlocked("test-token", "login");
      expect(result.isBlocked).toBe(false);
    });

    it("should return isBlocked true when token is blocked", () => {
      const { hashToken } = require("../../utils/session");
      const tokenHash = hashToken("blocked-token");
      const key = `token:${tokenHash}|endpoint:login`;
      const now = Date.now();
      rl.rateLimitCache.set(key, {
        count: 10,
        createdAt: now,
        expiresAt: now + 60000,
        blocked: true,
        blockUntil: now + 60000,
      });
      const result = rl.isTokenBlocked("blocked-token", "login");
      expect(result.isBlocked).toBe(true);
      expect(result.reason).toBe("Token blocked due to suspicious activity");
    });
  });

  describe("isUserLockedOut", () => {
    it("should return isLocked false when no entry exists", () => {
      const result = rl.isUserLockedOut("user-new", "login");
      expect(result.isLocked).toBe(false);
    });

    it("should return isLocked true when user is locked", () => {
      const key = "user:user-locked|endpoint:login";
      const now = Date.now();
      rl.rateLimitCache.set(key, {
        count: 5,
        createdAt: now,
        expiresAt: now + 900000,
        lockoutUntil: now + 900000,
      });
      const result = rl.isUserLockedOut("user-locked", "login");
      expect(result.isLocked).toBe(true);
      expect(result.remainingAttempts).toBe(0);
    });

    it("should return false when lockout has expired", () => {
      const key = "user-expired|endpoint:login";
      const now = Date.now();
      rl.rateLimitCache.set(key, {
        count: 5,
        createdAt: now - 1000000,
        expiresAt: now - 100000,
        lockoutUntil: now - 100000,
      });
      const result = rl.isUserLockedOut("user-expired", "login");
      expect(result.isLocked).toBe(false);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return status with user entry", () => {
      const key = "user:user-status|endpoint:login";
      rl.rateLimitCache.set(key, {
        count: 2,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      });
      const status = rl.getRateLimitStatus({
        userId: "user-status",
        endpoint: "login",
      });
      expect(status.user).not.toBeNull();
      expect(status.user.count).toBe(2);
    });

    it("should return status with token entry", () => {
      const key = "token:hash-status";
      rl.rateLimitCache.set(key, {
        count: 1,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        blocked: false,
      });
      const status = rl.getRateLimitStatus({ tokenHash: "hash-status" });
      expect(status.token).not.toBeNull();
      // Service returns 'isBlocked' not 'blocked'
      expect(status.token.isBlocked).toBe(false);
    });

    it("should return empty status when no entries", () => {
      const status = rl.getRateLimitStatus({});
      expect(status).toEqual({});
    });

    it("should include IP status when provided", () => {
      const key = "ip:10.0.0.1";
      rl.rateLimitCache.set(key, {
        count: 3,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      });
      const status = rl.getRateLimitStatus({ ip: "10.0.0.1" });
      expect(status.ip).not.toBeNull();
      expect(status.ip.count).toBe(3);
    });
  });

  describe("admin functions", () => {
    it("clearAllRateLimits should clear the cache", () => {
      const beforeSize = rl.rateLimitCache.size;
      rl.rateLimitCache.set("key1", { count: 1 });
      rl.rateLimitCache.set("key2", { count: 2 });
      expect(rl.rateLimitCache.size).toBe(beforeSize + 2);
      rl.clearAllRateLimits();
      expect(rl.rateLimitCache.size).toBe(0);
    });

    it("cleanupExpiredEntries should remove expired entries", () => {
      rl.rateLimitCache.clear();
      const now = Date.now();
      rl.rateLimitCache.set("expired", {
        count: 1,
        createdAt: now,
        expiresAt: now - 1000,
      });
      rl.rateLimitCache.set("active", {
        count: 1,
        createdAt: now,
        expiresAt: now + 60000,
      });
      expect(rl.rateLimitCache.size).toBe(2);
      rl.cleanupExpiredEntries();
      expect(rl.rateLimitCache.size).toBe(1);
    });

    it("cleanupExpiredEntries should not remove non-expired entries", () => {
      rl.rateLimitCache.clear();
      const now = Date.now();
      rl.rateLimitCache.set("active1", {
        count: 1,
        createdAt: now,
        expiresAt: now + 60000,
      });
      rl.rateLimitCache.set("active2", {
        count: 2,
        createdAt: now,
        expiresAt: now + 120000,
      });
      rl.cleanupExpiredEntries();
      expect(rl.rateLimitCache.size).toBe(2);
    });

    it("cleanupExpiredEntries should handle empty cache", () => {
      expect(() => rl.cleanupExpiredEntries()).not.toThrow();
    });
  });

  describe("RATE_LIMIT_CONFIG", () => {
    it("should have all expected endpoints", () => {
      const config = rl.RATE_LIMIT_CONFIG;
      expect(config.login).toBeDefined();
      expect(config.forgotPassword).toBeDefined();
      expect(config.resetPassword).toBeDefined();
      expect(config.register).toBeDefined();
      expect(config.default).toBeDefined();
    });

    it("should have maxAttempts, windowMs, and lockoutMs for each endpoint", () => {
      Object.values(rl.RATE_LIMIT_CONFIG).forEach((config) => {
        expect(config.maxAttempts).toBeDefined();
        expect(config.windowMs).toBeDefined();
        expect(config.lockoutMs).toBeDefined();
        expect(config.description).toBeDefined();
      });
    });

    it("login should have maxAttempts of 5", () => {
      expect(rl.RATE_LIMIT_CONFIG.login.maxAttempts).toBe(5);
    });

    it("forgotPassword should have maxAttempts of 3", () => {
      expect(rl.RATE_LIMIT_CONFIG.forgotPassword.maxAttempts).toBe(3);
    });

    it("register should have maxAttempts of 3", () => {
      expect(rl.RATE_LIMIT_CONFIG.register.maxAttempts).toBe(3);
    });
  });

  describe("authRateLimiter middleware", () => {
    it("should be a function", () => {
      expect(typeof rl.authRateLimiter("login")).toBe("function");
      expect(typeof rl.authRateLimiter("default")).toBe("function");
    });

    it("should use custom maxRequests when provided", () => {
      const mw = rl.authRateLimiter("default", 50, 60000);
      expect(typeof mw).toBe("function");
    });

    it("should allow requests under the limit and set headers", async () => {
      const mw = rl.authRateLimiter("default", 2, 60000);
      const req = {
        headers: {},
        ip: "127.0.0.1",
        socket: {},
      };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await mw(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith("X-RateLimit-Limit", "2");
      expect(res.set).toHaveBeenCalledWith("X-RateLimit-Remaining", "1");
    });

    it("should block requests over the limit", async () => {
      const mw = rl.authRateLimiter("default", 1, 60000);
      const req = {
        headers: { "x-forwarded-for": "10.0.0.2" },
        user: { id: "user-123" },
        tokenHash: "hash-456",
        socket: {},
      };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // First request (should pass)
      await mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request (should be blocked)
      await mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1); // not called again
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Too many requests"),
        }),
      );
    });

    it("should handle custom default error message when description is not defined", async () => {
      const originalDescription = rl.RATE_LIMIT_CONFIG.default.description;
      rl.RATE_LIMIT_CONFIG.default.description = null;

      const mw = rl.authRateLimiter("default", 1, 60000);
      const req = {
        headers: {},
        ip: "10.0.0.99",
        socket: {},
      };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await mw(req, res, next); // Pass
      await mw(req, res, next); // Blocked

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Too many requests. Please try again later.",
        }),
      );

      rl.RATE_LIMIT_CONFIG.default.description = originalDescription;
    });

    it("should reset window when expired", async () => {
      const mw = rl.authRateLimiter("default", 1, -1000); // Window expired immediately
      const req = {
        headers: {},
        ip: "10.0.0.3",
        socket: {},
      };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // First request
      await mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request (window expired, so it should reset and pass)
      await mw(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);
    });
  });
});
