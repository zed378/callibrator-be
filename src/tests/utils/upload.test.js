/**
 * Tests for upload.js utility
 * Note: Only tests pure functions (getUploadUrl, deleteUpload) that don't
 * require multer/uuid initialization at module load time.
 */

const fs = require("fs");

// Mock storagePath before any other mocks
jest.mock("../../utils/storagePath", () => {
  return jest.fn((...paths) => "/storage/" + paths.join("/"));
});

// Mock activityLog before upload.js loads
jest.mock("../../middlewares/activityLog", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock appError before upload.js loads
jest.mock("../../utils/appError", () => {
  class AppError extends Error {
    constructor(message, status, isOperational, details) {
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

// Mock uuid with a CommonJS-compatible mock
jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid-12345"),
}));

// Mock multer - diskStorage must be a function on the multer object itself
jest.mock("multer", () => {
  const multerInstance = jest.fn();
  multerInstance.diskStorage = jest.fn((config) => {
    // diskStorage returns undefined, it calls callbacks synchronously
    return {
      destination: config.destination,
      filename: config.filename,
    };
  });
  multerInstance.prototype.single = jest
    .fn()
    .mockReturnValue(jest.fn((req, res, next) => next()));
  multerInstance.prototype.array = jest
    .fn()
    .mockReturnValue(jest.fn((req, res, next) => next()));
  return multerInstance;
});

const { deleteUpload, getUploadUrl } = require("../../utils/upload");

describe("upload utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUploadUrl", () => {
    it("should generate correct URL for file in uploads folder", () => {
      const url = getUploadUrl("test-image.png", "uploads");
      expect(url).toBe("/uploads/test-image.png");
    });

    it("should generate correct URL for file in uploads/profile folder", () => {
      const url = getUploadUrl("avatar.png", "uploads/profile");
      expect(url).toBe("/uploads/profile/avatar.png");
    });

    it("should generate correct URL for file in uploads/tenant folder", () => {
      const url = getUploadUrl("logo.png", "uploads/tenant");
      expect(url).toBe("/uploads/tenant/logo.png");
    });

    it("should default to uploads folder when folder not specified", () => {
      const url = getUploadUrl("file.jpg");
      expect(url).toBe("/uploads/file.jpg");
    });
  });

  describe("deleteUpload", () => {
    it("should delete file from uploads folder", async () => {
      const unlinkSpy = jest
        .spyOn(fs, "unlink")
        .mockImplementation((path, cb) => cb(null));

      await expect(
        deleteUpload("test-file.png", "uploads"),
      ).resolves.toBeUndefined();

      expect(unlinkSpy).toHaveBeenCalledWith(
        expect.stringContaining("test-file.png"),
        expect.any(Function),
      );

      unlinkSpy.mockRestore();
    });

    it("should reject with error when file deletion fails", async () => {
      const unlinkSpy = jest
        .spyOn(fs, "unlink")
        .mockImplementation((path, cb) => cb(new Error("File not found")));

      await expect(deleteUpload("nonexistent.png", "uploads")).rejects.toThrow(
        "File not found",
      );

      unlinkSpy.mockRestore();
    });
  });
});
