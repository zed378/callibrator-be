const { ROLE_NAMES, ROLE_LEVELS } = require("../../constants");
const { rbac, checkRoleLevel, notSuperAdmin } = require("../../middlewares/rbac");

describe("rbac middleware", () => {
  let req, res, next;

  beforeEach(() => {
    next = jest.fn();
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    req = { user: null };
    jest.clearAllMocks();
  });

  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  describe("rbac", () => {
    it("should throw if no user context", () => {
      const middleware = rbac(["USER"]);
      middleware({}, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 })
      );
    });

    it("should throw if user has no role", () => {
      req.user = { role: null };
      const middleware = rbac(["USER"]);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 })
      );
    });

    it("should allow SUPER_ADMIN to access any route", () => {
      req.user = { role: { name: ROLE_NAMES.SUPER_ADMIN, role_level: 10 } };
      const middleware = rbac([ROLE_NAMES.TENANT_ADMIN]);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("should allow user with exact matching role", () => {
      req.user = { role: { name: ROLE_NAMES.USER, role_level: 1 } };
      const middleware = rbac([ROLE_NAMES.USER]);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("should allow higher role when allowHigher is true", () => {
      req.user = { role: { name: ROLE_NAMES.TENANT_ADMIN, role_level: 2 } };
      const middleware = rbac([ROLE_NAMES.USER], { allowHigher: true });
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("should deny higher role when allowHigher is false", () => {
      req.user = { role: { name: ROLE_NAMES.TENANT_ADMIN, role_level: 2 } };
      const middleware = rbac([ROLE_NAMES.USER], { allowHigher: false });
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 })
      );
    });

    it("should deny user with insufficient role", () => {
      req.user = { role: { name: ROLE_NAMES.USER, role_level: 1 } };
      const middleware = rbac([ROLE_NAMES.TENANT_ADMIN]);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 })
      );
    });

    it("should deny user when role is not in required list", () => {
      req.user = { role: { name: ROLE_NAMES.USER, role_level: 1 } };
      const middleware = rbac([ROLE_NAMES.TENANT_ADMIN, "CUSTOM"]);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 })
      );
    });
  });

  describe("checkRoleLevel", () => {
    it("should allow when user meets minimum level", () => {
      req.user = { role: { roleLevel: 3 } };
      const middleware = checkRoleLevel(2);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("should deny when user role level is too low", () => {
      req.user = { role: { roleLevel: 1 } };
      const middleware = checkRoleLevel(2);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 })
      );
    });

    it("should deny when user has no role", () => {
      req.user = {};
      const middleware = checkRoleLevel(1);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 })
      );
    });

    it("should deny when req.user is missing", () => {
      req = {};
      const middleware = checkRoleLevel(1);
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 })
      );
    });
  });

  describe("notSuperAdmin", () => {
    it("should pass for non-super-admin", () => {
      req.user = { role: { name: ROLE_NAMES.USER } };
      const middleware = notSuperAdmin();
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("should pass when no user", () => {
      req = { user: null };
      const middleware = notSuperAdmin();
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("should block super admin", () => {
      req.user = { role: { name: ROLE_NAMES.SUPER_ADMIN } };
      const middleware = notSuperAdmin();
      middleware(req, makeRes(), next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 })
      );
    });
  });
});
