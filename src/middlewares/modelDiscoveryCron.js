const cron = require("node-cron");
const { logger } = require("./activityLog");
const modelDiscoveryService = require("../services/modelDiscovery.service");
const migrationService = require("../services/migration.service");
const cronExp = process.env.MODEL_DISCOVERY_SCHEDULER || "0 2 * * *";

/**
 * Run model discovery and sync
 * Discovers all models and creates/updates table permissions
 */
async function runModelDiscovery() {
  try {
    console.log("[INFO] Model discovery cron job started");
    logger.info("Model discovery cron job started");

    // Discover and seed models with existing permissions sync
    const discoveryResult =
      await modelDiscoveryService.discoverAndSeedModels(true);

    console.log(
      `[INFO] Model discovery completed: ${discoveryResult.modelsFound} models found`,
    );
    logger.info(
      `Model discovery completed: ${discoveryResult.modelsFound} models found`,
    );

    // Sync table permissions from existing permissions
    const syncResult =
      await migrationService.syncTablePermissionsFromPermissions();

    console.log(
      `[INFO] Table permission sync completed: ${syncResult.tablePermissionsCreated} created`,
    );
    logger.info(
      `Table permission sync completed: ${syncResult.tablePermissionsCreated} created`,
    );

    console.log("Model discovery cron job completed successfully");
    logger.info("Model discovery cron job completed successfully");
  } catch (error) {
    console.error(`[ERROR] Model discovery cron job failed: ${error.message}`);
    logger.error(`Model discovery cron job failed: ${error.message}`);
  }
}

/**
 * Initialize model discovery cron job
 */
const cronModelDiscovery = () => {
  const message =
    cronExp !== "0 0 * * *"
      ? `Model discovery cron expression set to ${cronExp}`
      : "Model discovery cron job started at 02:00 AM +0700";
  console.log(message);
  logger.info(message);

  cron.schedule(cronExp, async () => {
    console.log("Running model discovery cron job");
    logger.info("Running model discovery cron job");

    try {
      await runModelDiscovery();
      console.log("Model discovery cron job completed successfully");
      logger.info("Model discovery cron job completed successfully");
    } catch (error) {
      console.error("Error during model discovery cron job:", error.message);
      logger.error(`Error during model discovery cron job: ${error.message}`);
    }
  });
};

module.exports = { runModelDiscovery, cronModelDiscovery };
