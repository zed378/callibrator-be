const { db } = require("./");
const { logger } = require("../middlewares/activityLog");

async function Up() {
  try {
    // Sync database tables
    await db.sync({ alter: true });
    logger.info("Database Synced");
  } catch (error) {
    logger.error(`Database sync failed: ${error.message}`);
  }
}

async function Down() {
  try {
    await db.drop({});
    logger.info("Table Dropped");
  } catch (error) {
    logger.error(`Table drop failed: ${error.message}`);
  }
}

module.exports = { Up, Down };
