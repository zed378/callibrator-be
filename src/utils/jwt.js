const jwt = require("jsonwebtoken");

// ==========================================
// ENV VALIDATION
// ==========================================

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Validate JWT secrets are configured at startup
if (!ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET environment variable is required");
}

if (!REFRESH_SECRET) {
  throw new Error("JWT_REFRESH_SECRET environment variable is required");
}

// ==========================================
// ENV
// ==========================================

// ==========================================
// ACCESS TOKEN
// ==========================================

const generateAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRED || "15m",
  });
};

// ==========================================
// REFRESH TOKEN
// ==========================================

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRED || "7d",
  });
};

// ==========================================
// VERIFY ACCESS TOKEN
// ==========================================

const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

// ==========================================
// VERIFY REFRESH TOKEN
// ==========================================

const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

// ==========================================
// DECODE
// ==========================================

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
