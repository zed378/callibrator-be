const { Op } = require("sequelize");

// Create mock objects with jest.fn() before importing service
const mockUserMenuGrant = {
  findAll: jest.fn(),
  findOrCreate: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
};

const mockMenuGroup = {
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

const mockMenuItem = {
  findAll: jest.fn(),
};

const mockRoles = {
  findByPk: jest.fn(),
};

const mockMenuRole = {
  findAll: jest.fn(),
  findOne: jest.fn(),
};

const mockUsers = {
  findByPk: jest.fn(),
  findAll: jest.fn(),
};

jest.mock("../../models", () => ({
  UserMenuGrant: mockUserMenuGrant,
  MenuGroup: mockMenuGroup,
  MenuItem: mockMenuItem,
  Roles: mockRoles,
  MenuRole: mockMenuRole,
  Users: mockUsers,
  Op,
}));

jest.mock("../../middlewares/activityLog", () => ({
  logger: {
    error: jest.fn(),
  },
}));

const userMenuGrantService = require("../../services/userMenuGrant.service");
const { Users } = require("../../models");

describe("UserMenuGrant Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserMenuGrants", () => {
    it("should return all active grants for a user", async () => {
      const mockGrants = [
        {
          userId: "user1",
          grantType: "menu-group",
          targetId: "group1",
          isActive: true,
        },
        {
          userId: "user1",
          grantType: "menu-item",
          targetId: "item1",
          isActive: true,
        },
      ];
      mockUserMenuGrant.findAll.mockResolvedValue(mockGrants);

      const result = await userMenuGrantService.getUserMenuGrants("user1");

      expect(mockUserMenuGrant.findAll).toHaveBeenCalledWith({
        where: { userId: "user1", isActive: true },
        order: [["createdAt", "ASC"]],
      });
      expect(result).toEqual(mockGrants);
    });
  });

  describe("getAllUserMenuGrants", () => {
    it("should return all active grants with user info", async () => {
      const mockGrants = [
        {
          id: "g1",
          userId: "user1",
          grantType: "menu-group",
          targetId: "group1",
          user: {
            id: "user1",
            username: "test",
            firstName: "Test",
            lastName: "User",
          },
        },
      ];
      mockUserMenuGrant.findAll.mockResolvedValue(mockGrants);

      const result = await userMenuGrantService.getAllUserMenuGrants();

      expect(mockUserMenuGrant.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        include: [
          {
            model: Users,
            as: "user",
            attributes: ["id", "username", "firstName", "lastName"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
      expect(result).toEqual(mockGrants);
    });
  });

  describe("grantMenuGroupToUser", () => {
    it("should create a new grant when it does not exist", async () => {
      const mockGrant = {
        id: "g1",
        userId: "user1",
        grantType: "menu-group",
        targetId: "group1",
        config: { label: "Test" },
        notes: "test notes",
        isActive: true,
      };
      mockUserMenuGrant.findOrCreate.mockResolvedValue([mockGrant, true]);

      const result = await userMenuGrantService.grantMenuGroupToUser(
        "user1",
        "group1",
        "admin1",
        { label: "Test" },
        "test notes",
      );

      expect(mockUserMenuGrant.findOrCreate).toHaveBeenCalledWith({
        where: { userId: "user1", grantType: "menu-group", targetId: "group1" },
        defaults: {
          grantedBy: "admin1",
          config: { label: "Test" },
          notes: "test notes",
        },
        updating: { config: { label: "Test" }, notes: "test notes" },
      });
      expect(result).toEqual(mockGrant);
    });

    it("should update existing grant when it already exists", async () => {
      const mockGrant = {
        id: "g1",
        userId: "user1",
        grantType: "menu-group",
        targetId: "group1",
        config: null,
        notes: null,
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockUserMenuGrant.findOrCreate.mockResolvedValue([mockGrant, false]);

      await userMenuGrantService.grantMenuGroupToUser(
        "user1",
        "group1",
        "admin1",
        { newConfig: true },
        "updated notes",
      );

      expect(mockGrant.config).toEqual({ newConfig: true });
      expect(mockGrant.notes).toEqual("updated notes");
      expect(mockGrant.isActive).toBe(true);
      expect(mockGrant.save).toHaveBeenCalled();
    });
  });

  describe("grantMenuItemToUser", () => {
    it("should create a new menu item grant", async () => {
      const mockGrant = {
        id: "g2",
        userId: "user1",
        grantType: "menu-item",
        targetId: "item1",
        config: null,
        notes: "item grant",
        isActive: true,
      };
      mockUserMenuGrant.findOrCreate.mockResolvedValue([mockGrant, true]);

      const result = await userMenuGrantService.grantMenuItemToUser(
        "user1",
        "item1",
        "admin1",
        null,
        "item grant",
      );

      expect(mockUserMenuGrant.findOrCreate).toHaveBeenCalledWith({
        where: { userId: "user1", grantType: "menu-item", targetId: "item1" },
        defaults: { grantedBy: "admin1", config: null, notes: "item grant" },
        updating: { config: null, notes: "item grant" },
      });
      expect(result).toEqual(mockGrant);
    });
  });

  describe("revokeMenuGroupFromUser", () => {
    it("should deactivate existing grant", async () => {
      const mockGrant = {
        id: "g1",
        userId: "user1",
        grantType: "menu-group",
        targetId: "group1",
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockUserMenuGrant.findOne.mockResolvedValue(mockGrant);

      const result = await userMenuGrantService.revokeMenuGroupFromUser(
        "user1",
        "group1",
      );

      expect(mockUserMenuGrant.findOne).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          grantType: "menu-group",
          targetId: "group1",
          isActive: true,
        },
      });
      expect(mockGrant.isActive).toBe(false);
      expect(mockGrant.save).toHaveBeenCalled();
      expect(result).toEqual(mockGrant);
    });

    it("should return null when grant not found", async () => {
      mockUserMenuGrant.findOne.mockResolvedValue(null);

      const result = await userMenuGrantService.revokeMenuGroupFromUser(
        "user1",
        "nonexistent",
      );

      expect(result).toBeNull();
    });
  });

  describe("revokeMenuItemFromUser", () => {
    it("should deactivate existing menu item grant", async () => {
      const mockGrant = {
        id: "g2",
        userId: "user1",
        grantType: "menu-item",
        targetId: "item1",
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockUserMenuGrant.findOne.mockResolvedValue(mockGrant);

      const result = await userMenuGrantService.revokeMenuItemFromUser(
        "user1",
        "item1",
      );

      expect(mockGrant.isActive).toBe(false);
      expect(mockGrant.save).toHaveBeenCalled();
      expect(result).toEqual(mockGrant);
    });

    it("should return null when grant not found", async () => {
      mockUserMenuGrant.findOne.mockResolvedValue(null);

      const result = await userMenuGrantService.revokeMenuItemFromUser(
        "user1",
        "nonexistent",
      );

      expect(result).toBeNull();
    });
  });

  describe("blockMenuGroupFromUser", () => {
    it("should create a new block entry", async () => {
      const mockGrant = {
        id: "g3",
        userId: "user1",
        grantType: "menu-group-block",
        targetId: "group1",
        blockedBy: "admin1",
        notes: "blocking reason",
        isActive: true,
      };
      mockUserMenuGrant.findOrCreate.mockResolvedValue([mockGrant, true]);

      const result = await userMenuGrantService.blockMenuGroupFromUser(
        "user1",
        "group1",
        "admin1",
        "blocking reason",
      );

      expect(mockUserMenuGrant.findOrCreate).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          grantType: "menu-group-block",
          targetId: "group1",
        },
        defaults: {
          blockedBy: "admin1",
          notes: "blocking reason",
          isActive: true,
        },
        updating: {
          blockedBy: "admin1",
          notes: "blocking reason",
          isActive: true,
        },
      });
      expect(result).toEqual(mockGrant);
    });
  });

  describe("blockMenuItemFromUser", () => {
    it("should create a new menu item block entry", async () => {
      const mockGrant = {
        id: "g4",
        userId: "user1",
        grantType: "menu-item-block",
        targetId: "item1",
        blockedBy: "admin1",
        notes: "item block reason",
        isActive: true,
      };
      mockUserMenuGrant.findOrCreate.mockResolvedValue([mockGrant, true]);

      const result = await userMenuGrantService.blockMenuItemFromUser(
        "user1",
        "item1",
        "admin1",
        "item block reason",
      );

      expect(mockUserMenuGrant.findOrCreate).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          grantType: "menu-item-block",
          targetId: "item1",
        },
        defaults: {
          blockedBy: "admin1",
          notes: "item block reason",
          isActive: true,
        },
        updating: {
          blockedBy: "admin1",
          notes: "item block reason",
          isActive: true,
        },
      });
      expect(result).toEqual(mockGrant);
    });
  });

  describe("unblockMenuGroupFromUser", () => {
    it("should deactivate block entry", async () => {
      const mockGrant = {
        id: "g3",
        userId: "user1",
        grantType: "menu-group-block",
        targetId: "group1",
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockUserMenuGrant.findOne.mockResolvedValue(mockGrant);

      const result = await userMenuGrantService.unblockMenuGroupFromUser(
        "user1",
        "group1",
      );

      expect(mockGrant.isActive).toBe(false);
      expect(mockGrant.save).toHaveBeenCalled();
      expect(result).toEqual(mockGrant);
    });

    it("should return null when block not found", async () => {
      mockUserMenuGrant.findOne.mockResolvedValue(null);

      const result = await userMenuGrantService.unblockMenuGroupFromUser(
        "user1",
        "nonexistent",
      );

      expect(result).toBeNull();
    });
  });

  describe("unblockMenuItemFromUser", () => {
    it("should deactivate menu item block entry", async () => {
      const mockGrant = {
        id: "g4",
        userId: "user1",
        grantType: "menu-item-block",
        targetId: "item1",
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockUserMenuGrant.findOne.mockResolvedValue(mockGrant);

      const result = await userMenuGrantService.unblockMenuItemFromUser(
        "user1",
        "item1",
      );

      expect(mockGrant.isActive).toBe(false);
      expect(mockGrant.save).toHaveBeenCalled();
      expect(result).toEqual(mockGrant);
    });
  });

  describe("bulkGrantMenuGroupsToUser", () => {
    it("should grant multiple menu groups", async () => {
      mockUserMenuGrant.findOne.mockResolvedValue(null);
      mockUserMenuGrant.create.mockResolvedValue({ id: "new1" });

      const result = await userMenuGrantService.bulkGrantMenuGroupsToUser(
        "user1",
        ["group1", "group2"],
        "admin1",
      );

      expect(result.granted).toContain("group1");
      expect(result.granted).toContain("group2");
      expect(result.alreadyGranted).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it("should track already granted groups", async () => {
      mockUserMenuGrant.findOne.mockResolvedValueOnce({ id: "existing1" });
      mockUserMenuGrant.findOne.mockResolvedValueOnce(null);
      mockUserMenuGrant.create.mockResolvedValue({ id: "new1" });

      const result = await userMenuGrantService.bulkGrantMenuGroupsToUser(
        "user1",
        ["group1", "group2"],
        "admin1",
      );

      expect(result.alreadyGranted).toContain("group1");
      expect(result.granted).toContain("group2");
    });

    it("should track failed grants", async () => {
      mockUserMenuGrant.findOne.mockRejectedValue(new Error("DB error"));

      const result = await userMenuGrantService.bulkGrantMenuGroupsToUser(
        "user1",
        ["group1"],
        "admin1",
      );

      expect(result.failed[0].menuGroupId).toBe("group1");
    });
  });

  describe("buildUserMenu", () => {
    it("should return all menus for SUPER_ADMIN", async () => {
      mockUsers.findByPk.mockResolvedValueOnce({ roleId: "super-role-id" });
      mockRoles.findByPk.mockResolvedValueOnce({ name: "SUPER_ADMIN" });
      mockMenuGroup.findAll.mockResolvedValueOnce([
        {
          id: "g1",
          label: "Group 1",
          icon: "icon1",
          path: "/path1",
          sortOrder: 1,
          items: [
            {
              id: "i1",
              label: "Item 1",
              path: "/item1",
              icon: "icon2",
              requiredPermission: null,
              sortOrder: 1,
            },
          ],
        },
      ]);

      const result = await userMenuGrantService.buildUserMenu("user1", null);

      expect(result).toEqual([
        {
          id: "g1",
          label: "Group 1",
          icon: "icon1",
          path: "/path1",
          sortOrder: 1,
          items: [
            {
              id: "i1",
              label: "Item 1",
              path: "/item1",
              icon: "icon2",
              requiredPermission: null,
              sortOrder: 1,
            },
          ],
        },
      ]);
    });

    it("should return user-specific grants for non-SUPER_ADMIN", async () => {
      mockUsers.findByPk.mockResolvedValueOnce({ roleId: "role1" });
      mockRoles.findByPk.mockResolvedValueOnce({ name: "ADMIN" });
      mockUserMenuGrant.findAll.mockResolvedValueOnce([
        {
          userId: "user1",
          grantType: "menu-group",
          targetId: "group1",
          isActive: true,
        },
      ]);
      mockUserMenuGrant.findAll.mockResolvedValueOnce([]);
      mockMenuGroup.findByPk.mockResolvedValueOnce({
        id: "group1",
        label: "Granted Group",
        icon: "icon1",
        path: "/path1",
        sortOrder: 1,
        items: [
          {
            id: "i1",
            label: "Item 1",
            path: "/item1",
            icon: "icon2",
            requiredPermission: null,
            sortOrder: 1,
          },
        ],
      });

      const result = await userMenuGrantService.buildUserMenu("user1", null);

      expect(result).toEqual([
        {
          id: "group1",
          label: "Granted Group",
          icon: "icon1",
          path: "/path1",
          sortOrder: 1,
          items: [
            {
              id: "i1",
              label: "Item 1",
              path: "/item1",
              icon: "icon2",
              requiredPermission: null,
              sortOrder: 1,
            },
          ],
        },
      ]);
    });

    it("should exclude blocked groups", async () => {
      mockUsers.findByPk.mockResolvedValueOnce({ roleId: "role1" });
      mockRoles.findByPk.mockResolvedValueOnce({ name: "ADMIN" });
      mockUserMenuGrant.findAll.mockResolvedValueOnce([
        {
          userId: "user1",
          grantType: "menu-group",
          targetId: "group1",
          isActive: true,
        },
      ]);
      mockUserMenuGrant.findAll.mockResolvedValueOnce([
        {
          userId: "user1",
          grantType: "menu-group-block",
          targetId: "group1",
        },
      ]);

      const result = await userMenuGrantService.buildUserMenu("user1", null);

      expect(result).toEqual([]);
    });

    it("should use provided roleId", async () => {
      mockRoles.findByPk.mockResolvedValueOnce({ name: "SUPER_ADMIN" });
      mockMenuGroup.findAll.mockResolvedValueOnce([
        {
          id: "g1",
          label: "Group 1",
          icon: "icon1",
          path: "/path1",
          sortOrder: 1,
          items: [],
        },
      ]);

      const result = await userMenuGrantService.buildUserMenu(
        "user1",
        "super-role-id",
      );

      expect(mockRoles.findByPk).toHaveBeenCalledWith("super-role-id");
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getUserMenuGrantTargetIds", () => {
    it("should return categorized grant target IDs", async () => {
      const mockGrants = [
        { targetId: "item1", grantType: "menu-item" },
        { targetId: "group1", grantType: "menu-group" },
        { targetId: "item2", grantType: "menu-item-block" },
        { targetId: "group2", grantType: "menu-group-block" },
      ];
      mockUserMenuGrant.findAll.mockResolvedValueOnce(mockGrants);

      const result =
        await userMenuGrantService.getUserMenuGrantTargetIds("user1");

      expect(result).toEqual({
        grantedItemIds: ["item1"],
        grantedGroupIds: ["group1"],
        blockedItemIds: ["item2"],
        blockedGroupIds: ["group2"],
      });
    });

    it("should return empty arrays when no grants exist", async () => {
      mockUserMenuGrant.findAll.mockResolvedValueOnce([]);

      const result =
        await userMenuGrantService.getUserMenuGrantTargetIds("user1");

      expect(result).toEqual({
        grantedItemIds: [],
        grantedGroupIds: [],
        blockedItemIds: [],
        blockedGroupIds: [],
      });
    });
  });

  describe("getRoleBasedMenuGroups", () => {
    it("should return all menus for SUPER_ADMIN", async () => {
      mockMenuGroup.findAll.mockResolvedValueOnce([
        {
          id: "g1",
          label: "Group 1",
          icon: "icon1",
          path: "/path1",
          sortOrder: 1,
          items: [
            {
              id: "i1",
              label: "Item 1",
              path: "/item1",
              icon: "icon2",
              requiredPermission: null,
              sortOrder: 1,
            },
          ],
        },
      ]);

      const result = await userMenuGrantService.getRoleBasedMenuGroups(
        "role1",
        true,
      );

      expect(mockMenuGroup.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [["sortOrder", "ASC"]],
        include: [
          {
            model: require("../../models").MenuItem,
            as: "items",
            where: { isActive: true },
            order: [["sortOrder", "ASC"]],
          },
        ],
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return assigned groups for non-SUPER_ADMIN", async () => {
      mockMenuRole.findAll
        .mockResolvedValueOnce([{ menuTargetId: "group1" }])
        .mockResolvedValueOnce([]);
      mockMenuGroup.findAll.mockResolvedValueOnce([
        {
          id: "group1",
          label: "Assigned Group",
          icon: "icon1",
          path: "/path1",
          sortOrder: 1,
          items: [
            {
              id: "i1",
              label: "Item 1",
              path: "/item1",
              icon: "icon2",
              requiredPermission: null,
              sortOrder: 1,
            },
          ],
        },
      ]);

      const result = await userMenuGrantService.getRoleBasedMenuGroups(
        "role1",
        false,
      );

      expect(result).toEqual([
        {
          id: "group1",
          label: "Assigned Group",
          icon: "icon1",
          path: "/path1",
          sortOrder: 1,
          items: [
            {
              id: "i1",
              label: "Item 1",
              path: "/item1",
              icon: "icon2",
              requiredPermission: null,
              sortOrder: 1,
            },
          ],
        },
      ]);
    });

    it("should return empty array when no assignments exist", async () => {
      mockMenuRole.findAll.mockResolvedValueOnce([]);
      mockMenuRole.findAll.mockResolvedValueOnce([]);

      const result = await userMenuGrantService.getRoleBasedMenuGroups(
        "role1",
        false,
      );

      expect(result).toEqual([]);
    });

    it("should handle role with only individual item assignments", async () => {
      mockMenuRole.findAll.mockResolvedValueOnce([]);
      mockMenuRole.findAll.mockResolvedValueOnce([{ menuTargetId: "item1" }]);
      mockMenuItem.findAll.mockResolvedValueOnce([
        {
          id: "item1",
          label: "Item 1",
          path: "/item1",
          icon: "icon1",
          requiredPermission: null,
          sortOrder: 1,
          menuGroup: {
            id: "group1",
            label: "Parent Group",
            icon: "icon2",
            path: "/group1",
            sortOrder: 1,
          },
        },
      ]);

      const result = await userMenuGrantService.getRoleBasedMenuGroups(
        "role1",
        false,
      );

      expect(result).toEqual([
        {
          id: "group1",
          label: "Parent Group",
          icon: "icon2",
          path: "/group1",
          sortOrder: 1,
          items: [
            {
              id: "item1",
              label: "Item 1",
              path: "/item1",
              icon: "icon1",
              requiredPermission: null,
              sortOrder: 1,
            },
          ],
        },
      ]);
    });
  });

  describe("isMenuGroupGrantedToUser", () => {
    it("should return true when role has assignment", async () => {
      mockMenuRole.findOne.mockResolvedValueOnce({ id: "mgr1" });

      const result = await userMenuGrantService.isMenuGroupGrantedToUser(
        "user1",
        "group1",
        "role1",
      );

      expect(result).toBe(true);
      expect(mockMenuRole.findOne).toHaveBeenCalled();
    });

    it("should return true when user has direct grant", async () => {
      mockMenuRole.findOne.mockResolvedValueOnce(null);
      mockUserMenuGrant.findOne.mockResolvedValueOnce({ id: "umg1" });

      const result = await userMenuGrantService.isMenuGroupGrantedToUser(
        "user1",
        "group1",
        "role1",
      );

      expect(result).toBe(true);
    });

    it("should return false when no grant exists", async () => {
      mockMenuRole.findOne.mockResolvedValueOnce(null);
      mockUserMenuGrant.findOne.mockResolvedValueOnce(null);

      const result = await userMenuGrantService.isMenuGroupGrantedToUser(
        "user1",
        "group1",
        "role1",
      );

      expect(result).toBe(false);
    });
  });

  describe("isMenuItemGrantedToUser", () => {
    it("should return true when role has item assignment", async () => {
      mockMenuRole.findOne.mockResolvedValueOnce({ id: "mir1" });

      const result = await userMenuGrantService.isMenuItemGrantedToUser(
        "user1",
        "item1",
        "role1",
      );

      expect(result).toBe(true);
    });

    it("should return true when user has direct item grant", async () => {
      mockMenuRole.findOne.mockResolvedValueOnce(null);
      mockUserMenuGrant.findOne.mockResolvedValueOnce({ id: "umg1" });

      const result = await userMenuGrantService.isMenuItemGrantedToUser(
        "user1",
        "item1",
        "role1",
      );

      expect(result).toBe(true);
    });

    it("should return false when no grant exists", async () => {
      mockMenuRole.findOne.mockResolvedValueOnce(null);
      mockUserMenuGrant.findOne.mockResolvedValueOnce(null);

      const result = await userMenuGrantService.isMenuItemGrantedToUser(
        "user1",
        "item1",
        "role1",
      );

      expect(result).toBe(false);
    });
  });

  describe("assignRoleBasedMenuToUser", () => {
    it("should return empty results when no roleId", async () => {
      const result = await userMenuGrantService.assignRoleBasedMenuToUser(
        "user1",
        null,
      );

      expect(result).toEqual({ assignedGroups: [], assignedItems: [] });
    });

    it("should assign menu groups and items from role to user", async () => {
      mockMenuRole.findAll
        .mockResolvedValueOnce([{ menuTargetId: "group1" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ menuTargetId: "group1" }])
        .mockResolvedValueOnce([]);
      mockMenuGroup.findAll.mockResolvedValueOnce([{ id: "group1" }]);
      mockMenuItem.findAll.mockResolvedValueOnce([]);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.create.mockResolvedValueOnce({ id: "new1" });

      const result = await userMenuGrantService.assignRoleBasedMenuToUser(
        "user1",
        "role1",
      );

      expect(result.assignedGroups).toContain("group1");
      expect(mockUserMenuGrant.destroy).toHaveBeenCalled();
      expect(mockUserMenuGrant.create).toHaveBeenCalledWith({
        userId: "user1",
        grantType: "menu-group",
        targetId: "group1",
        isActive: true,
      });
    });
  });

  describe("reassignUserRoleMenu", () => {
    it("should call assignRoleBasedMenuToUser", async () => {
      mockUserMenuGrant.destroy.mockResolvedValueOnce(0);
      mockUserMenuGrant.create.mockResolvedValueOnce({ id: "new1" });
      mockMenuRole.findAll
        .mockResolvedValueOnce([{ menuTargetId: "group1" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ menuTargetId: "group1" }])
        .mockResolvedValueOnce([]);
      mockMenuGroup.findAll.mockResolvedValueOnce([{ id: "group1" }]);
      mockMenuItem.findAll.mockResolvedValueOnce([]);

      const result = await userMenuGrantService.reassignUserRoleMenu(
        "user1",
        "newRole1",
      );

      expect(result.assignedGroups).toContain("group1");
    });
  });

  describe("propagateRoleMenuChanges", () => {
    it("should return updatedUsers when no users found", async () => {
      mockUsers.findAll.mockResolvedValueOnce([]);

      const result =
        await userMenuGrantService.propagateRoleMenuChanges("role1");

      expect(result).toEqual({ updatedUsers: 0 });
    });

    it("should update all users with the role", async () => {
      mockUsers.findAll.mockResolvedValueOnce([
        { id: "user1" },
        { id: "user2" },
      ]);
      mockMenuRole.findAll
        .mockResolvedValueOnce([{ menuTargetId: "group1" }]) // outer groups
        .mockResolvedValueOnce([]) // outer items
        .mockResolvedValueOnce([{ menuTargetId: "group1" }]) // nested user1 groups
        .mockResolvedValueOnce([]) // nested user1 items
        .mockResolvedValueOnce([{ menuTargetId: "group1" }]) // nested user2 groups
        .mockResolvedValueOnce([]); // nested user2 items
      mockMenuGroup.findAll.mockResolvedValueOnce([{ id: "group1" }]);
      mockMenuGroup.findAll.mockResolvedValueOnce([{ id: "group1" }]);
      mockMenuItem.findAll.mockResolvedValueOnce([]);
      mockMenuItem.findAll.mockResolvedValueOnce([]);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);
      mockUserMenuGrant.create.mockResolvedValueOnce({ id: "new1" });
      mockUserMenuGrant.create.mockResolvedValueOnce({ id: "new2" });

      const result =
        await userMenuGrantService.propagateRoleMenuChanges("role1");

      expect(result.updatedUsers).toBe(2);
      expect(result.affectedGroupIds).toContain("group1");
    });

    it("should handle errors when updating users", async () => {
      mockUsers.findAll.mockResolvedValueOnce([{ id: "user1" }]);
      mockMenuRole.findAll.mockResolvedValueOnce([]);
      mockMenuRole.findAll.mockResolvedValueOnce([]);
      mockMenuGroup.findAll.mockResolvedValueOnce([]);
      mockUserMenuGrant.destroy.mockResolvedValueOnce(1);

      await userMenuGrantService.propagateRoleMenuChanges("role1");

      expect(mockUsers.findAll).toHaveBeenCalled();
    });
  });
});
