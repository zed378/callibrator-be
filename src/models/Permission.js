/**
 * Permission Model
 *
 * Defines granular permissions (module:action format).
 * Used for role-based permission seeding and user-specific permissions.
 */

/**
 * Define the Permission model.
 * @param {import("sequelize").Sequelize} db - The Sequelize instance
 * @param {typeof import("sequelize").DataTypes} DataTypes - The Sequelize DataTypes
 * @returns {object} The defined Sequelize model
 */
const defineModel = (db, DataTypes) => {
  const Permission = db.define(
    "Permission",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      module: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "permissions",
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ["name"] }, { fields: ["module"] }],
    },
  );

  /**
   * Define associations for this model.
   * @param {object} models - The aggregated models object
   */
  Permission.associate = (models) => {
    // Permission -> UserPermission (hasMany)
    Permission.hasMany(models.UserPermission, {
      foreignKey: "permissionId",
      as: "userPermissions",
    });
  };

  return Permission;
};

module.exports = defineModel;
