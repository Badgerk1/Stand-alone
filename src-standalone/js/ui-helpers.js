// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(id){
  pluginDebug('switchTab: switching to tab "' + id + '"');
  document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  var panel = document.getElementById('pane-' + id);
  if(panel) panel.classList.add('active');
  // Activate matching tab button using data-tab attribute
  document.querySelectorAll('.tab').forEach(function(t){
    if(t.getAttribute('data-tab') === id) t.classList.add('active');
  });

  // Teleport jog controls between Setup tab and Probe tab
  var jogCard = document.getElementById('jog-controls-card');
  var probeHolder = document.getElementById('probe-jog-panel');
  var setupAnchor = document.getElementById('jog-original-anchor');
  if (jogCard && probeHolder && setupAnchor) {
    if (id === 'top') {
      // Move jog card into the probe placeholder and apply compact style
      probeHolder.appendChild(jogCard);
      jogCard.classList.add('jog-compact');
    } else {
      // Return jog card to its dedicated top-level setup panel (setup-jog-controls)
      setupAnchor.parentNode.insertBefore(jogCard, setupAnchor.nextSibling);
      jogCard.classList.remove('jog-compact');
    }
  }

  // Re-render relief maps when switching to their tabs (canvas needs visible width)
  if(id === 'meshdata') { setTimeout(renderSurfaceReliefMap, 60); setTimeout(renderRelief3D, 120); setTimeout(renderFaceReliefMap, 90); }
  if(id === 'results')  { setTimeout(populateSurfaceResults, 30); setTimeout(renderSurfaceReliefMap, 60); setTimeout(renderFaceReliefMap, 90); }
  // Re-render probe-tab heatmap canvases when switching to probe tab
  if(id === 'top')      { setTimeout(renderSurfaceReliefMap, 60); setTimeout(renderFaceReliefMap, 90); }
  // Refresh Apply tab button states when switching to it so mesh availability is reflected
  if(id === 'apply')    { try { applyUpdateButtons(); } catch(e) {} }
  pluginDebug('switchTab: tab "' + id + '" active');
}

// ── Logging ───────────────────────────────────────────────────────────────────
function persistLogs(){
  try{
    localStorage.setItem(FACE_LOG_KEY, JSON.stringify(faceLogLines));
  }catch(e){
    console.error('Failed to persist logs', e);
  }
}

function loadPersistedLogs(){
  try{
    var savedFace = localStorage.getItem(FACE_LOG_KEY);
    faceLogLines = savedFace ? JSON.parse(savedFace) : [];
  }catch(e){
    console.error('Failed to load persisted logs', e);
    faceLogLines = [];
  }
}

function renderLog(tab){
  var el = document.getElementById(tab + '-log');
  if(!el) return;
  var lines = tab === 'face' ? faceLogLines : (tab === 'outline' ? outlineLogLines : topLogLines);
  el.innerHTML = '';
  lines.forEach(function(line){
    var div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = line;
    el.appendChild(div);
  });
  el.scrollTop = el.scrollHeight;
}

function logLine(tab, msg){
  var el = document.getElementById(tab + '-log');
  if(!el) return;
  var ts = tsMs();
  var line = '[' + ts + '] ' + msg;
  var lines = tab === 'face' ? faceLogLines : (tab === 'outline' ? outlineLogLines : topLogLines);
  lines.push(line);
  if(lines.length > 5000) lines.splice(0, lines.length - 5000);
  persistLogs();
  var div = document.createElement('div');
  div.className = 'log-entry';
  div.textContent = line;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function clearLog(tab){
  if(tab === 'face') faceLogLines = [];
  else if(tab === 'outline') { outlineLogLines = []; try { clearOutlineLogBackup(); } catch(e) {} }
  else topLogLines = [];
  persistLogs();
  renderLog(tab);
}

function saveTextFile(filename, content){
  var blob = new Blob([content], {type:'text/plain;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
}

function tsForFilename(){
  var d = new Date();
  function pad(n){ return String(n).padStart(2, '0'); }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
}

function getLogText(tab){
  var lines = tab === 'face' ? faceLogLines : topLogLines;
  return lines.join('\n') + (lines.length ? '\n' : '');
}

function saveLog(tab){
  var name = 'live-edge-probe_' + tab + '_log_' + tsForFilename() + '.txt';
  var body = '3D Live Edge Mesh ' + tab.toUpperCase() + ' log\n\n' + getLogText(tab);
  saveTextFile(name, body);
  setFooterStatus((tab === 'face' ? 'Face' : 'Top') + ' log saved.', 'good');
}

function buildFullLogBundle(){
  var settings = getSettingsFromUI();
  var payload = [];
  payload.push('3D Live Edge Mesh full log bundle');
  payload.push('Generated: ' + new Date().toISOString());
  payload.push('');
  payload.push('=== SETTINGS ===');
  payload.push(JSON.stringify(settings, null, 2));
  payload.push('');
  payload.push('=== TOP LOG ===');
  payload.push(getLogText('top') || '(empty)');
  payload.push('=== FACE LOG ===');
  payload.push(getLogText('face') || '(empty)');
  payload.push('=== TOP RESULTS ===');
  payload.push(JSON.stringify(topResults, null, 2));
  payload.push('');
  payload.push('=== FACE RESULTS ===');
  payload.push(JSON.stringify(faceResults, null, 2));
  payload.push('');
  payload.push('=== LAYERED FACE RESULTS ===');
  payload.push(JSON.stringify(layeredFaceResults, null, 2));
  payload.push('');
  return payload.join('\n');
}

function saveAllLogs(){
  saveTextFile('live-edge-probe_full_log_bundle_' + tsForFilename() + '.txt', buildFullLogBundle());
  setFooterStatus('Full log bundle saved.', 'good');
}

function setFooterStatus(msg, cls){
  var el = document.getElementById('footer-status');
  el.textContent = msg;
  el.className = 'status-line' + (cls ? ' ' + cls : '');
}

function updateSavedLocationUI(pos){
  if(!pos) return;
  var xEl = document.getElementById('savedLocX');
  var yEl = document.getElementById('savedLocY');
  var zEl = document.getElementById('savedLocZ');
  if(xEl) xEl.value = Number(pos.x || 0).toFixed(3);
  if(yEl) yEl.value = Number(pos.y || 0).toFixed(3);
  if(zEl) zEl.value = Number(pos.z || 0).toFixed(3);
}

function updateSurfaceGridSizeDisplay() {
  var el = document.getElementById('sm-gridSizeDisplay');
  if (!el) return;
  var vMinX = document.getElementById('sm-minX').value;
  var vMaxX = document.getElementById('sm-maxX').value;
  var vSpacingX = document.getElementById('sm-spacingX').value;
  var vMinY = document.getElementById('sm-minY').value;
  var vMaxY = document.getElementById('sm-maxY').value;
  var vSpacingY = document.getElementById('sm-spacingY').value;
  if (vMinX === '' || vMaxX === '' || vSpacingX === '' || vMinY === '' || vMaxY === '' || vSpacingY === '') {
    el.innerHTML = '&mdash;';
    return;
  }
  var minX = Number(vMinX), maxX = Number(vMaxX), spacingX = Number(vSpacingX);
  var minY = Number(vMinY), maxY = Number(vMaxY), spacingY = Number(vSpacingY);
  if (isNaN(minX) || isNaN(maxX) || isNaN(spacingX) || isNaN(minY) || isNaN(maxY) || isNaN(spacingY) ||
      minX >= maxX || minY >= maxY || spacingX <= 0 || spacingY <= 0) {
    el.innerHTML = '&mdash;';
    return;
  }
  var colCount = Math.floor((maxX - minX) / spacingX) + 1;
  var rowCount = Math.floor((maxY - minY) / spacingY) + 1;
  el.innerHTML = colCount + ' &times; ' + rowCount + ' = ' + (colCount * rowCount) + ' points';
}

function smLogProbe(msg) { smAppendLog('sm-probeLog', msg); }
function smLogApply(msg) { smAppendLog('sm-applyLog', msg); }
function smAppendLog(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  var ts = tsMs();
  var text = '[' + ts + '] ' + msg;
  var line = document.createElement('div');
  line.textContent = text;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
function smClearLog(id) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = '';
  if (id === 'sm-probeLog') {
    var bar = document.getElementById('sm-probeProgressBar');
    if (bar) bar.style.width = '0%';
    var track = document.getElementById('sm-probeProgressTrack');
    if (track) track.style.display = 'none';
    smSetProbeStatus('Ready', '');
  }
}
function smSetProbeStatus(msg, type) {
  var el = document.getElementById('sm-probeStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'mini' + (type ? ' status-' + type : '');
}
function smSetProgress(pct) {
  var track = document.getElementById('sm-probeProgressTrack');
  if (track) track.style.display = 'block';
  var el = document.getElementById('sm-probeProgressBar');
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function smFmtN(n) { return Number(n).toFixed(3); }

function populateSurfaceResults() {
  var panel = document.getElementById('res-surface-panel');
  var facePanel = document.getElementById('res-face-panel');
  if (!panel) return;

  var hasSurface = smMeshData && smGridConfig;
  var faceData = getFaceMeshData();
  var hasFace = faceData && faceData.length > 0;

  if (!hasSurface && !hasFace) {
    panel.style.display = 'none';
    if (facePanel) facePanel.style.display = 'none';
    var resSurfRelief0 = document.getElementById('res-surface-relief-panel');
    if (resSurfRelief0) resSurfRelief0.style.display = 'none';
    var resFaceRelief0 = document.getElementById('res-face-relief-panel');
    if (resFaceRelief0) resFaceRelief0.style.display = 'none';
    populateUnifiedProbeTable();
    return;
  }

  // Show/hide top surface panel based on surface data
  panel.style.display = hasSurface ? 'block' : 'none';

  // Show face panel whenever any data is present so both 3D views appear together
  var hasAnyProbeData = hasSurface || hasFace;
  if (facePanel) facePanel.style.display = hasAnyProbeData ? 'block' : 'none';

  // Show/hide Results tab relief map panels based on available data
  var resSurfRelief = document.getElementById('res-surface-relief-panel');
  if (resSurfRelief) resSurfRelief.style.display = hasSurface ? '' : 'none';
  var resFaceRelief = document.getElementById('res-face-relief-panel');
  if (resFaceRelief) resFaceRelief.style.display = hasFace ? '' : 'none';

  var _resFirstRender = !(_threeState['res'] && _threeState['res'].meshGroup);
  initResVizRotation();
  if (_resFirstRender) resVizResetView();
  renderResVizMesh();

  // Always initialize and render face 3D view when the panel is shown
  if (hasAnyProbeData) {
    var _resFaceFirstRender = !(_threeState['resface'] && _threeState['resface'].meshGroup);
    initResFaceVizRotation();
    if (_resFaceFirstRender) resFaceVizResetView();
    renderResFaceVizMesh();
  }

  // Populate summary stats (surface grid summary)
  if (hasSurface) {
    var cfg = smGridConfig, grid = smMeshData;
    var zMin = Infinity, zMax = -Infinity, ptCount = 0;
    for (var r = 0; r < cfg.rowCount; r++) {
      for (var c = 0; c < cfg.colCount; c++) {
        var z = grid[r] && grid[r][c];
        if (z !== null && z !== undefined && isFinite(z)) { if (z < zMin) zMin = z; if (z > zMax) zMax = z; ptCount++; }
      }
    }
    var zDelta = isFinite(zMin) ? (zMax - zMin) : 0;
    var areaX = cfg.maxX - cfg.minX, areaY = cfg.maxY - cfg.minY;
    var sumEl = document.getElementById('res-probe-summary');
    if (sumEl) {
      sumEl.innerHTML =
        '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 12px">' +
          '<div style="color:var(--muted);font-size:10px">Grid</div>' +
          '<div style="color:var(--accent2);font-size:15px;font-weight:700">' + cfg.colCount + '&times;' + cfg.rowCount + '</div>' +
          '<div style="color:var(--muted);font-size:10px">' + ptCount + ' points</div>' +
        '</div>' +
        '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 12px">' +
          '<div style="color:var(--muted);font-size:10px">Area</div>' +
          '<div style="color:var(--text);font-size:14px;font-weight:700">' + areaX + '&times;' + areaY + '</div>' +
          '<div style="color:var(--muted);font-size:10px">coords</div>' +
        '</div>' +
        '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 12px">' +
          '<div style="color:var(--muted);font-size:10px">Z range</div>' +
          '<div style="color:var(--good);font-size:13px;font-weight:700">' + (isFinite(zMin) ? zMin.toFixed(3) : '?') + '</div>' +
          '<div style="color:var(--muted);font-size:10px">to ' + (isFinite(zMax) ? zMax.toFixed(3) : '?') + '</div>' +
        '</div>' +
        '<div style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 12px">' +
          '<div style="color:var(--muted);font-size:10px">Z delta</div>' +
          '<div style="color:var(--warn);font-size:15px;font-weight:700">' + zDelta.toFixed(3) + '</div>' +
          '<div style="color:var(--muted);font-size:10px">coords</div>' +
        '</div>';
    }
  } else {
    var sumEl = document.getElementById('res-probe-summary');
    if (sumEl) sumEl.innerHTML = '';
  }

  populateUnifiedProbeTable();
}

function populateUnifiedProbeTable() {
  var tbody = document.getElementById('res-unified-tbody');
  if (!tbody) return;
  var rows = [];
  var n = 0;

  // Surface probe points
  if (smMeshData && smGridConfig) {
    var cfg = smGridConfig, grid = smMeshData;
    for (var ri = 0; ri < cfg.rowCount; ri++) {
      for (var ci = 0; ci < cfg.colCount; ci++) {
        var x = cfg.minX + ci * cfg.colSpacing;
        var y = cfg.minY + ri * cfg.rowSpacing;
        var zval = grid[ri][ci];
        n++;
        rows.push('<tr><td>' + n + '</td><td>' + smFmtN(x) + '</td><td>' + smFmtN(y) + '</td><td>' + (zval != null ? smFmtN(zval) : '&mdash;') + '</td><td>&mdash;</td><td style="color:var(--accent2)">Surface</td></tr>');
      }
    }
  }

  // Face probe points
  var faceData = getFaceMeshData();
  if (faceData && faceData.length) {
    faceData.forEach(function(p) {
      var layer = p.layer != null ? p.layer : 1;
      n++;
      rows.push('<tr><td>' + n + '</td><td>' + Number(p.x).toFixed(3) + '</td><td>' + Number(p.y).toFixed(3) + '</td><td>' + Number(p.z).toFixed(3) + '</td><td>' + (p.machineZ != null ? Number(p.machineZ).toFixed(3) : '&mdash;') + '</td><td style="color:var(--good)">Face L' + layer + '</td></tr>');
    });
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:16px;">No probe data yet</td></tr>';
  } else {
    tbody.innerHTML = rows.join('');
  }
}


function updateSurfaceMeshUI() {
  // Ensure smPvizXYtoPos() has the correct config for rendering
  if (smGridConfig) window._smPvizCfg = smGridConfig;
  updateMeshTable_sm();
  initSurfVizRotation();
  surfVizResetView();
  smPvizRenderMesh();    // Keep Probe tab 3D visualizer in sync
  renderSurfVizMesh();   // Mesh Data tab 3D visualizer
  populateSurfaceResults();
  // Render relief maps then switch probe-tab surface section to heatmap view
  setTimeout(function() {
    renderSurfaceReliefMap();
    setTimeout(renderRelief3D, 60);
    setTimeout(function() { showProbeHeatmapView('sm'); }, 120);
  }, 60);
}

function updateMeshTable_sm() {
  var tbody = document.getElementById('sm-meshTableBody');
  if (!tbody) return;
  if (!smMeshData || !smGridConfig) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:16px;">No data yet</td></tr>';
    return;
  }
  var cfg = smGridConfig;
  var refZ = Number((document.getElementById('sm-referenceZ') || {value: 0}).value);
  var rows = [];
  var n = 0;
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var x = cfg.minX + ci * cfg.colSpacing;
      var y = cfg.minY + ri * cfg.rowSpacing;
      var z = smMeshData[ri][ci];
      var offset = z != null ? (z - refZ).toFixed(3) : '-';
      rows.push('<tr><td>' + n + '</td><td>' + smFmtN(x) + '</td><td>' + smFmtN(y) + '</td><td>' + (z != null ? smFmtN(z) : '-') + '</td><td>' + offset + '</td></tr>');
      n++;
    }
  }
  tbody.innerHTML = rows.join('');
}

function applyLogSurface(msg) {
  var el = document.getElementById('apply-surface-log');
  if (!el) return;
  el.style.display = 'block';
  var ts = tsMs();
  var line = document.createElement('div');
  line.textContent = '[' + ts + '] ' + msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function applyLogFace(msg) {
  var el = document.getElementById('apply-face-log');
  if (!el) return;
  el.style.display = 'block';
  var ts = tsMs();
  var line = document.createElement('div');
  line.textContent = '[' + ts + '] ' + msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function applyUpdateButtons() {
  var hasGcode = !!applyOriginalGcode;
  var hasSurfaceMesh = !!smMeshData && !!smGridConfig;
  var hasFaceMesh = (typeof getFaceMeshData === 'function') && !!getFaceMeshData();

  var surfaceBtn = document.getElementById('apply-btn-surface-comp');
  if (surfaceBtn) surfaceBtn.disabled = !(hasGcode && hasSurfaceMesh);

  var faceBtn = document.getElementById('apply-btn-face-comp');
  if (faceBtn) faceBtn.disabled = !(hasGcode && hasFaceMesh);

  var dlSurface = document.getElementById('apply-btn-download-surface');
  if (dlSurface) dlSurface.disabled = !applySurfaceCompGcode;

  var sendSurface = document.getElementById('apply-btn-send-ncsender-surface');
  if (sendSurface) sendSurface.disabled = !applySurfaceCompGcode;

  var dlFace = document.getElementById('apply-btn-download-face');
  if (dlFace) dlFace.disabled = !applyFaceCompGcode;

  var sendFace = document.getElementById('apply-btn-send-ncsender-face');
  if (sendFace) sendFace.disabled = !applyFaceCompGcode;
}

function applyUpdatePreview(gcodeText) {
  var el = document.getElementById('apply-preview');
  if (!el || !gcodeText) return;
  el.textContent = gcodeText.split('\n').slice(0, 40).join('\n');
  if (gcodeText.split('\n').length > 40) {
    el.textContent += '\n... (' + gcodeText.split('\n').length + ' total lines)';
  }
}

function applyDownloadCompensatedGcode(type) {
  var gcode = (type === 'face') ? applyFaceCompGcode : applySurfaceCompGcode;
  if (!gcode) { alert('No compensated G-code. Apply compensation first.'); return; }
  var blob = new Blob([gcode], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'compensated_' + type + '_' + Date.now() + '.nc';
  a.click();
}

async function applySendToNcSender(type) {
  var gcode = (type === 'face') ? applyFaceCompGcode : applySurfaceCompGcode;
  if (!gcode) { alert('No compensated G-code. Apply compensation first.'); return; }
  await sendCompToNcSender(gcode, 'compensated_' + type);
}

function updateFaceMeshDataUI() {
  updateFaceMeshTable();
  initFacePVizRotation();
  facePVizResetView();
  renderFacePVizMesh();
  updateFaceCompGridInfo();
  // Update Results tab 3D viz and data table so face-only probing stays in sync
  renderResVizMesh();
  populateSurfaceResults();
  // Render face relief map to all instances (Probe tab + Results tab)
  // then auto-switch probe-tab face section to heatmap view
  setTimeout(function() {
    renderFaceReliefMap();
    setTimeout(function() { showProbeHeatmapView('face'); }, 120);
  }, 60);
  // Auto-populate Apply tab reference position if still at default (0)
  var refEl = document.getElementById('apply-face-refPos');
  if (refEl && (!refEl.value || Number(refEl.value) === 0)) {
    var data = getFaceMeshData();
    if (data && data.length) {
      var axisEl = document.getElementById('apply-face-axis');
      var ax = axisEl ? (axisEl.value || 'Y').toUpperCase() : 'Y';
      var vals = [], sum = 0;
      for (var i = 0; i < data.length; i++) {
        var v = ax === 'X' ? Number(data[i].x) : Number(data[i].y);
        if (!isNaN(v)) vals.push(v);
      }
      if (vals.length) {
        for (var j = 0; j < vals.length; j++) sum += vals[j];
        var mean = Math.round((sum / vals.length) * 1000) / 1000;
        refEl.value = mean;
        var statsEl = document.getElementById('apply-face-refPos-stats');
        if (statsEl) {
          var mn = vals[0], mx = vals[0];
          for (var k = 0; k < vals.length; k++) {
            if (vals[k] < mn) mn = vals[k];
            if (vals[k] > mx) mx = vals[k];
          }
          statsEl.textContent = 'Auto: Mean ' + mean.toFixed(3) + ' | Min: ' + mn.toFixed(3) +
            ' | Max: ' + mx.toFixed(3) + ' | ' + vals.length + ' points';
        }
      }
    }
  }
}

function updateFaceMeshTable() {
  var tbody = document.getElementById('face-meshTableBody');
  if (!tbody) return;
  var data = getFaceMeshData();
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:16px;">No data yet</td></tr>';
    var vizStatus = document.getElementById('face-meshVizStatus');
    if (vizStatus) vizStatus.textContent = 'No face mesh data — run a face probe or load face mesh';
    return;
  }
  var rows = [];
  data.forEach(function(p, i) {
    var layer = p.layer != null ? p.layer : (p.type === 'face' ? 1 : '-');
    rows.push('<tr><td>' + (i + 1) + '</td><td>' + Number(p.x).toFixed(3) + '</td><td>' +
      Number(p.y).toFixed(3) + '</td><td>' + Number(p.z).toFixed(3) + '</td><td>' + layer + '</td></tr>');
  });
  tbody.innerHTML = rows.join('');
  var vizStatus = document.getElementById('face-meshVizStatus');
  if (vizStatus) vizStatus.textContent = data.length + ' contact points across ' +
    (layeredFaceResults && layeredFaceResults.length ? new Set(layeredFaceResults.map(function(p){ return p.layer; })).size : 1) + ' layer(s)';
}

function updateFaceCompGridInfo() {
  var el = document.getElementById('face-comp-grid-info');
  if (el) {
    var data = getFaceMeshData();
    if (!data || !data.length) {
      el.textContent = 'No face mesh loaded \u2014 run a face probe or load face mesh in the Probe tab.';
      el.style.color = 'var(--muted)';
    } else {
      var layerSet = {};
      data.forEach(function(p){ layerSet[p.layer] = true; });
      var layerCount = Object.keys(layerSet).length;
      var xs = data.map(function(p){ return Number(p.x); });
      var zs = data.map(function(p){ return Number(p.z); });
      el.textContent = data.length + ' face contact points across ' + layerCount + ' layer(s) \u2014 X: ' +
        Math.min.apply(null, xs).toFixed(2) + ' to ' + Math.max.apply(null, xs).toFixed(2) +
        ', Z: ' + Math.min.apply(null, zs).toFixed(2) + ' to ' + Math.max.apply(null, zs).toFixed(2);
      el.style.color = 'var(--good)';
    }
  }
}
// ── Probe Type Dropdown ───────────────────────────────────────────────────────

function onProbeTypeChange() {
  var type = (document.getElementById('probe-type-select') || {}).value || '2d-surface';

  // Face axis row
  var axisRow = document.getElementById('probe-axis-row');
  if (axisRow) axisRow.style.display = (type === 'face' || type === 'combined') ? 'flex' : 'none';

  // Surface config section (grid + probe settings)
  var showSurface = (type === '2d-surface' || type === 'combined');
  var surfCfg = document.getElementById('surface-config-section');
  if (surfCfg) surfCfg.style.display = showSurface ? '' : 'none';
  var surfProbeSettings = document.getElementById('surface-probe-settings-section');
  if (surfProbeSettings) surfProbeSettings.style.display = showSurface ? '' : 'none';

  // Face config section
  var showFace = (type === 'face' || type === 'combined');
  var faceCfg = document.getElementById('face-config-section');
  if (faceCfg) faceCfg.style.display = showFace ? '' : 'none';
  var faceSurfCfg = document.getElementById('face-surf-config-section');
  if (faceSurfCfg) faceSurfCfg.style.display = showFace ? '' : 'none';

  // Surface mesh panels (split from surface-mesh-section into individual top-level panels)
  if (showSurface) {
    var smHeatmap = document.getElementById('sm-heatmap-panel');
    if (smHeatmap) smHeatmap.style.display = '';
    var surfExport = document.getElementById('surf-export-panel');
    if (surfExport) surfExport.style.display = '';
  } else {
    ['sm-heatmap-panel', 'sm-terrain-panel', 'surf-export-panel'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // Face mesh panels (split from face-mesh-section into individual top-level panels)
  if (showFace) {
    ['face-heatmap-panel', 'face-point-data-panel', 'face-data-mgmt-panel', 'face-export-panel'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = '';
    });
  } else {
    ['face-heatmap-panel', 'face-terrain-panel', 'face-point-data-panel', 'face-data-mgmt-panel', 'face-export-panel'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // Face probe direct controls section
  var faceDirectControls = document.getElementById('face-direct-controls-section');
  if (faceDirectControls) faceDirectControls.style.display = showFace ? '' : 'none';

  // Unified log sections
  var surfLogWrap = document.getElementById('unified-log-surface-wrap');
  if (surfLogWrap) surfLogWrap.style.display = showSurface ? '' : 'none';
  var faceLogWrap = document.getElementById('unified-log-face-wrap');
  if (faceLogWrap) faceLogWrap.style.display = showFace ? '' : 'none';
  var liveLogWrap = document.getElementById('unified-log-live-wrap');
  if (liveLogWrap) liveLogWrap.style.display = showSurface ? '' : 'none';

  // Run button label
  var runBtn = document.getElementById('sm-btn-run-probe');
  if (runBtn) {
    if (type === '2d-surface') runBtn.textContent = '\u25b6 Run Surface Probe';
    else if (type === 'face') runBtn.textContent = '\u25b6 Run Face Probe';
    else runBtn.textContent = '\u25b6\u25b6 Run Combined Probe';
  }

  // Combined export panel — only visible in combined mode
  var combExport = document.getElementById('combined-export-panel');
  if (combExport) combExport.style.display = (type === 'combined') ? '' : 'none';

  // Combined settings panel — only visible in combined mode
  var combSettings = document.getElementById('combined-settings-panel');
  if (combSettings) combSettings.style.display = (type === 'combined') ? '' : 'none';

  // Auto-fill Bottom Z when switching into combined mode
  if (type === 'combined') _autoFillCombinedBottomZ();

  // Update Combined face plan status line whenever the mode changes
  try { fpUpdateCombinedFacePlanStatus(); } catch(e) {}
}

function saveUnifiedProbeLog() {
  function getElementLogText(id) {
    var el = document.getElementById(id);
    if (!el) return '';
    var lines = [];
    for (var i = 0; i < el.children.length; i++) {
      lines.push(el.children[i].textContent);
    }
    return lines.join('\n');
  }
  var surfLog = getElementLogText('sm-probeLog');
  var faceLog = getElementLogText('face-log');
  var liveLog = getElementLogText('sm-pviz-live-log');
  var type = (document.getElementById('probe-type-select') || {}).value || '2d-surface';
  var combined = '';
  if (type === '2d-surface' || type === 'combined') combined += '=== Surface Probe Log ===\n' + surfLog + '\n';
  if (type === 'face' || type === 'combined') combined += '=== Face Probe Log ===\n' + faceLog + '\n';
  if (liveLog) combined += '=== Live Movement Log ===\n' + liveLog + '\n';
  var blob = new Blob([combined], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'probe-log-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
  a.click();
}

function clearUnifiedProbeLog() {
  var surfLog = document.getElementById('sm-probeLog');
  if (surfLog) surfLog.textContent = '';
  var faceLog = document.getElementById('face-log');
  if (faceLog) faceLog.textContent = '';
  var liveLog = document.getElementById('sm-pviz-live-log');
  if (liveLog) liveLog.textContent = '';
  _smPvizLiveLogLastPos = null;
}

function startProbeByType() {
  var type = (document.getElementById('probe-type-select') || {}).value || '2d-surface';
  var axis = (document.getElementById('probe-face-axis-select') || {}).value || 'Y';
  if (type === '2d-surface') {
    runSurfaceProbing();
  } else if (type === 'face') {
    runFaceProbe(axis);
  } else if (type === 'combined') {
    runCombinedProbeMode(axis);
  }
}

// ── Merge combined data ───────────────────────────────────────────────────────

function mergeCombinedProbeData() {
  var points = [];

  // Add surface mesh points
  if (smMeshData && smGridConfig) {
    var cfg = smGridConfig;
    for (var ri = 0; ri < cfg.rowCount; ri++) {
      for (var ci = 0; ci < cfg.colCount; ci++) {
        var z = smMeshData[ri] && smMeshData[ri][ci];
        if (z !== null && z !== undefined && isFinite(z)) {
          points.push({
            x: cfg.minX + ci * cfg.colSpacing,
            y: cfg.minY + ri * cfg.rowSpacing,
            z: z,
            source: 'surface'
          });
        }
      }
    }
  }

  // Add face probe contact points
  if (layeredFaceResults && layeredFaceResults.length > 0) {
    layeredFaceResults.forEach(function(r) {
      var x = Number(r.x), y = Number(r.y), z = Number(r.z);
      if (isFinite(x) && isFinite(y) && isFinite(z)) {
        points.push({ x: x, y: y, z: z, source: 'face' });
      }
    });
  } else if (faceResults && faceResults.length > 0) {
    faceResults.forEach(function(r) {
      if (r.status && (r.status.indexOf('FACE') !== -1) && r.status.indexOf('MISS') === -1) {
        var x = Number(r.x), y = Number(r.y), z = Number(r.z);
        if (isFinite(x) && isFinite(y) && isFinite(z)) {
          points.push({ x: x, y: y, z: z, source: 'face' });
        }
      }
    });
  }

  combinedMeshPoints = points.length > 0 ? points : null;
  return combinedMeshPoints;
}

// ── Combined Mesh UI ──────────────────────────────────────────────────────────

function updateCombinedMeshUI() {
  var hasData = combinedMeshPoints && combinedMeshPoints.length > 0;
  ['combined-mesh-panel', 'combined-mesh-data-panel', 'combined-mesh-mgmt-panel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = hasData ? 'block' : 'none';
  });

  if (!hasData) return;

  // Update data table
  var tbody = document.getElementById('comb-mesh-tbody');
  if (tbody) {
    var rows = [];
    combinedMeshPoints.forEach(function(pt, i) {
      var srcColor = pt.source === 'surface' ? 'var(--accent2)' : '#e4a050';
      var srcLabel = pt.source === 'surface' ? 'Surface' : 'Face';
      rows.push('<tr><td>' + (i + 1) + '</td><td style="color:' + srcColor + ';font-weight:600">' + srcLabel +
        '</td><td>' + pt.x.toFixed(3) + '</td><td>' + pt.y.toFixed(3) + '</td><td>' + pt.z.toFixed(3) + '</td></tr>');
    });
    tbody.innerHTML = rows.join('');
  }

  // Update status (count in single pass)
  var statusEl = document.getElementById('comb-meshVizStatus');
  var surfPts = 0, facePts = 0;
  combinedMeshPoints.forEach(function(p) { if (p.source === 'surface') surfPts++; else facePts++; });
  if (statusEl) statusEl.textContent = combinedMeshPoints.length + ' total points (' + surfPts + ' surface, ' + facePts + ' face)';

  // Render combined 3D visualizer
  renderCombinedViz();
  initCombVizRotation();
}

// ── Outline UI helpers ────────────────────────────────────────────────────────
function outlineSetProgress(pct) {
  var bar = document.getElementById('outline-progressBar');
  if (bar) bar.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
}
function outlineAppendLog(msg) {
  logLine('outline', msg);
  // Persist to localStorage for crash/E-stop recovery
  try {
    var key = 'outlineLogBackup';
    var existing = localStorage.getItem(key) || '';
    localStorage.setItem(key, existing + msg + '\n');
  } catch(e) { /* storage full or unavailable */ }
  // Also update results summary when scan completes
  try { _outlineUpdateResultsSummary(); } catch(e) {}
}
function outlineSetStatus(msg, type) {
  var el = document.getElementById('outline-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-line mini mt4 mb8' + (type ? ' status-' + type : '');
}
function exportLog(tabName) {
  var logEl = document.getElementById(tabName + '-log');
  if (!logEl) return;
  saveTextFile(tabName + '_log_' + tsForFilename() + '.txt', logEl.innerText || logEl.textContent);
}
function _outlineUpdateResultsSummary() {
  var rows = typeof outlineRowResults !== 'undefined' ? outlineRowResults.length : 0;
  var cols = typeof outlineColResults !== 'undefined' ? outlineColResults.length : 0;
  var surfZ = typeof outlineSurfaceZ !== 'undefined' && outlineSurfaceZ !== null ? outlineSurfaceZ.toFixed(4) : 'n/a';
  var msg = rows > 0 || cols > 0
    ? rows + ' row(s), ' + cols + ' col(s) detected.  Surface Z: ' + surfZ
    : 'No outline data yet. Run Outline Scan first.';
  var s1 = document.getElementById('outline-results-summary');
  var s2 = document.getElementById('res-outline-summary');
  if (s1) s1.textContent = msg;
  if (s2) s2.textContent = msg;
  var panel = document.getElementById('res-outline-panel');
  if (panel) panel.style.display = (rows > 0 || cols > 0) ? '' : 'none';

  // Compute and display bounding-box absolute centre from probed edge points
  var centreEl  = document.getElementById('outline-centre-display');
  var centreBtn = document.getElementById('btn-outline-set-wcs-centre');
  var moveBtn   = document.getElementById('btn-outline-move-centre');
  if (rows > 0 || cols > 0) {
    var allX = [], allY = [];
    if (typeof outlineRowResults !== 'undefined') {
      outlineRowResults.forEach(function(r) {
        if (r.hasLeft  && r.xLeft  !== null) { allX.push(r.xLeft);  allY.push(r.y); }
        if (r.hasRight && r.xRight !== null) { allX.push(r.xRight); allY.push(r.y); }
      });
    }
    if (typeof outlineColResults !== 'undefined') {
      outlineColResults.forEach(function(c) {
        if (c.hasBottom && c.yBottom !== null) { allX.push(c.x); allY.push(c.yBottom); }
        if (c.hasTop    && c.yTop    !== null) { allX.push(c.x); allY.push(c.yTop); }
      });
    }
    if (allX.length > 0) {
      var xMin = Math.min.apply(null, allX);
      var xMax = Math.max.apply(null, allX);
      var yMin = Math.min.apply(null, allY);
      var yMax = Math.max.apply(null, allY);
      var cx = (xMin + xMax) / 2;
      var cy = (yMin + yMax) / 2;
      if (centreEl) {
        centreEl.textContent = 'Centre  X=' + cx.toFixed(3) + '  Y=' + cy.toFixed(3) +
          '   (Width=' + (xMax - xMin).toFixed(3) + '  Height=' + (yMax - yMin).toFixed(3) + ')';
        centreEl.style.color = 'var(--accent2)';
      }
      if (centreBtn) centreBtn.style.display = '';
      if (moveBtn)   moveBtn.style.display   = '';
    }
  } else {
    if (centreEl)  { centreEl.textContent = ''; }
    if (centreBtn) centreBtn.style.display = 'none';
    if (moveBtn)   moveBtn.style.display   = 'none';
  }
}

function updateOutlineProbeCenter() {
  var x0   = Number((document.getElementById('outlineX0')   || {}).value) || 0;
  var xLen = Number((document.getElementById('outlineXLen') || {}).value) || 0;
  var y0   = Number((document.getElementById('outlineY0')   || {}).value) || 0;
  var yLen = Number((document.getElementById('outlineYLen') || {}).value) || 0;
  var cx = x0 + xLen / 2;
  var cy = y0 + yLen / 2;
  var el = document.getElementById('outlineProbeCenter');
  if (el) el.value = 'X=' + cx.toFixed(3) + '  Y=' + cy.toFixed(3);
}
