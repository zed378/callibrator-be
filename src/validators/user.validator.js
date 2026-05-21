/**
 * User validation schemas
 */
const Joi = require("joi");

// ==========================================
// COMMON FIELDS
// ==========================================

const email = Joi.string()
  .trim()
  .lowercase()
  .email()
  .min(6)
  .max(255)
  .required();

const username = Joi.string()
  .trim()
  .lowercase()
  .alphanum()
  .min(3)
  .max(30)
  .required();

// ==========================================
// CREATE USER
// ==========================================

exports.createUserSchema = Joi.object({
  tenantId: Joi.string().uuid().allow(null, ""),
  username,
  firstName: Joi.string().trim().min(2).max(100).required(),
  lastName: Joi.string().trim().min(2).max(100).required(),
  email,
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/,
    )
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character",
    }),
  roleId: Joi.string().uuid().required(),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED")
    .default("ACTIVE"),
  createdBy: Joi.string().uuid().allow(null, ""),
});

// ==========================================
// UPDATE USER
// ==========================================

exports.updateUserSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  tenantId: Joi.string().uuid().allow(null, ""),
  username,
  firstName: Joi.string().trim().min(2).max(100),
  lastName: Joi.string().trim().min(2).max(100).allow(null, ""),
  email,
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/,
    )
    .messages({
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character",
    }),
  roleId: Joi.string().uuid(),
  status: Joi.string().valid("ACTIVE", "INACTIVE", "SUSPENDED"),
  isEmailVerified: Joi.boolean(),
  isBanned: Joi.boolean(),
  newPassword: Joi.string()
    .min(8)
    .max(100)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/,
    )
    .messages({
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character",
    }),
  updatedBy: Joi.string().uuid().allow(null, ""),
});

// ==========================================
// USER ROLE UPDATE
// ==========================================

exports.updateUserRoleSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  roleId: Joi.string().uuid().required(),
  updatedBy: Joi.string().uuid().required(),
});

// ==========================================
// CHECK USERNAME
// ==========================================

exports.checkUsernameSchema = Joi.object({
  username,
});

// ==========================================
// VALIDATION HELPER
// ==========================================

/**
 * Validate request body against a Joi schema
 * @param {Object} body - Request body to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} - { error, value }
 */
exports.validate = (body, schema) => {
  return schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
};

/**
 * Format validation errors for API response
 * @param {Array} details - Joi error details
 * @returns {Array} - Formatted errors
 */
exports.formatErrors = (details) => {
  return details.map((item) => ({
    field: item.path.join("."),
    message: item.message,
  }));
};
