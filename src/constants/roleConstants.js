/**
 * Role Constants
 *
 * Centralized role-related constants including role names, IDs, and role hierarchy.
 * These values must stay in sync with the database seed data.
 *
 * Migration path:
 * - When updating roles, update both this file AND the seed scripts
 * - ROLE_IDS UUIDs are used in database seeding
 * - ROLE_NAMES are used throughout the application for role checks
 */

/**
 * Super Admin Role ID
 * MUST match the Roles seed data exactly
 * If changed, update both this file AND the seed script
 */
const SUPER_ADMIN_ROLE_ID =
  process.env.SUPER_ADMIN_ROLE_ID || '9be20605-cc6a-4d91-8246-9756b4a1754b';

/**
 * Role names enum
 * Used throughout the application for role-based access control
 */
const ROLE_NAMES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
  USER: 'USER',
};

/**
 * Role IDs (UUIDs for seeding)
 * These UUIDs are used when seeding the database with default roles
 * Must match the IDs in the seed scripts
 */
const ROLE_IDS = {
  SUPER_ADMIN: '9be20605-cc6a-4d91-8246-9756b4a1754b',
  TENANT_ADMIN: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  USER: 'f6e5d4c3-b2a1-4987-6543-210fedcba987',
};

/**
 * Role hierarchy levels
 * - 10: SUPER_ADMIN - Has full access to all resources
 * - 2: TENANT_ADMIN - Can manage users within their tenant
 * - 1: USER - Can only manage their own profile
 */
const ROLE_LEVELS = {
  SUPER_ADMIN: 10,
  TENANT_ADMIN: 2,
  USER: 1,
};

/**
 * Built-in roles that cannot be deleted
 */
const BUILTIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'USER'];

/**
 * Role permission categories (DEPRECATED)
 * Kept for backward compatibility with legacy permission assignment
 * @deprecated Use dynamic table permissions instead
 */
const ROLE_PERMISSIONS = {
  [ROLE_NAMES.SUPER_ADMIN]: 'ALL', // Super admin has all permissions implicitly
  [ROLE_NAMES.TENANT_ADMIN]: [
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
  [ROLE_NAMES.USER]: ['user:self:update', 'user:self:read'],
};

module.exports = {
  SUPER_ADMIN_ROLE_ID,
  ROLE_NAMES,
  ROLE_IDS,
  ROLE_LEVELS,
  BUILTIN_ROLES,
  ROLE_PERMISSIONS,
};
