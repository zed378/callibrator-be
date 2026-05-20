/**
 * Permission Assignment Service
 *
 * This service handles assigning permissions to users based on their role.
 * It supports both the legacy permission system and the new dynamic table permissions.
 *
 * Permission assignment by role:
 * - SUPER_ADMIN: No explicit permissions needed (has implicit all)
 * - TENANT_ADMIN: Gets tenant-related permissions + self permissions
 * - USER: Gets only self permissions (user:self:update, user:self:read)
 *
 * Dynamic permissions are managed via the tablePermission.service.js
 */

const { Permissions, UserPermissions } = require("../models");
const { ROLE_NAMES, USER_PERMISSIONS } = require("../utils/constants");
const { logger } = require("../middlewares/activityLog");

/**
 * Get default permissions for a role (Legacy system)
 * @param {string} roleName - The role name
 * @returns {string[]} Array of permission names
 */
function getPermissionsForRole(roleName) {
  switch (roleName) {
    case ROLE_NAMES.SUPER_ADMIN:
      // Super admin has implicit all permissions, return empty array
      return [];

    case ROLE_NAMES.TENANT_ADMIN:
      return [
        USER_PERMISSIONS.TENANT_CREATE,
        USER_PERMISSIONS.TENANT_READ,
        USER_PERMISSIONS.TENANT_UPDATE,
        USER_PERMISSIONS.TENANT_DELETE,
        USER_PERMISSIONS.TENANT_ASSIGN,
        USER_PERMISSIONS.SELF_UPDATE,
        USER_PERMISSIONS.SELF_READ,
      ];

    case ROLE_NAMES.USER:
      return [USER_PERMISSIONS.SELF_UPDATE, USER_PERMISSIONS.SELF_READ];

    default:
      // Unknown role, return only self permissions as default
      logger.warn(
        `Unknown role "${roleName}", assigning default self permissions`,
      );
      return [USER_PERMISSIONS.SELF_UPDATE, USER_PERMISSIONS.SELF_READ];
  }
}

/**
 * Assign default permissions to a user based on their role (Legacy system)
 *
 * This function:
 * 1. Finds all permission records by name
 * 2. Creates user_permission records for each permission
 * 3. Handles errors gracefully
 *
 * @param {Object} user - The user object (must have id and roleId)
 * @param {Object} options - Optional parameters
 * @param {string} options.grantedBy - UUID of the user who granted permissions
 * @returns {Object} Result of the assignment operation
 */
async function assignPermissionsToUser(user, options = {}) {
  const { grantedBy = null } = options;

  const result = {
    success: false,
    assignedPermissions: [],
    skippedPermissions: [],
    errors: [],
  };

  try {
    // Validate user
    if (!user || !user.id) {
      throw new Error("Invalid user object provided");
    }

    // Fetch user's role to determine permissions
    const role =
      user.role || (await require("../models").Roles.findByPk(user.roleId));

    if (!role) {
      throw new Error(`Role not found for user ${user.id}`);
    }

    const roleName = role.name;

    // Get permissions for this role
    const permissionNames = getPermissionsForRole(roleName);

    // Super admin doesn't need explicit permissions
    if (permissionNames.length === 0) {
      result.success = true;
      result.skippedPermissions = ["SUPER_ADMIN - implicit all permissions"];
      logger.info(
        `Super admin user ${user.id} - no explicit permissions needed`,
      );
      return result;
    }

    // Find all permissions by name
    const permissions = await Permissions.findAll({
      where: { name: permissionNames },
      attributes: ["id", "name"],
    });

    const permissionMap = new Map(permissions.map((p) => [p.name, p.id]));

    // Track which permissions were found
    const foundPermissionIds = [];
    const notFoundPermissions = [];

    for (const permName of permissionNames) {
      const permId = permissionMap.get(permName);
      if (permId) {
        foundPermissionIds.push({ id: permId, name: permName });
      } else {
        notFoundPermissions.push(permName);
      }
    }

    if (notFoundPermissions.length > 0) {
      result.errors.push(
        `Permissions not found in database: ${notFoundPermissions.join(", ")}. Run seed script first.`,
      );
      logger.warn(
        `Permissions not found for user ${user.id}: ${notFoundPermissions.join(", ")}`,
      );
    }

    // Create user_permission records
    if (foundPermissionIds.length > 0) {
      const userPermissionRecords = foundPermissionIds.map((perm) => ({
        userId: user.id,
        permissionId: perm.id,
        ...(grantedBy && { grantedBy }),
      }));

      // Use bulkCreate with ignoreDuplicates to avoid duplicate entries
      await UserPermissions.bulkCreate(userPermissionRecords, {
        ignoreDuplicates: true,
      });

      result.assignedPermissions = foundPermissionIds;
      result.success = true;

      logger.info(
        `Assigned ${foundPermissionIds.length} permissions to user ${user.id}`,
        {
          userId: user.id,
          roleId: role.id,
          roleName: role.name,
          permissions: foundPermissionIds.map((p) => p.name),
          grantedBy,
        },
      );
    }

    return result;
  } catch (error) {
    result.errors.push(`Error assigning permissions: ${error.message}`);
    logger.error(`Error assigning permissions to user ${user?.id}:`, error);
    return result;
  }
}

/**
 * Assign self permissions to a user
 * This is a convenience function that only assigns self permissions
 * regardless of the user's role
 *
 * @param {Object} user - The user object
 * @param {Object} options - Optional parameters
 * @returns {Object} Result of the assignment operation
 */
async function assignSelfPermissions(user, options = {}) {
  const selfPermissionNames = [
    USER_PERMISSIONS.SELF_UPDATE,
    USER_PERMISSIONS.SELF_READ,
  ];

  const result = {
    success: false,
    assignedPermissions: [],
    errors: [],
  };

  try {
    if (!user || !user.id) {
      throw new Error("Invalid user object provided");
    }

    // Find self permissions
    const permissions = await Permissions.findAll({
      where: { name: selfPermissionNames },
      attributes: ["id", "name"],
    });

    const permissionMap = new Map(permissions.map((p) => [p.name, p.id]));

    const userPermissionRecords = permissions.map((perm) => ({
      userId: user.id,
      permissionId: perm.id,
      ...(options.grantedBy && { grantedBy: options.grantedBy }),
    }));

    if (userPermissionRecords.length > 0) {
      await UserPermissions.bulkCreate(userPermissionRecords, {
        ignoreDuplicates: true,
      });

      result.assignedPermissions = permissions;
      result.success = true;

      logger.info(`Assigned self permissions to user ${user.id}`);
    }

    return result;
  } catch (error) {
    result.errors.push(`Error assigning self permissions: ${error.message}`);
    logger.error(
      `Error assigning self permissions to user ${user?.id}:`,
      error,
    );
    return result;
  }
}

/**
 * Revoke all permissions from a user
 *
 * @param {string} userId - The user ID
 * @returns {Object} Result of the revocation operation
 */
async function revokeAllPermissions(userId) {
  const result = {
    success: false,
    revokedCount: 0,
    errors: [],
  };

  try {
    if (!userId) {
      throw new Error("Invalid user ID provided");
    }

    const deletedCount = await UserPermissions.destroy({
      where: { userId },
    });

    result.revokedCount = deletedCount;
    result.success = true;

    logger.info(`Revoked ${deletedCount} permissions from user ${userId}`);

    return result;
  } catch (error) {
    result.errors.push(`Error revoking permissions: ${error.message}`);
    logger.error(`Error revoking permissions for user ${userId}:`, error);
    return result;
  }
}

/**
 * Get all permissions for a user
 *
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of permission objects
 */
async function getUserPermissions(userId) {
  try {
    if (!userId) {
      throw new Error("Invalid user ID provided");
    }

    const userPermissions = await UserPermissions.findAll({
      where: { userId },
      include: [
        {
          model: require("../models").Permissions,
          as: "permission",
          attributes: ["id", "name", "module", "action", "description"],
        },
      ],
    });

    return userPermissions.map((up) => ({
      ...up.permission.get(),
      grantedBy: up.grantedBy,
      expiresAt: up.expiresAt,
      assignedAt: up.createdAt,
    }));
  } catch (error) {
    logger.error(`Error getting permissions for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Check if a user has a specific permission
 *
 * @param {string} userId - The user ID
 * @param {string} permissionName - The permission name to check
 * @returns {Promise<boolean>} True if user has the permission
 */
async function hasPermission(userId, permissionName) {
  try {
    if (!userId || !permissionName) {
      return false;
    }

    const userPermission = await UserPermissions.findOne({
      where: {
        userId,
        permissionId: {
          [require("sequelize").Op.in]: require("sequelize").Sequelize.literal(
            `(SELECT id FROM permissions WHERE name = '${permissionName}')`,
          ),
        },
      },
    });

    return !!userPermission;
  } catch (error) {
    logger.error(
      `Error checking permission ${permissionName} for user ${userId}:`,
      error,
    );
    return false;
  }
}

// ==========================================
// DYNAMIC TABLE PERMISSIONS (NEW SYSTEM)
// ==========================================

/**
 * Get dynamic table permissions for a user based on their role
 * This is the new system that replaces the hardcoded permission assignment
 *
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID (optional)
 * @returns {Promise<Array>} Array of table permissions
 */
async function getUserTablePermissions(userId, tenantId) {
  try {
    const {
      Users,
      Roles,
      TenantRoles,
      TablePermission,
      Models,
    } = require("../models");

    // Get user with their roles
    const user = await Users.findByPk(userId, {
      include: [
        {
          model: Roles,
          as: "role",
          attributes: ["id", "name", "roleLevel"],
        },
        {
          model: TenantRoles,
          as: "tenantRole",
          where: tenantId ? { tenantId } : undefined,
          attributes: ["id", "name", "level"],
        },
      ],
    });

    if (!user) {
      return [];
    }

    // SUPER_ADMIN gets all table permissions
    if (user.role?.name === "SUPER_ADMIN") {
      return TablePermission.findAll({
        include: [
          {
            model: Models,
            as: "model",
            attributes: ["id", "modelName", "tableName", "module"],
          },
        ],
        order: [
          ["modelId", "ASC"],
          ["action", "ASC"],
        ],
      });
    }

    // For other roles, get permissions from role_permissions table
    const where = {
      isGranted: true,
    };

    if (user.role) {
      where["$roles.id$"] = user.role.id;
    }

    return TablePermission.findAll({
      where,
      include: [
        {
          model: Models,
          as: "model",
          attributes: ["id", "modelName", "tableName", "module"],
        },
        {
          model: Roles,
          through: { attributes: ["isGranted", "expiresAt"] },
          as: "roles",
        },
        {
          model: TenantRoles,
          through: { attributes: ["isGranted", "expiresAt", "abacRules"] },
          as: "tenantRoles",
        },
      ],
      order: [
        ["modelId", "ASC"],
        ["action", "ASC"],
      ],
    });
  } catch (error) {
    logger.error(`Error getting table permissions for user ${userId}:`, error);
    return [];
  }
}

/**
 * Check if user has a specific table permission
 *
 * @param {string} userId - User ID
 * @param {string} modelName - Model name (e.g., 'User', 'Invoice')
 * @param {string} action - Action (create, read, update, delete, export, import)
 * @param {string} tenantId - Tenant ID (optional)
 * @returns {Promise<boolean>} True if user has the permission
 */
async function hasTablePermission(userId, modelName, action, tenantId) {
  try {
    return await require("../services/tablePermission.service").checkUserPermission(
      userId,
      modelName,
      action,
      tenantId,
    );
  } catch (error) {
    logger.error(`Error checking table permission for user ${userId}:`, error);
    return false;
  }
}

module.exports = {
  // Legacy functions
  assignPermissionsToUser,
  assignSelfPermissions,
  revokeAllPermissions,
  getUserPermissions,
  hasPermission,
  getPermissionsForRole,
  // New dynamic table permission functions
  getUserTablePermissions,
  hasTablePermission,
};
