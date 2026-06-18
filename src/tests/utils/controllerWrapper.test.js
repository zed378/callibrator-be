/**
 * Tests for controllerWrapper.js utility
 */

const {
  asyncHandler,
  asyncHandlerWithMapping,
} = require("../../utils/controllerWrapper");
const {
  createMockRes,
  createMockReq,
  createMockNext,
} = require("./test.utils");

describe("asyncHandler", () => {
  it("should call the async function with req, res, next", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(fn);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it("should catch async errors and send error response", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("Async error"));
    const handler = asyncHandler(fn);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(fn).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 500,
        message: "Async error",
      }),
    );
  });

  it("should not call error handler on success", async () => {
    const fn = jest.fn().mockResolvedValue({ data: "test" });
    const handler = asyncHandler(fn);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(fn).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("asyncHandlerWithMapping", () => {
  it("should call the async function with req, res, next", async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const handler = asyncHandlerWithMapping(fn);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(fn).toHaveBeenCalledWith(req, res, next);
  });

  it("should map error message patterns to status codes", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("user not found"));
    const handler = asyncHandlerWithMapping(fn, { "not found": 404 });
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 404,
        message: "user not found",
      }),
    );
  });

  it("should default to 500 for unmapped errors", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("Unknown error"));
    const handler = asyncHandlerWithMapping(fn, { "not found": 404 });
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 500,
        message: "Unknown error",
      }),
    );
  });

  it("should handle credentials error mapping", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("invalid credentials"));
    const handler = asyncHandlerWithMapping(fn, { credentials: 401 });
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        status: 401,
        message: "invalid credentials",
      }),
    );
  });

  it("should not call error handler on success", async () => {
    const fn = jest.fn().mockResolvedValue({ data: "test" });
    const handler = asyncHandlerWithMapping(fn);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await handler(req, res, next);

    expect(fn).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
