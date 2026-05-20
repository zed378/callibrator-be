const { Sequelize, DataTypes, Op } = require("sequelize");

const { db } = require("../config");

/**
 * TenantRole Model
 *
 * Defines roles specific to each tenant.
 * These roles are separate from global roles and allow
 * tenants to customize their own role hierarchy.
 *
 * Example: A tenant might have "Project Manager", "Developer", "QA" roles
 * that are specific to their organization structure.
 */
const TenantRoles = db.define(
  "tenant_roles",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },

    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "tenants",
        key: "id",
      },
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [2, 100],
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /**
     * Role level within tenant hierarchy
     * Lower numbers = higher privilege within this tenant
     * 1 = Tenant Owner (highest)
     * 2 = Tenant Admin
     * 3+ = Custom roles (defined by tenant)
     */
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      comment: "Role hierarchy level within tenant (lower = higher privilege)",
    },

    /**
     * Whether this role can be assigned to users
     */
    isAssignable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    /**
     * Maximum number of users that can have this role
     * null = unlimited
     */
    maxUsers: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },

    /**
     * Whether this role is default for new users in this tenant
     */
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    /**
     * Whether this role is system-defined (cannot be deleted)
     */
    isSystemRole: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["tenantId", "name"],
      },
      {
        fields: ["tenantId", "level"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

TenantRoles.associate = (models) => {
  TenantRoles.belongsTo(models.Tenants, {
    foreignKey: "tenantId",
    as: "tenant",
  });

  TenantRoles.hasMany(models.Users, {
    foreignKey: "tenantRoleId",
    as: "users",
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
  });
};

/**
 * Create a default tenant role
 *
 * @param {Object} params - Creation parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.name - Role name
 * @param {string} params.description - Role description
 * @param {number} params.level - Role level
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Created tenant role
 */
TenantRoles.createDefaultRole = async (
  {
    tenantId,
    name = "Tenant Member",
    description = "Default tenant role",
    level = 10,
  },
  models,
) => {
  return TenantRoles.create(
    {
      tenantId,
      name,
      description,
      level,
      isAssignable: true,
      isDefault: true,
    },
    { transaction: models.Sequelize?.TRANSACTION_NONE },
  );
};

/**
 * Get role count for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<number>} Number of active roles
 */
TenantRoles.getRoleCountForTenant = async (tenantId, models) => {
  return TenantRoles.count({
    where: { tenantId, isActive: true },
  });
};

/**
 * Check if role name is unique within tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} name - Role name
 * @param {string} excludeId - Role ID to exclude (for updates)
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>} True if name is unique
 */
TenantRoles.isNameUniqueInTenant = async (
  tenantId,
  name,
  excludeId = null,
  models,
) => {
  const where = { tenantId, name };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }
  const count = await TenantRoles.count({ where });
  return count === 0;
};

module.exports = {
  TenantRoles,
};
