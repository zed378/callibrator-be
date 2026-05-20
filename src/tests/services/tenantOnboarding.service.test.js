/**
 * Tests for tenantOnboarding service
 */

// Mock models before importing service
const mockTenants = {
  create: jest.fn(),
  findByPk: jest.fn(),
};

const mockUsers = {
  create: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  findByPk: jest.fn(),
};

const mockTenantRoles = {
  create: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
};

const mockTenantFeatures = {
  count: jest.fn(),
};

jest.mock("../../models", () => ({
  Tenants: mockTenants,
  Users: mockUsers,
  TenantRoles: mockTenantRoles,
  TenantFeatures: mockTenantFeatures,
}));

// Mock Sequelize
const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
const mockSequelize = {
  transaction: jest.fn().mockResolvedValue(mockTransaction),
  TRANSACTION_NONE: {},
};

// Mock audit service
jest.mock("../../services/tenantAudit.service", () => ({
  createLog: jest.fn(),
  ACTIONS: {
    USER_CREATE: "user.create",
  },
  SEVERITY: {
    INFO: "INFO",
  },
}));

// Mock feature service
jest.mock("../../services/tenantFeature.service", () => ({
  initializeFeatures: jest.fn().mockResolvedValue([]),
}));

// Mock JWT
jest.mock("../../utils/jwt", () => ({
  generateAccessToken: jest.fn().mockReturnValue("mock-access-token"),
  generateRefreshToken: jest.fn().mockReturnValue("mock-refresh-token"),
}));

// Mock session service
jest.mock("../../services/session.service", () => ({
  createSession: jest.fn().mockResolvedValue({ id: "session-1" }),
}));

const {
  onboardTenant,
  getOnboardingStatus,
  completeOnboarding,
  ONBOARDING_STATUS,
} = require("../../services/tenantOnboarding.service");

describe("Tenant Onboarding Service", () => {
  const mockTenantId = "tenant-123";
  const mockUserId = "user-456";

  // Create mock models object that matches what the service expects
  const mockModels = {
    TenantFeatures: mockTenantFeatures,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("onboardTenant", () => {
    it("should create tenant with full onboarding", async () => {
      const mockTenant = {
        id: mockTenantId,
        name: "Acme Corp",
        code: "acme",
        status: "ACTIVE",
      };

      const mockAdminUser = {
        id: mockUserId,
        firstName: "Admin",
        lastName: "User",
        email: "admin@acme.com",
        tenantId: mockTenantId,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockRole = {
        id: "role-1",
        name: "Tenant Admin",
      };

      mockTenants.create.mockResolvedValue(mockTenant);
      mockUsers.create.mockResolvedValue(mockAdminUser);
      mockTenantRoles.create.mockResolvedValue(mockRole);
      mockTenantRoles.findOne.mockResolvedValue(mockRole);

      const result = await onboardTenant(
        {
          name: "Acme Corp",
          code: "acme",
          admin: {
            firstName: "Admin",
            lastName: "User",
            email: "admin@acme.com",
          },
          createDefaultRoles: true,
          enableDefaultFeatures: true,
        },
        { Sequelize: mockSequelize },
      );

      expect(mockTenants.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme Corp",
          code: "acme",
          status: "ACTIVE",
        }),
        expect.any(Object),
      );

      expect(mockUsers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          isEmailVerified: true,
        }),
        expect.any(Object),
      );

      expect(result.tenant).toEqual(mockTenant);
      expect(result.adminUser).toEqual(mockAdminUser);
      expect(result.onboardingStatus).toBe(ONBOARDING_STATUS.COMPLETED);
    });

    it("should rollback on error", async () => {
      mockTenants.create.mockRejectedValue(new Error("Database error"));

      await expect(
        onboardTenant(
          {
            name: "Acme Corp",
            code: "acme",
          },
          { Sequelize: mockSequelize },
        ),
      ).rejects.toThrow("Database error");

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe("getOnboardingStatus", () => {
    it("should return PENDING when no users exist", async () => {
      const mockTenant = { id: mockTenantId };
      mockTenants.findByPk.mockResolvedValue(mockTenant);
      mockUsers.count.mockResolvedValue(0);
      mockTenantRoles.count.mockResolvedValue(0);
      mockTenantFeatures.count.mockResolvedValue(0);

      const result = await getOnboardingStatus(mockTenantId, mockModels);

      expect(result.status).toBe(ONBOARDING_STATUS.PENDING);
      expect(result.completedSteps.tenantCreated).toBe(true);
      expect(result.completedSteps.adminCreated).toBe(false);
    });

    it("should return COMPLETED when all steps done", async () => {
      const mockTenant = { id: mockTenantId };
      mockTenants.findByPk.mockResolvedValue(mockTenant);
      mockUsers.count.mockResolvedValue(5);
      mockTenantRoles.count.mockResolvedValue(3);
      mockTenantFeatures.count.mockResolvedValue(10);

      const result = await getOnboardingStatus(mockTenantId, mockModels);

      expect(result.status).toBe(ONBOARDING_STATUS.COMPLETED);
      expect(result.completedSteps.adminCreated).toBe(true);
      expect(result.completedSteps.rolesSetup).toBe(true);
      expect(result.completedSteps.featuresEnabled).toBe(true);
    });

    it("should throw error if tenant not found", async () => {
      mockTenants.findByPk.mockResolvedValue(null);

      await expect(
        getOnboardingStatus("nonexistent", mockModels),
      ).rejects.toThrow("Tenant not found");
    });
  });

  describe("completeOnboarding", () => {
    it("should complete pending steps", async () => {
      const mockTenant = { id: mockTenantId };
      mockTenants.findByPk.mockResolvedValue(mockTenant);

      // First call: incomplete
      mockUsers.count.mockResolvedValue(1);
      mockTenantRoles.count.mockResolvedValue(0);
      mockTenantFeatures.count.mockResolvedValue(0);

      // Second call: after completion
      mockTenantRoles.count.mockResolvedValue(3);
      mockTenantFeatures.count.mockResolvedValue(5);

      const result = await completeOnboarding(
        mockTenantId,
        {
          createRoles: true,
          enableFeatures: true,
        },
        mockModels,
      );

      expect(result.status).toBe(ONBOARDING_STATUS.COMPLETED);
    });
  });
});
