/**
 * Tests for Auth Middleware
 */

const { auth } = require("../../middlewares/auth");

// Mock JWT utilities
jest.mock("../../utils/jwt", () => ({
  verifyAccessToken: jest.fn(),
}));

const { verifyAccessToken } = require("../../utils/jwt");

// Mock services
jest.mock("../../services/session.service", () => ({
  SessionService: {
    findByToken: jest.fn(),
  },
}));

jest.mock("../../services/redis.service", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

describe("auth Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    next = jest.fn();
    req = {
      headers: {
        authorization: "Bearer test-token",
      },
      cookies: {},
    };
    res = {};
  });

  describe("token extraction", () => {
    it("should extract Bearer token from Authorization header", () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        roleId: "role-1",
        tenantId: "tenant-1",
        status: "ACTIVE",
      };

      verifyAccessToken.mockReturnValue({ sub: "user-1" });
      require("../../services/session.service").SessionService.findByPk = jest
        .fn()
        .mockResolvedValue({ userId: "user-1" });

      auth(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return 401 when no Authorization header", () => {
      req.headers.authorization = null;

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 401,
        message: "Authentication required",
        data: null,
      });
    });

    it("should return 401 when Authorization header is malformed", () => {
      req.headers.authorization = "InvalidToken";

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("token verification", () => {
    it("should return 401 when token is invalid", () => {
      verifyAccessToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 401,
        message: "Invalid or expired token",
        data: null,
      });
    });

    it("should attach user to request when token is valid", () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
        roleId: "role-1",
        tenantId: "tenant-1",
        status: "ACTIVE",
        role: { name: "SUPER_ADMIN", roleLevel: 3 },
        tenant: { id: "tenant-1", name: "Test Tenant" },
      };

      verifyAccessToken.mockReturnValue({ sub: "user-1" });
      require("../../models").Users.findOne = jest
        .fn()
        .mockResolvedValue(mockUser);
      require("../../services/session.service").SessionService.findByPk = jest
        .fn()
        .mockResolvedValue({ userId: "user-1" });

      auth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.email).toBe("test@example.com");
    });
  });

  describe("user status validation", () => {
    it("should return 403 when user is banned", () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        isBanned: true,
        status: "ACTIVE",
      };

      verifyAccessToken.mockReturnValue({ sub: "user-1" });
      require("../../models").Users.findOne = jest
        .fn()
        .mockResolvedValue(mockUser);

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 403,
        message: "Account is banned",
        data: null,
      });
    });

    it("should return 403 when user is inactive", () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        status: "INACTIVE",
      };

      verifyAccessToken.mockReturnValue({ sub: "user-1" });
      require("../../models").Users.findOne = jest
        .fn()
        .mockResolvedValue(mockUser);

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("session validation", () => {
    it("should return 401 when session is invalid", () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        status: "ACTIVE",
      };

      verifyAccessToken.mockReturnValue({ sub: "user-1" });
      require("../../models").Users.findOne = jest
        .fn()
        .mockResolvedValue(mockUser);
      require("../../services/session.service").SessionService.findByPk = jest
        .fn()
        .mockResolvedValue(null);

      auth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should attach session to request when valid", () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        status: "ACTIVE",
      };
      const mockSession = {
        id: "session-1",
        expiresAt: new Date(Date.now() + 86400000),
      };

      verifyAccessToken.mockReturnValue({ sub: "user-1" });
      require("../../models").Users.findOne = jest
        .fn()
        .mockResolvedValue(mockUser);
      require("../../services/session.service").SessionService.findByPk = jest
        .fn()
        .mockResolvedValue(mockSession);

      auth(req, res, next);

      expect(req.session).toBeDefined();
    });
  });
});
