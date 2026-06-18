const { db } = require("../../../config");
const { Users, Roles } = require("../../../models");
const { hashPassword, comparePassword } = require("../../../utils/password");
const { generateAccessToken, verifyAccessToken, generateRefreshToken } = require("../../../utils/jwt");
const { createSession, validateSession, revokeAllSessions } = require("../../../services/session.service");
const { queueActivationEmail, queueOtpEmail } = require("../../../services/emailQueue.service");
const { acquireLock, releaseLock, get, set, del, cacheKeys } = require("../../../services/redis.service");
const { logger } = require("../../middlewares/activityLog");
const { PASSWORD_MIN_LENGTH, ROLE_IDS } = require("../../constants");

jest.mock("../../../config");
jest.mock("../../../models", () => ({
  Users: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  Roles: { findOne: jest.fn() },
}));
jest.mock("../../../utils/password");
jest.mock("../../../utils/jwt");
jest.mock("../../../services/session.service");
jest.mock("../../../services/emailQueue.service");
jest.mock("../../../services/redis.service", () => ({
  acquireLock: jest.fn(),
  releaseLock: jest.fn().mockResolvedValue(true),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  cacheKeys: {
    userByEmail: jest.fn((e) => `user:email:${e}`),
    userByUsername: jest.fn((u) => `user:username:${u}`),
    userSession: jest.fn((id) => `user:session:${id}`),
    userSessions: jest.fn((id) => `user:sessions:${id}`),
  },
}));
jest.mock("../../middlewares/activityLog", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("../../../utils/appError", () => {
  const { AppError: RealAppError } = jest.requireActual("../../../utils/appError");
  return { AppError: RealAppError };
});
jest.mock("../../../validators/auth.validator", () => {
  const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = jest.requireActual("../../../validators/auth.validator");
  return {
    validate: jest.fn((data, schema) => ({ value: { ...data }, error: null })),
    formatErrors: jest.fn((d) => d),
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
  };
});

const {
  registerUser,
  loginUser,
  activateAccount,
  requestOTP,
  processResetPassword,
  verifyUserSession,
  justUpdatePassword,
  passIsValid,
  logoutSession,
  logoutAllUserSessions,
} = require("../../../services/auth.service");

describe("auth.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.transaction.mockResolvedValue({
      LOCK: { UPDATE: "UPDATE" },
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
    });
    acquireLock.mockResolvedValue("lock-123");
    generateAccessToken.mockReturnValue("access-token");
    generateRefreshToken.mockReturnValue("refresh-token");
    queueActivationEmail.mockResolvedValue(undefined);
    queueOtpEmail.mockResolvedValue(undefined);
    hashPassword.mockResolvedValue("hashed");
    comparePassword.mockResolvedValue(true);
    createSession.mockResolvedValue({ id: "session-1" });
    revokeAllSessions.mockResolvedValue(undefined);
    set.mockResolvedValue(true);
    del.mockResolvedValue(true);
  });

  describe("registerUser", () => {
    it("should register a new user successfully", async () => {
      const user = { id: "user-1", email: "test@example.com", username: "testuser" };
      Users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      Users.create.mockResolvedValue(user);

      const result = await registerUser(
        { firstName: "Test", lastName: "User", username: "testuser", email: "test@example.com", password: "Password123" },
        "https://api.example.com"
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(Users.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: "testuser", email: "test@example.com", password: "hashed", role_id: ROLE_IDS.USER }),
        expect.any(Object),
      );
      expect(queueActivationEmail).toHaveBeenCalled();
    });

    it("should throw 409 if email already registered", async () => {
      Users.findOne.mockResolvedValueOnce({ id: "existing" });
      await expect(
        registerUser({ firstName: "T", lastName: "U", username: "newuser", email: "existing@example.com", password: "Password123" }, "")
      ).rejects.toThrow("Email already registered");
    });

    it("should throw 429 if lock is already held", async () => {
      acquireLock.mockResolvedValue(null);
      await expect(
        registerUser({ firstName: "T", lastName: "U", username: "new", email: "x@y.com", password: "Password123" }, "")
      ).rejects.toThrow("Registration in progress");
    });

    it("should rollback on failure and release lock", async () => {
      Users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      Users.create.mockRejectedValue(new Error("DB error"));
      await expect(
        registerUser({ firstName: "T", lastName: "U", username: "new", email: "x@y.com", password: "Password123" }, "")
      ).rejects.toThrow("DB error");
      expect(db.transaction().commit).not.toHaveBeenCalled;
    });
  });

  describe("loginUser", () => {
    it("should login successfully", async () => {
      const user = {
        id: "user-1", username: "testuser", email: "test@example.com",
        password: "hashed", is_active: true, locked_until: null,
        failed_login_attempts: 0, last_login_at: null,
        tenant_id: "tenant-1",
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findOne.mockResolvedValue(user);

      const result = await loginUser({ username: "testuser", password: "Password123", ip: "1.2.3.4", userAgent: "Chrome" });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.message).toBe("Login successful");
      expect(result.token).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
      expect(createSession).toHaveBeenCalled();
      expect(user.update).toHaveBeenCalledWith({ last_login_at: expect.any(Date) });
    });

    it("should throw 401 for invalid credentials", async () => {
      const user = {
        id: "user-1", username: "testuser", password: "hashed",
        is_active: true, locked_until: null, failed_login_attempts: 0,
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findOne.mockResolvedValue(user);
      comparePassword.mockResolvedValue(false);

      await expect(loginUser({ username: "testuser", password: "wrong" })).rejects.toThrow("Invalid credentials");
    });

    it("should lock account after 5 failed attempts", async () => {
      const user = {
        id: "user-1", username: "testuser", password: "hashed",
        is_active: true, locked_until: null,
        failed_login_attempts: 4,
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findOne.mockResolvedValue(user);
      comparePassword.mockResolvedValue(false);

      await expect(loginUser({ username: "testuser", password: "wrong" })).rejects.toThrow("Account locked");
    });

    it("should throw 403 for suspended account", async () => {
      const user = {
        id: "user-1", username: "testuser", password: "hashed",
        is_active: false, locked_until: null,
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findOne.mockResolvedValue(user);

      await expect(loginUser({ username: "testuser", password: "x" })).rejects.toThrow("suspended");
    });

    it("should throw 423 for locked account", async () => {
      const user = {
        id: "user-1", username: "testuser", password: "hashed",
        is_active: true, locked_until: new Date(Date.now() + 100000),
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findOne.mockResolvedValue(user);

      await expect(loginUser({ username: "testuser", password: "x" })).rejects.toThrow("locked");
    });

    it("should throw 401 for non-existent user", async () => {
      Users.findOne.mockResolvedValue(null);
      await expect(loginUser({ username: "ghost", password: "x" })).rejects.toThrow("Invalid credentials");
    });
  });

  describe("activateAccount", () => {
    it("should activate account", async () => {
      const user = {
        id: "user-1", email: "t@x.com", username: "test",
        is_email_verified: false,
        update: jest.fn().mockResolvedValue(true),
      };
      verifyAccessToken.mockReturnValue({ id: "user-1" });
      Users.findByPk.mockResolvedValue(user);

      const result = await activateAccount("token123");
      expect(result.message).toBe("Account activated successfully");
      expect(user.update).toHaveBeenCalledWith({ is_email_verified: true });
      expect(del).toHaveBeenCalledWith(expect.any(String));
    });

    it("should return already activated message", async () => {
      const user = { is_email_verified: true };
      verifyAccessToken.mockReturnValue({ id: "user-1" });
      Users.findByPk.mockResolvedValue(user);

      const result = await activateAccount("token123");
      expect(result.message).toBe("Account already activated");
    });

    it("should throw 404 for non-existent user", async () => {
      verifyAccessToken.mockReturnValue({ id: "nope" });
      Users.findByPk.mockResolvedValue(null);
      await expect(activateAccount("token123")).rejects.toThrow("User not found");
    });
  });

  describe("requestOTP", () => {
    it("should send OTP and return success", async () => {
      const user = {
        id: "user-1", email: "t@x.com", first_name: "Test", last_name: "User",
        otp_request_count: 0,
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findOne.mockResolvedValue(user);

      const result = await requestOTP({ email: "t@x.com" });
      expect(result.message).toBe("OTP sent");
      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({ otp_code: expect.any(String), otp_expired_at: expect.any(Date) })
      );
      expect(queueOtpEmail).toHaveBeenCalled();
    });

    it("should return success even if user not found", async () => {
      Users.findOne.mockResolvedValue(null);
      const result = await requestOTP({ email: "nonexistent@test.com" });
      expect(result.message).toContain("If the account exists");
    });
  });

  describe("processResetPassword", () => {
    it("should reset password successfully", async () => {
      const user = {
        id: "user-1", email: "t@x.com", otp_code: "hash123",
        otp_expired_at: new Date(Date.now() + 1000000),
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findOne.mockResolvedValue(user);

      const result = await processResetPassword({ email: "t@x.com", otp: "123456", newPassword: "NewPass123" });
      expect(result.message).toBe("Password reset successful");
      expect(revokeAllSessions).toHaveBeenCalledWith("user-1", "PASSWORD_RESET");
    });

    it("should throw 404 if user not found", async () => {
      Users.findOne.mockResolvedValue(null);
      await expect(processResetPassword({ email: "x@x.com", otp: "123", newPassword: "NewPass123" })).rejects.toThrow("not found");
    });

    it("should throw 400 if OTP is invalid", async () => {
      const user = { otp_code: "different-hash", otp_expired_at: new Date(Date.now() + 100000) };
      Users.findOne.mockResolvedValue(user);
      await expect(processResetPassword({ email: "t@x.com", otp: "wrong", newPassword: "NewPass123" })).rejects.toThrow("Invalid OTP");
    });
  });

  describe("verifyUserSession", () => {
    it("should verify valid session", async () => {
      const user = { id: "user-1", username: "test", email: "t@x.com", is_active: true };
      Users.findByPk.mockResolvedValue(user);

      const result = await verifyUserSession("user-1", { id: "sess1" });
      expect(result.success).toBe(true);
    });

    it("should throw 401 if user not found", async () => {
      Users.findByPk.mockResolvedValue(null);
      await expect(verifyUserSession("nope", {})).rejects.toThrow("Invalid session");
    });

    it("should throw 403 if account suspended", async () => {
      const user = { is_active: false };
      Users.findByPk.mockResolvedValue(user);
      await expect(verifyUserSession("user-1", {})).rejects.toThrow("suspended");
    });
  });

  describe("justUpdatePassword", () => {
    it("should update password successfully", async () => {
      const user = {
        id: "user-1",
        update: jest.fn().mockResolvedValue(true),
      };
      Users.findByPk.mockResolvedValue(user);

      const result = await justUpdatePassword("user-1", "NewPassword123");
      expect(result.message).toBe("Password updated successfully");
      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({ password: "hashed", password_changed_at: expect.any(Date) })
      );
    });

    it("should throw 404 for non-existent user", async () => {
      Users.findByPk.mockResolvedValue(null);
      await expect(justUpdatePassword("nope", "NewPass123")).rejects.toThrow("User not found");
    });

    it("should throw 400 if password too short", async () => {
      await expect(justUpdatePassword("user-1", "short")).rejects.toThrow(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
      );
    });
  });

  describe("passIsValid", () => {
    it("should return valid match", async () => {
      const user = { id: "user-1", password: "hashed" };
      Users.findByPk.mockResolvedValue(user);
      comparePassword.mockResolvedValue(true);

      const result = await passIsValid("user-1", "Password123");
      expect(result.data.valid).toBe(true);
    });

    it("should throw 404 for non-existent user", async () => {
      Users.findByPk.mockResolvedValue(null);
      await expect(passIsValid("nope", "x")).rejects.toThrow("User not found");
    });
  });

  describe("logoutSession", () => {
    it("should logout a session", async () => {
      const req = { user: { id: "user-1" }, token: "token123" };
      const result = await logoutSession(req);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Logout successful");
    });

    it("should logout even without token", async () => {
      const req = { user: { id: "user-1" }, token: null };
      const result = await logoutSession(req);
      expect(result.success).toBe(true);
    });
  });

  describe("logoutAllUserSessions", () => {
    it("should revoke all sessions", async () => {
      const result = await logoutAllUserSessions("user-1");
      expect(result.message).toBe("All sessions revoked successfully");
      expect(revokeAllSessions).toHaveBeenCalledWith("user-1", "USER_REQUESTED");
    });
  });
});
