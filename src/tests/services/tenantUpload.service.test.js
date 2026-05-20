/**
 * Tests for tenantUpload.service.js
 */

// Mock appError first with proper constructor signature matching service usage
jest.mock("../../utils/appError", () => {
  class AppError extends Error {
    constructor(message, status, isOperational, details) {
      // Handle both (status, message) and (message, status) signatures
      let actualStatus, actualMessage;
      if (typeof message === "number") {
        actualStatus = message;
        actualMessage = status;
      } else {
        actualMessage = message;
        actualStatus = status;
      }
      super(actualMessage);
      this.name = "AppError";
      this.status = actualStatus || 500;
      this.isOperational = isOperational !== false;
    }
  }
  return { AppError };
});

// Mock dependencies before importing service
jest.mock("../../utils/upload", () => ({
  deleteUpload: jest.fn(),
  getUploadUrl: jest.fn((filename, folder) => `/${folder}/${filename}`),
}));

jest.mock("../../middlewares/activityLog", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../models", () => ({
  Tenants: {
    findByPk: jest.fn(),
  },
}));

const { deleteUpload, getUploadUrl } = require("../../utils/upload");
const { logger } = require("../../middlewares/activityLog");
const { AppError } = require("../../utils/appError");
const {
  updateTenantLogo,
  removeTenantLogo,
} = require("../../services/tenantUpload.service");
const { Tenants } = require("../../models");

describe("tenantUpload.service", () => {
  const mockTenant = {
    id: "tenant-123",
    logo: "/uploads/tenant/old-logo.png",
    update: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Tenants.findByPk.mockResolvedValue(mockTenant);
    deleteUpload.mockResolvedValue(undefined);
    getUploadUrl.mockImplementation(
      (filename, folder) => `/${folder}/${filename}`,
    );
  });

  describe("updateTenantLogo", () => {
    it("should update tenant logo successfully", async () => {
      const result = await updateTenantLogo(
        "tenant-123",
        "new-logo.png",
        "user-456",
      );

      expect(deleteUpload).toHaveBeenCalledWith(
        "old-logo.png",
        "uploads/tenant",
      );
      expect(mockTenant.update).toHaveBeenCalledWith(
        { logo: "/uploads/tenant/new-logo.png" },
        { silent: true },
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Tenant logo updated: tenant-123 by user-456",
      );
      expect(result).toEqual({
        data: { logo: "/uploads/tenant/new-logo.png" },
        message: "Tenant logo updated successfully",
        status: 200,
      });
    });

    it("should handle tenant without existing logo", async () => {
      Tenants.findByPk.mockResolvedValue({
        ...mockTenant,
        logo: null,
      });

      const result = await updateTenantLogo(
        "tenant-123",
        "new-logo.png",
        "user-456",
      );

      expect(deleteUpload).not.toHaveBeenCalled();
      expect(mockTenant.update).toHaveBeenCalledWith(
        { logo: "/uploads/tenant/new-logo.png" },
        { silent: true },
      );
      expect(result).toEqual({
        data: { logo: "/uploads/tenant/new-logo.png" },
        message: "Tenant logo updated successfully",
        status: 200,
      });
    });

    it("should throw 404 when tenant not found", async () => {
      Tenants.findByPk.mockResolvedValue(null);

      await expect(
        updateTenantLogo("invalid-id", "new-logo.png", "user-456"),
      ).rejects.toThrow("Tenant not found");
    });

    it("should continue if old logo deletion fails", async () => {
      deleteUpload.mockRejectedValue(new Error("File not found"));

      const result = await updateTenantLogo(
        "tenant-123",
        "new-logo.png",
        "user-456",
      );

      expect(logger.warn).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("removeTenantLogo", () => {
    it("should remove tenant logo successfully", async () => {
      const result = await removeTenantLogo("tenant-123", "user-456");

      expect(deleteUpload).toHaveBeenCalledWith(
        "old-logo.png",
        "uploads/tenant",
      );
      expect(mockTenant.update).toHaveBeenCalledWith(
        { logo: null },
        { silent: true },
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Tenant logo removed: tenant-123 by user-456",
      );
      expect(result).toEqual({
        data: { logo: null },
        message: "Tenant logo removed successfully",
        status: 200,
      });
    });

    it("should do nothing if tenant has no logo", async () => {
      Tenants.findByPk.mockResolvedValue({
        ...mockTenant,
        logo: null,
      });

      const result = await removeTenantLogo("tenant-123", "user-456");

      expect(deleteUpload).not.toHaveBeenCalled();
      expect(mockTenant.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: { logo: null },
        message: "Tenant logo removed successfully",
        status: 200,
      });
    });

    it("should throw 404 when tenant not found", async () => {
      Tenants.findByPk.mockResolvedValue(null);

      await expect(removeTenantLogo("invalid-id", "user-456")).rejects.toThrow(
        "Tenant not found",
      );
    });
  });
});
