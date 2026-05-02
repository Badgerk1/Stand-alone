async function raiseFaceTravelSafeZ(label, feed, safeZ) {
  var s = getSettingsFromUI();
  var liftFeed = (feed != null) ? Number(feed) : (Number(s.travelFeedRate) || 600);
  var targetZ = (safeZ != null) ? safeZ : null;
  if (targetZ === null) {
    // Compute from topResults: highest measured top Z + retract clearance
    var topPts = topResults.filter(function(r){ return r.status === 'TOP'; });
    var highestZ = -Infinity;
    topPts.forEach(function(tp){ var tz = Number(tp.z); if (tz > highestZ) highestZ = tz; });
    var retractClearance = Number(s.topRetract) || 2;
    if (isFinite(highestZ)) {
      targetZ = highestZ + retractClearance;
    } else {
      // No top results available — lift relative to current position
      var curPosForLift = await getWorkPosition();
      var clearZ = Number(s.topClearZ) || 5;
      targetZ = Number(curPosForLift.z) + clearZ;
    }
  }
  logLine('face', label + ': raising Z to safe travel height ' + targetZ.toFixed(3));
  pluginDebug('raiseFaceTravelSafeZ: label=' + label + ' targetZ=' + targetZ.toFixed(3) + ' feed=' + liftFeed);
  var curPos = await getWorkPosition();
  if (Number(curPos.z) < targetZ - 0.001) {
    await moveAbs(null, null, targetZ, liftFeed);
  } else {
    pluginDebug('raiseFaceTravelSafeZ SKIP: already at/above targetZ=' + targetZ.toFixed(3));
  }
}

async function probeAbsAxis(axis, target, feed, skipClearCheck){
    axis = String(axis || '').toUpperCase();
    if(axis !== 'X' && axis !== 'Y') throw new Error('Unsupported face probe axis');
    // Verify probe pin is clear before issuing G38.2; GRBL requires probe to be open to start a probe cycle.
    // Skip this check when the caller knows the probe is already clear (e.g. after a retract move).
    if(!skipClearCheck){
      var maxClearAttempts = 3;
      for (var clearAttempt = 0; clearAttempt <= maxClearAttempts; clearAttempt++) {
        var triggered = await smGetProbeTriggered();
        if (!triggered) break;
        if (clearAttempt >= maxClearAttempts) {
          throw new Error('Probe input stuck triggered after ' + maxClearAttempts + ' clearing attempts before face probe ' + axis + '; aborting');
        }
        logLine('face', 'Face probe: probe pin still triggered before G38.2 on ' + axis + ' (attempt ' + (clearAttempt + 1) + '/' + maxClearAttempts + '); backing off 2mm to clear...');
        var pos = await getWorkPosition();
        var curAxisPos = axis === 'X' ? Number(pos.x) : Number(pos.y);
        var probeDir = Number(target) >= curAxisPos ? 1 : -1;
        var backoffPos = curAxisPos - probeDir * 2;
        await sendCommand('G90 G1 ' + axis + backoffPos.toFixed(3) + ' F' + Number(s && (s.faceRetractFeed || s.travelFeedRate) || 1000).toFixed(0));
        await sleep(50); // Brief delay to ensure controller starts processing
        await waitForIdleWithTimeout();
        await smSleep(80);
      }
    }
    // Record starting axis position to detect contact via position change
    // (reliable fallback when Pn:P clears before idle status is polled — same
    // technique used by smPlungeProbe for the Z-axis top probe).
    var _startPos = await getWorkPosition();
    var _startAxisPos = axis === 'X' ? Number(_startPos.x) : Number(_startPos.y);
    await sendCommand('G90 G38.2 ' + axis + Number(target).toFixed(3) + ' F' + Number(feed).toFixed(0));
    await sleep(50); // Brief delay to ensure controller starts processing
    var probePos = await waitForIdleWithTimeout();
    if (!probePos) probePos = await getWorkPosition();
    // Position-based contact detection: if the machine stopped short of the target
    // by more than the tolerance, the probe triggered even if Pn:P has already cleared.
    var _endAxisPos = axis === 'X' ? Number(probePos.x) : Number(probePos.y);
    var _totalDistance = Math.abs(target - _startAxisPos);
    var _distanceTraveled = Math.abs(_endAxisPos - _startAxisPos);
    var _probeContactTolerance = 0.5; // coords; must stop this far short of target to count as contact
    var _stoppedShort = _totalDistance > _probeContactTolerance && _distanceTraveled < (_totalDistance - _probeContactTolerance);
    if (!probePos.probeTriggered && _stoppedShort) {
      logLine('face', 'Face probe ' + axis + ': contact detected by position (pin cleared before poll) — stopped at ' + _endAxisPos.toFixed(3) + ' (traveled ' + _distanceTraveled.toFixed(3) + ' of ' + _totalDistance.toFixed(3) + ' coords).');
      probePos = Object.assign({}, probePos, { probeTriggered: true });
    }
    return probePos;
  }

async function _clearTriggeredProbeByBackingOffGeneric(tab, currentPos, unitX, unitY, s, state){
    var backoff = Math.max(0.1, Number(s.travelContactBackoff) || 5);
    var lift = Math.max(0.1, Number(s.travelContactLift) || Number(s.topRetract) || 5);
    var maxRetries = Math.max(1, Math.round(Number(s.travelContactMaxRetries) || 5));
    if(state.recoveries >= maxRetries){
      throw new Error('Travel path blocked after ' + maxRetries + ' contact recoveries (max added lift ' + (maxRetries * lift).toFixed(3) + ' coords). Raise starting Z or reposition the work.');
    }
    state.recoveries += 1;
    state.totalLift += lift;
    var pos = currentPos;
    var backX = pos.x - unitX * backoff;
    var backY = pos.y - unitY * backoff;
    var liftZ = pos.z + lift;
    logLine(tab, 'TRAVEL CONTACT: recovery ' + state.recoveries + '/' + maxRetries + ' backoff to X=' + Number(backX).toFixed(3) + ' Y=' + Number(backY).toFixed(3) + ' at F' + Number(s.travelRecoveryFeedRate || s.travelFeedRate).toFixed(0) + ', then lift Z to ' + Number(liftZ).toFixed(3) + ' at F' + Number(s.travelRecoveryLiftFeedRate || s.travelRecoveryFeedRate || s.travelFeedRate).toFixed(0) + ' (cumulative added lift ' + Number(state.totalLift).toFixed(3) + ' coords).');
    await moveAbs(backX, backY, null, s.travelRecoveryFeedRate || s.travelFeedRate);
    await moveAbs(null, null, liftZ, s.travelRecoveryLiftFeedRate || s.travelRecoveryFeedRate || s.travelFeedRate);
    await sleep(50);
    pos = await getWorkPosition();
    if(pos.probeTriggered){
      logLine(tab, 'TRAVEL CONTACT WARNING: probe is still triggered after recovery ' + state.recoveries + '/' + maxRetries + '.');
    }
    return pos;
  }

// Build a standardised face-probe contact record for storage in faceResults.
// n              — sequential record number (1-based)
// pos            — position object returned by probeAbsAxis / moveAbs / getWorkPosition
//                  ({x, y, z, machineZ, probeTriggered})
// axis           — probe axis ('X' or 'Y')
// status         — status tag, e.g. 'FACE Y', 'FACE Y MISS', 'EARLY_CONTACT_...'
// targetCoord    — intended target coordinate on the probe axis
// sampleLineCoord — coordinate on the perpendicular (sampled) axis for this line
function makeFaceContactRecord(n, pos, axis, status, targetCoord, sampleLineCoord) {
  return {
    type: 'face',
    n: n,
    axis: axis,
    status: status,
    x: Number(pos.x),
    y: Number(pos.y),
    z: Number(pos.z),
    machineZ: (pos.machineZ != null) ? Number(pos.machineZ) : null,
    targetCoord: Number(targetCoord),
    sampleCoord: Number(sampleLineCoord)
  };
}

async function segmentedFaceMoveWithRecovery(axis, targetCoord, fixedCoord, probeZ, s, mode, sampleLineCoord, skipClearCheck){
  axis = String(axis || 'X').toUpperCase();
  mode = String(mode || 'to_start').toLowerCase();
  var stepLen = Math.max(0.2, Number(s.travelContactStep) || 5);
  if(mode !== 'to_start'){
    stepLen = Math.min(stepLen, 5);
  }
  var extras = [];
  var pos = await getWorkPosition();
  var recoveryState = {recoveries: 0, totalLift: 0};
  var maxRetries = Math.max(1, Math.round(Number(s.travelContactMaxRetries) || 5));
  var fixedX = axis === 'X' ? null : Number(fixedCoord);
  var fixedY = axis === 'X' ? Number(fixedCoord) : null;
  var label = mode === 'to_start' ? 'FACE REPOSITION' : 'FACE PROBE';

  if(mode === 'to_start'){
    if(pos.probeTriggered){
      logLine('face', 'FACE REPOSITION: probe already triggered before smooth move to start. Switching directly to recovery mode.');
    } else {
      logLine('face', 'FACE REPOSITION: smooth move toward ' + axis + ' ' + Number(targetCoord).toFixed(3) + ' before probing.');
      var smoothX = axis === 'X' ? Number(targetCoord) : fixedX;
      var smoothY = axis === 'X' ? fixedY : Number(targetCoord);
      pos = await moveAbs(smoothX, smoothY, null, s.travelFeedRate) || await getWorkPosition();
      if(!pos.probeTriggered){
        return {position: pos, extras: extras, contact: null, reachedTarget: true};
      }
      logLine('face', 'FACE REPOSITION: probe was triggered at end of smooth move. Entering segmented recovery to clear path to start.');
    }
  }

  var moveFeed = mode === 'to_start' ? Number(s.travelFeedRate) : Number(s.faceFeed || s.topFeed || s.travelFeedRate);

  if(mode !== 'to_start'){
    logLine('face', 'FACE PROBE: smooth probe move toward ' + axis + ' ' + Number(targetCoord).toFixed(3) + ' at feed ' + moveFeed.toFixed(0) + ' mm/min.');
    var probePos = await probeAbsAxis(axis, Number(targetCoord), moveFeed, skipClearCheck);
    if(probePos.probeTriggered){
      var hit = makeFaceContactRecord(faceResults.length + extras.length + 1, probePos, axis, 'FACE ' + axis, targetCoord, sampleLineCoord);
      extras.push(hit);
      logLine('face', 'FACE CONTACT: first forward contact at ' + axis + '=' + Number(axis === 'X' ? probePos.x : probePos.y).toFixed(3) + ' on sample line ' + Number(sampleLineCoord).toFixed(3) + '. Stopping this face sample.');
      return {position: probePos, extras: extras, contact: probePos, reachedTarget: false};
    }
    logLine('face', 'FACE PROBE: reached target ' + axis + ' ' + Number(targetCoord).toFixed(3) + ' without contact.');
    return {position: probePos, extras: extras, contact: null, reachedTarget: true};
  }

  logLine('face', label + ': segmented move toward ' + axis + ' ' + Number(targetCoord).toFixed(3) + ' (step ' + stepLen.toFixed(3) + ' coords, feed ' + moveFeed.toFixed(0) + ' mm/min).');

  for(var guard = 0; guard < 4000; guard++){
    checkStop();
    var axisPos = axis === 'X' ? Number(pos.x) : Number(pos.y);
    var remaining = Number(targetCoord) - axisPos;
    if(Math.abs(remaining) <= 0.02){
      return {position: pos, extras: extras, contact: null, reachedTarget: true};
    }

    var dir = remaining >= 0 ? 1 : -1;
    var moveLen = Math.min(stepLen, Math.abs(remaining));
    var nextCoord = axisPos + dir * moveLen;
    var nextX = axis === 'X' ? nextCoord : fixedX;
    var nextY = axis === 'X' ? fixedY : nextCoord;

    pos = await moveAbs(nextX, nextY, null, (typeof moveFeed !== 'undefined' ? moveFeed : Number(s.travelFeedRate || 600))) || await getWorkPosition();

    if(pos.probeTriggered){
      var status = mode === 'to_start' ? 'EARLY_CONTACT_FACE_REPOSITION_' + axis : 'FACE ' + axis;
      var extra = makeFaceContactRecord(faceResults.length + extras.length + 1, pos, axis, status, targetCoord, sampleLineCoord);
      extras.push(extra);

      if(mode !== 'to_start'){
        logLine('face', 'FACE CONTACT: first forward contact at ' + axis + '=' + Number(axis === 'X' ? pos.x : pos.y).toFixed(3) + ' on sample line ' + Number(sampleLineCoord).toFixed(3) + '. Stopping this face sample.');
        return {position: pos, extras: extras, contact: pos, reachedTarget: false};
      }

      logLine('face', 'FACE REPOSITION CONTACT: recorded extra point at ' + axis + '=' + Number(axis === 'X' ? pos.x : pos.y).toFixed(3) + ' Z=' + Number(pos.z).toFixed(3) + '. Backing off and lifting before continuing to start.');
      var unitX = axis === 'X' ? dir : 0;
      var unitY = axis === 'Y' ? dir : 0;
      pos = await _clearTriggeredProbeByBackingOffGeneric('face', pos, unitX, unitY, s, recoveryState);
      await smSleep(80);
      if(pos.probeTriggered && recoveryState.recoveries >= maxRetries){
        throw new Error('Face reposition path blocked after ' + maxRetries + ' contact recoveries (max added lift ' + Number(recoveryState.totalLift).toFixed(3) + ' coords). Raise starting Z or reposition the work.');
      }
      if(Number(pos.z) > Number(probeZ) + 0.001){
        logLine('face', 'FACE REPOSITION RECOVERY: lowering back to face probe Z ' + Number(probeZ).toFixed(3) + ' at F' + Number(s.travelRecoveryLiftFeedRate || s.travelRecoveryFeedRate || s.travelFeedRate).toFixed(0));
        await moveAbs(null, null, Number(probeZ), s.travelRecoveryLiftFeedRate || s.travelRecoveryFeedRate || s.travelFeedRate);
        pos = await getWorkPosition();
        if(pos.probeTriggered){
          var downExtra = makeFaceContactRecord(faceResults.length + extras.length + 1, pos, axis, 'EARLY_CONTACT_FACE_Z_RESET_' + axis, targetCoord, sampleLineCoord);
          extras.push(downExtra);
          logLine('face', 'FACE REPOSITION CONTACT: probe re-triggered while returning to face probe Z. Backing off and lifting again.');
          pos = await _clearTriggeredProbeByBackingOffGeneric('face', pos, unitX, unitY, s, recoveryState);
          await smSleep(80);
        }
      }
    }
  }
  throw new Error('Segmented face move exceeded safety iteration limit while moving on axis ' + axis + '.');
}


// ── runFaceProbe ──────────────────────────────────────────────────────────────
async function runFaceProbe(axis, _calledFromCombined){
  pluginDebug('runFaceProbe ENTER: axis=' + axis);
  if(_running){ logLine('face','Face probe skipped: another operation is still running.'); pluginDebug('runFaceProbe SKIP: _running=true'); setFooterStatus('Already running', 'warn'); return; }
  if(!validateSettings()){ logLine('face','Face probe skipped: settings validation failed — check Setup tab for warnings.'); pluginDebug('runFaceProbe SKIP: settings validation failed'); return; }
  _running = true; _stopRequested = false; smStopFlag = false; _outlineStopFlag = false;
  axis = String(axis || 'X').toUpperCase();
  document.getElementById('btn-stop-face').disabled = false;
  document.getElementById('btn-face-x').disabled = true;
  document.getElementById('btn-face-y').disabled = true;
  setFooterStatus('Running face probe ' + axis + '…', 'warn');
  smSetProgress(0);
  logLine('face', '=== 3D Live Edge Mesh Plugin ' + SM_VERSION + ' ===');
  logLine('face', 'Starting face probe on axis ' + axis);

  try{
    await requireStartupHomingPreflight('face probe ' + axis);
    s = getSettingsFromUI();
    meshSubdivisionSpacing = s.meshSubdivisionSpacing != null ? Number(s.meshSubdivisionSpacing) : meshSubdivisionSpacing;
    var startCoord = Number(s.faceStartOffset);
    var depthBelow = Number(s.faceDepthBelowSurface);
    var probeDist = Number(s.faceProbeDistance);
    var targetCoord = startCoord + probeDist;
    var sampledAxis = String(s.sampleAxis || 'X').toUpperCase();
    var fixedCoord = Number(s.faceFixedCoord);
    logLine('face', 'Probe axis ' + axis + ': start=' + startCoord.toFixed(3) + ' target=' + targetCoord.toFixed(3));
    pluginDebug('runFaceProbe: axis=' + axis + ' start=' + startCoord + ' target=' + targetCoord + ' depthBelow=' + depthBelow + ' fixedCoord=' + fixedCoord);

    // ── Phase 0: Auto Top-Z ───────────────────────────────────────────────────
    // When running Face Probe directly (not from combined mode), automatically
    // probe the surface Z at the face probe's configured X positions so that
    // topResults contains real measured data at the exact coordinates the face
    // probe will use, rather than relying on stale or interpolated values.
    var _p0Ran = false;
    if (!_calledFromCombined) {
      var _p0xStart = Number((document.getElementById('fp-xStart') || {}).value);
      var _p0xEnd   = Number((document.getElementById('fp-xEnd')   || {}).value);
      var _p0xPts   = fpGetEffectiveXPoints();
      // In endpoints mode, Phase 0 probes only xStart and xEnd
      if (s.fpTopRefMode === 'endpoints') { _p0xPts = 2; }
      if (isFinite(_p0xStart) && isFinite(_p0xEnd) && _p0xStart !== _p0xEnd) {
        var _p0ClearZ  = Number(s.topClearZ)      || 5;
        var _p0Feed    = Number(s.topFeed)         || 200;
        var _p0Travel  = Number(s.travelFeedRate)  || 600;
        var _p0Depth   = Number(s.topProbeDepth)   || 5;
        var _p0Retract = Number(s.topRetract)      || 2;
        var _p0FaceY   = Number(s.topFixedCoord);
        var _p0Range   = _p0xEnd - _p0xStart;
        var _p0Step    = _p0Range / (_p0xPts - 1);
        logLine('face', 'AUTO TOP-Z: Phase 0 — probing surface Z at face X positions before face probe...');
        logLine('face', 'AUTO TOP-Z: ' + _p0xPts + ' points from X=' + _p0xStart.toFixed(3) + ' to X=' + _p0xEnd.toFixed(3) + ' at Y=' + _p0FaceY.toFixed(3));
        topResults = [];
        
        // Perform initial clearance lift if enabled (before Phase 0 starts)
        var _p0UseInitialLift = s.useInitialClearanceLift;
        if (_p0UseInitialLift) {
          logLine('face', 'INITIAL LIFT: Performing initial clearance lift of ' + _p0ClearZ.toFixed(3) + ' coords before Phase 0...');
          await smPerformInitialClearanceLift('face', _p0ClearZ, _p0Travel);
        } else {
          logLine('face', 'Initial clearance lift disabled: starting from current Z position.');
        }
        
        for (var _p0i = 0; _p0i < _p0xPts; _p0i++) {
          smCheckStop();
          var _p0xPos = _p0xStart + _p0i * _p0Step;
          logLine('face', 'AUTO TOP-Z: Probing point ' + (_p0i + 1) + '/' + _p0xPts + ' at X=' + Number(_p0xPos).toFixed(3) + ' Y=' + Number(_p0FaceY).toFixed(3));
          smSetProgress((_p0i + 1) / _p0xPts * 30);
          await smSafeLateralMove(_p0xPos, _p0FaceY, _p0Travel, _p0ClearZ);
          await smEnsureProbeClear(_p0ClearZ, _p0Travel);
          var _p0Contact = await smPlungeProbe(_p0Depth, _p0Feed);
          if (!_p0Contact || !isFinite(_p0Contact.z)) {
            throw new Error('AUTO TOP-Z probe returned invalid contact at X=' + Number(_p0xPos).toFixed(3));
          }
          topResults.push({
            type: 'top',
            index: _p0i + 1,
            sampleCoord: _p0xPos,
            targetSamplePos: _p0xPos,
            x: Number(_p0Contact.x),
            y: Number(_p0Contact.y),
            z: Number(_p0Contact.z),
            machineZ: _p0Contact.machineZ != null ? Number(_p0Contact.machineZ) : null,
            status: 'TOP'
          });
          logLine('face', 'AUTO TOP-Z:   -> Z=' + Number(_p0Contact.z).toFixed(3));
          await smRetractSmall(_p0Contact.z, _p0Retract, _p0Travel);
        }
        smSetProgress(30);
        _p0Ran = true;
        logLine('face', 'AUTO TOP-Z: Phase 0 complete — ' + topResults.length + ' top-Z reference points measured at Y=' + Number(_p0FaceY).toFixed(3));
        pluginDebug('runFaceProbe Phase 0 complete: ' + topResults.length + ' top-Z points at faceY=' + _p0FaceY);
      } else {
        logLine('face', 'AUTO TOP-Z: Phase 0 skipped — fp-xStart/fp-xEnd not configured (will use existing topResults if available).');
      }
    }

    var topPts = topResults.filter(function(r){ return r.status === 'TOP'; }).sort(function(a, b){
      return Number(a.sampleCoord) - Number(b.sampleCoord);
    });

    var faceSamples = [];
    if(topPts.length && sampledAxis !== axis){
      if ((_p0Ran || _calledFromCombined) && s.fpTopRefMode === 'endpoints') {
        // Phase 0 (standalone) or Phase 1.5 (combined) ran in endpoints mode: only
        // 2 top-Z reference points were measured (xStart and xEnd).  Build the full
        // face sample grid from the X-sampling config (auto-spacing or manual xPoints)
        // so that face probing uses all configured columns — NOT just the 2 endpoint
        // columns from topResults.  topZ for each column is linearly interpolated from
        // the two measured endpoints so that minTopZ correctly reflects the measured
        // surface height.
        var _epSamples = fpBuildFaceSamplesFromConfig();
        if (_epSamples && _epSamples.length >= 2) {
          var _ep0 = topPts[0];
          var _ep1 = topPts[topPts.length - 1];
          var _epSpan = Number(_ep1.sampleCoord) - Number(_ep0.sampleCoord);
          faceSamples = _epSamples.map(function(cs) {
            var t = _epSpan !== 0 ? (cs.sampleCoord - Number(_ep0.sampleCoord)) / _epSpan : 0;
            t = Math.max(0, Math.min(1, t));
            var interpTopZ = Number(_ep0.z) * (1 - t) + Number(_ep1.z) * t;
            return { index: cs.index, sampleCoord: cs.sampleCoord, topZ: interpTopZ };
          });
          logLine('face', 'Face probe (endpoints top-ref' + (_calledFromCombined ? ', combined' : '') + '): building ' + faceSamples.length + ' X columns from config; topZ linearly interpolated from ' + topPts.length + ' measured endpoint(s).');
          logLine('face', 'Face probe: faceSamples length=' + faceSamples.length + ' first sampleCoord=' + faceSamples[0].sampleCoord.toFixed(3) + ' last sampleCoord=' + faceSamples[faceSamples.length - 1].sampleCoord.toFixed(3));
        } else {
          // Config build failed — fall back to the 2 measured endpoint values.
          faceSamples = topPts.map(function(tp, idx){
            return { index: idx + 1, sampleCoord: Number(tp.sampleCoord), topZ: Number(tp.z) };
          });
          logLine('face', 'Face probe (endpoints top-ref): config sample build failed; falling back to ' + faceSamples.length + ' measured endpoint(s).');
        }
      } else {
        // When Phase 0 (standalone, all mode) or Phase 1.5 (combined) has already
        // measured real top-Z values at the exact face X positions, use those directly.
        // Only fall back to fpBuildFaceSamplesFromConfig() (mesh interpolation) when
        // no auto top-Z pass was made AND we are not in combined mode (combined mode
        // always provides real Phase 1.5 measured values via topResults).
        var configSamples = (!_p0Ran && !_calledFromCombined && smMeshData && smGridConfig) ? fpBuildFaceSamplesFromConfig() : null;
        if(configSamples && configSamples.length >= 2){
          faceSamples = configSamples;
          logLine('face', 'Face probe: user requested ' + faceSamples.length + ' X samples (fp-xPoints).');
          logLine('face', 'Face probe: X positions = [' + faceSamples.map(function(s){ return s.sampleCoord.toFixed(1); }).join(', ') + ']');
          logLine('face', 'Face probe: interpolated topZ = [' + faceSamples.map(function(s){ return s.topZ.toFixed(3); }).join(', ') + ']');
        } else {
          // Use topPts directly — real measured values from Phase 0 (standalone) or
          // Phase 1.5 (combined mode), or the best available data when neither ran.
          faceSamples = topPts.map(function(tp, idx){
            return { index: idx + 1, sampleCoord: Number(tp.sampleCoord), topZ: Number(tp.z) };
          });
          if(_p0Ran){
            logLine('face', 'Face probe: using ' + faceSamples.length + ' measured top-Z reference points from Phase 0 auto top-Z pass.');
          } else if(_calledFromCombined){
            logLine('face', 'Face probe: using ' + faceSamples.length + ' measured top-Z reference points from Phase 1.5 (combined mode).');
          } else {
            logLine('face', 'Using ' + faceSamples.length + ' indexed face sample(s) from top profile along ' + sampledAxis + ' (no mesh data for interpolation).');
          }
        }
      }
    } else {
      var curPos = await getWorkPosition();
      var fallbackTopZ = topPts.length ? Number(topPts[0].z) : (_faceSurfRefZ !== null ? _faceSurfRefZ : Number(curPos.z));
      if(topPts.length && sampledAxis === axis){
        logLine('face', 'Sample axis matches face probe axis (' + axis + '), so indexed face stepping is unavailable. Falling back to single face line at fixed coordinate ' + fixedCoord.toFixed(3) + '.');
      } else {
        logLine('face', 'No usable top profile samples for indexed face stepping. Falling back to single face line at fixed coordinate ' + fixedCoord.toFixed(3) + '.');
      }
      if(_faceSurfRefZ !== null && !topPts.length){
        logLine('face', 'Using surface reference Z = ' + _faceSurfRefZ.toFixed(3) + ' coords (captured by Surface Reference Probe).');
      }
      faceSamples = [{ index: 1, sampleCoord: fixedCoord, topZ: fallbackTopZ }];
    }

    // Use the lowest (minimum) topZ across all samples as the single reference
    // depth for every face probe move.  Every sample therefore probes at the
    // exact same absolute Z coordinate, which completely eliminates horizontal
    // banding.  For samples whose surface is higher than the minimum the probe
    // is simply inserted a little deeper below their surface — this is always
    // safe and still contacts the face wall correctly.  The user-configurable
    // depth-below / maxDepth offset is applied on top of this minimum.
    var minTopZ = Infinity;
    for(var _mti = 0; _mti < faceSamples.length; _mti++){
      var _mtz = Number(faceSamples[_mti].topZ);
      if(_mtz < minTopZ) minTopZ = _mtz;
    }
    if(!isFinite(minTopZ)) minTopZ = 0;
    logLine('face', 'Face probe: minimum topZ reference = ' + minTopZ.toFixed(3) + ' coords (from ' + faceSamples.length + ' samples, range ' + minTopZ.toFixed(3) + ' to ' + Math.max.apply(null, faceSamples.map(function(s){ return Number(s.topZ); })).toFixed(3) + ')');

    // ── Layered face probe mode ───────────────────────────────────────────────
    if(s.enableLayeredFace){
      var maxDepth = Number(s.faceMaxDepth) || 14.75;
      var layerCount = Math.max(2, Math.round(Number(s.faceLayerCount) || 3));
      var totalLayers = layerCount;

      logLine('face', 'Layered face probe: ' + totalLayers + ' layers, max depth ' + maxDepth.toFixed(3) + ' coords');
      layeredFaceResults = [];

      // Pre-calculate inter-sample retract Z for each layer.
      // For each non-last layer: find the shallowest (closest to zero / highest) next-layer Z
      // across all X samples, then add 2 coords clearance buffer.
      // For the last layer: null (signals "use full safe Z").
      // Uses effectiveTopZ = sampleTopZ - 0.05 so the shallowest layer probes 0.05 coords below surface.
      var layerRetractZ = [];
      for(var layerIdx = 0; layerIdx < totalLayers; layerIdx++){
        if(layerIdx === totalLayers - 1){
          layerRetractZ.push(null);
        } else {
          // Use minTopZ so retract heights are consistent and always above the workpiece
          var nextDeepestZ = minTopZ - maxDepth;
          var nextSpacing = (minTopZ - 0.05 - nextDeepestZ) / (totalLayers - 1);
          var nextLayerZ = parseFloat((nextDeepestZ + ((layerIdx + 1) * nextSpacing)).toFixed(6));
          layerRetractZ.push(nextLayerZ + 2);
        }
      }

      // Pre-compute safe travel Z for the entire run — avoids re-scanning topResults on every retract call.
      var preScanRetractClearance = Number(s.topRetract) || 2;
      var preScanTopPts = topResults.filter(function(r){ return r.status === 'TOP'; });
      var preScanHighestZ = -Infinity;
      preScanTopPts.forEach(function(tp){ var tz = Number(tp.z); if(tz > preScanHighestZ) preScanHighestZ = tz; });
      var localSafeZ = isFinite(preScanHighestZ) ? (preScanHighestZ + preScanRetractClearance) : null;

      var didOptimizedRetract = false;
      var _fpBase = _p0Ran ? 30 : 0;
      var _fpRange = 100 - _fpBase;
      var _fpTotal = totalLayers * faceSamples.length;
      var _fpDone = 0;
      for(var li = 0; li < totalLayers; li++){
        checkStop();
        var layerNum = li + 1;
        var isBottomLayer = (li === 0);
        // Serpentine X ordering: even layers go left→right, odd layers go right→left.
        var forward = (li % 2 === 0);
        var sampleOrder = [];
        for(var oi = 0; oi < faceSamples.length; oi++) sampleOrder.push(oi);
        if(!forward) sampleOrder.reverse();
        if(isBottomLayer){
          logLine('face', 'Layer ' + layerNum + '/' + totalLayers + ': probing face at per-sample depth (stylusLen=' + maxDepth.toFixed(3) + ' coords below topZ) across ' + faceSamples.length + ' X samples');
        } else {
          logLine('face', 'Layer ' + layerNum + '/' + totalLayers + ': probing face across ' + faceSamples.length + ' X samples (per-sample Z, ' + (forward ? 'left\u2192right' : 'right\u2192left') + ' serpentine)');
        }
        var layerContacts = 0;

        for(var si = 0; si < sampleOrder.length; si++){
          checkStop();
          var i = sampleOrder[si];
          var sample = faceSamples[i];
          var lineCoord = Number(sample.sampleCoord);
          var sampleNum = si + 1;

          // Per-sample layer Z calculation uses minTopZ so every sample probes at
          // the same absolute Z — completely eliminates banding.  For higher-surface
          // samples the probe is simply inserted a bit deeper below their surface,
          // which is always safe and still contacts the face wall correctly.
          var sampleTopZ = minTopZ;
          var deepestZ = sampleTopZ - maxDepth;
          var layerZ;
          if(totalLayers === 1){
            layerZ = deepestZ;
          } else {
            var effectiveTopZ = sampleTopZ - 0.05;
            var layerSpacing = (effectiveTopZ - deepestZ) / (totalLayers - 1);
            layerZ = parseFloat((deepestZ + (li * layerSpacing)).toFixed(6));
          }

          logLine('face', 'Layer ' + layerNum + ' sample ' + sampleNum + '/' + faceSamples.length + ': ' + sampledAxis + '=' + lineCoord.toFixed(3) + ' probing at Z=' + layerZ.toFixed(3) + ' from ' + axis + '=' + startCoord.toFixed(3) + ' toward ' + axis + '=' + targetCoord.toFixed(3));

          if(!didOptimizedRetract){
            await raiseFaceTravelSafeZ('Layer ' + layerNum + ' sample ' + sampleNum + ': safe retract', null, localSafeZ);

            if(axis === 'X'){
              await moveAbs(null, lineCoord, null, s.faceRetractFeed || s.travelFeedRate);
            } else {
              await moveAbs(lineCoord, null, null, s.faceRetractFeed || s.travelFeedRate);
            }

            if(axis === 'X'){
              await moveAbs(startCoord, null, null, s.faceRetractFeed || s.travelFeedRate);
            } else {
              await moveAbs(null, startCoord, null, s.faceRetractFeed || s.travelFeedRate);
            }
          }
          didOptimizedRetract = false;

          await moveAbs(null, null, layerZ, s.travelRecoveryLiftFeedRate || s.travelFeedRate);

          var _layerFeedLog = Number(s.faceFeed || s.topFeed || s.travelFeedRate || 0);
          logLine('face', 'Layer ' + layerNum + ' sample ' + sampleNum + ': probing toward ' + axis + ' ' + targetCoord.toFixed(3) + ' at feed ' + _layerFeedLog.toFixed(0) + ' mm/min.');
          var faceAdv = await segmentedFaceMoveWithRecovery(axis, targetCoord, lineCoord, layerZ, s, 'probe', lineCoord, true);
          faceAdv.extras.forEach(function(ep){
            ep.sampleCoord = lineCoord;
            faceResults.push(ep);
          });
          if(faceAdv.extras.length) saveProbeResultsThrottled();

          var contact = faceAdv.contact || faceAdv.position;
          var contactFaceCoord = axis === 'X' ? Number(contact.x) : Number(contact.y);
          if(faceAdv.contact){
            logLine('face', 'FACE CONTACT: ' + axis + '=' + contactFaceCoord.toFixed(3) + ' at ' + sampledAxis + '=' + lineCoord.toFixed(3) + ' Z=' + layerZ.toFixed(3) + ' (layer ' + layerNum + ')');
            layerContacts++;
            var lRec = makeFaceContactRecord(faceResults.length + 1, contact, axis, 'FACE ' + axis, targetCoord, lineCoord);
            faceResults.push(lRec);
            layeredFaceResults.push({
              x: axis === 'Y' ? lineCoord : contactFaceCoord,
              y: axis === 'X' ? lineCoord : contactFaceCoord,
              z: layerZ,
              machineZ: contact.machineZ != null ? Number(contact.machineZ) : null,
              layer: layerNum,
              sampleTopZ: sampleTopZ,
              sampleCoord: lineCoord,
              contactCoord: contactFaceCoord
            });
          } else {
            logLine('face', 'Layer ' + layerNum + ' sample ' + sampleNum + ': reached target ' + axis + '=' + targetCoord.toFixed(3) + ' without contact.');
            var lMiss = makeFaceContactRecord(faceResults.length + 1, contact, axis, 'FACE ' + axis + ' MISS', targetCoord, lineCoord);
            faceResults.push(lMiss);
          }
          saveProbeResultsThrottled();
          _fpDone++;
          smSetProgress(_fpBase + _fpDone / _fpTotal * _fpRange);

          var isLastSampleInLayer = (si === sampleOrder.length - 1);
          var isLastLayer = (li === totalLayers - 1);
          if(!isLastSampleInLayer){
            var nextSampleCoord = Number(faceSamples[sampleOrder[si + 1]].sampleCoord);
            logLine('face', 'Inter-sample return (layer ' + layerNum + '): G1 retract ' + axis + '=' + startCoord.toFixed(3) + ' at F' + Number(s.faceRetractFeed || s.travelFeedRate).toFixed(0) + ', then G1 travel to ' + sampledAxis + '=' + nextSampleCoord.toFixed(3) + ' at F' + Number(s.faceRetractFeed || s.travelFeedRate).toFixed(0) + '.');
            // Step 1: G1 retract on face axis back to startCoord (fully clears workpiece)
            if(axis === 'X'){
              await moveAbs(startCoord, null, null, s.faceRetractFeed || s.travelFeedRate);
            } else {
              await moveAbs(null, startCoord, null, s.faceRetractFeed || s.travelFeedRate);
            }
            // Step 2: G1 travel on sample axis to next sample position; use returned position to avoid extra HTTP call
            var _isrPos;
            if(axis === 'X'){
              _isrPos = await moveAbs(null, nextSampleCoord, null, s.faceRetractFeed || s.travelFeedRate) || await getWorkPosition();
            } else {
              _isrPos = await moveAbs(nextSampleCoord, null, null, s.faceRetractFeed || s.travelFeedRate) || await getWorkPosition();
            }
            // Safety net: check if probe was inadvertently triggered during G1 moves
            if(_isrPos.probeTriggered){
              logLine('face', 'INTER-SAMPLE TRAVEL CONTACT: probe triggered during inter-sample retract at X=' + Number(_isrPos.x).toFixed(3) + ' Y=' + Number(_isrPos.y).toFixed(3) + ' Z=' + Number(_isrPos.z).toFixed(3));
              var _isrRec = makeFaceContactRecord(faceResults.length + 1, _isrPos, axis, 'EARLY_CONTACT_INTER_SAMPLE_RETRACT_' + axis, targetCoord, lineCoord);
              faceResults.push(_isrRec);
              layeredFaceResults.push({
                x: Number(_isrPos.x),
                y: Number(_isrPos.y),
                z: layerZ,
                machineZ: _isrPos.machineZ != null ? Number(_isrPos.machineZ) : null,
                layer: layerNum,
                sampleTopZ: sampleTopZ,
                sampleCoord: lineCoord,
                contactCoord: axis === 'Y' ? Number(_isrPos.y) : Number(_isrPos.x)
              });
              saveProbeResultsThrottled();
              var _isrRecovery = {recoveries: 0, totalLift: 0};
              var _isrUnitX = axis === 'X' ? Math.sign(startCoord - targetCoord) : 0;
              var _isrUnitY = axis === 'X' ? 0 : Math.sign(startCoord - targetCoord);
              await _clearTriggeredProbeByBackingOffGeneric('face', _isrPos, _isrUnitX, _isrUnitY, s, _isrRecovery);
              didOptimizedRetract = false;
            } else {
              didOptimizedRetract = true;
            }
          } else if(!isLastLayer){
            var layerTransitionZ = layerRetractZ[li];
            logLine('face', 'Layer ' + layerNum + ' \u2192 ' + (layerNum + 1) + ': G1 retract ' + axis + '=' + startCoord.toFixed(3) + ' at F' + Number(s.faceRetractFeed || s.travelFeedRate).toFixed(0) + ', then G1 raise Z=' + layerTransitionZ.toFixed(3) + ' at F' + Number(s.faceRetractFeed || s.travelFeedRate).toFixed(0) + ' (serpentine \u2014 next layer starts at ' + sampledAxis + '=' + lineCoord.toFixed(3) + ').');
            // Step 1: G1 retract on face axis back to startCoord (fully clears workpiece)
            if(axis === 'X'){
              await moveAbs(startCoord, null, null, s.faceRetractFeed || s.travelFeedRate);
            } else {
              await moveAbs(null, startCoord, null, s.faceRetractFeed || s.travelFeedRate);
            }
            // Step 2: G1 raise Z to next-layer clearance height; use returned position to avoid extra HTTP call
            var _ltrPos = await moveAbs(null, null, layerTransitionZ, s.faceRetractFeed || s.travelFeedRate) || await getWorkPosition();
            // Safety net: check if probe was inadvertently triggered during G1 moves
            if(_ltrPos.probeTriggered){
              logLine('face', 'INTER-SAMPLE TRAVEL CONTACT: probe triggered during layer-transition retract at X=' + Number(_ltrPos.x).toFixed(3) + ' Y=' + Number(_ltrPos.y).toFixed(3) + ' Z=' + Number(_ltrPos.z).toFixed(3));
              var _ltrRec = makeFaceContactRecord(faceResults.length + 1, _ltrPos, axis, 'EARLY_CONTACT_INTER_SAMPLE_RETRACT_' + axis, targetCoord, lineCoord);
              faceResults.push(_ltrRec);
              layeredFaceResults.push({
                x: Number(_ltrPos.x),
                y: Number(_ltrPos.y),
                z: Number(_ltrPos.z),
                machineZ: _ltrPos.machineZ != null ? Number(_ltrPos.machineZ) : null,
                layer: layerNum,
                sampleTopZ: sampleTopZ,
                sampleCoord: lineCoord,
                contactCoord: axis === 'Y' ? Number(_ltrPos.y) : Number(_ltrPos.x)
              });
              saveProbeResultsThrottled();
              var _ltrRecovery = {recoveries: 0, totalLift: 0};
              var _ltrUnitX = axis === 'X' ? Math.sign(startCoord - targetCoord) : 0;
              var _ltrUnitY = axis === 'X' ? 0 : Math.sign(startCoord - targetCoord);
              await _clearTriggeredProbeByBackingOffGeneric('face', _ltrPos, _ltrUnitX, _ltrUnitY, s, _ltrRecovery);
              didOptimizedRetract = false;
            } else {
              didOptimizedRetract = true;
            }
          }
        }
        logLine('face', 'Layer ' + layerNum + '/' + totalLayers + ' complete — ' + layeredFaceResults.length + ' total contacts recorded.');
        setTimeout(updateAllResultsUI, 0);
      }

      saveProbeResults();
      logLine('face', 'Layered face probe complete: ' + totalLayers + ' layers x ' + faceSamples.length + ' samples = ' + layeredFaceResults.length + ' total contacts');
      pluginDebug('runFaceProbe layered: faceResults=' + faceResults.length + ' layeredFaceResults=' + layeredFaceResults.length);
      // No extra waitForIdle here: the last moveAbs in the layer loop already
      // calls waitForIdleWithTimeout(), so the controller is already idle.
      smSetProgress(100);
      await finishRunMotion('face');
      if (!_calledFromCombined) switchTab('results');
      setFooterStatus('Layered face probe ' + axis + ' complete: ' + totalLayers + ' layers x ' + faceSamples.length + ' samples = ' + layeredFaceResults.length + ' contacts', 'good');
      layeredFaceResultsRaw = layeredFaceResults.slice();
      layeredFaceResults = subdivideFaceMesh(layeredFaceResults, meshSubdivisionSpacing);
      updateFaceMeshDataUI();
      // Re-render surface mesh visualizers to include face wall (even when no surface mesh is present)
      smPvizRenderMesh();
      renderSurfVizMesh();
      renderResVizMesh();
      populateUnifiedProbeTable();
      updateEdgeProbeStorageUI();
      return;
    }

    // ── Single-pass face probe mode ───────────────────────────────────────────
    var spDidOptimizedRetract = false;
    for(var i = 0; i < faceSamples.length; i++){
      checkStop();
      var sample = faceSamples[i];
      var lineCoord = Number(sample.sampleCoord);
      // Use minTopZ so every sample probes at the exact same absolute Z coordinate,
      // which completely eliminates banding.  For samples with a higher surface the
      // probe is inserted a little deeper below their topZ — always safe and still
      // contacts the face wall correctly.
      var _spEffectiveTopZ = minTopZ;
      var zForProbe = _spEffectiveTopZ - depthBelow;
      logLine('face', 'Face sample ' + sample.index + '/' + faceSamples.length + ': line ' + sampledAxis + '=' + lineCoord.toFixed(3) + ' using minTopZ=' + minTopZ.toFixed(3) + ' (sample=' + Number(sample.topZ).toFixed(3) + ') depth below=' + depthBelow.toFixed(3) + ' probe Z=' + zForProbe.toFixed(3));

      if(!spDidOptimizedRetract){
        await raiseFaceTravelSafeZ('Face sample ' + sample.index + ': safe retract before indexed move');

        if(axis === 'X'){
          logLine('face', 'Face sample ' + sample.index + ': moving to sample line Y=' + lineCoord.toFixed(3) + ' at safe travel Z.');
          await moveAbs(null, lineCoord, null, s.faceRetractFeed || s.travelFeedRate);
        } else {
          logLine('face', 'Face sample ' + sample.index + ': moving to sample line X=' + lineCoord.toFixed(3) + ' at safe travel Z.');
          await moveAbs(lineCoord, null, null, s.faceRetractFeed || s.travelFeedRate);
        }

        logLine('face', 'At face sample line. Moving to face start ' + axis + '=' + startCoord.toFixed(3) + ' at safe travel Z before lowering.');
        if(axis === 'X'){
          await moveAbs(startCoord, null, null, s.faceRetractFeed || s.travelFeedRate);
        } else {
          await moveAbs(null, startCoord, null, s.faceRetractFeed || s.travelFeedRate);
        }
      }
      // Consume the flag — set to true at end of previous iteration after a diagonal retract.
      // The check above already used it; reset so the default (full positioning) applies next time.
      spDidOptimizedRetract = false;

      logLine('face', 'At face start. Lowering to face probe Z ' + zForProbe.toFixed(3));
      await moveAbs(null, null, zForProbe, s.travelRecoveryLiftFeedRate || s.travelFeedRate);

      var _faceFeedLog = Number(s.faceFeed || s.topFeed || s.travelFeedRate || 0); logLine('face', 'At face start. Probing toward ' + axis + ' ' + targetCoord.toFixed(3) + ' at feed ' + _faceFeedLog.toFixed(0) + ' mm/min.');
      var faceAdvance = await segmentedFaceMoveWithRecovery(axis, targetCoord, lineCoord, zForProbe, s, 'probe', lineCoord, true);
      faceAdvance.extras.forEach(function(ep){
        ep.sampleCoord = lineCoord;
        faceResults.push(ep);
      });
      if(faceAdvance.extras.length) saveProbeResultsThrottled();

      var contact = faceAdvance.contact || faceAdvance.position;
      var contactCoord = axis === 'X' ? Number(contact.x) : Number(contact.y);
      if(faceAdvance.contact){
        logLine('face', 'Face ' + axis + ' final contact at ' + axis + '=' + contactCoord.toFixed(3) + ' on sample ' + sampledAxis + '=' + lineCoord.toFixed(3) + ' Z=' + Number(contact.z).toFixed(3));
        var rec = makeFaceContactRecord(faceResults.length + 1, contact, axis, 'FACE ' + axis, targetCoord, lineCoord);
        faceResults.push(rec);
      } else {
        logLine('face', 'Face ' + axis + ' reached target ' + axis + '=' + targetCoord.toFixed(3) + ' on sample ' + sampledAxis + '=' + lineCoord.toFixed(3) + ' without contact.');
        var miss = makeFaceContactRecord(faceResults.length + 1, contact, axis, 'FACE ' + axis + ' MISS', targetCoord, lineCoord);
        faceResults.push(miss);
      }
      saveProbeResultsThrottled();
      smSetProgress((_p0Ran ? 30 : 0) + (i + 1) / faceSamples.length * (_p0Ran ? 70 : 100));

      if(i < faceSamples.length - 1){
        var nextLineCoord = Number(faceSamples[i + 1].sampleCoord);
        logLine('face', 'Inter-sample return: G1 retract ' + axis + '=' + startCoord.toFixed(3) + ' at F' + Number(s.faceRetractFeed || s.travelFeedRate).toFixed(0) + ', then G1 travel to ' + sampledAxis + '=' + nextLineCoord.toFixed(3) + ' at F' + Number(s.faceRetractFeed || s.travelFeedRate).toFixed(0) + '.');
        // Step 1: G1 retract on face axis back to startCoord (fully clears workpiece)
        if(axis === 'X'){
          await moveAbs(startCoord, null, null, s.faceRetractFeed || s.travelFeedRate);
        } else {
          await moveAbs(null, startCoord, null, s.faceRetractFeed || s.travelFeedRate);
        }
        // Step 2: G1 travel on sample axis to next sample position; use returned position to avoid extra HTTP call
        var _spIsrPos;
        if(axis === 'X'){
          _spIsrPos = await moveAbs(null, nextLineCoord, null, s.faceRetractFeed || s.travelFeedRate) || await getWorkPosition();
        } else {
          _spIsrPos = await moveAbs(nextLineCoord, null, null, s.faceRetractFeed || s.travelFeedRate) || await getWorkPosition();
        }
        // Safety net: check if probe was inadvertently triggered during G1 moves
        if(_spIsrPos.probeTriggered){
          logLine('face', 'INTER-SAMPLE TRAVEL CONTACT: probe triggered during inter-sample retract at X=' + Number(_spIsrPos.x).toFixed(3) + ' Y=' + Number(_spIsrPos.y).toFixed(3) + ' Z=' + Number(_spIsrPos.z).toFixed(3));
          var _spIsrRec = makeFaceContactRecord(faceResults.length + 1, _spIsrPos, axis, 'EARLY_CONTACT_INTER_SAMPLE_RETRACT_' + axis, targetCoord, lineCoord);
          faceResults.push(_spIsrRec);
          saveProbeResultsThrottled();
          var _spIsrRecovery = {recoveries: 0, totalLift: 0};
          var _spIsrUnitX = axis === 'X' ? Math.sign(startCoord - targetCoord) : 0;
          var _spIsrUnitY = axis === 'X' ? 0 : Math.sign(startCoord - targetCoord);
          await _clearTriggeredProbeByBackingOffGeneric('face', _spIsrPos, _spIsrUnitX, _spIsrUnitY, s, _spIsrRecovery);
          spDidOptimizedRetract = false;
        } else {
          spDidOptimizedRetract = true;
        }
      }
    }

    // No extra waitForIdle here: the last moveAbs in the sample loop already
    // calls waitForIdleWithTimeout(), so the controller is already idle.
    smSetProgress(100);
    await finishRunMotion('face');
    if (!_calledFromCombined) switchTab('results');
    pluginDebug('runFaceProbe COMPLETE: axis=' + axis + ' samples=' + faceSamples.length);
    setFooterStatus('Face probe ' + axis + ' complete: ' + faceSamples.length + ' sample(s)', 'good');
    layeredFaceResultsRaw = layeredFaceResults.slice();
    layeredFaceResults = subdivideFaceMesh(layeredFaceResults, meshSubdivisionSpacing);
    updateFaceMeshDataUI();
    populateUnifiedProbeTable();
    saveProbeResults();
    updateEdgeProbeStorageUI();
    pluginDebug('runFaceProbe single-pass complete: faceResults=' + faceResults.length);

  } catch(e){
    logLine('face', 'ERROR: ' + e.message);
    pluginDebug('runFaceProbe ERROR: axis=' + axis + ' error="' + e.message + '"');
    setFooterStatus('Error: ' + e.message, 'bad');
    saveProbeResults();
  } finally{
    _running = false;
    _stopRequested = false;
    pluginDebug('runFaceProbe EXIT (finally): _running reset to false');
    document.getElementById('btn-stop-face').disabled = true;
    document.getElementById('btn-face-x').disabled = false;
    document.getElementById('btn-face-y').disabled = false;
  }
}

// ── Mesh Data Management ──────────────────────────────────────────────────────
function smSaveSettings() {
  pluginDebug('smSaveSettings ENTER');
  var ids = ['sm-minX','sm-maxX','sm-spacingX','sm-minY','sm-maxY','sm-spacingY',
             'sm-probeFeed','sm-travelFeed','sm-clearanceZ','sm-maxPlunge','sm-referenceZ'];
  var data = {};
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) data[id] = el.value;
  });
  try {
    localStorage.setItem(SM_SURFACE_GRID_SETTINGS_KEY, JSON.stringify(data));
    pluginDebug('smSaveSettings: saved ' + Object.keys(data).length + ' settings');
    setFooterStatus('Surface grid settings saved.', 'good');
  } catch(e) {
    pluginDebug('smSaveSettings ERROR: ' + e.message);
    setFooterStatus('Failed to save settings: ' + e.message, 'bad');
    return;
  }
}

function fpSmSaveSettings() {
  pluginDebug('fpSmSaveSettings ENTER');
  var ids = ['sm-minX','sm-maxX','sm-spacingX','sm-minY','sm-maxY','sm-spacingY',
             'sm-probeFeed','sm-travelFeed','sm-clearanceZ','sm-maxPlunge','sm-referenceZ'];
  ids.forEach(function(id) {
    var fpEl = document.getElementById('fp-' + id);
    var smEl = document.getElementById(id);
    if (fpEl && smEl) smEl.value = fpEl.value;
  });
  smSaveSettings();
  try { updateSurfaceGridSizeDisplay(); } catch(e) {}
}

function smLoadSettings() {
  var raw;
  try { raw = localStorage.getItem(SM_SURFACE_GRID_SETTINGS_KEY); } catch(e) { return; }
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch(e) { return; }
  console.log('[smLoadSettings] Restoring 2D surface grid settings:', data);
  Object.keys(data).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = data[id];
    var fpEl = document.getElementById('fp-' + id);
    if (fpEl) fpEl.value = data[id];
  });
  try { updateSurfaceGridSizeDisplay(); } catch(e) { console.warn('[smLoadSettings] updateSurfaceGridSizeDisplay error:', e); }
}

(function init(){
  pluginDebug('init: plugin initializing');
  // Clear any stale visuals from a previous session/reload
  try{ clearAllVisuals(); }catch(e){ pluginDebug('init: clearAllVisuals error: ' + e.message); }
  try{ var vTag=document.getElementById('sm-version-tag'); if(vTag) vTag.textContent=SM_VERSION; }catch(e){}
  setTimeout(function(){ try{ bindProbeDimensionUI(); applyProbeDimensionSettings(getSettingsFromUI()); loadProbeDimensions(); }catch(e){} }, 0);
  try{ loadPersistedLogs(); }catch(e){}
  try{ loadSettings(); }catch(e){}
  // Do NOT restore probe results from previous session — Results tab starts empty on each restart.
  // User can manually load saved results via the Edge Probe Results Storage buttons if needed.
  try{ updateEdgeProbeStorageUI(); }catch(e){}
  try{ renderWorkflowList(); }catch(e){}
  try{ populateSurfaceResults(); }catch(e){}
  try{ loadSavedLocation(); }catch(e){}
  try{ refreshFinishBehaviorPreview(); }catch(e){}
  try{ refreshTravelRecoveryPreview(); }catch(e){}
  try{ smPvizInitRotation(); }catch(e){}
  try{ initSurfVizRotation(); }catch(e){}
  // Wire relief reset button and dblclick for Three.js camera reset
  try {
    var reliefResetBtnEl = document.getElementById('relief-3d-reset-btn');
    if (reliefResetBtnEl) reliefResetBtnEl.addEventListener('click', function(e) { e.stopPropagation(); reliefResetView(); });
    var reliefSceneEl = document.getElementById('relief-3d-scene');
    if (reliefSceneEl && !reliefSceneEl._reliefDblInited) {
      reliefSceneEl._reliefDblInited = true;
      reliefSceneEl.addEventListener('dblclick', reliefResetView);
    }
  } catch(e) {}
  try{ checkHomedStatus(); }catch(e){}
  refreshCurrentPosition().catch(function(e){
    console.warn('Could not refresh position on init (controller may not be connected):', e.message);
    var el = document.getElementById('setup-status');
    if(el){ el.textContent = 'Controller not connected'; el.className = 'status-line'; }
    setFooterStatus('Ready', '');
  });
  try{ renderLog('top'); }catch(e){}
  try{ renderLog('face'); }catch(e){}
  try{ smLoadSettings(); }catch(e){}
  try{ onProbeTypeChange(); }catch(e){}
  try{ updateOutlineProbeCenter(); }catch(e){}
  try{ initLayoutEditor(); }catch(e){ console.warn('Layout editor init error:', e); }

  // Tab buttons
  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      var tabId = t.getAttribute('data-tab');
      pluginDebug('Tab button clicked: ' + tabId);
      if(tabId) switchTab(tabId);
    });
  });

  // Setup buttons
  var btnSave = document.getElementById('btn-save-settings');
  if(btnSave) btnSave.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('btn-save-settings clicked'); saveSettings(); });
  var btnLoad = document.getElementById('btn-load-settings');
  if(btnLoad) btnLoad.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-load-settings clicked'); loadSettings(); });
  var btnReset = document.getElementById('btn-reset-settings');
  if(btnReset) btnReset.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-reset-settings clicked'); resetSettings(); });
  var btnSaveProbeDims = document.getElementById('btn-save-probe-dims');
  if(btnSaveProbeDims) btnSaveProbeDims.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('btn-save-probe-dims clicked'); saveProbeDimensions(); });
  var btnSaveLocation = document.getElementById('btn-save-location');
  if(btnSaveLocation) btnSaveLocation.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('btn-save-location clicked'); saveCurrentLocation(); });
  var btnGoLocation = document.getElementById('btn-go-location');
  if(btnGoLocation) btnGoLocation.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-go-location clicked'); goToSavedLocation(); });
  var btnCheckHomed = document.getElementById('btn-check-homed');
  if(btnCheckHomed) btnCheckHomed.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-check-homed clicked'); checkHomedStatus(); });
  var btnUseCurrentZHome = document.getElementById('btn-use-current-z-home');
  if(btnUseCurrentZHome) btnUseCurrentZHome.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-use-current-z-home clicked'); useCurrentZAsFinishHome(); });
  var btnRefreshPosition = document.getElementById('btn-refresh-position');
  if(btnRefreshPosition) btnRefreshPosition.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-refresh-position clicked'); refreshCurrentPosition(); });
  var btnHomeMachine = document.getElementById('btn-home-machine');
  if(btnHomeMachine) btnHomeMachine.addEventListener('click', function(){
    flashButton(this);
    pluginDebug('btn-home-machine clicked');
    sendCommand('$H')
      .then(function(){ setFooterStatus('Homing started — waiting for machine to finish.', 'ok'); refreshCurrentPosition(); })
      .catch(function(e){ setFooterStatus('Home failed: ' + e.message, 'bad'); });
  });
  var btnSetXYZero = document.getElementById('btn-set-xy-zero');
  if(btnSetXYZero) btnSetXYZero.addEventListener('click', function(){
    flashButton(this);
    pluginDebug('btn-set-xy-zero clicked');
    sendCommand('G10 L20 P1 X0 Y0')
      .then(function(){ setFooterStatus('X/Y zeroed at current position (X=0 Y=0 set here).', 'ok'); refreshCurrentPosition(); })
      .catch(function(e){ setFooterStatus('Set X/Y=0 failed: ' + e.message, 'bad'); });
  });
  var btnSetZZero = document.getElementById('btn-set-z-zero');
  if(btnSetZZero) btnSetZZero.addEventListener('click', function(){
    flashButton(this);
    pluginDebug('btn-set-z-zero clicked');
    sendCommand('G10 L20 P1 Z0')
      .then(function(){ setFooterStatus('Z zeroed at current position (Z=0 set here).', 'ok'); refreshCurrentPosition(); })
      .catch(function(e){ setFooterStatus('Set Z=0 failed: ' + e.message, 'bad'); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.jog-pill[data-step]'), function(btn){
    btn.addEventListener('click', function(){ var step = btn.getAttribute('data-step'); pluginDebug('Jog step pill clicked: ' + step); setJogStepPreset(step); });
  });
  setJogStepPreset((document.getElementById('jogStepXY') && document.getElementById('jogStepXY').value) || '1');
  var btnJogXMinus = document.getElementById('btn-jog-x-minus');
  if(btnJogXMinus) btnJogXMinus.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog X- clicked'); var j = getJogSettingsFromUI(); jogBy(-Math.abs(j.stepXY), null, null).catch(function(e){ setFooterStatus('Jog X- failed: ' + e.message, 'bad'); }); });
  var btnJogXPlus = document.getElementById('btn-jog-x-plus');
  if(btnJogXPlus) btnJogXPlus.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog X+ clicked'); var j = getJogSettingsFromUI(); jogBy(Math.abs(j.stepXY), null, null).catch(function(e){ setFooterStatus('Jog X+ failed: ' + e.message, 'bad'); }); });
  var btnJogYMinus = document.getElementById('btn-jog-y-minus');
  if(btnJogYMinus) btnJogYMinus.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Y- clicked'); var j = getJogSettingsFromUI(); jogBy(null, -Math.abs(j.stepXY), null).catch(function(e){ setFooterStatus('Jog Y- failed: ' + e.message, 'bad'); }); });
  var btnJogYPlus = document.getElementById('btn-jog-y-plus');
  if(btnJogYPlus) btnJogYPlus.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Y+ clicked'); var j = getJogSettingsFromUI(); jogBy(null, Math.abs(j.stepXY), null).catch(function(e){ setFooterStatus('Jog Y+ failed: ' + e.message, 'bad'); }); });
  var btnJogDiagUL = document.getElementById('btn-jog-xy-up-left');
  if(btnJogDiagUL) btnJogDiagUL.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog XY↖ clicked'); var j = getJogSettingsFromUI(); var s=Math.abs(j.stepXY); jogBy(-s, s, null).catch(function(e){ setFooterStatus('Jog failed: ' + e.message, 'bad'); }); });
  var btnJogDiagUR = document.getElementById('btn-jog-xy-up-right');
  if(btnJogDiagUR) btnJogDiagUR.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog XY↗ clicked'); var j = getJogSettingsFromUI(); var s=Math.abs(j.stepXY); jogBy(s, s, null).catch(function(e){ setFooterStatus('Jog failed: ' + e.message, 'bad'); }); });
  var btnJogDiagDL = document.getElementById('btn-jog-xy-down-left');
  if(btnJogDiagDL) btnJogDiagDL.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog XY↙ clicked'); var j = getJogSettingsFromUI(); var s=Math.abs(j.stepXY); jogBy(-s, -s, null).catch(function(e){ setFooterStatus('Jog failed: ' + e.message, 'bad'); }); });
  var btnJogDiagDR = document.getElementById('btn-jog-xy-down-right');
  if(btnJogDiagDR) btnJogDiagDR.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog XY↘ clicked'); var j = getJogSettingsFromUI(); var s=Math.abs(j.stepXY); jogBy(s, -s, null).catch(function(e){ setFooterStatus('Jog failed: ' + e.message, 'bad'); }); });
  var btnJogHold = document.getElementById('btn-jog-hold');
  if(btnJogHold) btnJogHold.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Hold clicked'); jogHoldMotion(); });
  var btnJogResume = document.getElementById('btn-jog-resume');
  if(btnJogResume) btnJogResume.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Resume clicked'); jogResumeMotion(); });
  var btnJogZMinus = document.getElementById('btn-jog-z-minus');
  if(btnJogZMinus) btnJogZMinus.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Z- clicked'); var j = getJogSettingsFromUI(); jogBy(null, null, -Math.abs(j.stepZ)).catch(function(e){ setFooterStatus('Jog Z- failed: ' + e.message, 'bad'); }); });
  var btnJogZPlus = document.getElementById('btn-jog-z-plus');
  if(btnJogZPlus) btnJogZPlus.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Z+ clicked'); var j = getJogSettingsFromUI(); jogBy(null, null, Math.abs(j.stepZ)).catch(function(e){ setFooterStatus('Jog Z+ failed: ' + e.message, 'bad'); }); });
  var btnJogWorkZero = document.getElementById('btn-jog-work-zero');
  if(btnJogWorkZero) btnJogWorkZero.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Work Zero clicked'); jogToWorkZero(); });
  var btnJogSafeTop = document.getElementById('btn-jog-safe-top');
  if(btnJogSafeTop) btnJogSafeTop.addEventListener('click', function(){ flashButton(this); pluginDebug('Jog Safe Top clicked'); jogRaiseToMachineSafeTop(); });
  var finishHomeZEl = document.getElementById('finishHomeZ');
  if(finishHomeZEl) finishHomeZEl.addEventListener('input', refreshFinishBehaviorPreview);
  var useMachineHomeRetractEl = document.getElementById('useMachineHomeRetract');
  if(useMachineHomeRetractEl) useMachineHomeRetractEl.addEventListener('change', refreshFinishBehaviorPreview);
  var machineSafeTopZEl = document.getElementById('machineSafeTopZ');
  if(machineSafeTopZEl) machineSafeTopZEl.addEventListener('input', refreshFinishBehaviorPreview);
  var returnToXYZeroEl = document.getElementById('returnToXYZero');
  if(returnToXYZeroEl) returnToXYZeroEl.addEventListener('change', refreshFinishBehaviorPreview);
  var travelContactLiftEl = document.getElementById('travelContactLift');
  if(travelContactLiftEl) travelContactLiftEl.addEventListener('input', refreshTravelRecoveryPreview);
  var travelContactMaxRetriesEl = document.getElementById('travelContactMaxRetries');
  if(travelContactMaxRetriesEl) travelContactMaxRetriesEl.addEventListener('input', refreshTravelRecoveryPreview);

  // Face probe buttons
  var btnFaceX = document.getElementById('btn-face-x');
  if(btnFaceX) btnFaceX.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-face-x clicked'); runFaceProbe('X'); });
  var btnFaceY = document.getElementById('btn-face-y');
  if(btnFaceY) btnFaceY.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-face-y clicked'); runFaceProbe('Y'); });
  var btnStopFace = document.getElementById('btn-stop-face');
  if(btnStopFace) btnStopFace.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-stop-face clicked'); stopAll(); });
  var btnSaveFaceLog = document.getElementById('btn-save-face-log');
  if(btnSaveFaceLog) btnSaveFaceLog.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-save-face-log clicked'); saveLog('face'); });
  var btnClearFaceLog = document.getElementById('btn-clear-face-log');
  if(btnClearFaceLog) btnClearFaceLog.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-clear-face-log clicked'); clearLog('face'); });
  var btnExportFaceCsv = document.getElementById('btn-export-face-csv');
  if(btnExportFaceCsv) btnExportFaceCsv.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-face-csv clicked'); exportFaceCSV(); });
  var btnExportFaceDxf = document.getElementById('btn-export-face-dxf');
  if(btnExportFaceDxf) btnExportFaceDxf.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-face-dxf clicked'); exportFaceDXF(); });
  var btnExportFaceObj = document.getElementById('btn-export-face-obj');
  if(btnExportFaceObj) btnExportFaceObj.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-face-obj clicked'); exportFaceOBJ(); });
  var btnExportFaceStl = document.getElementById('btn-export-face-stl');
  if(btnExportFaceStl) btnExportFaceStl.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-face-stl clicked'); exportFaceSTL(); });

  // Surface mesh export buttons
  try {
    document.getElementById('btn-export-surf-csv').addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-surf-csv clicked'); exportSurfaceMeshCSV(); });
    document.getElementById('btn-export-surf-dxf').addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-surf-dxf clicked'); exportSurfaceDXF(); });
    document.getElementById('btn-export-surf-obj').addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-surf-obj clicked'); exportSurfaceOBJ(); });
    document.getElementById('btn-export-surf-stl').addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-surf-stl clicked'); exportSurfaceSTL(); });
  } catch(e){}

  // Combined mesh export buttons
  try {
    document.getElementById('btn-export-combined-obj').addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-combined-obj clicked'); exportCombinedOBJWatertight(); });
    document.getElementById('btn-export-combined-stl').addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-combined-stl clicked'); exportCombinedSTLWatertight(); });
    document.getElementById('btn-export-combined-dxf').addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-combined-dxf clicked'); exportCombinedDXF(); });
    // Clear auto-fill flag when user manually edits the Bottom Z field
    var combinedBottomZEl = document.getElementById('combinedBottomZ');
    if (combinedBottomZEl) combinedBottomZEl.addEventListener('input', function() {
      this.setAttribute('data-is-default', '0');
      var hint = document.getElementById('combinedBottomZ-hint');
      if (hint) hint.style.display = 'none';
    });
  } catch(e){}

  // Results buttons
  var btnExportCsv = document.getElementById('btn-export-csv');
  if(btnExportCsv) btnExportCsv.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-csv clicked'); exportCSV(); });
  var btnClearAll = document.getElementById('btn-clear-all-results');
  if(btnClearAll) btnClearAll.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-clear-all-results clicked'); clearAllResults(); });
  var btnCopyResults = document.getElementById('btn-copy-results');
  if(btnCopyResults) btnCopyResults.addEventListener('click', function() {
    flashButton(this);
    pluginDebug('btn-copy-results clicked');
    var tbody = document.getElementById('res-unified-tbody');
    if (!tbody) return;
    var rows = Array.from(tbody.querySelectorAll('tr')).filter(function(tr) {
      return tr.querySelectorAll('td').length >= 5;
    }).map(function(tr) {
      return Array.from(tr.querySelectorAll('td')).map(function(td) { return td.textContent; }).join('\t');
    });
    var text = '#\tX\tY\tZ\tType\n' + rows.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() { setFooterStatus('Results copied to clipboard.', 'good'); }).catch(function() { setFooterStatus('Copy failed.', 'warn'); });
    } else {
      var ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta); setFooterStatus('Results copied to clipboard.', 'good');
    }
  });

  // Actions / workflow buttons
  var btnSaveWf = document.getElementById('btn-save-workflow');
  if(btnSaveWf) btnSaveWf.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('btn-save-workflow clicked'); saveWorkflow(); });
  var btnLoadWf = document.getElementById('btn-load-workflow');
  if(btnLoadWf) btnLoadWf.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-load-workflow clicked'); loadWorkflow(); });
  var btnExportWf = document.getElementById('btn-export-workflows');
  if(btnExportWf) btnExportWf.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-export-workflows clicked'); exportWorkflows(); });
  var btnImportWf = document.getElementById('btn-import-workflows');
  if(btnImportWf) btnImportWf.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-import-workflows clicked'); importWorkflows(); });
  var btnSaveAllLogs = document.getElementById('btn-save-all-logs');
  if(btnSaveAllLogs) btnSaveAllLogs.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('btn-save-all-logs clicked'); saveAllLogs(); });
  var btnClearAll2 = document.getElementById('btn-clear-all-results-2');
  if(btnClearAll2) btnClearAll2.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-clear-all-results-2 clicked'); clearAllResults(); });

  // Workflow list — event delegation for dynamically generated Load/Delete buttons
  var wfList = document.getElementById('workflow-list');
  if(wfList){
    wfList.addEventListener('click', function(e){
      var btn = e.target.closest('button');
      if(!btn) return;
      var name = btn.getAttribute('data-wf-name');
      if(!name) return;
      pluginDebug('Workflow list click: name="' + name + '" action=' + (btn.classList.contains('wf-load') ? 'load' : 'delete'));
      if(btn.classList.contains('wf-load')) _loadWorkflowByName(name);
      else if(btn.classList.contains('wf-delete')) deleteWorkflow(name);
    });
  }

  // Mesh Data Management buttons
  var btnSaveMeshFile = document.getElementById('btn-save-mesh-file');
  if(btnSaveMeshFile) btnSaveMeshFile.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('btn-save-mesh-file clicked'); saveMeshToFile(); });
  var btnLoadMeshFile = document.getElementById('btn-load-mesh-file');
  if(btnLoadMeshFile) btnLoadMeshFile.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-load-mesh-file clicked'); loadMeshFromFile(); });
  var btnSaveMeshStorage = document.getElementById('btn-save-mesh-storage');
  if(btnSaveMeshStorage) btnSaveMeshStorage.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('btn-save-mesh-storage clicked'); saveMeshToStorage(); });
  var btnLoadMeshStorage = document.getElementById('btn-load-mesh-storage');
  if(btnLoadMeshStorage) btnLoadMeshStorage.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-load-mesh-storage clicked'); loadMeshFromStorage(); });
  var btnClearMeshStorage = document.getElementById('btn-clear-mesh-storage');
  if(btnClearMeshStorage) btnClearMeshStorage.addEventListener('click', function(){ flashButton(this); pluginDebug('btn-clear-mesh-storage clicked'); clearMeshStorage(); });

  // 2D Surface Compensation buttons (legacy — kept for backward compatibility)
  var btnApply2d = document.getElementById('sm-btn-apply-comp');
  if(btnApply2d) btnApply2d.addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-apply-comp clicked'); applySurfaceCompensation(); });
  var btnDownload2d = document.getElementById('sm-btn-download-comp');
  if(btnDownload2d) btnDownload2d.addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-download-comp clicked'); smDownloadCompensatedGcode(); });
  var btnSendNcSender2d = document.getElementById('sm-btn-send-ncsender');
  if(btnSendNcSender2d) btnSendNcSender2d.addEventListener('click', function(){ flashButton(this); pluginDebug('sm-btn-send-ncsender clicked'); sendCompToNcSender(smCompensatedGcode, 'compensated_surface'); });

  // Face Probe Tab — Mesh Data Management buttons
  var faceBtnSaveMesh = document.getElementById('face-btn-save-mesh');
  if (faceBtnSaveMesh) faceBtnSaveMesh.addEventListener('click', function(){ flashSaveButton(this); pluginDebug('face-btn-save-mesh clicked'); saveFaceMeshData(); });
  var faceBtnLoadMesh = document.getElementById('face-btn-load-mesh');
  if (faceBtnLoadMesh) faceBtnLoadMesh.addEventListener('click', function(){ flashButton(this); pluginDebug('face-btn-load-mesh clicked'); loadFaceMeshData(); });
  var faceBtnClearMesh = document.getElementById('face-btn-clear-mesh');
  if (faceBtnClearMesh) faceBtnClearMesh.addEventListener('click', function(){ flashButton(this); pluginDebug('face-btn-clear-mesh clicked'); clearFaceMeshData(); });
  var faceBtnExportJson = document.getElementById('face-btn-export-json');
  if (faceBtnExportJson) faceBtnExportJson.addEventListener('click', function(){ flashButton(this); pluginDebug('face-btn-export-json clicked'); exportFaceMeshJSON(); });
  var faceBtnExportCsvNew = document.getElementById('face-btn-export-csv-new');
  if (faceBtnExportCsvNew) faceBtnExportCsvNew.addEventListener('click', function(){ flashButton(this); pluginDebug('face-btn-export-csv-new clicked'); exportFaceMeshCSVNew(); });
  var faceBtnImportMesh = document.getElementById('face-btn-import-mesh');
  if (faceBtnImportMesh) faceBtnImportMesh.addEventListener('click', function(){ flashButton(this); pluginDebug('face-btn-import-mesh clicked'); importFaceMeshData(); });

  // Face probe stylus cap sync on Setup tab change
  var probeStylusEl = document.getElementById('probeStylusCalloutLength');
  if (probeStylusEl) probeStylusEl.addEventListener('input', fpUpdateStylusCapInfo);

  // Initialize face probe tab on page load
  fpUpdateStylusCapInfo();
  updateFaceMeshDataUI();
  initFacePVizRotation();
})();


// ── Face Probe Data Helper ────────────────────────────────────────────────────

function getFaceMeshData() {
  // Returns the best available face probe data: layered results first, then filtered single-pass
  if (layeredFaceResults && layeredFaceResults.length) return layeredFaceResults;
  if (faceResults && faceResults.length) {
    var filtered = faceResults.filter(function(r) { return r.type === 'face' && r.status && r.status.indexOf('MISS') === -1; });
    return filtered.length ? filtered : null;
  }
  return null;
}

// ── Face Wall Grid Builder ─────────────────────────────────────────────────────
// Converts layered face results into a 2D [colIndex][rowIndex] grid suitable
// for rendering as a perpendicular wall below the front edge of the top surface.
// Rows are sorted ascending by layer (layer 1 = deepest = bottom, layer N = top).
// Returns null when data is insufficient for triangulated rendering (<2 cols or rows).
function buildFaceWallGrid(dataOverride) {
  var data = dataOverride || getFaceMeshData();
  if (!data || !data.length) return null;

  // Collect unique sample positions (rounded to 3 dp to merge near-identical floats)
  // and layer numbers. Build an index map for O(1) lookup during grid fill.
  // Use sampleCoord (always the controlled axis position) when present; fall back
  // to r.x for backward-compatibility with data captured before this field was added.
  var xKeyToVal = {}, layerSet = {};
  data.forEach(function(r) {
    var sc = r.sampleCoord != null ? Number(r.sampleCoord) : Number(r.x);
    var key = sc.toFixed(3);
    // Use the first seen exact value for this rounded key to avoid drift
    if (!(key in xKeyToVal)) xKeyToVal[key] = sc;
    layerSet[r.layer != null ? r.layer : 1] = true;
  });

  var xs = Object.keys(xKeyToVal)
    .map(function(k) { return xKeyToVal[k]; })
    .sort(function(a, b) { return a - b; });
  var layers = Object.keys(layerSet).map(Number).sort(function(a, b) { return a - b; });
  // layers[0] = deepest (bottom of wall), layers[N-1] = shallowest (top, shared edge)

  if (xs.length < 2 || layers.length < 2) return null;

  // Pre-build lookup maps for O(1) index resolution during grid fill
  var xIndexMap = {}; // rounded x key → column index
  xs.forEach(function(v, i) { xIndexMap[v.toFixed(3)] = i; });
  var layerIndexMap = {}; // layer number → row index
  layers.forEach(function(l, i) { layerIndexMap[l] = i; });

  // Build grid: grid[li][xi] = {x, y, z, layer, sampleTopZ}
  var grid = [];
  for (var li = 0; li < layers.length; li++) { grid.push({}); }

  data.forEach(function(r) {
    var sc = r.sampleCoord != null ? Number(r.sampleCoord) : Number(r.x);
    var xi = xIndexMap[sc.toFixed(3)];
    if (xi == null) return;
    var l = r.layer != null ? r.layer : 1;
    var li = layerIndexMap[l];
    if (li == null) return;
    if (!grid[li][xi]) grid[li][xi] = r;
  });

  // Nearest-neighbor fill: propagate non-null cells into adjacent null cells so that
  // a single missed probe contact doesn't create holes in the 3D face wall mesh.
  // Uses multi-pass flood-fill (at most max(cols,rows) passes) to reach all null cells.
  var _nnCols = xs.length, _nnRows = layers.length;
  var _nnChanged = true, _nnMaxPass = Math.max(_nnCols, _nnRows);
  for (var _nnP = 0; _nnP < _nnMaxPass && _nnChanged; _nnP++) {
    _nnChanged = false;
    for (var _nnLi = 0; _nnLi < _nnRows; _nnLi++) {
      for (var _nnXi = 0; _nnXi < _nnCols; _nnXi++) {
        if (grid[_nnLi][_nnXi]) continue; // already filled
        // Gather non-null orthogonal neighbours
        var _nnNbrs = [];
        if (_nnXi > 0 && grid[_nnLi][_nnXi-1]) _nnNbrs.push(grid[_nnLi][_nnXi-1]);
        if (_nnXi < _nnCols-1 && grid[_nnLi][_nnXi+1]) _nnNbrs.push(grid[_nnLi][_nnXi+1]);
        if (_nnLi > 0 && grid[_nnLi-1][_nnXi]) _nnNbrs.push(grid[_nnLi-1][_nnXi]);
        if (_nnLi < _nnRows-1 && grid[_nnLi+1][_nnXi]) _nnNbrs.push(grid[_nnLi+1][_nnXi]);
        if (_nnNbrs.length === 0) continue;
        var _nnSumY = 0, _nnSumZ = 0;
        _nnNbrs.forEach(function(r) { _nnSumY += Number(r.y); _nnSumZ += Number(r.z); });
        var _nnCnt = _nnNbrs.length;
        grid[_nnLi][_nnXi] = { x: xs[_nnXi], y: _nnSumY/_nnCnt, z: _nnSumZ/_nnCnt, layer: layers[_nnLi], _interpolated: true };
        _nnChanged = true;
      }
    }
  }


  var zMin = Infinity, zMax = -Infinity;
  var yMin = Infinity, yMax = -Infinity;
  data.forEach(function(r) {
    var z = Number(r.z);
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
    var y = Number(r.y);
    if (isFinite(y)) { if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
  });
  if (!isFinite(yMin)) { yMin = 0; yMax = 1; }

  return {
    grid: grid,
    xs: xs,
    layers: layers,
    nCols: xs.length,
    nRows: layers.length,
    xMin: xs[0],
    xMax: xs[xs.length - 1],
    zMin: zMin,
    zMax: zMax,
    yMin: yMin,
    yMax: yMax
  };
}

// ── Face Wall SVG Renderer ─────────────────────────────────────────────────────



function fpReadRow1ZStart() {
  if (!smMeshData || !smGridConfig) {
    alert('No surface mesh data available.\n\nRun a Surface Probe first, or enter Z Start manually.');
    return;
  }
  var row0 = smMeshData[0];
  if (!row0 || !row0.length) {
    alert('Row 1 of surface mesh is empty. Run a surface probe first.');
    return;
  }
  var validZ = row0.filter(function(z) { return z != null && isFinite(z); });
  if (!validZ.length) { alert('Row 1 has no valid Z values.'); return; }
  var avgZ = validZ.reduce(function(a, b) { return a + b; }, 0) / validZ.length;
  var el = document.getElementById('fp-zStart');
  if (el) el.value = avgZ.toFixed(3);
  fpUpdateStylusCapInfo();
  var statusEl = document.getElementById('face-meshStorageStatus');
  if (statusEl) statusEl.textContent = 'Z Start loaded from Row 1 average: ' + avgZ.toFixed(3) + ' coords (' + validZ.length + ' points).';
}

function fpUpdateStylusCapInfo() {
  var stylusLen = Number((document.getElementById('probeStylusCalloutLength') || {}).value) || FACE_PROBE_DEFAULT_MAX_DEPTH;
  var infoEl = document.getElementById('fp-stylus-cap-info');
  if (infoEl) infoEl.textContent = 'Max = ' + stylusLen.toFixed(3) + ' coords (probe stylus callout length from Setup)';
  fpValidateZEnd();
}

function fpValidateZEnd() {
  var stylusLen = Number((document.getElementById('probeStylusCalloutLength') || {}).value) || FACE_PROBE_DEFAULT_MAX_DEPTH;
  var zEndEl = document.getElementById('faceMaxDepth');
  var warningEl = document.getElementById('fp-stylus-warning');
  if (!zEndEl || !warningEl) return;
  var zEnd = Number(zEndEl.value);
  if (isFinite(zEnd) && zEnd > stylusLen) {
    warningEl.style.display = '';
    zEndEl.style.borderColor = 'var(--bad)';
  } else {
    warningEl.style.display = 'none';
    zEndEl.style.borderColor = '';
  }
}


// ── Face Mesh Data Management ─────────────────────────────────────────────────

function saveFaceMeshData() {
  var data = getFaceMeshData();
  if (!data || !data.length) { alert('No face mesh data to save. Run a face probe first.'); return; }
  var payload = { faceMeshData: data, timestamp: Date.now() };
  var json = JSON.stringify(payload, null, 2);
  try { localStorage.setItem(FACE_MESH_STORAGE_KEY, json); } catch(e) {}
  if (window.showSaveFilePicker) {
    window.showSaveFilePicker({
      suggestedName: 'face_mesh_' + Date.now() + '.json',
      types: [{ description: 'Face Mesh JSON', accept: { 'application/json': ['.json'] } }]
    }).then(function(handle) {
      return handle.createWritable().then(function(writable) {
        return writable.write(json).then(function() { return writable.close(); });
      });
    }).then(function() {
      var el = document.getElementById('face-meshStorageStatus');
      if (el) el.textContent = 'Face mesh saved to file and browser storage.';
    }).catch(function(e) {
      if (e && e.name !== 'AbortError') {
        var el = document.getElementById('face-meshStorageStatus');
        if (el) el.textContent = 'Saved to browser storage only. File save cancelled or unavailable.';
      }
    });
  } else {
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'face_mesh_' + Date.now() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    var el = document.getElementById('face-meshStorageStatus');
    if (el) el.textContent = 'Face mesh saved to file and browser storage.';
  }
}

function loadFaceMeshData() {
  var raw = localStorage.getItem(FACE_MESH_STORAGE_KEY);
  if (!raw) { alert('No face mesh data in browser storage. Run a face probe first or import a file.'); return; }
  try {
    var data = JSON.parse(raw);
    if (data.faceMeshData && data.faceMeshData.length) {
      layeredFaceResultsRaw = data.faceMeshData;
      layeredFaceResults = subdivideFaceMesh(data.faceMeshData, meshSubdivisionSpacing);
      updateFaceMeshDataUI();
      var el = document.getElementById('face-meshStorageStatus');
      if (el) el.textContent = 'Face mesh loaded from browser storage (' + layeredFaceResults.length + ' points).';
    } else { alert('Face mesh storage data is empty or corrupt.'); }
  } catch(e) { alert('Failed to parse face mesh data: ' + e.message); }
}

function clearFaceMeshData() {
  if (!confirm('Clear all face mesh data?')) return;
  layeredFaceResults = [];
  faceResults = [];
  try { localStorage.removeItem(FACE_MESH_STORAGE_KEY); } catch(e) {}
  updateFaceMeshDataUI();
  var el = document.getElementById('face-meshStorageStatus');
  if (el) el.textContent = 'Face mesh cleared.';
}

function exportFaceMeshJSON() {
  var data = getFaceMeshData();
  if (!data || !data.length) { alert('No face mesh data to export. Run a face probe first.'); return; }
  var json = JSON.stringify({ faceMeshData: data, timestamp: Date.now() }, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'face_mesh_export_' + Date.now() + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function exportFaceMeshCSVNew() {
  var data = getFaceMeshData();
  if (!data || !data.length) { alert('No face mesh data to export. Run a face probe first.'); return; }
  var rows = ['# Plugin Version: ' + SM_VERSION, 'Index,X,Y,Z,Layer'];
  data.forEach(function(p, i) {
    rows.push((i + 1) + ',' + Number(p.x).toFixed(3) + ',' + Number(p.y).toFixed(3) + ',' +
      Number(p.z).toFixed(3) + ',' + (p.layer != null ? p.layer : 1));
  });
  var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'face_mesh_' + Date.now() + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function importFaceMeshData() {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = function(ev) {
    var file = ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        var pts = data.faceMeshData || data;
        if (!Array.isArray(pts)) throw new Error('Expected an array of face mesh points');
        layeredFaceResultsRaw = pts;
        layeredFaceResults = subdivideFaceMesh(pts, meshSubdivisionSpacing);
        updateFaceMeshDataUI();
        var statusEl = document.getElementById('face-meshStorageStatus');
        if (statusEl) statusEl.textContent = 'Face mesh imported: ' + pts.length + ' points.';
      } catch(err) { alert('Failed to parse face mesh file: ' + err.message); }
    };
    reader.readAsText(file);
  };
  inp.click();
}

// ── Combined Probe Mode ───────────────────────────────────────────────────────

async function runCombinedProbeMode(axis) {
  if (_running) { smLogProbe('COMBINED: cannot start — another probe operation is already running (_running=true).'); pluginDebug('runCombinedProbeMode SKIP: _running=true'); setFooterStatus('Already running', 'warn'); return; }
  axis = String(axis || 'Y').toUpperCase();
  // Reset stop flags so a previously-stopped run does not block this one.
  smStopFlag = false;
  _stopRequested = false;
  _outlineStopFlag = false;
  smLogProbe('=== 3D Live Edge Mesh Plugin ' + SM_VERSION + ' ===');
  smLogProbe('COMBINED: Starting combined probe (surface + face axis=' + axis + ')...');
  pluginDebug('runCombinedProbeMode ENTER: axis=' + axis);
  setFooterStatus('Combined probe: running surface phase\u2026', 'warn');

  // Disable all probe controls
  var runBtn = document.getElementById('sm-btn-run-probe');
  var stopBtn = document.getElementById('sm-btn-stop-probe');
  var btnFaceX = document.getElementById('btn-face-x');
  var btnFaceY = document.getElementById('btn-face-y');
  if (runBtn) runBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = false;
  if (btnFaceX) btnFaceX.disabled = true;
  if (btnFaceY) btnFaceY.disabled = true;

  try {
    // Phase 1: Run surface probe and await its completion via Promise wrapper.
    // _smProbingCompleteCallback is called by runSurfaceProbing when done;
    // wrapping it in a Promise lets us properly await the result here.
    smLogProbe('COMBINED: Phase 1 — running surface probe...');
    pluginDebug('runCombinedProbeMode: Phase 1 starting surface probe, setting _smProbingCompleteCallback');
    var surfaceSuccess = await new Promise(function(resolve) {
      _smProbingCompleteCallback = function(success) {
        pluginDebug('runCombinedProbeMode: _smProbingCompleteCallback called success=' + success + ' smMeshData=' + !!smMeshData + ' smStopFlag=' + smStopFlag);
        resolve(!!success);
      };
      _smSkipFinishMotion = true; // Skip home detour in combined mode — go directly to Phase 1.5/face probe
      runSurfaceProbing();
    });
    pluginDebug('runCombinedProbeMode: surface probe promise resolved, surfaceSuccess=' + surfaceSuccess);

    if (!surfaceSuccess) {
      smLogProbe('COMBINED: Phase 1 FAILED — surface probe failed or was stopped. Face probe skipped.');
      pluginDebug('runCombinedProbeMode: Phase 1 FAILED. smMeshData=' + !!smMeshData + ' smStopFlag=' + smStopFlag);
      setFooterStatus('Combined probe: surface phase failed/stopped.', 'bad');
      return;
    }
    smLogProbe('COMBINED: Phase 1 complete — surface probe done. smMeshData rows=' + (smMeshData ? smMeshData.length : 'null'));

    smLogProbe('COMBINED: Phase 1.5 — probing top surface at face line Y coordinate...');
    setFooterStatus('Combined probe: running top-surface reference phase\u2026', 'warn');

    // Phase 1.5: Physically probe the top surface at the exact face line Y coordinate
    // for each face sample X position so the face probe gets real measured top-Z values
    // rather than interpolated grid row 0 values.
    topResults = [];
    var _phase15FallbackNeeded = false;
    try {
      var _p15Settings = getSettingsFromUI();
      var _p15FaceY = _p15Settings.faceFixedCoord;
      var _p15ClearanceZ = Number((document.getElementById('sm-clearanceZ') || {}).value) || 5;
      var _p15TravelFeed = Number((document.getElementById('sm-travelFeed') || {}).value) || 600;
      var _p15ProbeFeed = _p15Settings.topFeed;
      var _p15MaxPlunge = _p15Settings.topProbeDepth;
      var _p15Retract = _p15Settings.topRetract;

      // Compute face sample X positions using face probe config (auto-spacing or manual
      // xPoints). fpBuildFaceSamplesFromConfig() is the authoritative source — it honours
      // fp-xAutoSpacing, fp-xTargetSpacing, fp-xStart and fp-xEnd so that Phase 1.5
      // probes the top surface at exactly the X positions the face probe will use in
      // Phase 2.  Fall back to surface grid column positions only when the face config
      // cannot produce samples (fp-xStart/xEnd not configured).
      var _p15Samples = fpBuildFaceSamplesFromConfig();
      // Fallback: use grid column X positions when face config is unavailable.
      if (!_p15Samples || _p15Samples.length === 0) {
        if (smGridConfig) {
          _p15Samples = [];
          for (var _p15ci = 0; _p15ci < smGridConfig.colCount; _p15ci++) {
            _p15Samples.push({ index: _p15ci + 1, sampleCoord: smGridConfig.minX + _p15ci * smGridConfig.colSpacing });
          }
        }
      }

      if (!_p15Samples || _p15Samples.length === 0) {
        throw new Error('No face sample X positions available for Phase 1.5');
      }

      // In endpoints mode, restrict Phase 1.5 to probe only xStart and xEnd
      if (_p15Settings.fpTopRefMode === 'endpoints') {
        var _p15xStartEp = Number((document.getElementById('fp-xStart') || {}).value);
        var _p15xEndEp   = Number((document.getElementById('fp-xEnd')   || {}).value);
        if (isFinite(_p15xStartEp) && isFinite(_p15xEndEp) && _p15xStartEp !== _p15xEndEp) {
          _p15Samples = [
            { index: 1, sampleCoord: _p15xStartEp },
            { index: 2, sampleCoord: _p15xEndEp }
          ];
        } else if (_p15Samples.length > 2) {
          _p15Samples = [_p15Samples[0], _p15Samples[_p15Samples.length - 1]];
        }
      }

      var _p15Total = _p15Samples.length;
      pluginDebug('runCombinedProbeMode Phase 1.5: faceY=' + _p15FaceY + ' samples=' + _p15Total + ' maxPlunge=' + _p15MaxPlunge + ' probeFeed=' + _p15ProbeFeed);

      // Perform initial clearance lift if enabled (before Phase 1.5 starts)
      var _p15UseInitialLift = _p15Settings.useInitialClearanceLift;
      var _p15TopClearZ = Number(_p15Settings.topClearZ) || 5;
      if (_p15UseInitialLift) {
        smLogProbe('COMBINED Phase 1.5: Performing initial clearance lift of ' + _p15TopClearZ.toFixed(3) + ' coords...');
        await smPerformInitialClearanceLift('sm', _p15TopClearZ, _p15TravelFeed);
      }

      for (var _p15i = 0; _p15i < _p15Total; _p15i++) {
        if (_stopRequested) { checkStop(); }
        var _p15xPos = _p15Samples[_p15i].sampleCoord;
        smLogProbe('COMBINED Phase 1.5: probing top surface at X=' + _p15xPos.toFixed(3) + ' Y=' + _p15FaceY.toFixed(3) + ' (' + (_p15i + 1) + '/' + _p15Total + ')');
        pluginDebug('runCombinedProbeMode Phase 1.5: sample ' + (_p15i + 1) + '/' + _p15Total + ' X=' + _p15xPos.toFixed(3) + ' Y=' + _p15FaceY.toFixed(3));

        await smSafeLateralMove(_p15xPos, _p15FaceY, _p15TravelFeed, _p15ClearanceZ);
        await smEnsureProbeClear(_p15ClearanceZ, _p15TravelFeed);
        var _p15Contact = await smPlungeProbe(_p15MaxPlunge, _p15ProbeFeed);
        if (!_p15Contact || !isFinite(_p15Contact.z)) {
          throw new Error('Phase 1.5 probe returned invalid contact position at X=' + _p15xPos.toFixed(3));
        }

        topResults.push({
          type: 'top',
          index: _p15i + 1,
          sampleCoord: _p15xPos,
          targetSamplePos: _p15xPos,
          x: Number(_p15Contact.x),
          y: Number(_p15Contact.y),
          z: Number(_p15Contact.z),
          machineZ: _p15Contact.machineZ != null ? Number(_p15Contact.machineZ) : null,
          status: 'TOP'
        });

        smLogProbe('COMBINED Phase 1.5: contact at Z=' + _p15Contact.z.toFixed(3));
        await smRetractSmall(_p15Contact.z, _p15Retract, _p15TravelFeed);
      }

      smLogProbe('COMBINED Phase 1.5: measured ' + topResults.length + ' top-surface reference points at face line Y=' + _p15FaceY.toFixed(3));
      pluginDebug('runCombinedProbeMode Phase 1.5 complete: ' + topResults.length + ' points at faceY=' + _p15FaceY.toFixed(3));
      saveProbeResults();

    } catch (_p15Err) {
      smLogProbe('COMBINED Phase 1.5 ERROR: ' + (_p15Err && _p15Err.message ? _p15Err.message : String(_p15Err)) + ' — falling back to surface mesh row 0 interpolation.');
      pluginDebug('runCombinedProbeMode Phase 1.5 ERROR (fallback): ' + (_p15Err && _p15Err.message ? _p15Err.message : String(_p15Err)));
      console.error('COMBINED Phase 1.5 error (falling back to grid row 0):', _p15Err);
      _phase15FallbackNeeded = true;
    }

    // Fallback: populate topResults from surface mesh row 0 if Phase 1.5 failed.
    if (_phase15FallbackNeeded || topResults.length === 0) {
      topResults = [];
      if (smMeshData && smGridConfig) {
        var _cfg = smGridConfig;
        var _row0 = smMeshData[0];
        if (_row0) {
          for (var _ci = 0; _ci < _cfg.colCount; _ci++) {
            var _zVal = _row0[_ci];
            if (_zVal != null && isFinite(_zVal)) {
              var _xCoord = _cfg.minX + _ci * _cfg.colSpacing;
              topResults.push({
                type: 'top', index: _ci + 1,
                sampleCoord: _xCoord, targetSamplePos: _xCoord,
                x: _xCoord, y: _cfg.minY, z: Number(_zVal), status: 'TOP'
              });
            }
          }
          smLogProbe('COMBINED: (fallback) populated ' + topResults.length + ' top-profile reference points from surface mesh row 0.');
          console.log('COMBINED: topResults (fallback) =', JSON.stringify(topResults.slice(0, 3)));
        }
      } else {
        smLogProbe('COMBINED: WARNING — smMeshData or smGridConfig is null; topResults will be empty.');
        pluginDebug('runCombinedProbeMode WARNING: smMeshData=' + smMeshData + ' smGridConfig=' + smGridConfig);
      }
    }

    // Phase 2: Run face probe.
    // Reset _running in case surface probing left it in a non-false state —
    // runFaceProbe() guards on _running and returns early (no-op) if it is true.
    if (_running) {
      smLogProbe('COMBINED: WARNING — _running flag was true before face probe; resetting to allow face probe to execute.');
      pluginDebug('runCombinedProbeMode WARNING: _running was true before face probe — resetting');
      _running = false;
    }
    // Also reset _stopRequested so face probe does not abort immediately
    _stopRequested = false;

    // Retract probe and wait for it to clear before starting the face probe.
    // After the surface probe's last point the pin may still be in contact with the
    // surface (triggered state). runFaceProbe calls requireStartupHomingPreflight
    // which aborts immediately if the probe is triggered, so we must lift Z first.
    smLogProbe('COMBINED: Retracting probe before face phase...');
    var combinedClearZ = Number((document.getElementById('sm-clearanceZ') || {}).value) || 5;
    var combinedTravelFeed = Number((document.getElementById('sm-travelFeed') || {}).value) || 600;
    var probeCleared = false;
    try {
      await smEnsureProbeClear(combinedClearZ, combinedTravelFeed);
      probeCleared = true;
      smLogProbe('COMBINED: Probe cleared. Starting face probe phase...');
    } catch (clearErr) {
      smLogProbe('ERROR: Could not clear probe after surface phase. Aborting face probe. ' + (clearErr && clearErr.message ? clearErr.message : String(clearErr)));
      console.error('COMBINED: probe clear failed:', clearErr);
    }
    if (!probeCleared) {
      setFooterStatus('Combined probe: could not clear probe before face phase.', 'bad');
      return;
    }

    // Configurable pause between surface probe phase and face probe phase
    var phasePauseMs = Math.max(0, Number((document.getElementById('combined-phase-pause') || {}).value) || 0);
    if (phasePauseMs > 0) {
      smLogProbe('COMBINED: surface probe row complete — pausing ' + phasePauseMs + 'ms before face probe...');
      logLine('face', 'COMBINED MODE: surface probe row complete — pausing ' + phasePauseMs + 'ms before face probe...');
      await sleep(phasePauseMs);
      smLogProbe('COMBINED: pause complete — starting face probe phase (axis=' + axis + ')...');
      logLine('face', 'COMBINED MODE: pause complete — starting face probe phase (axis=' + axis + ')...');
    }

    setFooterStatus('Combined probe: running face probe phase (' + axis + ')\u2026', 'warn');
    smLogProbe('COMBINED: Phase 2 — calling runFaceProbe(axis=' + axis + ')...');
    pluginDebug('runCombinedProbeMode: Phase 2 calling runFaceProbe axis=' + axis + ' _running=' + _running + ' _stopRequested=' + _stopRequested);
    logLine('face', 'COMBINED MODE: starting face probe phase (axis=' + axis + ')...');
    try {
      await runFaceProbe(axis, true);
      smLogProbe('COMBINED: Phase 2 complete — face probe done.');
      pluginDebug('runCombinedProbeMode: Phase 2 face probe completed successfully');
    } catch (faceErr) {
      smLogProbe('COMBINED: Phase 2 FAILED — face probe error: ' + (faceErr && faceErr.message ? faceErr.message : String(faceErr)));
      pluginDebug('runCombinedProbeMode ERROR (face): ' + (faceErr && faceErr.message ? faceErr.message : String(faceErr)));
      console.error('COMBINED: face probe threw:', faceErr);
      logLine('face', 'ERROR: face probe failed in combined mode: ' + (faceErr && faceErr.message ? faceErr.message : String(faceErr)));
    }

    // Merge combined data and update all visualizers
    mergeCombinedProbeData();
    updateCombinedMeshUI();
    try {
      smPvizRenderMesh();
      renderSurfVizMesh();
      renderResVizMesh();
      populateSurfaceResults();
      renderRelief3D();
      // Render 2D relief maps for both surface and face datasets
      // then auto-switch probe-tab sections to heatmap views
      setTimeout(function() {
        renderSurfaceReliefMap();
        renderFaceReliefMap();
        setTimeout(function() {
          showProbeHeatmapView('sm');
          showProbeHeatmapView('face');
        }, 120);
      }, 60);
    } catch (vizErr) {
      smLogProbe('WARNING: 3D visualization failed: ' + (vizErr && vizErr.message ? vizErr.message : String(vizErr)));
      console.warn('COMBINED: visualization error (non-fatal):', vizErr);
    }
    setFooterStatus('Combined probe complete: surface + face ' + axis + ' merged.', 'good');
    smSetProgress(100);
    smLogProbe('COMBINED: All phases complete. ' + (combinedMeshPoints ? combinedMeshPoints.length : 0) + ' total points in combined dataset.');
    pluginDebug('runCombinedProbeMode COMPLETE: axis=' + axis + ' total=' + (combinedMeshPoints ? combinedMeshPoints.length : 0) + ' points');
    saveProbeResults();
    updateEdgeProbeStorageUI();
    pluginDebug('runCombinedProbeMode complete: topResults=' + topResults.length + ' faceResults=' + faceResults.length + ' layeredFaceResults=' + layeredFaceResults.length);

  } catch (err) {
    smLogProbe('COMBINED: unexpected error: ' + (err && err.message ? err.message : String(err)));
    pluginDebug('runCombinedProbeMode UNEXPECTED ERROR: ' + (err && err.message ? err.message : String(err)));
    console.error('COMBINED: unexpected error:', err);
    setFooterStatus('Combined probe error: ' + (err && err.message ? err.message : String(err)), 'bad');
    // Still attempt to merge any partial data
    try { mergeCombinedProbeData(); updateCombinedMeshUI(); } catch(e2) { /* ignore */ }
  } finally {
    // Best-effort final park: lift to Park Z then rapid to X0 Y0 (work coords).
    // Runs whether the combined probe completed normally or aborted with an error.
    var finalParkEnabledEl = document.getElementById('combined-final-park-enabled');
    if (finalParkEnabledEl && finalParkEnabledEl.checked) {
      await _combinedFinalPark();
    }
    if (runBtn) runBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (btnFaceX) btnFaceX.disabled = false;
    if (btnFaceY) btnFaceY.disabled = false;
    _running = false;
    pluginDebug('runCombinedProbeMode EXIT (finally): _running reset to false');
  }
}

// Best-effort park routine for Combined mode.
// Lifts Z to parkZ (work coords) then rapids to X0 Y0.
// If the Z lift fails, the X/Y move is skipped for safety.
async function _combinedFinalPark() {
  var parkZEl = document.getElementById('combined-park-z');
  var parkZ = (parkZEl && isFinite(Number(parkZEl.value)) && Number(parkZEl.value) > 0) ? Number(parkZEl.value) : 10;
  smLogProbe('COMBINED: parking to Z=' + parkZ + ' then G0 X0 Y0');
  pluginDebug('_combinedFinalPark: parkZ=' + parkZ);
  try {
    await sendCommand('G90 G1 Z' + parkZ.toFixed(3) + ' F8000');
    await waitForIdleWithTimeout();
    smLogProbe('COMBINED: park Z lift done, moving to X0 Y0');
    try {
      await sendCommand('G0 X0 Y0');
      await waitForIdleWithTimeout();
      smLogProbe('COMBINED: park complete — machine at X0 Y0 Z' + parkZ.toFixed(3));
    } catch (xyErr) {
      smLogProbe('COMBINED: park X0 Y0 move failed: ' + (xyErr && xyErr.message ? xyErr.message : String(xyErr)));
      pluginDebug('_combinedFinalPark XY move failed: ' + (xyErr && xyErr.message ? xyErr.message : String(xyErr)));
    }
  } catch (zErr) {
    smLogProbe('COMBINED: park Z lift failed — skipping X/Y move: ' + (zErr && zErr.message ? zErr.message : String(zErr)));
    pluginDebug('_combinedFinalPark Z lift failed: ' + (zErr && zErr.message ? zErr.message : String(zErr)));
  }
}

