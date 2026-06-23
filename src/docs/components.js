/**
 * Swagger Components
 *
 * Reusable component definitions for all API routes.
 * Imported by generateSwagger.js to build the central OpenAPI spec.
 *
 * To add a new component:
 *   1. Add to securitySchemes, schemas, parameters, etc. below
 *   2. Reference it in route files using $ref: '#/components/schemas/MySchema'
 */

module.exports = {
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      // ---------------------------------------------------------------
      // Generic Response Wrappers
      // ---------------------------------------------------------------
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          status: { type: "integer", example: 200 },
          message: { type: "string", example: "Success" },
          data: { type: "object" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          status: { type: "integer", example: 400 },
          message: { type: "string", example: "Error message" },
          errors: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      PaginatedResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          status: { type: "integer", example: 200 },
          message: { type: "string" },
          data: { type: "array" },
          pagination: {
            type: "object",
            properties: {
              page: { type: "integer", example: 1 },
              limit: { type: "integer", example: 20 },
              total: { type: "integer", example: 100 },
              totalPages: { type: "integer", example: 5 },
            },
          },
        },
      },

      // ---------------------------------------------------------------
      // Auth Schemas
      // ---------------------------------------------------------------
      RegisterRequest: {
        type: "object",
        required: ["firstName", "lastName", "username", "email", "password"],
        properties: {
          firstName: { type: "string", example: "John" },
          lastName: { type: "string", example: "Doe" },
          username: { type: "string", example: "johndoe" },
          email: { type: "string", format: "email", example: "user@example.com" },
          password: { type: "string", minLength: 6, example: "Secret123" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["user", "password"],
        properties: {
          user: { type: "string", description: "Username or email", example: "sys" },
          password: { type: "string", example: "123123" },
        },
      },
      SendOtpRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", example: "user@example.com" },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["email", "otp", "password"],
        properties: {
          email: { type: "string", format: "email" },
          otp: { type: "string" },
          password: { type: "string", minLength: 6 },
        },
      },

      // ---------------------------------------------------------------
      // User Schemas
      // ---------------------------------------------------------------
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          username: { type: "string" },
          email: { type: "string", format: "email" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          phone: { type: "string" },
          avatarUrl: { type: "string", format: "uri" },
          isActive: { type: "boolean" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },

      // ---------------------------------------------------------------
      // Role Schemas
      // ---------------------------------------------------------------
      Role: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          nameToShow: { type: "string" },
          description: { type: "string" },
          isSystem: { type: "boolean" },
          status: { type: "string" },
          sortOrder: { type: "integer" },
          roleLevel: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },

      // ---------------------------------------------------------------
      // Tenant Schemas
      // ---------------------------------------------------------------
      Tenant: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          subdomain: { type: "string" },
          email: { type: "string", format: "email" },
          domain: { type: "string" },
          plan: { type: "string", enum: ["free", "professional", "business", "enterprise"] },
          status: { type: "string", enum: ["active", "suspended", "deleted"] },
          trialEndsAt: { type: "string", format: "date-time" },
          settings: { type: "object" },
          limitSeats: { type: "integer" },
          limitStorageMb: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
};
