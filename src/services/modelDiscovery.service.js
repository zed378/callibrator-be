/**
 * Model Discovery Service
 *
 * Automatically discovers all model files in the models directory,
 * creates model entries in the database, and generates table permissions
 * with global permissions for all discovered models.
 *
 * Usage:
 *   const modelDiscovery = require('../services/modelDiscovery.service');
 *   await modelDiscovery.discoverAndSeedModels();
 */

const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const { Models, TablePermission, Roles } = require("../models");
const { ROLE_NAMES, ROLE_IDS } = require("../constants");

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Default table permissions actions that will be created for each discovered model
 */
const DEFAULT_ACTIONS = [
  { action: "create", scope: "global", description: "Create records" },
  { action: "read", scope: "global", description: "Read records" },
  { action: "update", scope: "self", description: "Update records" },
  { action: "delete", scope: "global", description: "Delete records" },
  { action: "export", scope: "global", description: "Export records" },
  { action: "import", scope: "global", description: "Import records" },
];

/**
 * Scope defaults by action type
 */
const ACTION_SCOPE_DEFAULTS = {
  create: "global",
  read: "global",
  update: "self",
  delete: "global",
  export: "global",
  import: "global",
};

/**
 * Module grouping mapping by model name patterns
 */
const MODULE_MAPPINGS = {
  // User management module
  user: "user_management",
  tenant: "tenant_management",
  tenant_role: "access_control",
  role: "access_control",
  permission: "access_control",
  session: "authentication",
  login_log: "authentication",
  loginLogs: "authentication",
  login: "authentication",
  setting: "tenant_management",
  feature: "tenant_management",
  audit: "audit",
  backup: "backup",
  model: "access_control",
  table_permission: "access_control",
  role_permission: "access_control",
  user_permission: "access_control",
  menugroup: "menu_group",
  menuitem: "menu_item",
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Extract model name from filename
 * @param {string} filename - Filename without extension
 * @returns {string} Model name (PascalCase)
 */
function extractModelName(filename) {
  // Handle special cases
  const specialCases = {
    tenant: "Tenant",
    user: "User",
    permission: "Permission",
    role: "Role",
    model: "Model",
    session: "Session",
    setting: "Setting",
    feature: "Feature",
    audit_log: "AuditLog",
    backup: "Backup",
  };

  const lowerFilename = filename.toLowerCase();

  // Check special cases first
  if (specialCases[lowerFilename]) {
    return specialCases[lowerFilename];
  }

  // Handle compound names (e.g., 'tenant_role' -> 'TenantRole')
  if (lowerFilename.includes("_")) {
    return lowerFilename
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  // Simple PascalCase conversion
  return filename.charAt(0).toUpperCase() + filename.slice(1);
}

/**
 * Extract table name from model name
 * @param {string} modelName - PascalCase model name
 * @returns {string} Snake case table name
 */
function extractTableName(modelName) {
  // Convert PascalCase to snake_case and pluralize
  const snakeCase = modelName
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");

  return pluralize(snakeCase);
}

/**
 * Simple pluralization for table names
 * @param {string} word - Singular word
 * @returns {string} Pluralized word
 */
function pluralize(word) {
  if (word.endsWith("y") && !isVowel(word[word.length - 2])) {
    return word.slice(0, -1) + "ies";
  }
  if (word.endsWith("s") || word.endsWith("es")) {
    return word; // Already plural-ish
  }
  return word + "s";
}

/**
 * Check if character is a vowel
 * @param {string} char - Character to check
 * @returns {boolean}
 */
function isVowel(char) {
  return ["a", "e", "i", "o", "u"].includes(char);
}

/**
 * Determine module based on model name
 * @param {string} modelName - PascalCase model name
 * @returns {string} Module name
 */
function getModuleForModel(modelName) {
  const lowerName = modelName.toLowerCase();

  // Direct lookup
  if (MODULE_MAPPINGS[lowerName]) {
    return MODULE_MAPPINGS[lowerName];
  }

  // Pattern matching
  if (lowerName.includes("user") || lowerName.includes("tenant")) {
    return "user_management";
  }
  if (lowerName.includes("role") || lowerName.includes("permission")) {
    return "access_control";
  }
  if (lowerName.includes("session") || lowerName.includes("login")) {
    return "authentication";
  }
  if (lowerName.includes("setting") || lowerName.includes("feature")) {
    return "tenant_management";
  }
  if (lowerName.includes("audit")) {
    return "audit";
  }
  if (lowerName.includes("backup")) {
    return "backup";
  }

  // Default module based on model name
  // Convert PascalCase to snake_case (e.g., "MenuItem" → "menu_item")
  const snakeCase = modelName
    .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`)
    .replace(/^_/, ""); // Remove leading underscore if any
  return snakeCase;
}

/**
 * Get default attributes for a model based on its fields
 * @param {Array} fields - Array of field definitions from the model file
 * @returns {Object} Attributes configuration
 */
function getDefaultAttributes(modelName, fields) {
  const allowedFields = fields || [];

  const sensitiveFields = [
    "password",
    "passwordHash",
    "salt",
    "otpCode",
    "token",
    "secret",
    "apiKey",
  ];

  const commonFields = ["id", "createdAt", "updatedAt", "deletedAt"];

  let allowed = [];
  let hidden = [];

  // Determine allowed and hidden fields based on model
  for (const field of allowedFields) {
    const fieldName = typeof field === "string" ? field : field.name;
    if (sensitiveFields.includes(fieldName)) {
      hidden.push(fieldName);
    } else if (!commonFields.includes(fieldName)) {
      allowed.push(fieldName);
    }
  }

  // If no specific fields detected, use sensible defaults
  if (allowed.length === 0 && hidden.length === 0) {
    switch (modelName) {
      case "User":
        allowed = [
          "username",
          "email",
          "firstName",
          "lastName",
          "status",
          "picture",
        ];
        hidden = ["password", "otpCode"];
        break;
      case "Tenant":
        allowed = [
          "name",
          "code",
          "description",
          "status",
          "maxUsers",
          "email",
        ];
        break;
      case "Role":
        allowed = ["name", "description", "roleLevel", "isActive"];
        break;
      case "TenantRole":
        allowed = ["name", "description", "level", "isAssignable"];
        break;
      case "Permission":
        allowed = ["name", "module", "action", "description"];
        break;
      case "Session":
        allowed = ["userId", "tenantId", "createdAt", "expiredAt", "isActive"];
        hidden = ["token"];
        break;
      case "TenantSetting":
        allowed = ["tenantId", "key", "value", "updatedAt"];
        break;
      case "TenantFeature":
        allowed = ["tenantId", "featureKey", "isEnabled", "updatedAt"];
        break;
      case "TenantAuditLog":
        allowed = [
          "tenantId",
          "userId",
          "action",
          "entityType",
          "entityId",
          "changes",
          "ipAddress",
          "createdAt",
        ];
        break;
      case "TenantBackup":
        allowed = ["tenantId", "status", "createdAt", "size", "fileUrl"];
        break;
      default:
        allowed = ["id"];
        break;
    }
  }

  return {
    allowed: allowed.length > 0 ? allowed : ["id"],
    hidden: hidden.length > 0 ? hidden : [],
  };
}

// ==========================================
// MODEL DISCOVERY
// ==========================================

/**
 * Discover all model files in the models directory
 * @returns {Array} Array of discovered model definitions
 */
async function discoverModels() {
  const modelsDir = path.join(__dirname, "../models");
  const discoveredModels = [];

  try {
    const files = fs.readdirSync(modelsDir);

    for (const file of files) {
      if (!file.endsWith(".js")) continue;
      if (file === "index.js") continue; // Skip index file

      const filePath = path.join(modelsDir, file);
      const modelName = extractModelName(file.replace(".js", ""));
      const tableName = extractTableName(modelName);
      const module = getModuleForModel(modelName);

      // Try to detect fields from the model file for better attribute defaults
      let fields = [];
      try {
        const content = fs.readFileSync(filePath, "utf8");
        // Extract field names from the model definition
        const fieldMatches = content.match(/[\w]+:\s*\{\s*type:/g) || [];
        fields = fieldMatches
          .map((match) => match.replace(/:\s*\{\s*type:/, "").trim())
          .filter(
            (name) =>
              ![
                "type",
                "allowNull",
                "defaultValue",
                "primaryKey",
                "unique",
                "comment",
                "onDelete",
                "onUpdate",
              ].includes(name),
          );
      } catch (e) {
        // If we can't read the file, use defaults
      }

      discoveredModels.push({
        modelName,
        tableName,
        module,
        description: `${modelName} records`,
        fields,
      });
    }
  } catch (error) {
    console.error(`[ERROR] Failed to discover models: ${error.message}`);
  }

  return discoveredModels;
}

/**
 * Get default table permissions for a model
 * @param {string} modelName - Model name
 * @param {Array} fields - Model fields
 * @returns {Array} Array of permission definitions
 */
function getDefaultTablePermissions(modelName, fields = []) {
  const attributes = getDefaultAttributes(modelName, fields);

  return DEFAULT_ACTIONS.map((actionDef) => {
    const perm = {
      action: actionDef.action,
      scope: ACTION_SCOPE_DEFAULTS[actionDef.action] || "global",
      description: actionDef.description,
    };

    // Add attributes for read and update actions
    if (actionDef.action === "read") {
      perm.attributes = {
        allowed: attributes.allowed,
        hidden: attributes.hidden,
      };
    } else if (actionDef.action === "update") {
      // For self scope, allow updating common fields
      perm.attributes = {
        allowed: ["id", ...attributes.allowed.slice(0, 3)],
      };
      perm.abacRules = {
        condition: "owner",
        fields: ["id"],
      };
    } else if (actionDef.action === "create") {
      perm.attributes = {
        allowed: attributes.allowed.filter(
          (f) => !["id", "createdAt", "updatedAt", "deletedAt"].includes(f),
        ),
      };
    }

    return perm;
  });
}

// ==========================================
// SEEDING OPERATIONS
// ==========================================

/**
 * Discover models and seed them into the database
 * Creates model entries and table permissions with global scope
 * @param {Object} options - Seed options
 * @param {boolean} options.assignToRoles - Whether to assign permissions to default roles
 * @returns {Promise<Object>} Seed result
 */
async function discoverAndSeedModels(assignToRoles = true) {
  const result = {
    modelsDiscovered: 0,
    modelsCreated: 0,
    modelsUpdated: 0,
    modelsSkipped: 0,
    permissionsCreated: 0,
    permissionsSkipped: 0,
    roleAssignments: 0,
    errors: [],
  };

  try {
    console.log(
      `[INFO] ${new Date().toISOString()} - Starting model discovery...`,
    );

    // 1. Discover all models
    const discoveredModels = await discoverModels();
    result.modelsDiscovered = discoveredModels.length;
    console.log(
      `[INFO] ${new Date().toISOString()} - Discovered ${discoveredModels.length} models`,
    );

    // 2. Create or update models in the database
    for (const modelDef of discoveredModels) {
      try {
        let model = await Models.findOne({
          where: { modelName: modelDef.modelName },
        });

        if (model) {
          await model.update({
            tableName: modelDef.tableName,
            module: modelDef.module,
            description: modelDef.description,
            isActive: true,
          });
          result.modelsUpdated++;
          console.log(
            `[INFO] ${new Date().toISOString()} -   Updated model: ${modelDef.modelName}`,
          );
        } else {
          await Models.create(modelDef);
          result.modelsCreated++;
          console.log(
            `[INFO] ${new Date().toISOString()} -   Created model: ${modelDef.modelName}`,
          );
        }
      } catch (error) {
        result.errors.push(
          `Error seeding model ${modelDef.modelName}: ${error.message}`,
        );
        console.error(
          `[ERROR] ${new Date().toISOString()} -   Failed to seed model ${modelDef.modelName}: ${error.message}`,
        );
      }
    }

    // 3. Create table permissions for each model
    console.log(
      `[INFO] ${new Date().toISOString()} - Creating table permissions...`,
    );

    const allModels = await Models.findAll({
      where: { isActive: true },
    });

    for (const model of allModels) {
      // Get the discovered model definition for default attributes
      const discoveredDef = discoveredModels.find(
        (d) => d.modelName === model.modelName,
      );
      const fields = discoveredDef?.fields || [];
      const defaultPerms = getDefaultTablePermissions(model.modelName, fields);

      for (const permDef of defaultPerms) {
        try {
          let tablePerm = await TablePermission.findOne({
            where: { modelId: model.id, action: permDef.action },
          });

          if (tablePerm) {
            // Update existing permission
            await tablePerm.update({
              scope: permDef.scope,
              attributes: permDef.attributes || {},
              abacRules: permDef.abacRules || null,
              description: permDef.description,
            });
            result.permissionsSkipped++;
          } else {
            await TablePermission.create({
              modelId: model.id,
              action: permDef.action,
              scope: permDef.scope,
              attributes: permDef.attributes || {},
              abacRules: permDef.abacRules || null,
              description: permDef.description,
            });
            result.permissionsCreated++;
            console.log(
              `[INFO] ${new Date().toISOString()} -   Created permission: ${model.modelName}:${permDef.action}`,
            );
          }
        } catch (error) {
          result.errors.push(
            `Error creating permission for ${model.modelName}:${permDef.action}: ${error.message}`,
          );
        }
      }
    }

    // 4. Assign permissions to default roles
    if (assignToRoles) {
      console.log(
        `[INFO] ${new Date().toISOString()} - Assigning permissions to roles...`,
      );
      await assignPermissionsToRoles(result);
    }

    console.log(
      `[INFO] ${new Date().toISOString()} - Model discovery and seeding completed!`,
    );
    console.log(`  - Models discovered: ${result.modelsDiscovered}`);
    console.log(`  - Models created: ${result.modelsCreated}`);
    console.log(`  - Models updated: ${result.modelsUpdated}`);
    console.log(`  - Permissions created: ${result.permissionsCreated}`);
    console.log(`  - Errors: ${result.errors.length}`);

    return result;
  } catch (error) {
    result.errors.push(`Fatal error during model discovery: ${error.message}`);
    console.error(
      `[ERROR] ${new Date().toISOString()} - Fatal error: ${error.message}`,
    );
    return result;
  }
}

/**
 * Assign discovered model permissions to default roles
 * @param {Object} result - Seed result object to update
 * @returns {Promise<void>}
 */
async function assignPermissionsToRoles(result) {
  try {
    // SUPER_ADMIN - get all permissions
    const superAdminRole = await Roles.findOne({
      where: { name: ROLE_NAMES.SUPER_ADMIN },
    });

    if (superAdminRole) {
      const allPerms = await TablePermission.findAll();
      for (const perm of allPerms) {
        await assignTablePermissionToRole(superAdminRole.id, perm.id, true);
        result.roleAssignments++;
      }
      console.log(
        `[INFO] ${new Date().toISOString()} -   Assigned all permissions to SUPER_ADMIN`,
      );
    }

    // TENANT_ADMIN - get tenant-scoped permissions
    const tenantAdminRole = await Roles.findOne({
      where: { name: ROLE_NAMES.TENANT_ADMIN },
    });

    if (tenantAdminRole) {
      const allPerms = await TablePermission.findAll({
        include: [
          {
            model: Models,
            as: "model",
            where: { isActive: true },
          },
        ],
      });

      for (const perm of allPerms) {
        if (["read", "create", "update"].includes(perm.action)) {
          await assignTablePermissionToRole(tenantAdminRole.id, perm.id, true);
          result.roleAssignments++;
        }
      }
      console.log(
        `[INFO] ${new Date().toISOString()} -   Assigned permissions to TENANT_ADMIN`,
      );
    }

    // USER - get self permissions for User model
    const userRole = await Roles.findOne({
      where: { name: ROLE_NAMES.USER },
    });

    if (userRole) {
      const selfPerms = await TablePermission.findAll({
        include: [
          {
            model: Models,
            as: "model",
            where: { modelName: "User" },
          },
        ],
        where: { action: ["read", "update"] },
      });

      for (const perm of selfPerms) {
        await assignTablePermissionToRole(userRole.id, perm.id, true);
        result.roleAssignments++;
      }
      console.log(
        `[INFO] ${new Date().toISOString()} -   Assigned permissions to USER`,
      );
    }
  } catch (error) {
    result.errors.push(
      `Error assigning permissions to roles: ${error.message}`,
    );
  }
}

/**
 * Assign a table permission to a role (handles duplicates)
 * @param {string} roleId - Role ID
 * @param {string} tablePermissionId - Table permission ID
 * @param {boolean} isGranted - Whether permission is granted
 * @returns {Promise<void>}
 */
async function assignTablePermissionToRole(
  roleId,
  tablePermissionId,
  isGranted,
) {
  const { RolePermission } = require("../models");

  const existing = await RolePermission.findOne({
    where: { roleId, tablePermissionId },
  });

  if (!existing) {
    await RolePermission.create({
      roleId,
      tablePermissionId,
      isGranted,
    });
  }
}

/**
 * Get a summary of all models and their permissions
 * @returns {Promise<Object>} Model and permission summary
 */
async function getModelSummary() {
  try {
    const models = await Models.findAll({
      include: [
        {
          model: TablePermission,
          as: "tablePermissions",
          attributes: ["id", "action", "scope", "description"],
          include: [
            {
              model: Roles,
              through: { attributes: ["isGranted"] },
              as: "roles",
            },
          ],
        },
      ],
      order: [["modelName", "ASC"]],
    });

    return {
      totalModels: models.length,
      models: models.map((model) => ({
        id: model.id,
        modelName: model.modelName,
        tableName: model.tableName,
        module: model.module,
        isActive: model.isActive,
        permissions: model.tablePermissions.map((perm) => ({
          action: perm.action,
          scope: perm.scope,
          description: perm.description,
          roles:
            perm.roles?.map((role) => ({
              name: role.name,
              isGranted: role.RolePermission?.isGranted,
            })) || [],
        })),
      })),
    };
  } catch (error) {
    throw new Error(`Failed to get model summary: ${error.message}`);
  }
}

module.exports = {
  discoverModels,
  discoverAndSeedModels,
  getModelSummary,
  extractModelName,
  extractTableName,
  getModuleForModel,
  getDefaultTablePermissions,
  // Re-export constants for external use
  DEFAULT_ACTIONS,
  ACTION_SCOPE_DEFAULTS,
  MODULE_MAPPINGS,
};
