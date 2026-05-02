// ── Settings: collect, save, load, reset ──────────────────────────────────────
function getSettingsFromUI() {
  function n(id) { var el = document.getElementById(id); return el ? Number(el.value) : 0; }
  function s(id) { var el = document.getElementById(id); return el ? String(el.value) : ''; }
  function b(id) { var el = document.getElementById(id); return el ? el.value === 'yes' : false; }
  function chk(id) { var el = document.getElementById(id); return el ? !!el.checked : false; }
  return {
    // Travel / Recovery
    travelFeedRate:              n('travelFeedRate'),
    travelRecoveryFeedRate:      n('travelRecoveryFeedRate'),
    travelRecoveryLiftFeedRate:  n('travelRecoveryLiftFeedRate'),
    useTravelContactRecovery:    b('useTravelContactRecovery'),
    travelContactStep:           n('travelContactStep'),
    travelContactBackoff:        n('travelContactBackoff'),
    travelContactLift:           n('travelContactLift'),
    travelContactMaxRetries:     n('travelContactMaxRetries'),
    probeFeed:                   n('probeFeed'),
    retractDist:                 n('retractDist'),
    // Finish motion
    finishHomeZ:                 n('finishHomeZ'),
    useMachineHomeRetract:       b('useMachineHomeRetract'),
    machineSafeTopZ:             n('machineSafeTopZ'),
    returnToXYZero:              b('returnToXYZero'),
    // Mesh subdivision
    meshSubdivisionSpacing:      n('meshSubdivisionSpacing'),
    // Top / surface probe
    sampleAxis:                  s('sampleAxis'),
    topFixedCoord:               n('topFixedCoord'),
    topSampleStart:              n('topSampleStart'),
    topSampleEnd:                n('topSampleEnd'),
    topSampleCount:              n('topSampleCount'),
    useInitialClearanceLift:     b('useInitialClearanceLift'),
    topClearZ:                   n('topClearZ'),
    topFeed:                     n('topFeed'),
    topProbeDepth:               n('topProbeDepth'),
    topRetract:                  n('topRetract'),
    // Face probe
    faceFixedCoord:              n('faceFixedCoord'),
    enableLayeredFace:           chk('enableLayeredFace'),
    faceStartOffset:             n('faceStartOffset'),
    faceMaxDepth:                n('faceMaxDepth'),
    faceFeed:                    n('faceFeed'),
    faceRetractFeed:             n('faceRetractFeed'),
    faceDepthBelowSurface:       n('faceDepthBelowSurface'),
    faceProbeDistance:           n('faceProbeDistance'),
    faceLayerCount:              n('faceLayerCount'),
    fpZStepCount:                n('fp-zStepCount'),
    fpZStepSize:                 n('fp-zStepSize'),
    fpXAutoSpacing:              chk('fp-xAutoSpacing'),
    fpXTargetSpacing:            n('fp-xTargetSpacing'),
    fpTopRefMode:                s('fp-topRefMode'),
    // Combined mode
    combinedPhasePause:          n('combined-phase-pause'),
    combinedFinalParkEnabled:    chk('combined-final-park-enabled'),
    combinedParkZ:               n('combined-park-z'),
    // Surface smoothing (OBJ/STL export only)
    surfSmoothPeak:              n('surfSmoothPeak'),
    surfSmoothValley:            n('surfSmoothValley'),
    surfSmoothPasses:            n('surfSmoothPasses'),
    // Seam edge smoothing (face only)
    faceSeamSmooth:              n('faceSeamSmooth'),
    faceWallSmoothPeak:          n('faceWallSmoothPeak'),
    faceWallSmoothValley:        n('faceWallSmoothValley'),
    faceWallSmoothPasses:        n('faceWallSmoothPasses'),
    // Combined smoothing (OBJ/STL export only)
    combinedSurfSmoothPeak:      n('combinedSurfSmoothPeak'),
    combinedSurfSmoothValley:    n('combinedSurfSmoothValley'),
    combinedSurfSmoothPasses:    n('combinedSurfSmoothPasses'),
    combinedFaceWallSmoothPeak:  n('combinedFaceWallSmoothPeak'),
    combinedFaceWallSmoothValley:n('combinedFaceWallSmoothValley'),
    combinedFaceWallSmoothPasses:n('combinedFaceWallSmoothPasses'),
    combinedSeamSmooth:          n('combinedSeamSmooth'),
    // Probe dimensions
    probeShankDiameter:          n('probeShankDiameter'),
    probeBodyDiameter:           n('probeBodyDiameter'),
    probeUpperHeight:            n('probeUpperHeight'),
    probeUpperLength:            n('probeUpperLength'),
    probeMainBodyHeight:         n('probeMainBodyHeight'),
    probeLowerLength:            n('probeLowerLength'),
    probeStylusLength:           n('probeStylusLength'),
    probeStylusCalloutLength:    n('probeStylusCalloutLength'),
    probeBallTipDiameter:        n('probeBallTipDiameter'),
    probeTipBallDiameter:        n('probeTipBallDiameter'),
    probeTotalLength:            n('probeTotalLength'),
    // Jog controls
    jogFeedXY:                   n('jogFeedXY'),
    jogStepZ:                    n('jogStepZ'),
    jogFeedZ:                    n('jogFeedZ'),
    // Probe mode
    probeTypeSelect:             s('probe-type-select'),
    probeFaceAxisSelect:         s('probe-face-axis-select'),
    // Surface export
    surfOBJSubdivision:          n('surfOBJSubdivision'),
    // Face export
    faceTopSurfaceMode:          s('faceTopSurfaceMode'),
    faceOBJSubdivision:          n('faceOBJSubdivision'),
    // Combined export
    combinedBottomZ:             n('combinedBottomZ'),
    combinedOBJSubdivision:      n('combinedOBJSubdivision'),
    // Apply tab — surface compensation
    applyRefZ:                   n('apply-refZ'),
    applySubdivide:              chk('apply-subdivide'),
    // Apply tab — face compensation
    applyFaceRefPos:             n('apply-face-refPos'),
    applyFaceAxis:               s('apply-face-axis'),
    applyFaceUniform:            chk('apply-face-uniform'),
    // Outline tab
    outlineX0:                   n('outlineX0'),
    outlineXLen:                 n('outlineXLen'),
    outlineXCount:               n('outlineXCount'),
    outlineY0:                   n('outlineY0'),
    outlineYLen:                 n('outlineYLen'),
    outlineYCount:               n('outlineYCount'),
    outlineSurfaceZ:             n('outlineSurfaceZ'),
    outlineFaceDepth:            n('outlineFaceDepth'),
    outlineFaceFeed:             n('outlineFaceFeed'),
    outlineRetractAbove:         n('outlineRetractAbove'),
    outlineOvershoot:            n('outlineOvershoot'),
    outlineApproachDist:         n('outlineApproachDist'),
    outlineSafeTravelZ:          n('outlineSafeTravelZ'),
    outlineZStepDepth:           n('outlineZStepDepth'),
    outlineProbeFeed:            n('outlineProbeFeed'),
    outlineFastFeed:             n('outlineFastFeed'),
    outlineRetractFeed:          n('outlineRetractFeed'),
    outlineClearZ:               n('outlineClearZ'),
    outlineProbeDown:            n('outlineProbeDown'),
    outlineSurfRefMaxPlunge:     n('outlineSurfRefMaxPlunge'),
    outlineGridSource:           s('outlineGridSource'),
    outlineGridMargin:           n('outlineGridMargin'),
    outlineGridEdgeMarginMm:     n('outlineGridEdgeMarginMm'),
    outlineGridSamplingMode:     s('outlineGridSamplingMode'),
    outlineGridXCount:           n('outlineGridXCount'),
    outlineGridYCount:           n('outlineGridYCount'),
    outlineSkipSurfaceProbe:     chk('outlineSkipSurfaceProbe'),
    outlineForceRectangle:       chk('outlineForceRectangle'),
    autoHideStatusPanel:         chk('autoHideStatusPanel')
  };
}
function saveSettings() {
  pluginDebug('saveSettings ENTER');
  try {
    var data = getSettingsFromUI();
    localStorage.setItem(SM_SETTINGS_KEY, JSON.stringify(data));
    pluginDebug('saveSettings: saved ' + Object.keys(data).length + ' settings');
    setFooterStatus('Settings saved.', 'good');
    var el = document.getElementById('setup-status');
    if (el) {
      el.textContent = 'Settings saved.';
      el.className = 'status-line good';
      setTimeout(function() { el.textContent = ''; el.className = 'status-line'; }, 2500);
    }
  } catch(e) {
    pluginDebug('saveSettings ERROR: ' + e.message);
    console.error('saveSettings error:', e);
    setFooterStatus('Failed to save settings: ' + e.message, 'bad');
    var el = document.getElementById('setup-status');
    if (el) { el.textContent = 'Save failed: ' + e.message; el.className = 'status-line bad'; }
  }
}
function saveSettingsPartial(keys) {
  pluginDebug('saveSettingsPartial ENTER keys=' + keys.join(','));
  try {
    var stored = {};
    try { var raw = localStorage.getItem(SM_SETTINGS_KEY); if (raw) stored = JSON.parse(raw); } catch(e) {}
    var all = getSettingsFromUI();
    keys.forEach(function(k) { if (k in all) stored[k] = all[k]; });
    localStorage.setItem(SM_SETTINGS_KEY, JSON.stringify(stored));
    pluginDebug('saveSettingsPartial: saved ' + keys.length + ' keys');
    setFooterStatus('Settings saved.', 'good');
  } catch(e) {
    pluginDebug('saveSettingsPartial ERROR: ' + e.message);
    console.error('saveSettingsPartial error:', e);
    setFooterStatus('Failed to save settings: ' + e.message, 'bad');
  }
}
function loadSettings() {
  var raw;
  try { raw = localStorage.getItem(SM_SETTINGS_KEY); } catch(e) { return; }
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch(e) { return; }
  function sv(id, val) { var el = document.getElementById(id); if (el && val != null) el.value = val; }
  function sc(id, val) { var el = document.getElementById(id); if (el) el.checked = !!val; }
  function sb(id, val) { var el = document.getElementById(id); if (el) el.value = (val ? 'yes' : 'no'); }
  // Travel / Recovery
  sv('travelFeedRate',             data.travelFeedRate);
  sv('travelRecoveryFeedRate',     data.travelRecoveryFeedRate);
  sv('travelRecoveryLiftFeedRate', data.travelRecoveryLiftFeedRate);
  sb('useTravelContactRecovery',   data.useTravelContactRecovery);
  sv('travelContactStep',          data.travelContactStep);
  sv('travelContactBackoff',       data.travelContactBackoff);
  sv('travelContactLift',          data.travelContactLift);
  sv('travelContactMaxRetries',    data.travelContactMaxRetries);
  sv('probeFeed',                  data.probeFeed);
  sv('retractDist',                data.retractDist);
  // Finish motion
  sv('finishHomeZ',                data.finishHomeZ);
  sb('useMachineHomeRetract',      data.useMachineHomeRetract);
  sv('machineSafeTopZ',            data.machineSafeTopZ);
  sb('returnToXYZero',             data.returnToXYZero);
  // Mesh subdivision
  sv('meshSubdivisionSpacing',     data.meshSubdivisionSpacing);
  // Top / surface probe
  sv('sampleAxis',                 data.sampleAxis);
  sv('topFixedCoord',              data.topFixedCoord);
  sv('topSampleStart',             data.topSampleStart);
  sv('topSampleEnd',               data.topSampleEnd);
  sv('topSampleCount',             data.topSampleCount);
  sb('useInitialClearanceLift',    data.useInitialClearanceLift);
  sv('topClearZ',                  data.topClearZ);
  sv('topFeed',                    data.topFeed);
  sv('topProbeDepth',              data.topProbeDepth);
  sv('topRetract',                 data.topRetract);
  // Face probe
  sv('faceFixedCoord',             data.faceFixedCoord);
  sc('enableLayeredFace',          data.enableLayeredFace);
  sv('faceStartOffset',            data.faceStartOffset);
  sv('faceMaxDepth',               data.faceMaxDepth);
  sv('faceFeed',                   data.faceFeed);
  sv('faceRetractFeed',            data.faceRetractFeed);
  sv('faceDepthBelowSurface',      data.faceDepthBelowSurface);
  sv('faceProbeDistance',          data.faceProbeDistance);
  sv('faceLayerCount',             data.faceLayerCount);
  sv('fp-zStepCount',              data.fpZStepCount);
  sv('fp-zStepSize',               data.fpZStepSize);
  sc('fp-xAutoSpacing',            data.fpXAutoSpacing);
  sv('fp-xTargetSpacing',          data.fpXTargetSpacing);
  sv('fp-topRefMode',              data.fpTopRefMode);
  try { fpUpdateAutoSpacingUI(); } catch(e) {}
  // Combined mode
  sv('combined-phase-pause',       data.combinedPhasePause);
  sc('combined-final-park-enabled', data.combinedFinalParkEnabled !== false); // default ON
  sv('combined-park-z',            data.combinedParkZ != null ? data.combinedParkZ : 10);
  // Surface smoothing (OBJ/STL export only)
  sv('surfSmoothPeak',             data.surfSmoothPeak);
  sv('surfSmoothValley',           data.surfSmoothValley);
  sv('surfSmoothPasses',           data.surfSmoothPasses);
  // Seam edge smoothing (face only)
  sv('faceSeamSmooth',             data.faceSeamSmooth);
  sv('faceWallSmoothPeak',         data.faceWallSmoothPeak);
  sv('faceWallSmoothValley',       data.faceWallSmoothValley);
  sv('faceWallSmoothPasses',       data.faceWallSmoothPasses);
  // Combined smoothing (OBJ/STL export only)
  sv('combinedSurfSmoothPeak',     data.combinedSurfSmoothPeak);
  sv('combinedSurfSmoothValley',   data.combinedSurfSmoothValley);
  sv('combinedSurfSmoothPasses',   data.combinedSurfSmoothPasses);
  sv('combinedFaceWallSmoothPeak', data.combinedFaceWallSmoothPeak);
  sv('combinedFaceWallSmoothValley', data.combinedFaceWallSmoothValley);
  sv('combinedFaceWallSmoothPasses', data.combinedFaceWallSmoothPasses);
  sv('combinedSeamSmooth',         data.combinedSeamSmooth);
  // Probe dimensions
  sv('probeShankDiameter',         data.probeShankDiameter);
  sv('probeBodyDiameter',          data.probeBodyDiameter);
  sv('probeUpperHeight',           data.probeUpperHeight);
  sv('probeUpperLength',           data.probeUpperLength);
  sv('probeMainBodyHeight',        data.probeMainBodyHeight);
  sv('probeLowerLength',           data.probeLowerLength);
  sv('probeStylusLength',          data.probeStylusLength);
  sv('probeStylusCalloutLength',   data.probeStylusCalloutLength);
  sv('probeBallTipDiameter',       data.probeBallTipDiameter);
  sv('probeTipBallDiameter',       data.probeTipBallDiameter);
  sv('probeTotalLength',           data.probeTotalLength);
  // Jog controls
  if (data.jogFeedXY != null) sv('jogFeedXY', data.jogFeedXY);
  if (data.jogStepZ  != null) sv('jogStepZ',  data.jogStepZ);
  if (data.jogFeedZ  != null) sv('jogFeedZ',  data.jogFeedZ);
  // Probe mode
  if (data.probeTypeSelect     != null) sv('probe-type-select',     data.probeTypeSelect);
  if (data.probeFaceAxisSelect != null) sv('probe-face-axis-select', data.probeFaceAxisSelect);
  // Surface export
  if (data.surfOBJSubdivision  != null) sv('surfOBJSubdivision',  data.surfOBJSubdivision);
  // Face export
  if (data.faceTopSurfaceMode  != null) sv('faceTopSurfaceMode',  data.faceTopSurfaceMode);
  if (data.faceOBJSubdivision  != null) sv('faceOBJSubdivision',  data.faceOBJSubdivision);
  // Combined export
  if (data.combinedBottomZ        != null) sv('combinedBottomZ',       data.combinedBottomZ);
  if (data.combinedOBJSubdivision != null) sv('combinedOBJSubdivision', data.combinedOBJSubdivision);
  // Apply tab — surface compensation
  if (data.applyRefZ    != null) sv('apply-refZ', data.applyRefZ);
  if (data.applySubdivide != null) sc('apply-subdivide', data.applySubdivide);
  // Apply tab — face compensation
  if (data.applyFaceRefPos != null) sv('apply-face-refPos', data.applyFaceRefPos);
  if (data.applyFaceAxis   != null) sv('apply-face-axis',   data.applyFaceAxis);
  if (data.applyFaceUniform != null) sc('apply-face-uniform', data.applyFaceUniform);
  // Outline tab
  if (data.outlineX0          != null) sv('outlineX0',          data.outlineX0);
  if (data.outlineXLen        != null) sv('outlineXLen',        data.outlineXLen);
  // Load xCount; migrate from old xStep if needed
  if (data.outlineXCount      != null) sv('outlineXCount',      Math.max(2, Math.round(data.outlineXCount)));
  else if (data.outlineXStep  != null && data.outlineXLen != null && data.outlineXStep > 0)
    sv('outlineXCount', Math.max(2, Math.round(data.outlineXLen / data.outlineXStep) + 1));
  if (data.outlineY0          != null) sv('outlineY0',          data.outlineY0);
  if (data.outlineYLen        != null) sv('outlineYLen',        data.outlineYLen);
  // Load yCount; migrate from old yStep if needed
  if (data.outlineYCount      != null) sv('outlineYCount',      Math.max(2, Math.round(data.outlineYCount)));
  else if (data.outlineYStep  != null && data.outlineYLen != null && data.outlineYStep > 0)
    sv('outlineYCount', Math.max(2, Math.round(data.outlineYLen / data.outlineYStep) + 1));
  if (data.outlineSurfaceZ    != null) sv('outlineSurfaceZ',    data.outlineSurfaceZ);
  if (data.outlineFaceDepth   != null) sv('outlineFaceDepth',   data.outlineFaceDepth);
  if (data.outlineFaceFeed    != null) sv('outlineFaceFeed',    data.outlineFaceFeed);
  if (data.outlineRetractAbove!= null) sv('outlineRetractAbove',data.outlineRetractAbove);
  if (data.outlineOvershoot   != null) sv('outlineOvershoot',   data.outlineOvershoot);
  if (data.outlineApproachDist!= null) sv('outlineApproachDist',data.outlineApproachDist);
  if (data.outlineSafeTravelZ != null) sv('outlineSafeTravelZ', data.outlineSafeTravelZ);
  if (data.outlineZStepDepth  != null) sv('outlineZStepDepth',  data.outlineZStepDepth);
  if (data.outlineProbeFeed   != null) sv('outlineProbeFeed',   data.outlineProbeFeed);
  if (data.outlineFastFeed    != null) sv('outlineFastFeed',    data.outlineFastFeed);
  if (data.outlineRetractFeed != null) sv('outlineRetractFeed', data.outlineRetractFeed);
  if (data.outlineClearZ      != null) sv('outlineClearZ',      data.outlineClearZ);
  if (data.outlineProbeDown        != null) sv('outlineProbeDown',        data.outlineProbeDown);
  if (data.outlineSurfRefMaxPlunge != null) sv('outlineSurfRefMaxPlunge', data.outlineSurfRefMaxPlunge);
  if (data.outlineGridSource  != null) sv('outlineGridSource',  data.outlineGridSource);
  if (data.outlineGridMargin  != null) sv('outlineGridMargin',  data.outlineGridMargin);
  if (data.outlineGridEdgeMarginMm != null) sv('outlineGridEdgeMarginMm', data.outlineGridEdgeMarginMm);
  if (data.outlineGridSamplingMode != null) sv('outlineGridSamplingMode', data.outlineGridSamplingMode);
  if (data.outlineGridXCount  != null) sv('outlineGridXCount',  Math.max(2, Math.round(data.outlineGridXCount)));
  else if (data.outlineGridXStep != null) sv('outlineGridXCount', 2); // can't reliably migrate without bounds
  if (data.outlineGridYCount  != null) sv('outlineGridYCount',  Math.max(2, Math.round(data.outlineGridYCount)));
  else if (data.outlineGridYStep != null) sv('outlineGridYCount', 2); // can't reliably migrate without bounds
  if (data.outlineSkipSurfaceProbe != null) sc('outlineSkipSurfaceProbe', data.outlineSkipSurfaceProbe);
  if (data.outlineForceRectangle   != null) sc('outlineForceRectangle',   data.outlineForceRectangle);
  if (data.autoHideStatusPanel != null) sc('autoHideStatusPanel', data.autoHideStatusPanel);
  // Trigger dependent previews
  try { refreshFinishBehaviorPreview(); } catch(e) {}
  try { refreshTravelRecoveryPreview(); } catch(e) {}
  try { calcProbeAutoTotalLength(); } catch(e) {}
  try { updateOutlineCountHelpers(); } catch(e) {}
  try { updateOutlineGridCountHelpers(); } catch(e) {}
}
function resetSettings() {
  var defaults = {
    travelFeedRate: 600, travelRecoveryFeedRate: 1500, travelRecoveryLiftFeedRate: 1000,
    useTravelContactRecovery: true, travelContactStep: 5, travelContactBackoff: 5,
    travelContactLift: 5, travelContactMaxRetries: 5,
    probeFeed: 100, retractDist: 2,
    finishHomeZ: 10, useMachineHomeRetract: true, machineSafeTopZ: 0, returnToXYZero: true,
    meshSubdivisionSpacing: 2,
    sampleAxis: 'X', topFixedCoord: 0, topSampleStart: 0, topSampleEnd: 100, topSampleCount: 10,
    useInitialClearanceLift: true, topClearZ: 5, topFeed: 200, topProbeDepth: 5, topRetract: 2,
    faceFixedCoord: 0, enableLayeredFace: false, faceStartOffset: -10, faceMaxDepth: 14.75,
    faceFeed: 150, faceRetractFeed: 1000, faceDepthBelowSurface: 2, faceProbeDistance: 20, faceLayerCount: 3,
    fpZStepCount: 3, fpZStepSize: 1,
    fpXAutoSpacing: false, fpXTargetSpacing: 2, fpTopRefMode: 'all',
    combinedPhasePause: 2000, combinedFinalParkEnabled: true, combinedParkZ: 10,
    surfSmoothPeak: 0, surfSmoothValley: 0, surfSmoothPasses: 1,
    faceSeamSmooth: 0, faceWallSmoothPeak: 0.5, faceWallSmoothValley: 0.5, faceWallSmoothPasses: 3,
    combinedSurfSmoothPeak: 0, combinedSurfSmoothValley: 0, combinedSurfSmoothPasses: 1,
    combinedFaceWallSmoothPeak: 0.5, combinedFaceWallSmoothValley: 0.5, combinedFaceWallSmoothPasses: 3,
    combinedSeamSmooth: 0,
    probeShankDiameter: 6, probeBodyDiameter: 33, probeUpperHeight: 20, probeUpperLength: 20,
    probeMainBodyHeight: 21, probeLowerLength: 21,
    probeStylusLength: 26, probeStylusCalloutLength: 14.75, probeBallTipDiameter: 0, probeTipBallDiameter: 0, probeTotalLength: 67,
    // Jog controls
    jogFeedXY: 600, jogStepZ: 2, jogFeedZ: 300,
    // Probe mode
    probeTypeSelect: '2d-surface', probeFaceAxisSelect: 'Y',
    // Surface export
    surfOBJSubdivision: 0.5,
    // Face export
    faceTopSurfaceMode: 'flat', faceOBJSubdivision: 0.5,
    // Combined export
    combinedBottomZ: -20, combinedOBJSubdivision: 0.5,
    // Apply tab
    applyRefZ: 0, applySubdivide: true, applyFaceRefPos: 0, applyFaceAxis: 'Y', applyFaceUniform: true,
    // Outline tab
    outlineSkipSurfaceProbe: false,
    outlineGridEdgeMarginMm: 2,
    autoHideStatusPanel: false
  };
  function sv(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
  function sc(id, val) { var el = document.getElementById(id); if (el) el.checked = !!val; }
  function sb(id, val) { var el = document.getElementById(id); if (el) el.value = (val ? 'yes' : 'no'); }
  sv('travelFeedRate',             defaults.travelFeedRate);
  sv('travelRecoveryFeedRate',     defaults.travelRecoveryFeedRate);
  sv('travelRecoveryLiftFeedRate', defaults.travelRecoveryLiftFeedRate);
  sb('useTravelContactRecovery',   defaults.useTravelContactRecovery);
  sv('travelContactStep',          defaults.travelContactStep);
  sv('travelContactBackoff',       defaults.travelContactBackoff);
  sv('travelContactLift',          defaults.travelContactLift);
  sv('travelContactMaxRetries',    defaults.travelContactMaxRetries);
  sv('probeFeed',                  defaults.probeFeed);
  sv('retractDist',                defaults.retractDist);
  sv('finishHomeZ',                defaults.finishHomeZ);
  sb('useMachineHomeRetract',      defaults.useMachineHomeRetract);
  sv('machineSafeTopZ',            defaults.machineSafeTopZ);
  sb('returnToXYZero',             defaults.returnToXYZero);
  sv('meshSubdivisionSpacing',     defaults.meshSubdivisionSpacing);
  sv('sampleAxis',                 defaults.sampleAxis);
  sv('topFixedCoord',              defaults.topFixedCoord);
  sv('topSampleStart',             defaults.topSampleStart);
  sv('topSampleEnd',               defaults.topSampleEnd);
  sv('topSampleCount',             defaults.topSampleCount);
  sb('useInitialClearanceLift',    defaults.useInitialClearanceLift);
  sv('topClearZ',                  defaults.topClearZ);
  sv('topFeed',                    defaults.topFeed);
  sv('topProbeDepth',              defaults.topProbeDepth);
  sv('topRetract',                 defaults.topRetract);
  sv('faceFixedCoord',             defaults.faceFixedCoord);
  sc('enableLayeredFace',          defaults.enableLayeredFace);
  sv('faceStartOffset',            defaults.faceStartOffset);
  sv('faceMaxDepth',               defaults.faceMaxDepth);
  sv('faceFeed',                   defaults.faceFeed);
  sv('faceRetractFeed',            defaults.faceRetractFeed);
  sv('faceDepthBelowSurface',      defaults.faceDepthBelowSurface);
  sv('faceProbeDistance',          defaults.faceProbeDistance);
  sv('faceLayerCount',             defaults.faceLayerCount);
  sv('fp-zStepCount',              defaults.fpZStepCount);
  sv('fp-zStepSize',               defaults.fpZStepSize);
  sc('fp-xAutoSpacing',            defaults.fpXAutoSpacing);
  sv('fp-xTargetSpacing',          defaults.fpXTargetSpacing);
  sv('fp-topRefMode',              defaults.fpTopRefMode);
  try { fpUpdateAutoSpacingUI(); } catch(e) {}
  sv('combined-phase-pause',       defaults.combinedPhasePause);
  sc('combined-final-park-enabled', defaults.combinedFinalParkEnabled);
  sv('combined-park-z',            defaults.combinedParkZ);
  sv('probeShankDiameter',         defaults.probeShankDiameter);
  sv('probeBodyDiameter',          defaults.probeBodyDiameter);
  sv('probeUpperHeight',           defaults.probeUpperHeight);
  sv('probeUpperLength',           defaults.probeUpperLength);
  sv('probeMainBodyHeight',        defaults.probeMainBodyHeight);
  sv('probeLowerLength',           defaults.probeLowerLength);
  sv('probeStylusLength',          defaults.probeStylusLength);
  sv('probeStylusCalloutLength',   defaults.probeStylusCalloutLength);
  sv('probeBallTipDiameter',       defaults.probeBallTipDiameter);
  sv('probeTipBallDiameter',       defaults.probeTipBallDiameter);
  sv('probeTotalLength',           defaults.probeTotalLength);
  sv('surfSmoothPeak',             defaults.surfSmoothPeak);
  sv('surfSmoothValley',           defaults.surfSmoothValley);
  sv('surfSmoothPasses',           defaults.surfSmoothPasses);
  sv('faceSeamSmooth',             defaults.faceSeamSmooth);
  sv('faceWallSmoothPeak',         defaults.faceWallSmoothPeak);
  sv('faceWallSmoothValley',       defaults.faceWallSmoothValley);
  sv('faceWallSmoothPasses',       defaults.faceWallSmoothPasses);
  sv('combinedSurfSmoothPeak',     defaults.combinedSurfSmoothPeak);
  sv('combinedSurfSmoothValley',   defaults.combinedSurfSmoothValley);
  sv('combinedSurfSmoothPasses',   defaults.combinedSurfSmoothPasses);
  sv('combinedFaceWallSmoothPeak', defaults.combinedFaceWallSmoothPeak);
  sv('combinedFaceWallSmoothValley', defaults.combinedFaceWallSmoothValley);
  sv('combinedFaceWallSmoothPasses', defaults.combinedFaceWallSmoothPasses);
  sv('combinedSeamSmooth',         defaults.combinedSeamSmooth);
  // Jog controls
  sv('jogFeedXY',                  defaults.jogFeedXY);
  sv('jogStepZ',                   defaults.jogStepZ);
  sv('jogFeedZ',                   defaults.jogFeedZ);
  // Probe mode
  sv('probe-type-select',          defaults.probeTypeSelect);
  sv('probe-face-axis-select',     defaults.probeFaceAxisSelect);
  // Surface export
  sv('surfOBJSubdivision',         defaults.surfOBJSubdivision);
  // Face export
  sv('faceTopSurfaceMode',         defaults.faceTopSurfaceMode);
  sv('faceOBJSubdivision',         defaults.faceOBJSubdivision);
  // Combined export
  sv('combinedBottomZ',            defaults.combinedBottomZ);
  sv('combinedOBJSubdivision',     defaults.combinedOBJSubdivision);
  // Apply tab
  sv('apply-refZ',                 defaults.applyRefZ);
  sc('apply-subdivide',            defaults.applySubdivide);
  sv('apply-face-refPos',          defaults.applyFaceRefPos);
  sv('apply-face-axis',            defaults.applyFaceAxis);
  sc('apply-face-uniform',         defaults.applyFaceUniform);
  // Outline tab
  sc('outlineSkipSurfaceProbe',    defaults.outlineSkipSurfaceProbe);
  sv('outlineGridEdgeMarginMm',    defaults.outlineGridEdgeMarginMm);
  sc('autoHideStatusPanel',        defaults.autoHideStatusPanel);
  try { refreshFinishBehaviorPreview(); } catch(e) {}
  try { refreshTravelRecoveryPreview(); } catch(e) {}
  try { calcProbeAutoTotalLength(); } catch(e) {}
  var el = document.getElementById('setup-status');
  if (el) {
    el.textContent = 'Settings reset to defaults.';
    el.className = 'status-line good';
    setTimeout(function() { el.textContent = ''; el.className = 'status-line'; }, 2500);
  }
}
// ── Live preview helpers ───────────────────────────────────────────────────────
function refreshFinishBehaviorPreview() {
  var el = document.getElementById('finishBehaviorPreview');
  if (!el) return;
  var returnXY = (document.getElementById('returnToXYZero') || {}).value === 'yes';
  var clearanceOffset = Number((document.getElementById('finishHomeZ') || {}).value);
  var parts = [];
  var maxSurfZ = (typeof getMaxMeasuredSurfaceZ === 'function') ? getMaxMeasuredSurfaceZ() : null;
  if (maxSurfZ !== null && isFinite(clearanceOffset)) {
    var retractTo = maxSurfZ + clearanceOffset;
    parts.push('Retract to work Z ' + retractTo.toFixed(3) + ' (' + clearanceOffset.toFixed(1) + 'mm above highest point Z=' + maxSurfZ.toFixed(3) + ')');
  } else {
    parts.push('Retract to [highest measured Z + ' + (isFinite(clearanceOffset) ? clearanceOffset.toFixed(1) : '?') + 'mm clearance]');
  }
  if (returnXY) parts.push('return to X0 Y0');
  el.value = parts.join(', then ');
}
function refreshTravelRecoveryPreview() {
  var el = document.getElementById('travelContactMaxLiftPreview');
  if (!el) return;
  var lift = Math.max(0, Number((document.getElementById('travelContactLift') || {}).value) || 5);
  var maxRetries = Math.max(1, Number((document.getElementById('travelContactMaxRetries') || {}).value) || 5);
  el.value = (lift * maxRetries).toFixed(3);
  var preview = document.getElementById('travelRecoveryPreview');
  if (preview) {
    var useRecovery = (document.getElementById('useTravelContactRecovery') || {}).value === 'yes';
    if (!useRecovery) {
      preview.value = 'Travel contact recovery disabled';
    } else {
      preview.value = 'Recovery: lift ' + lift.toFixed(2) + ' coords, max ' + maxRetries + ' retries (max lift ' + (lift * maxRetries).toFixed(2) + ' coords)';
    }
  }
}
// ── Machine Z shortcut ────────────────────────────────────────────────────────
async function useCurrentZAsFinishHome() {
  try {
    var snap = await getMachineSnapshot();
    var workPos = await getWorkPosition();
    var zEl = document.getElementById('finishHomeZ');
    if (zEl && workPos && isFinite(workPos.z)) {
      var maxSurfZ = (typeof getMaxMeasuredSurfaceZ === 'function') ? getMaxMeasuredSurfaceZ() : null;
      if (maxSurfZ !== null) {
        var clearance = Number(workPos.z) - maxSurfZ;
        zEl.value = clearance.toFixed(3);
        refreshFinishBehaviorPreview();
        setFooterStatus('Clearance set to ' + clearance.toFixed(3) + 'mm above highest surface (current Z=' + Number(workPos.z).toFixed(3) + ', surface=' + maxSurfZ.toFixed(3) + ')', 'good');
      } else {
        zEl.value = Number(workPos.z).toFixed(3);
        refreshFinishBehaviorPreview();
        setFooterStatus('Clearance set to ' + Number(workPos.z).toFixed(3) + 'mm (no surface data yet; jog to desired clearance height first)', 'good');
      }
      updateMachineHelperUI(snap);
    }
  } catch(e) {
    setFooterStatus('Failed to get current Z: ' + e.message, 'bad');
    var el = document.getElementById('setup-status');
    if (el) { el.textContent = 'Error: ' + e.message; el.className = 'status-line bad'; }
  }
}
// ── Settings validation ────────────────────────────────────────────────────────
function validateSettings() {
  var faceStartOffset   = Number((document.getElementById('faceStartOffset')   || {}).value);
  var faceProbeDistance = Number((document.getElementById('faceProbeDistance') || {}).value);
  var faceFeed          = Number((document.getElementById('faceFeed')          || {}).value);
  var travelFeedRate    = Number((document.getElementById('travelFeedRate')    || {}).value);
  if (!isFinite(faceStartOffset)) {
    logLine('face', 'Settings error: invalid Face Start Offset.'); return false;
  }
  if (!isFinite(faceProbeDistance) || faceProbeDistance <= 0) {
    logLine('face', 'Settings error: Face Probe Distance must be > 0.'); return false;
  }
  if (!isFinite(faceFeed) || faceFeed <= 0) {
    logLine('face', 'Settings error: Face Feed must be > 0.'); return false;
  }
  if (!isFinite(travelFeedRate) || travelFeedRate <= 0) {
    logLine('face', 'Settings error: Travel Feed Rate must be > 0.'); return false;
  }
  return true;
}
// ── Probe results persistence ─────────────────────────────────────────────────
var PROBE_RESULTS_KEY = '3dmesh.combined.probe_results';
var _saveProbeResultsTimer = null;
function saveProbeResults() {
  try {
    var data = {
      topResults: topResults,
      faceResults: faceResults,
      layeredFaceResults: layeredFaceResults,
      timestamp: Date.now()
    };
    localStorage.setItem(PROBE_RESULTS_KEY, JSON.stringify(data));
  } catch(e) { console.warn('saveProbeResults error:', e); }
}
function saveProbeResultsThrottled() {
  if (_saveProbeResultsTimer) clearTimeout(_saveProbeResultsTimer);
  _saveProbeResultsTimer = setTimeout(saveProbeResults, 1000);
}
function loadProbeResults() {
  try {
    var raw = localStorage.getItem(PROBE_RESULTS_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (Array.isArray(data.topResults))        topResults        = data.topResults;
    if (Array.isArray(data.faceResults))       faceResults       = data.faceResults;
    if (Array.isArray(data.layeredFaceResults)) layeredFaceResults = data.layeredFaceResults;
    updateAllResultsUI();
  } catch(e) { console.warn('loadProbeResults error:', e); }
}
function clearPersistedProbeResults() {
  if (_saveProbeResultsTimer) { clearTimeout(_saveProbeResultsTimer); _saveProbeResultsTimer = null; }
  try { localStorage.removeItem(PROBE_RESULTS_KEY); } catch(e) {}
}
// ── Results UI helpers ────────────────────────────────────────────────────────
function updateAllResultsUI() {
  try { populateSurfaceResults(); }    catch(e) {}
  try { populateUnifiedProbeTable(); } catch(e) {}
  try { updateFaceMeshDataUI(); }      catch(e) {}
  try { updateEdgeProbeStorageUI(); }  catch(e) {}
}
function updateEdgeProbeStorageUI() {
  var el = document.getElementById('edge-probe-results-summary');
  if (!el) return;
  var topCount     = topResults     ? topResults.length     : 0;
  var faceCount    = faceResults    ? faceResults.length    : 0;
  var layeredCount = layeredFaceResults ? layeredFaceResults.length : 0;
  if (topCount === 0 && faceCount === 0 && layeredCount === 0) { el.innerHTML = ''; return; }
  var parts = [];
  if (topCount)     parts.push(topCount     + ' top point'          + (topCount     !== 1 ? 's' : ''));
  if (layeredCount) parts.push(layeredCount + ' layered face point' + (layeredCount !== 1 ? 's' : ''));
  else if (faceCount) parts.push(faceCount  + ' face point'        + (faceCount    !== 1 ? 's' : ''));
  el.innerHTML = '<span style="color:var(--muted);font-size:11px">In memory: ' + parts.join(', ') + '</span>';
}
// ── Clear all results ─────────────────────────────────────────────────────────
function clearAllResults() {
  pluginDebug('clearAllResults ENTER');
  if (!confirm('Clear all probe results and mesh data? This cannot be undone.')) { pluginDebug('clearAllResults: cancelled by user'); return; }
  topResults        = [];
  faceResults       = [];
  layeredFaceResults = [];
  // Also clear surface mesh data so the Probe Data table and relief maps blank out
  smMeshData   = null;
  smGridConfig = null;
  clearPersistedProbeResults();
  updateAllResultsUI();
  // Clear all visualization canvases
  try { clearAllVisuals(); } catch(e) {}
  // Re-render relief maps (now with no data they will blank the canvases)
  try { renderSurfaceReliefMap(); } catch(e) {}
  try { renderFaceReliefMap(); }    catch(e) {}
  try { updateSurfaceMeshUI(); }    catch(e) {}
  setFooterStatus('All probe results cleared.', 'good');
  pluginDebug('clearAllResults: done');
}
// ── Export results as unified CSV ─────────────────────────────────────────────
function exportCSV() {
  pluginDebug('exportCSV ENTER');
  var allData = [];
  if (smMeshData && smGridConfig) {
    var cfg = smGridConfig;
    for (var ri = 0; ri < cfg.rowCount; ri++) {
      for (var ci = 0; ci < cfg.colCount; ci++) {
        var z = smMeshData[ri][ci];
        if (z != null) {
          allData.push({
            x: cfg.minX + ci * cfg.colSpacing,
            y: cfg.minY + ri * cfg.rowSpacing,
            z: z, machineZ: null, type: 'Surface'
          });
        }
      }
    }
  }
  var faceData = getFaceMeshData();
  if (faceData) {
    faceData.forEach(function(p) {
      allData.push({ x: p.x, y: p.y, z: p.z, machineZ: p.machineZ, type: 'Face' });
    });
  }
  if (!allData.length) { pluginDebug('exportCSV: no data to export'); alert('No probe data to export. Run a probe first.'); return; }
  var rows = ['# Plugin Version: ' + SM_VERSION, 'Index,X,Y,Z,Machine Z,Type'];
  allData.forEach(function(p, i) {
    rows.push((i + 1) + ',' + Number(p.x).toFixed(3) + ',' + Number(p.y).toFixed(3) + ',' +
      Number(p.z).toFixed(3) + ',' + (p.machineZ != null ? Number(p.machineZ).toFixed(3) : '') + ',' + p.type);
  });
  var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'probe_results_' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  pluginDebug('exportCSV: exported ' + allData.length + ' points');
  setFooterStatus('Exported ' + allData.length + ' points to CSV.', 'good');
}
// Alias: face CSV export uses existing implementation
function exportFaceCSV() { pluginDebug('exportFaceCSV called'); exportFaceMeshCSVNew(); }
// ── DXF helpers ───────────────────────────────────────────────────────────────
function _dxfHeader() {
  return '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
}
function _dxfFooter() { return '0\nENDSEC\n0\nEOF\n'; }
function _dxf3DPolyline(pts) {
  var s = '0\nPOLYLINE\n66\n1\n70\n8\n';
  pts.forEach(function(p) {
    s += '0\nVERTEX\n10\n' + Number(p.x).toFixed(4) + '\n20\n' + Number(p.y).toFixed(4) + '\n30\n' + Number(p.z).toFixed(4) + '\n70\n32\n';
  });
  s += '0\nSEQEND\n';
  return s;
}
function _dxfDownload(content, filename) {
  var blob = new Blob([content], { type: 'application/dxf' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  a.click(); URL.revokeObjectURL(a.href);
}
// ── OBJ helpers ───────────────────────────────────────────────────────────────
function _objDownload(content, filename) {
  var blob = new Blob([content], { type: 'model/obj' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  a.click(); URL.revokeObjectURL(a.href);
}
// ── Binary STL helper ─────────────────────────────────────────────────────────
// Writes a binary STL file (80-byte header + 4-byte tri count + 50 bytes/tri).
// verts: [{x,y,z}, ...], tris: [[i0,i1,i2], ...]
// Per-triangle normals are the area-weighted average of their three vertex normals
// (each vertex normal = sum of unnormalised cross-products of all adjacent faces),
// matching Three.js BufferGeometry.computeVertexNormals() so Aspire renders the
// imported mesh smooth — no crease lines at cell boundaries.
function _stlDownload(verts, tris, filename) {
  if (!tris.length) return;
  var nV = verts.length, nT = tris.length;
  // ── Step 1: accumulate area-weighted face normals into per-vertex buckets ──
  var vnx = new Float64Array(nV), vny = new Float64Array(nV), vnz = new Float64Array(nV);
  for (var i = 0; i < nT; i++) {
    var v0=verts[tris[i][0]], v1=verts[tris[i][1]], v2=verts[tris[i][2]];
    var e1x=v1.x-v0.x, e1y=v1.y-v0.y, e1z=v1.z-v0.z;
    var e2x=v2.x-v0.x, e2y=v2.y-v0.y, e2z=v2.z-v0.z;
    // Cross product (unnormalised magnitude ∝ triangle area — area weighting is free)
    var nx=e1y*e2z-e1z*e2y, ny=e1z*e2x-e1x*e2z, nz=e1x*e2y-e1y*e2x;
    vnx[tris[i][0]]+=nx; vny[tris[i][0]]+=ny; vnz[tris[i][0]]+=nz;
    vnx[tris[i][1]]+=nx; vny[tris[i][1]]+=ny; vnz[tris[i][1]]+=nz;
    vnx[tris[i][2]]+=nx; vny[tris[i][2]]+=ny; vnz[tris[i][2]]+=nz;
  }
  // ── Step 2: normalise per-vertex normals ──────────────────────────────────
  for (var vi = 0; vi < nV; vi++) {
    var nl=Math.sqrt(vnx[vi]*vnx[vi]+vny[vi]*vny[vi]+vnz[vi]*vnz[vi]);
    if (nl > 1e-10) { vnx[vi]/=nl; vny[vi]/=nl; vnz[vi]/=nl; }
    else { vnx[vi]=0; vny[vi]=0; vnz[vi]=1; }
  }
  // ── Step 3: write binary STL ─────────────────────────────────────────────
  var buf = new ArrayBuffer(84 + 50 * nT);
  var view = new DataView(buf);
  // 80-byte ASCII header
  var hdr = '3D Live Edge Mesh — binary STL export';
  for (var h = 0; h < 80; h++) view.setUint8(h, h < hdr.length ? hdr.charCodeAt(h) : 0);
  view.setUint32(80, nT, true);
  var off = 84;
  for (var i = 0; i < nT; i++) {
    var i0=tris[i][0], i1=tris[i][1], i2=tris[i][2];
    var v0=verts[i0], v1=verts[i1], v2=verts[i2];
    // Smooth face normal = normalised average of the three corner vertex normals
    var snx=vnx[i0]+vnx[i1]+vnx[i2], sny=vny[i0]+vny[i1]+vny[i2], snz=vnz[i0]+vnz[i1]+vnz[i2];
    var snl=Math.sqrt(snx*snx+sny*sny+snz*snz);
    if (snl > 1e-10) { snx/=snl; sny/=snl; snz/=snl; } else { snx=0; sny=0; snz=1; }
    view.setFloat32(off, snx, true); off+=4;
    view.setFloat32(off, sny, true); off+=4;
    view.setFloat32(off, snz, true); off+=4;
    view.setFloat32(off, v0.x, true); off+=4;
    view.setFloat32(off, v0.y, true); off+=4;
    view.setFloat32(off, v0.z, true); off+=4;
    view.setFloat32(off, v1.x, true); off+=4;
    view.setFloat32(off, v1.y, true); off+=4;
    view.setFloat32(off, v1.z, true); off+=4;
    view.setFloat32(off, v2.x, true); off+=4;
    view.setFloat32(off, v2.y, true); off+=4;
    view.setFloat32(off, v2.z, true); off+=4;
    view.setUint16(off, 0, true); off+=2;
  }
  var blob = new Blob([buf], { type: 'model/stl' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  a.click(); URL.revokeObjectURL(a.href);
}
// ── Bowyer-Watson Delaunay triangulation ─────────────────────────────────────
// pts2d: [{x,y}, ...] — returns [[i0,i1,i2], ...] CCW triangles (indices into pts2d)
function _delaunayTriangulate(pts2d) {
  var n = pts2d.length;
  if (n < 3) return [];
  var minX = pts2d[0].x, maxX = pts2d[0].x, minY = pts2d[0].y, maxY = pts2d[0].y;
  for (var i = 1; i < n; i++) {
    if (pts2d[i].x < minX) minX = pts2d[i].x;
    if (pts2d[i].x > maxX) maxX = pts2d[i].x;
    if (pts2d[i].y < minY) minY = pts2d[i].y;
    if (pts2d[i].y > maxY) maxY = pts2d[i].y;
  }
  var sz = Math.max(maxX - minX, maxY - minY, 1) * 20;
  var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  var coords = pts2d.slice();
  coords.push({x: cx,      y: cy + sz});   // super-triangle vertex n
  coords.push({x: cx - sz, y: cy - sz});   // super-triangle vertex n+1
  coords.push({x: cx + sz, y: cy - sz});   // super-triangle vertex n+2
  var tris = [[n, n + 1, n + 2]];
  for (var pi = 0; pi < n; pi++) {
    var px = coords[pi].x, py = coords[pi].y;
    var bad = [];
    for (var ti = 0; ti < tris.length; ti++) {
      var t = tris[ti];
      var a = coords[t[0]], b = coords[t[1]], c = coords[t[2]];
      var adx=a.x-px, ady=a.y-py, bdx=b.x-px, bdy=b.y-py, cdx=c.x-px, cdy=c.y-py;
      if ((adx*adx+ady*ady)*(bdx*cdy-bdy*cdx)
        - (bdx*bdx+bdy*bdy)*(adx*cdy-ady*cdx)
        + (cdx*cdx+cdy*cdy)*(adx*bdy-ady*bdx) > 0) bad.push(ti);
    }
    var boundary = [];
    for (var bi = 0; bi < bad.length; bi++) {
      var T = tris[bad[bi]];
      var edges = [[T[0],T[1]],[T[1],T[2]],[T[2],T[0]]];
      for (var ei = 0; ei < 3; ei++) {
        var e = edges[ei];
        var shared = false;
        for (var bj = 0; bj < bad.length && !shared; bj++) {
          if (bj === bi) continue;
          var T2 = tris[bad[bj]];
          if ((T2[0]===e[0]||T2[1]===e[0]||T2[2]===e[0]) &&
              (T2[0]===e[1]||T2[1]===e[1]||T2[2]===e[1])) shared = true;
        }
        if (!shared) boundary.push(e);
      }
    }
    bad.sort(function(a,b){return b-a;});
    for (var di = 0; di < bad.length; di++) tris.splice(bad[di], 1);
    for (var fi = 0; fi < boundary.length; fi++) tris.push([boundary[fi][0], boundary[fi][1], pi]);
  }
  return tris.filter(function(t) { return t[0] < n && t[1] < n && t[2] < n; });
}
// ── Seam-edge vertex welding ──────────────────────────────────────────────────
// Merges vertices in `edgeB` (array of global vertex indices, may contain nulls)
// into the nearest vertex of `edgeA` (same format) matched by closest X value.
// For each matched pair the vertex position in `allVerts` is averaged so the
// seam sits at the best-estimate of the true physical edge.  All references to
// the edgeB vertex inside `trisToRemap` are replaced with the edgeA vertex index.
// Returns the remapped copy of `trisToRemap`; `allVerts` is mutated in place.
function _weldSeamEdge(allVerts, trisToRemap, edgeA, edgeB) {
  var remap = {};
  for (var bi = 0; bi < edgeB.length; bi++) {
    var bIdx = edgeB[bi];
    if (bIdx == null) continue;
    var bv = allVerts[bIdx];
    var bestAIdx = -1, bestDX = Infinity;
    for (var ai = 0; ai < edgeA.length; ai++) {
      var aIdx = edgeA[ai];
      if (aIdx == null) continue;
      var dx = Math.abs(allVerts[aIdx].x - bv.x);
      if (dx < bestDX) { bestDX = dx; bestAIdx = aIdx; }
    }
    if (bestAIdx === -1) continue;
    // Average position so neither probe's measurement dominates.
    var av = allVerts[bestAIdx];
    allVerts[bestAIdx] = {
      x: (av.x + bv.x) * 0.5,
      y: (av.y + bv.y) * 0.5,
      z: (av.z + bv.z) * 0.5
    };
    remap[bIdx] = bestAIdx;
  }
  if (Object.keys(remap).length === 0) return trisToRemap;
  return trisToRemap.map(function(t) {
    return [
      remap[t[0]] !== undefined ? remap[t[0]] : t[0],
      remap[t[1]] !== undefined ? remap[t[1]] : t[1],
      remap[t[2]] !== undefined ? remap[t[2]] : t[2]
    ];
  });
}
// ── Seam-edge row smoothing ───────────────────────────────────────────────────
// Blends the Z values of one edge row of an upsampled surface grid toward the
// local neighborhood average (inward row + left/right lateral neighbours).
// This automatically corrects both peaks and valleys at the seam edge — no
// manual +/− needed.
//
// grid[ri][ci]  = Z value (number|null)
// seamRowIdx    = 0 (front seam) or rowCount-1 (back seam)
// blendFactor   = 0 (no change) … 1 (full replacement with neighbour average)
function _smoothSeamEdgeRow(grid, rowCount, colCount, seamRowIdx, blendFactor) {
  if (!blendFactor || blendFactor <= 0 || rowCount < 2 || colCount < 1) return;
  var bf = Math.min(1, Math.max(0, blendFactor));
  var inwardRow = seamRowIdx === 0 ? 1 : rowCount - 2;
  for (var ci = 0; ci < colCount; ci++) {
    var cur = grid[seamRowIdx][ci];
    if (cur == null || !isFinite(cur)) continue;
    var inner = grid[inwardRow][ci];
    if (inner == null || !isFinite(inner)) continue;
    var sum = inner, cnt = 1;
    var lv = ci > 0 ? grid[seamRowIdx][ci - 1] : null;
    var rv = ci < colCount - 1 ? grid[seamRowIdx][ci + 1] : null;
    if (lv != null && isFinite(lv)) { sum += lv; cnt++; }
    if (rv != null && isFinite(rv)) { sum += rv; cnt++; }
    grid[seamRowIdx][ci] = cur * (1 - bf) + (sum / cnt) * bf;
  }
}
// ── Surface grid smoothing ────────────────────────────────────────────────────
// Multi-pass neighbourhood-average smoothing applied to a Z-value surface grid.
// peakFactor   applies when the Z value is ABOVE the neighbourhood average (peaks).
// valleyFactor applies when the Z value is BELOW the neighbourhood average (valleys).
// passes       number of full smoothing iterations (1–10).
// grid[ri][ci] = Z value (number|null); mutated in place.
function _smoothSurfaceGrid(grid, rowCount, colCount, peakFactor, valleyFactor, passes) {
  var pfClamp = Math.min(1, Math.max(0, peakFactor || 0));
  var vfClamp = Math.min(1, Math.max(0, valleyFactor || 0));
  if (pfClamp === 0 && vfClamp === 0) return;
  var numPasses = Math.max(1, Math.min(10, Math.round(passes) || 1));
  for (var p = 0; p < numPasses; p++) {
    // Snapshot current Z values before this pass.
    var origZ = [];
    for (var ri = 0; ri < rowCount; ri++) {
      origZ.push([]);
      for (var ci = 0; ci < colCount; ci++) {
        origZ[ri].push(grid[ri] ? grid[ri][ci] : null);
      }
    }
    // Apply neighbourhood blend using only snapshot values.
    for (var ri2 = 0; ri2 < rowCount; ri2++) {
      for (var ci2 = 0; ci2 < colCount; ci2++) {
        var orig = origZ[ri2][ci2];
        if (orig == null || !isFinite(orig)) continue;
        var sum = orig, cnt = 1;
        if (ri2 > 0 && origZ[ri2-1][ci2] != null) { sum += origZ[ri2-1][ci2]; cnt++; }
        if (ri2 < rowCount-1 && origZ[ri2+1][ci2] != null) { sum += origZ[ri2+1][ci2]; cnt++; }
        if (ci2 > 0 && origZ[ri2][ci2-1] != null) { sum += origZ[ri2][ci2-1]; cnt++; }
        if (ci2 < colCount-1 && origZ[ri2][ci2+1] != null) { sum += origZ[ri2][ci2+1]; cnt++; }
        var avg = sum / cnt;
        var bf = orig > avg ? pfClamp : (orig < avg ? vfClamp : 0);
        if (bf > 0) grid[ri2][ci2] = orig * (1 - bf) + avg * bf;
      }
    }
  }
}
// Blends the Y (contact-depth) values of the top row of an upsampled face wall
// toward the local neighbourhood average.  Works on the result object returned
// by _upsampleFaceData; the top row (rowCount-1) is the seam edge.
function _smoothFaceSeamRow(up, blendFactor) {
  if (!blendFactor || blendFactor <= 0 || !up.vMap || up.rowCount < 2) return;
  var bf = Math.min(1, Math.max(0, blendFactor));
  var topRow = up.rowCount - 1;
  var innerRow = topRow - 1;
  for (var ci = 0; ci < up.colCount; ci++) {
    var idx = up.vMap[topRow][ci];
    if (idx == null) continue;
    var innerIdx = up.vMap[innerRow][ci];
    if (innerIdx == null) continue;
    var sum = up.pts[innerIdx].y, cnt = 1;
    var li = ci > 0 ? up.vMap[topRow][ci - 1] : null;
    var ri = ci < up.colCount - 1 ? up.vMap[topRow][ci + 1] : null;
    if (li != null) { sum += up.pts[li].y; cnt++; }
    if (ri != null) { sum += up.pts[ri].y; cnt++; }
    up.pts[idx].y = up.pts[idx].y * (1 - bf) + (sum / cnt) * bf;
  }
}
// Blends the Y (contact-depth) values of EVERY row of an upsampled face wall
// toward the local 2-D neighbourhood average (above/below + left/right).
// peakFactor   applies when the original Y is BELOW the average (protrusion / peak).
// valleyFactor applies when the original Y is ABOVE the average (recession / valley).
// Using separate factors lets you independently soften peaks vs valleys.
// Works on the result object returned by _upsampleFaceData.
function _smoothFaceWallRows(up, peakFactor, valleyFactor) {
  var pfClamp = Math.min(1, Math.max(0, peakFactor || 0));
  var vfClamp = Math.min(1, Math.max(0, valleyFactor || 0));
  if (pfClamp === 0 && vfClamp === 0) return;
  if (!up.vMap || up.rowCount < 2) return;
  // Snapshot all original Y values before any modification.
  var origY = [];
  for (var ri = 0; ri < up.rowCount; ri++) {
    var row = [];
    for (var ci = 0; ci < up.colCount; ci++) {
      var idx = up.vMap[ri][ci];
      row.push(idx != null ? up.pts[idx].y : null);
    }
    origY.push(row);
  }
  // Apply neighbourhood blend using only original values, with separate peak/valley factor.
  for (var ri2 = 0; ri2 < up.rowCount; ri2++) {
    for (var ci2 = 0; ci2 < up.colCount; ci2++) {
      var idx2 = up.vMap[ri2][ci2];
      if (idx2 == null || origY[ri2][ci2] == null) continue;
      var sum = origY[ri2][ci2], cnt = 1;
      if (ri2 > 0 && origY[ri2-1][ci2] != null) { sum += origY[ri2-1][ci2]; cnt++; }
      if (ri2 < up.rowCount-1 && origY[ri2+1][ci2] != null) { sum += origY[ri2+1][ci2]; cnt++; }
      if (ci2 > 0 && origY[ri2][ci2-1] != null) { sum += origY[ri2][ci2-1]; cnt++; }
      if (ci2 < up.colCount-1 && origY[ri2][ci2+1] != null) { sum += origY[ri2][ci2+1]; cnt++; }
      var avg = sum / cnt;
      var orig = origY[ri2][ci2];
      // Peak: Y below average (probe contacted sooner = protrusion); Valley: Y above average.
      var bf = orig < avg ? pfClamp : (orig > avg ? vfClamp : 0);
      if (bf > 0) up.pts[idx2].y = orig * (1 - bf) + avg * bf;
    }
  }
}
// ── Smooth per-vertex normals ─────────────────────────────────────────────────
// verts: [{x,y,z}, ...], tris: [[i0,i1,i2], ...] — returns [{x,y,z}, ...] normalised
function _computeVertexNormals(verts, tris) {
  var norms = verts.map(function() { return {x:0, y:0, z:0}; });
  for (var ti = 0; ti < tris.length; ti++) {
    var t = tris[ti];
    var v0=verts[t[0]], v1=verts[t[1]], v2=verts[t[2]];
    var e1x=v1.x-v0.x, e1y=v1.y-v0.y, e1z=v1.z-v0.z;
    var e2x=v2.x-v0.x, e2y=v2.y-v0.y, e2z=v2.z-v0.z;
    var nx=e1y*e2z-e1z*e2y, ny=e1z*e2x-e1x*e2z, nz=e1x*e2y-e1y*e2x;
    for (var vi = 0; vi < 3; vi++) { norms[t[vi]].x+=nx; norms[t[vi]].y+=ny; norms[t[vi]].z+=nz; }
  }
  for (var i = 0; i < norms.length; i++) {
    var n=norms[i], len=Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z);
    if (len > 1e-10) { n.x/=len; n.y/=len; n.z/=len; } else { n.x=0; n.y=0; n.z=1; }
  }
  return norms;
}
// ── Natural cubic spline helpers for C2-smooth OBJ/STL export ────────────────
// These replace the former Catmull-Rom (C1) upsampler. A natural cubic spline
// is globally optimal (minimum bending energy) and gives C2 continuity — both
// the first AND second derivatives match at every probe point — producing
// visibly smoother surfaces than Catmull-Rom's C1 result.

// Thomas algorithm: O(n) solver for a tridiagonal system  A·x = rhs.
// sub[i], diag[i], sup[i] are the three diagonals (sub[0] and sup[n-1] unused).
function _solveTridiagonal(sub, diag, sup, rhs) {
  var n = rhs.length;
  if (n === 0) return [];
  var cp = new Array(n), dp = new Array(n), x = new Array(n);
  cp[0] = sup[0] / diag[0];
  dp[0] = rhs[0] / diag[0];
  for (var i = 1; i < n; i++) {
    var denom = diag[i] - sub[i] * cp[i - 1];
    if (Math.abs(denom) < 1e-15) return null; // singular — shouldn't happen for spline matrices
    cp[i] = (i < n - 1) ? sup[i] / denom : 0;
    dp[i] = (rhs[i] - sub[i] * dp[i - 1]) / denom;
  }
  x[n - 1] = dp[n - 1];
  for (var j = n - 2; j >= 0; j--) x[j] = dp[j] - cp[j] * x[j + 1];
  return x;
}
// Compute natural cubic spline second-derivative coefficients M[0..n-1].
// Natural boundary conditions: M[0] = M[n-1] = 0 (zero curvature at endpoints).
// Spacing between adjacent indices is 1 (parametric/index space).
// ys must be an array of n finite numbers (no nulls).
function _natCubicM(ys) {
  var n = ys.length;
  var M = new Array(n);
  for (var k = 0; k < n; k++) M[k] = 0;
  if (n < 3) return M;
  var ni = n - 2; // number of interior knots
  var sub = new Array(ni), diag = new Array(ni), sup = new Array(ni), rhs = new Array(ni);
  for (var i = 0; i < ni; i++) {
    sub[i] = 1; diag[i] = 4; sup[i] = 1;
    rhs[i] = 6 * (ys[i] - 2 * ys[i + 1] + ys[i + 2]);
  }
  sub[0] = 0; sup[ni - 1] = 0;
  var sol = _solveTridiagonal(sub, diag, sup, rhs);
  if (sol) for (var j = 0; j < ni; j++) M[j + 1] = sol[j];
  return M;
}
// Evaluate the natural cubic spline between indices i and i+1 at parameter t∈[0,1].
// ys and M are the value and second-derivative arrays from _natCubicM.
// Formula (uniform spacing h=1):  S = y[i]·(1-t) + y[i+1]·t - t·(1-t)/6·(M[i]·(2-t) + M[i+1]·(1+t))
function _cubicSplineEval(ys, M, i, t) {
  return ys[i] * (1 - t) + ys[i + 1] * t - t * (1 - t) / 6 * (M[i] * (2 - t) + M[i + 1] * (1 + t));
}
// Replace nulls in an array with the nearest non-null neighbour (forward then backward pass).
// Any element that remains null after both passes (all-null array) is set to 0.
function _clampNulls(arr) {
  var n = arr.length, out = arr.slice();
  var last = null;
  for (var i = 0; i < n; i++) { if (out[i] != null) last = out[i]; else if (last != null) out[i] = last; }
  last = null;
  for (var j = n - 1; j >= 0; j--) { if (out[j] != null) last = out[j]; else if (last != null) out[j] = last; }
  for (var k = 0; k < n; k++) if (out[k] == null) out[k] = 0;
  return out;
}
// ── C2 bicubic natural-cubic-spline grid upsampling for OBJ/STL export ────────
// Replaces the former Catmull-Rom (_bicubicUpsampleGrid).  Uses the globally-
// optimal natural cubic spline in both X and Y directions (separable bicubic).
//
// grid[ri][ci]  = Z value (number | null for missing contacts)
// cfg           = { rowCount, colCount, colSpacing, rowSpacing, minX, minY }
// targetSpacing = desired output vertex spacing in mm (e.g. 0.5)
// Returns an object with the same shape as cfg plus the upsampled grid.
function _cubicSplineUpsampleGrid(grid, cfg, targetSpacing) {
  var nR = cfg.rowCount, nC = cfg.colCount;
  if (nR < 2 || nC < 2) {
    return { grid: grid, rowCount: nR, colCount: nC,
             colSpacing: cfg.colSpacing, rowSpacing: cfg.rowSpacing,
             minX: cfg.minX, minY: cfg.minY };
  }
  var sp = Math.max(targetSpacing, 0.5);
  var subC = Math.max(1, Math.round(cfg.colSpacing / sp));
  var subR = Math.max(1, Math.round(cfg.rowSpacing / sp));
  // Safety cap: keep output under ~200 k vertices to avoid browser hangs.
  var nCX = nC - 1, nCY = nR - 1;
  var maxSub = Math.max(1, Math.floor(Math.sqrt(200000 / Math.max(nCX * nCY, 1))));
  subC = Math.min(subC, maxSub);
  subR = Math.min(subR, maxSub);
  if (subC <= 1 && subR <= 1) {
    return { grid: grid, rowCount: nR, colCount: nC,
             colSpacing: cfg.colSpacing, rowSpacing: cfg.rowSpacing,
             minX: cfg.minX, minY: cfg.minY };
  }
  // Helper: return value at (r,c) clamped to grid bounds; null if value is null/non-finite.
  function gZ(r, c) {
    var v = grid[Math.max(0, Math.min(nR - 1, r))][Math.max(0, Math.min(nC - 1, c))];
    return (v != null && isFinite(v)) ? v : null;
  }
  // Pre-compute per-row cubic spline M arrays and clamped value arrays.
  var rowClamped = [], rowM = [];
  for (var r = 0; r < nR; r++) {
    var rawRow = [];
    for (var c = 0; c < nC; c++) rawRow.push(gZ(r, c));
    var cr = _clampNulls(rawRow);
    rowClamped.push(cr);
    rowM.push(_natCubicM(cr));
  }
  // Pass 1 – X direction: build intermediate grid [nR × totalCols].
  // Each cell is null if either endpoint in the original row is null.
  var totalCols = nCX * subC + 1, totalRows = nCY * subR + 1;
  var interGrid = [];
  for (var r2 = 0; r2 < nR; r2++) {
    var irow = [];
    for (var gx = 0; gx < totalCols; gx++) {
      var cx = Math.min(Math.floor(gx / subC), nCX - 1);
      var tx = (gx - cx * subC) / subC;
      if (gZ(r2, cx) === null || gZ(r2, cx + 1) === null) { irow.push(null); }
      else { irow.push(_cubicSplineEval(rowClamped[r2], rowM[r2], cx, tx)); }
    }
    interGrid.push(irow);
  }
  // Pass 2 – Y direction: for each upsampled column, fit a cubic spline across rows.
  var newGrid = [];
  for (var gy = 0; gy < totalRows; gy++) newGrid.push(new Array(totalCols).fill(null));
  for (var gx2 = 0; gx2 < totalCols; gx2++) {
    var colOrig = [];
    for (var r3 = 0; r3 < nR; r3++) colOrig.push(interGrid[r3][gx2]);
    var colClamped = _clampNulls(colOrig);
    var colM = _natCubicM(colClamped);
    for (var gy2 = 0; gy2 < totalRows; gy2++) {
      var cy = Math.min(Math.floor(gy2 / subR), nCY - 1);
      var ty = (gy2 - cy * subR) / subR;
      if (colOrig[cy] === null || colOrig[cy + 1] === null) { newGrid[gy2][gx2] = null; }
      else { newGrid[gy2][gx2] = _cubicSplineEval(colClamped, colM, cy, ty); }
    }
  }
  return {
    grid: newGrid,
    rowCount: totalRows, colCount: totalCols,
    colSpacing: cfg.colSpacing / subC, rowSpacing: cfg.rowSpacing / subR,
    minX: cfg.minX, minY: cfg.minY
  };
}
// ── Face probe structured-grid upsampling ────────────────────────────────────
// Face probe data is a structured grid: nLayers × nSamples, where each point
// has (x = sample X, z = layer Z height, y = contact depth).
// This helper builds that grid, upsamples it with _cubicSplineUpsampleGrid, and
// returns both a flat vertex list and a vMap suitable for structured triangulation.
//
// data:          [{x, y, z, ...}, ...]   (raw face probe results)
// targetSpacing: desired vertex spacing in mm
// Returns:  { pts: [{x,y,z},...], vMap: [[idx|null,...], ...], rowCount, colCount }
function _upsampleFaceData(data, targetSpacing) {
  if (!data || data.length < 4) {
    return { pts: data.map(function(p){ return {x:Number(p.x),y:Number(p.y),z:Number(p.z)}; }), vMap: null, rowCount: 0, colCount: 0 };
  }
  // Collect unique (X, Z-layer) coordinates using 6-decimal keys.
  var xSet = {}, zSet = {};
  data.forEach(function(p) {
    xSet[Number(p.x).toFixed(6)] = Number(p.x);
    zSet[Number(p.z).toFixed(6)] = Number(p.z);
  });
  var xVals = Object.keys(xSet).map(function(k){ return xSet[k]; }).sort(function(a,b){return a-b;});
  var zVals = Object.keys(zSet).map(function(k){ return zSet[k]; }).sort(function(a,b){return a-b;});
  var nCols = xVals.length, nRows = zVals.length;
  if (nCols < 2 || nRows < 2) {
    return { pts: data.map(function(p){ return {x:Number(p.x),y:Number(p.y),z:Number(p.z)}; }), vMap: null, rowCount: 0, colCount: 0 };
  }
  // Build depth grid: depthGrid[zi][xi] = contact Y value.
  var xi2idx = {}, zi2idx = {};
  xVals.forEach(function(v, i){ xi2idx[v.toFixed(6)] = i; });
  zVals.forEach(function(v, i){ zi2idx[v.toFixed(6)] = i; });
  var depthGrid = [];
  for (var ri = 0; ri < nRows; ri++) { depthGrid.push(new Array(nCols).fill(null)); }
  data.forEach(function(p) {
    var xi = xi2idx[Number(p.x).toFixed(6)], zi = zi2idx[Number(p.z).toFixed(6)];
    if (xi != null && zi != null) depthGrid[zi][xi] = Number(p.y);
  });
  // Compute mean spacings (handles slightly non-uniform grids).
  var colSpacing = (xVals[nCols - 1] - xVals[0]) / (nCols - 1);
  var rowSpacing = (zVals[nRows - 1] - zVals[0]) / (nRows - 1);
  var cfg = { rowCount: nRows, colCount: nCols, colSpacing: colSpacing, rowSpacing: rowSpacing, minX: xVals[0], minY: zVals[0] };
  var up = _cubicSplineUpsampleGrid(depthGrid, cfg, targetSpacing);
  // Recompute subdivision factors using the same formulas as _cubicSplineUpsampleGrid so
  // we can map upsampled column/row indices back to actual probe positions.  Output
  // vertices are placed at the physically correct X/Z coordinates (linearly interpolated
  // between actual probe positions), not at assumed-uniform positions.  This eliminates
  // geometric seams at column boundaries (vertical lines) and layer boundaries (horizontal
  // lines) that appear when probe positions are non-uniformly spaced.
  var _sp = Math.max(targetSpacing, 0.5);
  var _nCX = nCols - 1, _nCY = nRows - 1;
  var _subC = Math.max(1, Math.round(colSpacing / _sp));
  var _subR = Math.max(1, Math.round(rowSpacing / _sp));
  var _maxSub = Math.max(1, Math.floor(Math.sqrt(200000 / Math.max(_nCX * _nCY, 1))));
  _subC = Math.min(_subC, _maxSub);
  _subR = Math.min(_subR, _maxSub);
  // Convert grid to flat vertex list + vMap for structured triangulation.
  var pts = [], vMap = [];
  for (var ri2 = 0; ri2 < up.rowCount; ri2++) {
    var kz = Math.min(Math.floor(ri2 / _subR), nRows - 2);
    var fz = (ri2 - kz * _subR) / _subR;
    var actualZ = zVals[kz] + fz * (zVals[kz + 1] - zVals[kz]);
    var vmRow = [];
    for (var ci2 = 0; ci2 < up.colCount; ci2++) {
      var depth = up.grid[ri2][ci2];
      if (depth !== null) {
        vmRow.push(pts.length);
        var kx = Math.min(Math.floor(ci2 / _subC), nCols - 2);
        var fx = (ci2 - kx * _subC) / _subC;
        var actualX = xVals[kx] + fx * (xVals[kx + 1] - xVals[kx]);
        pts.push({ x: actualX, y: depth, z: actualZ });
      } else {
        vmRow.push(null);
      }
    }
    vMap.push(vmRow);
  }
  if (pts.length < 3) {
    // Fall back to raw data if upsampling produced too few points.
    return { pts: data.map(function(p){ return {x:Number(p.x),y:Number(p.y),z:Number(p.z)}; }), vMap: null, rowCount: 0, colCount: 0 };
  }
  return { pts: pts, vMap: vMap, rowCount: up.rowCount, colCount: up.colCount };
}
// ── Surface DXF export ────────────────────────────────────────────────────────
function exportSurfaceDXF() {
  pluginDebug('exportSurfaceDXF ENTER');
  if (!smMeshData || !smGridConfig) { pluginDebug('exportSurfaceDXF: no data'); alert('No surface mesh data. Run a surface probe first.'); return; }
  var cfg = smGridConfig, grid = smMeshData;
  var dxf = _dxfHeader();
  var polylineCount = 0;
  // Export each row as a 3D polyline
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    var pts = [];
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var z = grid[ri][ci];
      if (z != null) pts.push({ x: cfg.minX + ci * cfg.colSpacing, y: cfg.minY + ri * cfg.rowSpacing, z: z });
    }
    if (pts.length >= 2) { dxf += _dxf3DPolyline(pts); polylineCount++; }
  }
  // Export each column as a 3D polyline
  for (var ci2 = 0; ci2 < cfg.colCount; ci2++) {
    var cpts = [];
    for (var ri2 = 0; ri2 < cfg.rowCount; ri2++) {
      var z2 = grid[ri2][ci2];
      if (z2 != null) cpts.push({ x: cfg.minX + ci2 * cfg.colSpacing, y: cfg.minY + ri2 * cfg.rowSpacing, z: z2 });
    }
    if (cpts.length >= 2) { dxf += _dxf3DPolyline(cpts); polylineCount++; }
  }
  dxf += _dxfFooter();
  _dxfDownload(dxf, 'surface_mesh_' + Date.now() + '.dxf');
  pluginDebug('exportSurfaceDXF: exported ' + polylineCount + ' polylines');
  setFooterStatus('Exported surface mesh to DXF.', 'good');
}
// ── Surface OBJ export ────────────────────────────────────────────────────────
// Upsamples the raw probe grid with C2 natural cubic spline interpolation before
// triangulation so the exported mesh has smooth geometry between probe points.
function exportSurfaceOBJ() {
  pluginDebug('exportSurfaceOBJ ENTER');
  if (!smMeshData || !smGridConfig) { pluginDebug('exportSurfaceOBJ: no data'); alert('No surface mesh data. Run a surface probe first.'); return; }
  var subSpacing = Number((document.getElementById('surfOBJSubdivision') || {}).value);
  if (!isFinite(subSpacing) || subSpacing <= 0) subSpacing = 0.5;
  subSpacing = Math.max(0.5, subSpacing);
  // Upsample the probe grid via C2 natural cubic spline interpolation.
  var up = _cubicSplineUpsampleGrid(smMeshData, smGridConfig, subSpacing);
  // Surface smoothing: apply peaks/valleys blend to the upsampled Z grid.
  var surfPeak   = Math.min(1, Math.max(0, Number((document.getElementById('surfSmoothPeak')   || {}).value) || 0));
  var surfValley = Math.min(1, Math.max(0, Number((document.getElementById('surfSmoothValley') || {}).value) || 0));
  var surfPasses = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('surfSmoothPasses') || {}).value) || 1)));
  if (surfPeak > 0 || surfValley > 0) _smoothSurfaceGrid(up.grid, up.rowCount, up.colCount, surfPeak, surfValley, surfPasses);
  var cfg = up, grid = up.grid;
  var lines = ['# 3D Live Edge Mesh — Surface OBJ', '# Plugin Version: ' + SM_VERSION,
               '# Exported: ' + new Date().toISOString(),
               '# C2 natural cubic spline interpolation, subdivision spacing: ' + subSpacing + 'mm', ''];
  var allVerts = [];
  var allTris = [];
  // Map grid positions to vertex indices (0-based).
  var vMap = [];
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    vMap.push([]);
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var z = grid[ri][ci];
      if (z != null) {
        vMap[ri].push(allVerts.length);
        allVerts.push({x: cfg.minX + ci*cfg.colSpacing, y: cfg.minY + ri*cfg.rowSpacing, z: z});
      } else {
        vMap[ri].push(null);
      }
    }
  }
  // Split each valid grid quad into two CCW triangles (normal points up +Z).
  for (var fr = 0; fr < cfg.rowCount - 1; fr++) {
    for (var fc = 0; fc < cfg.colCount - 1; fc++) {
      var a=vMap[fr][fc], b=vMap[fr][fc+1], c=vMap[fr+1][fc+1], d=vMap[fr+1][fc];
      if (a!=null && b!=null && c!=null && d!=null) {
        allTris.push([a, b, c]);
        allTris.push([a, c, d]);
      } else if (a!=null && b!=null && c!=null) { allTris.push([a, b, c]);
      } else if (a!=null && c!=null && d!=null) { allTris.push([a, c, d]);
      } else if (b!=null && c!=null && d!=null) { allTris.push([b, c, d]);
      } else if (a!=null && b!=null && d!=null) { allTris.push([a, b, d]); }
    }
  }
  var norms = _computeVertexNormals(allVerts, allTris);
  allVerts.forEach(function(v) { lines.push('v ' + v.x.toFixed(4) + ' ' + v.y.toFixed(4) + ' ' + v.z.toFixed(4)); });
  lines.push('');
  norms.forEach(function(n) { lines.push('vn ' + n.x.toFixed(4) + ' ' + n.y.toFixed(4) + ' ' + n.z.toFixed(4)); });
  lines.push('');
  lines.push('s 1');
  allTris.forEach(function(t) {
    var i0=t[0]+1, i1=t[1]+1, i2=t[2]+1;
    lines.push('f ' + i0 + '//' + i0 + ' ' + i1 + '//' + i1 + ' ' + i2 + '//' + i2);
  });
  _objDownload(lines.join('\n'), 'surface_mesh_' + Date.now() + '.obj');
  pluginDebug('exportSurfaceOBJ: exported ' + allVerts.length + ' vertices, ' + allTris.length + ' triangles (subdivision ' + subSpacing + 'mm)');
  setFooterStatus('Exported surface mesh to OBJ (' + allVerts.length + ' vertices, C2 spline subdivision ' + subSpacing + 'mm).', 'good');
}
// ── Surface STL export ────────────────────────────────────────────────────────
// Identical geometry to exportSurfaceOBJ but written as binary STL which Aspire
// v12 imports natively without requiring OBJ import workarounds.
function exportSurfaceSTL() {
  pluginDebug('exportSurfaceSTL ENTER');
  if (!smMeshData || !smGridConfig) { pluginDebug('exportSurfaceSTL: no data'); alert('No surface mesh data. Run a surface probe first.'); return; }
  var subSpacing = Number((document.getElementById('surfOBJSubdivision') || {}).value);
  if (!isFinite(subSpacing) || subSpacing <= 0) subSpacing = 0.5;
  subSpacing = Math.max(0.5, subSpacing);
  var up = _cubicSplineUpsampleGrid(smMeshData, smGridConfig, subSpacing);
  // Surface smoothing: apply peaks/valleys blend to the upsampled Z grid.
  var surfPeakS   = Math.min(1, Math.max(0, Number((document.getElementById('surfSmoothPeak')   || {}).value) || 0));
  var surfValleyS = Math.min(1, Math.max(0, Number((document.getElementById('surfSmoothValley') || {}).value) || 0));
  var surfPassesS = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('surfSmoothPasses') || {}).value) || 1)));
  if (surfPeakS > 0 || surfValleyS > 0) _smoothSurfaceGrid(up.grid, up.rowCount, up.colCount, surfPeakS, surfValleyS, surfPassesS);
  var cfg = up, grid = up.grid;
  var allVerts = [], allTris = [];
  var vMap = [];
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    vMap.push([]);
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var z = grid[ri][ci];
      if (z != null) { vMap[ri].push(allVerts.length); allVerts.push({x: cfg.minX + ci*cfg.colSpacing, y: cfg.minY + ri*cfg.rowSpacing, z: z}); }
      else { vMap[ri].push(null); }
    }
  }
  for (var fr = 0; fr < cfg.rowCount - 1; fr++) {
    for (var fc = 0; fc < cfg.colCount - 1; fc++) {
      var a=vMap[fr][fc], b=vMap[fr][fc+1], c=vMap[fr+1][fc+1], d=vMap[fr+1][fc];
      if (a!=null&&b!=null&&c!=null&&d!=null) { allTris.push([a,b,c]); allTris.push([a,c,d]); }
      else if (a!=null&&b!=null&&c!=null) { allTris.push([a,b,c]); }
      else if (a!=null&&c!=null&&d!=null) { allTris.push([a,c,d]); }
      else if (b!=null&&c!=null&&d!=null) { allTris.push([b,c,d]); }
      else if (a!=null&&b!=null&&d!=null) { allTris.push([a,b,d]); }
    }
  }
  _stlDownload(allVerts, allTris, 'surface_mesh_' + Date.now() + '.stl');
  pluginDebug('exportSurfaceSTL: exported ' + allVerts.length + ' vertices, ' + allTris.length + ' triangles');
  setFooterStatus('Exported surface mesh to STL (' + allVerts.length + ' vertices, C2 spline subdivision ' + subSpacing + 'mm).', 'good');
}
// ── Smooth-outline STL helpers ────────────────────────────────────────────────

// Densify a closed polygon so no edge is longer than maxSegLen.
// Returns a new array of [x,y] vertices (does NOT close with a repeated first vertex).
function _densifyPolygon(poly, maxSegLen) {
  if (!poly || poly.length < 2) return poly ? poly.slice() : [];
  var out = [];
  var n = poly.length;
  for (var i = 0; i < n; i++) {
    var p1 = poly[i];
    var p2 = poly[(i + 1) % n];
    out.push(p1);
    var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > maxSegLen) {
      var segs = Math.ceil(len / maxSegLen);
      for (var k = 1; k < segs; k++) {
        var t = k / segs;
        out.push([p1[0] + dx * t, p1[1] + dy * t]);
      }
    }
  }
  return out;
}

// Null-aware bilinear interpolation: returns a number or null.
// Unlike bilinearInterpolateZ, treats missing grid cells as absent rather than 0.
function _bilinearZNullAware(grid, cfg, qx, qy) {
  var col = (qx - cfg.minX) / cfg.colSpacing;
  var row = (qy - cfg.minY) / cfg.rowSpacing;
  var col0 = Math.floor(col);
  var row0 = Math.floor(row);
  col0 = Math.max(0, Math.min(cfg.colCount - 2, col0));
  row0 = Math.max(0, Math.min(cfg.rowCount - 2, row0));
  var col1 = col0 + 1;
  var row1 = row0 + 1;
  var z00 = grid[row0] && grid[row0][col0] != null ? grid[row0][col0] : null;
  var z10 = grid[row0] && grid[row0][col1] != null ? grid[row0][col1] : null;
  var z01 = grid[row1] && grid[row1][col0] != null ? grid[row1][col0] : null;
  var z11 = grid[row1] && grid[row1][col1] != null ? grid[row1][col1] : null;
  if (z00 === null || z10 === null || z01 === null || z11 === null) return null;
  var fx = Math.max(0, Math.min(1, col - col0));
  var fy = Math.max(0, Math.min(1, row - row0));
  return z00 * (1 - fx) * (1 - fy) + z10 * fx * (1 - fy) +
         z01 * (1 - fx) * fy       + z11 * fx * fy;
}

// Z-method B: clamp to nearest valid grid sample when bilinear interpolation
// is unavailable (null surrounding cells or point outside grid).
// validPts: [{x, y, z}, ...] — pre-built list of all valid grid samples.
function _nearestValidZ(x, y, validPts) {
  if (!validPts || validPts.length === 0) return 0;
  var bestZ = validPts[0].z, bestD2 = Infinity;
  for (var k = 0; k < validPts.length; k++) {
    var dx = validPts[k].x - x, dy = validPts[k].y - y;
    var d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; bestZ = validPts[k].z; }
  }
  return bestZ;
}

// ── Export STL (Smooth Outline) ───────────────────────────────────────────────
// Builds a surface mesh whose XY boundary follows the outline SVG curve rather
// than the blocky rectangular grid.  Algorithm:
//   1. Obtain the boundary polygon (inset outline or grid bounding rect fallback).
//   2. Densify the boundary to at most surfOBJSubdivision mm per segment.
//   3. Collect all valid interior grid sample points that lie inside the polygon.
//   4. Delaunay-triangulate all vertices (boundary + interior).
//   5. Discard triangles whose centroid falls outside the polygon.
//   6. Assign Z via null-aware bilinear interpolation; fall back to nearest-valid
//      sample (Z method B) when interpolation is not possible.
//   7. Export binary STL.
function exportSurfaceSTLSmooth() {
  pluginDebug('exportSurfaceSTLSmooth ENTER');
  if (!smMeshData || !smGridConfig) {
    pluginDebug('exportSurfaceSTLSmooth: no data');
    alert('No surface mesh data. Run a surface probe first.');
    return;
  }

  var grid = smMeshData, cfg = smGridConfig;

  // Max segment length for boundary densification (reuses subdivision control).
  var maxSeg = Number((document.getElementById('surfOBJSubdivision') || {}).value);
  if (!isFinite(maxSeg) || maxSeg <= 0) maxSeg = 0.5;
  maxSeg = Math.max(0.1, maxSeg);

  // ── 1. Obtain boundary polygon ────────────────────────────────────────────
  var boundaryPoly = null;
  var polySource = '';

  // Priority A: polygon cached from the last Outline Surface Grid Probe run.
  if (typeof smLastInsetPolygon !== 'undefined' && smLastInsetPolygon && smLastInsetPolygon.length >= 3) {
    boundaryPoly = smLastInsetPolygon;
    polySource = 'detected outline inset (from last Outline Surface Grid Probe run), ' + boundaryPoly.length + ' vertices';
  }
  // Priority B: build from current outline scan data and inset by gridMargin.
  if (!boundaryPoly) {
    try {
      var rawPoly = (typeof _buildOutlinePolygon === 'function') ? _buildOutlinePolygon() : null;
      if (rawPoly && rawPoly.length >= 3) {
        var margin = Number((document.getElementById('outlineGridMargin') || {}).value) || 2;
        boundaryPoly = _insetPolygon(rawPoly, margin);
        polySource = 'detected outline from scan data (inset ' + margin + 'mm), ' + boundaryPoly.length + ' raw vertices';
      }
    } catch (e) {
      pluginDebug('exportSurfaceSTLSmooth: could not build/inset outline polygon — ' + e.message);
    }
  }
  // Priority C: fallback — bounding rect of the surface grid (gives smooth boundary
  // from the grid edge, not from the outline curve, but always works).
  if (!boundaryPoly) {
    var minX = cfg.minX, maxX = cfg.minX + (cfg.colCount - 1) * cfg.colSpacing;
    var minY = cfg.minY, maxY = cfg.minY + (cfg.rowCount - 1) * cfg.rowSpacing;
    boundaryPoly = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
    polySource = 'grid bounding rectangle (no outline scan data available)';
  }

  pluginDebug('exportSurfaceSTLSmooth: boundary polygon source — ' + polySource);

  // ── 2. Densify boundary ───────────────────────────────────────────────────
  var denseBoundary = _densifyPolygon(boundaryPoly, maxSeg);
  pluginDebug('exportSurfaceSTLSmooth: boundary densified — ' + boundaryPoly.length +
    ' vertices → ' + denseBoundary.length + ' after densification (maxSeg=' + maxSeg + 'mm)');

  // ── 3. Collect valid interior grid points inside the polygon ──────────────
  var validPts = []; // [{x, y, z}] — all valid grid samples (for nearest-neighbor fallback)
  var interiorPts = []; // subset that lies inside the boundary polygon
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var gz = grid[ri] && grid[ri][ci] != null ? grid[ri][ci] : null;
      if (gz === null) continue;
      var gx = cfg.minX + ci * cfg.colSpacing;
      var gy = cfg.minY + ri * cfg.rowSpacing;
      validPts.push({ x: gx, y: gy, z: gz });
      if (_pointInPolygon(boundaryPoly, gx, gy)) interiorPts.push({ x: gx, y: gy });
    }
  }
  pluginDebug('exportSurfaceSTLSmooth: ' + validPts.length + ' valid grid samples; ' +
    interiorPts.length + ' interior points inside polygon');

  // ── 4. Build combined 2-D point set (boundary ring + interior samples) ────
  // De-duplicate: avoid placing grid points too close to a boundary vertex.
  var DEDUP_DIST = maxSeg * 0.5;
  var allPts2d = denseBoundary.map(function(p) { return { x: p[0], y: p[1] }; });
  var boundaryCount = allPts2d.length;

  interiorPts.forEach(function(ip) {
    var tooClose = false;
    for (var k = 0; k < allPts2d.length && !tooClose; k++) {
      var ddx = allPts2d[k].x - ip.x, ddy = allPts2d[k].y - ip.y;
      if (ddx * ddx + ddy * ddy < DEDUP_DIST * DEDUP_DIST) tooClose = true;
    }
    if (!tooClose) allPts2d.push({ x: ip.x, y: ip.y });
  });
  pluginDebug('exportSurfaceSTLSmooth: combined point count for triangulation = ' + allPts2d.length +
    ' (' + boundaryCount + ' boundary + ' + (allPts2d.length - boundaryCount) + ' interior)');

  if (allPts2d.length < 3) {
    alert('Not enough valid points to build a smooth outline mesh. Run Outline Surface Grid Probe first.');
    return;
  }

  // ── 5. Delaunay triangulate ───────────────────────────────────────────────
  var rawTris = _delaunayTriangulate(allPts2d);
  pluginDebug('exportSurfaceSTLSmooth: Delaunay produced ' + rawTris.length + ' raw triangles');

  // Discard triangles whose centroid falls outside the boundary polygon.
  var filteredTris = rawTris.filter(function(t) {
    var cx = (allPts2d[t[0]].x + allPts2d[t[1]].x + allPts2d[t[2]].x) / 3;
    var cy = (allPts2d[t[0]].y + allPts2d[t[1]].y + allPts2d[t[2]].y) / 3;
    return _pointInPolygon(boundaryPoly, cx, cy);
  });
  pluginDebug('exportSurfaceSTLSmooth: ' + filteredTris.length + ' triangles after polygon clip');

  if (filteredTris.length === 0) {
    alert('No triangles inside boundary polygon. Check outline scan data and margin.');
    return;
  }

  // ── 6. Compute Z for each vertex ──────────────────────────────────────────
  var allVerts = allPts2d.map(function(p) {
    var z = _bilinearZNullAware(grid, cfg, p.x, p.y);
    if (z === null) z = _nearestValidZ(p.x, p.y, validPts);
    return { x: p.x, y: p.y, z: z };
  });

  // ── 7. Export binary STL ──────────────────────────────────────────────────
  _stlDownload(allVerts, filteredTris, 'surface_smooth_outline_' + Date.now() + '.stl');
  pluginDebug('exportSurfaceSTLSmooth: exported ' + allVerts.length + ' vertices, ' +
    filteredTris.length + ' triangles — boundary: ' + polySource);
  setFooterStatus('Exported smooth-outline STL (' + allVerts.length + ' vertices, ' +
    filteredTris.length + ' triangles, boundary: ' + polySource + ').', 'good');
}

function exportFaceDXF() {
  pluginDebug('exportFaceDXF ENTER');
  var data = getFaceMeshData();
  if (!data || !data.length) { pluginDebug('exportFaceDXF: no data'); alert('No face mesh data. Run a face probe first.'); return; }
  var dxf = _dxfHeader();
  // Group by layer and X sample coordinate (sampleCoord), emit each as a polyline
  var byLayer = {};
  data.forEach(function(p) {
    var layer = p.layer != null ? p.layer : 1;
    if (!byLayer[layer]) byLayer[layer] = [];
    byLayer[layer].push(p);
  });
  var polylineCount = 0;
  Object.keys(byLayer).sort(function(a, b){ return Number(a) - Number(b); }).forEach(function(layer) {
    var pts = byLayer[layer].slice().sort(function(a, b){ return Number(a.x) - Number(b.x); });
    if (pts.length >= 2) { dxf += _dxf3DPolyline(pts.map(function(p){ return { x: p.x, y: p.y, z: p.z }; })); polylineCount++; }
  });
  dxf += _dxfFooter();
  _dxfDownload(dxf, 'face_mesh_' + Date.now() + '.dxf');
  pluginDebug('exportFaceDXF: exported ' + polylineCount + ' polylines from ' + data.length + ' points');
  setFooterStatus('Exported face mesh to DXF.', 'good');
}
// ── Face OBJ export ───────────────────────────────────────────────────────────
// Upsamples the face probe grid (X × Z-layer) with C2 natural cubic spline
// interpolation and uses structured-grid triangulation for smoother results.
function exportFaceOBJ() {
  pluginDebug('exportFaceOBJ ENTER');
  var data = getFaceMeshData();
  if (!data || !data.length) { pluginDebug('exportFaceOBJ: no data'); alert('No face mesh data. Run a face probe first.'); return; }
  var subSpacing = Number((document.getElementById('faceOBJSubdivision') || {}).value);
  if (!isFinite(subSpacing) || subSpacing <= 0) subSpacing = 0.5;
  subSpacing = Math.max(0.5, subSpacing);
  var lines = ['# 3D Live Edge Mesh — Face OBJ', '# Plugin Version: ' + SM_VERSION,
               '# Exported: ' + new Date().toISOString(),
               '# C2 natural cubic spline interpolation, subdivision spacing: ' + subSpacing + 'mm', ''];
  // Upsample the face probe grid via C2 natural cubic spline interpolation.
  var up = _upsampleFaceData(data, subSpacing);
  // Auto seam-edge smoothing: blend top edge row toward interior neighbours.
  // Value 0–10: integer part = full-blend passes, fractional part = one partial pass.
  var rawFaceSeamVal = Math.min(10, Math.max(0, Number((document.getElementById('faceSeamSmooth') || {}).value) || 0));
  if (rawFaceSeamVal > 0) {
    var _fsFull = Math.floor(rawFaceSeamVal), _fsFrac = rawFaceSeamVal - _fsFull;
    for (var _fsi = 0; _fsi < _fsFull; _fsi++) _smoothFaceSeamRow(up, 1.0);
    if (_fsFrac > 0) _smoothFaceSeamRow(up, _fsFrac);
  }
  // Face wall surface smoothing: reduce fold lines between probe layers across full wall height.
  var faceWallPeak = Math.min(1, Math.max(0, Number((document.getElementById('faceWallSmoothPeak') || {}).value) || 0));
  var faceWallValley = Math.min(1, Math.max(0, Number((document.getElementById('faceWallSmoothValley') || {}).value) || 0));
  if (faceWallPeak > 0 || faceWallValley > 0) _smoothFaceWallRows(up, faceWallPeak, faceWallValley);
  var allVerts = up.pts;
  var allTris;
  if (up.vMap && up.rowCount >= 2 && up.colCount >= 2) {
    // Structured-grid triangulation: smoother and avoids Delaunay artefacts.
    allTris = [];
    for (var ri = 0; ri < up.rowCount - 1; ri++) {
      for (var ci = 0; ci < up.colCount - 1; ci++) {
        var a=up.vMap[ri][ci], b=up.vMap[ri][ci+1], c=up.vMap[ri+1][ci+1], d=up.vMap[ri+1][ci];
        if (a!=null && b!=null && c!=null && d!=null) {
          allTris.push([a, b, c]);
          allTris.push([a, c, d]);
        } else if (a!=null && b!=null && c!=null) { allTris.push([a, b, c]);
        } else if (a!=null && c!=null && d!=null) { allTris.push([a, c, d]);
        } else if (b!=null && c!=null && d!=null) { allTris.push([b, c, d]);
        } else if (a!=null && b!=null && d!=null) { allTris.push([a, b, d]); }
      }
    }
  } else {
    // Fallback to Delaunay for scattered / insufficiently structured data.
    var pts2d = allVerts.map(function(v) { return {x: v.x, y: v.z}; });
    allTris = _delaunayTriangulate(pts2d);
  }
  if (!allTris.length) { pluginDebug('exportFaceOBJ: triangulation failed'); alert('Triangulation failed — need at least 3 face probe points.'); return; }
  // Ensure face normals point in -Y direction (outward from workpiece toward probe approach).
  var sumNy = 0;
  allTris.forEach(function(t) {
    var v0=allVerts[t[0]], v1=allVerts[t[1]], v2=allVerts[t[2]];
    var e1x=v1.x-v0.x, e1z=v1.z-v0.z, e2x=v2.x-v0.x, e2z=v2.z-v0.z;
    sumNy += e1z*e2x - e1x*e2z;
  });
  if (sumNy > 0) allTris = allTris.map(function(t) { return [t[0], t[2], t[1]]; });
  var norms = _computeVertexNormals(allVerts, allTris);
  allVerts.forEach(function(v) { lines.push('v ' + v.x.toFixed(4) + ' ' + v.y.toFixed(4) + ' ' + v.z.toFixed(4)); });
  lines.push('');
  norms.forEach(function(n) { lines.push('vn ' + n.x.toFixed(4) + ' ' + n.y.toFixed(4) + ' ' + n.z.toFixed(4)); });
  lines.push('');
  lines.push('s 1');
  allTris.forEach(function(t) {
    var i0=t[0]+1, i1=t[1]+1, i2=t[2]+1;
    lines.push('f ' + i0 + '//' + i0 + ' ' + i1 + '//' + i1 + ' ' + i2 + '//' + i2);
  });
  _objDownload(lines.join('\n'), 'face_mesh_' + Date.now() + '.obj');
  pluginDebug('exportFaceOBJ: exported ' + allVerts.length + ' vertices, ' + allTris.length + ' triangles (subdivision ' + subSpacing + 'mm)');
  setFooterStatus('Exported face mesh to OBJ (' + allVerts.length + ' vertices, C2 spline subdivision ' + subSpacing + 'mm).', 'good');
}
// ── Face wall mesh builder for export (matches 3D preview pipeline) ───────────
// Generates real-world-coordinate vertices/triangles using the same bicubic
// chord-length Hermite interpolation and pre-smoothing as _buildThreeFaceWall in
// the 3D preview, so the exported STL looks identical to the on-screen mesh.
var FACE_STL_MAX_VERTS = 500000;
function _buildFaceWallExportMesh(faceWall, sub, smPeak, smValley, smPasses) {
  var nR = faceWall.nRows, nC = faceWall.nCols;
  var nCX = nC - 1, nCY = nR - 1;
  if (nCX < 1 || nCY < 1) return null;
  var totalCols = nCX * sub + 1, totalRows = nCY * sub + 1;
  var totalVerts = totalCols * totalRows;
  if (totalVerts > FACE_STL_MAX_VERTS) return { tooLarge: true, vertCount: totalVerts };
  // ── Helpers: same as _buildThreeFaceWall ─────────────────────────────────
  function gR(li, xi) {
    var lli = Math.max(0, Math.min(nR-1, li)), lxi = Math.max(0, Math.min(nC-1, xi));
    var r = faceWall.grid[lli] && faceWall.grid[lli][lxi];
    return (r && isFinite(Number(r.z)) && isFinite(Number(r.y))) ? r : null;
  }
  // Actual column X positions and row Z heights for chord-length parameterisation.
  var fwXs = faceWall.xs;
  var rowZs = new Array(nR).fill(null);
  for (var _liz = 0; _liz < nR; _liz++) {
    for (var _xiz = 0; _xiz < nC; _xiz++) {
      var _fwg = faceWall.grid[_liz] && faceWall.grid[_liz][_xiz];
      if (_fwg && isFinite(Number(_fwg.z))) { rowZs[_liz] = Number(_fwg.z); break; }
    }
  }
  function rowInterpFn(li, xi, t, fn) {
    var p1=gR(li,xi), p2=gR(li,xi+1); if (!p1||!p2) return null;
    var p0=gR(li,xi-1); if (!p0) p0=p1;
    var p3=gR(li,xi+2); if (!p3) p3=p2;
    var x0 = xi > 0 ? fwXs[xi-1] : fwXs[xi];
    var x3 = xi+2 < nC ? fwXs[xi+2] : fwXs[xi+1];
    return _chordHermite(fn(p0),fn(p1),fn(p2),fn(p3), x0,fwXs[xi],fwXs[xi+1],x3, t);
  }
  function faceInterpFn(li, xi, tx, ty, fn) {
    var r00=gR(li,xi),r10=gR(li,xi+1),r01=gR(li+1,xi),r11=gR(li+1,xi+1);
    if (!r00||!r10||!r01||!r11) return null;
    var ri0=rowInterpFn(li-1,xi,tx,fn), ri1=rowInterpFn(li,xi,tx,fn);
    var ri2=rowInterpFn(li+1,xi,tx,fn), ri3=rowInterpFn(li+2,xi,tx,fn);
    if (ri1===null||ri2===null) return fn(r00)*(1-tx)*(1-ty)+fn(r10)*tx*(1-ty)+fn(r01)*(1-tx)*ty+fn(r11)*tx*ty;
    if (ri0===null) ri0=ri1; if (ri3===null) ri3=ri2;
    var z0 = rowZs[li-1] != null ? rowZs[li-1] : rowZs[li];
    var z1 = rowZs[li], z2 = rowZs[li+1];
    var z3 = rowZs[li+2] != null ? rowZs[li+2] : rowZs[li+1];
    if (z0 == null) z0 = z1; if (z3 == null) z3 = z2;
    return _chordHermite(ri0,ri1,ri2,ri3, z0,z1,z2,z3, ty);
  }
  // ── Pre-smooth contact-Y: multi-pass 2-D neighbourhood blend (same as preview) ──
  var smC = null;
  if (smPeak > 0 || smValley > 0) {
    var _smPasses = Math.max(1, Math.min(10, Math.round(smPasses) || 1));
    var smData = [];
    for (var _li=0; _li<nR; _li++) {
      smData.push([]);
      for (var _xi=0; _xi<nC; _xi++) { var _r=gR(_li,_xi); smData[_li][_xi]=_r?(_r.contactCoord!=null?Number(_r.contactCoord):Number(_r.y)):null; }
    }
    for (var _pass=0; _pass<_smPasses; _pass++) {
      var _nextSm = [];
      for (var _li2=0; _li2<nR; _li2++) {
        _nextSm.push([]);
        for (var _xi2=0; _xi2<nC; _xi2++) {
          var _orig=smData[_li2][_xi2]; if (_orig==null){_nextSm[_li2][_xi2]=null;continue;}
          var _sum=_orig,_cnt=1;
          if (_li2>0&&smData[_li2-1][_xi2]!=null){_sum+=smData[_li2-1][_xi2];_cnt++;}
          if (_li2<nR-1&&smData[_li2+1][_xi2]!=null){_sum+=smData[_li2+1][_xi2];_cnt++;}
          if (_xi2>0&&smData[_li2][_xi2-1]!=null){_sum+=smData[_li2][_xi2-1];_cnt++;}
          if (_xi2<nC-1&&smData[_li2][_xi2+1]!=null){_sum+=smData[_li2][_xi2+1];_cnt++;}
          var _avg=_sum/_cnt;
          var _bf=_orig<_avg?smPeak:(_orig>_avg?smValley:0);
          _nextSm[_li2][_xi2]=_bf>0?_orig*(1-_bf)+_avg*_bf:_orig;
        }
      }
      smData = _nextSm;
    }
    smC = smData;
  }
  // Bicubic chord-length Hermite on smoothed contact-Y (C1-continuous, eliminates crease lines).
  var smcInterpFn = smC ? function(li2, xi2, tx, ty) {
    function smcRow(l) {
      var ll=Math.max(0,Math.min(nR-1,l));
      var p1=smC[ll][xi2], p2=(xi2+1<nC)?smC[ll][xi2+1]:null;
      if (p1==null||p2==null) return null;
      var p0=xi2>0?smC[ll][xi2-1]:null; if (p0==null) p0=p1;
      var p3=xi2+2<nC?smC[ll][xi2+2]:null; if (p3==null) p3=p2;
      var x0=xi2>0?fwXs[xi2-1]:fwXs[xi2];
      var x3=xi2+2<nC?fwXs[xi2+2]:fwXs[xi2+1];
      return _chordHermite(p0,p1,p2,p3,x0,fwXs[xi2],fwXs[xi2+1],x3,tx);
    }
    var c00=smC[li2][xi2],c10=smC[li2][xi2+1];
    var c01=smC[li2+1]&&smC[li2+1][xi2],c11=smC[li2+1]&&smC[li2+1][xi2+1];
    if (c00==null||c10==null||c01==null||c11==null) return null;
    var sri0=smcRow(li2-1),sri1=smcRow(li2),sri2=smcRow(li2+1),sri3=smcRow(li2+2);
    if (sri1===null||sri2===null) { return c00*(1-tx)*(1-ty)+c10*tx*(1-ty)+c01*(1-tx)*ty+c11*tx*ty; }
    if (sri0===null) sri0=sri1; if (sri3===null) sri3=sri2;
    var sz0=rowZs[li2-1]!=null?rowZs[li2-1]:rowZs[li2];
    var sz1=rowZs[li2],sz2=rowZs[li2+1];
    var sz3=rowZs[li2+2]!=null?rowZs[li2+2]:rowZs[li2+1];
    if (sz0==null) sz0=sz1; if (sz3==null) sz3=sz2;
    return _chordHermite(sri0,sri1,sri2,sri3,sz0,sz1,sz2,sz3,ty);
  } : null;
  // ── Pre-check cell validity ───────────────────────────────────────────────
  var validCell = [];
  for (var xi=0; xi<nCX; xi++) {
    validCell[xi] = [];
    for (var li=0; li<nCY; li++) {
      var r00=faceWall.grid[li]&&faceWall.grid[li][xi], r10=faceWall.grid[li]&&faceWall.grid[li][xi+1];
      var r01=faceWall.grid[li+1]&&faceWall.grid[li+1][xi], r11=faceWall.grid[li+1]&&faceWall.grid[li+1][xi+1];
      if (!r00||!r10||!r01||!r11){validCell[xi][li]=false;continue;}
      validCell[xi][li]=isFinite(Number(r00.z))&&isFinite(Number(r10.z))&&isFinite(Number(r01.z))&&isFinite(Number(r11.z))&&
                        isFinite(Number(r00.y))&&isFinite(Number(r10.y))&&isFinite(Number(r01.y))&&isFinite(Number(r11.y));
    }
  }
  // ── Fill unified vertex grid (real-world coords: x=machineX, y=depth, z=layerZ) ──
  var posArr = new Array(totalVerts);
  var filled = new Uint8Array(totalVerts);
  for (var xi2=0; xi2<nCX; xi2++) {
    var baseGx=xi2*sub;
    for (var li2=0; li2<nCY; li2++) {
      if (!validCell[xi2][li2]) continue;
      var r00b=faceWall.grid[li2][xi2], r10b=faceWall.grid[li2][xi2+1];
      var x00=fwXs[xi2], x10=fwXs[xi2+1];
      var baseGy=li2*sub;
      for (var sy=0; sy<=sub; sy++) {
        var gy=baseGy+sy, rowOff=gy*totalCols;
        for (var sx=0; sx<=sub; sx++) {
          var vIdx=rowOff+baseGx+sx;
          if (filled[vIdx]) continue;
          var tx=sx/sub, ty=sy/sub;
          var mx=x00+tx*(x10-x00);
          var mz=faceInterpFn(li2,xi2,tx,ty,function(r){return Number(r.z);});
          var mc;
          if (smcInterpFn) {
            // Bicubic chord-length Hermite on multi-pass smoothed contact-Y (C1-continuous).
            mc = smcInterpFn(li2,xi2,tx,ty);
          } else {
            mc=faceInterpFn(li2,xi2,tx,ty,function(r){return r.contactCoord!=null?Number(r.contactCoord):Number(r.y);});
          }
          if (mz===null){var r01c=faceWall.grid[li2+1][xi2],r11c=faceWall.grid[li2+1][xi2+1];mz=Number(r00b.z)*(1-tx)*(1-ty)+Number(r10b.z)*tx*(1-ty)+Number(r01c.z)*(1-tx)*ty+Number(r11c.z)*tx*ty;}
          if (mc===null){var r01d=faceWall.grid[li2+1][xi2],r11d=faceWall.grid[li2+1][xi2+1];var _cc2=function(r){return r.contactCoord!=null?Number(r.contactCoord):Number(r.y);};mc=_cc2(r00b)*(1-tx)*(1-ty)+_cc2(r10b)*tx*(1-ty)+_cc2(r01d)*(1-tx)*ty+_cc2(r11d)*tx*ty;}
          posArr[vIdx]={x:mx, y:mc, z:mz};
          filled[vIdx]=1;
        }
      }
    }
  }
  for (var i=0; i<totalVerts; i++) if (!filled[i]) posArr[i]={x:0,y:0,z:0};
  // ── Triangle indices: same topology as preview ───────────────────────────
  var tris = [];
  for (var xi3=0; xi3<nCX; xi3++) {
    var bGx=xi3*sub;
    for (var li3=0; li3<nCY; li3++) {
      if (!validCell[xi3][li3]) continue;
      var bGy=li3*sub;
      for (var sy2=0; sy2<sub; sy2++) {
        var ro2=(bGy+sy2)*totalCols, nro2=ro2+totalCols;
        for (var sx2=0; sx2<sub; sx2++) {
          var i00=ro2+bGx+sx2,i10=i00+1,i01=nro2+bGx+sx2,i11=i01+1;
          tris.push([i00,i10,i01]);
          tris.push([i10,i11,i01]);
        }
      }
    }
  }
  return { pts: posArr, tris: tris, totalCols: totalCols, totalRows: totalRows };
}
// ── Face STL export ───────────────────────────────────────────────────────────
// Uses the same bicubic chord-length Hermite mesh pipeline as the 3D preview
// (_buildFaceWallExportMesh / _buildThreeFaceWall), so the exported STL matches
// the smooth on-screen view with no horizontal or vertical crease lines.
function exportFaceSTL() {
  pluginDebug('exportFaceSTL ENTER');
  var data = getFaceMeshData();
  if (!data || !data.length) { pluginDebug('exportFaceSTL: no data'); alert('No face mesh data. Run a face probe first.'); return; }
  var subSpacingMm = Number((document.getElementById('faceOBJSubdivision') || {}).value);
  if (!isFinite(subSpacingMm) || subSpacingMm <= 0) subSpacingMm = 0.5;
  subSpacingMm = Math.max(0.25, subSpacingMm);
  var faceWall = buildFaceWallGrid(data);
  if (!faceWall) { pluginDebug('exportFaceSTL: insufficient grid'); alert('Insufficient face probe data — need at least a 2×2 grid of probe points.'); return; }
  // Compute subdivision factor from mean cell width (minimum SUB=8 to match 3D preview quality).
  var meanColW = faceWall.nCols > 1 ? (faceWall.xMax - faceWall.xMin) / (faceWall.nCols - 1) : subSpacingMm;
  var sub = Math.max(8, Math.round(meanColW / subSpacingMm));
  var maxSub = Math.max(1, Math.floor(Math.sqrt(FACE_STL_MAX_VERTS / Math.max((faceWall.nCols-1)*(faceWall.nRows-1), 1))));
  sub = Math.min(sub, maxSub);
  var smPeak   = Math.min(1, Math.max(0, Number((document.getElementById('faceWallSmoothPeak')   || {}).value) || 0));
  var smValley = Math.min(1, Math.max(0, Number((document.getElementById('faceWallSmoothValley') || {}).value) || 0));
  var smPasses = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('faceWallSmoothPasses') || {}).value) || 1)));
  var mesh = _buildFaceWallExportMesh(faceWall, sub, smPeak, smValley, smPasses);
  if (!mesh) { pluginDebug('exportFaceSTL: insufficient grid'); alert('Insufficient face probe data — need at least a 2×2 grid of probe points.'); return; }
  if (mesh.tooLarge) {
    alert('Face STL export cancelled: requested subdivision would produce ' +
      mesh.vertCount.toLocaleString() + ' vertices (limit ' + FACE_STL_MAX_VERTS.toLocaleString() + ').\n' +
      'Increase "OBJ / STL Subdivision Resolution (mm)" to reduce vertex count.');
    return;
  }
  var allVerts = mesh.pts;
  var allTris  = mesh.tris;
  // Optional seam-edge smoothing on the top row.
  // Value 0–10: integer part = full-blend passes, fractional part = one partial pass.
  var rawSeamVal = Math.min(10, Math.max(0, Number((document.getElementById('faceSeamSmooth') || {}).value) || 0));
  if (rawSeamVal > 0) {
    var _sfull = Math.floor(rawSeamVal), _sfrac = rawSeamVal - _sfull;
    var tCols = mesh.totalCols, tRows = mesh.totalRows;
    var topRowOff = (tRows - 1) * tCols;
    var _applySTLSeamPass = function(bf) {
      for (var _sc = 0; _sc < tCols; _sc++) {
        var vi = topRowOff + _sc;
        var vi2 = topRowOff - tCols + _sc; // one row below top
        if (vi2 >= 0) allVerts[vi] = {
          x: allVerts[vi].x * (1-bf) + allVerts[vi2].x * bf,
          y: allVerts[vi].y * (1-bf) + allVerts[vi2].y * bf,
          z: allVerts[vi].z * (1-bf) + allVerts[vi2].z * bf
        };
      }
    };
    for (var _si = 0; _si < _sfull; _si++) _applySTLSeamPass(1.0);
    if (_sfrac > 0) _applySTLSeamPass(_sfrac);
  }
  if (!allTris || !allTris.length) {
    pluginDebug('exportFaceSTL: no triangles');
    alert('Triangulation failed — need at least a 2×2 grid of face probe points.');
    return;
  }
  // Ensure face normals point in -Y direction (outward toward probe approach).
  var sumNy = 0;
  allTris.forEach(function(t) {
    var v0=allVerts[t[0]], v1=allVerts[t[1]], v2=allVerts[t[2]];
    var e1x=v1.x-v0.x, e1z=v1.z-v0.z, e2x=v2.x-v0.x, e2z=v2.z-v0.z;
    sumNy += e1z*e2x - e1x*e2z;
  });
  if (sumNy > 0) allTris = allTris.map(function(t) { return [t[0], t[2], t[1]]; });
  _stlDownload(allVerts, allTris, 'face_mesh_' + Date.now() + '.stl');
  pluginDebug('exportFaceSTL: exported ' + allVerts.length + ' vertices, ' + allTris.length + ' triangles (sub=' + sub + ', ~' + subSpacingMm + 'mm)');
  setFooterStatus('Exported face mesh to STL (' + allVerts.length + ' vertices, chord-Hermite mesh, sub=' + sub + ').', 'good');
}
// ── Combined DXF export ───────────────────────────────────────────────────────
function exportCombinedDXF() {
  pluginDebug('exportCombinedDXF ENTER');
  if (!smMeshData && !getFaceMeshData()) { pluginDebug('exportCombinedDXF: no data'); alert('No mesh data to export.'); return; }
  var dxf = _dxfHeader();
  // Surface rows
  if (smMeshData && smGridConfig) {
    var cfg = smGridConfig, grid = smMeshData;
    for (var ri = 0; ri < cfg.rowCount; ri++) {
      var pts = [];
      for (var ci = 0; ci < cfg.colCount; ci++) {
        var z = grid[ri][ci];
        if (z != null) pts.push({ x: cfg.minX + ci * cfg.colSpacing, y: cfg.minY + ri * cfg.rowSpacing, z: z });
      }
      if (pts.length >= 2) dxf += _dxf3DPolyline(pts);
    }
  }
  // Face layers
  var faceData = getFaceMeshData();
  if (faceData && faceData.length) {
    var byLayer = {};
    faceData.forEach(function(p){ var l = p.layer != null ? p.layer : 1; if (!byLayer[l]) byLayer[l] = []; byLayer[l].push(p); });
    Object.keys(byLayer).sort(function(a,b){return Number(a)-Number(b);}).forEach(function(l) {
      var pts = byLayer[l].sort(function(a,b){return Number(a.x)-Number(b.x);});
      if (pts.length >= 2) dxf += _dxf3DPolyline(pts.map(function(p){return{x:p.x,y:p.y,z:p.z};}));
    });
  }
  dxf += _dxfFooter();
  _dxfDownload(dxf, 'combined_mesh_' + Date.now() + '.dxf');
  pluginDebug('exportCombinedDXF: export complete');
  setFooterStatus('Exported combined mesh to DXF.', 'good');
}
// ── Combined OBJ watertight export ────────────────────────────────────────────
// Upsamples both surface and face meshes with C2 natural cubic spline interpolation
// (driven by combinedOBJSubdivision) before stitching into a watertight solid.
function exportCombinedOBJWatertight() {
  pluginDebug('exportCombinedOBJWatertight ENTER');
  var faceData = getFaceMeshData();
  if (!smMeshData || !smGridConfig || !faceData || !faceData.length) {
    pluginDebug('exportCombinedOBJWatertight: missing data');
    alert('Both surface mesh and face mesh data are required for a watertight combined export.'); return;
  }
  var subSpacing = Number((document.getElementById('combinedOBJSubdivision') || {}).value);
  if (!isFinite(subSpacing) || subSpacing <= 0) subSpacing = 0.5;
  subSpacing = Math.max(0.5, subSpacing);
  var bottomZ = Number((document.getElementById('combinedBottomZ') || {}).value);
  if (!isFinite(bottomZ)) bottomZ = -20;
  // Upsample surface mesh via C2 natural cubic spline.
  var surfUp = _cubicSplineUpsampleGrid(smMeshData, smGridConfig, subSpacing);
  // Combined surface smoothing: peaks/valleys blend applied to OBJ/STL export only.
  var cSurfPeak   = Math.min(1, Math.max(0, Number((document.getElementById('combinedSurfSmoothPeak')   || {}).value) || 0));
  var cSurfValley = Math.min(1, Math.max(0, Number((document.getElementById('combinedSurfSmoothValley') || {}).value) || 0));
  var cSurfPasses = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('combinedSurfSmoothPasses') || {}).value) || 1)));
  if (cSurfPeak > 0 || cSurfValley > 0) _smoothSurfaceGrid(surfUp.grid, surfUp.rowCount, surfUp.colCount, cSurfPeak, cSurfValley, cSurfPasses);
  var cfg = surfUp, grid = surfUp.grid;
  var lines = ['# 3D Live Edge Mesh — Combined Watertight OBJ', '# Plugin Version: ' + SM_VERSION,
               '# C2 natural cubic spline interpolation, subdivision spacing: ' + subSpacing + 'mm', ''];
  var allVerts = [];
  var allTris = [];
  // ── Surface mesh (upsampled grid, CCW for +Z normal) ───────────────────────
  var surfV = [];
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    surfV.push([]);
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var z = grid[ri][ci];
      surfV[ri].push(allVerts.length);
      allVerts.push({x: cfg.minX + ci*cfg.colSpacing, y: cfg.minY + ri*cfg.rowSpacing, z: (z != null ? z : 0)});
    }
  }
  for (var fr = 0; fr < cfg.rowCount - 1; fr++) {
    for (var fc = 0; fc < cfg.colCount - 1; fc++) {
      var a=surfV[fr][fc], b=surfV[fr][fc+1], c=surfV[fr+1][fc+1], d=surfV[fr+1][fc];
      allTris.push([a, b, c]);
      allTris.push([a, c, d]);
    }
  }
  // ── Face mesh (upsampled via C2 spline, structured triangulation for -Y normal)
  var faceUp = _upsampleFaceData(faceData, subSpacing);
  // Combined seam smoothing: blend surface front-edge and face wall top-edge toward interior neighbours.
  var rawCombinedSeamVal = Math.min(10, Math.max(0, Number((document.getElementById('combinedSeamSmooth') || {}).value) || 0));
  if (rawCombinedSeamVal > 0) {
    var _csFull = Math.floor(rawCombinedSeamVal), _csFrac = rawCombinedSeamVal - _csFull;
    _smoothSeamEdgeRow(surfUp.grid, surfUp.rowCount, surfUp.colCount, 0, Math.min(1, rawCombinedSeamVal));
    for (var _cfsi = 0; _cfsi < _csFull; _cfsi++) _smoothFaceSeamRow(faceUp, 1.0);
    if (_csFrac > 0) _smoothFaceSeamRow(faceUp, _csFrac);
  }
  // Combined face wall smoothing: reduce fold lines between probe layers.
  var cFWPeak   = Math.min(1, Math.max(0, Number((document.getElementById('combinedFaceWallSmoothPeak')   || {}).value) || 0));
  var cFWValley = Math.min(1, Math.max(0, Number((document.getElementById('combinedFaceWallSmoothValley') || {}).value) || 0));
  var cFWPasses = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('combinedFaceWallSmoothPasses') || {}).value) || 1)));
  if (cFWPeak > 0 || cFWValley > 0) {
    for (var _cfwp = 0; _cfwp < cFWPasses; _cfwp++) _smoothFaceWallRows(faceUp, cFWPeak, cFWValley);
  }
  var faceVStart = allVerts.length;
  faceUp.pts.forEach(function(v) { allVerts.push(v); });
  var faceTris;
  if (faceUp.vMap && faceUp.rowCount >= 2 && faceUp.colCount >= 2) {
    faceTris = [];
    for (var fri = 0; fri < faceUp.rowCount - 1; fri++) {
      for (var fci = 0; fci < faceUp.colCount - 1; fci++) {
        var fa=faceUp.vMap[fri][fci], fb=faceUp.vMap[fri][fci+1], fc2=faceUp.vMap[fri+1][fci+1], fd=faceUp.vMap[fri+1][fci];
        if (fa!=null&&fb!=null&&fc2!=null&&fd!=null) {
          faceTris.push([fa+faceVStart, fb+faceVStart, fc2+faceVStart]);
          faceTris.push([fa+faceVStart, fc2+faceVStart, fd+faceVStart]);
        } else if (fa!=null&&fb!=null&&fc2!=null) { faceTris.push([fa+faceVStart, fb+faceVStart, fc2+faceVStart]);
        } else if (fa!=null&&fc2!=null&&fd!=null) { faceTris.push([fa+faceVStart, fc2+faceVStart, fd+faceVStart]);
        } else if (fb!=null&&fc2!=null&&fd!=null) { faceTris.push([fb+faceVStart, fc2+faceVStart, fd+faceVStart]);
        } else if (fa!=null&&fb!=null&&fd!=null)  { faceTris.push([fa+faceVStart, fb+faceVStart, fd+faceVStart]); }
      }
    }
  } else {
    var faceVerts3d = faceUp.pts;
    faceTris = _delaunayTriangulate(faceVerts3d.map(function(v) { return {x: v.x, y: v.z}; }));
    faceTris = faceTris.map(function(t) { return [t[0]+faceVStart, t[1]+faceVStart, t[2]+faceVStart]; });
  }
  // Ensure face normals point in -Y direction.
  var sumNy = 0;
  faceTris.forEach(function(t) {
    var v0=allVerts[t[0]], v1=allVerts[t[1]], v2=allVerts[t[2]];
    var e1x=v1.x-v0.x, e1z=v1.z-v0.z, e2x=v2.x-v0.x, e2z=v2.z-v0.z;
    sumNy += e1z*e2x - e1x*e2z;
  });
  if (sumNy > 0) faceTris = faceTris.map(function(t) { return [t[0], t[2], t[1]]; });
  // ── Top seam weld: stitch face top edge → surface front edge ───────────────
  // The face probe's topmost Z row and the surface probe's front Y row represent
  // the same physical edge.  Welding them into shared vertices lets vertex normals
  // average across both surfaces, eliminating the hard crease artefact.
  if (faceUp.vMap && faceUp.rowCount >= 2) {
    var surfFrontEdge = surfV[0].slice();
    var faceTopEdge = faceUp.vMap[faceUp.rowCount - 1].map(function(li) {
      return li != null ? faceVStart + li : null;
    });
    faceTris = _weldSeamEdge(allVerts, faceTris, surfFrontEdge, faceTopEdge);
  }
  allTris = allTris.concat(faceTris);
  // ── Bottom cap (front edge of surface to bottomZ, -Y normal) ───────────────
  var bottomVStart = allVerts.length;
  for (var bc = 0; bc < cfg.colCount; bc++) {
    allVerts.push({x: cfg.minX + bc*cfg.colSpacing, y: cfg.minY, z: bottomZ});
  }
  var frontRow = surfV[0];
  for (var bc2 = 0; bc2 < cfg.colCount - 1; bc2++) {
    var f0=frontRow[bc2], f1=frontRow[bc2+1], b0=bottomVStart+bc2, b1=bottomVStart+bc2+1;
    allTris.push([f0, b0, b1]);
    allTris.push([f0, b1, f1]);
  }
  // ── Bottom seam weld: stitch face bottom edge → bottom cap row ─────────────
  // Welding the face wall's lowest Z row to the bottom cap row removes the crease
  // at the base of the face wall.
  if (faceUp.vMap && faceUp.rowCount >= 2) {
    var bottomCapEdge = [];
    for (var bce = 0; bce < cfg.colCount; bce++) bottomCapEdge.push(bottomVStart + bce);
    var faceBottomEdge = faceUp.vMap[0].map(function(li) {
      return li != null ? faceVStart + li : null;
    });
    // Remap bottom-cap triangles to pull face-bottom vertices into the cap edge.
    // We extract only the bottom-cap tris (last 2*(colCount-1) pushed) for remapping.
    var capTrisStart = allTris.length - 2 * (cfg.colCount - 1);
    var capTrisOnly = allTris.splice(capTrisStart);
    capTrisOnly = _weldSeamEdge(allVerts, capTrisOnly, bottomCapEdge, faceBottomEdge);
    allTris = allTris.concat(capTrisOnly);
  }
  // ── Compute vertex normals and write OBJ ───────────────────────────────────
  var norms = _computeVertexNormals(allVerts, allTris);
  allVerts.forEach(function(v) { lines.push('v ' + v.x.toFixed(4) + ' ' + v.y.toFixed(4) + ' ' + v.z.toFixed(4)); });
  lines.push('');
  norms.forEach(function(n) { lines.push('vn ' + n.x.toFixed(4) + ' ' + n.y.toFixed(4) + ' ' + n.z.toFixed(4)); });
  lines.push('');
  lines.push('s 1');
  allTris.forEach(function(t) {
    var i0=t[0]+1, i1=t[1]+1, i2=t[2]+1;
    lines.push('f ' + i0 + '//' + i0 + ' ' + i1 + '//' + i1 + ' ' + i2 + '//' + i2);
  });
  _objDownload(lines.join('\n'), 'combined_watertight_' + Date.now() + '.obj');
  pluginDebug('exportCombinedOBJWatertight: exported ' + allVerts.length + ' vertices, ' + allTris.length + ' triangles (subdivision ' + subSpacing + 'mm)');
  setFooterStatus('Exported combined watertight OBJ (' + allVerts.length + ' vertices, C2 spline subdivision ' + subSpacing + 'mm).', 'good');
}
// ── Combined STL watertight export ────────────────────────────────────────────
// Identical geometry to exportCombinedOBJWatertight but written as binary STL.
function exportCombinedSTLWatertight() {
  pluginDebug('exportCombinedSTLWatertight ENTER');
  var faceData = getFaceMeshData();
  if (!smMeshData || !smGridConfig || !faceData || !faceData.length) {
    pluginDebug('exportCombinedSTLWatertight: missing data');
    alert('Both surface mesh and face mesh data are required for a watertight combined export.'); return;
  }
  var subSpacing = Number((document.getElementById('combinedOBJSubdivision') || {}).value);
  if (!isFinite(subSpacing) || subSpacing <= 0) subSpacing = 0.5;
  subSpacing = Math.max(0.5, subSpacing);
  var bottomZ = Number((document.getElementById('combinedBottomZ') || {}).value);
  if (!isFinite(bottomZ)) bottomZ = -20;
  var surfUp = _cubicSplineUpsampleGrid(smMeshData, smGridConfig, subSpacing);
  // Combined surface smoothing: peaks/valleys blend applied to OBJ/STL export only.
  var cSurfPeakS   = Math.min(1, Math.max(0, Number((document.getElementById('combinedSurfSmoothPeak')   || {}).value) || 0));
  var cSurfValleyS = Math.min(1, Math.max(0, Number((document.getElementById('combinedSurfSmoothValley') || {}).value) || 0));
  var cSurfPassesS = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('combinedSurfSmoothPasses') || {}).value) || 1)));
  if (cSurfPeakS > 0 || cSurfValleyS > 0) _smoothSurfaceGrid(surfUp.grid, surfUp.rowCount, surfUp.colCount, cSurfPeakS, cSurfValleyS, cSurfPassesS);
  var cfg = surfUp, grid = surfUp.grid;
  var allVerts = [], allTris = [];
  // Surface mesh
  var surfV = [];
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    surfV.push([]);
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var z = grid[ri][ci];
      surfV[ri].push(allVerts.length);
      allVerts.push({x: cfg.minX + ci*cfg.colSpacing, y: cfg.minY + ri*cfg.rowSpacing, z: (z != null ? z : 0)});
    }
  }
  for (var fr = 0; fr < cfg.rowCount - 1; fr++) {
    for (var fc = 0; fc < cfg.colCount - 1; fc++) {
      var a=surfV[fr][fc], b=surfV[fr][fc+1], c=surfV[fr+1][fc+1], d=surfV[fr+1][fc];
      allTris.push([a, b, c]); allTris.push([a, c, d]);
    }
  }
  // Face mesh
  var faceUp = _upsampleFaceData(faceData, subSpacing);
  // Combined seam smoothing: blend surface front-edge and face wall top-edge toward interior neighbours.
  var rawCombinedSeamValS = Math.min(10, Math.max(0, Number((document.getElementById('combinedSeamSmooth') || {}).value) || 0));
  if (rawCombinedSeamValS > 0) {
    var _csFullS = Math.floor(rawCombinedSeamValS), _csFracS = rawCombinedSeamValS - _csFullS;
    _smoothSeamEdgeRow(surfUp.grid, surfUp.rowCount, surfUp.colCount, 0, Math.min(1, rawCombinedSeamValS));
    for (var _cfsiS = 0; _cfsiS < _csFullS; _cfsiS++) _smoothFaceSeamRow(faceUp, 1.0);
    if (_csFracS > 0) _smoothFaceSeamRow(faceUp, _csFracS);
  }
  // Combined face wall smoothing: reduce fold lines between probe layers.
  var cFWPeakS   = Math.min(1, Math.max(0, Number((document.getElementById('combinedFaceWallSmoothPeak')   || {}).value) || 0));
  var cFWValleyS = Math.min(1, Math.max(0, Number((document.getElementById('combinedFaceWallSmoothValley') || {}).value) || 0));
  var cFWPassesS = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('combinedFaceWallSmoothPasses') || {}).value) || 1)));
  if (cFWPeakS > 0 || cFWValleyS > 0) {
    for (var _cfwpS = 0; _cfwpS < cFWPassesS; _cfwpS++) _smoothFaceWallRows(faceUp, cFWPeakS, cFWValleyS);
  }
  var faceVStart = allVerts.length;
  faceUp.pts.forEach(function(v) { allVerts.push(v); });
  var faceTris;
  if (faceUp.vMap && faceUp.rowCount >= 2 && faceUp.colCount >= 2) {
    faceTris = [];
    for (var fri = 0; fri < faceUp.rowCount - 1; fri++) {
      for (var fci = 0; fci < faceUp.colCount - 1; fci++) {
        var fa=faceUp.vMap[fri][fci], fb=faceUp.vMap[fri][fci+1], fc2=faceUp.vMap[fri+1][fci+1], fd=faceUp.vMap[fri+1][fci];
        if (fa!=null&&fb!=null&&fc2!=null&&fd!=null) {
          faceTris.push([fa+faceVStart, fb+faceVStart, fc2+faceVStart]);
          faceTris.push([fa+faceVStart, fc2+faceVStart, fd+faceVStart]);
        } else if (fa!=null&&fb!=null&&fc2!=null) { faceTris.push([fa+faceVStart, fb+faceVStart, fc2+faceVStart]);
        } else if (fa!=null&&fc2!=null&&fd!=null) { faceTris.push([fa+faceVStart, fc2+faceVStart, fd+faceVStart]);
        } else if (fb!=null&&fc2!=null&&fd!=null) { faceTris.push([fb+faceVStart, fc2+faceVStart, fd+faceVStart]);
        } else if (fa!=null&&fb!=null&&fd!=null)  { faceTris.push([fa+faceVStart, fb+faceVStart, fd+faceVStart]); }
      }
    }
  } else {
    faceTris = _delaunayTriangulate(faceUp.pts.map(function(v) { return {x: v.x, y: v.z}; }));
    faceTris = faceTris.map(function(t) { return [t[0]+faceVStart, t[1]+faceVStart, t[2]+faceVStart]; });
  }
  var sumNy = 0;
  faceTris.forEach(function(t) {
    var v0=allVerts[t[0]], v1=allVerts[t[1]], v2=allVerts[t[2]];
    var e1x=v1.x-v0.x, e1z=v1.z-v0.z, e2x=v2.x-v0.x, e2z=v2.z-v0.z;
    sumNy += e1z*e2x - e1x*e2z;
  });
  if (sumNy > 0) faceTris = faceTris.map(function(t) { return [t[0], t[2], t[1]]; });
  // Top seam weld: stitch face top edge → surface front edge.
  if (faceUp.vMap && faceUp.rowCount >= 2) {
    var surfFrontEdgeS = surfV[0].slice();
    var faceTopEdgeS = faceUp.vMap[faceUp.rowCount - 1].map(function(li) {
      return li != null ? faceVStart + li : null;
    });
    faceTris = _weldSeamEdge(allVerts, faceTris, surfFrontEdgeS, faceTopEdgeS);
  }
  allTris = allTris.concat(faceTris);
  // Bottom cap
  var bottomVStart = allVerts.length;
  for (var bc = 0; bc < cfg.colCount; bc++) {
    allVerts.push({x: cfg.minX + bc*cfg.colSpacing, y: cfg.minY, z: bottomZ});
  }
  var frontRow = surfV[0];
  for (var bc2 = 0; bc2 < cfg.colCount - 1; bc2++) {
    var f0=frontRow[bc2], f1=frontRow[bc2+1], b0=bottomVStart+bc2, b1=bottomVStart+bc2+1;
    allTris.push([f0, b0, b1]); allTris.push([f0, b1, f1]);
  }
  // Bottom seam weld: stitch face bottom edge → bottom cap row.
  if (faceUp.vMap && faceUp.rowCount >= 2) {
    var bottomCapEdgeS = [];
    for (var bceS = 0; bceS < cfg.colCount; bceS++) bottomCapEdgeS.push(bottomVStart + bceS);
    var faceBottomEdgeS = faceUp.vMap[0].map(function(li) {
      return li != null ? faceVStart + li : null;
    });
    var capTrisStartS = allTris.length - 2 * (cfg.colCount - 1);
    var capTrisOnlyS = allTris.splice(capTrisStartS);
    capTrisOnlyS = _weldSeamEdge(allVerts, capTrisOnlyS, bottomCapEdgeS, faceBottomEdgeS);
    allTris = allTris.concat(capTrisOnlyS);
  }
  _stlDownload(allVerts, allTris, 'combined_watertight_' + Date.now() + '.stl');
  pluginDebug('exportCombinedSTLWatertight: exported ' + allVerts.length + ' vertices, ' + allTris.length + ' triangles');
  setFooterStatus('Exported combined watertight STL (' + allVerts.length + ' vertices, C2 spline subdivision ' + subSpacing + 'mm).', 'good');
}
// ── Workflow stubs (UI buttons not yet present in HTML) ────────────────────────
var _WORKFLOW_STORAGE_KEY = '3dmesh.combined.workflows';
function renderWorkflowList() {
  var el = document.getElementById('workflow-list');
  if (!el) return;
  var wfs = _loadAllWorkflows();
  var names = Object.keys(wfs);
  if (!names.length) { el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px">No saved workflows</div>'; return; }
  el.innerHTML = names.map(function(n) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">' +
      '<span style="flex:1;font-size:12px">' + n + '</span>' +
      '<button class="btn ghost wf-load" data-wf-name="' + n + '" style="padding:2px 10px;font-size:11px">Load</button>' +
      '<button class="btn warn wf-delete" data-wf-name="' + n + '" style="padding:2px 10px;font-size:11px">&#10005;</button>' +
      '</div>';
  }).join('');
}
function _loadAllWorkflows() {
  try { var r = localStorage.getItem(_WORKFLOW_STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch(e) { return {}; }
}
function _saveAllWorkflows(wfs) {
  try { localStorage.setItem(_WORKFLOW_STORAGE_KEY, JSON.stringify(wfs)); } catch(e) {}
}
function saveWorkflow() {
  var nameEl = document.getElementById('workflow-name');
  var name = nameEl ? nameEl.value.trim() : ('Workflow ' + new Date().toLocaleTimeString());
  if (!name) { alert('Enter a workflow name.'); return; }
  var wfs = _loadAllWorkflows();
  wfs[name] = getSettingsFromUI();
  _saveAllWorkflows(wfs);
  renderWorkflowList();
  setFooterStatus('Workflow "' + name + '" saved.', 'good');
}
function loadWorkflow() {
  var nameEl = document.getElementById('workflow-name');
  var name = nameEl ? nameEl.value.trim() : '';
  if (!name) { alert('Enter the workflow name to load.'); return; }
  _loadWorkflowByName(name);
}
function _loadWorkflowByName(name) {
  var wfs = _loadAllWorkflows();
  if (!wfs[name]) { alert('Workflow "' + name + '" not found.'); return; }
  var data = wfs[name];
  // Apply as settings
  try { localStorage.setItem(SM_SETTINGS_KEY, JSON.stringify(data)); loadSettings(); } catch(e) {}
  setFooterStatus('Workflow "' + name + '" loaded.', 'good');
}
function deleteWorkflow(name) {
  var wfs = _loadAllWorkflows();
  if (!wfs[name]) return;
  delete wfs[name];
  _saveAllWorkflows(wfs);
  renderWorkflowList();
  setFooterStatus('Workflow "' + name + '" deleted.', 'good');
}
function exportWorkflows() {
  var wfs = _loadAllWorkflows();
  if (!Object.keys(wfs).length) { alert('No saved workflows to export.'); return; }
  var blob = new Blob([JSON.stringify(wfs, null, 2)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'workflows_' + Date.now() + '.json';
  a.click(); URL.revokeObjectURL(a.href);
}
function importWorkflows() {
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
  inp.onchange = function(ev) {
    var file = ev.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected a workflow object');
        var existing = _loadAllWorkflows();
        Object.assign(existing, data);
        _saveAllWorkflows(existing);
        renderWorkflowList();
        setFooterStatus('Imported ' + Object.keys(data).length + ' workflow(s).', 'good');
      } catch(err) { alert('Failed to import workflows: ' + err.message); }
    };
    reader.readAsText(file);
  };
  inp.click();
}
