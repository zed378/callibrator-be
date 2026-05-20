/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { auth } = require("../../middlewares/auth");
const {
  authRateLimiter,
  recordAuthFailure,
  resetAuthAttempts,
  rateLimitHeaders,
} = require("../../middlewares/tokenRateLimiter");

// IP-based rate limiter (additional layer for DDoS protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many requests from this IP, please try again later",
  },
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
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
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - username
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: Secret123
 *     responses:
 *       '201':
 *         description: Registration successful
 *       '409':
 *         description: Conflict (email or username already exists)
 *       '429':
 *         description: Too many requests - Rate limited (3 attempts per hour)
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
 *       '400':
 *         description: Invalid, missing or expired token
 *       '404':
 *         description: User not found
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
 *             type: object
 *             required:
 *               - user
 *               - password
 *             properties:
 *               user:
 *                 type: string
 *                 description: Username or email
 *                 example: sys
 *               password:
 *                 type: string
 *                 example: 123123
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
 *                 token:
 *                   type: string
 *                 data:
 *                   type: object
 *       '401':
 *         description: Invalid credentials
 *       '429':
 *         description: Too many login attempts - Rate limited (5 attempts per 15 minutes)
 *       '423':
 *         description: Account temporarily locked
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
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       '200':
 *         description: OTP sent
 *       '429':
 *         description: Too many requests - Rate limited (3 attempts per 15 minutes)
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
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       '200':
 *         description: Password reset successful
 *       '400':
 *         description: Invalid OTP
 *       '429':
 *         description: Too many requests - Rate limited (5 attempts per 5 minutes)
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
 *       '401':
 *         description: Invalid session
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
 */
router.post("/pass-is-valid", auth, passIsValid);

module.exports = router;
