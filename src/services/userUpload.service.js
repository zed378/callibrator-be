const { Users } = require("../models");
const { logger } = require("../middlewares/activityLog");
const { AppError } = require("../utils/appError");
const { deleteUpload, getUploadUrl } = require("../utils/upload");

// ==========================================
// USER AVATAR UPLOAD SERVICE
// ==========================================

/**
 * Update user avatar
 * @param {string} userId - User identifier
 * @param {string} filename - Uploaded filename
 * @param {string} updatedBy - User ID who updated
 */
exports.updateUserAvatar = async (userId, filename, updatedBy) => {
  try {
    const user = await Users.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Delete old avatar if exists
    if (user.avatar) {
      const oldFilename = user.avatar.split("/").pop();
      try {
        await deleteUpload(oldFilename, "uploads/profile");
      } catch (err) {
        logger.warn(`Failed to delete old avatar: ${oldFilename}`, err);
      }
    }

    // Update user with new avatar
    const avatarUrl = getUploadUrl(filename, "uploads/profile");
    await user.update({ avatar: avatarUrl }, { silent: true });

    logger.info(`User avatar updated: ${userId} by ${updatedBy}`);

    return {
      data: { avatar: avatarUrl },
      message: "User avatar updated successfully",
      status: 200,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error updating user avatar", { error: error.message });
    throw new AppError("Failed to update user avatar", 500);
  }
};

/**
 * Remove user avatar
 * @param {string} userId - User identifier
 * @param {string} updatedBy - User ID who updated
 */
exports.removeUserAvatar = async (userId, updatedBy) => {
  try {
    const user = await Users.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Delete avatar file if exists
    if (user.avatar) {
      const filename = user.avatar.split("/").pop();
      try {
        await deleteUpload(filename, "uploads/profile");
      } catch (err) {
        logger.warn(`Failed to delete avatar file: ${filename}`, err);
      }

      await user.update({ avatar: null }, { silent: true });
      logger.info(`User avatar removed: ${userId} by ${updatedBy}`);
    }

    return {
      data: { avatar: null },
      message: "User avatar removed successfully",
      status: 200,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error removing user avatar", { error: error.message });
    throw new AppError("Failed to remove user avatar", 500);
  }
};
