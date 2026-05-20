/**
 * @swagger
 * /api/v1/permissions:
 *   description: Endpoint group for Permission Management
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const express = require("express");
const router = express.Router();
const permissionController = require("../../controllers/permission.controller");
const { auth } = require("../../middlewares/auth");
const { rbac } = require("../../middlewares/rbac");

/* ------------------------------------------------------------------ */
/* GET ALL PERMISSIONS                                               */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/permissions/all:
 *   get:
 *     summary: Fetch a list of all permissions with pagination and search
 *     description: Requires SUPER_ADMIN role. Only super admin can view all permissions.
 *     tags:
 *       - Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or description
 *     responses:
 *       '200':
 *         description: Successful retrieval
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Permissions fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                         example: "user:read"
 *                       module:
 *                         type: string
 *                         example: "User"
 *                       action:
 *                         type: string
 *                         example: "Read"
 *                       description:
 *                         type: string
 *                         example: "Allow users to read user data"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
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
 *       '500':
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal Server Error"
 */
router.get(
  "/all",
  auth,
  rbac(["SUPERADMIN"]),
  permissionController.getAllPermissions,
);

/* ------------------------------------------------------------------ */
/* GET SPECIFIC PERMISSION BY ID                                     */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/permissions/detail:
 *   post:
 *     summary: Get details of a specific permission by its ID
 *     description: Requires SUPER_ADMIN role. Only super admin can view permission details.
 *     tags:
 *       - Permissions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissionId
 *             properties:
 *               permissionId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the permission to fetch
 *     responses:
 *       '200':
 *         description: Permission found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Permission fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     module:
 *                       type: string
 *                     action:
 *                       type: string
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         description: Bad Request (Invalid ID or not found)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Permission not found"
 *       '500':
 *         description: Internal Server Error
 */
router.post(
  "/detail",
  auth,
  rbac(["SUPERADMIN"]),
  permissionController.getPermission,
);

/* ------------------------------------------------------------------ */
/* CREATE PERMISSION                                                 */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/permissions/create:
 *   post:
 *     summary: Create a new permission
 *     description: Requires SUPER_ADMIN role. Only super admin can create new permissions.
 *     tags:
 *       - Permissions
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
 *               - module
 *               - action
 *             properties:
 *               name:
 *                 type: string
 *                 example: "user:delete"
 *               module:
 *                 type: string
 *                 example: "User"
 *               action:
 *                 type: string
 *                 example: "Delete"
 *               description:
 *                 type: string
 *                 example: "Allow users to delete user accounts"
 *     responses:
 *       '201':
 *         description: Permission created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Permission created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     module:
 *                       type: string
 *                     action:
 *                       type: string
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         description: Conflict or Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Permission already exists"
 *       '500':
 *         description: Internal Server Error
 */
router.post(
  "/create",
  auth,
  rbac(["SUPERADMIN"]),
  permissionController.createPermission,
);

/* ------------------------------------------------------------------ */
/* UPDATE PERMISSION                                                 */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/permissions/edit:
 *   patch:
 *     summary: Update an existing permission
 *     description: Requires SUPER_ADMIN role. Only super admin can update existing permissions.
 *     tags:
 *       - Permissions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the permission to update
 *               name:
 *                 type: string
 *                 example: "user:read"
 *               module:
 *                 type: string
 *                 example: "User"
 *               action:
 *                 type: string
 *                 example: "Read"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *     responses:
 *       '200':
 *         description: Permission updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Permission updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     module:
 *                       type: string
 *                     action:
 *                       type: string
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         description: Bad Request (Not found or invalid input)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Permission not found"
 *       '500':
 *         description: Internal Server Error
 */
router.patch(
  "/edit",
  auth,
  rbac(["SUPERADMIN"]),
  permissionController.updatePermission,
);

/* ------------------------------------------------------------------ */
/* DELETE PERMISSION                                                 */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/permissions/delete:
 *   delete:
 *     summary: Delete a permission by ID
 *     description: Requires SUPER_ADMIN role. Only super admin can delete permissions.
 *     tags:
 *       - Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the permission to delete
 *     responses:
 *       '200':
 *         description: Permission deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Permission deleted successfully"
 *       '400':
 *         description: Bad Request (Not found or invalid ID)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Permission not found"
 *       '500':
 *         description: Internal Server Error
 */
router.delete(
  "/delete",
  auth,
  rbac(["SUPERADMIN"]),
  permissionController.deletePermission,
);

module.exports = router;
