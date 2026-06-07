/**
 * Tests for Table Permission Service
 */

const {
  TablePermissionService,
} = require("../../services/tablePermission.service");

// Mock models
const mockModels = {
  TablePermission: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    destroy: jest.fn(),
    bulkDestroy: jest.fn(),
  },
  TableRolePermission: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
    bulkDestroy: jest.fn(),
  },
  Models: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("../../models", () => mockModels);

describe("TablePermissionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getModels", () => {
    it("should return all registered models", async () => {
      const mockModelsList = [
        { id: "1", modelName: "Users", tableName: "users", module: "user" },
        {
          id: "2",
          modelName: "Tenants",
          tableName: "tenants",
          module: "tenant",
        },
      ];

      mockModels.Models.findAll.mockResolvedValue(mockModelsList);

      const result = await TablePermissionService.getModels();

      expect(result).toEqual(mockModelsList);
      expect(mockModels.Models.findAll).toHaveBeenCalled();
    });

    it("should return empty array when no models registered", async () => {
      mockModels.Models.findAll.mockResolvedValue([]);

      const result = await TablePermissionService.getModels();

      expect(result).toEqual([]);
    });
  });

  describe("getPermissionsByModel", () => {
    it("should return permissions for a model", async () => {
      const mockPermissions = [
        {
          id: "1",
          modelId: "model-1",
          action: "read",
          scope: "tenant",
        },
      ];

      mockModels.TablePermission.findAll.mockResolvedValue(mockPermissions);

      const result =
        await TablePermissionService.getPermissionsByModel("model-1");

      expect(result).toEqual(mockPermissions);
      expect(mockModels.TablePermission.findAll).toHaveBeenCalledWith({
        where: { modelId: "model-1" },
        order: [["createdAt", "ASC"]],
      });
    });
  });

  describe("createPermission", () => {
    it("should create a new permission", async () => {
      const permissionData = {
        modelId: "model-1",
        action: "create",
        scope: "tenant",
        filterExpression: null,
      };

      const createdPermission = {
        id: "new-id",
        ...permissionData,
      };

      mockModels.TablePermission.create.mockResolvedValue(createdPermission);

      const result =
        await TablePermissionService.createPermission(permissionData);

      expect(result).toEqual(createdPermission);
      expect(mockModels.TablePermission.create).toHaveBeenCalledWith(
        permissionData,
      );
    });
  });

  describe("updatePermission", () => {
    it("should update an existing permission", async () => {
      const mockPermission = {
        id: "perm-1",
        action: "read",
        update: jest.fn().mockResolvedValue({
          ...mockPermission,
          action: "update",
        }),
      };

      mockModels.TablePermission.findByPk.mockResolvedValue(mockPermission);

      const result = await TablePermissionService.updatePermission("perm-1", {
        action: "update",
      });

      expect(result.action).toBe("update");
      expect(mockPermission.update).toHaveBeenCalledWith({
        action: "update",
      });
    });

    it("should return null when permission not found", async () => {
      mockModels.TablePermission.findByPk.mockResolvedValue(null);

      const result = await TablePermissionService.updatePermission(
        "nonexistent",
        { action: "read" },
      );

      expect(result).toBeNull();
    });
  });

  describe("deletePermission", () => {
    it("should delete a permission", async () => {
      const mockPermission = {
        id: "perm-1",
        destroy: jest.fn().mockResolvedValue(true),
      };

      mockModels.TablePermission.findByPk.mockResolvedValue(mockPermission);

      const result = await TablePermissionService.deletePermission("perm-1");

      expect(result).toBe(true);
      expect(mockPermission.destroy).toHaveBeenCalled();
    });
  });

  describe("grantRolePermission", () => {
    it("should grant permission to a role", async () => {
      const grantData = {
        tablePermissionId: "perm-1",
        tenantRoleId: "role-1",
        scope: "tenant",
        filterExpression: null,
      };

      const createdRolePerm = {
        id: "new-role-perm",
        ...grantData,
      };

      mockModels.TableRolePermission.findOne.mockResolvedValue(null);
      mockModels.TableRolePermission.create.mockResolvedValue(createdRolePerm);

      const result =
        await TablePermissionService.grantRolePermission(grantData);

      expect(result).toEqual(createdRolePerm);
      expect(mockModels.TableRolePermission.create).toHaveBeenCalled();
    });

    it("should return existing grant if already granted", async () => {
      const existingGrant = {
        id: "existing-role-perm",
        tablePermissionId: "perm-1",
        tenantRoleId: "role-1",
      };

      mockModels.TableRolePermission.findOne.mockResolvedValue(existingGrant);

      const result = await TablePermissionService.grantRolePermission({
        tablePermissionId: "perm-1",
        tenantRoleId: "role-1",
      });

      expect(result).toEqual(existingGrant);
      expect(mockModels.TableRolePermission.create).not.toHaveBeenCalled();
    });
  });

  describe("revokeRolePermission", () => {
    it("should revoke permission from a role", async () => {
      const existingGrant = {
        id: "role-perm-1",
        destroy: jest.fn().mockResolvedValue(true),
      };

      mockModels.TableRolePermission.findOne.mockResolvedValue(existingGrant);

      const result = await TablePermissionService.revokeRolePermission({
        tablePermissionId: "perm-1",
        tenantRoleId: "role-1",
      });

      expect(result).toBe(true);
      expect(existingGrant.destroy).toHaveBeenCalled();
    });

    it("should return false when grant not found", async () => {
      mockModels.TableRolePermission.findOne.mockResolvedValue(null);

      const result = await TablePermissionService.revokeRolePermission({
        tablePermissionId: "perm-1",
        tenantRoleId: "role-1",
      });

      expect(result).toBe(false);
    });
  });

  describe("checkPermission", () => {
    it("should return true for SUPER_ADMIN role", async () => {
      const result = await TablePermissionService.checkPermission({
        roleId: "super-admin-id",
        roleLevel: 3,
      });

      expect(result).toBe(true);
    });

    it("should check model and action permissions", async () => {
      const mockPermission = {
        action: "read",
        scope: "tenant",
      };

      mockModels.TablePermission.findOne.mockResolvedValue(mockPermission);

      const result = await TablePermissionService.checkPermission({
        userId: "user-1",
        roleId: "role-1",
        model: "Users",
        action: "read",
        tenantId: "tenant-1",
      });

      expect(result).toBeDefined();
    });
  });

  describe("getRolePermissions", () => {
    it("should return all permissions for a role", async () => {
      const mockPermissions = [
        {
          id: "1",
          tenantRoleId: "role-1",
          model: { modelName: "Users" },
        },
      ];

      mockModels.TableRolePermission.findAll.mockResolvedValue(mockPermissions);

      const result = await TablePermissionService.getRolePermissions("role-1");

      expect(result).toEqual(mockPermissions);
    });
  });

  describe("getModelPermissions", () => {
    it("should return all permissions for a model", async () => {
      const mockPermissions = [
        {
          id: "1",
          modelId: "model-1",
          action: "read",
        },
      ];

      mockModels.TablePermission.findAll.mockResolvedValue(mockPermissions);

      const result =
        await TablePermissionService.getModelPermissions("model-1");

      expect(result).toEqual(mockPermissions);
    });
  });

  describe("upsertPermission", () => {
    it("should create permission if not exists", async () => {
      const permissionData = {
        modelId: "model-1",
        action: "create",
        scope: "global",
      };

      mockModels.TablePermission.findOne.mockResolvedValue(null);
      mockModels.TablePermission.create.mockResolvedValue({
        id: "new-id",
        ...permissionData,
      });

      const result =
        await TablePermissionService.upsertPermission(permissionData);

      expect(mockModels.TablePermission.create).toHaveBeenCalled();
    });

    it("should update permission if exists", async () => {
      const existingPermission = {
        id: "perm-1",
        action: "read",
        update: jest.fn().mockResolvedValue({
          ...existingPermission,
          action: "update",
        }),
      };

      mockModels.TablePermission.findOne.mockResolvedValue(existingPermission);

      const result = await TablePermissionService.upsertPermission({
        modelId: "model-1",
        action: "update",
        scope: "global",
      });

      expect(existingPermission.update).toHaveBeenCalled();
    });
  });
});
