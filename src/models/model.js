const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

/**
 * Models Table
 *
 * Defines all application models (tables) that can have permissions assigned.
 * This enables dynamic RBAC/ABAC configuration per table.
 *
 * Example entries:
 * - { modelName: 'User', tableName: 'users', module: 'user' }
 * - { modelName: 'Invoice', tableName: 'invoices', module: 'billing' }
 * - { modelName: 'Product', tableName: 'products', module: 'catalog' }
 */
const Models = db.define(
  "models",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },
    modelName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Model class name (e.g., 'User', 'Invoice', 'Product')",
    },
    tableName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Database table name (e.g., 'users', 'invoices', 'products')",
    },
    module: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Logical module grouping (e.g., 'user', 'billing', 'catalog')",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Whether this model is active and can have permissions",
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

Models.associate = (models) => {
  Models.hasMany(models.TablePermission, {
    foreignKey: "modelId",
    as: "tablePermissions",
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  });
};

/**
 * Get model by name
 * @param {string} modelName - The model name (e.g., 'User')
 * @param {Object} models - Sequelize models object
 * @returns {Promise<Model|null>}
 */
Models.getModelByName = async (modelName, models) => {
  return Models.findOne({
    where: { modelName, isActive: true },
    include: [
      {
        model: models.TablePermission,
        as: "tablePermissions",
        include: [
          {
            model: models.Roles,
            through: { attributes: ["isGranted", "expiresAt"], as: "roles" },
            as: "roles",
          },
          {
            model: models.TenantRoles,
            through: {
              attributes: ["isGranted", "expiresAt", "abacRules"],
              as: "tenantRoles",
            },
            as: "tenantRoles",
          },
        ],
      },
    ],
  });
};

/**
 * Get model by table name
 * @param {string} tableName - The table name (e.g., 'users')
 * @returns {Promise<Model|null>}
 */
Models.getModelByTableName = async (tableName) => {
  return Models.findOne({
    where: { tableName, isActive: true },
  });
};

/**
 * Get all active models
 * @param {Object} options - Options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @returns {Promise<Object>}
 */
Models.getAllActiveModels = async ({ page = 1, limit = 20, search = "" }) => {
  const offset = (page - 1) * limit;
  const { Op } = require("sequelize");

  const where = search
    ? {
        [Op.or]: [
          { modelName: { [Op.iLike]: `%${search}%` } },
          { tableName: { [Op.iLike]: `%${search}%` } },
          { module: { [Op.iLike]: `%${search}%` } },
        ],
      }
    : { isActive: true };

  const { rows, count } = await Models.findAndCountAll({
    where,
    limit: Number(limit),
    offset: Number(offset),
    order: [["modelName", "ASC"]],
    where: search ? where : { isActive: true },
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

module.exports = {
  Models,
};
