/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Endpoints for managing user accounts and roles
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
const { upload } = require("../../utils/upload");
const userController = require("../../controllers/user.controller");

/* ------------------------------------------------------------------ */
/* GET ALL USERS (paginated, searchable, tenant‑scoped)               */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/all:
 *   get:
 *     summary: Retrieve a paginated list of users
 *     description: Requires read access to User model with tenant scope. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: false
 *         description: Identifier of the tenant the request belongs to
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: roleFilter
 *         required: false
 *         description: Role filter
 *         schema:
 *           type: string
 *       - in: query
 *         name: find
 *         required: false
 *         description: Free-text search
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
 *           default: 50
 *     responses:
 *       '200':
 *         description: Successful retrieval of users
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.get(
  "/all",
  auth,
  dynamicAccess("User", "read", { checkTenant: true }),
  userController.getAllUsers,
);

/* ------------------------------------------------------------------ */
/* GET SPECIFIC USER                                                  */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/detail:
 *   post:
 *     summary: Fetch details of a specific user by ID
 *     description: Requires read access to User model. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       '200':
 *         description: User details retrieved successfully
 *       '400':
 *         description: Missing userId
 *       '404':
 *         description: User not found
 */
router.post(
  "/detail",
  auth,
  dynamicAccess("User", "read", { checkTenant: true }),
  userController.getSpecificUser,
);

/* ------------------------------------------------------------------ */
/* CHECK USERNAME AVAILABILITY                                        */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/username-check:
 *   post:
 *     summary: Check if a username is available
 *     description: Requires authentication. No specific permission required - available to all authenticated users.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Availability check result
 */
router.post("/username-check", auth, userController.checkUsernameAvailability);

/* ------------------------------------------------------------------ */
/* UPDATE USER ROLE                                                   */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/role-update:
 *   post:
 *     summary: Update a user's role
 *     description: Requires update access to User model with tenant scope. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - roleId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               roleId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       '200':
 *         description: Role updated successfully
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.post(
  "/role-update",
  auth,
  dynamicAccess("User", "update", { checkTenant: true }),
  userController.updateUserRole,
);

/* ------------------------------------------------------------------ */
/* CREATE USER                                                        */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/create:
 *   post:
 *     summary: Create a new user
 *     description: Requires create access to User model with tenant scope. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - roleId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               roleId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       '201':
 *         description: User created successfully
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.post(
  "/create",
  auth,
  dynamicAccess("User", "create", { checkTenant: true }),
  userController.createUser,
);

/* ------------------------------------------------------------------ */
/* EDIT USER                                                          */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/edit:
 *   patch:
 *     summary: Update an existing user's details
 *     description: Requires update access to User model. Self-check enabled. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               status:
 *                 type: string
 *     responses:
 *       '200':
 *         description: User updated successfully
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.patch(
  "/edit",
  auth,
  dynamicAccess("User", "update", { checkSelf: true, checkTenant: true }),
  userController.editUser,
);

/* ------------------------------------------------------------------ */
/* DELETE USER                                                        */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/delete:
 *   delete:
 *     summary: Delete a user account
 *     description: Requires delete access to User model with tenant scope. Uses dynamic RBAC/ABAC.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: User deleted successfully
 *       '403':
 *         description: Forbidden - Insufficient permissions
 */
router.delete(
  "/delete",
  auth,
  dynamicAccess("User", "delete", { checkTenant: true }),
  userController.deleteUser,
);

/* ------------------------------------------------------------------ */
/* UPLOAD USER AVATAR                                                 */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/{userId}/avatar:
 *   post:
 *     summary: Upload an avatar for a user
 *     description: Requires update access to User model. Self-check enabled.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *         description: User avatar uploaded successfully
 *       '400':
 *         description: No file uploaded or invalid file type
 *       '404':
 *         description: User not found
 *       '403':
 *         description: Forbidden
 */
router.post(
  "/:userId/avatar",
  auth,
  dynamicAccess("User", "update", { checkSelf: true, checkTenant: true }),
  upload({
    folder: "uploads/profile",
    allowedMimes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    maxFileSize: 2 * 1024 * 1024, // 2MB
  }),
  userController.uploadUserAvatar,
);

/* ------------------------------------------------------------------ */
/* REMOVE USER AVATAR                                                 */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/users/{userId}/avatar:
 *   delete:
 *     summary: Remove a user's avatar
 *     description: Requires update access to User model. Self-check enabled.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: User avatar removed successfully
 *       '404':
 *         description: User not found
 *       '403':
 *         description: Forbidden
 */
router.delete(
  "/:userId/avatar",
  auth,
  dynamicAccess("User", "update", { checkSelf: true, checkTenant: true }),
  userController.removeUserAvatar,
);

module.exports = router;
