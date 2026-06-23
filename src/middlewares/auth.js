const { verifyAccessToken } = require("../utils/jwt");
const { unauthorized, forbidden } = require("../utils/response");
const { ROLE_NAMES } = require("../constants");
const authService = require("../services/auth.service");
const tenantService = require("../services/tenant.service");
const { logger } = require("./activityLog");

/**
 * Authentication Middleware
 * Validates JWT token, checks user status and session
 * Attaches tenant context when available
 */
exports.auth = async (req, res, next) => {
  try {
    // ==========================================
    // TOKEN EXTRACTION
    // ==========================================

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorized(res, "Unauthorized");
    }

    const token = authHeader.split(" ")[1];

    // ==========================================
    // VERIFY JWT
    // ==========================================

    const decoded = verifyAccessToken(token);

    // ==========================================
    // FETCH USER WITH ROLE AND TENANT
    // ==========================================

    const user = await authService.getAuthUserWithTenant(decoded.id);

    if (!user) {
      return unauthorized(res, "User not found");
    }

    // ==========================================
    // CHECK USER STATUS
    // ==========================================

    if (!user.isActive) {
      return forbidden(res, "Account banned");
    }

    if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
      return forbidden(res, `Account is ${user.status.toLowerCase()}`);
    }

    // ==========================================
    // ATTACH USER TO REQUEST (RBAC Only - No Session Validation)
    // ==========================================

    req.user = user;
    req.token = token;

    // Attach tenant context from user
    if (user.tenantId) {
      if (
        user.tenant &&
        (user.tenant.status === "suspended" ||
          user.tenant.status === "deleted" ||
          user.tenant.status === "SUSPENDED" ||
          user.tenant.status === "DELETED")
      ) {
        return forbidden(
          res,
          `Tenant account is ${user.tenant.status.toLowerCase()}`,
        );
      }
      req.tenantId = user.tenantId;
      req.tenant = user.tenant;
    }

    // Only allow explicit tenant header overrides if user is SUPER_ADMIN
    // or if the user is not bound to a tenant.
    const isSuperAdmin = user.role?.name === ROLE_NAMES.SUPER_ADMIN;

    if (isSuperAdmin || !user.tenantId) {
      const tenantCode = req.headers["x-tenant-code"];
      const tenantIdHeader = req.headers["x-tenant-id"];

      if (tenantCode && !req.tenant) {
        const tenant =
          await tenantService.getTenantByCodeForMiddleware(tenantCode);
        if (tenant) {
          req.tenant = tenant;
          req.tenantId = tenant.id;
        }
      }

      if (tenantIdHeader && !req.tenant) {
        const tenant =
          await tenantService.getTenantByIdForMiddleware(tenantIdHeader);
        if (tenant && tenant.status === "ACTIVE") {
          req.tenant = tenant;
          req.tenantId = tenant.id;
        }
      }
    }

    next();
  } catch (error) {
    logger.error(`AUTH MIDDLEWARE ERROR: ${error.message}`, error.stack);
    return unauthorized(res, "Invalid token");
  }
};

/**
 * Optional auth middleware
 * Doesn't fail if no token is provided
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const user = await authService.getAuthUserWithTenant(decoded.id);

    if (
      user &&
      user.isActive &&
      (user.status === "ACTIVE" || user.status === "INACTIVE")
    ) {
      req.user = user;
      if (user.tenantId) {
        req.tenantId = user.tenantId;
      }
    }

    next();
  } catch (error) {
    // Continue without auth
    next();
  }
};

/**
 * Super admin only middleware
 */
exports.superAdminOnly = (req, res, next) => {
  if (
    !req.user ||
    !req.user.role ||
    req.user.role.name !== ROLE_NAMES.SUPER_ADMIN
  ) {
    return forbidden(res, "Super admin access required");
  }
  next();
};
