/**
 * Tests for response.js utility
 */

const {
  success,
  error,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
} = require("../../utils/response");
const { createMockRes } = require("../test.utils");

describe("response utility", () => {
  describe("success", () => {
    it("should send success response with data and default message", () => {
      const res = createMockRes();
      const data = { id: 1, name: "test" };

      success(res, data);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Success",
        data,
      });
    });

    it("should send success response with custom message and status", () => {
      const res = createMockRes();
      const data = { id: 1 };

      success(res, data, "Created", 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 201,
        message: "Created",
        data,
      });
    });
  });

  describe("error", () => {
    it("should send error response with default status 500", () => {
      const res = createMockRes();

      error(res, "Something went wrong");

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 500,
        message: "Something went wrong",
      });
    });

    it("should send error response with custom status code", () => {
      const res = createMockRes();

      error(res, "Bad request", 400);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: "Bad request",
      });
    });

    it("should include details in non-production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      const res = createMockRes();
      const details = { field: "email", reason: "invalid" };

      error(res, "Validation failed", 400, details);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: "Validation failed",
        details,
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("should not include details in production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      const res = createMockRes();
      const details = { field: "email", reason: "invalid" };

      error(res, "Validation failed", 400, details);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: "Validation failed",
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("notFound", () => {
    it("should send 404 response with default message", () => {
      const res = createMockRes();

      notFound(res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 404,
        message: "Resource not found",
      });
    });

    it("should send 404 response with custom message", () => {
      const res = createMockRes();

      notFound(res, "User not found");

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 404,
        message: "User not found",
      });
    });
  });

  describe("badRequest", () => {
    it("should send 400 response with default message", () => {
      const res = createMockRes();

      badRequest(res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: "Bad request",
      });
    });

    it("should send 400 response with custom message", () => {
      const res = createMockRes();

      badRequest(res, "Invalid email format");

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: "Invalid email format",
      });
    });
  });

  describe("unauthorized", () => {
    it("should send 401 response with default message", () => {
      const res = createMockRes();

      unauthorized(res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 401,
        message: "Unauthorized",
      });
    });

    it("should send 401 response with custom message", () => {
      const res = createMockRes();

      unauthorized(res, "Session expired");

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 401,
        message: "Session expired",
      });
    });
  });

  describe("forbidden", () => {
    it("should send 403 response with default message", () => {
      const res = createMockRes();

      forbidden(res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 403,
        message: "Forbidden",
      });
    });

    it("should send 403 response with custom message", () => {
      const res = createMockRes();

      forbidden(res, "Insufficient permissions");

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 403,
        message: "Insufficient permissions",
      });
    });
  });
});
