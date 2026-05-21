const userService = require("../services/user.service");
const userUploadService = require("../services/userUpload.service");
const { asyncHandler } = require("../utils/controllerWrapper");
const { success } = require("../utils/response");

// ==========================================
// FETCH ALL USERS WITH PAGINATION
// ==========================================

exports.getAllUsers = asyncHandler(async (req, res) => {
  const { tenantId, roleFilter, find, page, limit } = req.query;
  const role = req.user.role;

  const result = await userService.fetchUsers({
    tenantId,
    roleFilter,
    role,
    find,
    page,
    limit,
  });

  success(
    res,
    result.data.rows || result.data,
    result.meta,
    result.message || "Fetch users successful",
    result.status || 200,
  );
});

// ==========================================
// FETCH SPECIFIC USER
// ==========================================

exports.getSpecificUser = asyncHandler(async (req, res) => {
  const { userId } = req.params || req.body;

  const result = await userService.fetchSpecificUser(userId);
  success(
    res,
    result.data,
    null,
    result.message || "Fetch user successful",
    result.status || 200,
  );
});

// ==========================================
// CHECK USERNAME AVAILABILITY
// ==========================================

exports.checkUsernameAvailability = asyncHandler(async (req, res) => {
  const result = await userService.checkUsernameAvailability(req.body);

  success(
    res,
    result.data,
    null,
    result.message || "Username availability checked",
    200,
  );
});

// ==========================================
// UPDATE USER ROLE
// ==========================================

exports.updateUserRole = asyncHandler(async (req, res) => {
  const result = await userService.userRoleUpdate({
    ...req.body,
    updatedBy: req.user.id,
  });

  success(res, result.data, null, result.message || "User role updated", 200);
});

// ==========================================
// CREATE USER
// ==========================================

exports.createUser = asyncHandler(async (req, res) => {
  const result = await userService.userCreate({
    ...req.body,
    createdBy: req.user.id || null,
  });

  success(
    res,
    result.data,
    null,
    result.message || "User created successfully",
    result.status || 201,
  );
});

// ==========================================
// EDIT USER
// ==========================================

exports.editUser = asyncHandler(async (req, res) => {
  const result = await userService.editUser({
    ...req.body,
    updatedBy: req.user.id || null,
  });

  success(
    res,
    result.data,
    null,
    result.message || "User updated successfully",
    result.status || 200,
  );
});

// ==========================================
// DELETE USER
// ==========================================

exports.deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.query;

  const deletedBy = req.user.id || null;

  const result = await userService.deleteUser({ userId, deletedBy });

  success(
    res,
    result.data,
    null,
    result.message || "User deleted successfully",
    200,
  );
});

// ==========================================
// UPLOAD USER AVATAR
// ==========================================

exports.uploadUserAvatar = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const updatedBy = req.user?.id;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "No file uploaded",
      data: null,
    });
  }

  const result = await userUploadService.updateUserAvatar(
    userId,
    req.uploadFilename,
    updatedBy,
  );

  success(
    res,
    result.data,
    null,
    result.message || "User avatar uploaded successfully",
    result.status || 200,
  );
});

// ==========================================
// REMOVE USER AVATAR
// ==========================================

exports.removeUserAvatar = asyncHandler(async (req, res) => {
  const { userId } = req.params || req.body;
  const updatedBy = req.user?.id;

  const result = await userUploadService.removeUserAvatar(userId, updatedBy);

  success(
    res,
    result.data,
    null,
    result.message || "User avatar removed successfully",
    result.status || 200,
  );
});
