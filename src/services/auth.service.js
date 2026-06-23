// auth.service.js
const { AppError } = require("../utils/appError");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { db } = require("../config");
const { Users } = require("../models");
const { hashPassword, comparePassword } = require("../utils/password");
const {
  generateAccessToken,
  verifyAccessToken,
  generateOpaqueRefreshToken,
} = require("../utils/jwt");
// Email service (sendOtpEmail/sendActivationEmail not used — emailQueue.service is used instead)
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
  // get not used
  set,
  del,
  cacheKeys,
} = require("../services/redis.service");
const { logger } = require("../middlewares/activityLog");
const {
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
} = require("../services/session.service");
const { PASSWORD_MIN_LENGTH, ROLE_IDS } = require("../constants");

const validate = (data, schema) => {
  const { error, value } = validateInput(data, schema);
  if (error) {
    throw new AppError(
      400,
      "Validation failed",
      true,
      formatErrors(error.details),
    );
  }
  return value;
};

// Safe user attributes — exclude sensitive/secret fields (used by user.service)
// const safeUserAttrs = { exclude: ["updatedAt", "otpCode", ...] };

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
    throw new AppError(
      429,
      "Registration in progress. Please wait and try again.",
    );
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
        firstName,
        lastName,
        username,
        email,
        password: hashedPassword,
        roleId: ROLE_IDS.USER,
        isEmailVerified: false,
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
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
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
  const validated = validate(input, loginSchema);
  const loginIdentifier =
    validated.user || validated.username || validated.email;
  const password = validated.password;
  // Normalize: schema uses 'user' (email or username), service uses 'username'
  const username = typeof loginIdentifier === "string" ? loginIdentifier : null;
  if (!username) {
    throw new AppError(401, "Invalid credentials");
  }
  const { ip, userAgent } = input;

  // Support login by username OR email
  const dbUser = await Users.findOne({
    where: {
      [Op.or]: [{ username }, { email: username }],
    },
    include: [
      {
        model: require("../models").Role,
        as: "role",
        attributes: ["id", "name"],
        required: false,
      },
    ],
  });
  if (!dbUser) {
    throw new AppError(401, "Invalid credentials");
  }
  if (!dbUser.isActive) {
    throw new AppError(403, "Account is suspended");
  }

  const lockedUntil = dbUser.lockedUntil;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    throw new AppError(423, "Account temporarily locked");
  }

  const match = await comparePassword(password, dbUser.password);
  if (!match) {
    const attempts = (dbUser.failedLoginAttempts || 0) + 1;
    await dbUser.update({ failedLoginAttempts: attempts });

    if (attempts >= 5) {
      await dbUser.update({
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });
      throw new AppError(423, "Account locked due to too many failed attempts");
    }
    throw new AppError(401, "Invalid credentials");
  }

  // Reset failed attempts on success
  if (dbUser.failedLoginAttempts > 0) {
    await dbUser.update({ failedLoginAttempts: 0, lockedUntil: null });
  }

  // Update last login
  await dbUser.update({ lastLoginAt: new Date() });

  const accessToken = generateAccessToken({
    id: dbUser.id,
    email: dbUser.email,
  });
  const refreshToken = generateOpaqueRefreshToken();

  // Create session
  const session = await createSession({
    tenantId: dbUser.tenantId,
    userId: dbUser.id,
    refreshToken,
    ipAddress: ip || "",
    userAgent: userAgent || "",
    expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // Include role info with the user data
  const role = dbUser.role
    ? {
      id: dbUser.role.id,
      name: dbUser.role.name,
    }
    : null;

  return {
    success: true,
    status: 200,
    message: "Login successful",
    data: {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      roleId: dbUser.roleId,
      role,
    },
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

  if (user.isEmailVerified) {
    return { success: true, status: 200, message: "Account already activated" };
  }

  await user.update({ isEmailVerified: true });
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
    otpCode: otpHashed,
    otpExpiredAt: otpExpiredAt,
    otpRequestCount: (user.otpRequestCount || 0) + 1,
    otpLastRequestedAt: new Date(),
  });

  try {
    queueOtpEmail(email, {
      firstName: user.firstName,
      lastName: user.lastName,
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
  if (user.otpCode !== providedHash) {
    throw new AppError(400, "Invalid OTP");
  }
  if (new Date(user.otpExpiredAt) <= new Date()) {
    throw new AppError(400, "OTP expired");
  }

  // Update password and clear OTP
  const hashedPassword = await hashPassword(newPassword);
  await user.update({
    password: hashedPassword,
    otpCode: null,
    otpExpiredAt: null,
    passwordChangedAt: new Date(),
  });

  // Revoke all sessions — invalidates all active refresh tokens
  await revokeAllSessions(user.id, "PASSWORD_RESET");

  return { success: true, status: 200, message: "Password reset successful" };
};

// ------------------------------------------------------------------
// VERIFY USER SESSION
// ------------------------------------------------------------------
exports.verifyUserSession = async (userId, _session) => {
  const user = await Users.findByPk(userId, {
    include: [
      {
        model: require("../models").Role,
        as: "role",
        attributes: ["id", "name"],
        required: false,
      },
    ],
  });
  if (!user) {
    throw new AppError(401, "Invalid session");
  }
  if (!user.isActive) {
    throw new AppError(403, "Account is suspended");
  }
  return {
    success: true,
    status: 200,
    message: "Token valid",
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
    },
  };
};

// ------------------------------------------------------------------
// GET AUTH USER (FOR MIDDLEWARE)
// ------------------------------------------------------------------
exports.getAuthUserWithTenant = async (userId) => {
  const { Roles, Tenants } = require("../models");
  return await Users.findByPk(userId, {
    include: [
      {
        model: Roles,
        as: "role",
        attributes: ["id", "name", "description"],
        required: false,
      },
      {
        model: Tenants,
        as: "tenant",
        attributes: ["id", "name", "status"],
        required: false,
      },
    ],
  });
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
    passwordChangedAt: new Date(),
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
  const token = req.token || null;
  if (token) {
    await revokeSession(token, "LOGOUT");
  }
  return { success: true, status: 200, message: "Logout successful" };
};

// ------------------------------------------------------------------
// REFRESH USER TOKEN
// ------------------------------------------------------------------
exports.refreshUserToken = async (
  refreshToken,
  sessionId = null,
  ipAddress = null,
  userAgent = null,
) => {
  // 1. Validate the opaque token hash against sessions table
  const session = await validateSession(refreshToken);

  if (!session) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  // 2. Token binding check (optional but recommended)
  if (sessionId && session.id !== sessionId) {
    await revokeAllSessions(session.userId, "TOKEN_MISMATCH");
    throw new AppError(
      401,
      "Session mismatch. All sessions have been revoked for security.",
    );
  }

  // 3. Generate new opaque refresh token
  const newRefreshToken = generateOpaqueRefreshToken();

  // 4. Generate new access token
  const user = await Users.findByPk(session.userId);
  if (!user) {
    throw new AppError(401, "User not found");
  }

  const newAccessToken = generateAccessToken({
    id: user.id,
    email: user.email,
  });

  // 5. Revoke old session (token rotation)
  await revokeSession(refreshToken, "TOKEN_ROTATION");

  // 6. Create new session with new token
  const newSession = await createSession({
    tenantId: session.tenantId,
    userId: session.userId,
    refreshToken: newRefreshToken,
    ipAddress: ipAddress || session.ipAddress,
    userAgent: userAgent || session.userAgent,
    device: session.device,
    expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  return {
    success: true,
    status: 200,
    message: "Token refreshed successfully",
    data: {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      session: newSession,
    },
  };
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
