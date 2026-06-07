const { MenuGroup, MenuItem } = require("../models");

/**
 * Seed default menu groups and items
 * This creates the default menu structure that can be modified via the admin UI
 */
async function seedMenuGroups() {
  console.log("Seeding menu groups...");

  const menuData = [
    {
      label: "Dashboard",
      icon: "LayoutGrid",
      path: "/dashboard",
      sortOrder: 0,
      isActive: true,
      items: [],
    },
    {
      label: "Account",
      icon: "User",
      path: null,
      sortOrder: 1,
      isActive: true,
      items: [
        {
          label: "Profile",
          path: "/dashboard/profile",
          icon: "User",
          requiredPermission: null,
          sortOrder: 0,
          isActive: true,
        },
      ],
    },
    {
      label: "Management",
      icon: "Settings",
      path: null,
      sortOrder: 2,
      isActive: true,
      items: [
        {
          label: "Users",
          path: "/dashboard/users",
          icon: "Users",
          requiredPermission: "User:read",
          sortOrder: 0,
          isActive: true,
        },
        {
          label: "Roles",
          path: "/dashboard/roles",
          icon: "Shield",
          requiredPermission: "Role:read",
          sortOrder: 1,
          isActive: true,
        },
        {
          label: "Tenants",
          path: "/dashboard/tenants",
          icon: "Building2",
          requiredPermission: "Tenant:read",
          sortOrder: 2,
          isActive: true,
        },
        {
          label: "Menu Groups Assignment",
          path: "/dashboard/menu-groups",
          icon: "LayoutGrid",
          requiredPermission: "MenuGroup:read",
          sortOrder: 3,
          isActive: true,
        },
      ],
    },
    {
      label: "Security",
      icon: "Shield",
      path: null,
      sortOrder: 3,
      isActive: true,
      items: [
        {
          label: "Permissions",
          path: "/dashboard/permissions",
          icon: "Key",
          requiredPermission: "Permission:read",
          sortOrder: 0,
          isActive: true,
        },
        {
          label: "Table Permissions",
          path: "/dashboard/table-permissions",
          icon: "Table2",
          requiredPermission: "TablePermission:read",
          sortOrder: 1,
          isActive: true,
        },
      ],
    },
  ];

  for (const groupData of menuData) {
    // Find existing group or create new
    let group = await MenuGroup.findOne({
      where: { label: groupData.label },
    });

    if (!group) {
      group = await MenuGroup.create({
        id:
          groupData.label === "Dashboard"
            ? "a0000000-0000-0000-0000-000000000001"
            : groupData.label === "Account"
              ? "a0000000-0000-0000-0000-000000000002"
              : groupData.label === "Management"
                ? "a0000000-0000-0000-0000-000000000003"
                : "a0000000-0000-0000-0000-000000000004",
        label: groupData.label,
        icon: groupData.icon,
        path: groupData.path,
        sortOrder: groupData.sortOrder,
        isActive: groupData.isActive,
      });
      console.log(`  Created menu group: ${groupData.label}`);
    } else {
      await group.update({
        icon: groupData.icon,
        path: groupData.path,
        sortOrder: groupData.sortOrder,
        isActive: groupData.isActive,
      });
      console.log(`  Updated menu group: ${groupData.label}`);
    }

    // Process items
    for (const itemData of groupData.items) {
      let item = await MenuItem.findOne({
        where: { menuGroupId: group.id, path: itemData.path },
      });

      if (!item) {
        item = await MenuItem.create({
          menuGroupId: group.id,
          label: itemData.label,
          path: itemData.path,
          icon: itemData.icon,
          requiredPermission: itemData.requiredPermission,
          sortOrder: itemData.sortOrder,
          isActive: itemData.isActive,
        });
        console.log(`    Created menu item: ${itemData.label}`);
      } else {
        await item.update({
          label: itemData.label,
          icon: itemData.icon,
          requiredPermission: itemData.requiredPermission,
          sortOrder: itemData.sortOrder,
          isActive: itemData.isActive,
        });
        console.log(`    Updated menu item: ${itemData.label}`);
      }
    }

    // Delete items that are not in the seed data
    const seedItemPaths = groupData.items.map((i) => i.path);
    await MenuItem.destroy({
      where: {
        menuGroupId: group.id,
        path: {
          [require("sequelize").Op.notIn]: seedItemPaths,
        },
      },
    });
  }

  console.log("Menu groups seeding completed.");
}

module.exports = { seedMenuGroups };
