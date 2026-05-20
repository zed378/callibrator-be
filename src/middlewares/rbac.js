/**
 * Role-Based Access Control Middleware
 *
 * Supports 3 role types:
 * - SUPER_ADMIN (roleLevel: 3) - Has full access without restrictions
 * - TENANT_ADMIN (roleLevel: 2) - Can manage users within their tenant
 * - USER (roleLevel: 1) - Can only manage their own profile
 *
 * @param {string[]} requiredRoles - Array of role names allowed to access the route
 * @param {Object} options - Additional options
 * @param {boolean} options.allowHigher - If true, users with higher role levels can also access (default: true)
 * @returns {Function} Express middleware
 */
exports.rbac = (requiredRoles = [], options = {}) => {
  const { allowHigher = true } = options;

  return (req, res, next) => {
    try {
      // 1. Ensure user exists (checked by auth middleware)
      if (!req.user) {
        throw new Error("Unauthorized: No user context found");
      }

      // 2. Safely extract role name and level
      const userRoleName = req.user.role?.name;
      const userRoleLevel = req.user.role?.roleLevel || 0;

      if (!userRoleName) {
        throw new Error("Unauthorized: User has no role assigned");
      }

      // 3. Super Admin bypass - has access to everything
      if (userRoleName === "SUPER_ADMIN") {
        return next();
      }

      // 4. Resolve required role levels
      const { ROLE_NAMES } = require("../utils/constants");
      const roleLevels = {
        [ROLE_NAMES.SUPER_ADMIN]: 3,
        [ROLE_NAMES.TENANT_ADMIN]: 2,
        [ROLE_NAMES.USER]: 1,
      };

      // Determine the minimum required role level
      let minRequiredLevel = 0;
      const isRoleValid = requiredRoles.some((role) => {
        if (roleLevels[role] !== undefined) {
          minRequiredLevel = Math.max(minRequiredLevel, roleLevels[role]);
          return true;
        }
        // If role name doesn't match known roles, treat as valid name check
        return requiredRoles.includes(role);
      });

      // 5. Check if user's role is in the allowed list
      if (!requiredRoles.includes(userRoleName)) {
        // If allowHigher is true, check if user's role level is higher
        if (!allowHigher || userRoleLevel < minRequiredLevel) {
          throw new Error("Forbidden: Insufficient permissions");
        }
      }

      // 6. Permission granted
      next();
    } catch (error) {
      const message = error.message || "Internal Server Error";

      // Determine status code based on message context
      let statusCode = 500;
      if (message.includes("Unauthorized")) statusCode = 401;
      if (message.includes("Forbidden")) statusCode = 403;

      // Send error to the global error handler
      next({
        status: statusCode,
        message: message,
        isOperational: true,
      });
    }
  };
};

/**
 * Middleware to check if user has a minimum role level
 * @param {number} minLevel - Minimum role level required
 * @returns {Function} Express middleware
 */
exports.checkRoleLevel = (minLevel = 1) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        throw new Error("Unauthorized: No user context found");
      }

      const userRoleLevel = req.user.role.roleLevel || 0;

      if (userRoleLevel < minLevel) {
        throw new Error("Forbidden: Insufficient role level");
      }

      next();
    } catch (error) {
      const message = error.message || "Internal Server Error";
      let statusCode = 500;
      if (message.includes("Unauthorized")) statusCode = 401;
      if (message.includes("Forbidden")) statusCode = 403;

      next({
        status: statusCode,
        message: message,
        isOperational: true,
      });
    }
  };
};

/**
 * Middleware to check if user is not a super admin
 * Used to ensure certain operations are only done by non-super-admin users
 * @returns {Function} Express middleware
 */
exports.notSuperAdmin = () => {
  return (req, res, next) => {
    try {
      if (req.user && req.user.role && req.user.role.name === "SUPER_ADMIN") {
        throw new Error("Forbidden: Super admin cannot perform this action");
      }
      next();
    } catch (error) {
      const message = error.message || "Internal Server Error";
      let statusCode = 500;
      if (message.includes("Forbidden")) statusCode = 403;

      next({
        status: statusCode,
        message: message,
        isOperational: true,
      });
    }
  };
};
