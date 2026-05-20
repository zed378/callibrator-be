const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

/**
 * TenantAuditLog Model
 *
 * Stores audit logs for tenant-specific operations.
 * Provides compliance and security tracking for all tenant activities.
 *
 * Logs include:
 * - User actions (create, update, delete)
 * - Authentication events (login, logout, failed attempts)
 * - Permission changes
 * - Settings modifications
 * - Data access patterns
 */
const TenantAuditLog = db.define(
  "tenant_audit_logs",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },

    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "tenants",
        key: "id",
      },
      allowNull: true, // Some logs may be pre-tenant or global
    },

    /**
     * User who performed the action
     */
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    /**
     * Action performed
     * Examples: user.create, user.update, login.success, login.failed
     */
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [2, 100],
      },
    },

    /**
     * Resource type affected
     * Examples: User, Tenant, Role, Permission, Setting
     */
    resourceType: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    /**
     * Resource ID affected
     */
    resourceId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    /**
     * Resource name affected (denormalized for quick display)
     */
    resourceName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    /**
     * Severity level: INFO, WARNING, ERROR, CRITICAL
     */
    severity: {
      type: DataTypes.ENUM("INFO", "WARNING", "ERROR", "CRITICAL"),
      defaultValue: "INFO",
    },

    /**
     * IP address of the request
     */
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    /**
     * User agent string
     */
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /**
     * Additional context as JSON
     * Examples:
     * - { changes: { email: { old: "a@b.com", new: "c@d.com" } } }
     * - { reason: "Account security" }
     * - { method: "password", provider: "email" }
     */
    context: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },

    /**
     * Whether this log was masked for privacy (GDPR)
     */
    isMasked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ["tenantId", "action"],
      },
      {
        fields: ["tenantId", "userId"],
      },
      {
        fields: ["tenantId", "createdAt"],
      },
      {
        fields: ["resourceType", "resourceId"],
      },
      {
        fields: ["severity"],
      },
      {
        fields: ["action"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

TenantAuditLog.associate = (models) => {
  TenantAuditLog.belongsTo(models.Tenants, {
    foreignKey: "tenantId",
    as: "tenant",
  });

  TenantAuditLog.belongsTo(models.Users, {
    foreignKey: "userId",
    as: "user",
  });
};

/**
 * Common action types for audit logging
 */
TenantAuditLog.ACTIONS = {
  // User actions
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  USER_ACTIVATE: "user.activate",
  USER_DEACTIVATE: "user.deactivate",
  USER_ROLE_CHANGE: "user.role_change",
  USER_BAN: "user.ban",
  USER_UNBAN: "user.unban",

  // Authentication actions
  LOGIN_SUCCESS: "login.success",
  LOGIN_FAILED: "login.failed",
  LOGOUT: "logout",
  PASSWORD_CHANGE: "password.change",
  PASSWORD_RESET_REQUEST: "password.reset_request",
  PASSWORD_RESET_COMPLETE: "password.reset_complete",
  OTP_REQUEST: "otp.request",
  OTP_VERIFY: "otp.verify",
  OTP_EXPIRED: "otp.expired",

  // Tenant actions
  TENANT_CREATE: "tenant.create",
  TENANT_UPDATE: "tenant.update",
  TENANT_DELETE: "tenant.delete",
  TENANT_STATUS_CHANGE: "tenant.status_change",
  TENANT_SETTINGS_UPDATE: "tenant.settings_update",

  // Permission actions
  PERMISSION_GRANT: "permission.grant",
  PERMISSION_REVOKE: "permission.revoke",
  ROLE_ASSIGN: "role.assign",
  ROLE_REMOVE: "role.remove",

  // Data actions
  DATA_EXPORT: "data.export",
  DATA_IMPORT: "data.import",
  DATA_ACCESS: "data.access",
};

/**
 * Severity levels
 */
TenantAuditLog.SEVERITY = {
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
};

/**
 * Create an audit log entry
 *
 * @param {Object} params - Log parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.userId - User UUID
 * @param {string} params.action - Action performed
 * @param {string} [params.resourceType] - Resource type
 * @param {string} [params.resourceId] - Resource ID
 * @param {string} [params.resourceName] - Resource name
 * @param {string} [params.severity] - Severity level
 * @param {string} [params.ipAddress] - Request IP
 * @param {string} [params.userAgent] - User agent
 * @param {Object} [params.context] - Additional context
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Created audit log
 */
TenantAuditLog.createLog = async (
  {
    tenantId,
    userId,
    action,
    resourceType,
    resourceId,
    resourceName,
    severity = TenantAuditLog.SEVERITY.INFO,
    ipAddress,
    userAgent,
    context = {},
  },
  models,
) => {
  return TenantAuditLog.create({
    tenantId,
    userId,
    action,
    resourceType,
    resourceId,
    resourceName,
    severity,
    ipAddress,
    userAgent,
    context,
  });
};

/**
 * Get audit logs for a tenant with filtering
 *
 * @param {Object} params - Filter parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} [params.action] - Filter by action
 * @param {string} [params.userId] - Filter by user
 * @param {string} [params.severity] - Filter by severity
 * @param {string} [params.startDate] - Filter from date
 * @param {string} [params.endDate] - Filter to date
 * @param {number} [params.limit] - Max results
 * @param {number} [params.offset] - Pagination offset
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} { rows, count }
 */
TenantAuditLog.getTenantLogs = async (
  {
    tenantId,
    action,
    userId,
    severity,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  },
  models,
) => {
  const where = { tenantId };

  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (severity) where.severity = severity;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Sequelize.Op.gte] = new Date(startDate);
    if (endDate) where.createdAt[Sequelize.Op.lte] = new Date(endDate);
  }

  return TenantAuditLog.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
};

/**
 * Clean up old audit logs
 *
 * @param {string} tenantId - Tenant UUID
 * @param {number} daysToKeep - Number of days to retain logs
 * @param {Object} models - Sequelize models
 * @returns {Promise<number>} Number of deleted logs
 */
TenantAuditLog.cleanupOldLogs = async (tenantId, daysToKeep = 365, models) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { count } = await TenantAuditLog.findAndCountAll({
    where: {
      tenantId,
      createdAt: { [Sequelize.Op.lt]: cutoffDate },
    },
    limit: 10000,
  });

  await TenantAuditLog.destroy({
    where: {
      tenantId,
      createdAt: { [Sequelize.Op.lt]: cutoffDate },
    },
  });

  return count;
};

module.exports = {
  TenantAuditLog,
};
