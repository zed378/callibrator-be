/**
 * Tests for upload.js utility
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

// Mock multer - diskStorage is a static method on the multer function
jest.mock("multer", () => {
  function multer() {
    // Instance methods for middleware creation
    return {
      single: jest.fn(() => jest.fn((req, res, next) => next())),
      array: jest.fn(() => jest.fn((req, res, next) => next())),
    };
  }
  // Static method for storage configuration (called at module load time)
  multer.diskStorage = jest.fn((config) => {
    return {
      destination: config.destination,
      filename: config.filename,
    };
  });
  return multer;
});

const {
  deleteUpload,
  getUploadUrl,
  upload,
  uploadMulti,
} = require("../../utils/upload");

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

    it("should use default uploads folder when folder not provided", async () => {
      const unlinkSpy = jest
        .spyOn(fs, "unlink")
        .mockImplementation((path, cb) => cb(null));

      await expect(deleteUpload("test-file.png")).resolves.toBeUndefined();

      expect(unlinkSpy).toHaveBeenCalledWith(
        expect.stringContaining("test-file.png"),
        expect.any(Function),
      );

      unlinkSpy.mockRestore();
    });

    it("should log error when file deletion fails", async () => {
      const { logger } = require("../../middlewares/activityLog");
      const unlinkSpy = jest
        .spyOn(fs, "unlink")
        .mockImplementation((path, cb) => cb(new Error("Permission denied")));

      await expect(deleteUpload("locked-file.png", "uploads")).rejects.toThrow(
        "Permission denied",
      );

      expect(logger.error).toHaveBeenCalled();

      unlinkSpy.mockRestore();
    });
  });

  describe("upload middleware factory", () => {
    it("should return a middleware function", () => {
      const middleware = upload();
      expect(typeof middleware).toBe("function");
    });

    it("should set uploadFolder on request", () => {
      const middleware = upload({ folder: "uploads/profile" });
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.uploadFolder).toBe("uploads/profile");
    });

    it("should use default uploads folder when not specified", () => {
      const middleware = upload();
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.uploadFolder).toBe("uploads");
    });

    it("should set allowedMimes when provided", () => {
      const middleware = upload({
        allowedMimes: ["image/jpeg", "image/png"],
      });
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.allowedMimes).toEqual(["image/jpeg", "image/png"]);
    });

    it("should set allowedExtensions when provided", () => {
      const middleware = upload({
        allowedExtensions: [".jpg", ".jpeg"],
      });
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.allowedExtensions).toEqual([".jpg", ".jpeg"]);
    });

    it("should call next on successful upload", () => {
      const middleware = upload();
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("uploadMulti middleware factory", () => {
    it("should return a middleware function", () => {
      const middleware = uploadMulti();
      expect(typeof middleware).toBe("function");
    });

    it("should set uploadFolder on request", () => {
      const middleware = uploadMulti({ folder: "uploads/documents" });
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.uploadFolder).toBe("uploads/documents");
    });

    it("should use default folder when not specified", () => {
      const middleware = uploadMulti();
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.uploadFolder).toBe("uploads");
    });

    it("should call next on successful upload", () => {
      const middleware = uploadMulti();
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("storage configuration", () => {
    it("should use default allowed MIME types", () => {
      const middleware = upload();
      const req = { originalname: "test.jpg" };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.allowedMimes).toBeUndefined();
    });

    it("should use default allowed file extensions", () => {
      const middleware = upload();
      const req = { originalname: "test.jpg" };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.allowedExtensions).toBeUndefined();
    });
  });
});
