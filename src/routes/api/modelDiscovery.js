/**
 * @swagger
 * tags:
 *   name: ModelDiscovery
 *   description: Automatic model discovery and seeding endpoints
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const controller = require("../../controllers/modelDiscovery.controller");

/* ------------------------------------------------------------------ */
/* MODEL DISCOVERY ENDPOINTS                                          */
/* ------------------------------------------------------------------ */

/**
 * @swagger
 * /api/v1/model-discovery/status:
 *   get:
 *     summary: Get model discovery status and summary
 *     tags: [ModelDiscovery]
 *     security: [bearerAuth: []]
 *     responses:
 *       200:
 *         description: Model discovery status retrieved successfully
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
 *                   example: "Model discovery status retrieved"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalModels:
 *                       type: integer
 *                     models:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/status", auth, controller.getModelDiscoveryStatus);

/**
 * @swagger
 * /api/v1/model-discovery/discover:
 *   post:
 *     summary: Run model discovery and seed database
 *     description: Discovers all models in the models directory, creates/updates model entries, and generates table permissions
 *     tags: [ModelDiscovery]
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: query
 *         name: assignRoles
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Whether to assign permissions to default roles
 *     responses:
 *       200:
 *         description: Model discovery completed successfully
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
 *                   example: "Model discovery completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     modelsDiscovered:
 *                       type: integer
 *                     modelsCreated:
 *                       type: integer
 *                     modelsUpdated:
 *                       type: integer
 *                     permissionsCreated:
 *                       type: integer
 *                     errors:
 *                       type: array
 */
router.post("/discover", auth, controller.runModelDiscovery);

/**
 * @swagger
 * /api/v1/model-discovery/models:
 *   get:
 *     summary: Get all discovered models
 *     tags: [ModelDiscovery]
 *     security: [bearerAuth: []]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by modelName, tableName, or module
 *     responses:
 *       200:
 *         description: Discovered models retrieved successfully
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
 *                   example: "Discovered models retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     models:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get("/models", auth, controller.getDiscoveredModels);

module.exports = router;
