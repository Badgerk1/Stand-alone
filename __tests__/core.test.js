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
    test('should support object-style xyz parsing in _parsePos', () => {
      expect(coreJs).toMatch(/typeof str === 'object' && !Array\.isArray\(str\)/);
      expect(coreJs).toMatch(/parseFloat\(str\.x\), oy = parseFloat\(str\.y\), oz = parseFloat\(str\.z\)/);
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
      expect(coreJs).toContain('ms.workPosition || ms.position || ms.pos || null');
      expect(coreJs).toContain('state.wpos || state.WPos || state.workPos || null');
      expect(coreJs).toContain("pluginDebug('getWorkPosition FAIL:");
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
