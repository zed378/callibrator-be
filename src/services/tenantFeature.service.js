const { TenantFeatures } = require("../models");
const { NotFoundError, ConflictError } = require("../utils/appError");

/**
 * Tenant Feature Flags Service
 *
 * Manages feature flags per tenant.
 * Allows enabling/disabling features, checking feature status,
 * and managing feature configurations.
 */

/**
 * Enable a feature for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} featureKey - Feature key to enable
 * @param {string} userId - User who enabled the feature
 * @param {Object} config - Feature configuration
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Updated feature
 */
const enableFeature = async (
  { tenantId, featureKey, userId, config = {} },
  models,
) => {
  const feature = await TenantFeatures.findOne({
    where: { tenantId, featureKey },
  });

  if (!feature) {
    throw new NotFoundError(`Feature ${featureKey} not found for this tenant`);
  }

  // Check expiration for premium/beta features
  if (
    ["PREMIUM", "BETA"].includes(feature.tier) &&
    feature.expiresAt &&
    new Date(feature.expiresAt) < new Date()
  ) {
    throw new ConflictError(`Feature ${featureKey} has expired`);
  }

  await feature.update({
    isEnabled: true,
    config: { ...feature.config, ...config },
    enabledBy: userId,
  });

  return feature;
};

/**
 * Disable a feature for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} featureKey - Feature key to disable
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Updated feature
 */
const disableFeature = async ({ tenantId, featureKey }, models) => {
  const feature = await TenantFeatures.findOne({
    where: { tenantId, featureKey },
  });

  if (!feature) {
    throw new NotFoundError(`Feature ${featureKey} not found for this tenant`);
  }

  await feature.update({
    isEnabled: false,
  });

  return feature;
};

/**
 * Check if a feature is enabled for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} featureKey - Feature key to check
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>} True if feature is enabled
 */
const isFeatureEnabled = async (tenantId, featureKey, models) => {
  return TenantFeatures.isFeatureEnabled(tenantId, featureKey, models);
};

/**
 * Get all features for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>} List of features
 */
const getTenantFeatures = async (tenantId, models) => {
  return TenantFeatures.findAll({
    where: { tenantId },
    order: [["featureKey", "ASC"]],
  });
};

/**
 * Get enabled features for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Features keyed by featureKey
 */
const getEnabledFeatures = async (tenantId, models) => {
  const features = await TenantFeatures.getEnabledFeatures(tenantId, models);

  const result = {};
  features.forEach((feature) => {
    result[feature.featureKey] = {
      enabled: true,
      config: feature.config,
      tier: feature.tier,
    };
  });

  return result;
};

/**
 * Update feature configuration
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} featureKey - Feature key
 * @param {Object} config - New configuration
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Updated feature
 */
const updateFeatureConfig = async (
  { tenantId, featureKey, config },
  models,
) => {
  const feature = await TenantFeatures.findOne({
    where: { tenantId, featureKey },
  });

  if (!feature) {
    throw new NotFoundError(`Feature ${featureKey} not found for this tenant`);
  }

  await feature.update({
    config: { ...feature.config, ...config },
  });

  return feature;
};

/**
 * Set feature expiration date
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} featureKey - Feature key
 * @param {Date} expiresAt - Expiration date
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Updated feature
 */
const setFeatureExpiration = async (
  { tenantId, featureKey, expiresAt },
  models,
) => {
  const feature = await TenantFeatures.findOne({
    where: { tenantId, featureKey },
  });

  if (!feature) {
    throw new NotFoundError(`Feature ${featureKey} not found for this tenant`);
  }

  await feature.update({ expiresAt });

  return feature;
};

/**
 * Initialize default features for a new tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>} Created features
 */
const initializeFeatures = async (tenantId, models) => {
  return TenantFeatures.initializeDefaultFeatures(tenantId, models);
};

module.exports = {
  enableFeature,
  disableFeature,
  isFeatureEnabled,
  getTenantFeatures,
  getEnabledFeatures,
  updateFeatureConfig,
  setFeatureExpiration,
  initializeFeatures,
};
