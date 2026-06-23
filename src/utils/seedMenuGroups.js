const { Roles } = require("../models");
const { MenuGroup, RoleMenuPermission } = require("../models");
const { logger } = require("../middlewares/activityLog");
const { Op } = require("sequelize");

/**
 * Get or create menu group by slug
 */
function getMenuGroupId(slug) {
  const ids = {
    home: "a0000000-0000-0000-0000-000000000000",
    dashboard: "a0000000-0000-0000-0000-000000000001",
    account: "a0000000-0000-0000-0000-000000000002",
    management: "a0000000-0000-0000-0000-000000000003",
    security: "a0000000-0000-0000-0000-000000000004",
    profile: "a0000000-0000-0000-0000-000000000005",
    warehouse: "a0000000-0000-0000-0000-000000000006",
  };
  return (
    ids[slug] || `a0000000-0000-0000-0000-${Date.now().toString().slice(-4)}`
  );
}

/**
 * Seed menu groups
 */
async function seedMenuGroups() {
  logger.info("Seeding menu groups...");

  const menuData = [
    {
      name: "Home",
      slug: "home",
      icon: "Home",
      sortOrder: 0,
      is_active: true,
    },
    {
      name: "Dashboard",
      slug: "dashboard",
      icon: "LayoutGrid",
      sortOrder: 1,
      is_active: true,
    },
    {
      name: "Account",
      slug: "account",
      icon: "User",
      sortOrder: 2,
      is_active: true,
    },
    {
      name: "Management",
      slug: "management",
      icon: "Settings",
      sortOrder: 3,
      is_active: true,
    },
    {
      name: "Security",
      slug: "security",
      icon: "Shield",
      sortOrder: 4,
      is_active: true,
    },
    {
      name: "Profile",
      slug: "profile",
      icon: "UserCircle",
      sortOrder: 5,
      is_active: true,
      description:
        "Profile menu group contains profile page and change password sub-routes",
    },
    {
      name: "Warehouse",
      slug: "warehouse",
      icon: "Warehouse",
      sortOrder: 6,
      is_active: true,
      description: "Warehouse, stock, and inventory management",
    },
  ];

  for (const groupData of menuData) {
    let group = await MenuGroup.findOne({
      where: { slug: groupData.slug },
    });

    if (!group) {
      group = await MenuGroup.create({
        id: getMenuGroupId(groupData.slug),
        name: groupData.name,
        slug: groupData.slug,
        icon: groupData.icon,
        sortOrder: groupData.sortOrder,
        is_active: groupData.is_active,
      });
      logger.info(`Created menu group: ${groupData.name}`);
    } else {
      await group.update({
        icon: groupData.icon,
        sortOrder: groupData.sortOrder,
        is_active: groupData.is_active,
      });
    }
  }

  logger.info("Menu groups seeding completed.");
}

/**
 * Seed role menu permissions (simplified RBAC - read/write)
 */
async function seedRoleMenuPermissions() {
  logger.info("Seeding role menu permissions...");

  const roleAssignments = [
    {
      roleName: "SUPER_ADMIN",
      groupSlugs: ["home", "dashboard", "account", "management", "security"],
    },
    {
      roleName: "TENANT_ADMIN",
      groupSlugs: ["home", "dashboard", "account", "management"],
    },
    {
      roleName: "ADMIN",
      groupSlugs: ["home", "dashboard", "account", "management"],
    },
    {
      roleName: "USER",
      groupSlugs: ["home", "dashboard", "account"],
    },
    {
      roleName: "GUEST",
      groupSlugs: ["home", "dashboard"],
    },
  ];

  for (const assignment of roleAssignments) {
    const role = await Roles.findOne({
      where: { name: assignment.roleName },
    });

    if (!role) {
      logger.warn(`Role not found: ${assignment.roleName}, skipping...`);
      continue;
    }

    for (const slug of assignment.groupSlugs) {
      const group = await MenuGroup.findOne({
        where: { slug },
      });

      if (!group) {
        logger.warn(`Menu group not found: ${slug}, skipping...`);
        continue;
      }

      const existing = await RoleMenuPermission.findOne({
        where: {
          roleId: role.id,
          menuGroupId: group.id,
        },
      });

      if (!existing) {
        // SUPER_ADMIN and TENANT_ADMIN get full read+write access
        // ADMIN gets read+write on management
        // USER gets read on account, write on dashboard
        // GUEST gets read only
        let permissionType = "read";

        if (role.name === "SUPER_ADMIN" || role.name === "TENANT_ADMIN") {
          permissionType = "read"; // Will be extended by admin logic
        } else if (role.name === "ADMIN") {
          permissionType = group.slug === "management" ? "write" : "read";
        } else if (role.name === "USER") {
          permissionType =
            group.slug === "account"
              ? "read"
              : group.slug === "dashboard"
                ? "read"
                : "read";
        }

        await RoleMenuPermission.create({
          roleId: role.id,
          menuGroupId: group.id,
          permissionType,
        });
      }
    }
  }

  logger.info("Role menu permissions seeded.");
}

/**
 * Seed all: menu groups + role permissions
 */
async function seedAll() {
  await seedMenuGroups();
  await seedRoleMenuPermissions();
  logger.info("All seeding completed successfully.");
}

module.exports = {
  seedMenuGroups,
  seedRoleMenuPermissions,
  seedAll,
};
