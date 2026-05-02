var SM_VERSION = 'V21.0';
// ── State ─────────────────────────────────────────────────────────────────────
var _running = false;
var _stopRequested = false;
var _safetyMoveActive = false; // set true during stop handler's retract/home phase
var _runGeneration = 0;        // incremented on each stop; async ops compare to detect stale work
var _stopInProgress = false;   // guard against overlapping stop sequences (double-click)
var _unlockPollActive = false; // guard against concurrent unlock+auto-safety-move polls
var _faceSurfRefZ = null; // surface reference Z in WORK coords captured by Surface Reference Probe button
var topResults = [];
var faceResults = [];
var s = {}; // current run settings — set by runFaceProbe
var TOP_RESULTS_KEY = 'edgeProbeTopResults';
var FACE_RESULTS_KEY = 'edgeProbeFaceResults';
var FACE_LAYERED_RESULTS_KEY = 'edgeProbeFaceLayeredResults';
var FACE_MESH_STORAGE_KEY = 'faceProbe.faceMeshData';
var FACE_PROBE_DEFAULT_MAX_DEPTH = 14.75; // default probe stylus callout length (coords) — cap for Z End
var _facePvizRotX = 20, _facePvizRotY = -25, _facePvizRotZ = 0, _faceDragActive = false, _faceDragLastX = 0, _faceDragLastY = 0;
var FACE_LOG_KEY = 'edgeProbeFaceLog';
var SAVED_LOCATION_KEY = 'edgeProbeSavedLocation';
var topLogLines = [];
var faceLogLines = [];
var outlineLogLines = [];
var layeredFaceResults = [];
var layeredFaceResultsRaw = []; // original sparse face probe points (pre-subdivision)
var MESH_STORAGE_KEY = 'edgeProbeMeshData';
var meshSubdivisionSpacing = 2; // mm between subdivided mesh points (0 = disabled)
var PROBE_DIMENSIONS_KEY = 'edgeProbeDimensions';

// ── Debug logging ─────────────────────────────────────────────────────────────
var _pluginDebugMode = false; // toggled by "Debug Log" checkbox in footer

/**
 * pluginDebug(msg) — write a [PLUGIN DEBUG] entry to the browser console
 * and append it to whichever probe log is currently visible (sm-probeLog
 * first, then face-log, then top-log).  Does nothing when debug mode is off.
 */
function pluginDebug(msg) {
  var line = '[PLUGIN DEBUG] ' + msg;
  // Always log to browser console so devtools captures every entry
  console.log(line);
  if (!_pluginDebugMode) return;
  // Append to surface probe log when available (primary during probing)
  var el = document.getElementById('sm-probeLog');
  if (!el) el = document.getElementById('face-log');
  if (!el) el = document.getElementById('top-log');
  if (el) {
    var ts = tsMs();
    var div = document.createElement('div');
    div.className = 'log-entry';
    div.style.color = 'var(--muted)';
    div.textContent = '[' + ts + '] ' + line;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────────
function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
function tsMs(){
  var d = new Date();
  var hh = String(d.getHours()).padStart(2,'0');
  var mm = String(d.getMinutes()).padStart(2,'0');
  var ss = String(d.getSeconds()).padStart(2,'0');
  var ms = String(d.getMilliseconds()).padStart(3,'0');
  return hh + ':' + mm + ':' + ss + '.' + ms;
}
function escHtml(v){ return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function checkStop(){
  // During the stop handler's safety retract/home phase, do not throw — let
  // the motion commands execute so the machine reaches a safe position.
  if(_stopRequested && !_safetyMoveActive) throw new Error('User stop requested');
}

// ── Visual reset on plugin restart ────────────────────────────────────────────
// Clear all canvases and Three.js scenes to prevent stale visuals on restart
function clearAllVisuals() {
  pluginDebug('clearAllVisuals: clearing all canvas and visualization state');
  // Clear all 2D canvas elements
  var canvasIds = [
    'sm-heatmap-canvas', 'face-heatmap-canvas', 'res-heatmap-canvas',
    'res-face-heatmap-canvas', 'relief-2d-canvas'
  ];
  canvasIds.forEach(function(id) {
    var canvas = document.getElementById(id);
    if (canvas && canvas.getContext) {
      var ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  });
  // Dispose all Three.js WebGL renderers (cancels animation, frees GPU resources,
  // removes canvas elements).  _threeDispose is defined in visualization.js and
  // safe to call when no state exists for a given prefix.
  try {
    ['sm', 'res', 'surf', 'face', 'resface', 'comb', 'relief'].forEach(function(prefix) {
      _threeDispose(prefix);
    });
  } catch(e) {}
  // Reset internal visualization state flags
  try {
    if (typeof _smHeatmapRendered !== 'undefined') _smHeatmapRendered = false;
    if (typeof _faceHeatmapRendered !== 'undefined') _faceHeatmapRendered = false;
    if (typeof _relief3DInited !== 'undefined') _relief3DInited = false;
  } catch(e) {}
  pluginDebug('clearAllVisuals: done');
}

// ── Stop ──────────────────────────────────────────────────────────────────────

/**
 * _trySafeStopEndpoints(label)
 *
 * Tries ncSender-compatible safe-stop endpoints in best-practice order:
 *   1. POST /api/gcode-job/stop  — ncSender job stop (clears queue, no resume)
 *   2. POST /api/probe/stop      — probe-op stop (safe no-op if 404)
 *   3. POST /api/gcode/stop      — legacy / backward-compat fallback
 *
 * Returns true if any endpoint responded with 2xx (Hold/queue should be cleared).
 * Logs each attempt result via pluginDebug.
 */
async function _trySafeStopEndpoints(label) {
  var endpoints = [
    '/api/gcode-job/stop',
    '/api/probe/stop',
    '/api/gcode/stop'
  ];
  for (var _i = 0; _i < endpoints.length; _i++) {
    var _ep = endpoints[_i];
    try {
      var _ctrl = new AbortController();
      var _tmr  = setTimeout(function(){ _ctrl.abort(); }, 3000);
      var _resp = await fetch(_ep, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        signal: _ctrl.signal
      });
      clearTimeout(_tmr);
      if (_resp.ok) {
        pluginDebug(label + ': safe stop succeeded via ' + _ep);
        return true;
      } else if (_resp.status === 404) {
        pluginDebug(label + ': ' + _ep + ' returned 404 (not supported), trying next');
      } else {
        pluginDebug(label + ': ' + _ep + ' returned ' + _resp.status + ', trying next');
      }
    } catch(_err) {
      pluginDebug(label + ': ' + _ep + ' not available (' + _err.message + '), trying next');
    }
  }
  return false;
}

/**
 * stopNowAndSafeHome(reason)
 *
 * Unified immediate-stop for all probe/outline routines:
 *  1. Sets all stop flags so no new commands are queued.
 *  2. Sends real-time Feed Hold (!) to halt motion ASAP.
 *  3. Polls until machineState.status is Hold (up to 1 s).
 *  4. Tries ncSender safe-stop endpoints to cancel queued motion without resuming.
 *     Order: /api/gcode-job/stop → /api/probe/stop → /api/gcode/stop.
 *     Does NOT automatically send ~ regardless of whether an endpoint succeeds.
 *  5. Polls until machineState.status is no longer Hold (up to 4 s).
 *     If still in Hold, shows the Hold Warning panel and keeps polling (up to 10 min)
 *     at a low frequency until Hold clears or the user navigates away.
 *     The panel provides a "Clear Hold (Stop)" button (calls safe-stop endpoints)
 *     and a clearly-labelled "Resume (~) — UNSAFE fallback" button.
 *  6. Sets _safetyMoveActive so checkStop() does NOT abort safety moves.
 *  7. Retracts Z to machineSafeTopZ (G53) at a controlled feed.
 *  8. Returns to work X0 Y0 at a controlled feed.
 *  9. Clears _safetyMoveActive.
 *
 * Does NOT require controller unlock or re-home.
 * Does NOT require the user to switch to ncSender.
 * Never auto-sends ~; ~ is only sent when the user explicitly clicks the fallback button.
 */
async function stopNowAndSafeHome(reason) {
  // Guard: prevent overlapping stop sequences from double-clicking Stop.
  if (_stopInProgress) {
    pluginDebug('stopNowAndSafeHome: already in progress, ignoring duplicate call');
    return;
  }
  _stopInProgress = true;

  try {
  // 1. Set all stop flags immediately so running routines queue no more commands.
  //    Increment _runGeneration so any in-flight async probe/travel can detect
  //    that a stop has been issued and skip stale results.
  _stopRequested   = true;
  smStopFlag       = true;
  _outlineStopFlag = true;
  _runGeneration++;

  var label = reason ? ('STOP (' + reason + ')') : 'STOP';
  setFooterStatus(label + ': feed hold\u2026', 'warn');

  // Helper: write a line to every visible probe log.
  function _stopLog(msg) {
    try { logLine('top', msg); } catch(_e) {}
    try { logLine('face', msg); } catch(_e) {}
    try { if (typeof outlineAppendLog === 'function') outlineAppendLog(msg); } catch(_e) {}
    try { smLogProbe(msg); } catch(_e) {}
  }

  // 2. Feed Hold — halts motion as quickly as the controller allows.
  _stopLog(label + ': feed hold sent (!)');
  pluginDebug(label + ': sending feed hold (!)');
  try {
    await sendCommand('!');
  } catch(e) {
    pluginDebug(label + ': feed-hold send error (ignored): ' + e.message);
  }

  // 3. Poll until status is Hold (up to 1 s).
  pluginDebug(label + ': waiting for Hold state\u2026');
  var _detectedAlarm = false;
  var holdDeadline = Date.now() + 1000;
  while (Date.now() < holdDeadline) {
    await sleep(100);
    try {
      var _st = await _getState();
      var _ms = _machineStateFrom(_st);
      var _status = String(_ms.status || '').toLowerCase();
      if (_status.indexOf('alarm') >= 0) { _detectedAlarm = true; break; }
      if (_status.indexOf('hold') >= 0 || _status === 'idle') break;
    } catch(_e) {}
  }
  pluginDebug(label + ': Hold poll done');
  if (_detectedAlarm) {
    _stopLog('STOP (outline): ALARM detected \u2014 safety moves skipped until alarm clears');
    setFooterStatus(label + ': ALARM \u2014 click Unlock ($X) to recover', 'bad');
    pluginDebug(label + ': ALARM detected in initial Hold poll; showing alarm panel');
    _showAlarmWarning(true);
    return;
  }

  // 4. Try to cancel queued motion via ncSender-compatible safe-stop endpoints.
  //    Order: /api/gcode-job/stop → /api/probe/stop → /api/gcode/stop.
  //    We do NOT automatically send ~ regardless of outcome — that would resume
  //    buffered moves.  ~ is only sent when the user explicitly clicks the button.
  _stopLog(label + ': clearing hold/queue (safe stop)');
  pluginDebug(label + ': attempting safe hold clear via ncSender-compatible endpoints');
  var _usedSafeStop = await _trySafeStopEndpoints(label);
  if (_usedSafeStop) {
    _stopLog(label + ': safe stop endpoint succeeded — Hold/queue should be cleared');
  } else {
    _stopLog(label + ': no safe-stop endpoint available; showing hold-warning panel for manual action');
    pluginDebug(label + ': all safe-stop endpoints failed; user must manually clear Hold via panel buttons');
  }

  // 5. Poll until no longer in Hold (up to 4 s).
  pluginDebug(label + ': waiting for controller to leave Hold\u2026');
  var idleDeadline = Date.now() + 4000;
  var leftHold = false;
  while (Date.now() < idleDeadline) {
    await sleep(150);
    try {
      var _st2 = await _getState();
      var _ms2 = _machineStateFrom(_st2);
      var _st2s = String(_ms2.status || '').toLowerCase();
      if (_st2s.indexOf('alarm') >= 0) { _detectedAlarm = true; break; }
      if (_st2s.indexOf('hold') < 0) { leftHold = true; break; }
    } catch(_e2) {}
  }
  if (_detectedAlarm) {
    _stopLog('STOP (outline): ALARM detected \u2014 safety moves skipped until alarm clears');
    setFooterStatus(label + ': ALARM \u2014 click Unlock ($X) to recover', 'bad');
    pluginDebug(label + ': ALARM detected in exit-Hold poll; showing alarm panel');
    _showAlarmWarning(true);
    return;
  }

  if (!leftHold) {
    // Controller is still in Hold — warn the user and show the manual action panel.
    // Keep the panel visible and poll at a low frequency until Hold clears or the
    // user navigates away (no forced timeout — user must act via the panel buttons).
    _stopLog(label + ': WARNING — controller still in Hold. Use "Clear Hold (Stop)" in the panel to cancel the queue via ncSender, or press "Resume (~) — UNSAFE fallback" only if Stop is unavailable; safety moves will continue once Hold clears.');
    setFooterStatus(label + ': controller still in Hold — use Clear Hold (Stop) in the panel', 'warn');
    pluginDebug(label + ': controller still in Hold after 4s; showing hold-warning panel (polling until cleared)');
    _showResumeButtonWarning(true);
    // Poll at low frequency (every 500 ms) for up to 10 minutes; panel stays
    // visible the whole time so the user can act via the panel buttons.
    var manualDeadline = Date.now() + 600000;
    while (Date.now() < manualDeadline) {
      await sleep(500);
      try {
        var _st3 = await _getState();
        var _ms3 = _machineStateFrom(_st3);
        var _st3s = String(_ms3.status || '').toLowerCase();
        if (_st3s.indexOf('alarm') >= 0) { _detectedAlarm = true; break; }
        if (_st3s.indexOf('hold') < 0) { leftHold = true; break; }
      } catch(_e3) {}
    }
    if (_detectedAlarm) {
      _showResumeButtonWarning(false);
      _stopLog('STOP (outline): ALARM detected \u2014 safety moves skipped until alarm clears');
      setFooterStatus(label + ': ALARM \u2014 click Unlock ($X) to recover', 'bad');
      pluginDebug(label + ': ALARM detected in hold-warning poll; showing alarm panel');
      _showAlarmWarning(true);
      return;
    } else if (leftHold) {
      // Hold cleared — hide the warning panel and proceed with safety moves.
      _showResumeButtonWarning(false);
    } else {
      // Still in Hold after 10 minutes — abort safety moves but leave the panel
      // visible so the user can still use the buttons.
      _stopLog(label + ': aborting safety moves — controller did not leave Hold');
      setFooterStatus(label + ': safety moves skipped (still in Hold)', 'bad');
      return;
    }
  }

  pluginDebug(label + ': controller left Hold; starting safety moves');

  // Final ALARM check before starting safety moves.
  try {
    var _preMoveState = await _getState();
    var _preMoveMs = _machineStateFrom(_preMoveState);
    var _preMoveStatus = String(_preMoveMs.status || '').toLowerCase();
    if (_preMoveStatus.indexOf('alarm') >= 0) { _detectedAlarm = true; }
  } catch(_preErr) {}
  if (_detectedAlarm) {
    _stopLog('STOP (outline): ALARM detected \u2014 safety moves skipped until alarm clears');
    setFooterStatus(label + ': ALARM \u2014 click Unlock ($X) to recover', 'bad');
    pluginDebug(label + ': ALARM detected before safety moves; showing alarm panel');
    _showAlarmWarning(true);
    return;
  }

  // 6. Set safetyMoveActive so checkStop() will NOT abort the retract/home.
  _safetyMoveActive = true;

  try {
    // 7. Retract Z to machine safe top.
    var cfg = getSettingsFromUI();
    var retractFeed = Math.max(100, cfg.travelFeedRate || 600);

    _stopLog(label + ': retracting to machine safe top Z');
    setFooterStatus(label + ': retracting Z\u2026', 'warn');

    try {
      var machineSafeZ = isFinite(Number(cfg.machineSafeTopZ)) ? Number(cfg.machineSafeTopZ) : null;
      if (machineSafeZ !== null) {
        // G53 machine-coordinate retract (same as jogRaiseToMachineSafeTop but without homed check).
        await sendCommand('G53 G1 Z' + machineSafeZ.toFixed(3) + ' F' + retractFeed.toFixed(0));
        await sleep(100);
        await _waitForIdleOrStop(15000);
      } else {
        // Fallback: relative lift of 10 mm in work coords.
        await sendCommand('G91 G1 Z10 F' + retractFeed.toFixed(0));
        await sleep(100);
        await _waitForIdleOrStop(15000);
        await sendCommand('G90');
      }
    } catch(e) {
      if (e.message === 'Machine in alarm state') {
        _stopLog('STOP (outline): ALARM detected during safety moves \u2014 stopping');
        setFooterStatus(label + ': ALARM during safety moves \u2014 click Unlock ($X) to recover', 'bad');
        _showAlarmWarning(true);
        return;
      }
      pluginDebug(label + ': Z retract error (ignored): ' + e.message);
    }

    // 8. Return to work X0 Y0 at controlled feed.
    _stopLog(label + ': returning to X0 Y0');
    setFooterStatus(label + ': returning to X0 Y0\u2026', 'warn');

    try {
      await sendCommand('G90 G1 X0.000 Y0.000 F' + retractFeed.toFixed(0));
      await sleep(100);
      await _waitForIdleOrStop(30000);
    } catch(e) {
      if (e.message === 'Machine in alarm state') {
        _stopLog('STOP (outline): ALARM detected during safety moves \u2014 stopping');
        setFooterStatus(label + ': ALARM during safety moves \u2014 click Unlock ($X) to recover', 'bad');
        _showAlarmWarning(true);
        return;
      }
      pluginDebug(label + ': XY home error (ignored): ' + e.message);
    }
  } finally {
    // 9. Always clear safetyMoveActive when done.
    _safetyMoveActive = false;
  }

  _stopLog(label + ': complete');
  setFooterStatus(label + ': complete', 'warn');

  try { var after = await getMachineSnapshot(); updateMachineHelperUI(after); } catch(_e) {}

  } finally {
    // Outer finally: always release the double-stop guard.
    _stopInProgress = false;
  }
}

/**
 * _showResumeButtonWarning(visible)
 * Show or hide the "still in Hold" warning panel (under Outline → Probing Control).
 * The panel contains the manual Resume button and is normally hidden.
 */
function _showResumeButtonWarning(visible) {
  var el = document.getElementById('plugin-hold-warning');
  if (el) el.style.display = visible ? '' : 'none';
}

/**
 * _updateStatusPanel(isAlarm)
 * Update the Machine Status panel (#plugin-alarm-warning) to reflect whether the
 * controller is in ALARM or in a normal / OK state.
 *
 * When isAlarm is true  → red styling, recovery buttons enabled.
 * When isAlarm is false → green styling, buttons disabled, "Status: OK" shown.
 *
 * Panel visibility:
 *   • Auto-hide OFF (default): panel is always visible.
 *   • Auto-hide ON:  panel is hidden when OK, shown when in ALARM.
 *
 */
function _updateStatusPanel(isAlarm) {
  var panel = document.getElementById('plugin-alarm-warning');
  if (!panel) return;

  // Determine whether auto-hide is enabled
  var autoHideEl = document.getElementById('autoHideStatusPanel');
  var autoHideOn = autoHideEl ? autoHideEl.checked : false;

  // Show / hide the panel
  if (autoHideOn) {
    panel.style.display = isAlarm ? '' : 'none';
  } else {
    panel.style.display = '';
  }

  // Update callout box styling
  var callout = document.getElementById('plugin-alarm-callout');
  var statusText = document.getElementById('plugin-alarm-status-text');
  var detailText = document.getElementById('plugin-alarm-detail-text');

  if (isAlarm) {
    // Navigate to the Outline tab so the Unlock ($X) button is immediately visible,
    // regardless of which tab the user was on when the alarm was triggered.
    if (typeof switchTab === 'function') { try { switchTab('outline'); } catch(_e) {} }

    if (callout) {
      callout.style.background = 'rgba(220,50,50,0.12)';
      callout.style.borderColor = 'var(--bad,#d03030)';
    }
    if (statusText) {
      statusText.style.color = 'var(--bad,#d03030)';
      statusText.textContent = '\u26A0 Controller in ALARM \u2014 motion locked out';
    }
    if (detailText) {
      detailText.innerHTML = 'The controller has entered ALARM state (e.g.\u00a0ALARM:3). Motion commands are locked out and the '
        + 'safety retract\u00a0/\u00a0home moves have been skipped to avoid repeated errors.<br>'
        + 'To recover: click <strong>Unlock ($X)</strong> to clear the alarm latch, then <strong>Home ($H)</strong> if your machine requires homing.';
    }
  } else {
    if (callout) {
      callout.style.background = 'rgba(30,150,50,0.08)';
      callout.style.borderColor = 'var(--ok,#209020)';
    }
    if (statusText) {
      statusText.style.color = 'var(--ok,#209020)';
      statusText.textContent = '\u2713 Status: OK \u2014 No ALARM';
    }
    if (detailText) {
      detailText.textContent = 'Machine is operating normally. Alarm recovery buttons below are disabled until an ALARM is detected.';
    }
  }

  // Enable / disable action buttons
  var btnUnlock    = document.getElementById('btn-unlock-x');
  var btnHome      = document.getElementById('btn-home-h');

  if (btnUnlock)    btnUnlock.disabled    = !isAlarm;
  if (btnHome)      btnHome.disabled      = !isAlarm;
}

/**
 * _showAlarmWarning(visible)
 * Show or hide the ALARM warning panel (under Outline → Probing Control).
 * Shown when the controller enters ALARM during a stop sequence.
 * @deprecated Use _updateStatusPanel(isAlarm) directly; this wrapper is kept
 *             for backwards-compatibility with existing call-sites.
 */
function _showAlarmWarning(visible) {
  _updateStatusPanel(!!visible);
}

// Constants for post-unlock idle polling
var UNLOCK_POLL_TIMEOUT_MS = 5000;
var UNLOCK_POLL_INTERVAL_MS = 250;

/**
 * sendUnlockCommand()
 * Sends the $X unlock command to clear the ALARM latch.
 * After sending $X, polls server-state until the controller becomes Idle
 * (not alarm, not hold) and then automatically runs retrySafetyMoves().
 * If the controller is not ready within UNLOCK_POLL_TIMEOUT_MS, logs a message
 * and keeps the ALARM panel visible for manual retry.
 * A guard flag (_unlockPollActive) prevents concurrent polls on double-click.
 * Called by the Unlock ($X) button in the ALARM warning panel.
 */
async function sendUnlockCommand() {
  if (_unlockPollActive) {
    pluginDebug('ALARM: unlock already in progress — ignoring duplicate click');
    return;
  }
  _unlockPollActive = true;
  try {
    console.log('[' + tsMs() + '] CMD: unlock ($X) — explicit button click');
    await sendCommand('$X');
    pluginDebug('ALARM: unlock ($X) sent');
    setFooterStatus('ALARM: unlock ($X) sent', 'warn');

    pluginDebug('ALARM: waiting for controller to become Idle before safety moves\u2026');
    setFooterStatus('ALARM: waiting for controller to become Idle\u2026', 'warn');

    var deadline = Date.now() + UNLOCK_POLL_TIMEOUT_MS;
    var becameIdle = false;
    while (Date.now() < deadline) {
      await sleep(UNLOCK_POLL_INTERVAL_MS);
      try {
        var _ulState = await _getState();
        var _ulMs = _machineStateFrom(_ulState);
        var _ulStatus = String(_ulMs.status || '').toLowerCase();
        if (_ulStatus.indexOf('alarm') < 0 && _ulStatus.indexOf('hold') < 0 && _ulStatus.indexOf('idle') >= 0) {
          becameIdle = true;
          break;
        }
      } catch(_e) { /* transient fetch error — keep polling */ }
    }

    if (becameIdle) {
      pluginDebug('ALARM: controller ready \u2014 auto-running safety moves');
      setFooterStatus('ALARM: controller ready \u2014 auto-running safety moves', 'warn');
      await retrySafetyMoves();
    } else {
      pluginDebug('ALARM: controller not ready after timeout \u2014 manual retry required');
      setFooterStatus('ALARM: not ready \u2014 click Home ($H) if required', 'bad');
      _showAlarmWarning(true);
      try { var after = await getMachineSnapshot(); updateMachineHelperUI(after); } catch(_e) {}
    }
  } catch(e) {
    setFooterStatus('Unlock failed: ' + e.message, 'bad');
  } finally {
    _unlockPollActive = false;
  }
}

/**
 * sendHomeCommand()
 * Sends the $H homing command.
 * Called by the Home ($H) button in the ALARM warning panel.
 */
async function sendHomeCommand() {
  try {
    console.log('[' + tsMs() + '] CMD: home ($H) — explicit button click');
    await sendCommand('$H');
    pluginDebug('ALARM: home ($H) sent');
    setFooterStatus('ALARM: home ($H) sent', 'warn');
    try { var after = await getMachineSnapshot(); updateMachineHelperUI(after); } catch(_e) {}
  } catch(e) {
    setFooterStatus('Home failed: ' + e.message, 'bad');
  }
}

/**
 * retrySafetyMoves()
 * Re-runs the safety retract/home sequence after ALARM has been cleared.
 * Called automatically after sendUnlockCommand() polls the controller to Idle.
 * Checks that the controller is no longer in ALARM or Hold before proceeding.
 */
async function retrySafetyMoves() {
  pluginDebug('ALARM: retrying safety moves\u2026');
  try {
    var _retryState = await _getState();
    var _retryMs = _machineStateFrom(_retryState);
    var _retryStatus = String(_retryMs.status || '').toLowerCase();
    if (_retryStatus.indexOf('alarm') >= 0) {
      pluginDebug('retrySafetyMoves: still in ALARM \u2014 cannot retry yet');
      setFooterStatus('ALARM: still in alarm \u2014 click Unlock ($X) or Home ($H) first', 'bad');
      return;
    }
    if (_retryStatus.indexOf('hold') >= 0) {
      pluginDebug('retrySafetyMoves: still in Hold \u2014 cannot retry yet');
      setFooterStatus('ALARM: still in Hold \u2014 clear Hold first', 'bad');
      return;
    }
  } catch(e) {
    setFooterStatus('retrySafetyMoves: state check failed: ' + e.message, 'bad');
    return;
  }

  _showAlarmWarning(false);
  _safetyMoveActive = true;

  try {
    var cfg = getSettingsFromUI();
    var retractFeed = Math.max(100, cfg.travelFeedRate || 600);

    setFooterStatus('ALARM: retracting Z\u2026', 'warn');
    pluginDebug('ALARM: retrying safety moves \u2014 retracting Z');

    try {
      var _retryMachineSafeZ = isFinite(Number(cfg.machineSafeTopZ)) ? Number(cfg.machineSafeTopZ) : null;
      if (_retryMachineSafeZ !== null) {
        await sendCommand('G53 G1 Z' + _retryMachineSafeZ.toFixed(3) + ' F' + retractFeed.toFixed(0));
        await sleep(100);
        await _waitForIdleOrStop(15000);
      } else {
        await sendCommand('G91 G1 Z10 F' + retractFeed.toFixed(0));
        await sleep(100);
        await _waitForIdleOrStop(15000);
        await sendCommand('G90');
      }
    } catch(e) {
      pluginDebug('retrySafetyMoves: Z retract error: ' + e.message);
      if (e.message === 'Machine in alarm state') {
        setFooterStatus('ALARM: alarm re-entered during retry \u2014 reset and try again', 'bad');
        _showAlarmWarning(true);
        return;
      }
    }

    setFooterStatus('ALARM: returning to X0 Y0\u2026', 'warn');
    pluginDebug('ALARM: retrying safety moves \u2014 returning to X0 Y0');

    try {
      await sendCommand('G90 G1 X0.000 Y0.000 F' + retractFeed.toFixed(0));
      await sleep(100);
      await _waitForIdleOrStop(30000);
    } catch(e) {
      pluginDebug('retrySafetyMoves: XY home error: ' + e.message);
      if (e.message === 'Machine in alarm state') {
        setFooterStatus('ALARM: alarm re-entered during retry \u2014 reset and try again', 'bad');
        _showAlarmWarning(true);
        return;
      }
    }

    setFooterStatus('ALARM: safety moves complete', 'ok');
    pluginDebug('ALARM: retry safety moves complete');
    try { var after = await getMachineSnapshot(); updateMachineHelperUI(after); } catch(_e) {}
  } finally {
    _safetyMoveActive = false;
  }
}

/**
 * sendResumeCommand()
 * Send the real-time cycle-start / resume character (~).
 * Called by the in-plugin Resume button.
 */
async function sendResumeCommand() {
  try {
    await sendCommand('~');
    setFooterStatus('Resume (~) sent.', 'ok');
    try { var after = await getMachineSnapshot(); updateMachineHelperUI(after); } catch(_e) {}
  } catch(e) {
    setFooterStatus('Resume failed: ' + e.message, 'bad');
  }
}

/**
 * sendClearHoldCommand()
 * Calls the ncSender-compatible safe-stop endpoints to cancel queued motion and
 * clear Hold without resuming buffered moves.  Called by the "Clear Hold (Stop)"
 * button in the Hold Warning panel.
 */
async function sendClearHoldCommand() {
  try {
    setFooterStatus('Clear Hold (Stop): trying safe-stop endpoints\u2026', 'warn');
    var ok = await _trySafeStopEndpoints('Clear Hold (Stop)');
    if (ok) {
      setFooterStatus('Clear Hold (Stop): succeeded — Hold should be cleared.', 'ok');
    } else {
      setFooterStatus('Clear Hold (Stop): no endpoint available. Try ncSender Stop manually.', 'bad');
    }
    try { var after = await getMachineSnapshot(); updateMachineHelperUI(after); } catch(_e) {}
  } catch(e) {
    setFooterStatus('Clear Hold (Stop) failed: ' + e.message, 'bad');
  }
}

/**
 *
 * Like waitForIdleWithTimeout() but:
 * - When _stopRequested is true AND _safetyMoveActive is false, treats
 *   Hold or Idle as an acceptable "done" state so routines exit cleanly.
 * - When _safetyMoveActive is true (safety retract/home in progress), waits
 *   for Idle only — Hold is NOT acceptable because safety moves must complete.
 */
async function _waitForIdleOrStop(timeoutMs) {
  var deadline = Date.now() + (timeoutMs || 15000);
  var pollInterval = 50;
  while (Date.now() < deadline) {
    await sleep(pollInterval);
    try {
      var state = await _getState();
      var ms = _machineStateFrom(state);
      var status = String(ms.status || '').toLowerCase();
      if (status === 'idle') return;
      // If stop was requested but we're NOT in a safety move, accept Hold as done.
      if (_stopRequested && !_safetyMoveActive && (status.indexOf('hold') >= 0 || status === 'idle')) return;
      if (status === 'alarm') throw new Error('Machine in alarm state');
    } catch(e) {
      if (e.message === 'Machine in alarm state') throw e;
      // Transient fetch error — keep polling.
    }
  }
}

function stopAll(){
  stopNowAndSafeHome('user').catch(function(e){
    pluginDebug('stopAll: stopNowAndSafeHome error: ' + e.message);
  });
}

// ── ncSender API bridge (fetch-based) ─────────────────────────────────────────
async function sendCommand(gcode, timeoutMs){
  pluginDebug('sendCommand ENTER: cmd="' + gcode + '" timeout=' + ((timeoutMs !== null && timeoutMs !== undefined) ? timeoutMs : 15000) + 'ms');
  console.log('[' + tsMs() + '] SEND: ' + gcode);
  var controller = new AbortController();
  var ms = (timeoutMs !== null && timeoutMs !== undefined) ? timeoutMs : 15000;
  var timer = setTimeout(function(){ controller.abort(); }, ms);
  try {
    var r = await fetch('/api/send-command', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({command: gcode, meta: {sourceId: 'plugin', plugin: 'com.ncsender.edgeprobe.combined'}}),
      signal: controller.signal
    });
    var js = await r.json();
    pluginDebug('sendCommand RESPONSE: cmd="' + gcode + '" response=' + JSON.stringify(js));
    if(js.error || js.success === false){
      var errMsg = (js.error && (js.error.message || js.error)) || 'Command failed';
      pluginDebug('sendCommand ERROR: cmd="' + gcode + '" error="' + errMsg + '"');
      throw new Error(errMsg);
    }
    console.log('[' + tsMs() + '] DONE: ' + gcode);
    pluginDebug('sendCommand OK: cmd="' + gcode + '"');
    return js;
  } catch(e) {
    if(e.name === 'AbortError'){
      pluginDebug('sendCommand TIMEOUT: cmd="' + gcode + '" after ' + ms + 'ms');
      throw new Error('sendCommand timed out after ' + ms + 'ms for: ' + gcode);
    }
    pluginDebug('sendCommand EXCEPTION: cmd="' + gcode + '" error="' + e.message + '"');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function _getState(){
  var r = await fetch('/api/server-state');
  var state = await r.json();
  pluginDebug('_getState raw: status=' + ((state.machineState || (state.cnc && state.cnc.machineState) || {}).status || 'n/a'));
  return state;
}

function _machineStateFrom(state){
  return state.machineState || (state.cnc && state.cnc.machineState) || {};
}

function _detectHomed(ms, state){
  var candidates = [
    ms.isHomed, ms.homed, ms.hasHomed, ms.homingComplete,
    state && state.isHomed, state && state.homed
  ];
  for(var i = 0; i < candidates.length; i++){
    if(typeof candidates[i] === 'boolean') return candidates[i];
  }
  if(typeof ms.homing === 'boolean') return !ms.homing;
  return null;
}

async function getMachineSnapshot(){
  pluginDebug('getMachineSnapshot ENTER');
  var state = await _getState();
  var ms = _machineStateFrom(state);
  var pos = await getWorkPosition();
  var m = _parsePos(ms.MPos);
  var wco = _parsePos(ms.WCO);
  var machine = m ? {x:m.x, y:m.y, z:m.z} : (wco ? {x:pos.x + wco.x, y:pos.y + wco.y, z:pos.z + wco.z} : null);
  var _feedOvr    = ms.feedrateOverride  != null ? Number(ms.feedrateOverride)  : NaN;
  var _rapidOvr   = ms.rapidOverride     != null ? Number(ms.rapidOverride)     : NaN;
  var _spindleOvr = ms.spindleOverride   != null ? Number(ms.spindleOverride)   : NaN;
  var snap = {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    machineX: machine ? machine.x : null,
    machineY: machine ? machine.y : null,
    machineZ: machine ? machine.z : null,
    status: pos.status || ms.status || 'Unknown',
    probeTriggered: !!pos.probeTriggered,
    homed: _detectHomed(ms, state),
    feedOverridePct:    isFinite(_feedOvr)    ? _feedOvr    : null,
    rapidOverridePct:   isFinite(_rapidOvr)   ? _rapidOvr   : null,
    spindleOverridePct: isFinite(_spindleOvr) ? _spindleOvr : null,
    raw: ms
  };
  pluginDebug('getMachineSnapshot EXIT: status=' + snap.status + ' pos=X' + snap.x + ' Y' + snap.y + ' Z' + snap.z + ' homed=' + snap.homed + ' probe=' + snap.probeTriggered + ' feedOvr=' + snap.feedOverridePct + '% rapidOvr=' + snap.rapidOverridePct + '% spindleOvr=' + snap.spindleOverridePct + '%');
  return snap;
}

function _isAlarmStatus(status){
  return String(status || '').toLowerCase() === 'alarm';
}

async function requireStartupHomingPreflight(runLabel){
  pluginDebug('requireStartupHomingPreflight ENTER: label="' + (runLabel || 'probe run') + '"');
  var info = await getMachineSnapshot();
  updateMachineHelperUI(info);
  var label = runLabel || 'probe run';
  if(_isAlarmStatus(info.status)){
    pluginDebug('requireStartupHomingPreflight ABORT: controller in ALARM');
    throw new Error('Controller is in ALARM. Reset/unlock and home the machine before ' + label + '.');
  }
  if(info.probeTriggered){
    pluginDebug('requireStartupHomingPreflight ABORT: probe already triggered');
    throw new Error('Probe input is already triggered. Clear the probe before ' + label + '.');
  }
  if(info.homed !== true){
    pluginDebug('requireStartupHomingPreflight ABORT: machine not homed (homed=' + info.homed + ')');
    throw new Error('Machine must be homed after startup before ' + label + '.');
  }
  pluginDebug('requireStartupHomingPreflight OK: status=' + info.status + ' homed=true probe=open');
  logLine('top', 'Preflight OK: machine homed, status=' + (info.status || 'Unknown') + ', probe=open');
  logLine('face', 'Preflight OK: machine homed, status=' + (info.status || 'Unknown') + ', probe=open');
  // Non-blocking override warnings
  var _overrideWarns = [];
  if(typeof info.feedOverridePct === 'number' && info.feedOverridePct !== 100){
    _overrideWarns.push('Feed override is ' + info.feedOverridePct + '% \u2014 travel will be slower than commanded.');
  }
  if(typeof info.rapidOverridePct === 'number' && info.rapidOverridePct !== 100){
    _overrideWarns.push('Rapid override is ' + info.rapidOverridePct + '%.');
  }
  if(typeof info.spindleOverridePct === 'number' && info.spindleOverridePct !== 100){
    _overrideWarns.push('Spindle override is ' + info.spindleOverridePct + '%.');
  }
  if(_overrideWarns.length > 0){
    var _warnMsg = 'WARNING: ' + _overrideWarns.join(' ');
    pluginDebug('requireStartupHomingPreflight OVERRIDE WARNING: ' + _warnMsg);
    logLine('top', _warnMsg);
    logLine('face', _warnMsg);
    if(typeof outlineAppendLog === 'function') outlineAppendLog(_warnMsg);
    setFooterStatus(_warnMsg, 'warn');
  }
  return info;
}
function updateMachineHelperUI(info){
  if(!info) return;
  var homedEl = document.getElementById('homedState');
  var machineEl = document.getElementById('machineStatus');
  var probeEl = document.getElementById('probeState');
  if(homedEl) homedEl.value = info.homed == null ? 'Unknown' : (info.homed ? 'Yes' : 'No');
  if(machineEl) machineEl.value = info.status || 'Unknown';
  if(probeEl) probeEl.value = info.probeTriggered ? 'Triggered' : 'Open';
  updateCurrentPositionUI(info);
  updateOverrideCallouts(info);
  // Keep the Machine Status panel in sync with the current machine state.
  var _uiStatus = String(info.status || '').toLowerCase();
  var _uiIsAlarm = _uiStatus.indexOf('alarm') >= 0;
  var _uiIsHold  = _uiStatus.indexOf('hold')  >= 0;
  // Motion is safe only when not in ALARM and not in Hold (Idle or other non-blocking state)
  var _uiMotionSafe = !_uiIsAlarm && !_uiIsHold;
  _updateStatusPanel(_uiIsAlarm, _uiMotionSafe);
}

function updateCurrentPositionUI(pos){
  if(!pos) return;
  var xEl = document.getElementById('currentPosX');
  var yEl = document.getElementById('currentPosY');
  var zEl = document.getElementById('currentPosZ');
  if(xEl && isFinite(Number(pos.x))) xEl.value = Number(pos.x).toFixed(3);
  if(yEl && isFinite(Number(pos.y))) yEl.value = Number(pos.y).toFixed(3);
  if(zEl && isFinite(Number(pos.z))) zEl.value = Number(pos.z).toFixed(3);
}

/**
 * updateOverrideCallouts(snap)
 * Update the "Overrides: Feed X%  Rapid X%  Spindle X%" callouts near Run buttons.
 * Called automatically by updateMachineHelperUI on every snapshot refresh.
 */
function updateOverrideCallouts(snap) {
  var feedPct    = (snap && snap.feedOverridePct    != null) ? snap.feedOverridePct    : null;
  var rapidPct   = (snap && snap.rapidOverridePct   != null) ? snap.rapidOverridePct   : null;
  var spindlePct = (snap && snap.spindleOverridePct != null) ? snap.spindleOverridePct : null;

  var ids = ['outline-override-callout', 'top-override-callout', 'face-override-callout'];
  var hasAny = feedPct !== null || rapidPct !== null || spindlePct !== null;
  var parts = [];
  if (feedPct    !== null) parts.push('Feed '    + feedPct    + '%');
  if (rapidPct   !== null) parts.push('Rapid '   + rapidPct   + '%');
  if (spindlePct !== null) parts.push('Spindle ' + spindlePct + '%');
  var text = hasAny ? ('Overrides: ' + parts.join('\u2002 ')) : '';

  // Highlight non-100% overrides in amber so they catch the eye.
  var isNonDefault = hasAny && (feedPct !== 100 || rapidPct !== 100 || spindlePct !== 100);

  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (!el) continue;
    if (!hasAny) {
      el.style.display = 'none';
    } else {
      el.textContent = text;
      el.style.display = '';
      el.style.color = isNonDefault ? 'var(--warn,#e8a020)' : 'var(--muted)';
    }
  }
}

async function refreshCurrentPosition(){
  try{
    var info = await getMachineSnapshot();
    updateMachineHelperUI(info);
    setFooterStatus('Current position refreshed.', 'good');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Current position refreshed.'; el.className = 'status-line good'; }
    return info;
  }catch(e){
    setFooterStatus('Error: ' + e.message, 'bad');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Refresh position failed: ' + e.message; el.className = 'status-line bad'; }
    throw e;
  }
}

function setJogStepPreset(val){
  var n = Number(val);
  if(!isFinite(n) || n <= 0) return;
  var xy = document.getElementById('jogStepXY');
  if(xy) xy.value = String(n);
  Array.prototype.forEach.call(document.querySelectorAll('.jog-pill[data-step]'), function(btn){
    var active = Number(btn.getAttribute('data-step')) === n;
    btn.classList.toggle('active', active);
  });
}

async function jogHoldMotion(){
  try{
    await sendCommand('!');
    setFooterStatus('Feed hold sent.', 'warn');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Feed hold sent.'; el.className = 'status-line warn'; }
  }catch(e){
    setFooterStatus('Jog hold failed: ' + e.message, 'bad');
    throw e;
  }
}

async function jogResumeMotion(){
  try{
    await sendCommand('~');
    setFooterStatus('Resume sent.', 'ok');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Resume sent.'; el.className = 'status-line ok'; }
    try{
      var after = await getMachineSnapshot();
      updateMachineHelperUI(after);
    }catch(_e){}
  }catch(e){
    setFooterStatus('Jog resume failed: ' + e.message, 'bad');
    throw e;
  }
}

function getJogSettingsFromUI(){
  function _num(id, fallback) {
    var el = document.getElementById(id);
    var v = el ? Number(el.value) : NaN;
    return (isFinite(v) && v > 0) ? v : fallback;
  }
  return {
    stepXY: _num('jogStepXY', 1),
    stepZ:  _num('jogStepZ',  2),
    feedXY: _num('jogFeedXY', 600),
    feedZ:  _num('jogFeedZ',  300)
  };
}

async function jogBy(dx, dy, dz){
  var jog = getJogSettingsFromUI();
  var feed = (dz != null && dx == null && dy == null) ? jog.feedZ : jog.feedXY;
  if (!isFinite(feed) || feed <= 0) feed = (dz != null) ? 300 : 600;
  // Use standard incremental G-code (G91 G1) instead of the GRBL-specific $J= command
  // so the move works across all GRBL-compatible controllers and the NCSender API.
  // G90 is queued immediately after so absolute mode is restored once the move finishes.
  var cmd = 'G91 G1';
  if (dx != null) cmd += ' X' + Number(dx).toFixed(3);
  if (dy != null) cmd += ' Y' + Number(dy).toFixed(3);
  if (dz != null) cmd += ' Z' + Number(dz).toFixed(3);
  cmd += ' F' + Number(feed).toFixed(0);
  var moveErr = null;
  try {
    await sendCommand(cmd);
  } catch(e) {
    moveErr = e;
  }
  // Always restore absolute mode, whether or not the move succeeded.
  try { await sendCommand('G90'); } catch(_e) {}
  if (moveErr) {
    setFooterStatus('Jog failed: ' + moveErr.message, 'bad');
    var el = document.getElementById('setup-status');
    if (el) { el.textContent = 'Jog error: ' + moveErr.message; el.className = 'status-line warn'; }
    throw moveErr;
  }
  var moved = [];
  if (dx != null) moved.push('X ' + (dx > 0 ? '+' : '') + Number(dx).toFixed(3));
  if (dy != null) moved.push('Y ' + (dy > 0 ? '+' : '') + Number(dy).toFixed(3));
  if (dz != null) moved.push('Z ' + (dz > 0 ? '+' : '') + Number(dz).toFixed(3));
  setFooterStatus('Jog complete: ' + moved.join('  '), 'good');
  try {
    var after = await getMachineSnapshot();
    updateMachineHelperUI(after);
  } catch(_e) {}
}

// ── Button flash animation helper ─────────────────────────────────────────────
function flashButton(btn) {
  if (!btn) return;
  btn.classList.remove('btn-flash');
  // Force reflow to restart animation
  void btn.offsetWidth;
  btn.classList.add('btn-flash');
  setTimeout(function() { btn.classList.remove('btn-flash'); }, 400);
}

// ── Animated save-confirm helper ──────────────────────────────────────────────
function flashSaveButton(btn) {
  if (!btn) return;
  var origHTML = btn.innerHTML;
  btn.classList.remove('btn-save-confirm');
  void btn.offsetWidth;
  btn.innerHTML = '\u2713 Saved!';
  btn.classList.add('btn-save-confirm');
  setTimeout(function() {
    btn.classList.remove('btn-save-confirm');
    setTimeout(function() { btn.innerHTML = origHTML; }, 300);
  }, 1800);
}

async function jogToWorkZero(){
  var jog = getJogSettingsFromUI();
  await moveAbs(0, 0, null, jog.feedXY || 600);
  var after = await getMachineSnapshot();
  updateMachineHelperUI(after);
  setFooterStatus('Moved to work X0 Y0.', 'good');
}

async function jogRaiseToMachineSafeTop(){
  var snap = await getMachineSnapshot();
  var cfg = getSettingsFromUI();
  if(_isAlarmStatus(snap.status)) throw new Error('Controller is in ALARM. Clear/reset before moving to machine safe top.');
  if(!cfg.useMachineHomeRetract) throw new Error('Use Machine-Home Z Retract is disabled in Setup.');
  if(snap.homed !== true) throw new Error('Machine must be homed before moving to machine safe top Z.');
  await moveMachineZAbs(cfg.machineSafeTopZ, cfg.travelFeedRate || 600);
  var after = await getMachineSnapshot();
  updateMachineHelperUI(after);
  setFooterStatus('Moved to machine safe top Z.', 'good');
}

function loadSavedLocation(){
  try{
    var raw = localStorage.getItem(SAVED_LOCATION_KEY);
    if(!raw) return null;
    var pos = JSON.parse(raw);
    updateSavedLocationUI(pos);
    return pos;
  }catch(e){
    console.error('Failed to load saved location', e);
    return null;
  }
}

function saveSavedLocation(pos){
  try{
    localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify(pos));
    updateSavedLocationUI(pos);
  }catch(e){
    console.error('Failed to save location', e);
  }
}

async function saveCurrentLocation(){
  try{
    var info = await getMachineSnapshot();
    saveSavedLocation({x: info.x, y: info.y, z: info.z});
    updateMachineHelperUI(info);
    setFooterStatus('Current location saved.', 'good');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Saved current work position.'; el.className = 'status-line good'; }
  }catch(e){
    setFooterStatus('Error: ' + e.message, 'bad');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Save location failed: ' + e.message; el.className = 'status-line bad'; }
  }
}

async function goToSavedLocation(){
  try{
    var pos = loadSavedLocation();
    if(!pos) throw new Error('No saved location found');
    var cfg = getSettingsFromUI();
    await moveAbs(Number(pos.x), Number(pos.y), Number(pos.z), cfg.travelFeedRate || 600);
    setFooterStatus('Moved to saved location.', 'good');
    var info = await getMachineSnapshot();
    updateMachineHelperUI(info);
  }catch(e){
    setFooterStatus('Error: ' + e.message, 'bad');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Go to saved location failed: ' + e.message; el.className = 'status-line bad'; }
  }
}

async function checkHomedStatus(){
  try{
    var info = await getMachineSnapshot();
    updateMachineHelperUI(info);
    var homedText = info.homed == null ? 'unknown' : (info.homed ? 'yes' : 'no');
    var msg = 'Machine=' + (info.status || 'Unknown') + '  Homed=' + homedText + '  Probe=' + (info.probeTriggered ? 'Triggered' : 'Open');
    var cls = String(info.status || '').toLowerCase() === 'alarm' ? 'bad' : (info.homed === false ? 'warn' : 'good');
    setFooterStatus(msg, cls);
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Homed check: ' + msg; el.className = 'status-line ' + cls; }
  }catch(e){
    setFooterStatus('Error: ' + e.message, 'bad');
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Homed check failed: ' + e.message; el.className = 'status-line bad'; }
  }
}

function _parsePos(str){
  if(!str || typeof str !== 'string') return null;
  var p = str.split(',').map(function(v){ return parseFloat(v.trim()); });
  return p.length >= 3 && p.every(function(v){ return !isNaN(v); }) ? {x:p[0], y:p[1], z:p[2]} : null;
}

async function getWorkPosition(){
  var state = await _getState();
  var ms = _machineStateFrom(state);
  var status = ms.status || 'Unknown';
  var probeTriggered = (ms.Pn || '').indexOf('P') >= 0;
  var w = _parsePos(ms.WPos);
  if(w) return {x:w.x, y:w.y, z:w.z, status: status, probeTriggered: probeTriggered};
  var m = _parsePos(ms.MPos), wco = _parsePos(ms.WCO);
  if(m && wco) return {x:m.x-wco.x, y:m.y-wco.y, z:m.z-wco.z, status: status, probeTriggered: probeTriggered};
  if(m) return {x:m.x, y:m.y, z:m.z, status: status, probeTriggered: probeTriggered};
  throw new Error('Could not read current position from ncSender');
}

async function waitForIdle(){
  pluginDebug('waitForIdle ENTER');
  var _wiStart = _smTimingEnabled ? Date.now() : 0;
  var lastStatus = '';
  var pollInterval = 15; // Start with fast polling (was 30ms)
  var pollCount = 0;
  var maxPolls = 12000; // Maintain same total timeout (~180s)
  for(var i = 0; i < maxPolls; i++){
    await sleep(pollInterval);
    pollCount++;
    // Adaptive polling: start fast, slow down after initial period to reduce CPU load
    if(pollCount === 20) pollInterval = 25;
    else if(pollCount === 100) pollInterval = 35;
    checkStop();
    var state = await _getState();
    var ms = _machineStateFrom(state);
    var status = String(ms.status || '').toLowerCase();
    if(status !== lastStatus){
      pluginDebug('waitForIdle: status changed to "' + status + '" (poll #' + i + ')');
      lastStatus = status;
    }
    // When a stop has been requested AND we are NOT in a safety move, treat Hold
    // as an acceptable done state so routines exit cleanly without spinning.
    if(_stopRequested && !_safetyMoveActive && status.indexOf('hold') >= 0){
      pluginDebug('waitForIdle EXIT (stop requested, hold): returning null');
      return null;
    }
    if(status === 'idle'){
      pluginDebug('waitForIdle EXIT: idle confirmed after ' + pollCount + ' polls');
      if(_smTimingEnabled && smTimingStats){ smTimingStats.waitIdle.totalMs += Date.now() - _wiStart; smTimingStats.waitIdle.calls++; }
      var w = _parsePos(ms.WPos);
      if(w) return {x:w.x, y:w.y, z:w.z, status: status, probeTriggered: !!(ms.Pn && ms.Pn.indexOf('P') !== -1)};
      var m = _parsePos(ms.MPos), wco = _parsePos(ms.WCO);
      if(m && wco) return {x:m.x-wco.x, y:m.y-wco.y, z:m.z-wco.z, status: status, probeTriggered: !!(ms.Pn && ms.Pn.indexOf('P') !== -1)};
      if(m) return {x:m.x, y:m.y, z:m.z, status: status, probeTriggered: !!(ms.Pn && ms.Pn.indexOf('P') !== -1)};
      return null;
    }
    if(status === 'alarm'){ pluginDebug('waitForIdle ERROR: machine in alarm state'); throw new Error('Machine in alarm state'); }
  }
  pluginDebug('waitForIdle TIMEOUT: machine never reached idle');
  throw new Error('Timeout waiting for Idle');
}

async function waitForIdleWithTimeout(timeoutMs){
  var ms = (timeoutMs !== null && timeoutMs !== undefined) ? timeoutMs : 30000;
  return Promise.race([
    waitForIdle(),
    new Promise(function(_, reject){
      setTimeout(function(){ reject(new Error('waitForIdle timed out after ' + ms + 'ms')); }, ms);
    })
  ]);
}

// ── Movement helpers ──────────────────────────────────────────────────────────
async function moveAbs(x, y, z, feed){
  var cmd = 'G90 G1';
  if(x != null) cmd += ' X' + Number(x).toFixed(3);
  if(y != null) cmd += ' Y' + Number(y).toFixed(3);
  if(z != null) cmd += ' Z' + Number(z).toFixed(3);
  cmd += ' F' + Number(feed).toFixed(0);
  pluginDebug('moveAbs: ' + cmd);
  await sendCommand(cmd);
  // Brief delay to ensure the controller has started processing the command.
  // Without this, waitForIdleWithTimeout may return immediately if polled before
  // the machine transitions from idle to running state.
  await sleep(50);
  var pos = await waitForIdleWithTimeout();
  pluginDebug('moveAbs DONE: ' + cmd);
  return pos;
}

async function probeSafeMove(x, y, z, feed){
  if(x == null && y == null && z == null){ pluginDebug('probeSafeMove: no coordinates specified — skipping'); return await getWorkPosition(); }
  var cmd = 'G90 G38.3';
  if(x != null) cmd += ' X' + Number(x).toFixed(3);
  if(y != null) cmd += ' Y' + Number(y).toFixed(3);
  if(z != null) cmd += ' Z' + Number(z).toFixed(3);
  cmd += ' F' + Number(feed).toFixed(0);
  pluginDebug('probeSafeMove: ' + cmd);
  await sendCommand(cmd);
  // Brief delay to ensure the controller has started processing the command.
  await sleep(50);
  var pos = await waitForIdleWithTimeout();
  if(!pos) pos = await getWorkPosition();
  pluginDebug('probeSafeMove DONE: ' + cmd + ' probeTriggered=' + pos.probeTriggered);
  return pos;
}

async function moveMachineZAbs(z, feed){
  var cmd = 'G53 G1';
  if(z != null) cmd += ' Z' + Number(z).toFixed(3);
  if(feed != null && isFinite(Number(feed))) cmd += ' F' + Number(feed).toFixed(0);
  pluginDebug('moveMachineZAbs: ' + cmd);
  await sendCommand(cmd);
  // Brief delay to ensure the controller has started processing the command.
  await sleep(50);
  await waitForIdleWithTimeout();
  pluginDebug('moveMachineZAbs DONE: ' + cmd);
}

// ── Settings helpers ──────────────────────────────────────────────────────────
function _panelStorageKey(panelId) {
    return 'edgeProbePanel.' + panelId;
}

function _shouldPersistControl(el) {
    return el.dataset.noPersist !== '1';
}

function _getControlPersistValue(el) {
    return localStorage.getItem(_panelStorageKey(el.id));
}

function _setControlPersistValue(el, val) {
    localStorage.setItem(_panelStorageKey(el.id), val);
}

function savePanelSettings(panelElOrId) {
    const panelEl = typeof panelElOrId === 'string' ? document.getElementById(panelElOrId) : panelElOrId;
    const controls = panelEl.querySelectorAll('[data-persist]');
    controls.forEach(el => {
        if (_shouldPersistControl(el)) {
            _setControlPersistValue(el, el.value);
        }
    });
}

function loadPanelSettings(panelElOrId) {
    const panelEl = typeof panelElOrId === 'string' ? document.getElementById(panelElOrId) : panelElOrId;
    const controls = panelEl.querySelectorAll('[data-persist]');
    controls.forEach(el => {
        if (_shouldPersistControl(el)) {
            const value = _getControlPersistValue(el);
            if (value !== null) {
                el.value = value;
            }
        }
    });
}

function clearPanelSettings(panelElOrId) {
    const panelEl = typeof panelElOrId === 'string' ? document.getElementById(panelElOrId) : panelElOrId;
    const controls = panelEl.querySelectorAll('[data-persist]');
    controls.forEach(el => {
        if (_shouldPersistControl(el)) {
            localStorage.removeItem(_panelStorageKey(el.id));
        }
    });
}function _buildMeshData(){
  var sampleAxis      = (document.getElementById('sampleAxis') || {}).value || 'X';
  var topFixedCoord   = parseFloat((document.getElementById('topFixedCoord') || {}).value) || 0;
  var topSampleStart  = parseFloat((document.getElementById('topSampleStart') || {}).value) || 0;
  var topSampleEnd    = parseFloat((document.getElementById('topSampleEnd') || {}).value) || 100;
  var topSampleCount  = parseInt((document.getElementById('topSampleCount') || {}).value, 10) || 10;
  var topDirection    = (document.getElementById('topDirection') || {}).value || '+';
  return {
    pluginId: 'com.ncsender.edgeprobe.combined',
    pluginVersion: SM_VERSION,
    version: '1.7.0',
    timestamp: new Date().toISOString(),
    gridConfig: {
      sampleAxis: sampleAxis,
      topFixedCoord: topFixedCoord,
      topSampleStart: topSampleStart,
      topSampleEnd: topSampleEnd,
      topSampleCount: topSampleCount,
      topDirection: topDirection
    },
    topResults: topResults,
    faceResults: faceResults
  };
}

function saveMeshToFile(){
  try{
    var data = _buildMeshData();
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mesh_' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    var statusEl = document.getElementById('mesh-storage-status');
    if(statusEl) statusEl.textContent = 'Mesh saved to file.';
  }catch(e){
    var statusEl = document.getElementById('mesh-storage-status');
    if(statusEl) statusEl.textContent = 'Save failed: ' + e.message;
  }
}

function loadMeshFromFile(){
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      try{
        var data = JSON.parse(ev.target.result);
        if(!data.topResults) throw new Error('Missing topResults field');
        topResults = data.topResults || [];
        faceResults = data.faceResults || [];
        updateAllResultsUI();
        updateEdgeProbeStorageUI();
        var statusEl = document.getElementById('mesh-storage-status');
        if(statusEl) statusEl.textContent = 'Loaded from file: ' + topResults.length + ' top + ' + faceResults.length + ' face results.';
        pluginDebug('loadMeshFromFile: loaded top=' + topResults.length + ' face=' + faceResults.length);
      }catch(ex){
        var statusEl = document.getElementById('mesh-storage-status');
        if(statusEl) statusEl.textContent = 'Load failed: ' + ex.message;
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

function saveMeshToStorage(){
  var statusEl = document.getElementById('mesh-storage-status');
  var data;
  try {
    data = _buildMeshData();
  } catch(e) {
    if(statusEl) statusEl.textContent = 'Save failed: ' + e.message;
    return;
  }
  var jsonStr = JSON.stringify(data, null, 2);
  var today = new Date();
  var dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  var suggestedName = 'edge-probe-results-' + dateStr + '.json';

  // Also save to localStorage as backup
  var localSaved = false;
  try { localStorage.setItem(MESH_STORAGE_KEY, jsonStr); localSaved = true; } catch(e) {}
  var backupNote = localSaved ? ' (also backed up to browser storage)' : '';

  if (window.showSaveFilePicker) {
    // Preferred: native OS file save dialog (Chromium-based browsers)
    window.showSaveFilePicker({
      suggestedName: suggestedName,
      types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
    }).then(function(handle) {
      return handle.createWritable().then(function(writable) {
        return writable.write(jsonStr).then(function() {
          return writable.close();
        }).then(function() {
          if (statusEl) statusEl.textContent = '\u2705 Saved to file: ' + handle.name + backupNote;
        });
      });
    }).catch(function(err) {
      if (err.name !== 'AbortError') {
        if (statusEl) statusEl.textContent = 'Save failed: ' + err.message;
        console.error('Save edge probe results failed:', err);
      } else {
        if (statusEl) statusEl.textContent = localSaved ? 'Save cancelled (backed up to browser storage).' : 'Save cancelled.';
      }
    });
  } else {
    // Fallback: trigger download to default Downloads folder
    try {
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (statusEl) statusEl.textContent = '\u2705 Saved as ' + suggestedName + backupNote;
    } catch(e) {
      if (statusEl) statusEl.textContent = 'Save failed: ' + e.message;
    }
  }
}

function loadMeshFromStorage(){
  try{
    var raw = localStorage.getItem(MESH_STORAGE_KEY);
    if(!raw) throw new Error('No mesh found in storage');
    var data = JSON.parse(raw);
    if(!data.topResults) throw new Error('Missing topResults field');
    topResults = data.topResults || [];
    faceResults = data.faceResults || [];
    updateAllResultsUI();
    updateEdgeProbeStorageUI();
    var statusEl = document.getElementById('mesh-storage-status');
    if(statusEl) statusEl.textContent = 'Loaded from storage: ' + topResults.length + ' top + ' + faceResults.length + ' face results.';
    pluginDebug('loadMeshFromStorage: loaded top=' + topResults.length + ' face=' + faceResults.length);
  }catch(e){
    var statusEl = document.getElementById('mesh-storage-status');
    if(statusEl) statusEl.textContent = 'Load failed: ' + e.message;
  }
}

function clearMeshStorage(){
  localStorage.removeItem(MESH_STORAGE_KEY);
  var statusEl = document.getElementById('mesh-storage-status');
  if(statusEl) statusEl.textContent = 'Stored mesh cleared.';
  updateEdgeProbeStorageUI();
  pluginDebug('clearMeshStorage: edge probe localStorage cleared');
}

// ── Initialise ────────────────────────────────────────────────────────────────
// ── Surface Mesh State ────────────────────────────────────────────────────────
var smMeshData = null;
var smGridConfig = null;
var smMeshDataRaw = null;    // original sparse surface grid (pre-subdivision)
var smGridConfigRaw = null;  // original grid config (pre-subdivision)
var smLastInsetPolygon = null; // inset polygon used by the last Outline Surface Grid Probe run
var smOriginalGcode = null;
var smCompensatedGcode = null;
var smStopFlag = false;
var SM_MESH_KEY = '3dmesh.combined.mesh';
var SM_SETTINGS_KEY = '3dmesh.combined.settings';
// ── Combined Mode State ───────────────────────────────────────────────────────
var combinedMeshPoints = null; // unified array: [{x,y,z,source:'surface'|'face'}]
var _smProbingCompleteCallback = null; // set by combined mode to chain face probe after surface probe
var _smSkipFinishMotion = false; // set by combined mode to skip smFinishMotion home detour between phases
// ── Probe Sequence Recording ──────────────────────────────────────────────────
var smPvizProbeSequence = [];
var _smPvizSeqLastTime = 0;
// ── Surface Probe Timing Instrumentation ──────────────────────────────────────
// Accumulates timing/count data during a surface probing run.
// Reset by runSurfaceProbing(); read at the end to emit a [TIMING] summary.
var smTimingStats = null;
var _smTimingEnabled = false; // true only during an active surface probing run

var SM_SURFACE_GRID_SETTINGS_KEY = 'smSurfaceGridSettings';


// ── Face Probe Tab — sample builder from config fields ────────────────────────

function fpBuildFaceSamplesFromConfig() {
  var xStart = Number((document.getElementById('fp-xStart') || {}).value);
  var xEnd   = Number((document.getElementById('fp-xEnd') || {}).value);
  var xPts   = fpGetEffectiveXPoints();
  if (!isFinite(xStart) || !isFinite(xEnd)) return null;
  var range = xEnd - xStart;
  var step = range / (xPts - 1);
  var samples = [];
  for (var i = 0; i < xPts; i++) {
    var xPos = xStart + i * step;
    var topZ = 0;
    if (smMeshData && smGridConfig) {
      topZ = bilinearInterpolateZ(smMeshData, smGridConfig, xPos, smGridConfig.minY) || 0;
    }
    samples.push({ index: i + 1, sampleCoord: xPos, topZ: topZ });
  }
  return samples;
}

// Returns the effective number of face probe X points, honoring the auto-spacing
// toggle (fp-xAutoSpacing). When the toggle is on, computes xPoints from the
// target spacing and the configured face width [fp-xStart, fp-xEnd], clamped to
// [2, 50]. When off, reads fp-xPoints directly.
function fpGetEffectiveXPoints() {
  var autoEl = document.getElementById('fp-xAutoSpacing');
  if (autoEl && autoEl.checked) {
    var xStart  = Number((document.getElementById('fp-xStart')        || {}).value);
    var xEnd    = Number((document.getElementById('fp-xEnd')          || {}).value);
    var spacing = Number((document.getElementById('fp-xTargetSpacing') || {}).value) || 2;
    if (!isFinite(xStart) || !isFinite(xEnd) || xStart === xEnd) {
      return Math.max(2, Math.round(Number((document.getElementById('fp-xPoints') || {}).value) || 5));
    }
    var widthMm = Math.abs(xEnd - xStart);
    spacing = Math.max(0.5, spacing);
    var nIntervals = Math.max(1, Math.round(widthMm / spacing));
    var xPts = nIntervals + 1;
    var clamped = false;
    if (xPts < 2)  { xPts = 2;  clamped = true; }
    if (xPts > 50) { xPts = 50; clamped = true; }
    // Update the fp-xPoints display to reflect computed value
    var xPtsEl = document.getElementById('fp-xPoints');
    if (xPtsEl) xPtsEl.value = xPts;
    // Update status note
    var statusEl = document.getElementById('fp-xAutoSpacing-status');
    if (statusEl) {
      var effectiveSpacing = widthMm / (xPts - 1);
      var msg = xPts + ' X points (effective spacing: ' + effectiveSpacing.toFixed(2) + ' mm)';
      if (clamped) msg += ' — clamped to ' + xPts + ' (limit: 2–50)';
      statusEl.textContent = msg;
      statusEl.style.color = clamped ? 'var(--accent2)' : 'var(--muted)';
    }
    return xPts;
  }
  return Math.max(2, Math.round(Number((document.getElementById('fp-xPoints') || {}).value) || 5));
}

// Shows/hides the target-spacing field and refreshes the computed point count.
function fpUpdateAutoSpacingUI() {
  var autoEl   = document.getElementById('fp-xAutoSpacing');
  var fieldEl  = document.getElementById('fp-xTargetSpacing-field');
  var xPtsEl   = document.getElementById('fp-xPoints');
  var isAuto   = autoEl && autoEl.checked;
  if (fieldEl)  fieldEl.style.display  = isAuto ? '' : 'none';
  if (xPtsEl)   xPtsEl.readOnly        = isAuto;
  if (xPtsEl)   xPtsEl.style.opacity   = isAuto ? '0.5' : '';
  if (isAuto) fpGetEffectiveXPoints(); // trigger status update
  else {
    var statusEl = document.getElementById('fp-xAutoSpacing-status');
    if (statusEl) statusEl.textContent = '';
  }
  fpUpdateCombinedFacePlanStatus();
}

// Updates the Combined mode status line that summarises the planned face probe phase.
// Called whenever any face-probe config setting changes that affects the plan.
function fpUpdateCombinedFacePlanStatus() {
  var el = document.getElementById('combined-face-plan-status');
  if (!el) return;
  var xPts = fpGetEffectiveXPoints();
  var autoEl = document.getElementById('fp-xAutoSpacing');
  var isAuto = autoEl && autoEl.checked;
  var spacingInfo = '';
  if (isAuto) {
    var xStartEl = document.getElementById('fp-xStart');
    var xEndEl   = document.getElementById('fp-xEnd');
    var xStart   = Number((xStartEl || {}).value);
    var xEnd     = Number((xEndEl   || {}).value);
    if (isFinite(xStart) && isFinite(xEnd) && xStart !== xEnd) {
      var effectiveSpacing = Math.abs(xEnd - xStart) / Math.max(1, xPts - 1);
      spacingInfo = ', spacing \u2248 ' + effectiveSpacing.toFixed(2) + ' mm';
    }
  }
  var topModeEl = document.getElementById('fp-topRefMode');
  var topMode   = (topModeEl && topModeEl.value === 'endpoints') ? 'endpoints only' : 'every column';
  var layerEl   = document.getElementById('enableLayeredFace');
  var isLayered = layerEl && layerEl.checked;
  var layerCountEl = document.getElementById('faceLayerCount');
  var layerCount   = isLayered ? (Math.max(2, Math.round(Number((layerCountEl || {}).value) || 3))) : 1;
  var layerInfo    = isLayered ? (layerCount + ' layers') : '1 layer (single pass)';
  el.textContent = 'Face phase plan: X points = ' + xPts +
    (isAuto ? ' (auto spacing ON' + spacingInfo + ')' : ' (manual)') +
    ' \u00b7 ' + layerInfo +
    ' \u00b7 top ref = ' + topMode;
}

function calcProbeAutoTotalLength(){
  var upper = Number((document.getElementById('probeUpperHeight')||{}).value || 0);
  var main = Number((document.getElementById('probeMainBodyHeight')||{}).value || 0);
  var stylus = Number((document.getElementById('probeStylusLength')||{}).value || 0);
  var total = upper + main + stylus;
  var autoEl = document.getElementById('probeAutoTotalLength');
  if(autoEl) autoEl.value = total.toFixed(3);
  return total;
}

function updateProbeDimensionPreview(){
  var pairs = [
    ['probeShankDiameter','probeLabelShank'],
    ['probeBodyDiameter','probeLabelBody'],
    ['probeUpperHeight','probeLabelUpper'],
    ['probeMainBodyHeight','probeLabelMain'],
    ['probeStylusLength','probeLabelStylus'],
    ['probeStylusCalloutLength','probeLabelStylusCallout'],
    ['probeBallTipDiameter','probeLabelBall'],
    ['probeTotalLength','probeLabelTotal']
  ];
  pairs.forEach(function(pair){
    var input = document.getElementById(pair[0]);
    var label = document.getElementById(pair[1]);
    if(input && label){
      var raw = input.value || '0';
      var v = Number(raw);
      label.textContent = isFinite(v) ? String(v) : raw;
    }
  });
}

function applyProbeDimensionSettings(s){
  if(!s) return;
  var map = {
    probeShankDiameter:'probeShankDiameter',
    probeBodyDiameter:'probeBodyDiameter',
    probeUpperHeight:'probeUpperHeight',
    probeMainBodyHeight:'probeMainBodyHeight',
    probeStylusLength:'probeStylusLength',
    probeStylusCalloutLength:'probeStylusCalloutLength',
    probeBallTipDiameter:'probeBallTipDiameter',
    probeTotalLength:'probeTotalLength'
  };
  Object.keys(map).forEach(function(k){
    var el = document.getElementById(map[k]);
    if(el && s[k] != null && s[k] !== '') el.value = s[k];
  });
  calcProbeAutoTotalLength();
  updateProbeDimensionPreview();
}

var PROBE_DIM_IDS = ['probeShankDiameter','probeBodyDiameter','probeUpperHeight','probeUpperLength','probeMainBodyHeight','probeLowerLength','probeStylusLength','probeStylusCalloutLength','probeBallTipDiameter','probeTipBallDiameter','probeTotalLength'];

function saveProbeDimensions(){
  try{
    var data = {};
    PROBE_DIM_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if(el) data[id] = el.value;
    });
    localStorage.setItem(PROBE_DIMENSIONS_KEY, JSON.stringify(data));
    var el = document.getElementById('probe-dims-status');
    if(el){ el.textContent = 'Probe dimensions saved.'; el.className = 'status-line good'; }
    setTimeout(function(){ if(el){ el.textContent = ''; el.className = 'status-line'; } }, 2500);
  }catch(e){ console.error('saveProbeDimensions error:', e); }
}

function loadProbeDimensions(){
  try{
    var raw = localStorage.getItem(PROBE_DIMENSIONS_KEY);
    if(!raw) return;
    var data = JSON.parse(raw);
    PROBE_DIM_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if(el && data[id] != null && data[id] !== '') el.value = data[id];
    });
    calcProbeAutoTotalLength();
    updateProbeDimensionPreview();
  }catch(e){ console.error('loadProbeDimensions error:', e); }
}

function bindProbeDimensionUI(){
  PROBE_DIM_IDS.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('input', function(){
      calcProbeAutoTotalLength();
      updateProbeDimensionPreview();
    });
    if(el) el.addEventListener('change', function(){
      calcProbeAutoTotalLength();
      updateProbeDimensionPreview();
    });
  });
  var btn = document.getElementById('calcProbeTotalBtn');
  if(btn){
    btn.addEventListener('click', function(){
      flashButton(this);
      var total = calcProbeAutoTotalLength();
      var totalEl = document.getElementById('probeTotalLength');
      if(totalEl) totalEl.value = total.toFixed(3);
      updateProbeDimensionPreview();
    });
  }
  calcProbeAutoTotalLength();
  updateProbeDimensionPreview();

  // Surface mesh buttons
  try {
    document.getElementById('sm-btn-save-mesh').addEventListener('click', function(){ flashSaveButton(this); pluginDebug('sm-btn-save-mesh clicked'); saveSurfaceMesh(); });
    document.getElementById('sm-btn-load-mesh').addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-load-mesh clicked'); loadSurfaceMesh(); });
    document.getElementById('sm-btn-export-mesh').addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-export-mesh clicked'); exportSurfaceMesh(); });
    document.getElementById('sm-btn-export-mesh-csv').addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-export-mesh-csv clicked'); exportSurfaceMeshCSV(); });
    document.getElementById('sm-btn-import-mesh').addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-import-mesh clicked'); importSurfaceMesh(); });
    document.getElementById('sm-btn-clear-mesh').addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-clear-mesh clicked'); clearSurfaceMesh(); });
    document.getElementById('sm-btn-save-replay-html').addEventListener('click', function(){ flashSaveButton(this); pluginDebug('sm-btn-save-replay-html clicked'); smSaveReplayHtml(); });
  } catch(e){}

  // Combined mesh buttons
  try {
    document.getElementById('comb-btn-save-mesh').addEventListener('click', function(){ flashSaveButton(this); pluginDebug('comb-btn-save-mesh clicked'); saveCombinedMesh(); });
    document.getElementById('comb-btn-export-csv').addEventListener('click', function(){ flashButton(this); pluginDebug('comb-btn-export-csv clicked'); exportCombinedMeshCSV(); });
    document.getElementById('comb-btn-export-json').addEventListener('click', function(){ flashButton(this); pluginDebug('comb-btn-export-json clicked'); exportCombinedMeshJSON(); });
    document.getElementById('comb-btn-clear-mesh').addEventListener('click', function(){ flashButton(this); pluginDebug('comb-btn-clear-mesh clicked'); clearCombinedMesh(); });
    var combDataClearBtn = document.getElementById('comb-data-btn-clear');
    if (combDataClearBtn) combDataClearBtn.addEventListener('click', function(){ flashButton(this); pluginDebug('comb-data-btn-clear clicked'); clearCombinedMesh(); smLogProbe('Combined results cleared.'); });
  } catch(e){}

  // Results tab Save 3D View button
  try {
    document.getElementById('res-btn-save-3d').addEventListener('click', function(){ flashSaveButton(this); save3DViewPNG(); });
  } catch(e){}

  // Results tab Face 3D View — save and reset buttons
  try {
    var resfaceSaveBtn = document.getElementById('resface-btn-save-3d');
    if (resfaceSaveBtn) resfaceSaveBtn.addEventListener('click', function() {
      flashSaveButton(this);
      var s = _threeState['resface'];
      if (s && s.renderer) {
        s.renderer.render(s.scene, s.camera);
        var dataURL = s.renderer.domElement.toDataURL('image/png');
        var link = document.createElement('a');
        link.download = 'face-3d-view.png';
        link.href = dataURL;
        link.click();
      }
    });
    var resfaceResetBtn = document.getElementById('resface-pviz-reset-btn');
    if (resfaceResetBtn) resfaceResetBtn.addEventListener('click', function() { resFaceVizResetView(); });
  } catch(e){}

  // Grid size display updates
  try {
    ['sm-minX','sm-maxX','sm-spacingX','sm-minY','sm-maxY','sm-spacingY'].forEach(function(id) {
      document.getElementById(id).addEventListener('input', updateSurfaceGridSizeDisplay);
    });
    updateSurfaceGridSizeDisplay();
  } catch(e){}

  // Do NOT auto-load saved mesh on startup — Mesh Data tab starts empty on each restart.
  // User can manually restore a saved mesh via the Load Mesh button if needed.
  // try { loadSurfaceMesh(); } catch(e){}

  // G-code file reader (legacy sm-gcodeFile — no longer in DOM after Apply tab redesign, kept for safety)
  try {
    var legacyGcodeFile = document.getElementById('sm-gcodeFile');
    if (legacyGcodeFile) legacyGcodeFile.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        smOriginalGcode = ev.target.result;
        var span = document.getElementById('sm-gcode-file-status');
        if (span) span.textContent = 'Loaded: ' + file.name + ' (' + smOriginalGcode.split('\n').length + ' lines)';
      };
      reader.readAsText(file);
    });
  } catch(e){}

  // Apply tab: G-code file input
  try {
    var applyGcodeFileInput = document.getElementById('apply-gcode-file-input');
    if (applyGcodeFileInput) applyGcodeFileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        applyOriginalGcode = ev.target.result;
        var statusEl = document.getElementById('apply-gcode-status');
        if (statusEl) {
          statusEl.textContent = 'Loaded: ' + file.name + ' (' + applyOriginalGcode.split('\n').length + ' lines)';
          statusEl.className = 'status-line good';
        }
        applyUpdateButtons();
      };
      reader.readAsText(file);
    });
  } catch(e){}

  // Apply tab: initialize button states
  try { applyUpdateButtons(); } catch(e) {}

  // Allow free manual keyboard entry in all non-readonly number inputs.
  // Remove min/max permanently (not restored on blur) so that clearing a field
  // does not cause Chromium/Electron to snap the value back to the min value.
  // Stop keyboard event propagation so the host application (ncSender/Electron)
  // cannot intercept keystrokes that belong to the focused input field.
  Array.prototype.forEach.call(document.querySelectorAll('input[type="number"]:not([readonly])'), function(el) {
    el.step = 'any';
    el.removeAttribute('min');
    el.removeAttribute('max');
    el.addEventListener('keydown',  function(e) { e.stopPropagation(); });
    el.addEventListener('keypress', function(e) { e.stopPropagation(); });
    el.addEventListener('keyup',    function(e) { e.stopPropagation(); });
  });

}

// ── Clear all probe and mesh data on plugin close/exit ────────────────────────
function pluginCleanupOnClose() {
  try {
    // Clear in-memory logs
    topLogLines = [];
    faceLogLines = [];
    // Clear in-memory probe results
    topResults = [];
    faceResults = [];
    layeredFaceResults = [];
    // Clear in-memory mesh data
    smMeshData = null;
    smGridConfig = null;
    combinedMeshPoints = null;
    // Clear persisted logs from localStorage
    localStorage.removeItem(FACE_LOG_KEY);
    // Clear persisted probe results from localStorage
    clearPersistedProbeResults();
    // Clear persisted surface mesh data from localStorage
    localStorage.removeItem(SM_MESH_KEY);
    localStorage.removeItem(MESH_STORAGE_KEY);
    // Clear persisted face mesh data from localStorage
    localStorage.removeItem(FACE_MESH_STORAGE_KEY);
    // Reset Results tab DOM to empty state
    var ut = document.getElementById('res-unified-tbody');
    if (ut) ut.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:16px;">No probe data yet</td></tr>';
    var rsp = document.getElementById('res-surface-panel');
    if (rsp) rsp.style.display = 'none';
    var rfp = document.getElementById('res-face-panel');
    if (rfp) rfp.style.display = 'none';
    var rSurfRelief = document.getElementById('res-surface-relief-panel');
    if (rSurfRelief) rSurfRelief.style.display = 'none';
    var rFaceRelief = document.getElementById('res-face-relief-panel');
    if (rFaceRelief) rFaceRelief.style.display = 'none';
    // Reset Mesh Data tab — surface mesh table
    var smTbody = document.getElementById('sm-meshTableBody');
    if (smTbody) smTbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:16px;">No data yet</td></tr>';
    var smVizStatus = document.getElementById('sm-meshVizStatus');
    if (smVizStatus) smVizStatus.textContent = 'No mesh data — run a surface probe or load a mesh';
    // Reset Mesh Data tab — face mesh table
    var faceTbody = document.getElementById('face-meshTableBody');
    if (faceTbody) faceTbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:16px;">No data yet</td></tr>';
    var faceVizStatus = document.getElementById('face-meshVizStatus');
    if (faceVizStatus) faceVizStatus.textContent = 'No face mesh data — run a face probe or load face mesh';
    // Reset combined mesh panel
    var combTbody = document.getElementById('comb-mesh-tbody');
    if (combTbody) combTbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:16px;">No combined data yet</td></tr>';
  } catch(e) {}
  // Dispose Three.js resources to prevent memory leaks
  try {
    Object.keys(_threeState).forEach(function(prefix) { _threeDispose(prefix); });
  } catch(e) {}
}

// NOTE: pluginCleanupOnClose() does NOT send any machine commands.
// It only clears in-memory data, localStorage probe results, and Three.js
// GPU resources.  We intentionally do NOT attach this to 'beforeunload'
// because some plugin host environments (e.g. ncSender) interpret a
// beforeunload event from the plugin panel as a full disconnect/reset,
// which can clear the controller's homed state even when the user only
// closed the UI panel after successfully unlocking with $X.
// Cleanup is triggered explicitly by the plugin host via index.js onUnload.


