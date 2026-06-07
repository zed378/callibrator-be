const { MenuGroupRole, MenuGroup, Roles, MenuItem } = require("../models");
const { checkUserPermission } = require("../services/tablePermission.service");

/**
 * Get all menu group role assignments
 */
exports.getAllMenuGroupRoles = async () => {
  const assignments = await MenuGroupRole.findAll({
    where: { isActive: true },
    include: [
      {
        model: MenuGroup,
        as: "menuGroup",
        where: { isActive: true },
        attributes: ["id", "label", "icon", "path", "sortOrder"],
        include: [
          {
            model: MenuItem,
            as: "items",
            where: { isActive: true },
            attributes: ["id", "label", "path", "icon", "requiredPermission"],
            order: [["sortOrder", "ASC"]],
          },
        ],
        order: [["sortOrder", "ASC"]],
      },
      {
        model: Roles,
        as: "role",
        attributes: ["id", "name", "nameToShow", "roleLevel"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  return assignments;
};

/**
 * Get menu groups assigned to a specific role
 */
exports.getMenuGroupsByRole = async (roleId) => {
  const assignments = await MenuGroupRole.findAll({
    where: { roleId, isActive: true },
    include: [
      {
        model: MenuGroup,
        as: "menuGroup",
        where: { isActive: true },
        attributes: ["id", "label", "icon", "path", "sortOrder"],
        include: [
          {
            model: MenuItem,
            as: "items",
            where: { isActive: true },
            attributes: ["id", "label", "path", "icon", "requiredPermission"],
            order: [["sortOrder", "ASC"]],
          },
        ],
        order: [["sortOrder", "ASC"]],
      },
      {
        model: Roles,
        as: "role",
        attributes: ["id", "name", "nameToShow", "roleLevel"],
      },
    ],
    order: [[{ model: MenuGroup }, "sortOrder", "ASC"]],
  });
  return assignments;
};

/**
 * Assign a menu group to a role
 */
exports.assignMenuGroupToRole = async (
  menuGroupId,
  roleId,
  assignedBy,
  notes = null,
) => {
  const [assignment, created] = await MenuGroupRole.findOrCreate({
    where: { menuGroupId, roleId },
    defaults: { assignedBy, notes },
    updating: { assignedBy, notes },
  });
  if (!created) {
    assignment.assignedBy = assignedBy;
    assignment.notes = notes;
    assignment.isActive = true;
    await assignment.save();
  }
  return assignment;
};

/**
 * Revoke a menu group assignment from a role
 */
exports.revokeMenuGroupFromRole = async (menuGroupId, roleId) => {
  const assignment = await MenuGroupRole.findOne({
    where: { menuGroupId, roleId, isActive: true },
  });
  if (assignment) {
    assignment.isActive = false;
    await assignment.save();
  }
  return assignment;
};

/**
 * Get all menu groups with their assignment status for a specific role
 */
exports.getMenuGroupsForRoleAssignment = async (roleId) => {
  const allGroups = await MenuGroup.findAll({
    where: { isActive: true },
    order: [["sortOrder", "ASC"]],
    include: [
      {
        model: MenuItem,
        as: "items",
        where: { isActive: true },
        attributes: ["id", "label", "path", "icon", "requiredPermission"],
        order: [["sortOrder", "ASC"]],
      },
    ],
  });

  const assignedGroupIds = await MenuGroupRole.findAll({
    where: { roleId, isActive: true },
    attributes: ["menuGroupId"],
    raw: true,
  });

  const assignedIds = assignedGroupIds.map((a) => a.menuGroupId);

  return allGroups.map((group) => ({
    id: group.id,
    label: group.label,
    icon: group.icon,
    path: group.path,
    sortOrder: group.sortOrder,
    items: group.items?.map((item) => ({
      id: item.id,
      label: item.label,
      path: item.path,
      icon: item.icon,
      requiredPermission: item.requiredPermission,
    })),
    isAssigned: assignedIds.includes(group.id),
  }));
};

/**
 * Get all roles for assignment UI
 */
exports.getAllRoles = async () => {
  const roles = await Roles.findAll({
    where: { isActive: true },
    attributes: ["id", "name", "nameToShow", "roleLevel", "description"],
    order: [
      ["roleLevel", "DESC"],
      ["name", "ASC"],
    ],
  });
  return roles;
};

/**
 * Bulk assign menu groups to a role
 */
exports.bulkAssignMenuGroupsToRole = async (
  roleId,
  menuGroupIds,
  assignedBy,
) => {
  const results = {
    assigned: [],
    alreadyAssigned: [],
    failed: [],
  };

  for (const menuGroupId of menuGroupIds) {
    try {
      const assignment = await MenuGroupRole.findOne({
        where: { menuGroupId, roleId, isActive: true },
      });

      if (assignment) {
        results.alreadyAssigned.push(menuGroupId);
      } else {
        await MenuGroupRole.create({
          menuGroupId,
          roleId,
          assignedBy,
          isActive: true,
        });
        results.assigned.push(menuGroupId);
      }
    } catch (err) {
      results.failed.push({ menuGroupId, error: err.message });
    }
  }

  return results;
};

/**
 * Bulk revoke menu groups from a role
 */
exports.bulkRevokeMenuGroupsFromRole = async (roleId, menuGroupIds) => {
  const results = {
    revoked: [],
    notFound: [],
  };

  await MenuGroupRole.update(
    { isActive: false },
    {
      where: {
        roleId,
        menuGroupId: menuGroupIds,
        isActive: true,
      },
    },
  );

  const updated = await MenuGroupRole.findAll({
    where: {
      roleId,
      menuGroupId: menuGroupIds,
      isActive: false,
    },
  });

  results.revoked = updated.map((a) => a.menuGroupId);

  return results;
};

/**
 * Get menu groups filtered by role assignments
 * This is used by the frontend to show/hide menu groups based on role
 */
exports.getFilteredMenuGroupsByRole = async (roleId, userId) => {
  // SUPER_ADMIN gets everything
  const userRole = await Roles.findByPk(roleId);
  if (userRole?.name === "SUPER_ADMIN") {
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
    return groups.map((group) => ({
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
  }

  // Get assigned menu groups
  const assignedAssignments = await MenuGroupRole.findAll({
    where: { roleId, isActive: true },
    attributes: ["menuGroupId"],
    raw: true,
  });

  const assignedGroupIds = assignedAssignments.map((a) => a.menuGroupId);

  // If no specific assignments, use default behavior (permission-based filtering)
  if (assignedGroupIds.length === 0) {
    return null; // Signal to use default permission-based filtering
  }

  // Get menu groups that have at least one assignment
  const groups = await MenuGroup.findAll({
    where: {
      isActive: true,
      id: assignedGroupIds,
    },
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

  // Filter items based on both role assignment AND individual permissions
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

      // Parse permission string
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
          userId,
          modelName,
          action,
          null, // tenantId
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
        console.error(
          `[MenuGroupRole] Permission check failed for ${item.requiredPermission}:`,
          err.message,
        );
      }
    }

    if (filteredItems.length > 0) {
      filteredGroups.push({
        label: group.label,
        icon: group.icon,
        path: group.path,
        items: filteredItems,
      });
    }
  }

  return filteredGroups;
};
