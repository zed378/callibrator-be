/**
 * Migration Service
 *
 * Centralized service for database migrations, seeding, and unseeding operations.
 * Consolidates all seeding logic from migration.controller.js, seedPermissions.js,
 * and seedTablePermissions.js into a single service layer.
 *
 * Usage:
 *   const migrationService = require("../services/migration.service");
 *   const result = await migrationService.seedAll();
 */

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  Users,
  Roles,
  Permissions,
  UserPermissions,
  Models,
  TablePermission,
  RolePermission,
} = require('../models');
const {
  ROLE_NAMES,
  ROLE_IDS,
  USER_PERMISSIONS,
  TENANT_PERMISSIONS,
  PASSWORD_SALT_ROUNDS,
} = require('../constants');
const {
  DEFAULT_MODELS: TABLE_PERMISSION_MODELS,
} = require('../utils/seedTablePermissions');

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Additional role definitions for seeding (extends DEFAULT_ROLES from constants)
 * Contains all application-specific roles beyond the core three (SUPER_ADMIN, TENANT_ADMIN, USER)
 */
const APPLICATION_ROLES = [
  {
    id: 'cd8ce1a8-138e-4d91-8ae2-2f52ad3a8d08',
    name: 'HEALTHCARE ADMIN',
    description: 'Healthcare Administrator',
    nameToShow: 'Admin Faskes',
    isActive: true,
    roleLevel: 2,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: 'ce5bc0f9-b342-45d1-b08a-b626c6026a7f',
    name: 'CALIBRATOR ADMIN',
    description: 'Calibrator Administrator',
    nameToShow: 'Admin Kalibrator',
    isActive: true,
    roleLevel: 2,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: '752e324a-e426-4cc9-ae2d-639b1a7a2785',
    name: 'TECHNICIAN',
    description: 'Technician',
    nameToShow: 'Teknisi',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: '137404e9-c995-4437-be17-d1af64ab3c30',
    name: 'SUPERVISOR',
    description: 'Supervisor',
    nameToShow: 'Penyelia',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: '74101285-c256-4cb9-951d-24ed6547a9cb',
    name: 'ENGINEERING MANAGER',
    description: 'Engineering Manager',
    nameToShow: 'Manajer Teknik',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: 'b85b324b-9b80-4c36-85b8-46db21872bdf',
    name: 'HEALTHCARE TECHNICIAN',
    description: 'Healthcare Technician',
    nameToShow: 'Teknisi Faskes',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: '5e724805-02ba-498f-a7f0-6b415c8f69fe',
    name: 'FACILITY MAINTENANCE',
    description: 'Facility Maintenance',
    nameToShow: 'IPSRS',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: 'e50b664b-451c-45a9-8c83-f65b94a8afdf',
    name: 'WAREHOUSE STAFF',
    description: 'Warehouse Staff',
    nameToShow: 'Gudang',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: '6fdd1212-9c4f-45d5-b3bf-5335892be7c0',
    name: 'ROOM USER',
    description: 'Room User',
    nameToShow: 'User Ruangan',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
];

/**
 * Default system user to seed after roles
 */
const DEFAULT_SYSTEM_USERS = [
  {
    username: 'sys',
    firstName: 'Super',
    lastName: 'System',
    email: 'sys@mail.com',
    password: '123123',
    isActive: true,
    status: 'ACTIVE',
    isEmailVerified: true,
    roleId: ROLE_IDS.SUPER_ADMIN,
  },
];

/**
 * Permission definitions for User module
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
  // Self permissions (module:self:action)
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
 * Permission definitions for Tenant module
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
 * Default roles definition (core roles from constants)
 */
const DEFAULT_ROLES = [
  {
    id: ROLE_IDS.SUPER_ADMIN,
    name: ROLE_NAMES.SUPER_ADMIN,
    description: 'Super Admin - Has full access to all resources',
    nameToShow: 'Super Admin',
    isActive: true,
    roleLevel: 3,
    permissionIds: [], // Super admin gets all permissions implicitly
  },
  {
    id: ROLE_IDS.TENANT_ADMIN,
    name: ROLE_NAMES.TENANT_ADMIN,
    description: 'Tenant Admin - Can manage users within their tenant',
    nameToShow: 'Tenant Admin',
    isActive: true,
    roleLevel: 2,
    permissionIds: [], // Will be populated during seeding
  },
  {
    id: ROLE_IDS.USER,
    name: ROLE_NAMES.USER,
    description: 'Regular User - Can manage own profile',
    nameToShow: 'User',
    isActive: true,
    roleLevel: 1,
    permissionIds: [], // Will be populated during seeding
  },
];

/**
 * Permission assignments for each role
 * SUPER_ADMIN gets all permissions implicitly (handled in middleware)
 */
const ROLE_PERMISSION_ASSIGNMENTS = {
  [ROLE_IDS.TENANT_ADMIN]: [
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
  ],
  [ROLE_IDS.USER]: [USER_PERMISSIONS.SELF_UPDATE, USER_PERMISSIONS.SELF_READ],
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(PASSWORD_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Get permission ID by name from the permission map
 * @param {string} permissionName - Permission name
 * @param {Map<string, string>} permissionMap - Map of permission name to ID
 * @returns {string|null} Permission ID or null
 */
const getPermissionIdByName = (permissionName, permissionMap) => {
  return permissionMap.get(permissionName) || null;
};

// ==========================================
// ROLE SEEDING
// ==========================================

/**
 * Seed default roles (SUPER_ADMIN, TENANT_ADMIN, USER)
 * @returns {Promise<Object>} Result of seeding operation
 */
async function seedDefaultRoles() {
  const result = {
    rolesCreated: 0,
    rolesSkipped: 0,
    permissionsAssigned: 0,
    errors: [],
  };

  try {
    for (const role of DEFAULT_ROLES) {
      try {
        const roleInstance = await Roles.findOne({
          where: { name: role.name },
        });

        if (roleInstance) {
          result.rolesSkipped++;
          continue;
        }

        const { permissionIds, ...roleData } = role;
        const newRole = await Roles.create(roleData);

        // Assign permissions if specified
        if (permissionIds && permissionIds.length > 0) {
          await newRole.setPermissions(permissionIds);
          result.permissionsAssigned += permissionIds.length;
        }

        result.rolesCreated++;
      } catch (error) {
        result.errors.push(`Error seeding role ${role.name}: ${error.message}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(
      `Fatal error during default roles seeding: ${error.message}`,
    );
    return result;
  }
}

/**
 * Seed application-specific roles (HEALTHCARE ADMIN, TECHNICIAN, etc.)
 * @returns {Promise<Object>} Result of seeding operation
 */
async function seedApplicationRoles() {
  const result = {
    rolesCreated: 0,
    rolesSkipped: 0,
    permissionsAssigned: 0,
    errors: [],
  };

  try {
    for (const role of APPLICATION_ROLES) {
      try {
        const roleInstance = await Roles.findOne({
          where: { name: role.name },
        });

        if (roleInstance) {
          result.rolesSkipped++;
          continue;
        }

        const { permissionIds, ...roleData } = role;
        const newRole = await Roles.create(roleData);

        // Assign permissions if specified
        if (permissionIds && permissionIds.length > 0) {
          await newRole.setPermissions(permissionIds);
          result.permissionsAssigned += permissionIds.length;
        }

        result.rolesCreated++;
      } catch (error) {
        result.errors.push(`Error seeding role ${role.name}: ${error.message}`);
      }
    }

    return result;
  } catch (error) {
    result.errors.push(
      `Fatal error during application roles seeding: ${error.message}`,
    );
    return result;
  }
}

/**
 * Seed all roles (default + application roles)
 * @returns {Promise<Object>} Result of seeding operation
 */
async function seedAllRoles() {
  const defaultRolesResult = await seedDefaultRoles();
  const applicationRolesResult = await seedApplicationRoles();

  return {
    rolesCreated:
      defaultRolesResult.rolesCreated + applicationRolesResult.rolesCreated,
    rolesSkipped:
      defaultRolesResult.rolesSkipped + applicationRolesResult.rolesSkipped,
    permissionsAssigned:
      defaultRolesResult.permissionsAssigned +
      applicationRolesResult.permissionsAssigned,
    errors: [...defaultRolesResult.errors, ...applicationRolesResult.errors],
  };
}

// ==========================================
// PERMISSION SEEDING
// ==========================================

/**
 * Seed permissions for user and tenant modules
 * @returns {Promise<Object>} Result of seeding operation
 */
async function seedPermissions() {
  const result = {
    permissionsCreated: 0,
    permissionsSkipped: 0,
    errors: [],
  };

  try {
    // Seed user module permissions
    for (const perm of USER_MODULE_PERMISSIONS) {
      try {
        const permInstance = await Permissions.findOne({
          where: { name: perm.name },
        });

        if (permInstance) {
          result.permissionsSkipped++;
          continue;
        }

        await Permissions.create(perm);
        result.permissionsCreated++;
      } catch (error) {
        result.errors.push(
          `Error seeding permission ${perm.name}: ${error.message}`,
        );
      }
    }

    // Seed tenant module permissions
    for (const perm of TENANT_MODULE_PERMISSIONS) {
      try {
        const permInstance = await Permissions.findOne({
          where: { name: perm.name },
        });

        if (permInstance) {
          result.permissionsSkipped++;
          continue;
        }

        await Permissions.create(perm);
        result.permissionsCreated++;
      } catch (error) {
        result.errors.push(
          `Error seeding permission ${perm.name}: ${error.message}`,
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(
      `Fatal error during permissions seeding: ${error.message}`,
    );
    return result;
  }
}

// ==========================================
// ROLES PERMISSION ASSIGNMENT
// ==========================================

/**
 * Grant permissions to roles based on role type
 * Assigns permission IDs to roles using the role's setPermissions method
 * @returns {Promise<Object>} Result of permission assignment
 */
async function seedRolesPermissions() {
  const result = {
    tenantAdminPermissionsGranted: 0,
    userPermissionsGranted: 0,
    permissionsSkipped: 0,
    errors: [],
  };

  try {
    // Get all permissions by name
    const allPermissions = await Permissions.findAll({
      attributes: ['id', 'name'],
    });

    const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

    // Grant permissions to TENANT_ADMIN role
    const tenantAdminRole = await Roles.findByPk(ROLE_IDS.TENANT_ADMIN);
    if (tenantAdminRole) {
      const tenantAdminPermissionNames =
        ROLE_PERMISSION_ASSIGNMENTS[ROLE_IDS.TENANT_ADMIN] || [];
      const permissionIds = tenantAdminPermissionNames
        .map((name) => getPermissionIdByName(name, permissionMap))
        .filter(Boolean);

      // Check which permissions are already assigned
      const existingPermissions = await tenantAdminRole.getPermissions();
      const existingPermissionIds = existingPermissions.map((p) => p.id);

      const newPermissionIds = permissionIds.filter(
        (id) => !existingPermissionIds.includes(id),
      );

      if (newPermissionIds.length > 0) {
        await tenantAdminRole.setPermissions([
          ...existingPermissionIds,
          ...newPermissionIds,
        ]);
        result.tenantAdminPermissionsGranted += newPermissionIds.length;
      } else {
        result.permissionsSkipped += permissionIds.length;
      }
    }

    // Grant permissions to USER role
    const userRole = await Roles.findByPk(ROLE_IDS.USER);
    if (userRole) {
      const userPermissionNames =
        ROLE_PERMISSION_ASSIGNMENTS[ROLE_IDS.USER] || [];
      const permissionIds = userPermissionNames
        .map((name) => getPermissionIdByName(name, permissionMap))
        .filter(Boolean);

      // Check which permissions are already assigned
      const existingPermissions = await userRole.getPermissions();
      const existingPermissionIds = existingPermissions.map((p) => p.id);

      const newPermissionIds = permissionIds.filter(
        (id) => !existingPermissionIds.includes(id),
      );

      if (newPermissionIds.length > 0) {
        await userRole.setPermissions([
          ...existingPermissionIds,
          ...newPermissionIds,
        ]);
        result.userPermissionsGranted += newPermissionIds.length;
      } else {
        result.permissionsSkipped += permissionIds.length;
      }
    }

    // SUPER_ADMIN gets all permissions implicitly (handled in middleware)

    return result;
  } catch (error) {
    result.errors.push(`Error granting permissions to roles: ${error.message}`);
    return result;
  }
}

// ==========================================
// TABLE PERMISSION SEEDING
// ==========================================

/**
 * Assign a table permission to a role
 * @param {string} roleId - Role ID
 * @param {string} tablePermissionId - Table permission ID
 * @param {boolean} isGranted - Whether permission is granted
 * @returns {Promise<void>}
 */
const assignTablePermissionToRole = async (
  roleId,
  tablePermissionId,
  isGranted,
) => {
  const existing = await RolePermission.findOne({
    where: { roleId, tablePermissionId },
  });

  if (existing) {
    return; // Skip existing role permissions
  } else {
    await RolePermission.create({ roleId, tablePermissionId, isGranted });
  }
};

/**
 * Seed table permissions for all models
 * @returns {Promise<boolean>} Success status
 */
async function seedTablePermissions() {
  try {
    console.log(
      `[INFO] ${new Date().toISOString()} - Starting table permissions seed...`,
    );

    // 1. Create models and track their definitions
    console.log(`[INFO] ${new Date().toISOString()} - Creating models...`);
    const createdModels = [];
    const modelDefsMap = new Map();

    for (const modelDef of TABLE_PERMISSION_MODELS) {
      const model = await Models.findOne({
        where: { modelName: modelDef.modelName },
      });

      if (model) {
        console.log(
          `[INFO] ${new Date().toISOString()} -   Skipped existing model: ${modelDef.modelName}`,
        );
        createdModels.push(model);
        modelDefsMap.set(modelDef.modelName, modelDef);
        continue;
      }

      await Models.create(modelDef);
      console.log(
        `[INFO] ${new Date().toISOString()} -   Created model: ${modelDef.modelName}`,
      );
      createdModels.push(modelDef);
      modelDefsMap.set(modelDef.modelName, modelDef);
    }

    // 2. Create table permissions for each model
    console.log(
      `[INFO] ${new Date().toISOString()} - Creating table permissions...`,
    );

    for (const modelDef of TABLE_PERMISSION_MODELS) {
      const model = await Models.findOne({
        where: { modelName: modelDef.modelName },
      });

      if (!model) continue;

      for (const permDef of modelDef.permissions || []) {
        const { action, scope, attributes, abacRules, description } = permDef;

        const tablePerm = await TablePermission.findOne({
          where: { modelId: model.id, action },
        });

        if (tablePerm) {
          console.log(
            `[INFO] ${new Date().toISOString()} -   Skipped existing permission: ${modelDef.modelName}:${action}`,
          );
          continue;
        }

        await TablePermission.create({
          modelId: model.id,
          action,
          scope,
          attributes,
          abacRules,
          description,
        });
        console.log(
          `[INFO] ${new Date().toISOString()} -   Created permission: ${modelDef.modelName}:${action}`,
        );
      }
    }

    // 3. Assign permissions to global roles
    console.log(
      `[INFO] ${new Date().toISOString()} - Assigning permissions to global roles...`,
    );

    const superAdminRole = await Roles.findOne({
      where: { name: ROLE_NAMES.SUPER_ADMIN },
    });

    if (superAdminRole) {
      // SUPER_ADMIN gets all permissions
      const allPermissions = await TablePermission.findAll();

      for (const perm of allPermissions) {
        await assignTablePermissionToRole(superAdminRole.id, perm.id, true);
      }
      console.log(
        `[INFO] ${new Date().toISOString()} -   Assigned all permissions to SUPER_ADMIN`,
      );
    }

    const tenantAdminRole = await Roles.findOne({
      where: { name: ROLE_NAMES.TENANT_ADMIN },
    });

    if (tenantAdminRole) {
      // TENANT_ADMIN gets tenant-scoped permissions
      const tenantScopedPermissions = await TablePermission.findAll({
        include: [
          {
            model: Models,
            as: 'model',
            where: {
              modelName: TABLE_PERMISSION_MODELS.map((m) => m.modelName),
            },
          },
        ],
      });

      for (const perm of tenantScopedPermissions) {
        // Grant read, create, update for tenant-scoped resources
        if (['read', 'create', 'update'].includes(perm.action)) {
          await assignTablePermissionToRole(tenantAdminRole.id, perm.id, true);
          console.log(
            `[INFO] ${new Date().toISOString()} -   Assigned ${perm.action} to TENANT_ADMIN for ${perm.model?.modelName || perm.modelId}`,
          );
        }
      }
    }

    const userRole = await Roles.findOne({
      where: { name: ROLE_NAMES.USER },
    });

    if (userRole) {
      // Regular USER gets self permissions only
      const selfPermissions = await TablePermission.findAll({
        include: [
          {
            model: Models,
            as: 'model',
            where: { modelName: 'User' },
          },
        ],
        where: { action: ['read', 'update'] },
      });

      for (const perm of selfPermissions) {
        await assignTablePermissionToRole(userRole.id, perm.id, true);
        console.log(
          `[INFO] ${new Date().toISOString()} -   Assigned ${perm.action} to USER for User model`,
        );
      }
    }

    console.log(
      `[INFO] ${new Date().toISOString()} - Table permissions seed completed successfully!`,
    );
    return true;
  } catch (error) {
    console.error(
      `[ERROR] ${new Date().toISOString()} - Seed failed: ${error.message}`,
    );
    console.error(error);
    return false;
  }
}

// ==========================================
// USER SEEDING
// ==========================================

/**
 * Seed default system users
 * @returns {Promise<Object>} Result of seeding operation
 */
async function seedUsers() {
  const result = {
    usersCreated: 0,
    usersSkipped: 0,
    errors: [],
  };

  try {
    for (const userData of DEFAULT_SYSTEM_USERS) {
      try {
        const userInstance = await Users.findOne({
          where: { email: userData.email },
        });

        if (userInstance) {
          result.usersSkipped++;
          continue;
        }

        const hashedPassword = await hashPassword(userData.password);

        await Users.create({
          ...userData,
          password: hashedPassword,
        });

        result.usersCreated++;
      } catch (error) {
        result.errors.push(
          `Error seeding user ${userData.email}: ${error.message}`,
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(`Fatal error during users seeding: ${error.message}`);
    return result;
  }
}

// ==========================================
// UNSEEDING
// ==========================================

/**
 * Unseed (delete) seeded roles
 * @param {string[]} roleIds - Array of role IDs to delete
 * @returns {Promise<Object>} Result of unseeding operation
 */
async function unseedRoles(roleIds) {
  const result = {
    rolesDeleted: 0,
    errors: [],
  };

  try {
    const deletedCount = await Roles.destroy({
      where: {
        id: {
          [Op.in]: roleIds,
        },
      },
    });

    result.rolesDeleted = deletedCount;
    return result;
  } catch (error) {
    result.errors.push(`Error deleting roles: ${error.message}`);
    return result;
  }
}

/**
 * Unseed (delete) seeded users
 * @param {string[]} emails - Array of user emails to delete
 * @returns {Promise<Object>} Result of unseeding operation
 */
async function unseedUsers(emails) {
  const result = {
    usersDeleted: 0,
    errors: [],
  };

  try {
    const deletedCount = await Users.destroy({
      where: {
        email: {
          [Op.in]: emails,
        },
      },
    });

    result.usersDeleted = deletedCount;
    return result;
  } catch (error) {
    result.errors.push(`Error deleting users: ${error.message}`);
    return result;
  }
}

// ==========================================
// COMPLETE SEEDING
// ==========================================

/**
 * Seed all database data (roles, permissions, users)
 * This is the main entry point for complete database seeding
 * @returns {Promise<Object>} Complete seeding result
 */
async function seedAll() {
  const result = {
    roles: await seedAllRoles(),
    permissions: await seedPermissions(),
    rolesPermissions: await seedRolesPermissions(),
    tablePermissions: await seedTablePermissions(),
    users: await seedUsers(),
  };

  return result;
}

/**
 * Complete unseed operation - removes all seeded data
 * @returns {Promise<Object>} Complete unseeding result
 */
async function unseedAll() {
  const roleIds = Object.values(ROLE_IDS);
  // Add application role IDs
  APPLICATION_ROLES.forEach((role) => {
    roleIds.push(role.id);
  });

  const emails = DEFAULT_SYSTEM_USERS.map((u) => u.email);

  const result = {
    users: await unseedUsers(emails),
    roles: await unseedRoles(roleIds),
  };

  return result;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Role seeding
  seedDefaultRoles,
  seedApplicationRoles,
  seedAllRoles,

  // Permission seeding
  seedPermissions,

  // Roles permission assignment
  seedRolesPermissions,

  // Table permission seeding
  seedTablePermissions,

  // User seeding
  seedUsers,

  // Complete seeding
  seedAll,

  // Unseeding
  unseedAll,
  unseedRoles,
  unseedUsers,

  // Constants (for external use if needed)
  DEFAULT_ROLES,
  APPLICATION_ROLES,
  USER_MODULE_PERMISSIONS,
  TENANT_MODULE_PERMISSIONS,
  ROLE_PERMISSION_ASSIGNMENTS,
};
