const { DataTypes } = require("sequelize");
const { db } = require("../config");

const MenuItem = db.define(
  "MenuItem",
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
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Display name of the menu item",
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Navigation path for this menu item",
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Icon class name (e.g., 'User', 'Settings')",
    },
    requiredPermission: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Required permission string (e.g., 'User:read')",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Order position of the menu item within its group",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether this menu item is active",
    },
  },
  {
    tableName: "menu_items",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    indexes: [
      {
        fields: ["menuGroupId"],
      },
      {
        fields: ["isActive"],
      },
    ],
  },
);

// Associations
MenuItem.associate = (models) => {
  MenuItem.belongsTo(models.MenuGroup, {
    foreignKey: "menuGroupId",
    as: "menuGroup",
  });
};

module.exports = { MenuItem };
