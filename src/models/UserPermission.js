/**
 * UserPermission Model
 *
 * Maps permissions to users (many-to-many).
 * Allows granting specific permissions to individual users beyond their role.
 */

/**
 * Define the UserPermission model.
 * @param {import("sequelize").Sequelize} db - The Sequelize instance
 * @param {typeof import("sequelize").DataTypes} DataTypes - The Sequelize DataTypes
 * @returns {object} The defined Sequelize model
 */
const defineModel = (db, DataTypes) => {
  const UserPermission = db.define(
    "UserPermission",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      permissionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "permissions", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "user_permissions",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["user_id", "permission_id"],
          unique: true,
        },
        { fields: ["user_id"] },
        { fields: ["permission_id"] },
      ],
    },
  );

  /**
   * Define associations for this model.
   * @param {object} models - The aggregated models object
   */
  UserPermission.associate = (models) => {
    // UserPermission -> User
    UserPermission.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    // UserPermission -> Permission
    UserPermission.belongsTo(models.Permission, {
      foreignKey: "permissionId",
      as: "permission",
    });
  };

  return UserPermission;
};

module.exports = defineModel;
