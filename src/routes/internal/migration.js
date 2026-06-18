const express = require("express");
const router = express.Router();
const {
  migrate,
  dropTable,
  seeding,
  unseeding,
} = require("../../controllers/migration.controller");

/**
 * @swagger
 * tags:
 *   name: Migration
 *   description: Database migration endpoints
 */

/**
 * @swagger
 * /api/v1/migration/up:
 *   get:
 *     summary: Run database migration
 *     tags:
 *       - Migration
 *     responses:
 *       '200':
 *         description: Migration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Database table migrate success
 *       '400':
 *         description: Migration failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: Something went wrong while running migrations
 */
router.get(
  "/up",
  // abac(["SUPERADMIN", "migration:execute"]),
  migrate,
);

/**
 * @swagger
 * /api/v1/migration/down:
 *   get:
 *     summary: Drop database tables
 *     tags:
 *       - Migration
 *     responses:
 *       '200':
 *         description: Drop successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Database table drop successfully
 *       '400':
 *         description: Drop failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: Failed to drop tables
 */
router.get(
  "/down",
  // abac(["SUPERADMIN", "migration:revert"]),
  dropTable,
);

/**
 * @swagger
 * /api/v1/migration/seeding:
 *   get:
 *     summary: Seed database with initial data
 *     tags:
 *       - Migration
 *     responses:
 *       '200':
 *         description: Seeding successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Seeding success
 *       '400':
 *         description: Seeding failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: Seeding failed
 */
router.get(
  "/seeding",
  // abac(["SUPERADMIN", "migration:seed"]),
  seeding,
);

/**
 * @swagger
 * /api/v1/migration/unseeding:
 *   get:
 *     summary: Remove seeded data from the database
 *     tags:
 *       - Migration
 *     responses:
 *       '200':
 *         description: Unseeding successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: Unseeding success
 *       '400':
 *         description: Unseeding failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: Unseeding failed
 */
router.get(
  "/unseeding",
  // abac(["SUPERADMIN", "migration:unseed"]),
  unseeding,
);

module.exports = router;
