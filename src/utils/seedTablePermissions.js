// DEPRECATED: This file has been removed as part of ABAC removal.
// The simplified RBAC system uses RoleMenuPermission with permissionType ("read" | "write")
// Menu group permissions are now seeded via seedMenuGroups.js using seedRoleMenuPermissions()
// Table-level permissions are no longer supported in the simplified architecture.

const { logger } = require("../middlewares/activityLog");

logger.info(
  "Table permissions seed is deprecated - ABAC removed in simplified RBAC",
);

async function seedTablePermissions() {
  logger.info("Table permissions seeding skipped (deprecated - ABAC removed)");
  return true;
}

module.exports = {
  seedTablePermissions,
};
