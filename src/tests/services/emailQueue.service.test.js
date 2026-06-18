const amqplibMock = {
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn().mockReturnValue(true),
      consume: jest.fn(),
      prefetch: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
      purgeQueue: jest.fn().mockResolvedValue(undefined),
      checkQueue: jest.fn().mockResolvedValue({ messageCount: 5 }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    isOpen: true,
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  }),
};

jest.mock("amqplib", () => amqplibMock);
jest.mock("../../services/email.service", () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(true),
  sendActivationEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../middlewares/activityLog", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  processEmailQueue,
  queueActivationEmail,
  queueOtpEmail,
  getQueueStats,
  clearQueue,
  closeRabbitMQ,
} = require("../../services/emailQueue.service");

describe("emailQueue.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("queueActivationEmail", () => {
    it("should queue an activation email job", async () => {
      const result = await queueActivationEmail({
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        activationLink: "https://example.com/act?token=***",
      });
      expect(result).toBe(true);
    });
  });

  describe("queueOtpEmail", () => {
    it("should queue an OTP email job", async () => {
      const result = await queueOtpEmail({
        email: "user@example.com",
        firstName: "Test",
        lastName: "User",
        otp: "123456",
      });
      expect(result).toBe(true);
    });
  });

  describe("getQueueStats", () => {
    it("should return queue stats when connected", async () => {
      const result = await getQueueStats();
      expect(result.status).toBe("connected");
      expect(typeof result.processedAt).toBe("string");
    });
  });

  describe("clearQueue", () => {
    it("should clear the email queue", async () => {
      const result = await clearQueue();
      expect(result).toBe(true);
    });
  });

  describe("closeRabbitMQ", () => {
    it("should close RabbitMQ connection", async () => {
      await closeRabbitMQ();
    });
  });

  describe("processEmailQueue", () => {
    it("should be a function", () => {
      expect(typeof processEmailQueue).toBe("function");
    });
  });
});
