/**
 * Tests for session utility
 */
jest.mock("../../models", () => ({
  Sessions: {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
}));

const { hashToken, createSession, findSession, revokeSession, revokeAllUserSessions } = require("../../utils/session");
const { Sessions } = require("../../models");

describe("session utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("hashToken", () => {
    it("should return a SHA-256 hex string", () => {
      const hash = hashToken("some-token");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should return consistent hash for same token", () => {
      expect(hashToken("token1")).toBe(hashToken("token1"));
    });

    it("should return different hash for different tokens", () => {
      expect(hashToken("token1")).not.toBe(hashToken("token2"));
    });
  });

  describe("createSession", () => {
    it("should call Sessions.create with hashed token", async () => {
      Sessions.create.mockResolvedValue({ id: "session-1" });

      await createSession({
        userId: "user-1",
        token: "raw-token",
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        expiredAt: new Date("2026-12-31"),
      });

      expect(Sessions.create).toHaveBeenCalledWith({
        userId: "user-1",
        tokenHash: hashToken("raw-token"),
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        expiredAt: new Date("2026-12-31"),
        isRevoked: false,
      });
    });

    it("should default ipAddress and userAgent to null", async () => {
      Sessions.create.mockResolvedValue({ id: "session-2" });

      await createSession({
        userId: "user-2",
        token: "raw-token",
        expiredAt: new Date(),
      });

      expect(Sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: null,
          userAgent: null,
        }),
      );
    });
  });

  describe("findSession", () => {
    it("should find by sessionId when provided", async () => {
      Sessions.findOne.mockResolvedValue({ id: "session-1" });

      await findSession({ token: "tok", userId: "u1", sessionId: "s1" });

      expect(Sessions.findOne).toHaveBeenCalledWith({
        where: {
          isRevoked: false,
          id: "s1",
        },
      });
    });

    it("should find by token hash and userId when no sessionId", async () => {
      Sessions.findOne.mockResolvedValue({ id: "session-2" });

      await findSession({ token: "tok", userId: "u1" });

      expect(Sessions.findOne).toHaveBeenCalledWith({
        where: {
          isRevoked: false,
          tokenHash: hashToken("tok"),
          userId: "u1",
        },
      });
    });
  });

  describe("revokeSession", () => {
    it("should update session to revoked", async () => {
      Sessions.update.mockResolvedValue([1]);

      await revokeSession({ token: "tok", userId: "u1" });

      expect(Sessions.update).toHaveBeenCalledWith(
        { isRevoked: true },
        {
          where: {
            tokenHash: hashToken("tok"),
            userId: "u1",
          },
        },
      );
    });
  });

  describe("revokeAllUserSessions", () => {
    it("should revoke all sessions for a user", async () => {
      Sessions.update.mockResolvedValue([3]);

      await revokeAllUserSessions("user-1");

      expect(Sessions.update).toHaveBeenCalledWith(
        { isRevoked: true },
        {
          where: { userId: "user-1" },
        },
      );
    });
  });
});
