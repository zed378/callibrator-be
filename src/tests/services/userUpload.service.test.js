/**
 * Tests for userUpload.service.js
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
  Users: {
    findByPk: jest.fn(),
  },
}));

const { deleteUpload, getUploadUrl } = require("../../utils/upload");
const { logger } = require("../../middlewares/activityLog");
const { AppError } = require("../../utils/appError");
const {
  updateUserAvatar,
  removeUserAvatar,
} = require("../../services/userUpload.service");
const { Users } = require("../../models");

describe("userUpload.service", () => {
  const mockUser = {
    id: "user-123",
    avatar: "/uploads/profile/old-avatar.png",
    update: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Users.findByPk.mockResolvedValue(mockUser);
    deleteUpload.mockResolvedValue(undefined);
    getUploadUrl.mockImplementation(
      (filename, folder) => `/${folder}/${filename}`,
    );
  });

  describe("updateUserAvatar", () => {
    it("should update user avatar successfully", async () => {
      const result = await updateUserAvatar(
        "user-123",
        "new-avatar.png",
        "user-123",
      );

      expect(deleteUpload).toHaveBeenCalledWith(
        "old-avatar.png",
        "uploads/profile",
      );
      expect(mockUser.update).toHaveBeenCalledWith(
        { avatar: "/uploads/profile/new-avatar.png" },
        { silent: true },
      );
      expect(logger.info).toHaveBeenCalledWith(
        "User avatar updated: user-123 by user-123",
      );
      expect(result).toEqual({
        data: { avatar: "/uploads/profile/new-avatar.png" },
        message: "User avatar updated successfully",
        status: 200,
      });
    });

    it("should handle user without existing avatar", async () => {
      Users.findByPk.mockResolvedValue({
        ...mockUser,
        avatar: null,
      });

      const result = await updateUserAvatar(
        "user-123",
        "new-avatar.png",
        "user-123",
      );

      expect(deleteUpload).not.toHaveBeenCalled();
      expect(mockUser.update).toHaveBeenCalledWith(
        { avatar: "/uploads/profile/new-avatar.png" },
        { silent: true },
      );
      expect(result).toEqual({
        data: { avatar: "/uploads/profile/new-avatar.png" },
        message: "User avatar updated successfully",
        status: 200,
      });
    });

    it("should throw 404 when user not found", async () => {
      Users.findByPk.mockResolvedValue(null);

      await expect(
        updateUserAvatar("invalid-id", "new-avatar.png", "user-123"),
      ).rejects.toThrow("User not found");
    });

    it("should continue if old avatar deletion fails", async () => {
      deleteUpload.mockRejectedValue(new Error("File not found"));

      const result = await updateUserAvatar(
        "user-123",
        "new-avatar.png",
        "user-123",
      );

      expect(logger.warn).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("removeUserAvatar", () => {
    it("should remove user avatar successfully", async () => {
      const result = await removeUserAvatar("user-123", "user-123");

      expect(deleteUpload).toHaveBeenCalledWith(
        "old-avatar.png",
        "uploads/profile",
      );
      expect(mockUser.update).toHaveBeenCalledWith(
        { avatar: null },
        { silent: true },
      );
      expect(logger.info).toHaveBeenCalledWith(
        "User avatar removed: user-123 by user-123",
      );
      expect(result).toEqual({
        data: { avatar: null },
        message: "User avatar removed successfully",
        status: 200,
      });
    });

    it("should do nothing if user has no avatar", async () => {
      Users.findByPk.mockResolvedValue({
        ...mockUser,
        avatar: null,
      });

      const result = await removeUserAvatar("user-123", "user-123");

      expect(deleteUpload).not.toHaveBeenCalled();
      expect(mockUser.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: { avatar: null },
        message: "User avatar removed successfully",
        status: 200,
      });
    });

    it("should throw 404 when user not found", async () => {
      Users.findByPk.mockResolvedValue(null);

      await expect(removeUserAvatar("invalid-id", "user-123")).rejects.toThrow(
        "User not found",
      );
    });
  });
});
