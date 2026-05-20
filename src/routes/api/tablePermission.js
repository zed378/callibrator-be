/**
 * @swagger
 * tags:
 *   name: TablePermissions
 *   description: Dynamic RBAC/ABAC permission management endpoints
 */
const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { rbac } = require("../../middlewares/rbac");
const { ROLE_NAMES } = require("../../utils/constants");
const controller = require("../../controllers/tablePermission.controller");

/* ------------------------------------------------------------------ */
/* MODELS MANAGEMENT                                                  */
/* ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/table-permissions/models:
 *   get:
 *     summary: Get all models
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Models fetched successfully
 */
router.get("/models", auth, controller.getAllModels);

/**
 * @swagger
 * /api/v1/table-permissions/models:
 *   post:
 *     summary: Create a new model
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modelName, tableName, module]
 *             properties:
 *               modelName: { type: string }
 *               tableName: { type: string }
 *               module: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Model created successfully
 */
router.post("/models", auth, controller.createModel);

/**
 * @swagger
 * /api/v1/table-permissions/models/detail:
 *   post:
 *     summary: Get model detail by ID
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Model fetched successfully
 */
router.post("/models/detail", auth, controller.getModelDetail);

/**
 * @swagger
 * /api/v1/table-permissions/models:
 *   patch:
 *     summary: Update a model
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, format: uuid }
 *               modelName: { type: string }
 *               tableName: { type: string }
 *               module: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Model updated successfully
 */
router.patch("/models", auth, controller.updateModel);

/**
 * @swagger
 * /api/v1/table-permissions/models:
 *   delete:
 *     summary: Delete a model
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Model deleted successfully
 */
router.delete("/models", auth, controller.deleteModel);

/* ------------------------------------------------------------------ */
/* TABLE PERMISSIONS MANAGEMENT                                       */
/* ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/table-permissions/permissions/detail:
 *   post:
 *     summary: Get table permissions for a model
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modelId]
 *             properties:
 *               modelId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Table permissions fetched successfully
 */
router.post("/permissions/detail", auth, controller.getTablePermissions);

/**
 * @swagger
 * /api/v1/table-permissions/permissions/upsert:
 *   post:
 *     summary: Create or update table permissions for a model
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modelId, permissions]
 *             properties:
 *               modelId: { type: string, format: uuid }
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [action]
 *                   properties:
 *                     action: { type: string, enum: [create, read, update, delete, export, import] }
 *                     scope: { type: string, enum: [global, tenant, self, custom], default: global }
 *                     attributes: { type: object }
 *                     abacRules: { type: object }
 *                     description: { type: string }
 *     responses:
 *       200:
 *         description: Table permissions updated successfully
 */
router.post("/permissions/upsert", auth, controller.upsertTablePermissions);

/**
 * @swagger
 * /api/v1/table-permissions/permissions:
 *   patch:
 *     summary: Update a specific table permission
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, format: uuid }
 *               scope: { type: string, enum: [global, tenant, self, custom] }
 *               attributes: { type: object }
 *               abacRules: { type: object }
 *     responses:
 *       200:
 *         description: Table permission updated successfully
 */
router.patch("/permissions", auth, controller.updateTablePermission);

/**
 * @swagger
 * /api/v1/table-permissions/permissions:
 *   delete:
 *     summary: Delete a table permission
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Table permission deleted successfully
 */
router.delete("/permissions", auth, controller.deleteTablePermission);

/* ------------------------------------------------------------------ */
/* ROLE PERMISSIONS MANAGEMENT                                        */
/* ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/table-permissions/role-permissions/grant:
 *   post:
 *     summary: Grant table permission to a global role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId, tablePermissionId]
 *             properties:
 *               roleId: { type: string, format: uuid }
 *               tablePermissionId: { type: string, format: uuid }
 *               expiresAt: { type: string, format: date-time }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Permission granted successfully
 */
router.post("/role-permissions/grant", auth, controller.grantRolePermission);

/**
 * @swagger
 * /api/v1/table-permissions/role-permissions/revoke:
 *   post:
 *     summary: Revoke table permission from a global role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId, tablePermissionId]
 *             properties:
 *               roleId: { type: string, format: uuid }
 *               tablePermissionId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Permission revoked successfully
 */
router.post("/role-permissions/revoke", auth, controller.revokeRolePermission);

/**
 * @swagger
 * /api/v1/table-permissions/role-permissions:
 *   post:
 *     summary: Get all granted permissions for a role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId]
 *             properties:
 *               roleId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role permissions fetched successfully
 */
router.post("/role-permissions", auth, controller.getRolePermissions);

/**
 * @swagger
 * /api/v1/table-permissions/role-permissions/bulk-assign:
 *   post:
 *     summary: Bulk assign permissions to a role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId, tablePermissionIds]
 *             properties:
 *               roleId: { type: string, format: uuid }
 *               tablePermissionIds: { type: array, items: { type: string, format: uuid } }
 *               expiresAt: { type: string, format: date-time }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Permissions assigned successfully
 */
router.post(
  "/role-permissions/bulk-assign",
  auth,
  controller.bulkAssignRolePermissions,
);

/* ------------------------------------------------------------------ */
/* TENANT ROLE PERMISSIONS MANAGEMENT                                 */
/* ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/table-permissions/tenant-role-permissions/grant:
 *   post:
 *     summary: Grant table permission to a tenant role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantRoleId, tablePermissionId]
 *             properties:
 *               tenantRoleId: { type: string, format: uuid }
 *               tablePermissionId: { type: string, format: uuid }
 *               expiresAt: { type: string, format: date-time }
 *               abacRules: { type: object }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Permission granted to tenant role successfully
 */
router.post(
  "/tenant-role-permissions/grant",
  auth,
  controller.grantTenantRolePermission,
);

/**
 * @swagger
 * /api/v1/table-permissions/tenant-role-permissions/revoke:
 *   post:
 *     summary: Revoke table permission from a tenant role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantRoleId, tablePermissionId]
 *             properties:
 *               tenantRoleId: { type: string, format: uuid }
 *               tablePermissionId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Permission revoked from tenant role successfully
 */
router.post(
  "/tenant-role-permissions/revoke",
  auth,
  controller.revokeTenantRolePermission,
);

/**
 * @swagger
 * /api/v1/table-permissions/tenant-role-permissions:
 *   post:
 *     summary: Get all granted permissions for a tenant role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantRoleId]
 *             properties:
 *               tenantRoleId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Tenant role permissions fetched successfully
 */
router.post(
  "/tenant-role-permissions",
  auth,
  controller.getTenantRolePermissions,
);

/**
 * @swagger
 * /api/v1/table-permissions/tenant-role-permissions/abac-rules:
 *   patch:
 *     summary: Update ABAC rules for a tenant role permission
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantRoleId, tablePermissionId, abacRules]
 *             properties:
 *               tenantRoleId: { type: string, format: uuid }
 *               tablePermissionId: { type: string, format: uuid }
 *               abacRules:
 *                 type: object
 *                 properties:
 *                   condition: { type: string, enum: [owner, attribute, custom, tenant] }
 *                   fields: { type: array, items: { type: string } }
 *                   operator: { type: string }
 *                   value: {}
 *     responses:
 *       200:
 *         description: ABAC rules updated successfully
 */
router.patch(
  "/tenant-role-permissions/abac-rules",
  auth,
  controller.updateTenantRoleAbacRules,
);

/**
 * @swagger
 * /api/v1/table-permissions/tenant-role-permissions/bulk-assign:
 *   post:
 *     summary: Bulk assign permissions to a tenant role
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantRoleId, tablePermissionIds]
 *             properties:
 *               tenantRoleId: { type: string, format: uuid }
 *               tablePermissionIds: { type: array, items: { type: string, format: uuid } }
 *               expiresAt: { type: string, format: date-time }
 *               abacRules: { type: object }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Permissions assigned to tenant role successfully
 */
router.post(
  "/tenant-role-permissions/bulk-assign",
  auth,
  controller.bulkAssignTenantRolePermissions,
);

/* ------------------------------------------------------------------ */
/* PERMISSION CHECKING                                                */
/* ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/table-permissions/check:
 *   post:
 *     summary: Check if user has permission for a model/action
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modelName, action]
 *             properties:
 *               modelName: { type: string }
 *               action: { type: string, enum: [create, read, update, delete, export, import] }
 *               userId: { type: string, format: uuid }
 *               tenantId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Permission check completed
 */
router.post("/check", auth, controller.checkPermission);

/**
 * @swagger
 * /api/v1/table-permissions/allowed-attributes:
 *   post:
 *     summary: Get allowed attributes for a user on a model
 *     tags: [TablePermissions]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [modelName, action]
 *             properties:
 *               modelName: { type: string }
 *               action: { type: string, enum: [create, read, update, delete, export, import] }
 *     responses:
 *       200:
 *         description: Allowed attributes fetched successfully
 */
router.post("/allowed-attributes", auth, controller.getAllowedAttributes);

module.exports = router;
