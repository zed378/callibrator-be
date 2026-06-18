const { verifyAccessToken } = require("../utils/jwt");
const { Users, Roles, Tenants } = require("../models");
const { unauthorized, forbidden } = require("../utils/response");
const { ROLE_NAMES } = require("../constants");

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

    const includeOptions = [
      {
        model: Roles,
        as: "role",
        attributes: ["id", "name", "description"],
      },
    ];

    // Include tenant if user has tenantId
    // Note: DB tenants table doesn't have 'code' or 'logo' columns
    if (true) {
      includeOptions.push({
        model: Tenants,
        as: "tenant",
        attributes: ["id", "name", "status"],
      });
    }

    const user = await Users.findByPk(decoded.id, {
      include: includeOptions,
    });

    if (!user) {
      return unauthorized(res, "User not found");
    }

    // ==========================================
    // CHECK USER STATUS
    // ==========================================

    if (!user.is_active) {
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
      req.tenantId = user.tenantId;
    }

    // Attach tenant from header if provided
    const tenantCode = req.headers["x-tenant-code"];
    const tenantIdHeader = req.headers["x-tenant-id"];

    if (tenantCode && !req.tenant) {
      const tenant = await Tenants.findOne({
        where: { name: tenantCode, status: "active" },
        attributes: ["id", "name", "status"],
      });
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
      }
    }

    if (tenantIdHeader && !req.tenant) {
      const tenant = await Tenants.findByPk(tenantIdHeader, {
        attributes: ["id", "name", "status"],
      });
      if (tenant && tenant.status === "ACTIVE") {
        req.tenant = tenant;
        req.tenantId = tenant.id;
      }
    }

    next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error.message, error.stack);
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

    const user = await Users.findByPk(decoded.id, {
      include: [
        {
          model: Roles,
          as: "role",
          attributes: ["id", "name", "description"],
        },
        {
          model: Tenants,
          as: "tenant",
          attributes: ["id", "name", "status"],
        },
      ],
    });

    if (
      user &&
      user.is_active &&
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
