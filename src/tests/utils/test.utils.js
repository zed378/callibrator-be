/**
 * Test utility functions
 * Provides mock helpers for Express requests/responses/next and Sequelize models.
 */

/**
 * Create a mock Express `res` object with chainable stubs.
 */
const createMockRes = (overrides = {}) => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  end: jest.fn().mockReturnThis(),
  ...overrides,
});

/**
 * Create a mock Express `req` object.
 */
const createMockReq = (overrides = {}) => ({
  body: overrides.body || {},
  query: overrides.query || {},
  params: overrides.params || {},
  headers: overrides.headers || {},
  user: overrides.user || null,
  ip: overrides.ip || "127.0.0.1",
  tenantId: overrides.tenantId || null,
  tenant: overrides.tenant || null,
  ...overrides,
});

/**
 * Create a mock `next` function.
 */
const createMockNext = () => jest.fn();

/**
 * Create a mock Sequelize model with common CRUD methods.
 */
const createMockModel = (overrides = {}) => ({
  findOne: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  count: jest.fn(),
  ...overrides,
});

/**
 * Create a mock Sequelize transaction.
 */
const createMockTransaction = () => ({
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
});

/**
 * Return a Promise that resolves after `ms` milliseconds.
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Return a mock function that rejects with the given error.
 */
const mockThrow = (error) => jest.fn().mockRejectedValue(error);

/**
 * Return a mock function that resolves with the given value.
 */
const mockResolve = (value) => jest.fn().mockResolvedValue(value);

module.exports = {
  createMockRes,
  createMockReq,
  createMockNext,
  createMockModel,
  createMockTransaction,
  wait,
  mockThrow,
  mockResolve,
};
