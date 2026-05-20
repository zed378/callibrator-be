/**
 * Permission Seeder
 *
 * This script seeds the database with default permissions and roles.
 * It should be called during initial database setup or migration.
 *
 * Permission naming convention:
 * - Global permission: module:action (e.g., user:create, user:read, user:update, user:delete)
 * - Self permission: module:self:action (e.g., user:self:update, user:self:read) - Note: self-delete is not included
 * - Tenant permission: module:tenant:action (e.g., user:tenant:create, user:tenant:read)
 *
 * NOTE: This file is kept for backward compatibility.
 * The main seeding logic has been moved to src/services/migration.service.js
 *
 * @deprecated Use migrationService.seedAll() instead
 */

const { Roles } = require('../models');
const { Permissions } = require('../models');
const { UserPermissions } = require('../models');
const {
  ROLE_NAMES,
  ROLE_IDS,
  USER_PERMISSIONS,
  TENANT_PERMISSIONS,
} = require('../constants');

/**
 * Define all permissions to be seeded
 * Structure: { name, module, action, description }
 */
const USER_MODULE_PERMISSIONS = [
  // Global permissions (module:action)
  {
    name: USER_PERMISSIONS.CREATE,
    module: 'user',
    action: 'create',
    description: 'Global permission to create users',
  },
  {
    name: USER_PERMISSIONS.READ,
    module: 'user',
    action: 'read',
    description: 'Global permission to read users',
  },
  {
    name: USER_PERMISSIONS.UPDATE,
    module: 'user',
    action: 'update',
    description: 'Global permission to update users',
  },
  {
    name: USER_PERMISSIONS.DELETE,
    module: 'user',
    action: 'delete',
    description: 'Global permission to delete users',
  },

  // Self permissions (module:self:action) - Note: self-delete is not included
  // Users cannot delete their own accounts via permission system
  {
    name: USER_PERMISSIONS.SELF_UPDATE,
    module: 'user',
    action: 'self:update',
    description: 'Permission to update own profile',
  },
  {
    name: USER_PERMISSIONS.SELF_READ,
    module: 'user',
    action: 'self:read',
    description: 'Permission to read own profile',
  },

  // Tenant permissions (module:tenant:action)
  {
    name: USER_PERMISSIONS.TENANT_CREATE,
    module: 'user',
    action: 'tenant:create',
    description: 'Permission to create users within tenant',
  },
  {
    name: USER_PERMISSIONS.TENANT_READ,
    module: 'user',
    action: 'tenant:read',
    description: 'Permission to read users within tenant',
  },
  {
    name: USER_PERMISSIONS.TENANT_UPDATE,
    module: 'user',
    action: 'tenant:update',
    description: 'Permission to update users within tenant',
  },
  {
    name: USER_PERMISSIONS.TENANT_DELETE,
    module: 'user',
    action: 'tenant:delete',
    description: 'Permission to delete users within tenant',
  },
  {
    name: USER_PERMISSIONS.TENANT_ASSIGN,
    module: 'user',
    action: 'tenant:assign',
    description: 'Permission to assign users to tenant',
  },
];

/**
 * Tenant Module Permissions
 */
const TENANT_MODULE_PERMISSIONS = [
  // Global permissions (module:action)
  {
    name: TENANT_PERMISSIONS.CREATE,
    module: 'tenant',
    action: 'create',
    description: 'Global permission to create tenants',
  },
  {
    name: TENANT_PERMISSIONS.READ,
    module: 'tenant',
    action: 'read',
    description: 'Global permission to read tenants',
  },
  {
    name: TENANT_PERMISSIONS.UPDATE,
    module: 'tenant',
    action: 'update',
    description: 'Global permission to update tenants',
  },
  {
    name: TENANT_PERMISSIONS.DELETE,
    module: 'tenant',
    action: 'delete',
    description: 'Global permission to delete tenants',
  },

  // Self permissions (module:self:action)
  {
    name: TENANT_PERMISSIONS.SELF_UPDATE,
    module: 'tenant',
    action: 'self:update',
    description: 'Permission to update own tenant profile',
  },
  {
    name: TENANT_PERMISSIONS.SELF_READ,
    module: 'tenant',
    action: 'self:read',
    description: 'Permission to read own tenant profile',
  },

  // Tenant permissions (module:tenant:action)
  {
    name: TENANT_PERMISSIONS.TENANT_READ,
    module: 'tenant',
    action: 'tenant:read',
    description: 'Permission to read tenants within scope',
  },
  {
    name: TENANT_PERMISSIONS.TENANT_ASSIGN,
    module: 'tenant',
    action: 'tenant:assign',
    description: 'Permission to assign tenants',
  },
];

/**
 * Define default roles to be seeded
 */
const DEFAULT_ROLES = [
  {
    id: ROLE_IDS.SUPER_ADMIN,
    name: ROLE_NAMES.SUPER_ADMIN,
    description: 'Super Admin - Has full access to all resources',
    nameToShow: 'Super Admin',
    isActive: true,
    roleLevel: 3,
  },
  {
    id: ROLE_IDS.TENANT_ADMIN,
    name: ROLE_NAMES.TENANT_ADMIN,
    description: 'Tenant Admin - Can manage users within their tenant',
    nameToShow: 'Tenant Admin',
    isActive: true,
    roleLevel: 2,
  },
  {
    id: ROLE_IDS.USER,
    name: ROLE_NAMES.USER,
    description: 'Regular User - Can manage own profile',
    nameToShow: 'User',
    isActive: true,
    roleLevel: 1,
  },
];

/**
 * Seed roles and permissions into the database
 * @param {Object} models - The models object containing Roles, Permissions, UserPermissions
 * @returns {Object} Result of seeding operation
 */
async function seedRolesAndPermissions(models = {}) {
  const rolesModel = models.Roles || Roles;
  const permissionsModel = models.Permissions || Permissions;
  const userPermissionsModel = models.UserPermissions || UserPermissions;

  const result = {
    rolesCreated: 0,
    rolesUpdated: 0,
    permissionsCreated: 0,
    permissionsUpdated: 0,
    errors: [],
  };

  try {
    // Seed roles
    for (const role of DEFAULT_ROLES) {
      try {
        const [roleInstance, created] = await rolesModel.findOrCreate({
          where: { id: role.id },
          defaults: role,
        });

        if (!created) {
          // Update if changed
          const changed = roleInstance.changed();
          if (changed.length > 0) {
            await roleInstance.update(role);
            result.rolesUpdated++;
          } else {
            result.rolesUpdated++;
          }
        } else {
          result.rolesCreated++;
        }
      } catch (error) {
        result.errors.push(`Error seeding role ${role.name}: ${error.message}`);
      }
    }

    // Seed user module permissions
    for (const perm of USER_MODULE_PERMISSIONS) {
      try {
        const [permInstance, created] = await permissionsModel.findOrCreate({
          where: { name: perm.name },
          defaults: perm,
        });

        if (!created) {
          await permInstance.update(perm);
          result.permissionsUpdated++;
        } else {
          result.permissionsCreated++;
        }
      } catch (error) {
        result.errors.push(
          `Error seeding permission ${perm.name}: ${error.message}`,
        );
      }
    }

    // Seed tenant module permissions
    for (const perm of TENANT_MODULE_PERMISSIONS) {
      try {
        const [permInstance, created] = await permissionsModel.findOrCreate({
          where: { name: perm.name },
          defaults: perm,
        });

        if (!created) {
          await permInstance.update(perm);
          result.permissionsUpdated++;
        } else {
          result.permissionsCreated++;
        }
      } catch (error) {
        result.errors.push(
          `Error seeding permission ${perm.name}: ${error.message}`,
        );
      }
    }

    // Grant default permissions to roles
    await grantPermissionsToRoles(
      rolesModel,
      permissionsModel,
      userPermissionsModel,
    );

    return result;
  } catch (error) {
    result.errors.push(`Fatal error during seeding: ${error.message}`);
    return result;
  }
}

/**
 * Grant default permissions to roles based on role type
 */
async function grantPermissionsToRoles(
  rolesModel,
  permissionsModel,
  userPermissionsModel,
) {
  try {
    // Get all permissions by name
    const allPermissions = await permissionsModel.findAll({
      attributes: ['id', 'name'],
    });

    const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

    // Grant permissions to TENANT_ADMIN role
    const tenantAdminRole = await rolesModel.findByPk(ROLE_IDS.TENANT_ADMIN);
    if (tenantAdminRole) {
      const tenantAdminPermissions = USER_PERMISSIONS.TENANT_CREATE
        ? [
            // User tenant permissions
            USER_PERMISSIONS.TENANT_CREATE,
            USER_PERMISSIONS.TENANT_READ,
            USER_PERMISSIONS.TENANT_UPDATE,
            USER_PERMISSIONS.TENANT_DELETE,
            USER_PERMISSIONS.TENANT_ASSIGN,
            USER_PERMISSIONS.SELF_UPDATE,
            USER_PERMISSIONS.SELF_READ,
            // Tenant permissions
            TENANT_PERMISSIONS.TENANT_READ,
            TENANT_PERMISSIONS.TENANT_ASSIGN,
            TENANT_PERMISSIONS.SELF_UPDATE,
            TENANT_PERMISSIONS.SELF_READ,
          ]
        : [];

      const permissionIds = tenantAdminPermissions
        .map((name) => permissionMap.get(name))
        .filter(Boolean);

      await tenantAdminRole.setPermissions(permissionIds);
    }

    // Grant permissions to USER role
    const userRole = await rolesModel.findByPk(ROLE_IDS.USER);
    if (userRole) {
      const userPermissions = [
        USER_PERMISSIONS.SELF_UPDATE,
        USER_PERMISSIONS.SELF_READ,
      ];

      const permissionIds = userPermissions
        .map((name) => permissionMap.get(name))
        .filter(Boolean);

      await userRole.setPermissions(permissionIds);
    }

    // SUPER_ADMIN gets all permissions implicitly (handled in middleware)
  } catch (error) {
    console.error('Error granting permissions to roles:', error);
    throw error;
  }
}

/**
 * Check if a permission name follows the correct format
 * @param {string} permissionName - The permission name to validate
 * @returns {boolean} True if valid format
 */
function isValidPermissionFormat(permissionName) {
  // Global: module:action
  // Self: module:self:action
  // Tenant: module:tenant:action
  const pattern = /^[a-zA-Z0-9]+:(self|tenant:[a-zA-Z0-9]+|[a-zA-Z0-9]+)$/;
  return pattern.test(permissionName);
}

/**
 * Extract permission type from permission name
 * @param {string} permissionName - The permission name
 * @returns {string} Type: 'global', 'self', or 'tenant'
 */
function getPermissionType(permissionName) {
  if (permissionName.includes(':self:')) {
    return 'self';
  }
  if (permissionName.includes(':tenant:')) {
    return 'tenant';
  }
  return 'global';
}

/**
 * Extract module name from permission name
 * @param {string} permissionName - The permission name
 * @returns {string} The module name
 */
function getPermissionModule(permissionName) {
  return permissionName.split(':')[0];
}

module.exports = {
  seedRolesAndPermissions,
  isValidPermissionFormat,
  getPermissionType,
  getPermissionModule,
  USER_MODULE_PERMISSIONS,
  TENANT_MODULE_PERMISSIONS,
  DEFAULT_ROLES,
};
