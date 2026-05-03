# Stand-alone 3D Live Edge Probe - Architecture Documentation

**Version:** V21.0
**Last Updated:** 2026-05-03

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Module Structure](#module-structure)
3. [Data Flow](#data-flow)
4. [State Management](#state-management)
5. [Communication Architecture](#communication-architecture)
6. [Build Architecture](#build-architecture)
7. [UI Architecture](#ui-architecture)
8. [Extension Points](#extension-points)

---

## High-Level Architecture

The Stand-alone 3D Live Edge Probe uses a **modular, layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                            │
│  (HTML/CSS, Three.js visualization, user interaction)      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (Probe logic, motion planning, data management)           │
│  • top-probe.js  • face-probe.js  • outline-probe.js       │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Probe Engine Layer                       │
│  (Core probe primitives, timing, safety)                   │
│  • probe-engine.js  • finish-motion.js                     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Core Layer                             │
│  (Machine communication, state management, commands)       │
│  • core.js                                                  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Transport Layer                          │
│  (Communication protocol implementation)                    │
│  • ncSender API (fetch) OR                                 │
│  • Web Serial (USB) OR                                     │
│  • WebSocket (network)                                      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                     Hardware Layer                          │
│  (GRBL-compatible CNC controller)                          │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns** - Each module has a single, well-defined responsibility
2. **Transport Abstraction** - Core logic is transport-agnostic (works with any connection type)
3. **Progressive Enhancement** - Features work across all connection modes
4. **Fail-Safe Defaults** - Safety is paramount; errors halt operations
5. **Testability** - Clear boundaries enable unit and integration testing

---

## Module Structure

### Core Module (`core.js`)

**Responsibility:** Foundation for all operations - machine communication, state management, safety systems.

**Key Components:**

**State Variables:**
```javascript
var _running = false;               // Probe operation active
var _stopRequested = false;         // User requested stop
var _safetyMoveActive = false;      // Safety retract in progress
var _runGeneration = 0;             // Invalidate stale async work
var _stopInProgress = false;        // Guard double-stop clicks
var _unlockPollActive = false;      // Guard concurrent unlock
var _faceSurfRefZ = null;           // Surface reference Z for face probe
var topResults = [];                // Top probe results
var faceResults = [];               // Face probe results
var s = {};                         // Current run settings
```

**Public API:**
- `sendCommand(gcode, timeout)` - Send G-code, wait for completion
- `_getState()` - Query machine status
- `getMachineSnapshot()` - Comprehensive state snapshot
- `getWorkPosition()` - Current work coordinates
- `waitForIdle(fastPoll)` - Poll until Idle status
- `stopNowAndSafeHome(reason)` - Unified stop handler
- `requireStartupHomingPreflight(label)` - Pre-run validation

**Safety Systems:**
- ALARM detection and recovery
- Feed hold and queue clearing
- Emergency stop with safety retract
- Probe trigger validation

### Probe Engine Module (`probe-engine.js`)

**Responsibility:** Core probe motion primitives, timing instrumentation.

**Key Functions:**

**Motion Primitives:**
```javascript
smSafeLateralMove(x, y, travelFeed, clearanceZ)
  → Lift Z (absolute), move XY with G38.3 (safe travel)

smPlungeProbe(maxPlunge, probeFeed)
  → G38.2 probe down, detect contact, return position

smEnsureProbeClear(clearanceZ, travelFeed)
  → Verify probe open, lift if triggered, retry 3x

smRetractUp(clearanceZ, travelFeed)
  → Raise Z to absolute clearance height

smRetractSmall(contactZ, retractMm, travelFeed)
  → Small retract after contact

smRetractToZ(targetZ, travelFeed)
  → Absolute Z move to target

smPerformInitialClearanceLift(mode, lift, feed)
  → Initial Z lift before first probe point
```

**Surface Grid:**
```javascript
buildSurfaceGridConfig()
  → Parse UI, compute grid {minX, maxX, colCount, rowCount, ...}

runSurfaceProbing()
  → Main surface probe loop (serpentine pattern)

subdivideSurfaceMesh(grid, config, spacing)
  → Interpolate mesh points for smoother surfaces
```

**Timing:**
```javascript
_smTimingReset(totalPoints)
  → Initialize timing stats for probe run

_smEmitTimingSummary(outcome)
  → Log detailed timing breakdown at end of run
```

### Top Probe Module (`top-probe.js`)

**Responsibility:** Top surface probe operations, sample generation, logging.

**Key Functions:**
```javascript
runTopSurfaceProbe()
  → Execute top probe strategy (1D linear sample)

buildTopProbeSamples()
  → Generate sample positions from UI config

topLogProbe(msg)
  → Write to top probe log

topClearLog()
  → Clear top probe log
```

**Sample Strategy:**
- Sample along single axis (X or Y)
- Configurable start, end, count, direction
- Bi-directional scan option (forward, then reverse)

### Face Probe Module (`face-probe.js`)

**Responsibility:** Vertical face/edge probe operations, layered depth scanning.

**Key Functions:**
```javascript
runFaceProbe()
  → Execute face probe (single or layered)

fpBuildFaceSamplesFromConfig()
  → Generate face sample positions

fpGetEffectiveXPoints()
  → Compute X point count (manual or auto-spacing)

fpUpdateAutoSpacingUI()
  → Show/hide auto-spacing controls

fpUpdateCombinedFacePlanStatus()
  → Update combined mode plan summary
```

**Sample Strategy:**
- Horizontal samples along X axis at fixed Y offset
- Optional layered depth scanning (multiple Z levels)
- Top reference modes: every column or endpoints only
- Auto-spacing: compute point count from target spacing

### Outline Probe Module (`outline-probe.js`)

**Responsibility:** Outline/perimeter scanning from inside or outside.

**Key Functions:**
```javascript
runOutlineProbe()
  → Execute outline scan strategy

outlineProbeAxis(axis, direction, startPos, maxTravel, step)
  → Probe single axis/direction

outlineDetectContactThreshold(contacts, threshold)
  → Verify contact with multiple hits

outlineComputeBoundingBox(contacts)
  → Calculate bounding box from contact points

outlineApplyToSurfaceGrid(bbox)
  → Auto-populate surface grid bounds from outline
```

**Scan Strategies:**
- **Inside:** Start from center/corner, probe outward
- **Outside:** Start from border, probe inward
- **Cross:** 4 axes (+X, -X, +Y, -Y)
- **Square:** 8 directions (cross + diagonals)

### Finish Motion Module (`finish-motion.js`)

**Responsibility:** Post-probe positioning and safe retract.

**Key Functions:**
```javascript
smFinishMotion(travelFeed)
  → Retract Z to safe height, optionally return to X0 Y0

getMaxMeasuredSurfaceZ()
  → Find highest Z from all probe results

computeSafeRetractZ(clearanceOffset)
  → maxZ + clearance offset
```

**Behavior:**
- Queries highest measured surface Z
- Adds configurable clearance offset
- Uses **work coordinates (G90)**, not machine (G53)
- Optional return to X0 Y0 after retract
- Skipped in combined mode between probe phases

### Visualization Module (`visualization.js`)

**Responsibility:** Three.js 3D rendering, heatmaps, relief views.

**Key Components:**

**Scene Management:**
```javascript
_threeState = {
  'sm': { scene, camera, renderer, controls, ... },
  'res': { ... },  // Results tab
  'surf': { ... }, // Surface mesh tab
  // ... other scenes
}

_threeInit(prefix, targetDiv, bounds)
  → Create Three.js scene in target div

_threeDispose(prefix)
  → Clean up scene, stop animation, free GPU memory

_threeAnimate(prefix)
  → Render loop (requestAnimationFrame)
```

**Rendering:**
```javascript
_renderMesh3D(prefix, meshData, config, options)
  → Render 3D surface mesh with color gradient

_render2DHeatmap(canvasId, meshData, config)
  → Render 2D heatmap to canvas

_renderRelief3D(prefix, meshData, config)
  → Render 3D relief map with height exaggeration
```

**Live Probe Viz:**
```javascript
smPvizInit(gridConfig)
  → Initialize live probe visualization scene

smPvizUpdate(state, progress)
  → Update visualization state (traveling, plunging, contact)
```

### UI Helpers Module (`ui-helpers.js`)

**Responsibility:** UI utilities, form helpers, button handlers.

**Key Functions:**
```javascript
updateSavedLocationUI(pos)
  → Display saved position in UI

flashButton(btn)
  → Visual feedback animation

flashSaveButton(btn)
  → "Saved!" confirmation animation

updateMachineHelperUI(snap)
  → Update status displays (homed, probe, position)

updateOverrideCallouts(snap)
  → Show feed/rapid/spindle override warnings

setFooterStatus(msg, cls)
  → Update footer status bar (ok, warn, bad)
```

**Form Persistence:**
```javascript
savePanelSettings(panelId)
  → Save all inputs with data-persist attribute

loadPanelSettings(panelId)
  → Restore saved settings from localStorage

clearPanelSettings(panelId)
  → Remove saved settings
```

### Settings and Exports Module (`settings-and-exports.js`)

**Responsibility:** Settings persistence, data export, G-code compensation.

**Key Functions:**
```javascript
getSettingsFromUI()
  → Read all settings from UI into object

saveMeshToStorage()
  → Save mesh data to localStorage + file

exportSurfaceMeshCSV()
  → Export surface mesh as CSV

exportCombinedMeshJSON()
  → Export combined results as JSON

applyCompensationSurface(gcode)
  → Adjust Z coordinates using surface mesh

applyCompensationFace(gcode)
  → Adjust Y coordinates using face mesh

bilinearInterpolateZ(meshData, config, x, y)
  → Interpolate Z value at arbitrary XY position
```

**G-code Compensation:**
- Parse G-code line-by-line
- Extract coordinates (X, Y, Z)
- Interpolate offset from mesh
- Modify Z (surface) or Y (face) coordinate
- Preserve all other lines unchanged

### Diagnostics Module (`diagnostics.js`)

**Responsibility:** Debug logging, console output, timing reports.

**Key Functions:**
```javascript
pluginDebug(msg)
  → Write debug message to console and visible log

smLogProbe(msg)
  → Write to surface probe log

logLine(mode, msg)
  → Write to mode-specific log (top, face, outline)

outlineAppendLog(msg)
  → Write to outline scan log
```

**Debug Mode:**
- Toggled by "Debug Log" checkbox
- Prefix: `[PLUGIN DEBUG]`
- Color: gray (muted)
- Logs to console (always) + visible log (when enabled)

### Layout Editor Module (`layout-editor.js`)

**Responsibility:** Advanced UI layout configuration, custom layouts.

**Note:** This module is for future extensibility; current implementation is minimal.

---

## Data Flow

### Surface Probe Data Flow

```
User Clicks "Run Surface Probe"
  ↓
runSurfaceProbing()
  ↓
buildSurfaceGridConfig()  → {minX, maxX, colCount, rowCount, ...}
  ↓
requireStartupHomingPreflight()  → Validate homed, probe clear, no ALARM
  ↓
Loop: For each row (serpentine pattern)
  ↓
  Loop: For each column
    ↓
    smPvizUpdate('traveling')  → Update live visualization
    ↓
    smSafeLateralMove(x, y, travelFeed, clearanceZ)
      ↓
      getWorkPosition()  → Query current Z
      ↓
      Compute targetClearanceZ = currentZ + clearanceZ
      ↓
      sendCommand('G90 G1 Z' + targetClearanceZ + ' F' + travelFeed)
      ↓
      waitForIdleWithTimeout()
      ↓
      moveAxis('X', targetX)  → G38.3 safe travel
      ↓
      moveAxis('Y', targetY)  → G38.3 safe travel
    ↓
    smPvizUpdate('plunging')
    ↓
    smPlungeProbe(maxPlunge, probeFeed)
      ↓
      smEnsureProbeClear()  → Verify probe open, lift if triggered
      ↓
      sendCommand('G91')  → Relative mode
      ↓
      sendCommand('G38.2 Z-' + maxPlunge + ' F' + probeFeed)
      ↓
      waitForIdleWithTimeout(30000, true)  → Fast-poll mode
      ↓
      sendCommand('G90')  → Restore absolute mode
      ↓
      Return contact position {x, y, z, machineX, machineY, machineZ}
    ↓
    result[row][col] = contactZ
    ↓
    smPvizUpdate('contact')
  ↓
  Row transition: smSafeLateralMove to start of next row
↓
smMeshData = result
smGridConfig = config
↓
smFinishMotion(travelFeed)  → Retract Z, return to X0 Y0
  ↓
  getMaxMeasuredSurfaceZ()  → Find highest Z
  ↓
  finishZ = maxZ + clearanceOffset
  ↓
  moveAbs(null, null, finishZ, feed)  → Retract Z
  ↓
  moveAbs(0, 0, null, feed)  → Return to X0 Y0 (if enabled)
↓
saveMeshToStorage()  → Persist to localStorage
↓
updateSurfaceMeshUI()  → Render 3D visualization
↓
populateSurfaceResults()  → Populate results table
```

### Combined Mode Data Flow

```
User Clicks "Run Combined Probe"
  ↓
runCombinedProbe()
  ↓
_smSkipFinishMotion = true  → Skip retract between phases
_smProbingCompleteCallback = onSurfaceComplete  → Chain face probe
  ↓
runSurfaceProbing()  → Execute surface probe (see above)
  ↓
  [Surface probe completes]
  ↓
  _smProbingCompleteCallback(success)
    ↓
    if (success && smMeshData)
      ↓
      runFaceProbe()  → Execute face probe
        ↓
        fpBuildFaceSamplesFromConfig()  → Generate face samples
        ↓
        For each sample:
          ↓
          topZ = bilinearInterpolateZ(smMeshData, smGridConfig, x, y)  → Use surface data
          ↓
          Face probe at (x, y, topZ)
        ↓
        faceResults = [...]
      ↓
      smFinishMotion(travelFeed)  → Now retract (after both phases)
    ↓
    combinedMeshPoints = merge(smMeshData, faceResults)
    ↓
    updateCombinedMeshUI()  → Render unified visualization
```

---

## State Management

### Global State

**Machine State:**
```javascript
{
  x, y, z,                  // Work coordinates
  machineX, machineY, machineZ,  // Machine coordinates
  status,                   // "Idle", "Run", "Hold", "Alarm", etc.
  probeTriggered,           // Boolean - probe input state
  homed,                    // Boolean - homing status (null if unknown)
  feedOverridePct,          // Feed rate override percentage
  rapidOverridePct,         // Rapid rate override percentage
  spindleOverridePct,       // Spindle speed override percentage
  raw                       // Full raw status report
}
```

**Probe Run State:**
```javascript
{
  _running,                 // Boolean - operation in progress
  _stopRequested,           // Boolean - user clicked stop
  _safetyMoveActive,        // Boolean - safety retract in progress (don't abort)
  _runGeneration,           // Number - incremented on stop to invalidate async work
  _stopInProgress,          // Boolean - guard double-stop clicks
  smStopFlag,               // Boolean - surface probe stop
  _outlineStopFlag,         // Boolean - outline probe stop
  smMeshData,               // 2D array - surface probe Z values
  smGridConfig,             // Object - surface grid configuration
  topResults,               // Array - top probe results
  faceResults,              // Array - face probe results
  layeredFaceResults,       // Array - layered face probe results
  combinedMeshPoints        // Array - combined surface + face points
}
```

**Stop Flags:**
- `_stopRequested` - Universal stop flag (core)
- `smStopFlag` - Surface probe specific
- `_outlineStopFlag` - Outline probe specific
- All set to `true` in `stopNowAndSafeHome()`
- All cleared to `false` before starting new run

**Run Generation:**
- Incremented on stop: `_runGeneration++`
- Async operations check against captured generation
- If mismatch, abort (work is stale)

Example:
```javascript
var myGeneration = _runGeneration;
await longAsyncOperation();
if (_runGeneration !== myGeneration) {
  return; // Stop was clicked during operation
}
```

### LocalStorage State

**Keys:**
- `edgeProbeTopResults` - Top probe results
- `edgeProbeFaceResults` - Face probe results
- `edgeProbeFaceLayeredResults` - Layered face results
- `faceProbe.faceMeshData` - Face mesh
- `edgeProbeMeshData` - Combined mesh
- `edgeProbeSavedLocation` - Saved jog position
- `edgeProbeDimensions` - Probe dimensions
- `edgeProbeFaceLog` - Face probe log
- `3dmesh.combined.mesh` - Surface mesh data
- `3dmesh.combined.settings` - Surface grid settings
- `smSurfaceGridSettings` - Surface grid config
- `edgeProbePanel.{inputId}` - Per-control settings

**Cleanup:**
- `pluginCleanupOnClose()` clears all probe results
- Settings persist across sessions
- Mesh data cleared on plugin close (user can export first)

---

## Communication Architecture

### Transport Abstraction

The codebase uses **function override pattern** to support multiple connection types:

```javascript
// core.js defines base implementations:
async function sendCommand(gcode, timeout) {
  // Fetch-based ncSender API
}

async function _getState() {
  // Fetch /api/server-state
}

// Transport files override these functions:
// webserial-transport.js or websocket-transport.js

async function sendCommand(gcode, timeout) {
  // Serial write or WebSocket send
}

async function _getState() {
  // Query '?' status report via serial/WebSocket
}
```

**JavaScript Last-Wins Resolution:**
- Transport file appended AFTER core.js in build
- Duplicate function declarations resolve to last definition
- All probe logic calls same function names
- Transport-specific behavior injected transparently

### ncSender API (Plugin Mode)

**Base URL:** `http://localhost:8000` (ncSender server)

**Endpoints:**

```javascript
POST /api/send-command
Body: { "command": "G1 X10", "meta": {"sourceId": "plugin"} }
Response: { "success": true } or { "error": "..." }

GET /api/server-state
Response: { "machineState": {...} }

POST /api/gcode-job/stop
POST /api/probe/stop
POST /api/gcode/stop
Response: 200 OK or 404 Not Found
```

**Command Flow:**
```
Plugin: sendCommand('G1 X10')
  ↓
fetch('/api/send-command', POST)
  ↓
ncSender: Queue command
  ↓
ncSender: Send to GRBL via serial
  ↓
GRBL: Execute, respond 'ok'
  ↓
ncSender: Resolve fetch promise
  ↓
Plugin: Command complete
```

### Web Serial (Standalone Mode)

**Connection:**
```javascript
var port = await navigator.serial.requestPort();
await port.open({ baudRate: 115200 });
var writer = port.writable.getWriter();
var reader = port.readable.getReader();
```

**Command Flow:**
```
Plugin: sendCommand('G1 X10')
  ↓
Encode: 'G1 X10\n' → Uint8Array
  ↓
writer.write(bytes)
  ↓
USB Serial → GRBL
  ↓
Read loop: reader.read()
  ↓
Decode bytes → text
  ↓
Parse 'ok' or 'error:...'
  ↓
Resolve promise
  ↓
Plugin: Command complete
```

**Response Queues:**
- `_wsOkQueue` - Pending commands waiting for 'ok'/'error'
- `_wsStatusQueue` - Pending '?' queries waiting for '<...>' status
- FIFO order (GRBL responds in command order)

**Real-Time Commands:**
- `!` (feed hold) - Sent as raw byte `0x21`
- `~` (cycle start) - Sent as raw byte `0x7E`
- `?` (status query) - Sent as text line

### WebSocket (Standalone Network Mode)

**Connection:**
```javascript
var ws = new WebSocket('ws://192.168.5.1:81/ws');
ws.onopen = () => { /* Connected */ };
ws.onmessage = (evt) => { /* Receive data */ };
ws.send('G1 X10\n');
```

**Command Flow:**
```
Plugin: sendCommand('G1 X10')
  ↓
ws.send('G1 X10\n')
  ↓
Network → FluidNC/grblHAL
  ↓
ws.onmessage: 'ok'
  ↓
Parse, resolve promise
  ↓
Plugin: Command complete
```

**Line Buffering:**
- WebSocket messages may contain partial lines
- `_wsLineBuf` accumulates bytes until `\n`
- Full lines parsed and routed to queues

---

## Build Architecture

### Build Process

**build-standalone.sh:**
```bash
cat src-standalone/config-header.html \
    src-standalone/styles.css \
    src-standalone/config-body.html \
    src-standalone/js/core.js \
    src-standalone/js/ui-helpers.js \
    src-standalone/js/probe-engine.js \
    src-standalone/js/visualization.js \
    src-standalone/js/top-probe.js \
    src-standalone/js/face-probe.js \
    src-standalone/js/outline-probe.js \
    src-standalone/js/finish-motion.js \
    src-standalone/js/settings-and-exports.js \
    src-standalone/js/diagnostics.js \
    src-standalone/js/layout-editor.js \
    standalone/src/webserial-transport.js \
    src-standalone/config-footer.html \
    > standalone.html
```

**Output:**
- Single HTML file with embedded CSS and JavaScript
- No external dependencies
- Can be opened directly in browser (no web server needed)

**build-standalone-ws.sh:**
- Identical to above, but uses `websocket-transport.js` instead

### Build Rules

**DO NOT:**
- Edit `standalone.html` or `standalone-ws.html` directly (will be overwritten)
- Modify build scripts without testing both variants

**DO:**
- Edit source files in `src-standalone/` or `standalone/src/`
- Re-run build scripts after any source changes
- Test both builds after modifying shared code

### Module Order

**Order Matters:**
1. **HTML Header** - DOCTYPE, meta tags, `<style>`
2. **CSS** - All styles embedded
3. **HTML Body** - UI structure, tabs, panels
4. **Core JS** - Base functionality
5. **Helper Modules** - UI, settings, diagnostics
6. **Probe Modules** - Top, face, outline, engine
7. **Visualization** - Three.js rendering
8. **Transport** - Connection-specific overrides (LAST)
9. **HTML Footer** - Close tags, init script

**Why Transport is Last:**
- JavaScript function declarations resolve last-wins
- Transport overrides core.js functions
- Core logic remains transport-agnostic

---

## UI Architecture

### Tab Structure

```
┌────────────────────────────────────────────────────┐
│  Header: Connection Status, Version                │
├────────────────────────────────────────────────────┤
│  Tabs: Setup | Outline | Probe | Face | Combined | │
│        Results | Mesh Data | Apply | Diagnostics  │
├────────────────────────────────────────────────────┤
│                  Tab Content                        │
│  (Dynamic - shown/hidden via switchTab)           │
├────────────────────────────────────────────────────┤
│  Footer: Status Bar, Debug Toggle                  │
└────────────────────────────────────────────────────┘
```

**Tab Switching:**
```javascript
function switchTab(tabName) {
  // Hide all tab content divs
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  // Show selected tab
  document.getElementById(tabName + '-tab').style.display = 'block';
  // Update tab button active state
  // ...
}
```

### Component Structure

**Panel Pattern:**
```html
<div class="panel" id="panel-name">
  <div class="panel-header">
    <h3>Panel Title</h3>
  </div>
  <div class="panel-body">
    <div class="form-group">
      <label for="input-id">Label</label>
      <input type="number" id="input-id" data-persist value="10">
    </div>
    <!-- More form groups -->
    <div class="button-group">
      <button class="btn" onclick="actionFunction()">Action</button>
    </div>
  </div>
</div>
```

**Settings Persistence:**
- `data-persist` attribute enables auto-save
- `data-no-persist="1"` excludes from persistence
- Storage key: `edgeProbePanel.{inputId}`

### CSS Architecture

**Variables:**
```css
:root {
  --text: #e8e8e8;
  --bg: #0a0e14;
  --panel: #131824;
  --line: #1b2740;
  --muted: #6b7a9a;
  --accent: #5fd38d;
  --accent2: #4db8ff;
  --warn: #e8a020;
  --bad: #d03030;
  --ok: #5fd38d;
  --good: #5fd38d;
}
```

**Utility Classes:**
```css
.status-line.ok { color: var(--ok); }
.status-line.warn { color: var(--warn); }
.status-line.bad { color: var(--bad); }
.btn { /* Primary button */ }
.btn.ghost { /* Secondary/disabled button */ }
.btn-flash { /* Button press animation */ }
.btn-save-confirm { /* Save confirmation animation */ }
```

---

## Extension Points

### Adding a New Probe Mode

1. **Create Module File:** `src-standalone/js/my-probe.js`
2. **Implement Functions:**
   ```javascript
   async function runMyProbe() {
     await requireStartupHomingPreflight('my probe');
     // Use smSafeLateralMove, smPlungeProbe, etc.
     // Store results in myProbeResults array
   }
   function stopMyProbe() {
     myStopFlag = true;
     stopNowAndSafeHome('my probe');
   }
   ```
3. **Update Build Scripts:**
   ```bash
   cat ... \
       src-standalone/js/my-probe.js \
       ... > standalone.html
   ```
4. **Add UI Tab:**
   ```html
   <div class="tab-content" id="myprobe-tab">
     <!-- Config, Run button, Log, Viz -->
   </div>
   ```
5. **Wire Up Buttons:**
   ```html
   <button onclick="runMyProbe()">Run My Probe</button>
   <button onclick="stopMyProbe()">Stop</button>
   ```

### Adding a New Transport

1. **Create Transport File:** `standalone/src/my-transport.js`
2. **Implement Core Functions:**
   ```javascript
   async function sendCommand(gcode, timeoutMs) {
     // Send via your protocol
     // Wait for response
     // Return or throw
   }
   async function _getState() {
     // Query status via your protocol
     // Return { machineState: {...} }
   }
   async function _trySafeStopEndpoints(label) {
     // Send stop command
     // Return true if successful
   }
   ```
3. **Create Build Script:** `build-standalone-my.sh`
   ```bash
   cat ... \
       standalone/src/my-transport.js \
       ... > standalone-my.html
   ```
4. **Add Connection UI:** Inject controls in transport file
   ```javascript
   (function _myInjectUI() {
     var hdr = document.getElementById('hdr-conn');
     hdr.innerHTML = '<!-- Connect button, status -->';
   })();
   ```

### Adding Visualization

1. **Add to visualization.js:**
   ```javascript
   function _renderMyViz(prefix, data) {
     var state = _threeState[prefix];
     if (!state) state = _threeInit(prefix, 'my-viz-container', bounds);
     // Create geometry, material, mesh
     // Add to scene
     // Render
   }
   ```
2. **Add HTML Container:**
   ```html
   <div id="my-viz-container" style="width:100%;height:400px"></div>
   ```
3. **Call from Probe Module:**
   ```javascript
   _renderMyViz('myviz', myResults);
   ```

---

## Architectural Decisions

### Why Single HTML File?

**Pros:**
- No web server required (open directly in browser)
- No CORS issues (all code embedded)
- Easy distribution (one file)
- Self-contained (no missing dependencies)

**Cons:**
- Large file size (~900KB)
- Harder to debug (no source maps)
- Must rebuild after every change

**Mitigation:**
- Source files remain separate for development
- Build scripts are fast (<1s)
- Debug mode enabled via checkbox

### Why Function Override Pattern?

**Pros:**
- No code duplication (probe logic written once)
- Transport-agnostic design (works with any backend)
- Easy to add new transports (just override 4 functions)
- No complex dependency injection

**Cons:**
- Non-obvious override mechanism (last-wins JS resolution)
- Must preserve function signatures exactly
- Can't have multiple transports in same build

**Mitigation:**
- Document override pattern clearly (this doc, PR history)
- Use TypeScript-style JSDoc comments for signatures
- Build separate HTML per transport

### Why LocalStorage for State?

**Pros:**
- Persists across sessions
- No server required
- Instant save/load (synchronous API)
- Works offline

**Cons:**
- 10MB limit (can fill with large meshes)
- Cleared if user clears browser data
- Not shared across devices

**Mitigation:**
- Export/import to files for backup
- Clear old data on plugin close
- Warn user about storage limits

---

*This architecture is designed for maintainability, extensibility, and safety. Follow established patterns when adding new features.*
