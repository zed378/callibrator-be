// ==========================================
// TenantBackup - Backup Management Model
// ==========================================
// Kept as-is. Tracks tenant database backup operations and schedules.
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TenantBackup = sequelize.define(
    "TenantBackup",
    {
      id: {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      // Backup details
      backupPath: { type: DataTypes.STRING },
      size: { type: DataTypes.BIGINT },
      status: {
        type: DataTypes.ENUM,
        values: ["pending", "in_progress", "completed", "failed", "deleted"],
        defaultValue: "pending",
      },
      // Schedule (for recurring backups)
      cronExpression: { type: DataTypes.STRING },
      retentionDays: { type: DataTypes.INTEGER, defaultValue: 30 },
      // Audit
      createdBy: { type: DataTypes.STRING },
      deletedBy: { type: DataTypes.STRING },
    },
    {
      timestamps: true,
      tableName: "tenant_backups",
      paranoid: true,
      indexes: [
        { fields: ["tenantId"] },
        { fields: ["status"] },
        { fields: ["createdAt"] },
      ],
    },
  );

  TenantBackup.associate = (models) => {
    TenantBackup.belongsTo(models.Tenant, {
      foreignKey: "tenantId",
      as: "tenant",
    });
  };

  return TenantBackup;
};
