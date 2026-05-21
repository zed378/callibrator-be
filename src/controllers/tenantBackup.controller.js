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
const { success } = require("../utils/response");

/**
 * Create a new backup for a tenant
 * POST /api/v1/tenants/:tenantId/backups
 */
async function createBackupController(req, res, next) {
  try {
    const { tenantId } = req.params;
    const { name, description, backupType, retentionDays, tag } = req.body;
    const user = req.user;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Backup name is required",
        data: null,
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

    success(
      res,
      result.data,
      null,
      result.message || "Backup created successfully",
      result.status || 201,
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get all backups for a tenant
 * GET /api/v1/tenants/:tenantId/backups
 */
async function getBackupsController(req, res, next) {
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

    const meta = {
      total: result.count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(result.count / parseInt(limit)),
    };

    success(res, result.rows, meta, "Backups retrieved successfully", 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific backup
 * GET /api/v1/tenants/:tenantId/backups/:backupId
 */
async function getBackupController(req, res, next) {
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
        status: 404,
        message: "Backup not found",
        data: null,
      });
    }

    success(res, backup, null, "Backup retrieved successfully", 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Download a backup file
 * GET /api/v1/tenants/:tenantId/backups/:backupId/download
 */
async function downloadBackupController(req, res, next) {
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
    next(error);
  }
}

/**
 * Restore a backup
 * POST /api/v1/tenants/:tenantId/backups/:backupId/restore
 */
async function restoreBackupController(req, res, next) {
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

    success(
      res,
      result.data,
      null,
      result.message || "Backup restored successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a backup
 * DELETE /api/v1/tenants/:tenantId/backups/:backupId
 */
async function deleteBackupController(req, res, next) {
  try {
    const { backupId } = req.params;
    const user = req.user;

    const result = await deleteBackup(backupId, user.id, req.models);

    success(
      res,
      result.data,
      null,
      result.message || "Backup deleted successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get backup statistics
 * GET /api/v1/tenants/:tenantId/backups/stats
 */
async function getBackupStatsController(req, res, next) {
  try {
    const { tenantId } = req.params;

    const stats = await getBackupStats(tenantId, req.models);

    success(res, stats, null, "Backup statistics retrieved successfully", 200);
  } catch (error) {
    next(error);
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
