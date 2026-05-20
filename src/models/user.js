const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

const Users = db.define(
  "users",
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
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
    },
    lastName: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    picture: {
      type: DataTypes.STRING,
      defaultValue: "default.svg",
    },
    roleId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Global role (for super admins)",
    },
    tenantRoleId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Tenant-specific role",
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isBanned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    otpCode: {
      type: DataTypes.TEXT,
    },
    otpExpiredAt: {
      type: DataTypes.DATE,
    },
    otpRequestCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    otpLastRequestedAt: {
      type: DataTypes.DATE,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
    },
    lastLoginIp: {
      type: DataTypes.STRING,
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lockedUntil: {
      type: DataTypes.DATE,
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE", "SUSPENDED"),
      defaultValue: "INACTIVE",
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

Users.associate = (models) => {
  Users.belongsTo(models.Roles, {
    foreignKey: "roleId",
    as: "role",
  });

  Users.belongsTo(models.TenantRoles, {
    foreignKey: "tenantRoleId",
    as: "tenantRole",
  });

  Users.belongsTo(models.Tenants, {
    foreignKey: "tenantId",
    as: "tenant",
  });

  Users.belongsToMany(models.Permissions, {
    through: models.UserPermissions,
    foreignKey: "userId",
    otherKey: "permissionId",
    as: "permissions",
  });
};

module.exports = {
  Users,
};
