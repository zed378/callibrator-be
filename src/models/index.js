const { Users } = require("./user");
const { Tenants } = require("./tenant");
const { Permissions } = require("./permission");
const { UserPermissions } = require("./user_permission");
const { TenantSettings } = require("./tenant_setting");
const { Sessions } = require("./session");
const { LoginLogs } = require("./login_record");
const { Roles } = require("./roles");
const { TenantRoles } = require("./tenant_role");
const { TenantFeatures } = require("./tenant_feature");
const { TenantAuditLog } = require("./tenant_audit_log");
const { TenantBackup } = require("./tenant_backup");
const { Models } = require("./model");
const { TablePermission } = require("./table_permission");
const { RolePermission } = require("./role_permission");
const { TenantRolePermission } = require("./tenant_role_permission");
// const {} = require("");

// ==========================================
// COLLECT MODELS
// ==========================================

const models = {
  Users,
  Tenants,
  Permissions,
  UserPermissions,
  TenantSettings,
  Sessions,
  LoginLogs,
  Roles,
  TenantRoles,
  TenantFeatures,
  TenantAuditLog,
  TenantBackup,
  Models,
  TablePermission,
  RolePermission,
  TenantRolePermission,
};

// ==========================================
// RUN ASSOCIATIONS
// ==========================================

Object.keys(models).forEach((key) => {
  if (models[key].associate) {
    models[key].associate(models);
  }
});

module.exports = {
  ...models,
  TenantBackup: require("./tenant_backup").TenantBackup,
  Op: require("sequelize").Op,
  Sequelize: require("sequelize").Sequelize,
};
