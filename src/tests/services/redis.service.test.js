// Mock ioredis first
const mockRedis = {
  connected: true,
  connect: jest.fn().mockResolvedValue(undefined),
  status: "ready",
  get: jest.fn(),
  setex: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(["0", []]),
  set: jest.fn().mockResolvedValue("OK"),
  eval: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock("ioredis", () => jest.fn(() => mockRedis));
jest.mock("../../middlewares/activityLog", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const {
  initRedis,
  getRedisConnection,
  get,
  set,
  del,
  delPattern,
  acquireLock,
  releaseLock,
  cacheKeys,
  closeRedis,
} = require("../../services/redis.service");

describe("redis.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.connect.mockResolvedValue(undefined);
    mockRedis.status = "ready";
    mockRedis.connected = true;
    // Reset singleton state
    jest.resetModules();
  });

  describe("initRedis", () => {
    it("should initialize and return connection", async () => {
      const result = await initRedis();
      expect(result).toBe(mockRedis);
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it("should return null on connection failure", async () => {
      mockRedis.connect.mockRejectedValue(new Error("ECONNREFUSED"));
      const result = await initRedis();
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getRedisConnection", () => {
    it("should return the redis client", async () => {
      await initRedis();
      const { getRedisConnection } = require("../../services/redis.service");
      const conn = getRedisConnection();
      expect(conn).toBeDefined();
      expect(conn).toBe(mockRedis);
    });
  });

  describe("get", () => {
    it("should return parsed JSON from cache", async () => {
      mockRedis.get.mockResolvedValue('{"foo":"bar"}');
      const result = await get("test:key");
      expect(result).toEqual({ foo: "bar" });
    });

    it("should return raw string when not JSON", async () => {
      mockRedis.get.mockResolvedValue("plain-text");
      const result = await get("test:key");
      expect(result).toBe("plain-text");
    });

    it("should return null when key not found", async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await get("missing:key");
      expect(result).toBeNull();
    });

    it("should return null when client is not connected", async () => {
      mockRedis.connected = false;
      const result = await get("test:key");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("should set a JSON value with TTL", async () => {
      const result = await set("test:key", { foo: "bar" }, 600);
      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith("test:key", 600, '{"foo":"bar"}');
    });

    it("should set a plain string value", async () => {
      const result = await set("test:key", "hello", 300);
      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith("test:key", 300, "hello");
    });

    it("should return false when client is not connected", async () => {
      mockRedis.connected = false;
      const result = await set("test:key", "value");
      expect(result).toBe(false);
    });
  });

  describe("del", () => {
    it("should delete a key", async () => {
      const result = await del("test:key");
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith("test:key");
    });

    it("should return false when not connected", async () => {
      mockRedis.connected = false;
      const result = await del("test:key");
      expect(result).toBe(false);
    });
  });

  describe("delPattern", () => {
    it("should delete matching keys", async () => {
      mockRedis.scan.mockResolvedValueOnce(["0", ["key1", "key2"]]);
      const result = await delPattern("prefix:*");
      expect(result).toBe(2);
      expect(mockRedis.del).toHaveBeenCalledWith("key1", "key2");
    });

    it("should return 0 when no keys match", async () => {
      mockRedis.scan.mockResolvedValueOnce(["0", []]);
      const result = await delPattern("prefix:*");
      expect(result).toBe(0);
    });
  });

  describe("acquireLock", () => {
    it("should acquire lock successfully", async () => {
      mockRedis.set.mockResolvedValue("OK");
      const result = await acquireLock("resource:1", 5000);
      expect(result).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        "lock:resource:1",
        expect.any(String),
        "EX",
        5,
        "NX",
      );
    });

    it("should return null if lock is already held", async () => {
      mockRedis.set.mockResolvedValue(null);
      const result = await acquireLock("resource:1", 5000);
      expect(result).toBeNull();
    });
  });

  describe("releaseLock", () => {
    it("should release lock successfully", async () => {
      const lockId = "lock-123";
      const result = await releaseLock("resource:1", lockId);
      expect(result).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it("should return false if lock id mismatch", async () => {
      mockRedis.eval.mockResolvedValue(0);
      const result = await releaseLock("resource:1", "wrong-id");
      expect(result).toBe(false);
    });
  });

  describe("cacheKeys", () => {
    it("should build correct user key", () => {
      expect(cacheKeys.user("user-1")).toBe("user:user-1");
    });

    it("should build correct userByEmail key", () => {
      expect(cacheKeys.userByEmail("test@example.com")).toBe("user:email:test@example.com");
    });

    it("should build correct tenant key", () => {
      expect(cacheKeys.tenant("tenant-1")).toBe("user:tenant-1");
    });

    it("should build correct rate limit key", () => {
      expect(cacheKeys.rateLimit("192.168.1.1")).toBe("ratelimit:192.168.1.1");
    });

    it("should build correct lock key", () => {
      expect(cacheKeys.lock("resource")).toBe("lock:resource");
    });

    it("should build correct session key", () => {
      expect(cacheKeys.session("hash123")).toBe("session:hash123");
    });
  });

  describe("closeRedis", () => {
    it("should close connection", async () => {
      await closeRedis();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
