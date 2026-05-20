const {
  scopeToTenant,
  createTenantScope,
  enforceTenantIsolation,
} = require("../../middlewares/tenantScope");
const { ROLE_NAMES } = require("../../utils/constants");

describe("Tenant Scope Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockReq = (options = {}) => ({
    tenant: options.tenant || null,
    tenantId: options.tenantId || null,
    user: options.user || null,
    path: options.path || "/",
    headers: options.headers || {},
  });

  const createMockNext = () => jest.fn();

  describe("scopeToTenant", () => {
    it("should skip if tenant already exists", async () => {
      const mockReq = createMockReq({
        tenantId: "existing-tenant",
      });
      const mockNext = createMockNext();

      const middleware = scopeToTenant();
      await middleware(mockReq, {}, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should skip exempt routes", async () => {
      const mockReq = createMockReq({
        path: "/api/health",
      });
      const mockNext = createMockNext();

      const middleware = scopeToTenant({ exemptRoutes: ["/api/health"] });
      await middleware(mockReq, {}, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should set tenantId from user.tenantId", async () => {
      const mockReq = createMockReq({
        user: { tenantId: "user-tenant-1" },
      });
      const mockNext = createMockNext();

      const middleware = scopeToTenant();
      await middleware(mockReq, {}, mockNext);

      expect(mockReq.tenantId).toBe("user-tenant-1");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow super admin to specify target tenant", async () => {
      const mockReq = createMockReq({
        user: {
          role: { name: ROLE_NAMES.SUPER_ADMIN },
          tenantId: null,
        },
        headers: { "x-target-tenant-id": "target-tenant-123" },
      });
      const mockNext = createMockNext();

      const middleware = scopeToTenant();
      await middleware(mockReq, {}, mockNext);

      expect(mockReq.tenantId).toBe("target-tenant-123");
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("createTenantScope", () => {
    it("should return tenantId from req.tenantId", () => {
      const mockReq = { tenantId: "scope-tenant-1" };
      const scope = createTenantScope(mockReq);

      expect(scope).toEqual({ tenantId: "scope-tenant-1" });
    });

    it("should return tenantId from req.user.tenantId", () => {
      const mockReq = { user: { tenantId: "user-scope-tenant" } };
      const scope = createTenantScope(mockReq);

      expect(scope).toEqual({ tenantId: "user-scope-tenant" });
    });

    it("should return empty object for super admin with cross-tenant access", () => {
      const mockReq = {
        user: {
          role: { name: ROLE_NAMES.SUPER_ADMIN },
        },
      };
      const scope = createTenantScope(mockReq, {
        allowSuperAdminCrossTenant: true,
      });

      expect(scope).toEqual({});
    });

    it("should return null when no tenant context", () => {
      const mockReq = { user: {} };
      const scope = createTenantScope(mockReq);

      expect(scope).toBeNull();
    });
  });

  describe("enforceTenantIsolation", () => {
    it("should not throw for super admin", () => {
      const mockReq = {
        user: {
          role: { name: ROLE_NAMES.SUPER_ADMIN },
        },
      };

      expect(() => enforceTenantIsolation(mockReq)).not.toThrow();
    });

    it("should not throw when tenant context exists", () => {
      const mockReq = {
        user: { tenantId: "tenant-1" },
      };

      expect(() => enforceTenantIsolation(mockReq)).not.toThrow();
    });

    it("should throw when no tenant context and not super admin", () => {
      const mockReq = {
        user: {
          role: { name: ROLE_NAMES.USER },
          tenantId: null,
        },
      };

      expect(() => enforceTenantIsolation(mockReq)).toThrow(
        "Tenant context required for this operation",
      );
    });
  });
});
