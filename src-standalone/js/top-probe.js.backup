function _smTimingReset(totalPoints) {
  smTimingStats = {
    runStart: Date.now(),
    totalPoints: totalPoints,
    // Z-lift moves (relative raise before each lateral travel)
    zLift:      { totalMs: 0, count: 0 },
    // Lateral X/Y travel moves (G38.3)
    lateral:    { totalMs: 0, count: 0, minMs: Infinity, maxMs: 0 },
    // waitForIdle polling totals (all calls during the run)
    waitIdle:   { totalMs: 0, calls: 0 },
    // G38.2 probe plunges
    plunges:    { totalMs: 0, count: 0, minMs: Infinity, maxMs: 0 },
    // smEnsureProbeClear triggered events (probe pre-triggered before plunge)
    preTrigger: { events: 0, totalMs: 0 },
    // smSafeLateralMove travel contact (G38.3 stopped short)
    travelContact: { events: 0, recoveryTotalMs: 0 },
    // smFinishMotion duration
    finishMotion: { totalMs: 0 },
    // Per-point durations (ms)
    perPoint: []
  };
  _smTimingEnabled = true;
}

function _smEmitTimingSummary(outcome) {
  if (!smTimingStats) return;
  _smTimingEnabled = false;
  var st = smTimingStats;
  var totalMs = Date.now() - st.runStart;
  var pp = st.perPoint;
  var ppAvg = pp.length ? Math.round(pp.reduce(function(a,b){ return a+b; }, 0) / pp.length) : 0;
  var ppMin = pp.length ? Math.min.apply(null, pp) : 0;
  var ppMax = pp.length ? Math.max.apply(null, pp) : 0;
  var lAvg = st.lateral.count ? Math.round(st.lateral.totalMs / st.lateral.count) : 0;
  var lMin = st.lateral.count ? st.lateral.minMs : 0;
  var lMax = st.lateral.count ? st.lateral.maxMs : 0;
  var pAvg = st.plunges.count ? Math.round(st.plunges.totalMs / st.plunges.count) : 0;
  var pMin = st.plunges.count ? st.plunges.minMs : 0;
  var pMax = st.plunges.count ? st.plunges.maxMs : 0;
  smLogProbe('[TIMING] ══════════════════════════════════════════════');
  smLogProbe('[TIMING] Surface probe run ' + outcome + ' — ' + st.totalPoints + ' pts in ' + (totalMs / 1000).toFixed(1) + 's');
  smLogProbe('[TIMING] Per-point    : ' + pp.length + ' pts · avg=' + ppAvg + 'ms  min=' + ppMin + 'ms  max=' + ppMax + 'ms');
  smLogProbe('[TIMING] Probe plunges: ' + st.plunges.count + ' · avg=' + pAvg + 'ms  min=' + pMin + 'ms  max=' + pMax + 'ms  total=' + st.plunges.totalMs + 'ms');
  smLogProbe('[TIMING] Z-lift moves : ' + st.zLift.count + ' · total=' + st.zLift.totalMs + 'ms  avg=' + (st.zLift.count ? Math.round(st.zLift.totalMs / st.zLift.count) : 0) + 'ms');
  smLogProbe('[TIMING] Lateral moves: ' + st.lateral.count + ' · avg=' + lAvg + 'ms  min=' + lMin + 'ms  max=' + lMax + 'ms  total=' + st.lateral.totalMs + 'ms');
  smLogProbe('[TIMING] waitForIdle  : ' + st.waitIdle.calls + ' calls · total=' + st.waitIdle.totalMs + 'ms');
  smLogProbe('[TIMING] Pre-trigger  : ' + st.preTrigger.events + ' events · clear time=' + st.preTrigger.totalMs + 'ms');
  smLogProbe('[TIMING] Travel contact: ' + st.travelContact.events + ' hits · recovery=' + st.travelContact.recoveryTotalMs + 'ms');
  smLogProbe('[TIMING] Finish motion: ' + st.finishMotion.totalMs + 'ms');
  smLogProbe('[TIMING] ══════════════════════════════════════════════');
  var json = JSON.stringify({
    outcome: outcome,
    totalMs: totalMs,
    totalPoints: st.totalPoints,
    probedPoints: pp.length,
    perPoint:      { avgMs: ppAvg, minMs: ppMin, maxMs: ppMax },
    plunges:       { count: st.plunges.count, avgMs: pAvg, minMs: pMin, maxMs: pMax, totalMs: st.plunges.totalMs },
    zLift:         { count: st.zLift.count, totalMs: st.zLift.totalMs },
    lateral:       { count: st.lateral.count, avgMs: lAvg, minMs: lMin, maxMs: lMax, totalMs: st.lateral.totalMs },
    waitIdle:      { calls: st.waitIdle.calls, totalMs: st.waitIdle.totalMs },
    preTrigger:    { events: st.preTrigger.events, totalMs: st.preTrigger.totalMs },
    travelContact: { events: st.travelContact.events, recoveryTotalMs: st.travelContact.recoveryTotalMs },
    finishMotion:  { totalMs: st.finishMotion.totalMs }
  });
  smLogProbe('[TIMING] JSON: ' + json);
}

function buildSurfaceGridConfig() {
  var minX = Number(document.getElementById('sm-minX').value);
  var maxX = Number(document.getElementById('sm-maxX').value);
  var spacingX = Number(document.getElementById('sm-spacingX').value);
  var minY = Number(document.getElementById('sm-minY').value);
  var maxY = Number(document.getElementById('sm-maxY').value);
  var spacingY = Number(document.getElementById('sm-spacingY').value);
  if (minX >= maxX || minY >= maxY || spacingX <= 0 || spacingY <= 0) {
    alert('Invalid grid settings: Min must be less than Max, spacing must be > 0');
    return null;
  }
  var colCount = Math.floor((maxX - minX) / spacingX) + 1;
  var rowCount = Math.floor((maxY - minY) / spacingY) + 1;
  return { minX: minX, maxX: maxX, colSpacing: spacingX, minY: minY, maxY: maxY, rowSpacing: spacingY, colCount: colCount, rowCount: rowCount };
}

function smCheckStop() {
  if (smStopFlag && !_safetyMoveActive) throw new Error('Stopped by user');
}
function smSleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }


function smGetProbeTriggered() {
  return _getState().then(function(state) {
    var ms = _machineStateFrom(state);
    return (ms.Pn || '').indexOf('P') >= 0;
  });
}

// Perform an initial relative Z lift before the first probe point.
// This ensures the probe starts above the surface, not at or below it.
// logMode - the mode name for logging ('surface', 'face', 'sm')
// liftAmount - relative Z coords to lift
// feed - travel feed rate in mm/min
async function smPerformInitialClearanceLift(logMode, liftAmount, feed) {
  var logFn = (logMode === 'face') ? function(m) { logLine('face', m); } : smLogProbe;
  logFn('INITIAL LIFT: Raising Z by ' + liftAmount.toFixed(3) + ' coords before first probe point...');
  pluginDebug('smPerformInitialClearanceLift: logMode=' + logMode + ' liftAmount=' + liftAmount + ' feed=' + feed);
  var liftCmd = 'G91 G1 Z' + liftAmount.toFixed(3) + ' F' + feed;
  logFn('[PLUGIN DEBUG] smPerformInitialClearanceLift: sending command: ' + liftCmd);
  await sendCommand(liftCmd);
  await sleep(50); // Brief delay to ensure controller starts processing
  await waitForIdleWithTimeout();
  await sendCommand('G90'); // Return to absolute mode
  await waitForIdleWithTimeout();
  var pos = await getWorkPosition();
  logFn('INITIAL LIFT: Z now at ' + pos.z.toFixed(3) + ' coords');
  pluginDebug('smPerformInitialClearanceLift EXIT: Z=' + pos.z.toFixed(3));
}

// Verify probe input is open before issuing a plunge. If triggered, raises Z above
// clearanceZ + 2 coords and waits 200ms, then re-checks. Up to maxAttempts retries.
async function smEnsureProbeClear(clearanceZ, travelFeed) {
  pluginDebug('smEnsureProbeClear ENTER: clearanceZ=' + clearanceZ + ' travelFeed=' + travelFeed);
  var maxAttempts = 3;
  for (var attempt = 0; attempt <= maxAttempts; attempt++) {
    var triggered = await smGetProbeTriggered();
    if (!triggered){ pluginDebug('smEnsureProbeClear OK: probe is clear (attempt ' + attempt + ')'); return; }
    if (attempt >= maxAttempts) {
      pluginDebug('smEnsureProbeClear ERROR: probe stuck triggered after ' + maxAttempts + ' attempts');
      throw new Error('Probe input stuck triggered after ' + maxAttempts + ' clearing attempts; aborting');
    }
    smLogProbe('Probe triggered before plunge (attempt ' + (attempt + 1) + '/' + maxAttempts + '); raising Z to clear...');
    pluginDebug('smEnsureProbeClear: probe triggered attempt=' + (attempt + 1) + '/' + maxAttempts + ', raising Z');
    if (_smTimingEnabled && smTimingStats) { smTimingStats.preTrigger.events++; }
    var _preTriggerStart = _smTimingEnabled ? Date.now() : 0;
    var pos = await getWorkPosition();
    var targetZ = Math.max(pos.z, clearanceZ) + 2; // 2 coords above clearance to ensure probe clears
    var clearCmd = 'G90 G1 Z' + targetZ.toFixed(3) + ' F' + travelFeed;
    smLogProbe('[PLUGIN DEBUG] smEnsureProbeClear: sending command: ' + clearCmd);
    pluginDebug('smEnsureProbeClear: sending: ' + clearCmd);
    await sendCommand(clearCmd);
    await sleep(50); // Brief delay to ensure controller starts processing
    await waitForIdleWithTimeout();
    await smSleep(200); // 200ms settle time for probe input to clear
    if (_smTimingEnabled && smTimingStats) { smTimingStats.preTrigger.totalMs += Date.now() - _preTriggerStart; }
  }
}

async function smSafeLateralMove(targetX, targetY, travelFeed, clearanceZ) {
  pluginDebug('smSafeLateralMove ENTER: targetX=' + targetX + ' targetY=' + targetY + ' travelFeed=' + travelFeed + ' clearanceZ=' + clearanceZ);
  var backoff = Math.max(0.1, Number(document.getElementById('travelContactBackoff').value) || 5);
  var lift = Math.max(0.1, Number(document.getElementById('travelContactLift').value) || 5);
  var maxRetries = Math.max(1, Math.round(Number(document.getElementById('travelContactMaxRetries').value) || 5));

  smLogProbe('TRAVEL: lifting Z by ' + clearanceZ.toFixed(3) + ' coords (relative), then moving to X' + targetX.toFixed(3) + ' Y' + targetY.toFixed(3));

  // Move a single axis to target using one full-distance G38.3 command.
  // If the probe triggers mid-move (stopped short), back off opposite to travel direction,
  // lift Z, and retry up to maxRetries times.
  async function moveAxis(axis, target) {
    var retries = 0;
    async function attempt() {
      smCheckStop();
      var pos = await getWorkPosition();
      var current = (axis === 'X') ? pos.x : pos.y;
      if (Math.abs(current - target) < 0.1) return;
      var travelDir = (target > current) ? 1 : -1;
      var _travelStart = _smTimingEnabled ? Date.now() : 0;
      await sendCommand('G90 G38.3 ' + axis + target.toFixed(3) + ' F' + travelFeed);
      await sleep(50); // Brief delay to ensure controller starts processing
      await waitForIdleWithTimeout();
      var newPos = await getWorkPosition();
      var arrived = (axis === 'X') ? newPos.x : newPos.y;
      if (Math.abs(arrived - target) <= 0.1) {
        if (_smTimingEnabled && smTimingStats) {
          var _tMs = Date.now() - _travelStart;
          smTimingStats.lateral.totalMs += _tMs;
          smTimingStats.lateral.count++;
          if (_tMs < smTimingStats.lateral.minMs) smTimingStats.lateral.minMs = _tMs;
          if (_tMs > smTimingStats.lateral.maxMs) smTimingStats.lateral.maxMs = _tMs;
        }
        return;
      }
      // Stopped short — probe triggered during lateral travel
      smLogProbe('TRAVEL CONTACT (' + axis + '): stopped at ' + arrived.toFixed(3) + ', target ' + target.toFixed(3) + '.');
      if (_smTimingEnabled && smTimingStats) { smTimingStats.travelContact.events++; }
      if (retries >= maxRetries) {
        throw new Error('Travel path blocked after ' + maxRetries + ' contact recoveries on ' + axis + ' axis.');
      }
      retries++;
      var bounceVal = arrived - travelDir * backoff;
      var liftZ = newPos.z + lift;
      var _recoveryStart = _smTimingEnabled ? Date.now() : 0;
      smLogProbe('TRAVEL CONTACT: recovery ' + retries + '/' + maxRetries + ': ' + axis + ' to ' + bounceVal.toFixed(3) + ', lift Z to ' + liftZ.toFixed(3) + '.');
      await sendCommand('G90 G1 ' + axis + bounceVal.toFixed(3) + ' F' + travelFeed);
      await sleep(50); // Brief delay to ensure controller starts processing
      await waitForIdleWithTimeout();
      await sendCommand('G90 G1 Z' + liftZ.toFixed(3) + ' F' + travelFeed);
      await sleep(50); // Brief delay to ensure controller starts processing
      await waitForIdleWithTimeout();
      await smSleep(120);
      if (_smTimingEnabled && smTimingStats) { smTimingStats.travelContact.recoveryTotalMs += Date.now() - _recoveryStart; }
      await attempt();
    }
    await attempt();
  }

  // Lift Z by at least 5mm relative from current position (contact point), then travel X/Y.
  // Using Math.max(5, clearanceZ) ensures the probe pin reliably clears even if the user
  // configured a small clearanceZ, so smEnsureProbeClear() passes through as a no-op.
  var effectiveLift = Math.max(5, clearanceZ);
  var liftCmd = 'G91 G1 Z' + effectiveLift.toFixed(3) + ' F' + travelFeed;
  smLogProbe('[PLUGIN DEBUG] smSafeLateralMove: sending command: ' + liftCmd);
  pluginDebug('smSafeLateralMove: Z-lift cmd: ' + liftCmd);
  var _zLiftStart = _smTimingEnabled ? Date.now() : 0;
  await sendCommand(liftCmd);
  await sleep(50); // Brief delay to ensure controller starts processing
  smLogProbe('[PLUGIN DEBUG] smSafeLateralMove: waiting for idle after Z lift...');
  await waitForIdleWithTimeout();
  smLogProbe('[PLUGIN DEBUG] smSafeLateralMove: idle confirmed after Z lift');
  if (_smTimingEnabled && smTimingStats) { smTimingStats.zLift.totalMs += Date.now() - _zLiftStart; smTimingStats.zLift.count++; }
  await sendCommand('G90');
  await waitForIdleWithTimeout();
  await moveAxis('X', targetX);
  await moveAxis('Y', targetY);
  var pos = await getWorkPosition();
  smLogProbe('[PLUGIN DEBUG] smSafeLateralMove: position after travel X=' + pos.x.toFixed(3) + ' Y=' + pos.y.toFixed(3) + ' Z=' + pos.z.toFixed(3));
  pluginDebug('smSafeLateralMove EXIT: X=' + pos.x.toFixed(3) + ' Y=' + pos.y.toFixed(3) + ' Z=' + pos.z.toFixed(3));
}

async function smPlungeProbe(maxPlunge, probeFeed) {
  pluginDebug('smPlungeProbe ENTER: maxPlunge=' + maxPlunge + ' probeFeed=' + probeFeed);
  var clearanceZ = Number((document.getElementById('sm-clearanceZ') || {}).value) || 5;
  var liftFeed = Number((document.getElementById('travelRecoveryLiftFeedRate') || {}).value) ||
                 Number((document.getElementById('sm-travelFeed') || {}).value) || 600;

  // Verify probe input is open before plunging; lift and recheck if triggered (up to 3 attempts)
  await smEnsureProbeClear(clearanceZ, liftFeed);
  // Record starting Z to detect contact via position change (reliable fallback when Pn clears on idle)
  var startPos = await getWorkPosition();
  var startZ = startPos.z;
  // Issue the probe move and require contact within maxPlunge.
  // G38.3 is used instead of G38.2 so the controller does not alarm when the
  // surface is not found within maxPlunge — the JS error handling below reports
  // "No contact within max plunge" cleanly without needing an $X unlock cycle.
  var probeCmd = 'G91 G38.3 Z-' + maxPlunge.toFixed(3) + ' F' + probeFeed;
  smLogProbe('[PLUGIN DEBUG] smPlungeProbe: sending command: ' + probeCmd);
  pluginDebug('smPlungeProbe: sending: ' + probeCmd);
  var _plungeStart = _smTimingEnabled ? Date.now() : 0;
  await sendCommand(probeCmd);
  await sleep(50); // Brief delay to ensure controller starts processing
  smLogProbe('[PLUGIN DEBUG] smPlungeProbe: waiting for idle after probe move...');
  await waitForIdleWithTimeout();
  smLogProbe('[PLUGIN DEBUG] smPlungeProbe: idle confirmed after probe move');
  if (_smTimingEnabled && smTimingStats) {
    var _pMs = Date.now() - _plungeStart;
    smTimingStats.plunges.totalMs += _pMs;
    smTimingStats.plunges.count++;
    if (_pMs < smTimingStats.plunges.minMs) smTimingStats.plunges.minMs = _pMs;
    if (_pMs > smTimingStats.plunges.maxMs) smTimingStats.plunges.maxMs = _pMs;
  }
  var endPos = await getWorkPosition();
  var distanceTraveled = startZ - endPos.z;
  smLogProbe('[PLUGIN DEBUG] smPlungeProbe: startZ=' + startZ.toFixed(3) + ' endZ=' + endPos.z.toFixed(3) + ' traveled=' + distanceTraveled.toFixed(3) + ' coords');
  pluginDebug('smPlungeProbe: travel startZ=' + startZ.toFixed(3) + ' endZ=' + endPos.z.toFixed(3) + ' traveled=' + distanceTraveled.toFixed(3) + ' coords');
  // Contact detected if machine stopped short of maxPlunge (position-based, robust when
  // probe pin clears before idle query) or if Pn still shows 'P' (pin-based)
  var probeContactTolerance = 0.5; // coords; machine must stop at least this far short of maxPlunge
  var stoppedShort = distanceTraveled < (maxPlunge - probeContactTolerance);
  var triggered = await smGetProbeTriggered();
  if (!triggered && !stoppedShort) {
    smLogProbe('[PLUGIN DEBUG] smPlungeProbe ERROR: No contact within max plunge ' + maxPlunge.toFixed(3) + ' coords');
    pluginDebug('smPlungeProbe ERROR: no contact within maxPlunge=' + maxPlunge.toFixed(3));
    throw new Error('No contact within max plunge');
  }
  if (!triggered && stoppedShort) {
    smLogProbe('[PLUGIN DEBUG] smPlungeProbe NOTE: probe pin not active after idle but machine stopped at Z=' + endPos.z.toFixed(3) + ' (' + distanceTraveled.toFixed(3) + ' coords/' + maxPlunge.toFixed(3) + ' coords) — contact detected by position');
    pluginDebug('smPlungeProbe: contact by position (pin cleared), Z=' + endPos.z.toFixed(3));
  }
  pluginDebug('smPlungeProbe EXIT: contact Z=' + endPos.z.toFixed(3));
  var snap = await getMachineSnapshot();
  endPos.machineX = snap.machineX;
  endPos.machineY = snap.machineY;
  endPos.machineZ = snap.machineZ;
  smLogProbe('[PLUGIN DEBUG] smPlungeProbe: machineZ=' + snap.machineZ.toFixed(3));
  return endPos;
}

async function smRetractUp(clearanceZ, travelFeed) {
  var pos = await getWorkPosition();
  if (pos.z >= clearanceZ - 0.001){ pluginDebug('smRetractUp SKIP: Z=' + pos.z.toFixed(3) + ' already >= clearanceZ=' + clearanceZ); return; }
  var cmd = 'G90 G1 Z' + clearanceZ.toFixed(3) + ' F' + travelFeed;
  smLogProbe('[PLUGIN DEBUG] smRetractUp: sending command: ' + cmd);
  smLogProbe('[PLUGIN DEBUG] smRetractUp: position BEFORE: Z=' + pos.z.toFixed(3));
  pluginDebug('smRetractUp: ' + cmd);
  await sendCommand(cmd);
  smLogProbe('[PLUGIN DEBUG] smRetractUp: waiting for idle...');
  await waitForIdleWithTimeout();
  smLogProbe('[PLUGIN DEBUG] smRetractUp: idle confirmed');
  var newPos = await getWorkPosition();
  smLogProbe('[PLUGIN DEBUG] smRetractUp: position AFTER: Z=' + newPos.z.toFixed(3));
  pluginDebug('smRetractUp EXIT: Z=' + newPos.z.toFixed(3));
}

async function smRetractSmall(contactZ, retractMm, travelFeed) {
  var targetZ = contactZ + retractMm;
  var cmd = 'G90 G1 Z' + targetZ.toFixed(3) + ' F' + travelFeed;
  smLogProbe('[PLUGIN DEBUG] smRetractSmall: sending command: ' + cmd + ' (contact=' + contactZ.toFixed(3) + ' retract=' + retractMm + ' coords)');
  pluginDebug('smRetractSmall: contact=' + contactZ.toFixed(3) + ' retract=' + retractMm + ' coords cmd: ' + cmd);
  await sendCommand(cmd);
  smLogProbe('[PLUGIN DEBUG] smRetractSmall: waiting for idle...');
  await waitForIdleWithTimeout();
  smLogProbe('[PLUGIN DEBUG] smRetractSmall: idle confirmed; expected Z=' + targetZ.toFixed(3));
  pluginDebug('smRetractSmall EXIT: expected Z=' + targetZ.toFixed(3));
}

async function smRetractToZ(targetZ, travelFeed) {
  var pos = await getWorkPosition();
  var delta = targetZ - pos.z;
  if (delta <= 0.001){ pluginDebug('smRetractToZ SKIP: already at/above targetZ=' + targetZ.toFixed(3)); return; }
  var cmd = 'G90 G1 Z' + targetZ.toFixed(3) + ' F' + travelFeed;
  smLogProbe('[PLUGIN DEBUG] smRetractToZ: sending command: ' + cmd + ' (delta=' + delta.toFixed(3) + ' coords)');
  pluginDebug('smRetractToZ: current Z=' + pos.z.toFixed(3) + ' target=' + targetZ.toFixed(3) + ' delta=' + delta.toFixed(3));
  await sendCommand(cmd);
  smLogProbe('[PLUGIN DEBUG] smRetractToZ: waiting for idle...');
  await waitForIdleWithTimeout();
  smLogProbe('[PLUGIN DEBUG] smRetractToZ: idle confirmed; expected Z=' + targetZ.toFixed(3));
  pluginDebug('smRetractToZ EXIT: expected Z=' + targetZ.toFixed(3));
}

// Raise Z to a safe face-probe travel clearance height before moving between samples.
// label  — descriptive string logged to the face probe log.
// feed   — travel feed rate in mm/min; null/undefined uses travelFeedRate from settings.
// safeZ  — absolute work Z to raise to; null/undefined computes from topResults (highest
//          measured top-Z + topRetract clearance) or falls back to a relative lift of topClearZ
//          when no top results are available.
async function smFinishMotion(travelFeed) {
  pluginDebug('smFinishMotion ENTER: travelFeed=' + travelFeed);
  var _fmStart = _smTimingEnabled ? Date.now() : 0;
  var s = getSettingsFromUI();
  var clearanceOffset = Number(s.finishHomeZ);
  var returnXYZero = !!s.returnToXYZero;
  var feed = travelFeed || s.travelFeedRate || 600; // 600 mm/min safe fallback

  // Guard: clearance offset must be a positive number.
  if (!isFinite(clearanceOffset) || clearanceOffset <= 0) {
    smLogProbe('Finish move: WARNING — finishHomeZ clearance is ' + clearanceOffset + ' (invalid or non-positive); using safe fallback of 10.0mm clearance.');
    clearanceOffset = 10.0;
  }

  // Ensure absolute positioning mode (G90) is active.
  // The preceding probe commands use G91 (relative), and some controllers
  // may not apply G90 on the same line as the movement command; sending
  // G90 separately guarantees the mode switch is complete before moveAbs.
  await sendCommand('G90');
  await waitForIdleWithTimeout();

  var pos = await getWorkPosition();
  var currentZ = Number(pos.z);

  // Compute retract Z: highest measured surface + clearance offset.
  // Fall back to currentZ + offset if no probe data is available.
  var maxSurfaceZ = (typeof getMaxMeasuredSurfaceZ === 'function') ? getMaxMeasuredSurfaceZ() : null;
  var finishZ;
  if (maxSurfaceZ !== null) {
    finishZ = maxSurfaceZ + clearanceOffset;
    smLogProbe('Finish move: highest measured surface Z=' + maxSurfaceZ.toFixed(3) + 'mm, clearance offset=' + clearanceOffset.toFixed(1) + 'mm → retracting to work Z ' + finishZ.toFixed(3));
  } else {
    finishZ = currentZ + clearanceOffset;
    smLogProbe('Finish move: no surface data available — retracting ' + clearanceOffset.toFixed(1) + 'mm above current Z=' + currentZ.toFixed(3) + ' → work Z ' + finishZ.toFixed(3));
  }

  // Z retract — always use work coordinates (G0 Z{finishZ}), never G53 machine coords.
  // Only move if finishZ is actually higher than the current position.
  var zRetractOk = false;
  if (isFinite(currentZ) && finishZ <= currentZ) {
    smLogProbe('Finish move: current work Z ' + currentZ.toFixed(3) + ' is already at or above target work Z ' + finishZ.toFixed(3) + '; no Z retract needed');
    zRetractOk = true;
  } else {
    smLogProbe('Finish move: retracting to work Z ' + finishZ.toFixed(3));
    smLogProbe('Finish move: sending G90 G1 Z' + finishZ.toFixed(3) + ' F' + feed);
    // moveAbs already calls waitForIdleWithTimeout() and returns the position —
    // reuse that instead of issuing a redundant getWorkPosition() HTTP call.
    var retractPos = await moveAbs(null, null, finishZ, feed);
    if (!retractPos) retractPos = await getWorkPosition();
    smLogProbe('Finish move: after retract X=' + retractPos.x.toFixed(3) + ' Y=' + retractPos.y.toFixed(3) + ' Z=' + retractPos.z.toFixed(3));
    if (Number(retractPos.z) >= finishZ - 0.5) {
      zRetractOk = true;
    } else {
      smLogProbe('Finish move: ERROR — Z retract did not reach target (got Z=' + Number(retractPos.z).toFixed(3) + ', expected >= ' + (finishZ - 0.5).toFixed(3) + '); aborting XY return to prevent collision');
    }
  }

  if (returnXYZero) {
    if (!zRetractOk) {
      smLogProbe('Finish move: skipping X/Y return — Z retract did not succeed');
    } else {
      smLogProbe('Finish move: returning to work X0.000 Y0.000');
      // moveAbs already calls waitForIdleWithTimeout() and returns the position —
      // reuse that instead of issuing a redundant getWorkPosition() HTTP call.
      var returnPos = await moveAbs(0, 0, null, feed);
      if (!returnPos) returnPos = await getWorkPosition();
      smLogProbe('Finish move: after return X=' + returnPos.x.toFixed(3) + ' Y=' + returnPos.y.toFixed(3) + ' Z=' + returnPos.z.toFixed(3));
    }
  } else {
    smLogProbe('Finish move: X/Y return disabled');
  }
  if (_smTimingEnabled && smTimingStats) { smTimingStats.finishMotion.totalMs = Date.now() - _fmStart; }
}

function runSurfaceProbing() {
  pluginDebug('runSurfaceProbing ENTER');
  smStopFlag = false;
  _stopRequested   = false;
  _outlineStopFlag = false;
  meshSubdivisionSpacing = (function(){ var el = document.getElementById('meshSubdivisionSpacing'); return el ? Number(el.value) : meshSubdivisionSpacing; })();
  // Clear any previous mesh data so the combined-mode callback correctly detects
  // whether THIS probe run succeeded (stale smMeshData would make it look like
  // success even when the current probe fails on the first point).
  smMeshData = null;
  smGridConfig = null;
  var cfg = buildSurfaceGridConfig();
  if (!cfg) {
    // If grid config is invalid, call the completion callback with failure so combined
    // mode does not hang waiting for a callback that will never arrive.
    var _earlyCb = _smProbingCompleteCallback;
    _smProbingCompleteCallback = null;
    if (_earlyCb) { try { _earlyCb(false); } catch(_e) {} }
    return;
  }

  var probeFeed = Number(document.getElementById('sm-probeFeed').value);
  var travelFeed = Number(document.getElementById('sm-travelFeed').value);
  var clearanceZ = Number(document.getElementById('sm-clearanceZ').value) || 5;
  var maxPlunge = Number(document.getElementById('sm-maxPlunge').value);

  var totalPoints = cfg.colCount * cfg.rowCount;
  var probed = 0;
  var result = [];
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    result.push([]);
    for (var ci = 0; ci < cfg.colCount; ci++) {
      result[ri].push(null);
    }
  }

  // Initialise timing accumulator for this run
  _smTimingReset(totalPoints);

  document.getElementById('sm-btn-run-probe').disabled = true;
  document.getElementById('sm-btn-stop-probe').disabled = false;
  smClearLog('sm-probeLog');
  smSetProbeStatus('Running...', 'info');
  smSetProgress(0);
  var smPvizEl = document.getElementById('sm-probeViz');
  if (smPvizEl) smPvizEl.style.display = 'block';
  smPvizInit({ minX: cfg.minX, maxX: cfg.maxX, minY: cfg.minY, maxY: cfg.maxY, colCount: cfg.colCount, rowCount: cfg.rowCount, clearanceZ: clearanceZ });
  smPvizUpdate(null, { point: 0, total: totalPoints, pct: 0 });
  smLogProbe('=== 3D Live Edge Mesh Plugin ' + SM_VERSION + ' ===');
  smLogProbe('Starting probing: ' + cfg.colCount + 'x' + cfg.rowCount + ' = ' + totalPoints + ' points');
  smLogProbe('Config: clearanceZ=' + clearanceZ + ' probeFeed=' + probeFeed + ' travelFeed=' + travelFeed + ' maxPlunge=' + maxPlunge);
  pluginDebug('runSurfaceProbing: grid ' + cfg.colCount + 'x' + cfg.rowCount + '=' + totalPoints + ' pts, clearanceZ=' + clearanceZ + ' probeFeed=' + probeFeed + ' travelFeed=' + travelFeed + ' maxPlunge=' + maxPlunge);

  // Check if initial clearance lift is enabled
  var useInitialLiftEl = document.getElementById('useInitialClearanceLift');
  var useInitialLift = useInitialLiftEl ? useInitialLiftEl.value === 'yes' : false;
  var topClearZ = Number((document.getElementById('topClearZ') || {}).value) || 5;
  if (useInitialLift) {
    smLogProbe('Initial clearance lift enabled: will raise Z by ' + topClearZ.toFixed(3) + ' coords before first probe.');
  } else {
    smLogProbe('Initial clearance lift disabled: starting from current Z position.');
  }

  function probeRow(ri) {
    if (ri >= cfg.rowCount) return Promise.resolve();
    var rowY = cfg.minY + ri * cfg.rowSpacing;
    // Serpentine: even rows go left→right, odd rows go right→left
    var reversed = (ri % 2 !== 0);

    function probeStep(step) {
      if (step >= cfg.colCount) return Promise.resolve();
      var ci = reversed ? (cfg.colCount - 1 - step) : step;
      var colX = cfg.minX + ci * cfg.colSpacing;
      smLogProbe('Probing point [' + ri + ',' + ci + '] X' + smFmtN(colX) + ' Y' + smFmtN(rowY));
      smCheckStop();
      smPvizUpdate('traveling', { x: colX, y: rowY, point: probed + 1, total: totalPoints, pct: probed / totalPoints * 100 });
      var _ptStart = _smTimingEnabled ? Date.now() : 0;
      // Skip lateral move for first step of a new row — row transition already positioned the machine here
      var movePromise = (step === 0 && ri > 0)
        ? Promise.resolve()
        : smSafeLateralMove(colX, rowY, travelFeed, clearanceZ);
      return movePromise
        .then(function() { return smEnsureProbeClear(clearanceZ, travelFeed); })
        .then(function() {
          smPvizUpdate('plunging', { x: colX, y: rowY, point: probed + 1, total: totalPoints, pct: probed / totalPoints * 100 });
          return smPlungeProbe(maxPlunge, probeFeed);
        })
        .then(function(pos) {
          result[ri][ci] = pos.z;
          probed++;
          if (_smTimingEnabled && smTimingStats) { smTimingStats.perPoint.push(Date.now() - _ptStart); }
          smSetProgress(probed / totalPoints * 100);
          smPvizUpdate('contact', { x: colX, y: rowY, point: probed, total: totalPoints, contactZ: pos.z, pct: probed / totalPoints * 100 });
          smLogProbe('  -> Z=' + smFmtN(pos.z));
          smLogProbe('DEBUG POSITION: after probe X=' + pos.x.toFixed(3) + ' Y=' + pos.y.toFixed(3) + ' Z=' + pos.z.toFixed(3));
          smLogProbe('DEBUG: contact at Z=' + pos.z.toFixed(3) + '; smSafeLateralMove will lift ' + clearanceZ.toFixed(3) + ' coords relative before next travel');
        })
        .then(function() { return probeStep(step + 1); });
    }

    return probeStep(0).then(function() {
      if (ri + 1 < cfg.rowCount) {
        var nextY = cfg.minY + (ri + 1) * cfg.rowSpacing;
        // After LTR row (even) machine is at maxX; next row (odd, RTL) starts at maxX — Y-only move
        // After RTL row (odd) machine is at minX; next row (even, LTR) starts at minX — Y-only move
        var nextStartX = reversed ? cfg.minX : cfg.maxX;
        smLogProbe('ROW TRANSITION: row ' + ri + ' done (direction: ' + (reversed ? 'RTL' : 'LTR') + '); using smSafeLateralMove to lift Z by ' + clearanceZ + ' coords relative then move to X=' + smFmtN(nextStartX) + ' Y=' + smFmtN(nextY));
        smPvizUpdate('traveling', { x: nextStartX, y: nextY, point: probed + 1, total: totalPoints, pct: probed / totalPoints * 100, action: 'Row transition...' });
        return smSafeLateralMove(nextStartX, nextY, travelFeed, clearanceZ)
          .then(function() { return smEnsureProbeClear(clearanceZ, travelFeed); });
      }
    }).then(function() { return probeRow(ri + 1); });
  }

  // Start probing: perform initial clearance lift if enabled, then begin probe rows
  var startPromise = useInitialLift
    ? smPerformInitialClearanceLift('sm', topClearZ, travelFeed)
    : Promise.resolve();

  startPromise.then(function() {
    return probeRow(0);
  }).then(function() {
    smMeshDataRaw = result;
    smGridConfigRaw = cfg;
    var subdivided = subdivideSurfaceMesh(result, cfg, meshSubdivisionSpacing);
    smMeshData = subdivided.grid;
    smGridConfig = subdivided.config;
    smSetProbeStatus('Probing complete! ' + totalPoints + ' points captured.', 'ok');
    smLogProbe('Done! Probing complete.');
    pluginDebug('runSurfaceProbing COMPLETE: ' + totalPoints + ' points captured, meshData rows=' + result.length);
    smSetProgress(100);
    // Call finish motion FIRST to minimize lag before Z retract/XY return
    var skipFinish = _smSkipFinishMotion;
    _smSkipFinishMotion = false;
    var finishPromise;
    if (!skipFinish) {
      finishPromise = smFinishMotion(travelFeed);
    } else {
      smLogProbe('COMBINED: Skipping smFinishMotion (going directly to face probe phase).');
      finishPromise = Promise.resolve();
    }
    // Defer UI updates until after finish motion completes (non-blocking)
    finishPromise.then(function() {
      _smEmitTimingSummary('COMPLETE');
      smPvizUpdate('complete', { point: totalPoints, total: totalPoints, pct: 100 });
      smSaveMeshToStorage();
      try { updateSurfaceMeshUI(); } catch(vizErr) { console.warn('Surface probe: updateSurfaceMeshUI error (non-fatal):', vizErr); }
      try { populateSurfaceResults(); } catch(vizErr) { console.warn('Surface probe: populateSurfaceResults error (non-fatal):', vizErr); }
    });
    return finishPromise;
  }).catch(function(err) {
    // Guard against non-Error rejections (e.g. throw null / throw 'string') so that
    // the final .then() below always runs and the combined-mode callback is not lost.
    var msg;
    if (err && err.message) { msg = err.message; }
    else if (err == null) { msg = 'Unknown error'; }
    else { msg = String(err); }
    smSetProbeStatus('Error: ' + msg, 'err');
    smLogProbe('ERROR in probing: ' + msg);
    pluginDebug('runSurfaceProbing ERROR: ' + msg);
    _smEmitTimingSummary(msg === 'Stopped by user' ? 'STOPPED' : 'ERROR');
    smPvizUpdate('error', { action: msg === 'Stopped by user' ? 'Stopped' : 'Error' });
    console.error('Surface probe error:', err);
  }).then(function() {
    var cb = _smProbingCompleteCallback;
    _smProbingCompleteCallback = null;
    try {
      if (cb) {
        cb(!!smMeshData && !smStopFlag);
      } else {
        document.getElementById('sm-btn-run-probe').disabled = false;
        document.getElementById('sm-btn-stop-probe').disabled = true;
      }
    } catch (cbErr) {
      console.error('Surface probe completion callback error:', cbErr);
    }
  });
}

function stopSurfaceProbing() {
  smStopFlag = true;
  smLogProbe('Stop requested by user.');
  stopNowAndSafeHome('surface').catch(function(e){
    pluginDebug('stopSurfaceProbing: stopNowAndSafeHome error: ' + e.message);
  });
}

