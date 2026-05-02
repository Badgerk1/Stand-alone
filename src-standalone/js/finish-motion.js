// ── getMaxMeasuredSurfaceZ: find the highest Z across all probe data sources ───
//
// Returns the maximum measured surface Z value from any available probe data:
//   1. topResults — AUTO TOP-Z phase 0 (face probe) and standalone top probe results
//   2. layeredFaceResults — face probe contacts (highest Z contacts are near-surface)
//   3. faceResults — non-layered face probe contacts
//
// Returns null if no probe data is available.
//
function getMaxMeasuredSurfaceZ() {
  var candidates = [];

  // smMeshData: surface probe mesh grid — primary source for surface probing
  if (typeof smMeshData !== 'undefined' && smMeshData && typeof smGridConfig !== 'undefined' && smGridConfig) {
    for (var ri = 0; ri < smGridConfig.rowCount; ri++) {
      for (var ci = 0; ci < smGridConfig.colCount; ci++) {
        var z = smMeshData[ri] && smMeshData[ri][ci];
        if (z != null && isFinite(z)) candidates.push(z);
      }
    }
  }

  // topResults: AUTO TOP-Z phase 0 (face probe) and standalone surface probe results
  if (typeof topResults !== 'undefined' && Array.isArray(topResults) && topResults.length > 0) {
    topResults.forEach(function(p) { if (p && isFinite(p.z)) candidates.push(p.z); });
  }

  // layeredFaceResults: face probe contacts — highest Z contacts are near-surface
  if (typeof layeredFaceResults !== 'undefined' && Array.isArray(layeredFaceResults) && layeredFaceResults.length > 0) {
    layeredFaceResults.forEach(function(p) { if (p && isFinite(p.z)) candidates.push(p.z); });
  }

  // faceResults: non-layered face probe contacts
  if (typeof faceResults !== 'undefined' && Array.isArray(faceResults) && faceResults.length > 0) {
    faceResults.forEach(function(p) { if (p && isFinite(p.z)) candidates.push(p.z); });
  }

  if (candidates.length === 0) return null;
  return Math.max.apply(null, candidates);
}

// ── finishRunMotion: post-probe retract and home for all run modes ─────────────
//
// Called after every probe run (face, top, etc.) to:
//   1. Raise Z to (maxSurfaceZ + clearanceOffset) above the highest measured surface point
//   2. Optionally return X/Y to the origin (X0 Y0)
//
// Parameters:
//   mode  – string key used for logLine ('face', 'top', etc.)
//
async function finishRunMotion(mode, feedOverride) {
  pluginDebug('finishRunMotion ENTER: mode=' + mode);
  var s = getSettingsFromUI();
  var clearanceOffset = Number(s.finishHomeZ);
  var returnXYZero    = !!s.returnToXYZero;
  var feed            = feedOverride || s.faceRetractFeed || s.travelFeedRate || 600;

  // Guard: clearance offset must be a positive number.
  if (!isFinite(clearanceOffset) || clearanceOffset <= 0) {
    logLine(mode, 'Finish: WARNING — finishHomeZ clearance is ' + clearanceOffset + ' (invalid or non-positive); using safe fallback of 10.0mm clearance.');
    clearanceOffset = 10.0;
  }

  var pos      = await getWorkPosition();
  var currentZ = Number(pos.z);

  // Compute retract Z: highest measured surface + clearance offset.
  // Fall back to currentZ + offset if no probe data is available.
  var maxSurfaceZ = getMaxMeasuredSurfaceZ();
  var finishZ;
  if (maxSurfaceZ !== null) {
    finishZ = maxSurfaceZ + clearanceOffset;
    logLine(mode, 'Finish: highest measured surface Z=' + maxSurfaceZ.toFixed(3) + 'mm, clearance offset=' + clearanceOffset.toFixed(1) + 'mm → retracting to work Z ' + finishZ.toFixed(3));
  } else {
    finishZ = currentZ + clearanceOffset;
    logLine(mode, 'Finish: no surface data available — retracting ' + clearanceOffset.toFixed(1) + 'mm above current Z=' + currentZ.toFixed(3) + ' → work Z ' + finishZ.toFixed(3));
  }

  // Z retract — always use work coordinates (G0 Z{finishZ}), never G53 machine coords.
  // Only move if finishZ is actually higher than the current position.
  var zRetractOk = false;
  if (isFinite(currentZ) && finishZ <= currentZ) {
    logLine(mode, 'Finish: current work Z ' + currentZ.toFixed(3) + ' is already at or above target work Z ' + finishZ.toFixed(3) + '; no Z retract needed');
    zRetractOk = true;
  } else {
    // moveAbs already calls waitForIdleWithTimeout() and returns the position —
    // reuse that instead of issuing a redundant getWorkPosition() HTTP call.
    var retractPos = await moveAbs(null, null, finishZ, feed);
    if (!retractPos) retractPos = await getWorkPosition();
    logLine(mode, 'Finish: after retract X=' + retractPos.x.toFixed(3) + ' Y=' + retractPos.y.toFixed(3) + ' Z=' + retractPos.z.toFixed(3));
    if (Number(retractPos.z) >= finishZ - 0.5) {
      zRetractOk = true;
    } else {
      logLine(mode, 'Finish: ERROR — Z retract did not reach target (got Z=' + Number(retractPos.z).toFixed(3) + ', expected >= ' + (finishZ - 0.5).toFixed(3) + '); aborting XY return to prevent collision');
    }
  }

  if (returnXYZero) {
    if (!zRetractOk) {
      logLine(mode, 'Finish: skipping X/Y return — Z retract did not succeed');
    } else {
      logLine(mode, 'Finish: returning to X0.000 Y0.000');
      // moveAbs already calls waitForIdleWithTimeout() and returns the position —
      // reuse that instead of issuing a redundant getWorkPosition() HTTP call.
      var returnPos = await moveAbs(0, 0, null, feed);
      if (!returnPos) returnPos = await getWorkPosition();
      logLine(mode, 'Finish: after return X=' + returnPos.x.toFixed(3) + ' Y=' + returnPos.y.toFixed(3) + ' Z=' + returnPos.z.toFixed(3));
    }
  } else {
    logLine(mode, 'Finish: X/Y return to home disabled');
  }

  pluginDebug('finishRunMotion EXIT: mode=' + mode);
}
