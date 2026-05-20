/**
 * @swagger
 * tags:
 *   name: Tenant Backups
 *   description: Endpoints for managing tenant backups and restores
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { rbac } = require("../../middlewares/rbac");
const { abac } = require("../../middlewares/abac");
const { TENANT_PERMISSIONS, ROLE_NAMES } = require("../../utils/constants");
const {
  createBackupController,
  getBackupsController,
  getBackupController,
  downloadBackupController,
  restoreBackupController,
  deleteBackupController,
  getBackupStatsController,
} = require("../../controllers/tenantBackup.controller");

/* ------------------------------------------------------------------ */
/* CREATE BACKUP                                                      */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/backups:
 *   post:
 *     summary: Create a backup for a tenant
 *     description: Requires SUPER_ADMIN or TENANT_ADMIN role with tenant:update permission. Creates a ZIP file containing tenant data (settings, roles, features, users, permissions).
 *     tags:
 *       - Tenant Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Pre-migration backup"
 *               description:
 *                 type: string
 *                 example: "Backup before system migration"
 *               backupType:
 *                 type: string
 *                 enum: [FULL, PARTIAL, USER_ONLY]
 *                 default: FULL
 *                 example: FULL
 *               retentionDays:
 *                 type: integer
 *                 default: 90
 *                 example: 180
 *               tag:
 *                 type: string
 *                 example: "pre-migration"
 *     responses:
 *       '201':
 *         description: Backup created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Tenant not found
 */
router.post(
  "/:tenantId/backups",
  auth,
  rbac([ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.TENANT_ADMIN], {
    allowHigher: true,
  }),
  abac([TENANT_PERMISSIONS.UPDATE], { checkTenant: true }),
  createBackupController,
);

/* ------------------------------------------------------------------ */
/* GET ALL BACKUPS                                                    */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/backups:
 *   get:
 *     summary: Get all backups for a tenant
 *     description: Requires SUPER_ADMIN or TENANT_ADMIN role with tenant:read permission. Returns paginated list of backups with status, size, and metadata.
 *     tags:
 *       - Tenant Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_PROGRESS, COMPLETED, FAILED, RESTORING, RESTORED, DELETING]
 *       - in: query
 *         name: backupType
 *         schema:
 *           type: string
 *           enum: [FULL, PARTIAL, USER_ONLY]
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       '200':
 *         description: Backups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 meta:
 *                   type: object
 *       '403':
 *         description: Forbidden
 */
router.get(
  "/:tenantId/backups",
  auth,
  rbac([ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.TENANT_ADMIN], {
    allowHigher: true,
  }),
  abac([TENANT_PERMISSIONS.READ], { checkTenant: true }),
  getBackupsController,
);

/* ------------------------------------------------------------------ */
/* GET SPECIFIC BACKUP                                                */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/backups/{backupId}:
 *   get:
 *     summary: Get details of a specific backup
 *     description: Requires SUPER_ADMIN or TENANT_ADMIN role with tenant:read permission. Returns detailed information about a specific backup including creator, size, and metadata.
 *     tags:
 *       - Tenant Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Backup details retrieved successfully
 *       '404':
 *         description: Backup not found
 *       '403':
 *         description: Forbidden
 */
router.get(
  "/:tenantId/backups/:backupId",
  auth,
  rbac([ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.TENANT_ADMIN], {
    allowHigher: true,
  }),
  abac([TENANT_PERMISSIONS.READ], { checkTenant: true }),
  getBackupController,
);

/* ------------------------------------------------------------------ */
/* DOWNLOAD BACKUP                                                    */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/backups/{backupId}/download:
 *   get:
 *     summary: Download a backup file
 *     description: Requires SUPER_ADMIN or TENANT_ADMIN role with tenant:read permission. Downloads the ZIP file containing the backup data.
 *     tags:
 *       - Tenant Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Backup file downloaded successfully
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       '400':
 *         description: Backup is not ready for download
 *       '404':
 *         description: Backup not found or file missing
 *       '403':
 *         description: Forbidden
 */
router.get(
  "/:tenantId/backups/:backupId/download",
  auth,
  rbac([ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.TENANT_ADMIN], {
    allowHigher: true,
  }),
  abac([TENANT_PERMISSIONS.READ], { checkTenant: true }),
  downloadBackupController,
);

/* ------------------------------------------------------------------ */
/* RESTORE BACKUP                                                     */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/backups/{backupId}/restore:
 *   post:
 *     summary: Restore a backup for a tenant
 *     description: Requires SUPER_ADMIN or TENANT_ADMIN role with tenant:update permission. Restores tenant data from a backup. Can optionally merge with existing data.
 *     tags:
 *       - Tenant Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mergeData:
 *                 type: boolean
 *                 default: false
 *                 description: Whether to merge with existing data instead of replacing
 *     responses:
 *       '200':
 *         description: Backup restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       '400':
 *         description: Backup is not ready for restore
 *       '404':
 *         description: Backup not found
 *       '403':
 *         description: Forbidden
 */
router.post(
  "/:tenantId/backups/:backupId/restore",
  auth,
  rbac([ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.TENANT_ADMIN], {
    allowHigher: true,
  }),
  abac([TENANT_PERMISSIONS.UPDATE], { checkTenant: true }),
  restoreBackupController,
);

/* ------------------------------------------------------------------ */
/* DELETE BACKUP                                                      */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/backups/{backupId}:
 *   delete:
 *     summary: Delete a backup
 *     description: Requires SUPER_ADMIN or TENANT_ADMIN role with tenant:delete permission. Deletes the backup file and record.
 *     tags:
 *       - Tenant Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Backup deleted successfully
 *       '404':
 *         description: Backup not found
 *       '403':
 *         description: Forbidden
 */
router.delete(
  "/:tenantId/backups/:backupId",
  auth,
  rbac([ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.TENANT_ADMIN], {
    allowHigher: true,
  }),
  abac([TENANT_PERMISSIONS.DELETE], { checkTenant: true }),
  deleteBackupController,
);

/* ------------------------------------------------------------------ */
/* GET BACKUP STATISTICS                                              */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/backups/stats:
 *   get:
 *     summary: Get backup statistics for a tenant
 *     description: Requires SUPER_ADMIN or TENANT_ADMIN role with tenant:read permission. Returns statistics including total backups, completed, failed, total size, and latest backup.
 *     tags:
 *       - Tenant Backups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Backup statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBackups:
 *                       type: integer
 *                     completedBackups:
 *                       type: integer
 *                     failedBackups:
 *                       type: integer
 *                     totalSize:
 *                       type: integer
 *                     latestBackup:
 *                       type: object
 *                     hasValidBackups:
 *                       type: boolean
 *       '403':
 *         description: Forbidden
 */
router.get(
  "/:tenantId/backups/stats",
  auth,
  rbac([ROLE_NAMES.SUPER_ADMIN, ROLE_NAMES.TENANT_ADMIN], {
    allowHigher: true,
  }),
  abac([TENANT_PERMISSIONS.READ], { checkTenant: true }),
  getBackupStatsController,
);

module.exports = router;
