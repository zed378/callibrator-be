// auth.service.js
const { AppError } = require("../utils/appError");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { db } = require("../config");
const { Users, Roles } = require("../models");
const { hashPassword, comparePassword } = require("../utils/password");
const {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const { hashToken } = require("../utils/session");
const {
  sendOtpEmail,
  sendActivationEmail,
} = require("../services/email.service");
const {
  queueActivationEmail,
  queueOtpEmail,
} = require("../services/emailQueue.service");
const {
  validate: validateInput,
  formatErrors,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validators/auth.validator");
const {
  acquireLock,
  releaseLock,
  get,
  set,
  del,
  cacheKeys,
} = require("../services/redis.service");
const { logger } = require("../middlewares/activityLog");
const {
  createSession,
  validateSession,
  revokeAllSessions,
} = require("../services/session.service");
const {
  DEFAULT_SESSION_EXPIRY_HOURS,
  PASSWORD_MIN_LENGTH,
  ROLE_IDS,
} = require("../constants");

const validate = (data, schema) => {
  const { error, value } = validateInput(data, schema);
  if (error) {
    throw new AppError(400, "Validation failed", true, formatErrors(error.details));
  }
  return value;
};

// Safe user attributes — exclude sensitive/secret fields
const safeUserAttrs = {
  exclude: [
    "updatedAt",
    "otp_code",
    "otp_expired_at",
    "otp_request_count",
    "password",
    "otp_last_requested_at",
    "failed_login_attempts",
    "locked_until",
    "password_changed_at",
  ],
};

// ------------------------------------------------------------------
// REGISTER USER
// ------------------------------------------------------------------
exports.registerUser = async (input, origin) => {
  const data = validate(input, registerSchema);
  const { firstName, lastName, username, email, password } = data;
  const baseOrigin = origin || "";
  const lockKey = `register:${email}:${username}`;
  let lockId = null;

  lockId = await acquireLock(lockKey, 10000);
  if (!lockId) {
    throw new AppError(429, "Registration in progress. Please wait and try again.");
  }

  let transaction;
  try {
    transaction = await db.transaction();

    const existingUser = await Users.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingUser) {
      await transaction.rollback();
      throw new AppError(409, "Email already registered");
    }

    const existingUsername = await Users.findOne({
      where: { username },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingUsername) {
      await transaction.rollback();
      throw new AppError(409, "Username already used");
    }

    const hashedPassword = await hashPassword(password);

    const user = await Users.create(
      {
        first_name: firstName,
        last_name: lastName,
        username,
        email,
        password: hashedPassword,
        role_id: ROLE_IDS.USER,
        is_email_verified: false,
      },
      { transaction },
    );

    await transaction.commit();

    // Cache user lookup
    await set(cacheKeys.userByEmail(email), user.id, 86400);
    await set(cacheKeys.userByUsername(username), user.id, 86400);

    // Generate activation token
    const activationToken = generateAccessToken({ id: user.id });
    const activationLink = baseOrigin + "/activation?token=" + activationToken;

    // Queue activation email (async, non-blocking)
    try {
      queueActivationEmail(email, { firstName, lastName, activationLink });
    } catch (e) {
      logger.warn("queueActivationEmail failed", { err: e.message });
    }

    logger.info("User registered", { userId: user.id, email });
    return { success: true, status: 201, message: "Registration successful" };
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    throw error;
  } finally {
    if (lockId) {
      await releaseLock(lockKey, lockId).catch(() => {});
    }
  }
};

// ------------------------------------------------------------------
// LOGIN USER
// ------------------------------------------------------------------
exports.loginUser = async (input) => {
  const { username, password } = validate(input, loginSchema);
  const { ip, userAgent } = input;

  const user = await Users.findOne({ where: { username } });
  if (!user) {
    throw new AppError(401, "Invalid credentials");
  }
  if (!user.is_active) {
    throw new AppError(403, "Account is suspended");
  }

  const lockedUntil = user.locked_until || user.lockedUntil;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    throw new AppError(423, "Account temporarily locked");
  }

  const match = await comparePassword(password, user.password);
  if (!match) {
    const attempts =
      (user.failed_login_attempts || user.failedLoginAttempts || 0) + 1;
    await user.update({ failed_login_attempts: attempts });

    if (attempts >= 5) {
      await user.update({
        locked_until: new Date(Date.now() + 15 * 60 * 1000),
      });
      throw new AppError(423, "Account locked due to too many failed attempts");
    }
    throw new AppError(401, "Invalid credentials");
  }

  // Reset failed attempts on success
  if (user.failed_login_attempts > 0 || user.failedLoginAttempts > 0) {
    await user.update({ failed_login_attempts: 0, locked_until: null });
  }

  // Update last login
  await user.update({ last_login_at: new Date() });

  const accessToken = generateAccessToken({ id: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ id: user.id });

  // Create session
  const session = await createSession({
    tenantId: user.tenant_id || user.tenantId,
    userId: user.id,
    refreshToken,
    ipAddress: ip || "",
    userAgent: userAgent || "",
  });

  return {
    success: true,
    status: 200,
    message: "Login successful",
    data: { id: user.id, username: user.username, email: user.email },
    token: accessToken,
    refreshToken,
    session,
  };
};

// ------------------------------------------------------------------
// ACTIVATE ACCOUNT
// ------------------------------------------------------------------
exports.activateAccount = async (token) => {
  const decoded = verifyAccessToken(token);
  const user = await Users.findByPk(decoded.id);
  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (user.is_email_verified || user.isEmailVerified) {
    return { success: true, status: 200, message: "Account already activated" };
  }

  await user.update({ is_email_verified: true });
  await del(cacheKeys.userByEmail(user.email));
  await del(cacheKeys.userByUsername(user.username));

  logger.info("Account activated", { userId: user.id });
  return {
    success: true,
    status: 200,
    message: "Account activated successfully",
  };
};

// ------------------------------------------------------------------
// REQUEST OTP
// ------------------------------------------------------------------
exports.requestOTP = async (input) => {
  const { email } = validate(input, forgotPasswordSchema);

  const user = await Users.findOne({ where: { email } });
  if (!user) {
    return {
      success: true,
      status: 200,
      message: "If the account exists, OTP has been sent",
    };
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHashed = crypto.createHash("sha256").update(otpCode).digest("hex");
  const otpExpiredAt = new Date(Date.now() + 5 * 60 * 1000);

  await user.update({
    otp_code: otpHashed,
    otp_expired_at: otpExpiredAt,
    otp_request_count: (user.otp_request_count || 0) + 1,
    otp_last_requested_at: new Date(),
  });

  try {
    queueOtpEmail(email, {
      firstName: user.first_name || user.firstName,
      lastName: user.last_name || user.lastName,
      otp: otpCode,
    });
  } catch (e) {
    logger.warn("queueOtpEmail failed", { err: e.message });
  }

  return { success: true, status: 200, message: "OTP sent" };
};

// ------------------------------------------------------------------
// PROCESS RESET PASSWORD
// ------------------------------------------------------------------
exports.processResetPassword = async (input) => {
  const { email, otp, newPassword } = validate(input, resetPasswordSchema);

  const user = await Users.findOne({ where: { email } });
  if (!user) {
    throw new AppError(404, "Account not found");
  }

  // Verify OTP
  const providedHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (user.otp_code !== providedHash) {
    throw new AppError(400, "Invalid OTP");
  }
  if (new Date(user.otp_expired_at) <= new Date()) {
    throw new AppError(400, "OTP expired");
  }

  // Update password and clear OTP
  const hashedPassword = await hashPassword(newPassword);
  await user.update({
    password: hashedPassword,
    otp_code: null,
    otp_expired_at: null,
    password_changed_at: new Date(),
  });

  // Revoke all sessions — invalidates all active refresh tokens
  await revokeAllSessions(user.id, "PASSWORD_RESET");

  return { success: true, status: 200, message: "Password reset successful" };
};

// ------------------------------------------------------------------
// VERIFY USER SESSION
// ------------------------------------------------------------------
exports.verifyUserSession = async (userId, session) => {
  const user = await Users.findByPk(userId);
  if (!user) {
    throw new AppError(401, "Invalid session");
  }
  if (!user.is_active) {
    throw new AppError(403, "Account is suspended");
  }
  return {
    success: true,
    status: 200,
    message: "Token valid",
    data: { id: user.id, username: user.username, email: user.email },
  };
};

// ------------------------------------------------------------------
// JUST UPDATE PASSWORD
// ------------------------------------------------------------------
exports.justUpdatePassword = async (userId, newPassword) => {
  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(
      400,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  }
  const user = await Users.findByPk(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  await user.update({
    password: await hashPassword(newPassword),
    password_changed_at: new Date(),
  });
  // Revoke all sessions — invalidates all active refresh tokens
  await revokeAllSessions(userId, "PASSWORD_CHANGED");
  return {
    success: true,
    status: 200,
    message: "Password updated successfully",
  };
};

// ------------------------------------------------------------------
// CHECK PASSWORD VALIDITY
// ------------------------------------------------------------------
exports.passIsValid = async (userId, password) => {
  const user = await Users.findByPk(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const match = await comparePassword(password, user.password);
  return {
    success: true,
    status: 200,
    message: "Password is valid",
    data: { valid: match },
  };
};

// ------------------------------------------------------------------
// LOGOUT SESSION
// ------------------------------------------------------------------
exports.logoutSession = async (req) => {
  const userId = req.user.id;
  const token = req.token;
  if (token) {
    const refreshToken = generateRefreshToken({ id: userId });
    const session = await createSession({ userId, refreshToken });
    await set(
      cacheKeys.userSession(userId),
      session.id,
      DEFAULT_SESSION_EXPIRY_HOURS * 3600,
    );
  }
  return { success: true, status: 200, message: "Logout successful" };
};

// ------------------------------------------------------------------
// LOGOUT ALL SESSIONS
// ------------------------------------------------------------------
exports.logoutAllUserSessions = async (userId) => {
  await revokeAllSessions(userId, "USER_REQUESTED");
  await del(cacheKeys.userSessions(userId));
  return {
    success: true,
    status: 200,
    message: "All sessions revoked successfully",
  };
};
