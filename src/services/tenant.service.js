// src/services/tenant.service.js
const { Op } = require("sequelize");
const { db } = require("../config");
const { Tenants, Users } = require("../models");
const { logger } = require("../middlewares/activityLog");
const { AppError } = require("../utils/appError");
const {
  validate: validateInput,
  formatErrors,
  createTenantSchema,
  updateTenantSchema,
} = require("../validators/tenant.validator");
const { get, set, del, delPattern, cacheKeys } = require("./redis.service");

// ==========================================
// VALIDATION HELPERS
// ==========================================

/**
 * Validate input data against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @returns {Object} - Validated and sanitized data
 */
const validate = (data, schema) => {
  const { error, value } = validateInput(data, schema);
  if (error) {
    throw {
      status: 400,
      message: "Validation failed",
      errors: formatErrors(error.details),
    };
  }
  return value;
};

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const safeTenantAttributes = {
  exclude: ["createdAt", "updatedAt", "createdBy"],
};

// ------------------------------------------------------------------
// GET ALL TENANTS
// ------------------------------------------------------------------
exports.fetchTenants = async ({ find, page = 1, limit = DEFAULT_LIMIT }) => {
  try {
    // Only cache simple fetches (no search, paginated)
    const shouldCache = !find && Number(page) === 1;

    if (shouldCache) {
      const cacheKey = `tenants:page:1:limit:${limit}`;
      const cached = await get(cacheKey);
      if (cached) {
        return {
          data: cached.rows,
          message: "Fetch tenants successful (cached)",
          status: 200,
          meta: cached.meta,
        };
      }
    }

    const whereClause = {};

    // Free-text search (case-insensitive)
    if (find) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${find}%` } },
        { code: { [Op.iLike]: `%${find}%` } },
        { description: { [Op.iLike]: `%${find}%` } },
      ];
    }

    const { rows, count } = await Tenants.findAndCountAll({
      where: whereClause,
      attributes: safeTenantAttributes,
      include: [
        {
          model: Users,
          as: "users",
          attributes: ["id", "username", "email", "status"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });

    const result = {
      data: rows,
      message: "Fetch tenants successful",
      status: 200,
      meta: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    };

    // Cache first page only for 5 minutes
    if (shouldCache) {
      const cacheKey = `tenants:page:1:limit:${limit}`;
      await set(cacheKey, { rows: result.data, meta: result.meta }, 300);
    }

    return result;
  } catch (error) {
    logger.error("Error fetching tenants", { error: error.message });
    throw new AppError("Internal server error", 500);
  }
};

// ------------------------------------------------------------------
// GET SPECIFIC TENANT
// ------------------------------------------------------------------
exports.fetchSpecificTenant = async (tenantId) => {
  try {
    // Try cache first
    const cacheKey = cacheKeys.tenant(tenantId);
    const cached = await get(cacheKey);
    if (cached) {
      return {
        data: cached,
        message: "Fetch tenant successful (cached)",
        status: 200,
      };
    }

    const tenant = await Tenants.findByPk(tenantId, {
      attributes: { exclude: ["createdAt", "updatedAt", "createdBy"] },
      include: [
        {
          model: Users,
          as: "users",
          attributes: ["id", "username", "email", "status"],
          required: false,
        },
      ],
    });

    if (!tenant) {
      return {
        data: null,
        message: "Tenant not found",
        status: 404,
      };
    }

    // Cache for 10 minutes
    await set(cacheKey, tenant, 600);

    return {
      data: tenant,
      message: "Fetch tenant successful",
      status: 200,
    };
  } catch (error) {
    logger.error("Error fetching specific tenant", { error: error.message });
    throw new AppError("Internal server error", 500);
  }
};

// ------------------------------------------------------------------
// CREATE TENANT
// ------------------------------------------------------------------
exports.createTenant = async (input, createdBy) => {
  // Validate input
  const data = validate(input, createTenantSchema);
  const { name, code, description, logo, maxUsers } = data;

  const transaction = await db.transaction();

  try {
    // Check if code already exists
    const existingCode = await Tenants.findOne({
      where: { code },
      transaction,
    });

    if (existingCode) {
      await transaction.rollback();
      throw new AppError("Tenant code already exists", 409);
    }

    // Check if name already exists
    const existingName = await Tenants.findOne({
      where: { name },
      transaction,
    });

    if (existingName) {
      await transaction.rollback();
      throw new AppError("Tenant name already exists", 409);
    }

    const tenant = await Tenants.create(
      {
        name,
        code,
        description: description || null,
        logo: logo || "default.svg",
        maxUsers: maxUsers || 10,
        createdBy,
      },
      { transaction },
    );

    await transaction.commit();

    // Cache new tenant by ID and code
    await set(cacheKeys.tenant(tenant.id), tenant, 600);
    await set(cacheKeys.tenantByCode(code), tenant, 600);

    // Invalidate tenant list cache
    await delPattern("tenants:*");

    logger.info("Tenant created", {
      tenantId: tenant.id,
      code: tenant.code,
      createdBy,
    });

    return {
      data: tenant,
      message: "Tenant created successfully",
      status: 201,
    };
  } catch (error) {
    if (!error.isAppError) {
      await transaction.rollback();
    }
    logger.error("Error creating tenant", { error: error.message });
    throw error;
  }
};

// ------------------------------------------------------------------
// UPDATE TENANT
// ------------------------------------------------------------------
exports.updateTenant = async (tenantId, input, updatedBy) => {
  // Validate input
  const data = validate(input, updateTenantSchema);
  const { name, code, description, logo, status, maxUsers } = data;

  const transaction = await db.transaction();

  try {
    const tenant = await Tenants.findByPk(tenantId, { transaction });

    if (!tenant) {
      await transaction.rollback();
      throw new AppError("Tenant not found", 404);
    }

    // Check if code already exists (excluding current tenant)
    if (code) {
      const existingCode = await Tenants.findOne({
        where: { code, id: { [Op.ne]: tenantId } },
        transaction,
      });

      if (existingCode) {
        await transaction.rollback();
        throw new AppError("Tenant code already exists", 409);
      }
    }

    // Check if name already exists (excluding current tenant)
    if (name) {
      const existingName = await Tenants.findOne({
        where: { name, id: { [Op.ne]: tenantId } },
        transaction,
      });

      if (existingName) {
        await transaction.rollback();
        throw new AppError("Tenant name already exists", 409);
      }
    }

    await tenant.update(
      {
        name: name || tenant.name,
        code: code || tenant.code,
        description:
          description !== undefined ? description : tenant.description,
        logo: logo || tenant.logo,
        status: status || tenant.status,
        maxUsers: maxUsers !== undefined ? maxUsers : tenant.maxUsers,
      },
      { transaction },
    );

    await transaction.commit();

    // Update cache with new tenant data
    await set(cacheKeys.tenant(tenantId), tenant, 600);

    // Update cache by code if code changed
    if (code && code !== tenant.code) {
      await del(cacheKeys.tenantByCode(tenant.code));
      await set(cacheKeys.tenantByCode(code), tenant, 600);
    }

    // Invalidate tenant list cache
    await delPattern("tenants:*");

    logger.info("Tenant updated", {
      tenantId,
      updatedBy,
    });

    return {
      data: tenant,
      message: "Tenant updated successfully",
      status: 200,
    };
  } catch (error) {
    if (!error.isAppError) {
      await transaction.rollback();
    }
    logger.error("Error updating tenant", { error: error.message });
    throw error;
  }
};

// ------------------------------------------------------------------
// DELETE TENANT
// ------------------------------------------------------------------
exports.deleteTenant = async (tenantId, deletedBy) => {
  const transaction = await db.transaction();

  try {
    const tenant = await Tenants.findByPk(tenantId, { transaction });

    if (!tenant) {
      await transaction.rollback();
      throw new AppError("Tenant not found", 404);
    }

    // Check if tenant has users
    const userCount = await Users.count({
      where: { tenantId },
      transaction,
    });

    if (userCount > 0) {
      await transaction.rollback();
      throw new AppError(
        `Cannot delete tenant with ${userCount} active user(s). Please remove or reassign users first.`,
        400,
      );
    }

    await tenant.destroy({ transaction });

    await transaction.commit();

    // Invalidate all tenant caches
    await del(cacheKeys.tenant(tenantId));
    await del(cacheKeys.tenantByCode(tenant.code));
    await delPattern("tenants:*");
    await delPattern(`tenant:settings:${tenantId}`);

    logger.info("Tenant deleted", {
      tenantId,
      deletedBy,
    });

    return {
      data: null,
      message: "Tenant deleted successfully",
      status: 200,
    };
  } catch (error) {
    if (!error.isAppError) {
      await transaction.rollback();
    }
    logger.error("Error deleting tenant", { error: error.message });
    throw error;
  }
};

// ------------------------------------------------------------------
// GET TENANT SETTINGS
// ------------------------------------------------------------------
exports.getTenantSettings = async (tenantId) => {
  try {
    // Try cache first
    const cacheKey = cacheKeys.tenantSettings(tenantId);
    const cached = await get(cacheKey);
    if (cached) {
      return {
        data: cached,
        message: "Fetch tenant settings successful (cached)",
        status: 200,
      };
    }

    const tenant = await Tenants.findByPk(tenantId, {
      include: [
        {
          model: TenantSettings,
          as: "settings",
          required: false,
        },
      ],
    });

    if (!tenant) {
      return {
        data: null,
        message: "Tenant not found",
        status: 404,
      };
    }

    const settings = {};
    if (tenant.settings && tenant.settings.length > 0) {
      tenant.settings.forEach((setting) => {
        settings[setting.key] = setting.value;
      });
    }

    const result = { tenant, settings };

    // Cache for 15 minutes
    await set(cacheKey, result, 900);

    return {
      data: result,
      message: "Fetch tenant settings successful",
      status: 200,
    };
  } catch (error) {
    logger.error("Error fetching tenant settings", { error: error.message });
    throw new AppError("Internal server error", 500);
  }
};

// ------------------------------------------------------------------
// UPDATE TENANT SETTINGS
// ------------------------------------------------------------------
exports.updateTenantSettings = async (tenantId, settingsData, updatedBy) => {
  const transaction = await db.transaction();

  try {
    const tenant = await Tenants.findByPk(tenantId, { transaction });

    if (!tenant) {
      await transaction.rollback();
      throw new AppError("Tenant not found", 404);
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(settingsData)) {
      await TenantSettings.findOrCreate({
        where: { tenantId, key },
        defaults: { value },
        transaction,
      }).then(([setting, created]) => {
        if (!created) {
          return setting.update({ value }, { transaction });
        }
        return setting;
      });
    }

    await transaction.commit();

    // Invalidate settings cache
    await del(cacheKeys.tenantSettings(tenantId));

    logger.info("Tenant settings updated", {
      tenantId,
      updatedBy,
      keys: Object.keys(settingsData),
    });

    return {
      data: settingsData,
      message: "Tenant settings updated successfully",
      status: 200,
    };
  } catch (error) {
    if (!error.isAppError) {
      await transaction.rollback();
    }
    logger.error("Error updating tenant settings", { error: error.message });
    throw error;
  }
};

// ------------------------------------------------------------------
// GET TENANT USER COUNT
// ------------------------------------------------------------------
exports.getTenantUserCount = async (tenantId) => {
  try {
    const tenant = await Tenants.findByPk(tenantId);

    if (!tenant) {
      return {
        data: null,
        message: "Tenant not found",
        status: 404,
      };
    }

    const userCount = await Users.count({
      where: { tenantId },
    });

    return {
      data: {
        tenantId,
        userCount,
        maxUsers: tenant.maxUsers,
        remainingSlots: Math.max(0, tenant.maxUsers - userCount),
      },
      message: "Fetch tenant user count successful",
      status: 200,
    };
  } catch (error) {
    logger.error("Error fetching tenant user count", { error: error.message });
    throw new AppError("Internal server error", 500);
  }
};
