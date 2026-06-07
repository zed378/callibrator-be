/**
 * Model Discovery Controller
 *
 * Handles API endpoints for model discovery and seeding
 */

const modelDiscoveryService = require("../services/modelDiscovery.service");
const { success, error } = require("../utils/response");

/**
 * GET /api/v1/model-discovery/status
 * Get discovery status and summary
 */
exports.getModelDiscoveryStatus = async (req, res, next) => {
  try {
    const summary = await modelDiscoveryService.getModelSummary();

    success(res, summary, null, "Model discovery status retrieved", 200);
  } catch (err) {
    error(res, err.message || "Failed to get model discovery status", 500);
  }
};

/**
 * POST /api/v1/model-discovery/discover
 * Run model discovery and seed database
 * Query params: assignRoles (boolean, default: true)
 */
exports.runModelDiscovery = async (req, res, next) => {
  try {
    const assignRoles = req.query.assignRoles !== "false";

    const result =
      await modelDiscoveryService.discoverAndSeedModels(assignRoles);

    const status = result.errors.length > 0 ? 207 : 200;
    success(res, result, null, "Model discovery completed", status);
  } catch (err) {
    error(res, err.message || "Model discovery failed", 500);
  }
};

/**
 * GET /api/v1/model-discovery/models
 * Get all discovered models with their permissions
 */
exports.getDiscoveredModels = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const summary = await modelDiscoveryService.getModelSummary();

    let models = summary.models;

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      models = models.filter(
        (m) =>
          m.modelName.toLowerCase().includes(searchLower) ||
          m.tableName.toLowerCase().includes(searchLower) ||
          m.module.toLowerCase().includes(searchLower),
      );
    }

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const total = models.length;
    const totalPages = Math.ceil(total / limitNum);
    const start = (pageNum - 1) * limitNum;
    const paginatedModels = models.slice(start, start + limitNum);

    success(
      res,
      {
        models: paginatedModels,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      null,
      "Discovered models retrieved successfully",
      200,
    );
  } catch (err) {
    error(res, err.message || "Failed to get discovered models", 500);
  }
};
