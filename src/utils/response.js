/**
 * Standardized API Response Helper
 * Ensures consistent response format across all endpoints
 */

/**
 * Send a success response
 * @param {import('express').Response} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const success = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    status: statusCode,
    message,
    data,
  });
};

/**
 * Send an error response
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {*} details - Optional error details (development only)
 */
const error = (res, message, statusCode = 500, details = null) => {
  const response = {
    success: false,
    status: statusCode,
    message,
  };

  // Include details only in development
  if (process.env.NODE_ENV !== "production" && details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send a not found response
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Not found message
 */
const notFound = (res, message = "Resource not found") => {
  return error(res, message, 404);
};

/**
 * Send a bad request response
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Validation error message
 */
const badRequest = (res, message = "Bad request") => {
  return error(res, message, 400);
};

/**
 * Send an unauthorized response
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Unauthorized message
 */
const unauthorized = (res, message = "Unauthorized") => {
  return error(res, message, 401);
};

/**
 * Send a forbidden response
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Forbidden message
 */
const forbidden = (res, message = "Forbidden") => {
  return error(res, message, 403);
};

module.exports = {
  success,
  error,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
};
