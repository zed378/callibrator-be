const { Sequelize, DataTypes, Op } = require("sequelize");

const { db } = require("../config");

/**
 * TenantRolePermission Model
 *
 * Junction table linking TenantRoles to TablePermissions.
 * Defines which tenant-specific roles have access to which table actions.
 *
 * Unlike global RolePermission, this model supports:
 * - Per-tenant permission customization
 * - ABAC rules stored as JSONB for dynamic attribute-based conditions
 *
 * Example ABAC rules:
 * {
 *   condition: 'owner',                    // User can only access their own records
 *   fields: ['userId'],                    // Field to check
 *   operator: 'eq',                        // Comparison operator
 *   value: null                            // Not used for 'owner' condition
 * }
 *
 * {
 *   condition: 'attribute',                // Check resource attribute
 *   field: 'status',                       // Field to check
 *   operator: 'in',                        // Operator: eq, neq, in, nin, gt, lt, gte, lte
 *   value: ['active', 'pending']           // Expected values
 * }
 *
 * {
 *   condition: 'custom',                   // Custom JavaScript expression
 *   expression: 'record.departmentId === user.departmentId',  // Custom condition
 *   fields: ['departmentId']               // Fields needed for evaluation
 * }
 */
const TenantRolePermission = db.define(
  "tenant_role_permissions",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    tenantRoleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "tenant_roles",
        key: "id",
      },
    },
    tablePermissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "table_permissions",
        key: "id",
      },
    },
    isGranted: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether this permission is granted or denied",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Optional expiration for temporary permissions",
    },
    abacRules: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      comment:
        "Dynamic ABAC rules: { condition: 'owner', fields: ['userId'], operator: 'eq' }",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for this permission assignment",
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["tenantRoleId", "tablePermissionId"],
      },
      {
        fields: ["tenantRoleId", "isGranted"],
      },
      {
        fields: ["tablePermissionId"],
      },
      {
        fields: ["expiresAt"],
        where: { expiresAt: { [Op.not]: null } },
        name: "idx_tenant_role_permissions_expires",
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

TenantRolePermission.associate = (models) => {
  TenantRolePermission.belongsTo(models.TenantRoles, {
    foreignKey: "tenantRoleId",
    as: "tenantRole",
  });

  TenantRolePermission.belongsTo(models.TablePermission, {
    foreignKey: "tablePermissionId",
    as: "tablePermission",
    include: [
      {
        model: models.Models,
        as: "model",
        attributes: ["id", "modelName", "tableName", "module"],
      },
    ],
  });
};

// ==========================================
// HELPER METHODS
// ==========================================

/**
 * Grant a table permission to a tenant role
 * @param {string} tenantRoleId - TenantRole UUID
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} options - Options
 * @param {string} options.expiresAt - Optional expiration date
 * @param {Object} options.abacRules - Optional ABAC rules
 * @param {string} options.description - Optional description
 * @param {Object} models - Sequelize models
 * @returns {Promise<Model>}
 */
TenantRolePermission.grantPermission = async (
  tenantRoleId,
  tablePermissionId,
  options = {},
  models,
) => {
  const { expiresAt = null, abacRules = null, description = null } = options;

  const [tenantRolePermission, created] =
    await TenantRolePermission.findOrCreate({
      where: { tenantRoleId, tablePermissionId },
      defaults: { isGranted: true, expiresAt, abacRules, description },
    });

  if (!created) {
    await tenantRolePermission.update({
      isGranted: true,
      expiresAt,
      abacRules,
      description,
    });
  }

  return tenantRolePermission;
};

/**
 * Revoke a table permission from a tenant role
 * @param {string} tenantRoleId - TenantRole UUID
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>}
 */
TenantRolePermission.revokePermission = async (
  tenantRoleId,
  tablePermissionId,
  models,
) => {
  const tenantRolePermission = await TenantRolePermission.findOne({
    where: { tenantRoleId, tablePermissionId },
  });

  if (!tenantRolePermission) {
    return false;
  }

  await tenantRolePermission.update({ isGranted: false });
  return true;
};

/**
 * Check if a tenant role has a specific table permission
 * @param {string} tenantRoleId - TenantRole UUID
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>}
 */
TenantRolePermission.hasPermission = async (
  tenantRoleId,
  tablePermissionId,
  models,
) => {
  const tenantRolePermission = await TenantRolePermission.findOne({
    where: {
      tenantRoleId,
      tablePermissionId,
      isGranted: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
  });

  return !!tenantRolePermission;
};

/**
 * Get all granted table permissions for a tenant role
 * @param {string} tenantRoleId - TenantRole UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>}
 */
TenantRolePermission.getGrantedPermissions = async (tenantRoleId, models) => {
  return TenantRolePermission.findAll({
    where: {
      tenantRoleId,
      isGranted: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    include: [
      {
        model: models.TablePermission,
        as: "tablePermission",
        include: [
          {
            model: models.Models,
            as: "model",
            attributes: ["id", "modelName", "tableName", "module"],
          },
        ],
      },
    ],
  });
};

/**
 * Update ABAC rules for a tenant role permission
 * @param {string} tenantRoleId - TenantRole UUID
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} abacRules - New ABAC rules
 * @param {Object} models - Sequelize models
 * @returns {Promise<Model>}
 */
TenantRolePermission.updateAbacRules = async (
  tenantRoleId,
  tablePermissionId,
  abacRules,
  models,
) => {
  const tenantRolePermission = await TenantRolePermission.findOne({
    where: { tenantRoleId, tablePermissionId },
  });

  if (!tenantRolePermission) {
    throw new Error("Tenant role permission not found");
  }

  await tenantRolePermission.update({ abacRules });
  return tenantRolePermission;
};

/**
 * Get tenant role permissions with ABAC rules for a tenant
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>}
 */
TenantRolePermission.getTenantAbacRules = async (tenantId, models) => {
  return TenantRolePermission.findAll({
    where: {
      isGranted: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
    include: [
      {
        model: models.TenantRoles,
        as: "tenantRole",
        where: { tenantId },
        attributes: ["id", "name", "level"],
      },
      {
        model: models.TablePermission,
        as: "tablePermission",
        attributes: ["id", "action", "scope", "attributes"],
        include: [
          {
            model: models.Models,
            as: "model",
            attributes: ["id", "modelName", "tableName", "module"],
          },
        ],
      },
    ],
    where: {
      abacRules: {
        [Op.not]: null,
      },
    },
  });
};

module.exports = {
  TenantRolePermission,
};
