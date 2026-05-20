const { Tenants } = require("../models");
const { unauthorized, badRequest } = require("../utils/response");
const { NotFoundError } = require("../utils/appError");

/**
 * Tenant Identification Middleware
 *
 * Identifies the tenant from one of the following sources (in order of priority):
 * 1. X-Tenant-Code header
 * 2. X-Tenant-ID header
 * 3. subdomain from host (e.g., acme.api.example.com -> acme)
 * 4. query parameter: ?tenantCode= or ?tenantId=
 *
 * Attaches tenant object to req.tenant for downstream use.
 *
 * @param {boolean} requireTenant - Whether tenant identification is required (default: true)
 * @returns {Function} Express middleware
 */
const identifyTenant = (requireTenant = true) => {
  return async (req, res, next) => {
    try {
      let tenant = null;

      // Priority 1: X-Tenant-Code header
      const tenantCode = req.headers["x-tenant-code"];
      if (tenantCode) {
        tenant = await Tenants.findOne({
          where: { code: tenantCode, status: "ACTIVE" },
          attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
        });
      }

      // Priority 2: X-Tenant-ID header
      const tenantId = req.headers["x-tenant-id"];
      if (!tenant && tenantId) {
        tenant = await Tenants.findByPk(tenantId, {
          attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
        });
        if (tenant && tenant.status !== "ACTIVE") {
          tenant = null;
        }
      }

      // Priority 3: Subdomain extraction
      if (!tenant) {
        const host = req.headers.host || "";
        const parts = host.split(".");
        if (parts.length > 2) {
          const subdomain = parts[0];
          // Exclude common non-tenant subdomains
          const excludedSubdomains = ["www", "api", "app", "localhost"];
          if (!excludedSubdomains.includes(subdomain.toLowerCase())) {
            tenant = await Tenants.findOne({
              where: { code: subdomain, status: "ACTIVE" },
              attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
            });
          }
        }
      }

      // Priority 4: Query parameters
      if (!tenant) {
        const queryCode = req.query.tenantCode;
        if (queryCode) {
          tenant = await Tenants.findOne({
            where: { code: queryCode, status: "ACTIVE" },
            attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
          });
        }
      }

      if (!tenant && !req.query.tenantCode) {
        const queryId = req.query.tenantId;
        if (queryId) {
          tenant = await Tenants.findByPk(queryId, {
            attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
          });
          if (tenant && tenant.status !== "ACTIVE") {
            tenant = null;
          }
        }
      }

      // Handle tenant not found
      if (!tenant) {
        if (requireTenant) {
          // Check if tenant identification was attempted but failed
          if (
            tenantCode ||
            tenantId ||
            req.query.tenantCode ||
            req.query.tenantId
          ) {
            throw new NotFoundError("Tenant not found");
          }
          // No tenant identification provided - check if user has tenant
          if (req.user && req.user.tenantId) {
            tenant = await Tenants.findByPk(req.user.tenantId, {
              attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
            });
            if (!tenant || tenant.status !== "ACTIVE") {
              return badRequest(res, "User has no active tenant assigned");
            }
          } else {
            return badRequest(
              res,
              "Tenant identification required. Provide X-Tenant-Code, X-Tenant-ID header, or subdomain.",
            );
          }
        }
      }

      // Attach tenant to request
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
      }

      next();
    } catch (error) {
      if (error instanceof NotFoundError) {
        return unauthorized(res, error.message);
      }
      next(error);
    }
  };
};

/**
 * Require active tenant middleware
 * Convenience wrapper that requires tenant identification
 */
const requireActiveTenant = identifyTenant(true);

/**
 * Optional tenant middleware
 * Attempts to identify tenant but doesn't fail if not found
 */
const optionalTenant = identifyTenant(false);

module.exports = {
  identifyTenant,
  requireActiveTenant,
  optionalTenant,
};
