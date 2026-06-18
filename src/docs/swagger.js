const fs = require("fs");
const swaggerUi = require("swagger-ui-express");

const appPath = require("../utils/appPath");

const swaggerSpec = JSON.parse(
  fs.readFileSync(appPath("swagger.json"), "utf8"),
);

// Remove xSession API Key scheme — it conflicts with bearerAuth JWT
// and causes Swagger UI to prompt for the wrong auth header.
if (swaggerSpec.components) {
  delete swaggerSpec.components.securitySchemes;
  if (Object.keys(swaggerSpec.components).length === 0) {
    // Clean up empty components object if bearerAuth is already in spec
  }
}
if (swaggerSpec.securityDefinitions) {
  delete swaggerSpec.securityDefinitions.xSession;
}

const swaggerDocs = (app) => {
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,

      swaggerOptions: {
        persistAuthorization: true,
        // Use bearerAuth (JWT) instead of the incorrect xSession API key
        security: [{ bearerAuth: [] }],
      },
    }),
  );
};

module.exports = {
  swaggerDocs,
};
