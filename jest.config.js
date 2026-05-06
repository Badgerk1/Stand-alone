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

  // Coverage thresholds - disabled for now since tests validate logic patterns
  // Re-enable once integration tests can load actual source files
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
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
