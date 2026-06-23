/**
 * Controller Wrapper Utility
 * Eliminates repetitive try/catch blocks in controllers
 *
 * Usage:
 *   const { asyncHandler } = require("../utils/controllerWrapper");
 *
 *   exports.getAllUsers = asyncHandler(async (req, res) => {
 *     const result = await userService.fetchUsers(req.query);
 *     res.success(result);
 *   });
 */

const { error: sendError } = require("./response");
const { AppError } = require("./appError");

/**
 * Wraps an async controller function to handle errors centrally
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch((error) => {
      // Handle AppError instances properly
      if (error instanceof AppError) {
        const isDevelopment = process.env.NODE_ENV !== "production";
        return sendError(
          res,
          error.message,
          error.status,
          isDevelopment ? error.stack : null,
        );
      }

      // Handle plain object errors (legacy format)
      if (typeof error === "object" && error.status && error.message) {
        return sendError(
          res,
          error.message,
          error.status,
          process.env.NODE_ENV !== "production" ? error.stack : null,
        );
      }

      // Handle native Error instances
      if (error instanceof Error) {
        return sendError(
          res,
          error.message || "Internal server error",
          error.status || 500,
          process.env.NODE_ENV !== "production" ? error.stack : null,
        );
      }

      // Fallback for unknown error types
      return sendError(
        res,
        "Internal server error",
        500,
        process.env.NODE_ENV !== "production" ? String(error) : null,
      );
    });
  };
};

/**
 * Wraps a controller with custom error mapping
 * Use this when service errors use string matching instead of status codes
 *
 * Usage:
 *   exports.getAllUsers = asyncHandlerWithMapping(async (req, res) => { ... }, {
 *     credentials: 401,
 *     verify: 403,
 *     suspended: 403,
 *     locked: 423,
 *   });
 */
const asyncHandlerWithMapping = (fn, errorMap = {}) => {
  return (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch((error) => {
      let statusCode = error.status || error.statusCode || 500;
      const errorMessage = error.message || "Internal server error";

      // Map error message patterns to status codes
      for (const [pattern, code] of Object.entries(errorMap)) {
        if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
          statusCode = code;
          break;
        }
      }

      const { error: sendError } = require("./response");
      return sendError(res, errorMessage, statusCode);
    });
  };
};

module.exports = {
  asyncHandler,
  asyncHandlerWithMapping,
};
