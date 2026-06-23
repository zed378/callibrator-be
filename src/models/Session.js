/**
 * Session Model
 *
 * Persistent authentication session records stored in PostgreSQL.
 * Used for session management, logout, and audit purposes.
 */

/**
 * Define the Session model.
 * @param {import("sequelize").Sequelize} db - The Sequelize instance
 * @param {typeof import("sequelize").DataTypes} DataTypes - The Sequelize DataTypes
 * @returns {object} The defined Sequelize model
 */
const defineModel = (db, DataTypes) => {
  const Session = db.define(
    "Session",
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
      tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "tenants", key: "id" },
        onDelete: "CASCADE",
      },
      tokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      device: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      expiredAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      lastActivityAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      isRevoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedReason: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "sessions",
      timestamps: true,
      underscored: false,
      indexes: [
        { fields: ["tokenHash"], unique: true },
        { fields: ["userId"] },
        { fields: ["tenantId"] },
        { fields: ["expiredAt"] },
        { fields: ["isRevoked", "isActive"] },
        { fields: ["isDeleted"] },
      ],
      defaultScope: {
        where: { isDeleted: false },
      },
      scopes: {
        includeDeleted: {
          where: null,
        },
      },
    },
  );

  /**
   * Soft-delete a session. Sets is_deleted = true, records deleted_at timestamp,
   * and persists. Also revokes the session (sets is_revoked = true).
   */
  Session.prototype.softDelete = async function () {
    this.is_deleted = true;
    this.deleted_at = new Date();
    this.is_revoked = true;
    return this.save({ hooks: false });
  };

  /**
   * Restore a soft-deleted session by ID. Sets is_deleted = false and nulls deleted_at.
   */
  Session.restoreStatic = async function (id) {
    return this.update(
      { is_deleted: false, deleted_at: null },
      { where: { id, is_deleted: true } },
    );
  };

  /**
   * Define associations for this model.
   * @param {object} models - The aggregated models object
   */
  Session.associate = (models) => {
    // Session -> User
    Session.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
    });
    // Session -> Tenant
    Session.belongsTo(models.Tenant, {
      foreignKey: "tenantId",
      as: "tenant",
    });
  };

  return Session;
};

module.exports = defineModel;
