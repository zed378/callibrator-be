const { db } = require('./');
const { logger } = require('../middlewares/activityLog');
const migrationService = require('../services/migration.service');

async function Up() {
  try {
    // Sync database tables
    await db.sync({ alter: true });
    console.log('Database Synced');
    logger.info('Database Synced');

    // Seed all database data using migration service
    const seedResult = await migrationService.seedAll();

    console.log('Seed Results:', {
      roles: seedResult.roles,
      permissions: seedResult.permissions,
      rolesPermissions: seedResult.rolesPermissions,
      tablePermissions: seedResult.tablePermissions,
      users: seedResult.users,
    });
    logger.info('Seed Results:', seedResult);

    const hasErrors = Object.values(seedResult).some(
      (result) => result.errors && result.errors.length > 0,
    );
    if (hasErrors) {
      console.warn('Some seeds failed:', seedResult);
    } else {
      console.log('Database seeded successfully');
    }
  } catch (error) {
    console.log(error);
    logger.error(error);
  }
}

async function Down() {
  try {
    await db.drop({});
    console.log('Table Dropped');
    logger.info('Table Dropped');
  } catch (error) {
    console.log(error);
    logger.info(error);
  }
}

module.exports = { Up, Down };
