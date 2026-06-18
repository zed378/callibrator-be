// Get actual models first, then mock specific methods
const actualModels = jest.requireActual("../../models");
const RoleMenuPermission = { findOne: jest.fn() };
const MenuGroup = { findOne: jest.fn() };
const User = { findByPk: jest.fn() };
const Tenants = { findByPk: jest.fn() };

// Mock at module level
jest.mock("../../models", () => ({
  RoleMenuPermission,
  MenuGroup,
  User,
  Tenants,
}));

const { dynamicAccess, hasDynamicPermission } = require("../../middlewares/dynamicAccess");

describe("dynamicAccess middleware", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    req = { user: null, params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("dynamicAccess", () => {
    it("should return 401 when no user context", async () => {
      const middleware = dynamicAccess("Home", "read");
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Unauthorized: No user context found" })
      );
    });

    it("should allow SUPER_ADMIN bypass", async () => {
      req.user = { role: { name: "SUPER_ADMIN", id: "role-1" } };
      const middleware = dynamicAccess("Home", "read");
      await middleware(req, res, next);
      expect(req.dynamicAccessContext).toBeDefined();
      expect(req.dynamicAccessContext.allowed).toBe(true);
      expect(req.dynamicAccessContext.reason).toBe("SUPER_ADMIN bypass");
      expect(next).toHaveBeenCalled();
    });

    it("should deny access when no permissions found", async () => {
      req.user = { role: { name: "USER", id: "role-1" } };
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValue(null);

      const middleware = dynamicAccess("Home", "read");
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should allow access when permission exists", async () => {
      req.user = { role: { name: "USER", id: "role-1" } };
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValue({
        id: "perm-1",
        permission_type: "read",
      });

      const middleware = dynamicAccess("Home", "read");
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.dynamicAccessContext.allowed).toBe(true);
    });

    it("should support OR logic (any permission matches)", async () => {
      req.user = { role: { name: "USER", id: "role-1" } };
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValueOnce(null);
      RoleMenuPermission.findOne.mockResolvedValueOnce({ permission_type: "write" });

      const middleware = dynamicAccess("Home", ["read", "write"]);
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should support AND logic (requireAll) - deny when not all match", async () => {
      req.user = { role: { name: "USER", id: "role-1" } };
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValueOnce({ permission_type: "read" });
      RoleMenuPermission.findOne.mockResolvedValueOnce(null);

      const middleware = dynamicAccess("Home", ["read", "write"], { requireAll: true });
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should support AND logic (requireAll) - allow when all match", async () => {
      req.user = { role: { name: "USER", id: "role-1" } };
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValueOnce({ permission_type: "read" });
      RoleMenuPermission.findOne.mockResolvedValueOnce({ permission_type: "write" });

      const middleware = dynamicAccess("Home", ["read", "write"], { requireAll: true });
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should support multiple menu groups with OR logic", async () => {
      req.user = { role: { name: "USER", id: "role-1" } };
      MenuGroup.findOne.mockResolvedValueOnce({ id: "mg-1", name: "Home" });
      MenuGroup.findOne.mockResolvedValueOnce({ id: "mg-2", name: "Dashboard" });
      RoleMenuPermission.findOne.mockResolvedValueOnce(null);
      RoleMenuPermission.findOne.mockResolvedValueOnce({ permission_type: "read" });

      const middleware = dynamicAccess(["Home", "Dashboard"], "read");
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should allow when tenant isolation matches", async () => {
      req.user = { role: { name: "USER", id: "role-1" }, tenantId: "tenant-A" };
      req.params.tenantId = "tenant-A";
      Tenants.findByPk.mockResolvedValue({ id: "tenant-A" });
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValue({ permission_type: "read" });

      const middleware = dynamicAccess("Home", "read", { checkTenant: true });
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("should deny tenant mismatch", async () => {
      req.user = { role: { name: "USER", id: "role-1" }, tenantId: "tenant-A" };
      req.params.tenantId = "tenant-B";
      Tenants.findByPk.mockResolvedValue({ id: "tenant-B" });
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValue(null);

      const middleware = dynamicAccess("Home", "read", { checkTenant: true });
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should deny when tenant not found", async () => {
      req.user = { role: { name: "USER", id: "role-1" }, tenantId: "tenant-A" };
      req.params.tenantId = "tenant-X";
      Tenants.findByPk.mockResolvedValue(null);

      const middleware = dynamicAccess("Home", "read", { checkTenant: true });
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should handle MenuGroup not found", async () => {
      req.user = { role: { name: "USER", id: "role-1" } };
      MenuGroup.findOne.mockResolvedValue(null);

      const middleware = dynamicAccess("Home", "read");
      await middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe("hasDynamicPermission", () => {
    it("should return 400 when required params missing", async () => {
      await hasDynamicPermission(
        { user: { role: { id: "role-1" } } },
        res,
        next
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return allowed: false when menu group not found", async () => {
      MenuGroup.findOne.mockResolvedValue(null);
      await hasDynamicPermission(
        {
          user: { role: { id: "role-1" } },
          body: { menuGroup: "Home", permissionType: "read" },
        },
        res,
        next
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { allowed: false },
        })
      );
    });

    it("should return allowed: true when permission exists", async () => {
      MenuGroup.findOne.mockResolvedValue({ id: "mg-1", name: "Home" });
      RoleMenuPermission.findOne.mockResolvedValue({
        permission_type: "read",
      });

      await hasDynamicPermission(
        {
          user: { role: { id: "role-1" } },
          body: { menuGroup: "Home", permissionType: "read" },
        },
        res,
        next
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { allowed: true },
        })
      );
    });
  });
});
