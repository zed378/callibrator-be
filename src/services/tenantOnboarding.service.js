const { Tenants, Users, TenantRoles } = require("../models");
const { initializeFeatures } = require("./tenantFeature.service");
const { generateAccessToken } = require("../utils/jwt");

/**
 * Tenant Onboarding Service
 *
 * Manages the tenant onboarding workflow:
 * 1. Create tenant
 * 2. Create initial admin user
 * 3. Set up default roles
 * 4. Enable default features
 * 5. Send welcome email
 */

/**
 * Onboarding status values
 */
const ONBOARDING_STATUS = {
  PENDING: "PENDING",
  ADMIN_CREATED: "ADMIN_CREATED",
  ROLES_SETUP: "ROLES_SETUP",
  FEATURES_ENABLED: "FEATURES_ENABLED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

/**
 * Default onboarding configuration
 */
const DEFAULT_ONBOARDING = {
  adminFirstName: "Admin",
  adminLastName: "User",
  adminUsername: "admin",
  adminEmail: "admin@example.com",
  adminPassword: null, // Will be set via password reset
  createDefaultRoles: true,
  enableDefaultFeatures: true,
};

/**
 * Create a new tenant with full onboarding
 *
 * @param {Object} params - Onboarding parameters
 * @param {string} params.name - Tenant name
 * @param {string} params.code - Tenant code
 * @param {string} [params.description] - Tenant description
 * @param {Object} [params.admin] - Admin user details
 * @param {boolean} [params.createDefaultRoles] - Create default roles
 * @param {boolean} [params.enableDefaultFeatures] - Enable default features
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Onboarding result with tenant and admin user
 */
const onboardTenant = async (
  {
    name,
    code,
    description,
    admin = {},
    createDefaultRoles = true,
    enableDefaultFeatures = true,
  },
  models,
  transaction,
) => {
  const t = transaction || (await models.Sequelize.transaction());
  let result;
  let wasTransactionStarted = false;

  try {
    // Step 1: Create tenant
    const tenant = await Tenants.create(
      {
        name,
        code,
        description,
        status: "ACTIVE",
        createdBy: admin.userId || null,
      },
      { transaction: t },
    );

    // Step 2: Create admin user
    const adminUser = await Users.create(
      {
        firstName: admin.firstName || DEFAULT_ONBOARDING.adminFirstName,
        lastName: admin.lastName || DEFAULT_ONBOARDING.adminLastName,
        username: admin.username || DEFAULT_ONBOARDING.adminUsername,
        email: admin.email || DEFAULT_ONBOARDING.adminEmail,
        password: admin.password || null,
        isEmailVerified: true,
        tenantId: tenant.id,
        roleId: null, // Will be set to tenant admin role
        status: "ACTIVE",
      },
      { transaction: t },
    );

    // Step 3: Create tenant-specific roles
    if (createDefaultRoles) {
      await TenantRoles.create(
        {
          tenantId: tenant.id,
          name: "Tenant Owner",
          description: "Tenant owner with full access",
          level: 1,
          isAssignable: false,
          isSystemRole: true,
          isDefault: false,
        },
        { transaction: t },
      );

      await TenantRoles.create(
        {
          tenantId: tenant.id,
          name: "Tenant Admin",
          description: "Tenant administrator",
          level: 2,
          isAssignable: true,
          isSystemRole: false,
          isDefault: false,
        },
        { transaction: t },
      );

      await TenantRoles.create(
        {
          tenantId: tenant.id,
          name: "Member",
          description: "Default member role",
          level: 10,
          isAssignable: true,
          isSystemRole: false,
          isDefault: true,
        },
        { transaction: t },
      );
    }

    // Step 4: Initialize features
    if (enableDefaultFeatures) {
      await initializeFeatures(tenant.id, models);
    }

    // Step 5: Update admin user with tenant admin role
    // Find or create tenant admin role
    let tenantAdminRole = await TenantRoles.findOne({
      where: { tenantId: tenant.id, name: "Tenant Admin" },
      transaction: t,
    });

    if (!tenantAdminRole) {
      tenantAdminRole = await TenantRoles.create(
        {
          tenantId: tenant.id,
          name: "Tenant Admin",
          description: "Tenant administrator",
          level: 2,
          isAssignable: true,
          isSystemRole: false,
          isDefault: false,
        },
        { transaction: t },
      );
    }

    await adminUser.update(
      {
        tenantRoleId: tenantAdminRole.id,
      },
      { transaction: t },
    );

    result = {
      tenant,
      adminUser,
      onboardingStatus: ONBOARDING_STATUS.COMPLETED,
    };

    if (!transaction) {
      await t.commit();
    }
  } catch (error) {
    if (!transaction) {
      await t.rollback();
    }
    throw error;
  }

  return result;
};

/**
 * Get onboarding status for a tenant
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Onboarding status
 */
const getOnboardingStatus = async (tenantId, models) => {
  const tenant = await Tenants.findByPk(tenantId);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const roleCount = await TenantRoles.count({ where: { tenantId } });
  const featureCount = await models.TenantFeatures.count({
    where: { tenantId },
  });
  const userCount = await Users.count({ where: { tenantId } });

  let status = ONBOARDING_STATUS.PENDING;

  if (userCount > 0) {
    status = ONBOARDING_STATUS.ADMIN_CREATED;
  }
  if (roleCount >= 3) {
    status = ONBOARDING_STATUS.ROLES_SETUP;
  }
  if (featureCount > 0) {
    status = ONBOARDING_STATUS.FEATURES_ENABLED;
  }
  if (userCount > 0 && roleCount >= 3 && featureCount > 0) {
    status = ONBOARDING_STATUS.COMPLETED;
  }

  return {
    tenantId,
    status,
    completedSteps: {
      tenantCreated: true,
      adminCreated: userCount > 0,
      rolesSetup: roleCount >= 3,
      featuresEnabled: featureCount > 0,
    },
    counts: {
      users: userCount,
      roles: roleCount,
      features: featureCount,
    },
  };
};

/**
 * Complete pending onboarding steps
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} options - Options
 * @param {boolean} [options.createRoles] - Create default roles
 * @param {boolean} [options.enableFeatures] - Enable default features
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Updated onboarding status
 */
const completeOnboarding = async (tenantId, options = {}, models) => {
  const { createRoles = true, enableFeatures = true } = options;

  const status = await getOnboardingStatus(tenantId, models);

  let result = { ...status };

  if (createRoles && !status.completedSteps.rolesSetup) {
    await TenantRoles.create(
      {
        tenantId,
        name: "Tenant Owner",
        description: "Tenant owner with full access",
        level: 1,
        isAssignable: false,
        isSystemRole: true,
      },
      { transaction: models.Sequelize.transaction() },
    );

    await TenantRoles.create(
      {
        tenantId,
        name: "Tenant Admin",
        description: "Tenant administrator",
        level: 2,
        isAssignable: true,
        isSystemRole: false,
      },
      { transaction: models.Sequelize.transaction() },
    );

    await TenantRoles.create(
      {
        tenantId,
        name: "Member",
        description: "Default member role",
        level: 10,
        isAssignable: true,
        isSystemRole: false,
        isDefault: true,
      },
      { transaction: models.Sequelize.transaction() },
    );

    result = await getOnboardingStatus(tenantId, models);
  }

  if (enableFeatures && !status.completedSteps.featuresEnabled) {
    await initializeFeatures(tenantId, models);
    result = await getOnboardingStatus(tenantId, models);
  }

  return result;
};

/**
 * Generate onboarding credentials for admin user
 *
 * @param {string} userId - User UUID
 * @param {string} tenantId - Tenant UUID
 * @param {Object} models - Sequelize models
 * @returns {Promise<Object>} Credentials with tokens
 */
const generateOnboardingCredentials = async (userId, tenantId, models) => {
  const user = await Users.findByPk(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const accessToken = generateAccessToken({
    id: user.id,
    tenantId,
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    tenantId,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      tenantId,
    },
  };
};

/**
 * Send welcome email to new tenant admin
 *
 * @param {Object} user - User object
 * @param {string} tenantName - Tenant name
 * @param {Object} models - Sequelize models
 * @returns {Promise<boolean>} True if sent
 */
const sendWelcomeEmail = async (user, tenantName, models) => {
  // Email service integration placeholder
  // This would use the existing email service
  const { sendWelcomeEmail } = require("./email.service");

  try {
    await sendWelcomeEmail({
      to: user.email,
      tenantName,
      userName: `${user.firstName} ${user.lastName}`,
    });
    return true;
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return false;
  }
};

module.exports = {
  ONBOARDING_STATUS,
  DEFAULT_ONBOARDING,
  onboardTenant,
  getOnboardingStatus,
  completeOnboarding,
  generateOnboardingCredentials,
  sendWelcomeEmail,
};
