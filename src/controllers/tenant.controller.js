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
    result.data,
    result.message || "Fetch tenants successful",
    result.status || 200,
    result.meta,
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
    });
  }

  success(
    res,
    result.data,
    result.message || "Fetch tenant successful",
    result.status || 200,
  );
});

// ==========================================
// CREATE TENANT
// ==========================================

exports.createTenant = asyncHandler(async (req, res) => {
  const createdBy = req.user?.id;

  const result = await tenantService.createTenant(req.body, createdBy);

  success(
    res,
    result.data,
    result.message || "Tenant created successfully",
    result.status || 201,
  );
});

// ==========================================
// UPDATE TENANT
// ==========================================

exports.updateTenant = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;
  const updatedBy = req.user?.id;

  const result = await tenantService.updateTenant(
    tenantId,
    req.body,
    updatedBy,
  );

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
    });
  }

  success(
    res,
    result.data,
    result.message || "Tenant updated successfully",
    result.status || 200,
  );
});

// ==========================================
// DELETE TENANT
// ==========================================

exports.deleteTenant = asyncHandler(async (req, res) => {
  const { tenantId } = req.params || req.body;
  const deletedBy = req.user?.id;

  const result = await tenantService.deleteTenant(tenantId, deletedBy);

  if (result.status === 404) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: result.message,
    });
  }

  if (result.status === 400) {
    return res.status(400).json({
      success: false,
      status: 400,
      message: result.message,
    });
  }

  success(
    res,
    result.data,
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
    });
  }

  success(
    res,
    result.data,
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
    });
  }

  success(
    res,
    result.data,
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
    });
  }

  success(
    res,
    result.data,
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
    result.message || "Tenant logo removed successfully",
    result.status || 200,
  );
});
