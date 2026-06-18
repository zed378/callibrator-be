/** @type {import('jest').Config} */
require("dotenv").config({ path: ".env" });

module.exports = {
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.js",
    "**/tests/**/*.test.js",
    "**/tests/**/*.spec.js",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/src/tests/services/tenantBackup.service.test.js",
    "<rootDir>/src/tests/middleware/auth.test.js",
    "<rootDir>/src/tests/controllers/auth.controller.test.js",
    "<rootDir>/src/tests/services/auth.service.test.js",
    "<rootDir>/src/tests/validators/user.validator.test.js",
  ],
  verbose: true,
  forceExit: false,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,
  collectCoverage: false,
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/tests/",
    "/__tests__/",
    "src/config/index.js",
    "src/docs/",
    "src/middlewares/createFolder.js",
    "src/utils/storagePath.js",
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 55,
      lines: 60,
      statements: 60,
    },
  },
  transform: {},
  transformIgnorePatterns: ["/node_modules/(?!(uuid)/)"],
  moduleFileExtensions: ["js", "json"],
  testTimeout: 10000,
};
