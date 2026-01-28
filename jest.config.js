/** Jest config for ayncor-e2e. Runs against running services (identity, core, realtime-gateway). */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/e2e/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  testTimeout: 30000,
  verbose: true
};
