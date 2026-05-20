const { Op } = require('sequelize');

const { Permissions } = require('../models');

// ==========================================
// GET ALL PERMISSIONS
// ==========================================

exports.getAllPermissions = async ({ page = 1, limit = 20, search = '' }) => {
  const offset = (page - 1) * limit;

  const where = search
    ? {
        [Op.or]: [
          {
            name: {
              [Op.iLike]: `%${search}%`,
            },
          },
          {
            description: {
              [Op.iLike]: `%${search}%`,
            },
          },
        ],
      }
    : {};

  const { rows, count } = await Permissions.findAndCountAll({
    where,
    limit: Number(limit),
    offset: Number(offset),
    order: [['createdAt', 'DESC']],
  });

  return {
    success: true,
    status: 200,
    message: 'Fetch permissions successful',
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
// GET SPECIFIC PERMISSION
// ==========================================

exports.getPermissionById = async (id) => {
  const permission = await Permissions.findByPk(id);
  if (!permission) {
    throw { status: 404, message: 'Permission not found' };
  }
  return {
    success: true,
    status: 200,
    message: 'Fetch permission successful',
    data: permission,
  };
};

// ==========================================
// CREATE PERMISSION
// ==========================================

exports.createPermission = async (payload) => {
  const exist = await Permissions.findOne({
    where: {
      name: payload.name,
    },
  });
  if (exist) {
    throw { status: 409, message: 'Permission already exists' };
  }
  const permission = await Permissions.create(payload);
  return {
    success: true,
    status: 201,
    message: 'Permission created successfully',
    data: permission,
  };
};

// ==========================================
// UPDATE PERMISSION
// ==========================================

exports.updatePermission = async ({ id, data }) => {
  const permission = await Permissions.findByPk(id);
  if (!permission) {
    throw { status: 404, message: 'Permission not found' };
  }
  await permission.update(data);
  return {
    success: true,
    status: 200,
    message: 'Permission updated successfully',
    data: permission,
  };
};

// ==========================================
// DELETE PERMISSION
// ==========================================

exports.deletePermission = async (id) => {
  const permission = await Permissions.findByPk(id);
  if (!permission) {
    throw { status: 404, message: 'Permission not found' };
  }
  await permission.destroy();
  return {
    success: true,
    status: 200,
    message: 'Permission deleted successfully',
    data: null,
  };
};
