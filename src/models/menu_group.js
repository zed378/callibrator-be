const { DataTypes } = require("sequelize");
const { db } = require("../config");

const MenuGroup = db.define(
  "MenuGroup",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Display name of the menu group",
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Icon class name (e.g., 'LayoutGrid', 'Users')",
    },
    path: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Optional direct path for the group (if it links to a page)",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Order position of the menu group",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether this menu group is active",
    },
  },
  {
    tableName: "menu_groups",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    indexes: [
      {
        fields: ["sortOrder"],
      },
      {
        fields: ["isActive"],
      },
    ],
  },
);

// Associations
MenuGroup.associate = (models) => {
  MenuGroup.hasMany(models.MenuItem, {
    foreignKey: "menuGroupId",
    as: "items",
    onDelete: "CASCADE",
  });
};

module.exports = { MenuGroup };
