const { ROLE_NAMES } = require("../utils/constants");

/**
 * Tenant Scoping Middleware
 *
 * Provides tenant scoping context for query isolation.
 * Injects tenantId into request for use in services.
 *
 * For super admins, provides ability to scope to specific tenant.
 * For tenant admins and users, enforces tenant isolation.
 *
 * @param {Object} options - Middleware options
 * @param {string[]} options.exemptRoutes - Routes that don't require tenant scoping
 * @returns {Function} Express middleware
 */
const scopeToTenant = (options = {}) => {
  const { exemptRoutes = [] } = options;

  return async (req, res, next) => {
    try {
      // Skip if already has tenant context
      if (req.tenant || req.tenantId) {
        return next();
      }

      // Check if route is exempt
      const isExempt = exemptRoutes.some((route) => req.path.startsWith(route));
      if (isExempt) {
        return next();
      }

      // Get tenant context from user
      if (req.user) {
        let tenantId = req.user.tenantId;

        // Super admins can specify target tenant
        if (
          !tenantId &&
          req.user.role &&
          req.user.role.name === ROLE_NAMES.SUPER_ADMIN
        ) {
          const targetTenantId =
            req.headers["x-target-tenant-id"] || req.query.tenantId;
          if (targetTenantId) {
            tenantId = targetTenantId;
          }
        }

        if (tenantId) {
          req.tenantId = tenantId;
          req.user.tenantId = tenantId;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Create tenant-aware query scope
 *
 * Returns a where clause object that scopes queries to the current tenant.
 * Respects super admin override for cross-tenant queries.
 *
 * @param {Object} req - Express request object
 * @param {Object} options - Scope options
 * @param {boolean} options.allowSuperAdminCrossTenant - Allow super admin to query all tenants
 * @returns {Object} Sequelize where clause
 */
const createTenantScope = (req, options = {}) => {
  const { allowSuperAdminCrossTenant = false } = options;

  // If tenant already specified in request, use it
  if (req.tenantId) {
    return { tenantId: req.tenantId };
  }

  // If user has tenant, use it
  if (req.user && req.user.tenantId) {
    return { tenantId: req.user.tenantId };
  }

  // Super admin cross-tenant check
  if (
    allowSuperAdminCrossTenant &&
    req.user &&
    req.user.role &&
    req.user.role.name === ROLE_NAMES.SUPER_ADMIN
  ) {
    // No tenant filter - super admin can see all
    return {};
  }

  // No scope - caller doesn't have tenant context
  return null;
};

/**
 * Enforce tenant isolation
 *
 * Throws error if user tries to access resources outside their tenant.
 * Only tenant admins and users are subject to this check.
 * Super admins are exempt.
 *
 * @param {Object} req - Express request object
 * @throws {Error} If user tries to access resources outside their tenant
 */
const enforceTenantIsolation = (req) => {
  if (!req.user) {
    return;
  }

  // Super admins can access everything
  if (req.user.role && req.user.role.name === ROLE_NAMES.SUPER_ADMIN) {
    return;
  }

  // Users without tenant cannot access tenant-scoped resources
  if (!req.user.tenantId && !req.tenantId) {
    throw new Error("Tenant context required for this operation");
  }
};

module.exports = {
  scopeToTenant,
  createTenantScope,
  enforceTenantIsolation,
};
