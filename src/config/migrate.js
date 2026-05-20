const { db } = require('./');
const { logger } = require('../middlewares/activityLog');

async function Up() {
  try {
    // Sync database tables
    await db.sync({ alter: true });
    console.log('Database Synced');
    logger.info('Database Synced');
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
