const { UserPermissions, Users } = require("../models");
const { ROLE_NAMES } = require("../utils/constants");

/**
 * Attribute-Based Access Control (ABAC) Middleware
 *
 * Permission naming convention:
 * - Global permission: module:action (e.g., user:create, user:read)
 * - Self permission: module:self:action (e.g., user:self:update)
 * - Tenant permission: module:tenant:action (e.g., user:tenant:create)
 *
 * Flow:
 * 1. If SUPER_ADMIN -> Skip checks (has all permissions implicitly)
 * 2. Fetch User's Permissions + Permission Names
 * 3. Check if User has all required permissions
 * 4. Handle self-permission checks (module:self:action)
 * 5. Handle tenant-permission checks (module:tenant:action)
 * 6. If fail -> 403 Response. If pass -> next().
 */
exports.abac = (requiredPermissions = [], options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const { checkSelf = false, checkTenant = false } = options;

      // ==========================================
      // STEP 1: SUPER_ADMIN SKIP
      // ==========================================
      if (user && user.role && user.role.name === ROLE_NAMES.SUPER_ADMIN) {
        return next();
      }

      if (!user) {
        return res.status(401).send({
          success: false,
          message: "Unauthorized: No user context found",
        });
      }

      // ==========================================
      // STEP 2: FETCH USER'S PERMISSIONS
      // ==========================================
      const userPermRecords = await UserPermissions.findAll({
        where: { userId: user.id },
        include: [
          {
            model: require("../models").Permissions,
            as: "permission",
            attributes: ["name", "module", "action"],
          },
        ],
        attributes: [],
      });

      // Extract permission names from the fetched records
      const userPermissionNames = userPermRecords
        .map((up) => up.permission?.name)
        .filter(Boolean);

      // ==========================================
      // STEP 3: CHECK PERMISSIONS
      // ==========================================
      if (requiredPermissions.length > 0) {
        // Separate permissions by type
        const globalPerms = [];
        const selfPerms = [];
        const tenantPerms = [];

        for (const perm of requiredPermissions) {
          if (perm.includes(":self:")) {
            selfPerms.push(perm);
          } else if (perm.includes(":tenant:")) {
            tenantPerms.push(perm);
          } else {
            globalPerms.push(perm);
          }
        }

        // Check global permissions
        if (globalPerms.length > 0) {
          const hasAllGlobalPermissions = globalPerms.every((reqPerm) =>
            userPermissionNames.includes(reqPerm),
          );

          if (!hasAllGlobalPermissions) {
            return res.status(403).send({
              success: false,
              message: "Forbidden: Insufficient permissions",
              required: globalPerms.filter(
                (p) => !userPermissionNames.includes(p),
              ),
            });
          }
        }

        // Check self permissions
        if (selfPerms.length > 0 && checkSelf) {
          const targetId = req.params.id || req.body.userId || req.query.userId;

          if (targetId && String(targetId) === String(user.id)) {
            // User is trying to access their own profile
            const hasAllSelfPermissions = selfPerms.every((reqPerm) =>
              userPermissionNames.includes(reqPerm),
            );

            if (!hasAllSelfPermissions) {
              return res.status(403).send({
                success: false,
                message: "Forbidden: You can only update your own profile",
                required: selfPerms.filter(
                  (p) => !userPermissionNames.includes(p),
                ),
              });
            }
          } else if (targetId) {
            // User is trying to access another user's profile
            return res.status(403).send({
              success: false,
              message:
                "Forbidden: You can only update your own profile, not others",
            });
          }
        }

        // Check tenant permissions
        if (tenantPerms.length > 0 && checkTenant) {
          const requestedTenantId = req.params.tenantId || req.body?.tenantId;

          if (requestedTenantId) {
            // Check if user has the required tenant permissions
            const hasAllTenantPermissions = tenantPerms.every((reqPerm) =>
              userPermissionNames.includes(reqPerm),
            );

            if (!hasAllTenantPermissions) {
              return res.status(403).send({
                success: false,
                message: "Forbidden: Insufficient tenant permissions",
                required: tenantPerms.filter(
                  (p) => !userPermissionNames.includes(p),
                ),
              });
            }

            // Additional tenant isolation check for non-SUPER_ADMIN
            if (user.role && user.role.name !== ROLE_NAMES.SUPER_ADMIN) {
              if (String(user.tenantId) !== String(requestedTenantId)) {
                return res.status(403).send({
                  success: false,
                  message: "Cross-tenant access denied",
                });
              }
            }
          }
        }
      }

      // ==========================================
      // STEP 4: TENANT ISOLATION (default check)
      // ==========================================
      if (!checkTenant) {
        const requestedTenantId = req.params.tenantId || req.body?.tenantId;

        if (requestedTenantId && user.tenantId) {
          if (String(user.tenantId) !== String(requestedTenantId)) {
            return res.status(403).send({
              success: false,
              message: "Cross-tenant access denied",
            });
          }
        }
      }

      // ==========================================
      // STEP 5: SUCCESS
      // ==========================================
      next();
    } catch (error) {
      console.error("ABAC Error:", error);
      return res.status(500).send({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  };
};

/**
 * Helper middleware to check if user has self-permission
 * Usage: auth, checkSelfPermission('user:self:update')
 */
exports.checkSelfPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).send({
          success: false,
          message: "Unauthorized: No user context found",
        });
      }

      // Get target ID from request
      const targetId = req.params.id || req.body.userId || req.query.userId;

      if (!targetId) {
        return res.status(400).send({
          success: false,
          message: "Missing target user ID",
        });
      }

      // Check if user is accessing their own profile
      if (String(targetId) !== String(user.id)) {
        return res.status(403).send({
          success: false,
          message:
            "Forbidden: You can only perform actions on your own profile",
        });
      }

      // Permission check will be done by abac middleware
      next();
    } catch (error) {
      console.error("checkSelfPermission Error:", error);
      return res.status(500).send({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  };
};

/**
 * Helper middleware to check if user has tenant permission
 * Usage: auth, checkTenantPermission('user:tenant:create')
 */
exports.checkTenantPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).send({
          success: false,
          message: "Unauthorized: No user context found",
        });
      }

      // Get tenant ID from request
      const tenantId =
        req.params.tenantId || req.body?.tenantId || req.query.tenantId;

      if (!tenantId) {
        return next(); // No tenant context, proceed
      }

      // SUPER_ADMIN can access any tenant
      if (user.role && user.role.name === ROLE_NAMES.SUPER_ADMIN) {
        return next();
      }

      // Check tenant isolation
      if (user.tenantId && String(user.tenantId) !== String(tenantId)) {
        return res.status(403).send({
          success: false,
          message: "Cross-tenant access denied",
        });
      }

      next();
    } catch (error) {
      console.error("checkTenantPermission Error:", error);
      return res.status(500).send({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  };
};
