const { Op } = require('sequelize');
const {
  Models,
  TablePermission,
  RolePermission,
  TenantRolePermission,
} = require('../models');

// ==========================================
// MODELS MANAGEMENT
// ==========================================

/**
 * Get all models with pagination and search
 */
exports.getAllModels = async ({ page = 1, limit = 20, search = '' }) => {
  const offset = (page - 1) * limit;
  const where = search
    ? {
        [Op.or]: [
          { modelName: { [Op.like]: `%${search.toLowerCase()}%` } },
          { tableName: { [Op.like]: `%${search.toLowerCase()}%` } },
          { module: { [Op.like]: `%${search.toLowerCase()}%` } },
        ],
      }
    : {};

  const { rows, count } = await Models.findAndCountAll({
    where,
    limit: Number(limit),
    offset: Number(offset),
    order: [['modelName', 'ASC']],
  });

  return {
    success: true,
    status: 200,
    message: 'Fetch models successful',
    data: {
      rows,
      meta: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  };
};

/**
 * Get model by ID with full permission details
 */
exports.getModelById = async (id) => {
  const model = await Models.findByPk(id, {
    include: [
      {
        model: TablePermission,
        as: 'tablePermissions',
        include: [
          {
            model: require('../models').Roles,
            through: { attributes: ['isGranted', 'expiresAt', 'description'] },
            as: 'roles',
          },
          {
            model: require('../models').TenantRoles,
            through: {
              attributes: [
                'isGranted',
                'expiresAt',
                'abacRules',
                'description',
              ],
            },
            as: 'tenantRoles',
          },
        ],
      },
    ],
  });

  if (!model) {
    throw { status: 404, message: 'Model not found' };
  }

  return {
    success: true,
    status: 200,
    message: 'Fetch model successful',
    data: model,
  };
};

/**
 * Get model by name
 */
exports.getModelByName = async (modelName) => {
  const model = await Models.findOne({
    where: { modelName },
    include: [
      {
        model: TablePermission,
        as: 'tablePermissions',
      },
    ],
  });

  if (!model) {
    throw { status: 404, message: 'Model not found' };
  }

  return {
    success: true,
    status: 200,
    message: 'Fetch model by name successful',
    data: model,
  };
};

/**
 * Create a new model entry
 */
exports.createModel = async (payload) => {
  const existing = await Models.findOne({
    where: { modelName: payload.modelName },
  });

  if (existing) {
    throw { status: 409, message: 'Model already exists' };
  }

  const model = await Models.create(payload);

  return {
    success: true,
    status: 201,
    message: 'Model created successfully',
    data: model,
  };
};

/**
 * Update a model
 */
exports.updateModel = async ({ id, data }) => {
  const model = await Models.findByPk(id);
  if (!model) {
    throw { status: 404, message: 'Model not found' };
  }
  await model.update(data);

  return {
    success: true,
    status: 200,
    message: 'Model updated successfully',
    data: model,
  };
};

/**
 * Delete a model
 */
exports.deleteModel = async (id) => {
  const model = await Models.findByPk(id);
  if (!model) {
    throw { status: 404, message: 'Model not found' };
  }
  await model.destroy();

  return {
    success: true,
    status: 200,
    message: 'Model deleted successfully',
    data: null,
  };
};

// ==========================================
// TABLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Get all table permissions for a model
 */
exports.getTablePermissions = async (modelId) => {
  const permissions = await TablePermission.findAll({
    where: { modelId },
    include: [
      {
        model: Models,
        as: 'model',
        attributes: ['id', 'modelName', 'tableName', 'module'],
      },
      {
        model: require('../models').Roles,
        through: { attributes: ['isGranted', 'expiresAt', 'description'] },
        as: 'roles',
      },
      {
        model: require('../models').TenantRoles,
        through: {
          attributes: ['isGranted', 'expiresAt', 'abacRules', 'description'],
        },
        as: 'tenantRoles',
      },
    ],
    order: [['action', 'ASC']],
  });

  return {
    success: true,
    status: 200,
    message: 'Fetch table permissions successful',
    data: permissions,
  };
};

/**
 * Create or update table permissions for a model
 */
exports.upsertTablePermissions = async (modelId, permissions) => {
  const results = [];

  for (const perm of permissions) {
    const {
      action,
      scope = 'global',
      attributes = {},
      abacRules = null,
      description,
    } = perm;

    const [created, updated] = await TablePermission.findOrCreate({
      where: { modelId, action },
      defaults: { scope, attributes, abacRules, description },
    });

    if (!created) {
      await updated.update({ scope, attributes, abacRules, description });
    }

    results.push(created || updated);
  }

  return {
    success: true,
    status: 200,
    message: 'Table permissions upserted successfully',
    data: results,
  };
};

/**
 * Update a specific table permission
 */
exports.updateTablePermission = async ({ id, data }) => {
  const permission = await TablePermission.findByPk(id);
  if (!permission) {
    throw { status: 404, message: 'Table permission not found' };
  }
  await permission.update(data);

  return {
    success: true,
    status: 200,
    message: 'Table permission updated successfully',
    data: permission,
  };
};

/**
 * Delete a table permission
 */
exports.deleteTablePermission = async (id) => {
  const permission = await TablePermission.findByPk(id);
  if (!permission) {
    throw { status: 404, message: 'Table permission not found' };
  }
  await permission.destroy();

  return {
    success: true,
    status: 200,
    message: 'Table permission deleted successfully',
    data: null,
  };
};

// ==========================================
// ROLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Grant table permission to a global role
 */
exports.grantRolePermission = async (
  roleId,
  tablePermissionId,
  options = {},
) => {
  return RolePermission.grantPermission(
    roleId,
    tablePermissionId,
    options,
    require('../models'),
  );
};

/**
 * Revoke table permission from a global role
 */
exports.revokeRolePermission = async (roleId, tablePermissionId) => {
  return RolePermission.revokePermission(
    roleId,
    tablePermissionId,
    require('../models'),
  );
};

/**
 * Check if a role has a specific table permission
 */
exports.hasRolePermission = async (roleId, tablePermissionId) => {
  return RolePermission.hasPermission(
    roleId,
    tablePermissionId,
    require('../models'),
  );
};

/**
 * Get all granted permissions for a role
 */
exports.getRolePermissions = async (roleId) => {
  return RolePermission.getGrantedPermissions(roleId, require('../models'));
};

/**
 * Bulk assign permissions to a role
 */
exports.bulkAssignRolePermissions = async (
  roleId,
  tablePermissionIds,
  options = {},
) => {
  const results = {
    granted: [],
    failed: [],
  };

  for (const tablePermissionId of tablePermissionIds) {
    try {
      await RolePermission.grantPermission(
        roleId,
        tablePermissionId,
        options,
        require('../models'),
      );
      results.granted.push(tablePermissionId);
    } catch (error) {
      results.failed.push({ tablePermissionId, error: error.message });
    }
  }

  return {
    success: true,
    status: 200,
    message: 'Bulk assign role permissions completed',
    data: results,
  };
};

// ==========================================
// TENANT ROLE PERMISSIONS MANAGEMENT
// ==========================================

/**
 * Grant table permission to a tenant role
 */
exports.grantTenantRolePermission = async (
  tenantRoleId,
  tablePermissionId,
  options = {},
) => {
  return TenantRolePermission.grantPermission(
    tenantRoleId,
    tablePermissionId,
    options,
    require('../models'),
  );
};

/**
 * Revoke table permission from a tenant role
 */
exports.revokeTenantRolePermission = async (
  tenantRoleId,
  tablePermissionId,
) => {
  return TenantRolePermission.revokePermission(
    tenantRoleId,
    tablePermissionId,
    require('../models'),
  );
};

/**
 * Check if a tenant role has a specific table permission
 */
exports.hasTenantRolePermission = async (tenantRoleId, tablePermissionId) => {
  return TenantRolePermission.hasPermission(
    tenantRoleId,
    tablePermissionId,
    require('../models'),
  );
};

/**
 * Get all granted permissions for a tenant role
 */
exports.getTenantRolePermissions = async (tenantRoleId) => {
  return TenantRolePermission.getGrantedPermissions(
    tenantRoleId,
    require('../models'),
  );
};

/**
 * Update ABAC rules for a tenant role permission
 */
exports.updateTenantRoleAbacRules = async (
  tenantRoleId,
  tablePermissionId,
  abacRules,
) => {
  return TenantRolePermission.updateAbacRules(
    tenantRoleId,
    tablePermissionId,
    abacRules,
    require('../models'),
  );
};

/**
 * Bulk assign permissions to a tenant role
 */
exports.bulkAssignTenantRolePermissions = async (
  tenantRoleId,
  tablePermissionIds,
  options = {},
) => {
  const results = {
    granted: [],
    failed: [],
  };

  for (const tablePermissionId of tablePermissionIds) {
    try {
      await TenantRolePermission.grantPermission(
        tenantRoleId,
        tablePermissionId,
        options,
        require('../models'),
      );
      results.granted.push(tablePermissionId);
    } catch (error) {
      results.failed.push({ tablePermissionId, error: error.message });
    }
  }

  return {
    success: true,
    status: 200,
    message: 'Bulk assign tenant role permissions completed',
    data: results,
  };
};

// ==========================================
// DYNAMIC PERMISSION CHECKING
// ==========================================

/**
 * Check if a user has permission for a specific model and action
 * This is the core function used by the dynamicAccess middleware
 *
 * @param {string} userId - User UUID
 * @param {string} modelName - Model name (e.g., 'User', 'Invoice')
 * @param {string} action - Action (create, read, update, delete, export, import)
 * @param {string} tenantId - Tenant UUID (for tenant-scoped checks)
 * @returns {Promise<Object>} { allowed: boolean, permission: Object|null, abacRules: Object|null }
 */
exports.checkUserPermission = async (userId, modelName, action, tenantId) => {
  const { Users, Roles, TenantRoles } = require('../models');

  // Get user with their roles
  const user = await Users.findByPk(userId, {
    include: [
      {
        model: Roles,
        as: 'role',
        attributes: ['id', 'name', 'roleLevel'],
      },
      {
        model: TenantRoles,
        as: 'tenantRole',
        where: tenantId ? { tenantId } : undefined,
        attributes: ['id', 'name', 'level'],
      },
    ],
  });

  if (!user) {
    return { allowed: false, permission: null, abacRules: null };
  }

  // SUPER_ADMIN bypass
  if (user.role?.name === 'SUPER_ADMIN') {
    return { allowed: true, permission: { scope: 'global' }, abacRules: null };
  }

  // Get the model
  const model = await Models.findOne({
    where: { modelName, isActive: true },
    include: [
      {
        model: TablePermission,
        as: 'tablePermissions',
        where: { action },
        required: true,
        include: [
          {
            model: Roles,
            through: { attributes: ['isGranted', 'expiresAt'] },
            as: 'roles',
          },
          {
            model: TenantRoles,
            through: { attributes: ['isGranted', 'expiresAt', 'abacRules'] },
            as: 'tenantRoles',
          },
        ],
      },
    ],
  });

  if (!model || !model.tablePermissions?.[0]) {
    return { allowed: false, permission: null, abacRules: null };
  }

  const tablePerm = model.tablePermissions[0];

  // Check global role permission
  if (user.role) {
    const hasGlobalPerm = tablePerm.roles?.some(
      (r) =>
        (r.rolePermissions?.isGranted !== false &&
          !r.rolePermissions?.expiresAt) ||
        (r.rolePermissions?.expiresAt &&
          new Date(r.rolePermissions.expiresAt) > new Date()),
    );

    if (hasGlobalPerm) {
      return {
        allowed: true,
        permission: tablePerm,
        abacRules: tablePerm.abacRules,
      };
    }
  }

  // Check tenant role permission
  if (user.tenantRole && tenantId) {
    const hasTenantPerm = tablePerm.tenantRoles?.some(
      (tr) =>
        tr.tenantRolePermissions?.isGranted !== false &&
        (!tr.tenantRolePermissions?.expiresAt ||
          new Date(tr.tenantRolePermissions.expiresAt) > new Date()),
    );

    if (hasTenantPerm) {
      return {
        allowed: true,
        permission: tablePerm,
        abacRules:
          tablePerm.abacRules ||
          tablePerm.tenantRoles?.[0]?.tenantRolePermissions?.abacRules,
      };
    }
  }

  return { allowed: false, permission: null, abacRules: null };
};

/**
 * Get allowed attributes for a user on a specific model
 * @param {string} userId - User UUID
 * @param {string} modelName - Model name
 * @param {string} action - Action
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object|null>} Allowed attributes configuration
 */
exports.getUserAllowedAttributes = async (
  userId,
  modelName,
  action,
  tenantId,
) => {
  const result = await exports.checkUserPermission(
    userId,
    modelName,
    action,
    tenantId,
  );

  if (!result.allowed) {
    return null;
  }

  return result.permission?.attributes || null;
};
