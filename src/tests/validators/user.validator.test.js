/**
 * User validator tests
 */
const {
  validate,
  formatErrors,
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  checkUsernameSchema,
} = require("../../validators/user.validator");

describe("User Validators", () => {
  describe("createUserSchema", () => {
    it("should validate correct user data", () => {
      const data = {
        tenantId: null,
        username: "johndoe",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "Password123",
        roleId: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c",
        createdBy: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c",
      };

      const { error } = validate(data, createUserSchema);

      expect(error).toBeUndefined();
    });

    it("should reject missing username", () => {
      const data = {
        firstName: "John",
        email: "john@example.com",
        password: "Password123",
        roleId: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c",
      };

      const { error } = validate(data, createUserSchema);

      expect(error).toBeDefined();
      expect(error.details[0].path).toContain("username");
    });

    it("should reject invalid UUID for roleId", () => {
      const data = {
        username: "johndoe",
        firstName: "John",
        email: "john@example.com",
        password: "Password123",
        roleId: "not-a-uuid",
      };

      const { error } = validate(data, createUserSchema);

      expect(error).toBeDefined();
      expect(error.details[0].path).toContain("roleId");
    });

    it("should allow null tenantId", () => {
      const data = {
        tenantId: null,
        username: "johndoe",
        firstName: "John",
        email: "john@example.com",
        password: "Password123",
        roleId: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c",
      };

      const { error } = validate(data, createUserSchema);

      expect(error).toBeUndefined();
    });
  });

  describe("updateUserRoleSchema", () => {
    it("should validate correct data", () => {
      const data = {
        userId: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9c",
        roleId: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9d",
        updatedBy: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9e",
      };

      const { error } = validate(data, updateUserRoleSchema);

      expect(error).toBeUndefined();
    });

    it("should reject missing userId", () => {
      const data = {
        roleId: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9d",
        updatedBy: "e7e1cdd1-14fe-440f-89ec-b0bcd7041f9e",
      };

      const { error } = validate(data, updateUserRoleSchema);

      expect(error).toBeDefined();
      expect(error.details[0].path).toContain("userId");
    });
  });

  describe("checkUsernameSchema", () => {
    it("should validate correct username", () => {
      const data = {
        username: "johndoe",
      };

      const { error } = validate(data, checkUsernameSchema);

      expect(error).toBeUndefined();
    });

    it("should reject empty username", () => {
      const data = {
        username: "",
      };

      const { error } = validate(data, checkUsernameSchema);

      expect(error).toBeDefined();
    });
  });

  describe("formatErrors", () => {
    it("should format error details correctly", () => {
      const details = [
        { path: ["username"], message: "Username is required" },
        { path: ["email"], message: "Invalid email" },
      ];

      const errors = formatErrors(details);

      expect(errors).toEqual([
        { field: "username", message: "Username is required" },
        { field: "email", message: "Invalid email" },
      ]);
    });
  });
});
