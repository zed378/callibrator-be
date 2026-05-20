/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.js",
    "**/tests/**/*.test.js",
    "**/tests/**/*.spec.js",
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
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transform: {},
  transformIgnorePatterns: ["/node_modules/(?!(uuid)/)"],
  moduleFileExtensions: ["js", "json"],
  testTimeout: 10000,
};
