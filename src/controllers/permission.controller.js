const permissionService = require("../services/permission.service");

// ==========================================
// GET ALL PERMISSIONS
// GET /api/v1/permissions?page=1&limit=20&search=xxx
// ==========================================

exports.getAllPermissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const permissions = await permissionService.getAllPermissions({
      page,
      limit,
      search,
    });

    return res.status(200).send({
      success: true,
      message: "Permissions fetched successfully",
      ...permissions,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET SPECIFIC PERMISSION
// POST /api/v1/permissions/detail
// ==========================================

exports.getPermission = async (req, res) => {
  try {
    const { permissionId } = req.body;

    const permission = await permissionService.getPermissionById(permissionId);

    return res.status(200).send({
      success: true,
      message: "Permission fetched successfully",
      data: permission,
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// CREATE PERMISSION
// POST /api/v1/permissions
// ==========================================

exports.createPermission = async (req, res) => {
  try {
    const permission = await permissionService.createPermission(req.body);

    return res.status(201).send({
      success: true,
      message: "Permission created successfully",
      data: permission,
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// UPDATE PERMISSION
// PATCH /api/v1/permissions
// ==========================================

exports.updatePermission = async (req, res) => {
  try {
    const { id, ...data } = req.body;

    const permission = await permissionService.updatePermission({
      id,
      data,
    });

    return res.status(200).send({
      success: true,
      message: "Permission updated successfully",
      data: permission,
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// DELETE PERMISSION
// DELETE /api/v1/permissions?id=xxx
// ==========================================

exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.query;

    await permissionService.deletePermission(id);

    return res.status(200).send({
      success: true,
      message: "Permission deleted successfully",
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      message: error.message,
    });
  }
};
