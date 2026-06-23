/**
 * Tests for password utility functions
 */
const { hashPassword, comparePassword } = require("../../utils/password");

describe("password utility", () => {
  describe("hashPassword", () => {
    it("should hash a password", async () => {
      const hashed = await hashPassword("mysecretpassword");
      expect(hashed).toBeDefined();
      expect(typeof hashed).toBe("string");
      expect(hashed).not.toBe("mysecretpassword");
      expect(hashed.startsWith("$2")).toBe(true);
    });

    it("should produce different hashes for the same password", async () => {
      const hash1 = await hashPassword("samepassword");
      const hash2 = await hashPassword("samepassword");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string password", async () => {
      const hashed = await hashPassword("");
      expect(hashed).toBeDefined();
      expect(typeof hashed).toBe("string");
    });
  });

  describe("comparePassword", () => {
    it("should return true for correct password", async () => {
      const hashed = await hashPassword("testpassword123");
      const result = await comparePassword("testpassword123", hashed);
      expect(result).toBe(true);
    });

    it("should return false for wrong password", async () => {
      const hashed = await hashPassword("correctpassword");
      const result = await comparePassword("wrongpassword", hashed);
      expect(result).toBe(false);
    });

    it("should handle empty strings", async () => {
      const hashed = await hashPassword("");
      const result = await comparePassword("", hashed);
      expect(result).toBe(true);
    });
  });
});
