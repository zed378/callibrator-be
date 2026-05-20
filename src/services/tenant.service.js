// src/services/tenant.service.js
const { Op } = require('sequelize');
const { db } = require('../config');
const { Tenants, Users } = require('../models');
const { logger } = require('../middlewares/activityLog');
const { AppError } = require('../utils/appError');
const { DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');
const { deleteUpload } = require('../utils/upload');
const {
  validate: validateInput,
  formatErrors,
  createTenantSchema,
  updateTenantSchema,
} = require('../validators/tenant.validator');
const { get, set, del, delPattern, cacheKeys } = require('./redis.service');

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
      message: 'Validation failed',
      errors: formatErrors(error.details),
    };
  }
  return value;
};

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const safeTenantAttributes = {
  exclude: ['updatedAt', 'createdBy'],
};

const TENANT_LOGO_BASE_URL = `${process.env.HOST_URL || 'http://localhost:5000'}/uploads/tenant`;

/**
 * Transform tenant instance to plain object with logo baseUrl
 * @param {Object} tenant - Sequelize tenant instance
 * @returns {Object} - Transformed tenant data
 */
const transformTenant = (tenant) => {
  if (!tenant) return null;
  const data = tenant.toJSON ? tenant.toJSON() : { ...tenant };
  data.logoBaseUrl = data.logo ? `${TENANT_LOGO_BASE_URL}/${data.logo}` : null;
  return data;
};

/**
 * Transform tenant rows array with logo baseUrl
 * @param {Array} rows - Array of Sequelize tenant instances
 * @returns {Array} - Transformed tenant data
 */
const transformTenants = (rows) => {
  return (rows || []).map(transformTenant);
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
          success: true,
          status: 200,
          message: 'Fetch tenants successful (cached)',
          data: {
            rows: cached.rows,
            count: cached.meta?.total || 0,
            meta: cached.meta,
          },
        };
      }
    }

    const whereClause = {};

    // Free-text search (case-insensitive - MySQL compatible)
    if (find) {
      const searchTerm = `%${find.toLowerCase()}%`;
      whereClause[Op.or] = [
        { name: { [Op.like]: searchTerm } },
        { code: { [Op.like]: searchTerm } },
        { description: { [Op.like]: searchTerm } },
      ];
    }

    const { rows, count } = await Tenants.findAndCountAll({
      where: whereClause,
      attributes: safeTenantAttributes,
      include: [
        {
          model: Users,
          as: 'users',
          attributes: ['id', 'username', 'email', 'status'],
          required: false,
        },
      ],
      order: [['id', 'DESC']],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });

    // Transform tenants to include logoBaseUrl
    const transformedRows = transformTenants(rows);

    const resultData = {
      rows: transformedRows,
      count,
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
      await set(
        cacheKey,
        {
          rows: resultData.rows,
          meta: resultData.meta,
        },
        300,
      );
    }

    return {
      success: true,
      status: 200,
      message: 'Fetch tenants successful',
      data: resultData,
    };
  } catch (error) {
    logger.error('Error fetching tenants', {
      error: error.message,
      stack: error.stack,
    });
    throw {
      status: error.status || 500,
      message: error.message || 'Internal server error',
    };
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
        success: true,
        status: 200,
        message: 'Fetch tenant successful (cached)',
        data: cached,
      };
    }

    const tenant = await Tenants.findByPk(tenantId, {
      attributes: safeTenantAttributes,
      include: [
        {
          model: Users,
          as: 'users',
          attributes: ['id', 'username', 'email', 'status'],
          required: false,
        },
      ],
    });

    if (!tenant) {
      return {
        success: true,
        status: 404,
        message: 'Tenant not found',
        data: null,
      };
    }

    // Transform tenant to include logoBaseUrl
    const transformedTenant = transformTenant(tenant);

    // Cache for 10 minutes
    await set(cacheKey, transformedTenant, 600);

    return {
      success: true,
      status: 200,
      message: 'Fetch tenant successful',
      data: transformedTenant,
    };
  } catch (error) {
    logger.error('Error fetching specific tenant', { error: error.message });
    throw new AppError(500, 'Internal server error');
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
      throw new AppError(409, 'Tenant code already exists');
    }

    // Check if name already exists
    const existingName = await Tenants.findOne({
      where: { name },
      transaction,
    });

    if (existingName) {
      await transaction.rollback();
      throw new AppError(409, 'Tenant name already exists');
    }

    const tenant = await Tenants.create(
      {
        name,
        code,
        description: description || null,
        logo: logo || 'default.svg',
        maxUsers: maxUsers || 10,
        createdBy,
      },
      { transaction },
    );

    await transaction.commit();

    // Transform tenant to include logoBaseUrl
    const transformedTenant = transformTenant(tenant);

    // Cache new tenant by ID and code
    await set(cacheKeys.tenant(tenant.id), transformedTenant, 600);
    await set(cacheKeys.tenantByCode(code), transformedTenant, 600);

    // Invalidate tenant list cache
    await delPattern('tenants:*');

    logger.info('Tenant created', {
      tenantId: tenant.id,
      code: tenant.code,
      createdBy,
    });

    return {
      success: true,
      status: 201,
      message: 'Tenant created successfully',
      data: transformedTenant,
    };
  } catch (error) {
    if (!error.isAppError) {
      await transaction.rollback();
    }
    logger.error('Error creating tenant', { error: error.message });
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
      throw new AppError(404, 'Tenant not found');
    }

    // Check if code already exists (excluding current tenant)
    if (code) {
      const existingCode = await Tenants.findOne({
        where: { code, id: { [Op.ne]: tenantId } },
        transaction,
      });

      if (existingCode) {
        throw new AppError(409, 'Tenant code already exists');
      }
    }

    // Check if name already exists (excluding current tenant)
    if (name) {
      const existingName = await Tenants.findOne({
        where: { name, id: { [Op.ne]: tenantId } },
        transaction,
      });

      if (existingName) {
        throw new AppError(409, 'Tenant name already exists');
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

    // Transform tenant to include logoBaseUrl
    const transformedTenant = transformTenant(tenant);

    // Update cache with new tenant data
    await set(cacheKeys.tenant(tenantId), transformedTenant, 600);

    // Update cache by code if code changed
    if (code && code !== tenant.code) {
      await del(cacheKeys.tenantByCode(tenant.code));
      await set(cacheKeys.tenantByCode(code), transformedTenant, 600);
    }

    // Invalidate tenant list cache
    await delPattern('tenants:*');

    logger.info('Tenant updated', {
      tenantId,
      updatedBy,
    });

    return {
      success: true,
      status: 200,
      message: 'Tenant updated successfully',
      data: transformedTenant,
    };
  } catch (error) {
    // Only rollback if transaction is still active (not finished)
    if (transaction && !transaction.finished) {
      await transaction.rollback().catch(() => {
        // Ignore rollback errors if transaction is already finished
      });
    }
    logger.error('Error updating tenant', { error: error.message });
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
      throw new AppError(404, 'Tenant not found');
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

    // Delete tenant logo file if exists and not default
    if (tenant.logo) {
      const logoFilename = tenant.logo.split('/').pop();
      if (logoFilename && logoFilename !== 'default.svg') {
        try {
          await deleteUpload(logoFilename, 'uploads/tenant');
        } catch (err) {
          logger.warn(`Failed to delete tenant logo: ${logoFilename}`, err);
        }
      }
    }

    await tenant.destroy({ transaction });

    await transaction.commit();

    // Invalidate all tenant caches
    await del(cacheKeys.tenant(tenantId));
    await del(cacheKeys.tenantByCode(tenant.code));
    await delPattern('tenants:*');
    await delPattern(`tenant:settings:${tenantId}`);

    logger.info('Tenant deleted', {
      tenantId,
      deletedBy,
    });

    return {
      success: true,
      status: 200,
      message: 'Tenant deleted successfully',
      data: null,
    };
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback().catch(() => {
        // Ignore rollback errors if transaction is already finished
      });
    }
    logger.error('Error deleting tenant', { error: error.message });
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
        success: true,
        status: 200,
        message: 'Fetch tenant settings successful (cached)',
        data: cached,
      };
    }

    const tenant = await Tenants.findByPk(tenantId, {
      include: [
        {
          model: TenantSettings,
          as: 'settings',
          required: false,
        },
      ],
    });

    if (!tenant) {
      return {
        success: true,
        status: 404,
        message: 'Tenant not found',
        data: null,
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
      success: true,
      status: 200,
      message: 'Fetch tenant settings successful',
      data: result,
    };
  } catch (error) {
    logger.error('Error fetching tenant settings', { error: error.message });
    throw new AppError(500, 'Internal server error');
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
      throw new AppError(404, 'Tenant not found');
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

    logger.info('Tenant settings updated', {
      tenantId,
      updatedBy,
      keys: Object.keys(settingsData),
    });

    return {
      success: true,
      status: 200,
      message: 'Tenant settings updated successfully',
      data: settingsData,
    };
  } catch (error) {
    if (!error.isAppError) {
      await transaction.rollback();
    }
    logger.error('Error updating tenant settings', { error: error.message });
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
        success: true,
        status: 404,
        message: 'Tenant not found',
        data: null,
      };
    }

    const userCount = await Users.count({
      where: { tenantId },
    });

    return {
      success: true,
      status: 200,
      message: 'Fetch tenant user count successful',
      data: {
        tenantId,
        userCount,
        maxUsers: tenant.maxUsers,
        remainingSlots: Math.max(0, tenant.maxUsers - userCount),
      },
    };
  } catch (error) {
    logger.error('Error fetching tenant user count', { error: error.message });
    throw new AppError(500, 'Internal server error');
  }
};
