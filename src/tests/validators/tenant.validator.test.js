/**
 * Tenant validator tests
 */
const {
  validate,
  formatErrors,
  createTenantSchema,
  updateTenantSchema,
} = require("../../validators/tenant.validator");

describe("Tenant Validators", () => {
  describe("createTenantSchema", () => {
    it("should validate correct tenant data", () => {
      const data = {
        name: "Acme Corp",
        code: "acme",
        description: "A technology company",
        logo: "https://example.com/logo.png",
        status: "active",
        maxUsers: 50,
        createdBy: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c",
      };

      const { error } = validate(data, createTenantSchema);

      expect(error).toBeUndefined();
    });

    it("should accept minimal required data", () => {
      const data = {
        name: "Acme Corp",
        code: "acme",
      };

      const { error, value } = validate(data, createTenantSchema);

      expect(error).toBeUndefined();
      expect(value.status).toBe("ACTIVE");
      expect(value.maxUsers).toBe(10);
    });

    it("should reject missing name", () => {
      const data = {
        code: "acme",
      };

      const { error } = validate(data, createTenantSchema);

      expect(error).toBeDefined();
      expect(error.details[0].path).toContain("name");
    });

    it("should reject invalid status", () => {
      const data = {
        name: "Acme Corp",
        code: "acme",
        status: "invalid",
      };

      const { error } = validate(data, createTenantSchema);

      expect(error).toBeDefined();
      expect(error.details[0].path).toContain("status");
    });

    it("should allow null description", () => {
      const data = {
        name: "Acme Corp",
        code: "acme",
        description: null,
      };

      const { error } = validate(data, createTenantSchema);

      expect(error).toBeUndefined();
    });

    it("should accept null status and skip uppercase transformation", () => {
      const data = {
        name: "Acme Corp",
        code: "acme",
        status: null,
      };

      const { error, value } = validate(data, createTenantSchema);

      expect(error).toBeUndefined();
      expect(value.status).toBeNull();
    });
  });

  describe("updateTenantSchema", () => {
    it("should validate correct update data", () => {
      const data = {
        name: "Acme Corporation",
        status: "inactive",
        maxUsers: 100,
      };

      const { error } = validate(data, updateTenantSchema);

      expect(error).toBeUndefined();
    });

    it("should allow partial updates", () => {
      const data = {
        name: "Acme Corporation",
      };

      const { error } = validate(data, updateTenantSchema);

      expect(error).toBeUndefined();
    });

    it("should reject invalid status", () => {
      const data = {
        status: "invalid",
      };

      const { error } = validate(data, updateTenantSchema);

      expect(error).toBeDefined();
    });
  });

  describe("formatErrors", () => {
    it("should format error details correctly", () => {
      const details = [
        { path: ["name"], message: "Name is required" },
        { path: ["code"], message: "Code is required" },
      ];

      const errors = formatErrors(details);

      expect(errors).toEqual([
        { field: "name", message: "Name is required" },
        { field: "code", message: "Code is required" },
      ]);
    });
  });
});
