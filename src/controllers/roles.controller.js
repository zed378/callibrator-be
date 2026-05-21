const rolesService = require("../services/roles.service");
const { success } = require("../utils/response");

// ==========================================
// GET ALL ROLES
// GET /api/v1/roles?page=1&limit=20&search=xxx
// ==========================================

exports.getAllRoles = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const result = await rolesService.getAllRoles({
      page,
      limit,
      search,
    });

    success(
      res,
      result.data,
      result.meta,
      result.message || "Roles fetched successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET ROLE BY ID
// POST /api/v1/roles/detail
// ==========================================

exports.getRole = async (req, res, next) => {
  try {
    const { roleId } = req.body;

    const result = await rolesService.getRoleById(roleId);

    success(
      res,
      result.data,
      null,
      result.message || "Role fetched successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CREATE ROLE
// POST /api/v1/roles
// ==========================================

exports.createRole = async (req, res, next) => {
  try {
    const result = await rolesService.createRole(req.body);

    success(
      res,
      result.data,
      null,
      result.message || "Role created successfully",
      result.status || 201,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UPDATE ROLE
// PATCH /api/v1/roles
// ==========================================

exports.updateRole = async (req, res, next) => {
  try {
    const { id, ...data } = req.body;

    const result = await rolesService.updateRole({
      id,
      data,
    });

    success(
      res,
      result.data,
      null,
      result.message || "Role updated successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// DELETE ROLE
// DELETE /api/v1/roles?id=xxx
// ==========================================

exports.deleteRole = async (req, res, next) => {
  try {
    const { id } = req.query;

    const result = await rolesService.deleteRole(id);

    success(
      res,
      result.data,
      null,
      result.message || "Role deleted successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET ROLE PERMISSIONS
// GET /api/v1/roles/:id/permissions
// ==========================================

exports.getRolePermissions = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await rolesService.getRolePermissions(id);

    success(
      res,
      result.data,
      null,
      result.message || "Role permissions fetched successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ASSIGN PERMISSIONS TO ROLE
// PUT /api/v1/roles/:id/permissions
// ==========================================

exports.assignPermissionsToRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    const result = await rolesService.assignPermissionsToRole({
      roleId: id,
      permissionIds,
    });

    success(
      res,
      result.data,
      null,
      result.message || "Permissions assigned successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REVOKE ALL PERMISSIONS FROM ROLE
// DELETE /api/v1/roles/:id/permissions
// ==========================================

exports.revokeAllPermissionsFromRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await rolesService.revokeAllPermissionsFromRole(id);

    success(
      res,
      result.data,
      null,
      result.message || "All permissions revoked successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET ROLE USERS
// GET /api/v1/roles/:id/users
// ==========================================

exports.getRoleUsers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await rolesService.getRoleUsers(id, { page, limit });

    success(
      res,
      result.data,
      result.meta,
      result.message || "Role users fetched successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};
