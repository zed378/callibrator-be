const { Users, Roles } = require("../models");

const { Op } = require("sequelize");

const { Up, Down } = require("../config/migrate");

const bcrypt = require("bcryptjs");

const saltRounds = 12;

// ==========================================
// STATIC ROLE UUID
// ==========================================

const ROLE_IDS = {
  SUPER_ADMIN: "9be20605-cc6a-4d91-8246-9756b4a1754b",
  HEALTCARE_ADMIN: "cd8ce1a8-138e-4a4d-8ae2-2f52ad3a8d08",
  CALIBRATOR_ADMIN: "ce5bc0f9-b342-45d1-b08a-b626c6026a7f",
  USER: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c",
  TECHNICIAN: "752e324a-e426-4cc9-ae2d-639b1a7a2785",
  SUPERVISOR: "137404e9-c995-4437-be17-d1af64ab3c30",
  ENGINEERING_MANAGER: "74101285-c256-4cb9-951d-24ed6547a9cb",
  HEALTHCARE_TECHNICIAN: "b85b324b-9b80-4c36-85b8-46db21872bdf",
  FACILITY_MAINTENANCE: "5e724805-02ba-498f-a7f0-6b415c8f69fe",
  WAREHOUSE_STAFF: "e50b664b-451c-45a9-8c83-f65b94a8afdf",
  ROOM_USER: "6fdd1212-9c4f-45d5-b3bf-5335892be7c0",
};

// ==========================================
// HASH PASSWORD
// ==========================================

const genPass = async (val) => {
  const salt = await bcrypt.genSalt(saltRounds);

  const hash = await bcrypt.hash(val, salt);

  return hash;
};

// ==========================================
// MIGRATE
// ==========================================

exports.migrate = async (req, res) => {
  try {
    await Up();

    res.status(200).send({
      success: true,
      status: 200,
      message: "Database table migrate success",
    });
  } catch (error) {
    res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};

// ==========================================
// DROP TABLE
// ==========================================

exports.dropTable = async (req, res) => {
  try {
    await Down();

    res.status(200).send({
      success: true,
      status: 200,
      message: "Database table drop successfully",
    });
  } catch (error) {
    res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};

// ==========================================
// SEEDING
// ==========================================

exports.seeding = async (req, res) => {
  try {
    // ==========================================
    // SEED ROLES
    // ==========================================

    await Roles.bulkCreate(
      [
        {
          id: ROLE_IDS.SUPER_ADMIN,
          name: "SUPERADMIN",
          description: "System Super Administrator",
          nameToShow: "Super Admin",
        },
        {
          id: ROLE_IDS.HEALTCARE_ADMIN,
          name: "HEALTHCARE ADMIN",
          description: "Healthcare Administrator",
          nameToShow: "Admin Faskes",
        },
        {
          id: ROLE_IDS.CALIBRATOR_ADMIN,
          name: "CALIBRATOR ADMIN",
          description: "Calibrator Administrator",
          nameToShow: "Admin Kalibrator",
        },
        {
          id: ROLE_IDS.USER,
          name: "USER",
          description: "Authenticated User",
          nameToShow: "Normal User",
        },
        {
          id: ROLE_IDS.TECHNICIAN,
          name: "TECHNICIAN",
          description: "Technician",
          nameToShow: "Teknisi",
        },
        {
          id: ROLE_IDS.SUPERVISOR,
          name: "SUPERVISOR",
          description: "Supervisor",
          nameToShow: "Penyelia",
        },
        {
          id: ROLE_IDS.ENGINEERING_MANAGER,
          name: "ENGINEERING MANAGER",
          description: "Enginnering Manager",
          nameToShow: "Manajer Teknik",
        },
        {
          id: ROLE_IDS.HEALTHCARE_TECHNICIAN,
          name: "HEALTHCARE TECHNICIAN",
          description: "Healthcare Technician",
          nameToShow: "Teknisi Faskes",
        },
        {
          id: ROLE_IDS.FACILITY_MAINTENANCE,
          name: "FACILITY MAINTENANCE",
          description: "Facility Maintainance",
          nameToShow: "IPSRS",
        },
        {
          id: ROLE_IDS.WAREHOUSE_STAFF,
          name: "WAREHOUSE STAFF",
          description: "Warehouse Staff",
          nameToShow: "Gudang",
        },
        {
          id: ROLE_IDS.ROOM_USER,
          name: "ROOM USER",
          description: "Room User",
          nameToShow: "User Ruangan",
        },
      ],
      {
        ignoreDuplicates: true,
      },
    ).then(async () => {
      // ==========================================
      // SEED USERS
      // ==========================================

      await Users.bulkCreate(
        [
          {
            username: "sys",
            firstName: "Super",
            lastName: "System",
            email: "sys@mail.com",
            password: await genPass("123123"),
            isActive: true,
            status: "ACTIVE", // it should be ACTIVE, INACTIVE or SUSPENDED
            isEmailVerified: true,
            roleId: ROLE_IDS.SUPER_ADMIN,
          },
        ],
        {
          ignoreDuplicates: true,
        },
      );
    });

    return res.status(200).send({
      success: true,
      status: 200,
      message: "Seeding success",
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};

// ==========================================
// UNSEEDING
// ==========================================

exports.unseeding = async (req, res) => {
  try {
    // ==========================================
    // DELETE USERS
    // ==========================================

    await Users.destroy({
      where: {
        email: {
          [Op.in]: ["root@mail.com"],
        },
      },
    }).then(async () => {
      // ==========================================
      // DELETE ROLES
      // ==========================================

      await Roles.destroy({
        where: {
          id: {
            [Op.in]: Object.values(ROLE_IDS),
          },
        },
      });
    });

    return res.status(200).send({
      success: true,
      status: 200,
      message: "Unseeding success",
    });
  } catch (error) {
    return res.status(400).send({
      success: false,
      status: 400,
      message: error.message,
    });
  }
};
