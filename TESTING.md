# Testing Guide

## Overview

This repository now includes a comprehensive testing infrastructure using Jest. The tests cover core functionality, probe operations, data management, and more.

## Running Tests

### Prerequisites

First, install the dependencies:

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

Automatically re-run tests when files change:

```bash
npm run test:watch
```

### Run Tests with Coverage

Generate a coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser to view detailed coverage.

### Run Tests with Verbose Output

```bash
npm run test:verbose
```

## Test Structure

```
__tests__/
├── setup.js                    # Jest configuration and mocks
├── helpers/
│   └── mock-grbl.js           # Mock GRBL controller for testing
├── core.test.js               # Tests for core.js
├── probe-engine.test.js       # Tests for probe-engine.js
└── settings-exports.test.js   # Tests for settings-and-exports.js
```

## Writing New Tests

### Example Test File

```javascript
const { describe, test, expect } = require('@jest/globals');

describe('My Module', () => {
  test('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Using Mocks

The test environment includes mocks for:
- `localStorage` - Browser storage API
- `Web Serial API` - USB serial communication
- `WebSocket` - Network communication
- `requestAnimationFrame` - Animation timing
- `console` methods - Reduces test output noise

### Mock GRBL Controller

Use the `MockGRBL` helper to simulate controller responses:

```javascript
const MockGRBL = require('./__tests__/helpers/mock-grbl');

test('probe operation', () => {
  const grbl = new MockGRBL();
  grbl.moveTo(10, 20, 5);

  const status = grbl.getStatusReport();
  expect(status).toContain('WPos:10.000,20.000,5.000');

  const probeResult = grbl.probe(10);
  expect(probeResult).toMatch(/\[PRB:.*:1\]/);
});
```

## Current Test Coverage

### Covered Areas

✅ **Core Module**
- Utility functions (sleep, timestamp, HTML escaping)
- Stop handler logic
- Position parsing (WPos, MPos, PRB)
- Probe state detection
- ALARM state detection
- LocalStorage keys
- Version validation

✅ **Probe Engine**
- Grid configuration calculations
- Serpentine path generation
- Bilinear interpolation
- Coordinate calculations
- Maximum/minimum Z finding
- Progress tracking
- Timing estimation

✅ **Settings & Exports**
- CSV export formatting
- JSON serialization/deserialization
- G-code coordinate extraction
- Move command detection
- Input validation
- Grid configuration validation
- LocalStorage operations

### Areas for Expansion

The following areas need additional test coverage:

- **Integration tests** - End-to-end probe workflows
- **Transport layer tests** - Web Serial and WebSocket communication
- **UI component tests** - Form validation, button states
- **Visualization tests** - Three.js rendering (can use snapshots)
- **Face probe tests** - Layered depth scanning
- **Outline probe tests** - Perimeter detection strategies
- **Error recovery tests** - ALARM handling, retry logic

## Continuous Integration

Tests run automatically on GitHub Actions for:
- All pushes to `main` branch
- All pushes to `claude/*` branches
- All pull requests to `main`

The CI pipeline runs tests on Node.js 18.x and 20.x.

## Coverage Goals

Current targets:
- **Lines:** 50%+
- **Branches:** 50%+
- **Functions:** 50%+
- **Statements:** 50%+

These thresholds are enforced in `jest.config.js`.

## Troubleshooting

### Tests fail with "Cannot find module"

Make sure dependencies are installed:
```bash
npm install
```

### Tests timeout

Increase timeout in `jest.config.js`:
```javascript
testTimeout: 30000  // 30 seconds
```

### Mock not working

Check that mocks are defined in `__tests__/setup.js` before tests run.

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Maintain or improve coverage percentages
5. Add integration tests for complex workflows

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [JSDOM Documentation](https://github.com/jsdom/jsdom)
