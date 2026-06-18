// src/services/userService.js
const { Op, Sequelize } = require("sequelize");
const { db } = require("../config");
const { Users, Roles } = require("../models");
const { logger } = require("../middlewares/activityLog");
const { hashPassword } = require("../utils/password");
const { deleteUpload, getUploadUrl } = require("../utils/upload");
const { AppError } = require("../utils/appError");
const {
  SUPER_ADMIN_ROLE_ID,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require("../constants");
const {
  validate: validateInput,
  formatErrors,
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  checkUsernameSchema,
} = require("../validators/user.validator");

// Permission assignment moved to role-based model (RoleMenuPermission)
// userMenuGrant.service removed - now using role_menu_permissions table directly

// ==========================================
// VALIDATION HELPERS
// ==========================================

const validate = (data, schema) => {
  const { error, value } = validateInput(data, schema);
  if (error) {
    throw {
      status: 400,
      message: "Validation failed",
      errors: formatErrors(error.details),
    };
  }
  return value;
};

// ------------------------------------------------------------------
// Helper: build safe attribute list
// ------------------------------------------------------------------
const safeUserAttributes = {
  exclude: [
    "updatedAt",
    "otp_code",
    "otp_expired_at",
    "otp_request_count",
    "password",
    "otp_last_requested_at",
    "failed_login_attempts",
    "locked_until",
    "password_changed_at",
    "status",
    "role_id",
  ],
};

// ------------------------------------------------------------------
// GET ALL USERS
// ------------------------------------------------------------------
exports.fetchUsers = async ({
  tenantId,
  roleFilter,
  role,
  find,
  page = 1,
  limit = DEFAULT_LIMIT,
}) => {
  let transaction;
  try {
    // Resolve role → roleId (if needed)
    let roleId = null;
    if (role && typeof role === "object" && role.id) {
      roleId = role.id;
    } else if (typeof role === "string") {
      const roleRecord = await Roles.findOne({
        where: { name: role },
        attributes: ["id"],
      });
      roleId = roleRecord ? roleRecord.id : null;
    }

    // Build WHERE clause
    const whereClause = {};

    // Tenant scoping – skip for SUPER_ADMIN
    if (roleId !== SUPER_ADMIN_ROLE_ID) {
      whereClause.tenantId = tenantId;
      whereClause.roleId = {
        [Op.notIn]: [SUPER_ADMIN_ROLE_ID],
      };
    }

    // Free-text search
    if (find && typeof find === "string" && find.trim() !== "") {
      const searchTerm = `%${find.toLowerCase()}%`;
      whereClause[Op.or] = [
        { username: { [Op.like]: searchTerm } },
        { firstName: { [Op.like]: searchTerm } },
        { lastName: { [Op.like]: searchTerm } },
        { email: { [Op.like]: searchTerm } },
      ];
    }

    // filter by role
    if (roleFilter && roleFilter !== SUPER_ADMIN_ROLE_ID) {
      whereClause.roleId = roleFilter;
    }

    // Pagination
    const safeLimit = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = (Math.max(Number(page), 1) - 1) * safeLimit;

    transaction = await db.transaction();

    const data = await Users.findAndCountAll({
      attributes: safeUserAttributes,
      where: whereClause,
      order: [["firstName", "ASC"]],
      limit: safeLimit,
      offset: offset,
      include: [
        {
          model: Roles,
          as: "role",
          attributes: ["id", "name", "description"],
        },
      ],
      transaction,
    });

    // Shape response
    const avatarBaseUrl = `${process.env.HOST_URL || ""}/uploads/profile/`;
    const rowsWithAvatars = data.rows.map((user) => {
      const plain = user.get();
      const avatar = plain.avatar_url || "";
      return {
        ...plain,
        avatarUrl: avatarBaseUrl + avatar,
      };
    });

    const totalPages = Math.ceil(data.count / safeLimit);

    if (transaction) await transaction.commit();

    // Count users by status (single query with grouping)
    const statusCounts = { ACTIVE: 0, INACTIVE: 0, LOCKED: 0, SUSPENDED: 0 };
    try {
      const statusRows = await Users.findAll({
        attributes: [
          [Sequelize.col("status"), "status"],
          [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
        ],
        paranoid: false,
        group: ["status"],
        raw: true,
      });
      for (const row of statusRows) {
        if (statusCounts.hasOwnProperty(row.status)) {
          statusCounts[row.status] = parseInt(row.count, 10);
        }
      }
    } catch (statusErr) {
      logger.error("Failed to fetch user status counts", {
        error: statusErr.message,
        stack: statusErr.stack,
      });
    }

    return {
      success: true,
      status: 200,
      message: "Fetch users successful",
      data: {
        count: data.count,
        rows: rowsWithAvatars,
        avatarBaseUrl,
      },
      meta: {
        total: data.count,
        statusCounts,
        page: Number(page) || 1,
        limit: safeLimit,
        totalPages,
        hasNextPage: (Number(page) || 1) < totalPages,
        hasPrevPage: (Number(page) || 1) > 1,
      },
    };
  } catch (err) {
    if (transaction) await transaction.rollback();

    logger.error("Error fetching users", {
      err: err.message,
      stack: err.stack,
      tenantId,
      role: role && role.id ? role.id : role,
      find,
      page,
      limit,
    });

    throw {
      status: err.status || 500,
      message: err.message || "Internal server error",
    };
  }
};

// ------------------------------------------------------------------
// GET SPECIFIC USER
// ------------------------------------------------------------------
exports.fetchSpecificUser = async (userId) => {
  try {
    const user = await Users.findByPk(userId, {
      attributes: safeUserAttributes,
      include: [
        {
          model: Roles,
          as: "role",
          attributes: ["id", "name", "description"],
        },
      ],
    });

    if (!user) {
      throw {
        status: 404,
        message: "User not found",
      };
    }

    const plain = user.get();
    const avatarBaseUrl = `${process.env.HOST_URL || ""}/uploads/profile/`;

    return {
      success: true,
      status: 200,
      message: "Fetch user successful",
      data: {
        ...plain,
        avatarUrl: avatarBaseUrl + (plain.avatar_url || ""),
      },
    };
  } catch (err) {
    logger.error("Error fetching specific user", {
      err: err.message,
      stack: err.stack,
      userId,
    });

    throw {
      status: err.status || 500,
      message: err.message || "Internal server error",
    };
  }
};

// ------------------------------------------------------------------
// CHECK USERNAME AVAILABILITY
// ------------------------------------------------------------------
exports.checkUsernameAvailability = async (input) => {
  const { username } = input;

  try {
    const normalizedUsername = username.trim().toLowerCase();

    const existingUser = await Users.findOne({
      where: {
        username: {
          [Op.like]: normalizedUsername,
        },
      },
      attributes: ["id", "username"],
    });

    return {
      success: true,
      status: 200,
      message: existingUser
        ? "Username is already taken"
        : "Username is available",
      data: {
        username: normalizedUsername,
        available: !existingUser,
      },
    };
  } catch (err) {
    logger.error("Error checking username availability", {
      err: err.message,
      stack: err.stack,
      username,
    });

    throw {
      status: err.status || 500,
      message: err.message || "Internal server error",
    };
  }
};

// ------------------------------------------------------------------
// UPDATE USER ROLE
// ------------------------------------------------------------------
exports.userRoleUpdate = async (input) => {
  const { userId, roleId, updatedBy } = validate(input, updateUserRoleSchema);

  let transaction;

  try {
    transaction = await db.transaction();

    const user = await Users.findByPk(userId, {
      include: [
        {
          model: Roles,
          as: "role",
          attributes: ["id", "name"],
        },
      ],
      transaction,
    });

    if (!user) {
      throw {
        status: 404,
        message: "User not found",
      };
    }

    const role = await Roles.findByPk(roleId, {
      transaction,
    });

    if (!role) {
      throw {
        status: 404,
        message: "Role not found",
      };
    }

    if (role.status !== "active") {
      throw {
        status: 400,
        message: "Cannot assign inactive role to user",
      };
    }

    if (user.role_id === role.id) {
      throw {
        status: 400,
        message: "User already has this role",
      };
    }

    await user.update(
      {
        roleId: role.id,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    // When role changes, user automatically inherits new role's menu
    // permissions from role_menu_permissions table. No separate reassignment needed.

    logger.info("User role updated", {
      userId: user.id,
      oldRoleId: user.roleId,
      newRoleId: role.id,
      updatedBy,
    });

    return {
      success: true,
      status: 200,
      message: "User role updated successfully",
      data: {
        userId: user.id,
        roleId: role.id,
        roleName: role.name,
      },
    };
  } catch (err) {
    if (transaction) {
      await transaction.rollback();
    }

    logger.error("Error updating user role", {
      err: err.message,
      stack: err.stack,
      userId,
      roleId,
      updatedBy,
    });

    throw {
      status: err.status || 500,
      message: err.message || "Internal server error",
    };
  }
};

// ------------------------------------------------------------------
// CREATE USER
// ------------------------------------------------------------------
exports.userCreate = async (input) => {
  const data = validate(input, createUserSchema);
  const {
    tenantId,
    username,
    firstName,
    lastName,
    email,
    password,
    roleId,
    status,
    createdBy,
  } = data;

  let transaction;

  try {
    transaction = await db.transaction();

    const existingUsername = await Users.findOne({
      where: {
        username: {
          [Op.like]: username.trim().toLowerCase(),
        },
      },
      transaction,
    });

    if (existingUsername) {
      throw {
        status: 409,
        message: "Username already used",
      };
    }

    const existingEmail = await Users.findOne({
      where: {
        email: {
          [Op.like]: email.trim().toLowerCase(),
        },
      },
      transaction,
    });

    if (existingEmail) {
      throw {
        status: 409,
        message: "Email already registered",
      };
    }

    const role = await Roles.findByPk(roleId, {
      transaction,
    });

    if (!role) {
      throw {
        status: 404,
        message: "Role not found",
      };
    }

    if (role.status !== "active") {
      throw {
        status: 400,
        message: "Cannot assign inactive role to user",
      };
    }

    const hashedPassword = await hashPassword(password);

    const user = await Users.create(
      {
        tenantId: tenantId,
        username: username.trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role_id: roleId,
        status: status || "ACTIVE",
        is_email_verified: true,
      },
      {
        transaction,
      },
    );

    await transaction.commit();
    await transaction.finished;

    const existingUser = await Users.findByPk(user.id);
    if (!existingUser) {
      throw { status: 500, message: "User was not created successfully" };
    }

    // When a role is assigned to a user, they automatically inherit
    // the role's menu permissions from role_menu_permissions table.
    // No separate assignment needed.

    logger.info("User created", {
      userId: existingUser.id,
      username: existingUser.username,
      email: existingUser.email,
      roleId,
      createdBy,
    });

    return {
      success: true,
      status: 201,
      message: "User created successfully",
      data: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleId: user.roleId,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    };
  } catch (err) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    logger.error("Error creating user", {
      err: err.message,
      stack: err.stack,
      username,
      email,
      roleId,
      createdBy,
    });

    throw {
      status: err.status || 500,
      message: err.message || "Internal server error",
    };
  }
};

// ------------------------------------------------------------------
// EDIT USER
// ------------------------------------------------------------------
exports.editUser = async (input) => {
  const data = validate(input, updateUserSchema);
  const {
    userId,
    tenantId,
    username,
    firstName,
    lastName,
    email,
    status,
    isEmailVerified,
    is_active,
    updatedBy,
  } = data;

  let transaction;

  try {
    transaction = await db.transaction();

    const user = await Users.findByPk(userId, {
      transaction,
    });

    if (!user) {
      throw {
        status: 404,
        message: "User not found",
      };
    }

    if (username && username !== user.username) {
      const existingUsername = await Users.findOne({
        where: {
          username: {
            [Op.like]: username.trim().toLowerCase(),
          },
          id: {
            [Op.ne]: user.id,
          },
        },
        transaction,
      });

      if (existingUsername) {
        throw {
          status: 409,
          message: "Username already used",
        };
      }
    }

    if (email && email !== user.email) {
      const existingEmail = await Users.findOne({
        where: {
          email: {
            [Op.like]: email.trim().toLowerCase(),
          },
          id: {
            [Op.ne]: user.id,
          },
        },
        transaction,
      });

      if (existingEmail) {
        throw {
          status: 409,
          message: "Email already registered",
        };
      }
    }

    await user.update(
      {
        tenantId: tenantId !== undefined ? tenantId : user.tenantId,
        username: username !== undefined ? username.trim() : user.username,
        firstName: firstName !== undefined ? firstName?.trim() : user.firstName,
        lastName: lastName !== undefined ? lastName?.trim() : user.lastName,
        email: email !== undefined ? email.trim().toLowerCase() : user.email,
        status: status !== undefined ? status : user.status,
        isEmailVerified:
          isEmailVerified !== undefined
            ? isEmailVerified
            : user.isEmailVerified,
        isActive: is_active !== undefined ? is_active : user.is_active,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    logger.info("User updated", {
      userId: user.id,
      updatedBy,
    });

    return {
      success: true,
      status: 200,
      message: "User updated successfully",
      data: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleId: user.roleId,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        is_active: user.is_active,
        updatedAt: user.updatedAt,
      },
    };
  } catch (err) {
    if (transaction) {
      await transaction.rollback();
    }

    logger.error("Error updating user", {
      err: err.message,
      stack: err.stack,
      userId,
      updatedBy,
    });

    throw {
      status: err.status || 500,
      message: err.message || "Internal server error",
    };
  }
};

// ==========================================
// USER AVATAR UPLOAD FUNCTIONS
// ==========================================

/**
 * Update user avatar
 */
exports.updateUserAvatar = async (userId, filename, updatedBy) => {
  try {
    const user = await Users.findByPk(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.picture) {
      const oldFilename = user.picture.split("/").pop();
      if (oldFilename && oldFilename !== "default.svg") {
        try {
          await deleteUpload(oldFilename, "uploads/profile");
        } catch (err) {
          logger.warn(`Failed to delete old avatar: ${oldFilename}`, err);
        }
      }
    }

    await user.update({ avatar_url: filename }, { silent: true });

    logger.info(`User avatar updated: ${userId} by ${updatedBy}`);

    return {
      data: { avatar: filename },
      message: "User avatar updated successfully",
      status: 200,
    };
  } catch (error) {
    if (error.name === "AppError" || error.status) throw error;
    logger.error("Error updating user avatar", { error: error.message });
    throw new AppError(500, "Failed to update user avatar");
  }
};

/**
 * Remove user avatar
 */
exports.removeUserAvatar = async (userId, updatedBy) => {
  try {
    const user = await Users.findByPk(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.picture) {
      const filename = user.picture.split("/").pop();
      if (filename && filename !== "default.svg") {
        try {
          await deleteUpload(filename, "uploads/profile");
        } catch (err) {
          logger.warn(`Failed to delete avatar file: ${filename}`, err);
        }
      }

      await user.update({ picture: "default.svg" }, { silent: true });
      logger.info(`User avatar removed: ${userId} by ${updatedBy}`);
    }

    return {
      data: { avatar: "default.svg" },
      message: "User avatar removed successfully",
      status: 200,
    };
  } catch (error) {
    if (error.name === "AppError" || error.status) throw error;
    logger.error("Error removing user avatar", { error: error.message });
    throw new AppError(500, "Failed to remove user avatar");
  }
};

// ------------------------------------------------------------------
// DELETE USER
// ------------------------------------------------------------------
exports.deleteUser = async ({ userId, deletedBy }) => {
  try {
    if (!userId) {
      throw {
        status: 400,
        message: "User ID is required",
      };
    }

    const user = await Users.findByPk(userId, {
      include: [
        {
          model: Roles,
          as: "role",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!user) {
      throw {
        status: 404,
        message: "User not found",
      };
    }

    if (deletedBy && deletedBy === user.id) {
      throw {
        status: 400,
        message: "You cannot delete your own account",
      };
    }

    if (user.picture) {
      const avatarFilename = user.picture.split("/").pop();
      if (avatarFilename && avatarFilename !== "default.svg") {
        try {
          await deleteUpload(avatarFilename, "uploads/profile");
        } catch (err) {
          logger.warn(`Failed to delete user avatar: ${avatarFilename}`, err);
        }
      }
    }

    await user.destroy();

    logger.info("User deleted", {
      userId: user.id,
      username: user.username,
      deletedBy,
    });

    return {
      success: true,
      status: 200,
      message: "User deleted successfully",
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  } catch (err) {
    logger.error("Error deleting user", {
      err: err.message,
      stack: err.stack,
      userId,
      deletedBy,
    });

    throw {
      status: err.status || 500,
      message: err.message || "Internal server error",
    };
  }
};
