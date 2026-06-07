/**
 * Tests for Auth Controller
 */

const { authController } = require("../../controllers/auth.controller");
const { authMiddleware } = require("../../middlewares/auth");

// Mock services
jest.mock("../../services/auth.service", () => ({
  AuthService: {
    registerUser: jest.fn(),
    activateUser: jest.fn(),
    loginUser: jest.fn(),
    logoutUser: jest.fn(),
    sendOtp: jest.fn(),
    resetPassword: jest.fn(),
    verifyOtp: jest.fn(),
  },
}));

const { AuthService } = require("../../services/auth.service");

// Mock response helper
jest.mock("../../utils/response", () => ({
  success: jest.fn(),
  error: jest.fn(),
  login: jest.fn(),
  badRequest: jest.fn(),
}));

const { success, error, login, badRequest } = require("../../utils/response");

describe("authController", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      query: {},
      headers: {},
      ip: "127.0.0.1",
      user: { id: "user-1", tenantId: "tenant-1" },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {},
    };

    success.mockImplementation((response, data, message) => {
      response.json({ success: true, data, message });
    });
    error.mockImplementation((response, message, status) => {
      response.status(status).json({ success: false, message });
    });
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const mockUserData = {
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123",
      };

      req.body = mockUserData;

      AuthService.registerUser.mockResolvedValue({
        success: true,
        status: 201,
        message:
          "Registration successful. Please check your email to activate your account.",
        data: { email: "test@example.com" },
      });

      await authController.register(req, res);

      expect(AuthService.registerUser).toHaveBeenCalledWith(mockUserData);
      expect(success).toHaveBeenCalled();
    });

    it("should return 400 when registration fails", async () => {
      req.body = {
        username: "testuser",
        email: "test@example.com",
        password: "TestPass123",
      };

      AuthService.registerUser.mockResolvedValue({
        success: false,
        status: 400,
        message: "Email already exists",
      });

      await authController.register(req, res);

      expect(error).toHaveBeenCalled();
    });
  });

  describe("activate", () => {
    it("should activate user account successfully", async () => {
      req.query = { token: "activation-token-123" };

      AuthService.activateUser.mockResolvedValue({
        success: true,
        status: 200,
        message: "Account activated successfully. You can now log in.",
      });

      await authController.activate(req, res);

      expect(AuthService.activateUser).toHaveBeenCalledWith(
        "activation-token-123",
      );
      expect(success).toHaveBeenCalled();
    });

    it("should return 400 when activation token is invalid", async () => {
      req.query = { token: "invalid-token" };

      AuthService.activateUser.mockResolvedValue({
        success: false,
        status: 400,
        message: "Invalid or expired activation token",
      });

      await authController.activate(req, res);

      expect(error).toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should login successfully with valid credentials", async () => {
      const mockCredentials = {
        email: "test@example.com",
        password: "TestPass123",
      };

      req.body = mockCredentials;

      AuthService.loginUser.mockResolvedValue({
        success: true,
        status: 200,
        message: "Login successful",
        data: {
          user: { id: "user-1", email: "test@example.com" },
          token: "access-token",
          session: { id: "session-1" },
        },
      });

      await authController.login(req, res);

      expect(AuthService.loginUser).toHaveBeenCalledWith(mockCredentials);
      expect(login).toHaveBeenCalled();
    });

    it("should return 401 with invalid credentials", async () => {
      req.body = {
        email: "wrong@example.com",
        password: "wrongpassword",
      };

      AuthService.loginUser.mockResolvedValue({
        success: false,
        status: 401,
        message: "Invalid email or password",
      });

      await authController.login(req, res);

      expect(error).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("should logout successfully", async () => {
      req.body = { refreshToken: "refresh-token-123" };

      AuthService.logoutUser.mockResolvedValue({
        success: true,
        status: 200,
        message: "Logout successful",
      });

      await authController.logout(req, res);

      expect(AuthService.logoutUser).toHaveBeenCalledWith({
        userId: "user-1",
        refreshToken: "refresh-token-123",
      });
      expect(success).toHaveBeenCalled();
    });
  });

  describe("sendOtp", () => {
    it("should send OTP successfully", async () => {
      req.body = { email: "test@example.com" };

      AuthService.sendOtp.mockResolvedValue({
        success: true,
        status: 200,
        message: "OTP sent to your email",
      });

      await authController.sendOtp(req, res);

      expect(AuthService.sendOtp).toHaveBeenCalledWith("test@example.com");
      expect(success).toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      req.body = {
        email: "test@example.com",
        otp: "123456",
        newPassword: "NewPass123",
      };

      AuthService.resetPassword.mockResolvedValue({
        success: true,
        status: 200,
        message: "Password reset successful",
      });

      await authController.resetPassword(req, res);

      expect(AuthService.resetPassword).toHaveBeenCalled();
      expect(success).toHaveBeenCalled();
    });
  });

  describe("verify", () => {
    it("should verify token successfully", async () => {
      req.user = { id: "user-1", email: "test@example.com" };

      AuthService.verifyToken.mockResolvedValue({
        success: true,
        status: 200,
        data: { user: { id: "user-1" } },
      });

      await authController.verify(req, res);

      expect(success).toHaveBeenCalled();
    });
  });
});
