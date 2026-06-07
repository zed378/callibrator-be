const { DataTypes } = require("sequelize");
const { db } = require("../config");

const MenuGroupRole = db.define(
  "MenuGroupRole",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    menuGroupId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "menu_groups",
        key: "id",
      },
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "roles",
        key: "id",
      },
    },
    assignedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "User ID who made this assignment",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Notes for this assignment",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether this assignment is active",
    },
  },
  {
    tableName: "menu_group_roles",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    indexes: [
      {
        unique: true,
        fields: ["menuGroupId", "roleId"],
      },
      {
        fields: ["roleId"],
      },
      {
        fields: ["isActive"],
      },
    ],
  },
);

// Associations
MenuGroupRole.associate = (models) => {
  MenuGroupRole.belongsTo(models.MenuGroup, {
    foreignKey: "menuGroupId",
    as: "menuGroup",
  });
  MenuGroupRole.belongsTo(models.Roles, {
    foreignKey: "roleId",
    as: "role",
  });
};

module.exports = { MenuGroupRole };
