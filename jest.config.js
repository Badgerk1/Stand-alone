module.exports = {
  // Use jsdom to simulate browser environment
  testEnvironment: 'jsdom',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src-standalone/js/**/*.js',
    '!src-standalone/js/layout-editor.js', // Skip minimal module
    '!**/node_modules/**'
  ],

  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

  // Module paths
  roots: ['<rootDir>'],

  // Transform files (if needed for ES6 modules)
  transform: {},

  // Verbose output
  verbose: true,

  // Timeout for async operations
  testTimeout: 10000
};
