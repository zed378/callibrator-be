const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

const Sessions = db.define(
  "sessions",
  {
    id: {
      type: DataTypes.UUID,

      defaultValue: Sequelize.UUIDV4,

      primaryKey: true,
    },

    tenantId: {
      type: DataTypes.UUID,

      allowNull: true,
    },

    userId: {
      type: DataTypes.UUID,

      allowNull: false,
    },

    tokenHash: {
      type: DataTypes.TEXT,

      unique: true,

      allowNull: false,
    },

    ipAddress: {
      type: DataTypes.STRING,
    },

    userAgent: {
      type: DataTypes.TEXT,
    },

    device: {
      type: DataTypes.TEXT,
    },

    isRevoked: {
      type: DataTypes.BOOLEAN,

      defaultValue: false,
    },

    revokedAt: {
      type: DataTypes.DATE,
    },

    expiredAt: {
      type: DataTypes.DATE,

      allowNull: false,

      defaultValue: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },

    revokedReason: {
      type: DataTypes.TEXT,
    },

    lastActivityAt: {
      type: DataTypes.DATE,

      defaultValue: Sequelize.NOW,
    },

    isActive: {
      type: DataTypes.BOOLEAN,

      defaultValue: true,
    },
  },
  {
    freezeTableName: true,

    timestamps: true,

    indexes: [
      {
        unique: true,

        fields: ["tokenHash"],
      },

      {
        fields: ["userId"],
      },

      {
        fields: ["tenantId"],
      },

      {
        fields: ["expiredAt"],
      },

      {
        fields: ["isRevoked"],
      },

      {
        fields: ["userId", "isRevoked"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

Sessions.associate = (models) => {
  Sessions.belongsTo(models.Users, {
    foreignKey: "userId",

    as: "user",

    onDelete: "CASCADE",

    onUpdate: "CASCADE",
  });

  Sessions.belongsTo(models.Tenants, {
    foreignKey: "tenantId",

    as: "tenant",

    onDelete: "CASCADE",

    onUpdate: "CASCADE",
  });
};

module.exports = {
  Sessions,
};
