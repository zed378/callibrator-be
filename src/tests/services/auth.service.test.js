/**
 * Tests for Auth Service
 */

// ==========================================
// MOCK DEPENDENCIES
// ==========================================

jest.mock("../../models", () => ({
  Users: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  Sessions: {
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  LoginLogs: {
    create: jest.fn(),
  },
  Roles: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../config", () => ({
  db: {
    transaction: jest.fn(),
  },
}));

jest.mock("../../utils/password", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed_password"),
  comparePassword: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../utils/jwt", () => ({
  generateAccessToken: jest.fn().mockReturnValue("mock_jwt_token"),
  verifyAccessToken: jest
    .fn()
    .mockReturnValue({ id: "user-1", type: "activation" }),
}));

jest.mock("../../utils/session", () => ({
  hashToken: jest.fn().mockReturnValue("hashed_token"),
}));

jest.mock("../../utils/otp", () => ({
  hashOTP: jest.fn().mockReturnValue("hashed_otp"),
  generateOTP: jest.fn().mockReturnValue("123456"),
}));

jest.mock("../../services/email.service", () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
  sendActivationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../services/redis.service", () => ({
  acquireLock: jest.fn().mockResolvedValue("lock-id-123"),
  releaseLock: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  cacheKeys: {
    userByEmail: jest.fn((email) => `cache:user:email:${email}`),
    userByUsername: jest.fn((username) => `cache:user:username:${username}`),
  },
}));

jest.mock("../../services/emailQueue.service", () => ({
  queueActivationEmail: jest.fn().mockResolvedValue({ success: true }),
  queueOtpEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../../validators/auth.validator", () => ({
  validate: jest.fn((data, schema) => ({ error: null, value: data })),
  formatErrors: jest.fn((details) => details),
  registerSchema: {},
  loginSchema: {},
  forgotPasswordSchema: {},
  resetPasswordSchema: {},
}));

// ==========================================
// IMPORT MOCKED MODULES
// ==========================================

const { Users, Sessions, LoginLogs, Roles } = require("../../models");
const { db } = require("../../config");
const { hashPassword, comparePassword } = require("../../utils/password");
const { generateAccessToken, verifyAccessToken } = require("../../utils/jwt");
const { hashToken } = require("../../utils/session");
const { hashOTP, generateOTP } = require("../../utils/otp");
const {
  sendOtpEmail,
  sendActivationEmail,
} = require("../../services/email.service");
const {
  acquireLock,
  releaseLock,
  get,
  set,
  cacheKeys,
} = require("../../services/redis.service");
const {
  queueActivationEmail,
  queueOtpEmail,
} = require("../../services/emailQueue.service");
const {
  validate: validateInput,
  formatErrors,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../../validators/auth.validator");

const {
  registerUser,
  activateAccount,
  loginUser,
  requestOTP,
  processResetPassword,
  logoutSession,
  logoutAllUserSessions,
  verifyUserSession,
  justUpdatePassword,
  passIsValid,
} = require("../../services/auth.service");

// ==========================================
// MOCK DATA
// ==========================================

const mockUser = {
  id: "user-1",
  firstName: "John",
  lastName: "Doe",
  username: "johndoe",
  email: "john@example.com",
  password: "hashed_password",
  isEmailVerified: false,
  isBan: false,
  isBanned: false,
  lockedUntil: null,
  failedLoginAttempts: 0,
  lastLoginAt: new Date(),
  lastLoginIp: "127.0.0.1",
  otpCode: "hashed_otp",
  otpExpiredAt: new Date(Date.now() + 5 * 60 * 1000),
  otpLastRequestedAt: new Date(),
  otpRequestCount: 1,
  picture: "default.svg",
  tenantId: "tenant-1",
  roleId: "role-1",
  passwordChangedAt: null,
  update: jest.fn().mockResolvedValue({}),
  changed: jest.fn().mockReturnValue([]),
};

const mockRole = {
  id: "role-1",
  name: "SUPER_ADMIN",
  description: "Super Admin",
  nameToShow: "Super Admin",
  isActive: true,
};

const mockTransaction = {
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  toObject: jest.fn().mockReturnValue({}),
  LOCK: { UPDATE: "UPDATE" },
};

const mockSession = {
  id: "session-1",
  tenantId: "tenant-1",
  userId: "user-1",
  tokenHash: "hashed_token",
  ipAddress: "127.0.0.1",
  userAgent: "TestBrowser",
  expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  isRevoked: false,
  isActive: true,
  lastActivityAt: new Date(),
  update: jest.fn().mockResolvedValue({}),
};

// ==========================================
// SETUP BEFORE EACH TEST
// ==========================================

beforeEach(() => {
  jest.clearAllMocks();
  Users.findOne.mockResolvedValue(null);
  Users.findByPk.mockResolvedValue(null);
  Users.create.mockResolvedValue(mockUser);
  Sessions.findByPk.mockResolvedValue(mockSession);
  Sessions.create.mockResolvedValue(mockSession);
  Sessions.update.mockResolvedValue(1);
  LoginLogs.create.mockResolvedValue({});
  Roles.findOne.mockResolvedValue(null);
  db.transaction.mockResolvedValue(mockTransaction);
  hashPassword.mockResolvedValue("hashed_password");
  comparePassword.mockResolvedValue(true);
  generateAccessToken.mockReturnValue("mock_jwt_token");
  verifyAccessToken.mockReturnValue({ id: "user-1", type: "activation" });
  acquireLock.mockResolvedValue("lock-id-123");
  releaseLock.mockResolvedValue(true);
  get.mockResolvedValue(null);
  set.mockResolvedValue(true);
  queueActivationEmail.mockResolvedValue({});
  queueOtpEmail.mockResolvedValue({});
  process.env.HOST_URL = "http://localhost:5000";
});

// ==========================================
// REGISTER USER TESTS
// ==========================================

describe("registerUser", () => {
  const registerInput = {
    firstName: "John",
    lastName: "Doe",
    username: "johndoe",
    email: "john@example.com",
    password: "Secret123",
  };

  it("should register a user successfully", async () => {
    Users.create.mockResolvedValueOnce({
      ...mockUser,
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
      email: "john@example.com",
    });

    const result = await registerUser(registerInput);

    expect(result).toEqual({
      success: true,
      status: 201,
      message: expect.stringContaining("Registration successful"),
    });
    expect(Users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
        email: "john@example.com",
      }),
      { transaction: mockTransaction },
    );
    expect(queueActivationEmail).toHaveBeenCalled();
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });

  it("should throw conflict when email already exists", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      email: "john@example.com",
    });

    await expect(registerUser(registerInput)).rejects.toEqual({
      status: 409,
      message: "Email already registered",
    });
  });

  it("should throw conflict when username already exists", async () => {
    Users.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mockUser, username: "johndoe" });

    await expect(registerUser(registerInput)).rejects.toEqual({
      status: 409,
      message: "Username already used",
    });
  });

  it("should throw rate limit when lock cannot be acquired", async () => {
    acquireLock.mockResolvedValueOnce(null);

    await expect(registerUser(registerInput)).rejects.toEqual({
      status: 429,
      message: "Registration in progress. Please wait and try again.",
    });
  });

  it("should handle transaction rollback on error", async () => {
    Users.create.mockRejectedValueOnce(new Error("Database error"));

    await expect(registerUser(registerInput)).rejects.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });

  it("should use custom origin URL", async () => {
    Users.create.mockResolvedValueOnce(mockUser);

    await registerUser(registerInput, "https://custom.example.com");

    expect(queueActivationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        activationLink: expect.stringContaining("https://custom.example.com"),
      }),
    );
  });
});

// ==========================================
// ACTIVATE ACCOUNT TESTS
// ==========================================

describe("activateAccount", () => {
  it("should throw error when token is missing", async () => {
    await expect(activateAccount(null)).rejects.toEqual({
      status: 400,
      message: "Activation token is required",
    });
  });

  it("should throw error when token is invalid", async () => {
    verifyAccessToken.mockReturnValueOnce({ id: "user-1", type: "login" });

    await expect(activateAccount("invalid-token")).rejects.toEqual({
      status: 400,
      message: "Invalid activation token type",
    });
  });

  it("should throw error when user not found", async () => {
    verifyAccessToken.mockReturnValueOnce({ id: "user-1", type: "activation" });
    Users.findOne.mockResolvedValueOnce(null);

    await expect(activateAccount("valid-token")).rejects.toEqual({
      status: 404,
      message: "User not found",
    });
  });

  it("should throw error when account already activated", async () => {
    verifyAccessToken.mockReturnValueOnce({ id: "user-1", type: "activation" });
    Users.findOne.mockResolvedValueOnce({ ...mockUser, isEmailVerified: true });

    await expect(activateAccount("valid-token")).rejects.toEqual({
      status: 400,
      message: "Account already activated",
    });
  });

  it("should activate account successfully", async () => {
    verifyAccessToken.mockReturnValueOnce({ id: "user-1", type: "activation" });
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: false,
    });

    const result = await activateAccount("valid-token");

    expect(result).toEqual({
      success: true,
      status: 200,
      message: "Account activated successfully",
    });
    expect(mockUser.update).toHaveBeenCalled();
    const updateCall = mockUser.update.mock.calls[0];
    expect(updateCall[0]).toEqual(
      expect.objectContaining({ isEmailVerified: true, isActive: true }),
    );
  });
});

// ==========================================
// LOGIN USER TESTS
// ==========================================

describe("loginUser", () => {
  const loginInput = {
    user: "johndoe",
    password: "Secret123",
    ip: "127.0.0.1",
    userAgent: "TestBrowser",
  };

  it("should login successfully", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      role: mockRole,
      isEmailVerified: true,
      isBan: false,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });
    Sessions.create.mockResolvedValueOnce(mockSession);

    const result = await loginUser(loginInput);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.message).toBe("Login successful");
    expect(result.token).toBe("mock_jwt_token");
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "user-1",
        email: "john@example.com",
        username: "johndoe",
      }),
    );
    expect(Sessions.create).toHaveBeenCalled();
    expect(LoginLogs.create).toHaveBeenCalled();
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  it("should throw error when user not found", async () => {
    Users.findOne.mockResolvedValueOnce(null);

    await expect(loginUser(loginInput)).rejects.toEqual({
      status: 401,
      message: "Invalid credentials",
    });
  });

  it("should throw error when email not verified", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: false,
    });

    await expect(loginUser(loginInput)).rejects.toEqual({
      status: 403,
      message: "Please verify your email first",
    });
  });

  it("should throw error when account is banned", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: true,
      isBan: true,
    });

    await expect(loginUser(loginInput)).rejects.toEqual({
      status: 403,
      message: "Account has been suspended",
    });
  });

  it("should throw error when account is locked", async () => {
    const lockedDate = new Date(Date.now() + 60 * 60 * 1000);
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: true,
      lockedUntil: lockedDate,
    });

    await expect(loginUser(loginInput)).rejects.toEqual({
      status: 423,
      message: "Account temporarily locked",
      lockedUntil: lockedDate,
    });
  });

  it("should throw error when password is invalid", async () => {
    comparePassword.mockResolvedValueOnce(false);
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: true,
      isBan: false,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    await expect(loginUser(loginInput)).rejects.toEqual({
      status: 401,
      message: "Invalid credentials",
    });
  });

  it("should lock account after 5 failed attempts", async () => {
    comparePassword.mockResolvedValueOnce(false);
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: true,
      isBan: false,
      lockedUntil: null,
      failedLoginAttempts: 4,
    });

    await expect(loginUser(loginInput)).rejects.toEqual({
      status: 401,
      message: "Invalid credentials",
    });
    expect(mockUser.update).toHaveBeenCalled();
    const updateCall = mockUser.update.mock.calls[0];
    expect(updateCall[0]).toEqual(
      expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date),
      }),
    );
  });

  it("should handle transaction rollback on error", async () => {
    Users.findOne.mockRejectedValueOnce(new Error("Database error"));

    await expect(loginUser(loginInput)).rejects.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});

// ==========================================
// REQUEST OTP TESTS
// ==========================================

describe("requestOTP", () => {
  const otpInput = { email: "john@example.com" };

  it("should send OTP successfully", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: true,
      otpLastRequestedAt: null,
      otpRequestCount: 0,
    });

    const result = await requestOTP(otpInput);

    expect(result.success).toBe(true);
    expect(result.message).toBe("If the account exists, OTP has been sent");
    expect(queueOtpEmail).toHaveBeenCalled();
  });

  it("should return success even if user not found (security)", async () => {
    Users.findOne.mockResolvedValueOnce(null);

    const result = await requestOTP(otpInput);

    expect(result.success).toBe(true);
    expect(result.message).toBe("If the account exists, OTP has been sent");
  });

  it("should throw error when email not verified", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: false,
    });

    await expect(requestOTP(otpInput)).rejects.toEqual({
      status: 403,
      message: "Account email not verified",
    });
  });

  it("should throw rate limit when too many requests", async () => {
    get.mockResolvedValueOnce(3);

    await expect(requestOTP(otpInput)).rejects.toEqual({
      status: 429,
      message: "Too many OTP requests. Please wait 1 minute.",
    });
  });

  it("should throw rate limit when OTP requested recently", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: true,
      otpLastRequestedAt: new Date(),
    });

    await expect(requestOTP(otpInput)).rejects.toEqual({
      status: 429,
      message: "Please wait before requesting another OTP",
    });
  });

  it("should handle cache miss and fallback to database", async () => {
    get.mockResolvedValueOnce(null);
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isEmailVerified: true,
      otpLastRequestedAt: null,
    });

    await requestOTP(otpInput);
    expect(Users.findOne).toHaveBeenCalled();
  });
});

// ==========================================
// PROCESS RESET PASSWORD TESTS
// ==========================================

describe("processResetPassword", () => {
  const resetInput = {
    email: "john@example.com",
    otp: "123456",
    password: "NewSecret123",
  };

  it("should reset password successfully", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      otpCode: "hashed_otp",
      otpExpiredAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const result = await processResetPassword(resetInput);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Password reset successful");
    expect(Sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ revokedReason: "PASSWORD_RESET" }),
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("should throw error when user not found", async () => {
    Users.findOne.mockResolvedValueOnce(null);

    await expect(processResetPassword(resetInput)).rejects.toEqual({
      status: 400,
      message: "Invalid OTP or email",
    });
  });

  it("should throw error when OTP not found", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      otpCode: null,
    });

    await expect(processResetPassword(resetInput)).rejects.toEqual({
      status: 400,
      message: "OTP not found",
    });
  });

  it("should throw error when OTP is expired", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      otpCode: "hashed_otp",
      otpExpiredAt: new Date(Date.now() - 1000 * 60),
    });

    await expect(processResetPassword(resetInput)).rejects.toEqual({
      status: 400,
      message: "OTP expired",
    });
  });

  it("should throw error when OTP is invalid", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      otpCode: "different_hashed_otp",
      otpExpiredAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await expect(processResetPassword(resetInput)).rejects.toEqual({
      status: 400,
      message: "Invalid OTP",
    });
  });

  it("should handle transaction rollback on error", async () => {
    Users.findOne.mockRejectedValueOnce(new Error("Database error"));

    await expect(processResetPassword(resetInput)).rejects.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});

// ==========================================
// LOGOUT SESSION TESTS
// ==========================================

describe("logoutSession", () => {
  it("should logout a session successfully", async () => {
    const result = await logoutSession("session-1");

    expect(result.success).toBe(true);
    expect(result.message).toBe("Logout successful");
    expect(Sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ isRevoked: true, revokedReason: "LOGOUT" }),
      expect.objectContaining({ where: { id: "session-1" } }),
    );
  });

  it("should handle transaction rollback on error", async () => {
    Sessions.update.mockRejectedValueOnce(new Error("Database error"));

    await expect(logoutSession("session-1")).rejects.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});

// ==========================================
// LOGOUT ALL USER SESSIONS TESTS
// ==========================================

describe("logoutAllUserSessions", () => {
  it("should logout all sessions successfully", async () => {
    const result = await logoutAllUserSessions("user-1");

    expect(result.success).toBe(true);
    expect(result.message).toBe("All sessions revoked successfully");
    expect(Sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({ revokedReason: "LOGOUT_ALL" }),
      expect.objectContaining({
        where: { userId: "user-1", isRevoked: false },
      }),
    );
  });

  it("should handle transaction rollback on error", async () => {
    Sessions.update.mockRejectedValueOnce(new Error("Database error"));

    await expect(logoutAllUserSessions("user-1")).rejects.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});

// ==========================================
// VERIFY USER SESSION TESTS
// ==========================================

describe("verifyUserSession", () => {
  const verifyInput = { userId: "user-1", sessionId: "session-1" };

  it("should verify session successfully", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      role: mockRole,
      isBanned: false,
      picture: "default.svg",
    });
    Sessions.findByPk.mockResolvedValueOnce(mockSession);

    const result = await verifyUserSession(
      verifyInput.userId,
      verifyInput.sessionId,
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("Token valid");
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "user-1",
        email: "john@example.com",
        username: "johndoe",
      }),
    );
    expect(mockSession.update).toHaveBeenCalled();
    const updateCall = mockSession.update.mock.calls[0];
    expect(updateCall[0]).toEqual(
      expect.objectContaining({ lastActivityAt: expect.any(Date) }),
    );
  });

  it("should throw error when user not found", async () => {
    Users.findOne.mockResolvedValueOnce(null);

    await expect(
      verifyUserSession(verifyInput.userId, verifyInput.sessionId),
    ).rejects.toEqual({
      status: 401,
      message: "User not found",
    });
  });

  it("should throw error when user is banned", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isBanned: true,
    });

    await expect(
      verifyUserSession(verifyInput.userId, verifyInput.sessionId),
    ).rejects.toEqual({
      status: 403,
      message: "Account banned",
    });
  });

  it("should throw error when session not found", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isBanned: false,
    });
    Sessions.findByPk.mockResolvedValueOnce(null);

    await expect(
      verifyUserSession(verifyInput.userId, verifyInput.sessionId),
    ).rejects.toEqual({
      status: 401,
      message: "Session not found",
    });
  });

  it("should throw error when session is revoked", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isBanned: false,
    });
    Sessions.findByPk.mockResolvedValueOnce({
      ...mockSession,
      isRevoked: true,
    });

    await expect(
      verifyUserSession(verifyInput.userId, verifyInput.sessionId),
    ).rejects.toEqual({
      status: 401,
      message: "Session revoked",
    });
  });

  it("should throw error when session is expired", async () => {
    Users.findOne.mockResolvedValueOnce({
      ...mockUser,
      isBanned: false,
    });
    Sessions.findByPk.mockResolvedValueOnce({
      ...mockSession,
      expiredAt: new Date(Date.now() - 1000 * 60),
    });

    await expect(
      verifyUserSession(verifyInput.userId, verifyInput.sessionId),
    ).rejects.toEqual({
      status: 401,
      message: "Session expired",
    });
  });

  it("should handle transaction rollback on error", async () => {
    Users.findOne.mockRejectedValueOnce(new Error("Database error"));

    await expect(
      verifyUserSession(verifyInput.userId, verifyInput.sessionId),
    ).rejects.toEqual(expect.objectContaining({ message: expect.any(String) }));
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});

// ==========================================
// JUST UPDATE PASSWORD TESTS
// ==========================================

describe("justUpdatePassword", () => {
  it("should throw error when password is missing", async () => {
    await expect(justUpdatePassword("user-1", null)).rejects.toEqual({
      status: 400,
      message: "New password is required and must be a string",
    });
  });

  it("should throw error when password is too short", async () => {
    await expect(justUpdatePassword("user-1", "123")).rejects.toEqual({
      status: 400,
      message: "Password must be at least 6 characters long",
    });
  });

  it("should throw error when user not found", async () => {
    Users.findByPk.mockResolvedValueOnce(null);

    await expect(justUpdatePassword("user-1", "NewSecret123")).rejects.toEqual({
      status: 404,
      message: "User not found",
    });
  });

  it("should update password successfully", async () => {
    Users.findByPk.mockResolvedValueOnce(mockUser);

    const result = await justUpdatePassword("user-1", "NewSecret123");

    expect(result.success).toBe(true);
    expect(result.message).toBe("Password updated successfully");
    expect(mockUser.update).toHaveBeenCalled();
    const updateCall = mockUser.update.mock.calls[0];
    expect(updateCall[0]).toEqual(
      expect.objectContaining({
        password: "hashed_password",
        passwordChangedAt: expect.any(Date),
      }),
    );
  });

  it("should handle transaction rollback on error", async () => {
    Users.findByPk.mockRejectedValueOnce(new Error("Database error"));

    await expect(justUpdatePassword("user-1", "NewSecret123")).rejects.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});

// ==========================================
// PASS IS VALID TESTS
// ==========================================

describe("passIsValid", () => {
  it("should throw error when password is missing", async () => {
    await expect(passIsValid("user-1", null)).rejects.toEqual({
      status: 400,
      message: "Password must be a non‑empty string",
    });
  });

  it("should throw error when user not found", async () => {
    Users.findByPk.mockResolvedValueOnce(null);

    await expect(passIsValid("user-1", "Secret123")).rejects.toEqual({
      status: 404,
      message: "User not found",
    });
  });

  it("should throw error when password is invalid", async () => {
    Users.findByPk.mockResolvedValueOnce(mockUser);
    comparePassword.mockResolvedValueOnce(false);

    await expect(passIsValid("user-1", "WrongPassword")).rejects.toEqual({
      status: 401,
      message: "Invalid password",
    });
  });

  it("should return success when password is valid", async () => {
    Users.findByPk.mockResolvedValueOnce(mockUser);
    comparePassword.mockResolvedValueOnce(true);

    const result = await passIsValid("user-1", "Secret123");

    expect(result.success).toBe(true);
    expect(result.message).toBe("Password is valid");
  });

  it("should handle transaction rollback on error", async () => {
    Users.findByPk.mockRejectedValueOnce(new Error("Database error"));

    await expect(passIsValid("user-1", "Secret123")).rejects.toEqual(
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });
});
