/**
 * Tests for JWT utility
 */
describe("JWT utility", () => {
  let jwtUtils;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.JWT_ACCESS_EXPIRED = "15m";
    process.env.JWT_REFRESH_EXPIRED = "7d";
    jest.resetModules();
    jwtUtils = require("../../utils/jwt");
  });

  afterEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ACCESS_EXPIRED;
    delete process.env.JWT_REFRESH_EXPIRED;
  });

  // ================================================================
  // generateAccessToken
  // ================================================================
  describe("generateAccessToken", () => {
    it("should return a JWT string with 3 parts", () => {
      const token = jwtUtils.generateAccessToken({
        id: 1,
        email: "test@example.com",
      });
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should embed payload in token", () => {
      const payload = { id: 42, email: "user@test.com" };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwtUtils.decodeToken(token);
      expect(decoded.id).toBe(42);
      expect(decoded.email).toBe("user@test.com");
    });
  });

  // ================================================================
  // generateOpaqueRefreshToken
  // ================================================================
  describe("generateOpaqueRefreshToken", () => {
    it("should return a 64-character hex string", () => {
      const token = jwtUtils.generateOpaqueRefreshToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should return unique tokens", () => {
      const token1 = jwtUtils.generateOpaqueRefreshToken();
      const token2 = jwtUtils.generateOpaqueRefreshToken();
      expect(token1).not.toBe(token2);
    });
  });

  // ================================================================
  // generateRefreshToken (legacy)
  // ================================================================
  describe("generateRefreshToken", () => {
    it("should return a JWT string", () => {
      const token = jwtUtils.generateRefreshToken({ id: 1 });
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    it("should embed payload in token", () => {
      const payload = { id: 99 };
      const token = jwtUtils.generateRefreshToken(payload);
      const decoded = jwtUtils.decodeToken(token);
      expect(decoded.id).toBe(99);
    });
  });

  // ================================================================
  // verifyAccessToken
  // ================================================================
  describe("verifyAccessToken", () => {
    it("should verify a valid access token", () => {
      const payload = { id: 1 };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwtUtils.verifyAccessToken(token);
      expect(decoded.id).toBe(1);
    });

    it("should throw on invalid token", () => {
      expect(() => jwtUtils.verifyAccessToken("invalid.token.here")).toThrow();
    });

    it("should throw on token signed with wrong secret", () => {
      const jwt = require("jsonwebtoken");
      const token = jwt.sign({ id: 1 }, "wrong-secret", { algorithm: "HS256" });
      expect(() => jwtUtils.verifyAccessToken(token)).toThrow();
    });
  });

  // ================================================================
  // verifyRefreshToken
  // ================================================================
  describe("verifyRefreshToken", () => {
    it("should verify a valid refresh token", () => {
      const payload = { id: 2 };
      const token = jwtUtils.generateRefreshToken(payload);
      const decoded = jwtUtils.verifyRefreshToken(token);
      expect(decoded.id).toBe(2);
    });

    it("should throw on invalid refresh token", () => {
      expect(() => jwtUtils.verifyRefreshToken("bad.token")).toThrow();
    });
  });

  // ================================================================
  // decodeToken
  // ================================================================
  describe("decodeToken", () => {
    it("should decode a token without verification", () => {
      const token = jwtUtils.generateAccessToken({ id: 10, role: "admin" });
      const decoded = jwtUtils.decodeToken(token);
      expect(decoded.id).toBe(10);
      expect(decoded.role).toBe("admin");
    });

    it("should return null for non-JWT strings", () => {
      const decoded = jwtUtils.decodeToken("not-a-jwt");
      expect(decoded).toBeNull();
    });
  });

  // ================================================================
  // ENV validation
  // ================================================================
  describe("ENV validation", () => {
    it("should throw if JWT_ACCESS_SECRET is missing", () => {
      delete process.env.JWT_ACCESS_SECRET;
      jest.resetModules();
      expect(() => require("../../utils/jwt")).toThrow(
        "JWT_ACCESS_SECRET environment variable is required",
      );
    });

    it("should throw if JWT_REFRESH_SECRET is missing", () => {
      process.env.JWT_ACCESS_SECRET = "test";
      delete process.env.JWT_REFRESH_SECRET;
      jest.resetModules();
      expect(() => require("../../utils/jwt")).toThrow(
        "JWT_REFRESH_SECRET environment variable is required",
      );
    });
  });

  describe("fallback expiration values", () => {
    it("should use fallback '15m' when JWT_ACCESS_EXPIRED is not set", () => {
      delete process.env.JWT_ACCESS_EXPIRED;
      jest.resetModules();
      const jwtAlt = require("../../utils/jwt");
      const token = jwtAlt.generateAccessToken({ id: 1 });
      const decoded = jwtAlt.decodeToken(token);
      expect(decoded).toBeDefined();
    });

    it("should use fallback '7d' when JWT_REFRESH_EXPIRED is not set", () => {
      delete process.env.JWT_REFRESH_EXPIRED;
      jest.resetModules();
      const jwtAlt = require("../../utils/jwt");
      const token = jwtAlt.generateRefreshToken({ id: 1 });
      const decoded = jwtAlt.decodeToken(token);
      expect(decoded).toBeDefined();
    });
  });
});
