const tablePermissionService = require("../services/tablePermission.service");

// ==========================================
// MODELS MANAGEMENT
// ==========================================

/**
 * Get all models
 * GET /api/v1/table-permissions/models?page=1&limit=20&search=xxx
 */
exports.getAllModels = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const result = await tablePermissionService.getAllModels({
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      message: "Models fetched successfully",
      ...result,
    });
  } catch (error) {
    console.error("getAllModels Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

/**
 * Get model by ID
 * POST /api/v1/table-permissions/models/detail
 */
exports.getModelDetail = async (req, res) => {
  try {
    const { id } = req.body;

    const model = await tablePermissionService.getModelById(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        message: "Model not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Model fetched successfully",
      data: model,
    });
  } catch (error) {
    console.error("getModelDetail Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

/**
 * Create model
 * POST /api/v1/table-permissions/models
 */
exports.createModel = async (req, res) => {
  try {
    const model = await tablePermissionService.createModel(req.body);

    return res.status(201).json({
      success: true,
      message: "Model created successfully",
      data: model,
    });
  } catch (error) {
    console.error("createModel Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create model",
    });
  }
};

/**
 * Update model
 * PATCH /api/v1/table-permissions/models
 */
exports.updateModel = async (req, res) => {
  try {
    const { id, ...data } = req.body;

    const model = await tablePermissionService.updateModel({ id, data });

    return res.status(200).json({
      success: true,
      message: "Model updated successfully",
      data: model,
    });
  } catch (error) {
    console.error("updateModel Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update model",
    });
  }
};

/**
 * Delete model
 * DELETE /api/v1/table-permissions/models?id=xxx
 */
exports.deleteModel = async (req, res) => {
  try {
    const { id } = req.query;

    await tablePermissionService.deleteModel(id);

    return res.status(200).json({
      success: true,
      message: "Model deleted successfully",
    });
  } catch (error) {
    console.error("deleteModel Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete model",
    });
  }
};

// ==========================================
// TABLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Get table permissions for a model
 * POST /api/v1/table-permissions/permissions/detail
 */
exports.getTablePermissions = async (req, res) => {
  try {
    const { modelId } = req.body;

    const permissions =
      await tablePermissionService.getTablePermissions(modelId);

    return res.status(200).json({
      success: true,
      message: "Table permissions fetched successfully",
      data: permissions,
    });
  } catch (error) {
    console.error("getTablePermissions Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

/**
 * Create or update table permissions for a model
 * POST /api/v1/table-permissions/permissions/upsert
 */
exports.upsertTablePermissions = async (req, res) => {
  try {
    const { modelId, permissions } = req.body;

    const result = await tablePermissionService.upsertTablePermissions(
      modelId,
      permissions,
    );

    return res.status(200).json({
      success: true,
      message: "Table permissions updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("upsertTablePermissions Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update table permissions",
    });
  }
};

/**
 * Update a specific table permission
 * PATCH /api/v1/table-permissions/permissions
 */
exports.updateTablePermission = async (req, res) => {
  try {
    const { id, ...data } = req.body;

    const permission = await tablePermissionService.updateTablePermission({
      id,
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Table permission updated successfully",
      data: permission,
    });
  } catch (error) {
    console.error("updateTablePermission Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update table permission",
    });
  }
};

/**
 * Delete a table permission
 * DELETE /api/v1/table-permissions/permissions?id=xxx
 */
exports.deleteTablePermission = async (req, res) => {
  try {
    const { id } = req.query;

    await tablePermissionService.deleteTablePermission(id);

    return res.status(200).json({
      success: true,
      message: "Table permission deleted successfully",
    });
  } catch (error) {
    console.error("deleteTablePermission Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete table permission",
    });
  }
};

// ==========================================
// ROLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Grant permission to a role
 * POST /api/v1/table-permissions/role-permissions/grant
 */
exports.grantRolePermission = async (req, res) => {
  try {
    const { roleId, tablePermissionId, expiresAt, description } = req.body;

    const result = await tablePermissionService.grantRolePermission(
      roleId,
      tablePermissionId,
      { expiresAt, description },
    );

    return res.status(200).json({
      success: true,
      message: "Permission granted to role successfully",
      data: result,
    });
  } catch (error) {
    console.error("grantRolePermission Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to grant permission",
    });
  }
};

/**
 * Revoke permission from a role
 * POST /api/v1/table-permissions/role-permissions/revoke
 */
exports.revokeRolePermission = async (req, res) => {
  try {
    const { roleId, tablePermissionId } = req.body;

    const result = await tablePermissionService.revokeRolePermission(
      roleId,
      tablePermissionId,
    );

    return res.status(200).json({
      success: true,
      message: "Permission revoked from role successfully",
      data: { revoked: result },
    });
  } catch (error) {
    console.error("revokeRolePermission Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to revoke permission",
    });
  }
};

/**
 * Get all granted permissions for a role
 * POST /api/v1/table-permissions/role-permissions
 */
exports.getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.body;

    const permissions = await tablePermissionService.getRolePermissions(roleId);

    return res.status(200).json({
      success: true,
      message: "Role permissions fetched successfully",
      data: permissions,
    });
  } catch (error) {
    console.error("getRolePermissions Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

/**
 * Bulk assign permissions to a role
 * POST /api/v1/table-permissions/role-permissions/bulk-assign
 */
exports.bulkAssignRolePermissions = async (req, res) => {
  try {
    const { roleId, tablePermissionIds, expiresAt, description } = req.body;

    const result = await tablePermissionService.bulkAssignRolePermissions(
      roleId,
      tablePermissionIds,
      { expiresAt, description },
    );

    return res.status(200).json({
      success: true,
      message: "Permissions assigned to role successfully",
      data: result,
    });
  } catch (error) {
    console.error("bulkAssignRolePermissions Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to assign permissions",
    });
  }
};

// ==========================================
// TENANT ROLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Grant permission to a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions/grant
 */
exports.grantTenantRolePermission = async (req, res) => {
  try {
    const {
      tenantRoleId,
      tablePermissionId,
      expiresAt,
      abacRules,
      description,
    } = req.body;

    const result = await tablePermissionService.grantTenantRolePermission(
      tenantRoleId,
      tablePermissionId,
      { expiresAt, abacRules, description },
    );

    return res.status(200).json({
      success: true,
      message: "Permission granted to tenant role successfully",
      data: result,
    });
  } catch (error) {
    console.error("grantTenantRolePermission Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to grant permission",
    });
  }
};

/**
 * Revoke permission from a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions/revoke
 */
exports.revokeTenantRolePermission = async (req, res) => {
  try {
    const { tenantRoleId, tablePermissionId } = req.body;

    const result = await tablePermissionService.revokeTenantRolePermission(
      tenantRoleId,
      tablePermissionId,
    );

    return res.status(200).json({
      success: true,
      message: "Permission revoked from tenant role successfully",
      data: { revoked: result },
    });
  } catch (error) {
    console.error("revokeTenantRolePermission Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to revoke permission",
    });
  }
};

/**
 * Get all granted permissions for a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions
 */
exports.getTenantRolePermissions = async (req, res) => {
  try {
    const { tenantRoleId } = req.body;

    const permissions =
      await tablePermissionService.getTenantRolePermissions(tenantRoleId);

    return res.status(200).json({
      success: true,
      message: "Tenant role permissions fetched successfully",
      data: permissions,
    });
  } catch (error) {
    console.error("getTenantRolePermissions Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

/**
 * Update ABAC rules for a tenant role permission
 * PATCH /api/v1/table-permissions/tenant-role-permissions/abac-rules
 */
exports.updateTenantRoleAbacRules = async (req, res) => {
  try {
    const { tenantRoleId, tablePermissionId, abacRules } = req.body;

    const result = await tablePermissionService.updateTenantRoleAbacRules(
      tenantRoleId,
      tablePermissionId,
      abacRules,
    );

    return res.status(200).json({
      success: true,
      message: "ABAC rules updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("updateTenantRoleAbacRules Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update ABAC rules",
    });
  }
};

/**
 * Bulk assign permissions to a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions/bulk-assign
 */
exports.bulkAssignTenantRolePermissions = async (req, res) => {
  try {
    const {
      tenantRoleId,
      tablePermissionIds,
      expiresAt,
      abacRules,
      description,
    } = req.body;

    const result = await tablePermissionService.bulkAssignTenantRolePermissions(
      tenantRoleId,
      tablePermissionIds,
      { expiresAt, abacRules, description },
    );

    return res.status(200).json({
      success: true,
      message: "Permissions assigned to tenant role successfully",
      data: result,
    });
  } catch (error) {
    console.error("bulkAssignTenantRolePermissions Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to assign permissions",
    });
  }
};

// ==========================================
// PERMISSION CHECKING
// ==========================================

/**
 * Check if user has permission for a model/action
 * POST /api/v1/table-permissions/check
 */
exports.checkPermission = async (req, res) => {
  try {
    const { modelName, action, userId, tenantId } = req.body;

    const result = await tablePermissionService.checkUserPermission(
      userId || req.user.id,
      modelName,
      action,
      tenantId || req.user.tenantId,
    );

    return res.status(200).json({
      success: true,
      message: "Permission check completed",
      data: {
        allowed: result.allowed,
        permission: result.permission,
        abacRules: result.abacRules,
      },
    });
  } catch (error) {
    console.error("checkPermission Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

/**
 * Get allowed attributes for a user on a model
 * POST /api/v1/table-permissions/allowed-attributes
 */
exports.getAllowedAttributes = async (req, res) => {
  try {
    const { modelName, action } = req.body;

    const attributes = await tablePermissionService.getUserAllowedAttributes(
      req.user.id,
      modelName,
      action,
      req.user.tenantId,
    );

    return res.status(200).json({
      success: true,
      message: "Allowed attributes fetched successfully",
      data: attributes || {},
    });
  } catch (error) {
    console.error("getAllowedAttributes Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
