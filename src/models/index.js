/**
 * Database Models Index — Dynamic Loading Entry Point
 *
 * Architecture:
 * - All models reside in src/models/ as individual files
 * - Each model exports a function that accepts the Sequelize instance and DataTypes
 * - Dynamic directory loading via fs.readdirSync discovers and initializes models
 * - Association methods on each model are called after all models are loaded
 * - Single aggregated db object is exported for dependency injection
 *
 * This pattern enforces:
 * - One model per file (1:1 ratio)
 * - No hard-coded model imports
 * - Centralized model access
 * - Automatic association resolution
 *
 * Models:
 * - Tenant: Organization/entity with plan and settings
 * - User: Individual user accounts within tenants
 * - Role: RBAC roles with CRUD permissions (read/write) on menu groups
 * - MenuGroup: Navigation menu groups that roles can access
 * - RoleMenuPermission: Maps read/write permissions on menu groups to roles
 * - Session: Persistent authentication session records
 * - Warehouse: Physical warehouse locations for a tenant
 * - StorageLocation: Specific storage locations within a warehouse
 * - Stock: Inventory levels per SKU per warehouse location
 * - StockTransfer: Inter-warehouse stock transfers
 * - StockAdjustment: Manual stock adjustments (add/remove)
 * - StockOpname: Periodic inventory counting records
 * - CalibrationDevice: Devices with calibration schedule tracking
 * - CalibrationRecord: Calibration history for devices
 * - TenantBackup: Backup operation records for tenants
 * - TenantSettings: Key-value tenant configuration settings
 * - Permission: Granular permission definitions (module:action)
 * - UserPermission: User-to-permission mappings
 * - Certificate: Calibration certificates with digital signatures
 */

const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes, Op } = require("sequelize");

// Use the shared Sequelize instance from config.
// This ensures all queries use the configured pool, SSL, timezone,
// retry logic, and logging settings instead of Sequelize defaults.
const { db } = require("../config");

const models = {};

// Dynamic Loading: Read directory, execute exports, store in models object
const modelFiles = fs
  .readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 && file !== "index.js" && file.slice(-3) === ".js"
    );
  })
  .map((file) => require(path.join(__dirname, file)));

modelFiles.forEach((defineModel) => {
  const model = defineModel(db, DataTypes);
  models[model.name] = model;
});

// Association Mapping: Iterate models, execute associate method if exists
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Global Export: Export collective models object for dependency injection
db.sequelize = db;
db.Sequelize = Sequelize;
db.Op = Op;

// Backward compatibility: export both singular and plural names
module.exports = Object.assign(db, {
  // Singular
  Tenant: models.Tenant,
  User: models.User,
  Role: models.Role,
  MenuGroup: models.MenuGroup,
  RoleMenuPermission: models.RoleMenuPermission,
  Session: models.Session,
  Warehouse: models.Warehouse,
  StorageLocation: models.StorageLocation,
  Stock: models.Stock,
  StockTransfer: models.StockTransfer,
  StockAdjustment: models.StockAdjustment,
  StockOpname: models.StockOpname,
  CalibrationDevice: models.CalibrationDevice,
  CalibrationRecord: models.CalibrationRecord,
  TenantBackup: models.TenantBackup,
  TenantSettings: models.TenantSettings,
  Permission: models.Permission,
  UserPermission: models.UserPermission,
  Certificate: models.Certificate,
  // Plural (backward compatibility)
  Tenants: models.Tenant,
  Users: models.User,
  Roles: models.Role,
  MenuGroups: models.MenuGroup,
  RoleMenuPermissions: models.RoleMenuPermission,
  Sessions: models.Session,
  Warehouses: models.Warehouse,
  StorageLocations: models.StorageLocation,
  Stocks: models.Stock,
  StockTransfers: models.StockTransfer,
  StockAdjustments: models.StockAdjustment,
  StockOpnames: models.StockOpname,
  CalibrationDevices: models.CalibrationDevice,
  CalibrationRecords: models.CalibrationRecord,
  TenantBackups: models.TenantBackup,
  TenantSettingses: models.TenantSettings,
  Permissions: models.Permission,
  UserPermissions: models.UserPermission,
  Certificates: models.Certificate,
});
