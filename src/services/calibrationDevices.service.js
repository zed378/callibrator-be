/**
 * Calibration Device service methods
 */
const { Op } = require("sequelize");
const { CalibrationDevice } = require("../models");
const { logger } = require("../middlewares/activityLog");
const { AppError } = require("../utils/appError");
const { DEFAULT_LIMIT } = require("../constants");

// ==========================================
// VALIDATION HELPERS
// ==========================================

const validate = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw {
      status: 400,
      message: "Validation failed",
      errors: error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      })),
    };
  }
  return value;
};

// ==========================================
// SERVICE METHODS
// ==========================================

/**
 * Fetch all calibration devices for a tenant with pagination and filtering
 */
exports.fetchCalibrationDevices = async ({
  tenantId,
  find,
  page = 1,
  limit = DEFAULT_LIMIT,
  status,
  category,
}) => {
  try {
    const whereClause = { tenantId };

    if (find) {
      const searchTerm = `%${find.toLowerCase()}%`;
      whereClause[Op.or] = [
        { name: { [Op.iLike]: searchTerm } },
        { serialNumber: { [Op.iLike]: searchTerm } },
        { manufacturer: { [Op.iLike]: searchTerm } },
      ];
    }

    if (status) {
      whereClause.status = status.toLowerCase();
    }

    if (category) {
      whereClause.category = category;
    }

    const { rows, count } = await CalibrationDevice.findAndCountAll({
      where: whereClause,
      order: [["name", "ASC"]],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      include: [
        {
          association: "warehouse",
          attributes: ["id", "name", "code"],
        },
      ],
    });

    return {
      success: true,
      status: 200,
      message: "Fetch calibration devices successful",
      data: {
        rows,
        count,
        meta: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit)),
        },
      },
    };
  } catch (error) {
    logger.error("Error fetching calibration devices", {
      error: error.message,
    });
    throw error;
  }
};

/**
 * Fetch a specific calibration device by ID
 */
exports.fetchSpecificCalibrationDevice = async (
  tenantId,
  calibrationDeviceId,
) => {
  try {
    const device = await CalibrationDevice.findOne({
      where: { id: calibrationDeviceId, tenantId },
      include: [
        {
          association: "warehouse",
          attributes: ["id", "name", "code"],
        },
        {
          association: "calibrationRecords",
          order: [["calibrationDate", "DESC"]],
          limit: 10,
          attributes: { exclude: ["results"] },
        },
      ],
    });

    if (!device) {
      return {
        success: false,
        status: 404,
        message: "Calibration device not found",
        data: null,
      };
    }

    return {
      success: true,
      status: 200,
      message: "Fetch calibration device successful",
      data: device,
    };
  } catch (error) {
    logger.error("Error fetching specific calibration device", {
      error: error.message,
      calibrationDeviceId,
    });
    throw error;
  }
};

/**
 * Create a new calibration device
 */
exports.createCalibrationDevice = async (tenantId, inputData) => {
  try {
    const validated = validate(
      inputData,
      require("../validators/calibrationDevices.validator")
        .createCalibrationDeviceSchema,
    );

    // Check for duplicate serial number
    const existing = await CalibrationDevice.findOne({
      where: {
        tenantId,
        serialNumber: validated.serialNumber,
      },
    });

    if (existing) {
      return {
        success: false,
        status: 409,
        message: "Calibration device with this serial number already exists",
        data: null,
      };
    }

    const device = await CalibrationDevice.create({
      ...validated,
      tenantId,
    });

    return {
      success: true,
      status: 201,
      message: "Calibration device created successfully",
      data: device,
    };
  } catch (error) {
    logger.error("Error creating calibration device", { error: error.message });
    throw error;
  }
};

/**
 * Update an existing calibration device
 */
exports.updateCalibrationDevice = async (
  tenantId,
  calibrationDeviceId,
  inputData,
) => {
  try {
    const validated = validate(
      inputData,
      require("../validators/calibrationDevices.validator")
        .updateCalibrationDeviceSchema,
    );

    const device = await CalibrationDevice.findOne({
      where: { id: calibrationDeviceId, tenantId },
    });

    if (!device) {
      return {
        success: false,
        status: 404,
        message: "Calibration device not found",
        data: null,
      };
    }

    await device.update(validated);

    return {
      success: true,
      status: 200,
      message: "Calibration device updated successfully",
      data: device,
    };
  } catch (error) {
    logger.error("Error updating calibration device", { error: error.message });
    throw error;
  }
};

/**
 * Soft-delete a calibration device
 */
exports.deleteCalibrationDevice = async (tenantId, calibrationDeviceId) => {
  try {
    const device = await CalibrationDevice.findOne({
      where: { id: calibrationDeviceId, tenantId },
    });

    if (!device) {
      return {
        success: false,
        status: 404,
        message: "Calibration device not found",
        data: null,
      };
    }

    await device.softDelete();

    return {
      success: true,
      status: 200,
      message: "Calibration device deleted successfully",
      data: null,
    };
  } catch (error) {
    logger.error("Error deleting calibration device", { error: error.message });
    throw error;
  }
};
