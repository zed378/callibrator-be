// src/services/userService.js
const { Op } = require("sequelize");
const { db } = require("../config");
const { Users, Roles } = require("../models");
const { logger } = require("../middlewares/activityLog");
const { hashPassword } = require("../utils/password");
const {
  validate: validateInput,
  formatErrors,
} = require("../validators/user.validator");

// ==========================================
// VALIDATION HELPERS
// ==========================================

/**
 * Validate input data against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} - Validated and sanitized data
 */
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
// Constants
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Helper: build safe attribute list (could also be a model scope)
// ------------------------------------------------------------------
const safeUserAttributes = {
  exclude: [
    "updatedAt",
    "otpCode",
    "otpExpiredAt",
    "otpRequestCount",
    "password",
    "otpLastRequestedAt",
    "lastLoginIp",
    "failedLoginAttempts",
    "lockedUntil",
    "passwordChangedAt",
    "status",
    "roleId",
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
  let transaction; // kept only if you *really* need it for repeatable‑read; otherwise remove
  try {
    // ----------------------------------------------------------------
    // 1️⃣ Resolve role → roleId (if needed)
    // ----------------------------------------------------------------
    let roleId = null;
    if (role && typeof role === "object" && role.id) {
      roleId = role.id;
    } else if (typeof role === "string") {
      // Assume the caller passed a role name; look it up once (could be cached)
      const roleRecord = await Roles.findOne({
        where: { name: role },
        attributes: ["id"],
      });
      roleId = roleRecord ? roleRecord.id : null;
    }

    // ----------------------------------------------------------------
    // 2️⃣ Build WHERE clause
    // ----------------------------------------------------------------
    const whereClause = {};

    // Tenant scoping – skip for SUPER_ADMIN
    if (roleId !== SUPER_ADMIN_ROLE_ID) {
      whereClause.tenantId = tenantId;
      whereClause.roleId = {
        [Op.notIn]: [SUPER_ADMIN_ROLE_ID],
      };
    }

    // Free‑text search (case‑insensitive)
    if (find && typeof find === "string" && find.trim() !== "") {
      const searchTerm = `%${find.toLowerCase()}%`;
      // Using ILike for PostgreSQL; fallback to lower+like for MySQL if needed
      whereClause[Op.or] = [
        { username: { [Op.iLike]: searchTerm } },
        { firstName: { [Op.iLike]: searchTerm } },
        { lastName: { [Op.iLike]: searchTerm } },
        { email: { [Op.iLike]: searchTerm } },
      ];
    }

    // filter by role
    if (roleFilter && roleFilter !== SUPER_ADMIN_ROLE_ID) {
      whereClause.roleId = roleFilter;
    }

    // ----------------------------------------------------------------
    // 3️⃣ Pagination (limit/offset) – guard against excessive limits
    // ----------------------------------------------------------------
    const safeLimit = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = (Math.max(Number(page), 1) - 1) * safeLimit;

    // ----------------------------------------------------------------
    // 4️⃣ Optional: start a transaction only if you truly need repeatable‑read
    // ----------------------------------------------------------------
    transaction = await db.transaction(); // <-- Uncomment if required

    // ----------------------------------------------------------------
    // 5️⃣ Query
    // ----------------------------------------------------------------
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
          attributes: ["id", "name", "description", "nameToShow"],
        },
      ],
      transaction, // <-- Uncomment if you opened a transaction above
    });

    // ----------------------------------------------------------------
    // 6️⃣ Commit transaction (if used)
    // ----------------------------------------------------------------
    if (transaction) await transaction.commit();

    // ----------------------------------------------------------------
    // 7️⃣ Shape response
    // ----------------------------------------------------------------
    const pictureBaseUrl = `${process.env.HOST_URL || ""}/uploads/profile/`;
    const rowsWithPicture = data.rows.map((user) => {
      const plain = user.get(); // sequelize instance → plain object
      // Adjust the field name if your picture column is named differently
      const picture = plain.picture || "";
      return {
        ...plain,
        pictureUrl: pictureBaseUrl + picture, // <-- convenient for the client
        // You could also keep `picture` raw and let the client concat:
        // picture,
      };
    });

    return {
      success: true,
      status: 200,
      message: "Fetch users successful",
      data: {
        count: data.count,
        rows: rowsWithPicture,
        pictureBaseUrl,
      },
    };
  } catch (err) {
    // ----------------------------------------------------------------
    // 8️⃣ Error handling – rollback if we opened a transaction
    // ----------------------------------------------------------------
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
    // Re‑throw a shaped error (you could also use a custom AppError class)
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
          attributes: ["id", "name", "description", "nameToShow"],
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

    const pictureBaseUrl = `${process.env.HOST_URL || ""}/uploads/profile/`;

    return {
      success: true,
      status: 200,
      message: "Fetch user successful",
      data: {
        ...plain,
        pictureUrl: pictureBaseUrl + (plain.picture || ""),
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
  // Validate input
  const { username } = validate(input, checkUsernameSchema);

  try {
    const normalizedUsername = username.trim().toLowerCase();

    const existingUser = await Users.findOne({
      where: {
        username: {
          [Op.iLike]: normalizedUsername,
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
  // Validate input
  const { userId, roleId, updatedBy } = validate(input, updateUserRoleSchema);

  let transaction;

  try {
    // --------------------------------------------------------------
    // TRANSACTION
    // --------------------------------------------------------------

    transaction = await db.transaction();

    // --------------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------------

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

    // --------------------------------------------------------------
    // FIND ROLE
    // --------------------------------------------------------------

    const role = await Roles.findByPk(roleId, {
      transaction,
    });

    if (!role) {
      throw {
        status: 404,
        message: "Role not found",
      };
    }

    // --------------------------------------------------------------
    // SAME ROLE
    // --------------------------------------------------------------

    if (user.roleId === role.id) {
      throw {
        status: 400,
        message: "User already has this role",
      };
    }

    // --------------------------------------------------------------
    // UPDATE ROLE
    // --------------------------------------------------------------

    await user.update(
      {
        roleId: role.id,
      },
      {
        transaction,
      },
    );

    // --------------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------------

    await transaction.commit();

    logger.info("User role updated", {
      userId: user.id,
      oldRoleId: user.roleId,
      newRoleId: role.id,
      updatedBy,
    });

    // --------------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------------

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
    // --------------------------------------------------------------
    // ROLLBACK
    // --------------------------------------------------------------

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
  // Validate input
  const data = validate(input, createUserSchema);
  const {
    tenantId,
    username,
    firstName,
    lastName,
    email,
    password,
    roleId,
    createdBy,
  } = data;

  let transaction;

  try {
    // --------------------------------------------------------------
    // TRANSACTION
    // --------------------------------------------------------------

    transaction = await db.transaction();

    // --------------------------------------------------------------
    // CHECK USERNAME
    // --------------------------------------------------------------

    const existingUsername = await Users.findOne({
      where: {
        username: {
          [Op.iLike]: username.trim(),
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

    // --------------------------------------------------------------
    // CHECK EMAIL
    // --------------------------------------------------------------

    const existingEmail = await Users.findOne({
      where: {
        email: {
          [Op.iLike]: email.trim(),
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

    // --------------------------------------------------------------
    // ROLE
    // --------------------------------------------------------------

    const role = await Roles.findByPk(roleId, {
      transaction,
    });

    if (!role) {
      throw {
        status: 404,
        message: "Role not found",
      };
    }

    // --------------------------------------------------------------
    // HASH PASSWORD
    // --------------------------------------------------------------

    const hashedPassword = await hashPassword(password);

    // --------------------------------------------------------------
    // CREATE USER
    // --------------------------------------------------------------

    const user = await Users.create(
      {
        tenantId,
        username: username.trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        roleId,
        isEmailVerified: true,
        status: "ACTIVE",
      },
      {
        transaction,
      },
    );

    // --------------------------------------------------------------
    // ASSIGN DEFAULT PERMISSIONS BASED ON ROLE
    // --------------------------------------------------------------

    // Commit transaction first to ensure user exists before assigning permissions
    await transaction.commit();

    // Assign permissions outside transaction (permissions are separate from user creation)
    const permissionResult = await assignPermissionsToUser(user, {
      grantedBy: createdBy,
    });

    if (permissionResult.errors.length > 0) {
      logger.warn(`Some permissions failed to assign for user ${user.id}:`, {
        errors: permissionResult.errors,
      });
    }

    logger.info("User created", {
      userId: user.id,
      username: user.username,
      email: user.email,
      roleId,
      createdBy,
      permissionsAssigned: permissionResult.assignedPermissions?.length || 0,
    });

    // --------------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------------

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
    // --------------------------------------------------------------
    // ROLLBACK
    // --------------------------------------------------------------

    if (transaction) {
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
  // Validate input
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
    isBanned,
    updatedBy,
  } = data;

  let transaction;

  try {
    // --------------------------------------------------------------
    // TRANSACTION
    // --------------------------------------------------------------

    transaction = await db.transaction();

    // --------------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------------

    const user = await Users.findByPk(userId, {
      transaction,
    });

    if (!user) {
      throw {
        status: 404,
        message: "User not found",
      };
    }

    // --------------------------------------------------------------
    // CHECK USERNAME
    // --------------------------------------------------------------

    if (username && username !== user.username) {
      const existingUsername = await Users.findOne({
        where: {
          username: {
            [Op.iLike]: username.trim(),
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

    // --------------------------------------------------------------
    // CHECK EMAIL
    // --------------------------------------------------------------

    if (email && email !== user.email) {
      const existingEmail = await Users.findOne({
        where: {
          email: {
            [Op.iLike]: email.trim(),
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

    // --------------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------------

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
        isBanned: isBanned !== undefined ? isBanned : user.isBanned,
      },
      {
        transaction,
      },
    );

    // --------------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------------

    await transaction.commit();

    logger.info("User updated", {
      userId: user.id,
      updatedBy,
    });

    // --------------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------------

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
        isBanned: user.isBanned,
        updatedAt: user.updatedAt,
      },
    };
  } catch (err) {
    // --------------------------------------------------------------
    // ROLLBACK
    // --------------------------------------------------------------

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

// ------------------------------------------------------------------
// DELETE USER
// ------------------------------------------------------------------
exports.deleteUser = async ({ userId, deletedBy }) => {
  let transaction;

  try {
    // --------------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------------

    if (!userId) {
      throw {
        status: 400,
        message: "User ID is required",
      };
    }

    // --------------------------------------------------------------
    // TRANSACTION
    // --------------------------------------------------------------

    transaction = await db.transaction();

    // --------------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------------

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

    // --------------------------------------------------------------
    // PREVENT SELF DELETE
    // --------------------------------------------------------------

    if (deletedBy && deletedBy === user.id) {
      throw {
        status: 400,
        message: "You cannot delete your own account",
      };
    }

    // --------------------------------------------------------------
    // DELETE USER SESSIONS
    // --------------------------------------------------------------

    await Sessions.destroy({
      where: {
        userId: user.id,
      },

      transaction,
    });

    // --------------------------------------------------------------
    // DELETE USER PERMISSIONS
    // --------------------------------------------------------------

    await UserPermissions.destroy({
      where: {
        userId: user.id,
      },

      transaction,
    });

    // --------------------------------------------------------------
    // DELETE USER
    // --------------------------------------------------------------

    await user.destroy({
      transaction,
    });

    // --------------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------------

    await transaction.commit();

    logger.info("User deleted", {
      userId: user.id,
      username: user.username,
      deletedBy,
    });

    // --------------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------------

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
    // --------------------------------------------------------------
    // ROLLBACK
    // --------------------------------------------------------------

    if (transaction) {
      await transaction.rollback();
    }

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
