// ─────────────────────────────────────────────────────────
//  outline-probe.js  –  360 outline capture
//  Uses existing sm* motion primitives.
//  Phase 1: Surface reference probe (standalone button)
//  Phase 2: X-axis edge scan (face-first, row by row)
//  Phase 3: Y-axis edge scan (face-first, col by col)
//  Phase 4: 360 face probe from edge grid
// ─────────────────────────────────────────────────────────

var outlineRowResults = [];   // {y, xLeft, xRight, hasLeft, hasRight}
var outlineColResults = [];   // {x, yBottom, yTop, hasBottom, hasTop}
var outlineSurfaceZ   = null;
var _outlineRunning   = false;
var _outlineStopFlag  = false;

// ── Stop control ──────────────────────────────────────────
function outlineCheckStop() {
  if (_outlineStopFlag || _stopRequested) throw new Error('STOP_REQUESTED');
  smCheckStop();
}

function stopOutlineScan() {
  _outlineStopFlag = true;
  _stopRequested   = true;
  smStopFlag       = true;
  outlineAppendLog('Stop requested.');
  outlineSetStatus('Stopping\u2026', 'warn');
  setFooterStatus('Stopping\u2026', 'warn');
  stopNowAndSafeHome('outline').catch(function(e){
    pluginDebug('stopOutlineScan: stopNowAndSafeHome error: ' + e.message);
  });
}

// ── Log backup / recovery ─────────────────────────────────
function clearOutlineLogBackup() {
  try { localStorage.removeItem('outlineLogBackup'); } catch(e) {}
}

function recoverOutlineLog() {
  var saved = localStorage.getItem('outlineLogBackup');
  if (!saved) {
    outlineAppendLog('No saved log found in localStorage.');
    return;
  }
  var logEl = document.getElementById('outline-log');
  if (logEl) {
    logEl.innerHTML = '';
    var lines = saved.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim()) logLine('outline', '[RECOVERED] ' + lines[i]);
    }
  }
  outlineAppendLog('Recovered ' + saved.split('\n').length + ' log lines from last session.');
}

// ── Read outline settings ─────────────────────────────────
function _outlineSettings() {
  function gn(id, def) { var el = document.getElementById(id); if (!el) return def; var v = Number(el.value); return isNaN(v) ? def : v; }
  function gb(id) { var el = document.getElementById(id); return el ? el.checked : false; }
  var cfg = {
    x0:                gn('outlineX0',               0),
    xLen:              gn('outlineXLen',             100),
    y0:                gn('outlineY0',               0),
    yLen:              gn('outlineYLen',             100),
    xCount:            Math.max(2, gn('outlineXCount', 2)),
    yCount:            Math.max(2, gn('outlineYCount', 2)),
    faceDepth:         gn('outlineFaceDepth',        3),
    faceFeed:          gn('outlineFaceFeed',         200),
    retractAbove:      gn('outlineRetractAbove',     2),
    overshoot:         gn('outlineOvershoot',        2),
    approachDist:      gn('outlineApproachDist',     10),
    safeTravelZ:       gn('outlineSafeTravelZ',      10),
    zStepDepth:        gn('outlineZStepDepth',       5),
    probeFeed:         gn('outlineProbeFeed',        200),
    fastFeed:          gn('outlineFastFeed',         800),
    retractFeed:       gn('outlineRetractFeed',      600),
    clearZ:            gn('outlineClearZ',           5),
    probeDown:         gn('outlineProbeDown',        5),
    surfRefMaxPlunge:  gn('outlineSurfRefMaxPlunge', 200),
    skipSurfaceProbe:  gb('outlineSkipSurfaceProbe'),
    forceRectangle:    gb('outlineForceRectangle')
  };
  // Compute step spacing from count and length (count drives spacing, not the other way around)
  cfg.xStep = cfg.xLen / (cfg.xCount - 1);
  cfg.yStep = cfg.yLen / (cfg.yCount - 1);
  return cfg;
}

// ── Update Outline Search Bounds count helper text ────────
function updateOutlineCountHelpers() {
  var xLen  = Number((document.getElementById('outlineXLen')   || {}).value) || 0;
  var yLen  = Number((document.getElementById('outlineYLen')   || {}).value) || 0;
  var xCount = Math.max(2, parseInt((document.getElementById('outlineXCount') || {}).value) || 2);
  var yCount = Math.max(2, parseInt((document.getElementById('outlineYCount') || {}).value) || 2);
  var xStep = xLen > 0 ? xLen / (xCount - 1) : 0;
  var yStep = yLen > 0 ? yLen / (yCount - 1) : 0;
  var xEl = document.getElementById('outlineXStepHelper');
  var yEl = document.getElementById('outlineYStepHelper');
  if (xEl) xEl.textContent = xStep > 0 ? 'Computed step: ' + xStep.toFixed(3) + 'mm' : 'Computed step: \u2014';
  if (yEl) yEl.textContent = yStep > 0 ? 'Computed step: ' + yStep.toFixed(3) + 'mm' : 'Computed step: \u2014';
}

// ── Update Surface Grid Probe count helper text ────────────
function updateOutlineGridCountHelpers() {
  var xLen  = Number((document.getElementById('outlineXLen')   || {}).value) || 0;
  var yLen  = Number((document.getElementById('outlineYLen')   || {}).value) || 0;
  var xCount = Math.max(2, parseInt((document.getElementById('outlineGridXCount') || {}).value) || 2);
  var yCount = Math.max(2, parseInt((document.getElementById('outlineGridYCount') || {}).value) || 2);
  var sourceEl = document.getElementById('outlineGridSource');
  var source   = sourceEl ? sourceEl.value : 'bounds';
  var xEl = document.getElementById('outlineGridXStepHelper');
  var yEl = document.getElementById('outlineGridYStepHelper');
  if (source === 'detected') {
    var xApprox = xLen > 0 ? xLen / (xCount - 1) : 0;
    var yApprox = yLen > 0 ? yLen / (yCount - 1) : 0;
    if (xEl) xEl.textContent = xApprox > 0 ? 'Computed step: ~' + xApprox.toFixed(3) + 'mm (approx, based on search bounds)' : 'Computed step: depends on detected outline';
    if (yEl) yEl.textContent = yApprox > 0 ? 'Computed step: ~' + yApprox.toFixed(3) + 'mm (approx, based on search bounds)' : 'Computed step: depends on detected outline';
  } else {
    var xStep = xLen > 0 ? xLen / (xCount - 1) : 0;
    var yStep = yLen > 0 ? yLen / (yCount - 1) : 0;
    if (xEl) xEl.textContent = xStep > 0 ? 'Computed step: ' + xStep.toFixed(3) + 'mm' : 'Computed step: \u2014';
    if (yEl) yEl.textContent = yStep > 0 ? 'Computed step: ' + yStep.toFixed(3) + 'mm' : 'Computed step: \u2014';
  }
}

// ── Get/set surface Z from UI field ───────────────────────
function _outlineGetSurfaceZ() {
  var el = document.getElementById('outlineSurfaceZ');
  if (!el || el.value === '') return null;
  var v = Number(el.value);
  return isNaN(v) ? null : v;
}

function _outlineSetSurfaceZField(z) {
  var el = document.getElementById('outlineSurfaceZ');
  if (el) el.value = z.toFixed(4);
  outlineSurfaceZ = z;
}

// ── Lower Z to absolute position (moves down or up) ───────
async function _outlineMoveToZ(targetZ, feed) {
  outlineAppendLog('LOWER: Z to ' + targetZ.toFixed(3) + ' at F' + feed.toFixed(0));
  await sendCommand('G90 G1 Z' + targetZ.toFixed(3) + ' F' + feed.toFixed(0));
  await sleep(50);
  await waitForIdleWithTimeout(30000);
}

// ── Safety retract helper ─────────────────────────────────
async function _outlineSafetyRetract() {
  try {
    var safeFeed = Number((document.getElementById('outlineFastFeed') || {}).value) || 800;
    outlineAppendLog('SAFETY RETRACT: Z to machine Z=0');
    await moveMachineZAbs(0, safeFeed);
    await sleep(50);
    await waitForIdleWithTimeout(30000);
    outlineAppendLog('SAFETY RETRACT: returning to X0 Y0');
    await moveAbs(0, 0, null, safeFeed);
  } catch(re) { pluginDebug('Safety retract failed: ' + re.message); }
}

// ── Absolute travel helper — retract Z first, then move X/Y diagonally ───────
// Uses G90 absolute moves so Z never exceeds soft limits regardless of start Z.
async function _outlineAbsTravel(targetX, targetY, safeTravelZ, fastFeed, retractFeed) {
  var pos = await getWorkPosition();
  outlineAppendLog('TRAVEL: current pos X=' + pos.x.toFixed(3) + ' Y=' + pos.y.toFixed(3) + ' Z=' + pos.z.toFixed(3));
  if (pos.z < safeTravelZ) {
    outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + retractFeed.toFixed(0));
    await sendCommand('G90 G1 Z' + safeTravelZ.toFixed(3) + ' F' + retractFeed.toFixed(0));
    await sleep(50);
    await waitForIdleWithTimeout(30000);
  }
  outlineAppendLog('TRAVEL: diagonal to X=' + targetX.toFixed(3) + ' Y=' + targetY.toFixed(3) + ' at F' + fastFeed.toFixed(0));
  await moveAbs(targetX, targetY, null, fastFeed);
}

// ── Phase 1: Surface reference probe ─────────────────────
async function runOutlineSurfaceProbe() {
  if (_outlineRunning) { outlineAppendLog('Already running.'); return; }
  _outlineRunning  = true;
  _outlineStopFlag = false;
  _stopRequested   = false;
  smStopFlag       = false;
  _running         = true;

  clearLog('outline');
  outlineSetProgress(0);
  outlineSetStatus('Surface probe\u2026', '');
  setFooterStatus('Outline surface probe running\u2026', '');

  try {
    var cfg = _outlineSettings();
    outlineAppendLog('Phase 1: Surface Reference Probe');
    await requireStartupHomingPreflight('Outline Surface Probe');

    // 1. Retract to machine Z=0 (absolute ceiling) — guarantees clearance
    //    when surface Z is unknown and work Z zero may be below the wood.
    outlineAppendLog('RETRACT: Z to machine Z=0 (top of travel) for safe lateral move');
    await moveMachineZAbs(0, cfg.retractFeed);
    await sleep(50);
    await waitForIdleWithTimeout(30000);

    // 2. Diagonal move to grid center — already at max Z so no lift needed.
    //    Use moveAbs NOT smSafeLateralMove (which tries relative Z lift → soft limit alarm at ceiling).
    var cx = cfg.x0 + cfg.xLen / 2;
    var cy = cfg.y0 + cfg.yLen / 2;
    outlineAppendLog('TRAVEL: diagonal to center X=' + cx.toFixed(3) + ' Y=' + cy.toFixed(3) + ' at F' + cfg.fastFeed);
    await moveAbs(cx, cy, null, cfg.fastFeed);

    // 3. Read current work Z — this is the full travel distance available
    //    from machine ceiling to work zero. Probe the entire range so the
    //    probe finds the surface no matter how far down it is.
    //    Use surfRefMaxPlunge as a minimum to handle the case where work
    //    coordinates have not been set up (pos.z = 0 at ceiling).
    var pos = await getWorkPosition();
    var fullPlunge = Math.max(pos.z + 5, cfg.surfRefMaxPlunge);
    outlineAppendLog('PROBE: full Z plunge from Z=' + pos.z.toFixed(3) + ' distance=' + fullPlunge.toFixed(3));

    // 4. G38.2 plunge — stops on contact, errors only if nothing touched
    // Calculate timeout: travel time at probe feed rate + 10s buffer
    var probeTimeMs = Math.ceil((fullPlunge / cfg.probeFeed) * 60000) + 10000;
    outlineAppendLog('PROBE: G91 G38.2 Z-' + fullPlunge.toFixed(3) + ' F' + cfg.probeFeed.toFixed(0) + ' timeout=' + probeTimeMs + 'ms');
    await sendCommand('G91 G38.2 Z-' + fullPlunge.toFixed(3) + ' F' + cfg.probeFeed.toFixed(0), probeTimeMs);
    await sleep(50);
    await waitForIdleWithTimeout(30000);

    var endPos = await getWorkPosition();
    var pinTriggered = await smGetProbeTriggered();
    var distTraveled = pos.z - endPos.z;
    outlineAppendLog('PROBE RESULT: pinTriggered=' + pinTriggered +
      ' startZ=' + pos.z.toFixed(3) + ' endZ=' + endPos.z.toFixed(3) + ' traveled=' + distTraveled.toFixed(3));

    if (!pinTriggered && distTraveled >= (fullPlunge - 0.5)) {
      throw new Error('Surface probe: No contact in full Z travel range (' + fullPlunge.toFixed(1) + 'mm)');
    }

    var surfZ = endPos.z;
    outlineAppendLog('Surface Z established: ' + surfZ.toFixed(4));

    _outlineSetSurfaceZField(surfZ);
    outlineSetProgress(50);

    // 5. Retract to surfZ + retractAbove — gives proper clearance for diagonal return
    var retractZ = surfZ + cfg.retractAbove;
    outlineAppendLog('RETRACT: Z to surfZ+retractAbove=' + retractZ.toFixed(3) + ' at F' + cfg.retractFeed);
    await smRetractToZ(retractZ, cfg.retractFeed);

    // 6. Diagonal return to X0 Y0
    outlineAppendLog('TRAVEL: diagonal return to X0 Y0 at F' + cfg.fastFeed);
    await moveAbs(0, 0, null, cfg.fastFeed);

    outlineSetProgress(100);
    outlineSetStatus('Surface Z = ' + surfZ.toFixed(4) + ' \u2013 ready', 'good');
    outlineAppendLog('Phase 1 complete. Surface Z=' + surfZ.toFixed(4) + '. Returned to X0 Y0.');
    setFooterStatus('Surface probe done \u2013 Z=' + surfZ.toFixed(4), 'good');

  } catch(e) {
    if (e.message === 'STOP_REQUESTED' || e.message === 'Stopped by user') {
      outlineAppendLog('Stopped by user.');
      outlineSetStatus('Stopped', 'warn');
      setFooterStatus('Outline stopped', 'warn');
      // Safety retract/home is handled by stopNowAndSafeHome — do not call here.
    } else {
      outlineAppendLog('ERROR: ' + e.message);
      outlineSetStatus('Error: ' + e.message, 'error');
      setFooterStatus('Outline error: ' + e.message, 'error');
      await _outlineSafetyRetract();
    }
  } finally {
    _outlineRunning  = false;
    _outlineStopFlag = false;
    _running         = false;
  }
}

// ── Horizontal edge probe (G38.3 — no error on miss) ──────
async function _probeHorizEdge(axis, targetCoord, feed, safeTravelZ) {
  var pos0 = await getWorkPosition();
  var pinState = await smGetProbeTriggered();
  outlineAppendLog('PROBE PIN STATE: triggered=' + pinState + ' before probe move');
  outlineAppendLog('PROBE: G38.3 ' + axis + targetCoord.toFixed(3) + ' F' + feed.toFixed(0) +
    ' from X=' + pos0.x.toFixed(3) + ' Y=' + pos0.y.toFixed(3) + ' Z=' + pos0.z.toFixed(3));
  await smEnsureProbeClear(safeTravelZ, feed);

  // Calculate travel distance for timeout
  var travelDist = (axis === 'X') ? Math.abs(targetCoord - pos0.x) : Math.abs(targetCoord - pos0.y);
  var probeTimeMs = Math.ceil((travelDist / feed) * 60000) + 10000;

  // G38.3 — probe without error on miss; machine just stops at target if no contact
  await sendCommand('G90 G38.3 ' + axis + targetCoord.toFixed(3) + ' F' + feed.toFixed(0), probeTimeMs);
  await sleep(50);
  await waitForIdleWithTimeout(probeTimeMs);
  outlineCheckStop(); // Cancel stale probe result if stop was pressed while waiting

  var pos = await getWorkPosition();
  var pinAfter = await smGetProbeTriggered();

  // Position-based contact detection: stopped well short of target means probe triggered
  var endCoord = (axis === 'X') ? pos.x : pos.y;
  var distToTarget = Math.abs(targetCoord - endCoord);
  var stoppedShort = distToTarget > 0.5;
  var triggered = pinAfter || stoppedShort;

  // Attach triggered flag to pos object for callers
  pos.probeTriggered = triggered;

  outlineAppendLog('PROBE RESULT: triggered=' + triggered + ' pinAfter=' + pinAfter +
    ' stoppedShort=' + stoppedShort + ' distToTarget=' + distToTarget.toFixed(3) +
    ' X=' + pos.x.toFixed(3) + ' Y=' + pos.y.toFixed(3) + ' Z=' + pos.z.toFixed(3));
  return pos;
}

// ── Surface step probe (Z plunge, G38.3 — no error on miss) ──
async function _surfStepProbe(probeDown, probeFeed) {
  var startPos = await getWorkPosition();
  var startZ   = startPos.z;
  var pinBefore = await smGetProbeTriggered();
  outlineAppendLog('PROBE PIN STATE: triggered=' + pinBefore + ' before surface step probe');
  outlineAppendLog('PROBE: surface plunge at X=' + startPos.x.toFixed(3) +
    ' Y=' + startPos.y.toFixed(3) + ' Z=' + startZ.toFixed(3) +
    ' depth=' + probeDown.toFixed(3) + ' F' + probeFeed.toFixed(0));
  await sendCommand('G91 G38.3 Z-' + Math.abs(probeDown).toFixed(4) + ' F' + probeFeed.toFixed(0));
  await sleep(50);
  await waitForIdleWithTimeout(30000);
  outlineCheckStop(); // Cancel stale probe result if stop was pressed while waiting
  var pos = await getWorkPosition();
  var distanceTraveled = startZ - pos.z;
  var stoppedShort = distanceTraveled < (probeDown - 0.5);
  var triggered = pos.probeTriggered || stoppedShort;
  var pinAfter = await smGetProbeTriggered();
  outlineAppendLog('PROBE RESULT: triggered=' + triggered + ' pinAfter=' + pinAfter +
    ' X=' + pos.x.toFixed(3) + ' Y=' + pos.y.toFixed(3) + ' Z=' + pos.z.toFixed(3) +
    ' traveled=' + distanceTraveled.toFixed(3));
  return { triggered: triggered, z: pos.z, x: pos.x, y: pos.y };
}

// ── Phase 2: Row scan (X scanlines at fixed Y) ────────────
async function _runRowScan(cfg, surfZ) {
  var totalRows = Math.ceil(cfg.yLen / cfg.yStep) + 1;
  var rowIdx    = 0;
  var faceZ       = surfZ - cfg.faceDepth;    // absolute Z below surface for face probe
  var clearZ      = surfZ + cfg.retractAbove; // absolute Z above surface after contact
  var safeTravelZ = surfZ + cfg.safeTravelZ;  // absolute Z for inter-row travel (offset from surface)

  outlineAppendLog('X-axis scan: surfZ=' + surfZ.toFixed(3) +
    ' faceZ=' + faceZ.toFixed(3) + ' clearZ=' + clearZ.toFixed(3) +
    ' safeTravelZ=' + safeTravelZ.toFixed(3) + ' rows=' + totalRows);

  for (var y = cfg.y0; y <= cfg.y0 + cfg.yLen + 1e-9; y += cfg.yStep) {
    outlineCheckStop();
    var rowY     = parseFloat(y.toFixed(6));
    rowIdx++;
    var rowStart = Date.now();
    outlineAppendLog('\u2500\u2500 Row ' + rowIdx + '/' + totalRows + ' Y=' + rowY.toFixed(3) + ' \u2500\u2500');

    // 1. Travel to approach position (outside bounds on -X side)
    var approachX = cfg.x0 - cfg.approachDist;
    outlineAppendLog('TRAVEL: approach X=' + approachX.toFixed(3) + ' Y=' + rowY.toFixed(3) + ' at F' + cfg.fastFeed);
    await _outlineAbsTravel(approachX, rowY, safeTravelZ, cfg.fastFeed, cfg.retractFeed);

    // 2. Lower Z to face probe depth (below surface)
    outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + cfg.retractFeed);
    await _outlineMoveToZ(faceZ, cfg.retractFeed);

    // 3. Probe +X for left (near) edge
    var leftTarget = cfg.x0 + cfg.xLen + cfg.approachDist;
    var edgePos    = await _probeHorizEdge('X', leftTarget, cfg.faceFeed, safeTravelZ);

    if (!edgePos.probeTriggered) {
      outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' complete. No edges found.');
      outlineRowResults.push({ y: rowY, xLeft: null, xRight: null, hasLeft: false, hasRight: false });
      outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await sendCommand('G90 G1 Z' + safeTravelZ.toFixed(3) + ' F' + cfg.retractFeed.toFixed(0));
      await sleep(50);
      await waitForIdleWithTimeout(30000);
      continue;
    }

    var xLeft = edgePos.x;
    outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' Left edge TRIGGERED at X=' + xLeft.toFixed(3) + ' Z=' + edgePos.z.toFixed(3));

    var xRight = null;

    if (cfg.skipSurfaceProbe) {
      // ── Skip Surface Probe mode ──────────────────────────────────────────────
      // Retract to safe travel Z, go directly to the far end of the row, lower,
      // then back-probe -X to find the opposing (right) edge.
      outlineAppendLog('SKIP SURFACE PROBE: retracting to safeTravelZ=' + safeTravelZ.toFixed(3) + ' and travelling to row far end.');
      await smRetractToZ(safeTravelZ, cfg.retractFeed);

      var skipReverseX = cfg.x0 + cfg.xLen + cfg.approachDist;
      outlineAppendLog('SKIP SURFACE PROBE: TRAVEL to X=' + skipReverseX.toFixed(3) + ' Y=' + rowY.toFixed(3) + ' at F' + cfg.fastFeed);
      await _outlineAbsTravel(skipReverseX, rowY, safeTravelZ, cfg.fastFeed, cfg.retractFeed);

      outlineAppendLog('SKIP SURFACE PROBE: LOWER Z to faceZ=' + faceZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await _outlineMoveToZ(faceZ, cfg.retractFeed);

      var skipRightEdgePos = await _probeHorizEdge('X', xLeft - 1, cfg.faceFeed, safeTravelZ);
      if (skipRightEdgePos.probeTriggered) {
        xRight = skipRightEdgePos.x;
        outlineAppendLog('SKIP SURFACE PROBE: Row Y=' + rowY.toFixed(3) + ' Right edge TRIGGERED at X=' + xRight.toFixed(3) + ' Z=' + skipRightEdgePos.z.toFixed(3));
      } else {
        outlineAppendLog('SKIP SURFACE PROBE: Row Y=' + rowY.toFixed(3) + ' Right edge not found from far end.');
      }

      outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await smRetractToZ(safeTravelZ, cfg.retractFeed);

    } else {
      // ── Standard surface step mode ───────────────────────────────────────────
      // 4. Back off -X from trigger
      var backoffX = xLeft - 2;
      outlineAppendLog('TRAVEL: backoff -X to X=' + backoffX.toFixed(3) + ' at F' + cfg.fastFeed);
      await sendCommand('G90 G1 X' + backoffX.toFixed(3) + ' F' + cfg.fastFeed.toFixed(0));
      await sleep(50);
      await waitForIdleWithTimeout(30000);

      // 5. Retract Z above surface
      outlineAppendLog('RETRACT: Z to clearZ=' + clearZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await smRetractToZ(clearZ, cfg.retractFeed);

      // 6. Move +X past trigger by overshoot (now on top of wood)
      var overshootX = xLeft + cfg.overshoot;
      outlineAppendLog('TRAVEL: overshoot to X=' + overshootX.toFixed(3) + ' Y=' + rowY.toFixed(3) + ' at F' + cfg.fastFeed);
      await _outlineAbsTravel(overshootX, rowY, clearZ, cfg.fastFeed, cfg.retractFeed);

      // 7. Step +X across surface, plunge Z at each step until 2 consecutive misses
      var missCount = 0;
      var scanX     = overshootX;
      var scanStep  = Math.max(1, cfg.xStep / 2);
      var lastHitX  = overshootX;
      outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' stepping +X from X=' + scanX.toFixed(3) + ' step=' + scanStep.toFixed(3));

      while (scanX <= cfg.x0 + cfg.xLen + cfg.approachDist + 1e-9) {
        outlineCheckStop();
        outlineAppendLog('TRAVEL: step to X=' + scanX.toFixed(3) + ' Y=' + rowY.toFixed(3) + ' at F' + cfg.fastFeed);
        await _outlineAbsTravel(scanX, rowY, clearZ, cfg.fastFeed, cfg.retractFeed);

        var stepResult = await _surfStepProbe(cfg.retractAbove + cfg.zStepDepth, cfg.probeFeed);
        outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' surface step X=' + scanX.toFixed(3) +
          ' Z=' + stepResult.z.toFixed(3) + ' triggered=' + stepResult.triggered);

        outlineAppendLog('RETRACT: Z to clearZ=' + clearZ.toFixed(3) + ' at F' + cfg.retractFeed);
        await smRetractToZ(clearZ, cfg.retractFeed);

        if (stepResult.triggered) {
          missCount = 0;
          lastHitX  = scanX;
        } else {
          missCount++;
          outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' miss #' + missCount + ' at X=' + scanX.toFixed(3));
          if (missCount >= 2) {
            outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' off-part confirmed. Last hit X=' + lastHitX.toFixed(3));
            break;
          }
        }
        scanX += scanStep;
      }

      // 8. Reverse probe -X for exact right edge
      var reverseStartX = Math.min(lastHitX + scanStep * 2, cfg.x0 + cfg.xLen + cfg.approachDist);
      outlineAppendLog('TRAVEL: reverse probe start X=' + reverseStartX.toFixed(3) + ' at F' + cfg.fastFeed);
      await _outlineAbsTravel(reverseStartX, rowY, safeTravelZ, cfg.fastFeed, cfg.retractFeed);

      outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await _outlineMoveToZ(faceZ, cfg.retractFeed);

      var rightEdgePos = await _probeHorizEdge('X', xLeft - 1, cfg.faceFeed, safeTravelZ);
      if (rightEdgePos.probeTriggered) {
        xRight = rightEdgePos.x;
        outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' Right edge TRIGGERED at X=' + xRight.toFixed(3) + ' Z=' + rightEdgePos.z.toFixed(3));
      } else {
        xRight = lastHitX;
        outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' Right edge not confirmed, using lastHitX=' + xRight.toFixed(3));
      }

      // 9. Retract to safeTravelZ
      outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await smRetractToZ(safeTravelZ, cfg.retractFeed);
    }

    outlineRowResults.push({ y: rowY, xLeft: xLeft, xRight: xRight, hasLeft: true, hasRight: xRight !== null });
    var rowMs = Date.now() - rowStart;
    outlineAppendLog('Row Y=' + rowY.toFixed(3) + ' complete. Left=' + xLeft.toFixed(3) +
      ' Right=' + (xRight !== null ? xRight.toFixed(3) : 'n/a') + ' in ' + rowMs + 'ms');
    outlineSetProgress((rowIdx / totalRows) * 50);
  }

  outlineAppendLog('X-axis scan complete. ' + outlineRowResults.length + ' rows scanned. Returning to X0 Y0.');
  await _outlineAbsTravel(0, 0, safeTravelZ, cfg.fastFeed, cfg.retractFeed);
}

// ── Phase 3: Column scan (Y scanlines at fixed X) ─────────
async function _runColScan(cfg, surfZ) {
  var totalCols = Math.ceil(cfg.xLen / cfg.xStep) + 1;
  var colIdx    = 0;
  var faceZ       = surfZ - cfg.faceDepth;
  var clearZ      = surfZ + cfg.retractAbove;
  var safeTravelZ = surfZ + cfg.safeTravelZ;  // absolute Z for inter-col travel (offset from surface)

  outlineAppendLog('Y-axis scan: surfZ=' + surfZ.toFixed(3) +
    ' faceZ=' + faceZ.toFixed(3) + ' clearZ=' + clearZ.toFixed(3) +
    ' safeTravelZ=' + safeTravelZ.toFixed(3) + ' cols=' + totalCols);

  for (var x = cfg.x0; x <= cfg.x0 + cfg.xLen + 1e-9; x += cfg.xStep) {
    outlineCheckStop();
    var colX     = parseFloat(x.toFixed(6));
    colIdx++;
    var colStart = Date.now();
    outlineAppendLog('\u2500\u2500 Col ' + colIdx + '/' + totalCols + ' X=' + colX.toFixed(3) + ' \u2500\u2500');

    // 1. Travel to approach position (outside bounds on -Y side)
    var approachY = cfg.y0 - cfg.approachDist;
    outlineAppendLog('TRAVEL: approach X=' + colX.toFixed(3) + ' Y=' + approachY.toFixed(3) + ' at F' + cfg.fastFeed);
    await _outlineAbsTravel(colX, approachY, safeTravelZ, cfg.fastFeed, cfg.retractFeed);

    // 2. Lower Z to face probe depth (below surface)
    outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + cfg.retractFeed);
    await _outlineMoveToZ(faceZ, cfg.retractFeed);

    // 3. Probe +Y for bottom (near) edge
    var bottomTarget = cfg.y0 + cfg.yLen + cfg.approachDist;
    var edgePos      = await _probeHorizEdge('Y', bottomTarget, cfg.faceFeed, safeTravelZ);

    if (!edgePos.probeTriggered) {
      outlineAppendLog('Col X=' + colX.toFixed(3) + ' complete. No edges found.');
      outlineColResults.push({ x: colX, yBottom: null, yTop: null, hasBottom: false, hasTop: false });
      outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await sendCommand('G90 G1 Z' + safeTravelZ.toFixed(3) + ' F' + cfg.retractFeed.toFixed(0));
      await sleep(50);
      await waitForIdleWithTimeout(30000);
      continue;
    }

    var yBottom = edgePos.y;
    outlineAppendLog('Col X=' + colX.toFixed(3) + ' Bottom edge TRIGGERED at Y=' + yBottom.toFixed(3) + ' Z=' + edgePos.z.toFixed(3));

    var yTop = null;

    if (cfg.skipSurfaceProbe) {
      // ── Skip Surface Probe mode ──────────────────────────────────────────────
      // Retract to safe travel Z, go directly to the far end of the column, lower,
      // then back-probe -Y to find the opposing (top) edge.
      outlineAppendLog('SKIP SURFACE PROBE: retracting to safeTravelZ=' + safeTravelZ.toFixed(3) + ' and travelling to col far end.');
      await smRetractToZ(safeTravelZ, cfg.retractFeed);

      var skipReverseY = cfg.y0 + cfg.yLen + cfg.approachDist;
      outlineAppendLog('SKIP SURFACE PROBE: TRAVEL to X=' + colX.toFixed(3) + ' Y=' + skipReverseY.toFixed(3) + ' at F' + cfg.fastFeed);
      await _outlineAbsTravel(colX, skipReverseY, safeTravelZ, cfg.fastFeed, cfg.retractFeed);

      outlineAppendLog('SKIP SURFACE PROBE: LOWER Z to faceZ=' + faceZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await _outlineMoveToZ(faceZ, cfg.retractFeed);

      var skipTopEdgePos = await _probeHorizEdge('Y', yBottom - 1, cfg.faceFeed, safeTravelZ);
      if (skipTopEdgePos.probeTriggered) {
        yTop = skipTopEdgePos.y;
        outlineAppendLog('SKIP SURFACE PROBE: Col X=' + colX.toFixed(3) + ' Top edge TRIGGERED at Y=' + yTop.toFixed(3) + ' Z=' + skipTopEdgePos.z.toFixed(3));
      } else {
        outlineAppendLog('SKIP SURFACE PROBE: Col X=' + colX.toFixed(3) + ' Top edge not found from far end.');
      }

      outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await smRetractToZ(safeTravelZ, cfg.retractFeed);

    } else {
      // ── Standard surface step mode ───────────────────────────────────────────
      // 4. Back off -Y from trigger
      var backoffY = yBottom - 2;
      outlineAppendLog('TRAVEL: backoff -Y to Y=' + backoffY.toFixed(3) + ' at F' + cfg.fastFeed);
      await sendCommand('G90 G1 Y' + backoffY.toFixed(3) + ' F' + cfg.fastFeed.toFixed(0));
      await sleep(50);
      await waitForIdleWithTimeout(30000);

      // 5. Retract Z above surface
      outlineAppendLog('RETRACT: Z to clearZ=' + clearZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await smRetractToZ(clearZ, cfg.retractFeed);

      // 6. Move +Y past bottom edge by overshoot
      var overshootY = yBottom + cfg.overshoot;
      outlineAppendLog('TRAVEL: overshoot to X=' + colX.toFixed(3) + ' Y=' + overshootY.toFixed(3) + ' at F' + cfg.fastFeed);
      await _outlineAbsTravel(colX, overshootY, clearZ, cfg.fastFeed, cfg.retractFeed);

      // 7. Step +Y across surface, plunge Z at each step until 2 consecutive misses
      var missCount = 0;
      var scanY     = overshootY;
      var scanStep  = Math.max(1, cfg.yStep / 2);
      var lastHitY  = overshootY;
      outlineAppendLog('Col X=' + colX.toFixed(3) + ' stepping +Y from Y=' + scanY.toFixed(3) + ' step=' + scanStep.toFixed(3));

      while (scanY <= cfg.y0 + cfg.yLen + cfg.approachDist + 1e-9) {
        outlineCheckStop();
        outlineAppendLog('TRAVEL: step to X=' + colX.toFixed(3) + ' Y=' + scanY.toFixed(3) + ' at F' + cfg.fastFeed);
        await _outlineAbsTravel(colX, scanY, clearZ, cfg.fastFeed, cfg.retractFeed);

        var stepResult = await _surfStepProbe(cfg.retractAbove + cfg.zStepDepth, cfg.probeFeed);
        outlineAppendLog('Col X=' + colX.toFixed(3) + ' surface step Y=' + scanY.toFixed(3) +
          ' Z=' + stepResult.z.toFixed(3) + ' triggered=' + stepResult.triggered);

        outlineAppendLog('RETRACT: Z to clearZ=' + clearZ.toFixed(3) + ' at F' + cfg.retractFeed);
        await smRetractToZ(clearZ, cfg.retractFeed);

        if (stepResult.triggered) {
          missCount = 0;
          lastHitY  = scanY;
        } else {
          missCount++;
          outlineAppendLog('Col X=' + colX.toFixed(3) + ' miss #' + missCount + ' at Y=' + scanY.toFixed(3));
          if (missCount >= 2) {
            outlineAppendLog('Col X=' + colX.toFixed(3) + ' off-part confirmed. Last hit Y=' + lastHitY.toFixed(3));
            break;
          }
        }
        scanY += scanStep;
      }

      // 8. Reverse probe -Y for exact top edge
      var reverseStartY = Math.min(lastHitY + scanStep * 2, cfg.y0 + cfg.yLen + cfg.approachDist);
      outlineAppendLog('TRAVEL: reverse probe start Y=' + reverseStartY.toFixed(3) + ' at F' + cfg.fastFeed);
      await _outlineAbsTravel(colX, reverseStartY, safeTravelZ, cfg.fastFeed, cfg.retractFeed);

      outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await _outlineMoveToZ(faceZ, cfg.retractFeed);

      var topEdgePos = await _probeHorizEdge('Y', yBottom - 1, cfg.faceFeed, safeTravelZ);
      if (topEdgePos.probeTriggered) {
        yTop = topEdgePos.y;
        outlineAppendLog('Col X=' + colX.toFixed(3) + ' Top edge TRIGGERED at Y=' + yTop.toFixed(3) + ' Z=' + topEdgePos.z.toFixed(3));
      } else {
        yTop = lastHitY;
        outlineAppendLog('Col X=' + colX.toFixed(3) + ' Top edge not confirmed, using lastHitY=' + yTop.toFixed(3));
      }

      // 9. Retract to safeTravelZ
      outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + cfg.retractFeed);
      await smRetractToZ(safeTravelZ, cfg.retractFeed);
    }

    outlineColResults.push({ x: colX, yBottom: yBottom, yTop: yTop, hasBottom: true, hasTop: yTop !== null });
    var colMs = Date.now() - colStart;
    outlineAppendLog('Col X=' + colX.toFixed(3) + ' complete. Bottom=' + yBottom.toFixed(3) +
      ' Top=' + (yTop !== null ? yTop.toFixed(3) : 'n/a') + ' in ' + colMs + 'ms');
    outlineSetProgress(50 + (colIdx / totalCols) * 50);
  }

  outlineAppendLog('Y-axis scan complete. ' + outlineColResults.length + ' cols scanned. Returning to X0 Y0.');
  await _outlineAbsTravel(0, 0, safeTravelZ, cfg.fastFeed, cfg.retractFeed);
}

// ── Main outline scan (Phases 2 + 3) ─────────────────────
async function runOutlineScan() {
  if (_outlineRunning) { outlineAppendLog('Already running.'); return; }
  _outlineRunning   = true;
  _outlineStopFlag  = false;
  _stopRequested    = false;
  smStopFlag        = false;
  _running          = true;
  outlineRowResults = [];
  outlineColResults = [];

  clearLog('outline');
  outlineSetProgress(0);
  outlineSetStatus('Running\u2026', '');
  setFooterStatus('Outline scan running\u2026', '');

  try {
    var cfg = _outlineSettings();
    if (cfg.xLen <= 0 || cfg.yLen <= 0) throw new Error('Outline bounds invalid (XLen/YLen must be > 0)');
    if (cfg.yStep <= 0) cfg.yStep = 5;
    if (cfg.xStep <= 0) cfg.xStep = 5;

    // Surface Z from UI field (probed or manually entered)
    var surfZ = _outlineGetSurfaceZ();
    if (surfZ === null) {
      throw new Error('Surface Z not set. Run \u25bc Surface Probe first or enter a value in the Surface Z field.');
    }
    outlineSurfaceZ = surfZ;

    outlineAppendLog('Outline scan start. SurfaceZ=' + surfZ.toFixed(4) +
      ' Bounds: X' + cfg.x0.toFixed(2) + '+' + cfg.xLen.toFixed(2) +
      '  Y' + cfg.y0.toFixed(2) + '+' + cfg.yLen.toFixed(2));
    outlineAppendLog('Settings: ' + JSON.stringify(cfg, null, 0));

    await requireStartupHomingPreflight('Outline Scan');
    var safeTravelZ = surfZ + cfg.safeTravelZ;
    await smEnsureProbeClear(safeTravelZ, cfg.fastFeed);

    // Phase 2: X-axis edge scan
    outlineAppendLog('\u2500\u2500 Phase 2: X-axis edge scan \u2500\u2500');
    await _runRowScan(cfg, surfZ);

    // Phase 3: Y-axis edge scan
    outlineCheckStop();
    outlineAppendLog('\u2500\u2500 Phase 3: Y-axis edge scan \u2500\u2500');
    await _runColScan(cfg, surfZ);

    // Return home
    outlineCheckStop();
    await _outlineAbsTravel(0, 0, safeTravelZ, cfg.fastFeed, cfg.retractFeed);

    outlineSetProgress(100);
    outlineSetStatus('Done \u2013 ' + outlineRowResults.length + ' rows, ' + outlineColResults.length + ' cols', 'good');
    outlineAppendLog('Outline scan complete.');
    outlineAppendLog('Rows: ' + outlineRowResults.length + '  Cols: ' + outlineColResults.length);
    setFooterStatus('Outline scan done', 'good');
    drawOutlineCanvas();

  } catch(e) {
    if (e.message === 'STOP_REQUESTED' || e.message === 'Stopped by user') {
      outlineAppendLog('Stopped by user.');
      outlineSetStatus('Stopped', 'warn');
      setFooterStatus('Outline stopped', 'warn');
      // Safety retract/home is handled by stopNowAndSafeHome — do not call here.
    } else {
      outlineAppendLog('ERROR: ' + e.message);
      outlineSetStatus('Error: ' + e.message, 'error');
      setFooterStatus('Outline error: ' + e.message, 'error');
      await _outlineSafetyRetract();
    }
  } finally {
    _outlineRunning  = false;
    _outlineStopFlag = false;
    _running         = false;
  }
}

// ── Phase 4: 360 face probe from outline edge grid ────────
async function runOutline360FaceProbe() {
  if (_outlineRunning) { outlineAppendLog('Scan still running.'); return; }

  if (outlineRowResults.length === 0 || outlineSurfaceZ === null) {
    outlineAppendLog('No outline scan data. Run Outline Scan first.');
    outlineSetStatus('No outline data \u2013 run Outline Scan first', 'warn');
    return;
  }

  _outlineRunning  = true;
  _outlineStopFlag = false;
  _stopRequested   = false;
  smStopFlag       = false;
  _running         = true;
  faceResults      = [];

  clearLog('outline');
  outlineSetStatus('Running 360 face probe\u2026', '');
  setFooterStatus('360 face probe running\u2026', '');

  try {
    await requireStartupHomingPreflight('360 Face Probe');

    var cfg         = _outlineSettings();
    var faceZ       = outlineSurfaceZ - cfg.faceDepth;
    var safeTravelZ = outlineSurfaceZ + cfg.safeTravelZ;  // absolute Z for travel (offset from surface)
    var travelFeed  = cfg.fastFeed;
    var feed        = cfg.faceFeed;
    var retFeed     = cfg.retractFeed;
    var n           = 0;
    var totalOps    = outlineRowResults.length * 2 + outlineColResults.length * 2;
    var done        = 0;

    await smEnsureProbeClear(safeTravelZ, travelFeed);
    outlineAppendLog('360 face probe: surfZ=' + outlineSurfaceZ.toFixed(3) +
      ' faceZ=' + faceZ.toFixed(3) + ' safeTravelZ=' + safeTravelZ.toFixed(3) + ' approachDist=' + cfg.approachDist.toFixed(1));

    // ── Probe left and right X edges from row results ──────────
    for (var ri = 0; ri < outlineRowResults.length; ri++) {
      var row = outlineRowResults[ri];
      outlineCheckStop();

      if (row.hasLeft && row.xLeft !== null) {
        var approachX = row.xLeft - cfg.approachDist;
        outlineAppendLog('360 Face: edge #' + (n + 1) + ' axis=X dir=+X at X=' + row.xLeft.toFixed(3) + ' Y=' + row.y.toFixed(3));
        outlineAppendLog('TRAVEL: approach X=' + approachX.toFixed(3) + ' Y=' + row.y.toFixed(3) + ' at F' + travelFeed);
        await _outlineAbsTravel(approachX, row.y, safeTravelZ, travelFeed, retFeed);
        outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + retFeed);
        await _outlineMoveToZ(faceZ, retFeed);
        await smEnsureProbeClear(safeTravelZ, travelFeed);
        var _lStartPos = await getWorkPosition();
        var _lStartX   = Number(_lStartPos.x);
        var _lTarget   = row.xLeft + cfg.approachDist * 2;
        var _lProbeTimeMs = Math.ceil((Math.abs(_lTarget - _lStartX) / feed) * 60000) + 10000;
        outlineAppendLog('PROBE: G38.2 X' + _lTarget.toFixed(3) + ' F' + feed +
          ' from X=' + _lStartPos.x.toFixed(3) + ' Y=' + _lStartPos.y.toFixed(3) + ' Z=' + _lStartPos.z.toFixed(3));
        await sendCommand('G90 G38.2 X' + _lTarget.toFixed(3) + ' F' + feed.toFixed(0), _lProbeTimeMs);
        await sleep(50);
        var lpos = await waitForIdleWithTimeout(_lProbeTimeMs);
        outlineCheckStop(); // Cancel stale probe result if stop was pressed
        if (!lpos) lpos = await getWorkPosition();
        var _lEndX = Number(lpos.x);
        var _lDist = Math.abs(_lTarget - _lStartX);
        var _lTrav = Math.abs(_lEndX - _lStartX);
        if (!lpos.probeTriggered && _lDist > 0.5 && _lTrav < (_lDist - 0.5)) {
          lpos = Object.assign({}, lpos, { probeTriggered: true });
        }
        outlineAppendLog('PROBE RESULT: triggered=' + !!lpos.probeTriggered +
          ' X=' + lpos.x.toFixed(3) + ' Y=' + lpos.y.toFixed(3) + ' Z=' + lpos.z.toFixed(3));
        if (lpos.probeTriggered) {
          n++;
          faceResults.push(makeFaceContactRecord(n, lpos, 'X', 'triggered', row.xLeft, row.y));
          outlineAppendLog('360 Face: edge #' + n + ' axis=X dir=+X at X=' + lpos.x.toFixed(3) +
            ' Y=' + lpos.y.toFixed(3) + ' Z=' + lpos.z.toFixed(3) + ' TRIGGERED');
        }
        outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + retFeed);
        await smRetractToZ(safeTravelZ, retFeed);
      }
      done++;
      outlineSetProgress((done / totalOps) * 100);

      outlineCheckStop();
      if (row.hasRight && row.xRight !== null) {
        var approachXR = row.xRight + cfg.approachDist;
        outlineAppendLog('360 Face: edge #' + (n + 1) + ' axis=X dir=-X at X=' + row.xRight.toFixed(3) + ' Y=' + row.y.toFixed(3));
        outlineAppendLog('TRAVEL: approach X=' + approachXR.toFixed(3) + ' Y=' + row.y.toFixed(3) + ' at F' + travelFeed);
        await _outlineAbsTravel(approachXR, row.y, safeTravelZ, travelFeed, retFeed);
        outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + retFeed);
        await _outlineMoveToZ(faceZ, retFeed);
        await smEnsureProbeClear(safeTravelZ, travelFeed);
        var _rStartPos = await getWorkPosition();
        var _rStartX   = Number(_rStartPos.x);
        var _rTarget   = row.xRight - cfg.approachDist * 2;
        var _rProbeTimeMs = Math.ceil((Math.abs(_rTarget - _rStartX) / feed) * 60000) + 10000;
        outlineAppendLog('PROBE: G38.2 X' + _rTarget.toFixed(3) + ' F' + feed +
          ' from X=' + _rStartPos.x.toFixed(3) + ' Y=' + _rStartPos.y.toFixed(3) + ' Z=' + _rStartPos.z.toFixed(3));
        await sendCommand('G90 G38.2 X' + _rTarget.toFixed(3) + ' F' + feed.toFixed(0), _rProbeTimeMs);
        await sleep(50);
        var rpos = await waitForIdleWithTimeout(_rProbeTimeMs);
        outlineCheckStop(); // Cancel stale probe result if stop was pressed
        if (!rpos) rpos = await getWorkPosition();
        var _rEndX = Number(rpos.x);
        var _rDist = Math.abs(_rTarget - _rStartX);
        var _rTrav = Math.abs(_rEndX - _rStartX);
        if (!rpos.probeTriggered && _rDist > 0.5 && _rTrav < (_rDist - 0.5)) {
          rpos = Object.assign({}, rpos, { probeTriggered: true });
        }
        outlineAppendLog('PROBE RESULT: triggered=' + !!rpos.probeTriggered +
          ' X=' + rpos.x.toFixed(3) + ' Y=' + rpos.y.toFixed(3) + ' Z=' + rpos.z.toFixed(3));
        if (rpos.probeTriggered) {
          n++;
          faceResults.push(makeFaceContactRecord(n, rpos, 'X', 'triggered', row.xRight, row.y));
          outlineAppendLog('360 Face: edge #' + n + ' axis=X dir=-X at X=' + rpos.x.toFixed(3) +
            ' Y=' + rpos.y.toFixed(3) + ' Z=' + rpos.z.toFixed(3) + ' TRIGGERED');
        }
        outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + retFeed);
        await smRetractToZ(safeTravelZ, retFeed);
      }
      done++;
      outlineSetProgress((done / totalOps) * 100);
    }

    // ── Probe bottom and top Y edges from col results ──────────
    for (var ci = 0; ci < outlineColResults.length; ci++) {
      var col = outlineColResults[ci];
      outlineCheckStop();

      if (col.hasBottom && col.yBottom !== null) {
        var approachYB = col.yBottom - cfg.approachDist;
        outlineAppendLog('360 Face: edge #' + (n + 1) + ' axis=Y dir=+Y at X=' + col.x.toFixed(3) + ' Y=' + col.yBottom.toFixed(3));
        outlineAppendLog('TRAVEL: approach X=' + col.x.toFixed(3) + ' Y=' + approachYB.toFixed(3) + ' at F' + travelFeed);
        await _outlineAbsTravel(col.x, approachYB, safeTravelZ, travelFeed, retFeed);
        outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + retFeed);
        await _outlineMoveToZ(faceZ, retFeed);
        await smEnsureProbeClear(safeTravelZ, travelFeed);
        var _bStartPos = await getWorkPosition();
        var _bStartY   = Number(_bStartPos.y);
        var _bTarget   = col.yBottom + cfg.approachDist * 2;
        var _bProbeTimeMs = Math.ceil((Math.abs(_bTarget - _bStartY) / feed) * 60000) + 10000;
        outlineAppendLog('PROBE: G38.2 Y' + _bTarget.toFixed(3) + ' F' + feed +
          ' from X=' + _bStartPos.x.toFixed(3) + ' Y=' + _bStartPos.y.toFixed(3) + ' Z=' + _bStartPos.z.toFixed(3));
        await sendCommand('G90 G38.2 Y' + _bTarget.toFixed(3) + ' F' + feed.toFixed(0), _bProbeTimeMs);
        await sleep(50);
        var bpos = await waitForIdleWithTimeout(_bProbeTimeMs);
        outlineCheckStop(); // Cancel stale probe result if stop was pressed
        if (!bpos) bpos = await getWorkPosition();
        var _bEndY = Number(bpos.y);
        var _bDist = Math.abs(_bTarget - _bStartY);
        var _bTrav = Math.abs(_bEndY - _bStartY);
        if (!bpos.probeTriggered && _bDist > 0.5 && _bTrav < (_bDist - 0.5)) {
          bpos = Object.assign({}, bpos, { probeTriggered: true });
        }
        outlineAppendLog('PROBE RESULT: triggered=' + !!bpos.probeTriggered +
          ' X=' + bpos.x.toFixed(3) + ' Y=' + bpos.y.toFixed(3) + ' Z=' + bpos.z.toFixed(3));
        if (bpos.probeTriggered) {
          n++;
          faceResults.push(makeFaceContactRecord(n, bpos, 'Y', 'triggered', col.yBottom, col.x));
          outlineAppendLog('360 Face: edge #' + n + ' axis=Y dir=+Y at X=' + col.x.toFixed(3) +
            ' Y=' + bpos.y.toFixed(3) + ' Z=' + bpos.z.toFixed(3) + ' TRIGGERED');
        }
        outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + retFeed);
        await smRetractToZ(safeTravelZ, retFeed);
      }
      done++;
      outlineSetProgress((done / totalOps) * 100);

      outlineCheckStop();
      if (col.hasTop && col.yTop !== null) {
        var approachYT = col.yTop + cfg.approachDist;
        outlineAppendLog('360 Face: edge #' + (n + 1) + ' axis=Y dir=-Y at X=' + col.x.toFixed(3) + ' Y=' + col.yTop.toFixed(3));
        outlineAppendLog('TRAVEL: approach X=' + col.x.toFixed(3) + ' Y=' + approachYT.toFixed(3) + ' at F' + travelFeed);
        await _outlineAbsTravel(col.x, approachYT, safeTravelZ, travelFeed, retFeed);
        outlineAppendLog('LOWER: Z to faceZ=' + faceZ.toFixed(3) + ' at F' + retFeed);
        await _outlineMoveToZ(faceZ, retFeed);
        await smEnsureProbeClear(safeTravelZ, travelFeed);
        var _tStartPos = await getWorkPosition();
        var _tStartY   = Number(_tStartPos.y);
        var _tTarget   = col.yTop - cfg.approachDist * 2;
        var _tProbeTimeMs = Math.ceil((Math.abs(_tTarget - _tStartY) / feed) * 60000) + 10000;
        outlineAppendLog('PROBE: G38.2 Y' + _tTarget.toFixed(3) + ' F' + feed +
          ' from X=' + _tStartPos.x.toFixed(3) + ' Y=' + _tStartPos.y.toFixed(3) + ' Z=' + _tStartPos.z.toFixed(3));
        await sendCommand('G90 G38.2 Y' + _tTarget.toFixed(3) + ' F' + feed.toFixed(0), _tProbeTimeMs);
        await sleep(50);
        var tpos = await waitForIdleWithTimeout(_tProbeTimeMs);
        outlineCheckStop(); // Cancel stale probe result if stop was pressed
        if (!tpos) tpos = await getWorkPosition();
        var _tEndY = Number(tpos.y);
        var _tDist = Math.abs(_tTarget - _tStartY);
        var _tTrav = Math.abs(_tEndY - _tStartY);
        if (!tpos.probeTriggered && _tDist > 0.5 && _tTrav < (_tDist - 0.5)) {
          tpos = Object.assign({}, tpos, { probeTriggered: true });
        }
        outlineAppendLog('PROBE RESULT: triggered=' + !!tpos.probeTriggered +
          ' X=' + tpos.x.toFixed(3) + ' Y=' + tpos.y.toFixed(3) + ' Z=' + tpos.z.toFixed(3));
        if (tpos.probeTriggered) {
          n++;
          faceResults.push(makeFaceContactRecord(n, tpos, 'Y', 'triggered', col.yTop, col.x));
          outlineAppendLog('360 Face: edge #' + n + ' axis=Y dir=-Y at X=' + col.x.toFixed(3) +
            ' Y=' + tpos.y.toFixed(3) + ' Z=' + tpos.z.toFixed(3) + ' TRIGGERED');
        }
        outlineAppendLog('RETRACT: Z to safeTravelZ=' + safeTravelZ.toFixed(3) + ' at F' + retFeed);
        await smRetractToZ(safeTravelZ, retFeed);
      }
      done++;
      outlineSetProgress((done / totalOps) * 100);
    }

    outlineSetProgress(100);
    outlineAppendLog('360 face probe complete. ' + n + ' contacts recorded.');
    outlineSetStatus('360 face probe done \u2013 ' + n + ' contacts', 'good');
    setFooterStatus('360 face probe done', 'good');
    drawFaceCanvas();

  } catch(e) {
    if (e.message === 'STOP_REQUESTED' || e.message === 'Stopped by user') {
      outlineAppendLog('Stopped by user.');
      outlineSetStatus('Stopped', 'warn');
      setFooterStatus('360 face probe stopped', 'warn');
      // Safety retract/home is handled by stopNowAndSafeHome — do not call here.
    } else {
      outlineAppendLog('ERROR: ' + e.message);
      outlineSetStatus('Error', 'error');
      setFooterStatus('360 face probe error', 'error');
      await _outlineSafetyRetract();
    }
  } finally {
    _outlineRunning  = false;
    _outlineStopFlag = false;
    _running         = false;
  }
}

// ── Outline-local Z plunge probe (G38.2 — errors on no contact) ──────────────
// Safe alternative to smPlungeProbe for outline operations.
// Reads only parameters computed from Outline settings — never touches Surface
// Probe tab DOM fields (e.g. sm-clearanceZ) that would corrupt clearance logic.
//   maxPlunge  – total relative downward travel from current Z (retractAbove + probeDown)
//   probeFeed  – probe feed rate mm/min from Outline settings
//   clearanceZ – absolute work-Z clearance height (surfZ + retractAbove), for logging only
async function _outlinePlungeProbe(maxPlunge, probeFeed, clearanceZ) {
  var startPos = await getWorkPosition();
  var startZ   = startPos.z;
  var pinBefore = await smGetProbeTriggered();
  outlineAppendLog('PROBE PIN STATE: triggered=' + pinBefore +
    ' before grid Z plunge at X=' + startPos.x.toFixed(3) + ' Y=' + startPos.y.toFixed(3));
  if (pinBefore) {
    throw new Error('Probe pin already triggered before plunge at X=' + startPos.x.toFixed(3) +
      ' Y=' + startPos.y.toFixed(3) + ' — smEnsureProbeClear should have cleared this');
  }

  // Timeout: travel time (distance mm / feed mm·min⁻¹ × 60000 ms·min⁻¹) + 10 s buffer
  var probeTimeMs = Math.ceil((maxPlunge / probeFeed) * 60000) + 10000;
  outlineAppendLog('PROBE: G91 G38.2 Z-' + maxPlunge.toFixed(4) +
    ' F' + probeFeed.toFixed(0) + ' timeout=' + probeTimeMs + 'ms' +
    ' (clearanceZ=' + clearanceZ.toFixed(3) + ')');

  await sendCommand('G91 G38.2 Z-' + maxPlunge.toFixed(4) + ' F' + probeFeed.toFixed(0), probeTimeMs);
  await sleep(50);
  await waitForIdleWithTimeout(probeTimeMs);

  var endPos   = await getWorkPosition();
  var traveled = startZ - endPos.z;
  var probeContactTolerance = 0.5; // mm; machine must stop at least this far short to count as contact
  var stoppedShort = traveled < (maxPlunge - probeContactTolerance);
  var pinAfter = await smGetProbeTriggered();

  outlineAppendLog('PROBE RESULT: pinAfter=' + pinAfter + ' stoppedShort=' + stoppedShort +
    ' startZ=' + startZ.toFixed(3) + ' endZ=' + endPos.z.toFixed(3) +
    ' traveled=' + traveled.toFixed(3) + '/' + maxPlunge.toFixed(3));

  if (!pinAfter && !stoppedShort) {
    throw new Error('No contact within max plunge ' + maxPlunge.toFixed(3) +
      'mm at X=' + endPos.x.toFixed(3) + ' Y=' + endPos.y.toFixed(3));
  }

  return endPos;
}

// ── Outline-local Z plunge probe (G38.3 — no alarm on miss) ──────────────────
// Variant of _outlinePlungeProbe that uses G38.3 so a "no contact" result does
// not cause a controller ALARM.  Returns the end position on contact, or null
// if no contact occurred within maxPlunge.  The caller is responsible for
// retracting to clearanceZ when null is returned.
async function _outlinePlungeProbeG383(maxPlunge, probeFeed, clearanceZ) {
  // Extra idle wait before reading position to ensure the controller has settled after travel.
  await sleep(50);
  await waitForIdleWithTimeout(5000);
  var startPos = await getWorkPosition();
  var startZ   = startPos.z;
  var pinBefore = await smGetProbeTriggered();
  outlineAppendLog('PROBE PIN STATE: triggered=' + pinBefore +
    ' before grid Z plunge at X=' + startPos.x.toFixed(3) + ' Y=' + startPos.y.toFixed(3));
  if (pinBefore) {
    throw new Error('Probe pin already triggered before plunge at X=' + startPos.x.toFixed(3) +
      ' Y=' + startPos.y.toFixed(3) + ' \u2014 smEnsureProbeClear should have cleared this');
  }

  var probeTimeMs = Math.ceil((maxPlunge / probeFeed) * 60000) + 10000;
  outlineAppendLog('PROBE: G91 G38.3 Z-' + maxPlunge.toFixed(4) +
    ' F' + probeFeed.toFixed(0) + ' timeout=' + probeTimeMs + 'ms' +
    ' (clearanceZ=' + clearanceZ.toFixed(3) + ')');

  await sendCommand('G91 G38.3 Z-' + maxPlunge.toFixed(4) + ' F' + probeFeed.toFixed(0), probeTimeMs);
  await sleep(50);
  await waitForIdleWithTimeout(probeTimeMs);

  var endPos   = await getWorkPosition();
  var traveled = startZ - endPos.z;
  var probeContactTolerance = 0.5;
  var stoppedShort = traveled < (maxPlunge - probeContactTolerance);
  var pinAfter = await smGetProbeTriggered();

  outlineAppendLog('PROBE RESULT: pinAfter=' + pinAfter + ' stoppedShort=' + stoppedShort +
    ' startZ=' + startZ.toFixed(3) + ' endZ=' + endPos.z.toFixed(3) +
    ' traveled=' + traveled.toFixed(3) + '/' + maxPlunge.toFixed(3));

  if (!pinAfter && !stoppedShort) {
    // No contact — return null; caller must retract
    return null;
  }
  return endPos;
}

// ── Build ordered outline polygon from scan results ───────────────────────────
// Collects edge points from outlineRowResults / outlineColResults, deduplicates
// within 0.1 mm, orders with greedy nearest-neighbour traversal (same as SVG
// export), and enforces CW winding (negative signed area in world Y-up coords).
// Returns an array of [x, y] pairs, or null if fewer than 3 points are available.
function _buildOutlinePolygon() {
  var allPts = [];
  outlineRowResults.forEach(function(r) {
    if (r.hasLeft  && r.xLeft  !== null) allPts.push([r.xLeft,  r.y]);
    if (r.hasRight && r.xRight !== null) allPts.push([r.xRight, r.y]);
  });
  outlineColResults.forEach(function(c) {
    if (c.hasBottom && c.yBottom !== null) allPts.push([c.x, c.yBottom]);
    if (c.hasTop    && c.yTop    !== null) allPts.push([c.x, c.yTop]);
  });

  // Use Euclidean distance for dedup so that near-corner pairs (e.g. a row
  // xLeft and a col yTop that are <1 mm apart and both approximate the same
  // physical corner) are merged into one vertex.  The old axis-aligned check
  // (|Δx|<0.1 AND |Δy|<0.1) missed pairs like (0.088,232) and (0,232.587)
  // which are only 0.59 mm apart but have |Δy|=0.587>0.1, leaving a short
  // degenerate edge that distorts the inset polygon at that corner.
  var _POLY_BUILD_DEDUP_SQ = 1.0 * 1.0; // 1 mm Euclidean dedup radius
  var dedupPts = [];
  allPts.forEach(function(pt) {
    var dup = dedupPts.some(function(p) {
      var ddx = p[0] - pt[0], ddy = p[1] - pt[1];
      return ddx * ddx + ddy * ddy < _POLY_BUILD_DEDUP_SQ;
    });
    if (!dup) dedupPts.push(pt);
  });

  if (dedupPts.length < 3) return null;

  // Start from the bottom-left point (lowest Y, then lowest X as tiebreaker)
  var blIdx = 0;
  dedupPts.forEach(function(p, i) {
    var b = dedupPts[blIdx];
    if (p[1] < b[1] || (p[1] === b[1] && p[0] < b[0])) blIdx = i;
  });

  // Greedy nearest-neighbour traversal
  var nnOrdered = [];
  var nnUsed = new Array(dedupPts.length).fill(false);
  var nnCur = blIdx;
  nnUsed[nnCur] = true;
  nnOrdered.push(dedupPts[nnCur]);
  while (nnOrdered.length < dedupPts.length) {
    var nnBest = -1, nnBestD = Infinity;
    for (var j = 0; j < dedupPts.length; j++) {
      if (nnUsed[j]) continue;
      var ddx = dedupPts[j][0] - dedupPts[nnCur][0];
      var ddy = dedupPts[j][1] - dedupPts[nnCur][1];
      var d2 = ddx * ddx + ddy * ddy;
      if (d2 < nnBestD) { nnBestD = d2; nnBest = j; }
    }
    if (nnBest === -1) break;
    nnUsed[nnBest] = true;
    nnCur = nnBest;
    nnOrdered.push(dedupPts[nnCur]);
  }

  // Ensure CW winding (negative signed area in world Y-up coords)
  var area = 0;
  for (var i = 0; i < nnOrdered.length; i++) {
    var j2 = (i + 1) % nnOrdered.length;
    area += nnOrdered[i][0] * nnOrdered[j2][1] - nnOrdered[j2][0] * nnOrdered[i][1];
  }
  if (area > 0) nnOrdered.reverse();

  return nnOrdered;
}

// ── Inset a closed polygon by a uniform margin ────────────────────────────────
// For each edge of a CW polygon the inward normal is the right-of-edge vector.
// The inset vertex at each corner is the intersection of the two adjacent
// offset lines (edge-normal offset by margin), with a miter-limit clamp so
// sharp convex spikes don't overshoot.  Throws if the result collapses to less
// than 1 mm² (margin too large for the polygon).
function _insetPolygon(poly, margin) {
  var n = poly.length;
  if (n < 3) throw new Error('Polygon must have at least 3 vertices');
  if (margin <= 0) return poly.slice();

  // For each edge compute the offset line (point + direction) displaced inward
  // by margin.  For CW polygon in Y-up coords, inward = right-of-edge:
  // right normal of edge P1→P2 = (dy/len, -dx/len).
  var offLines = [];
  for (var i = 0; i < n; i++) {
    var p1 = poly[i];
    var p2 = poly[(i + 1) % n];
    var edx = p2[0] - p1[0];
    var edy = p2[1] - p1[1];
    var len = Math.sqrt(edx * edx + edy * edy);
    if (len < 1e-10) len = 1e-10;
    var nx = edy / len;
    var ny = -edx / len;
    offLines.push({ ax: p1[0] + nx * margin, ay: p1[1] + ny * margin, dx: edx, dy: edy });
  }

  // Intersect consecutive offset lines to find inset vertices.
  // Miter limit: if the intersection is more than 4× margin from the original
  // vertex, fall back to the start of the second offset line (conservative).
  var MITER_LIMIT = margin * 4;
  var inset = [];
  for (var i = 0; i < n; i++) {
    var prev = (i - 1 + n) % n;
    var L1 = offLines[prev];
    var L2 = offLines[i];
    var det = L1.dx * (-L2.dy) - (-L2.dx) * L1.dy;
    var vx, vy;
    if (Math.abs(det) < 1e-8) {
      // Parallel edges — use start of second offset line
      vx = L2.ax; vy = L2.ay;
    } else {
      var rx = L2.ax - L1.ax, ry = L2.ay - L1.ay;
      var t = (rx * (-L2.dy) - ry * (-L2.dx)) / det;
      vx = L1.ax + t * L1.dx;
      vy = L1.ay + t * L1.dy;
      var dist = Math.sqrt(Math.pow(vx - poly[i][0], 2) + Math.pow(vy - poly[i][1], 2));
      if (dist > MITER_LIMIT) { vx = L2.ax; vy = L2.ay; }
    }
    inset.push([vx, vy]);
  }

  // Validate: area must remain positive (polygon not collapsed)
  var insetArea = 0;
  for (var i = 0; i < inset.length; i++) {
    var j2 = (i + 1) % inset.length;
    insetArea += inset[i][0] * inset[j2][1] - inset[j2][0] * inset[i][1];
  }
  insetArea = Math.abs(insetArea) / 2;
  if (insetArea < 1.0) {
    throw new Error('Polygon inset by ' + margin + 'mm collapsed to ' + insetArea.toFixed(2) +
      ' mm\u00b2 \u2014 reduce Inset Margin or re-run Outline Scan');
  }

  return inset;
}

// ── Ray-casting point-in-polygon test ─────────────────────────────────────────
// Works for CW and CCW simple polygons.  Returns true if (x, y) is inside poly.
// Epsilon tolerance (mm) for point-in-polygon boundary test.
// Points within this distance of the outline boundary are treated as inside
// to avoid floating-point misclassification of near-edge probe points.
var _POLY_EPSILON = 0.25;

function _pointInPolygon(poly, x, y) {
  var n = poly.length;
  var inside = false;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var xi = poly[i][0], yi = poly[i][1];
    var xj = poly[j][0], yj = poly[j][1];
    // Check if the point is within epsilon of this edge segment (boundary = inside)
    var dx = xj - xi, dy = yj - yi;
    var lenSq = dx * dx + dy * dy;
    if (lenSq > 0) {
      var t = ((x - xi) * dx + (y - yi) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      var nearX = xi + t * dx, nearY = yi + t * dy;
      var distSq = (x - nearX) * (x - nearX) + (y - nearY) * (y - nearY);
      if (distSq <= _POLY_EPSILON * _POLY_EPSILON) return true;
    }
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Compute horizontal X span of polygon at a given Y (scanline intersection) ──
// Casts a horizontal scanline at targetY, collects all edge crossing X values,
// and returns {xLeft: min(xs), xRight: max(xs)}.
// Returns null when fewer than 2 intersections are found (row outside polygon).
function _polyRowXSpan(poly, targetY) {
  var xs = [];
  var n = poly.length;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var x0 = poly[j][0], y0 = poly[j][1];
    var x1 = poly[i][0], y1 = poly[i][1];
    if ((y0 <= targetY && y1 > targetY) || (y1 <= targetY && y0 > targetY)) {
      var t = (targetY - y0) / (y1 - y0);
      xs.push(x0 + t * (x1 - x0));
    }
  }
  if (xs.length < 2) return null;
  return { xLeft: Math.min.apply(null, xs), xRight: Math.max.apply(null, xs) };
}

// ── Robust span lookup: retries with Y±epsY when the primary scanline misses ──
// Handles the common edge-case where a scanline coincides with a horizontal
// polygon edge or vertex (classic scanline ambiguity for axis-aligned shapes).
// Returns { span, retried, retryY } or null when no span is found after retries.
var _SPAN_EPS_Y = 0.01; // mm — small offset for horizontal-edge retry
var _ROW_BOUNDARY_EPS = 0.01; // mm — inset applied to first/last row Y in polygon mode
function _polyRowXSpanRobust(poly, targetY, epsY) {
  epsY = epsY || _SPAN_EPS_Y;
  var span = _polyRowXSpan(poly, targetY);
  if (span !== null) return { span: span, retried: false, retryY: null };
  // Retry below the scanline first (most common for top-edge miss)
  span = _polyRowXSpan(poly, targetY - epsY);
  if (span !== null) return { span: span, retried: true, retryY: targetY - epsY };
  // Retry above
  span = _polyRowXSpan(poly, targetY + epsY);
  if (span !== null) return { span: span, retried: true, retryY: targetY + epsY };
  return null;
}

// ── Compute largest axis-aligned inscribed rectangle inside polygon ───────────
// Starts from the bounding box and shrinks each side inward in small steps
// until all four corners are inside the polygon (conservative/inscribed result).
// Returns {xMin, xMax, yMin, yMax} or null if no valid rectangle was found.
function _computeInscribedRectangle(poly) {
  if (!poly || poly.length < 3) return null;
  var xs = poly.map(function(p) { return p[0]; });
  var ys = poly.map(function(p) { return p[1]; });
  var xMin = Math.min.apply(null, xs);
  var xMax = Math.max.apply(null, xs);
  var yMin = Math.min.apply(null, ys);
  var yMax = Math.max.apply(null, ys);

  var step = 0.25; // mm — inward shrink step per iteration
  var maxIter = Math.ceil(Math.max(xMax - xMin, yMax - yMin) / step) * 2 + 4;

  for (var iter = 0; iter < maxIter; iter++) {
    if (xMin >= xMax || yMin >= yMax) return null;
    var bl = _pointInPolygon(poly, xMin, yMin);
    var br = _pointInPolygon(poly, xMax, yMin);
    var tl = _pointInPolygon(poly, xMin, yMax);
    var tr = _pointInPolygon(poly, xMax, yMax);
    if (bl && br && tl && tr) break;
    if (!bl || !tl) xMin += step;
    if (!br || !tr) xMax -= step;
    if (!bl || !br) yMin += step;
    if (!tl || !tr) yMax -= step;
  }

  if (xMin >= xMax || yMin >= yMax) return null;
  if (!_pointInPolygon(poly, xMin, yMin) || !_pointInPolygon(poly, xMax, yMin) ||
      !_pointInPolygon(poly, xMin, yMax) || !_pointInPolygon(poly, xMax, yMax)) {
    return null;
  }
  return { xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax };
}

// ── Outline Surface Grid Probe (full heightmap over outline bounds) ────────────
async function runOutlineSurfaceGridProbe() {
  if (_outlineRunning) { outlineAppendLog('Already running.'); return; }
  _outlineRunning  = true;
  _outlineStopFlag = false;
  _stopRequested   = false;
  smStopFlag       = false;
  _running         = true;

  var runBtn  = document.getElementById('outline-grid-run-btn');
  var stopBtn = document.getElementById('outline-grid-stop-btn');
  if (runBtn)  runBtn.disabled  = true;
  if (stopBtn) stopBtn.disabled = false;

  clearLog('outline');
  outlineSetProgress(0);
  outlineSetStatus('Surface grid probe running\u2026', '');
  setFooterStatus('Outline surface grid probe running\u2026', '');

  try {
    var cfg = _outlineSettings();

    // Surface Z must be known before probing — either from running ▼ Surface Probe or
    // entered manually.  The clearance height and plunge depth are computed relative to
    // the measured surface so the probe always starts safely above the wood regardless
    // of where the machine's work Z=0 is set.
    var surfZ = _outlineGetSurfaceZ();
    if (surfZ === null) {
      throw new Error('Surface Z not set. Run \u25bc Surface Probe first or enter a value in the Surface Z field.');
    }
    outlineSurfaceZ = surfZ;

    var clearanceZ = surfZ + cfg.retractAbove;          // absolute work Z above the known surface
    var maxPlunge  = cfg.retractAbove + cfg.probeDown;  // relative plunge: clear above + search below surface
    var probeFeed  = cfg.probeFeed;
    var travelFeed = cfg.fastFeed;

    // Sync meshSubdivisionSpacing from UI before using it
    meshSubdivisionSpacing = (function() {
      var el = document.getElementById('meshSubdivisionSpacing');
      return el ? (Number(el.value) || meshSubdivisionSpacing) : meshSubdivisionSpacing;
    })();

    // Determine grid bounds: from detected outline (inset by margin) or fallback to search bounds
    var gridSource = (function() { var el = document.getElementById('outlineGridSource'); return el ? el.value : 'detected'; })();
    var gridMargin = (function() { var el = document.getElementById('outlineGridMargin'); return el ? (Number(el.value) || 2) : 2; })();
    var gridXCount = (function() { var el = document.getElementById('outlineGridXCount'); return el ? Math.max(2, parseInt(el.value) || 2) : 2; })();
    var gridYCount = (function() { var el = document.getElementById('outlineGridYCount'); return el ? Math.max(2, parseInt(el.value) || 2) : 2; })();
    var gridEdgeMargin = (function() { var el = document.getElementById('outlineGridEdgeMarginMm'); return el ? Math.max(0, Number(el.value) || 0) : 2; })();
    var gridSamplingMode = (function() { var el = document.getElementById('outlineGridSamplingMode'); return el ? el.value : 'centered'; })();
    var hasOutlineData = (outlineRowResults.length > 0 || outlineColResults.length > 0);

    var gridMinX, gridMaxX, gridMinY, gridMaxY;
    var gridSourceUsed; // 'detected' or 'fallback' — recorded for summary log
    var gridInsetPoly = null; // set when using detected-outline vector boundary mode

    if (gridSource === 'detected' && hasOutlineData) {
      // Build the actual outline polygon (same algorithm as SVG export / visualization)
      // then inset it by gridMargin and use the inset polygon for both bounding-box
      // grid generation and per-point inside/outside filtering.
      var outlinePoly = _buildOutlinePolygon();
      if (!outlinePoly || outlinePoly.length < 3) {
        throw new Error('Could not build outline polygon from scan data \u2014 too few valid edge points');
      }
      try {
        gridInsetPoly = _insetPolygon(outlinePoly, gridMargin);
      } catch (insetErr) {
        throw new Error('Inset margin ' + gridMargin + 'mm failed: ' + insetErr.message +
          ' \u2014 reduce Inset Margin or re-run Outline Scan');
      }
      // Compute grid bounding box from the OUTER polygon minus gridMargin rather
      // than from the inset polygon's own bounding box.  The inset polygon can
      // have miter spikes at zig-zag corners that push its bbox vertices outside
      // the expected inset distance (e.g. a spike to Y=234 when the outer top
      // edge is at Y=232 with a 2 mm inset).  Using the outer bbox avoids those
      // spikes, ensuring rows/cols are placed in the region where the inset
      // polygon actually has full-width coverage.
      gridMinX = Infinity; gridMaxX = -Infinity;
      gridMinY = Infinity; gridMaxY = -Infinity;
      outlinePoly.forEach(function(p) {
        if (p[0] < gridMinX) gridMinX = p[0];
        if (p[0] > gridMaxX) gridMaxX = p[0];
        if (p[1] < gridMinY) gridMinY = p[1];
        if (p[1] > gridMaxY) gridMaxY = p[1];
      });
      gridMinX += gridMargin; gridMaxX -= gridMargin;
      gridMinY += gridMargin; gridMaxY -= gridMargin;
      if (gridMinX >= gridMaxX) throw new Error('Inset polygon X span is zero after ' + gridMargin + 'mm inset \u2014 reduce Inset Margin');
      if (gridMinY >= gridMaxY) throw new Error('Inset polygon Y span is zero after ' + gridMargin + 'mm inset \u2014 reduce Inset Margin');
      gridSourceUsed = 'detected';
      outlineAppendLog('Grid source: Detected Outline vector boundary (inset ' + gridMargin + 'mm) \u2014 ' +
        outlinePoly.length + ' polygon vertices from ' + outlineRowResults.length + ' rows / ' + outlineColResults.length + ' cols');
      outlineAppendLog('Grid bounds from outline polygon \u00b1' + gridMargin + 'mm inset: X' + gridMinX.toFixed(3) + '\u2192' + gridMaxX.toFixed(3) +
        '  Y' + gridMinY.toFixed(3) + '\u2192' + gridMaxY.toFixed(3));
    } else {
      if (gridSource === 'detected') outlineAppendLog('Grid source: DETECTED OUTLINE requested but no outline scan data present \u2014 falling back to Outline Search Bounds.');
      else outlineAppendLog('Grid source: OUTLINE SEARCH BOUNDS (user-selected).');
      if (cfg.xLen <= 0 || cfg.yLen <= 0) throw new Error('Outline bounds invalid (XLen/YLen must be > 0)');
      gridMinX = cfg.x0;
      gridMaxX = cfg.x0 + cfg.xLen;
      gridMinY = cfg.y0;
      gridMaxY = cfg.y0 + cfg.yLen;
      gridSourceUsed = 'fallback';
      outlineAppendLog('Grid bounds from Outline Search Bounds: X' + gridMinX.toFixed(3) + '\u2192' + gridMaxX.toFixed(3) + '  Y' + gridMinY.toFixed(3) + '\u2192' + gridMaxY.toFixed(3));
    }

    // Apply Force rectangular boundary toggle: when ON with a detected outline,
    // discard the polygon boundary and probe within the plain bounding-box rectangle.
    // This is equivalent to not following the oval/irregular outline shape.
    if (cfg.forceRectangle && gridInsetPoly !== null) {
      gridInsetPoly = null;
      outlineAppendLog('Boundary mode: forced-rectangle (polygon boundary discarded \u2014 probing full rectangular region)');
    } else if (gridInsetPoly !== null) {
      outlineAppendLog('Boundary mode: detected-outline (oval/polygon boundary active \u2014 points outside outline will be skipped)');
    } else {
      outlineAppendLog('Boundary mode: rectangular (search bounds or no outline data)');
    }

    var xLen = gridMaxX - gridMinX;
    var yLen = gridMaxY - gridMinY;

    // Compute step spacing from counts and actual grid bounds
    var gridXStep = gridXCount > 1 ? xLen / (gridXCount - 1) : xLen;
    var gridYStep = gridYCount > 1 ? yLen / (gridYCount - 1) : yLen;

    var gridCfg = {
      minX:       gridMinX,
      maxX:       gridMaxX,
      colSpacing: gridXStep,
      minY:       gridMinY,
      maxY:       gridMaxY,
      rowSpacing: gridYStep,
      colCount:   gridXCount,
      rowCount:   gridYCount
    };

    var totalPoints = gridCfg.colCount * gridCfg.rowCount;
    var probed = 0;
    var skipped = 0;
    var result = [];
    for (var ri = 0; ri < gridCfg.rowCount; ri++) {
      result.push([]);
      for (var ci = 0; ci < gridCfg.colCount; ci++) result[ri].push(null);
    }

    outlineAppendLog('=== Outline Surface Grid Probe ===');
    outlineAppendLog('Bounds source: ' + (gridSourceUsed === 'detected' ? 'Detected Outline vector boundary (inset ' + gridMargin + 'mm)' : 'OUTLINE SEARCH BOUNDS (fallback)'));
    outlineAppendLog('Grid: ' + gridCfg.colCount + 'x' + gridCfg.rowCount + ' = ' + totalPoints + ' points' +
      (gridInsetPoly !== null ? ' (per-row X span from polygon boundary)' : ''));
    outlineAppendLog('Bounds: X' + gridCfg.minX.toFixed(3) + '\u2192' + gridCfg.maxX.toFixed(3) +
      '  Y' + gridCfg.minY.toFixed(3) + '\u2192' + gridCfg.maxY.toFixed(3) +
      '  edgeMargin=' + gridEdgeMargin.toFixed(3) + 'mm  sampling=' + gridSamplingMode);
    outlineAppendLog('Surface Z: ' + surfZ.toFixed(3) + ' \u2192 clearanceZ=' + clearanceZ.toFixed(3) +
      ' (surfZ + retractAbove=' + cfg.retractAbove.toFixed(3) + ')');
    outlineAppendLog('maxPlunge=' + maxPlunge.toFixed(3) + ' (retractAbove + probeDown=' + cfg.probeDown.toFixed(3) +
      ')  probeFeed=' + probeFeed + '  travelFeed=' + travelFeed);

    await requireStartupHomingPreflight('Outline Surface Grid Probe');

    // Move Z to clearanceZ (= surfZ + retractAbove) before the first lateral travel.
    // Using an absolute target ensures the machine is safely above the surface regardless
    // of where the outline scan left it.  clearanceZ is computed from the measured surface
    // Z so it is always the correct absolute height, not a raw field value.
    outlineAppendLog('INITIAL RETRACT: Z to clearanceZ=' + clearanceZ.toFixed(3));
    await sendCommand('G90 G1 Z' + clearanceZ.toFixed(3) + ' F' + travelFeed);
    await sleep(50);
    await waitForIdleWithTimeout();

    var SPAN_EPS = 0.05; // mm — threshold below which a span is treated as a single point

    // Apply Y edge margin: sample rows within [yEdge0, yEdge1].
    // Centered mode: rows at cell centres. Edge-inclusive mode: first/last rows at yEdge0/yEdge1.
    // If the margin makes the span degenerate, use a single row at the true Y center.
    var yEdge0 = gridCfg.minY + gridEdgeMargin;
    var yEdge1 = gridCfg.maxY - gridEdgeMargin;
    var yEdgeDegenerate = yEdge1 <= yEdge0;
    if (yEdgeDegenerate) {
      outlineAppendLog('Y edge margin=' + gridEdgeMargin.toFixed(3) + 'mm makes Y span degenerate \u2014 all rows will use single Y at center ' + ((gridCfg.minY + gridCfg.maxY) / 2).toFixed(3));
    } else if (gridInsetPoly !== null && gridSamplingMode === 'edge-inclusive') {
      // In edge-inclusive polygon mode the first/last row lands exactly at the polygon
      // bounding-box boundary.  A floating-point scanline exactly on a polygon vertex
      // can cause the ray-casting point-in-polygon test to misclassify points as outside.
      // Nudge the first/last row Y inward by _ROW_BOUNDARY_EPS so the scanline is
      // clearly inside the polygon, preventing spurious "outside boundary" skips.
      outlineAppendLog('Edge-inclusive polygon mode: applying Y boundary epsilon=' + _ROW_BOUNDARY_EPS.toFixed(4) +
        'mm nudge to first/last row \u2014 effective Y range [' + (yEdge0 + _ROW_BOUNDARY_EPS).toFixed(4) +
        ', ' + (yEdge1 - _ROW_BOUNDARY_EPS).toFixed(4) + ']');
    }

    function _computeRowY(rowIdx, rowCount) {
      if (yEdgeDegenerate || rowCount === 1) return (gridCfg.minY + gridCfg.maxY) / 2;
      if (gridSamplingMode === 'edge-inclusive') {
        var y = yEdge0 + rowIdx * (yEdge1 - yEdge0) / (rowCount - 1);
        // When probing inside an inset polygon, nudge the first and last row Y slightly
        // inward (_ROW_BOUNDARY_EPS) so they don't fall exactly on the polygon bounding-box
        // boundary.  This prevents floating-point / scanline vertex ambiguity in the
        // point-in-polygon test from incorrectly classifying boundary-adjacent points as outside.
        if (gridInsetPoly !== null) {
          if (rowIdx === 0) y += _ROW_BOUNDARY_EPS;
          else if (rowIdx === rowCount - 1) y -= _ROW_BOUNDARY_EPS;
        }
        return y;
      }
      // centered (default)
      return yEdge0 + (rowIdx + 0.5) * ((yEdge1 - yEdge0) / rowCount);
    }

    function _computeColX(colIdx, colCount, x0, x1) {
      if (x1 <= x0 || colCount === 1) return (x0 + x1) / 2;
      if (gridSamplingMode === 'edge-inclusive') {
        return x0 + colIdx * (x1 - x0) / (colCount - 1);
      }
      // centered (default)
      return x0 + (colIdx + 0.5) * ((x1 - x0) / colCount);
    }

    for (var row = 0; row < gridCfg.rowCount; row++) {
      outlineCheckStop();
      // Compute row Y using current sampling mode
      var rowY;
      if (yEdgeDegenerate || gridCfg.rowCount === 1) {
        rowY = (gridCfg.minY + gridCfg.maxY) / 2;
      } else {
        rowY = _computeRowY(row, gridCfg.rowCount);
      }
      // B) Row start log
      outlineAppendLog('--- ROW ' + row + '/' + (gridCfg.rowCount - 1) +
        ' Y=' + rowY.toFixed(3) + ' (' + gridSamplingMode + ', edgeMargin=' + gridEdgeMargin.toFixed(3) + 'mm) ---');

      // Compute per-row X span from the inset polygon boundary (scanline intersection).
      // When using detected outline mode each row's probe columns are generated from
      // xLeft to xRight so points start/end at the actual SVG boundary rather than
      // the global bounding-box edges.  Falls back to global minX..maxX when no
      // polygon is available (fallback bounds mode).
      var rowXLeft  = gridCfg.minX;
      var rowXRight = gridCfg.maxX;
      var rowIsDegenerate = false; // true when span width < SPAN_EPS (probe single point)
      if (gridInsetPoly !== null) {
        var rowSpanResult = _polyRowXSpanRobust(gridInsetPoly, rowY);
        if (rowSpanResult === null) {
          // No polygon intersection at this Y even after Y±eps retries — skip row.
          outlineAppendLog('--- ROW ' + row + ' Y=' + rowY.toFixed(3) +
            ': no polygon span at this Y (tried Y\u00b1' + _SPAN_EPS_Y + 'mm) \u2014 row skipped ---');
          skipped += gridCfg.colCount;
          outlineSetProgress((probed + skipped) / totalPoints * 100);
          continue;
        }
        if (rowSpanResult.retried) {
          outlineAppendLog('ROW ' + row + ' Y=' + rowY.toFixed(3) +
            ': no span at exact Y \u2014 using Y=' + rowSpanResult.retryY.toFixed(4) +
            ' (horizontal-edge offset \u00b1' + _SPAN_EPS_Y + 'mm)');
        }
        rowXLeft  = rowSpanResult.span.xLeft;
        rowXRight = rowSpanResult.span.xRight;
      }
      var rowColSpan = rowXRight - rowXLeft;
      rowIsDegenerate = rowColSpan < SPAN_EPS;

      // Apply X edge margin within the per-row span.
      // x0/x1 are the usable X bounds after inset; if they're degenerate, fall back to span center.
      var rowX0 = rowXLeft + gridEdgeMargin;
      var rowX1 = rowXRight - gridEdgeMargin;
      var rowMarginDegenerate = rowIsDegenerate || rowX1 <= rowX0;

      // Column step width for log display (centered: cell width; edge-inclusive: point-to-point distance).
      var rowCellWidth;
      if (rowMarginDegenerate) {
        rowCellWidth = 0;
      } else if (gridSamplingMode === 'edge-inclusive') {
        rowCellWidth = gridCfg.colCount > 1 ? (rowX1 - rowX0) / (gridCfg.colCount - 1) : 0;
      } else {
        rowCellWidth = (rowX1 - rowX0) / gridCfg.colCount;
      }

      if (rowIsDegenerate) {
        outlineAppendLog('ROW span: xLeft=' + rowXLeft.toFixed(3) + ', xRight=' + rowXRight.toFixed(3) +
          ', cols=' + gridCfg.colCount + ', dx=0 (degenerate span <' + SPAN_EPS + 'mm \u2014 single point only)');
      } else if (rowMarginDegenerate) {
        outlineAppendLog('ROW span: xLeft=' + rowXLeft.toFixed(3) + ', xRight=' + rowXRight.toFixed(3) +
          ', cols=' + gridCfg.colCount + ', dx=0 (span too small after edgeMargin=' + gridEdgeMargin.toFixed(3) + 'mm \u2014 single point at span center)');
      } else {
        outlineAppendLog('ROW span: xLeft=' + rowXLeft.toFixed(3) + ', xRight=' + rowXRight.toFixed(3) +
          ', cols=' + gridCfg.colCount + ', dx=' + rowCellWidth.toFixed(3) +
          ' (' + gridSamplingMode + ', edgeMargin=' + gridEdgeMargin.toFixed(3) + 'mm)');
      }

      // B) Find nearest outline row result for this Y (for edge comparison logging)
      var nearestRowEdge = (function(targetY) {
        if (!outlineRowResults || outlineRowResults.length === 0) return null;
        var best = null, bestDist = Infinity;
        for (var ri = 0; ri < outlineRowResults.length; ri++) {
          var d = Math.abs(outlineRowResults[ri].y - targetY);
          if (d < bestDist) { bestDist = d; best = outlineRowResults[ri]; }
        }
        return best;
      })(rowY);

      var rowProbed = 0, rowSkipped = 0;

      for (var step = 0; step < gridCfg.colCount; step++) {
        outlineCheckStop();
        var col = step;
        // If span is degenerate (xLeft ≈ xRight or too small after edge margin), only probe the
        // first column; skip the rest to avoid probing duplicate X positions for this row.
        if (rowMarginDegenerate && col > 0) {
          outlineAppendLog('SKIP [' + row + ',' + col + '] \u2014 degenerate span (same X as col 0; probing single point for this row)');
          skipped++;
          rowSkipped++;
          outlineSetProgress((probed + skipped) / totalPoints * 100);
          continue;
        }
        // Column X: position within the edge-margin-inset span using the current sampling mode.
        // For degenerate span (original or after margin), use the original span midpoint.
        var colX;
        if (rowMarginDegenerate) {
          colX = (rowXLeft + rowXRight) / 2;
        } else {
          colX = _computeColX(col, gridCfg.colCount, rowX0, rowX1);
        }

        // B) Find nearest outline col result for this X (for edge comparison logging)
        var nearestColEdge = (function(targetX) {
          if (!outlineColResults || outlineColResults.length === 0) return null;
          var best = null, bestDist = Infinity;
          for (var ci = 0; ci < outlineColResults.length; ci++) {
            var d = Math.abs(outlineColResults[ci].x - targetX);
            if (d < bestDist) { bestDist = d; best = outlineColResults[ci]; }
          }
          return best;
        })(colX);

        var edgeCtx = '';
        if (nearestRowEdge) {
          edgeCtx += ' nearestRow(Y=' + nearestRowEdge.y.toFixed(3) + ')' +
            ' xLeft=' + (nearestRowEdge.hasLeft  ? nearestRowEdge.xLeft.toFixed(3)   : 'n/a') +
            ' xRight=' + (nearestRowEdge.hasRight ? nearestRowEdge.xRight.toFixed(3) : 'n/a');
        }
        if (nearestColEdge) {
          edgeCtx += ' nearestCol(X=' + nearestColEdge.x.toFixed(3) + ')' +
            ' yBottom=' + (nearestColEdge.hasBottom ? nearestColEdge.yBottom.toFixed(3) : 'n/a') +
            ' yTop='    + (nearestColEdge.hasTop    ? nearestColEdge.yTop.toFixed(3)    : 'n/a');
        }

        // Edge-case guard: column X was computed from the polygon span so it should be
        // inside by construction; this check catches floating-point edge cases only.
        if (gridInsetPoly !== null && !_pointInPolygon(gridInsetPoly, colX, rowY)) {
          outlineAppendLog('SKIP [' + row + ',' + col + '] X' + colX.toFixed(3) + ' Y' + rowY.toFixed(3) +
            ' \u2014 outside inset outline boundary (edge case)' + edgeCtx);
          skipped++;
          rowSkipped++;
          outlineSetProgress((probed + skipped) / totalPoints * 100);
          continue;
        }

        outlineAppendLog('Probing [' + row + ',' + col + '] X' + colX.toFixed(3) + ' Y' + rowY.toFixed(3) + edgeCtx);

        // Lateral travel to next probe point using absolute-retract-then-XY pattern:
        // - row=0, step=0: machine is already at clearanceZ from the absolute retract above;
        //   use a plain XY move (no extra Z needed).
        // - all other points: coming from a probe contact (Z ≈ surfZ); _outlineAbsTravel
        //   raises to clearanceZ (absolute) before moving laterally.
        // Always travel explicitly to each probe point so position is always fresh/correct.
        if (row === 0 && step === 0) {
          await moveAbs(colX, rowY, null, travelFeed);
        } else {
          await _outlineAbsTravel(colX, rowY, clearanceZ, travelFeed, travelFeed);
        }

        // Ensure probe pin is not already triggered before plunging; retries up to 3× if stuck
        await smEnsureProbeClear(clearanceZ, travelFeed);

        // Grid Z plunge uses G38.3 (no error on miss) so an unexpected void/air gap
        // near the outline edge does not ALARM the controller.
        // null return = no contact within maxPlunge → store null, retract, continue.
        var pos = await _outlinePlungeProbeG383(maxPlunge, probeFeed, clearanceZ);
        if (pos === null) {
          // No contact — machine stopped at bottom of travel; retract to clearanceZ
          await sendCommand('G90 G1 Z' + clearanceZ.toFixed(3) + ' F' + travelFeed);
          await sleep(50);
          await waitForIdleWithTimeout(30000);
          result[row][col] = null;
          skipped++;
          rowSkipped++;
          outlineSetProgress((probed + skipped) / totalPoints * 100);
          outlineAppendLog('  -> no contact (G38.3 miss) \u2014 stored null');
          continue;
        }
        result[row][col] = pos.z;
        probed++;
        rowProbed++;
        outlineSetProgress((probed + skipped) / totalPoints * 100);
        outlineAppendLog('  -> Z=' + pos.z.toFixed(4));
      }

      // B) Row end summary
      outlineAppendLog('--- ROW ' + row + ' done: ' + rowProbed + ' probed, ' + rowSkipped + ' skipped ---');

      // Row transition: retract Z and pre-position near start of next row.
      // Uses the Y of the next row and the first column X within its span (per sampling mode).
      if (row + 1 < gridCfg.rowCount) {
        outlineCheckStop();
        var nextRowIdx = row + 1;
        // Y for next row using current sampling mode
        var nextY = _computeRowY(nextRowIdx, gridCfg.rowCount);
        var nextStartX = gridCfg.minX;
        if (gridInsetPoly !== null) {
          var nextRowSpanResult = _polyRowXSpanRobust(gridInsetPoly, nextY);
          if (nextRowSpanResult !== null) {
            var nSpan = nextRowSpanResult.span;
            var nX0 = nSpan.xLeft + gridEdgeMargin;
            var nX1 = nSpan.xRight - gridEdgeMargin;
            if (nX1 <= nX0 || nSpan.xRight - nSpan.xLeft < SPAN_EPS) {
              nextStartX = (nSpan.xLeft + nSpan.xRight) / 2;
            } else {
              nextStartX = _computeColX(0, gridCfg.colCount, nX0, nX1);
            }
          }
        }
        outlineAppendLog('ROW TRANSITION: row ' + row + ' done; moving to start of row ' + nextRowIdx +
          ' X=' + nextStartX.toFixed(3) + ' Y=' + nextY.toFixed(3));
        await _outlineAbsTravel(nextStartX, nextY, clearanceZ, travelFeed, travelFeed);
        await smEnsureProbeClear(clearanceZ, travelFeed);
      }
    }

    // Store results in the global surface mesh variables (same as Probe tab)
    smMeshDataRaw   = result;
    smGridConfigRaw = gridCfg;
    smLastInsetPolygon = gridInsetPoly; // null when using fallback bounds (no detected outline)
    var subdivided  = subdivideSurfaceMesh(result, gridCfg, meshSubdivisionSpacing);
    smMeshData      = subdivided.grid;
    smGridConfig    = subdivided.config;

    outlineSetProgress(100);
    outlineAppendLog('Surface grid probe complete! ' + probed + ' probed, ' + skipped + ' skipped (outside boundary or no contact), ' + totalPoints + ' total grid points.');
    outlineSetStatus('Grid probe done \u2013 ' + probed + ' probed / ' + skipped + ' skipped', 'good');
    setFooterStatus('Outline surface grid probe complete', 'good');

    // Finish motion: retract Z, then always return to work origin X0 Y0
    await finishRunMotion('outline', travelFeed);
    outlineAppendLog('Returning to work origin X0 Y0\u2026');
    await moveAbs(0, 0, null, travelFeed);

    // Persist mesh and refresh UI (enables DXF/OBJ/STL exports and Apply tab)
    smSaveMeshToStorage();
    try { updateSurfaceMeshUI(); }    catch(e) { console.warn('updateSurfaceMeshUI error (non-fatal):', e); }
    try { populateSurfaceResults(); } catch(e) { console.warn('populateSurfaceResults error (non-fatal):', e); }
    // Show the Outline tab export panel so DXF/OBJ/STL are immediately available
    _showOutlineSurfExportPanel();

  } catch(e) {
    var msg;
    if (e && e.message) { msg = e.message; }
    else if (e == null)  { msg = 'Unknown error'; }
    else                 { msg = String(e); }
    if (msg === 'STOP_REQUESTED' || msg === 'Stopped by user') {
      outlineAppendLog('Stopped by user.');
      outlineSetStatus('Stopped', 'warn');
      setFooterStatus('Outline grid probe stopped', 'warn');
      // Safety retract/home is handled by stopNowAndSafeHome — do not call here.
    } else {
      outlineAppendLog('ERROR: ' + msg);
      outlineSetStatus('Error: ' + msg, 'error');
      setFooterStatus('Outline grid probe error: ' + msg, 'error');
      console.error('Outline surface grid probe error:', e);
      await _outlineSafetyRetract();
    }
  } finally {
    _outlineRunning  = false;
    _outlineStopFlag = false;
    _running         = false;
    var runBtnF  = document.getElementById('outline-grid-run-btn');
    var stopBtnF = document.getElementById('outline-grid-stop-btn');
    if (runBtnF)  runBtnF.disabled  = false;
    if (stopBtnF) stopBtnF.disabled = true;
  }
}

// ── Draw outline canvas ───────────────────────────────────
function drawOutlineCanvas() {
  if (window.probeViz && typeof window.probeViz.drawOutlineCanvas === 'function') {
    window.probeViz.drawOutlineCanvas();
  }
}

// ── Show / wire Outline tab Surface Mesh Export panel ────
// Called after Outline Surface Grid Probe completes so the export panel
// becomes immediately visible without switching to the Probe tab.
function _showOutlineSurfExportPanel() {
  var panel = document.getElementById('outline-surf-export-panel');
  if (panel) panel.style.display = '';
}

// Wire Outline tab export buttons once the DOM is ready.
// Reuses the same export functions as the Probe tab (no duplicated logic).
(function _wireOutlineExportButtons() {
  function _wire() {
    var dxfBtn = document.getElementById('btn-outline-export-surf-dxf');
    var objBtn = document.getElementById('btn-outline-export-surf-obj');
    var stlBtn = document.getElementById('btn-outline-export-surf-stl');
    var stlSmoothBtn = document.getElementById('btn-outline-export-surf-stl-smooth');
    if (dxfBtn) dxfBtn.addEventListener('click', function() { flashButton(this); exportSurfaceDXF(); });
    if (objBtn) objBtn.addEventListener('click', function() { flashButton(this); exportSurfaceOBJ(); });
    if (stlBtn) stlBtn.addEventListener('click', function() { flashButton(this); exportSurfaceSTL(); });
    if (stlSmoothBtn) stlSmoothBtn.addEventListener('click', function() { flashButton(this); exportSurfaceSTLSmooth(); });
    // Show panel if mesh data is already present (e.g. after page reload with saved mesh)
    if (typeof smMeshData !== 'undefined' && smMeshData) _showOutlineSurfExportPanel();
    // Initialise count helper text on page load
    try { updateOutlineCountHelpers(); } catch(e) {}
    try { updateOutlineGridCountHelpers(); } catch(e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wire);
  } else {
    _wire();
  }
})();

// ── Move probe to absolute centre of outline ──────────────
async function moveToCentre() {
  if (outlineRowResults.length === 0 && outlineColResults.length === 0) {
    outlineAppendLog('No outline data — run Outline Scan first.');
    outlineSetStatus('No outline data – run Outline Scan first', 'warn');
    return;
  }

  var allX = [], allY = [];
  outlineRowResults.forEach(function(r) {
    if (r.hasLeft  && r.xLeft  !== null) { allX.push(r.xLeft);  allY.push(r.y); }
    if (r.hasRight && r.xRight !== null) { allX.push(r.xRight); allY.push(r.y); }
  });
  outlineColResults.forEach(function(c) {
    if (c.hasBottom && c.yBottom !== null) { allX.push(c.x); allY.push(c.yBottom); }
    if (c.hasTop    && c.yTop    !== null) { allX.push(c.x); allY.push(c.yTop); }
  });

  if (allX.length === 0) {
    outlineAppendLog('No valid edge points to compute centre.');
    return;
  }

  var xMin = Math.min.apply(null, allX);
  var xMax = Math.max.apply(null, allX);
  var yMin = Math.min.apply(null, allY);
  var yMax = Math.max.apply(null, allY);
  var cx = (xMin + xMax) / 2;
  var cy = (yMin + yMax) / 2;

  var cfg = _outlineSettings();
  var surfZ = (typeof outlineSurfaceZ !== 'undefined' && outlineSurfaceZ !== null) ? outlineSurfaceZ : 0;
  var safeTravelZ = surfZ + cfg.safeTravelZ;

  outlineAppendLog('MOVE TO CENTRE: X=' + cx.toFixed(3) + ' Y=' + cy.toFixed(3) + ' via safeTravelZ=' + safeTravelZ.toFixed(3));
  try {
    await _outlineAbsTravel(cx, cy, safeTravelZ, cfg.fastFeed, cfg.retractFeed);
    outlineAppendLog('Arrived at outline centre X=' + cx.toFixed(3) + ' Y=' + cy.toFixed(3));
    outlineSetStatus('At centre X=' + cx.toFixed(3) + ' Y=' + cy.toFixed(3), 'good');
    setFooterStatus('Probe moved to outline centre', 'good');
  } catch(e) {
    outlineAppendLog('ERROR moving to centre: ' + e.message);
    outlineSetStatus('Error moving to centre: ' + e.message, 'error');
  }
}

// ── Set WCS zero to absolute centre of outline ────────────
async function setWCSToCentre() {
  if (outlineRowResults.length === 0 && outlineColResults.length === 0) {
    outlineAppendLog('No outline data — run Outline Scan first.');
    outlineSetStatus('No outline data – run Outline Scan first', 'warn');
    return;
  }

  var allX = [], allY = [];
  outlineRowResults.forEach(function(r) {
    if (r.hasLeft  && r.xLeft  !== null) { allX.push(r.xLeft);  allY.push(r.y); }
    if (r.hasRight && r.xRight !== null) { allX.push(r.xRight); allY.push(r.y); }
  });
  outlineColResults.forEach(function(c) {
    if (c.hasBottom && c.yBottom !== null) { allX.push(c.x); allY.push(c.yBottom); }
    if (c.hasTop    && c.yTop    !== null) { allX.push(c.x); allY.push(c.yTop); }
  });

  if (allX.length === 0) {
    outlineAppendLog('No valid edge points to compute centre.');
    return;
  }

  var xMin = Math.min.apply(null, allX);
  var xMax = Math.max.apply(null, allX);
  var yMin = Math.min.apply(null, allY);
  var yMax = Math.max.apply(null, allY);
  var cx = (xMin + xMax) / 2;
  var cy = (yMin + yMax) / 2;

  var cmd = 'G10 L20 P1 X' + cx.toFixed(3) + ' Y' + cy.toFixed(3);
  outlineAppendLog('Set WCS zero to outline centre: ' + cmd);
  try {
    await sendCommand(cmd);
    outlineAppendLog('WCS X/Y zeroed at centre X=' + cx.toFixed(3) + ' Y=' + cy.toFixed(3));
    outlineSetStatus('WCS zeroed at centre X=' + cx.toFixed(3) + ' Y=' + cy.toFixed(3), 'good');
    setFooterStatus('WCS X/Y set to outline centre', 'good');
  } catch(e) {
    outlineAppendLog('ERROR setting WCS: ' + e.message);
    outlineSetStatus('Error setting WCS: ' + e.message, 'error');
  }
}

// ── Export SVG ────────────────────────────────────────────
function exportOutlineSVG() {
  if (outlineRowResults.length === 0 && outlineColResults.length === 0) {
    outlineAppendLog('No outline data to export.');
    return;
  }

  var cfg    = _outlineSettings();
  var margin = 10;
  var svgW   = cfg.xLen + 2 * margin;
  var svgH   = cfg.yLen + 2 * margin;

  function svgX(worldX) { return (worldX - cfg.x0 + margin).toFixed(3); }
  function svgY(worldY) { return (svgH - (worldY - cfg.y0 + margin)).toFixed(3); }

  var lines = [];
  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + svgW + 'mm" height="' + svgH + 'mm" viewBox="0 0 ' + svgW + ' ' + svgH + '">');
  lines.push('  <title>Live Edge Outline \u2013 ' + tsForFilename() + '</title>');
  lines.push('  <style>path { fill:none; }</style>');

  // Collect all edge points
  var allPts = [];
  outlineRowResults.forEach(function(r) {
    if (r.hasLeft  && r.xLeft  !== null) allPts.push([r.xLeft,  r.y]);
    if (r.hasRight && r.xRight !== null) allPts.push([r.xRight, r.y]);
  });
  outlineColResults.forEach(function(c) {
    if (c.hasBottom && c.yBottom !== null) allPts.push([c.x, c.yBottom]);
    if (c.hasTop    && c.yTop    !== null) allPts.push([c.x, c.yTop]);
  });

  // Deduplicate points within 0.1mm
  var dedupPts = [];
  allPts.forEach(function(pt) {
    var dup = dedupPts.some(function(p) {
      return Math.abs(p[0] - pt[0]) < 0.1 && Math.abs(p[1] - pt[1]) < 0.1;
    });
    if (!dup) dedupPts.push(pt);
  });

  if (dedupPts.length > 2) {
    // Find bottom-left point (lowest Y, then lowest X as tiebreaker) as the start.
    var blIdx = 0;
    dedupPts.forEach(function(p, i) {
      var b = dedupPts[blIdx];
      if (p[1] < b[1] || (p[1] === b[1] && p[0] < b[0])) blIdx = i;
    });

    // Order points using greedy nearest-neighbour traversal starting from blIdx.
    // More robust than a pure angular sort when probe points cluster at similar
    // centroid angles (e.g. row-scan and column-scan points mixing near the top
    // of a wide oval), because it always picks the physically closest unvisited
    // point rather than relying on angle from a distant centroid.
    var nnOrdered = [];
    var nnUsed = new Array(dedupPts.length).fill(false);
    var nnCur = blIdx;
    nnUsed[nnCur] = true;
    nnOrdered.push(dedupPts[nnCur]);
    while (nnOrdered.length < dedupPts.length) {
      var nnBest = -1, nnBestD = Infinity;
      for (var j = 0; j < dedupPts.length; j++) {
        if (nnUsed[j]) continue;
        var ddx = dedupPts[j][0] - dedupPts[nnCur][0];
        var ddy = dedupPts[j][1] - dedupPts[nnCur][1];
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 < nnBestD) { nnBestD = d2; nnBest = j; }
      }
      if (nnBest === -1) break;
      nnUsed[nnBest] = true;
      nnCur = nnBest;
      nnOrdered.push(dedupPts[nnCur]);
    }
    // Ensure clockwise winding (negative signed area in world Y-up coords).
    var nnArea = 0;
    for (var i = 0; i < nnOrdered.length; i++) {
      var j2 = (i + 1) % nnOrdered.length;
      nnArea += nnOrdered[i][0] * nnOrdered[j2][1] - nnOrdered[j2][0] * nnOrdered[i][1];
    }
    if (nnArea > 0) nnOrdered.reverse(); // CCW → flip to CW
    dedupPts = nnOrdered;

    if (cfg.forceRectangle) {
      // Force rectangle: compute inscribed axis-aligned rectangle and export as 4 straight lines.
      var rect = _computeInscribedRectangle(dedupPts);
      if (rect) {
        var dRect = 'M ' + svgX(rect.xMin) + ',' + svgY(rect.yMin) +
                    ' L ' + svgX(rect.xMax) + ',' + svgY(rect.yMin) +
                    ' L ' + svgX(rect.xMax) + ',' + svgY(rect.yMax) +
                    ' L ' + svgX(rect.xMin) + ',' + svgY(rect.yMax) +
                    ' Z';
        lines.push('  <path d="' + dRect + '" stroke="#000000" stroke-width="0.8" />');
      } else {
        outlineAppendLog('Force rectangle: could not compute inscribed rectangle; falling back to spline.');
        cfg.forceRectangle = false; // fall through to spline below
      }
    }

    if (!cfg.forceRectangle) {
      // Smooth closed centripetal Catmull-Rom spline (alpha=0.5).
      // Converts each segment directly to an exact cubic bezier ('C' SVG command)
      // using the centripetal-CR tangent formula — no polyline subdivision needed,
      // giving a mathematically perfect smooth curve in the exported SVG.
      function crBezier(p0, p1, p2, p3) {
        // knot interval = (chord_length)^0.5 (centripetal, alpha=0.5)
        function knot(a, b) {
          var dx = b[0]-a[0], dy = b[1]-a[1];
          return Math.pow(dx*dx + dy*dy, 0.25);
        }
        var t0 = 0;
        var t1 = t0 + Math.max(knot(p0, p1), 1e-4);
        var t2 = t1 + Math.max(knot(p1, p2), 1e-4);
        var t3 = t2 + Math.max(knot(p2, p3), 1e-4);
        var dt = t2 - t1;
        // Centripetal CR derivative at p1 and p2 (w.r.t. knot parameter t)
        var T1x = (p1[0]-p0[0])/(t1-t0) - (p2[0]-p0[0])/(t2-t0) + (p2[0]-p1[0])/dt;
        var T1y = (p1[1]-p0[1])/(t1-t0) - (p2[1]-p0[1])/(t2-t0) + (p2[1]-p1[1])/dt;
        var T2x = (p2[0]-p1[0])/dt - (p3[0]-p1[0])/(t3-t1) + (p3[0]-p2[0])/(t3-t2);
        var T2y = (p2[1]-p1[1])/dt - (p3[1]-p1[1])/(t3-t1) + (p3[1]-p2[1])/(t3-t2);
        // Cubic bezier control points: cp1 = p1 + T1*dt/3,  cp2 = p2 - T2*dt/3
        return [
          [p1[0] + T1x*dt/3, p1[1] + T1y*dt/3],
          [p2[0] - T2x*dt/3, p2[1] - T2y*dt/3]
        ];
      }
      var n = dedupPts.length;
      function wIdx(i) { return ((i % n) + n) % n; } // wrap index for closed loop
      var dPoly = 'M ' + svgX(dedupPts[0][0]) + ',' + svgY(dedupPts[0][1]);
      for (var k = 0; k < n; k++) {
        var p0 = dedupPts[wIdx(k - 1)];
        var p1 = dedupPts[wIdx(k)];
        var p2 = dedupPts[wIdx(k + 1)];
        var p3 = dedupPts[wIdx(k + 2)];
        var bz = crBezier(p0, p1, p2, p3);
        dPoly += ' C ' + svgX(bz[0][0]) + ',' + svgY(bz[0][1]) +
                 ' '   + svgX(bz[1][0]) + ',' + svgY(bz[1][1]) +
                 ' '   + svgX(p2[0])    + ',' + svgY(p2[1]);
      }
      dPoly += ' Z';
      lines.push('  <path d="' + dPoly + '" stroke="#000000" stroke-width="0.8" />');
    }
  }

  lines.push('</svg>');

  saveTextFile('outline_' + tsForFilename() + '.svg', lines.join('\n'));
  outlineAppendLog('SVG exported.');
}

// ── Export outline JSON ───────────────────────────────────
function exportOutlineJSON() {
  var payload = {
    generated: new Date().toISOString(),
    settings: _outlineSettings(),
    surfaceZ: outlineSurfaceZ,
    rowResults: outlineRowResults,
    colResults: outlineColResults
  };
  saveTextFile('outline_data_' + tsForFilename() + '.json', JSON.stringify(payload, null, 2));
  outlineAppendLog('Outline data exported as JSON.');
}
