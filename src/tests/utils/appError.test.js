/**
 * Tests for appError.js custom error classes
 */

const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  LockedError,
  InternalServerError,
} = require("../../utils/appError");
const { createMockRes } = require("./test.utils");

describe("AppError", () => {
  it("should extend native Error", () => {
    const error = new AppError(500, "Test error");
    expect(error).toBeInstanceOf(Error);
  });

  it("should set status, message, isOperational, and details", () => {
    const details = { field: "email", reason: "invalid" };
    const error = new AppError(400, "Bad request", true, details);

    expect(error.status).toBe(400);
    expect(error.message).toBe("Bad request");
    expect(error.isOperational).toBe(true);
    expect(error.details).toEqual(details);
  });

  it("should have default values for isOperational and details", () => {
    const error = new AppError(500, "Server error");

    expect(error.status).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeNull();
  });

  it("should have proper stack trace", () => {
    const error = new AppError(500, "Test error");
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe("string");
  });

  describe("toJSON", () => {
    it("should return error as JSON object without details in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      const error = new AppError(400, "Bad request", true, { field: "email" });

      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        status: 400,
        message: "Bad request",
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("should return error as JSON object with details in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      const error = new AppError(400, "Bad request", true, { field: "email" });

      const json = error.toJSON();

      expect(json).toEqual({
        success: false,
        status: 400,
        message: "Bad request",
        details: { field: "email" },
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe("BadRequestError", () => {
  it("should create error with status 400", () => {
    const error = new BadRequestError();
    expect(error.status).toBe(400);
    expect(error.message).toBe("Bad request");
    expect(error.isOperational).toBe(true);
  });

  it("should accept custom message", () => {
    const error = new BadRequestError("Invalid input");
    expect(error.message).toBe("Invalid input");
  });
});

describe("UnauthorizedError", () => {
  it("should create error with status 401", () => {
    const error = new UnauthorizedError();
    expect(error.status).toBe(401);
    expect(error.message).toBe("Unauthorized");
    expect(error.isOperational).toBe(true);
  });
});

describe("ForbiddenError", () => {
  it("should create error with status 403", () => {
    const error = new ForbiddenError();
    expect(error.status).toBe(403);
    expect(error.message).toBe("Forbidden");
    expect(error.isOperational).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("should create error with status 404", () => {
    const error = new NotFoundError();
    expect(error.status).toBe(404);
    expect(error.message).toBe("Resource not found");
    expect(error.isOperational).toBe(true);
  });

  it("should accept custom message", () => {
    const error = new NotFoundError("User not found");
    expect(error.message).toBe("User not found");
  });
});

describe("ConflictError", () => {
  it("should create error with status 409", () => {
    const error = new ConflictError();
    expect(error.status).toBe(409);
    expect(error.message).toBe("Conflict");
    expect(error.isOperational).toBe(true);
  });
});

describe("TooManyRequestsError", () => {
  it("should create error with status 429", () => {
    const error = new TooManyRequestsError();
    expect(error.status).toBe(429);
    expect(error.message).toBe("Too many requests");
    expect(error.isOperational).toBe(true);
  });
});

describe("LockedError", () => {
  it("should create error with status 423", () => {
    const error = new LockedError();
    expect(error.status).toBe(423);
    expect(error.message).toBe("Account locked");
    expect(error.isOperational).toBe(true);
  });
});

describe("InternalServerError", () => {
  it("should create error with status 500", () => {
    const error = new InternalServerError();
    expect(error.status).toBe(500);
    expect(error.message).toBe("Internal server error");
    expect(error.isOperational).toBe(false);
  });

  it("should accept details", () => {
    const details = { stack: "Error stack trace" };
    const error = new InternalServerError("Server error", details);
    expect(error.details).toEqual(details);
  });
});
