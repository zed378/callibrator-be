const { logger } = require('./activityLog');

/**
 * Global Error Handler Middleware
 * Logs errors with Winston and returns standardized JSON responses
 */
exports.errorHandler = (err, req, res, next) => {
  const statusCode = err.status || 500;
  const message = err.message || 'Internal server error';
  const requestId = req.requestId || 'unknown';

  // Structured logging with Winston
  logger.error(message, {
    requestId,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    stack: err.stack,
  });

  // Build response
  const response = {
    success: false,
    status: statusCode,
    message,
    requestId,
  };

  // Include validation errors if present
  if (err.errors) {
    response.errors = err.errors;
  }

  // Include stack trace only in development
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};
