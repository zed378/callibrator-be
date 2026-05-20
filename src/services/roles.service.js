const { Op } = require('sequelize');
const { Roles, Permissions, UserPermissions } = require('../models');
const { DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');

// ==========================================
// GET ALL ROLES
// ==========================================

exports.getAllRoles = async ({
  page = 1,
  limit = DEFAULT_LIMIT,
  search = '',
}) => {
  const offset = (page - 1) * limit;

  const where = search
    ? {
        [Op.or]: [
          { name: { [Op.like]: `%${search.toLowerCase()}%` } },
          { description: { [Op.like]: `%${search.toLowerCase()}%` } },
          { nameToShow: { [Op.like]: `%${search.toLowerCase()}%` } },
        ],
      }
    : {};

  const { rows, count } = await Roles.findAndCountAll({
    where,
    limit: Number(limit),
    offset: Number(offset),
    order: [
      ['roleLevel', 'ASC'],
      ['createdAt', 'DESC'],
    ],
    attributes: [
      'id',
      'name',
      'description',
      'nameToShow',
      'isActive',
      'roleLevel',
    ],
  });

  return {
    success: true,
    status: 200,
    message: 'Fetch roles successful',
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

// ==========================================
// GET ROLE BY ID
// ==========================================

exports.getRoleById = async (id) => {
  const role = await Roles.findByPk(id);
  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }
  return {
    success: true,
    status: 200,
    message: 'Fetch role successful',
    data: role,
  };
};

// ==========================================
// GET ROLE BY NAME
// ==========================================

exports.getRoleByName = async (name) => {
  const role = await Roles.findOne({ where: { name } });
  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }
  return {
    success: true,
    status: 200,
    message: 'Fetch role by name successful',
    data: role,
  };
};

// ==========================================
// CREATE ROLE
// ==========================================

exports.createRole = async (payload) => {
  const { name, isActive } = payload;

  // Check if role already exists
  const existing = await Roles.findOne({ where: { name } });
  if (existing) {
    throw { status: 409, message: 'Role already exists' };
  }

  // Default isActive to true if not provided
  const roleData = {
    ...payload,
    isActive: isActive !== undefined ? isActive : true,
  };

  const role = await Roles.create(roleData);
  return {
    success: true,
    status: 201,
    message: 'Role created successfully',
    data: role,
  };
};

// ==========================================
// UPDATE ROLE
// ==========================================

exports.updateRole = async ({ id, data }) => {
  const role = await Roles.findByPk(id);
  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }

  // Check if name is being changed and already exists
  if (data.name && data.name !== role.name) {
    const existing = await Roles.findOne({ where: { name: data.name } });
    if (existing) {
      throw { status: 409, message: 'Role name already exists' };
    }
  }

  // Default isActive to true if not provided
  const updateData = {
    ...data,
    isActive: data.isActive !== undefined ? data.isActive : role.isActive,
  };

  await role.update(updateData);
  return {
    success: true,
    status: 200,
    message: 'Role updated successfully',
    data: role,
  };
};

// ==========================================
// DELETE ROLE
// ==========================================

exports.deleteRole = async (id) => {
  const role = await Roles.findByPk(id);
  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }

  // Prevent deleting built-in roles
  const BUILTIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'USER'];
  if (BUILTIN_ROLES.includes(role.name)) {
    throw { status: 403, message: 'Cannot delete built-in role' };
  }

  await role.destroy();
  return {
    success: true,
    status: 200,
    message: 'Role deleted successfully',
    data: null,
  };
};

// ==========================================
// GET ROLE PERMISSIONS
// ==========================================

exports.getRolePermissions = async (roleId) => {
  const role = await Roles.findByPk(roleId, {
    include: [
      {
        model: Permissions,
        through: { attributes: [] },
        as: 'permissions',
      },
    ],
  });

  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }

  return {
    success: true,
    status: 200,
    message: 'Fetch role permissions successful',
    data: {
      role,
      permissions: role.permissions || [],
    },
  };
};

// ==========================================
// ASSIGN PERMISSIONS TO ROLE
// ==========================================

exports.assignPermissionsToRole = async ({ roleId, permissionIds }) => {
  const role = await Roles.findByPk(roleId);
  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }

  // Validate all permissions exist
  const permissions = await Permissions.findAll({
    where: { id: permissionIds },
  });

  if (permissions.length !== permissionIds.length) {
    const foundIds = permissions.map((p) => p.id);
    const missingIds = permissionIds.filter((id) => !foundIds.includes(id));
    throw {
      status: 400,
      message: `Permissions not found: ${missingIds.join(', ')}`,
    };
  }

  // Clear existing permissions and assign new ones
  await role.setPermissions([]);
  await role.addPermissions(permissionIds);

  return {
    success: true,
    status: 200,
    message: 'Permissions assigned to role successfully',
    data: {
      roleId,
      permissionIds,
    },
  };
};

// ==========================================
// REVOKE ALL PERMISSIONS FROM ROLE
// ==========================================

exports.revokeAllPermissionsFromRole = async (roleId) => {
  const role = await Roles.findByPk(roleId);
  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }

  await role.setPermissions([]);

  return {
    success: true,
    status: 200,
    message: 'All permissions revoked from role successfully',
    data: { roleId },
  };
};

// ==========================================
// GET ROLE USERS
// ==========================================

exports.getRoleUsers = async (
  roleId,
  { page = 1, limit = DEFAULT_LIMIT } = {},
) => {
  const role = await Roles.findByPk(roleId, {
    include: [
      {
        model: require('../models').Users,
        as: 'users',
        attributes: ['id', 'username', 'email', 'status'],
        limit: Number(limit),
        offset: (Number(page) - 1) * Number(limit),
        order: [['createdAt', 'DESC']],
      },
    ],
  });

  if (!role) {
    throw { status: 404, message: 'Role not found' };
  }

  const users = role.users || [];
  const count = await require('../models').Users.count({ where: { roleId } });

  return {
    success: true,
    status: 200,
    message: 'Fetch role users successful',
    data: {
      role,
      users,
      meta: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  };
};
