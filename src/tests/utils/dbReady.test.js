/**
 * dbReady utility tests
 */
const { waitForDbReady } = require("../../utils/dbReady");
const { logger } = require("../../middlewares/activityLog");

describe("waitForDbReady", () => {
  let mockSequelize;
  let mockAuthenticate;
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockAuthenticate = jest.fn();
    mockQuery = jest.fn();

    mockSequelize = {
      authenticate: mockAuthenticate,
      query: mockQuery,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("successful connection", () => {
    it("should resolve on first attempt when DB is immediately ready", async () => {
      mockAuthenticate.mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([1]);

      const result = await waitForDbReady(mockSequelize, {
        maxAttempts: 5,
        delayMs: 100,
      });

      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith("SELECT 1");
      expect(result).toMatch(/Database connection established/);
    });

    it("should use default maxAttempts and delayMs", async () => {
      mockAuthenticate.mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([1]);

      const result = await waitForDbReady(mockSequelize);

      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it("should include attempt count in message", async () => {
      mockAuthenticate.mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([1]);

      const result = await waitForDbReady(mockSequelize, {
        maxAttempts: 3,
        delayMs: 50,
      });

      expect(result).toContain("attempt 1");
    });
  });

  describe("failed connection with retry", () => {
    it("should retry when authenticate fails then succeed on second attempt", async () => {
      const retryError = new Error("Connection refused");
      mockAuthenticate
        .mockRejectedValueOnce(retryError)
        .mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([1]);

      const promise = waitForDbReady(mockSequelize, {
        maxAttempts: 3,
        delayMs: 100,
      });

      jest.runOnlyPendingTimers();

      const result = await promise;

      expect(mockAuthenticate).toHaveBeenCalledTimes(2);
      expect(result).toContain("Database connection established");
      expect(result).toContain("attempt 2");
    });

    it("should retry up to maxAttempts before rejecting", async () => {
      const maxAttempts = 3;
      const retryError = new Error("Connection refused");
      mockAuthenticate.mockRejectedValue(retryError);
      mockQuery.mockRejectedValue(retryError);

      await expect(
        waitForDbReady(mockSequelize, {
          maxAttempts: maxAttempts,
          delayMs: 100,
        }),
      ).rejects.toThrow(`Database not ready after ${maxAttempts} attempts`);

      expect(mockAuthenticate).toHaveBeenCalledTimes(maxAttempts);
    });

    it("should fail immediately when attempt 0 already exceeds maxAttempts", async () => {
      mockAuthenticate.mockRejectedValue(new Error("Connection refused"));

      await expect(
        waitForDbReady(mockSequelize, {
          maxAttempts: 0,
          delayMs: 100,
        }),
      ).rejects.toThrow("Database not ready after 0 attempts");
    });

    it("should log warn on each failed attempt", async () => {
      const retryError = new Error("Connection refused");
      mockAuthenticate
        .mockRejectedValueOnce(retryError)
        .mockRejectedValueOnce(retryError)
        .mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([1]);

      const promise = waitForDbReady(mockSequelize, {
        maxAttempts: 5,
        delayMs: 50,
      });

      jest.runOnlyPendingTimers();
      const result = await promise;

      expect(result).toContain("Database connection established");
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should log error when all attempts exhausted", async () => {
      mockAuthenticate.mockRejectedValue(new Error("Connection refused"));

      await expect(
        waitForDbReady(mockSequelize, {
          maxAttempts: 2,
          delayMs: 50,
        }),
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("query fails but authenticate succeeds", () => {
    it("should retry when authenticate succeeds but query fails", async () => {
      const queryError = new Error("Query failed");
      mockAuthenticate
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      mockQuery.mockRejectedValueOnce(queryError).mockResolvedValueOnce([1]);

      const promise = waitForDbReady(mockSequelize, {
        maxAttempts: 3,
        delayMs: 50,
      });

      jest.runOnlyPendingTimers();
      const result = await promise;

      expect(mockAuthenticate).toHaveBeenCalledTimes(2);
      expect(result).toContain("Database connection established");
    });
  });

  describe("custom configuration", () => {
    it("should use custom maxAttempts", async () => {
      mockAuthenticate.mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([1]);

      const result = await waitForDbReady(mockSequelize, {
        maxAttempts: 20,
        delayMs: 500,
      });

      expect(result).toBeDefined();
    });

    it("should pass through attempt number in recursive calls", async () => {
      const errors = [];
      for (let i = 0; i < 2; i++) {
        errors.push(new Error(`Attempt ${i + 1} failed`));
      }

      mockAuthenticate
        .mockRejectedValueOnce(errors[0])
        .mockRejectedValueOnce(errors[1])
        .mockResolvedValueOnce(undefined);
      mockQuery.mockResolvedValueOnce([1]);

      const promise = waitForDbReady(mockSequelize, {
        maxAttempts: 5,
        delayMs: 50,
      });

      jest.runOnlyPendingTimers();
      const result = await promise;

      expect(result).toContain("attempt 3");
    });
  });
});
