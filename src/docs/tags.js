/**
 * Swagger Tags
 *
 * Reusable tag definitions grouped by module.
 */

module.exports = {
  tags: [
    {
      name: "Auth",
      description:
        "Authentication endpoints (register, login, OTP, password reset, session management)",
    },
    {
      name: "Users",
      description: "User management endpoints",
    },
    {
      name: "Roles",
      description:
        "Role-based access control endpoints (RBAC with read/write permissions)",
    },
    {
      name: "Tenants",
      description: "Tenant (organization) management endpoints",
    },
    {
      name: "Sessions",
      description: "Session management and cleanup endpoints",
    },
    {
      name: "TenantBackup",
      description: "Tenant backup and restore operations",
    },
    {
      name: "Migration",
      description:
        "Internal migration and seeding operations (development only)",
    },
    {
      name: "Stock",
      description:
        "Stock management endpoints (inventory, adjustments, transfers, opname)",
    },
    {
      name: "Warehouse",
      description:
        "Warehouse management endpoints (warehouses, storage locations)",
    },
    {
      name: "Certificates",
      description:
        "Certificate management endpoints (generate, approve, sign, revoke certificates)",
    },
    {
      name: "CalibrationDevices",
      description: "Calibration device management endpoints",
    },
    {
      name: "CalibrationRecords",
      description: "Calibration record management endpoints",
    },
  ],
};
