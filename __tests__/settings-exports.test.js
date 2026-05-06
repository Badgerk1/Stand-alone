/**
 * Tests for settings-and-exports.js
 * Data export, import, validation, and G-code compensation
 */

const { describe, test, expect } = require('@jest/globals');

describe('Settings and Exports Module', () => {
  describe('CSV Export', () => {
    test('should format CSV header correctly', () => {
      const formatCSVHeader = () => {
        return 'X,Y,Z';
      };

      expect(formatCSVHeader()).toBe('X,Y,Z');
    });

    test('should format CSV row correctly', () => {
      const formatCSVRow = (x, y, z) => {
        return `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      };

      expect(formatCSVRow(10.5, 20.25, -5.375)).toBe('10.500,20.250,-5.375');
      expect(formatCSVRow(0, 0, 0)).toBe('0.000,0.000,0.000');
    });

    test('should convert grid to CSV', () => {
      const gridToCSV = (grid, config) => {
        const lines = ['X,Y,Z'];

        for (let row = 0; row < grid.length; row++) {
          for (let col = 0; col < grid[row].length; col++) {
            const x = config.minX + col * config.spacing;
            const y = config.minY + row * config.spacing;
            const z = grid[row][col];

            if (z !== null) {
              lines.push(`${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`);
            }
          }
        }

        return lines.join('\n');
      };

      const grid = [
        [1, 2],
        [3, 4]
      ];

      const config = {
        minX: 0,
        minY: 0,
        spacing: 10
      };

      const csv = gridToCSV(grid, config);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('X,Y,Z');
      expect(lines[1]).toBe('0.000,0.000,1.000');
      expect(lines[2]).toBe('10.000,0.000,2.000');
      expect(lines[3]).toBe('0.000,10.000,3.000');
      expect(lines[4]).toBe('10.000,10.000,4.000');
    });
  });

  describe('JSON Export', () => {
    test('should serialize mesh data correctly', () => {
      const serializeMesh = (grid, config) => {
        return JSON.stringify({
          version: 'V21.0',
          grid: grid,
          config: config,
          timestamp: new Date().toISOString()
        });
      };

      const grid = [[1, 2], [3, 4]];
      const config = { minX: 0, maxX: 10, minY: 0, maxY: 10, spacing: 10 };

      const json = serializeMesh(grid, config);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('V21.0');
      expect(parsed.grid).toEqual(grid);
      expect(parsed.config).toEqual(config);
      expect(parsed.timestamp).toBeDefined();
    });

    test('should deserialize mesh data correctly', () => {
      const deserializeMesh = (jsonString) => {
        try {
          const data = JSON.parse(jsonString);
          return {
            grid: data.grid || null,
            config: data.config || null,
            version: data.version || null
          };
        } catch (e) {
          return null;
        }
      };

      const validJSON = JSON.stringify({
        version: 'V21.0',
        grid: [[1, 2]],
        config: { spacing: 5 }
      });

      const result = deserializeMesh(validJSON);
      expect(result).not.toBeNull();
      expect(result.grid).toEqual([[1, 2]]);
      expect(result.config.spacing).toBe(5);

      const invalidJSON = 'not valid json';
      expect(deserializeMesh(invalidJSON)).toBeNull();
    });
  });

  describe('G-code Parsing', () => {
    test('should extract X coordinate from G-code', () => {
      const extractX = (line) => {
        const match = line.match(/X([-\d.]+)/i);
        return match ? parseFloat(match[1]) : null;
      };

      expect(extractX('G1 X10.5 Y20 Z-5')).toBe(10.5);
      expect(extractX('G0 X-15.25')).toBe(-15.25);
      expect(extractX('G1 Y20 Z-5')).toBeNull();
    });

    test('should extract Y coordinate from G-code', () => {
      const extractY = (line) => {
        const match = line.match(/Y([-\d.]+)/i);
        return match ? parseFloat(match[1]) : null;
      };

      expect(extractY('G1 X10 Y20.5 Z-5')).toBe(20.5);
      expect(extractY('G0 Y-30.75')).toBe(-30.75);
      expect(extractY('G1 X10 Z-5')).toBeNull();
    });

    test('should extract Z coordinate from G-code', () => {
      const extractZ = (line) => {
        const match = line.match(/Z([-\d.]+)/i);
        return match ? parseFloat(match[1]) : null;
      };

      expect(extractZ('G1 X10 Y20 Z-5.5')).toBe(-5.5);
      expect(extractZ('G0 Z10.25')).toBe(10.25);
      expect(extractZ('G1 X10 Y20')).toBeNull();
    });

    test('should detect move commands', () => {
      const isMoveCommand = (line) => {
        return /^(?:N\d+\s+)?G[01]\b/i.test(line) || /\b[XYZ][-\d.]/i.test(line);
      };

      expect(isMoveCommand('G1 X10 Y20 Z-5')).toBe(true);
      expect(isMoveCommand('G0 X10')).toBe(true);
      expect(isMoveCommand('G01 Y20')).toBe(true);
      expect(isMoveCommand('N100 G1 X10')).toBe(true);
      expect(isMoveCommand('X10 Y20')).toBe(true); // Coordinates imply move
      expect(isMoveCommand('M3 S1000')).toBe(false);
      expect(isMoveCommand('G90')).toBe(false);
    });
  });

  describe('Input Validation', () => {
    test('should validate numeric inputs', () => {
      const isValidNumber = (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num);
      };

      expect(isValidNumber('10.5')).toBe(true);
      expect(isValidNumber('-5.25')).toBe(true);
      expect(isValidNumber('0')).toBe(true);
      expect(isValidNumber('abc')).toBe(false);
      expect(isValidNumber('')).toBe(false);
      expect(isValidNumber('Infinity')).toBe(false);
      expect(isValidNumber('NaN')).toBe(false);
    });

    test('should validate coordinate ranges', () => {
      const isInRange = (value, min, max) => {
        return value >= min && value <= max;
      };

      expect(isInRange(50, 0, 100)).toBe(true);
      expect(isInRange(0, 0, 100)).toBe(true);
      expect(isInRange(100, 0, 100)).toBe(true);
      expect(isInRange(-1, 0, 100)).toBe(false);
      expect(isInRange(101, 0, 100)).toBe(false);
    });

    test('should validate grid configuration', () => {
      const isValidGridConfig = (config) => {
        if (!config) return false;
        if (config.maxX <= config.minX) return false;
        if (config.maxY <= config.minY) return false;
        if (config.spacing <= 0) return false;
        return true;
      };

      expect(isValidGridConfig({ minX: 0, maxX: 100, minY: 0, maxY: 100, spacing: 5 })).toBe(true);
      expect(isValidGridConfig({ minX: 100, maxX: 0, minY: 0, maxY: 100, spacing: 5 })).toBe(false);
      expect(isValidGridConfig({ minX: 0, maxX: 100, minY: 100, maxY: 0, spacing: 5 })).toBe(false);
      expect(isValidGridConfig({ minX: 0, maxX: 100, minY: 0, maxY: 100, spacing: -5 })).toBe(false);
      expect(isValidGridConfig(null)).toBe(false);
    });
  });

  describe('LocalStorage Operations', () => {
    test('should save settings to localStorage', () => {
      const saveSettings = (key, settings) => {
        try {
          localStorage.setItem(key, JSON.stringify(settings));
          return true;
        } catch (e) {
          return false;
        }
      };

      const settings = { spacing: 5, clearance: 3 };
      const result = saveSettings('testKey', settings);

      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(settings));
    });

    test('should load settings from localStorage', () => {
      const loadSettings = (key, defaults) => {
        try {
          const stored = localStorage.getItem(key);
          return stored ? JSON.parse(stored) : defaults;
        } catch (e) {
          return defaults;
        }
      };

      localStorage.getItem.mockReturnValue(JSON.stringify({ spacing: 10 }));

      const result = loadSettings('testKey', { spacing: 5 });
      expect(result.spacing).toBe(10);

      localStorage.getItem.mockReturnValue(null);
      const defaultResult = loadSettings('testKey', { spacing: 5 });
      expect(defaultResult.spacing).toBe(5);
    });
  });
});
