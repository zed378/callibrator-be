const xss = require("xss");

// Fields that should NOT be sanitized (binary/base64-like content)
const EXCLUDED_FIELDS = [
  "avatar_url",
  "avatar",
  "signature",
  "file_content",
  "content_base64",
];

/**
 * Recursively sanitize a value
 */
function sanitize(data, parentKey = "") {
  // Skip excluded fields (likely binary/base64)
  if (EXCLUDED_FIELDS.includes(parentKey)) {
    return data;
  }

  if (typeof data === "string") {
    return xss(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, parentKey));
  }
  if (data && typeof data === "object") {
    const sanitizedObject = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitizedObject[key] = sanitize(data[key], key);
      }
    }
    return sanitizedObject;
  }
  return data;
}

/**
 * Global XSS Sanitizer Middleware
 * Sanitizes all incoming request data to prevent XSS attacks
 */
const globalSanitizer = (req, res, next) => {
  // Sanitize Request Body
  if (req.body && typeof req.body === "object") {
    req.body = sanitize(req.body);
  }

  // Sanitize Query Parameters
  if (req.query && typeof req.query === "object") {
    req.query = sanitize(req.query);
  }

  // Sanitize Route Parameters
  if (req.params && typeof req.params === "object") {
    req.params = sanitize(req.params);
  }

  next();
};

module.exports = { globalSanitizer };
