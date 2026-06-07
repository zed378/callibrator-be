/**
 * Tests for Model Discovery Service
 */

const {
  ModelDiscoveryService,
} = require("../../services/modelDiscovery.service");
const { Op, Sequelize } = require("sequelize");

// Mock models
const mockModels = {
  Models: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
  },
  Users: {
    tableName: "users",
    modelName: "Users",
    rawAttributes: {
      id: { field: "id" },
      email: { field: "email" },
      username: { field: "username" },
    },
    associations: {
      role: { as: "role", target: "Roles" },
      tenant: { as: "tenant", target: "Tenants" },
    },
    associate: jest.fn(),
  },
  Tenants: {
    tableName: "tenants",
    modelName: "Tenants",
    rawAttributes: {
      id: { field: "id" },
      name: { field: "name" },
      code: { field: "code" },
    },
    associations: {},
    associate: jest.fn(),
  },
  Roles: {
    tableName: "roles",
    modelName: "Roles",
    rawAttributes: {
      id: { field: "id" },
      name: { field: "name" },
    },
    associations: {},
    associate: jest.fn(),
  },
  Permissions: {
    tableName: "permissions",
    modelName: "Permissions",
    rawAttributes: {
      id: { field: "id" },
      name: { field: "name" },
      module: { field: "module" },
    },
    associations: {},
    associate: jest.fn(),
  },
};

jest.mock("../../models", () => mockModels);

describe("ModelDiscoveryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.Models.findAll.mockResolvedValue([]);
    mockModels.Models.findOne.mockResolvedValue(null);
  });

  describe("discoverAllModels", () => {
    it("should discover and register all models", async () => {
      const mockModelRecord = {
        id: "test-id",
        modelName: "Users",
        tableName: "users",
        module: "user",
        attributeCount: 3,
        attributes: JSON.stringify(["id", "email", "username"]),
        relationCount: 2,
        relations: JSON.stringify([
          { model: "Roles", type: "BELONGS_TO" },
          { model: "Tenants", type: "BELONGS_TO" },
        ]),
        description: "User management",
        isActive: true,
      };

      mockModels.Models.findOne.mockResolvedValue(mockModelRecord);

      const result = await ModelDiscoveryService.discoverAllModels();

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should skip already registered models", async () => {
      const mockModelRecord = {
        id: "test-id",
        modelName: "Users",
        tableName: "users",
        module: "user",
        attributeCount: 3,
        attributes: JSON.stringify(["id", "email", "username"]),
        isActive: true,
      };

      mockModels.Models.findOne.mockResolvedValue(mockModelRecord);

      const result = await ModelDiscoveryService.discoverAllModels();

      expect(mockModels.Models.create).not.toHaveBeenCalled();
    });

    it("should register new models that are not in database", async () => {
      mockModels.Models.findOne.mockResolvedValue(null);
      mockModels.Models.create.mockResolvedValue({
        id: "new-id",
        modelName: "Users",
        tableName: "users",
        module: "user",
        attributeCount: 3,
        attributes: '["id", "email", "username"]',
        relationCount: 0,
        relations: "[]",
        description: "User management",
        isActive: true,
        isNewRecord: true,
      });

      await ModelDiscoveryService.discoverAllModels();

      expect(mockModels.Models.create).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: "Users",
          tableName: "users",
        }),
      );
    });
  });

  describe("getAllModels", () => {
    it("should return all registered models", async () => {
      const mockModelsList = [
        {
          id: "1",
          modelName: "Users",
          tableName: "users",
          module: "user",
        },
        {
          id: "2",
          modelName: "Tenants",
          tableName: "tenants",
          module: "tenant",
        },
      ];

      mockModels.Models.findAll.mockResolvedValue(mockModelsList);

      const result = await ModelDiscoveryService.getAllModels();

      expect(result).toEqual(mockModelsList);
      expect(mockModels.Models.findAll).toHaveBeenCalled();
    });

    it("should return empty array when no models are registered", async () => {
      mockModels.Models.findAll.mockResolvedValue([]);

      const result = await ModelDiscoveryService.getAllModels();

      expect(result).toEqual([]);
    });
  });

  describe("getModelByName", () => {
    it("should return a model by name", async () => {
      const mockModel = {
        id: "1",
        modelName: "Users",
        tableName: "users",
        module: "user",
      };

      mockModels.Models.findOne.mockResolvedValue(mockModel);

      const result = await ModelDiscoveryService.getModelByName("Users");

      expect(result).toEqual(mockModel);
      expect(mockModels.Models.findOne).toHaveBeenCalledWith({
        where: { modelName: "Users" },
      });
    });

    it("should return null when model not found", async () => {
      mockModels.Models.findOne.mockResolvedValue(null);

      const result = await ModelDiscoveryService.getModelByName("NonExistent");

      expect(result).toBeNull();
    });
  });

  describe("registerModel", () => {
    it("should register a new model", async () => {
      const modelData = {
        modelName: "Users",
        tableName: "users",
        module: "user",
        description: "User management",
      };

      const createdModel = {
        id: "new-id",
        ...modelData,
        attributeCount: 0,
        attributes: "[]",
        relationCount: 0,
        relations: "[]",
        isActive: true,
      };

      mockModels.Models.findOne.mockResolvedValue(null);
      mockModels.Models.create.mockResolvedValue(createdModel);

      const result = await ModelDiscoveryService.registerModel(modelData);

      expect(result).toEqual(createdModel);
      expect(mockModels.Models.create).toHaveBeenCalledWith(
        expect.objectContaining(modelData),
      );
    });

    it("should return existing model if already registered", async () => {
      const existingModel = {
        id: "existing-id",
        modelName: "Users",
        tableName: "users",
        module: "user",
      };

      mockModels.Models.findOne.mockResolvedValue(existingModel);

      const result = await ModelDiscoveryService.registerModel({
        modelName: "Users",
        tableName: "users",
        module: "user",
      });

      expect(result).toEqual(existingModel);
      expect(mockModels.Models.create).not.toHaveBeenCalled();
    });
  });

  describe("getModelAttributes", () => {
    it("should extract model attributes", () => {
      const model = {
        rawAttributes: {
          id: { field: "id", type: "UUID" },
          email: { field: "email", type: "STRING" },
          username: { field: "username", type: "STRING" },
        },
      };

      const attributes = ModelDiscoveryService.getModelAttributes(model);

      expect(attributes).toEqual([
        { name: "id", type: "UUID", field: "id" },
        { name: "email", type: "STRING", field: "email" },
        { name: "username", type: "STRING", field: "username" },
      ]);
    });

    it("should return empty array for model without attributes", () => {
      const model = { rawAttributes: {} };

      const attributes = ModelDiscoveryService.getModelAttributes(model);

      expect(attributes).toEqual([]);
    });
  });

  describe("getModelRelations", () => {
    it("should extract model relations", () => {
      const model = {
        associations: {
          role: { as: "role", target: "Roles", associationType: "BelongsTo" },
          tenant: {
            as: "tenant",
            target: "Tenants",
            associationType: "BelongsTo",
          },
          permissions: {
            as: "permissions",
            target: "Permissions",
            associationType: "BelongsToMany",
          },
        },
      };

      const relations = ModelDiscoveryService.getModelRelations(model);

      expect(relations).toEqual([
        { model: "Roles", type: "BelongsTo", as: "role" },
        { model: "Tenants", type: "BelongsTo", as: "tenant" },
        { model: "Permissions", type: "BelongsToMany", as: "permissions" },
      ]);
    });

    it("should return empty array for model without relations", () => {
      const model = { associations: {} };

      const relations = ModelDiscoveryService.getModelRelations(model);

      expect(relations).toEqual([]);
    });
  });
});
