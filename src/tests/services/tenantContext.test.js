/**
 * Tests for tenantContext middleware
 */

// Mock models before importing middleware
const mockTenants = {
  findOne: jest.fn(),
  findByPk: jest.fn(),
};

jest.mock("../../models", () => ({
  Tenants: mockTenants,
}));

jest.mock("../../utils/response", () => ({
  unauthorized: jest.fn(),
  badRequest: jest.fn(),
}));

jest.mock("../../utils/appError", () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = "NotFoundError";
    }
  },
}));

const {
  identifyTenant,
  requireActiveTenant,
  optionalTenant,
} = require("../../middlewares/tenantContext");
const { Tenants } = require("../../models");
const { badRequest } = require("../../utils/response");

describe("Tenant Context Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockReq = (options = {}) => ({
    headers: options.headers || {},
    query: options.query || {},
    user: options.user || null,
    tenant: options.tenant || null,
    tenantId: options.tenantId || null,
  });

  const createMockRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  const createMockNext = () => jest.fn();

  describe("identifyTenant", () => {
    it("should identify tenant from X-Tenant-Code header", async () => {
      const mockReq = createMockReq({
        headers: { "x-tenant-code": "acme" },
      });
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findOne.mockResolvedValue({
        id: "tenant-1",
        name: "Acme Corp",
        code: "acme",
        logo: "logo.svg",
        status: "ACTIVE",
        maxUsers: 50,
      });

      const middleware = identifyTenant(true);
      await middleware(mockReq, mockRes, mockNext);

      expect(Tenants.findOne).toHaveBeenCalledWith({
        where: { code: "acme", status: "ACTIVE" },
        attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
      });
      expect(mockReq.tenant).toBeDefined();
      expect(mockReq.tenantId).toBe("tenant-1");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should identify tenant from X-Tenant-ID header", async () => {
      const mockReq = createMockReq({
        headers: { "x-tenant-id": "tenant-123" },
      });
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findByPk.mockResolvedValue({
        id: "tenant-123",
        name: "Acme Corp",
        code: "acme",
        logo: "logo.svg",
        status: "ACTIVE",
        maxUsers: 50,
      });

      const middleware = identifyTenant(true);
      await middleware(mockReq, mockRes, mockNext);

      expect(Tenants.findByPk).toHaveBeenCalledWith("tenant-123", {
        attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
      });
      expect(mockReq.tenant).toBeDefined();
      expect(mockReq.tenantId).toBe("tenant-123");
    });

    it("should identify tenant from subdomain", async () => {
      const mockReq = createMockReq({
        headers: { host: "acme.api.example.com" },
      });
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findOne.mockResolvedValue({
        id: "tenant-subdomain",
        name: "Acme Corp",
        code: "acme",
        logo: "logo.svg",
        status: "ACTIVE",
        maxUsers: 50,
      });

      const middleware = identifyTenant(true);
      await middleware(mockReq, mockRes, mockNext);

      expect(Tenants.findOne).toHaveBeenCalledWith({
        where: { code: "acme", status: "ACTIVE" },
        attributes: ["id", "name", "code", "logo", "status", "maxUsers"],
      });
      expect(mockReq.tenant).toBeDefined();
    });

    it("should identify tenant from query parameter", async () => {
      const mockReq = createMockReq({
        query: { tenantCode: "acme" },
      });
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findOne.mockResolvedValue({
        id: "tenant-query",
        name: "Acme Corp",
        code: "acme",
        logo: "logo.svg",
        status: "ACTIVE",
        maxUsers: 50,
      });

      const middleware = identifyTenant(true);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.tenant).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should use user tenantId when no identification provided", async () => {
      const mockReq = createMockReq({
        user: { tenantId: "user-tenant-1" },
      });
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findByPk.mockResolvedValue({
        id: "user-tenant-1",
        name: "User Tenant",
        code: "usertenant",
        logo: "logo.svg",
        status: "ACTIVE",
        maxUsers: 10,
      });

      const middleware = identifyTenant(true);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.tenant).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should not fail when tenant identification is optional and not found", async () => {
      const mockReq = createMockReq({});
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findOne.mockResolvedValue(null);
      Tenants.findByPk.mockResolvedValue(null);

      const middleware = optionalTenant;
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.tenant).toBeNull();
    });

    it("should prioritize X-Tenant-Code over X-Tenant-ID", async () => {
      const mockReq = createMockReq({
        headers: {
          "x-tenant-code": "code-tenant",
          "x-tenant-id": "id-tenant-123",
        },
      });
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findOne.mockResolvedValue({
        id: "code-tenant-id",
        name: "Code Tenant",
        code: "code-tenant",
        status: "ACTIVE",
        maxUsers: 10,
        logo: "logo.svg",
      });

      const middleware = identifyTenant(true);
      await middleware(mockReq, mockRes, mockNext);

      expect(Tenants.findOne).toHaveBeenCalled();
      expect(mockReq.tenantId).toBe("code-tenant-id");
    });
  });

  describe("requireActiveTenant", () => {
    it("should be alias for identifyTenant(true)", async () => {
      const mockReq = createMockReq({
        headers: { "x-tenant-code": "test" },
      });
      const mockRes = createMockRes();
      const mockNext = createMockNext();

      Tenants.findOne.mockResolvedValue({
        id: "tenant-1",
        name: "Test Tenant",
        code: "test",
        status: "ACTIVE",
        maxUsers: 10,
        logo: "logo.svg",
      });

      const middleware = requireActiveTenant;
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
