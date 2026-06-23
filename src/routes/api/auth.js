/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints (register, login, OTP, password reset, session management)
 */

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { auth } = require("../../middlewares/auth");
const { RATE_LIMIT } = require("../../constants/appConstants");
const {
  authRateLimiter,
  recordAuthFailure,
  resetAuthAttempts,
  rateLimitHeaders,
} = require("../../middlewares/tokenRateLimiter");

// IP-based rate limiter (DDoS protection — global limiters in index.js handle per-endpoint)
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.STANDARD_WINDOW,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many requests from this IP, please try again later",
  },
});

const otpLimiter = rateLimit({
  windowMs: RATE_LIMIT.HOUR_WINDOW,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many requests from this IP, please try again later",
  },
});

const {
  register,
  login,
  activation,
  sendOTP,
  resetPassword,
  logout,
  logoutAll,
  verify,
  justUpdatePassword,
  passIsValid,
  refresh,
} = require("../../controllers/auth.controller");

/* ------------------------------------------------------------------ */
/* REGISTER */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: Public endpoint - no authentication or permission required. Rate limited to 3 attempts per hour to prevent abuse.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       '201':
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       '409':
 *         description: Conflict (email or username already exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: Too many requests - Rate limited (3 attempts per hour)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/register",
  authLimiter,
  authRateLimiter("register"),
  rateLimitHeaders(),
  register,
  recordAuthFailure("register"),
);

/* ------------------------------------------------------------------ */
/* ACTIVATION */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/activation:
 *   get:
 *     tags: [Auth]
 *     summary: Activate user account using token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           description: Activation token sent via email
 *     responses:
 *       '200':
 *         description: Account activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       '400':
 *         description: Invalid, missing or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/activation", activation);

/* ------------------------------------------------------------------ */
/* LOGIN */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in a user
 *     description: Public endpoint - no authentication or permission required. Rate limited to 5 attempts per 15 minutes. Account will be locked for 15 minutes after too many failed attempts. Token is revoked if brute force is detected.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 token:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       '401':
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: Too many login attempts - Rate limited (5 attempts per 15 minutes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '423':
 *         description: Account temporarily locked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/login",
  authLimiter,
  authRateLimiter("login"),
  rateLimitHeaders(),
  login,
  resetAuthAttempts("login"),
  recordAuthFailure("login"),
);

/* ------------------------------------------------------------------ */
/* SEND OTP (forgot password) */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP for password reset
 *     description: Public endpoint - no authentication or permission required. Rate limited to 3 attempts per 15 minutes to prevent OTP abuse.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendOtpRequest'
 *     responses:
 *       '200':
 *         description: OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: Too many requests - Rate limited (3 attempts per 15 minutes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/send-otp",
  otpLimiter,
  authRateLimiter("forgotPassword"),
  rateLimitHeaders(),
  sendOTP,
  recordAuthFailure("forgotPassword"),
);

/* ------------------------------------------------------------------ */
/* RESET PASSWORD */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using OTP
 *     description: Public endpoint - no authentication or permission required. Requires valid OTP sent to email. Rate limited to 5 attempts per 5 minutes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       '200':
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       '400':
 *         description: Invalid OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: Too many requests - Rate limited (5 attempts per 5 minutes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/reset-password",
  otpLimiter,
  authRateLimiter("resetPassword"),
  rateLimitHeaders(),
  resetPassword,
  recordAuthFailure("resetPassword"),
);

/* ------------------------------------------------------------------ */
/* LOGOUT (single session) */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     summary: Log out a single session
 *     description: Requires authentication. Users can revoke their current session. No specific permission required - available to all authenticated users.
 *     responses:
 *       '200':
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post("/logout", auth, logout);

/* ------------------------------------------------------------------ */
/* LOGOUT ALL (requires auth) */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     summary: Log out all sessions for the authenticated user
 *     description: Requires authentication. Users can revoke all their active sessions. No specific permission required - available to all authenticated users.
 *     responses:
 *       '200':
 *         description: All sessions revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post("/logout-all", auth, logoutAll);

/* ------------------------------------------------------------------ */
/* VERIFY SESSION (requires auth) */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/verify:
 *   post:
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     summary: Verify a user session
 *     description: Requires authentication. Verifies if the current token is valid. No specific permission required - available to all authenticated users.
 *     responses:
 *       '200':
 *         description: Token valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       '401':
 *         description: Invalid session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/verify", auth, verify);

/* ------------------------------------------------------------------ */
/* JUST UPDATE PASSWORD (requires auth) */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/just-update-password:
 *   post:
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     summary: Update the password of the logged-in user
 *     description: Requires authentication. Users can update their own password. Uses user:self:update permission implicitly.
 *     responses:
 *       '200':
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post("/just-update-password", auth, justUpdatePassword);

/* ------------------------------------------------------------------ */
/* PASSWORD VALIDITY CHECK (requires auth) */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/pass-is-valid:
 *   post:
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     summary: Check whether the supplied password matches
 *     description: Requires authentication. Verifies if the supplied password matches the user's current password. No specific permission required - available to all authenticated users.
 *     responses:
 *       '200':
 *         description: Password is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Password is valid"
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 */
router.post("/pass-is-valid", auth, passIsValid);

/* ------------------------------------------------------------------ */
/* REFRESH TOKEN */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh an access token using a valid refresh token
 *     description: |
 *       - Requires a valid, unexpired, non-revoked refresh token
 *       - Returns a new access token AND a new refresh token (rotation)
 *       - The old refresh token is revoked immediately
 *       - Supports token binding via sessionId for extra security
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Token refreshed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       '400':
 *         description: Refresh token is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/refresh",
  authRateLimiter("refreshToken"),
  rateLimitHeaders(),
  refresh,
);

module.exports = router;
