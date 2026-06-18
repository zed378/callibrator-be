/**
 * Tests for rate limiter service (coverage boost)
 *
 * These tests focus on coverage for rateLimiter.service.js functions
 * that were not previously tested. Uses jest.mock() for external deps.
 */

// Mock dependencies before importing service
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

jest.mock("../../models", () => ({
  Users: {
    findByPk: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
  },
  Sessions: {
    update: jest.fn().mockResolvedValue([1]),
  },
}));

jest.mock("../../utils/session", () => ({
  hashToken: jest.fn((token) => `hash:${token}`),
}));

jest.mock("../../utils/jwt", () => ({
  generateAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

// Import the module using require to get the actual mock export
const rl = () => require("../../services/rateLimiter.service");

describe("rateLimiter.service - coverage boost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rl().clearAllRateLimits();
  });

  describe("getRateLimitKey", () => {
    it("should build a composite key from userId and endpoint", () => {
      const key = rl().getRateLimitKey({ userId: "user-1", endpoint: "login" });
      expect(key).toBe("user:user-1|endpoint:login");
    });

    it("should include all dimensions when provided", () => {
      const key = rl().getRateLimitKey({
        userId: "user-1",
        tokenHash: "hash-abc",
        ip: "1.2.3.4",
        endpoint: "login",
      });
      expect(key).toBe(
        "user:user-1|token:hash-abc|ip:1.2.3.4|endpoint:login",
      );
    });

    it("should return 'unknown' when all params are null", () => {
      const key = rl().getRateLimitKey({});
      expect(key).toBe("unknown");
    });

    it("should include only non-null parts", () => {
      const key = rl().getRateLimitKey({ userId: "u1", ip: "1.2.3.4" });
      expect(key).toBe("user:u1|ip:1.2.3.4");
    });
  });

  describe("recordFailedAttempt", () => {
    it("should record a failed attempt for a user and return remaining attempts", async () => {
      const result = await rl().recordFailedAttempt({
        userId: "user-1",
        endpoint: "login",
      });
      expect(result.isLimited).toBe(false);
      expect(result.remainingAttempts).toBe(4); // 5 - 1
    });

    it("should return a result with default config for unknown endpoint", async () => {
      const result = await rl().recordFailedAttempt({
        userId: "user-1",
        endpoint: "unknownEndpoint",
      });
      expect(result.isLimited).toBe(false);
      expect(result.remainingAttempts).toBe(9); // default maxAttempts is 10
    });

    it("should not throw when called with no params", async () => {
      const result = await rl().recordFailedAttempt({});
      expect(result).toBeDefined();
      expect(result.isLimited).toBe(false);
    });

    it("should lock out user after exceeding max attempts", async () => {
      // Login maxAttempts = 5
      for (let i = 0; i < 5; i++) {
        await rl().recordFailedAttempt({
          userId: "user-lock",
          endpoint: "login",
        });
      }
      const result = await rl().recordFailedAttempt({
        userId: "user-lock",
        endpoint: "login",
      });
      expect(result.isLimited).toBe(true);
      expect(result.lockoutReason).toBeDefined();
    });

    it("should revoke token after 3 failures for same token", async () => {
      for (let i = 0; i < 3; i++) {
        await rl().recordFailedAttempt({
          tokenHash: "hash-abc",
          endpoint: "login",
        });
      }
      const result = await rl().recordFailedAttempt({
        tokenHash: "hash-abc",
        endpoint: "login",
      });
      expect(result.isLimited).toBe(true);
    });

    it("should reset counter when cache entry expires", async () => {
      jest.useFakeTimers();
      await rl().recordFailedAttempt({ userId: "user-exp", endpoint: "login" });
      // Advance past the 15-minute window
      jest.advanceTimersByTime(16 * 60 * 1000);
      const result = await rl().recordFailedAttempt({
        userId: "user-exp",
        endpoint: "login",
      });
      expect(result.remainingAttempts).toBe(4); // Reset to maxAttempts - 1
      jest.useRealTimers();
    });
  });

  describe("resetFailedAttempts", () => {
    it("should remove user rate limit entry from cache", async () => {
      await rl().recordFailedAttempt({ userId: "user-reset", endpoint: "login" });
      const cacheSize = rl().rateLimitCache.size;
      expect(cacheSize).toBeGreaterThan(0);
      await rl().resetFailedAttempts({
        userId: "user-reset",
        endpoint: "login",
      });
      const key = rl().getRateLimitKey({
        userId: "user-reset",
        endpoint: "login",
      });
      expect(rl().rateLimitCache.has(key)).toBe(false);
    });

    it("should remove token rate limit entry from cache", async () => {
      await rl().recordFailedAttempt({
        tokenHash: "hash-token",
        endpoint: "login",
      });
      await rl().resetFailedAttempts({
        tokenHash: "hash-token",
        endpoint: "login",
      });
      const key = rl().getRateLimitKey({
        tokenHash: "hash-token",
        endpoint: "login",
      });
      expect(rl().rateLimitCache.has(key)).toBe(false);
    });

    it("should not throw when called with no params", async () => {
      await expect(rl().resetFailedAttempts({})).resolves.toBeUndefined();
    });
  });

  describe("revokeTokenByHash", () => {
    it("should update Sessions when token is revoked", async () => {
      const { Sessions } = require("../../models");
      const result = await rl().revokeTokenByHash("hash-abc", "TEST_REVOKE");
      expect(result).toBe(true);
      expect(Sessions.update).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true }),
        expect.objectContaining({
          where: { tokenHash: "hash-abc", isRevoked: false },
        }),
      );
    });

    it("should return false when update throws", async () => {
      const { Sessions } = require("../../models");
      Sessions.update.mockRejectedValueOnce(new Error("DB error"));
      const result = await rl().revokeTokenByHash("hash-xyz", "ERROR");
      expect(result).toBe(false);
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all sessions for a user", async () => {
      const { Sessions } = require("../../models");
      const result = await rl().revokeAllUserTokens(
        "user-123",
        "SECURITY_TEST",
      );
      expect(result).toBe(1);
      expect(Sessions.update).toHaveBeenCalledWith(
        expect.objectContaining({ isRevoked: true }),
        expect.objectContaining({
          where: { userId: "user-123", isRevoked: false },
        }),
      );
    });

    it("should return 0 when update throws", async () => {
      const { Sessions } = require("../../models");
      Sessions.update.mockRejectedValueOnce(new Error("DB error"));
      const result = await rl().revokeAllUserTokens("user-bad", "ERROR");
      expect(result).toBe(0);
    });
  });

  describe("isTokenBlocked", () => {
    it("should return isBlocked false when no entry exists", () => {
      const result = rl().isTokenBlocked("test-token", "login");
      expect(result.isBlocked).toBe(false);
    });

    it("should return isBlocked true when token is blocked", () => {
      const { hashToken } = require("../../utils/session");
      const tokenHash = hashToken("blocked-token");
      const key = rl().getRateLimitKey({ tokenHash, endpoint: "login" });
      const now = Date.now();
      rl().rateLimitCache.set(key, {
        count: 10,
        createdAt: now,
        expiresAt: now + 60000,
        blocked: true,
        blockUntil: now + 60000,
      });
      const result = rl().isTokenBlocked("blocked-token", "login");
      expect(result.isBlocked).toBe(true);
      expect(result.reason).toBe("Token blocked due to suspicious activity");
    });
  });

  describe("isUserLockedOut", () => {
    it("should return isLocked false when no entry exists", () => {
      const result = rl().isUserLockedOut("user-new", "login");
      expect(result.isLocked).toBe(false);
    });

    it("should return isLocked true when user is locked", () => {
      const key = rl().getRateLimitKey({
        userId: "user-locked",
        endpoint: "login",
      });
      const now = Date.now();
      rl().rateLimitCache.set(key, {
        count: 5,
        createdAt: now,
        expiresAt: now + 900000,
        lockoutUntil: now + 900000,
      });
      const result = rl().isUserLockedOut("user-locked", "login");
      expect(result.isLocked).toBe(true);
      expect(result.remainingAttempts).toBe(0);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return status with user entry", () => {
      const key = rl().getRateLimitKey({
        userId: "user-status",
        endpoint: "login",
      });
      rl().rateLimitCache.set(key, {
        count: 2,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      });
      const status = rl().getRateLimitStatus({
        userId: "user-status",
        endpoint: "login",
      });
      expect(status.user).not.toBeNull();
      expect(status.user.count).toBe(2);
    });

    it("should return status with token entry", () => {
      const key = rl().getRateLimitKey({ tokenHash: "hash-status" });
      rl().rateLimitCache.set(key, {
        count: 1,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        blocked: false,
      });
      const status = rl().getRateLimitStatus({ tokenHash: "hash-status" });
      expect(status.token).not.toBeNull();
      expect(status.token.blocked).toBe(false);
    });

    it("should return empty status when no entries", () => {
      const status = rl().getRateLimitStatus({});
      expect(status).toEqual({});
    });

    it("should include IP status when provided", () => {
      const key = rl().getRateLimitKey({ ip: "10.0.0.1" });
      rl().rateLimitCache.set(key, {
        count: 3,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      });
      const status = rl().getRateLimitStatus({ ip: "10.0.0.1" });
      expect(status.ip).not.toBeNull();
      expect(status.ip.count).toBe(3);
    });
  });

  describe("admin functions", () => {
    it("clearAllRateLimits should clear the cache", () => {
      rl().rateLimitCache.set("key1", { count: 1 });
      rl().rateLimitCache.set("key2", { count: 2 });
      expect(rl().rateLimitCache.size).toBe(2);
      rl().clearAllRateLimits();
      expect(rl().rateLimitCache.size).toBe(0);
    });

    it("cleanupExpiredEntries should remove expired entries", () => {
      const now = Date.now();
      rl().rateLimitCache.set("expired", {
        count: 1,
        createdAt: now,
        expiresAt: now - 1000, // expired
      });
      rl().rateLimitCache.set("active", {
        count: 1,
        createdAt: now,
        expiresAt: now + 60000,
      });
      expect(rl().rateLimitCache.size).toBe(2);
      rl().cleanupExpiredEntries();
      expect(rl().rateLimitCache.size).toBe(1);
    });

    it("cleanupExpiredEntries should not remove non-expired entries", () => {
      const now = Date.now();
      rl().rateLimitCache.set("active1", {
        count: 1,
        createdAt: now,
        expiresAt: now + 60000,
      });
      rl().rateLimitCache.set("active2", {
        count: 2,
        createdAt: now,
        expiresAt: now + 120000,
      });
      rl().cleanupExpiredEntries();
      expect(rl().rateLimitCache.size).toBe(2);
    });
  });

  describe("RATE_LIMIT_CONFIG", () => {
    it("should have all expected endpoints", () => {
      const config = rl().RATE_LIMIT_CONFIG;
      expect(config.login).toBeDefined();
      expect(config.forgotPassword).toBeDefined();
      expect(config.resetPassword).toBeDefined();
      expect(config.register).toBeDefined();
      expect(config.default).toBeDefined();
    });

    it("should have maxAttempts, windowMs, and lockoutMs for each endpoint", () => {
      Object.values(rl().RATE_LIMIT_CONFIG).forEach((config) => {
        expect(config.maxAttempts).toBeDefined();
        expect(config.windowMs).toBeDefined();
        expect(config.lockoutMs).toBeDefined();
        expect(config.description).toBeDefined();
      });
    });

    it("login should have maxAttempts of 5", () => {
      expect(rl().RATE_LIMIT_CONFIG.login.maxAttempts).toBe(5);
    });

    it("forgotPassword should have maxAttempts of 3", () => {
      expect(rl().RATE_LIMIT_CONFIG.forgotPassword.maxAttempts).toBe(3);
    });
  });

  describe("authRateLimiter middleware", () => {
    it("should be a function", () => {
      expect(typeof rl().authRateLimiter("login")).toBe("function");
      expect(typeof rl().authRateLimiter("default")).toBe("function");
    });

    it("should use custom maxRequests when provided", () => {
      const mw = rl().authRateLimiter("default", 50, 60000);
      expect(typeof mw).toBe("function");
    });
  });
});
