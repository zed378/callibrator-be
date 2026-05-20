const { Op } = require("sequelize");

const { Permissions } = require("../models");

// ==========================================
// GET ALL PERMISSIONS
// ==========================================

exports.getAllPermissions = async ({ page = 1, limit = 20, search = "" }) => {
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
    order: [["createdAt", "DESC"]],
  });

  return {
    data: rows,
    meta: {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / limit),
    },
  };
};

// ==========================================
// GET SPECIFIC PERMISSION
// ==========================================

exports.getPermissionById = async (id) => {
  const permission = await Permissions.findByPk(id);
  if (!permission) {
    throw new Error("Permission not found");
  }
  return permission;
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
    throw new Error("Permission already exists");
  }
  const permission = await Permissions.create(payload);
  return permission;
};

// ==========================================
// UPDATE PERMISSION
// ==========================================

exports.updatePermission = async ({ id, data }) => {
  const permission = await Permissions.findByPk(id);
  if (!permission) {
    throw new Error("Permission not found");
  }
  await permission.update(data);
  return permission;
};

// ==========================================
// DELETE PERMISSION
// ==========================================

exports.deletePermission = async (id) => {
  const permission = await Permissions.findByPk(id);
  if (!permission) {
    throw new Error("Permission not found");
  }
  await permission.destroy();
  return true;
};
