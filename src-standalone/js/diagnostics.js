// ── UI Diagnostics ────────────────────────────────────────────────────────────
// Non-destructive audit of all UI fields, buttons, and JS functions.
// Run by clicking the "🔬 Run UI Diagnostics" button in the Setup tab.
// Does NOT send any CNC commands or mutate real machine state.
// ─────────────────────────────────────────────────────────────────────────────

(function() {

// ── Editable field list ───────────────────────────────────────────────────────
var EDITABLE_FIELDS = [
  // Setup tab — probe dimensions
  'probeShankDiameter', 'probeBodyDiameter', 'probeUpperLength', 'probeLowerLength',
  'probeStylusLength', 'probeTipBallDiameter', 'probeTotalLength',
  // Setup tab — general settings
  'probeFeed', 'retractDist', 'finishHomeZ', 'machineSafeTopZ',
  'travelContactLift', 'travelContactMaxRetries', 'meshSubdivisionSpacing',
  'jogFeedXY',
  // Surface grid settings
  'sm-minX', 'sm-maxX', 'sm-spacingX',
  'sm-minY', 'sm-maxY', 'sm-spacingY',
  'sm-probeFeed', 'sm-travelFeed', 'sm-clearanceZ', 'sm-maxPlunge', 'sm-referenceZ',
  // Top/surface probe tab
  'topFixedCoord', 'topSampleStart', 'topSampleEnd', 'topSampleCount', 'topClearZ',
  // Face probe fields
  'faceStartOffset', 'fp-xStart', 'fp-xEnd', 'faceDepthBelowSurface',
  'faceFixedCoord', 'faceProbeDistance', 'fp-zStepCount', 'fp-zStepSize',
  // Apply tab
  'apply-refZ'
];

// Selects / checkboxes (editable)
var EDITABLE_SELECTS = [
  'probe-type-select', 'sampleAxis', 'useInitialClearanceLift', 'apply-subdivide'
];

// Known intentional read-only / display-only fields — verify they ARE readonly/disabled
var READONLY_FIELDS = [
  'homedState', 'machineStatus', 'probeState',
  'currentPosX', 'currentPosY', 'currentPosZ',
  'savedLocX', 'savedLocY', 'savedLocZ',
  'finishBehaviorPreview', 'travelRecoveryPreview'
];

// ── Button list ───────────────────────────────────────────────────────────────
// { id, expectedDisabled: true } means the button is intentionally disabled until a probe runs
var BUTTONS = [
  { id: 'btn-save-settings' },
  { id: 'btn-load-settings' },
  { id: 'btn-reset-settings' },
  { id: 'btn-save-probe-dims' },
  { id: 'btn-save-travel-recovery' },
  { id: 'btn-save-machine-helpers' },
  { id: 'btn-save-jog-settings' },
  { id: 'btn-save-location' },
  { id: 'btn-go-location' },
  { id: 'btn-check-homed' },
  { id: 'btn-use-current-z-home' },
  { id: 'btn-refresh-position' },
  { id: 'btn-home-machine' },
  { id: 'btn-set-xy-zero' },
  { id: 'btn-set-z-zero' },
  { id: 'btn-save-probe-mode' },
  { id: 'btn-save-surf-config' },
  { id: 'sm-btn-save-settings' },
  { id: 'btn-save-surf-export-settings' },
  { id: 'btn-save-combined-settings' },
  { id: 'btn-save-combined-export-settings' },
  { id: 'btn-save-face-export-settings' },
  { id: 'btn-save-surf-comp-settings' },
  { id: 'btn-save-face-comp-settings' },
  { id: 'sm-btn-run-probe' },
  { id: 'sm-btn-stop-probe', expectedDisabled: true },
  { id: 'btn-face-x' },
  { id: 'btn-face-y' },
  { id: 'btn-stop-face', expectedDisabled: true },
  { id: 'btn-save-face-log' },
  { id: 'btn-clear-face-log' },
  { id: 'btn-export-face-csv' },
  { id: 'btn-export-face-dxf' },
  { id: 'btn-export-face-obj' },
  { id: 'btn-export-face-stl' },
  { id: 'btn-export-surf-csv' },
  { id: 'btn-export-surf-dxf' },
  { id: 'btn-export-surf-obj' },
  { id: 'btn-export-surf-stl' },
  { id: 'btn-export-csv' },
  { id: 'btn-clear-all-results' },
  { id: 'btn-copy-results' },
  { id: 'sm-btn-save-mesh' },
  { id: 'sm-btn-load-mesh' },
  { id: 'sm-btn-clear-mesh' },
  { id: 'sm-btn-export-mesh' },
  { id: 'sm-btn-export-mesh-csv' },
  { id: 'sm-btn-import-mesh' },
  { id: 'sm-btn-save-replay-html' },
  { id: 'btn-save-mesh-storage' },
  { id: 'btn-load-mesh-storage' },
  { id: 'btn-save-mesh-file' },
  { id: 'btn-load-mesh-file' },
  { id: 'btn-clear-mesh-storage' },
  { id: 'comb-btn-save-mesh' },
  { id: 'comb-btn-export-csv' },
  { id: 'comb-btn-export-json' },
  { id: 'comb-btn-clear-mesh' },
  { id: 'apply-btn-load-ncsender' },
  { id: 'apply-btn-load-file' },
  { id: 'apply-btn-analyze-bounds' },
  { id: 'res-btn-save-3d' },
  { id: 'btn-export-combined-obj' },
  { id: 'btn-export-combined-stl' },
  { id: 'btn-export-combined-dxf' },
  { id: 'btn-run-diagnostics' }
];

// ── Function list ─────────────────────────────────────────────────────────────
var FUNCTIONS_TO_CHECK = [
  'saveSettings', 'loadSettings', 'resetSettings',
  'saveSettingsPartial',
  'saveProbeDimensions', 'loadProbeDimensions',
  'smSaveSettings', 'smLoadSettings',
  'saveCurrentLocation', 'goToSavedLocation', 'loadSavedLocation',
  'checkHomedStatus', 'refreshCurrentPosition',
  'useCurrentZAsFinishHome',
  'startProbeByType', 'stopSurfaceProbing',
  'runFaceProbe', 'stopAll',
  'saveLog', 'clearLog', 'saveAllLogs',
  'exportCSV', 'exportFaceCSV', 'exportFaceDXF', 'exportFaceOBJ', 'exportFaceSTL',
  'exportSurfaceMeshCSV', 'exportSurfaceDXF', 'exportSurfaceOBJ', 'exportSurfaceSTL', 'exportSurfaceSTLSmooth',
  'exportSurfaceMesh', 'loadSurfaceMesh', 'saveSurfaceMesh', 'clearSurfaceMesh',
  'exportCombinedMeshCSV', 'exportCombinedMeshJSON',
  'exportCombinedOBJWatertight', 'exportCombinedSTLWatertight',
  'saveCombinedMesh', 'clearCombinedMesh',
  'switchTab', 'flashButton', 'flashSaveButton',
  'getSettingsFromUI',
  'setFooterStatus',
  'logLine',
  'pluginDebug',
  'clearAllVisuals',
  'clearAllResults',
  'applyLoadGcodeFromNcSender', 'applyAnalyzeGcodeBounds',
  'smSaveReplayHtml'
];

// ── Tab list ──────────────────────────────────────────────────────────────────
var TABS = ['pane-setup', 'pane-top', 'pane-meshdata', 'pane-results', 'pane-apply'];

// ── Result helpers ─────────────────────────────────────────────────────────────
function pass(name, msg)  { return { status: 'PASS',  icon: '✅', name: name, msg: msg || '' }; }
function fail(name, msg)  { return { status: 'FAIL',  icon: '❌', name: name, msg: msg || '' }; }
function warn(name, msg)  { return { status: 'WARN',  icon: '⚠️', name: name, msg: msg || '' }; }

// ── A. Field editability checks ───────────────────────────────────────────────
function checkEditableFields() {
  var results = [];
  EDITABLE_FIELDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) {
      results.push(fail('Field: ' + id, 'Element not found in DOM'));
      return;
    }
    if (el.disabled) {
      results.push(fail('Field: ' + id, 'Element is disabled'));
      return;
    }
    if (el.readOnly) {
      results.push(fail('Field: ' + id, 'Element is readonly (unexpected)'));
      return;
    }
    // Test round-trip write/read for text and number inputs
    var origVal = el.value;
    var testVal = '42.5';
    try {
      el.value = testVal;
      var readBack = el.value;
      el.value = origVal; // restore
      if (readBack === testVal) {
        results.push(pass('Field: ' + id));
      } else {
        results.push(warn('Field: ' + id, 'Value write succeeded but read-back differed (got "' + readBack + '")'));
      }
    } catch(e) {
      el.value = origVal;
      results.push(fail('Field: ' + id, 'Write/read test threw: ' + e.message));
    }
  });

  // Selects and checkboxes
  EDITABLE_SELECTS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) {
      results.push(fail('Field: ' + id, 'Element not found in DOM'));
      return;
    }
    if (el.disabled) {
      results.push(fail('Field: ' + id, 'Element is disabled'));
      return;
    }
    var origIdx = el.selectedIndex !== undefined ? el.selectedIndex : null;
    var origChecked = el.checked !== undefined ? el.checked : null;
    try {
      if (el.type === 'checkbox') {
        el.checked = !el.checked;
        var changed = el.checked !== origChecked;
        el.checked = origChecked;
        results.push(changed ? pass('Field: ' + id) : warn('Field: ' + id, 'Checkbox state did not toggle'));
      } else {
        // select — try changing selectedIndex
        var newIdx = origIdx === 0 ? Math.min(1, el.options.length - 1) : 0;
        el.selectedIndex = newIdx;
        var readBack = el.selectedIndex;
        el.selectedIndex = origIdx;
        results.push(readBack === newIdx ? pass('Field: ' + id) : warn('Field: ' + id, 'selectedIndex write/read-back mismatch'));
      }
    } catch(e) {
      results.push(fail('Field: ' + id, 'Select test threw: ' + e.message));
    }
  });

  // Verify known readonly fields ARE readonly or disabled
  READONLY_FIELDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) {
      results.push(warn('ReadOnly: ' + id, 'Element not found (may be hidden or dynamically rendered)'));
      return;
    }
    if (el.readOnly || el.disabled) {
      results.push(pass('ReadOnly: ' + id, 'Correctly readonly/disabled'));
    } else {
      results.push(warn('ReadOnly: ' + id, 'Expected readonly/disabled but is editable'));
    }
  });

  return results;
}

// ── B. Save button existence & wiring checks ──────────────────────────────────
function checkButtons() {
  var results = [];
  BUTTONS.forEach(function(spec) {
    var id = spec.id;
    var el = document.getElementById(id);
    if (!el) {
      results.push(fail('Button: ' + id, 'Element not found in DOM'));
      return;
    }
    if (spec.expectedDisabled) {
      // Expected to start disabled
      if (el.disabled) {
        results.push(pass('Button: ' + id, 'Correctly disabled (expected)'));
      } else {
        results.push(warn('Button: ' + id, 'Expected disabled but is enabled'));
      }
    } else {
      if (el.disabled) {
        results.push(fail('Button: ' + id, 'Unexpectedly disabled'));
        return;
      }
      results.push(pass('Button: ' + id, 'Enabled'));
    }
    // Check for click handler: onclick attribute OR event listener sentinel
    var hasHandler = typeof el.onclick === 'function' ||
                     (el.getAttribute('onclick') && el.getAttribute('onclick').trim().length > 0) ||
                     el._diagListenerWired === true;
    if (!hasHandler) {
      results.push(warn('Button wiring: ' + id, 'No onclick attribute detected (listener may be wired via addEventListener — OK if init ran)'));
    } else {
      results.push(pass('Button wiring: ' + id, 'Handler detected'));
    }
  });
  return results;
}

// ── C. JS function existence checks ──────────────────────────────────────────
function checkFunctions() {
  var results = [];
  FUNCTIONS_TO_CHECK.forEach(function(name) {
    var val;
    try { val = window[name]; } catch(e) { val = undefined; }
    if (typeof val === 'function') {
      results.push(pass('Function: ' + name));
    } else if (val === undefined) {
      results.push(fail('Function: ' + name, 'Not defined (typeof window["' + name + '"] === undefined)'));
    } else {
      results.push(fail('Function: ' + name, 'Defined but not a function (typeof: ' + typeof val + ')'));
    }
  });
  return results;
}

// ── D. localStorage round-trip tests ─────────────────────────────────────────
function checkLocalStorageRoundTrips() {
  var results = [];

  // Helper: save and restore a single localStorage key around a test
  function withLocalStorageBackup(key, fn) {
    var backup = null;
    try { backup = localStorage.getItem(key); } catch(e) {}
    try {
      fn();
    } catch(e) {
      results.push(fail('localStorage round-trip: ' + key, 'Test threw: ' + e.message));
    }
    // Restore backup
    try {
      if (backup === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, backup);
      }
    } catch(e) {}
  }

  // D1. Surface grid settings round-trip (smSaveSettings / smLoadSettings)
  var smGridKey = (typeof SM_SURFACE_GRID_SETTINGS_KEY !== 'undefined') ? SM_SURFACE_GRID_SETTINGS_KEY : 'smSurfaceGridSettings';
  withLocalStorageBackup(smGridKey, function() {
    var el = document.getElementById('sm-minX');
    if (!el) { results.push(warn('localStorage round-trip: sm-minX', 'sm-minX not found, skipping')); return; }
    if (typeof smSaveSettings !== 'function') {
      results.push(warn('localStorage round-trip: smSaveSettings', 'smSaveSettings not defined, skipping')); return;
    }
    var origVal = el.value;
    smSaveSettings();
    var savedVal = el.value;
    el.value = '999.9'; // mutate
    if (typeof smLoadSettings === 'function') {
      smLoadSettings();
      var restored = el.value;
      el.value = origVal; // restore UI
      if (restored === savedVal) {
        results.push(pass('localStorage round-trip: smSaveSettings/smLoadSettings', 'sm-minX restored correctly'));
      } else {
        results.push(fail('localStorage round-trip: smSaveSettings/smLoadSettings', 'sm-minX not restored (expected "' + savedVal + '", got "' + restored + '")'));
      }
    } else {
      el.value = origVal;
      results.push(warn('localStorage round-trip: smLoadSettings', 'smLoadSettings not defined, skipping load test'));
    }
  });

  // D2. Probe dimensions round-trip (saveProbeDimensions / loadProbeDimensions)
  var probeDimKey = (typeof PROBE_DIMENSIONS_KEY !== 'undefined') ? PROBE_DIMENSIONS_KEY : 'edgeProbeDimensions';
  withLocalStorageBackup(probeDimKey, function() {
    var el = document.getElementById('probeShankDiameter');
    if (!el) { results.push(warn('localStorage round-trip: probeShankDiameter', 'Element not found, skipping')); return; }
    if (typeof saveProbeDimensions !== 'function') {
      results.push(warn('localStorage round-trip: saveProbeDimensions', 'Not defined, skipping')); return;
    }
    var origVal = el.value;
    saveProbeDimensions();
    var savedVal = el.value;
    el.value = '999.9';
    if (typeof loadProbeDimensions === 'function') {
      loadProbeDimensions();
      var restored = el.value;
      el.value = origVal;
      if (restored === savedVal) {
        results.push(pass('localStorage round-trip: saveProbeDimensions/loadProbeDimensions', 'probeShankDiameter restored correctly'));
      } else {
        results.push(fail('localStorage round-trip: saveProbeDimensions/loadProbeDimensions', 'probeShankDiameter not restored (expected "' + savedVal + '", got "' + restored + '")'));
      }
    } else {
      el.value = origVal;
      results.push(warn('localStorage round-trip: loadProbeDimensions', 'Not defined, skipping load test'));
    }
  });

  // D3. General settings round-trip (saveSettings / loadSettings) — only if defined
  if (typeof saveSettings === 'function' && typeof loadSettings === 'function') {
    var settingsKey = 'edgeProbeSettings';
    withLocalStorageBackup(settingsKey, function() {
      var el = document.getElementById('probeFeed');
      if (!el) { results.push(warn('localStorage round-trip: saveSettings', 'probeFeed not found, skipping')); return; }
      var origVal = el.value;
      saveSettings();
      var savedVal = el.value;
      el.value = '99999';
      loadSettings();
      var restored = el.value;
      el.value = origVal;
      if (restored === savedVal) {
        results.push(pass('localStorage round-trip: saveSettings/loadSettings', 'probeFeed restored correctly'));
      } else {
        results.push(fail('localStorage round-trip: saveSettings/loadSettings', 'probeFeed not restored (expected "' + savedVal + '", got "' + restored + '")'));
      }
    });
  } else {
    results.push(warn('localStorage round-trip: saveSettings/loadSettings', 'Not defined — skipping (see Function checks above)'));
  }

  return results;
}

// ── E. Tab switching checks ───────────────────────────────────────────────────
function checkTabSwitching() {
  var results = [];

  if (typeof switchTab !== 'function') {
    results.push(fail('Tab switching', 'switchTab() not defined'));
    return results;
  }

  // Remember the original active tab
  var originalTab = null;
  TABS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && (el.classList.contains('active') || el.style.display !== 'none')) {
      originalTab = id;
    }
  });

  TABS.forEach(function(id) {
    try {
      switchTab(id);
      var el = document.getElementById(id);
      if (!el) {
        results.push(fail('Tab: ' + id, 'Element not found after switchTab()'));
        return;
      }
      var isVisible = el.classList.contains('active') || el.style.display !== 'none';
      if (isVisible) {
        results.push(pass('Tab: ' + id, 'switchTab() made pane visible'));
      } else {
        results.push(fail('Tab: ' + id, 'switchTab() called but pane is not active/visible'));
      }
    } catch(e) {
      results.push(fail('Tab: ' + id, 'switchTab() threw: ' + e.message));
    }
  });

  // Restore original tab
  if (originalTab) {
    try { switchTab(originalTab); } catch(e) {}
  }

  return results;
}

// ── Collect all results ───────────────────────────────────────────────────────
function runSilentDiagnostics() {
  var all = [];
  all = all.concat(checkEditableFields());
  all = all.concat(checkButtons());
  all = all.concat(checkFunctions());
  all = all.concat(checkLocalStorageRoundTrips());
  all = all.concat(checkTabSwitching());
  return all;
}

// ── F. Overlay UI ─────────────────────────────────────────────────────────────
function buildOverlay(results) {
  var passed = results.filter(function(r) { return r.status === 'PASS'; }).length;
  var failed = results.filter(function(r) { return r.status === 'FAIL'; }).length;
  var warned = results.filter(function(r) { return r.status === 'WARN'; }).length;

  // Remove existing overlay if present
  var existing = document.getElementById('diag-overlay');
  if (existing) existing.parentNode.removeChild(existing);

  // Container
  var overlay = document.createElement('div');
  overlay.id = 'diag-overlay';
  overlay.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
    'z-index:99999',
    'background:rgba(0,0,0,0.6)',
    'display:flex', 'align-items:center', 'justify-content:center'
  ].join(';');

  // Panel
  var panel = document.createElement('div');
  panel.style.cssText = [
    'background:var(--panel,#171c26)',
    'border:1px solid var(--line,#2b3444)',
    'border-radius:10px',
    'padding:20px',
    'width:min(700px,95vw)',
    'max-height:85vh',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'color:var(--text,#e8eef9)',
    'font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
    'box-shadow:0 8px 40px rgba(0,0,0,0.6)'
  ].join(';');

  // Header row
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap';
  var title = document.createElement('span');
  title.textContent = '🔬 UI Diagnostic Report';
  title.style.cssText = 'font-size:15px;font-weight:700;flex:1;color:var(--accent,#6ea8ff)';
  header.appendChild(title);

  // Summary badges
  var summaryEl = document.createElement('span');
  var badgeStyle = function(color) {
    return 'display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;margin-left:4px;background:' + color + ';color:#fff';
  };
  var badgePassed = document.createElement('span');
  badgePassed.style.cssText = badgeStyle('var(--good,#5fd38d)');
  badgePassed.textContent = '✅ ' + passed + ' passed';
  var badgeFailed = document.createElement('span');
  badgeFailed.style.cssText = badgeStyle(failed > 0 ? 'var(--bad,#ff6b6b)' : 'var(--good,#5fd38d)');
  badgeFailed.textContent = '❌ ' + failed + ' failed';
  var badgeWarned = document.createElement('span');
  badgeWarned.style.cssText = badgeStyle(warned > 0 ? 'var(--warn,#f0b35c)' : 'var(--muted,#9aa8bf)');
  badgeWarned.textContent = '⚠️ ' + warned + ' warnings';
  summaryEl.appendChild(badgePassed);
  summaryEl.appendChild(badgeFailed);
  summaryEl.appendChild(badgeWarned);
  header.appendChild(summaryEl);
  panel.appendChild(header);

  // Separator
  var sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:var(--line,#2b3444)';
  panel.appendChild(sep);

  // Scrollable results list
  var list = document.createElement('div');
  list.style.cssText = [
    'overflow-y:auto',
    'flex:1',
    'min-height:0',
    'max-height:55vh',
    'display:flex',
    'flex-direction:column',
    'gap:3px'
  ].join(';');

  results.forEach(function(r) {
    var row = document.createElement('div');
    var rowBg = r.status === 'PASS' ? 'transparent' :
                r.status === 'FAIL' ? 'rgba(255,107,107,0.08)' :
                                      'rgba(240,179,92,0.08)';
    row.style.cssText = [
      'padding:4px 8px',
      'border-radius:4px',
      'background:' + rowBg,
      'font-size:12px',
      'display:flex',
      'gap:8px',
      'align-items:baseline'
    ].join(';');
    var icon = document.createElement('span');
    icon.textContent = r.icon;
    icon.style.flexShrink = '0';
    var nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-weight:600;color:' +
      (r.status === 'PASS' ? 'var(--text,#e8eef9)' :
       r.status === 'FAIL' ? 'var(--bad,#ff6b6b)' :
                             'var(--warn,#f0b35c)');
    nameEl.textContent = r.name;
    row.appendChild(icon);
    row.appendChild(nameEl);
    if (r.msg) {
      var msgEl = document.createElement('span');
      msgEl.style.cssText = 'color:var(--muted,#9aa8bf);margin-left:4px';
      msgEl.textContent = '— ' + r.msg;
      row.appendChild(msgEl);
    }
    list.appendChild(row);
  });
  panel.appendChild(list);

  // Separator
  var sep2 = document.createElement('div');
  sep2.style.cssText = 'height:1px;background:var(--line,#2b3444)';
  panel.appendChild(sep2);

  // Footer buttons
  var footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';

  var btnCopy = document.createElement('button');
  btnCopy.textContent = '📋 Copy Report';
  btnCopy.style.cssText = [
    'padding:6px 14px',
    'border-radius:5px',
    'border:1px solid var(--line,#2b3444)',
    'background:var(--panel2,#1c2330)',
    'color:var(--text,#e8eef9)',
    'cursor:pointer',
    'font-size:12px'
  ].join(';');
  btnCopy.addEventListener('click', function() {
    var text = buildPlainTextReport(results, passed, failed, warned);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(function() { btnCopy.textContent = '✅ Copied!'; setTimeout(function() { btnCopy.textContent = '📋 Copy Report'; }, 2000); })
        .catch(function() { _fallbackCopy(text); });
    } else {
      _fallbackCopy(text);
    }
  });

  var btnClose = document.createElement('button');
  btnClose.textContent = '✕ Close';
  btnClose.style.cssText = [
    'padding:6px 14px',
    'border-radius:5px',
    'border:none',
    'background:var(--accent,#6ea8ff)',
    'color:#fff',
    'cursor:pointer',
    'font-weight:600',
    'font-size:12px'
  ].join(';');
  btnClose.addEventListener('click', function() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  });

  footer.appendChild(btnCopy);
  footer.appendChild(btnClose);
  panel.appendChild(footer);

  overlay.appendChild(panel);

  // Close on backdrop click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  });

  return overlay;
}

function _fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
}

function buildPlainTextReport(results, passed, failed, warned) {
  var lines = [];
  lines.push('=== 3D Live Edge Mesh — UI Diagnostic Report ===');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('Summary: ' + passed + ' passed / ' + failed + ' failed / ' + warned + ' warnings');
  lines.push('');
  results.forEach(function(r) {
    var line = r.icon + ' [' + r.status + '] ' + r.name;
    if (r.msg) line += '  — ' + r.msg;
    lines.push(line);
  });
  return lines.join('\n');
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * runSilentDiagnostics() — run all checks, return result array.
 * Non-destructive; safe to call programmatically from automated tests.
 */
window.runSilentDiagnostics = runSilentDiagnostics;

/**
 * runUIDiagnostics() — run all checks and show the floating overlay panel.
 * Triggered by the "🔬 Run UI Diagnostics" button in the Setup tab.
 */
function runUIDiagnostics() {
  try {
    if (typeof pluginDebug === 'function') pluginDebug('runUIDiagnostics started');
    var results = runSilentDiagnostics();
    var overlay = buildOverlay(results);
    document.body.appendChild(overlay);
    if (typeof pluginDebug === 'function') {
      var passed = results.filter(function(r) { return r.status === 'PASS'; }).length;
      var failed = results.filter(function(r) { return r.status === 'FAIL'; }).length;
      var warned = results.filter(function(r) { return r.status === 'WARN'; }).length;
      pluginDebug('runUIDiagnostics done: ' + passed + ' passed / ' + failed + ' failed / ' + warned + ' warnings');
    }
  } catch(e) {
    console.error('[Diagnostics] runUIDiagnostics threw:', e);
    if (typeof setFooterStatus === 'function') {
      setFooterStatus('Diagnostics error: ' + e.message, 'bad');
    }
  }
}
window.runUIDiagnostics = runUIDiagnostics;

// ── Wire the trigger button ───────────────────────────────────────────────────
// The button is added to config-body.html; wire it here after DOM is ready.
(function wireDiagButton() {
  function doWire() {
    var btn = document.getElementById('btn-run-diagnostics');
    if (btn) {
      // Mark as listener-wired for button-wiring check
      btn._diagListenerWired = true;
      btn.addEventListener('click', function() {
        if (typeof flashButton === 'function') flashButton(this);
        runUIDiagnostics();
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doWire);
  } else {
    doWire();
  }
})();

})(); // end IIFE
