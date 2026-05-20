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
const express = require('express');
const router = express.Router();
const { auth } = require('../../middlewares/auth');
const { dynamicAccess } = require('../../middlewares/dynamicAccess');
const tenantController = require('../../controllers/tenant.controller');
const { upload } = require('../../utils/upload');

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Tenants fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       '403':
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 */
router.get(
  '/all',
  auth,
  dynamicAccess('Tenant', 'read', { checkTenant: true }),
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Tenant fetched successfully"
 *                 data:
 *                   type: object
 *       '404':
 *         description: Tenant not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "Tenant not found"
 *       '403':
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 */
router.post(
  '/detail',
  auth,
  dynamicAccess('Tenant', 'read', { checkTenant: true }),
  tenantController.getSpecificTenant,
);

/* ------------------------------------------------------------------ */
/* CREATE TENANT (supports form-data with optional file upload)       */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/create:
 *   post:
 *     summary: Create a new tenant
 *     description: Requires create access to Tenant model with tenant scope. Uses dynamic RBAC/ABAC. Supports multipart/form-data for file upload.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
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
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional logo file (JPEG, PNG, GIF, WebP, SVG). Use field name "file" for the upload.
 *               maxUsers:
 *                 type: integer
 *                 example: 50
 *     responses:
 *       '201':
 *         description: Tenant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: "Tenant created successfully"
 *                 data:
 *                   type: object
 *       '409':
 *         description: Conflict (name or code already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 409
 *                 message:
 *                   type: string
 *                   example: "Tenant name or code already exists"
 *       '403':
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 */
router.post(
  '/create',
  auth,
  dynamicAccess('Tenant', 'create', { checkTenant: true }),
  upload({
    folder: 'uploads/tenant',
    allowedMimes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  }),
  tenantController.createTenant,
);

/* ------------------------------------------------------------------ */
/* UPDATE TENANT (supports form-data with optional file upload)       */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/tenants/edit:
 *   patch:
 *     summary: Update an existing tenant's details
 *     description: Requires update access to Tenant model. Self-check enabled. Uses dynamic RBAC/ABAC. Supports multipart/form-data for file upload.
 *     tags:
 *       - Tenants
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *                 example: "b4130d0e-4772-4868-9da9-0817271bda93"
 *               name:
 *                 type: string
 *                 example: "Acme Corporation Updated"
 *               code:
 *                 type: string
 *                 example: "acme-corp-updated"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Optional logo file (JPEG, PNG, GIF, WebP, SVG). Use field name "file" for the upload.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Tenant updated successfully"
 *                 data:
 *                   type: object
 *       '404':
 *         description: Tenant not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "Tenant not found"
 *       '409':
 *         description: Conflict (name or code already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 409
 *                 message:
 *                   type: string
 *                   example: "Tenant name or code already exists"
 *       '403':
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 */
router.patch(
  '/edit',
  auth,
  dynamicAccess('Tenant', 'update', { checkSelf: true, checkTenant: true }),
  upload({
    folder: 'uploads/tenant',
    allowedMimes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  }),
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Tenant deleted successfully"
 *       '404':
 *         description: Tenant not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "Tenant not found"
 *       '400':
 *         description: Bad Request (tenant has active users)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Cannot delete tenant with active users"
 *       '403':
 *         description: Forbidden - Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 403
 *                 message:
 *                   type: string
 *                   example: "Forbidden"
 */
router.delete(
  '/delete',
  auth,
  dynamicAccess('Tenant', 'delete', { checkTenant: true }),
  tenantController.deleteTenant,
);

module.exports = router;
