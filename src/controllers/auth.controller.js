// auth.controller.js
const authService = require("../services/auth.service");
const { asyncHandlerWithMapping } = require("../utils/controllerWrapper");
const { success, badRequest, error } = require("../utils/response");
const { recordFailedAttempt } = require("../services/rateLimiter.service");

// ==========================================
// REGISTER
// ==========================================

exports.register = asyncHandlerWithMapping(
  async (req, res) => {
    // Use Origin header for multi-tenant support, fall back to Host header
    const origin = req.headers.origin || req.headers.host || "";

    await authService.registerUser(req.body, origin); // service creates its own tx

    success(
      res,
      null,
      "Registration successful. Please check your email for activation.",
      201,
    );
  },
  {
    registered: 409,
    used: 409,
  },
);

// ==========================================
// ACTIVATION
// ==========================================

exports.activation = asyncHandlerWithMapping(
  async (req, res) => {
    const { token } = req.query;
    if (!token) {
      throw { status: 400, message: "Activation token is required" };
    }

    await authService.activateAccount(token);

    success(res, null, "Account activated successfully", 200);
  },
  {
    "not found": 404,
  },
);

// ==========================================
// LOGIN
// ==========================================

exports.login = asyncHandlerWithMapping(
  async (req, res) => {
    const result = await authService.loginUser({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    }); // service creates its own tx

    success(
      res,
      {
        token: result.token,
        session: result.session.id,
        data: result.data,
      },
      "Login successful",
      200,
    );
  },
  {
    credentials: 401,
    verify: 403,
    suspended: 403,
    locked: 423,
  },
);

// ==========================================
// SEND OTP
// ==========================================

exports.sendOTP = asyncHandlerWithMapping(
  async (req, res) => {
    await authService.requestOTP(req.body); // service creates its own tx

    success(res, null, "If the account exists, OTP has been sent", 200);
  },
  {
    wait: 429,
    verified: 403,
  },
);

// ==========================================
// RESET PASSWORD
// ==========================================

exports.resetPassword = asyncHandlerWithMapping(async (req, res) => {
  await authService.processResetPassword(req.body); // service creates its own tx

  success(res, null, "Password reset successful", 200);
}, {});

// ==========================================
// LOGOUT
// ==========================================

exports.logout = asyncHandlerWithMapping(async (req, res) => {
  await authService.logoutSession(req.body.sessionId);
  success(res, null, "Logout successful", 200);
}, {});

// ==========================================
// LOGOUT ALL
// ==========================================

exports.logoutAll = asyncHandlerWithMapping(async (req, res) => {
  await authService.logoutAllUserSessions(req.user.id);
  success(res, null, "All sessions revoked successfully", 200);
}, {});

// ==========================================
// VERIFY TOKEN
// ==========================================

exports.verify = asyncHandlerWithMapping(
  async (req, res) => {
    const userData = await authService.verifyUserSession(
      req.user.id,
      req.session,
    );

    success(res, userData, "Token valid", 200);
  },
  {
    banned: 403,
  },
);

// ==========================================
// UPDATE PASSWORD ONLY
// ==========================================

exports.justUpdatePassword = asyncHandlerWithMapping(async (req, res) => {
  const { id: userId } = req.user;
  const { newPassword } = req.body;
  const result = await authService.justUpdatePassword(userId, newPassword);
  success(res, result.data, result.message, result.status);
}, {});

// ==========================================
// CHECK PASSWORD VALIDITY
// ==========================================

exports.passIsValid = asyncHandlerWithMapping(async (req, res) => {
  const { id: userId } = req.user;
  const { password } = req.body;
  const result = await authService.passIsValid(userId, password);
  success(res, result.data, result.message, result.status);
}, {});
