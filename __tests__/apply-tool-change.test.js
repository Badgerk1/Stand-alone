/**
 * @jest-environment jsdom
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const toolChangeSource = fs.readFileSync(
  path.join(repoRoot, 'src-standalone/js/tool-change-helper.js'),
  'utf8'
);
const uiHelpersSource = fs.readFileSync(
  path.join(repoRoot, 'src-standalone/js/ui-helpers.js'),
  'utf8'
);
const probeEngineSource = fs.readFileSync(
  path.join(repoRoot, 'src-standalone/js/probe-engine.js'),
  'utf8'
);
const coreSource = fs.readFileSync(
  path.join(repoRoot, 'src-standalone/js/core.js'),
  'utf8'
);
const configBodySource = fs.readFileSync(
  path.join(repoRoot, 'src-standalone/config-body.html'),
  'utf8'
);

describe('Apply tab logging and tool-change depth wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tool-change-status"></div>
      <div id="tool-change-ref-display"></div>
      <button id="tool-change-move-btn"></button>
      <button id="tool-change-return-btn"></button>
      <div id="workflow-step4">&#9744; Step 4</div>
      <input id="outlineProbeFeed" value="250">
      <select id="outlineSurfProbeDepthMode">
        <option value="auto" selected>auto</option>
        <option value="custom">custom</option>
      </select>
      <input id="outlineMachineZTravel" value="165">
      <input id="outlineSurfRefMaxPlunge" value="200">
    `;
    localStorage.clear();
  });

  test('toolChangeReturnAndReZero uses outline auto depth and shows it in confirm text', async () => {
    const commands = [];
    const snapshots = [
      { probeTriggered: false },
      { probeTriggered: true }
    ];
    let confirmMessage = '';

    const sandbox = {
      document,
      localStorage,
      console,
      alert: jest.fn(),
      confirm: (msg) => { confirmMessage = msg; return true; },
      pluginDebug: jest.fn(),
      setFooterStatus: jest.fn(),
      getSettingsFromUI: () => ({ probeFeed: 100, travelFeedRate: 600, machineSafeTopZ: 160 }),
      requireStartupHomingPreflight: async () => {},
      sendCommand: async (cmd) => { commands.push(cmd); },
      sleep: async () => {},
      _waitForIdleOrStop: async () => {},
      getMachineSnapshot: async () => snapshots.shift(),
      window,
      setTimeout,
      clearTimeout
    };

    vm.createContext(sandbox);
    vm.runInContext(toolChangeSource, sandbox);
    sandbox._toolChangeRefPos = { x: 10, y: 20, z: 5 };

    await sandbox.toolChangeReturnAndReZero();

    expect(confirmMessage).toContain('max plunge 160.000mm');
    expect(confirmMessage).toContain('Surface search depth: Auto — machineZTravel=165, effective=160mm');
    expect(commands).toContain('G38.2 Z-160.000 F250');
  });

  test('tool-change helper clamps custom outline depth to available machine travel', () => {
    document.getElementById('outlineSurfProbeDepthMode').value = 'custom';

    const sandbox = {
      document,
      localStorage,
      console,
      alert: jest.fn(),
      confirm: jest.fn(),
      pluginDebug: jest.fn(),
      setFooterStatus: jest.fn(),
      window,
      setTimeout,
      clearTimeout
    };

    vm.createContext(sandbox);
    vm.runInContext(toolChangeSource, sandbox);

    const resolved = sandbox._toolChangeResolveSurfaceSearchDepth({ probeFeed: 100 });

    expect(resolved.maxPlunge).toBe(160);
    expect(resolved.depthSummary).toBe('Surface search depth: Custom — 200mm (clamped to 160mm)');
  });

  test('source files include unified Apply log helpers and wiring', () => {
    expect(uiHelpersSource).toMatch(/function applyLog\(msg\)/);
    expect(uiHelpersSource).toMatch(/function applyDownloadLog\(\)/);
    expect(uiHelpersSource).toMatch(/function applyClearLog\(\)/);
    expect(uiHelpersSource).toMatch(/applyLog\('\[SURFACE\] ' \+ msg\);/);
    expect(uiHelpersSource).toMatch(/applyLog\('\[FACE\] ' \+ msg\);/);
    expect(uiHelpersSource).toMatch(/Downloaded compensated ' \+ type \+ ' G-code/);
    expect(uiHelpersSource).toMatch(/Sending ' \+ type \+ ' G-code to ncSender\.\.\./);

    expect(probeEngineSource).toMatch(/Loading G-code from ncSender\.\.\./);
    expect(probeEngineSource).toMatch(/Analyzing loaded G-code bounds\.\.\./);
    expect(probeEngineSource).toMatch(/Starting surface compensation:/);
    expect(probeEngineSource).toMatch(/Starting face compensation:/);

    expect(coreSource).toMatch(/Loaded G-code file: ' \+ file\.name \+ ' \('/);
    expect(configBodySource).toContain('id="apply-unified-log"');
    expect(configBodySource).toContain('onclick="applyDownloadLog()"');
    expect(configBodySource).toContain('onclick="applyClearLog()"');
  });
});
