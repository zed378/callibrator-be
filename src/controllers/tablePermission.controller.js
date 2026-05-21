const tablePermissionService = require("../services/tablePermission.service");
const { success } = require("../utils/response");

// ==========================================
// MODELS MANAGEMENT
// ==========================================

/**
 * Get all models
 * GET /api/v1/table-permissions/models?page=1&limit=20&search=xxx
 */
exports.getAllModels = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const result = await tablePermissionService.getAllModels({
      page,
      limit,
      search,
    });

    success(
      res,
      result.data,
      result.meta,
      result.message || "Models fetched successfully",
      result.status || 200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get model by ID
 * POST /api/v1/table-permissions/models/detail
 */
exports.getModelDetail = async (req, res, next) => {
  try {
    const { id } = req.body;

    const model = await tablePermissionService.getModelById(id);

    if (!model) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Model not found",
        data: null,
      });
    }

    success(res, model, null, "Model fetched successfully", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Create model
 * POST /api/v1/table-permissions/models
 */
exports.createModel = async (req, res, next) => {
  try {
    const model = await tablePermissionService.createModel(req.body);

    success(res, model, null, "Model created successfully", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update model
 * PATCH /api/v1/table-permissions/models
 */
exports.updateModel = async (req, res, next) => {
  try {
    const { id, ...data } = req.body;

    const model = await tablePermissionService.updateModel({ id, data });

    success(res, model, null, "Model updated successfully", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete model
 * DELETE /api/v1/table-permissions/models?id=xxx
 */
exports.deleteModel = async (req, res, next) => {
  try {
    const { id } = req.query;

    await tablePermissionService.deleteModel(id);

    success(res, null, null, "Model deleted successfully", 200);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// TABLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Get table permissions for a model
 * POST /api/v1/table-permissions/permissions/detail
 */
exports.getTablePermissions = async (req, res, next) => {
  try {
    const { modelId } = req.body;

    const permissions =
      await tablePermissionService.getTablePermissions(modelId);

    success(
      res,
      permissions,
      null,
      "Table permissions fetched successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update table permissions for a model
 * POST /api/v1/table-permissions/permissions/upsert
 */
exports.upsertTablePermissions = async (req, res, next) => {
  try {
    const { modelId, permissions } = req.body;

    const result = await tablePermissionService.upsertTablePermissions(
      modelId,
      permissions,
    );

    success(res, result, null, "Table permissions updated successfully", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a specific table permission
 * PATCH /api/v1/table-permissions/permissions
 */
exports.updateTablePermission = async (req, res, next) => {
  try {
    const { id, ...data } = req.body;

    const permission = await tablePermissionService.updateTablePermission({
      id,
      data,
    });

    success(
      res,
      permission,
      null,
      "Table permission updated successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a table permission
 * DELETE /api/v1/table-permissions/permissions?id=xxx
 */
exports.deleteTablePermission = async (req, res, next) => {
  try {
    const { id } = req.query;

    await tablePermissionService.deleteTablePermission(id);

    success(res, null, null, "Table permission deleted successfully", 200);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ROLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Grant permission to a role
 * POST /api/v1/table-permissions/role-permissions/grant
 */
exports.grantRolePermission = async (req, res, next) => {
  try {
    const { roleId, tablePermissionId, expiresAt, description } = req.body;

    const result = await tablePermissionService.grantRolePermission(
      roleId,
      tablePermissionId,
      { expiresAt, description },
    );

    success(res, result, null, "Permission granted to role successfully", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke permission from a role
 * POST /api/v1/table-permissions/role-permissions/revoke
 */
exports.revokeRolePermission = async (req, res, next) => {
  try {
    const { roleId, tablePermissionId } = req.body;

    const result = await tablePermissionService.revokeRolePermission(
      roleId,
      tablePermissionId,
    );

    success(
      res,
      { revoked: result },
      null,
      "Permission revoked from role successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all granted permissions for a role
 * POST /api/v1/table-permissions/role-permissions
 */
exports.getRolePermissions = async (req, res, next) => {
  try {
    const { roleId } = req.body;

    const permissions = await tablePermissionService.getRolePermissions(roleId);

    success(
      res,
      permissions,
      null,
      "Role permissions fetched successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk assign permissions to a role
 * POST /api/v1/table-permissions/role-permissions/bulk-assign
 */
exports.bulkAssignRolePermissions = async (req, res, next) => {
  try {
    const { roleId, tablePermissionIds, expiresAt, description } = req.body;

    const result = await tablePermissionService.bulkAssignRolePermissions(
      roleId,
      tablePermissionIds,
      { expiresAt, description },
    );

    success(
      res,
      result,
      null,
      "Permissions assigned to role successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// TENANT ROLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Grant permission to a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions/grant
 */
exports.grantTenantRolePermission = async (req, res, next) => {
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

    success(
      res,
      result,
      null,
      "Permission granted to tenant role successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke permission from a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions/revoke
 */
exports.revokeTenantRolePermission = async (req, res, next) => {
  try {
    const { tenantRoleId, tablePermissionId } = req.body;

    const result = await tablePermissionService.revokeTenantRolePermission(
      tenantRoleId,
      tablePermissionId,
    );

    success(
      res,
      { revoked: result },
      null,
      "Permission revoked from tenant role successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all granted permissions for a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions
 */
exports.getTenantRolePermissions = async (req, res, next) => {
  try {
    const { tenantRoleId } = req.body;

    const permissions =
      await tablePermissionService.getTenantRolePermissions(tenantRoleId);

    success(
      res,
      permissions,
      null,
      "Tenant role permissions fetched successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update ABAC rules for a tenant role permission
 * PATCH /api/v1/table-permissions/tenant-role-permissions/abac-rules
 */
exports.updateTenantRoleAbacRules = async (req, res, next) => {
  try {
    const { tenantRoleId, tablePermissionId, abacRules } = req.body;

    const result = await tablePermissionService.updateTenantRoleAbacRules(
      tenantRoleId,
      tablePermissionId,
      abacRules,
    );

    success(res, result, null, "ABAC rules updated successfully", 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk assign permissions to a tenant role
 * POST /api/v1/table-permissions/tenant-role-permissions/bulk-assign
 */
exports.bulkAssignTenantRolePermissions = async (req, res, next) => {
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

    success(
      res,
      result,
      null,
      "Permissions assigned to tenant role successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PERMISSION CHECKING
// ==========================================

/**
 * Check if user has permission for a model/action
 * POST /api/v1/table-permissions/check
 */
exports.checkPermission = async (req, res, next) => {
  try {
    const { modelName, action, userId, tenantId } = req.body;

    const result = await tablePermissionService.checkUserPermission(
      userId || req.user.id,
      modelName,
      action,
      tenantId || req.user.tenantId,
    );

    success(
      res,
      {
        allowed: result.allowed,
        permission: result.permission,
        abacRules: result.abacRules,
      },
      null,
      "Permission check completed",
      200,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get allowed attributes for a user on a model
 * POST /api/v1/table-permissions/allowed-attributes
 */
exports.getAllowedAttributes = async (req, res, next) => {
  try {
    const { modelName, action } = req.body;

    const attributes = await tablePermissionService.getUserAllowedAttributes(
      req.user.id,
      modelName,
      action,
      req.user.tenantId,
    );

    success(
      res,
      attributes || {},
      null,
      "Allowed attributes fetched successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};
