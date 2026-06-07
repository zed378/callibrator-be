const { Op } = require("sequelize");
const { success, error } = require("../utils/response");
const { MenuGroup, MenuItem } = require("../models");
const { checkUserPermission } = require("../services/tablePermission.service");
const menuGroupRoleService = require("../services/menuGroupRole.service");

/**
 * Get all menu groups with their items (no filtering)
 * GET /api/v1/menu-groups
 */
exports.getMenuGroups = async (req, res, next) => {
  try {
    const groups = await MenuGroup.findAll({
      where: { isActive: true },
      order: [["sortOrder", "ASC"]],
      include: [
        {
          model: MenuItem,
          as: "items",
          where: { isActive: true },
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    const menuGroups = groups.map((group) => ({
      label: group.label,
      icon: group.icon,
      path: group.path,
      items: group.items?.map((item) => ({
        label: item.label,
        path: item.path,
        icon: item.icon,
        requiredPermission: item.requiredPermission,
      })),
    }));

    success(res, menuGroups, null, "Menu groups fetched successfully", 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Get all menu group role assignments
 * GET /api/v1/menu-groups/assignments
 */
exports.getAllMenuGroupAssignments = async (req, res, next) => {
  try {
    const assignments = await menuGroupRoleService.getAllMenuGroupRoles();
    const formatted = assignments.map((a) => ({
      id: a.id,
      menuGroupId: a.menuGroupId,
      menuGroup: a.menuGroup
        ? {
            label: a.menuGroup.label,
            icon: a.menuGroup.icon,
            path: a.menuGroup.path,
            items: a.menuGroup.items?.map((item) => ({
              id: item.id,
              label: item.label,
              path: item.path,
              icon: item.icon,
              requiredPermission: item.requiredPermission,
            })),
          }
        : null,
      role: a.role
        ? {
            id: a.role.id,
            name: a.role.name,
            nameToShow: a.role.nameToShow,
            roleLevel: a.role.roleLevel,
          }
        : null,
      notes: a.notes,
      assignedBy: a.assignedBy,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
    success(
      res,
      formatted,
      null,
      "Menu group assignments fetched successfully",
      200,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get menu groups available for role assignment
 * GET /api/v1/menu-groups/available/:roleId
 */
exports.getAvailableMenuGroups = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const groups =
      await menuGroupRoleService.getMenuGroupsForRoleAssignment(roleId);
    success(
      res,
      groups,
      null,
      "Available menu groups fetched successfully",
      200,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Get all roles for menu group assignment
 * GET /api/v1/menu-groups/roles
 */
exports.getAvailableRoles = async (req, res, next) => {
  try {
    const roles = await menuGroupRoleService.getAllRoles();
    success(res, roles, null, "Roles fetched successfully", 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Assign menu group to role
 * POST /api/v1/menu-groups/assign
 */
exports.assignMenuGroupToRole = async (req, res, next) => {
  try {
    const { menuGroupId, roleId, notes } = req.body;
    const userId = req.user?.id;

    if (!menuGroupId || !roleId) {
      return res.status(400).json({
        status: "Error",
        message: "menuGroupId and roleId are required",
      });
    }

    const assignment = await menuGroupRoleService.assignMenuGroupToRole(
      menuGroupId,
      roleId,
      userId,
      notes,
    );

    success(
      res,
      assignment,
      null,
      "Menu group assigned to role successfully",
      201,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Revoke menu group from role
 * POST /api/v1/menu-groups/revoke
 */
exports.revokeMenuGroupFromRole = async (req, res, next) => {
  try {
    const { menuGroupId, roleId } = req.body;

    if (!menuGroupId || !roleId) {
      return res.status(400).json({
        status: "Error",
        message: "menuGroupId and roleId are required",
      });
    }

    const assignment = await menuGroupRoleService.revokeMenuGroupFromRole(
      menuGroupId,
      roleId,
    );

    if (!assignment) {
      return res.status(404).json({
        status: "Error",
        message: "Assignment not found",
      });
    }

    success(res, null, null, "Menu group revoked from role successfully", 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk assign menu groups to role
 * POST /api/v1/menu-groups/bulk-assign
 */
exports.bulkAssignMenuGroups = async (req, res, next) => {
  try {
    const { roleId, menuGroupIds, notes } = req.body;
    const userId = req.user?.id;

    if (!roleId || !Array.isArray(menuGroupIds) || menuGroupIds.length === 0) {
      return res.status(400).json({
        status: "Error",
        message: "roleId and menuGroupIds (array) are required",
      });
    }

    const results = await menuGroupRoleService.bulkAssignMenuGroupsToRole(
      roleId,
      menuGroupIds,
      userId,
    );

    success(res, results, null, "Bulk assignment completed", 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk revoke menu groups from role
 * POST /api/v1/menu-groups/bulk-revoke
 */
exports.bulkRevokeMenuGroups = async (req, res, next) => {
  try {
    const { roleId, menuGroupIds } = req.body;

    if (!roleId || !Array.isArray(menuGroupIds) || menuGroupIds.length === 0) {
      return res.status(400).json({
        status: "Error",
        message: "roleId and menuGroupIds (array) are required",
      });
    }

    const results = await menuGroupRoleService.bulkRevokeMenuGroupsFromRole(
      roleId,
      menuGroupIds,
    );

    success(res, results, null, "Bulk revocation completed", 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Get menu groups filtered by user permissions
 * POST /api/v1/menu-groups/filter
 */
exports.getFilteredMenuGroups = async (req, res, next) => {
  try {
    const { userId, tenantId } = req.body;
    const user = req.user || {};
    const checkUserId = userId || user.id;
    const checkTenantId = tenantId || user.tenantId;

    // Check if user is SUPER_ADMIN
    const isSuperAdmin = user.role?.name === "SUPER_ADMIN";

    if (isSuperAdmin) {
      // Return all menu groups for super admin
      const groups = await MenuGroup.findAll({
        where: { isActive: true },
        order: [["sortOrder", "ASC"]],
        include: [
          {
            model: MenuItem,
            as: "items",
            where: { isActive: true },
            order: [["sortOrder", "ASC"]],
          },
        ],
      });

      const menuGroups = groups.map((group) => ({
        label: group.label,
        icon: group.icon,
        path: group.path,
        items: group.items?.map((item) => ({
          label: item.label,
          path: item.path,
          icon: item.icon,
          requiredPermission: item.requiredPermission,
        })),
      }));

      return success(
        res,
        menuGroups,
        null,
        "Filtered menu groups fetched successfully",
        200,
      );
    }

    // For non-super-admin, fetch all groups and filter items
    const groups = await MenuGroup.findAll({
      where: { isActive: true },
      order: [["sortOrder", "ASC"]],
      include: [
        {
          model: MenuItem,
          as: "items",
          where: { isActive: true },
          order: [["sortOrder", "ASC"]],
        },
      ],
    });

    const filteredGroups = [];

    for (const group of groups) {
      const filteredItems = [];

      for (const item of group.items || []) {
        if (!item.requiredPermission) {
          // No permission required, always include
          filteredItems.push({
            label: item.label,
            path: item.path,
            icon: item.icon,
            requiredPermission: item.requiredPermission,
          });
          continue;
        }

        // Parse permission string (e.g., "User:read")
        const [modelName, action] = item.requiredPermission.split(":");
        if (!modelName || !action) {
          filteredItems.push({
            label: item.label,
            path: item.path,
            icon: item.icon,
            requiredPermission: item.requiredPermission,
          });
          continue;
        }

        // Check if user has permission
        try {
          const result = await checkUserPermission(
            checkUserId,
            modelName,
            action,
            checkTenantId,
          );

          if (result.allowed) {
            filteredItems.push({
              label: item.label,
              path: item.path,
              icon: item.icon,
              requiredPermission: item.requiredPermission,
            });
          }
        } catch (err) {
          // If permission check fails, deny by default
          console.error(
            `[MenuGroup] Permission check failed for ${item.requiredPermission}:`,
            err.message,
          );
        }
      }

      // Only include group if it has items
      if (filteredItems.length > 0) {
        filteredGroups.push({
          label: group.label,
          icon: group.icon,
          path: group.path,
          items: filteredItems,
        });
      }
    }

    success(
      res,
      filteredGroups,
      null,
      "Filtered menu groups fetched successfully",
      200,
    );
  } catch (err) {
    next(err);
  }
};
