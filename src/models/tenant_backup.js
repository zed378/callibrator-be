const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

/**
 * TenantBackup Model
 *
 * Manages backup and restore operations for tenant data.
 * Each backup contains a snapshot of tenant configuration,
 * settings, roles, and optionally user data.
 *
 * Backup types:
 * - FULL: Complete backup of all tenant data
 * - PARTIAL: Backup of configuration and settings only
 * - USER_ONLY: Backup of users and roles only
 */
const TenantBackup = db.define(
  "tenant_backups",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },

    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "tenants",
        key: "id",
      },
    },

    /**
     * Who created this backup
     */
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    /**
     * Backup name for identification
     */
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [1, 255],
      },
    },

    /**
     * Optional description of the backup
     */
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /**
     * Backup type: FULL, PARTIAL, USER_ONLY
     */
    backupType: {
      type: DataTypes.ENUM("FULL", "PARTIAL", "USER_ONLY"),
      defaultValue: "FULL",
    },

    /**
     * Backup status: PENDING, IN_PROGRESS, COMPLETED, FAILED, RESTORING, RESTORED, DELETING
     */
    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "IN_PROGRESS",
        "COMPLETED",
        "FAILED",
        "RESTORING",
        "RESTORED",
        "DELETING",
      ),
      defaultValue: "PENDING",
    },

    /**
     * Path to the backup file in storage
     */
    filePath: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },

    /**
     * File size in bytes
     */
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    /**
     * Number of records included in the backup
     */
    recordCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    /**
     * Backup metadata as JSON
     * Includes: version, tables backed up, checksum, etc.
     */
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },

    /**
     * Error message if backup/restore failed
     */
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /**
     * Whether this backup is encrypted
     */
    isEncrypted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    /**
     * Retention period in days
     */
    retentionDays: {
      type: DataTypes.INTEGER,
      defaultValue: 90,
      validate: {
        min: 1,
        max: 3650,
      },
    },

    /**
     * When this backup should be automatically deleted
     */
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    /**
     * Tag for easy grouping (e.g., "pre-migration", "quarterly")
     */
    tag: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [1, 50],
      },
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ["tenantId", "status"],
      },
      {
        fields: ["tenantId", "createdAt"],
      },
      {
        fields: ["tenantId", "tag"],
      },
      {
        fields: ["expiresAt"],
      },
      {
        fields: ["createdById"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

TenantBackup.associate = (models) => {
  TenantBackup.belongsTo(models.Tenants, {
    foreignKey: "tenantId",
    as: "tenant",
  });

  TenantBackup.belongsTo(models.Users, {
    foreignKey: "createdById",
    as: "creator",
  });
};

/**
 * Backup status constants
 */
TenantBackup.STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  RESTORING: "RESTORING",
  RESTORED: "RESTORED",
  DELETING: "DELETING",
};

/**
 * Backup type constants
 */
TenantBackup.BACKUP_TYPES = {
  FULL: "FULL",
  PARTIAL: "PARTIAL",
  USER_ONLY: "USER_ONLY",
};

/**
 * Default retention period (90 days)
 */
TenantBackup.DEFAULT_RETENTION_DAYS = 90;

/**
 * Maximum retention period (10 years)
 */
TenantBackup.MAX_RETENTION_DAYS = 3650;

/**
 * Create a new backup record
 *
 * @param {Object} params - Backup parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.createdById - User UUID who created the backup
 * @param {string} params.name - Backup name
 * @param {string} [params.description] - Backup description
 * @param {string} [params.backupType] - Backup type
 * @param {number} [params.retentionDays] - Retention days
 * @param {string} [params.tag] - Backup tag
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Created backup record
 */
TenantBackup.createBackup = async (
  {
    tenantId,
    createdById,
    name,
    description,
    backupType = TenantBackup.BACKUP_TYPES.FULL,
    retentionDays = TenantBackup.DEFAULT_RETENTION_DAYS,
    tag,
  },
  models,
) => {
  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  return TenantBackup.create({
    tenantId,
    createdById,
    name,
    description,
    backupType,
    status: TenantBackup.STATUS.PENDING,
    retentionDays,
    expiresAt,
    tag,
  });
};

/**
 * Update backup status
 *
 * @param {string} backupId - Backup UUID
 * @param {Object} updates - Status updates
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Updated backup
 */
TenantBackup.updateStatus = async (backupId, updates, models) => {
  const backup = await TenantBackup.findByPk(backupId);
  if (!backup) {
    throw new Error("Backup not found");
  }

  return backup.update(updates);
};

/**
 * Get backups for a tenant with filtering
 *
 * @param {Object} params - Filter parameters
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} [params.status] - Filter by status
 * @param {string} [params.backupType] - Filter by type
 * @param {string} [params.tag] - Filter by tag
 * @param {number} [params.limit] - Max results
 * @param {number} [params.offset] - Pagination offset
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} { rows, count }
 */
TenantBackup.getTenantBackups = async (
  { tenantId, status, backupType, tag, limit = 20, offset = 0 },
  models,
) => {
  const where = { tenantId };

  if (status) where.status = status;
  if (backupType) where.backupType = backupType;
  if (tag) where.tag = tag;

  return TenantBackup.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      {
        model: models.Users,
        as: "creator",
        attributes: ["id", "username", "email"],
      },
    ],
  });
};

/**
 * Get the latest successful backup for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object|null>} Latest backup or null
 */
TenantBackup.getLatestBackup = async (tenantId, models) => {
  return TenantBackup.findOne({
    where: {
      tenantId,
      status: TenantBackup.STATUS.COMPLETED,
      expiresAt: {
        [Sequelize.Op.gte]: new Date(),
      },
    },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: models.Users,
        as: "creator",
        attributes: ["id", "username", "email"],
      },
    ],
  });
};

/**
 * Clean up expired backups
 *
 * @param {string} tenantId - Tenant UUID (optional, for all tenants)
 * @param {Object} models - Sequelize models
 * @returns {Promise<number>} Number of deleted backups
 */
TenantBackup.cleanupExpired = async (tenantId, models) => {
  const where = {
    expiresAt: {
      [Sequelize.Op.lt]: new Date(),
    },
  };

  if (tenantId) {
    where.tenantId = tenantId;
  }

  const { count } = await TenantBackup.findAndCountAll({
    where,
    limit: 1000,
  });

  await TenantBackup.destroy({
    where,
  });

  return count;
};

/**
 * Check if a tenant has any valid backups
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>} True if tenant has valid backups
 */
TenantBackup.hasValidBackups = async (tenantId, models) => {
  const count = await TenantBackup.count({
    where: {
      tenantId,
      status: TenantBackup.STATUS.COMPLETED,
      expiresAt: {
        [Sequelize.Op.gte]: new Date(),
      },
    },
  });

  return count > 0;
};

module.exports = {
  TenantBackup,
};
