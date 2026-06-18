/**
 * Database Models - Simplified RBAC with Read/Write Permissions
 *
 * Architecture:
 * - User: Individual user accounts within tenants
 * - Tenant: Organization/entity with plan and settings
 * - Role: RBAC roles with CRUD permissions (read/write) on menu groups
 * - MenuGroup: Navigation menu groups that roles can access
 *
 * Simplified Permission Model:
 * - Roles have read or write permissions on menu groups via RoleMenuPermission
 * - Users inherit permissions from their assigned role within a tenant
 * - No ABAC (Attribute-Based Access Control) - pure RBAC with simple read/write
 * - All roles are global (not tenant-scoped) for consistent permission management
 */

const { DataTypes } = require("sequelize");

// Reuse the single Sequelize instance from config.
// This ensures all queries use the configured pool, SSL, timezone,
// retry logic, and logging settings instead of Sequelize defaults.
const { db } = require("../config");

// ==========================================
//                     TENANT
// ==========================================

const Tenant = db.define(
  "Tenant",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subdomain: {
      type: DataTypes.STRING(63),
      allowNull: false,
      unique: true,
      validate: {
        len: [1, 63],
        isLowercase: true,
        is: "^[a-z0-9][a-z0-9-]*[a-z0-9]$",
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { isEmail: true },
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    plan: {
      type: DataTypes.ENUM("free", "professional", "business", "enterprise"),
      defaultValue: "free",
    },
    status: {
      type: DataTypes.ENUM("active", "suspended", "deleted"),
      defaultValue: "active",
    },
    trial_ends_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    billing_cycle: {
      type: DataTypes.ENUM("monthly", "yearly"),
      defaultValue: "monthly",
    },
    billing_email: { type: DataTypes.STRING(255), allowNull: true },
    contact_name: { type: DataTypes.STRING(255), allowNull: true },
    contact_email: { type: DataTypes.STRING(255), allowNull: true },
    contact_phone: { type: DataTypes.STRING(50), allowNull: true },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    limit_seats: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
    },
    limit_storage_mb: {
      type: DataTypes.INTEGER,
      defaultValue: 10240,
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "tenants",
    timestamps: true,
    paranoid: true,
    underscored: false,
    indexes: [
      { fields: ["status"] },
      { fields: ["subdomain"] },
      { fields: ["domain"] },
      { fields: ["email"] },
      { fields: ["code"], unique: true },
      { fields: ["isDeleted"] },
    ],
    // Soft-delete: exclude deleted records by default.
    // Use tenant.scope({ includeDeleted: true }) to include them.
    defaultScope: {
      where: { isDeleted: false },
    },
    scopes: {
      includeDeleted: {
        where: null,
      },
    },
  },
);

/**
 * Soft-delete a tenant. Sets isDeleted = true and persists.
 * Note: destroy() performs a hard delete; use softDelete() instead.
 */
Tenant.prototype.softDelete = async function () {
  this.isDeleted = true;
  return this.save({ hooks: false });
};

/**
 * Restore a soft-deleted tenant by ID. Sets isDeleted = false.
 */
Tenant.restore = async function (id) {
  return this.update(
    { isDeleted: false },
    { where: { id, isDeleted: true } },
  );
};

// ==========================================
//                     USER
// ==========================================

const User = db.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "tenants", key: "id" },
      onDelete: "CASCADE",
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "roles", key: "id" },
      onDelete: "SET NULL",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { isEmail: true },
    },
    password: { type: DataTypes.STRING(255), allowNull: false },
    first_name: { type: DataTypes.STRING(100), allowNull: false },
    last_name: { type: DataTypes.STRING(100), allowNull: false },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    avatar_url: { type: DataTypes.STRING(1024), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    is_email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    // Authentication security fields
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // OTP fields
    otp_code: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    otp_expired_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    otp_request_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    otp_last_requested_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_changed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ["username"], unique: true },
      { fields: ["email"], unique: true },
      { fields: ["tenant_id", "email"] },
      { fields: ["tenant_id", "role_id"] },
      { fields: ["status"] },
      { fields: ["is_active"] },
      { fields: ["failed_login_attempts"] },
      { fields: ["isDeleted"] },
    ],
    // Soft-delete: exclude deleted records by default.
    // Use User.scope({ includeDeleted: true }) to include them.
    defaultScope: {
      where: { isDeleted: false },
    },
    scopes: {
      includeDeleted: {
        where: null,
      },
    },
  },
);

/**
 * Soft-delete a user. Sets isDeleted = true and persists.
 * Note: destroy() performs a hard delete; use softDelete() instead.
 */
User.prototype.softDelete = async function () {
  this.isDeleted = true;
  return this.save({ hooks: false });
};

/**
 * Restore a soft-deleted user by ID. Sets isDeleted = false.
 */
User.restore = async function (id) {
  return this.update(
    { isDeleted: false },
    { where: { id, isDeleted: true } },
  );
};

// ==========================================
//                     ROLE
// ==========================================

const Role = db.define(
  "Role",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    nameToShow: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "name_to_show",
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.STRING(20), defaultValue: "active" },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    role_level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "roles",
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
      { fields: ["status"] },
      { fields: ["isDeleted"] },
    ],
    // Soft-delete: exclude deleted records by default.
    // System roles (is_system: true) should NOT be soft-deleted.
    // Use Role.scope({ includeDeleted: true }) to include them.
    defaultScope: {
      where: { isDeleted: false },
    },
    scopes: {
      includeDeleted: {
        where: null,
      },
    },
  },
);

/**
 * Soft-delete a non-system role. Sets isDeleted = true and persists.
 * Throws if the role is a system role (is_system: true).
 * Note: destroy() performs a hard delete; use softDelete() instead.
 */
Role.prototype.softDelete = async function () {
  if (this.is_system) {
    const err = new Error("Cannot soft-delete system roles");
    err.code = "CANNOT_DELETE_SYSTEM_ROLE";
    throw err;
  }
  this.isDeleted = true;
  return this.save({ hooks: false });
};

/**
 * Restore a soft-deleted role by ID. Sets isDeleted = false.
 */
Role.restore = async function (id) {
  return this.update(
    { isDeleted: false },
    { where: { id, isDeleted: true } },
  );
};

// ==========================================
//                     MENU GROUP
// ==========================================

const MenuGroup = db.define(
  "MenuGroup",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    icon: { type: DataTypes.STRING(50), allowNull: true },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "menu_groups", key: "id" },
      onDelete: "SET NULL",
    },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "menu_groups",
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [{ fields: ["slug"] }, { fields: ["is_active"] }],
  },
);

// ==========================================
//                     ROLE MENU PERMISSION
// ==========================================

const RoleMenuPermission = db.define(
  "RoleMenuPermission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "roles", key: "id" },
      onDelete: "CASCADE",
      field: "role_id",
    },
    menu_group_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "menu_groups", key: "id" },
      onDelete: "CASCADE",
      field: "menu_group_id",
    },
    permission_type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "read",
      validate: {
        isIn: [["read", "write"]],
      },
      field: "permission_type",
    },
  },
  {
    tableName: "role_menu_permissions",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["role_id", "menu_group_id"], unique: true },
      { fields: ["role_id"] },
      { fields: ["menu_group_id"] },
    ],
    paranoid: false,
  },
);

// ==========================================
//                     SESSION
// ==========================================

const Session = db.define(
  "Session",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "tenants", key: "id" },
      onDelete: "CASCADE",
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    device: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expiredAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revokedReason: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "sessions",
    timestamps: true,
    underscored: false,
    indexes: [
      { fields: ["tokenHash"], unique: true },
      { fields: ["userId"] },
      { fields: ["tenantId"] },
      { fields: ["expiredAt"] },
      { fields: ["isRevoked", "isActive"] },
      { fields: ["isDeleted"] },
    ],
    // Soft-delete: exclude deleted records by default.
    // Use Session.scope({ includeDeleted: true }) to include them.
    defaultScope: {
      where: { isDeleted: false },
    },
    scopes: {
      includeDeleted: {
        where: null,
      },
    },
  },
);

/**
 * Soft-delete a session. Sets isDeleted = true, records deletedAt timestamp,
 * and persists. Also revokes the session (sets isRevoked = true).
 * Note: destroy() performs a hard delete; use softDelete() instead.
 */
Session.prototype.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isRevoked = true;
  return this.save({ hooks: false });
};

/**
 * Restore a soft-deleted session by ID. Sets isDeleted = false and nulls deletedAt.
 */
Session.restore = async function (id) {
  return this.update(
    { isDeleted: false, deletedAt: null },
    { where: { id, isDeleted: true } },
  );
};

// ==========================================
//                     RELATIONSHIPS
// ==========================================

// Session -> User
Session.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Session, { foreignKey: "userId", as: "sessions" });

// Session -> Tenant
Session.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Tenant.hasMany(Session, { foreignKey: "tenantId", as: "sessions" });

// Tenant -> Users
Tenant.hasMany(User, { foreignKey: "tenant_id", as: "users" });
User.belongsTo(Tenant, { foreignKey: "tenant_id", as: "tenant" });

// User -> Role (users have role_id for RBAC)
User.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
  onDelete: "SET NULL",
});
Role.hasMany(User, { foreignKey: "role_id", as: "users" });

// Role -> RoleMenuPermission
Role.hasMany(RoleMenuPermission, {
  foreignKey: "role_id",
  as: "permissions",
  onDelete: "CASCADE",
});
RoleMenuPermission.belongsTo(Role, { foreignKey: "role_id", as: "role" });

// MenuGroup -> RoleMenuPermission
MenuGroup.hasMany(RoleMenuPermission, {
  foreignKey: "menu_group_id",
  as: "role_permissions",
  onDelete: "CASCADE",
});
RoleMenuPermission.belongsTo(MenuGroup, {
  foreignKey: "menu_group_id",
  as: "menu",
});

// MenuGroup -> self (parent/child hierarchy)
MenuGroup.belongsTo(MenuGroup, {
  foreignKey: "parent_id",
  as: "parent",
  onDelete: "SET NULL",
});
MenuGroup.hasMany(MenuGroup, {
  foreignKey: "parent_id",
  as: "children",
  onDelete: "SET NULL",
});

// ==========================================
//                     SYNC & EXPORT
// ==========================================

// DISABLED: Auto-sync is handled by migration.service.js and reset-db.js
// Do NOT enable modelsSequelize.sync() here as it causes conflicts with the
// optimized models in separate files (Tenant.js, Users.js, etc.)
// if (process.env.NODE_ENV === "development") {
//   modelsSequelize.sync({ alter: true });
// }

// Backward compatibility: export both singular and plural names
module.exports = {
  sequelize: db, // shared instance (formerly modelsSequelize)
  Sequelize: db.sequelize, // class reference if needed
  // Singular
  Tenant,
  User,
  Role,
  MenuGroup,
  RoleMenuPermission,
  Session,
  // Plural (backward compatibility)
  Tenants: Tenant,
  Users: User,
  Roles: Role,
  MenuGroups: MenuGroup,
  RoleMenuPermissions: RoleMenuPermission,
  Sessions: Session,
};
