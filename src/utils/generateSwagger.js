const path = require("path");
const fs = require("fs");
require("./env");

const swaggerJsdoc = require("swagger-jsdoc");
const { logger } = require("../middlewares/activityLog");
const components = require("../docs/components");
const tags = require("../docs/tags");

const outputProdPath = path.resolve(__dirname, "../../swagger.json");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Calibrator API",
      version: "1.0.0",
      description: "Enterprise-grade Express.js API documentation",
    },

    servers: [
      {
        url: process.env.HOST_URL,
      },
    ],

    tags: tags.tags,
  },

  apis: [path.resolve(__dirname, "../routes/api/*.js")],
};

const swaggerSpec = swaggerJsdoc(options);

// swagger-jsdoc strips out top-level components from the definition object.
// Components are only preserved if referenced via inline @swagger JSDoc blocks.
// Since we moved all component definitions to docs/components.js, we inject
// them back here after generation so $ref: '#/components/schemas/...' works.
swaggerSpec.components = mergeComponents(
  swaggerSpec.components || {},
  components.components,
);

fs.writeFileSync(outputProdPath, JSON.stringify(swaggerSpec, null, 2));

logger.info(`Swagger generated at ${outputProdPath}`);

/**
 * Deep-merge external components into the swagger spec.
 * Handles schemas, securitySchemes, parameters, requestBodies, responses, examples.
 */
function mergeComponents(target, source) {
  const merged = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (key === "securitySchemes") {
      merged.securitySchemes = { ...merged.securitySchemes, ...value };
    } else if (key === "schemas") {
      merged.schemas = { ...merged.schemas, ...value };
    } else if (key === "parameters") {
      merged.parameters = { ...merged.parameters, ...value };
    } else if (key === "requestBodies") {
      merged.requestBodies = { ...merged.requestBodies, ...value };
    } else if (key === "responses") {
      merged.responses = { ...merged.responses, ...value };
    } else if (key === "examples") {
      merged.examples = { ...merged.examples, ...value };
    } else {
      merged[key] = value;
    }
  }

  return merged;
}
