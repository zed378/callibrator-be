const fs = require("fs");
const {
  createBackup,
  downloadBackup,
  restoreBackup,
  deleteBackup,
  getBackupStats,
} = require("../services/tenantBackup.service");
const { AppError } = require("../utils/appError");
const { TenantBackup, Users, Tenants } = require("../models");

/**
 * Create a new backup for a tenant
 * POST /api/v1/tenants/:tenantId/backups
 */
async function createBackupController(req, res) {
  try {
    const { tenantId } = req.params;
    const { name, description, backupType, retentionDays, tag } = req.body;
    const user = req.user;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Backup name is required",
      });
    }

    const result = await createBackup({
      tenantId,
      createdById: user.id,
      name,
      description,
      backupType,
      retentionDays,
      tag,
      models: req.models,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("createBackupController error:", error);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create backup",
    });
  }
}

/**
 * Get all backups for a tenant
 * GET /api/v1/tenants/:tenantId/backups
 */
async function getBackupsController(req, res) {
  try {
    const { tenantId } = req.params;
    const { status, backupType, tag, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await TenantBackup.getTenantBackups(
      {
        tenantId,
        status,
        backupType,
        tag,
        limit: parseInt(limit),
        offset,
      },
      req.models,
    );

    return res.status(200).json({
      success: true,
      message: "Backups retrieved successfully",
      data: result.rows,
      meta: {
        total: result.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getBackupsController error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve backups",
    });
  }
}

/**
 * Get a specific backup
 * GET /api/v1/tenants/:tenantId/backups/:backupId
 */
async function getBackupController(req, res) {
  try {
    const { backupId } = req.params;

    const backup = await TenantBackup.findByPk(backupId, {
      include: [
        {
          model: Users,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
        {
          model: Tenants,
          as: "tenant",
        },
      ],
    });

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: "Backup not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Backup retrieved successfully",
      data: backup,
    });
  } catch (error) {
    console.error("getBackupController error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve backup",
    });
  }
}

/**
 * Download a backup file
 * GET /api/v1/tenants/:tenantId/backups/:backupId/download
 */
async function downloadBackupController(req, res) {
  try {
    const { backupId } = req.params;

    const result = await downloadBackup(backupId, req.models);

    // Set headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.metadata.filename}"`,
    );
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Length",
      result.metadata.fileSize || fs.statSync(result.filePath).size,
    );

    return res.download(result.filePath);
  } catch (error) {
    console.error("downloadBackupController error:", error);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to download backup",
    });
  }
}

/**
 * Restore a backup
 * POST /api/v1/tenants/:tenantId/backups/:backupId/restore
 */
async function restoreBackupController(req, res) {
  try {
    const { backupId } = req.params;
    const { mergeData = false } = req.body;
    const user = req.user;

    const result = await restoreBackup({
      backupId,
      restoredById: user.id,
      mergeData: mergeData === true || mergeData === "true",
      models: req.models,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("restoreBackupController error:", error);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to restore backup",
    });
  }
}

/**
 * Delete a backup
 * DELETE /api/v1/tenants/:tenantId/backups/:backupId
 */
async function deleteBackupController(req, res) {
  try {
    const { backupId } = req.params;
    const user = req.user;

    const result = await deleteBackup(backupId, user.id, req.models);

    return res.status(200).json(result);
  } catch (error) {
    console.error("deleteBackupController error:", error);

    if (error instanceof AppError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete backup",
    });
  }
}

/**
 * Get backup statistics
 * GET /api/v1/tenants/:tenantId/backups/stats
 */
async function getBackupStatsController(req, res) {
  try {
    const { tenantId } = req.params;

    const stats = await getBackupStats(tenantId, req.models);

    return res.status(200).json({
      success: true,
      message: "Backup statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("getBackupStatsController error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve backup statistics",
    });
  }
}

module.exports = {
  createBackupController,
  getBackupsController,
  getBackupController,
  downloadBackupController,
  restoreBackupController,
  deleteBackupController,
  getBackupStatsController,
};
