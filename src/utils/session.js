const crypto = require("crypto");

const { Sessions } = require("../models");

// ==========================================
// HASH TOKEN
// ==========================================

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// ==========================================
// CREATE SESSION
// ==========================================

const createSession = async ({
  userId,
  token,
  ipAddress = null,
  userAgent = null,
  expiredAt,
}) => {
  const tokenHash = hashToken(token);

  return Sessions.create({
    userId,
    tokenHash,
    ipAddress,
    userAgent,
    expiredAt,
    isRevoked: false,
  });
};

// ==========================================
// FIND SESSION
// ==========================================

const findSession = async ({ token, userId, sessionId }) => {
  const tokenHash = hashToken(token);

  const where = {
    isRevoked: false,
  };

  // Prioritize session ID from x-session header
  if (sessionId) {
    where.id = sessionId;
  } else {
    // Fallback to token-based lookup
    where.tokenHash = tokenHash;
    where.userId = userId;
  }

  return Sessions.findOne({
    where,
  });
};

// ==========================================
// REVOKE SESSION
// ==========================================

const revokeSession = async ({ token, userId }) => {
  const tokenHash = hashToken(token);

  return Sessions.update(
    {
      isRevoked: true,
    },
    {
      where: {
        tokenHash,
        userId,
      },
    },
  );
};

// ==========================================
// REVOKE ALL USER SESSIONS
// ==========================================

const revokeAllUserSessions = async (userId) => {
  return Sessions.update(
    {
      isRevoked: true,
    },
    {
      where: {
        userId,
      },
    },
  );
};

module.exports = {
  hashToken,
  createSession,
  findSession,
  revokeSession,
  revokeAllUserSessions,
};
