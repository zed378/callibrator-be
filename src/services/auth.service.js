// auth.service.js
const { Op } = require('sequelize');
const { db } = require('../config');
const { Users, Sessions, LoginLogs, Roles } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, verifyAccessToken } = require('../utils/jwt');
const { hashToken } = require('../utils/session');
const { hashOTP, generateOTP } = require('../utils/otp');
const {
  sendOtpEmail,
  sendActivationEmail,
} = require('../services/email.service');
const {
  validate: validateInput,
  formatErrors,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');
const {
  acquireLock,
  releaseLock,
  get,
  set,
  cacheKeys,
} = require('../services/redis.service');
const {
  queueActivationEmail,
  queueOtpEmail,
} = require('../services/emailQueue.service');

// ==========================================
// VALIDATION HELPERS
// ==========================================

/**
 * Validate input data against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} - Validated and sanitized data
 */
const validate = (data, schema) => {
  const { error, value } = validateInput(data, schema);
  if (error) {
    throw {
      status: 400,
      message: 'Validation failed',
      errors: formatErrors(error.details),
    };
  }
  return value;
};

// ==========================================
// REGISTER
// ==========================================
exports.registerUser = async (input, origin) => {
  // Validate input
  const data = validate(input, registerSchema);
  const { firstName, lastName, username, email, password } = data;

  // Use origin from request header for multi-tenant support
  const baseOrigin = origin || '';

  // ---- distributed lock for race condition prevention -------------------
  const lockKey = `register:${email}:${username}`;
  const lockId = await acquireLock(lockKey, 10000);

  if (!lockId) {
    throw {
      status: 429,
      message: 'Registration in progress. Please wait and try again.',
    };
  }

  let transaction;
  try {
    transaction = await db.transaction();

    // ---- duplicate checks with SELECT FOR UPDATE -------------------------
    const existingUser = await Users.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingUser) {
      await transaction.rollback();
      throw { status: 409, message: 'Email already registered' };
    }

    const existingUsername = await Users.findOne({
      where: { username },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingUsername) {
      await transaction.rollback();
      throw { status: 409, message: 'Username already used' };
    }

    // ---- create user ------------------------------------------------------
    const hashedPassword = await hashPassword(password);
    const user = await Users.create(
      {
        firstName,
        lastName,
        username,
        email,
        password: hashedPassword,
        roleId: 'e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c',
      },
      { transaction },
    );

    // ---- cache user email mapping ----------------------------------------
    await set(cacheKeys.userByEmail(email), user.id, 86400);
    await set(cacheKeys.userByUsername(username), user.id, 86400);

    // ---- activation email (async via queue) ------------------------------
    const activationToken = generateAccessToken({
      id: user.id,
      type: 'activation',
    });
    const activationLink = `${baseOrigin}/activation?token=${activationToken}`;

    // Fire and forget - email sent asynchronously
    queueActivationEmail({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      activationLink,
    }).catch((err) => {
      // Log but don't fail registration if email queue fails
      console.error('Failed to queue activation email:', err.message);
    });

    await transaction.commit();

    // Release lock after successful registration
    await releaseLock(lockKey, lockId);

    return {
      success: true,
      status: 201,
      message:
        "Registration successful. Please check your email for activation. If you didn't receive an email just check junk or spam folder.",
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    // Release lock on error too
    await releaseLock(lockKey, lockId).catch(() => {});
    throw {
      status: error.status || 500,
      message: error.message,
    };
  }
};

// ==========================================
// ACTIVATION
// ==========================================
exports.activateAccount = async (token) => {
  if (!token) {
    throw { status: 400, message: 'Activation token is required' };
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw {
      status: 400,
      message: 'Invalid or expired activation token',
    };
  }

  if (decoded.type !== 'activation') {
    throw {
      status: 400,
      message: 'Invalid activation token type',
    };
  }

  const user = await Users.findOne({ where: { id: decoded.id } });
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }
  if (user.isEmailVerified) {
    throw { status: 400, message: 'Account already activated' };
  }

  await user.update({
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
  });

  return {
    success: true,
    status: 200,
    message: 'Account activated successfully',
  };
};

// ==========================================
// LOGIN
// ==========================================
exports.loginUser = async (input) => {
  // Validate input
  const data = validate(input, loginSchema);
  const { user, password, ip, userAgent } = data;

  let transaction;
  try {
    transaction = await db.transaction();

    const existingUser = await Users.findOne({
      where: {
        [Op.or]: [{ username: user }, { email: user }],
      },
      include: [
        {
          model: Roles,
          as: 'role',
          attributes: ['id', 'name', 'description', 'nameToShow'],
          where: {
            isActive: true,
          },
        },
      ],
      transaction,
    });

    if (!existingUser) {
      throw { status: 401, message: 'Invalid credentials' };
    }
    if (!existingUser.isEmailVerified) {
      throw { status: 403, message: 'Please verify your email first' };
    }
    if (existingUser.isBan) {
      throw { status: 403, message: 'Account has been suspended' };
    }
    if (
      existingUser.lockedUntil &&
      new Date(existingUser.lockedUntil) > new Date()
    ) {
      throw {
        status: 423,
        message: 'Account temporarily locked',
        lockedUntil: existingUser.lockedUntil,
      };
    }

    const validPassword = await comparePassword(
      password,
      existingUser.password,
    );
    if (!validPassword) {
      const failedAttempts = (existingUser.failedLoginAttempts || 0) + 1;
      let lockedUntil = null;
      if (failedAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await existingUser.update(
        {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
        { transaction },
      );
      await transaction.commit();
      throw { status: 401, message: 'Invalid credentials' };
    }

    // successful login – reset failure counters
    await existingUser.update(
      {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
      { transaction },
    );

    const token = generateAccessToken({
      id: existingUser.id,
      tenantId: existingUser.tenantId,
      role: existingUser.role,
      email: existingUser.email,
    });
    const tokenHash = hashToken(token);
    const session = await Sessions.create(
      {
        tenantId: existingUser.tenantId,
        userId: existingUser.id,
        tokenHash,
        ipAddress: ip,
        userAgent,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { transaction },
    );

    await LoginLogs.create(
      {
        userId: existingUser.id,
        tenantId: existingUser.tenantId,
        ipAddress: ip,
        userAgent,
        status: 'SUCCESS',
        loginAt: new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    const pictureUrl = process.env.HOST_URL + '/uploads/profile/';

    return {
      success: true,
      status: 200,
      message: 'Login successful',
      token,
      session,
      data: {
        id: existingUser.id,
        tenantId: existingUser.tenantId,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        email: existingUser.email,
        username: existingUser.username,
        role: existingUser.role,
        picture: pictureUrl + existingUser.picture,
      },
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.status || 500,
      message: error.message,
      lockedUntil: error.lockedUntil,
    };
  }
};

// ==========================================
// SEND OTP (forgot password)
// ==========================================
exports.requestOTP = async (input) => {
  // Validate input
  const data = validate(input, forgotPasswordSchema);
  const { email } = data;

  // ---- Redis rate limiting ------------------------------------------------
  const rateLimitKey = `otp:rate:${email}`;
  const rateLimitCount = await get(rateLimitKey);

  if (rateLimitCount !== null && rateLimitCount >= 3) {
    throw {
      status: 429,
      message: 'Too many OTP requests. Please wait 1 minute.',
    };
  }

  let transaction;
  try {
    transaction = await db.transaction();

    // ---- Use cached user lookup if available ------------------------------
    let user;
    const cachedUserId = await get(cacheKeys.userByEmail(email));

    if (cachedUserId) {
      user = await Users.findByPk(cachedUserId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    // Fallback to email lookup if cache miss
    if (!user) {
      user = await Users.findOne({
        where: { email },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    if (!user) {
      // Do not reveal whether an account exists – still return success
      await transaction.commit();
      // Still increment rate limit counter
      await set(rateLimitKey, (rateLimitCount || 0) + 1, 60);
      return {
        success: true,
        status: 200,
        message: 'If the account exists, OTP has been sent',
      };
    }

    if (!user.isEmailVerified) {
      await transaction.commit();
      await set(rateLimitKey, (rateLimitCount || 0) + 1, 60);
      throw { status: 403, message: 'Account email not verified' };
    }

    const now = Date.now();
    if (user.otpLastRequestedAt) {
      const diff = now - new Date(user.otpLastRequestedAt).getTime();
      if (diff < 60 * 1000) {
        await transaction.commit();
        await set(rateLimitKey, (rateLimitCount || 0) + 1, 60);
        throw {
          status: 429,
          message: 'Please wait before requesting another OTP',
        };
      }
    }

    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);
    await user.update(
      {
        otpCode: hashedOTP,
        otpExpiredAt: new Date(now + 5 * 60 * 1000),
        otpLastRequestedAt: new Date(),
        otpRequestCount: (user.otpRequestCount || 0) + 1,
      },
      { transaction },
    );

    await transaction.commit();

    // ---- Update rate limit counter ----------------------------------------
    await set(rateLimitKey, (rateLimitCount || 0) + 1, 60);

    // ---- Queue OTP email asynchronously -----------------------------------
    queueOtpEmail({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      otp,
    }).catch((err) => {
      console.error('Failed to queue OTP email:', err.message);
    });

    return {
      success: true,
      status: 200,
      message: 'If the account exists, OTP has been sent',
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.message.includes('wait')
        ? 429
        : error.message.includes('verified')
          ? 403
          : error.status || 500,
      message: error.message,
    };
  }
};

// ==========================================
// RESET PASSWORD
// ==========================================
exports.processResetPassword = async (input) => {
  // Validate input
  const data = validate(input, resetPasswordSchema);
  const { email, otp, password } = data;

  let transaction;
  try {
    transaction = await db.transaction();

    const user = await Users.findOne({ where: { email } }, { transaction });
    if (!user) {
      throw { status: 400, message: 'Invalid OTP or email' };
    }
    if (!user.otpCode) {
      throw { status: 400, message: 'OTP not found' };
    }
    if (!user.otpExpiredAt || new Date(user.otpExpiredAt) < new Date()) {
      // clear expired OTP
      await user.update({ otpCode: null, otpExpiredAt: null }, { transaction });
      await transaction.commit();
      throw { status: 400, message: 'OTP expired' };
    }

    const hashedOTP = hashOTP(otp);
    if (hashedOTP !== user.otpCode) {
      throw { status: 400, message: 'Invalid OTP' };
    }

    const hashedPassword = await hashPassword(password);
    await user.update(
      {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        otpCode: null,
        otpExpiredAt: null,
      },
      { transaction },
    );

    // revoke all existing sessions for this user
    await Sessions.update(
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'PASSWORD_RESET',
        isActive: false,
      },
      {
        where: { userId: user.id },
        transaction,
      },
    );

    await transaction.commit();
    return {
      success: true,
      status: 200,
      message: 'Password reset successful',
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.status || 500,
      message: error.message,
    };
  }
};

// ==========================================
// LOGOUT
// ==========================================
exports.logoutSession = async (sessionId) => {
  let transaction;
  try {
    transaction = await db.transaction();
    await Sessions.update(
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'LOGOUT',
        isActive: false,
      },
      { where: { id: sessionId }, transaction },
    );
    await transaction.commit();
    return {
      success: true,
      status: 200,
      message: 'Logout successful',
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.status || 500,
      message: error.message,
    };
  }
};

// ==========================================
// LOGOUT ALL
// ==========================================
exports.logoutAllUserSessions = async (userId) => {
  let transaction;
  try {
    transaction = await db.transaction();
    await Sessions.update(
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'LOGOUT_ALL',
        isActive: false,
      },
      { where: { userId, isRevoked: false }, transaction },
    );
    await transaction.commit();
    return {
      success: true,
      status: 200,
      message: 'All sessions revoked successfully',
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.status || 500,
      message: error.message,
    };
  }
};

// ==========================================
// VERIFY USER SESSION
// ==========================================
exports.verifyUserSession = async (userId, sessionId) => {
  let transaction;
  try {
    transaction = await db.transaction();

    const user = await Users.findOne({
      where: { id: userId },
      attributes: {
        exclude: ['password', 'otpCode'],
      },
      include: [
        {
          model: Roles,
          as: 'role',
          attributes: ['id', 'name', 'description', 'nameToShow'],
          where: {
            isActive: true,
          },
        },
      ],
      transaction,
    });

    if (!user) {
      throw { status: 401, message: 'User not found' };
    }
    if (user.isBanned) {
      throw { status: 403, message: 'Account banned' };
    }

    const session = await Sessions.findByPk(sessionId, {
      transaction,
    });
    if (!session) {
      throw { status: 401, message: 'Session not found' };
    }
    if (session.isRevoked) {
      throw { status: 401, message: 'Session revoked' };
    }
    if (new Date(session.expiredAt) < new Date()) {
      throw { status: 401, message: 'Session expired' };
    }

    // update last activity
    await session.update({ lastActivityAt: new Date() }, { transaction });

    await transaction.commit();

    const pictureUrl = process.env.HOST_URL + '/uploads/profile/';

    return {
      success: true,
      status: 200,
      message: 'Token valid',
      data: {
        id: user.id,
        tenantId: user.tenantId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        role: user.role,
        picture: pictureUrl + user.picture,
      },
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.message.includes('banned') ? 403 : error.status || 401,
      message: error.message,
    };
  }
};

// ==========================================
// UPDATE PASSWORD ONLY
// ==========================================
exports.justUpdatePassword = async (userId, newPassword) => {
  if (!newPassword || typeof newPassword !== 'string') {
    throw {
      status: 400,
      message: 'New password is required and must be a string',
    };
  }
  if (newPassword.length < 6) {
    throw {
      status: 400,
      message: 'Password must be at least 6 characters long',
    };
  }

  let transaction;
  try {
    transaction = await db.transaction();
    const user = await Users.findByPk(userId, { transaction });
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }
    const hashed = await hashPassword(newPassword);
    await user.update(
      { password: hashed, passwordChangedAt: new Date() },
      { transaction },
    );
    await transaction.commit();
    return {
      success: true,
      status: 200,
      message: 'Password updated successfully',
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.status || 500,
      message: error.message,
    };
  }
};

// ==========================================
// CHECK PASSWORD VALIDITY
// ==========================================
exports.passIsValid = async (userId, candidatePassword) => {
  if (!candidatePassword || typeof candidatePassword !== 'string') {
    throw { status: 400, message: 'Password must be a non‑empty string' };
  }

  let transaction;
  try {
    transaction = await db.transaction();
    const user = await Users.findByPk(userId, {
      attributes: ['id', 'password'],
      transaction,
    });
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }
    const valid = await comparePassword(candidatePassword, user.password);
    if (!valid) {
      throw { status: 401, message: 'Invalid password' };
    }
    await transaction.commit();
    return {
      success: true,
      status: 200,
      message: 'Password is valid',
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw {
      status: error.status || 500,
      message: error.message,
    };
  }
};
