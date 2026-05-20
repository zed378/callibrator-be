/**
 * Tests for tenantAudit service
 */

// Mock models before importing service
const mockTenantAuditLog = {
  createLog: jest.fn(),
  getTenantLogs: jest.fn(),
  findAndCountAll: jest.fn(),
  count: jest.fn(),
  destroy: jest.fn(),
};

jest.mock("../../models", () => ({
  TenantAuditLog: mockTenantAuditLog,
}));

jest.mock("../../middlewares/tenantScope", () => ({
  createTenantScope: jest.fn().mockReturnValue({ tenantId: "scope-tenant-1" }),
}));

// Import the ACTIONS and SEVERITY from the model directly
const { TenantAuditLog } = require("../../models");

// Mock the model static properties
TenantAuditLog.ACTIONS = {
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  LOGIN_SUCCESS: "login.success",
  LOGIN_FAILED: "login.failed",
  TENANT_CREATE: "tenant.create",
  PERMISSION_GRANT: "permission.grant",
};

TenantAuditLog.SEVERITY = {
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
};

const {
  createLog,
  createLogFromRequest,
  logUserAction,
  logAuthEvent,
  getAuditLogs,
  getSecurityEvents,
  ACTIONS,
  SEVERITY,
} = require("../../services/tenantAudit.service");

describe("Tenant Audit Service", () => {
  const mockModels = { TenantAuditLog, Users: {} };
  const mockTenantId = "tenant-123";
  const mockUserId = "user-456";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLog", () => {
    it("should create an audit log entry", async () => {
      const mockLog = {
        id: "log-1",
        tenantId: mockTenantId,
        userId: mockUserId,
        action: ACTIONS.USER_CREATE,
        severity: SEVERITY.INFO,
      };

      TenantAuditLog.createLog.mockResolvedValue(mockLog);

      const result = await createLog(
        {
          tenantId: mockTenantId,
          userId: mockUserId,
          action: ACTIONS.USER_CREATE,
          resourceType: "User",
          resourceId: "user-789",
          resourceName: "John Doe",
          severity: SEVERITY.INFO,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          context: { details: "New user created" },
        },
        mockModels,
      );

      expect(TenantAuditLog.createLog).toHaveBeenCalledWith(
        {
          tenantId: mockTenantId,
          userId: mockUserId,
          action: ACTIONS.USER_CREATE,
          resourceType: "User",
          resourceId: "user-789",
          resourceName: "John Doe",
          severity: SEVERITY.INFO,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          context: { details: "New user created" },
        },
        mockModels,
      );

      expect(result).toEqual(mockLog);
    });
  });

  describe("createLogFromRequest", () => {
    it("should extract IP and user agent from request", async () => {
      const mockLog = { id: "log-1" };
      const mockReq = {
        tenantId: mockTenantId,
        user: { id: mockUserId },
        ip: "10.0.0.1",
        headers: {
          "user-agent": "TestBrowser/1.0",
        },
      };

      TenantAuditLog.createLog.mockResolvedValue(mockLog);

      const result = await createLogFromRequest(
        mockReq,
        { action: ACTIONS.USER_UPDATE },
        mockModels,
      );

      expect(TenantAuditLog.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenantId,
          userId: mockUserId,
          ipAddress: "10.0.0.1",
          userAgent: "TestBrowser/1.0",
          action: ACTIONS.USER_UPDATE,
        }),
        mockModels,
      );
    });
  });

  describe("logUserAction", () => {
    it("should log a user action", async () => {
      const mockLog = { id: "log-1" };
      const mockReq = {
        tenantId: mockTenantId,
        user: { id: mockUserId },
        ip: "10.0.0.1",
        headers: { "user-agent": "TestBrowser" },
      };

      TenantAuditLog.createLog.mockResolvedValue(mockLog);

      const result = await logUserAction(
        mockReq,
        ACTIONS.USER_DELETE,
        {
          resourceType: "User",
          resourceId: "user-target",
          severity: SEVERITY.WARNING,
        },
        mockModels,
      );

      expect(TenantAuditLog.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTIONS.USER_DELETE,
          resourceType: "User",
          resourceId: "user-target",
          severity: SEVERITY.WARNING,
        }),
        mockModels,
      );
    });
  });

  describe("logAuthEvent", () => {
    it("should log login success with INFO severity", async () => {
      const mockLog = { id: "log-1" };
      const mockReq = {
        tenantId: mockTenantId,
        user: { id: mockUserId },
        ip: "10.0.0.1",
        headers: { "user-agent": "TestBrowser" },
      };

      TenantAuditLog.createLog.mockResolvedValue(mockLog);

      await logAuthEvent(mockReq, ACTIONS.LOGIN_SUCCESS, {}, mockModels);

      expect(TenantAuditLog.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTIONS.LOGIN_SUCCESS,
          severity: SEVERITY.INFO,
        }),
        mockModels,
      );
    });

    it("should log login failed with WARNING severity", async () => {
      const mockLog = { id: "log-1" };
      const mockReq = {
        tenantId: mockTenantId,
        ip: "10.0.0.1",
        headers: { "user-agent": "TestBrowser" },
      };

      TenantAuditLog.createLog.mockResolvedValue(mockLog);

      await logAuthEvent(
        mockReq,
        ACTIONS.LOGIN_FAILED,
        { context: { reason: "invalid_password" } },
        mockModels,
      );

      expect(TenantAuditLog.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ACTIONS.LOGIN_FAILED,
          severity: SEVERITY.WARNING,
        }),
        mockModels,
      );
    });
  });

  describe("ACTIONS constant", () => {
    it("should contain all expected action types", () => {
      expect(ACTIONS.USER_CREATE).toBe("user.create");
      expect(ACTIONS.USER_UPDATE).toBe("user.update");
      expect(ACTIONS.LOGIN_SUCCESS).toBe("login.success");
      expect(ACTIONS.LOGIN_FAILED).toBe("login.failed");
      expect(ACTIONS.TENANT_CREATE).toBe("tenant.create");
      expect(ACTIONS.PERMISSION_GRANT).toBe("permission.grant");
    });
  });

  describe("SEVERITY constant", () => {
    it("should contain all expected severity levels", () => {
      expect(SEVERITY.INFO).toBe("INFO");
      expect(SEVERITY.WARNING).toBe("WARNING");
      expect(SEVERITY.ERROR).toBe("ERROR");
      expect(SEVERITY.CRITICAL).toBe("CRITICAL");
    });
  });
});
