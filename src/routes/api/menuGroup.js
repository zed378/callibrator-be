const express = require("express");
const router = express.Router();
const menuGroupController = require("../../controllers/menuGroup.controller");
const { auth } = require("../../middlewares/auth");

/**
 * @swagger
 * tags:
 *   name: MenuGroups
 *   description: Menu group management endpoints
 */

/**
 * @swagger
 * /api/v1/menu-groups:
 *   get:
 *     summary: Get all menu groups
 *     description: Returns all active menu groups with their items (no permission filtering)
 *     tags:
 *       - MenuGroups
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all menu groups
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
 *                   example: "Menu groups fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                       icon:
 *                         type: string
 *                       path:
 *                         type: string
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                             path:
 *                               type: string
 *                             icon:
 *                               type: string
 *                             requiredPermission:
 *                               type: string
 *                               nullable: true
 *       401:
 *         description: Unauthorized
 */
router.get("/", auth, menuGroupController.getMenuGroups);

/**
 * @swagger
 * /api/v1/menu-groups/filter:
 *   post:
 *     summary: Get menu groups filtered by user permissions
 *     description: Returns menu groups with items filtered based on user's table permissions. SUPER_ADMIN gets all items.
 *     tags:
 *       - MenuGroups
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Filtered list of menu groups
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
 *                   example: "Filtered menu groups fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                       icon:
 *                         type: string
 *                       path:
 *                         type: string
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                             path:
 *                               type: string
 *                             icon:
 *                               type: string
 *                             requiredPermission:
 *                               type: string
 *                               nullable: true
 *       401:
 *         description: Unauthorized
 */
router.post("/filter", auth, menuGroupController.getFilteredMenuGroups);

/**
 * @swagger
 * /api/v1/menu-groups/assignments:
 *   get:
 *     summary: Get all menu group role assignments
 *     description: Returns all menu group to role assignments
 *     tags:
 *       - MenuGroups
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all assignments
 */
router.get(
  "/assignments",
  auth,
  menuGroupController.getAllMenuGroupAssignments,
);

/**
 * @swagger
 * /api/v1/menu-groups/available/{roleId}:
 *   get:
 *     summary: Get menu groups available for role assignment
 *     description: Returns all menu groups with assignment status for a specific role
 *     tags:
 *       - MenuGroups
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of menu groups with assignment status
 */
router.get(
  "/available/:roleId",
  auth,
  menuGroupController.getAvailableMenuGroups,
);

/**
 * @swagger
 * /api/v1/menu-groups/roles:
 *   get:
 *     summary: Get all roles for assignment
 *     description: Returns all active roles
 *     tags:
 *       - MenuGroups
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 */
router.get("/roles", auth, menuGroupController.getAvailableRoles);

/**
 * @swagger
 * /api/v1/menu-groups/assign:
 *   post:
 *     summary: Assign menu group to role
 *     description: Assigns a menu group (and its items) to a specific role
 *     tags:
 *       - MenuGroups
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - menuGroupId
 *               - roleId
 *             properties:
 *               menuGroupId:
 *                 type: string
 *                 format: uuid
 *               roleId:
 *                 type: string
 *                 format: uuid
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Assignment created
 */
router.post("/assign", auth, menuGroupController.assignMenuGroupToRole);

/**
 * @swagger
 * /api/v1/menu-groups/revoke:
 *   post:
 *     summary: Revoke menu group from role
 *     description: Revokes a menu group assignment from a role
 *     tags:
 *       - MenuGroups
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - menuGroupId
 *               - roleId
 *             properties:
 *               menuGroupId:
 *                 type: string
 *                 format: uuid
 *               roleId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Assignment revoked
 */
router.post("/revoke", auth, menuGroupController.revokeMenuGroupFromRole);

/**
 * @swagger
 * /api/v1/menu-groups/bulk-assign:
 *   post:
 *     summary: Bulk assign menu groups to role
 *     description: Assigns multiple menu groups to a specific role
 *     tags:
 *       - MenuGroups
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
 *               - menuGroupIds
 *             properties:
 *               roleId:
 *                 type: string
 *                 format: uuid
 *               menuGroupIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk assignment results
 */
router.post("/bulk-assign", auth, menuGroupController.bulkAssignMenuGroups);

/**
 * @swagger
 * /api/v1/menu-groups/bulk-revoke:
 *   post:
 *     summary: Bulk revoke menu groups from role
 *     description: Revokes multiple menu group assignments from a role
 *     tags:
 *       - MenuGroups
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
 *               - menuGroupIds
 *             properties:
 *               roleId:
 *                 type: string
 *                 format: uuid
 *               menuGroupIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Bulk revocation results
 */
router.post("/bulk-revoke", auth, menuGroupController.bulkRevokeMenuGroups);

module.exports = router;
