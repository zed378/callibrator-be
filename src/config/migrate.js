const { db } = require("./");
const { logger } = require("../middlewares/activityLog");
const { seedRolesAndPermissions } = require("../utils/seedPermissions");
const { Roles, Permissions, UserPermissions } = require("../models");

async function Up() {
  try {
    // Sync database tables
    await db.sync({ alter: true });
    console.log("Database Synced");
    logger.info("Database Synced");

    // Seed roles and permissions
    const models = { Roles, Permissions, UserPermissions };
    const seedResult = await seedRolesAndPermissions(models);

    console.log("Seed Results:", {
      rolesCreated: seedResult.rolesCreated,
      rolesUpdated: seedResult.rolesUpdated,
      permissionsCreated: seedResult.permissionsCreated,
      permissionsUpdated: seedResult.permissionsUpdated,
      errors: seedResult.errors,
    });
    logger.info("Seed Results:", seedResult);

    if (seedResult.errors.length > 0) {
      console.warn("Some seeds failed:", seedResult.errors);
    } else {
      console.log("Roles and permissions seeded successfully");
    }
  } catch (error) {
    console.log(error);
    logger.error(error);
  }
}

async function Down() {
  try {
    await db.drop({});
    console.log("Table Dropped");
    logger.info("Table Dropped");
  } catch (error) {
    console.log(error);
    logger.info(error);
  }
}

module.exports = { Up, Down };
