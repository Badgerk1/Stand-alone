// ── Web Serial Transport for Standalone Mode ─────────────────────────────────
//
// This file is appended AFTER all src/js/*.js files in the standalone build.
// JavaScript function declarations at the same scope level are resolved
// last-wins, so the definitions here silently replace the fetch-based versions
// from src/js/core.js:
//
//   sendCommand()                  → serial write + wait for 'ok'/'error'
//   _getState()                    → send '?' + parse GRBL status report
//   _trySafeStopEndpoints()        → send '!' feed-hold byte directly
//   requireStartupHomingPreflight()→ relaxed: GRBL doesn't expose homed state
//
// Everything else (probe math, visualization, settings, UI) is unchanged.
//
// DO NOT edit standalone.html directly — run build-standalone.sh instead.
// ─────────────────────────────────────────────────────────────────────────────

// ── Web Serial connection state ───────────────────────────────────────────────
var _wsPort      = null;
var _wsWriter    = null;
var _wsReader    = null;
var _wsConnected = false;
var _wsDecoder   = new TextDecoder();
var _wsEncoder   = new TextEncoder();

// Response queues (FIFO — GRBL responds in command order)
var _wsOkQueue     = []; // [{resolve, reject, _tid}] waiting for 'ok' or 'error'
var _wsStatusQueue = []; // [{resolve, reject, _tid}] waiting for '<…>' status line

// Last probe result received on a [PRB:x,y,z:n] line
var _wsProbeTriggered = false; // true when most recent [PRB:…:1] not yet consumed

// ── Connection UI injection ───────────────────────────────────────────────────
// Replaces the existing "Ready" span in #hdr-conn with a baud selector,
// a Connect/Disconnect button, and a live status indicator.
(function _wsInjectUI() {
  document.title = '3D Live Edge Probe — Standalone';
  var hdr = document.getElementById('hdr-conn');
  if (!hdr) return;
  hdr.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0';
  hdr.innerHTML =
    '<select id="ws-baud" title="Serial baud rate" style="background:#131824;color:var(--text);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font-size:12px">' +
      '<option value="115200" selected>115200</option>' +
      '<option value="230400">230400</option>' +
      '<option value="57600">57600</option>' +
      '<option value="38400">38400</option>' +
    '</select>' +
    '<button id="ws-connect-btn" onclick="wsToggleConnect()" ' +
      'style="background:#1b2740;border:1px solid var(--line);color:var(--text);' +
             'padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap">' +
      'Connect Serial' +
    '</button>' +
    '<span id="ws-status" style="font-size:12px;color:var(--muted);white-space:nowrap">&#9675; Not connected</span>';
})();

function _wsSetUI(connected) {
  var btn = document.getElementById('ws-connect-btn');
  var st  = document.getElementById('ws-status');
  if (btn) btn.textContent = connected ? 'Disconnect' : 'Connect Serial';
  if (st) {
    st.textContent = connected ? '\u25cf Connected' : '\u25cb Not connected';
    st.style.color = connected ? 'var(--good,#5fd38d)' : 'var(--muted)';
  }
}

// ── Public connection API (called from injected button) ───────────────────────
async function wsToggleConnect() {
  if (_wsConnected) { await wsDisconnect(); } else { await wsConnect(); }
}

async function wsConnect() {
  if (!navigator.serial) {
    setFooterStatus('Web Serial API not available — use Chrome or Edge 89+.', 'bad');
    return;
  }
  try {
    var baud = Number((document.getElementById('ws-baud') || {}).value) || 115200;
    var port = await navigator.serial.requestPort();
    await port.open({ baudRate: baud });
    _wsPort      = port;
    _wsWriter    = port.writable.getWriter();
    _wsReader    = port.readable.getReader();
    _wsConnected = true;
    _wsOkQueue     = [];
    _wsStatusQueue = [];
    _wsProbeTriggered = false;
    _wsReadLoop(); // fire-and-forget
    _wsSetUI(true);
    setFooterStatus('Serial connected at ' + baud + ' baud — sending soft reset\u2026', 'ok');
    // Ctrl-X soft reset — puts GRBL into a known idle state
    await _wsWriteRaw(new Uint8Array([0x18]));
    await sleep(1200);
    setFooterStatus('Serial connected \u2014 ready.', 'ok');
  } catch (e) {
    if (e.name !== 'NotSelectedError' && e.name !== 'AbortError') {
      setFooterStatus('Connect failed: ' + e.message, 'bad');
    }
    _wsConnected = false;
    _wsSetUI(false);
  }
}

async function wsDisconnect() {
  _wsConnected = false;
  _wsFlushQueues(new Error('Serial disconnected'));
  try { if (_wsReader) { _wsReader.cancel(); } } catch (_e) {}
  try { if (_wsWriter) { _wsWriter.releaseLock(); } } catch (_e) {}
  try { if (_wsPort)   { await _wsPort.close(); } } catch (_e) {}
  _wsReader = _wsWriter = _wsPort = null;
  _wsSetUI(false);
  setFooterStatus('Serial disconnected.', 'warn');
}

function _wsFlushQueues(err) {
  _wsOkQueue.forEach(function (r) { try { r.reject(err); } catch (_e) {} });
  _wsStatusQueue.forEach(function (r) { try { r.reject(err); } catch (_e) {} });
  _wsOkQueue     = [];
  _wsStatusQueue = [];
}

// ── Internal read loop ────────────────────────────────────────────────────────
async function _wsReadLoop() {
  var buf = '';
  while (_wsConnected && _wsReader) {
    try {
      var result = await _wsReader.read();
      if (result.done) break;
      buf += _wsDecoder.decode(result.value, { stream: true });
      var idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        var line = buf.slice(0, idx).replace(/\r$/, '').trim();
        buf = buf.slice(idx + 1);
        if (line) _wsHandleLine(line);
      }
    } catch (_e) {
      break;
    }
  }
  // Handle unexpected disconnect
  if (_wsConnected) {
    _wsConnected = false;
    _wsFlushQueues(new Error('Serial connection lost'));
    _wsReader = _wsWriter = _wsPort = null;
    _wsSetUI(false);
    setFooterStatus('Serial connection lost.', 'bad');
  }
}

function _wsHandleLine(line) {
  pluginDebug('[serial \u2190] ' + line);

  // GRBL status report  <Status|Key:Val|…>
  if (line.charAt(0) === '<') {
    var r = _wsStatusQueue.shift();
    if (r) { clearTimeout(r._tid); r.resolve(line); }
    return;
  }

  // Probe result  [PRB:x,y,z:1]
  if (line.charAt(0) === '[' && line.indexOf('PRB:') === 1) {
    var inner = line.slice(1, line.length - 1); // strip [ ]
    var colonIdx = inner.lastIndexOf(':');
    if (colonIdx >= 0 && inner.charAt(colonIdx + 1) === '1') {
      _wsProbeTriggered = true;
    }
    return;
  }

  // ok
  if (line === 'ok') {
    var r = _wsOkQueue.shift();
    if (r) { clearTimeout(r._tid); r.resolve(); }
    return;
  }

  // error:N
  if (line.toLowerCase().indexOf('error:') === 0) {
    var r = _wsOkQueue.shift();
    if (r) { clearTimeout(r._tid); r.reject(new Error(line)); }
    return;
  }

  // ALARM:N — reject all pending commands
  if (line.toUpperCase().indexOf('ALARM:') === 0) {
    var err = new Error('Machine in alarm state: ' + line);
    _wsOkQueue.forEach(function (r) { clearTimeout(r._tid); r.reject(err); });
    _wsOkQueue = [];
    return;
  }

  // Everything else (Grbl banner, [MSG:…], [GC:…], etc.) — informational only
  console.log('[serial] ' + line);
}

// ── Low-level write helpers ───────────────────────────────────────────────────
async function _wsWriteRaw(bytes) {
  if (!_wsWriter) throw new Error('Serial port not connected');
  await _wsWriter.write(bytes);
}

async function _wsWriteLine(text) {
  if (!_wsWriter) throw new Error('Serial port not connected');
  pluginDebug('[serial \u2192] ' + text);
  await _wsWriter.write(_wsEncoder.encode(text + '\n'));
}

// ── GRBL real-time command bytes (no 'ok' response generated) ─────────────────
var _WS_REALTIME = { '!': true, '~': true, '?': true, '\x18': true };

// ── Override: sendCommand ─────────────────────────────────────────────────────
async function sendCommand(gcode, timeoutMs) {
  if (!_wsConnected) {
    throw new Error('Serial port not connected. Click \u201cConnect Serial\u201d in the header.');
  }
  var ms = (timeoutMs != null) ? timeoutMs : 15000;
  pluginDebug('sendCommand: ' + gcode);
  console.log('[' + tsMs() + '] SEND: ' + gcode);

  // Real-time single-character commands are sent raw; GRBL never echoes an 'ok'
  if (_WS_REALTIME[gcode]) {
    await _wsWriteRaw(_wsEncoder.encode(gcode));
    return {};
  }

  var okPromise = new Promise(function (resolve, reject) {
    var tid = setTimeout(function () {
      // Remove from queue on timeout
      for (var i = 0; i < _wsOkQueue.length; i++) {
        if (_wsOkQueue[i]._tid === tid) { _wsOkQueue.splice(i, 1); break; }
      }
      reject(new Error('sendCommand timed out after ' + ms + 'ms for: ' + gcode));
    }, ms);
    _wsOkQueue.push({ resolve: resolve, reject: reject, _tid: tid });
  });

  await _wsWriteLine(gcode);
  await okPromise;
  console.log('[' + tsMs() + '] DONE: ' + gcode);
  return {};
}

// ── Override: _getState ───────────────────────────────────────────────────────
async function _getState() {
  if (!_wsConnected) {
    return { machineState: { status: 'Disconnected' } };
  }

  var statusPromise = new Promise(function (resolve, reject) {
    var tid = setTimeout(function () {
      for (var i = 0; i < _wsStatusQueue.length; i++) {
        if (_wsStatusQueue[i]._tid === tid) { _wsStatusQueue.splice(i, 1); break; }
      }
      reject(new Error('Status query timed out'));
    }, 3000);
    _wsStatusQueue.push({ resolve: resolve, reject: reject, _tid: tid });
  });

  try {
    await _wsWriteRaw(_wsEncoder.encode('?'));
  } catch (e) {
    return { machineState: { status: 'Unknown' } };
  }

  var line;
  try {
    line = await statusPromise;
  } catch (_e) {
    pluginDebug('_getState: status query timed out');
    return { machineState: { status: 'Unknown' } };
  }

  var ms = _wsParseStatus(line);

  // Inject probe-triggered flag from the last [PRB:…:1] line (consumed once)
  if (_wsProbeTriggered) {
    _wsProbeTriggered = false;
    if (!ms.Pn) {
      ms.Pn = 'P';
    } else if (ms.Pn.indexOf('P') < 0) {
      ms.Pn += 'P';
    }
  }

  pluginDebug('_getState: status=' + ms.status +
    ' WPos=' + (ms.WPos || '') + ' MPos=' + (ms.MPos || '') +
    ' Pn=' + (ms.Pn || ''));
  return { machineState: ms };
}

// Parses a GRBL status report line into a machineState object.
// Handles both <Status|WPos:x,y,z|…> and <Status|MPos:x,y,z|WCO:x,y,z|…> formats.
function _wsParseStatus(line) {
  var ms = {};
  // Strip surrounding < >
  var inner = line.replace(/^<|>$/g, '');
  var parts = inner.split('|');
  ms.status = (parts[0] || 'Unknown').trim();
  for (var i = 1; i < parts.length; i++) {
    var colon = parts[i].indexOf(':');
    if (colon < 0) continue;
    var key = parts[i].slice(0, colon).trim();
    var val = parts[i].slice(colon + 1).trim();
    switch (key) {
      case 'MPos': ms.MPos = val; break;
      case 'WPos': ms.WPos = val; break;
      case 'WCO':  ms.WCO  = val; break;
      case 'Pn':   ms.Pn   = val; break;
      case 'Bf':   ms.Bf   = val; break;
      case 'Ln':   ms.Ln   = val; break;
      case 'F':    ms.feedRate = Number(val); break;
      case 'FS':
        var fs = val.split(',');
        ms.feedRate     = Number(fs[0]);
        ms.spindleSpeed = Number(fs[1]);
        break;
      case 'Ov':
        var ov = val.split(',');
        ms.feedrateOverride  = Number(ov[0]);
        ms.rapidOverride     = Number(ov[1]);
        ms.spindleOverride   = Number(ov[2]);
        break;
    }
  }
  return ms;
}

// ── Override: _trySafeStopEndpoints ──────────────────────────────────────────
// After a feed-hold (!) has already been sent by stopNowAndSafeHome, this
// override sends a GRBL soft reset (Ctrl-X / 0x18) to discard the motion buffer
// and return the controller to Idle.  A feed hold alone leaves the machine in
// Hold indefinitely — only Ctrl-X or ~ can clear it, and ~ would resume buffered
// moves (unsafe after a user Stop).  After the reset we wait 1.2 s to match the
// standard GRBL startup time before the caller starts polling for state.
async function _trySafeStopEndpoints(label) {
  try {
    pluginDebug((label || 'STOP') + ': sending soft reset (0x18) to discard buffer via serial');
    await _wsWriteRaw(new Uint8Array([0x18]));
    // Give GRBL time to restart before the caller polls for state.
    await sleep(1200);
    return true;
  } catch (e) {
    pluginDebug((label || 'STOP') + ': serial write error: ' + e.message);
    return false;
  }
}

// ── Override: requireStartupHomingPreflight ───────────────────────────────────
// GRBL does not report homed state in the real-time status report, so the
// original homed-check would always block. This override skips that check while
// still guarding against ALARM and pre-triggered probe states.
async function requireStartupHomingPreflight(runLabel) {
  pluginDebug('requireStartupHomingPreflight (standalone) ENTER');
  if (!_wsConnected) {
    throw new Error('Serial port not connected. Click \u201cConnect Serial\u201d in the header.');
  }
  var info = await getMachineSnapshot();
  updateMachineHelperUI(info);
  var label = runLabel || 'probe run';
  if (_isAlarmStatus(info.status)) {
    throw new Error('Controller is in ALARM. Reset/unlock and home before ' + label + '.');
  }
  if (info.probeTriggered) {
    throw new Error('Probe input is already triggered. Clear the probe before ' + label + '.');
  }
  pluginDebug('requireStartupHomingPreflight (standalone) OK: status=' + info.status);
  var note = '(standalone \u2014 homed check skipped; ensure machine is homed before probing)';
  logLine('top',  'Preflight OK: status=' + (info.status || 'Unknown') + ', probe=open ' + note);
  logLine('face', 'Preflight OK: status=' + (info.status || 'Unknown') + ', probe=open ' + note);
  // Non-blocking override warnings (same as original)
  var _warns = [];
  if (typeof info.feedOverridePct   === 'number' && info.feedOverridePct   !== 100) _warns.push('Feed override is '    + info.feedOverridePct   + '%.');
  if (typeof info.rapidOverridePct  === 'number' && info.rapidOverridePct  !== 100) _warns.push('Rapid override is '   + info.rapidOverridePct  + '%.');
  if (typeof info.spindleOverridePct=== 'number' && info.spindleOverridePct!== 100) _warns.push('Spindle override is ' + info.spindleOverridePct + '%.');
  if (_warns.length > 0) {
    var _warnMsg = 'WARNING: ' + _warns.join(' ');
    pluginDebug('requireStartupHomingPreflight (standalone) OVERRIDE WARNING: ' + _warnMsg);
    logLine('top',  _warnMsg);
    logLine('face', _warnMsg);
    if (typeof outlineAppendLog === 'function') outlineAppendLog(_warnMsg);
    setFooterStatus(_warnMsg, 'warn');
  }
  return info;
}
