const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

const Permissions = db.define(
  "permissions",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    module: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

Permissions.associate = (models) => {
  Permissions.belongsToMany(models.Users, {
    through: models.UserPermissions,
    foreignKey: "permissionId",
    otherKey: "userId",
    as: "users",
  });
};

module.exports = {
  Permissions,
};
