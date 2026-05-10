// ── Tool Change & Re-Zero Helper ──────────────────────────────────────────────
// Helps users save their reference probe position and return to it after
// changing from touch probe to cutting bit, ensuring Z0 alignment.
// ──────────────────────────────────────────────────────────────────────────────

var _toolChangeRefPos = null;  // {x, y, z} saved reference position
var _toolChangeZReZeroed = false;  // flag indicating Z has been re-zeroed

function _toolChangeResolveSurfaceSearchDepth(cfg) {
  // Read probe feed from Outline tab first so tool-change re-zero matches the
  // same probe feed users expect from outline surface probing.
  var outlineProbeFeedEl = document.getElementById('outlineProbeFeed');
  var probeFeed = (outlineProbeFeedEl && Number(outlineProbeFeedEl.value) > 0)
    ? Number(outlineProbeFeedEl.value)
    : (cfg.probeFeed || 100);

  // Mirror the Outline tab surface reference probe search-depth logic.
  var surfProbeDepthModeEl = document.getElementById('outlineSurfProbeDepthMode');
  var surfProbeDepthMode = (surfProbeDepthModeEl && surfProbeDepthModeEl.value === 'custom') ? 'custom' : 'auto';
  var machineZTravelEl = document.getElementById('outlineMachineZTravel');
  var machineZTravel = Math.max(10, (machineZTravelEl ? Number(machineZTravelEl.value) : 0) || 165);
  var customPlungeEl = document.getElementById('outlineSurfRefMaxPlunge');
  var customPlunge = Math.max(10, (customPlungeEl ? Number(customPlungeEl.value) : 0) || 200);
  var allowedMax = Math.max(10, machineZTravel - 5);
  var maxPlunge;
  var depthSummary;

  if (surfProbeDepthMode === 'auto') {
    maxPlunge = allowedMax;
    depthSummary = 'Surface search depth: Auto — machineZTravel=' +
      machineZTravel.toFixed(0) + ', effective=' + maxPlunge.toFixed(0) + 'mm';
  } else {
    maxPlunge = Math.min(customPlunge, allowedMax);
    depthSummary = 'Surface search depth: Custom — ' + customPlunge.toFixed(0) + 'mm' +
      (customPlunge > allowedMax ? ' (clamped to ' + maxPlunge.toFixed(0) + 'mm)' : '');
  }

  return {
    probeFeed: probeFeed,
    maxPlunge: maxPlunge,
    depthSummary: depthSummary
  };
}

// Load saved reference position from localStorage on startup
(function _toolChangeLoadSaved() {
  try {
    var saved = localStorage.getItem('toolChangeRefPos');
    if (saved) {
      _toolChangeRefPos = JSON.parse(saved);
      _toolChangeUpdateUI();
    }
  } catch (e) {
    console.warn('[tool-change] Could not load saved reference position:', e);
  }
})();

// ── Save Current Position as Reference ────────────────────────────────────────
async function toolChangeSaveReference() {
  var statusEl = document.getElementById('tool-change-status');
  try {
    setFooterStatus('Reading current position...', 'ok');

    var snapshot = await getMachineSnapshot();
    if (!snapshot || snapshot.x == null || snapshot.y == null || snapshot.z == null) {
      throw new Error('Could not read current position. Ensure machine is connected and homed.');
    }

    _toolChangeRefPos = {
      x: snapshot.x,
      y: snapshot.y,
      z: snapshot.z
    };
    _toolChangeZReZeroed = false;

    // Save to localStorage
    try {
      localStorage.setItem('toolChangeRefPos', JSON.stringify(_toolChangeRefPos));
    } catch (e) {
      console.warn('[tool-change] Could not save to localStorage:', e);
    }

    _toolChangeUpdateUI();

    if (statusEl) {
      statusEl.textContent = 'Reference position saved: X' + _toolChangeRefPos.x.toFixed(3) +
                            ' Y' + _toolChangeRefPos.y.toFixed(3) +
                            ' Z' + _toolChangeRefPos.z.toFixed(3);
      statusEl.className = 'status-line good';
    }
    setFooterStatus('Reference position saved successfully.', 'ok');

    // Update workflow checklist
    _toolChangeUpdateWorkflowStep(2, true);

  } catch (e) {
    if (statusEl) {
      statusEl.textContent = 'Error: ' + e.message;
      statusEl.className = 'status-line bad';
    }
    setFooterStatus('Error saving reference position: ' + e.message, 'bad');
  }
}

// ── Move to Reference XY Position (without probing) ──────────────────────────
async function toolChangeMoveToReference() {
  if (!_toolChangeRefPos) {
    alert('No reference position saved. Click "Save Current Position" first.');
    return;
  }

  var statusEl = document.getElementById('tool-change-status');

  var confirmed = confirm(
    'This will move to the saved reference position:\n' +
    'X' + _toolChangeRefPos.x.toFixed(3) + ' Y' + _toolChangeRefPos.y.toFixed(3) + '\n\n' +
    'Make sure:\n' +
    '✓ Path is clear for safe travel\n' +
    '✓ Machine is ready to move\n\n' +
    'Continue?'
  );

  if (!confirmed) return;

  try {
    // Preflight: abort if controller is in ALARM, machine is not homed, or probe is triggered
    await requireStartupHomingPreflight('tool change move to reference');

    setFooterStatus('Moving to reference position...', 'ok');
    if (statusEl) {
      statusEl.textContent = 'Moving to reference XY position...';
      statusEl.className = 'status-line';
    }

    var cfg = getSettingsFromUI();
    var retractFeed = Math.max(100, cfg.travelFeedRate || 600);
    var machineSafeZ = isFinite(Number(cfg.machineSafeTopZ)) ? Number(cfg.machineSafeTopZ) : null;

    // Step 1: Raise to safe travel height using machine coordinates to avoid soft-limit
    // ALARM:2.  G53 overrides the active WCS for this one block, so the move is always
    // within travel limits regardless of the current WCO offset.
    if (machineSafeZ !== null) {
      await sendCommand('G53 G1 Z' + machineSafeZ.toFixed(3) + ' F' + retractFeed.toFixed(0));
      await sleep(50);
      await _waitForIdleOrStop(10000);
    } else {
      // Fallback: relative lift when machineSafeTopZ is not configured
      await sendCommand('G91 G1 Z10 F' + retractFeed.toFixed(0));
      await sleep(100);
      await _waitForIdleOrStop(15000);
      await sendCommand('G90');  // Restore absolute mode
    }
    // Ensure absolute work-coordinate mode for XY travel
    await sendCommand('G90');
    await sleep(20);

    setFooterStatus('Moving to XY reference...', 'ok');

    // Step 2: Move to XY reference position
    await sendCommand('G0 X' + _toolChangeRefPos.x.toFixed(3) +
                     ' Y' + _toolChangeRefPos.y.toFixed(3) +
                     ' F' + retractFeed.toFixed(0));
    await sleep(50);
    await _waitForIdleOrStop(15000);

    if (statusEl) {
      statusEl.textContent = 'At reference position. Use jog controls or "Return & Re-Zero Z" to probe and set Z0.';
      statusEl.className = 'status-line good';
    }
    setFooterStatus('Successfully moved to reference XY position.', 'ok');

  } catch (e) {
    if (statusEl) {
      statusEl.textContent = 'Error: ' + e.message;
      statusEl.className = 'status-line bad';
    }
    setFooterStatus('Error moving to reference: ' + e.message, 'bad');
  }
}

// ── Return to Reference Position and Re-Zero Z ────────────────────────────────
async function toolChangeReturnAndReZero() {
  if (!_toolChangeRefPos) {
    alert('No reference position saved. Click "Save Current Position" first.');
    return;
  }

  var statusEl = document.getElementById('tool-change-status');
  var cfg = getSettingsFromUI();
  var probeSettings = _toolChangeResolveSurfaceSearchDepth(cfg);

  var confirmed = confirm(
    'This will:\n' +
    '1. Move to X' + _toolChangeRefPos.x.toFixed(3) + ' Y' + _toolChangeRefPos.y.toFixed(3) + '\n' +
    '2. Probe down to find the surface (max plunge ' + probeSettings.maxPlunge.toFixed(3) + 'mm)\n' +
    '   ' + probeSettings.depthSummary + '\n' +
    '3. Set Z0 at that surface\n\n' +
    'Make sure:\n' +
    '✓ Touch probe removed, cutting bit installed\n' +
    '✓ Path is clear for safe travel\n' +
    '✓ Machine is ready to move\n\n' +
    'Continue?'
  );

  if (!confirmed) return;

  try {
    // Preflight: abort if controller is in ALARM, machine is not homed, or probe is triggered
    await requireStartupHomingPreflight('tool change return & re-zero');

    if (statusEl) {
      statusEl.textContent = probeSettings.depthSummary;
      statusEl.className = 'status-line';
    }
    setFooterStatus(probeSettings.depthSummary, 'ok');
    pluginDebug('[tool-change] ' + probeSettings.depthSummary);

    setFooterStatus('Returning to reference position...', 'ok');
    if (statusEl) {
      statusEl.textContent = 'Moving to reference position...';
      statusEl.className = 'status-line';
    }

    var retractFeed = Math.max(100, cfg.travelFeedRate || 600);
    var machineSafeZ = isFinite(Number(cfg.machineSafeTopZ)) ? Number(cfg.machineSafeTopZ) : null;

    // Step 1: Raise to safe travel height using machine coordinates to avoid soft-limit
    // ALARM:2.  G53 overrides the active WCS for this one block, so the move is always
    // within travel limits regardless of the current WCO offset.
    if (machineSafeZ !== null) {
      await sendCommand('G53 G1 Z' + machineSafeZ.toFixed(3) + ' F' + retractFeed.toFixed(0));
      await sleep(50);
      await _waitForIdleOrStop(10000);
    } else {
      // Fallback: relative lift when machineSafeTopZ is not configured
      await sendCommand('G91 G1 Z10 F' + retractFeed.toFixed(0));
      await sleep(100);
      await _waitForIdleOrStop(15000);
      await sendCommand('G90');  // Restore absolute mode
    }
    // Ensure absolute work-coordinate mode for XY travel
    await sendCommand('G90');
    await sleep(20);

    setFooterStatus('Moving to XY reference...', 'ok');

    // Step 2: Move to XY reference position
    await sendCommand('G0 X' + _toolChangeRefPos.x.toFixed(3) +
                     ' Y' + _toolChangeRefPos.y.toFixed(3) +
                     ' F' + retractFeed.toFixed(0));
    await sleep(50);
    await _waitForIdleOrStop(15000);

    if (statusEl) {
      statusEl.textContent = 'At reference position, probing surface to set Z0...';
      statusEl.className = 'status-line';
    }
    setFooterStatus('Probing surface to establish Z0...', 'ok');

    // Step 3: Probe down to find surface using the same Outline tab surface
    // search-depth mode users configure for the dedicated surface reference probe.
    var probeFeed = probeSettings.probeFeed;
    var maxPlunge = probeSettings.maxPlunge;

    // Ensure probe is not triggered before plunge
    var preSnap = await getMachineSnapshot();
    if (preSnap.probeTriggered) {
      throw new Error('Probe is already triggered. Clear probe before re-zeroing Z.');
    }

    // Probe down
    await sendCommand('G91');  // Relative mode
    await sleep(20);
    await sendCommand('G38.2 Z-' + maxPlunge.toFixed(3) + ' F' + probeFeed.toFixed(0));
    await sleep(100);
    await _waitForIdleOrStop(20000);
    // Restore absolute mode immediately after probe completes to clear any error state
    // (matches pattern in smPlungeProbe - G90 must be sent before probe validation to
    // ensure retraction can execute even if probe errors occur)
    await sendCommand('G90');  // Back to absolute mode
    await sleep(20);

    // Check probe triggered
    var postSnap = await getMachineSnapshot();
    if (!postSnap.probeTriggered) {
      throw new Error('Probe did not trigger. Check probe connection and surface height.');
    }

    // Step 4: Retract slightly BEFORE setting Z0 to ensure probe clears surface
    // This prevents issues if Z0 setting fails or errors occur
    await sendCommand('G91');
    await sleep(20);
    await sendCommand('G0 Z2 F' + (cfg.travelFeedRate || 1200));
    await sleep(50);
    await _waitForIdleOrStop(5000);
    await sendCommand('G90');
    await sleep(20);

    // Step 5: Set Z0 at 2mm above contact (account for retraction)
    // We retracted 2mm, so set Z to 2.0 to make the contact point Z=0
    await sendCommand('G10 L20 P0 Z2.0');
    await sleep(100);

    _toolChangeZReZeroed = true;
    _toolChangeUpdateUI();

    if (statusEl) {
      statusEl.textContent = 'Z0 successfully established at reference position!';
      statusEl.className = 'status-line good';
    }
    setFooterStatus('Tool change complete - Z0 re-zeroed successfully!', 'ok');

    // Update workflow checklist
    _toolChangeUpdateWorkflowStep(4, true);

  } catch (e) {
    if (statusEl) {
      statusEl.textContent = 'Error: ' + e.message;
      statusEl.className = 'status-line bad';
    }
    setFooterStatus('Error during return and re-zero: ' + e.message, 'bad');
  }
}

// ── Update UI Elements ────────────────────────────────────────────────────────
function _toolChangeUpdateUI() {
  var displayEl = document.getElementById('tool-change-ref-display');
  var moveBtn = document.getElementById('tool-change-move-btn');
  var returnBtn = document.getElementById('tool-change-return-btn');

  if (_toolChangeRefPos) {
    if (displayEl) {
      var zeroStatus = _toolChangeZReZeroed ?
        ' <span style="color:var(--good)">✓ Z re-zeroed</span>' :
        ' <span style="color:var(--warn)">⚠ Z not yet re-zeroed</span>';
      displayEl.innerHTML =
        'X: ' + _toolChangeRefPos.x.toFixed(3) + 'mm<br>' +
        'Y: ' + _toolChangeRefPos.y.toFixed(3) + 'mm<br>' +
        'Z: ' + _toolChangeRefPos.z.toFixed(3) + 'mm' + zeroStatus;
    }
    if (moveBtn) {
      moveBtn.disabled = false;
    }
    if (returnBtn) {
      returnBtn.disabled = false;
    }
  } else {
    if (displayEl) {
      displayEl.innerHTML = 'No reference position saved yet';
    }
    if (moveBtn) {
      moveBtn.disabled = true;
    }
    if (returnBtn) {
      returnBtn.disabled = true;
    }
  }
}

// ── Update Workflow Checklist Step ────────────────────────────────────────────
function _toolChangeUpdateWorkflowStep(stepNum, completed) {
  var stepEl = document.getElementById('workflow-step' + stepNum);
  if (!stepEl) return;

  var text = stepEl.textContent;
  if (completed) {
    stepEl.innerHTML = text.replace('&#9744;', '&#9745;').replace('☐', '☑');
    stepEl.style.color = 'var(--good)';
  } else {
    stepEl.innerHTML = text.replace('&#9745;', '&#9744;').replace('☑', '☐');
    stepEl.style.color = 'var(--muted)';
  }
}

// ── Clear Reference (for testing/reset) ───────────────────────────────────────
function toolChangeClearReference() {
  _toolChangeRefPos = null;
  _toolChangeZReZeroed = false;
  try {
    localStorage.removeItem('toolChangeRefPos');
  } catch (e) {}
  _toolChangeUpdateUI();
  var statusEl = document.getElementById('tool-change-status');
  if (statusEl) {
    statusEl.textContent = 'Reference position cleared.';
    statusEl.className = 'status-line';
  }
}
