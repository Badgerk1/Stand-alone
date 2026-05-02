function smSaveMeshToStorage() {
  if (!smMeshData || !smGridConfig) return;
  var statusEl = document.getElementById('sm-meshStorageStatus');
  try {
    localStorage.setItem(SM_MESH_KEY, JSON.stringify({ gridConfig: smGridConfig, meshData: smMeshData, timestamp: Date.now() }));
  } catch(e) {
    if (statusEl) statusEl.textContent = 'Failed to save to storage: ' + e.message;
  }
}

function saveSurfaceMesh() {
  var statusEl = document.getElementById('sm-meshStorageStatus');
  if (!smMeshData || !smGridConfig) {
    if (statusEl) statusEl.textContent = 'No mesh data to save.';
    return;
  }
  var today = new Date();
  var dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  var suggestedName = 'mesh-data-' + dateStr + '.json';
  var data = { pluginVersion: SM_VERSION, gridConfig: smGridConfig, meshData: smMeshData, timestamp: Date.now() };
  var jsonStr = JSON.stringify(data, null, 2);

  // Also save to localStorage as backup
  smSaveMeshToStorage();

  if (window.showSaveFilePicker) {
    // Preferred: native OS file save dialog (Chromium-based browsers)
    window.showSaveFilePicker({
      suggestedName: suggestedName,
      types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
    }).then(function(handle) {
      return handle.createWritable().then(function(writable) {
        return writable.write(jsonStr).then(function() {
          return writable.close();
        }).then(function() {
          if (statusEl) statusEl.textContent = '\u2705 Saved to file: ' + handle.name + ' (also backed up to browser storage)';
        });
      });
    }).catch(function(err) {
      if (err.name !== 'AbortError') {
        if (statusEl) statusEl.textContent = 'Save failed: ' + err.message;
        console.error('Save mesh failed:', err);
      } else {
        if (statusEl) statusEl.textContent = 'Save cancelled (backed up to browser storage).';
      }
    });
  } else {
    // Fallback: trigger download to default Downloads folder
    try {
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (statusEl) statusEl.textContent = '\u2705 Saved as ' + suggestedName + ' (also backed up to browser storage)';
    } catch(e) {
      if (statusEl) statusEl.textContent = 'Save failed: ' + e.message;
    }
  }
}

function loadSurfaceMesh() {
  try {
    var raw = localStorage.getItem(SM_MESH_KEY);
    var statusEl = document.getElementById('sm-meshStorageStatus');
    if (!raw) {
      if (statusEl) statusEl.textContent = 'No mesh in storage.';
      return;
    }
    var data = JSON.parse(raw);
    smMeshDataRaw = data.meshData;
    smGridConfigRaw = data.gridConfig;
    var subdivided = subdivideSurfaceMesh(data.meshData, data.gridConfig, meshSubdivisionSpacing);
    smMeshData = subdivided.grid;
    smGridConfig = subdivided.config;
    updateSurfaceMeshUI();
    if (statusEl) statusEl.textContent = 'Mesh loaded from storage.';
  } catch(e) {
    var errEl = document.getElementById('sm-meshStorageStatus');
    if (errEl) errEl.textContent = 'Failed to load: ' + e.message;
  }
}

function exportSurfaceMesh() {
  if (!smMeshData) { alert('No mesh data to export.'); return; }
  var data = { pluginVersion: SM_VERSION, gridConfig: smGridConfig, meshData: smMeshData };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'surface_mesh_' + Date.now() + '.json';
  a.click();
}

function smSaveReplayHtml() {
  if ((!smPvizProbeSequence || smPvizProbeSequence.length === 0) && !smMeshData) {
    alert('No mesh data available.\n\nRun a surface probe or load mesh data in the Mesh Data tab first, then click Save Replay HTML.');
    return;
  }

  // Safely JSON-encode and escape <\/script> tags to avoid premature closing of the script block
  function safeJson(v) {
    return JSON.stringify(v).replace(/<\/script>/gi, '<\\/script>');
  }

  var seqJson  = safeJson(smPvizProbeSequence);
  var cfgJson  = safeJson(smGridConfig);
  var meshJson = safeJson(smMeshData);

  // ── Probe spindle graphic (inline SVG; no external file dependency) ─────────
  // In-house design inspired by ncSender probe visual style.
  // ncSender © 2024 siganberg, GPL-3.0/Commercial dual license.
  // This asset is independently designed and not copied from ncSender source.
  var probeImg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 138" class="sm-probe-img" aria-label="Probe spindle">'
    + '<defs>'
    + '<linearGradient id="probeBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">'
    + '<stop offset="0%" style="stop-color:#1a3a5c"/>'
    + '<stop offset="30%" style="stop-color:#2a5a8c"/>'
    + '<stop offset="70%" style="stop-color:#2a5a8c"/>'
    + '<stop offset="100%" style="stop-color:#1a3a5c"/>'
    + '</linearGradient>'
    + '<linearGradient id="probeCollarGrad" x1="0%" y1="0%" x2="100%" y2="0%">'
    + '<stop offset="0%" style="stop-color:#3d5a7a"/>'
    + '<stop offset="50%" style="stop-color:#5a8ab8"/>'
    + '<stop offset="100%" style="stop-color:#3d5a7a"/>'
    + '</linearGradient>'
    + '<linearGradient id="probeStylusGrad" x1="0%" y1="0%" x2="100%" y2="0%">'
    + '<stop offset="0%" style="stop-color:#c0c0c0"/>'
    + '<stop offset="50%" style="stop-color:#f0f0f0"/>'
    + '<stop offset="100%" style="stop-color:#c0c0c0"/>'
    + '</linearGradient>'
    + '</defs>'
    + '<rect x="16" y="1" width="14" height="24" rx="2" fill="url(#probeCollarGrad)" stroke="#5a8ab8" stroke-width="1.5"/>'
    + '<rect x="18" y="3" width="3" height="20" rx="1" fill="rgba(120,180,220,0.25)"/>'
    + '<path d="M16 25 L8 36 L38 36 L30 25 Z" fill="url(#probeBodyGrad)" stroke="#4a7aa8" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<rect x="8" y="36" width="30" height="26" rx="3" fill="url(#probeBodyGrad)" stroke="#4a7aa8" stroke-width="1.5"/>'
    + '<line x1="9" y1="46" x2="37" y2="46" stroke="#5a8ab8" stroke-width="0.8" opacity="0.5"/>'
    + '<line x1="9" y1="55" x2="37" y2="55" stroke="#5a8ab8" stroke-width="0.8" opacity="0.5"/>'
    + '<path d="M8 62 L15 72 L31 72 L38 62 Z" fill="url(#probeBodyGrad)" stroke="#4a7aa8" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<rect x="15" y="72" width="16" height="30" rx="2" fill="url(#probeCollarGrad)" stroke="#5a8ab8" stroke-width="1.5"/>'
    + '<path d="M15 102 L20 110 L26 110 L31 102 Z" fill="url(#probeCollarGrad)" stroke="#5a8ab8" stroke-width="1.5" stroke-linejoin="round"/>'
    + '<rect x="21" y="110" width="4" height="20" rx="1" fill="url(#probeStylusGrad)" stroke="#a0a0a0" stroke-width="0.5"/>'
    + '<circle cx="23" cy="134" r="4" fill="#e04040" stroke="#ff6060" stroke-width="1.5"/>'
    + '<circle cx="22" cy="132.5" r="1.2" fill="rgba(255,255,255,0.5)"/>'
    + '</svg>';

  var html = '<!DOCTYPE html>\n'
    + '<html lang="en">\n'
    + '<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<title>3D Live Edge Mesh \u2014 Probe Replay</title>\n'
    + '<style>\n'
    + ':root{--bg:#0b0f18;--panel:#111723;--panel2:#141b27;--line:#1e2d47;--text:#d8e6ff;--muted:#4a6280;--good:#5fd38d;--warn:#e4bd53;--bad:#e06060;--accent:#3d7bd6;--accent2:#73d85f}\n'
    + '*{box-sizing:border-box;margin:0;padding:0}\n'
    + 'body{background:var(--bg);color:var(--text);font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;min-height:100vh;padding:12px}\n'
    + '.app{max-width:720px;margin:0 auto}\n'
    + '.header{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:10px}\n'
    + '.title{font-size:16px;font-weight:700;color:var(--text)}\n'
    + '.subtitle{font-size:11px;color:var(--muted);margin-top:2px}\n'
    + '.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px}\n'
    + '.box-title{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}\n'
    + '.btn-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}\n'
    + '.btn{height:34px;padding:0 14px;border-radius:8px;border:1px solid var(--accent);background:linear-gradient(180deg,#1f3d6a,#162d50);color:var(--text);cursor:pointer;font:inherit;font-size:12px;font-weight:600;transition:opacity .15s}\n'
    + '.btn:hover{opacity:.85}\n'
    + '.btn.ghost{background:transparent;border-color:var(--line)}\n'
    + '.btn.ghost:hover{border-color:var(--accent);background:rgba(61,123,214,.08)}\n'
    + '.btn.warn{background:linear-gradient(180deg,#5a2020,#3d1818);border-color:#9e4040}\n'
    + 'select{height:34px;padding:0 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font:inherit;font-size:12px;cursor:pointer}\n'
    + '.progress-track{height:6px;background:var(--panel2);border-radius:999px;overflow:hidden;border:1px solid var(--line)}\n'
    + '.progress-fill{height:100%;background:linear-gradient(90deg,#3d7bd6,#73d85f);border-radius:999px;width:0%;transition:width .3s}\n'
    + '#replay-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:10px}\n'
    + '#replay-timeline{flex:1 1 200px}\n'
    + '#replay-pct{font-size:10px;color:var(--muted);width:36px;text-align:right}\n'
    // 3D scene (top-down default)
    + '#sm-pviz-scene{position:relative;height:250px;background:radial-gradient(ellipse at 50% 0%,#0f1f38 0%,#060a10 70%);border:1px solid var(--line);border-radius:10px;overflow:hidden;cursor:grab;user-select:none}\n'
    + '#sm-pviz-scene.pviz-dragging{cursor:grabbing}\n'
    + '#sm-pviz-3dscene{position:absolute;width:78%;height:58%;left:11%;top:18%}\n'
    + '#sm-pviz-reset-btn{position:absolute;top:7px;right:9px;z-index:10;padding:3px 9px;border-radius:8px;border:1px solid rgba(58,85,128,.55);background:rgba(8,17,30,.72);color:var(--muted);font:10px/1.5 system-ui,-apple-system,sans-serif;cursor:pointer;transition:color .2s,border-color .2s}\n'
    + '#sm-pviz-reset-btn:hover{color:var(--text);border-color:var(--accent2)}\n'
    + '#sm-pviz-surface{position:absolute;inset:0;background-image:repeating-linear-gradient(90deg,rgba(58,85,128,.45) 0 1px,transparent 1px 100%),repeating-linear-gradient(0deg,rgba(58,85,128,.45) 0 1px,transparent 1px 100%);background-size:25% 33.33%;background-color:#08111e;border:1px solid rgba(58,85,128,.65);z-index:2}\n'
    + '.sm-pviz-dot{position:absolute;width:9px;height:9px;border-radius:50%;margin:-4.5px 0 0 -4.5px;pointer-events:none;transition:opacity .3s;z-index:3}\n'
    + '#sm-pviz-probe-wrap{position:absolute;width:0;height:0;left:50%;top:50%;transition:left 25ms linear,top 25ms linear;z-index:4}\n'
    + '#sm-pviz-probe-shadow{position:absolute;width:18px;height:18px;border-radius:50%;margin:-9px 0 0 -9px;background:rgba(149,168,200,.18)}\n'
    + '#sm-pviz-probe-body{position:absolute;left:-23px;top:-138px;transition:transform 25ms linear;pointer-events:none}\n'
    + '.sm-probe-img{width:46px;height:auto;display:block;transform-origin:50% 90%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.45));animation:smProbeWobble 2.4s ease-in-out infinite}\n'
    + '#sm-pviz-probe-body.probe-plunging .sm-probe-img,#sm-pviz-probe-body.probe-contact .sm-probe-img{animation:none}\n'
    + '@keyframes smProbeWobble{0%,100%{transform:translateY(0) rotateZ(0deg)}30%{transform:translateY(-3px) rotateZ(1.5deg)}70%{transform:translateY(-1.5px) rotateZ(-1deg)}}\n'
    + '#sm-pviz-probe-body.probe-plunging{transform:translateY(10px)}\n'
    + '#sm-pviz-probe-body.probe-contact{transform:translateY(12px);animation:smPvizBodyGlow .55s ease-in-out 3}\n'
    + '@keyframes smPvizBodyGlow{0%,100%{filter:drop-shadow(0 0 3px rgba(255,106,32,.15))}50%{filter:drop-shadow(0 0 8px rgba(255,106,32,.95)) drop-shadow(0 0 18px rgba(255,106,32,.5))}}\n'
    + '#sm-pviz-mesh-layer{position:absolute;inset:0;pointer-events:none;z-index:1}\n'
    + '#sm-pviz-mesh{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 0.5s ease;pointer-events:none;overflow:visible}\n'
    + '#sm-pviz-mesh.mesh-visible,#sm-pviz-mesh.mesh-active{opacity:1}\n'
    // Tilt mode overrides
    + '#sm-pviz-scene.sm-pviz-tilt{perspective:700px;perspective-origin:50% 10%}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-3dscene{transform-style:preserve-3d;transform:rotateX(60deg) rotateY(0deg) rotateZ(-35deg)}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-surface{transform-style:preserve-3d}\n'
    + '#sm-pviz-scene.sm-pviz-tilt .sm-pviz-dot{transform:translateZ(4px);z-index:auto}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-mesh-layer{transform:translateZ(-2px);transform-style:preserve-3d;z-index:auto}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-probe-wrap{transform-style:preserve-3d;transform:translateZ(2px);z-index:auto}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-probe-shadow{transform:translateZ(0)}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-probe-body{left:0;top:0;margin:-138px 0 0 -23px;transform:translateZ(52px);transform-style:preserve-3d}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-probe-orient{transform-style:preserve-3d;transform:rotateZ(35deg) rotateX(-60deg)}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-probe-body.probe-plunging{transform:translateZ(4px)}\n'
    + '#sm-pviz-scene.sm-pviz-tilt #sm-pviz-probe-body.probe-contact{transform:translateZ(4px);animation:smPvizBodyGlow .55s ease-in-out 3}\n'
    // info grid
    + '#pviz-info{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:11px;margin-top:6px;padding:0 2px}\n'
    + '#pviz-info .lbl{color:var(--muted)}\n'
    + '#pviz-info .val{color:var(--text);font-weight:600}\n'
    + '#pviz-info .val.green{color:var(--good)}\n'
    + '#pviz-info .val.amber{color:var(--warn)}\n'
    + '.hint{font-size:10px;color:var(--muted);margin-top:6px;text-align:center}\n'
    + '</style>\n'
    + '</head>\n'
    + '<body>\n'
    + '<div class="app">\n'
    + '<div class="header">'
    +   '<div>'
    +     '<div class="title">3D Live Edge Mesh \u2014 Probe Replay</div>'
    +     '<div class="subtitle">' + SM_VERSION + ' \u00b7 Recorded probe sequence playback \u00b7 Drag to rotate</div>'
    +   '</div>'
    + '</div>\n'
    + '<div class="panel">\n'
    +   '<div class="box-title">Playback Controls</div>\n'
    +   '<div id="replay-controls">\n'
    +     '<button class="btn" id="btn-play-pause">\u25b6\ufe0f Play</button>\n'
    +     '<button class="btn ghost" id="btn-skip-end">\u23ed\ufe0f Skip to End</button>\n'
    +     '<button class="btn ghost" id="btn-replay">\ud83d\udd04 Replay</button>\n'
    +     '<select id="replay-speed"><option value="1">1\u00d7</option><option value="2" selected>2\u00d7</option><option value="5">5\u00d7</option><option value="10">10\u00d7</option></select>\n'
    +     '<div id="replay-timeline" class="progress-track"><div id="replay-progress-fill" class="progress-fill"></div></div>\n'
    +     '<span id="replay-pct">0%</span>\n'
    +   '</div>\n'
    +   '<div style="text-align:center;margin-bottom:6px;font-size:11px;color:var(--muted)">View: <button id="btn-view-top" class="btn ghost" style="font-size:10px;padding:2px 8px;height:auto;border-color:var(--accent)" aria-pressed="true" onclick="setViewMode(\'top\')">&#8999; Top-Down</button> <button id="btn-view-tilt" class="btn ghost" style="font-size:10px;padding:2px 8px;height:auto" aria-pressed="false" onclick="setViewMode(\'tilt\')">&#9700; 3D Tilt</button></div>\n'
    +   '<div id="sm-pviz-scene">\n'
    +     '<button id="sm-pviz-reset-btn" title="Reset view \u00b7 double-click also works">\u21bb Reset View</button>\n'
    +     '<div id="sm-pviz-3dscene">\n'
    +       '<div id="sm-pviz-mesh-layer">\n'
    +         '<svg id="sm-pviz-mesh" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"></svg>\n'
    +       '</div>\n'
    +       '<div id="sm-pviz-surface">\n'
    +       '</div>\n'
    +       '<div id="sm-pviz-probe-wrap">\n'
    +         '<div id="sm-pviz-probe-shadow"></div>\n'
    +         '<div id="sm-pviz-probe-body"><div id="sm-pviz-probe-orient">' + probeImg + '</div></div>\n'
    +       '</div>\n'
    +     '</div>\n'
    +   '</div>\n'
    +   '<div id="pviz-info">\n'
    +     '<div class="lbl">Status: <span id="sm-pviz-status" class="val">\u2014</span></div>\n'
    +     '<div class="lbl">Point: <span id="sm-pviz-point" class="val amber">\u2014 / \u2014</span></div>\n'
    +     '<div class="lbl">Position: <span id="sm-pviz-pos" class="val">\u2014</span></div>\n'
    +     '<div class="lbl">Contact Z: <span id="sm-pviz-z" class="val green">\u2014</span></div>\n'
    +   '</div>\n'
    +   '<div style="margin-top:6px;padding:0 2px">'
    +     '<div class="progress-track"><div id="sm-pviz-bar" class="progress-fill"></div></div>'
    +     '<div style="text-align:right;font-size:10px;color:var(--muted);margin-top:2px"><span id="sm-pviz-pct">0%</span></div>'
    +   '</div>\n'
    +   '<div style="text-align:center;margin-top:6px;font-size:11px;color:var(--muted)">Z Exaggeration: <input type="range" id="replay-z-exag" aria-label="Z Exaggeration" min="1" max="20" value="5" style="vertical-align:middle;width:90px" oninput="document.getElementById(\'replay-z-exag-val\').textContent=this.value+\'\u00d7\';renderMesh()"> <span id="replay-z-exag-val">5\u00d7</span></div>\n'
    +   '<div class="hint">Top-Down by default \u00b7 Use View toggle above to switch to 3D Tilt \u00b7 In tilt: drag to rotate, double-click to reset</div>\n'
    + '</div>\n'
    + '</div>\n'
    + '<script>\n'
    + '// ── Embedded probe sequence data ─────────────────────────────────────────\n'
    + 'var probeSequence = ' + seqJson + ';\n'
    + 'var gridConfig    = ' + cfgJson + ';\n'
    + 'var meshData      = ' + meshJson + ';\n'
    + '\n'
    + '// ── View mode: "top" (default) or "tilt" ─────────────────────────────────\n'
    + 'var _viewMode = "top";\n'
    + '\n'
    + '// ── Rotation state (used only in tilt mode) ────────────────────────────────\n'
    + 'var _rotX = 60, _rotY = 0, _rotZ = -35;\n'
    + 'var _dragActive = false, _dragLastX = 0, _dragLastY = 0;\n'
    + '\n'
    + 'function applyRotation() {\n'
    + '  if (_viewMode !== "tilt") return;\n'
    + '  var el = document.getElementById("sm-pviz-3dscene");\n'
    + '  if (el) el.style.transform = "rotateX(" + _rotX + "deg) rotateY(" + _rotY + "deg) rotateZ(" + _rotZ + "deg)";\n'
    + '}\n'
    + 'function resetView() {\n'
    + '  _rotX = 60; _rotY = 0; _rotZ = -35;\n'
    + '  if (_viewMode === "tilt") applyRotation();\n'
    + '}\n'
    + 'function setViewMode(mode) {\n'
    + '  _viewMode = (mode === "tilt") ? "tilt" : "top";\n'
    + '  var scene = document.getElementById("sm-pviz-scene");\n'
    + '  if (scene) {\n'
    + '    if (_viewMode === "tilt") scene.classList.add("sm-pviz-tilt");\n'
    + '    else scene.classList.remove("sm-pviz-tilt");\n'
    + '  }\n'
    + '  var btnTop  = document.getElementById("btn-view-top");\n'
    + '  var btnTilt = document.getElementById("btn-view-tilt");\n'
    + '  if (btnTop)  { btnTop.setAttribute("aria-pressed",  _viewMode === "top"  ? "true" : "false"); btnTop.style.borderColor  = _viewMode === "top"  ? "var(--accent)" : ""; }\n'
    + '  if (btnTilt) { btnTilt.setAttribute("aria-pressed", _viewMode === "tilt" ? "true" : "false"); btnTilt.style.borderColor = _viewMode === "tilt" ? "var(--accent)" : ""; }\n'
    + '  if (_viewMode === "tilt") applyRotation();\n'
    + '  else { var sc = document.getElementById("sm-pviz-3dscene"); if (sc) sc.style.transform = ""; }\n'
    + '}\n'
    + '\n'
    + 'function initRotation() {\n'
    + '  var scene = document.getElementById("sm-pviz-scene");\n'
    + '  if (!scene || scene._rb) return;\n'
    + '  scene._rb = true;\n'
    + '  function startDrag(cx, cy) { _dragActive = true; _dragLastX = cx; _dragLastY = cy; scene.classList.add("pviz-dragging"); }\n'
    + '  function moveDrag(cx, cy) {\n'
    + '    if (!_dragActive) return;\n'
    + '    var dx = cx - _dragLastX, dy = cy - _dragLastY;\n'
    + '    _dragLastX = cx; _dragLastY = cy;\n'
    + '    _rotY += dx * 0.4;\n'
    + '    _rotX = Math.max(10, Math.min(80, _rotX - dy * 0.4));\n'
    + '    applyRotation();\n'
    + '  }\n'
    + '  function endDrag() { _dragActive = false; scene.classList.remove("pviz-dragging"); }\n'
    + '  scene.addEventListener("mousedown", function(e) { startDrag(e.clientX, e.clientY); e.preventDefault(); });\n'
    + '  document.addEventListener("mousemove", function(e) { moveDrag(e.clientX, e.clientY); });\n'
    + '  document.addEventListener("mouseup", endDrag);\n'
    + '  scene.addEventListener("touchstart", function(e) { if (e.touches.length===1) startDrag(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});\n'
    + '  scene.addEventListener("touchmove", function(e) { if (e.touches.length===1) { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); } }, {passive:false});\n'
    + '  scene.addEventListener("touchend", endDrag);\n'
    + '  scene.addEventListener("dblclick", resetView);\n'
    + '  var rb = document.getElementById("sm-pviz-reset-btn");\n'
    + '  if (rb) rb.addEventListener("click", function(e) { e.stopPropagation(); resetView(); });\n'
    + '}\n'
    + '\n'
    + '// ── Coordinate mapping ────────────────────────────────────────────────────\n'
    + 'function pvizXYtoPos(x, y) {\n'
    + '  var cfg = gridConfig;\n'
    + '  if (!cfg) return { left: 50, top: 50 };\n'
    + '  var spanX = (cfg.maxX - cfg.minX) || 1;\n'
    + '  var spanY = (cfg.maxY - cfg.minY) || 1;\n'
    + '  var left = Math.max(0, Math.min(100, (x - cfg.minX) / spanX * 100));\n'
    + '  var top  = Math.max(0, Math.min(100, 100 - (y - cfg.minY) / spanY * 100));\n'
    + '  return { left: left, top: top };\n'
    + '}\n'
    + '\n'
    + '// ── Color helpers ─────────────────────────────────────────────────────────\n'
    + '// Compute Z range from probe sequence contacts for relative depth coloring\n'
    + 'var _depthZMin = null, _depthZMax = null;\n'
    + '(function() {\n'
    + '  if (probeSequence && probeSequence.length > 0) {\n'
    + '    probeSequence.forEach(function(ev) {\n'
    + '      if (ev.type === "contact" && ev.z !== undefined) {\n'
    + '        if (_depthZMin === null || ev.z < _depthZMin) _depthZMin = ev.z;\n'
    + '        if (_depthZMax === null || ev.z > _depthZMax) _depthZMax = ev.z;\n'
    + '      }\n'
    + '    });\n'
    + '  }\n'
    + '  if (_depthZMin === null) _depthZMin = 0;\n'
    + '  if (_depthZMax === null) _depthZMax = 10;\n'
    + '  // Ensure minimum range of 1mm to avoid division by zero\n'
    + '  if (_depthZMax - _depthZMin < 1) { _depthZMin = _depthZMax - 1; }\n'
    + '})();\n'
    + 'function depthColor(z) {\n'
    + '  // depth 0 = highest Z (green #5fd38d), depth 1 = lowest Z (orange #ff5a32)\n'
    + '  var depth = Math.max(0, Math.min(1, (_depthZMax - z) / (_depthZMax - _depthZMin)));\n'
    + '  var r = Math.round((1 - depth) * 95 + depth * 255);\n'
    + '  var g = Math.round((1 - depth) * 211 + depth * 90);\n'
    + '  var b = Math.round((1 - depth) * 141 + depth * 50);\n'
    + '  return "rgb(" + r + "," + g + "," + b + ")";\n'
    + '}\n'
    + 'function rangeColor(z, zMin, zSpan) {\n'
    + '  var t = (z - zMin) / zSpan;\n'
    + '  var rv, gv, bv, q;\n'
    + '  if (t < 0.5) { q = t * 2; rv = Math.round(200 - q*50); gv = Math.round(30 + q*40); bv = Math.round(50 + q*160); }\n'
    + '  else { q = (t - 0.5) * 2; rv = Math.round(150 - q*120); gv = Math.round(70 + q*160); bv = Math.round(210 - q*160); }\n'
    + '  return "rgba(" + rv + "," + gv + "," + bv + ",0.68)";\n'
    + '}\n'
    + '\n'
    + '// ── Face normal helper ────────────────────────────────────────────────────\n'
    + 'function pvizFaceNormal(x0,y0,z0,x1,y1,z1,x2,y2,z2) {\n'
    + '  var e1x=x1-x0,e1y=y1-y0,e1z=z1-z0,e2x=x2-x0,e2y=y2-y0,e2z=z2-z0;\n'
    + '  var nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;\n'
    + '  var len=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;\n'
    + '  return nz/len;\n'
    + '}\n'
    + '\n'
    + '// ── Mesh renderer ─────────────────────────────────────────────────────────\n'
    + 'function renderMesh() {\n'
    + '  var grid = meshData, cfg = gridConfig;\n'
    + '  if (!grid || !cfg || cfg.rowCount < 2 || cfg.colCount < 2) return;\n'
    + '  var meshEl = document.getElementById("sm-pviz-mesh");\n'
    + '  if (!meshEl) return;\n'
    + '  while (meshEl.firstChild) meshEl.removeChild(meshEl.firstChild);\n'
    + '  var zMin = Infinity, zMax = -Infinity;\n'
    + '  for (var r = 0; r < cfg.rowCount; r++) for (var c = 0; c < cfg.colCount; c++) {\n'
    + '    var zv = grid[r] && grid[r][c];\n'
    + '    if (zv !== null && zv !== undefined && isFinite(zv)) { if (zv < zMin) zMin = zv; if (zv > zMax) zMax = zv; }\n'
    + '  }\n'
    + '  if (!isFinite(zMin)) return;\n'
    + '  var zSpan = (zMax - zMin) || 1;\n'
    + '  var zExagEl = document.getElementById("replay-z-exag");\n'
    + '  var zExag = Number(zExagEl && zExagEl.value) || 5;\n'
    + '  var zMid = (zMin + zMax) / 2;\n'
    + '  var spanY = (cfg.maxY - cfg.minY) || 1;\n'
    + '  var zSvgScale = zExag * 100 / spanY;\n'
    + '  var ns = "http://www.w3.org/2000/svg";\n'
    + '  var frag = document.createDocumentFragment();\n'
    + '  for (var row = 0; row < cfg.rowCount - 1; row++) {\n'
    + '    for (var col = 0; col < cfg.colCount - 1; col++) {\n'
    + '      var z00 = grid[row][col], z01 = grid[row][col+1], z10 = grid[row+1][col], z11 = grid[row+1][col+1];\n'
    + '      if (z00===null||z01===null||z10===null||z11===null) continue;\n'
    + '      if (!isFinite(z00)||!isFinite(z01)||!isFinite(z10)||!isFinite(z11)) continue;\n'
    + '      var x00=cfg.minX+col*cfg.colSpacing, y00=cfg.minY+row*cfg.rowSpacing;\n'
    + '      var x01=cfg.minX+(col+1)*cfg.colSpacing, y01=y00;\n'
    + '      var x10=x00, y10=cfg.minY+(row+1)*cfg.rowSpacing;\n'
    + '      var x11=x01, y11=y10;\n'
    + '      var p00=pvizXYtoPos(x00,y00), p01=pvizXYtoPos(x01,y01);\n'
    + '      var p10=pvizXYtoPos(x10,y10), p11=pvizXYtoPos(x11,y11);\n'
    + '      var t00=p00.top-(z00-zMid)*zSvgScale, t01=p01.top-(z01-zMid)*zSvgScale;\n'
    + '      var t10=p10.top-(z10-zMid)*zSvgScale, t11=p11.top-(z11-zMid)*zSvgScale;\n'
    + '      var ez=zExag;\n'
    + '      var b1=0.45+0.55*Math.abs(pvizFaceNormal(x00,y00,z00*ez,x01,y01,z01*ez,x10,y10,z10*ez));\n'
    + '      var b2=0.45+0.55*Math.abs(pvizFaceNormal(x01,y01,z01*ez,x11,y11,z11*ez,x10,y10,z10*ez));\n'
    + '      function litColor(z, b) {\n'
    + '        var t=(z-zMin)/zSpan, rv,gv,bv,q;\n'
    + '        if(t<0.5){q=t*2;rv=200-q*50;gv=30+q*40;bv=50+q*160;}\n'
    + '        else{q=(t-0.5)*2;rv=150-q*120;gv=70+q*160;bv=210-q*160;}\n'
    + '        return"rgba("+Math.round(rv*b)+","+Math.round(gv*b)+","+Math.round(bv*b)+",0.88)";\n'
    + '      }\n'
    + '      var poly1 = document.createElementNS(ns,"polygon");\n'
    + '      poly1.setAttribute("points", p00.left+","+t00+" "+p01.left+","+t01+" "+p10.left+","+t10);\n'
    + '      poly1.setAttribute("fill", litColor((z00+z01+z10)/3, b1));\n'
    + '      poly1.setAttribute("stroke", "rgba(80,160,220,0.45)"); poly1.setAttribute("stroke-width","0.8");\n'
    + '      frag.appendChild(poly1);\n'
    + '      var poly2 = document.createElementNS(ns,"polygon");\n'
    + '      poly2.setAttribute("points", p01.left+","+t01+" "+p11.left+","+t11+" "+p10.left+","+t10);\n'
    + '      poly2.setAttribute("fill", litColor((z01+z11+z10)/3, b2));\n'
    + '      poly2.setAttribute("stroke", "rgba(80,160,220,0.45)"); poly2.setAttribute("stroke-width","0.8");\n'
    + '      frag.appendChild(poly2);\n'
    + '    }\n'
    + '  }\n'
    + '  meshEl.appendChild(frag);\n'
    + '  setTimeout(function() { meshEl.classList.add("mesh-visible"); }, 60);\n'
    + '}\n'
    + '\n'
    + '// ── Playback engine ───────────────────────────────────────────────────────\n'
    + 'var _seqIdx = 0;\n'
    + 'var _seqTimer = null;\n'
    + 'var _isPlaying = false;\n'
    + '\n'
    + 'function getSpeed() { return Number(document.getElementById("replay-speed").value) || 2; }\n'
    + '\n'
    + 'function updatePlayBtn() {\n'
    + '  var btn = document.getElementById("btn-play-pause");\n'
    + '  if (btn) btn.textContent = _isPlaying ? "\u23f8\ufe0f Pause" : "\u25b6\ufe0f Play";\n'
    + '}\n'
    + '\n'
    + 'function updateReplayProgress(idx) {\n'
    + '  var pct = probeSequence.length ? Math.round(idx / probeSequence.length * 100) : 0;\n'
    + '  var fill = document.getElementById("replay-progress-fill");\n'
    + '  if (fill) fill.style.width = pct + "%";\n'
    + '  var pctEl = document.getElementById("replay-pct");\n'
    + '  if (pctEl) pctEl.textContent = pct + "%";\n'
    + '}\n'
    + '\n'
    + 'function processEvent(ev) {\n'
    + '  var type = ev.type;\n'
    + '  // Move probe position\n'
    + '  if (ev.x !== undefined && ev.y !== undefined) {\n'
    + '    var pos = pvizXYtoPos(ev.x, ev.y);\n'
    + '    var wrap = document.getElementById("sm-pviz-probe-wrap");\n'
    + '    if (wrap) { wrap.style.left = pos.left + "%"; wrap.style.top = pos.top + "%"; }\n'
    + '  }\n'
    + '  // Probe state animation class\n'
    + '  var body = document.getElementById("sm-pviz-probe-body");\n'
    + '  if (body) {\n'
    + '    body.classList.remove("probe-plunging", "probe-contact");\n'
    + '    void body.offsetWidth;\n'
    + '    if (type === "plunging") body.classList.add("probe-plunging");\n'
    + '    else if (type === "contact") body.classList.add("probe-contact");\n'
    + '  }\n'
    + '  // Status label\n'
    + '  var labels = { traveling:"Traveling...", plunging:"Probing...", contact:"\u2713 Contact!", complete:"\u2713 Complete \u2014 Surface mapped", error:"Error" };\n'
    + '  var label = ev.action || labels[type] || type;\n'
    + '  var statusEl = document.getElementById("sm-pviz-status");\n'
    + '  if (statusEl) {\n'
    + '    statusEl.textContent = label;\n'
    + '    statusEl.className = "val" + ((type==="contact"||type==="complete")?" green":type==="error"?" bad":"");\n'
    + '  }\n'
    + '  // Point counter\n'
    + '  var ptEl = document.getElementById("sm-pviz-point");\n'
    + '  if (ptEl && ev.point !== undefined) ptEl.textContent = ev.point + " / " + (ev.total || "?");\n'
    + '  // Position\n'
    + '  var posEl = document.getElementById("sm-pviz-pos");\n'
    + '  if (posEl && ev.x !== undefined) posEl.textContent = "X" + Number(ev.x).toFixed(3) + " Y" + Number(ev.y).toFixed(3);\n'
    + '  // Contact Z\n'
    + '  var zEl = document.getElementById("sm-pviz-z");\n'
    + '  if (zEl && ev.z !== undefined) zEl.textContent = Number(ev.z).toFixed(3);\n'
    + '  // Progress bar\n'
    + '  var pct = ev.pct !== undefined ? Math.max(0, Math.min(100, ev.pct)) : undefined;\n'
    + '  var barEl = document.getElementById("sm-pviz-bar");\n'
    + '  if (barEl && pct !== undefined) barEl.style.width = pct + "%";\n'
    + '  var pctEl2 = document.getElementById("sm-pviz-pct");\n'
    + '  if (pctEl2 && pct !== undefined) pctEl2.textContent = Math.round(pct) + "%";\n'
    + '  // Add contact dot\n'
    + '  if (type === "contact" && ev.x !== undefined && ev.z !== undefined) {\n'
    + '    var surf = document.getElementById("sm-pviz-surface");\n'
    + '    if (surf) {\n'
    + '      var dpos = pvizXYtoPos(ev.x, ev.y);\n'
    + '      var dot = document.createElement("div");\n'
    + '      dot.className = "sm-pviz-dot";\n'
    + '      dot.style.left = dpos.left + "%";\n'
    + '      dot.style.top  = dpos.top + "%";\n'
    + '      var col = depthColor(ev.z);\n'
    + '      dot.style.background = col;\n'
    + '      dot.style.boxShadow = "0 0 5px " + col;\n'
    + '      surf.appendChild(dot);\n'
    + '    }\n'
    + '  }\n'
    + '  // On complete: render mesh\n'
    + '  if (type === "complete") {\n'
    + '    setTimeout(function() { renderMesh(); }, 700);\n'
    + '  }\n'
    + '}\n'
    + '\n'
    + 'function playFromIndex(idx) {\n'
    + '  if (!_isPlaying) return;\n'
    + '  if (idx >= probeSequence.length) {\n'
    + '    _isPlaying = false;\n'
    + '    updatePlayBtn();\n'
    + '    updateReplayProgress(probeSequence.length);\n'
    + '    return;\n'
    + '  }\n'
    + '  _seqIdx = idx;\n'
    + '  updateReplayProgress(idx);\n'
    + '  var ev = probeSequence[idx];\n'
    + '  // Clamp raw delay to at most 3000 ms at 1x, then scale by speed\n'
    + '  var rawDelay = Math.min(ev.delay || 0, 3000);\n'
    + '  var delay = Math.max(40, rawDelay / getSpeed());\n'
    + '  _seqTimer = setTimeout(function() {\n'
    + '    processEvent(ev);\n'
    + '    playFromIndex(idx + 1);\n'
    + '  }, delay);\n'
    + '}\n'
    + '\n'
    + 'function startPlay() {\n'
    + '  if (_seqIdx >= probeSequence.length) { resetToStart(); }\n'
    + '  _isPlaying = true;\n'
    + '  updatePlayBtn();\n'
    + '  playFromIndex(_seqIdx);\n'
    + '}\n'
    + '\n'
    + 'function pausePlay() {\n'
    + '  _isPlaying = false;\n'
    + '  if (_seqTimer) { clearTimeout(_seqTimer); _seqTimer = null; }\n'
    + '  updatePlayBtn();\n'
    + '}\n'
    + '\n'
    + 'function togglePlay() {\n'
    + '  if (_isPlaying) pausePlay(); else startPlay();\n'
    + '}\n'
    + '\n'
    + 'function skipToEnd() {\n'
    + '  pausePlay();\n'
    + '  // Process all remaining events instantly\n'
    + '  for (var i = _seqIdx; i < probeSequence.length; i++) {\n'
    + '    processEvent(probeSequence[i]);\n'
    + '  }\n'
    + '  _seqIdx = probeSequence.length;\n'
    + '  updateReplayProgress(_seqIdx);\n'
    + '  updatePlayBtn();\n'
    + '}\n'
    + '\n'
    + 'function resetToStart() {\n'
    + '  pausePlay();\n'
    + '  _seqIdx = 0;\n'
    + '  // Clear dots\n'
    + '  var surf = document.getElementById("sm-pviz-surface");\n'
    + '  if (surf) { var dots = surf.querySelectorAll(".sm-pviz-dot"); for (var i=0;i<dots.length;i++) dots[i].remove(); }\n'
    + '  // Clear mesh\n'
    + '  var meshEl = document.getElementById("sm-pviz-mesh");\n'
    + '  if (meshEl) { while (meshEl.firstChild) meshEl.removeChild(meshEl.firstChild); meshEl.classList.remove("mesh-visible"); }\n'
    + '  // Reset probe position to start\n'
    + '  var wrap = document.getElementById("sm-pviz-probe-wrap");\n'
    + '  if (wrap) { wrap.style.left = "0%"; wrap.style.top = "100%"; }\n'
    + '  var body = document.getElementById("sm-pviz-probe-body");\n'
    + '  if (body) { body.className = ""; }\n'
    + '  // Reset info panel\n'
    + '  var statusEl = document.getElementById("sm-pviz-status"); if (statusEl) { statusEl.textContent = "\u2014"; statusEl.className = "val"; }\n'
    + '  var ptEl = document.getElementById("sm-pviz-point"); if (ptEl) ptEl.textContent = "\u2014 / \u2014";\n'
    + '  var posEl = document.getElementById("sm-pviz-pos"); if (posEl) posEl.textContent = "\u2014";\n'
    + '  var zEl = document.getElementById("sm-pviz-z"); if (zEl) zEl.textContent = "\u2014";\n'
    + '  var barEl = document.getElementById("sm-pviz-bar"); if (barEl) barEl.style.width = "0%";\n'
    + '  var pctEl = document.getElementById("sm-pviz-pct"); if (pctEl) pctEl.textContent = "0%";\n'
    + '  updateReplayProgress(0);\n'
    + '  updatePlayBtn();\n'
    + '  // Apply grid lines\n'
    + '  if (gridConfig && gridConfig.colCount > 1 && gridConfig.rowCount > 1 && surf) {\n'
    + '    var colPct = (100 / (gridConfig.colCount - 1)).toFixed(4);\n'
    + '    var rowPct = (100 / (gridConfig.rowCount - 1)).toFixed(4);\n'
    + '    surf.style.backgroundSize = colPct + "% " + rowPct + "%";\n'
    + '  }\n'
    + '}\n'
    + '\n'
    + '// ── Init ──────────────────────────────────────────────────────────────────\n'
    + 'document.addEventListener("DOMContentLoaded", function() {\n'
    + '  initRotation();\n'
    + '  resetToStart();\n'
    + '  document.getElementById("btn-play-pause").addEventListener("click", togglePlay);\n'
    + '  document.getElementById("btn-skip-end").addEventListener("click", skipToEnd);\n'
    + '  document.getElementById("btn-replay").addEventListener("click", function() { resetToStart(); startPlay(); });\n'
    + '  // Auto-play at 2x after a short delay so user sees the scene first\n'
    + '  setTimeout(function() { startPlay(); }, 800);\n'
    + '});\n'
    + '<\/script>\n'
    + '</body>\n'
    + '</html>';

  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'probe_replay_' + Date.now() + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function importSurfaceMesh() {
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
        smMeshDataRaw = data.meshData;
        smGridConfigRaw = data.gridConfig;
        var subdivided = subdivideSurfaceMesh(data.meshData, data.gridConfig, meshSubdivisionSpacing);
        smMeshData = subdivided.grid;
        smGridConfig = subdivided.config;
        updateSurfaceMeshUI();
        var importEl = document.getElementById('sm-meshStorageStatus');
        if (importEl) importEl.textContent = 'Mesh imported from file.';
      } catch(err) { alert('Failed to parse mesh file: ' + err.message); }
    };
    reader.readAsText(file);
  };
  inp.click();
}

function clearSurfaceMesh() {
  if (!confirm('Clear all surface mesh data?')) return;
  smMeshData = null;
  smGridConfig = null;
  updateSurfaceMeshUI();
  var clearEl = document.getElementById('sm-meshStorageStatus');
  if (clearEl) clearEl.textContent = 'Mesh cleared.';
}

function exportSurfaceMeshCSV() {
  if (!smMeshData || !smGridConfig) { alert('No mesh data to export. Run a surface probe or load a mesh first.'); return; }
  var cfg = smGridConfig;
  var rows = ['# Plugin Version: ' + SM_VERSION, 'Index,X,Y,Z'];
  var n = 0;
  for (var ri = 0; ri < cfg.rowCount; ri++) {
    for (var ci = 0; ci < cfg.colCount; ci++) {
      var x = cfg.minX + ci * cfg.colSpacing;
      var y = cfg.minY + ri * cfg.rowSpacing;
      var z = smMeshData[ri][ci];
      rows.push(n + ',' + x.toFixed(3) + ',' + y.toFixed(3) + ',' + (z != null ? z.toFixed(3) : ''));
      n++;
    }
  }
  var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'surface_mesh_' + Date.now() + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}


function bilinearInterpolateZ(data, cfg, queryX, queryY) {
  // Single column (Nx1): linear interpolation in Y only
  if (cfg.colCount === 1) {
    if (cfg.rowCount === 1) return data[0][0] || 0;
    var rowF = cfg.rowSpacing > 0 ? (queryY - cfg.minY) / cfg.rowSpacing : 0;
    var r0 = Math.max(0, Math.min(cfg.rowCount - 2, Math.floor(rowF)));
    var tz = Math.max(0, Math.min(1, rowF - r0));
    var za = data[r0][0] || 0;
    var zb = (data[r0 + 1] ? data[r0 + 1][0] : null) || za;
    return za * (1 - tz) + zb * tz;
  }
  // Single row (1xN): linear interpolation in X only
  if (cfg.rowCount === 1) {
    var colF = cfg.colSpacing > 0 ? (queryX - cfg.minX) / cfg.colSpacing : 0;
    var c0 = Math.max(0, Math.min(cfg.colCount - 2, Math.floor(colF)));
    var tx = Math.max(0, Math.min(1, colF - c0));
    var z0a = data[0][c0] || 0;
    var z0b = data[0][c0 + 1] || z0a;
    return z0a * (1 - tx) + z0b * tx;
  }
  // Standard bilinear interpolation for 2D grid
  var col = (queryX - cfg.minX) / cfg.colSpacing;
  var row = (queryY - cfg.minY) / cfg.rowSpacing;
  var col0 = Math.max(0, Math.min(cfg.colCount - 2, Math.floor(col)));
  var row0 = Math.max(0, Math.min(cfg.rowCount - 2, Math.floor(row)));
  var col1 = col0 + 1;
  var row1 = row0 + 1;
  var fx = Math.max(0, Math.min(1, col - col0));
  var fy = Math.max(0, Math.min(1, row - row0));
  var z00 = data[row0][col0];
  var z10 = data[row0][col1];
  var z01 = data[row1][col0];
  var z11 = data[row1][col1];
  var z0 = z00 * (1 - fx) + z10 * fx;
  var z1 = z01 * (1 - fx) + z11 * fx;
  return z0 * (1 - fy) + z1 * fy;
}

function applySurfaceCompensation() {
  if (!smOriginalGcode) { alert('No G-code loaded.'); return; }
  if (!smMeshData || !smGridConfig) { alert('No mesh data. Run probing or load a mesh first.'); return; }
  var refZEl = document.getElementById('sm-compRefZ');
  var refZ = refZEl ? Number(refZEl.value) : 0;
  smLogApply('Applying compensation with Reference Z=' + refZ + '...');
  try {
    var result = smApplyCompensationCore(smOriginalGcode, smMeshData, smGridConfig, refZ);
    smCompensatedGcode = result.gcode;
    var statusEl = document.getElementById('sm-applyStatus');
    if (statusEl) statusEl.textContent = 'Done. ' + result.modified + ' Z values modified.';
    smLogApply('Compensation applied. ' + result.modified + ' lines modified.');
    var preview = smCompensatedGcode.split('\n').slice(0, 30).join('\n');
    var previewEl = document.getElementById('sm-apply-preview');
    if (previewEl) previewEl.textContent = preview;
    var ncBtn2d = document.getElementById('sm-btn-send-ncsender');
    if(ncBtn2d) ncBtn2d.disabled = false;
  } catch(e) {
    var errEl = document.getElementById('sm-applyStatus');
    if (errEl) errEl.textContent = 'Error: ' + e.message;
    smLogApply('ERROR: ' + e.message);
  }
}

function smApplyCompensationCore(gcodeText, data, cfg, referenceZ) {
  var lines = gcodeText.split('\n');
  var output = [];
  var currentX = 0, currentY = 0;
  var linesModified = 0;
  var zLinesFound = 0;
  var zLinesOutOfBounds = 0;
  var firstModification = null;
  var sampleModifications = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.startsWith(';') || line.startsWith('(')) { output.push(lines[i]); continue; }
    var isMove = /^(?:N\d+\s+)?G[01]\b/i.test(line) || /\b[XYZ][-\d.]/i.test(line);
    if (!isMove) { output.push(lines[i]); continue; }
    var xMatch = line.match(/X(-?[\d.]+)/i);
    var yMatch = line.match(/Y(-?[\d.]+)/i);
    var zMatch = line.match(/Z(-?[\d.]+)/i);
    if (xMatch) currentX = parseFloat(xMatch[1]);
    if (yMatch) currentY = parseFloat(yMatch[1]);

    if (zMatch) {
      zLinesFound++;
      var originalZ = parseFloat(zMatch[1]);

      // Check if within bounds
      if (currentX >= cfg.minX && currentX <= cfg.maxX &&
          currentY >= cfg.minY && currentY <= cfg.maxY) {
        var meshZ = bilinearInterpolateZ(data, cfg, currentX, currentY);
        var offset = meshZ - referenceZ;
        var newZ = originalZ + offset;
        line = line.replace(/Z(-?[\d.]+)/i, 'Z' + newZ.toFixed(3));
        linesModified++;

        // Store first modification for logging
        if (!firstModification) {
          firstModification = {
            lineNum: i + 1,
            x: currentX.toFixed(3),
            y: currentY.toFixed(3),
            origZ: originalZ.toFixed(3),
            meshZ: meshZ.toFixed(3),
            offset: offset.toFixed(3),
            newZ: newZ.toFixed(3)
          };
        }

        // Store a few sample modifications for logging
        if (linesModified <= 3) {
          sampleModifications.push({
            lineNum: i + 1,
            x: currentX.toFixed(3),
            y: currentY.toFixed(3),
            origZ: originalZ.toFixed(3),
            meshZ: meshZ.toFixed(3),
            offset: offset.toFixed(3),
            newZ: newZ.toFixed(3)
          });
        }
      } else {
        zLinesOutOfBounds++;
      }
    }
    output.push(line);
  }

  return {
    gcode: output.join('\n'),
    modified: linesModified,
    zLinesFound: zLinesFound,
    zLinesOutOfBounds: zLinesOutOfBounds,
    firstModification: firstModification,
    sampleModifications: sampleModifications
  };
}

function smDownloadCompensatedGcode() {
  if (!smCompensatedGcode) { alert('No compensated G-code. Apply compensation first.'); return; }
  var blob = new Blob([smCompensatedGcode], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'compensated_surface_' + Date.now() + '.nc';
  a.click();
}

async function sendCompToNcSender(gcodeText, label) {
  if (!gcodeText) { alert('No compensated G-code available. Apply compensation first.'); return; }
  var filename = (label || 'compensated') + '_' + Date.now() + '.nc';
  var loaded = false;

  // Try loading temp content directly — ncSender /api/gcode-files/load-temp
  // This loads G-code from string content into the workspace without saving a file
  try {
    var r = await fetch('/api/gcode-files/load-temp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: gcodeText, filename: filename })
    });
    if (r.ok) {
      var js = await r.json().catch(function() { return {}; });
      if (!js.error && js.success !== false) { loaded = true; }
    }
  } catch(e) { /* fall through to file upload attempt */ }

  // Fallback: upload as a file — ncSender /api/gcode-files (uploads and immediately loads)
  if (!loaded) {
    try {
      var blob = new Blob([gcodeText], { type: 'text/plain' });
      var formData = new FormData();
      formData.append('file', blob, filename);
      var r2 = await fetch('/api/gcode-files', { method: 'POST', body: formData });
      if (r2.ok) {
        var js2 = await r2.json().catch(function() { return {}; });
        if (!js2.error && js2.success !== false) { loaded = true; }
      }
    } catch(e2) { /* fall through */ }
  }

  if (loaded) {
    alert((label || 'Compensated G-code') + ' loaded into ncSender successfully.\n\nThe file "' + filename + '" is now active and ready to run.');
  } else {
    // Neither API endpoint worked — download the file and instruct the user
    try {
      var dlBlob = new Blob([gcodeText], { type: 'text/plain' });
      var dlUrl = URL.createObjectURL(dlBlob);
      var a = document.createElement('a');
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
    } catch(dlErr) { /* ignore download errors */ }
    alert('Could not load directly into ncSender.\n\n' +
      'The file "' + filename + '" has been downloaded.\n\n' +
      'To load it in ncSender:\n' +
      '1. Open the G-code file list in ncSender\n' +
      '2. Upload or select "' + filename + '"\n' +
      '3. Press Run to execute');
  }
}

// ── Apply Tab — G-code loading, compensation, download ────────────────────────

var applyOriginalGcode = null;       // loaded G-code text for Apply tab
var applySurfaceCompGcode = null;    // compensated surface G-code
var applyFaceCompGcode = null;       // compensated face G-code
var PLUGIN_ID = 'com.ncsender.edgeprobe.combined';

async function applyLoadGcodeFromNcSender() {
  var statusEl = document.getElementById('apply-gcode-status');
  try {
    // Try /api/gcode-files/current to get loaded G-code content
    var r = await fetch('/api/gcode-files/current');
    if (r.ok) {
      var data = await r.json();
      if (data && data.content) {
        applyOriginalGcode = data.content;
        var lines = applyOriginalGcode.split('\n').length;
        if (statusEl) statusEl.textContent = 'Loaded from ncSender: ' + lines + ' lines' + (data.filename ? ' (' + data.filename + ')' : '');
        statusEl.className = 'status-line good';
        applyUpdateButtons();
        return;
      }
    }
    // Fallback: try fetching from cache file path
    var r2 = await fetch('/api/server-state');
    if (r2.ok) {
      var state = await r2.json();
      var filename = state?.jobLoaded?.filename;
      if (filename) {
        // Try to get the file content via gcode-files endpoint
        var r3 = await fetch('/api/gcode-files/' + encodeURIComponent(filename) + '/content');
        if (r3.ok) {
          applyOriginalGcode = await r3.text();
          var lines = applyOriginalGcode.split('\n').length;
          if (statusEl) statusEl.textContent = 'Loaded: ' + filename + ' (' + lines + ' lines)';
          statusEl.className = 'status-line good';
          applyUpdateButtons();
          return;
        }
      }
    }
    if (statusEl) { statusEl.textContent = 'No G-code loaded in ncSender. Load a file first.'; statusEl.className = 'status-line warn'; }
  } catch(e) {
    if (statusEl) { statusEl.textContent = 'Error loading from ncSender: ' + e.message; statusEl.className = 'status-line bad'; }
  }
}

async function applyAnalyzeGcodeBounds() {
  if (!applyOriginalGcode) { alert('Load G-code first.'); return; }
  var boundsEl = document.getElementById('apply-gcode-bounds-info');
  // Client-side bounds analysis (same algorithm as server)
  var bounds = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
  var currentX = 0, currentY = 0, currentZ = 0;
  var isAbsolute = true;
  var lines = applyOriginalGcode.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim().toUpperCase();
    if (trimmed.startsWith('(') || trimmed.startsWith(';') || trimmed.startsWith('%')) continue;
    if (trimmed.indexOf('G90') >= 0 && trimmed.indexOf('G90.1') < 0) isAbsolute = true;
    if (trimmed.indexOf('G91') >= 0 && trimmed.indexOf('G91.1') < 0) isAbsolute = false;
    if (trimmed.indexOf('G53') >= 0) continue;
    var xM = trimmed.match(/X([+-]?\d*\.?\d+)/);
    var yM = trimmed.match(/Y([+-]?\d*\.?\d+)/);
    var zM = trimmed.match(/Z([+-]?\d*\.?\d+)/);
    if (xM) { var v = parseFloat(xM[1]); currentX = isAbsolute ? v : currentX + v; }
    if (yM) { var v2 = parseFloat(yM[1]); currentY = isAbsolute ? v2 : currentY + v2; }
    if (zM) { var v3 = parseFloat(zM[1]); currentZ = isAbsolute ? v3 : currentZ + v3; }
    if (xM || yM || zM) {
      bounds.min.x = Math.min(bounds.min.x, currentX);
      bounds.min.y = Math.min(bounds.min.y, currentY);
      bounds.min.z = Math.min(bounds.min.z, currentZ);
      bounds.max.x = Math.max(bounds.max.x, currentX);
      bounds.max.y = Math.max(bounds.max.y, currentY);
      bounds.max.z = Math.max(bounds.max.z, currentZ);
    }
  }
  if (bounds.min.x === Infinity) bounds.min.x = 0;
  if (bounds.min.y === Infinity) bounds.min.y = 0;
  if (bounds.min.z === Infinity) bounds.min.z = 0;
  if (bounds.max.x === -Infinity) bounds.max.x = 0;
  if (bounds.max.y === -Infinity) bounds.max.y = 0;
  if (bounds.max.z === -Infinity) bounds.max.z = 0;

  if (boundsEl) {
    boundsEl.style.display = 'block';
    boundsEl.innerHTML = '<strong>G-code Bounds:</strong> ' +
      'X: ' + bounds.min.x.toFixed(2) + ' to ' + bounds.max.x.toFixed(2) +
      ' &nbsp;|&nbsp; Y: ' + bounds.min.y.toFixed(2) + ' to ' + bounds.max.y.toFixed(2) +
      ' &nbsp;|&nbsp; Z: ' + bounds.min.z.toFixed(2) + ' to ' + bounds.max.z.toFixed(2) +
      ' &nbsp;|&nbsp; Size: ' + (bounds.max.x - bounds.min.x).toFixed(2) + ' &times; ' + (bounds.max.y - bounds.min.y).toFixed(2) + ' coords';
  }
}

// Apply surface compensation — uses move subdivision for smooth surface following
function applyServerSurfaceCompensation() {
  if (!applyOriginalGcode) { alert('Load G-code first.'); return; }
  if (!smMeshData || !smGridConfig) { alert('No surface mesh data. Run probing or load a mesh first.'); return; }

  var refZ = Number(document.getElementById('apply-refZ').value) || 0;
  var subdivide = document.getElementById('apply-subdivide').checked;
  var statusEl = document.getElementById('apply-surface-status');
  var surfLogEl = document.getElementById('apply-surface-log');
  if (surfLogEl) surfLogEl.innerHTML = '';

  applyLogSurface('Applying surface Z compensation (Reference Z=' + refZ + ', Subdivide=' + subdivide + ')...');

  if (subdivide) {
    // Use subdivision compensation — same algorithm as server-side applyZCompensation
    try {
      var result = applySubdividedCompensation(applyOriginalGcode, smMeshData, smGridConfig, refZ);
      applySurfaceCompGcode = result.gcode;
      applyLogSurface('Done! ' + result.modified + ' moves processed, ' + result.segments + ' segments generated.');
      if (statusEl) { statusEl.textContent = 'Compensation applied: ' + result.modified + ' moves, ' + result.segments + ' segments (subdivided).'; statusEl.className = 'status-line good'; }
      applyUpdatePreview(applySurfaceCompGcode);
      applyUpdateButtons();
    } catch(e) {
      applyLogSurface('ERROR: ' + e.message);
      if (statusEl) { statusEl.textContent = 'Error: ' + e.message; statusEl.className = 'status-line bad'; }
    }
  } else {
    // Use simple compensation (existing smApplyCompensationCore)
    try {
      var result = smApplyCompensationCore(applyOriginalGcode, smMeshData, smGridConfig, refZ);
      applySurfaceCompGcode = result.gcode;
      applyLogSurface('Done! ' + result.modified + ' Z values modified.');
      if (statusEl) { statusEl.textContent = 'Compensation applied: ' + result.modified + ' Z values modified.'; statusEl.className = 'status-line good'; }
      applyUpdatePreview(applySurfaceCompGcode);
      applyUpdateButtons();
    } catch(e) {
      applyLogSurface('ERROR: ' + e.message);
      if (statusEl) { statusEl.textContent = 'Error: ' + e.message; statusEl.className = 'status-line bad'; }
    }
  }
}

// Client-side subdivided Z compensation (mirrors server-side applyZCompensation)
function applySubdividedCompensation(gcodeText, meshData, gridCfg, referenceZ) {
  var lines = gcodeText.split('\n');
  var output = [];
  var currentX = 0, currentY = 0, currentZ = 0;
  var isAbsolute = true;
  var currentFeedRate = null;
  var currentGMode = 'G1';
  var movesProcessed = 0;
  var totalSegments = 0;

  // When grid has only 1 column or 1 row, spacing is zero (all points at same position)
  var spacingX = gridCfg.colSpacing || (gridCfg.colCount > 1 ? (gridCfg.maxX - gridCfg.minX) / (gridCfg.colCount - 1) : 0);
  var spacingY = gridCfg.rowSpacing || (gridCfg.rowCount > 1 ? (gridCfg.maxY - gridCfg.minY) / (gridCfg.rowCount - 1) : 0);
  var segmentLength = Math.min(spacingX || 10, spacingY || 10, 2);

  output.push('(Z-Compensated G-code - 3D Live Edge Mesh Combined Plugin)');
  output.push('(Grid: ' + gridCfg.colCount + ' x ' + gridCfg.rowCount + ' points)');
  output.push('(Reference Z: ' + referenceZ.toFixed(3) + ')');
  output.push('(Segment length: ' + segmentLength.toFixed(2) + ' coords)');
  output.push('');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim().toUpperCase();

    if (!trimmed || trimmed.startsWith('(') || trimmed.startsWith(';') || trimmed.startsWith('%')) {
      output.push(line);
      continue;
    }

    if (trimmed.indexOf('G90') >= 0 && trimmed.indexOf('G90.1') < 0) isAbsolute = true;
    if (trimmed.indexOf('G91') >= 0 && trimmed.indexOf('G91.1') < 0) isAbsolute = false;

    if (trimmed.indexOf('G53') >= 0) { output.push(line); continue; }

    if (/^G0\b/.test(trimmed) || trimmed.indexOf(' G0 ') >= 0 || / G0$/.test(trimmed)) currentGMode = 'G0';
    if (/^G1\b/.test(trimmed) || trimmed.indexOf(' G1 ') >= 0 || / G1$/.test(trimmed)) currentGMode = 'G1';
    if (/^G2\b/.test(trimmed) || trimmed.indexOf(' G2 ') >= 0) currentGMode = 'G2';
    if (/^G3\b/.test(trimmed) || trimmed.indexOf(' G3 ') >= 0) currentGMode = 'G3';

    var xMatch = line.match(/X([+-]?\d*\.?\d+)/i);
    var yMatch = line.match(/Y([+-]?\d*\.?\d+)/i);
    var zMatch = line.match(/Z([+-]?\d*\.?\d+)/i);
    var fMatch = line.match(/F([+-]?\d*\.?\d+)/i);

    if (fMatch) currentFeedRate = parseFloat(fMatch[1]);

    var targetX = currentX, targetY = currentY, targetZ = currentZ;
    if (xMatch) targetX = isAbsolute ? parseFloat(xMatch[1]) : currentX + parseFloat(xMatch[1]);
    if (yMatch) targetY = isAbsolute ? parseFloat(yMatch[1]) : currentY + parseFloat(yMatch[1]);
    if (zMatch) targetZ = isAbsolute ? parseFloat(zMatch[1]) : currentZ + parseFloat(zMatch[1]);

    var isLinearMove = (currentGMode === 'G1');
    var isRapidMove = (currentGMode === 'G0');
    var hasXY = !!(xMatch || yMatch);
    var hasZ = zMatch !== null;

    if (isLinearMove && hasXY && isAbsolute) {
      var dx = targetX - currentX;
      var dy = targetY - currentY;
      var distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > segmentLength) {
        var segments = Math.ceil(distance / segmentLength);
        var dz = targetZ - currentZ;

        for (var s = 1; s <= segments; s++) {
          var t = s / segments;
          var segX = currentX + dx * t;
          var segY = currentY + dy * t;
          var segZ = currentZ + dz * t;

          var meshZ = bilinearInterpolateZ(meshData, gridCfg, segX, segY);
          var zOffset = meshZ - referenceZ;
          var compensatedZ = segZ + zOffset;

          var segCmd = 'G1 X' + segX.toFixed(3) + ' Y' + segY.toFixed(3) + ' Z' + compensatedZ.toFixed(3);
          if (s === 1 && currentFeedRate) segCmd += ' F' + currentFeedRate.toFixed(0);
          output.push(segCmd);
          totalSegments++;
        }
        movesProcessed++;
      } else {
        var meshZ2 = bilinearInterpolateZ(meshData, gridCfg, targetX, targetY);
        var zOffset2 = meshZ2 - referenceZ;
        var compensatedZ2 = targetZ + zOffset2;

        if (hasZ) {
          output.push(line.replace(/Z([+-]?\d*\.?\d+)/i, 'Z' + compensatedZ2.toFixed(3)));
        } else {
          var newLine = line.trim();
          if (currentFeedRate && /F[\d.]+/i.test(newLine)) {
            newLine = newLine.replace(/(F[\d.]+)/i, 'Z' + compensatedZ2.toFixed(3) + ' $1');
          } else {
            newLine += ' Z' + compensatedZ2.toFixed(3);
          }
          output.push(newLine);
        }
        movesProcessed++;
        totalSegments++;
      }
    } else if (isRapidMove && hasXY && isAbsolute) {
      var meshZ3 = bilinearInterpolateZ(meshData, gridCfg, targetX, targetY);
      var zOffset3 = meshZ3 - referenceZ;
      var compensatedZ3 = targetZ + zOffset3;

      if (hasZ) {
        output.push(line.replace(/Z([+-]?\d*\.?\d+)/i, 'Z' + compensatedZ3.toFixed(3)));
      } else {
        // Only add Z to rapid moves at working height (below safe retract threshold of 10 coords)
        if (currentZ < 10) {
          output.push(line.trim() + ' Z' + compensatedZ3.toFixed(3));
        } else {
          output.push(line);
        }
      }
      movesProcessed++;
    } else if (hasZ && isAbsolute) {
      var meshZ4 = bilinearInterpolateZ(meshData, gridCfg, targetX, targetY);
      var zOffset4 = meshZ4 - referenceZ;
      var compensatedZ4 = targetZ + zOffset4;
      output.push(line.replace(/Z([+-]?\d*\.?\d+)/i, 'Z' + compensatedZ4.toFixed(3)));
      movesProcessed++;
    } else {
      output.push(line);
    }

    currentX = targetX;
    currentY = targetY;
    currentZ = targetZ;
  }

  return { gcode: output.join('\n'), modified: movesProcessed, segments: totalSegments };
}

function autoCalcFaceRefPos() {
  var faceData = (typeof getFaceMeshData === 'function') ? getFaceMeshData() : null;
  if (!faceData || !faceData.length) {
    alert('No face mesh data available. Run a face probe or import face mesh data first.');
    return;
  }
  var axis = (document.getElementById('apply-face-axis').value || 'Y').toUpperCase();
  var values = [];
  for (var i = 0; i < faceData.length; i++) {
    var val = axis === 'X' ? Number(faceData[i].x) : Number(faceData[i].y);
    if (!isNaN(val)) values.push(val);
  }
  if (!values.length) {
    alert('No valid contact values found in face mesh data.');
    return;
  }
  var sum = 0;
  var mn = values[0], mx = values[0];
  for (var j = 0; j < values.length; j++) {
    sum += values[j];
    if (values[j] < mn) mn = values[j];
    if (values[j] > mx) mx = values[j];
  }
  var mean = sum / values.length;
  var rounded = Math.round(mean * 1000) / 1000;

  var refEl = document.getElementById('apply-face-refPos');
  if (refEl) refEl.value = rounded;

  var statsEl = document.getElementById('apply-face-refPos-stats');
  if (statsEl) {
    statsEl.textContent = 'Mean: ' + rounded.toFixed(3) + ' | Min: ' + mn.toFixed(3) +
      ' | Max: ' + mx.toFixed(3) + ' | ' + values.length + ' points';
  }

  var statusEl = document.getElementById('apply-face-status');
  if (statusEl) {
    statusEl.textContent = 'Auto-calculated reference: ' + rounded.toFixed(3) +
      ' (' + axis + '-axis mean across ' + values.length + ' face contacts)';
    statusEl.className = 'status-line good';
  }
}

function applyFaceCompensationFromTab() {
  if (!applyOriginalGcode) { alert('Load G-code first.'); return; }
  var faceData = (typeof getFaceMeshData === 'function') ? getFaceMeshData() : null;
  if (!faceData) { alert('No face mesh data. Run face probing first.'); return; }

  var refPos = Number(document.getElementById('apply-face-refPos').value) || 0;
  var axis = (document.getElementById('apply-face-axis').value || 'Y').toUpperCase();
  var uniformChk = document.getElementById('apply-face-uniform');
  var uniformOffset = uniformChk ? uniformChk.checked : true;
  var statusEl = document.getElementById('apply-face-status');
  var faceLogEl = document.getElementById('apply-face-log');
  if (faceLogEl) faceLogEl.innerHTML = '';

  // Validation: warn if refPos is far from mean contact value
  var contactValues = [];
  for (var ci = 0; ci < faceData.length; ci++) {
    var cv = axis === 'X' ? Number(faceData[ci].x) : Number(faceData[ci].y);
    if (!isNaN(cv)) contactValues.push(cv);
  }
  if (contactValues.length) {
    var contactSum = 0;
    for (var cj = 0; cj < contactValues.length; cj++) contactSum += contactValues[cj];
    var contactMean = contactSum / contactValues.length;
    if (Math.abs(contactMean - refPos) > 5) {
      var warnMsg = 'Warning: Reference Face Position (' + refPos + ') is far from the average face contact position (' +
        contactMean.toFixed(3) + ').\n\nThis will cause large bulk shifts in your G-code. ' +
        'Use \u21BB Auto from mesh to set the recommended value, or verify your reference is correct.\n\nProceed anyway?';
      if (!confirm(warnMsg)) return;
    }
  }

  applyLogFace('Applying face compensation (axis=' + axis + ', refPos=' + refPos + ', uniform=' + uniformOffset + ')...');

  try {
    if (typeof faceApplyCompensationCore !== 'function') {
      throw new Error('Face compensation core function not available');
    }
    var result = faceApplyCompensationCore(applyOriginalGcode, faceData, refPos, axis, uniformOffset);
    applyFaceCompGcode = result.gcode;
    applyLogFace('Done! ' + result.modified + ' ' + axis + ' values adjusted, ' + (result.segments || 0) + ' segments generated.');
    if (statusEl) { statusEl.textContent = 'Face compensation applied: ' + result.modified + ' values adjusted, ' + (result.segments || 0) + ' segments.'; statusEl.className = 'status-line good'; }
    applyUpdatePreview(applyFaceCompGcode);
    applyUpdateButtons();
  } catch(e) {
    applyLogFace('ERROR: ' + e.message);
    if (statusEl) { statusEl.textContent = 'Error: ' + e.message; statusEl.className = 'status-line bad'; }
  }
}


// ── Face Probe Compensation ───────────────────────────────────────────────────


// ── Face Compensation — 2D bilinear interpolation ────────────────────────────
// Adjusts the lateral axis (Y for Y-face probe, X for X-face probe) in G-code
// by interpolating the face mesh at each (sampleCoord, Z) position.
// This corrects the toolpath to follow the actual face contour at each depth.
// referenceContact = the nominal/expected flat face position (Y or X value).
// overrideAxis (optional): when 'X' or 'Y', use directly instead of auto-detecting.
function faceApplyCompensationCore(gcodeText, contactPoints, referenceContact, overrideAxis, uniformOffset) {

  // ── Detect face axis ──────────────────────────────────────────────────────
  // For a Y-axis face probe: the probe moved along Y, so:
  //   sampleCoord = r.x (position along the slab), contactVal = r.y (Y contact)
  // For an X-axis face probe: the probe moved along X, so:
  //   sampleCoord = r.y (position along the slab), contactVal = r.x (X contact)
  var faceAxis = 'Y';
  // Use explicit axis override if provided by caller (from Apply tab dropdown)
  if (overrideAxis && (overrideAxis === 'X' || overrideAxis === 'Y')) {
    faceAxis = overrideAxis;
  } else {
    var statusText = contactPoints.map(function(p){ return String(p.status || ''); }).join(' ');
    if (statusText.indexOf('FACE X') >= 0) faceAxis = 'X';
    else if (statusText.indexOf('FACE Y') >= 0) faceAxis = 'Y';
    else {
      var xr = Math.max.apply(null, contactPoints.map(function(p){ return Number(p.x); })) -
               Math.min.apply(null, contactPoints.map(function(p){ return Number(p.x); }));
      var yr = Math.max.apply(null, contactPoints.map(function(p){ return Number(p.y); })) -
               Math.min.apply(null, contactPoints.map(function(p){ return Number(p.y); }));
      faceAxis = xr >= yr ? 'X' : 'Y';
    }
  }

  var sampleFn   = faceAxis === 'X'
    ? function(p){ return Number(p.y); }   // X-face: sample coord is Y
    : function(p){ return Number(p.x); };  // Y-face: sample coord is X
  var contactFn  = faceAxis === 'X'
    ? function(p){ return Number(p.x); }   // X-face: contact value is X
    : function(p){ return Number(p.y); };  // Y-face: contact value is Y

  // ── Build 2D interpolation grid (sampleCoord × Z_depth → contactValue) ──────
  var sampleMap = {}, zMap = {};
  contactPoints.forEach(function(p) {
    var sk = sampleFn(p).toFixed(4), zk = Number(p.z).toFixed(4);
    if (!(sk in sampleMap)) sampleMap[sk] = sampleFn(p);
    if (!(zk in zMap))      zMap[zk]      = Number(p.z);
  });

  var sampleVals = Object.keys(sampleMap).map(function(k){ return sampleMap[k]; })
                         .sort(function(a, b){ return a - b; });
  var zVals      = Object.keys(zMap).map(function(k){ return zMap[k]; })
                         .sort(function(a, b){ return a - b; });

  var sIdxMap = {}, zIdxMap = {};
  sampleVals.forEach(function(v, i){ sIdxMap[v.toFixed(4)] = i; });
  zVals.forEach(function(v, i){ zIdxMap[v.toFixed(4)] = i; });

  // grid[zi][si] = contact value (or null if no data for that cell)
  var grid = [];
  for (var gi = 0; gi < zVals.length; gi++) {
    var row = [];
    for (var gj = 0; gj < sampleVals.length; gj++) row.push(null);
    grid.push(row);
  }
  contactPoints.forEach(function(p) {
    var si = sIdxMap[sampleFn(p).toFixed(4)];
    var zi = zIdxMap[Number(p.z).toFixed(4)];
    if (si != null && zi != null && grid[zi][si] === null) grid[zi][si] = contactFn(p); // si/zi come from object key lookup, != null is correct
  });

  // ── Lower-bound binary search helper ─────────────────────────────────────
  function lowerBound(arr, val) {
    if (val <= arr[0]) return 0;
    if (val >= arr[arr.length - 1]) return arr.length - 2;
    var lo = 0, hi = arr.length - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] <= val) lo = mid; else hi = mid;
    }
    return lo;
  }

  // ── Bilinear interpolation at (qSample, qZ) ───────────────────────────────
  // When fewer than 2 unique values exist on an axis, degrades gracefully.
  function interpolateContact(qSample, qZ) {
    var sn = sampleVals.length, zn = zVals.length;

    // Degenerate cases
    if (sn === 0 || zn === 0) return null;
    if (sn === 1 && zn === 1) {
      var cv = grid[0][0];
      return cv !== null ? cv - referenceContact : null;
    }

    var si0, si1, fi;
    if (sn === 1) { si0 = si1 = 0; fi = 0; }
    else { si0 = lowerBound(sampleVals, qSample); si1 = si0 + 1; var sSpan = sampleVals[si1] - sampleVals[si0]; fi = sSpan > 0 ? Math.max(0, Math.min(1, (qSample - sampleVals[si0]) / sSpan)) : 0; }

    var zi0, zi1, fz;
    if (zn === 1) { zi0 = zi1 = 0; fz = 0; }
    else { zi0 = lowerBound(zVals, qZ); zi1 = zi0 + 1; var zSpan = zVals[zi1] - zVals[zi0]; fz = zSpan > 0 ? Math.max(0, Math.min(1, (qZ - zVals[zi0]) / zSpan)) : 0; }

    var c00 = grid[zi0][si0], c10 = (si1 < sn ? grid[zi0][si1] : null);
    var c01 = grid[zi1][si0], c11 = (si1 < sn ? grid[zi1][si1] : null);

    // Fill null corners from neighbours so interpolation always has a value
    var fallback = c00 !== null ? c00 : (c10 !== null ? c10 : (c01 !== null ? c01 : c11));
    if (fallback === null) return null;
    if (c00 === null) c00 = fallback;
    if (c10 === null) c10 = fallback;
    if (c01 === null) c01 = fallback;
    if (c11 === null) c11 = fallback;

    // Interpolate along sample axis at each Z row
    var c0 = c00 * (1 - fi) + c10 * fi;
    var c1 = c01 * (1 - fi) + c11 * fi;
    // Interpolate along Z axis between the two sample-axis results
    var contactVal = c0 * (1 - fz) + c1 * fz;
    return contactVal - referenceContact;
  }

  // ── Apply compensation to each G-code line ────────────────────────────────
  var lines = gcodeText.split('\n');
  var output = [];
  var currentX = 0, currentY = 0, currentZ = 0;
  var linesModified = 0;
  var totalSegments = 0;

  // Compute segment length from face mesh sample spacing (distance between consecutive sample coords)
  var segmentLength = 2.0; // default 2mm fallback
  if (sampleVals.length > 1) {
    var minSpacing = Infinity;
    for (var si = 1; si < sampleVals.length; si++) {
      var sp = sampleVals[si] - sampleVals[si - 1];
      if (sp > 0 && sp < minSpacing) minSpacing = sp;
    }
    if (minSpacing < Infinity) segmentLength = minSpacing;
  }

  // ── Pass 1 (uniform offset mode): pre-compute one offset per move group ──────
  // Groups are separated by G0 rapids, Z retracts (pz >= 0 catches V-carve retracts
  // to Z=0 between letter strokes), or non-move lines.  Every G1 line in a group
  // receives the same Y (or X) offset derived from the group centroid, preserving
  // the internal letter geometry.
  var lineGroupOffset = null; // null → per-point mode; array → uniform mode
  if (uniformOffset) {
    var p1X = 0, p1Y = 0, p1Z = 0;
    var grpLines = [], grpSamples = [], grpZs = [];
    lineGroupOffset = [];
    for (var pi = 0; pi < lines.length; pi++) lineGroupOffset.push(null);

    var finalizeGrp = function() {
      if (grpLines.length > 0 && grpSamples.length > 0) {
        var avgS = 0, avgGZ = 0;
        for (var gk = 0; gk < grpSamples.length; gk++) avgS += grpSamples[gk];
        for (var gk = 0; gk < grpZs.length; gk++) avgGZ += grpZs[gk];
        avgS  /= grpSamples.length;
        avgGZ /= grpZs.length;
        var grpOff = interpolateContact(avgS, avgGZ);
        for (var gk = 0; gk < grpLines.length; gk++) lineGroupOffset[grpLines[gk]] = grpOff;
      }
      grpLines = []; grpSamples = []; grpZs = [];
    };

    for (var pi = 0; pi < lines.length; pi++) {
      var pl = lines[pi].trim();
      if (!pl || pl.startsWith(';') || pl.startsWith('(')) continue;
      var plIsG0 = /^(?:N\d+\s+)?G0\b|^(?:N\d+\s+)?G00\b/i.test(pl);
      var plIsG1 = /^(?:N\d+\s+)?G1\b/i.test(pl);
      var pxM = pl.match(/X(-?[\d.]+)/i);
      var pyM = pl.match(/Y(-?[\d.]+)/i);
      var pzM = pl.match(/Z(-?[\d.]+)/i);
      var px = pxM ? parseFloat(pxM[1]) : p1X;
      var py = pyM ? parseFloat(pyM[1]) : p1Y;
      var pz = pzM ? parseFloat(pzM[1]) : p1Z;
      if (plIsG0) {
        finalizeGrp();
      } else if (plIsG1) {
        if (pz >= 0) {
          // Retract move — end current group but don't add this line to a group
          // (pz >= 0 catches V-carve retracts to Z=0 as well as clearance moves)
          finalizeGrp();
        } else {
          grpLines.push(pi);
          grpSamples.push(faceAxis === 'Y' ? px : py);
          grpZs.push(pz);
        }
      } else {
        // Non-move line (tool change, spindle command, etc.) — end group
        finalizeGrp();
      }
      p1X = px; p1Y = py; p1Z = pz;
    }
    finalizeGrp(); // finalize any trailing group
  }

  // Prepend informational header comments
  var viewOrientation = faceAxis === 'Y' ? 'XZ plane (side view) for best visualization' : 'YZ plane (side view) for best visualization';
  output.push('; Face-compensated G-code generated by 3D Live Edge Mesh');
  output.push('; Compensation type: Face (' + faceAxis + '-axis)');
  output.push('; Face probe data: ' + contactPoints.length + ' contact points');
  output.push('; Offset mode: ' + (uniformOffset ? 'uniform per move group (preserves letter shapes)' : 'per-point interpolation'));
  output.push('; Compensation axis: ' + faceAxis + ' adjusted based on face contour at each (sampleCoord, Z) position');
  output.push('; View orientation: ' + viewOrientation);
  output.push('; Subdivision: enabled (segment length=' + segmentLength.toFixed(2) + ')');
  output.push('; NOTE: ncSender shows XY plane (top-down). Use the plugin toolpath preview to verify face contour.');
  output.push('');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.startsWith(';') || line.startsWith('(')) { output.push(lines[i]); continue; }
    var isMove = /^(?:N\d+\s+)?G[01]\b/i.test(line) || /\b[XYZ][-\d.]/i.test(line);
    if (!isMove) { output.push(lines[i]); continue; }

    var xMatch = line.match(/X(-?[\d.]+)/i);
    var yMatch = line.match(/Y(-?[\d.]+)/i);
    var zMatch = line.match(/Z(-?[\d.]+)/i);
    var fMatch = line.match(/F(-?[\d.]+)/i);

    var startX = currentX, startY = currentY, startZ = currentZ;
    var targetX = xMatch ? parseFloat(xMatch[1]) : currentX;
    var targetY = yMatch ? parseFloat(yMatch[1]) : currentY;
    var targetZ = zMatch ? parseFloat(zMatch[1]) : currentZ;

    currentX = targetX;
    currentY = targetY;
    currentZ = targetZ;

    // Compensate any G1 move that has an explicit face-axis coordinate, OR that moves
    // along the sample axis or changes Z (face position varies with both).
    // This ensures lines like "G1 X10 Z-2" (no Y) also get face compensation applied.
    var isG1Linear = /^(?:N\d+\s+)?G1\b/i.test(line);
    var hasFaceCoord = faceAxis === 'Y' ? !!yMatch : !!xMatch;
    var sampleAxisDist = faceAxis === 'Y' ? Math.abs(targetX - startX) : Math.abs(targetY - startY);
    var needsCompensation = hasFaceCoord || (isG1Linear && (sampleAxisDist > 0 || targetZ !== startZ));
    // In uniform mode only process G1 lines that belong to a cutting group
    if (lineGroupOffset !== null) needsCompensation = isG1Linear && lineGroupOffset[i] !== null;

    if (needsCompensation) {
      if (isG1Linear && sampleAxisDist > segmentLength) {
        // Subdivide into N segments for smooth face-contour following
        var nSegs = Math.ceil(sampleAxisDist / segmentLength);
        var dx = targetX - startX;
        var dy = targetY - startY;
        var dz = targetZ - startZ;
        var feedStr = fMatch ? (' F' + parseFloat(fMatch[1]).toFixed(0)) : '';

        for (var sn = 1; sn <= nSegs; sn++) {
          var t = sn / nSegs;
          var segX = startX + dx * t;
          var segY = startY + dy * t;
          var segZ = startZ + dz * t;
          var qSeg = faceAxis === 'Y' ? segX : segY;
          var offSeg = (lineGroupOffset !== null) ? lineGroupOffset[i] : interpolateContact(qSeg, segZ);
          var segLine;
          if (offSeg !== null) {
            if (faceAxis === 'Y') {
              segLine = 'G1 X' + segX.toFixed(3) + ' Y' + (segY + offSeg).toFixed(3) + ' Z' + segZ.toFixed(3);
            } else {
              segLine = 'G1 X' + (segX + offSeg).toFixed(3) + ' Y' + segY.toFixed(3) + ' Z' + segZ.toFixed(3);
            }
            linesModified++;
          } else {
            segLine = 'G1 X' + segX.toFixed(3) + ' Y' + segY.toFixed(3) + ' Z' + segZ.toFixed(3);
          }
          if (sn === 1) segLine += feedStr;
          output.push(segLine);
          totalSegments++;
        }
      } else {
        var qSample = faceAxis === 'Y' ? currentX : currentY;
        var offset  = (lineGroupOffset !== null) ? lineGroupOffset[i] : interpolateContact(qSample, currentZ);
        if (offset !== null) {
          if (faceAxis === 'Y') {
            var newY = currentY + offset;
            if (hasFaceCoord) {
              line = line.replace(/Y(-?[\d.]+)/i, 'Y' + newY.toFixed(3));
            } else {
              line = line + ' Y' + newY.toFixed(3);
            }
          } else {
            var newX = currentX + offset;
            if (hasFaceCoord) {
              line = line.replace(/X(-?[\d.]+)/i, 'X' + newX.toFixed(3));
            } else {
              line = line + ' X' + newX.toFixed(3);
            }
          }
          linesModified++;
        }
        output.push(line);
      }
    } else {
      output.push(line);
    }
  }
  return { gcode: output.join('\n'), modified: linesModified, faceAxis: faceAxis, segments: totalSegments };
}
// ── Combined Save / Export ────────────────────────────────────────────────────

function saveCombinedMesh() {
  var statusEl = document.getElementById('comb-meshStorageStatus');
  if (!combinedMeshPoints || combinedMeshPoints.length === 0) {
    if (statusEl) statusEl.textContent = 'No combined data to save.';
    return;
  }
  var today = new Date();
  var dateStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  var suggestedName = 'combined-mesh-' + dateStr + '.json';
  var data = { type: 'combined', pluginVersion: SM_VERSION, timestamp: Date.now(), points: combinedMeshPoints, gridConfig: smGridConfig };
  var jsonStr = JSON.stringify(data, null, 2);

  if (window.showSaveFilePicker) {
    window.showSaveFilePicker({
      suggestedName: suggestedName,
      types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
    }).then(function(handle) {
      return handle.createWritable().then(function(writable) {
        return writable.write(jsonStr).then(function() { return writable.close(); }).then(function() {
          if (statusEl) statusEl.textContent = '\u2705 Saved: ' + handle.name;
        });
      });
    }).catch(function(err) {
      if (err.name !== 'AbortError') {
        if (statusEl) statusEl.textContent = 'Save failed: ' + err.message;
      } else {
        if (statusEl) statusEl.textContent = 'Save cancelled.';
      }
    });
  } else {
    try {
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = suggestedName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      if (statusEl) statusEl.textContent = '\u2705 Saved as ' + suggestedName;
    } catch(e) {
      if (statusEl) statusEl.textContent = 'Save failed: ' + e.message;
    }
  }
}

function exportCombinedMeshCSV() {
  if (!combinedMeshPoints || combinedMeshPoints.length === 0) { alert('No combined data to export.'); return; }
  var lines = ['# Plugin Version: ' + SM_VERSION, '#,Source,X,Y,Z'];
  combinedMeshPoints.forEach(function(pt, i) {
    lines.push((i + 1) + ',' + pt.source + ',' + pt.x.toFixed(4) + ',' + pt.y.toFixed(4) + ',' + pt.z.toFixed(4));
  });
  var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'combined_mesh_' + Date.now() + '.csv';
  a.click();
}

function exportCombinedMeshJSON() {
  if (!combinedMeshPoints || combinedMeshPoints.length === 0) { alert('No combined data to export.'); return; }
  var data = { type: 'combined', pluginVersion: SM_VERSION, timestamp: Date.now(), points: combinedMeshPoints, gridConfig: smGridConfig };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'combined_mesh_' + Date.now() + '.json';
  a.click();
}

function clearCombinedMesh() {
  combinedMeshPoints = null;
  updateCombinedMeshUI();
  var statusEl = document.getElementById('comb-meshStorageStatus');
  if (statusEl) statusEl.textContent = 'Combined data cleared.';
}

