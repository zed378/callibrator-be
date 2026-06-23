// auth.controller.js
const { AppError } = require("../utils/appError");
const authService = require("../services/auth.service");
const { asyncHandlerWithMapping } = require("../utils/controllerWrapper");
const { success, login } = require("../utils/response");
const {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  validate,
} = require("../validators/auth.validator");

exports.register = asyncHandlerWithMapping(
  async (req, res) => {
    validate(req.body, registerSchema);

    const origin = req.headers.origin || req.headers.host || "";

    await authService.registerUser(req.body, origin);

    success(
      res,
      null,
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

exports.activation = asyncHandlerWithMapping(
  async (req, res) => {
    const { token } = req.query;
    if (!token) {
      throw new AppError(400, "Activation token is required");
    }

    await authService.activateAccount(token);

    success(res, null, null, "Account activated successfully", 200);
  },
  {
    "not found": 404,
  },
);

exports.login = asyncHandlerWithMapping(
  async (req, res) => {
    validate(req.body, loginSchema);

    const result = await authService.loginUser({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    login(res, result.data, result.token, result.session);
  },
  {
    credentials: 401,
    verify: 403,
    suspended: 403,
    locked: 423,
  },
);

exports.sendOTP = asyncHandlerWithMapping(
  async (req, res) => {
    await authService.requestOTP(req.body);

    success(res, null, null, "If the account exists, OTP has been sent", 200);
  },
  {
    wait: 429,
    verified: 403,
  },
);

exports.resetPassword = asyncHandlerWithMapping(async (req, res) => {
  validate(req.body, resetPasswordSchema);

  await authService.processResetPassword(req.body);

  success(res, null, null, "Password reset successful", 200);
}, {});

exports.logout = asyncHandlerWithMapping(async (req, res) => {
  await authService.logoutSession();
  success(res, null, null, "Logout successful", 200);
}, {});

exports.logoutAll = asyncHandlerWithMapping(async (req, res) => {
  await authService.logoutAllUserSessions(req.user.id);
  success(res, null, null, "All sessions revoked successfully", 200);
}, {});

exports.verify = asyncHandlerWithMapping(
  async (req, res) => {
    const result = await authService.verifyUserSession(
      req.user.id,
      req.session,
    );

    success(res, result.data, null, result.message, result.status);
  },
  {
    banned: 403,
  },
);

exports.justUpdatePassword = asyncHandlerWithMapping(async (req, res) => {
  const { id: userId } = req.user;
  const { newPassword } = req.body;
  const result = await authService.justUpdatePassword(userId, newPassword);
  success(res, null, null, result.message, 200);
}, {});

exports.passIsValid = asyncHandlerWithMapping(async (req, res) => {
  const { id: userId } = req.user;
  const { password } = req.body;
  const result = await authService.passIsValid(userId, password);
  success(res, result.data, null, result.message, 200);
}, {});

exports.refresh = asyncHandlerWithMapping(async (req, res) => {
  const { refreshToken, sessionId } = req.body;
  if (!refreshToken) {
    throw new AppError(400, "Refresh token is required");
  }
  const result = await authService.refreshUserToken(
    refreshToken,
    sessionId || null,
    req.ip,
    req.headers["user-agent"],
  );
  success(res, result.data, null, result.message, 200);
}, {});
