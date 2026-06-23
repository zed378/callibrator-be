/**
 * Tests for OTP utility
 */
const { generateOTP, hashOTP } = require("../../utils/otp");

describe("OTP utility", () => {
  describe("generateOTP", () => {
    it("should return a 6-digit string", () => {
      const otp = generateOTP();
      expect(typeof otp).toBe("string");
      expect(otp.length).toBe(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("should return a number between 100000 and 999999", () => {
      for (let i = 0; i < 100; i++) {
        const otp = parseInt(generateOTP(), 10);
        expect(otp).toBeGreaterThanOrEqual(100000);
        expect(otp).toBeLessThanOrEqual(999999);
      }
    });

    it("should generate different OTPs", () => {
      const otps = new Set();
      for (let i = 0; i < 50; i++) {
        otps.add(generateOTP());
      }
      expect(otps.size).toBeGreaterThan(1);
    });
  });

  describe("hashOTP", () => {
    it("should return a SHA-256 hex string (64 chars)", () => {
      const hash = hashOTP("123456");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should return consistent hash for same input", () => {
      const hash1 = hashOTP("123456");
      const hash2 = hashOTP("123456");
      expect(hash1).toBe(hash2);
    });

    it("should return different hash for different input", () => {
      const hash1 = hashOTP("123456");
      const hash2 = hashOTP("654321");
      expect(hash1).not.toBe(hash2);
    });
  });
});
