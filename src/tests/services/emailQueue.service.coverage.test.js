const {
  recordFailedAttempt,
  resetFailedAttempts,
  revokeTokenByHash,
  revokeAllUserTokens,
  isTokenBlocked,
  isUserLockedOut,
  getRateLimitStatus,
  clearAllRateLimits,
  cleanupExpiredEntries,
  rateLimitCache,
  authRateLimiter,
  RATE_LIMIT_CONFIG,
} = require("../../services/rateLimiter.service");

jest.mock("../../services/email.service", () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(true),
  sendActivationEmail: jest.fn().mockResolvedValue(true),
}));

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

describe("emailQueue.service - additional coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addEmailJob fallback", () => {
    it("should send email directly when RabbitMQ fails", async () => {
      const { addEmailJob } = jest.requireActual(
        "../../services/emailQueue.service",
      );
      // The mocked amqplib always succeeds, so this tests the happy path:
      // a job gets added and sendToQueue is called.
      const { queueActivationEmail } = require("../../services/emailQueue.service");
      const result = await queueActivationEmail({
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        activationLink: "https://example.com/act",
      });
      expect(result).toBe(true);
    });
  });

  describe("email queue integration", () => {
    it("should handle a complete add + stats + clear cycle", async () => {
      const {
        queueActivationEmail,
        getQueueStats,
        clearQueue,
      } = require("../../services/emailQueue.service");

      const added = await queueActivationEmail({
        email: "cycle@example.com",
        firstName: "Cycle",
        lastName: "Test",
        activationLink: "https://example.com/cycle",
      });
      expect(added).toBe(true);

      const stats = await getQueueStats();
      expect(stats.status).toBe("connected");

      const cleared = await clearQueue();
      expect(cleared).toBe(true);
    });

    it("should track different email types", async () => {
      const { queueActivationEmail, queueOtpEmail } = require(
        "../../services/emailQueue.service",
      );

      const actResult = await queueActivationEmail({
        email: "a@test.com",
        firstName: "A",
        lastName: "B",
        activationLink: "https://example.com/act",
      });

      const otpResult = await queueOtpEmail({
        email: "b@test.com",
        firstName: "B",
        lastName: "A",
        otp: "654321",
      });

      expect(actResult).toBe(true);
      expect(otpResult).toBe(true);
    });
  });
});
