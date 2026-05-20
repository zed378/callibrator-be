const { Models, TablePermission } = require("../models");
const tablePermissionService = require("../services/tablePermission.service");

/**
 * Dynamic RBAC + ABAC Middleware
 *
 * This middleware replaces the hardcoded rbac() and abac() middlewares.
 * It dynamically checks permissions from the database based on model and action.
 *
 * USAGE:
 *
 * // Simple model action check
 * router.get("/", auth, dynamicAccess("Invoice", "read", { checkTenant: true }), controller);
 *
 * // Self-check (user can only access their own record)
 * router.patch("/:id", auth, dynamicAccess("User", "update", { checkSelf: true }), controller);
 *
 * // Multiple actions (OR logic - user needs any one)
 * router.get("/", auth, dynamicAccess("Product", ["read", "export"]), controller);
 *
 * // Multiple actions (AND logic - user needs all)
 * router.post("/bulk", auth, dynamicAccess("Report", ["read", "export"], { requireAll: true }), controller);
 *
 * @param {string|string[]} modelName - Model name(s) (e.g., 'Invoice', 'Product', ['User', 'Admin'])
 * @param {string|string[]} action - Action(s) (e.g., 'read', 'update', ['create', 'read'])
 * @param {Object} options - Additional options
 * @param {boolean} options.checkSelf - Check if user is accessing own resource
 * @param {boolean} options.checkTenant - Check tenant isolation
 * @param {boolean} options.requireAll - Require all actions (AND logic) vs any action (OR logic, default)
 * @param {string} options.idField - Custom field name for ID lookup (default: 'id')
 * @returns {Function} Express middleware
 */
exports.dynamicAccess = (modelName, action, options = {}) => {
  const {
    checkSelf = false,
    checkTenant = false,
    requireAll = false,
    idField = "id",
  } = options;

  // Normalize to arrays
  const modelNames = Array.isArray(modelName) ? modelName : [modelName];
  const actions = Array.isArray(action) ? action : [action];

  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.role) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: No user context found",
        });
      }

      // 1. SUPER_ADMIN bypass - has access to everything
      if (user.role.name === "SUPER_ADMIN") {
        req.dynamicAccessContext = {
          allowed: true,
          reason: "SUPER_ADMIN bypass",
          models: modelNames,
          actions,
        };
        return next();
      }

      // 2. Get tenant ID for tenant-scoped checks
      const tenantId = req.user.tenantId;
      const requestedTenantId = req.params.tenantId || req.body?.tenantId;

      // 3. Check permissions for each model
      const results = [];
      let allAllowed = true;

      for (const name of modelNames) {
        const result = await checkModelPermission(
          name,
          actions,
          user,
          { checkSelf, checkTenant, requireAll },
          req,
          requestedTenantId,
        );

        results.push(result);
        if (!result.allowed) {
          allAllowed = false;
        }
      }

      // If requireAll is true, ALL models must be allowed
      // If requireAll is false (default), ANY model being allowed is sufficient
      const finalAllowed = requireAll
        ? allAllowed
        : results.some((r) => r.allowed);

      if (!finalAllowed) {
        const deniedActions = results
          .filter((r) => !r.allowed)
          .flatMap((r) => r.deniedActions || []);

        return res.status(403).json({
          success: false,
          message: "Forbidden: Insufficient permissions",
          required: deniedActions.length > 0 ? deniedActions : actions,
          models: modelNames,
        });
      }

      // 4. Apply ABAC rules if present
      const allowedResult = results.find((r) => r.allowed);
      if (allowedResult?.abacRules) {
        const abacResult = await evaluateAbacRules(
          allowedResult.abacRules,
          user,
          req,
          allowedResult.modelName,
        );

        if (!abacResult.allowed) {
          return res.status(403).json({
            success: false,
            message: abacResult.reason || "ABAC rule violation",
          });
        }
      }

      // 5. Handle self-check
      if (checkSelf) {
        const targetId =
          req.params[idField] ||
          req.body[`${modelNames[0].toLowerCase()}Id`] ||
          req.query[idField];

        if (targetId && String(targetId) !== String(user.id)) {
          return res.status(403).json({
            success: false,
            message: `Forbidden: You can only perform actions on your own ${modelNames[0].toLowerCase()}`,
          });
        }
      }

      // 6. Handle tenant isolation
      if (checkTenant && tenantId && requestedTenantId) {
        if (String(tenantId) !== String(requestedTenantId)) {
          return res.status(403).json({
            success: false,
            message: "Cross-tenant access denied",
          });
        }
      }

      // 7. Attach permission context to request for controller use
      req.dynamicAccessContext = {
        allowed: true,
        models: modelNames,
        actions,
        permission: allowedResult?.permission || null,
        abacRules: allowedResult?.abacRules || null,
      };

      // Attach allowed attributes to request for controller use
      if (allowedResult?.permission?.attributes) {
        req.allowedAttributes = allowedResult.permission.attributes;
      }

      next();
    } catch (error) {
      console.error("DynamicAccess Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Internal Server Error",
      });
    }
  };
};

/**
 * Check permission for a specific model
 */
async function checkModelPermission(
  modelName,
  actions,
  user,
  options,
  req,
  requestedTenantId,
) {
  const { checkSelf, checkTenant, requireAll } = options;

  // Check if model exists
  const model = await Models.findOne({
    where: { modelName, isActive: true },
    include: [
      {
        model: TablePermission,
        as: "tablePermissions",
        required: false,
      },
    ],
  });

  if (!model) {
    return {
      allowed: false,
      deniedActions: actions,
      modelName,
      permission: null,
      abacRules: null,
    };
  }

  // Check each action
  const actionResults = [];

  for (const action of actions) {
    const tablePerm = model.tablePermissions?.find((p) => p.action === action);

    if (!tablePerm) {
      actionResults.push({ action, allowed: false });
      continue;
    }

    // Use the service to check if user has permission
    const hasPermission = await tablePermissionService.checkUserPermission(
      user.id,
      modelName,
      action,
      requestedTenantId || user.tenantId,
    );

    actionResults.push({
      action,
      allowed: hasPermission.allowed,
      permission: hasPermission.permission,
      abacRules: hasPermission.abacRules,
    });
  }

  // Determine if actions are allowed (OR or AND logic)
  const allowed = requireAll
    ? actionResults.every((r) => r.allowed)
    : actionResults.some((r) => r.allowed);

  const deniedActions = actionResults
    .filter((r) => !r.allowed)
    .map((r) => r.action);

  // Return the first allowed permission with ABAC rules
  const allowedResult = actionResults.find((r) => r.allowed);

  return {
    allowed,
    deniedActions,
    modelName,
    permission: allowedResult?.permission || null,
    abacRules: allowedResult?.abacRules || null,
  };
}

/**
 * Evaluate ABAC rules against the request
 */
async function evaluateAbacRules(abacRules, user, req, modelName) {
  if (!abacRules) {
    return { allowed: true };
  }

  const { condition, fields, operator, value, expression } = abacRules;

  // Handle predefined conditions
  switch (condition) {
    case "owner":
      return evaluateOwnerRule(user, req, fields);

    case "attribute":
      return evaluateAttributeRule(fields, operator, value, req, modelName);

    case "custom":
      return evaluateCustomRule(expression, user, req, fields);

    case "tenant":
      return evaluateTenantRule(user, req);

    default:
      return { allowed: true }; // Unknown conditions are allowed by default
  }
}

/**
 * Evaluate owner rule - user can only access their own records
 */
function evaluateOwnerRule(user, req, fields) {
  const targetId = req.params.id || req.params.userId || req.body.userId;

  if (!targetId) {
    return { allowed: true }; // No target specified, allow
  }

  if (String(targetId) === String(user.id)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "You can only access your own records",
  };
}

/**
 * Evaluate attribute rule - check resource attribute against value
 */
async function evaluateAttributeRule(fields, operator, value, req, modelName) {
  // This would require fetching the resource and checking the attribute
  // For now, we return allowed - the actual implementation would depend on the model
  // and would be implemented in the controller after fetching the resource

  // Example implementation:
  // const ModelClass = getModelByName(modelName);
  // const resource = await ModelClass.findByPk(req.params.id);
  // return compareAttribute(resource[fields[0]], operator, value);

  return { allowed: true }; // Placeholder - actual check in controller
}

/**
 * Evaluate custom rule - execute custom JavaScript expression
 */
function evaluateCustomRule(expression, user, req, fields) {
  if (!expression) {
    return { allowed: true };
  }

  try {
    // Create a function from the expression with safe variables
    const safeVars = { user, req };
    const func = new Function(...Object.keys(safeVars), `return ${expression}`);
    const result = func(...Object.values(safeVars));

    return { allowed: !!result };
  } catch (error) {
    console.error("Custom ABAC rule evaluation error:", error);
    return { allowed: false, reason: "Custom rule evaluation failed" };
  }
}

/**
 * Evaluate tenant rule - user must be in the same tenant
 */
function evaluateTenantRule(user, req) {
  const requestedTenantId = req.params.tenantId || req.body?.tenantId;

  if (!requestedTenantId || !user.tenantId) {
    return { allowed: true };
  }

  if (String(user.tenantId) === String(requestedTenantId)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Cross-tenant access denied",
  };
}

/**
 * Helper: Compare attribute value
 */
function compareAttribute(actual, operator, expected) {
  switch (operator) {
    case "eq":
    case "==":
      return actual === expected;
    case "neq":
    case "!=":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "nin":
      return Array.isArray(expected) && !expected.includes(actual);
    case "gt":
      return actual > expected;
    case "lt":
      return actual < expected;
    case "gte":
      return actual >= expected;
    case "lte":
      return actual <= expected;
    default:
      return true;
  }
}

/**
 * Helper: Get model class by name
 */
function getModelByName(modelName) {
  const models = require("../models");
  // Convert to PascalCase for model key
  const key = modelName.charAt(0).toUpperCase() + modelName.slice(1);
  return models[key] || null;
}

/**
 * Middleware to check if user has permission for a specific action
 * Returns the permission details without blocking access
 * Useful for conditional UI rendering
 */
exports.hasDynamicPermission = async (req, res, next) => {
  try {
    const { modelName, action } = req.body || {};

    if (!modelName || !action) {
      return res.status(400).json({
        success: false,
        message: "modelName and action are required",
      });
    }

    const result = await tablePermissionService.checkUserPermission(
      req.user.id,
      modelName,
      action,
      req.user.tenantId,
    );

    return res.status(200).json({
      success: true,
      data: {
        allowed: result.allowed,
        permission: result.permission,
        abacRules: result.abacRules,
      },
    });
  } catch (error) {
    console.error("hasDynamicPermission Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
