/**
 * @swagger
 * tags:
 *   name: Tenants
 *   description: Endpoints for managing tenants and organizations
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
const { dynamicAccess } = require("../../middlewares/dynamicAccess");
const tenantController = require("../../controllers/tenant.controller");

/* ------------------------------------------------------------------ */
/* GET ALL TENANTS                                                    */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/all:
 *   get:
 *     summary: Retrieve a paginated list of tenants
 *     description: Requires read access to Tenant model with tenant scope. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: find
 *         required: false
 *         description: Free-text search by name, code, or description
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 25
 *     responses:
 *       '200':
 *         description: Successful retrieval of tenants
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.get(
  "/all",
  auth,
  dynamicAccess("Tenant", "read", { checkTenant: true }),
  tenantController.getAllTenants,
);

/* ------------------------------------------------------------------ */
/* GET SPECIFIC TENANT                                                */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/detail:
 *   post:
 *     summary: Fetch details of a specific tenant by ID
 *     description: Requires read access to Tenant model. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       '200':
 *         description: Tenant details retrieved successfully
 *       '404':
 *         description: Tenant not found
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.post(
  "/detail",
  auth,
  dynamicAccess("Tenant", "read", { checkTenant: true }),
  tenantController.getSpecificTenant,
);

/* ------------------------------------------------------------------ */
/* CREATE TENANT                                                      */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/create:
 *   post:
 *     summary: Create a new tenant
 *     description: Requires create access to Tenant model with tenant scope. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Acme Corporation"
 *               code:
 *                 type: string
 *                 example: "acme-corp"
 *               description:
 *                 type: string
 *                 example: "Acme Corporation - Global Enterprise"
 *               logo:
 *                 type: string
 *                 example: "acme-logo.png"
 *               maxUsers:
 *                 type: integer
 *                 example: 50
 *     responses:
 *       '201':
 *         description: Tenant created successfully
 *       '409':
 *         description: Conflict (name or code already exists)
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.post(
  "/create",
  auth,
  dynamicAccess("Tenant", "create", { checkTenant: true }),
  tenantController.createTenant,
);

/* ------------------------------------------------------------------ */
/* UPDATE TENANT                                                      */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/edit:
 *   patch:
 *     summary: Update an existing tenant's details
 *     description: Requires update access to Tenant model. Self-check enabled. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 example: "Acme Corporation Updated"
 *               code:
 *                 type: string
 *                 example: "acme-corp-updated"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               logo:
 *                 type: string
 *                 example: "acme-logo-updated.png"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED]
 *                 example: "ACTIVE"
 *               maxUsers:
 *                 type: integer
 *                 example: 100
 *     responses:
 *       '200':
 *         description: Tenant updated successfully
 *       '404':
 *         description: Tenant not found
 *       '409':
 *         description: Conflict (name or code already exists)
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.patch(
  "/edit",
  auth,
  dynamicAccess("Tenant", "update", { checkSelf: true, checkTenant: true }),
  tenantController.updateTenant,
);

/* ------------------------------------------------------------------ */
/* DELETE TENANT                                                      */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/delete:
 *   delete:
 *     summary: Delete a tenant
 *     description: Requires delete access to Tenant model with tenant scope. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       '200':
 *         description: Tenant deleted successfully
 *       '404':
 *         description: Tenant not found
 *       '400':
 *         description: Bad Request (tenant has active users)
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.delete(
  "/delete",
  auth,
  dynamicAccess("Tenant", "delete", { checkTenant: true }),
  tenantController.deleteTenant,
);

/* ------------------------------------------------------------------ */
/* GET TENANT SETTINGS                                                */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/settings:
 *   post:
 *     summary: Get settings for a specific tenant
 *     description: Requires read access to Tenant model. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       '200':
 *         description: Tenant settings retrieved successfully
 *       '404':
 *         description: Tenant not found
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.post(
  "/settings",
  auth,
  dynamicAccess("Tenant", "read", { checkTenant: true }),
  tenantController.getTenantSettings,
);

/* ------------------------------------------------------------------ */
/* UPDATE TENANT SETTINGS                                             */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/settings:
 *   patch:
 *     summary: Update settings for a specific tenant
 *     description: Requires update access to Tenant model. Self-check enabled. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *               - settings
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *               settings:
 *                 type: object
 *                 example:
 *                   branding_primary_color: "#007bff"
 *                   branding_secondary_color: "#6c757d"
 *                   features_enable_signup: true
 *                   features_enable_sso: false
 *                   limits_max_storage_gb: 100
 *     responses:
 *       '200':
 *         description: Tenant settings updated successfully
 *       '404':
 *         description: Tenant not found
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.patch(
  "/settings",
  auth,
  dynamicAccess("Tenant", "update", { checkSelf: true, checkTenant: true }),
  tenantController.updateTenantSettings,
);

/* ------------------------------------------------------------------ */
/* GET TENANT USER COUNT                                              */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/user-count:
 *   post:
 *     summary: Get user count for a tenant
 *     description: Requires read access to Tenant model. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       '200':
 *         description: Tenant user count retrieved successfully
 *       '404':
 *         description: Tenant not found
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.post(
  "/user-count",
  auth,
  dynamicAccess("Tenant", "read", { checkTenant: true }),
  tenantController.getTenantUserCount,
);

/* ------------------------------------------------------------------ */
/* UPLOAD TENANT LOGO                                                 */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/logo:
 *   post:
 *     summary: Upload a logo for a tenant
 *     description: Requires update access to Tenant model. Self-check enabled.
 *     tags:
 *       - Tenants
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Tenant logo uploaded successfully
 *       '400':
 *         description: No file uploaded or invalid file type
 *       '404':
 *         description: Tenant not found
 *       '403':
 *         description: Forbidden
 */
router.post(
  "/:tenantId/logo",
  auth,
  dynamicAccess("Tenant", "update", { checkSelf: true, checkTenant: true }),
  tenantController.uploadTenantLogo,
);

/* ------------------------------------------------------------------ */
/* REMOVE TENANT LOGO                                                 */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/{tenantId}/logo:
 *   delete:
 *     summary: Remove a tenant's logo
 *     description: Requires update access to Tenant model. Self-check enabled.
 *     tags:
 *       - Tenants
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
 *         description: Tenant logo removed successfully
 *       '404':
 *         description: Tenant not found
 *       '403':
 *         description: Forbidden
 */
router.delete(
  "/:tenantId/logo",
  auth,
  dynamicAccess("Tenant", "update", { checkSelf: true, checkTenant: true }),
  tenantController.removeTenantLogo,
);

module.exports = router;
