const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

const LoginLogs = db.define(
  "login_logs",
  {
    id: {
      type: DataTypes.UUID,

      defaultValue: Sequelize.UUIDV4,

      primaryKey: true,
    },

    tenantId: {
      type: DataTypes.UUID,
    },

    userId: {
      type: DataTypes.UUID,
    },

    email: {
      type: DataTypes.STRING,
    },

    ipAddress: {
      type: DataTypes.STRING,
    },

    userAgent: {
      type: DataTypes.TEXT,
    },

    device: {
      type: DataTypes.STRING,
    },

    status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED", "LOCKED", "REVOKED"),

      allowNull: false,
    },

    reason: {
      type: DataTypes.STRING,
    },

    loggedAt: {
      type: DataTypes.DATE,

      defaultValue: Sequelize.NOW,
    },
  },
  {
    freezeTableName: true,

    timestamps: true,

    indexes: [
      {
        fields: ["userId"],
      },

      {
        fields: ["tenantId"],
      },

      {
        fields: ["status"],
      },

      {
        fields: ["loggedAt"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

LoginLogs.associate = (models) => {
  LoginLogs.belongsTo(models.Users, {
    foreignKey: "userId",

    as: "user",
  });

  LoginLogs.belongsTo(models.Tenants, {
    foreignKey: "tenantId",

    as: "tenant",
  });
};

module.exports = {
  LoginLogs,
};
