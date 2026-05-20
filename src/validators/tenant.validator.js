/**
 * Tenant validation schemas
 */
const Joi = require('joi');

// ==========================================
// CREATE TENANT
// ==========================================

exports.createTenantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string().trim().lowercase().alphanum().min(2).max(50).required(),
  description: Joi.string().trim().allow(null, ''),
  logo: Joi.string().uri().allow(null, ''),
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'active', 'inactive', 'suspended')
    .default('ACTIVE')
    .insensitive(),
  maxUsers: Joi.number().integer().min(1).default(10),
  createdBy: Joi.string().uuid().allow(null, ''),
}).custom((value, helpers) => {
  // Normalize status to uppercase
  if (value.status && typeof value.status === 'string') {
    value.status = value.status.toUpperCase();
  }
  return value;
});

// ==========================================
// UPDATE TENANT
// ==========================================

exports.updateTenantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  code: Joi.string().trim().lowercase().alphanum().min(2).max(50),
  description: Joi.string().trim().allow(null, ''),
  logo: Joi.string().uri().allow(null, ''),
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'active', 'inactive', 'suspended')
    .insensitive()
    .allow(null, ''),
  maxUsers: Joi.number().integer().min(1),
  updatedBy: Joi.string().uuid().allow(null, ''),
}).custom((value, helpers) => {
  if (value.status && typeof value.status === 'string') {
    value.status = value.status.toUpperCase();
  }
  return value;
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
    field: item.path.join('.'),
    message: item.message,
  }));
};
