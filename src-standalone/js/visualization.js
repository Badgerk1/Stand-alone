// ── Probe Visualizer helpers ──────────────────────────────────────────────────
var _smPvizTrackActive = false;
var _smPvizTrackTimer = null;
var _smPvizLiveLogLastPos = null; // last position that was logged to the live movement log

function smPvizStartLiveTracking() {
  _smPvizTrackActive = true;
  _smPvizScheduleTrack();
}

function smPvizStopLiveTracking() {
  _smPvizTrackActive = false;
  if (_smPvizTrackTimer) { clearTimeout(_smPvizTrackTimer); _smPvizTrackTimer = null; }
}

function _smPvizScheduleTrack() {
  if (!_smPvizTrackActive) return;
  _smPvizTrackTimer = setTimeout(function() {
    _getState().then(function(state) {
      if (!_smPvizTrackActive) return;
      var ms = _machineStateFrom(state);
      var w = _parsePos(ms.WPos);
      var pos = w;
      if (!pos) {
        var m = _parsePos(ms.MPos), wco = _parsePos(ms.WCO);
        if (m && wco) pos = {x: m.x - wco.x, y: m.y - wco.y, z: m.z - wco.z};
        else if (m) pos = {x: m.x, y: m.y, z: m.z};
      }
      if (pos) {
        var cfg = window._smPvizCfg;
        if (cfg) {
          var pvizPos = smPvizXYtoPos(pos.x, pos.y);
          var wrap = document.getElementById('sm-pviz-probe-wrap');
          if (wrap) { wrap.style.left = pvizPos.left + '%'; wrap.style.top = pvizPos.top + '%'; }
          _smPvizUpdateProbeHeight(pos.z);
        }
        // Show orange glow if probe is triggered
        var probeTriggered = (ms.Pn || '').indexOf('P') >= 0;
        var body = document.getElementById('sm-pviz-probe-body');
        if (body && probeTriggered && !body.classList.contains('probe-contact')) {
          body.classList.add('probe-contact');
        }
        // Live Movement Log: log when XY distance >= 0.2mm OR |ΔZ| >= 0.5mm
        var liveLogEnabled = (document.getElementById('sm-pviz-live-log-enable') || {}).checked;
        if (liveLogEnabled) {
          var llp = _smPvizLiveLogLastPos;
          var shouldLog = !llp;
          if (llp) {
            var dXY = Math.sqrt(Math.pow(pos.x - llp.x, 2) + Math.pow(pos.y - llp.y, 2));
            var dZ  = Math.abs(pos.z - llp.z);
            if (dXY >= 0.2 || dZ >= 0.5) shouldLog = true;
          }
          if (shouldLog) {
            var dxStr = llp ? (pos.x - llp.x).toFixed(3) : '—';
            var dyStr = llp ? (pos.y - llp.y).toFixed(3) : '—';
            var dzStr = llp ? (pos.z - llp.z).toFixed(3) : '—';
            var dxyStr = llp ? Math.sqrt(Math.pow(pos.x - llp.x, 2) + Math.pow(pos.y - llp.y, 2)).toFixed(3) : '—';
            var logLine = '[PVIZ LIVE] X=' + pos.x.toFixed(3) + ' Y=' + pos.y.toFixed(3) + ' Z=' + pos.z.toFixed(3)
              + ' dXY=' + dxyStr + ' dx=' + dxStr + ' dy=' + dyStr + ' dz=' + dzStr;
            smAppendLog('sm-pviz-live-log', logLine);
            _smPvizLiveLogLastPos = { x: pos.x, y: pos.y, z: pos.z };
          }
        }
      }
      _smPvizScheduleTrack();
    }).catch(function() { _smPvizScheduleTrack(); });
  }, 200); // poll at ~5 Hz
}

function _smPvizUpdateProbeHeight(z) {
  if (_smPvizViewMode !== 'tilt') return; // top-down: CSS class handles visual state; no Z translate needed
  var body = document.getElementById('sm-pviz-probe-body');
  var cfg = window._smPvizCfg;
  if (!body || !cfg || !cfg.clearanceZ) return;
  // Estimate surface Z from lowest collected contact
  var contacts = window._smPvizContacts;
  var surfZ = null;
  if (contacts && contacts.length > 0) {
    surfZ = contacts[0].z;
    for (var ci = 1; ci < contacts.length; ci++) {
      if (contacts[ci].z < surfZ) surfZ = contacts[ci].z;
    }
  }
  if (surfZ === null) surfZ = z - cfg.clearanceZ; // estimate: current Z is near clearance height
  var travelZ = surfZ + cfg.clearanceZ;
  var zRange = Math.max(0.5, travelZ - surfZ);
  var zFrac = Math.max(0, Math.min(1, (z - surfZ) / zRange));
  var cssZ = 4 + zFrac * (52 - 4); // 4px at surface → 52px at clearance height
  body.style.transform = 'translateZ(' + cssZ.toFixed(1) + 'px)';
}

function smPvizUpdatePartialMesh() {
  var meshEl = document.getElementById('sm-pviz-mesh');
  if (!meshEl) return;
  var contacts = window._smPvizContacts;
  var grid     = window._smPvizGrid;
  var cfg      = window._smPvizCfg;
  if (!contacts || contacts.length === 0 || !cfg) {
    while (meshEl.firstChild) meshEl.removeChild(meshEl.firstChild);
    meshEl.classList.remove('mesh-active');
    return;
  }
  while (meshEl.firstChild) meshEl.removeChild(meshEl.firstChild);

  // Compute Z range across all contacts
  var zMin = contacts[0].z, zMax = contacts[0].z;
  for (var zi = 1; zi < contacts.length; zi++) {
    if (contacts[zi].z < zMin) zMin = contacts[zi].z;
    if (contacts[zi].z > zMax) zMax = contacts[zi].z;
  }
  var zRange = Math.max(0.5, zMax - zMin);

  var spanX    = (cfg.maxX - cfg.minX) || 1;
  var spanY    = (cfg.maxY - cfg.minY) || 1;
  var rowCount = cfg.rowCount || 1;
  var colCount = cfg.colCount || 1;

  // Read toggle state (defaults to on)
  var surfToggle = document.getElementById('sm-pviz-surface-toggle');
  var wireToggle = document.getElementById('sm-pviz-wireframe-toggle');
  var showSurface   = surfToggle ? surfToggle.checked : true;
  var showWireframe = wireToggle ? wireToggle.checked : true;

  // Map work-coordinate (x, y) → SVG viewport [0-100, 0-100]
  // X right → left increases; Y away → top decreases (top:0% = visual top = Y-max)
  function toSVG(x, y) {
    return {
      sx: (x - cfg.minX) / spanX * 100,
      sy: 100 - (y - cfg.minY) / spanY * 100
    };
  }

  // Map Z value → rgb color (0=high→green, 1=low→orange)
  function zColor(z) {
    var t = Math.max(0, Math.min(1, (zMax - z) / zRange));
    var r = Math.round((1 - t) * 95  + t * 255);
    var g = Math.round((1 - t) * 211 + t * 90);
    var b = Math.round((1 - t) * 141 + t * 50);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  var NS = 'http://www.w3.org/2000/svg';

  // ── Surface mesh (triangulated quads) ────────────────────────────────────────
  if (showSurface && grid) {
    for (var ri = 0; ri < rowCount - 1; ri++) {
      for (var ci = 0; ci < colCount - 1; ci++) {
        var p00 = grid[ri]     && grid[ri][ci];
        var p01 = grid[ri]     && grid[ri][ci + 1];
        var p10 = grid[ri + 1] && grid[ri + 1][ci];
        var p11 = grid[ri + 1] && grid[ri + 1][ci + 1];

        // Triangle A: (ri,ci) → (ri,ci+1) → (ri+1,ci)
        if (p00 && p01 && p10) {
          var s00 = toSVG(p00.x, p00.y);
          var s01 = toSVG(p01.x, p01.y);
          var s10 = toSVG(p10.x, p10.y);
          var avgZa = (p00.z + p01.z + p10.z) / 3;
          var polyA = document.createElementNS(NS, 'polygon');
          polyA.setAttribute('points',
            s00.sx.toFixed(3) + ',' + s00.sy.toFixed(3) + ' ' +
            s01.sx.toFixed(3) + ',' + s01.sy.toFixed(3) + ' ' +
            s10.sx.toFixed(3) + ',' + s10.sy.toFixed(3));
          polyA.setAttribute('fill', zColor(avgZa));
          polyA.setAttribute('opacity', '0.72');
          meshEl.appendChild(polyA);
        }

        // Triangle B: (ri,ci+1) → (ri+1,ci+1) → (ri+1,ci)
        if (p01 && p11 && p10) {
          var s01b = toSVG(p01.x, p01.y);
          var s11  = toSVG(p11.x, p11.y);
          var s10b = toSVG(p10.x, p10.y);
          var avgZb = (p01.z + p11.z + p10.z) / 3;
          var polyB = document.createElementNS(NS, 'polygon');
          polyB.setAttribute('points',
            s01b.sx.toFixed(3) + ',' + s01b.sy.toFixed(3) + ' ' +
            s11.sx.toFixed(3)  + ',' + s11.sy.toFixed(3)  + ' ' +
            s10b.sx.toFixed(3) + ',' + s10b.sy.toFixed(3));
          polyB.setAttribute('fill', zColor(avgZb));
          polyB.setAttribute('opacity', '0.72');
          meshEl.appendChild(polyB);
        }
      }
    }
  }

  // ── Wireframe grid (lines connecting adjacent sampled points) ────────────────
  if (showWireframe && grid) {
    // Horizontal edges (along column axis for each row)
    for (var wri = 0; wri < rowCount; wri++) {
      var prev = null;
      for (var wci = 0; wci < colCount; wci++) {
        var wp = grid[wri] && grid[wri][wci];
        if (wp && prev) {
          var sp = toSVG(prev.x, prev.y);
          var sc = toSVG(wp.x,   wp.y);
          var ln = document.createElementNS(NS, 'line');
          ln.setAttribute('x1', sp.sx.toFixed(3)); ln.setAttribute('y1', sp.sy.toFixed(3));
          ln.setAttribute('x2', sc.sx.toFixed(3)); ln.setAttribute('y2', sc.sy.toFixed(3));
          ln.setAttribute('stroke', 'rgba(120,190,255,0.65)');
          ln.setAttribute('stroke-width', '0.6');
          meshEl.appendChild(ln);
        }
        prev = wp || null;
      }
    }
    // Vertical edges (along row axis for each column)
    for (var vci = 0; vci < colCount; vci++) {
      var prev2 = null;
      for (var vri = 0; vri < rowCount; vri++) {
        var vp = grid[vri] && grid[vri][vci];
        if (vp && prev2) {
          var sp2 = toSVG(prev2.x, prev2.y);
          var sc2 = toSVG(vp.x,    vp.y);
          var ln2 = document.createElementNS(NS, 'line');
          ln2.setAttribute('x1', sp2.sx.toFixed(3)); ln2.setAttribute('y1', sp2.sy.toFixed(3));
          ln2.setAttribute('x2', sc2.sx.toFixed(3)); ln2.setAttribute('y2', sc2.sy.toFixed(3));
          ln2.setAttribute('stroke', 'rgba(120,190,255,0.65)');
          ln2.setAttribute('stroke-width', '0.6');
          meshEl.appendChild(ln2);
        }
        prev2 = vp || null;
      }
    }
  }

  meshEl.classList.add('mesh-active');
}

function smPvizInit(cfg) {
  window._smPvizCfg = cfg;
  window._smPvizContacts = [];
  // initialise 2D grid storage for mesh connectivity (row × col, filled on contact)
  window._smPvizGrid = [];
  for (var _gi = 0; _gi < (cfg.rowCount || 1); _gi++) {
    var _row = [];
    for (var _gj = 0; _gj < (cfg.colCount || 1); _gj++) { _row.push(null); }
    window._smPvizGrid.push(_row);
  }
  // reset probe sequence recording
  smPvizProbeSequence = [];
  _smPvizSeqLastTime = Date.now();
  // Reset live movement log position tracker
  _smPvizLiveLogLastPos = null;
  // Stop any previous live tracking
  smPvizStopLiveTracking();
  // Hide Three.js canvas so probe animation is visible during probing
  var smThreeWrap = document.getElementById('sm-three-canvas');
  if (smThreeWrap) smThreeWrap.classList.remove('three-active');
  // clear previous contact dots
  var surf = document.getElementById('sm-pviz-surface');
  if (surf) {
    var oldDots = surf.querySelectorAll('.sm-pviz-dot');
    for (var i = 0; i < oldDots.length; i++) oldDots[i].remove();
  }
  // clear progressive SVG mesh
  var meshEl = document.getElementById('sm-pviz-mesh');
  if (meshEl) {
    while (meshEl.firstChild) meshEl.removeChild(meshEl.firstChild);
    meshEl.classList.remove('mesh-active');
  }
  // set grid lines to match actual probe grid spacing
  if (surf && cfg && cfg.colCount > 1 && cfg.rowCount > 1) {
    var colPct = (100 / (cfg.colCount - 1)).toFixed(4);
    var rowPct = (100 / (cfg.rowCount - 1)).toFixed(4);
    surf.style.backgroundSize = colPct + '% ' + rowPct + '%';
  }
  // reset probe to starting corner
  var wrap = document.getElementById('sm-pviz-probe-wrap');
  if (wrap) { wrap.style.left = '0%'; wrap.style.top = '100%'; }
  var body = document.getElementById('sm-pviz-probe-body');
  if (body) { body.className = ''; body.style.transform = ''; }
  // Start live machine position tracking so probe follows machine directly
  smPvizStartLiveTracking();
}
function smPvizSetState(state) {
  var body = document.getElementById('sm-pviz-probe-body');
  if (!body) return;
  body.classList.remove('probe-plunging', 'probe-contact');
  // Clear any inline transform so CSS state class (translateY in top-down, translateZ in tilt) takes effect
  body.style.transform = '';
  void body.offsetWidth; // force reflow so CSS animations restart cleanly
  if (state === 'plunging') body.classList.add('probe-plunging');
  else if (state === 'contact') body.classList.add('probe-contact');
}
// ── Probe Visualizer view mode: 'top' (default) or 'tilt' ────────────────────
var _smPvizViewMode = 'top';
function smPvizSetViewMode(mode) {
  _smPvizViewMode = (mode === 'tilt') ? 'tilt' : 'top';
  var scene = document.getElementById('sm-pviz-scene');
  if (scene) {
    if (_smPvizViewMode === 'tilt') scene.classList.add('sm-pviz-tilt');
    else scene.classList.remove('sm-pviz-tilt');
  }
  // Update toggle button visual state
  var btnTop  = document.getElementById('sm-pviz-view-topdown');
  var btnTilt = document.getElementById('sm-pviz-view-tilt');
  if (btnTop)  { btnTop.setAttribute('aria-pressed',  _smPvizViewMode === 'top'  ? 'true' : 'false'); btnTop.style.borderColor  = _smPvizViewMode === 'top'  ? 'var(--accent)' : ''; }
  if (btnTilt) { btnTilt.setAttribute('aria-pressed', _smPvizViewMode === 'tilt' ? 'true' : 'false'); btnTilt.style.borderColor = _smPvizViewMode === 'tilt' ? 'var(--accent)' : ''; }
  // In tilt mode, apply current drag rotation; in top-down, clear inline transform on 3dscene
  if (_smPvizViewMode === 'tilt') {
    pvizApplyAllRotations();
  } else {
    var sc = document.getElementById('sm-pviz-3dscene');
    if (sc) sc.style.transform = '';
  }
}
function smPvizXYtoPos(x, y) {
  var cfg = window._smPvizCfg;
  if (!cfg) return { left: 50, top: 50 };
  var spanX = (cfg.maxX - cfg.minX) || 1;
  var spanY = (cfg.maxY - cfg.minY) || 1;
  var leftPct = Math.max(0, Math.min(100, (x - cfg.minX) / spanX * 100));
  // Inverted Y: top:100% = front of 3D view (near viewer, Y=minY); top:0% = back (far, Y=maxY)
  var topPct  = Math.max(0, Math.min(100, 100 - (y - cfg.minY) / spanY * 100));
  return { left: leftPct, top: topPct };
}
// Helper: returns z-component of the unit face normal for a triangle (used for shading).
// Pass exaggerated Z values so normal variation is meaningful on nearly-flat surfaces.
function pvizFaceNormal(x0, y0, z0, x1, y1, z1, x2, y2, z2) {
  var e1x = x1-x0, e1y = y1-y0, e1z = z1-z0;
  var e2x = x2-x0, e2y = y2-y0, e2z = z2-z0;
  var nx = e1y*e2z - e1z*e2y;
  var ny = e1z*e2x - e1x*e2z;
  var nz = e1x*e2y - e1y*e2x; // z-component of cross product
  var len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
  return nz / len; // positive = upward-facing
}
function smPvizRecordEvent(state, opts) {
  if (!state) return; // skip null/initial call
  var now = Date.now();
  var delay = Math.max(0, now - _smPvizSeqLastTime);
  _smPvizSeqLastTime = now;
  var ev = { type: state, delay: delay };
  if (opts.x !== undefined) ev.x = opts.x;
  if (opts.y !== undefined) ev.y = opts.y;
  if (opts.contactZ !== undefined) ev.z = opts.contactZ;
  if (opts.point !== undefined) ev.point = opts.point;
  if (opts.total !== undefined) ev.total = opts.total;
  if (opts.pct !== undefined) ev.pct = opts.pct;
  if (opts.action !== undefined) ev.action = opts.action;
  smPvizProbeSequence.push(ev);
}

function smPvizUpdate(state, opts) {
  opts = opts || {};
  smPvizSetState(state);
  smPvizRecordEvent(state, opts);
  var stateLabels = { traveling: 'Traveling...', plunging: 'Probing...', contact: '✓ Contact!', complete: '✓ Complete — Surface mapped', error: 'Error' };
  var label = opts.action || stateLabels[state] || 'Ready';
  var statusEl = document.getElementById('sm-pviz-status');
  if (statusEl) {
    statusEl.textContent = label;
    statusEl.style.color = (state === 'contact' || state === 'complete') ? 'var(--good)' : state === 'error' ? 'var(--bad)' : 'var(--text)';
  }
  var pointEl = document.getElementById('sm-pviz-point');
  if (pointEl && opts.point !== undefined) pointEl.textContent = opts.point + ' / ' + (opts.total !== undefined ? opts.total : '?');
  var posEl = document.getElementById('sm-pviz-pos');
  if (posEl && opts.x !== undefined) posEl.textContent = 'X' + Number(opts.x).toFixed(3) + ' Y' + Number(opts.y).toFixed(3);
  var zEl = document.getElementById('sm-pviz-z');
  if (zEl && opts.contactZ !== undefined) zEl.textContent = Number(opts.contactZ).toFixed(3);
  var pct = opts.pct !== undefined ? Math.max(0, Math.min(100, opts.pct)) : undefined;
  var barEl = document.getElementById('sm-pviz-bar');
  if (barEl && pct !== undefined) barEl.style.width = pct + '%';
  var pctEl = document.getElementById('sm-pviz-pct');
  if (pctEl && pct !== undefined) pctEl.textContent = Math.round(pct) + '%';
  // move probe in 3D X/Y — skip when live tracking is active (live tracking owns probe motion)
  if (opts.x !== undefined && opts.y !== undefined && !_smPvizTrackActive) {
    var pos = smPvizXYtoPos(opts.x, opts.y);
    var wrap = document.getElementById('sm-pviz-probe-wrap');
    if (wrap) { wrap.style.left = pos.left + '%'; wrap.style.top = pos.top + '%'; }
  }
  // add contact dot on the surface, update progressive mesh
  if (state === 'contact' && opts.x !== undefined) {
    // store contact point for mesh rendering
    if (!window._smPvizContacts) window._smPvizContacts = [];
    if (opts.contactZ !== undefined) {
      window._smPvizContacts.push({ x: opts.x, y: opts.y, z: opts.contactZ });
      // store in 2D grid for triangulated mesh connectivity
      var _pvCfg = window._smPvizCfg;
      if (_pvCfg && window._smPvizGrid) {
        var _gSpanX = (_pvCfg.maxX - _pvCfg.minX) || 1;
        var _gSpanY = (_pvCfg.maxY - _pvCfg.minY) || 1;
        var _gci = _pvCfg.colCount > 1 ? Math.round((opts.x - _pvCfg.minX) / _gSpanX * (_pvCfg.colCount - 1)) : 0;
        var _gri = _pvCfg.rowCount > 1 ? Math.round((opts.y - _pvCfg.minY) / _gSpanY * (_pvCfg.rowCount - 1)) : 0;
        _gci = Math.max(0, Math.min(_pvCfg.colCount - 1, _gci));
        _gri = Math.max(0, Math.min(_pvCfg.rowCount - 1, _gri));
        if (!window._smPvizGrid[_gri]) window._smPvizGrid[_gri] = [];
        window._smPvizGrid[_gri][_gci] = { x: opts.x, y: opts.y, z: opts.contactZ };
      }
    }
    var surf = document.getElementById('sm-pviz-surface');
    if (surf) {
      var dpos = smPvizXYtoPos(opts.x, opts.y);
      var dot = document.createElement('div');
      dot.className = 'sm-pviz-dot';
      dot.style.left = dpos.left + '%';
      dot.style.top  = dpos.top + '%';
      // Contact dot: always start orange (immediate activation indicator), then update
      // existing dots to Z-depth coloring so the newest dot stands out as orange
      var contacts = window._smPvizContacts;
      var zMin = contacts[0].z, zMax = contacts[0].z;
      for (var ci = 1; ci < contacts.length; ci++) {
        if (contacts[ci].z < zMin) zMin = contacts[ci].z;
        if (contacts[ci].z > zMax) zMax = contacts[ci].z;
      }
      var zRange = Math.max(1, zMax - zMin);
      // Recolor all existing dots to Z-depth gradient
      var oldDots = surf.querySelectorAll('.sm-pviz-dot');
      for (var di = 0; di < oldDots.length; di++) {
        var dc = contacts[di];
        if (!dc) continue;
        var depth = Math.max(0, Math.min(1, (zMax - dc.z) / zRange));
        var dr = Math.round((1 - depth) * 95 + depth * 255);
        var dg = Math.round((1 - depth) * 211 + depth * 90);
        var db = Math.round((1 - depth) * 141 + depth * 50);
        var dColor = 'rgb(' + dr + ',' + dg + ',' + db + ')';
        oldDots[di].style.background = dColor;
        oldDots[di].style.boxShadow = '0 0 5px ' + dColor;
      }
      // New dot always orange to immediately show probe activation
      var orange = '#ff6a20';
      dot.style.background = orange;
      dot.style.boxShadow = '0 0 7px ' + orange + ', 0 0 3px #fff4';
      surf.appendChild(dot);
    }
    // Update progressive mesh surface
    smPvizUpdatePartialMesh();
  }
  // on complete: stop live tracking, render final mesh, then switch back to heatmap view
  if (state === 'complete' || state === 'error') {
    smPvizStopLiveTracking();
  }
  if (state === 'complete') {
    setTimeout(function() {
      smPvizRenderMesh();
      setTimeout(function() {
        showProbeHeatmapView('sm');
        setTimeout(renderSurfaceReliefMap, 60);
      }, 900);
    }, 700);
  }
  // when probing starts, ensure the terrain panel is visible for the probe animation
  if (state === 'traveling' || state === 'plunging') {
    showProbeTerrainView('sm');
  }
}

// ── Unified 3D Mesh Renderer ──────────────────────────────────────────────────
// SVG polygon rendering removed — Three.js WebGL renderer handles all 3D terrain views.
// renderUnified3D is kept as a legacy stub for backward compatibility.
function renderUnified3D(prefix) {
  renderThreeUnified3D(prefix);
}

function smPvizRenderMesh() {
  renderThreeUnified3D('sm');
}

// ── Probe mode view toggle (2D Heatmap ↔ 3D Terrain) ─────────────────────────
// prefix: 'sm' (surface) | 'face' (face) — toggles between heatmap and 3D terrain panels.
function toggleProbeModeView(prefix) {
  var heatmapPanel  = document.getElementById(prefix + '-heatmap-panel');
  var terrainPanel  = document.getElementById(prefix + '-terrain-panel');
  if (!heatmapPanel || !terrainPanel) return;
  var showingHeatmap = terrainPanel.style.display === 'none';
  if (showingHeatmap) {
    // Switch to 3D terrain
    heatmapPanel.style.display  = 'none';
    terrainPanel.style.display  = '';
    // Render Three.js terrain into the now-visible scene
    setTimeout(function() {
      if (prefix === 'sm') smPvizRenderMesh();
      else renderThreeUnified3D(prefix);
    }, 60);
  } else {
    // Switch to 2D heatmap
    terrainPanel.style.display  = 'none';
    heatmapPanel.style.display  = '';
    // Re-render the canvas heatmap now that the panel is visible
    setTimeout(function() {
      if (prefix === 'sm') renderSurfaceReliefMap();
      else renderFaceReliefMap();
    }, 60);
  }
}

// Show the 3D terrain panel for a probe mode (used during probing animation).
function showProbeTerrainView(prefix) {
  var heatmapPanel = document.getElementById(prefix + '-heatmap-panel');
  var terrainPanel = document.getElementById(prefix + '-terrain-panel');
  if (heatmapPanel) heatmapPanel.style.display = 'none';
  if (terrainPanel) terrainPanel.style.display = '';
}

// Show the 2D heatmap panel for a probe mode (used after probing completes).
function showProbeHeatmapView(prefix) {
  var heatmapPanel = document.getElementById(prefix + '-heatmap-panel');
  var terrainPanel = document.getElementById(prefix + '-terrain-panel');
  if (terrainPanel) terrainPanel.style.display = 'none';
  if (heatmapPanel) heatmapPanel.style.display = '';
}

// ── Unified Visualizer: shared rotation state (kept for legacy/probe animation) ─
var _pvizRotX = 60, _pvizRotY = 0, _pvizRotZ = -35;
var _pvizDragActive = false, _pvizDragLastX = 0, _pvizDragLastY = 0;

function pvizApplyAllRotations() {
  var t = 'rotateX(' + _pvizRotX + 'deg) rotateY(' + _pvizRotY + 'deg) rotateZ(' + _pvizRotZ + 'deg)';
  ['sm-pviz-3dscene', 'res-pviz-3dscene', 'surf-pviz-3dscene'].forEach(function(id) {
    // Skip sm-pviz-3dscene when in top-down mode (rotation controlled by CSS .sm-pviz-tilt class)
    if (id === 'sm-pviz-3dscene' && _smPvizViewMode !== 'tilt') return;
    var el = document.getElementById(id); if (el) el.style.transform = t;
  });
}

function pvizResetView() {
  _pvizRotX = 60; _pvizRotY = 0; _pvizRotZ = -35;
  pvizApplyAllRotations();
  // Reset Three.js cameras for unified visualizers.
  // Face-only views use a frontal camera; all others use the isometric default.
  var _faceOnlySet = { 'face': true, 'resface': true, 'relief': true };
  ['sm', 'res', 'surf', 'face', 'resface', 'relief', 'comb'].forEach(function(p) {
    var s = _threeState[p];
    if (!s || !s.controls) return;
    if (_faceOnlySet[p]) {
      s.camera.position.set(0, 30, 200);
    } else {
      s.camera.position.set(120, 80, 120);
    }
    s.camera.lookAt(0, 0, 0); s.controls.reset();
  });
}

// Legacy aliases kept for backward compat
function resVizResetView()  { pvizResetView(); }
function surfVizResetView() { pvizResetView(); }

function initPvizRotation(sceneId) {
  // OrbitControls on the Three.js canvas handles drag/rotate/zoom/pan.
  // Wire up the reset button (z-index:10 overlay) and dblclick reset once per scene.
  // Note: face-pviz-scene uses initFacePVizRotation (calls facePVizResetView instead
  // of pvizResetView) and comb-pviz-scene uses initCombVizRotation.
  var scene = document.getElementById(sceneId);
  if (!scene || scene._pvizRotInited) return;
  scene._pvizRotInited = true;
  // Map scene ID to the corresponding reset-button ID (face/comb handled separately)
  var prefixMap = { 'sm-pviz-scene': 'sm', 'res-pviz-scene': 'res', 'surf-pviz-scene': 'surf', 'resface-pviz-scene': 'resface' };
  var prefix = prefixMap[sceneId];
  scene.addEventListener('dblclick', pvizResetView);
  var resetBtnId = prefix ? (prefix + '-pviz-reset-btn') : null;
  var resetBtn = resetBtnId ? document.getElementById(resetBtnId) : null;
  if (resetBtn && !resetBtn._pvizResetInited) {
    resetBtn._pvizResetInited = true;
    resetBtn.addEventListener('click', function(e) { e.stopPropagation(); pvizResetView(); });
  }
}

// Legacy aliases
function smPvizInitRotation() { initPvizRotation('sm-pviz-scene'); }
function initResVizRotation()  { initPvizRotation('res-pviz-scene'); }

function renderResVizMesh() {
  renderThreeUnified3D('res');
}

// ── Results Tab Face 3D Visualizer ────────────────────────────────────────────
function initResFaceVizRotation() { initPvizRotation('resface-pviz-scene'); }

function resFaceVizResetView() {
  var s = _threeState['resface'];
  // Frontal camera: Machine-X horizontal, Machine-Z vertical — matches XZ face relief map
  if (s && s.controls) { s.camera.position.set(0, 30, 200); s.camera.lookAt(0, 0, 0); s.controls.reset(); }
}

function renderResFaceVizMesh() {
  renderThreeUnified3D('resface');
}

// ── Surface Mesh Tab 3D Visualizer ────────────────────────────────────────────
function initSurfVizRotation() { initPvizRotation('surf-pviz-scene'); }

function renderSurfVizMesh() {
  renderThreeUnified3D('surf');
}

// ── Relief Map Visualization ──────────────────────────────────────────────────

function zToColorRelief(t) {
  // Multi-stop gradient: blue → cyan → green → yellow → orange → red
  var stops = [
    {t: 0.0, r: 0,   g: 0,   b: 255},
    {t: 0.2, r: 0,   g: 255, b: 255},
    {t: 0.4, r: 0,   g: 255, b: 0},
    {t: 0.6, r: 255, g: 255, b: 0},
    {t: 0.8, r: 255, g: 136, b: 0},
    {t: 1.0, r: 255, g: 0,   b: 0}
  ];
  t = Math.max(0, Math.min(1, t));
  var i = 0;
  while (i < stops.length - 1 && t > stops[i + 1].t) i++;
  var s0 = stops[i], s1 = stops[i + 1];
  var f = (t - s0.t) / (s1.t - s0.t);
  return {
    r: Math.round(s0.r + f * (s1.r - s0.r)),
    g: Math.round(s0.g + f * (s1.g - s0.g)),
    b: Math.round(s0.b + f * (s1.b - s0.b))
  };
}

// Returns false if the element is inside a .tab-panel that is not currently active.
// Used to skip expensive off-screen renders when a canvas lives in a hidden tab.
function _isInActiveTabPanel(el) {
  var node = el ? el.parentNode : null;
  while (node && node !== document.body) {
    if (node.classList && node.classList.contains('tab-panel')) {
      return node.classList.contains('active');
    }
    node = node.parentNode;
  }
  return true; // no tab-panel ancestor found — assume visible
}

// renderReliefMap: renders a canvas-based topographic heatmap.
// points: array of {px, py, val} where px/py are data coordinates and val is
//         the value mapped to color (e.g. Z for surface, Y-contact for face).
// cfg: { xLabel, yLabel, valueLabel, contourInterval, gridCols, gridRows }
//      gridCols/gridRows: number of unique x/y positions (used for bilinear interp)
// The points array must be on a regular grid sorted by py ascending then px ascending.
function renderReliefMap(canvasId, tooltipId, points, cfg) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Collect unique sorted px and py values — cache toFixed(6) keys to avoid
  // redundant floating-point formatting across the three phases below.
  var pxSet = {}, pySet = {};
  var pxKeys = new Array(points.length), pyKeys = new Array(points.length);
  points.forEach(function(p, i) {
    var kx = p.px.toFixed(6), ky = p.py.toFixed(6);
    pxSet[kx] = p.px; pySet[ky] = p.py;
    pxKeys[i] = kx; pyKeys[i] = ky;
  });
  var xs = Object.values(pxSet).sort(function(a, b) { return a - b; });
  var ys = Object.values(pySet).sort(function(a, b) { return a - b; });
  var nCols = xs.length, nRows = ys.length;
  if (nCols < 2 || nRows < 2) return;

  // Build lookup grid[col][row] = val — reuse cached keys
  var xIdx = {}, yIdx = {};
  xs.forEach(function(v, i) { xIdx[v.toFixed(6)] = i; });
  ys.forEach(function(v, i) { yIdx[v.toFixed(6)] = i; });
  var grid = [];
  for (var c = 0; c < nCols; c++) { grid.push(new Array(nRows).fill(null)); }
  points.forEach(function(p, i) {
    var ci = xIdx[pxKeys[i]], ri = yIdx[pyKeys[i]];
    if (ci != null && ri != null) grid[ci][ri] = p.val;
  });

  // Value range
  var valMin = Infinity, valMax = -Infinity;
  points.forEach(function(p) { if (p.val < valMin) valMin = p.val; if (p.val > valMax) valMax = p.val; });
  var valSpan = (valMax - valMin) || 1;

  // Canvas sizing
  var padL = 54, padR = 70, padT = 22, padB = 36;
  var aspectRatio = (ys[nRows-1] - ys[0]) / (xs[nCols-1] - xs[0]);
  if (!isFinite(aspectRatio) || aspectRatio <= 0) aspectRatio = 0.5;
  var containerW = canvas.offsetWidth || 600;
  var plotW = containerW - padL - padR;
  var plotH = Math.max(180, Math.min(plotW * aspectRatio, 500));
  var totalH = plotH + padT + padB;
  canvas.width = containerW;
  canvas.height = totalH;
  canvas.style.height = totalH + 'px';

  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, containerW, totalH);

  var xDataMin = xs[0], xDataMax = xs[nCols-1], xDataSpan = xDataMax - xDataMin || 1;
  var yDataMin = ys[0], yDataMax = ys[nRows-1], yDataSpan = yDataMax - yDataMin || 1;

  function dataToCanvas(px, py) {
    return {
      cx: padL + (px - xDataMin) / xDataSpan * plotW,
      cy: padT + (1 - (py - yDataMin) / yDataSpan) * plotH
    };
  }

  // Bilinear interpolation
  function bilinearVal(px, py) {
    var fx = (px - xDataMin) / xDataSpan * (nCols - 1);
    var fy = (py - yDataMin) / yDataSpan * (nRows - 1);
    var c0 = Math.floor(fx), c1 = Math.min(c0 + 1, nCols - 1);
    var r0 = Math.floor(fy), r1 = Math.min(r0 + 1, nRows - 1);
    var tx = fx - c0, ty = fy - r0;
    var v00 = grid[c0][r0], v10 = grid[c1][r0], v01 = grid[c0][r1], v11 = grid[c1][r1];
    if (v00 == null || v10 == null || v01 == null || v11 == null) {
      // Weighted-bilinear fallback for sparse grids (e.g. missed probe contacts).
      // Re-normalise bilinear weights across only the non-null corners so dark
      // patches don't appear adjacent to a single missing probe position.
      var w00 = (1-tx)*(1-ty), w10 = tx*(1-ty), w01 = (1-tx)*ty, w11 = tx*ty;
      var wSum = 0, vSum = 0;
      if (v00 != null) { wSum += w00; vSum += v00*w00; }
      if (v10 != null) { wSum += w10; vSum += v10*w10; }
      if (v01 != null) { wSum += w01; vSum += v01*w01; }
      if (v11 != null) { wSum += w11; vSum += v11*w11; }
      return wSum > 0 ? vSum / wSum : null;
    }
    return v00 * (1-tx) * (1-ty) + v10 * tx * (1-ty) + v01 * (1-tx) * ty + v11 * tx * ty;
  }

  // Render pixel-by-pixel using ImageData for performance
  var imgData = ctx.createImageData(plotW, plotH);
  var d = imgData.data;
  for (var py2 = 0; py2 < plotH; py2++) {
    var yFrac = 1 - py2 / (plotH - 1);
    var dataY = yDataMin + yFrac * yDataSpan;
    for (var px2 = 0; px2 < plotW; px2++) {
      var xFrac = px2 / (plotW - 1);
      var dataX = xDataMin + xFrac * xDataSpan;
      var val = bilinearVal(dataX, dataY);
      var idx = (py2 * plotW + px2) * 4;
      if (val == null) { d[idx]=13; d[idx+1]=17; d[idx+2]=26; d[idx+3]=255; continue; }
      var t = (val - valMin) / valSpan;
      var col = zToColorRelief(t);
      d[idx] = col.r; d[idx+1] = col.g; d[idx+2] = col.b; d[idx+3] = 255;
    }
  }
  ctx.putImageData(imgData, padL, padT);

  // Contour lines
  var interval = cfg.contourInterval || (valSpan / 6);
  if (interval > 0) {
    var firstContour = Math.ceil(valMin / interval) * interval;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    // Pre-compute per-row Y data values to avoid repeated division in the hot loop
    var plotHm1 = plotH - 1, plotWm1 = plotW - 1;
    var rowDataYa = new Float64Array(plotH);
    var rowDataYb = new Float64Array(plotH);
    for (var ry = 0; ry < plotH; ry++) {
      rowDataYa[ry] = yDataMin + (1 - ry / plotHm1) * yDataSpan;
      rowDataYb[ry] = yDataMin + (1 - (ry + 1) / plotHm1) * yDataSpan;
    }
    for (var cv = firstContour; cv <= valMax + 1e-9; cv += interval) {
      ctx.beginPath();
      for (var px3 = 0; px3 < plotWm1; px3++) {
        var dataX3a = xDataMin + (px3 / plotWm1) * xDataSpan;
        var dataX3b = xDataMin + ((px3 + 1) / plotWm1) * xDataSpan;
        for (var py3 = 0; py3 < plotHm1; py3++) {
          var v0 = bilinearVal(dataX3a, rowDataYa[py3]);
          var v1 = bilinearVal(dataX3b, rowDataYa[py3]);
          var v2 = bilinearVal(dataX3a, rowDataYb[py3]);
          var v3 = bilinearVal(dataX3b, rowDataYb[py3]);
          var a0 = v0 != null && v0 >= cv;
          var a1 = v1 != null && v1 >= cv;
          var a2 = v2 != null && v2 >= cv;
          var a3 = v3 != null && v3 >= cv;
          // Cell crosses contour threshold (some vertices above, some below)
          if ((a0 || a1 || a2 || a3) && (!a0 || !a1 || !a2 || !a3)) {
            ctx.moveTo(padL + px3 + 0.5, padT + py3 + 0.5);
            ctx.lineTo(padL + px3 + 1, padT + py3 + 0.5);
          }
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Probe point markers — batch style state outside loop.
  // Clamp marker centres so circles of radius MARK_R stay fully within the plot area
  // rather than being half-obscured by the dark axis padding at domain extremes.
  var MARK_R = 4;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.2;
  points.forEach(function(p) {
    var cp = dataToCanvas(p.px, p.py);
    var cx = Math.max(padL + MARK_R, Math.min(padL + plotW - MARK_R, cp.cx));
    var cy = Math.max(padT + MARK_R, Math.min(padT + plotH - MARK_R, cp.cy));
    ctx.beginPath();
    ctx.arc(cx, cy, MARK_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();

  // Axis labels and ticks
  ctx.save();
  ctx.fillStyle = 'var(--muted, #888)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  // X axis ticks and labels
  xs.forEach(function(xv) {
    var cx = padL + (xv - xDataMin) / xDataSpan * plotW;
    ctx.fillStyle = 'rgba(150,160,180,0.8)';
    ctx.fillRect(cx - 0.5, padT + plotH, 1, 4);
    ctx.fillStyle = 'var(--muted, #888)';
    ctx.fillText(xv.toFixed(1), cx, padT + plotH + 13);
  });
  ctx.textAlign = 'center';
  ctx.fillText(cfg.xLabel || 'X (coords)', padL + plotW / 2, totalH - 2);
  // Y axis ticks and labels — skip labels that would overlap (min 12px spacing)
  ctx.textAlign = 'right';
  var lastLabelY = -Infinity;
  ys.forEach(function(yv) {
    var cp = dataToCanvas(xs[0], yv);
    ctx.fillStyle = 'rgba(150,160,180,0.8)';
    ctx.fillRect(padL - 4, cp.cy - 0.5, 4, 1);
    if (cp.cy - lastLabelY >= 12) {
      ctx.fillStyle = 'var(--muted, #888)';
      ctx.fillText(yv.toFixed(1), padL - 6, cp.cy + 3);
      lastLabelY = cp.cy;
    }
  });
  ctx.save();
  ctx.translate(11, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(cfg.yLabel || 'Y (coords)', 0, 0);
  ctx.restore();
  ctx.restore();

  // Color legend bar
  var legendX = padL + plotW + 8, legendW = 14;
  var legendGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  var gradStops = [
    [0.0, '#FF0000'], [0.2, '#FF8800'], [0.4, '#FFFF00'],
    [0.6, '#00FF00'], [0.8, '#00FFFF'], [1.0, '#0000FF']
  ];
  gradStops.forEach(function(s) { legendGrad.addColorStop(s[0], s[1]); });
  ctx.fillStyle = legendGrad;
  ctx.fillRect(legendX, padT, legendW, plotH);
  ctx.strokeStyle = 'rgba(150,160,180,0.5)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(legendX, padT, legendW, plotH);
  // Legend ticks and labels
  ctx.fillStyle = 'var(--muted, #888)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  var nTicks = 5;
  for (var ti = 0; ti <= nTicks; ti++) {
    var tf = ti / nTicks;
    var legVal = valMax - tf * valSpan; // top = max, bottom = min
    var legY = padT + tf * plotH;
    ctx.fillStyle = 'rgba(150,160,180,0.8)';
    ctx.fillRect(legendX + legendW, legY - 0.5, 3, 1);
    ctx.fillStyle = 'var(--muted, #888)';
    ctx.fillText(legVal.toFixed(2), legendX + legendW + 5, legY + 3);
  }
  ctx.fillStyle = 'var(--muted, #888)';
  ctx.font = '9px monospace';
  ctx.save();
  ctx.translate(legendX + legendW + 42, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(cfg.valueLabel || 'Z (coords)', 0, 0);
  ctx.restore();

  // Hover tooltip
  var tooltipEl = document.getElementById(tooltipId);
  canvas.onmousemove = function(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var mx = (e.clientX - rect.left) * scaleX;
    var my = (e.clientY - rect.top) * scaleY;
    if (mx < padL || mx > padL + plotW || my < padT || my > padT + plotH) {
      if (tooltipEl) tooltipEl.textContent = 'Hover over map for values';
      return;
    }
    var fx = (mx - padL) / plotW;
    var fy = 1 - (my - padT) / plotH;
    var dataX = xDataMin + fx * xDataSpan;
    var dataY = yDataMin + fy * yDataSpan;
    var val = bilinearVal(dataX, dataY);
    if (tooltipEl && val != null) {
      tooltipEl.textContent = (cfg.xLabel || 'X') + ': ' + dataX.toFixed(3) + '  ' +
        (cfg.yLabel || 'Y') + ': ' + dataY.toFixed(3) + '  ' +
        (cfg.valueLabel || 'Z') + ': ' + val.toFixed(3);
    }
  };
  canvas.onmouseleave = function() {
    if (tooltipEl) tooltipEl.textContent = 'Hover over map for values';
  };
}

function renderSurfaceReliefMap() {
  var grid = smMeshData, cfg = smGridConfig;
  if (!grid || !cfg || cfg.rowCount < 2 || cfg.colCount < 2) {
    // No data — blank all surface relief canvases
    ['surface-relief-canvas', 'sm-surface-relief-canvas', 'res-surface-relief-canvas'].forEach(function(id) {
      var c = document.getElementById(id);
      if (c) { c.width = c.width; }
      var t = document.getElementById(id.replace('-canvas', '-tooltip'));
      if (t) t.textContent = 'Hover over map for values';
    });
    return;
  }
  var points = [];
  var zMin = Infinity, zMax = -Infinity;
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var z = grid[ri] && grid[ri][ci];
      if (z == null || !isFinite(z)) continue;
      points.push({
        px: cfg.minX + ci * cfg.colSpacing,
        py: cfg.minY + ri * cfg.rowSpacing,
        val: z
      });
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
  }
  if (points.length < 4) return;
  pluginDebug('renderSurfaceReliefMap: mode=surface projection=XY points=' + points.length + ' Z=' + zMin.toFixed(3) + ' to ' + zMax.toFixed(3));
  var reliefCfg = { xLabel: 'X (coords)', yLabel: 'Y (coords)', valueLabel: 'Z (coords)', gridCols: cfg.colCount, gridRows: cfg.rowCount };
  // Render to all surface relief canvas instances (Mesh Data tab, Probe tab, Results tab).
  // Skip any canvas whose element is not in the DOM or is inside an inactive tab panel
  // to avoid the expensive pixel-loop render on every tab switch.
  ['surface-relief-canvas', 'sm-surface-relief-canvas', 'res-surface-relief-canvas'].forEach(function(canvasId) {
    var c = document.getElementById(canvasId);
    if (!c) return;
    if (!_isInActiveTabPanel(c)) return;
    var tooltipId = canvasId.replace('-canvas', '-tooltip');
    renderReliefMap(canvasId, tooltipId, points, reliefCfg);
  });
}

function renderFaceReliefMap() {
  var data = getFaceMeshData();
  if (!data || data.length < 4) {
    // No data — blank all face relief canvases
    ['face-relief-canvas', 'res-face-relief-canvas', 'surf-face-relief-canvas'].forEach(function(id) {
      var c = document.getElementById(id);
      if (c) { c.width = c.width; }
      var t = document.getElementById(id.replace('-canvas', '-tooltip'));
      if (t) t.textContent = 'Hover over map for values';
    });
    return;
  }

  // Face probe Z depths (layerZ) are computed per-sample from sampleTopZ, so they
  // differ slightly between X positions for the same layer number.  Using actual Z
  // values as the grid row key produces a sparse grid where bilinear interpolation
  // returns null for most pixels.  Instead we use the average Z per layer as the
  // canonical row coordinate — this is the same value for every X column in the
  // same layer, giving a fully-populated rectangular grid.
  var DEFAULT_LAYER = 1;
  var xKeyToVal = {}, layerZSum = {}, layerZCnt = {};
  data.forEach(function(r) {
    // Use sampleCoord (controlled axis) when present; fall back to r.x for backward compat.
    var xv = r.sampleCoord != null ? Number(r.sampleCoord) : Number(r.x);
    var yv = r.contactCoord != null ? Number(r.contactCoord) : Number(r.y);
    var zv = Number(r.z);
    var lv = r.layer != null ? Number(r.layer) : DEFAULT_LAYER;
    if (!isFinite(xv) || !isFinite(yv) || !isFinite(zv)) return;
    var xKey = xv.toFixed(6);
    if (!(xKey in xKeyToVal)) xKeyToVal[xKey] = xv;
    if (!(lv in layerZSum)) { layerZSum[lv] = 0; layerZCnt[lv] = 0; }
    layerZSum[lv] += zv; layerZCnt[lv]++;
  });

  var xs = Object.values(xKeyToVal).sort(function(a, b) { return a - b; });
  var layers = Object.keys(layerZSum).map(Number).sort(function(a, b) { return a - b; });
  var nCols = xs.length, nRows = layers.length;
  if (nCols < 2 || nRows < 2) return;

  // Average Z depth per layer — used as the shared py coordinate for all X columns
  var layerToAvgZ = {};
  layers.forEach(function(l) { layerToAvgZ[l] = layerZSum[l] / layerZCnt[l]; });

  // Build per-(sampleCoord, layer) average contact value to handle any duplicates
  var cellSumY = {}, cellCntY = {};
  data.forEach(function(r) {
    var xv = r.sampleCoord != null ? Number(r.sampleCoord) : Number(r.x);
    var yv = r.contactCoord != null ? Number(r.contactCoord) : Number(r.y);
    var lv = r.layer != null ? Number(r.layer) : DEFAULT_LAYER;
    if (!isFinite(xv) || !isFinite(yv)) return;
    var key = xv.toFixed(6) + '|' + lv;
    if (!(key in cellSumY)) { cellSumY[key] = 0; cellCntY[key] = 0; }
    cellSumY[key] += yv; cellCntY[key]++;
  });

  var points = [];
  var valMin = Infinity, valMax = -Infinity;
  Object.keys(cellSumY).forEach(function(key) {
    var parts = key.split('|');
    var xv = parseFloat(parts[0]);
    var lv = parseInt(parts[1], 10);
    var yv = cellSumY[key] / cellCntY[key];
    var zv = layerToAvgZ[lv];
    if (!isFinite(xv) || !isFinite(yv) || !isFinite(zv)) return;
    points.push({ px: xv, py: zv, val: yv });
    if (yv < valMin) valMin = yv;
    if (yv > valMax) valMax = yv;
  });

  if (points.length < 4) return;
  pluginDebug('renderFaceReliefMap: mode=face projection=XZ points=' + points.length + ' Y-contact=' + valMin.toFixed(3) + ' to ' + valMax.toFixed(3));
  var reliefCfg = { xLabel: 'X (coords)', yLabel: 'Z depth (coords)', valueLabel: 'Y contact (coords)', gridCols: nCols, gridRows: nRows };
  // Render to all face relief canvas instances (Probe tab, Results tab, Mesh Data tab).
  // Show the Mesh Data tab face panel when face data is available.
  // Skip any canvas whose element is not in the DOM or is inside an inactive tab panel
  // to avoid the expensive pixel-loop render on every tab switch.
  var surfFacePanel = document.getElementById('surf-face-relief-panel');
  if (surfFacePanel) surfFacePanel.style.display = '';
  ['face-relief-canvas', 'res-face-relief-canvas', 'surf-face-relief-canvas'].forEach(function(canvasId) {
    var c = document.getElementById(canvasId);
    if (!c) return;
    if (!_isInActiveTabPanel(c)) return;
    var tooltipId = canvasId.replace('-canvas', '-tooltip');
    renderReliefMap(canvasId, tooltipId, points, reliefCfg);
  });
}

// ── 3D Terrain Relief Visualization ─────────────────────────────────────────

var _reliefRotX = 60;
var _reliefRotY = 0;
var _reliefRotZ = -35;

function reliefApplyRotation() {
  var el = document.getElementById('relief-3d-3dscene');
  if (el) el.style.transform = 'rotateX(' + _reliefRotX + 'deg) rotateY(' + _reliefRotY + 'deg) rotateZ(' + _reliefRotZ + 'deg)';
}

function reliefResetView() {
  _reliefRotX = 60; _reliefRotY = 0; _reliefRotZ = -35;
  reliefApplyRotation();
  // Also reset Three.js camera for relief scene — frontal view matching XZ face relief map
  var s = _threeState['relief'];
  if (s && s.controls) { s.camera.position.set(0, 30, 200); s.camera.lookAt(0, 0, 0); s.controls.reset(); }
}

function renderRelief3D() {
  // Delegate to Three.js unified renderer (face-only mode for relief-3d-scene)
  renderThreeUnified3D('relief');
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREE.JS WEBGL MESH VISUALIZER — Smooth GPU-accelerated surface + face mesh
// Replaces SVG-based polygon rendering with proper WebGL Phong-shaded geometry.
// Prefixes: 'sm' | 'res' | 'resface' | 'surf' | 'relief' | 'face' | 'comb'
// ═══════════════════════════════════════════════════════════════════════════════

var _threeState = {}; // prefix → {scene, camera, renderer, controls, animId, meshGroup, contourGroup, resizeObs}

function _threeGetOrInit(prefix) {
  if (_threeState[prefix] && _threeState[prefix].renderer) return _threeState[prefix];
  var containerId = (prefix === 'relief') ? 'relief-three-canvas' : prefix + '-three-canvas';
  var container = document.getElementById(containerId);
  if (!container) return null;
  // Dispose any stale state first
  _threeDispose(prefix);
  container.innerHTML = '';
  var w = Math.max(container.clientWidth || container.offsetWidth || 400, 100);
  // Use the scene container's defined height (sm/res/surf=250px, relief=260px)
  var h = (prefix === 'relief') ? 260 : 250;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a10);
  var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
  // Face-only views (face wall is roughly in the worldX-worldY plane): use a frontal
  // view so Machine-X appears horizontal and Machine-Z (height) appears vertical,
  // matching the XZ-projection semantics of the face relief map.
  var _faceOnlyPrefix = (prefix === 'face' || prefix === 'resface' || prefix === 'relief');
  if (_faceOnlyPrefix) {
    camera.position.set(0, 30, 200);
  } else {
    camera.position.set(120, 80, 120);
  }
  camera.lookAt(0, 0, 0);
  var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  var controls;
  if (typeof THREE.OrbitControls === 'function') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  } else {
    // Fallback built-in orbit/zoom controls when OrbitControls CDN fails to load.
    // Initial values depend on the camera mode: face-only views use a frontal position
    // (spherical: phi≈PI/2 = equator, theta=0 = front), isometric views use the
    // original (phi=1.13≈64.7°, theta=0.785≈45°).
    var _fbFaceOnly = _faceOnlyPrefix;
    var _fbDist = _fbFaceOnly ? 202 : 188; // dist matching camera.position length
    var _fbPhi  = _fbFaceOnly ? Math.PI / 2 : 1.13;  // polar angle from Y-up axis
    var _fbTheta= _fbFaceOnly ? 0            : 0.785; // azimuth around Y axis (0=+Z front)
    var _fbPanX = 0, _fbPanY = _fbFaceOnly ? 30 : 0;
    var _fbDrag = false, _fbBtn = 0, _fbPX = 0, _fbPY = 0;
    var _fbCamUpdate = function() {
      var sinP = Math.sin(_fbPhi), cosP = Math.cos(_fbPhi);
      var sinT = Math.sin(_fbTheta), cosT = Math.cos(_fbTheta);
      camera.position.set(
        _fbPanX + _fbDist * sinP * sinT,
        _fbPanY + _fbDist * cosP,
        _fbDist * sinP * cosT
      );
      camera.lookAt(_fbPanX, _fbPanY, 0);
    }
    _fbCamUpdate();
    var _fbEl = renderer.domElement;
    _fbEl.addEventListener('mousedown', function(e) {
      e.preventDefault(); _fbDrag = true; _fbBtn = e.button; _fbPX = e.clientX; _fbPY = e.clientY;
    });
    _fbEl.addEventListener('mousemove', function(e) {
      if (!_fbDrag) return;
      var dx = e.clientX - _fbPX, dy = e.clientY - _fbPY;
      _fbPX = e.clientX; _fbPY = e.clientY;
      if (_fbBtn === 0) { // left: rotate
        _fbTheta -= dx * 0.01;
        _fbPhi = Math.max(0.05, Math.min(Math.PI - 0.05, _fbPhi + dy * 0.01));
      } else if (_fbBtn === 2) { // right: pan
        var scale = _fbDist / 200;
        _fbPanX -= dx * scale * 0.3;
        _fbPanY += dy * scale * 0.3;
      }
      _fbCamUpdate();
    });
    _fbEl.addEventListener('mouseup', function() { _fbDrag = false; });
    _fbEl.addEventListener('mouseleave', function() { _fbDrag = false; });
    _fbEl.addEventListener('wheel', function(e) {
      e.preventDefault();
      _fbDist = Math.max(20, Math.min(800, _fbDist + e.deltaY * 0.3));
      _fbCamUpdate();
    }, { passive: false });
    _fbEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    var _fbResetDist  = _fbDist, _fbResetPhi = _fbPhi, _fbResetTheta = _fbTheta;
    var _fbResetPanY  = _fbPanY;
    controls = {
      update: function() {},
      reset: function() { _fbDist = _fbResetDist; _fbPhi = _fbResetPhi; _fbTheta = _fbResetTheta; _fbPanX = 0; _fbPanY = _fbResetPanY; _fbCamUpdate(); },
      enableDamping: false, mouseButtons: {}
    };
    console.warn('THREE.OrbitControls not available — using built-in fallback controls');
  }
  // Lighting: ambient + two directional lights for Phong shading
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  var dl1 = new THREE.DirectionalLight(0xffffff, 0.8); dl1.position.set(1, 2, 1); scene.add(dl1);
  var dl2 = new THREE.DirectionalLight(0x6688cc, 0.3); dl2.position.set(-1, 0.5, -1); scene.add(dl2);
  var state = { scene: scene, camera: camera, renderer: renderer, controls: controls,
                animId: null, meshGroup: null, contourGroup: null, resizeObs: null };
  _threeState[prefix] = state;
  // Skip rendering while the tab is hidden to save CPU/GPU across all 3D scenes
  (function animate() { state.animId = requestAnimationFrame(animate); if (!document.hidden) { controls.update(); renderer.render(scene, camera); } })();
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function() {
      var nw = container.clientWidth;
      if (nw > 10) { renderer.setSize(nw, h); camera.aspect = nw / h; camera.updateProjectionMatrix(); }
    });
    ro.observe(container);
    state.resizeObs = ro;
  }
  return state;
}

function _threeDispose(prefix) {
  var s = _threeState[prefix]; if (!s) return;
  if (s.animId) cancelAnimationFrame(s.animId);
  if (s.resizeObs) s.resizeObs.disconnect();
  if (s.renderer) { s.renderer.dispose(); var dom = s.renderer.domElement; if (dom && dom.parentNode) dom.parentNode.removeChild(dom); }
  delete _threeState[prefix];
}

// Color gradient: t=0 (low/deep) → blue/purple, t=1 (high/shallow) → red/orange
function _threeZCol(z, zMin, zMax) {
  var t = (zMax > zMin) ? Math.max(0, Math.min(1, (z - zMin) / (zMax - zMin))) : 0.5;
  var r, g, b, f;
  if (t < 0.25)      { f = t / 0.25;          r = 0;             g = Math.round(f * 128);       b = Math.round(180 + f * 75); }
  else if (t < 0.5)  { f = (t - 0.25) / 0.25; r = 0;             g = Math.round(128 + f * 127); b = Math.round(255 - f * 255); }
  else if (t < 0.75) { f = (t - 0.5) / 0.25;  r = Math.round(f * 255); g = 255; b = 0; }
  else               { f = (t - 0.75) / 0.25;  r = 255;           g = Math.round(255 - f * 180); b = 0; }
  return [r / 255, g / 255, b / 255];
}

// ── Mesh Subdivision Utilities ────────────────────────────────────────────────
var MIN_SUBDIVISION_SPACING = 0.5;  // mm — values below this are clamped to prevent millions of points
var MAX_SUBDIVISION_POINTS  = 500000; // abort subdivision if output would exceed this many points

/**
 * subdivideSurfaceMesh(grid, cfg, spacing)
 * Densifies a surface probe grid using bilinear interpolation.
 * Returns { grid, config } with updated colCount/rowCount/colSpacing/rowSpacing.
 * spacing = target point spacing in mm (e.g. 2). 0 / falsy = no subdivision.
 */
function subdivideSurfaceMesh(grid, cfg, spacing) {
  if (!grid || !cfg || !spacing || spacing <= 0) return { grid: grid, config: cfg };
  // Safety clamp: prevent dangerously small spacing that generates millions of points
  if (spacing < MIN_SUBDIVISION_SPACING) {
    console.warn('subdivideSurfaceMesh: spacing ' + spacing + 'mm is below minimum ' + MIN_SUBDIVISION_SPACING + 'mm — clamping to ' + MIN_SUBDIVISION_SPACING + 'mm to prevent browser lockup.');
    spacing = MIN_SUBDIVISION_SPACING;
  }
  var nRows = cfg.rowCount, nCols = cfg.colCount;
  if (nRows < 2 || nCols < 2) return { grid: grid, config: cfg };

  var colSub = Math.max(1, Math.round(cfg.colSpacing / spacing));
  var rowSub = Math.max(1, Math.round(cfg.rowSpacing / spacing));
  if (colSub === 1 && rowSub === 1) return { grid: grid, config: cfg };

  var newCols = (nCols - 1) * colSub + 1;
  var newRows = (nRows - 1) * rowSub + 1;
  // Safety: abort subdivision if output would exceed MAX_SUBDIVISION_POINTS
  if (newCols * newRows > MAX_SUBDIVISION_POINTS) {
    console.warn('subdivideSurfaceMesh: would generate ' + (newCols * newRows) + ' points (>' + MAX_SUBDIVISION_POINTS + ') — skipping subdivision to prevent browser lockup.');
    return { grid: grid, config: cfg };
  }

  var newGrid = [];
  for (var gy = 0; gy < newRows; gy++) {
    var row = [];
    var cy = Math.min(Math.floor(gy / rowSub), nRows - 2);
    var ty = (gy - cy * rowSub) / rowSub;
    for (var gx = 0; gx < newCols; gx++) {
      var cx = Math.min(Math.floor(gx / colSub), nCols - 2);
      var tx = (gx - cx * colSub) / colSub;
      var z00 = grid[cy][cx], z10 = grid[cy][cx + 1];
      var z01 = grid[cy + 1][cx], z11 = grid[cy + 1][cx + 1];
      if (z00 == null || z10 == null || z01 == null || z11 == null ||
          !isFinite(z00) || !isFinite(z10) || !isFinite(z01) || !isFinite(z11)) {
        row.push(null);
      } else {
        row.push(z00 * (1 - tx) * (1 - ty) + z10 * tx * (1 - ty) +
                 z01 * (1 - tx) * ty + z11 * tx * ty);
      }
    }
    newGrid.push(row);
  }

  var newConfig = {};
  for (var k in cfg) { if (cfg.hasOwnProperty(k)) newConfig[k] = cfg[k]; }
  newConfig.colCount = newCols;
  newConfig.rowCount = newRows;
  newConfig.colSpacing = cfg.colSpacing / colSub;
  newConfig.rowSpacing = cfg.rowSpacing / rowSub;
  newConfig.maxX = cfg.minX + (newCols - 1) * newConfig.colSpacing;
  newConfig.maxY = cfg.minY + (newRows - 1) * newConfig.rowSpacing;

  return { grid: newGrid, config: newConfig };
}

/**
 * subdivideFaceMesh(pts, spacing)
 * Densifies a face probe point array using bilinear interpolation on the
 * X-sample × layer grid.  Returns a new flat array of interpolated points.
 * Each interpolated point inherits layer, sampleTopZ, and machineZ from
 * the nearest grid node.  spacing = target point spacing in mm. 0 = no-op.
 */
function subdivideFaceMesh(pts, spacing) {
  if (!pts || pts.length < 4 || !spacing || spacing <= 0) return pts;
  // Safety clamp: prevent dangerously small spacing that generates millions of points
  if (spacing < MIN_SUBDIVISION_SPACING) {
    console.warn('subdivideFaceMesh: spacing ' + spacing + 'mm is below minimum ' + MIN_SUBDIVISION_SPACING + 'mm — clamping to ' + MIN_SUBDIVISION_SPACING + 'mm to prevent browser lockup.');
    spacing = MIN_SUBDIVISION_SPACING;
  }

  // Collect unique X positions and unique layer numbers
  var xKeyMap = {}, layerNums = {};
  pts.forEach(function(p) {
    // Use sampleCoord (controlled axis) when present; fall back to p.x for backward compat.
    var scv = p.sampleCoord != null ? Number(p.sampleCoord) : Number(p.x);
    var ccv = p.contactCoord != null ? Number(p.contactCoord) : Number(p.y);
    var lv = p.layer != null ? Number(p.layer) : 1;
    if (!isFinite(scv) || !isFinite(ccv) || !isFinite(Number(p.z))) return;
    xKeyMap[scv.toFixed(6)] = scv;
    layerNums[lv] = true;
  });

  var xs = Object.values(xKeyMap).sort(function(a, b) { return a - b; });
  var layers = Object.keys(layerNums).map(Number).sort(function(a, b) { return a - b; });
  var nCols = xs.length, nRows = layers.length;
  if (nCols < 2 || nRows < 2) return pts;

  // Build average-Z per layer (same approach as renderFaceReliefMap)
  var layerZSum = {}, layerZCnt = {};
  pts.forEach(function(p) {
    var lv = p.layer != null ? Number(p.layer) : 1;
    var zv = Number(p.z);
    if (!isFinite(zv)) return;
    if (!(lv in layerZSum)) { layerZSum[lv] = 0; layerZCnt[lv] = 0; }
    layerZSum[lv] += zv; layerZCnt[lv]++;
  });
  var layerAvgZ = {};
  layers.forEach(function(l) { layerAvgZ[l] = layerZSum[l] / layerZCnt[l]; });

  // Build 2D grid [colIdx][rowIdx] → { cc, mx, y, machineZ, sampleTopZ }
  // cc = contactCoord (face measurement), mx = machine X, y = machine Y
  var grid = [];
  for (var ci = 0; ci < nCols; ci++) { grid.push(new Array(nRows).fill(null)); }
  var xiMap = {}, liMap = {};
  xs.forEach(function(x, i) { xiMap[x.toFixed(6)] = i; });
  layers.forEach(function(l, i) { liMap[l] = i; });

  // Average contact coord, machine X, machine Y (and machineZ, sampleTopZ) per cell
  var cellSumCC = {}, cellSumMX = {}, cellSumY = {}, cellSumMZ = {}, cellSumST = {}, cellCnt = {};
  pts.forEach(function(p) {
    var scv = p.sampleCoord != null ? Number(p.sampleCoord) : Number(p.x);
    var ccv = p.contactCoord != null ? Number(p.contactCoord) : Number(p.y);
    var mxv = Number(p.x), yv = Number(p.y);
    var lv = p.layer != null ? Number(p.layer) : 1;
    if (!isFinite(scv) || !isFinite(ccv) || !isFinite(Number(p.z))) return;
    var key = scv.toFixed(6) + '|' + lv;
    if (!(key in cellCnt)) { cellSumCC[key] = 0; cellSumMX[key] = 0; cellSumY[key] = 0; cellSumMZ[key] = 0; cellSumST[key] = 0; cellCnt[key] = 0; }
    cellSumCC[key] += ccv;
    cellSumMX[key] += mxv;
    cellSumY[key] += yv;
    cellSumMZ[key] += (p.machineZ != null ? Number(p.machineZ) : 0);
    cellSumST[key] += (p.sampleTopZ != null ? Number(p.sampleTopZ) : 0);
    cellCnt[key]++;
  });
  Object.keys(cellCnt).forEach(function(key) {
    var parts = key.split('|');
    var scv = parseFloat(parts[0]), lv = parseInt(parts[1], 10);
    var xi = xiMap[scv.toFixed(6)], li = liMap[lv];
    if (xi == null || li == null) return;
    var cnt = cellCnt[key];
    grid[xi][li] = {
      cc: cellSumCC[key] / cnt,
      mx: cellSumMX[key] / cnt,
      y: cellSumY[key] / cnt,
      machineZ: cellSumMZ[key] / cnt,
      sampleTopZ: cellSumST[key] / cnt
    };
  });

  // Determine subdivisions per cell
  var xSpacings = [];
  for (var i = 0; i < nCols - 1; i++) xSpacings.push(xs[i + 1] - xs[i]);
  var avgXSpacing = xSpacings.reduce(function(a, b) { return a + b; }, 0) / xSpacings.length;
  var zSpacings = [];
  for (var j = 0; j < nRows - 1; j++) zSpacings.push(Math.abs(layerAvgZ[layers[j + 1]] - layerAvgZ[layers[j]]));
  var avgZSpacing = zSpacings.reduce(function(a, b) { return a + b; }, 0) / zSpacings.length;

  var xSub = Math.max(1, Math.round(avgXSpacing / spacing));
  var zSub = Math.max(1, Math.round(avgZSpacing / spacing));
  if (xSub === 1 && zSub === 1) return pts;

  var newPts = [];
  var newCols = (nCols - 1) * xSub + 1;
  var newRows = (nRows - 1) * zSub + 1;
  // Safety: abort subdivision if output would exceed MAX_SUBDIVISION_POINTS
  if (newCols * newRows > MAX_SUBDIVISION_POINTS) {
    console.warn('subdivideFaceMesh: would generate ' + (newCols * newRows) + ' points (>' + MAX_SUBDIVISION_POINTS + ') — skipping subdivision to prevent browser lockup.');
    return pts;
  }

  for (var gy = 0; gy < newRows; gy++) {
    var li0 = Math.min(Math.floor(gy / zSub), nRows - 2);
    var ty = (gy - li0 * zSub) / zSub;
    var newZ = layerAvgZ[layers[li0]] * (1 - ty) + layerAvgZ[layers[li0 + 1]] * ty;
    var nearLi = ty < 0.5 ? li0 : li0 + 1;
    var nearLayer = layers[nearLi];

    for (var gx = 0; gx < newCols; gx++) {
      var xi0 = Math.min(Math.floor(gx / xSub), nCols - 2);
      var tx = (gx - xi0 * xSub) / xSub;
      var newX = xs[xi0] * (1 - tx) + xs[xi0 + 1] * tx;

      var c00 = grid[xi0][li0], c10 = grid[xi0 + 1][li0];
      var c01 = grid[xi0][li0 + 1], c11 = grid[xi0 + 1][li0 + 1];
      if (!c00 || !c10 || !c01 || !c11) continue;

      var newCC = c00.cc * (1 - tx) * (1 - ty) + c10.cc * tx * (1 - ty) +
                  c01.cc * (1 - tx) * ty + c11.cc * tx * ty;
      var newMX = c00.mx * (1 - tx) * (1 - ty) + c10.mx * tx * (1 - ty) +
                  c01.mx * (1 - tx) * ty + c11.mx * tx * ty;
      var newY = c00.y * (1 - tx) * (1 - ty) + c10.y * tx * (1 - ty) +
                 c01.y * (1 - tx) * ty + c11.y * tx * ty;
      var newMZ = c00.machineZ * (1 - tx) * (1 - ty) + c10.machineZ * tx * (1 - ty) +
                  c01.machineZ * (1 - tx) * ty + c11.machineZ * tx * ty;
      var newST = c00.sampleTopZ * (1 - tx) * (1 - ty) + c10.sampleTopZ * tx * (1 - ty) +
                  c01.sampleTopZ * (1 - tx) * ty + c11.sampleTopZ * tx * ty;

      newPts.push({
        x: newMX, y: newY, z: newZ,
        sampleCoord: newX, contactCoord: newCC,
        machineZ: newMZ, sampleTopZ: newST,
        layer: nearLayer
      });
    }
  }

  return newPts.length >= pts.length ? newPts : pts;
}

// ── Catmull-Rom 1D cubic interpolation ───────────────────────────────────────
// Interpolates between p1 and p2 using p0 and p3 as tangent guides (t ∈ [0,1]).
// Gives C1-continuous joints: slopes match at grid point boundaries.
function _catmullRom(p0, p1, p2, p3, t) {
  var t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2*p0 - 5*p1 + 4*p2 - p3) * t2 +
    (-p0 + 3*p1 - 3*p2 + p3) * t3
  );
}

// Chord-length-parameterised Hermite interpolation for the segment [x1, x2].
// Computes tangents from adjacent physical positions so that
// d(value)/d(physical_pos) is C1-continuous at cell boundaries even when
// control-point positions x0…x3 are non-uniformly spaced.
// p0…p3 : scalar values at the four control points
// x0…x3 : physical positions (monotonically increasing)
// t      : local parameter in [0,1] for the segment [x1, x2]
function _chordHermite(p0, p1, p2, p3, x0, x1, x2, x3, t) {
  var d01 = x1 - x0; if (d01 <= 0) d01 = x2 - x1;
  var d12 = x2 - x1;  // current cell span
  var d23 = x3 - x2; if (d23 <= 0) d23 = d12;
  var denom1 = d01 + d12;  // x2 - x0
  var denom2 = d12 + d23;  // x3 - x1
  var m1 = denom1 > 0 ? (p2 - p0) / denom1 * d12 : 0;
  var m2 = denom2 > 0 ? (p3 - p1) / denom2 * d12 : 0;
  var t2 = t*t, t3 = t2*t;
  return (2*t3 - 3*t2 + 1)*p1 + (t3 - 2*t2 + t)*m1 + (-2*t3 + 3*t2)*p2 + (t3 - t2)*m2;
}

// Smooth subdivided surface mesh with bicubic Catmull-Rom interpolation between probe points.
// Catmull-Rom gives C1-continuous joints (matching slopes across grid-cell boundaries),
// which eliminates the sharp crease / "blocky terrain" artefact that bilinear produces
// when only a sparse set of probe points is available.
function _buildThreeSurface(grid, cfg, zMin, zMax, zExag) {
  var SUB = 8;
  var spanX = (cfg.maxX - cfg.minX) || 1, spanY = (cfg.maxY - cfg.minY) || 1;
  var maxSpan = Math.max(spanX, spanY);
  var xCenter = (cfg.minX + cfg.maxX) / 2, yCenter = (cfg.minY + cfg.maxY) / 2;
  var zMid = (zMin + zMax) / 2, zScale = 30 / maxSpan;
  var nCX = cfg.colCount - 1, nCY = cfg.rowCount - 1;
  var nR = cfg.rowCount, nC = cfg.colCount;
  // Unified vertex grid: shared vertices at cell boundaries allow
  // computeVertexNormals() to average normals across the entire mesh.
  var totalCols = nCX * SUB + 1, totalRows = nCY * SUB + 1;
  var totalVerts = totalCols * totalRows;
  var pos = new Array(totalVerts * 3);
  var col = new Array(totalVerts * 3);
  var idx = [];
  // Helper: get grid Z with boundary clamping; null/non-finite returns null.
  function gZ(r, c) {
    var rr = Math.max(0, Math.min(nR-1, r)), cc = Math.max(0, Math.min(nC-1, c));
    var v = grid[rr][cc];
    return (v != null && isFinite(v)) ? v : null;
  }
  // Bicubic Catmull-Rom interpolation for cell (cy,cx) at fractional (tx,ty).
  // Falls back to bilinear if any of the 4 required corner values are null.
  function biZ(cy, cx, tx, ty) {
    // Require 4 primary corners to be valid (same null-check as bilinear)
    var z00=gZ(cy,cx), z10=gZ(cy,cx+1), z01=gZ(cy+1,cx), z11=gZ(cy+1,cx+1);
    if (z00===null||z10===null||z01===null||z11===null) return null;
    // 1-D Catmull-Rom along a row at parameter t=tx; falls back to linear if either
    // outer neighbour is null (boundary or missing probe contact).
    function rowInterp(r, t) {
      var p1=gZ(r,cx), p2=gZ(r,cx+1);
      if (p1===null||p2===null) return null;
      var p0=gZ(r,cx-1); if (p0===null) p0=p1; // clamp at left boundary
      var p3=gZ(r,cx+2); if (p3===null) p3=p2; // clamp at right boundary
      return _catmullRom(p0, p1, p2, p3, t);
    }
    var r0=rowInterp(cy-1,tx), r1=rowInterp(cy,tx);
    var r2=rowInterp(cy+1,tx), r3=rowInterp(cy+2,tx);
    if (r1===null||r2===null) {
      // Bilinear fallback
      return z00*(1-tx)*(1-ty)+z10*tx*(1-ty)+z01*(1-tx)*ty+z11*tx*ty;
    }
    if (r0===null) r0=r1; // clamp at top boundary
    if (r3===null) r3=r2; // clamp at bottom boundary
    return _catmullRom(r0, r1, r2, r3, ty);
  }
  // gy ranges [0, nCY*SUB] so cy clamps to nCY-1 and ty stays in [0,1].
  for (var gy=0; gy<totalRows; gy++) {
    var cy=Math.min(Math.floor(gy/SUB), nCY-1), ty=(gy-cy*SUB)/SUB;
    var rowOff = gy * totalCols;
    for (var gx=0; gx<totalCols; gx++) {
      var cx=Math.min(Math.floor(gx/SUB), nCX-1), tx=(gx-cx*SUB)/SUB;
      var vIdx=rowOff+gx;
      var z=biZ(cy,cx,tx,ty); if (z===null) z=zMid;
      pos[vIdx*3]  =(cfg.minX+(cx+tx)*cfg.colSpacing-xCenter)/maxSpan*100;
      pos[vIdx*3+1]=(z-zMid)*zExag*zScale;
      pos[vIdx*3+2]=-((cfg.minY+(cy+ty)*cfg.rowSpacing)-yCenter)/maxSpan*100;
      var c=_threeZCol(z,zMin,zMax);
      col[vIdx*3]=c[0]; col[vIdx*3+1]=c[1]; col[vIdx*3+2]=c[2];
    }
  }
  for (var gy2=0; gy2<totalRows-1; gy2++) {
    var rowOff2 = gy2 * totalCols;
    var nextRowOff = (gy2 + 1) * totalCols;
    for (var gx2=0; gx2<totalCols-1; gx2++) {
      var i00=rowOff2+gx2, i10=i00+1, i01=nextRowOff+gx2, i11=i01+1;
      idx.push(i00,i10,i01, i10,i11,i01);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return { geo: geo, xCenter: xCenter, yCenter: yCenter, maxSpan: maxSpan, zMid: zMid, zScale: zScale };
}

// Face wall geometry — placed at the front edge of the surface, vertical.
// World-space mapping:
//   X = sample X position (no lateral shift)
//   Y = layer Z height (vertical position of each probe layer)
//   Z = frontZ - contact-Y deviation + layerFrac*FACE_LATERAL_SLANT
//       Negated contact-Y so face protrusions (toward probe start) appear CLOSER to the
//       frontal camera (+Z) — consistent with the "front view (XZ projection)" description.
// Color: mapped to contact Y (r.y) so variations in face flatness appear as rainbow terrain.
// Both Z (layer height) and contact-Y (face depth) are interpolated with bicubic
// Catmull-Rom to give C1-continuous smooth curvature across layer/sample boundaries.
var FACE_LATERAL_SLANT = 0; // scene units; set to 0 for flat XZ-projection appearance
function _buildThreeFaceWall(faceWall, cfg, zMin, zMax, zExag, si) {
  if (!faceWall) return null;
  var faceXSpan = (faceWall.xMax - faceWall.xMin) || 1;
  var faceZSpan = (faceWall.zMax - faceWall.zMin) || 1;
  var maxSpan = si ? si.maxSpan : Math.max(faceXSpan, faceZSpan);
  var xCenter = si ? si.xCenter : (faceWall.xMin + faceWall.xMax) / 2;
  var yCenter = si ? si.yCenter : 0;
  var zMid    = si ? si.zMid   : (zMin + zMax) / 2;
  var zScale  = si ? si.zScale : 30 / maxSpan;
  var frontZ  = (si && cfg) ? -((cfg.minY - yCenter) / maxSpan * 100) : 0;
  // Contact Y (r.y) range — represents the actual face-shape dimension
  var cMin = isFinite(faceWall.yMin) ? faceWall.yMin : 0;
  var cMax = isFinite(faceWall.yMax) ? faceWall.yMax : 1;
  var cMid = (cMin + cMax) / 2;
  // Outward slant: shallower (top) layers lean toward viewer; layerFrac=1=top gets full slant
  var lateralSlant = FACE_LATERAL_SLANT;
  var SUB = 8; // subdivision for smooth shading (matches surface mesh)
  var nCX = faceWall.nCols - 1, nCY = faceWall.nRows - 1;
  if (nCX < 1 || nCY < 1) return null;
  var nR = faceWall.nRows, nC = faceWall.nCols;
  // Actual column X positions and row Z heights for chord-length parameterisation.
  var fwXs = faceWall.xs; // fwXs[xi] = physical X of column xi
  var rowZs = new Array(nR).fill(null);
  for (var _liz = 0; _liz < nR; _liz++) {
    for (var _xiz = 0; _xiz < nC; _xiz++) {
      var _fwg = faceWall.grid[_liz] && faceWall.grid[_liz][_xiz];
      if (_fwg && isFinite(Number(_fwg.z))) { rowZs[_liz] = Number(_fwg.z); break; }
    }
  }
  // Helper: get grid point with boundary clamping; returns null if missing/invalid
  function gR(li, xi) {
    var lli = Math.max(0, Math.min(nR-1, li));
    var lxi = Math.max(0, Math.min(nC-1, xi));
    var r = faceWall.grid[lli] && faceWall.grid[lli][lxi];
    return (r && isFinite(Number(r.z)) && isFinite(Number(r.y))) ? r : null;
  }
  // 1-D chord-length Hermite along a row (layer li) for X-index xi and fractional t.
  // Uses actual physical X positions so d(value)/dX is continuous across column boundaries
  // even when probe columns are non-uniformly spaced.
  function rowInterpFn(li, xi, t, fn) {
    var p1 = gR(li, xi); var p2 = gR(li, xi+1);
    if (!p1 || !p2) return null;
    var p0 = gR(li, xi-1); if (!p0) p0 = p1;
    var p3 = gR(li, xi+2); if (!p3) p3 = p2;
    var x0 = xi > 0 ? fwXs[xi-1] : fwXs[xi];
    var x3 = xi+2 < nC ? fwXs[xi+2] : fwXs[xi+1];
    return _chordHermite(fn(p0), fn(p1), fn(p2), fn(p3), x0, fwXs[xi], fwXs[xi+1], x3, t);
  }
  // Bicubic chord-length Hermite for cell (li, xi) at params (tx, ty) extracting field fn.
  // Falls back to bilinear if any primary corner is null.
  function faceInterpFn(li, xi, tx, ty, fn) {
    var r00=gR(li,xi), r10=gR(li,xi+1), r01=gR(li+1,xi), r11=gR(li+1,xi+1);
    if (!r00||!r10||!r01||!r11) return null;
    var ri0=rowInterpFn(li-1, xi, tx, fn), ri1=rowInterpFn(li, xi, tx, fn);
    var ri2=rowInterpFn(li+1, xi, tx, fn), ri3=rowInterpFn(li+2, xi, tx, fn);
    if (ri1===null||ri2===null) {
      return fn(r00)*(1-tx)*(1-ty)+fn(r10)*tx*(1-ty)+fn(r01)*(1-tx)*ty+fn(r11)*tx*ty;
    }
    if (ri0===null) ri0=ri1;
    if (ri3===null) ri3=ri2;
    // Chord-length Hermite in the layer-Z direction for non-uniform row spacing.
    var z0 = rowZs[li-1] != null ? rowZs[li-1] : rowZs[li];
    var z1 = rowZs[li], z2 = rowZs[li+1];
    var z3 = rowZs[li+2] != null ? rowZs[li+2] : rowZs[li+1];
    if (z0 == null) z0 = z1; if (z3 == null) z3 = z2;
    return _chordHermite(ri0, ri1, ri2, ri3, z0, z1, z2, z3, ty);
  }
  // Unified vertex grid: shared vertices at cell boundaries allow
  // computeVertexNormals() to average normals across all cells — eliminates
  // the sharp crease / wrong-angle artifacts caused by per-cell duplicate vertices.
  var totalCols = nCX * SUB + 1, totalRows = nCY * SUB + 1;
  var totalVerts = totalCols * totalRows;
  var posArr = new Array(totalVerts * 3);
  var colArr = new Array(totalVerts * 3);
  // 1 byte per vertex: 0=unfilled, 1=filled (avoids recomputing shared boundary verts)
  var filled = new Uint8Array(totalVerts);
  // Pre-smooth contact-Y (depth) values to reduce visible fold lines at column/row boundaries.
  // Uses a multi-pass 2-D neighbourhood average with separate blend factors for peaks
  // (protrusions) and valleys (recessions); does not mutate faceWall.grid.
  var smPeak    = Math.min(1, Math.max(0, Number((document.getElementById('faceWallSmoothPeak')   || {}).value) || 0));
  var smValley  = Math.min(1, Math.max(0, Number((document.getElementById('faceWallSmoothValley') || {}).value) || 0));
  var smPasses  = Math.max(1, Math.min(10, Math.round(Number((document.getElementById('faceWallSmoothPasses') || {}).value) || 1)));
  var smC = null; // smC[li][xi] = smoothed contact-Y, or null if missing
  if (smPeak > 0 || smValley > 0) {
    // Build raw contact-Y grid
    var smData = [];
    for (var _li = 0; _li < nR; _li++) {
      smData.push([]);
      for (var _xi = 0; _xi < nC; _xi++) { var _r = gR(_li, _xi); smData[_li][_xi] = _r ? (_r.contactCoord != null ? Number(_r.contactCoord) : Number(_r.y)) : null; }
    }
    // Apply smPasses iterations of neighbourhood averaging for a Gaussian-like blur
    // that progressively reduces steep gradients causing visible fold lines.
    for (var _pass = 0; _pass < smPasses; _pass++) {
      var _nextSm = [];
      for (var _li2 = 0; _li2 < nR; _li2++) {
        _nextSm.push([]);
        for (var _xi2 = 0; _xi2 < nC; _xi2++) {
          var _orig = smData[_li2][_xi2]; if (_orig == null) { _nextSm[_li2][_xi2] = null; continue; }
          var _sum = _orig, _cnt = 1;
          if (_li2 > 0 && smData[_li2-1][_xi2] != null) { _sum += smData[_li2-1][_xi2]; _cnt++; }
          if (_li2 < nR-1 && smData[_li2+1][_xi2] != null) { _sum += smData[_li2+1][_xi2]; _cnt++; }
          if (_xi2 > 0 && smData[_li2][_xi2-1] != null) { _sum += smData[_li2][_xi2-1]; _cnt++; }
          if (_xi2 < nC-1 && smData[_li2][_xi2+1] != null) { _sum += smData[_li2][_xi2+1]; _cnt++; }
          var _avg = _sum / _cnt;
          // Peak: Y below average (probe contacted sooner = protrusion); Valley: Y above average.
          var _bf = _orig < _avg ? smPeak : (_orig > _avg ? smValley : 0);
          _nextSm[_li2][_xi2] = _bf > 0 ? _orig * (1 - _bf) + _avg * _bf : _orig;
        }
      }
      smData = _nextSm;
    }
    smC = smData;
  }
  // Bicubic chord-length Hermite interpolation for smoothed contact-Y (smC).
  // Replaces the previous bilinear approach: bilinear is only C0-continuous (slope
  // discontinuity at every cell boundary) → visible crease lines.  Chord Hermite gives
  // C1-continuous results that match the un-smoothed bicubic path, eliminating creases.
  var smcInterpFn = smC ? function(li, xi, tx, ty) {
    function smcRow(l) {
      var ll = Math.max(0, Math.min(nR-1, l));
      var p1 = smC[ll][xi], p2 = (xi+1 < nC) ? smC[ll][xi+1] : null;
      if (p1==null||p2==null) return null;
      var p0 = xi>0 ? smC[ll][xi-1] : null; if (p0==null) p0=p1;
      var p3 = xi+2<nC ? smC[ll][xi+2] : null; if (p3==null) p3=p2;
      var x0 = xi>0 ? fwXs[xi-1] : fwXs[xi];
      var x3 = xi+2<nC ? fwXs[xi+2] : fwXs[xi+1];
      return _chordHermite(p0, p1, p2, p3, x0, fwXs[xi], fwXs[xi+1], x3, tx);
    }
    var c00=smC[li][xi], c10=smC[li][xi+1];
    var c01=smC[li+1]&&smC[li+1][xi], c11=smC[li+1]&&smC[li+1][xi+1];
    if (c00==null||c10==null||c01==null||c11==null) return null;
    var sri0=smcRow(li-1), sri1=smcRow(li), sri2=smcRow(li+1), sri3=smcRow(li+2);
    if (sri1===null||sri2===null) {
      return c00*(1-tx)*(1-ty)+c10*tx*(1-ty)+c01*(1-tx)*ty+c11*tx*ty; // bilinear fallback
    }
    if (sri0===null) sri0=sri1;
    if (sri3===null) sri3=sri2;
    var sz0=rowZs[li-1]!=null?rowZs[li-1]:rowZs[li];
    var sz1=rowZs[li], sz2=rowZs[li+1];
    var sz3=rowZs[li+2]!=null?rowZs[li+2]:rowZs[li+1];
    if (sz0==null) sz0=sz1; if (sz3==null) sz3=sz2;
    return _chordHermite(sri0, sri1, sri2, sri3, sz0, sz1, sz2, sz3, ty);
  } : null;
  // Pre-check cell validity (all 4 corners present with finite Z)
  var validCell = [];
  for (var xi=0; xi<nCX; xi++) { validCell[xi] = [];
    for (var li=0; li<nCY; li++) {
      var r00=faceWall.grid[li]&&faceWall.grid[li][xi], r10=faceWall.grid[li]&&faceWall.grid[li][xi+1];
      var r01=faceWall.grid[li+1]&&faceWall.grid[li+1][xi], r11=faceWall.grid[li+1]&&faceWall.grid[li+1][xi+1];
      if (!r00||!r10||!r01||!r11) { validCell[xi][li]=false; continue; }
      validCell[xi][li]=isFinite(Number(r00.z))&&isFinite(Number(r10.z))&&isFinite(Number(r01.z))&&isFinite(Number(r11.z));
    }
  }
  // Fill vertices from valid cells into the unified grid
  var nRowsM1 = Math.max(faceWall.nRows - 1, 1);
  for (var xi=0; xi<nCX; xi++) {
    var baseGx = xi * SUB;
    for (var li=0; li<nCY; li++) {
      if (!validCell[xi][li]) continue;
      var r00=faceWall.grid[li][xi], r10=faceWall.grid[li][xi+1];
      var x00=fwXs[xi], x10=fwXs[xi+1];
      var baseGy = li * SUB;
      for (var sy=0; sy<=SUB; sy++) {
        var gy = baseGy + sy;
        var rowOff = gy * totalCols;
        for (var sx=0; sx<=SUB; sx++) {
          var vIdx = rowOff + baseGx + sx;
          if (filled[vIdx]) continue; // skip if already filled by a previously processed cell
          var tx=sx/SUB, ty=sy/SUB;
          var mx=x00+tx*(x10-x00);
          // Bicubic Catmull-Rom for both Z (layer height) and contact-Y (face depth)
          var mz = faceInterpFn(li, xi, tx, ty, function(r){ return Number(r.z); });
          var mc;
          if (smcInterpFn) {
            // Bicubic chord-length Hermite on multi-pass smoothed contact-Y (C1-continuous).
            mc = smcInterpFn(li, xi, tx, ty);
          } else {
            mc = faceInterpFn(li, xi, tx, ty, function(r){ return r.contactCoord != null ? Number(r.contactCoord) : Number(r.y); });
          }
          if (mz===null) { var r01=faceWall.grid[li+1][xi], r11=faceWall.grid[li+1][xi+1]; mz=Number(r00.z)*(1-tx)*(1-ty)+Number(r10.z)*tx*(1-ty)+Number(r01.z)*(1-tx)*ty+Number(r11.z)*tx*ty; }
          if (mc===null) { var r01b=faceWall.grid[li+1][xi], r11b=faceWall.grid[li+1][xi+1]; var _cc=function(r){return r.contactCoord!=null?Number(r.contactCoord):Number(r.y);}; mc=_cc(r00)*(1-tx)*(1-ty)+_cc(r10)*tx*(1-ty)+_cc(r01b)*(1-tx)*ty+_cc(r11b)*tx*ty; }
          var layerFrac = (li + ty) / nRowsM1;
          var worldX = (mx-xCenter)/maxSpan*100;
          var worldY = (mz-zMid)*zExag*zScale;
          // Negate contact-Y deviation: protruding regions (mc closer to startCoord) get positive
          // worldZ → appear CLOSER to the frontal camera, matching probe-side perspective.
          var worldZ = frontZ - (mc - cMid) * zExag * zScale + layerFrac * lateralSlant;
          posArr[vIdx*3]=worldX; posArr[vIdx*3+1]=worldY; posArr[vIdx*3+2]=worldZ;
          var c=_threeZCol(mc, cMin, cMax);
          colArr[vIdx*3]=c[0]; colArr[vIdx*3+1]=c[1]; colArr[vIdx*3+2]=c[2];
          filled[vIdx] = 1;
        }
      }
    }
  }
  // Build triangle indices for sub-quads within valid cells only
  var idx = [];
  for (var xi=0; xi<nCX; xi++) {
    var bGx = xi * SUB;
    for (var li=0; li<nCY; li++) {
      if (!validCell[xi][li]) continue;
      var bGy = li * SUB;
      for (var sy=0; sy<SUB; sy++) {
        var rowOff2 = (bGy + sy) * totalCols;
        var nextRowOff2 = rowOff2 + totalCols;
        for (var sx=0; sx<SUB; sx++) {
          var i00=rowOff2+bGx+sx, i10=i00+1, i01=nextRowOff2+bGx+sx, i11=i01+1;
          idx.push(i00,i10,i01, i10,i11,i01);
        }
      }
    }
  }
  if (idx.length === 0) return null;
  // Zero-fill any unfilled vertices (unreferenced by triangles — no visual effect)
  for (var i=0; i<totalVerts; i++) {
    if (!filled[i]) { posArr[i*3]=0; posArr[i*3+1]=0; posArr[i*3+2]=0;
                      colArr[i*3]=0; colArr[i*3+1]=0; colArr[i*3+2]=0; }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colArr, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return { geo: geo, frontZ: frontZ };
}

// Bridge geometry: fills the height gap between surface front row and face wall top edge
function _buildThreeBridge(grid, cfg, faceWall, zMin, zMax, zExag, si) {
  if (!grid||!cfg||!faceWall||!si) return null;
  var maxSpan=si.maxSpan, xCenter=si.xCenter, yCenter=si.yCenter, zMid=si.zMid, zScale=si.zScale;
  var frontZ = -((cfg.minY - yCenter) / maxSpan * 100);
  var topLi  = faceWall.nRows - 1;
  // Contact Y range (must match _buildThreeFaceWall so bridge Z aligns with face top edge)
  var cMin = isFinite(faceWall.yMin) ? faceWall.yMin : 0;
  var cMax = isFinite(faceWall.yMax) ? faceWall.yMax : 1;
  var cMid = (cMin + cMax) / 2;
  function faceTopZ(machX) {
    var xi = 0;
    while (xi < faceWall.nCols - 1 && faceWall.xs[xi + 1] <= machX) xi++;
    var r0 = faceWall.grid[topLi] && faceWall.grid[topLi][xi]; if (!r0) return null;
    if (xi >= faceWall.nCols - 1) return Number(r0.z);
    var r1 = faceWall.grid[topLi] && faceWall.grid[topLi][xi + 1]; if (!r1) return Number(r0.z);
    var x0=faceWall.xs[xi], x1=faceWall.xs[xi+1], t=x1>x0?(machX-x0)/(x1-x0):0;
    return Number(r0.z)*(1-t)+Number(r1.z)*t;
  }
  function faceTopContactY(machX) {
    var xi = 0;
    while (xi < faceWall.nCols - 1 && faceWall.xs[xi + 1] <= machX) xi++;
    var r0 = faceWall.grid[topLi] && faceWall.grid[topLi][xi]; if (!r0) return cMid;
    if (xi >= faceWall.nCols - 1) return Number(r0.y);
    var r1 = faceWall.grid[topLi] && faceWall.grid[topLi][xi + 1]; if (!r1) return Number(r0.y);
    var x0=faceWall.xs[xi], x1=faceWall.xs[xi+1], t=x1>x0?(machX-x0)/(x1-x0):0;
    return Number(r0.y)*(1-t)+Number(r1.y)*t;
  }
  var lateralSlant = FACE_LATERAL_SLANT; // must match _buildThreeFaceWall
  var pos=[], col=[], idx=[], vtx=0;
  for (var ci=0; ci<cfg.colCount-1; ci++) {
    var sx0=cfg.minX+ci*cfg.colSpacing, sx1=cfg.minX+(ci+1)*cfg.colSpacing;
    var sz0=grid[0][ci], sz1=grid[0][ci+1];
    if (sz0==null||sz1==null||!isFinite(sz0)||!isFinite(sz1)) continue;
    var fz0=faceTopZ(sx0), fz1=faceTopZ(sx1);
    if (fz0===null||fz1===null) continue;
    var fc0=faceTopContactY(sx0), fc1=faceTopContactY(sx1);
    var wx0=(sx0-xCenter)/maxSpan*100, wx1=(sx1-xCenter)/maxSpan*100;
    var wy_s0=(sz0-zMid)*zExag*zScale, wy_s1=(sz1-zMid)*zExag*zScale;
    var wy_f0=(fz0-zMid)*zExag*zScale, wy_f1=(fz1-zMid)*zExag*zScale;
    var wz_f0=frontZ-(fc0-cMid)*zExag*zScale+lateralSlant, wz_f1=frontZ-(fc1-cMid)*zExag*zScale+lateralSlant; // matches face wall top (layerFrac=1, full slant at top)
    var base=vtx;
    // Quad: surface front edge (at frontZ) → face top edge (at frontZ + contact-Y displacement + full slant at top)
    pos.push(wx0,wy_s0,frontZ, wx1,wy_s1,frontZ, wx1,wy_f1,wz_f1, wx0,wy_f0,wz_f0);
    var c0=_threeZCol(sz0,zMin,zMax),c1=_threeZCol(sz1,zMin,zMax),c2=_threeZCol(fz1,zMin,zMax),c3=_threeZCol(fz0,zMin,zMax);
    col.push(c0[0],c0[1],c0[2], c1[0],c1[1],c1[2], c2[0],c2[1],c2[2], c3[0],c3[1],c3[2]);
    idx.push(base,base+1,base+2, base,base+2,base+3);
    vtx += 4;
  }
  if (vtx === 0) return null;
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

// Contour lines: march through surface grid triangles and find Z-level crossings
function _buildThreeContours(grid, cfg, zMin, zMax, zExag, si) {
  if (!si || !grid || !cfg) return null;
  var interval = (zMax - zMin) / 10;
  if (interval <= 0) return null;
  var maxSpan=si.maxSpan, xCenter=si.xCenter, yCenter=si.yCenter, zMid=si.zMid, zScale=si.zScale;
  var pts = [];
  for (var z = Math.ceil(zMin / interval) * interval; z <= zMax + 1e-9; z += interval) {
    for (var cy=0; cy<cfg.rowCount-1; cy++) {
      for (var cx=0; cx<cfg.colCount-1; cx++) {
        var z00=grid[cy][cx],z10=grid[cy][cx+1],z01=grid[cy+1][cx],z11=grid[cy+1][cx+1];
        if (z00==null||z10==null||z01==null||z11==null) continue;
        if (!isFinite(z00)||!isFinite(z10)||!isFinite(z01)||!isFinite(z11)) continue;
        var x0=cfg.minX+cx*cfg.colSpacing, x1=cfg.minX+(cx+1)*cfg.colSpacing;
        var y0=cfg.minY+cy*cfg.rowSpacing, y1=cfg.minY+(cy+1)*cfg.rowSpacing;
        // March each triangle (T1: 00,10,01 and T2: 10,11,01) for this Z level
        var tris = [[x0,y0,z00, x1,y0,z10, x0,y1,z01],[x1,y0,z10, x1,y1,z11, x0,y1,z01]];
        for (var ti=0; ti<2; ti++) {
          var tr=tris[ti], crossPts=[];
          for (var ei=0; ei<3; ei++) {
            var ai=ei*3, bi=(ei<2?ei+1:0)*3;
            var ax=tr[ai],ay=tr[ai+1],az=tr[ai+2], bx=tr[bi],by=tr[bi+1],bz=tr[bi+2];
            if ((az<=z&&bz>z)||(bz<=z&&az>z)) {
              var t=(z-az)/(bz-az);
              crossPts.push(new THREE.Vector3((ax+t*(bx-ax)-xCenter)/maxSpan*100, (z-zMid)*zExag*zScale, -((ay+t*(by-ay))-yCenter)/maxSpan*100));
            }
          }
          if (crossPts.length >= 2) { pts.push(crossPts[0], crossPts[1]); }
        }
      }
    }
  }
  if (pts.length === 0) return null;
  var group = new THREE.Group();
  var lGeo = new THREE.BufferGeometry().setFromPoints(pts);
  var lMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
  group.add(new THREE.LineSegments(lGeo, lMat));
  return group;
}

// Contour lines for the face wall: march through face-wall triangles and find
// crossings of the *contact-Y* (r.y) coordinate — the same dimension used to
// colour and displace the face wall in _buildThreeFaceWall.  This produces
// curved iso-contours that follow the actual face shape, matching the terrain
// look of the surface mesh contours.
function _buildThreeFaceContours(faceWall, cfg, zMin, zMax, zExag, si) {
  if (!faceWall) return null;
  // Contour interval based on contact-Y range (face shape), not layer-Z range
  var cMin = isFinite(faceWall.yMin) ? faceWall.yMin : zMin;
  var cMax = isFinite(faceWall.yMax) ? faceWall.yMax : zMax;
  var interval = (cMax - cMin) / 10;
  if (interval <= 0) return null; // flat face: no visible contours
  var faceXSpan = (faceWall.xMax - faceWall.xMin) || 1;
  var faceZSpan = (faceWall.zMax - faceWall.zMin) || 1;
  var maxSpan = si ? si.maxSpan : Math.max(faceXSpan, faceZSpan);
  var xCenter = si ? si.xCenter : (faceWall.xMin + faceWall.xMax) / 2;
  var yCenter = si ? si.yCenter : 0;
  var zMid    = si ? si.zMid   : (zMin + zMax) / 2;
  var zScale  = si ? si.zScale : 30 / maxSpan;
  var frontZ  = (si && cfg) ? -((cfg.minY - yCenter) / maxSpan * 100) : 0;
  var cMid    = (cMin + cMax) / 2;
  var lateralSlant = FACE_LATERAL_SLANT; // must match _buildThreeFaceWall
  var nRowsM1 = Math.max(faceWall.nRows - 1, 1);
  var pts = [];
  // March through each cLevel (contact-Y iso-value)
  for (var cLevel = Math.ceil(cMin / interval) * interval; cLevel <= cMax + 1e-9; cLevel += interval) {
    for (var xi = 0; xi < faceWall.nCols - 1; xi++) {
      for (var li = 0; li < faceWall.nRows - 1; li++) {
        var r00=faceWall.grid[li]  &&faceWall.grid[li][xi];
        var r10=faceWall.grid[li]  &&faceWall.grid[li][xi+1];
        var r01=faceWall.grid[li+1]&&faceWall.grid[li+1][xi];
        var r11=faceWall.grid[li+1]&&faceWall.grid[li+1][xi+1];
        if (!r00||!r10||!r01||!r11) continue;
        var z00=Number(r00.z),z10=Number(r10.z),z01=Number(r01.z),z11=Number(r11.z);
        if (!isFinite(z00)||!isFinite(z10)||!isFinite(z01)||!isFinite(z11)) continue;
        // Contact Y at each corner — used for crossing detection
        var cy00=Number(r00.y),cy10=Number(r10.y),cy01=Number(r01.y),cy11=Number(r11.y);
        var x00=faceWall.xs[xi], x10=faceWall.xs[xi+1];
        var lf00=li/nRowsM1, lf01=(li+1)/nRowsM1;
        // 3-D positions matching _buildThreeFaceWall (outward slant + contact displacement)
        var px00=(x00-xCenter)/maxSpan*100, px10=(x10-xCenter)/maxSpan*100;
        var px01=(x00-xCenter)/maxSpan*100, px11=(x10-xCenter)/maxSpan*100;
        var py00=(z00-zMid)*zExag*zScale, py10=(z10-zMid)*zExag*zScale;
        var py01=(z01-zMid)*zExag*zScale, py11=(z11-zMid)*zExag*zScale;
        var pz00=frontZ-(cy00-cMid)*zExag*zScale+lf00*lateralSlant, pz10=frontZ-(cy10-cMid)*zExag*zScale+lf00*lateralSlant;
        var pz01=frontZ-(cy01-cMid)*zExag*zScale+lf01*lateralSlant, pz11=frontZ-(cy11-cMid)*zExag*zScale+lf01*lateralSlant;
        // Triangle pair marching: each entry = [px,py,pz, contactY] × 3 vertices
        var tris = [
          [px00,py00,pz00,cy00, px10,py10,pz10,cy10, px00,py01,pz01,cy01],
          [px10,py10,pz10,cy10, px10,py11,pz11,cy11, px00,py01,pz01,cy01]
        ];
        for (var ti=0; ti<2; ti++) {
          var tr=tris[ti], crossPts=[];
          for (var ei=0; ei<3; ei++) {
            var ai=ei*4, bi=(ei<2?ei+1:0)*4;
            var ax=tr[ai],ay=tr[ai+1],az=tr[ai+2],av=tr[ai+3];
            var bx=tr[bi],by=tr[bi+1],bz=tr[bi+2],bv=tr[bi+3];
            if ((av<=cLevel&&bv>cLevel)||(bv<=cLevel&&av>cLevel)) {
              var t=(cLevel-av)/(bv-av);
              crossPts.push(new THREE.Vector3(ax+t*(bx-ax), ay+t*(by-ay), az+t*(bz-az)));
            }
          }
          if (crossPts.length >= 2) { pts.push(crossPts[0], crossPts[1]); }
        }
      }
    }
  }
  if (pts.length === 0) return null;
  var group = new THREE.Group();
  var lGeo = new THREE.BufferGeometry().setFromPoints(pts);
  var lMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
  group.add(new THREE.LineSegments(lGeo, lMat));
  return group;
}

// ── Main unified Three.js renderer ───────────────────────────────────────────
function renderThreeUnified3D(prefix) {
  if (typeof THREE === 'undefined') { return; } // Three.js not loaded yet
  // Use the raw (pre-subdivision) probe grid so that _buildThreeSurface's bicubic
  // Catmull-Rom interpolates directly from actual probe contact points.  Bilinear
  // pre-subdivision bakes in slope discontinuities that cause the blocky appearance
  // even after the bicubic pass; raw data lets the bicubic produce smooth C1 curves.
  var grid = smMeshDataRaw || smMeshData;
  var cfg  = (smMeshDataRaw ? smGridConfigRaw : null) || smGridConfig;
  var hasSurface = grid && cfg && cfg.rowCount >= 2 && cfg.colCount >= 2;
  // Pass raw face contacts to buildFaceWallGrid for the same reason.
  var _rawFace = (typeof layeredFaceResultsRaw !== 'undefined' && layeredFaceResultsRaw && layeredFaceResultsRaw.length) ? layeredFaceResultsRaw : null;
  var faceWall   = buildFaceWallGrid(_rawFace);
  var hasFace    = faceWall !== null;

  // Filter by visualization mode: face view shows face-only, surface views show surface-only.
  // 'res' shows surface only, 'resface' shows face only, 'relief' shows face only (3D terrain).
  if (prefix === 'face' || prefix === 'resface' || prefix === 'relief') hasSurface = false;
  if (prefix === 'sm' || prefix === 'surf' || prefix === 'res') hasFace = false;

  var wrapId     = (prefix === 'relief') ? 'relief-three-canvas' : prefix + '-three-canvas';
  var canvasWrap = document.getElementById(wrapId);

  if (!hasSurface && !hasFace) {
    if (canvasWrap) canvasWrap.classList.remove('three-active');
    var statusEl = (prefix === 'surf') ? document.getElementById('sm-meshVizStatus') :
                   (prefix === 'face') ? document.getElementById('face-meshVizStatus') :
                   (prefix === 'resface') ? document.getElementById('resface-meshVizStatus') : null;
    if (statusEl) statusEl.textContent = (prefix === 'face' || prefix === 'resface')
      ? 'No face mesh data \u2014 run a face probe or load face mesh'
      : 'No mesh data \u2014 run a surface probe or load a mesh';
    pluginDebug('renderThreeUnified3D(' + prefix + '): no data — skipping render');
    return;
  }
  if (canvasWrap) canvasWrap.classList.add('three-active');

  var s = _threeGetOrInit(prefix);
  if (!s) return;

  var exagId = (prefix === 'relief') ? 'relief-3d-z-exag' : prefix + '-z-exag';
  var zExag  = Number((document.getElementById(exagId) || {}).value) || 5;

  var toggleEl = document.getElementById(prefix + '-contour-toggle');
  var contourOn = !!(toggleEl && toggleEl.checked);
  // Skip the expensive geometry rebuild when data and parameters haven't changed
  // since the last render — just repaint the existing scene instead.
  if (s.meshGroup &&
      s._cacheGrid    === grid    &&
      s._cacheRawFace === _rawFace &&
      s._cacheZExag   === zExag   &&
      s._cacheContour === contourOn) {
    s.renderer.render(s.scene, s.camera);
    return;
  }

  // Compute global Z range
  var zMin = Infinity, zMax = -Infinity;
  if (hasSurface) {
    for (var r=0; r<cfg.rowCount; r++) {
      for (var c=0; c<cfg.colCount; c++) {
        var zv = grid[r][c];
        if (zv != null && isFinite(zv)) { zMin = Math.min(zMin, zv); zMax = Math.max(zMax, zv); }
      }
    }
  }
  if (hasFace) { zMin = Math.min(zMin, faceWall.zMin); zMax = Math.max(zMax, faceWall.zMax); }
  if (!isFinite(zMin)) return;
  if (zMin === zMax) { zMin -= 0.5; zMax += 0.5; }

  // Dispose old geometry groups
  if (s.meshGroup)    { s.scene.remove(s.meshGroup);    s.meshGroup    = null; }
  if (s.contourGroup) { s.scene.remove(s.contourGroup); s.contourGroup = null; }

  var group = new THREE.Group();
  s.meshGroup = group;
  var mat = new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: false, shininess: 40 });

  var si = null;
  if (hasSurface) {
    var sr = _buildThreeSurface(grid, cfg, zMin, zMax, zExag);
    si = sr;
    group.add(new THREE.Mesh(sr.geo, mat.clone()));
  }

  if (hasFace) {
    var fwr = _buildThreeFaceWall(faceWall, cfg, zMin, zMax, zExag, si);
    if (fwr) group.add(new THREE.Mesh(fwr.geo, mat.clone()));
    if (hasSurface && si) {
      var bg = _buildThreeBridge(grid, cfg, faceWall, zMin, zMax, zExag, si);
      if (bg) group.add(new THREE.Mesh(bg, mat.clone()));
    }
  }

  s.scene.add(group);

  // Optional contour lines
  if (toggleEl && toggleEl.checked) {
    var contourGroup = new THREE.Group();
    var anyContour = false;
    if (si) {
      var cg = _buildThreeContours(grid, cfg, zMin, zMax, zExag, si);
      if (cg) { contourGroup.add(cg); anyContour = true; }
    }
    if (hasFace) {
      var fcg = _buildThreeFaceContours(faceWall, cfg, zMin, zMax, zExag, si);
      if (fcg) { contourGroup.add(fcg); anyContour = true; }
    }
    if (anyContour) { s.contourGroup = contourGroup; s.scene.add(contourGroup); }
  }

  // Update status text
  var statusEl = (prefix === 'surf') ? document.getElementById('sm-meshVizStatus') :
                 (prefix === 'face') ? document.getElementById('face-meshVizStatus') :
                 (prefix === 'resface') ? document.getElementById('resface-meshVizStatus') : null;
  if (statusEl) {
    if (hasSurface && hasFace) statusEl.textContent = (cfg.colCount*cfg.rowCount) + ' surface + ' + (faceWall.nCols*faceWall.nRows) + ' face = ' + (cfg.colCount*cfg.rowCount + faceWall.nCols*faceWall.nRows) + ' combined \u2014 Z: ' + zMin.toFixed(3) + ' to ' + zMax.toFixed(3);
    else if (hasSurface)        statusEl.textContent = (cfg.colCount*cfg.rowCount) + ' points, grid ' + cfg.colCount + '\u00d7' + cfg.rowCount + ' \u2014 Z: ' + zMin.toFixed(3) + ' to ' + zMax.toFixed(3);
    else                        statusEl.textContent = (faceWall.nCols*faceWall.nRows) + ' face points \u2014 Z: ' + zMin.toFixed(3) + ' to ' + zMax.toFixed(3);
  }
  var mode = hasSurface && hasFace ? 'combined' : hasSurface ? 'surface' : 'face';
  var ptCount = (hasSurface ? cfg.colCount*cfg.rowCount : 0) + (hasFace ? faceWall.nCols*faceWall.nRows : 0);
  pluginDebug('renderThreeUnified3D(' + prefix + '): mode=' + mode + ' points=' + ptCount + ' Z=' + zMin.toFixed(3) + ' to ' + zMax.toFixed(3) + ' zExag=' + zExag);
  // Store cache key so subsequent calls with unchanged data skip the rebuild.
  s._cacheGrid    = grid;
  s._cacheRawFace = _rawFace;
  s._cacheZExag   = zExag;
  s._cacheContour = contourOn;
}

// Save WebGL canvas as PNG (falls back to replay HTML if Three.js not active)
function save3DViewPNG() {
  var s = _threeState['res'];
  if (s && s.renderer) {
    s.renderer.render(s.scene, s.camera);
    var dataURL = s.renderer.domElement.toDataURL('image/png');
    var link = document.createElement('a');
    link.download = 'mesh-3d-view.png';
    link.href = dataURL;
    link.click();
  } else {
    smSaveReplayHtml();
  }
}

// ── Clear relief-map canvases visual display ──────────────────────────────────
// canvasIds: array of canvas element IDs to blank.
// clearRelief3D: when true also disposes the Three.js 3D terrain scene.
function clearReliefCanvasPanel(canvasIds, clearRelief3D) {
  (canvasIds || []).forEach(function(id) {
    var c = document.getElementById(id);
    if (c) { c.width = c.width; } // resets canvas content to blank
    var tid = id.replace('-canvas', '-tooltip');
    var t = document.getElementById(tid);
    if (t) t.textContent = 'Hover over map for values';
  });
  if (clearRelief3D) {
    try { _threeDispose('relief'); } catch(e) {}
    var surface = document.getElementById('relief-3d-surface');
    if (surface) surface.innerHTML = '';
  }
}

// ── Face Probe 3D Visualizer ──────────────────────────────────────────────────

function facePVizApplyRotation() {
  var el = document.getElementById('face-pviz-3dscene');
  if (el) el.style.transform = 'rotateX(' + _facePvizRotX + 'deg) rotateY(' + _facePvizRotY + 'deg) rotateZ(' + _facePvizRotZ + 'deg)';
}

function facePVizResetView() {
  _facePvizRotX = 20; _facePvizRotY = -25; _facePvizRotZ = 0;
  facePVizApplyRotation();
  var s = _threeState['face'];
  // Frontal camera: Machine-X horizontal, Machine-Z vertical — matches XZ face relief map
  if (s && s.controls) { s.camera.position.set(0, 30, 200); s.camera.lookAt(0, 0, 0); s.controls.reset(); }
}

function initFacePVizRotation() {
  // No-op for CSS drag: OrbitControls on the Three.js canvas handles rotation.
  // Wire up the reset button and double-click reset once.
  var scene = document.getElementById('face-pviz-scene');
  if (scene && !scene._facePvizInited) {
    scene._facePvizInited = true;
    scene.addEventListener('dblclick', facePVizResetView);
  }
  var resetBtn = document.getElementById('face-pviz-reset-btn');
  if (resetBtn && !resetBtn._pvizResetInited) {
    resetBtn._pvizResetInited = true;
    resetBtn.addEventListener('click', function(e) { e.stopPropagation(); facePVizResetView(); });
  }
}

function renderFacePVizMesh() {
  // SVG polygon rendering removed — Three.js WebGL renderer handles the 3D terrain view.
  // Clear old CSS dots from face-pviz-surface (kept for backward compat).
  var surf = document.getElementById('face-pviz-surface');
  var oldDots = surf ? surf.querySelectorAll('.face-pviz-dot') : [];
  Array.prototype.forEach.call(oldDots, function(d) { d.parentNode.removeChild(d); });

  var vizStatus = document.getElementById('face-meshVizStatus');
  var data = getFaceMeshData();
  if (!data || !data.length) {
    if (vizStatus) vizStatus.textContent = 'No face mesh data \u2014 run a face probe or load face mesh';
    renderThreeUnified3D('face');
    return;
  }

  var faceWall = buildFaceWallGrid();
  if (vizStatus) {
    if (faceWall) {
      vizStatus.textContent = (faceWall.nCols * faceWall.nRows) + ' contact points across ' + faceWall.nRows + ' layer(s)';
    } else {
      vizStatus.textContent = data.length + ' contact point(s)';
    }
  }
  renderThreeUnified3D('face');
}
// ── Combined 3D Visualizer ────────────────────────────────────────────────────

var _combRotX = 38, _combRotY = -20, _combRotZ = -4;
var _combDragActive = false, _combDragLastX = 0, _combDragLastY = 0;

function combVizApplyRotation() {
  var el = document.getElementById('comb-pviz-3dscene');
  if (el) el.style.transform = 'rotateX(' + _combRotX + 'deg) rotateY(' + _combRotY + 'deg) rotateZ(' + _combRotZ + 'deg)';
}

function combVizResetView() {
  _combRotX = 38; _combRotY = -20; _combRotZ = -4;
  combVizApplyRotation();
  // Reset Three.js camera for comb scene
  var s = _threeState['comb'];
  if (s && s.controls) { s.camera.position.set(120, 80, 120); s.camera.lookAt(0, 0, 0); s.controls.reset(); }
}

function initCombVizRotation() {
  // No-op for CSS drag: OrbitControls on the Three.js canvas handles rotation.
  // Wire up the reset button and double-click reset once.
  var scene = document.getElementById('comb-pviz-scene');
  if (scene && !scene._combRb) {
    scene._combRb = true;
    scene.addEventListener('dblclick', combVizResetView);
  }
  var resetBtn = document.getElementById('comb-pviz-reset-btn');
  if (resetBtn && !resetBtn._pvizResetInited) {
    resetBtn._pvizResetInited = true;
    resetBtn.addEventListener('click', function(e) { e.stopPropagation(); combVizResetView(); });
  }
}

function renderCombinedViz() {
  // SVG polygon rendering removed — delegate to Three.js unified renderer.
  // The 'comb' prefix renders to comb-three-canvas inside comb-pviz-scene.
  renderThreeUnified3D('comb');
  // Update combined status text
  var pts = combinedMeshPoints;
  var statusEl = document.getElementById('comb-meshVizStatus');
  if (statusEl) {
    if (pts && pts.length > 0) {
      statusEl.textContent = pts.length + ' combined points';
    } else {
      statusEl.textContent = 'No combined data yet';
    }
  }
}


// ── Outline Canvas Renderer ────────────────────────────────────────────────────
function _vizDrawOutlineCanvas() {
  var canvas = document.getElementById('outline-canvas');
  if (!canvas) return;
  var rows = (typeof outlineRowResults !== 'undefined') ? outlineRowResults : [];
  var cols = (typeof outlineColResults !== 'undefined') ? outlineColResults : [];
  if (rows.length === 0 && cols.length === 0) {
    var ctx0 = canvas.getContext('2d');
    if (ctx0) {
      canvas.width  = canvas.offsetWidth  || 400;
      canvas.height = canvas.offsetHeight || 200;
      ctx0.fillStyle = '#0d111a';
      ctx0.fillRect(0, 0, canvas.width, canvas.height);
      ctx0.fillStyle = '#4a5568';
      ctx0.font = '13px monospace';
      ctx0.textAlign = 'center';
      ctx0.fillText('No outline data — run Outline Scan first', canvas.width / 2, canvas.height / 2);
    }
    return;
  }

  // Determine world bounds
  var allX = [], allY = [];
  rows.forEach(function(r) {
    if (r.hasLeft  && r.xLeft  !== null) { allX.push(r.xLeft);  allY.push(r.y); }
    if (r.hasRight && r.xRight !== null) { allX.push(r.xRight); allY.push(r.y); }
  });
  cols.forEach(function(c) {
    if (c.hasBottom && c.yBottom !== null) { allX.push(c.x); allY.push(c.yBottom); }
    if (c.hasTop    && c.yTop    !== null) { allX.push(c.x); allY.push(c.yTop); }
  });
  if (allX.length === 0) return;

  var xMin = Math.min.apply(null, allX);
  var xMax = Math.max.apply(null, allX);
  var yMin = Math.min.apply(null, allY);
  var yMax = Math.max.apply(null, allY);
  var xRange = Math.max(xMax - xMin, 1);
  var yRange = Math.max(yMax - yMin, 1);

  var w = canvas.offsetWidth || 400;
  var h = Math.max(Math.round(w * yRange / xRange), 150);
  canvas.width  = w;
  canvas.height = h;

  var pad = 28;
  var scaleX = (w - 2 * pad) / xRange;
  var scaleY = (h - 2 * pad) / yRange;

  function cx(wx) { return pad + (wx - xMin) * scaleX; }
  function cy(wy) { return h - pad - (wy - yMin) * scaleY; }  // flip Y

  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d111a';
  ctx.fillRect(0, 0, w, h);

  // Search boundary
  var cfg = (typeof _outlineSettings === 'function') ? _outlineSettings() : null;
  if (cfg) {
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx(cfg.x0), cy(cfg.y0 + cfg.yLen), (cfg.xLen) * scaleX, (cfg.yLen) * scaleY);
    ctx.setLineDash([]);
  }

  // Collect all edge points and sort clockwise for single black outline
  var allPts = [];
  rows.forEach(function(r) {
    if (r.hasLeft  && r.xLeft  !== null) allPts.push([r.xLeft,  r.y]);
    if (r.hasRight && r.xRight !== null) allPts.push([r.xRight, r.y]);
  });
  cols.forEach(function(c) {
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
    // This is more robust than a pure angular sort when probe points cluster at
    // similar centroid angles (e.g. row-scan and column-scan points mixing near
    // the top of a wide oval), since it always picks the physically closest
    // unvisited point rather than relying on angle from a distant centroid.
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

    // Check if Force rectangle mode is enabled
    var forceRect = (typeof _outlineSettings === 'function') ? _outlineSettings().forceRectangle : false;

    if (forceRect && typeof _computeInscribedRectangle === 'function' && typeof _pointInPolygon === 'function') {
      // Draw inscribed axis-aligned rectangle instead of spline
      var rect = _computeInscribedRectangle(dedupPts);
      if (rect) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.rect(cx(rect.xMin), cy(rect.yMax), (rect.xMax - rect.xMin) * scaleX, (rect.yMax - rect.yMin) * scaleY);
        ctx.stroke();
      } else {
        forceRect = false; // fall through to spline
      }
    }

    if (!forceRect) {
      // Smooth closed centripetal Catmull-Rom spline on canvas (alpha=0.5).
      // Converts each segment directly to an exact cubic bezier via the centripetal-CR
      // tangent formula — no polyline subdivision needed, giving a mathematically
      // perfect smooth curve with a single bezierCurveTo call per segment.
      function crBezier(p0, p1, p2, p3) {
        function knot(a, b) {
          var dx = b[0]-a[0], dy = b[1]-a[1];
          return Math.pow(dx*dx + dy*dy, 0.25); // = dist^0.5
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
      function wIdx(i) { return ((i % n) + n) % n; }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cx(dedupPts[0][0]), cy(dedupPts[0][1]));
      for (var k = 0; k < n; k++) {
        var p0 = dedupPts[wIdx(k - 1)];
        var p1 = dedupPts[wIdx(k)];
        var p2 = dedupPts[wIdx(k + 1)];
        var p3 = dedupPts[wIdx(k + 2)];
        var bz = crBezier(p0, p1, p2, p3);
        ctx.bezierCurveTo(cx(bz[0][0]), cy(bz[0][1]), cx(bz[1][0]), cy(bz[1][1]), cx(p2[0]), cy(p2[1]));
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Small white dots at each point
    ctx.fillStyle = '#ffffff';
    dedupPts.forEach(function(pt) {
      ctx.beginPath();
      ctx.arc(cx(pt[0]), cy(pt[1]), 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Legend
  ctx.font = '10px monospace';
  var lx = pad;
  var ly = h - 8;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(lx, ly - 8, 10, 10);
  ctx.fillStyle = '#c2d3f2';
  ctx.fillText('Outline', lx + 13, ly);
}

// Register outline canvas renderer on the shared probeViz namespace
if (!window.probeViz) window.probeViz = {};
window.probeViz.drawOutlineCanvas = _vizDrawOutlineCanvas;
