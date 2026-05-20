const rolesService = require('../services/roles.service');

// ==========================================
// GET ALL ROLES
// GET /api/v1/roles?page=1&limit=20&search=xxx
// ==========================================

exports.getAllRoles = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const result = await rolesService.getAllRoles({
      page,
      limit,
      search,
    });

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// ==========================================
// GET ROLE BY ID
// POST /api/v1/roles/detail
// ==========================================

exports.getRole = async (req, res) => {
  try {
    const { roleId } = req.body;

    const result = await rolesService.getRoleById(roleId);

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// CREATE ROLE
// POST /api/v1/roles
// ==========================================

exports.createRole = async (req, res) => {
  try {
    const result = await rolesService.createRole(req.body);

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// UPDATE ROLE
// PATCH /api/v1/roles
// ==========================================

exports.updateRole = async (req, res) => {
  try {
    const { id, ...data } = req.body;

    const result = await rolesService.updateRole({
      id,
      data,
    });

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// DELETE ROLE
// DELETE /api/v1/roles?id=xxx
// ==========================================

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.query;

    const result = await rolesService.deleteRole(id);

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET ROLE PERMISSIONS
// GET /api/v1/roles/:id/permissions
// ==========================================

exports.getRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await rolesService.getRolePermissions(id);

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// ASSIGN PERMISSIONS TO ROLE
// PUT /api/v1/roles/:id/permissions
// ==========================================

exports.assignPermissionsToRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    const result = await rolesService.assignPermissionsToRole({
      roleId: id,
      permissionIds,
    });

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// REVOKE ALL PERMISSIONS FROM ROLE
// DELETE /api/v1/roles/:id/permissions
// ==========================================

exports.revokeAllPermissionsFromRole = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await rolesService.revokeAllPermissionsFromRole(id);

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET ROLE USERS
// GET /api/v1/roles/:id/users
// ==========================================

exports.getRoleUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await rolesService.getRoleUsers(id, { page, limit });

    return res.status(result.status).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
    });
  }
};
