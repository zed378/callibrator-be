const { db } = require("./");
const { waitForDbReady } = require("../utils/dbReady");
const { logger } = require("../middlewares/activityLog");

/**
 * Database Connection with Retry Mechanism
 *
 * This function attempts to connect to the database with exponential backoff.
 * It uses the waitForDbReady utility for robust retry logic.
 *
 * @param {Object} options - Connection options
 * @param {number} options.maxAttempts - Maximum number of connection attempts (default: 20)
 * @param {number} options.delayMs - Initial delay between attempts in milliseconds (default: 3000)
 * @param {number} options.backoffMultiplier - Multiplier for exponential backoff (default: 2)
 * @returns {Promise<string>} Connection status message
 */
async function Connection({
  maxAttempts = 20,
  delayMs = 3000,
  backoffMultiplier = 2,
} = {}) {
  try {
    logger.info("Initializing database connection with retry mechanism...");

    // Use waitForDbReady for robust retry logic
    const readyMsg = await waitForDbReady(db, {
      maxAttempts,
      delayMs,
    });

    logger.info(readyMsg);

    // Verify connection with a simple query
    await db.query("SELECT 1");
    logger.info("DB Connected successfully");

    return readyMsg;
  } catch (error) {
    const errorMsg = {
      status: "DB Connection Failed",
      message: error.message,
      stack: error.stack,
    };

    console.error(errorMsg);
    logger.error(
      `DB Connection Failed after ${maxAttempts} attempts: ${error.message}`,
    );

    // Exit process if database connection fails after all retries
    process.exit(1);
  }
}

module.exports = { Connection };
