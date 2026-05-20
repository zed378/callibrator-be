const { Sequelize, DataTypes } = require("sequelize");

const { db } = require("../config");

/**
 * TenantFeature Model
 *
 * Manages feature flags per tenant.
 * Allows enabling/disabling features for specific tenants.
 *
 * Features can be:
 * - Global (available to all tenants by default)
 * - Premium (requires special permission)
 * - Beta (opt-in only)
 * - Custom (tenant-specific)
 */
const TenantFeatures = db.define(
  "tenant_features",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
    },

    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "tenants",
        key: "id",
      },
    },

    /**
     * Feature identifier (e.g., "advanced_analytics", "sso", "api_access")
     */
    featureKey: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [2, 100],
      },
    },

    /**
     * Whether the feature is enabled for this tenant
     */
    isEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    /**
     * Feature tier: FREE, PREMIUM, BETA, CUSTOM
     */
    tier: {
      type: DataTypes.ENUM("FREE", "PREMIUM", "BETA", "CUSTOM"),
      defaultValue: "FREE",
    },

    /**
     * Feature configuration as JSON
     * Allows per-tenant feature customization
     * Example: { maxProjects: 10, allowExport: true }
     */
    config: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },

    /**
     * Expiration date for premium/beta features
     */
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    /**
     * Who enabled this feature
     */
    enabledBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    /**
     * Feature description
     */
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["tenantId", "featureKey"],
      },
      {
        fields: ["tenantId", "isEnabled"],
      },
      {
        fields: ["featureKey"],
      },
    ],
  },
);

// ==========================================
// ASSOCIATIONS
// ==========================================

TenantFeatures.associate = (models) => {
  TenantFeatures.belongsTo(models.Tenants, {
    foreignKey: "tenantId",
    as: "tenant",
  });
};

/**
 * Default feature definitions
 * These are the features that can be enabled per tenant
 */
TenantFeatures.DEFAULT_FEATURES = {
  ADVANCED_ANALYTICS: {
    key: "advanced_analytics",
    tier: "PREMIUM",
    description: "Advanced analytics and reporting dashboard",
  },
  SSO: {
    key: "sso",
    tier: "PREMIUM",
    description: "Single Sign-On integration",
  },
  API_ACCESS: {
    key: "api_access",
    tier: "FREE",
    description: "API access for programmatic operations",
  },
  CUSTOM_BRANDING: {
    key: "custom_branding",
    tier: "PREMIUM",
    description: "Custom domain and branding options",
  },
  AUDIT_LOG: {
    key: "audit_log",
    tier: "PREMIUM",
    description: "Detailed audit logging and compliance reports",
  },
  WEBHOOKS: {
    key: "webhooks",
    tier: "BETA",
    description: "Webhook integrations for event notifications",
  },
  MULTI_TENANT_ROLES: {
    key: "multi_tenant_roles",
    tier: "FREE",
    description: "Custom role management within tenant",
  },
  DATA_EXPORT: {
    key: "data_export",
    tier: "PREMIUM",
    description: "Data export in multiple formats",
  },
  TEAM_COLLABORATION: {
    key: "team_collaboration",
    tier: "FREE",
    description: "Team collaboration features",
  },
  TWO_FACTOR_AUTH: {
    key: "two_factor_auth",
    tier: "FREE",
    description: "Two-factor authentication for enhanced security",
  },
};

/**
 * Initialize default features for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>} Created features
 */
TenantFeatures.initializeDefaultFeatures = async (tenantId, models) => {
  const featuresToCreate = Object.values(TenantFeatures.DEFAULT_FEATURES).map(
    (feature) => ({
      tenantId,
      featureKey: feature.key,
      isEnabled: feature.tier === "FREE",
      tier: feature.tier,
      description: feature.description,
      config: {},
    }),
  );

  return TenantFeatures.bulkCreate(featuresToCreate, {
    ignoreDuplicates: true,
  });
};

/**
 * Get all enabled features for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Array>} Enabled features
 */
TenantFeatures.getEnabledFeatures = async (tenantId, models) => {
  return TenantFeatures.findAll({
    where: {
      tenantId,
      isEnabled: true,
      expiresAt: {
        [Sequelize.Op.or]: {
          [Sequelize.Op.is]: null,
          [Sequelize.Op.gte]: new Date(),
        },
      },
    },
    attributes: ["featureKey", "config", "tier"],
  });
};

/**
 * Check if a feature is enabled for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {string} featureKey - Feature key to check
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>} True if feature is enabled
 */
TenantFeatures.isFeatureEnabled = async (tenantId, featureKey, models) => {
  const feature = await TenantFeatures.findOne({
    where: { tenantId, featureKey },
    attributes: ["isEnabled", "expiresAt", "config"],
  });

  if (!feature) {
    // Check if it's a FREE tier default
    const defaultFeature = Object.values(TenantFeatures.DEFAULT_FEATURES).find(
      (f) => f.key === featureKey,
    );
    return defaultFeature?.tier === "FREE";
  }

  // Check expiration
  if (feature.expiresAt && new Date(feature.expiresAt) < new Date()) {
    return false;
  }

  return feature.isEnabled;
};

module.exports = {
  TenantFeatures,
};
