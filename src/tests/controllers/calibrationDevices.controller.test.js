/**
 * Tests for Calibration Devices Controller
 */

jest.mock("../../services/calibrationDevices.service", () => ({
  fetchCalibrationDevices: jest.fn(),
  fetchSpecificCalibrationDevice: jest.fn(),
  createCalibrationDevice: jest.fn(),
  updateCalibrationDevice: jest.fn(),
  deleteCalibrationDevice: jest.fn(),
}));

jest.mock("../../utils/response", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../../validators/calibrationDevices.validator", () => {
  const Joi = require("joi");
  return {
    getCalibrationDevicesQuery: Joi.object(),
    calibrationDeviceIdSchema: Joi.object(),
    createCalibrationDeviceSchema: Joi.object(),
    updateCalibrationDeviceSchema: Joi.object(),
    validate: jest.fn((data, schema) => {
      if (data.failValidation) {
        return {
          error: {
            details: [{ path: ["field"], message: "Validation error" }],
          },
          value: null,
        };
      }
      return { error: null, value: data };
    }),
  };
});

const calibrationDevicesController = require("../../controllers/calibrationDevices.controller");
const calibrationDevicesService = require("../../services/calibrationDevices.service");
const { success, error } = require("../../utils/response");
const { validate: validatorValidate } = require("../../validators/calibrationDevices.validator");

describe("calibrationDevicesController", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: { id: "user-1", tenantId: "tenant-1" },
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {},
    };

    success.mockImplementation((response, data, meta, message, status) => {
      response.status(status || 200).json({ success: true, data, meta, message });
    });
    error.mockImplementation((response, message, status) => {
      response.status(status || 500).json({ success: false, message });
    });
  });

  describe("getAllCalibrationDevices", () => {
    it("should fetch all devices successfully", async () => {
      calibrationDevicesService.fetchCalibrationDevices.mockResolvedValueOnce({
        success: true,
        status: 200,
        message: "Success",
        data: { rows: [{ id: "dev-1" }], meta: { total: 1 } },
      });

      await calibrationDevicesController.getAllCalibrationDevices(req, res);

      expect(calibrationDevicesService.fetchCalibrationDevices).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1" }),
      );
      expect(success).toHaveBeenCalled();
    });

    it("should call error response when validation fails", async () => {
      req.query = { failValidation: true };

      await calibrationDevicesController.getAllCalibrationDevices(req, res);

      expect(error).toHaveBeenCalled();
    });
  });

  describe("getSpecificCalibrationDevice", () => {
    it("should fetch device successfully", async () => {
      req.params = { calibrationDeviceId: "dev-1" };
      calibrationDevicesService.fetchSpecificCalibrationDevice.mockResolvedValueOnce({
        success: true,
        status: 200,
        message: "Success",
        data: { id: "dev-1" },
      });

      await calibrationDevicesController.getSpecificCalibrationDevice(req, res);

      expect(calibrationDevicesService.fetchSpecificCalibrationDevice).toHaveBeenCalledWith(
        "tenant-1",
        "dev-1",
      );
      expect(success).toHaveBeenCalled();
    });
  });

  describe("createCalibrationDevice", () => {
    it("should create device successfully", async () => {
      req.body = { name: "New Device" };
      calibrationDevicesService.createCalibrationDevice.mockResolvedValueOnce({
        success: true,
        status: 201,
        message: "Success",
        data: { id: "dev-1", name: "New Device" },
      });

      await calibrationDevicesController.createCalibrationDevice(req, res);

      expect(calibrationDevicesService.createCalibrationDevice).toHaveBeenCalledWith(
        "tenant-1",
        { name: "New Device" },
      );
      expect(success).toHaveBeenCalled();
    });
  });

  describe("updateCalibrationDevice", () => {
    it("should update device successfully", async () => {
      req.params = { calibrationDeviceId: "dev-1" };
      req.body = { name: "Updated Device" };
      calibrationDevicesService.updateCalibrationDevice.mockResolvedValueOnce({
        success: true,
        status: 200,
        message: "Success",
        data: { id: "dev-1", name: "Updated Device" },
      });

      await calibrationDevicesController.updateCalibrationDevice(req, res);

      expect(calibrationDevicesService.updateCalibrationDevice).toHaveBeenCalledWith(
        "tenant-1",
        "dev-1",
        { name: "Updated Device" },
      );
      expect(success).toHaveBeenCalled();
    });
  });

  describe("deleteCalibrationDevice", () => {
    it("should delete device successfully", async () => {
      req.params = { calibrationDeviceId: "dev-1" };
      calibrationDevicesService.deleteCalibrationDevice.mockResolvedValueOnce({
        success: true,
        status: 200,
        message: "Success",
        data: null,
      });

      await calibrationDevicesController.deleteCalibrationDevice(req, res);

      expect(calibrationDevicesService.deleteCalibrationDevice).toHaveBeenCalledWith(
        "tenant-1",
        "dev-1",
      );
      expect(success).toHaveBeenCalled();
    });
  });
});
