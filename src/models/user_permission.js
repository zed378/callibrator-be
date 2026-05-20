const { Sequelize, DataTypes } = require("sequelize");
const { db } = require("../config");

const UserPermissions = db.define(
  "user_permissions",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    grantedBy: {
      type: DataTypes.UUID,
      field: "granted_by",
    },
    expiresAt: {
      type: DataTypes.DATE,
      field: "expires_at",
    },
  },
  {
    tableName: "user_permissions",
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "permissionId"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================
UserPermissions.associate = (models) => {
  UserPermissions.belongsTo(models.Users, {
    foreignKey: "userId",
    as: "user",
  });
  UserPermissions.belongsTo(models.Permissions, {
    foreignKey: "permissionId",
    as: "permission",
    attributes: ["id", "name", "module", "action", "description"],
  });
};

module.exports = {
  UserPermissions,
};
