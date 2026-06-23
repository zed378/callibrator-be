/**
 * Tests for calibrationDevices.service.js
 */

jest.mock("sequelize", () => ({
  Op: {
    or: Symbol("or"),
    iLike: Symbol("iLike"),
  },
}));

jest.mock("../../models", () => ({
  CalibrationDevice: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../../middlewares/activityLog", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../utils/appError", () => {
  class AppError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  return { AppError };
});

jest.mock("../../validators/calibrationDevices.validator", () => ({
  createCalibrationDeviceSchema: {
    validate: jest.fn(),
  },
  updateCalibrationDeviceSchema: {
    validate: jest.fn(),
  },
}));

const { CalibrationDevice } = require("../../models");
const validator = require("../../validators/calibrationDevices.validator");
const {
  fetchCalibrationDevices,
  fetchSpecificCalibrationDevice,
  createCalibrationDevice,
  updateCalibrationDevice,
  deleteCalibrationDevice,
} = require("../../services/calibrationDevices.service");

describe("calibrationDevices.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchCalibrationDevices", () => {
    it("should fetch calibration devices successfully without query params", async () => {
      CalibrationDevice.findAndCountAll.mockResolvedValueOnce({
        rows: [{ id: "device-1", name: "Device 1" }],
        count: 1,
      });

      const result = await fetchCalibrationDevices({ tenantId: "tenant-1" });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.meta.total).toBe(1);
    });

    it("should fetch with query params (find, status, category)", async () => {
      CalibrationDevice.findAndCountAll.mockResolvedValueOnce({
        rows: [{ id: "device-1", name: "Search Device" }],
        count: 1,
      });

      const result = await fetchCalibrationDevices({
        tenantId: "tenant-1",
        find: "search",
        status: "ACTIVE",
        category: "Temp",
        page: 2,
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(CalibrationDevice.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-1",
            status: "active",
            category: "Temp",
          }),
          limit: 5,
          offset: 5,
        }),
      );
    });

    it("should handle error during fetching", async () => {
      CalibrationDevice.findAndCountAll.mockRejectedValueOnce(new Error("Db error"));
      await expect(
        fetchCalibrationDevices({ tenantId: "tenant-1" }),
      ).rejects.toThrow("Db error");
    });
  });

  describe("fetchSpecificCalibrationDevice", () => {
    it("should fetch a specific device successfully", async () => {
      CalibrationDevice.findOne.mockResolvedValueOnce({
        id: "device-1",
        name: "Device 1",
      });

      const result = await fetchSpecificCalibrationDevice("tenant-1", "device-1");

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data.name).toBe("Device 1");
    });

    it("should return 404 if device is not found", async () => {
      CalibrationDevice.findOne.mockResolvedValueOnce(null);

      const result = await fetchSpecificCalibrationDevice("tenant-1", "device-1");

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.data).toBeNull();
    });

    it("should handle error during fetchSpecificCalibrationDevice", async () => {
      CalibrationDevice.findOne.mockRejectedValueOnce(new Error("Db error"));
      await expect(
        fetchSpecificCalibrationDevice("tenant-1", "device-1"),
      ).rejects.toThrow("Db error");
    });
  });

  describe("createCalibrationDevice", () => {
    it("should throw a 400 error when validation fails", async () => {
      validator.createCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: {
          details: [{ path: ["name"], message: "Name is required" }],
        },
      });

      await expect(
        createCalibrationDevice("tenant-1", { serialNumber: "123" }),
      ).rejects.toEqual(
        expect.objectContaining({
          status: 400,
          message: "Validation failed",
        }),
      );
    });

    it("should return 409 if device serial number already exists", async () => {
      validator.createCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: null,
        value: { name: "Device A", serialNumber: "SN123" },
      });
      CalibrationDevice.findOne.mockResolvedValueOnce({
        id: "existing-device",
        serialNumber: "SN123",
      });

      const result = await createCalibrationDevice("tenant-1", {
        name: "Device A",
        serialNumber: "SN123",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(409);
      expect(result.message).toContain("already exists");
    });

    it("should create device successfully if all valid", async () => {
      const inputData = { name: "Device A", serialNumber: "SN123" };
      validator.createCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: null,
        value: inputData,
      });
      CalibrationDevice.findOne.mockResolvedValueOnce(null);
      CalibrationDevice.create.mockResolvedValueOnce({
        id: "new-device",
        ...inputData,
      });

      const result = await createCalibrationDevice("tenant-1", inputData);

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(result.data.id).toBe("new-device");
    });

    it("should handle error during create", async () => {
      validator.createCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: null,
        value: { name: "Device A" },
      });
      CalibrationDevice.findOne.mockRejectedValueOnce(new Error("Db error"));

      await expect(
        createCalibrationDevice("tenant-1", { name: "Device A" }),
      ).rejects.toThrow("Db error");
    });
  });

  describe("updateCalibrationDevice", () => {
    it("should throw a 400 error when validation fails", async () => {
      validator.updateCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: {
          details: [{ path: ["name"], message: "Name must be string" }],
        },
      });

      await expect(
        updateCalibrationDevice("tenant-1", "device-1", { name: 123 }),
      ).rejects.toEqual(
        expect.objectContaining({
          status: 400,
        }),
      );
    });

    it("should return 404 if device is not found", async () => {
      validator.updateCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: null,
        value: { name: "Updated Name" },
      });
      CalibrationDevice.findOne.mockResolvedValueOnce(null);

      const result = await updateCalibrationDevice("tenant-1", "device-1", {
        name: "Updated Name",
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("should update device successfully", async () => {
      validator.updateCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: null,
        value: { name: "Updated Name" },
      });
      const mockDevice = {
        id: "device-1",
        name: "Device 1",
        update: jest.fn().mockResolvedValueOnce(true),
      };
      CalibrationDevice.findOne.mockResolvedValueOnce(mockDevice);

      const result = await updateCalibrationDevice("tenant-1", "device-1", {
        name: "Updated Name",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockDevice.update).toHaveBeenCalledWith({ name: "Updated Name" });
    });

    it("should handle error during update", async () => {
      validator.updateCalibrationDeviceSchema.validate.mockReturnValueOnce({
        error: null,
        value: { name: "Updated Name" },
      });
      CalibrationDevice.findOne.mockRejectedValueOnce(new Error("Db error"));

      await expect(
        updateCalibrationDevice("tenant-1", "device-1", { name: "Updated Name" }),
      ).rejects.toThrow("Db error");
    });
  });

  describe("deleteCalibrationDevice", () => {
    it("should return 404 if device is not found", async () => {
      CalibrationDevice.findOne.mockResolvedValueOnce(null);

      const result = await deleteCalibrationDevice("tenant-1", "device-1");

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it("should delete device successfully", async () => {
      const mockDevice = {
        id: "device-1",
        softDelete: jest.fn().mockResolvedValueOnce(true),
      };
      CalibrationDevice.findOne.mockResolvedValueOnce(mockDevice);

      const result = await deleteCalibrationDevice("tenant-1", "device-1");

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockDevice.softDelete).toHaveBeenCalled();
    });

    it("should handle error during delete", async () => {
      CalibrationDevice.findOne.mockRejectedValueOnce(new Error("Db error"));

      await expect(
        deleteCalibrationDevice("tenant-1", "device-1"),
      ).rejects.toThrow("Db error");
    });
  });
});
