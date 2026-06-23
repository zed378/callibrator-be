/**
 * Tests for errorHandler middleware
 */
jest.mock("../../middlewares/activityLog", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const { errorHandler } = require("../../middlewares/errorHandlers");
const { logger } = require("../../middlewares/activityLog");

describe("errorHandler middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      requestId: "test-req-123",
      method: "GET",
      originalUrl: "/api/test",
      ip: "127.0.0.1",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it("should return error response with given status and message", () => {
    const err = { status: 404, message: "Not found", stack: "stack..." };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 404,
        message: "Not found",
        requestId: "test-req-123",
      }),
    );
  });

  it("should default to 500 when no status provided", () => {
    const err = { message: "Something broke" };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("should default message to 'Internal server error'", () => {
    const err = {};

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Internal server error",
      }),
    );
  });

  it("should log error with Winston", () => {
    const err = { status: 400, message: "Bad request", stack: "error stack" };

    errorHandler(err, req, res, next);

    expect(logger.error).toHaveBeenCalledWith("Bad request", expect.objectContaining({
      requestId: "test-req-123",
      statusCode: 400,
      method: "GET",
      url: "/api/test",
      ip: "127.0.0.1",
    }));
  });

  it("should include validation errors if present", () => {
    const err = { status: 422, message: "Validation failed", errors: [{ field: "email" }] };

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [{ field: "email" }],
      }),
    );
  });

  it("should include stack trace in non-production", () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const err = { status: 500, message: "Error", stack: "Error\n  at line 1" };

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: "Error\n  at line 1",
      }),
    );

    process.env.NODE_ENV = origEnv;
  });

  it("should not include stack in production", () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const err = { status: 500, message: "Error", stack: "Error\n  at line 1" };

    errorHandler(err, req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.stack).toBeUndefined();

    process.env.NODE_ENV = origEnv;
  });

  it("should handle missing requestId", () => {
    delete req.requestId;
    const err = { status: 500, message: "Error" };

    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "unknown",
      }),
    );
  });
});
