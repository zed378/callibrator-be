const { Up, Down } = require("../config/migrate");
const migrationService = require("../services/migration.service");
const { success } = require("../utils/response");

// ==========================================
// MIGRATE
// ==========================================

exports.migrate = async (req, res, next) => {
  try {
    await Up();

    success(res, null, null, "Database table migrate success", 200);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// DROP TABLE
// ==========================================

exports.dropTable = async (req, res, next) => {
  try {
    await Down();

    success(res, null, null, "Database table drop successfully", 200);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SEEDING
// ==========================================

exports.seeding = async (req, res, next) => {
  try {
    const result = await migrationService.seedAll();

    success(res, result, null, "Seeding success", 200);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UNSEEDING
// ==========================================

exports.unseeding = async (req, res, next) => {
  try {
    const result = await migrationService.unseedAll();

    success(res, result, null, "Unseeding success", 200);
  } catch (error) {
    next(error);
  }
};
