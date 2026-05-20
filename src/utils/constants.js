/**
 * Application Constants
 * Centralized configuration values that must stay in sync with database seeds
 *
 * NOTE: The permission constants (USER_PERMISSIONS, TENANT_PERMISSIONS, ROLE_PERMISSIONS)
 * are now DEPRECATED and kept for backward compatibility only.
 *
 * The new dynamic RBAC/ABAC system uses database-driven table permissions instead.
 * New code should use the dynamicAccess middleware and tablePermission.service.js
 *
 * Migration path:
 * 1. Run: node src/utils/seedTablePermissions.js
 * 2. Update routes to use dynamicAccess() instead of rbac() + abac()
 * 3. Manage permissions via the /api/v1/table-permissions endpoints
 */

/**
 * Super Admin Role ID
 * MUST match the Roles seed data exactly
 * If changed, update both this file AND the seed script
 */
const SUPER_ADMIN_ROLE_ID =
  process.env.SUPER_ADMIN_ROLE_ID || "9be20605-cc6a-4d91-8246-9756b4a1754b";

/**
 * Role names enum
 */
const ROLE_NAMES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  TENANT_ADMIN: "TENANT_ADMIN",
  USER: "USER",
};

/**
 * Role IDs (UUIDs for seeding)
 */
const ROLE_IDS = {
  SUPER_ADMIN: "9be20605-cc6a-4d91-8246-9756b4a1754b",
  TENANT_ADMIN: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  USER: "f6e5d4c3-b2a1-4987-6543-210fedcba987",
};

/**
 * ⚠️ DEPRECATED - Permission naming convention
 *
 * OLD SYSTEM (deprecated):
 * - Global permission: module:action (e.g., user:create, user:read)
 * - Self permission: module:self:action (e.g., user:self:update)
 * - Tenant permission: module:tenant:action (e.g., user:tenant:create)
 *
 * NEW SYSTEM (use this):
 * - Table permissions are stored in the database
 * - Use dynamicAccess("ModelName", "action") middleware
 * - Actions: create, read, update, delete, export, import
 * - Scopes: global, tenant, self, custom
 *
 * @deprecated Use tablePermission.service.js instead
 */

/**
 * ⚠️ DEPRECATED - User Module Permissions
 * Kept for backward compatibility with legacy permission assignment
 * @deprecated Use dynamic table permissions instead
 */
const USER_PERMISSIONS = {
  // Global permissions (module:action)
  CREATE: "user:create",
  READ: "user:read",
  UPDATE: "user:update",
  DELETE: "user:delete",

  // Self permissions (module:self:action) - Note: self-delete is not included
  // Users cannot delete their own accounts via permission system
  SELF_UPDATE: "user:self:update",
  SELF_READ: "user:self:read",

  // Tenant permissions (module:tenant:action)
  TENANT_CREATE: "user:tenant:create",
  TENANT_READ: "user:tenant:read",
  TENANT_UPDATE: "user:tenant:update",
  TENANT_DELETE: "user:tenant:delete",
  TENANT_ASSIGN: "user:tenant:assign",
};

/**
 * ⚠️ DEPRECATED - Tenant Module Permissions
 * Kept for backward compatibility with legacy permission assignment
 * @deprecated Use dynamic table permissions instead
 */
const TENANT_PERMISSIONS = {
  // Global permissions (module:action)
  CREATE: "tenant:create",
  READ: "tenant:read",
  UPDATE: "tenant:update",
  DELETE: "tenant:delete",

  // Self permissions (module:self:action)
  SELF_UPDATE: "tenant:self:update",
  SELF_READ: "tenant:self:read",

  // Tenant permissions (module:tenant:action)
  TENANT_READ: "tenant:tenant:read",
  TENANT_ASSIGN: "tenant:tenant:assign",

  // Backup permissions
  BACKUP_CREATE: "tenant:backup:create",
  BACKUP_READ: "tenant:backup:read",
  BACKUP_RESTORE: "tenant:backup:restore",
  BACKUP_DELETE: "tenant:backup:delete",
};

/**
 * ⚠️ DEPRECATED - Permission categories by role
 * Kept for backward compatibility with legacy permission assignment
 * @deprecated Use dynamic table permissions instead
 */
const ROLE_PERMISSIONS = {
  [ROLE_NAMES.SUPER_ADMIN]: "ALL", // Super admin has all permissions implicitly
  [ROLE_NAMES.TENANT_ADMIN]: [
    USER_PERMISSIONS.TENANT_CREATE,
    USER_PERMISSIONS.TENANT_READ,
    USER_PERMISSIONS.TENANT_UPDATE,
    USER_PERMISSIONS.TENANT_DELETE,
    USER_PERMISSIONS.TENANT_ASSIGN,
    USER_PERMISSIONS.SELF_UPDATE,
    USER_PERMISSIONS.SELF_READ,
    TENANT_PERMISSIONS.TENANT_READ,
    TENANT_PERMISSIONS.TENANT_ASSIGN,
    TENANT_PERMISSIONS.SELF_UPDATE,
    TENANT_PERMISSIONS.SELF_READ,
    TENANT_PERMISSIONS.BACKUP_CREATE,
    TENANT_PERMISSIONS.BACKUP_READ,
    TENANT_PERMISSIONS.BACKUP_RESTORE,
    TENANT_PERMISSIONS.BACKUP_DELETE,
  ],
  [ROLE_NAMES.USER]: [USER_PERMISSIONS.SELF_UPDATE, USER_PERMISSIONS.SELF_READ],
};

/**
 * Default pagination settings
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

/**
 * User status values
 */
const USER_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
};

/**
 * OTP settings
 */
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_REQUESTS = 3;
const OTP_REQUEST_WINDOW_MINUTES = 15;

/**
 * Password settings
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_SALT_ROUNDS = 12;

/**
 * Session settings
 */
const DEFAULT_SESSION_EXPIRY_HOURS = 24;
const MAX_SESSIONS_PER_USER = 5;

/**
 * Backup settings
 */
const DEFAULT_BACKUP_RETENTION_DAYS = 90;
const MAX_BACKUP_RETENTION_DAYS = 3650;
const BACKUP_DIR = "backups";

module.exports = {
  SUPER_ADMIN_ROLE_ID,
  ROLE_NAMES,
  ROLE_IDS,
  USER_PERMISSIONS, // DEPRECATED
  TENANT_PERMISSIONS, // DEPRECATED
  ROLE_PERMISSIONS, // DEPRECATED
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  USER_STATUS,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_REQUESTS,
  OTP_REQUEST_WINDOW_MINUTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SALT_ROUNDS,
  DEFAULT_SESSION_EXPIRY_HOURS,
  MAX_SESSIONS_PER_USER,
  DEFAULT_BACKUP_RETENTION_DAYS,
  MAX_BACKUP_RETENTION_DAYS,
  BACKUP_DIR,
};
