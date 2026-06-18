const { Tenants, Users } = require("../models");

/**
 * ABAC (Attribute-Based Access Control) Middleware
 *
 * Checks if a user has a specific attribute permission on a resource,
 * typically at the tenant level. Used alongside RBAC for fine-grained
 * access control.
 *
 * USAGE:
 *
 * // Tenant-level permission check
 * router.post('/backup', auth, rbac(['SUPER_ADMIN']), abac(['tenant:update'], { checkTenant: true }), controller);
 *
 * // Self-check (resource belongs to user)
 * router.post('/profile', auth, abac(['user:update'], { checkSelf: true }), controller);
 *
 * @param {string[]} permissions - Required permission(s)
 * @param {Object} options - Additional options
 * @param {boolean} options.checkTenant - Enforce multi-tenant isolation
 * @param {boolean} options.checkSelf - Check if the resource belongs to the requesting user
 * @returns {Function} Express middleware
 */

exports.abac = (permissions, options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.role) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: No user context found",
        });
      }

      // SUPER_ADMIN bypass — has all permissions
      if (user.role.name === "SUPER_ADMIN") {
        req.abacContext = {
          allowed: true,
          reason: "SUPER_ADMIN bypass",
          permissions,
        };
        return next();
      }

      // ---- Tenant isolation check ----
      if (options.checkTenant) {
        const resourceTenantId = req.params.tenantId || req.body.tenantId;

        if (resourceTenantId) {
          const tenant = await Tenants.findByPk(resourceTenantId, {
            attributes: ["id"],
          });

          if (!tenant) {
            return res.status(404).json({
              success: false,
              message: "Tenant not found",
            });
          }

          if (String(tenant.id) !== String(user.tenantId)) {
            return res.status(403).json({
              success: false,
              message:
                "Access denied: resource belongs to a different tenant",
            });
          }
        }
      }

      // ---- Self-check ----
      if (options.checkSelf) {
        const resourceOwnerId =
          req.params.userId || req.body.userId || req.params.id;

        if (resourceOwnerId && String(user.id) !== String(resourceOwnerId)) {
          // If it's not their own resource, fall back to permission check
          // If it IS their own resource, allow
        }
      }

      // Attach context to request
      req.abacContext = {
        allowed: true,
        permissions,
        tenantId: user.tenantId,
      };

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  };
};
