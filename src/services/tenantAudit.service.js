const { TenantAuditLog } = require("../models");

/**
 * Tenant Audit Log Service
 *
 * Manages audit logging for tenant-specific operations.
 * Provides methods for creating logs, querying logs,
 * and managing log retention.
 */

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
const createLog = async (params, models) => {
  return TenantAuditLog.createLog(params, models);
};

/**
 * Create audit log from Express request
 *
 * @param {Object} req - Express request object
 * @param {Object} params - Additional log parameters
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Created audit log
 */
const createLogFromRequest = (req, params = {}, models) => {
  const logParams = {
    tenantId: req.tenantId || req.user?.tenantId,
    userId: req.user?.id,
    ipAddress: req.ip || req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"],
    ...params,
  };

  return TenantAuditLog.createLog(logParams, models);
};

/**
 * Log a user action
 *
 * @param {Object} req - Express request object
 * @param {string} action - Action performed
 * @param {Object} [options] - Additional options
 * @param {string} [options.resourceType] - Resource type
 * @param {string} [options.resourceId] - Resource ID
 * @param {string} [options.resourceName] - Resource name
 * @param {string} [options.severity] - Severity level
 * @param {Object} [options.context] - Additional context
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Created audit log
 */
const logUserAction = async (req, action, options = {}, models) => {
  return createLogFromRequest(
    req,
    {
      action,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      resourceName: options.resourceName,
      severity: options.severity,
      context: options.context,
    },
    models,
  );
};

/**
 * Log authentication event
 *
 * @param {Object} req - Express request object
 * @param {string} action - Auth action (login.success, login.failed, etc.)
 * @param {Object} [options] - Additional options
 * @param {string} [options.userId] - User UUID
 * @param {Object} [options.context] - Additional context
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Created audit log
 */
const logAuthEvent = async (req, action, options = {}, models) => {
  return createLogFromRequest(
    req,
    {
      action,
      userId: options.userId,
      severity: action === "login.failed" ? "WARNING" : "INFO",
      context: options.context,
    },
    models,
  );
};

/**
 * Log tenant settings change
 *
 * @param {Object} req - Express request object
 * @param {string} tenantId - Tenant UUID
 * @param {Object} changes - Settings changes
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Created audit log
 */
const logTenantSettingsChange = async (req, tenantId, changes, models) => {
  return createLog(
    req,
    {
      tenantId,
      action: TenantAuditLog.ACTIONS.TENANT_SETTINGS_UPDATE,
      resourceType: "TenantSetting",
      severity: "INFO",
      context: { changes },
    },
    models,
  );
};

/**
 * Get audit logs with filtering and pagination
 *
 * @param {Object} req - Express request object
 * @param {Object} params - Filter parameters
 * @param {number} [params.limit] - Max results
 * @param {number} [params.offset] - Pagination offset
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} { rows, count }
 */
const getAuditLogs = async (req, params = {}, models) => {
  const {
    limit = 50,
    offset = 0,
    action,
    userId,
    severity,
    startDate,
    endDate,
  } = params;

  // Build where clause
  const where = {};

  // Apply tenant scope
  const tenantScope = createTenantScope(req, {
    allowSuperAdminCrossTenant: true,
  });
  if (tenantScope?.tenantId) {
    where.tenantId = tenantScope.tenantId;
  } else if (req.tenantId) {
    where.tenantId = req.tenantId;
  }

  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (severity) where.severity = severity;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate)
      where.createdAt[require("sequelize").Op.gte] = new Date(startDate);
    if (endDate)
      where.createdAt[require("sequelize").Op.lte] = new Date(endDate);
  }

  return TenantAuditLog.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: parseInt(limit),
    offset: parseInt(offset),
    include: [
      {
        model: models.Users,
        as: "user",
        attributes: ["id", "firstName", "lastName", "email", "username"],
      },
    ],
  });
};

/**
 * Get audit logs for a specific tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} params - Filter parameters
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} { rows, count }
 */
const getTenantAuditLogs = async (tenantId, params = {}, models) => {
  return TenantAuditLog.getTenantLogs({ tenantId, ...params }, models);
};

/**
 * Get security events for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {number} days - Number of days to look back
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>} Security events
 */
const getSecurityEvents = async (tenantId, days = 30, models) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const failedLogins = await TenantAuditLog.count({
    where: {
      tenantId,
      action: TenantAuditLog.ACTIONS.LOGIN_FAILED,
      createdAt: { [require("sequelize").Op.gte]: startDate },
    },
  });

  const bannedUsers = await TenantAuditLog.count({
    where: {
      tenantId,
      action: TenantAuditLog.ACTIONS.USER_BAN,
      createdAt: { [require("sequelize").Op.gte]: startDate },
    },
  });

  const permissionChanges = await TenantAuditLog.count({
    where: {
      tenantId,
      action: {
        [require("sequelize").Op.or]: [
          TenantAuditLog.ACTIONS.PERMISSION_GRANT,
          TenantAuditLog.ACTIONS.PERMISSION_REVOKE,
        ],
      },
      createdAt: { [require("sequelize").Op.gte]: startDate },
    },
  });

  return {
    failedLogins,
    bannedUsers,
    permissionChanges,
    period: days,
  };
};

/**
 * Clean up old audit logs
 *
 * @param {string} tenantId - Tenant UUID
 * @param {number} daysToKeep - Number of days to retain logs (default: 365)
 * @param {Object} models - Sequelize models
 * @returns {Promise<number>} Number of deleted logs
 */
const cleanupOldLogs = async (tenantId, daysToKeep = 365, models) => {
  return TenantAuditLog.cleanupOldLogs(tenantId, daysToKeep, models);
};

module.exports = {
  createLog,
  createLogFromRequest,
  logUserAction,
  logAuthEvent,
  logTenantSettingsChange,
  getAuditLogs,
  getTenantAuditLogs,
  getSecurityEvents,
  cleanupOldLogs,
  ACTIONS: TenantAuditLog.ACTIONS,
  SEVERITY: TenantAuditLog.SEVERITY,
};
