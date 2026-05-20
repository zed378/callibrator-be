const { verifyAccessToken } = require("../utils/jwt");
const { findSession } = require("../utils/session");
const { Users, Roles, Tenants } = require("../models");
const { unauthorized, forbidden } = require("../utils/response");
const { ROLE_NAMES } = require("../utils/constants");

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
        attributes: ["id", "name", "description", "nameToShow"],
      },
    ];

    // Include tenant if user has tenantId
    if (true) {
      includeOptions.push({
        model: Tenants,
        as: "tenant",
        attributes: ["id", "name", "code", "logo", "status"],
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

    if (user.isBanned) {
      return forbidden(res, "Account banned");
    }

    if (user.status === "INACTIVE" || user.status === "SUSPENDED") {
      return forbidden(res, `Account is ${user.status.toLowerCase()}`);
    }

    // ==========================================
    // EXTRACT SESSION ID FROM X-SESSION HEADER
    // ==========================================

    const xSessionHeader = req.headers["X-Session"];

    // ==========================================
    // VALIDATE SESSION
    // ==========================================

    const session = await findSession({
      token,
      userId: user.id,
      sessionId: xSessionHeader || null,
    });

    if (!session) {
      return unauthorized(res, "Session not found");
    }

    // ==========================================
    // CHECK SESSION EXPIRY
    // ==========================================

    if (new Date(session.expiredAt) < new Date()) {
      return unauthorized(res, "Session expired");
    }

    // ==========================================
    // ATTACH USER AND SESSION TO REQUEST
    // ==========================================

    req.user = user;
    req.session = session.id;
    req.token = token;

    // Attach session ID from x-session header for tracking
    if (xSessionHeader) {
      req.sessionHeader = xSessionHeader;
    }

    // Attach tenant context from user
    if (user.tenantId) {
      req.tenantId = user.tenantId;
    }

    // Attach tenant from header if provided
    const tenantCode = req.headers["x-tenant-code"];
    const tenantIdHeader = req.headers["x-tenant-id"];

    if (tenantCode && !req.tenant) {
      const tenant = await Tenants.findOne({
        where: { code: tenantCode, status: "ACTIVE" },
        attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
      });
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
      }
    }

    if (tenantIdHeader && !req.tenant) {
      const tenant = await Tenants.findByPk(tenantIdHeader, {
        attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
      });
      if (tenant && tenant.status === "ACTIVE") {
        req.tenant = tenant;
        req.tenantId = tenant.id;
      }
    }

    next();
  } catch (error) {
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
          attributes: ["id", "name", "description", "nameToShow"],
        },
        {
          model: Tenants,
          as: "tenant",
          attributes: ["id", "name", "code", "logo", "status"],
        },
      ],
    });

    if (
      user &&
      !user.isBanned &&
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
