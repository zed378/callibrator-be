const fs = require("fs");
const swaggerUi = require("swagger-ui-express");

const appPath = require("../utils/appPath");

const swaggerSpec = JSON.parse(
  fs.readFileSync(appPath("swagger.json"), "utf8"),
);

// Add X-Session header security definition
swaggerSpec.components = swaggerSpec.components || {};
swaggerSpec.securityDefinitions = swaggerSpec.securityDefinitions || {};
swaggerSpec.securityDefinitions.xSession = {
  type: "apiKey",
  in: "header",
  name: "X-Session",
  description: "Session ID for authentication",
};

const swaggerDocs = (app) => {
  app.use(
    "/docs",

    swaggerUi.serve,

    swaggerUi.setup(swaggerSpec, {
      explorer: true,

      swaggerOptions: {
        persistAuthorization: true,
        security: [{ xSession: [] }],
      },
    }),
  );
};

module.exports = {
  swaggerDocs,
};
