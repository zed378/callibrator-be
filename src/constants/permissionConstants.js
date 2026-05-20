/**
 * Permission Constants
 *
 * Centralized permission naming conventions for the RBAC system.
 * These constants define the permission naming patterns used throughout the application.
 *
 * Permission naming convention:
 * - Global permission: module:action (e.g., user:create, user:read, user:update, user:delete)
 * - Self permission: module:self:action (e.g., user:self:update, user:self:read)
 * - Tenant permission: module:tenant:action (e.g., user:tenant:create, user:tenant:read)
 *
 * NOTE: These permission constants are DEPRECATED for new code.
 * The new dynamic RBAC/ABAC system uses database-driven table permissions.
 * New code should use the dynamicAccess middleware and tablePermission.service.js
 */

/**
 * User Module Permissions
 * Permissions related to user management operations
 * @deprecated Use dynamic table permissions instead
 */
const USER_PERMISSIONS = {
  // Global permissions (module:action)
  CREATE: 'user:create',
  READ: 'user:read',
  UPDATE: 'user:update',
  DELETE: 'user:delete',

  // Self permissions (module:self:action) - Note: self-delete is not included
  // Users cannot delete their own accounts via permission system
  SELF_UPDATE: 'user:self:update',
  SELF_READ: 'user:self:read',

  // Tenant permissions (module:tenant:action)
  TENANT_CREATE: 'user:tenant:create',
  TENANT_READ: 'user:tenant:read',
  TENANT_UPDATE: 'user:tenant:update',
  TENANT_DELETE: 'user:tenant:delete',
  TENANT_ASSIGN: 'user:tenant:assign',
};

/**
 * Tenant Module Permissions
 * Permissions related to tenant management operations
 * @deprecated Use dynamic table permissions instead
 */
const TENANT_PERMISSIONS = {
  // Global permissions (module:action)
  CREATE: 'tenant:create',
  READ: 'tenant:read',
  UPDATE: 'tenant:update',
  DELETE: 'tenant:delete',

  // Self permissions (module:self:action)
  SELF_UPDATE: 'tenant:self:update',
  SELF_READ: 'tenant:self:read',

  // Tenant permissions (module:tenant:action)
  TENANT_READ: 'tenant:tenant:read',
  TENANT_ASSIGN: 'tenant:tenant:assign',

  // Backup permissions
  BACKUP_CREATE: 'tenant:backup:create',
  BACKUP_READ: 'tenant:backup:read',
  BACKUP_RESTORE: 'tenant:backup:restore',
  BACKUP_DELETE: 'tenant:backup:delete',
};

/**
 * Role Module Permissions
 * Permissions related to role management operations
 */
const ROLE_MODULE_PERMISSIONS = {
  // Global permissions (module:action)
  CREATE: 'role:create',
  READ: 'role:read',
  UPDATE: 'role:update',
  DELETE: 'role:delete',
  ASSIGN_PERMISSIONS: 'role:assign:permissions',
};

/**
 * Permission categories by role (DEPRECATED)
 * Kept for backward compatibility with legacy permission assignment
 * @deprecated Use dynamic table permissions instead
 */
const ROLE_PERMISSION_CATEGORIES = {
  SUPER_ADMIN: 'ALL',
  TENANT_ADMIN: [
    'user:tenant:create',
    'user:tenant:read',
    'user:tenant:update',
    'user:tenant:delete',
    'user:tenant:assign',
    'user:self:update',
    'user:self:read',
    'tenant:tenant:read',
    'tenant:tenant:assign',
    'tenant:self:update',
    'tenant:self:read',
    'tenant:backup:create',
    'tenant:backup:read',
    'tenant:backup:restore',
    'tenant:backup:delete',
  ],
  USER: ['user:self:update', 'user:self:read'],
};

module.exports = {
  USER_PERMISSIONS,
  TENANT_PERMISSIONS,
  ROLE_MODULE_PERMISSIONS,
  ROLE_PERMISSION_CATEGORIES,
};
