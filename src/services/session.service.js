const crypto = require("crypto");

const { Sessions } = require("../models");

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

exports.hashToken = hashToken;

// ==========================================
// CREATE SESSION
// ==========================================

exports.createSession = async ({
  tenantId = null,
  userId,
  refreshToken,
  ipAddress,
  userAgent,
  device,
  expiredAt,
}) => {
  return await Sessions.create({
    tenantId,
    userId,

    tokenHash: hashToken(refreshToken),

    ipAddress,
    userAgent,
    device,

    expiredAt,
    lastActivityAt: new Date(),
  });
};

// ==========================================
// VALIDATE SESSION
// ==========================================

exports.validateSession = async (refreshToken) => {
  const tokenHash = hashToken(refreshToken);

  const session = await Sessions.findOne({
    where: {
      tokenHash,
      isRevoked: false,
      isActive: true,
    },
  });

  if (!session) {
    return null;
  }

  if (new Date(session.expiredAt) <= new Date()) {
    await session.update({
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: "SESSION_EXPIRED",
      isActive: false,
    });

    return null;
  }

  await session.update({
    lastActivityAt: new Date(),
  });

  return session;
};

// ==========================================
// REVOKE SESSION
// ==========================================

exports.revokeSession = async (refreshToken, reason = "LOGOUT") => {
  const tokenHash = hashToken(refreshToken);

  return await Sessions.update(
    {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
      isActive: false,
    },
    {
      where: {
        tokenHash,
      },
    },
  );
};

// ==========================================
// REVOKE ALL USER SESSIONS
// ==========================================

exports.revokeAllSessions = async (userId, reason = "LOGOUT_ALL") => {
  return await Sessions.update(
    {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason,
      isActive: false,
    },
    {
      where: {
        userId,
        isRevoked: false,
      },
    },
  );
};

// ==========================================
// ROTATE REFRESH TOKEN
// ==========================================

exports.rotateRefreshToken = async ({
  oldRefreshToken,
  newRefreshToken,
  expiredAt,
}) => {
  const session = await exports.validateSession(oldRefreshToken);

  if (!session) {
    return null;
  }

  await exports.revokeSession(oldRefreshToken, "TOKEN_ROTATION");

  return await exports.createSession({
    tenantId: session.tenantId,
    userId: session.userId,

    refreshToken: newRefreshToken,

    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    device: session.device,

    expiredAt,
  });
};

// ==========================================
// CLEANUP EXPIRED SESSIONS
// ==========================================

exports.cleanupExpiredSessions = async () => {
  return await Sessions.destroy({
    where: {
      expiredAt: {
        [require("sequelize").Op.lt]: new Date(),
      },
    },
  });
};
