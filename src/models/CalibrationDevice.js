/**
 * CalibrationDevice Model
 *
 * Tracks calibration devices with their calibration schedule.
 * Each device belongs to a tenant and can be assigned to a warehouse.
 */

/**
 * Define the CalibrationDevice model.
 * @param {import("sequelize").Sequelize} db - The Sequelize instance
 * @param {typeof import("sequelize").DataTypes} DataTypes - The Sequelize DataTypes
 * @returns {object} The defined Sequelize model
 */
const defineModel = (db, DataTypes) => {
  const CalibrationDevice = db.define(
    "CalibrationDevice",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "tenants", key: "id" },
        onDelete: "CASCADE",
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      serialNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
      },
      manufacturer: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      model: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "maintenance", "retired"),
        defaultValue: "active",
      },
      locationId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "warehouses", key: "id" },
        onDelete: "SET NULL",
      },
      installationDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      nextCalibrationDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      calibrationIntervalDays: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Days between automatic recalibration",
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      tableName: "calibration_devices",
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { fields: ["tenant_id"] },
        { fields: ["serial_number"], unique: true },
        { fields: ["status"] },
        { fields: ["next_calibration_date"] },
        { fields: ["is_deleted"] },
      ],
      defaultScope: {
        where: { is_deleted: false },
      },
      scopes: {
        includeDeleted: {
          where: null,
        },
      },
    },
  );

  /**
   * Soft-delete a calibration device. Sets is_deleted = true and persists.
   */
  CalibrationDevice.prototype.softDelete = async function () {
    this.is_deleted = true;
    return this.save({ hooks: false });
  };

  /**
   * Restore a soft-deleted calibration device by ID. Sets is_deleted = false.
   */
  CalibrationDevice.restoreStatic = async function (id) {
    return this.update(
      { is_deleted: false },
      { where: { id, is_deleted: true } },
    );
  };

  /**
   * Define associations for this model.
   * @param {object} models - The aggregated models object
   */
  CalibrationDevice.associate = (models) => {
    // CalibrationDevice -> Tenant
    CalibrationDevice.belongsTo(models.Tenant, {
      foreignKey: "tenantId",
      as: "tenant",
    });
    // CalibrationDevice -> Warehouse
    CalibrationDevice.belongsTo(models.Warehouse, {
      foreignKey: "locationId",
      as: "warehouse",
    });
    // CalibrationDevice -> CalibrationRecord (hasMany)
    CalibrationDevice.hasMany(models.CalibrationRecord, {
      foreignKey: "deviceId",
      as: "calibrationRecords",
    });
  };

  return CalibrationDevice;
};

module.exports = defineModel;
