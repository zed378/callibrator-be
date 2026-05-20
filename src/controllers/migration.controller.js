const { Up, Down } = require('../config/migrate');
const migrationService = require('../services/migration.service');

// ==========================================
// MIGRATE
// ==========================================

exports.migrate = async (req, res) => {
  try {
    await Up();

    res.status(200).send({
      success: true,
      status: 200,
      message: 'Database table migrate success',
    });
  } catch (error) {
    res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};

// ==========================================
// DROP TABLE
// ==========================================

exports.dropTable = async (req, res) => {
  try {
    await Down();

    res.status(200).send({
      success: true,
      status: 200,
      message: 'Database table drop successfully',
    });
  } catch (error) {
    res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};

// ==========================================
// SEEDING
// ==========================================

exports.seeding = async (req, res) => {
  try {
    const result = await migrationService.seedAll();

    return res.status(200).send({
      success: true,
      status: 200,
      message: 'Seeding success',
      data: result,
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};

// ==========================================
// UNSEEDING
// ==========================================

exports.unseeding = async (req, res) => {
  try {
    const result = await migrationService.unseedAll();

    return res.status(200).send({
      success: true,
      status: 200,
      message: 'Unseeding success',
      data: result,
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};
