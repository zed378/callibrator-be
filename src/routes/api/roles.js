/**
 * @swagger
 * /api/v1/roles:
 *   description: Endpoint group for Role Management
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const express = require('express');
const router = express.Router();
const rolesController = require('../../controllers/roles.controller');
const { auth } = require('../../middlewares/auth');
const { rbac } = require('../../middlewares/rbac');

/* ------------------------------------------------------------------ */
/* GET ALL ROLES                                                      */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/all:
 *   get:
 *     summary: Fetch a list of all roles with pagination and search
 *     description: Requires SUPER_ADMIN role. Only super admin can view all roles.
 *     tags:
 *       - Roles
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
 *         description: Search by name, description, or nameToShow
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
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: "Fetch roles successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rows:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                             example: "TENANT_ADMIN"
 *                           description:
 *                             type: string
 *                             example: "Tenant Administrator"
 *                           nameToShow:
 *                             type: string
 *                             example: "Tenant Admin"
 *                           isActive:
 *                             type: boolean
 *                             example: true
 *                           roleLevel:
 *                             type: integer
 *                             example: 2
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     meta:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
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
 *                   example: "Internal server error"
 */
router.get('/all', auth, rbac(['SUPERADMIN']), rolesController.getAllRoles);

/* ------------------------------------------------------------------ */
/* GET SPECIFIC ROLE BY ID                                            */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/detail:
 *   post:
 *     summary: Get details of a specific role by its ID
 *     description: Requires SUPER_ADMIN role. Only super admin can view role details.
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the role to fetch
 *     responses:
 *       '200':
 *         description: Role found
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
 *                   example: "Fetch role successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                       example: "TENANT_ADMIN"
 *                     description:
 *                       type: string
 *                       example: "Tenant Administrator"
 *                     nameToShow:
 *                       type: string
 *                       example: "Tenant Admin"
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     roleLevel:
 *                       type: integer
 *                       example: 2
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
 *                   example: "Role not found"
 *       '500':
 *         description: Internal Server Error
 */
router.post('/detail', auth, rbac(['SUPERADMIN']), rolesController.getRole);

/* ------------------------------------------------------------------ */
/* CREATE ROLE                                                        */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/create:
 *   post:
 *     summary: Create a new role
 *     description: Requires SUPER_ADMIN role. Only super admin can create new roles.
 *     tags:
 *       - Roles
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
 *               - roleLevel
 *             properties:
 *               name:
 *                 type: string
 *                 example: "MANAGER"
 *               description:
 *                 type: string
 *                 example: "Manager role with limited access"
 *               nameToShow:
 *                 type: string
 *                 example: "Manager"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               roleLevel:
 *                 type: integer
 *                 example: 3
 *                 description: "Role hierarchy level: 1 = USER, 2 = TENANT_ADMIN, 3 = SUPER_ADMIN"
 *     responses:
 *       '201':
 *         description: Role created successfully
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
 *                   example: "Role created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     nameToShow:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     roleLevel:
 *                       type: integer
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
 *                   example: "Role already exists"
 *       '500':
 *         description: Internal Server Error
 */
router.post('/create', auth, rbac(['SUPERADMIN']), rolesController.createRole);

/* ------------------------------------------------------------------ */
/* UPDATE ROLE                                                        */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/edit:
 *   patch:
 *     summary: Update an existing role
 *     description: Requires SUPER_ADMIN role. Only super admin can update existing roles.
 *     tags:
 *       - Roles
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
 *                 description: UUID of the role to update
 *               name:
 *                 type: string
 *                 example: "MANAGER"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               nameToShow:
 *                 type: string
 *                 example: "Manager"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               roleLevel:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       '200':
 *         description: Role updated successfully
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
 *                   example: "Role updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     nameToShow:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     roleLevel:
 *                       type: integer
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
 *                   example: "Role not found"
 *       '409':
 *         description: Conflict (Role name already exists)
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
 *                   example: "Role name already exists"
 *       '500':
 *         description: Internal Server Error
 */
router.patch('/edit', auth, rbac(['SUPERADMIN']), rolesController.updateRole);

/* ------------------------------------------------------------------ */
/* DELETE ROLE                                                        */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/delete:
 *   delete:
 *     summary: Delete a role by ID
 *     description: Requires SUPER_ADMIN role. Only super admin can delete roles. Built-in roles cannot be deleted.
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the role to delete
 *     responses:
 *       '200':
 *         description: Role deleted successfully
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
 *                   example: "Role deleted successfully"
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
 *                   example: "Role not found"
 *       '403':
 *         description: Forbidden (Cannot delete built-in role)
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
 *                   example: "Cannot delete built-in role"
 *       '500':
 *         description: Internal Server Error
 */
router.delete(
  '/delete',
  auth,
  rbac(['SUPERADMIN']),
  rolesController.deleteRole,
);

/* ------------------------------------------------------------------ */
/* GET ROLE PERMISSIONS                                               */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   get:
 *     summary: Get all permissions assigned to a role
 *     description: Requires SUPER_ADMIN role. Only super admin can view role permissions.
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the role
 *     responses:
 *       '200':
 *         description: Role permissions retrieved successfully
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
 *                   example: "Fetch role permissions successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           module:
 *                             type: string
 *                           action:
 *                             type: string
 *       '404':
 *         description: Role not found
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
 *                   example: "Role not found"
 *       '500':
 *         description: Internal Server Error
 */
router.get(
  '/:id/permissions',
  auth,
  rbac(['SUPERADMIN']),
  rolesController.getRolePermissions,
);

/* ------------------------------------------------------------------ */
/* ASSIGN PERMISSIONS TO ROLE                                         */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   put:
 *     summary: Assign permissions to a role
 *     description: Requires SUPER_ADMIN role. Only super admin can assign permissions to roles.
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the role
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissionIds
 *             properties:
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of permission UUIDs to assign
 *                 example: ["perm-uuid-1", "perm-uuid-2"]
 *     responses:
 *       '200':
 *         description: Permissions assigned successfully
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
 *                   example: "Permissions assigned to role successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId:
 *                       type: string
 *                       format: uuid
 *                     permissionIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: uuid
 *       '400':
 *         description: Bad Request (Permissions not found)
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
 *                   example: "Permissions not found: xxx"
 *       '404':
 *         description: Role not found
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
 *                   example: "Role not found"
 *       '500':
 *         description: Internal Server Error
 */
router.put(
  '/:id/permissions',
  auth,
  rbac(['SUPERADMIN']),
  rolesController.assignPermissionsToRole,
);

/* ------------------------------------------------------------------ */
/* REVOKE ALL PERMISSIONS FROM ROLE                                   */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/{id}/permissions:
 *   delete:
 *     summary: Revoke all permissions from a role
 *     description: Requires SUPER_ADMIN role. Only super admin can revoke all permissions from a role.
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the role
 *     responses:
 *       '200':
 *         description: All permissions revoked successfully
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
 *                   example: "All permissions revoked from role successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId:
 *                       type: string
 *                       format: uuid
 *       '404':
 *         description: Role not found
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
 *                   example: "Role not found"
 *       '500':
 *         description: Internal Server Error
 */
router.delete(
  '/:id/permissions',
  auth,
  rbac(['SUPERADMIN']),
  rolesController.revokeAllPermissionsFromRole,
);

/* ------------------------------------------------------------------ */
/* GET ROLE USERS                                                     */
/* ------------------------------------------------------------------ */
/**
 * @swagger
 * /api/v1/roles/{id}/users:
 *   get:
 *     summary: Get all users with a specific role
 *     description: Requires SUPER_ADMIN role. Only super admin can view users by role.
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the role
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
 *     responses:
 *       '200':
 *         description: Role users retrieved successfully
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
 *                   example: "Fetch role users successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           username:
 *                             type: string
 *                           email:
 *                             type: string
 *                           status:
 *                             type: string
 *                     meta:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       '404':
 *         description: Role not found
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
 *                   example: "Role not found"
 *       '500':
 *         description: Internal Server Error
 */
router.get(
  '/:id/users',
  auth,
  rbac(['SUPERADMIN']),
  rolesController.getRoleUsers,
);

module.exports = router;
