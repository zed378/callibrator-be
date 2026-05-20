/**
 * Tests for tenantFeature service
 */

// Mock models before importing service
const mockTenantFeatures = {
  findOne: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  getEnabledFeatures: jest.fn(),
  initializeDefaultFeatures: jest.fn(),
  bulkCreate: jest.fn(),
  isFeatureEnabled: jest.fn(),
};

jest.mock("../../models", () => ({
  TenantFeatures: mockTenantFeatures,
}));

jest.mock("../../utils/appError", () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = "NotFoundError";
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message) {
      super(message);
      this.name = "ConflictError";
    }
  },
}));

const {
  enableFeature,
  disableFeature,
  isFeatureEnabled,
  getTenantFeatures,
  getEnabledFeatures,
  updateFeatureConfig,
  setFeatureExpiration,
  initializeFeatures,
} = require("../../services/tenantFeature.service");
const { TenantFeatures } = require("../../models");

describe("Tenant Feature Service", () => {
  const mockModels = { TenantFeatures };
  const mockTenantId = "tenant-123";
  const mockFeatureKey = "advanced_analytics";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("enableFeature", () => {
    it("should enable a feature", async () => {
      const mockFeature = {
        id: "feature-1",
        tenantId: mockTenantId,
        featureKey: mockFeatureKey,
        isEnabled: false,
        tier: "PREMIUM",
        config: {},
        expiresAt: null,
        enabledBy: null,
      };

      // Mock update to return this same object with updated property
      mockFeature.update = jest.fn().mockImplementation(async (updates) => {
        Object.assign(mockFeature, updates);
        return mockFeature;
      });

      TenantFeatures.findOne.mockResolvedValue(mockFeature);

      const result = await enableFeature(
        {
          tenantId: mockTenantId,
          featureKey: mockFeatureKey,
          userId: "user-1",
          config: { maxProjects: 10 },
        },
        mockModels,
      );

      expect(mockFeature.update).toHaveBeenCalledWith({
        isEnabled: true,
        config: { maxProjects: 10 },
        enabledBy: "user-1",
      });
      expect(result.isEnabled).toBe(true);
    });

    it("should throw NotFoundError if feature not found", async () => {
      TenantFeatures.findOne.mockResolvedValue(null);

      await expect(
        enableFeature(
          {
            tenantId: mockTenantId,
            featureKey: "nonexistent",
            userId: "user-1",
          },
          mockModels,
        ),
      ).rejects.toThrow("Feature nonexistent not found for this tenant");
    });
  });

  describe("disableFeature", () => {
    it("should disable a feature", async () => {
      const mockFeature = {
        isEnabled: true,
      };

      // Mock update to return this same object with updated property
      mockFeature.update = jest.fn().mockImplementation(async (updates) => {
        Object.assign(mockFeature, updates);
        return mockFeature;
      });

      TenantFeatures.findOne.mockResolvedValue(mockFeature);

      const result = await disableFeature(
        {
          tenantId: mockTenantId,
          featureKey: mockFeatureKey,
        },
        mockModels,
      );

      expect(mockFeature.update).toHaveBeenCalledWith({
        isEnabled: false,
      });
      expect(result.isEnabled).toBe(false);
    });

    it("should throw NotFoundError if feature not found", async () => {
      TenantFeatures.findOne.mockResolvedValue(null);

      await expect(
        disableFeature(
          {
            tenantId: mockTenantId,
            featureKey: "nonexistent",
          },
          mockModels,
        ),
      ).rejects.toThrow("Feature nonexistent not found for this tenant");
    });
  });

  describe("isFeatureEnabled", () => {
    it("should return true if feature is enabled", async () => {
      TenantFeatures.isFeatureEnabled.mockResolvedValue(true);

      const result = await isFeatureEnabled(
        mockTenantId,
        mockFeatureKey,
        mockModels,
      );

      expect(result).toBe(true);
      expect(TenantFeatures.isFeatureEnabled).toHaveBeenCalledWith(
        mockTenantId,
        mockFeatureKey,
        mockModels,
      );
    });

    it("should return false if feature is not enabled", async () => {
      TenantFeatures.isFeatureEnabled.mockResolvedValue(false);

      const result = await isFeatureEnabled(
        mockTenantId,
        mockFeatureKey,
        mockModels,
      );

      expect(result).toBe(false);
    });
  });

  describe("getTenantFeatures", () => {
    it("should return all features for a tenant", async () => {
      const mockFeatures = [
        { featureKey: "advanced_analytics", isEnabled: true },
        { featureKey: "sso", isEnabled: false },
      ];

      TenantFeatures.findAll.mockResolvedValue(mockFeatures);

      const result = await getTenantFeatures(mockTenantId, mockModels);

      expect(TenantFeatures.findAll).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
        order: [["featureKey", "ASC"]],
      });
      expect(result).toEqual(mockFeatures);
    });
  });

  describe("getEnabledFeatures", () => {
    it("should return enabled features keyed by featureKey", async () => {
      const mockFeatures = [
        { featureKey: "api_access", config: {}, tier: "FREE", isEnabled: true },
        {
          featureKey: "webhooks",
          config: { url: "https://example.com" },
          tier: "BETA",
          isEnabled: true,
        },
      ];

      TenantFeatures.getEnabledFeatures.mockResolvedValue(mockFeatures);

      const result = await getEnabledFeatures(mockTenantId, mockModels);

      expect(result).toEqual({
        api_access: { enabled: true, config: {}, tier: "FREE" },
        webhooks: {
          enabled: true,
          config: { url: "https://example.com" },
          tier: "BETA",
        },
      });
    });
  });

  describe("updateFeatureConfig", () => {
    it("should update feature configuration", async () => {
      const mockFeature = {
        config: { maxProjects: 5 },
      };

      // Mock update to return this same object with updated property
      mockFeature.update = jest.fn().mockImplementation(async (updates) => {
        Object.assign(mockFeature, updates);
        return mockFeature;
      });

      TenantFeatures.findOne.mockResolvedValue(mockFeature);

      const result = await updateFeatureConfig(
        {
          tenantId: mockTenantId,
          featureKey: mockFeatureKey,
          config: { maxProjects: 10, allowExport: true },
        },
        mockModels,
      );

      expect(mockFeature.update).toHaveBeenCalledWith({
        config: { maxProjects: 10, allowExport: true },
      });
    });

    it("should throw NotFoundError if feature not found", async () => {
      TenantFeatures.findOne.mockResolvedValue(null);

      await expect(
        updateFeatureConfig(
          {
            tenantId: mockTenantId,
            featureKey: "nonexistent",
            config: {},
          },
          mockModels,
        ),
      ).rejects.toThrow("Feature nonexistent not found for this tenant");
    });
  });

  describe("setFeatureExpiration", () => {
    it("should set feature expiration date", async () => {
      const mockFeature = {
        expiresAt: null,
      };

      // Mock update to return this same object with updated property
      mockFeature.update = jest.fn().mockImplementation(async (updates) => {
        Object.assign(mockFeature, updates);
        return mockFeature;
      });

      TenantFeatures.findOne.mockResolvedValue(mockFeature);

      const expirationDate = new Date("2025-12-31T23:59:59.000Z");
      const result = await setFeatureExpiration(
        {
          tenantId: mockTenantId,
          featureKey: mockFeatureKey,
          expiresAt: expirationDate,
        },
        mockModels,
      );

      expect(mockFeature.update).toHaveBeenCalledWith({
        expiresAt: expirationDate,
      });
    });
  });

  describe("initializeFeatures", () => {
    it("should initialize default features for a tenant", async () => {
      const mockCreatedFeatures = [
        { featureKey: "api_access", isEnabled: true },
        { featureKey: "team_collaboration", isEnabled: true },
      ];

      TenantFeatures.initializeDefaultFeatures.mockResolvedValue(
        mockCreatedFeatures,
      );

      const result = await initializeFeatures(mockTenantId, mockModels);

      expect(TenantFeatures.initializeDefaultFeatures).toHaveBeenCalledWith(
        mockTenantId,
        mockModels,
      );
      expect(result).toEqual(mockCreatedFeatures);
    });
  });
});
