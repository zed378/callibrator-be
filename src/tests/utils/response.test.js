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
  paginated,
  login,
} = require("../../utils/response");
const { createMockRes } = require("../test.utils");

describe("response utility", () => {
  describe("success", () => {
    it("should use null data when data argument is undefined", () => {
      const res = createMockRes();

      success(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Success",
        data: null,
      });
    });

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

      success(res, data, null, "Created", 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 201,
        message: "Created",
        data,
      });
    });

    it("should send success response with meta", () => {
      const res = createMockRes();
      const data = [{ id: 1 }, { id: 2 }];
      const meta = {
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      success(res, data, meta, "Fetched", 200);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Fetched",
        data,
        meta,
      });
    });

    it("should send success response with auth data (token and session)", () => {
      const res = createMockRes();
      const data = { id: 1, username: "test" };
      const authData = {
        token: "jwt_token_here",
        session: {
          id: "session-uuid",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-08T00:00:00Z",
        },
      };

      success(res, data, null, "Login successful", 200, authData);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Login successful",
        data,
        token: "jwt_token_here",
        session: {
          id: "session-uuid",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-08T00:00:00Z",
        },
      });
    });

    it("should not include meta when null", () => {
      const res = createMockRes();
      const data = { id: 1 };

      success(res, data, null, "Success", 200);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Success",
        data,
      });
    });

    it("should not include token/session when authData is null", () => {
      const res = createMockRes();
      const data = { id: 1 };

      success(res, data, null, "Success", 200, null);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Success",
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
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
        data: null,
      });
    });
  });

  describe("paginated", () => {
    it("should send paginated response with meta", () => {
      const res = createMockRes();
      res.query = { page: 1, limit: 20 };
      const rows = [{ id: 1 }, { id: 2 }];
      const count = 2;

      paginated(res, rows, count, "Fetched", 200);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Fetched",
        data: rows,
        meta: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
    });

    it("should send paginated response with custom counts", () => {
      const res = createMockRes();
      res.query = { page: 2, limit: 10 };
      const rows = [{ id: 11 }];
      const count = 50;
      const customCounts = { active: 30, inactive: 20 };

      paginated(res, rows, count, "Fetched", 200, customCounts);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Fetched",
        data: rows,
        meta: {
          total: 50,
          page: 2,
          limit: 10,
          totalPages: 5,
          customCounts,
        },
      });
    });
  });

  describe("login", () => {
    it("should send login response with token and session", () => {
      const res = createMockRes();
      const data = { id: "user-uuid", username: "test" };
      const token = "jwt_token_here";
      const session = {
        id: "session-uuid",
        createdAt: new Date("2024-01-01"),
        expiresAt: new Date("2024-01-08"),
      };

      login(res, data, token, session);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Login successful",
        data,
        token,
        session: {
          id: "session-uuid",
          createdAt: new Date("2024-01-01"),
          expiresAt: new Date("2024-01-08"),
        },
      });
    });

    it("should send login response with null session (session key omitted)", () => {
      const res = createMockRes();
      const data = { id: "user-uuid", username: "test" };
      const token = "jwt_token_here";

      login(res, data, token, null);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Login successful",
        data,
        token,
      });
    });
  });

  describe("success with authData edge cases", () => {
    it("should include only token when session is missing from authData", () => {
      const res = createMockRes();
      const data = { id: 1 };
      const authData = {
        token: "jwt_token_here",
      };

      success(res, data, null, "Success", 200, authData);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Success",
        data,
        token: "jwt_token_here",
      });
    });

    it("should include only session when token is missing from authData", () => {
      const res = createMockRes();
      const data = { id: 1 };
      const authData = {
        session: {
          id: "session-uuid",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-08T00:00:00Z",
        },
      };

      success(res, data, null, "Success", 200, authData);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Success",
        data,
        session: {
          id: "session-uuid",
          createdAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-08T00:00:00Z",
        },
      });
    });
  });

  describe("paginated without res.query", () => {
    it("should handle missing res.query gracefully", () => {
      const res = createMockRes();
      // Intentionally not setting res.query
      delete res.query;
      const rows = [{ id: 1 }, { id: 2 }];
      const count = 2;

      paginated(res, rows, count, "Fetched", 200);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Fetched",
        data: rows,
        meta: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
    });

    it("should use default status code 200 when statusCode is undefined", () => {
      const res = createMockRes();
      res.query = { page: 1, limit: 20 };
      const rows = [{ id: 1 }];
      const count = 1;

      paginated(res, rows, count, "Fetched", undefined);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Fetched",
        data: rows,
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
    });

    it("should use default message 'Success' when message is undefined", () => {
      const res = createMockRes();
      res.query = { page: 1, limit: 20 };
      const rows = [{ id: 1 }];
      const count = 1;

      paginated(res, rows, count, undefined, 200);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 200,
        message: "Success",
        data: rows,
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
    });
  });
});
