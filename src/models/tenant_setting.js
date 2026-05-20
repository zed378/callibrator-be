const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

const TenantSettings = db.define(
  "tenant_settings",
  {
    id: {
      type: DataTypes.UUID,

      defaultValue: Sequelize.UUIDV4,

      primaryKey: true,
    },

    tenantId: {
      type: DataTypes.UUID,

      allowNull: false,
    },

    key: {
      type: DataTypes.STRING,

      allowNull: false,
    },

    value: {
      type: DataTypes.JSONB,
    },
  },
  {
    freezeTableName: true,

    timestamps: true,

    indexes: [
      {
        unique: true,

        fields: ["tenantId", "key"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

TenantSettings.associate = (models) => {
  TenantSettings.belongsTo(models.Tenants, {
    foreignKey: "tenantId",

    as: "tenant",
  });
};

module.exports = {
  TenantSettings,
};
