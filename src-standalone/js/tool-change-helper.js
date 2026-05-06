// ── Tool Change & Re-Zero Helper ──────────────────────────────────────────────
// Helps users save their reference probe position and return to it after
// changing from touch probe to cutting bit, ensuring Z0 alignment.
// ──────────────────────────────────────────────────────────────────────────────

var _toolChangeRefPos = null;  // {x, y, z} saved reference position
var _toolChangeZReZeroed = false;  // flag indicating Z has been re-zeroed

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

// ── Return to Reference Position and Re-Zero Z ────────────────────────────────
async function toolChangeReturnAndReZero() {
  if (!_toolChangeRefPos) {
    alert('No reference position saved. Click "Save Current Position" first.');
    return;
  }

  var statusEl = document.getElementById('tool-change-status');

  var confirmed = confirm(
    'This will:\n' +
    '1. Move to X' + _toolChangeRefPos.x.toFixed(3) + ' Y' + _toolChangeRefPos.y.toFixed(3) + '\n' +
    '2. Probe down to find the surface\n' +
    '3. Set Z0 at that surface\n\n' +
    'Make sure:\n' +
    '✓ Touch probe removed, cutting bit installed\n' +
    '✓ Path is clear for safe travel\n' +
    '✓ Machine is ready to move\n\n' +
    'Continue?'
  );

  if (!confirmed) return;

  try {
    setFooterStatus('Returning to reference position...', 'ok');
    if (statusEl) {
      statusEl.textContent = 'Moving to reference position...';
      statusEl.className = 'status-line';
    }

    // Get current position to determine safe Z for travel
    var currentSnap = await getMachineSnapshot();
    var cfg = getSettingsFromUI();
    var safeTravelZ = cfg.surfaceTravelZ || 5;  // Use surface probe travel Z setting

    // Step 1: Raise to safe travel height
    await sendCommand('G90');
    await sleep(20);
    await sendCommand('G0 Z' + safeTravelZ.toFixed(3) + ' F' + (cfg.travelFeedRate || 1200));
    await sleep(50);
    await _waitForIdleOrStop(10000);

    setFooterStatus('Moving to XY reference...', 'ok');

    // Step 2: Move to XY reference position
    await sendCommand('G0 X' + _toolChangeRefPos.x.toFixed(3) +
                     ' Y' + _toolChangeRefPos.y.toFixed(3) +
                     ' F' + (cfg.travelFeedRate || 1200));
    await sleep(50);
    await _waitForIdleOrStop(15000);

    if (statusEl) {
      statusEl.textContent = 'At reference position, probing surface to set Z0...';
      statusEl.className = 'status-line';
    }
    setFooterStatus('Probing surface to establish Z0...', 'ok');

    // Step 3: Probe down to find surface
    var probeFeed = cfg.surfaceProbeFeedRate || 100;
    var maxPlunge = cfg.surfaceProbeMaxPlunge || 20;

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
    await sendCommand('G90');  // Back to absolute mode
    await sleep(20);

    // Check probe triggered
    var postSnap = await getMachineSnapshot();
    if (!postSnap.probeTriggered) {
      throw new Error('Probe did not trigger. Check probe connection and surface height.');
    }

    // Step 4: Set Z0 at this position
    await sendCommand('G10 L20 P0 Z0');
    await sleep(100);

    // Step 5: Retract slightly
    await sendCommand('G91');
    await sleep(20);
    await sendCommand('G0 Z2 F' + (cfg.travelFeedRate || 1200));
    await sleep(50);
    await _waitForIdleOrStop(5000);
    await sendCommand('G90');
    await sleep(20);

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
    if (returnBtn) {
      returnBtn.disabled = false;
    }
  } else {
    if (displayEl) {
      displayEl.innerHTML = 'No reference position saved yet';
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
