const tenantService = require("../services/tenant.service");
const tenantUploadService = require("../services/tenantUpload.service");
const { asyncHandler } = require("../utils/controllerWrapper");
const { success } = require("../utils/response");

// ==========================================
// FETCH ALL TENANTS WITH PAGINATION
// ==========================================

exports.getAllTenants = asyncHandler(async (req, res) => {
  const { find, page, limit } = req.query;

  const result = await tenantService.fetchTenants({
    find,
    page,
    limit,
  });

  success(
    res,
    result.data.data || result.data.rows,
    result.data.meta || result.meta,
    result.message || "Fetch tenants successful",
    result.status || 200,
  );
});

// ==========================================
// FETCH SPECIFIC TENANT
// ==========================================

exports.getSpecificTenant = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;

  const result = await tenantService.fetchSpecificTenant(tenantId);

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
      data: null,
    });
  }

  success(
    res,
    result.data,
    null,
    result.message || "Fetch tenant successful",
    result.status || 200,
  );
});

// ==========================================
// CREATE TENANT (supports form-data with optional file upload)
// ==========================================

exports.createTenant = asyncHandler(async (req, res, next) => {
  try {
    const createdBy = req.user?.id;
    const uploadedFilename = req.file ? req.uploadFilename : null;

    // Build input data from form-data or JSON body
    const inputData = { ...req.body };

    // If a file was uploaded, add the filename to the input
    if (uploadedFilename) {
      inputData.logo = uploadedFilename;
    }

    const result = await tenantService.createTenant(inputData, createdBy);

    success(
      res,
      result.data,
      null,
      result.message || "Tenant created successfully",
      result.status || 201,
    );
  } catch (err) {
    // Delete uploaded file if creation failed
    if (req.file) {
      try {
        await require("../utils/upload").deleteUpload(
          req.uploadFilename,
          "uploads/tenant",
        );
      } catch (deleteErr) {
        require("../middlewares/activityLog").logger.warn(
          `Failed to delete uploaded file after failure: ${req.uploadFilename}`,
          deleteErr,
        );
      }
    }
    next(err);
  }
});

// ==========================================
// UPDATE TENANT (supports form-data with optional file upload)
// ==========================================

exports.updateTenant = asyncHandler(async (req, res) => {
  const tenantId = req.params.tenantId || req.body.tenantId;
  const updatedBy = req.user?.id;
  const uploadedFilename = req.file ? req.uploadFilename : null;

  // Build input data from form-data or JSON body
  const inputData = { ...req.body };

  // If a file was uploaded, add the filename to the input
  if (uploadedFilename) {
    inputData.logo = uploadedFilename;
  }

  const result = await tenantService.updateTenant(
    tenantId,
    inputData,
    updatedBy,
  );

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
      data: null,
    });
  }

  success(
    res,
    result.data,
    null,
    result.message || "Tenant updated successfully",
    result.status || 200,
  );
});

// ==========================================
// DELETE TENANT
// ==========================================

exports.deleteTenant = asyncHandler(async (req, res) => {
  const { tenantId } = req.query || req.body;
  const deletedBy = req.user?.id;

  const result = await tenantService.deleteTenant(tenantId, deletedBy);

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
      data: null,
    });
  }

  if (result.status === 400) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: result.message,
      data: null,
    });
  }

  success(
    res,
    result.data,
    null,
    result.message || "Tenant deleted successfully",
    result.status || 200,
  );
});

// ==========================================
// GET TENANT SETTINGS
// ==========================================

exports.getTenantSettings = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;

  const result = await tenantService.getTenantSettings(tenantId);

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
      data: null,
    });
  }

  success(
    res,
    result.data,
    null,
    result.message || "Fetch tenant settings successful",
    result.status || 200,
  );
});

// ==========================================
// UPDATE TENANT SETTINGS
// ==========================================

exports.updateTenantSettings = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;
  const settingsData = req.body;
  const updatedBy = req.user?.id;

  const result = await tenantService.updateTenantSettings(
    tenantId,
    settingsData,
    updatedBy,
  );

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
      data: null,
    });
  }

  success(
    res,
    result.data,
    null,
    result.message || "Tenant settings updated successfully",
    result.status || 200,
  );
});

// ==========================================
// GET TENANT USER COUNT
// ==========================================

exports.getTenantUserCount = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;

  const result = await tenantService.getTenantUserCount(tenantId);

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
      data: null,
    });
  }

  success(
    res,
    result.data,
    null,
    result.message || "Fetch tenant user count successful",
    result.status || 200,
  );
});

// ==========================================
// UPLOAD TENANT LOGO
// ==========================================

exports.uploadTenantLogo = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;
  const updatedBy = req.user?.id;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: "No file uploaded",
      data: null,
    });
  }

  const result = await tenantUploadService.updateTenantLogo(
    tenantId,
    req.uploadFilename,
    updatedBy,
  );

  success(
    res,
    result.data,
    null,
    result.message || "Tenant logo uploaded successfully",
    result.status || 200,
  );
});

// ==========================================
// REMOVE TENANT LOGO
// ==========================================

exports.removeTenantLogo = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;
  const updatedBy = req.user?.id;

  const result = await tenantUploadService.removeTenantLogo(
    tenantId,
    updatedBy,
  );

  success(
    res,
    result.data,
    null,
    result.message || "Tenant logo removed successfully",
    result.status || 200,
  );
});
