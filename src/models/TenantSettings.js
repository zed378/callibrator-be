/**
 * TenantSettings Model
 *
 * Key-value pairs for tenant-specific configuration settings.
 */

/**
 * Define the TenantSettings model.
 * @param {import("sequelize").Sequelize} db - The Sequelize instance
 * @param {typeof import("sequelize").DataTypes} DataTypes - The Sequelize DataTypes
 * @returns {object} The defined Sequelize model
 */
const defineModel = (db, DataTypes) => {
  const TenantSettings = db.define(
    "TenantSettings",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "tenants", key: "id" },
        onDelete: "CASCADE",
      },
      key: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "tenant_settings",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["tenant_id", "key"],
          unique: true,
        },
      ],
    },
  );

  /**
   * Define associations for this model.
   * @param {object} models - The aggregated models object
   */
  TenantSettings.associate = (models) => {
    // TenantSettings -> Tenant
    TenantSettings.belongsTo(models.Tenant, {
      foreignKey: "tenantId",
      as: "tenant",
    });
  };

  return TenantSettings;
};

module.exports = defineModel;
