/**
 * Jest setup file - runs before all tests
 * Mocks browser APIs and sets up test environment
 */

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => {
    localStorageMock.store[key] = String(value);
  }),
  removeItem: jest.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
  store: {}
};

global.localStorage = localStorageMock;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock Web Serial API
global.navigator.serial = {
  requestPort: jest.fn(),
  getPorts: jest.fn(() => Promise.resolve([]))
};

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock requestAnimationFrame for Three.js
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock performance.now()
global.performance = {
  now: jest.fn(() => Date.now())
};

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});
