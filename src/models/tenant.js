const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

const Tenants = db.define(
  "tenants",
  {
    id: {
      type: DataTypes.UUID,

      defaultValue: Sequelize.UUIDV4,

      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,

      allowNull: false,
    },

    code: {
      type: DataTypes.STRING,

      unique: true,

      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
    },

    logo: {
      type: DataTypes.STRING,

      defaultValue: "default.svg",
    },

    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE", "SUSPENDED"),

      defaultValue: "ACTIVE",
    },

    maxUsers: {
      type: DataTypes.INTEGER,

      defaultValue: 10,
    },

    // Basic contact information
    email: {
      type: DataTypes.STRING,
      validate: { isEmail: true },
    },

    phone: {
      type: DataTypes.STRING,
    },

    address: {
      type: DataTypes.TEXT,
    },

    city: {
      type: DataTypes.STRING,
    },

    state: {
      type: DataTypes.STRING,
    },

    zipCode: {
      type: DataTypes.STRING,
    },

    country: {
      type: DataTypes.STRING,
    },

    website: {
      type: DataTypes.STRING,
      validate: { isUrl: true },
    },

    createdBy: {
      type: DataTypes.UUID,
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

Tenants.associate = (models) => {
  Tenants.hasMany(models.Users, {
    foreignKey: "tenantId",

    as: "users",
  });

  Tenants.hasMany(models.TenantSettings, {
    foreignKey: "tenantId",

    as: "settings",
  });
};

module.exports = {
  Tenants,
};
