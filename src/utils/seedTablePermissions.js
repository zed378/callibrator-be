/**
 * Seed Script for Dynamic Table Permissions
 *
 * This script creates the initial table permissions for all models in the system.
 * It sets up:
 * 1. Model entries (User, Tenant, etc.)
 * 2. Table permissions for each model (create, read, update, delete, export, import)
 * 3. Role-based permission assignments
 *
 * Usage:
 *   node src/utils/seedTablePermissions.js
 */

const { Models, TablePermission, Roles, TenantRoles } = require("../models");

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
};

/**
 * Define the default models and their permissions
 * Covers all standard tables in the codebase
 */
const DEFAULT_MODELS = [
  {
    modelName: "User",
    tableName: "users",
    module: "user_management",
    description: "User accounts and profiles",
    permissions: [
      {
        action: "create",
        scope: "tenant",
        attributes: {
          allowed: [
            "username",
            "email",
            "password",
            "firstName",
            "lastName",
            "tenantId",
            "roleId",
          ],
        },
        description: "Create new users",
      },
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: [
            "id",
            "username",
            "email",
            "firstName",
            "lastName",
            "status",
            "lastLoginAt",
          ],
          hidden: ["password", "otpCode"],
        },
        description: "Read user information",
      },
      {
        action: "update",
        scope: "self",
        attributes: {
          allowed: ["firstName", "lastName", "picture"],
        },
        abacRules: {
          condition: "owner",
          fields: ["id"],
        },
        description: "Update user information",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete user accounts",
      },
      {
        action: "export",
        scope: "tenant",
        attributes: {},
        description: "Export user data",
      },
    ],
  },
  {
    modelName: "Tenant",
    tableName: "tenants",
    module: "tenant_management",
    description: "Tenant organizations",
    permissions: [
      {
        action: "create",
        scope: "global",
        attributes: {
          allowed: ["name", "code", "description", "maxUsers"],
        },
        description: "Create new tenants",
      },
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: ["id", "name", "code", "description", "status", "maxUsers"],
        },
        description: "Read tenant information",
      },
      {
        action: "update",
        scope: "self",
        attributes: {
          allowed: ["name", "description", "maxUsers"],
        },
        abacRules: {
          condition: "owner",
          fields: ["id"],
        },
        description: "Update tenant information",
      },
      {
        action: "delete",
        scope: "global",
        attributes: {},
        description: "Delete tenants",
      },
      {
        action: "export",
        scope: "global",
        attributes: {},
        description: "Export tenant data",
      },
    ],
  },
  {
    modelName: "Permission",
    tableName: "permissions",
    module: "access_control",
    description: "System permissions",
    permissions: [
      {
        action: "read",
        scope: "global",
        attributes: {
          allowed: ["id", "name", "module", "action", "description"],
        },
        description: "Read permissions",
      },
      {
        action: "create",
        scope: "global",
        attributes: {
          allowed: ["name", "module", "action", "description"],
        },
        description: "Create permissions",
      },
      {
        action: "update",
        scope: "global",
        attributes: {
          allowed: ["name", "module", "action", "description"],
        },
        description: "Update permissions",
      },
      {
        action: "delete",
        scope: "global",
        attributes: {},
        description: "Delete permissions",
      },
    ],
  },
  {
    modelName: "Role",
    tableName: "roles",
    module: "access_control",
    description: "Global roles",
    permissions: [
      {
        action: "read",
        scope: "global",
        attributes: {
          allowed: ["id", "name", "description", "roleLevel", "isActive"],
        },
        description: "Read roles",
      },
      {
        action: "create",
        scope: "global",
        attributes: {
          allowed: ["name", "description", "roleLevel"],
        },
        description: "Create roles",
      },
      {
        action: "update",
        scope: "global",
        attributes: {
          allowed: ["name", "description", "isActive"],
        },
        description: "Update roles",
      },
      {
        action: "delete",
        scope: "global",
        attributes: {},
        description: "Delete roles",
      },
    ],
  },
  {
    modelName: "TenantRole",
    tableName: "tenant_roles",
    module: "access_control",
    description: "Tenant-specific roles",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: ["id", "name", "description", "level", "isAssignable"],
        },
        description: "Read tenant roles",
      },
      {
        action: "create",
        scope: "tenant",
        attributes: {
          allowed: ["name", "description", "level"],
        },
        description: "Create tenant roles",
      },
      {
        action: "update",
        scope: "tenant",
        attributes: {
          allowed: ["name", "description", "level", "isAssignable"],
        },
        description: "Update tenant roles",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete tenant roles",
      },
    ],
  },
  {
    modelName: "RolePermission",
    tableName: "role_permissions",
    module: "access_control",
    description: "Role-permission assignments",
    permissions: [
      {
        action: "read",
        scope: "global",
        attributes: {
          allowed: ["id", "roleId", "tablePermissionId", "isGranted"],
        },
        description: "Read role-permission assignments",
      },
      {
        action: "create",
        scope: "global",
        attributes: {
          allowed: ["roleId", "tablePermissionId", "isGranted"],
        },
        description: "Create role-permission assignments",
      },
      {
        action: "update",
        scope: "global",
        attributes: {
          allowed: ["isGranted"],
        },
        description: "Update role-permission assignments",
      },
      {
        action: "delete",
        scope: "global",
        attributes: {},
        description: "Delete role-permission assignments",
      },
    ],
  },
  {
    modelName: "TenantRolePermission",
    tableName: "tenant_role_permissions",
    module: "access_control",
    description: "Tenant role-permission assignments",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: [
            "id",
            "tenantRoleId",
            "tablePermissionId",
            "isGranted",
            "abacRules",
          ],
        },
        description: "Read tenant role-permission assignments",
      },
      {
        action: "create",
        scope: "tenant",
        attributes: {
          allowed: [
            "tenantRoleId",
            "tablePermissionId",
            "isGranted",
            "abacRules",
          ],
        },
        description: "Create tenant role-permission assignments",
      },
      {
        action: "update",
        scope: "tenant",
        attributes: {
          allowed: ["isGranted", "abacRules"],
        },
        description: "Update tenant role-permission assignments",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete tenant role-permission assignments",
      },
    ],
  },
  {
    modelName: "Session",
    tableName: "sessions",
    module: "authentication",
    description: "User sessions",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: [
            "id",
            "userId",
            "tenantId",
            "createdAt",
            "expiredAt",
            "isActive",
          ],
          hidden: ["token"],
        },
        description: "Read session information",
      },
      {
        action: "create",
        scope: "global",
        attributes: {
          allowed: ["userId", "tenantId", "token", "expiredAt"],
        },
        description: "Create sessions",
      },
      {
        action: "update",
        scope: "self",
        attributes: {
          allowed: ["lastActivityAt"],
        },
        abacRules: {
          condition: "owner",
          fields: ["userId"],
        },
        description: "Update sessions",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete sessions",
      },
    ],
  },
  {
    modelName: "LoginLog",
    tableName: "login_logs",
    module: "authentication",
    description: "Login activity logs",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: [
            "id",
            "userId",
            "tenantId",
            "ipAddress",
            "userAgent",
            "status",
            "createdAt",
          ],
        },
        description: "Read login logs",
      },
      {
        action: "create",
        scope: "global",
        attributes: {
          allowed: ["userId", "tenantId", "ipAddress", "userAgent", "status"],
        },
        description: "Create login logs",
      },
      {
        action: "export",
        scope: "tenant",
        attributes: {},
        description: "Export login logs",
      },
    ],
  },
  {
    modelName: "TenantSetting",
    tableName: "tenant_settings",
    module: "tenant_management",
    description: "Tenant configuration settings",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: ["id", "tenantId", "key", "value", "updatedAt"],
        },
        description: "Read tenant settings",
      },
      {
        action: "create",
        scope: "tenant",
        attributes: {
          allowed: ["tenantId", "key", "value"],
        },
        description: "Create tenant settings",
      },
      {
        action: "update",
        scope: "tenant",
        attributes: {
          allowed: ["value"],
        },
        description: "Update tenant settings",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete tenant settings",
      },
    ],
  },
  {
    modelName: "TenantFeature",
    tableName: "tenant_features",
    module: "tenant_management",
    description: "Tenant feature flags",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: ["id", "tenantId", "featureKey", "isEnabled", "updatedAt"],
        },
        description: "Read tenant features",
      },
      {
        action: "create",
        scope: "tenant",
        attributes: {
          allowed: ["tenantId", "featureKey", "isEnabled"],
        },
        description: "Create tenant features",
      },
      {
        action: "update",
        scope: "tenant",
        attributes: {
          allowed: ["isEnabled"],
        },
        description: "Update tenant features",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete tenant features",
      },
    ],
  },
  {
    modelName: "TenantAuditLog",
    tableName: "tenant_audit_logs",
    module: "audit",
    description: "Tenant audit trail",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: [
            "id",
            "tenantId",
            "userId",
            "action",
            "entityType",
            "entityId",
            "changes",
            "ipAddress",
            "createdAt",
          ],
        },
        description: "Read tenant audit logs",
      },
      {
        action: "create",
        scope: "global",
        attributes: {
          allowed: [
            "tenantId",
            "userId",
            "action",
            "entityType",
            "entityId",
            "changes",
            "ipAddress",
          ],
        },
        description: "Create audit logs",
      },
      {
        action: "export",
        scope: "tenant",
        attributes: {},
        description: "Export audit logs",
      },
    ],
  },
  {
    modelName: "TenantBackup",
    tableName: "tenant_backups",
    module: "backup",
    description: "Tenant backup management",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: ["id", "tenantId", "status", "createdAt", "size", "fileUrl"],
        },
        description: "Read backup information",
      },
      {
        action: "create",
        scope: "tenant",
        attributes: {
          allowed: ["tenantId", "description"],
        },
        description: "Create backups",
      },
      {
        action: "update",
        scope: "tenant",
        attributes: {
          allowed: ["status", "fileUrl"],
        },
        description: "Update backup settings",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete backups",
      },
      {
        action: "import",
        scope: "tenant",
        attributes: {},
        description: "Restore from backups",
      },
    ],
  },
  {
    modelName: "UserPermission",
    tableName: "user_permissions",
    module: "access_control",
    description: "User-specific permissions",
    permissions: [
      {
        action: "read",
        scope: "tenant",
        attributes: {
          allowed: ["id", "userId", "permissionId", "isGranted"],
        },
        description: "Read user permissions",
      },
      {
        action: "create",
        scope: "tenant",
        attributes: {
          allowed: ["userId", "permissionId", "isGranted"],
        },
        description: "Create user permissions",
      },
      {
        action: "update",
        scope: "tenant",
        attributes: {
          allowed: ["isGranted"],
        },
        description: "Update user permissions",
      },
      {
        action: "delete",
        scope: "tenant",
        attributes: {},
        description: "Delete user permissions",
      },
    ],
  },
];

/**
 * Seed the models and table permissions
 */
async function seedTablePermissions() {
  try {
    logger.info("Starting table permissions seed...");

    // 1. Create models
    logger.info("Creating models...");
    const createdModels = [];

    for (const modelDef of DEFAULT_MODELS) {
      let model = await Models.findOne({
        where: { modelName: modelDef.modelName },
      });

      if (!model) {
        model = await Models.create(modelDef);
        logger.info(`  Created model: ${modelDef.modelName}`);
      } else {
        await model.update({
          tableName: modelDef.tableName,
          module: modelDef.module,
          description: modelDef.description,
          isActive: true,
        });
        logger.info(`  Updated model: ${modelDef.modelName}`);
      }

      createdModels.push(model);
    }

    // 2. Create table permissions for each model
    logger.info("Creating table permissions...");

    for (const model of createdModels) {
      for (const permDef of model.permissions || []) {
        const { action, scope, attributes, abacRules, description } = permDef;

        let tablePerm = await TablePermission.findOne({
          where: { modelId: model.id, action },
        });

        if (!tablePerm) {
          tablePerm = await TablePermission.create({
            modelId: model.id,
            action,
            scope,
            attributes,
            abacRules,
            description,
          });
          logger.info(`  Created permission: ${model.modelName}:${action}`);
        } else {
          await tablePerm.update({ scope, attributes, abacRules, description });
          logger.info(`  Updated permission: ${model.modelName}:${action}`);
        }
      }
    }

    // 3. Assign permissions to global roles
    logger.info("Assigning permissions to global roles...");

    const { ROLE_NAMES } = require("../utils/constants");

    const superAdminRole = await Roles.findOne({
      where: { name: ROLE_NAMES.SUPER_ADMIN },
    });

    if (superAdminRole) {
      // SUPER_ADMIN gets all permissions
      const allPermissions = await TablePermission.findAll();

      for (const perm of allPermissions) {
        await assignPermissionToRole(superAdminRole.id, perm.id, true);
      }
      logger.info(`  Assigned all permissions to SUPER_ADMIN`);
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
            as: "model",
            where: {
              modelName: DEFAULT_MODELS.map((m) => m.modelName),
            },
          },
        ],
      });

      for (const perm of tenantScopedPermissions) {
        // Grant read, create, update for tenant-scoped resources
        if (["read", "create", "update"].includes(perm.action)) {
          await assignPermissionToRole(tenantAdminRole.id, perm.id, true);
          logger.info(
            `  Assigned ${perm.action} to TENANT_ADMIN for ${perm.model.modelName}`,
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
            as: "model",
            where: { modelName: "User" },
          },
        ],
        where: { action: ["read", "update"] },
      });

      for (const perm of selfPermissions) {
        await assignPermissionToRole(userRole.id, perm.id, true);
        logger.info(`  Assigned ${perm.action} to USER for User model`);
      }
    }

    logger.info("Table permissions seed completed successfully!");
    return true;
  } catch (error) {
    logger.error(`Seed failed: ${error.message}`);
    console.error(error);
    return false;
  }
}

/**
 * Helper: Assign a permission to a role
 */
async function assignPermissionToRole(roleId, tablePermissionId, isGranted) {
  const { RolePermission } = require("../models");

  const existing = await RolePermission.findOne({
    where: { roleId, tablePermissionId },
  });

  if (existing) {
    await existing.update({ isGranted });
  } else {
    await RolePermission.create({ roleId, tablePermissionId, isGranted });
  }
}

// Run the seed if this file is executed directly
if (require.main === module) {
  seedTablePermissions()
    .then((success) => {
      if (success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  seedTablePermissions,
  DEFAULT_MODELS,
};
