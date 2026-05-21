const permissionService = require("../services/permission.service");
const { success } = require("../utils/response");

// ==========================================
// GET ALL PERMISSIONS
// GET /api/v1/permissions?page=1&limit=20&search=xxx
// ==========================================

exports.getAllPermissions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const permissions = await permissionService.getAllPermissions({
      page,
      limit,
      search,
    });

    success(
      res,
      permissions.data,
      permissions.meta,
      permissions.message || "Permissions fetched successfully",
      permissions.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET SPECIFIC PERMISSION
// POST /api/v1/permissions/detail
// ==========================================

exports.getPermission = async (req, res, next) => {
  try {
    const { permissionId } = req.body;

    const permission = await permissionService.getPermissionById(permissionId);

    success(res, permission, null, "Permission fetched successfully", 200);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CREATE PERMISSION
// POST /api/v1/permissions
// ==========================================

exports.createPermission = async (req, res, next) => {
  try {
    const permission = await permissionService.createPermission(req.body);

    success(res, permission, null, "Permission created successfully", 201);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UPDATE PERMISSION
// PATCH /api/v1/permissions
// ==========================================

exports.updatePermission = async (req, res, next) => {
  try {
    const { id, ...data } = req.body;

    const permission = await permissionService.updatePermission({
      id,
      data,
    });

    success(res, permission, null, "Permission updated successfully", 200);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// DELETE PERMISSION
// DELETE /api/v1/permissions?id=xxx
// ==========================================

exports.deletePermission = async (req, res, next) => {
  try {
    const { id } = req.query;

    await permissionService.deletePermission(id);

    success(res, null, null, "Permission deleted successfully", 200);
  } catch (error) {
    next(error);
  }
};
