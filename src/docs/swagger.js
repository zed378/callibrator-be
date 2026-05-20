const fs = require("fs");
const swaggerUi = require("swagger-ui-express");

const appPath = require("../utils/appPath");

const swaggerSpec = JSON.parse(
  fs.readFileSync(appPath("swagger.json"), "utf8"),
);

const swaggerDocs = (app) => {
  app.use(
    "/docs",

    swaggerUi.serve,

    swaggerUi.setup(swaggerSpec, {
      explorer: true,

      swaggerOptions: {
        persistAuthorization: true,
      },
    }),
  );
};

module.exports = {
  swaggerDocs,
};
