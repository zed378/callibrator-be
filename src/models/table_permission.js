const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

/**
 * TablePermission Model
 *
 * Defines permissions for specific actions on models (tables).
 * Each model can have multiple table permissions (create, read, update, delete, export, import).
 *
 * Scope types:
 * - global: Accessible by anyone with the role
 * - tenant: Restricted to the user's tenant
 * - self: User can only access their own records
 * - custom: Custom ABAC rules apply
 *
 * Attributes (JSONB): Column-level permissions
 * {
 *   allowed: ['id', 'name', 'email'],    // Columns user can see
 *   hidden: ['ssn', 'password'],          // Columns always hidden
 *   editable: ['name', 'email']           // Columns user can edit
 * }
 *
 * AbacRules (JSONB): Dynamic attribute-based conditions
 * {
 *   condition: 'owner',                   // Predefined condition type
 *   fields: ['userId'],                   // Fields to check
 *   operator: 'eq',                       // Comparison operator
 *   value: null                           // Expected value (for non-owner conditions)
 * }
 */
const TablePermission = db.define(
  "table_permissions",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    modelId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "models",
        key: "id",
      },
    },
    action: {
      type: DataTypes.ENUM(
        "create",
        "read",
        "update",
        "delete",
        "export",
        "import",
      ),
      allowNull: false,
      comment: "Action allowed on this model",
    },
    scope: {
      type: DataTypes.ENUM("global", "tenant", "self", "custom"),
      allowNull: false,
      defaultValue: "global",
      comment: "Scope of the permission - who can perform this action",
    },
    attributes: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment:
        "Column-level permissions: { allowed: ['name', 'email'], hidden: ['ssn'] }",
    },
    abacRules: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: "Dynamic ABAC rules: { condition: 'owner', fields: ['userId'] }",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["modelId", "action"],
      },
      {
        fields: ["modelId", "scope"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

TablePermission.associate = (models) => {
  TablePermission.belongsTo(models.Models, {
    foreignKey: "modelId",
    as: "model",
  });

  TablePermission.belongsToMany(models.Roles, {
    through: models.RolePermission,
    foreignKey: "tablePermissionId",
    otherKey: "roleId",
    as: "roles",
  });

  TablePermission.belongsToMany(models.TenantRoles, {
    through: models.TenantRolePermission,
    foreignKey: "tablePermissionId",
    otherKey: "tenantRoleId",
    as: "tenantRoles",
  });
};

// ==========================================
// HELPER METHODS
// ==========================================

/**
 * Get all table permissions for a model
 * @param {string} modelId - Model UUID
 * @param {Object} options - Options
 * @param {boolean} options.includeRoles - Include role associations
 * @param {boolean} options.includeTenantRoles - Include tenant role associations
 * @returns {Promise<Array>}
 */
TablePermission.getTablePermissionsByModel = async (
  modelId,
  { includeRoles = false, includeTenantRoles = false } = {},
) => {
  const include = [
    {
      model: require("../models").Models,
      as: "model",
      attributes: ["id", "modelName", "tableName", "module"],
    },
  ];

  if (includeRoles) {
    include.push({
      model: require("../models").Roles,
      through: { attributes: ["isGranted", "expiresAt"] },
      as: "roles",
    });
  }

  if (includeTenantRoles) {
    include.push({
      model: require("../models").TenantRoles,
      through: { attributes: ["isGranted", "expiresAt", "abacRules"] },
      as: "tenantRoles",
    });
  }

  return TablePermission.findAll({
    where: { modelId },
    include,
    order: [["action", "ASC"]],
  });
};

/**
 * Get table permission by model and action
 * @param {string} modelId - Model UUID
 * @param {string} action - Action (create, read, update, delete, export, import)
 * @returns {Promise<Model|null>}
 */
TablePermission.getTablePermissionByAction = async (modelId, action) => {
  return TablePermission.findOne({
    where: { modelId, action },
    include: [
      {
        model: require("../models").Models,
        as: "model",
        attributes: ["id", "modelName", "tableName", "module"],
      },
    ],
  });
};

/**
 * Create or update table permissions for a model
 * @param {Object} modelId - Model UUID
 * @param {Array} permissions - Array of permission objects
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>}
 */
TablePermission.bulkUpsert = async (modelId, permissions, models) => {
  const results = [];

  for (const perm of permissions) {
    const {
      action,
      scope = "global",
      attributes = {},
      abacRules = null,
      description,
    } = perm;

    const [permission, created] = await TablePermission.findOrCreate({
      where: { modelId, action },
      defaults: { scope, attributes, abacRules, description },
    });

    if (!created) {
      await permission.update({ scope, attributes, abacRules, description });
    }

    results.push(permission);
  }

  return results;
};

module.exports = {
  TablePermission,
};
