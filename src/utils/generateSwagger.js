const path = require("path");
const fs = require("fs");

const swaggerJsdoc = require("swagger-jsdoc");

const outputProdPath = path.resolve(__dirname, "../../swagger.json");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Boilerplate API",

      version: "1.0.0",

      description: "Enterprise-grade Express.js API documentation",
    },

    servers: [
      {
        url: process.env.HOST_URL || "http://localhost:3000",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",

          scheme: "bearer",

          bearerFormat: "JWT",
        },
      },
    },
  },

  apis: [path.resolve(__dirname, "../routes/api/*.js")],
};

const swaggerSpec = swaggerJsdoc(options);

fs.writeFileSync(outputProdPath, JSON.stringify(swaggerSpec, null, 2));

console.log(`Swagger generated at ${outputProdPath}`);
