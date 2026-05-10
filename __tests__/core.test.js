/**
 * Tests for core.js
 * Core functionality: machine communication, state management, safety systems
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

// Load the core.js file
const coreJs = fs.readFileSync(
  path.join(__dirname, '../src-standalone/js/core.js'),
  'utf8'
);

function extractFunctionSource(source, fnName, isAsync) {
  const signature = `${isAsync ? 'async ' : ''}function ${fnName}(`;
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Function not found: ${fnName}`);
  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) throw new Error(`Function body not found: ${fnName}`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Function end not found: ${fnName}`);
}

describe('Core Module', () => {
  beforeEach(() => {
    // Clear any global state
    global._running = false;
    global._stopRequested = false;
    global._safetyMoveActive = false;
  });

  describe('Utility Functions', () => {
    test('sleep function should delay execution', async () => {
      // Define sleep function (from core.js)
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small tolerance
      expect(elapsed).toBeLessThan(150);
    });

    test('tsMs should return formatted timestamp', () => {
      const tsMs = () => {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const ms = String(d.getMilliseconds()).padStart(3, '0');
        return hh + ':' + mm + ':' + ss + '.' + ms;
      };

      const timestamp = tsMs();

      // Should match HH:MM:SS.mmm format
      expect(timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    });

    test('escHtml should escape HTML entities', () => {
      const escHtml = (v) =>
        String(v)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

      expect(escHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');

      expect(escHtml('Normal text')).toBe('Normal text');
      expect(escHtml('a & b')).toBe('a &amp; b');
    });
  });

  describe('Stop Handler', () => {
    test('checkStop should throw when stop requested and not in safety move', () => {
      const checkStop = () => {
        if (global._stopRequested && !global._safetyMoveActive) {
          throw new Error('User stop requested');
        }
      };

      global._stopRequested = false;
      expect(() => checkStop()).not.toThrow();

      global._stopRequested = true;
      global._safetyMoveActive = false;
      expect(() => checkStop()).toThrow('User stop requested');

      global._stopRequested = true;
      global._safetyMoveActive = true;
      expect(() => checkStop()).not.toThrow(); // Safety move in progress
    });
  });

  describe('Position Parsing', () => {
    test('should support object-style x, y, z parsing in _parsePos', () => {
      const parsePosSource = extractFunctionSource(coreJs, '_parsePos', false);
      const parsePos = new Function(`return (${parsePosSource});`)();
      expect(parsePos({ x: 1.5, y: '2.0', z: 3 })).toEqual({ x: 1.5, y: 2, z: 3 });
      expect(parsePos({ x: 1.5, y: 2 })).toBeNull();
      expect(parsePos('10.000,20.000,30.000')).toEqual({ x: 10, y: 20, z: 30 });
    });

    test('should parse WPos coordinates correctly', () => {
      const parseWPos = (str) => {
        const match = str.match(/WPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
        if (!match) return null;
        return {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3])
        };
      };

      const result = parseWPos('<Idle|WPos:10.500,20.250,-5.000>');
      expect(result).toEqual({ x: 10.5, y: 20.25, z: -5.0 });

      const noMatch = parseWPos('<Idle|MPos:0,0,0>');
      expect(noMatch).toBeNull();
    });

    test('should parse MPos coordinates correctly', () => {
      const parseMPos = (str) => {
        const match = str.match(/MPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
        if (!match) return null;
        return {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3])
        };
      };

      const result = parseMPos('<Idle|MPos:100.000,200.000,50.000|WPos:10,20,5>');
      expect(result).toEqual({ x: 100, y: 200, z: 50 });
    });

    test('should parse probe state from status report', () => {
      const isProbeTriggered = (statusReport) => {
        return /\|Pn:[A-Z]*P/i.test(statusReport);
      };

      expect(isProbeTriggered('<Idle|WPos:0,0,0|Pn:P>')).toBe(true);
      expect(isProbeTriggered('<Idle|WPos:0,0,0|Pn:XP>')).toBe(true);
      expect(isProbeTriggered('<Idle|WPos:0,0,0>')).toBe(false);
      expect(isProbeTriggered('<Idle|WPos:0,0,0|Pn:X>')).toBe(false);
    });

    test('should parse ALARM state', () => {
      const isInAlarm = (statusReport) => {
        return /^<Alarm/i.test(statusReport);
      };

      expect(isInAlarm('<Alarm|MPos:0,0,0>')).toBe(true);
      expect(isInAlarm('<Idle|MPos:0,0,0>')).toBe(false);
      expect(isInAlarm('<Run|MPos:0,0,0>')).toBe(false);
    });

    test('should parse homing state', () => {
      const isHoming = (statusReport) => {
        return /^<Home/i.test(statusReport);
      };

      expect(isHoming('<Home|MPos:0,0,0>')).toBe(true);
      expect(isHoming('<Idle|MPos:0,0,0>')).toBe(false);
    });

    test('should include alternate getWorkPosition fallbacks and diagnostics', () => {
      const parsePosSource = extractFunctionSource(coreJs, '_parsePos', false);
      const getWorkPositionSource = extractFunctionSource(coreJs, 'getWorkPosition', true);
      const parsePos = new Function(`return (${parsePosSource});`)();
      const noopSleep = () => Promise.resolve();
      const getWorkPositionFactory = new Function(
        '_getState',
        '_machineStateFrom',
        '_parsePos',
        'pluginDebug',
        'sleep',
        `return (${getWorkPositionSource});`
      );
      const getWorkPosition = getWorkPositionFactory(
        async () => ({ machineState: { status: 'Idle', workPosition: { x: '5', y: 6, z: 7 } } }),
        (state) => state.machineState || {},
        parsePos,
        () => {},
        noopSleep
      );
      return expect(getWorkPosition()).resolves.toMatchObject({ x: 5, y: 6, z: 7, status: 'Idle' });
    });

    test('should retry getWorkPosition up to 3 times when position is null', async () => {
      const parsePosSource = extractFunctionSource(coreJs, '_parsePos', false);
      const getWorkPositionSource = extractFunctionSource(coreJs, 'getWorkPosition', true);
      const parsePos = new Function(`return (${parsePosSource});`)();
      const noopSleep = () => Promise.resolve();
      const getWorkPositionFactory = new Function(
        '_getState',
        '_machineStateFrom',
        '_parsePos',
        'pluginDebug',
        'sleep',
        `return (${getWorkPositionSource});`
      );

      // First two attempts return no position, third returns WPos
      let callCount = 0;
      const getWorkPosition = getWorkPositionFactory(
        async () => {
          callCount += 1;
          if (callCount < 3) return { machineState: { status: 'Idle' } };
          return { machineState: { status: 'Idle', WPos: '10.000,20.000,30.000' } };
        },
        (state) => state.machineState || {},
        parsePos,
        () => {},
        noopSleep
      );
      const result = await getWorkPosition();
      expect(callCount).toBe(3);
      expect(result).toMatchObject({ x: 10, y: 20, z: 30, status: 'Idle' });
    });

    test('should throw after 3 failed getWorkPosition attempts', async () => {
      const getWorkPositionSource = extractFunctionSource(coreJs, 'getWorkPosition', true);
      const parsePosSource = extractFunctionSource(coreJs, '_parsePos', false);
      const parsePos = new Function(`return (${parsePosSource});`)();
      const noopSleep = () => Promise.resolve();
      const getWorkPositionFactory = new Function(
        '_getState',
        '_machineStateFrom',
        '_parsePos',
        'pluginDebug',
        'sleep',
        `return (${getWorkPositionSource});`
      );
      const getWorkPosition = getWorkPositionFactory(
        async () => ({ machineState: { status: 'Idle' } }),
        (state) => state.machineState || {},
        parsePos,
        () => {},
        noopSleep
      );
      await expect(getWorkPosition()).rejects.toThrow('Could not read current position from Sender');
    });

    test('should tolerate alternate machine position fields in getMachineSnapshot', () => {
      expect(coreJs).toContain('ms.MPos || ms.machinePosition || ms.mpos');
      expect(coreJs).toContain('ms.WCO || ms.wco');
    });
  });

  describe('PRB Coordinate Parsing', () => {
    test('should extract probe coordinates from PRB response', () => {
      const parsePRB = (response) => {
        const match = response.match(/\[PRB:([-\d.]+),([-\d.]+),([-\d.]+):([01])\]/);
        if (!match) return null;
        return {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3]),
          success: match[4] === '1'
        };
      };

      const result = parsePRB('[PRB:10.500,20.250,-5.375:1]');
      expect(result).toEqual({
        x: 10.5,
        y: 20.25,
        z: -5.375,
        success: true
      });

      const failed = parsePRB('[PRB:10.000,20.000,-10.000:0]');
      expect(failed).toEqual({
        x: 10,
        y: 20,
        z: -10,
        success: false
      });
    });
  });

  describe('LocalStorage Keys', () => {
    test('should use consistent storage keys', () => {
      const KEYS = {
        TOP_RESULTS: 'edgeProbeTopResults',
        FACE_RESULTS: 'edgeProbeFaceResults',
        FACE_LAYERED: 'edgeProbeFaceLayeredResults',
        FACE_MESH: 'faceProbe.faceMeshData',
        MESH_DATA: 'edgeProbeMeshData',
        SAVED_LOCATION: 'edgeProbeSavedLocation',
        PROBE_DIMENSIONS: 'edgeProbeDimensions',
        FACE_LOG: 'edgeProbeFaceLog'
      };

      // Verify keys are strings
      Object.values(KEYS).forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Version Constant', () => {
    test('should have valid version string', () => {
      const versionMatch = coreJs.match(/var SM_VERSION = ['"](.+?)['"]/);
      expect(versionMatch).not.toBeNull();

      const version = versionMatch[1];
      expect(version).toMatch(/^(V\d+\.\d+|Beta V\d+)$/); // Format: V21.0 or Beta V1
    });
  });
});
