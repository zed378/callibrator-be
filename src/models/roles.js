const { Sequelize, DataTypes } = require('sequelize');

const { db } = require('../config');

const Roles = db.define(
  'roles',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    nameToShow: {
      type: DataTypes.STRING,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment:
        'Role active status - inactive roles cannot be assigned to users',
    },

    roleLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment:
        'Role hierarchy level: 1 = USER, 2 = TENANT_ADMIN, 3 = SUPER_ADMIN',
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    paranoid: true,
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

Roles.associate = (models) => {
  Roles.hasMany(models.Users, {
    foreignKey: 'roleId',
    as: 'users',
  });

  Roles.belongsToMany(models.Permissions, {
    through: models.UserPermissions,
    foreignKey: 'userId', // This is actually roleId in a different context
    otherKey: 'permissionId',
    as: 'permissions',
  });
};

/**
 * Get permissions for a role instance
 */
Roles.getRolePermissions = async (roleId, models) => {
  const role = await Roles.findByPk(roleId, {
    include: [
      {
        model: models.Permissions,
        as: 'permissions',
        through: { attributes: [] },
      },
    ],
  });
  return role?.permissions || [];
};

module.exports = {
  Roles,
};
