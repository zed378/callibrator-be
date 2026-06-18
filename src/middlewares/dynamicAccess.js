const { RoleMenuPermission, User, Tenants } = require("../models");

/**
 * Dynamic RBAC Middleware
 *
 * Simplified RBAC middleware that checks role-based menu permissions.
 * Uses the role_menu_permissions table to determine read/write access.
 *
 * USAGE:
 *
 * // Simple permission check
 * router.get("/", auth, dynamicAccess("Home", "read"), controller);
 *
 * // Multiple actions (OR logic - user needs any one)
 * router.get("/", auth, dynamicAccess("Dashboard", ["read", "write"]), controller);
 *
 * // Multiple actions (AND logic - user needs all)
 * router.post("/bulk", auth, dynamicAccess("Report", ["read", "write"], { requireAll: true }), controller);
 *
 * @param {string|string[]} menuGroup - Menu group name(s) (e.g., 'Home', 'Dashboard', ['Account', 'Management'])
 * @param {string|string[]} permissionType - Permission type(s) (e.g., 'read', 'write', ['read', 'write'])
 * @param {Object} options - Additional options
 * @param {boolean} options.requireAll - Require all actions (AND logic) vs any action (OR logic, default)
 * @param {boolean} options.checkSelf - Check if the requested resource belongs to the user
 * @param {boolean} options.checkTenant - Enforce multi-tenant isolation (reject if resource belongs to different tenant)
 * @returns {Function} Express middleware
 */
exports.dynamicAccess = (menuGroup, permissionType, options = {}) => {
  const { requireAll = false } = options;

  // Normalize to arrays
  const menuGroups = Array.isArray(menuGroup) ? menuGroup : [menuGroup];
  const permTypes = Array.isArray(permissionType)
    ? permissionType
    : [permissionType];

  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.role) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: No user context found",
        });
      }

      // SUPER_ADMIN bypass - has access to everything (no tenant check)
      if (user.role.name === "SUPER_ADMIN") {
        req.dynamicAccessContext = {
          allowed: true,
          reason: "SUPER_ADMIN bypass",
          menuGroups,
          permissionTypes: permTypes,
        };
        return next();
      }

      // ---- Tenant isolation check ----
      if (options.checkTenant) {
        const resourceTenantId = req.params.tenantId || req.body.tenantId;

        if (resourceTenantId) {
          // Ensure resource belongs to user's tenant
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
              message: "Access denied: resource belongs to a different tenant",
            });
          }
        } else {
          // No tenant ID provided but checkTenant is enabled — check resource ownership
          const resourceOwnerId = req.params.userId || req.body.userId;

          if (resourceOwnerId) {
            const owner = await User.findByPk(resourceOwnerId, {
              attributes: ["tenantId"],
            });

            if (!owner) {
              return res.status(404).json({
                success: false,
                message: "Resource not found",
              });
            }

            if (String(owner.tenantId) !== String(user.tenantId)) {
              return res.status(403).json({
                success: false,
                message: "Access denied: resource belongs to a different tenant",
              });
            }
          }
        }
      }

      // Check permissions for each menu group
      const results = [];
      let allAllowed = true;

      for (const menuName of menuGroups) {
        const result = await checkMenuPermission(
          menuName,
          permTypes,
          user,
          requireAll,
        );

        results.push(result);
        if (!result.allowed) {
          allAllowed = false;
        }
      }

      // If requireAll is true, ALL menu groups must be allowed
      // If requireAll is false (default), ANY menu group being allowed is sufficient
      const finalAllowed = requireAll
        ? allAllowed
        : results.some((r) => r.allowed);

      if (!finalAllowed) {
        const deniedTypes = results
          .filter((r) => !r.allowed)
          .flatMap((r) => r.deniedTypes || []);

        return res.status(403).json({
          success: false,
          message: "Forbidden: Insufficient permissions",
          required: deniedTypes.length > 0 ? deniedTypes : permTypes,
          menuGroups,
        });
      }

      // Attach permission context to request for controller use
      const allowedResult = results.find((r) => r.allowed);
      req.dynamicAccessContext = {
        allowed: true,
        menuGroups,
        permissionTypes: permTypes,
        permission: allowedResult?.permission || null,
      };

      next();
    } catch (error) {
      if (typeof logger !== "undefined") {
        logger.error(`DynamicAccess Error: ${error.message}`);
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  };
};

/**
 * Check permission for a specific menu group
 */
async function checkMenuPermission(menuName, permTypes, user, requireAll) {
  // Get the menu group by name
  const { MenuGroup } = require("../models");
  const menuGroup = await MenuGroup.findOne({
    where: { name: menuName, isActive: true },
  });

  if (!menuGroup) {
    return {
      allowed: false,
      deniedTypes: permTypes,
      menuGroup,
      permission: null,
    };
  }

  // Check each permission type
  const typeResults = [];

  for (const permType of permTypes) {
    const rolePerm = await RoleMenuPermission.findOne({
      where: {
        roleId: user.role.id,
        menuGroupId: menuGroup.id,
        permission_type: permType,
      },
    });

    typeResults.push({
      permissionType: permType,
      allowed: !!rolePerm,
    });
  }

  // Determine if permissions are allowed (OR or AND logic)
  const allowed = requireAll
    ? typeResults.every((r) => r.allowed)
    : typeResults.some((r) => r.allowed);

  const deniedTypes = typeResults
    .filter((r) => !r.allowed)
    .map((r) => r.permissionType);

  // Return the first allowed permission
  const allowedResult = typeResults.find((r) => r.allowed);

  return {
    allowed,
    deniedTypes,
    menuGroup,
    permission: allowedResult
      ? { permission_type: allowedResult.permissionType }
      : null,
  };
}

/**
 * Middleware to check if user has permission for a specific action
 * Returns the permission details without blocking access
 * Useful for conditional UI rendering
 */
exports.hasDynamicPermission = async (req, res, next) => {
  try {
    const { menuGroup, permissionType } = req.body || {};

    if (!menuGroup || !permissionType) {
      return res.status(400).json({
        success: false,
        message: "menuGroup and permissionType are required",
      });
    }

    const { MenuGroup } = require("../models");
    const menu = await MenuGroup.findOne({
      where: { name: menuGroup, isActive: true },
    });

    if (!menu) {
      return res.status(200).json({
        success: true,
        data: { allowed: false, permission: null },
      });
    }

    const rolePerm = await RoleMenuPermission.findOne({
      where: {
        roleId: req.user.role.id,
        menuGroupId: menu.id,
        permission_type: permissionType,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        allowed: !!rolePerm,
        permission: rolePerm
          ? { permission_type: rolePerm.permission_type }
          : null,
      },
    });
  } catch (error) {
    if (typeof logger !== "undefined") {
      logger.error(`hasDynamicPermission Error: ${error.message}`);
    }
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
