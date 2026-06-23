/**
 * Tenant validation schemas
 */
const Joi = require("joi");

// ==========================================
// GET ALL TENANTS QUERY
// ==========================================

exports.getAllTenantsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  find: Joi.string().allow(null, ""),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED", "active", "inactive", "suspended")
    .insensitive()
    .allow(null, ""),
});

// ==========================================
// GET TENANT BODY/PARAMS
// ==========================================

exports.getTenantSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
});

// ==========================================
// CREATE TENANT
// ==========================================

exports.createTenantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string().trim().min(2).max(50).required(),
  description: Joi.string().trim().allow(null, ""),
  logo: Joi.string().allow(null, ""),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED", "active", "inactive", "suspended")
    .default("ACTIVE")
    .insensitive()
    .allow(null),
  maxUsers: Joi.number().integer().min(1).default(10),
  createdBy: Joi.string().uuid().allow(null, ""),
  email: Joi.string().email().allow(null, ""),
  phone: Joi.string().allow(null, ""),
  address: Joi.string().allow(null, ""),
  city: Joi.string().allow(null, ""),
  state: Joi.string().allow(null, ""),
  zipCode: Joi.string().allow(null, ""),
  country: Joi.string().allow(null, ""),
  website: Joi.string().uri().allow(null, ""),
}).custom((value, helpers) => {
  // Normalize status to uppercase
  if (value.status && typeof value.status === "string") {
    value.status = value.status.toUpperCase();
  }
  return value;
});

// ==========================================
// UPDATE TENANT
// ==========================================

exports.updateTenantSchema = Joi.object({
  tenantId: Joi.string().uuid(),
  name: Joi.string().trim().min(2).max(100),
  code: Joi.string().trim().min(2).max(50),
  description: Joi.string().trim().allow(null, ""),
  logo: Joi.string().allow(null, ""),
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED", "active", "inactive", "suspended")
    .insensitive()
    .allow(null, ""),
  maxUsers: Joi.number().integer().min(1),
  updatedBy: Joi.string().uuid().allow(null, ""),
  email: Joi.string().email().allow(null, ""),
  phone: Joi.string().allow(null, ""),
  address: Joi.string().allow(null, ""),
  city: Joi.string().allow(null, ""),
  state: Joi.string().allow(null, ""),
  zipCode: Joi.string().allow(null, ""),
  country: Joi.string().allow(null, ""),
  website: Joi.string().uri().allow(null, ""),
}).custom((value, helpers) => {
  if (value.status && typeof value.status === "string") {
    value.status = value.status.toUpperCase();
  }
  return value;
});

// ==========================================
// DELETE TENANT QUERY/PARAMS
// ==========================================

exports.deleteTenantSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  deletedBy: Joi.string().uuid().allow(null, ""),
});

// ==========================================
// TENANT SETTINGS
// ==========================================

exports.tenantIdSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
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
