const { Sequelize, DataTypes, Op } = require("sequelize");

const { db } = require("../config");

/**
 * RolePermission Model
 *
 * Junction table linking Roles to TablePermissions.
 * Defines which global roles have access to which table actions.
 *
 * Example:
 * - Role: SUPER_ADMIN -> TablePermission: User:read (isGranted: true)
 * - Role: TENANT_ADMIN -> TablePermission: User:update (isGranted: true)
 */
const RolePermission = db.define(
  "role_permissions",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "roles",
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for this permission assignment",
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["roleId", "tablePermissionId"],
      },
      {
        fields: ["roleId", "isGranted"],
      },
      {
        fields: ["tablePermissionId"],
      },
      {
        fields: ["expiresAt"],
        where: { expiresAt: { [Op.not]: null } },
        name: "idx_role_permissions_expires",
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

RolePermission.associate = (models) => {
  RolePermission.belongsTo(models.Roles, {
    foreignKey: "roleId",
    as: "role",
  });

  RolePermission.belongsTo(models.TablePermission, {
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
 * Grant a table permission to a role
 * @param {string} roleId - Role UUID
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} options - Options
 * @param {string} options.expiresAt - Optional expiration date
 * @param {string} options.description - Optional description
 * @param {Object} models - Sequelize models
 * @returns {Promise<Model>}
 */
RolePermission.grantPermission = async (
  roleId,
  tablePermissionId,
  options = {},
  models,
) => {
  const { expiresAt = null, description = null } = options;

  const [rolePermission, created] = await RolePermission.findOrCreate({
    where: { roleId, tablePermissionId },
    defaults: { isGranted: true, expiresAt, description },
  });

  if (!created) {
    await rolePermission.update({ isGranted: true, expiresAt, description });
  }

  return rolePermission;
};

/**
 * Revoke a table permission from a role
 * @param {string} roleId - Role UUID
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>}
 */
RolePermission.revokePermission = async (roleId, tablePermissionId, models) => {
  const rolePermission = await RolePermission.findOne({
    where: { roleId, tablePermissionId },
  });

  if (!rolePermission) {
    return false;
  }

  await rolePermission.update({ isGranted: false });
  return true;
};

/**
 * Check if a role has a specific table permission
 * @param {string} roleId - Role UUID
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>}
 */
RolePermission.hasPermission = async (roleId, tablePermissionId, models) => {
  const rolePermission = await RolePermission.findOne({
    where: {
      roleId,
      tablePermissionId,
      isGranted: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
    },
  });

  return !!rolePermission;
};

/**
 * Get all granted table permissions for a role
 * @param {string} roleId - Role UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>}
 */
RolePermission.getGrantedPermissions = async (roleId, models) => {
  return RolePermission.findAll({
    where: {
      roleId,
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
 * Get all roles that have a specific table permission
 * @param {string} tablePermissionId - TablePermission UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>}
 */
RolePermission.getRolesWithPermission = async (tablePermissionId, models) => {
  return RolePermission.findAll({
    where: {
      tablePermissionId,
      isGranted: true,
    },
    include: [
      {
        model: models.Roles,
        as: "role",
        attributes: ["id", "name", "description"],
      },
    ],
  });
};

module.exports = {
  RolePermission,
};
