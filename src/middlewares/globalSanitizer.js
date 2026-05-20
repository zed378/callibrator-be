const xss = require("xss");

// Fields that should NOT be sanitized
// Useful for:
// - rich text editor
// - markdown
// - html templates
const excludedFields = ["html", "rawHtml"];

// Recursive sanitizer
function sanitize(data, parentKey = "") {
  // String
  if (typeof data === "string") {
    // Skip excluded fields
    if (excludedFields.includes(parentKey)) {
      return data;
    }

    return xss(data.trim());
  }

  // Array
  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, parentKey));
  }

  // Object
  if (typeof data === "object" && data !== null) {
    const sanitizedObject = {};

    for (const key in data) {
      sanitizedObject[key] = sanitize(data[key], key);
    }

    return sanitizedObject;
  }

  // Other types
  return data;
}

// Global Sanitizer Middleware
const globalSanitizer = (req, res, next) => {
  try {
    // Sanitize Request Body
    if (req.body) {
      req.body = sanitize(req.body);
    }

    // Sanitize Query Parameters
    if (req.query) {
      req.query = sanitize(req.query);
    }

    // Sanitize Route Parameters
    if (req.params) {
      req.params = sanitize(req.params);
    }

    next();
  } catch (error) {
    return res.status(500).json({
      status: "Error",
      message: "Sanitization failed",
      error: error.message,
    });
  }
};

module.exports = {
  globalSanitizer,
};
