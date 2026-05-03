# Stand-alone 3D Live Edge Probe - Full Functionality Documentation

**Version:** V21.0
**Last Updated:** 2026-05-03

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Features](#core-features)
4. [Probing Modes](#probing-modes)
5. [Motion Control System](#motion-control-system)
6. [Safety Features](#safety-features)
7. [Data Management](#data-management)
8. [Visualization System](#visualization-system)
9. [Build System](#build-system)
10. [Configuration and Settings](#configuration-and-settings)
11. [API and Integration](#api-and-integration)

---

## Overview

The **Stand-alone 3D Live Edge Probe** is a comprehensive web-based CNC probing application that provides advanced 3D surface and edge probing capabilities for GRBL-compatible CNC machines. It operates in multiple modes:

1. **Plugin Mode** - Runs inside ncSender as a plugin via fetch-based API
2. **Standalone Mode (Web Serial)** - Direct browser-to-GRBL connection via USB using Web Serial API
3. **Standalone Mode (WebSocket)** - Network connection to FluidNC, grblHAL, or similar network-enabled controllers

### Key Capabilities

- **Multi-axis 3D surface probing** with automatic mesh generation
- **Face/edge probing** for vertical surfaces with layered depth scanning
- **Outline scanning** with configurable path strategies
- **Real-time 3D visualization** using Three.js
- **G-code compensation** for uneven surfaces
- **Advanced error handling** and recovery mechanisms
- **Comprehensive logging** and diagnostics

---

## System Architecture

### File Structure

```
Stand-alone/
├── src-standalone/           # Main source code (shared across all builds)
│   ├── config-header.html    # HTML header and structure
│   ├── config-body.html      # Main UI layout
│   ├── config-footer.html    # HTML footer
│   ├── styles.css            # All CSS styling
│   └── js/                   # JavaScript modules
│       ├── core.js           # Core functions, machine state, commands
│       ├── probe-engine.js   # Surface grid probing engine
│       ├── top-probe.js      # Top surface probe operations
│       ├── face-probe.js     # Vertical face probe operations
│       ├── outline-probe.js  # Outline scanning operations
│       ├── finish-motion.js  # Post-probe positioning
│       ├── visualization.js  # Three.js 3D rendering
│       ├── ui-helpers.js     # UI utilities and helpers
│       ├── settings-and-exports.js  # Settings persistence and data export
│       ├── diagnostics.js    # Debug and diagnostic tools
│       └── layout-editor.js  # Advanced layout configuration
│
├── standalone/               # Transport layers
│   └── src/
│       ├── webserial-transport.js   # USB Serial transport (overrides core.js functions)
│       └── websocket-transport.js   # WebSocket transport (overrides core.js functions)
│
├── build-standalone.sh       # Build script for Web Serial version
├── build-standalone-ws.sh    # Build script for WebSocket version
├── standalone.html           # Generated Web Serial build (DO NOT EDIT)
└── standalone-ws.html        # Generated WebSocket build (DO NOT EDIT)
```

### Module Dependencies

```
core.js (foundation)
  ├── Machine communication (sendCommand, _getState)
  ├── Position tracking (getMachineSnapshot, getWorkPosition)
  ├── Safety systems (stopNowAndSafeHome, ALARM handling)
  └── Settings management

probe-engine.js
  ├── Surface grid calculations
  ├── Probe timing instrumentation
  └── Motion primitives (smSafeLateralMove, smPlungeProbe)

top-probe.js, face-probe.js, outline-probe.js
  ├── Mode-specific probe strategies
  ├── User configuration
  └── Results generation

visualization.js
  ├── Three.js scene management
  ├── Real-time probe visualization
  └── Heatmap/relief rendering

settings-and-exports.js
  ├── LocalStorage persistence
  ├── File import/export (JSON, CSV)
  └── G-code compensation
```

---

## Core Features

### 1. Machine Communication

**Functions:**
- `sendCommand(gcode, timeoutMs)` - Send G-code commands with timeout
- `_getState()` - Query machine status (overridden per transport)
- `getWorkPosition()` - Get current work coordinates
- `getMachineSnapshot()` - Comprehensive machine state snapshot

**Capabilities:**
- Automatic timeout handling (default: 15s, configurable per command)
- Command queue management
- Real-time status polling with adaptive intervals
- Probe state detection via `Pn` flags

**Status Monitoring:**
```javascript
{
  x, y, z,              // Work coordinates
  machineX/Y/Z,         // Machine coordinates (when available)
  status,               // Idle, Run, Hold, Alarm, etc.
  probeTriggered,       // Boolean - probe input state
  homed,                // Boolean - homing status
  feedOverridePct,      // Feed rate override (%)
  rapidOverridePct,     // Rapid rate override (%)
  spindleOverridePct    // Spindle speed override (%)
}
```

### 2. Jogging and Manual Control

**Jog Controls:**
- XY jogging with configurable step sizes (0.1mm to 100mm)
- Z jogging with independent step control
- Feed rate control for XY and Z axes
- Preset step buttons (0.1, 1, 5, 10mm)

**Advanced Motion:**
- `jogToWorkZero()` - Return to work coordinate origin
- `jogRaiseToMachineSafeTop()` - Retract to machine safe Z limit
- `saveCurrentLocation()` / `goToSavedLocation()` - Position bookmarking

**Implementation:**
- Uses `G91` (incremental) + `G1` (linear) for jog moves
- Auto-restores `G90` (absolute) mode after each jog
- Compatible with all GRBL-compatible controllers

### 3. Homing and Preflight Checks

**Preflight Validation:**
```javascript
requireStartupHomingPreflight(runLabel)
```

Checks:
1. ✓ Machine is not in ALARM state
2. ✓ Probe input is open (not triggered)
3. ✓ Machine has been homed after startup
4. ⚠ Warns about non-100% overrides (feed/rapid/spindle)

**Machine Status Panel:**
- Real-time display of homed state, machine status, probe state
- Auto-hide feature (configurable)
- Color-coded status indicators (green = OK, red = ALARM)

---

## Probing Modes

### Mode 1: Surface (Top) Probe

**Purpose:** Creates a 3D height map of a flat or gently sloped surface.

**Configuration:**
- Grid bounds: `minX`, `maxX`, `minY`, `maxY` (work coordinates)
- Grid spacing: `spacingX`, `spacingY` (mm between probe points)
- Clearance Z: Safe travel height above surface
- Max plunge depth: Maximum probe descent per point
- Probe feed rate: Speed during G38.2 probe moves
- Travel feed rate: Speed during G38.3 safe moves

**Probe Strategy:**
1. **Initial Clearance Lift** - Raises Z relative to current position before first point
2. **Serpentine Pattern** - Alternates left-to-right and right-to-left per row to minimize travel
3. **Per-Point Sequence:**
   - Lift Z to absolute clearance height (prevents drift-induced ALARM:4)
   - Safe lateral move to next XY position using G38.3 (backs off if probe triggers)
   - Verify probe is clear (`smEnsureProbeClear`) - raises Z and retries if pre-triggered
   - Plunge probe using G38.2 until contact
   - Record Z contact position
4. **Row Transitions** - Lifts Z, moves to start of next row
5. **Finish Motion** - Retracts to safe Z, optionally returns to X0 Y0

**Travel Contact Recovery:**
- Detects if probe triggers during lateral travel (G38.3 stops short)
- Backs off opposite to travel direction
- Lifts Z by configured amount
- Retries move up to `maxRetries` times (default: 5)

**Output:**
- 2D array of Z heights (null if point was skipped/failed)
- Grid configuration metadata
- Optional mesh subdivision for smoother interpolation
- Timing statistics (per-point, plunge, lateral, waitIdle durations)

### Mode 2: Face (Edge) Probe

**Purpose:** Probes vertical or angled faces/edges, optionally in multiple depth layers.

**Configuration:**
- X range: `xStart` to `xEnd` (horizontal span of face)
- X points: Number of samples (manual or auto-computed from target spacing)
- Auto spacing: Calculates X points from target spacing (e.g., 2mm)
- Y offset: Fixed Y coordinate of face
- Z range: `zStart` (top) to `zEnd` (bottom)
- Z layers: Number of depth layers (1 = single pass, 2+ = layered)
- Top reference mode: `every_column` (probe top at each X) or `endpoints` (linear interpolation)
- Probe feed, travel feed, clearance Z, max depth

**Single-Layer Mode:**
1. Probe top reference Z at each X position (or endpoints only)
2. For each X position:
   - Move to X, lift to top Z + clearance
   - Plunge towards face at configured Y offset
   - Record contact position
3. Generate face mesh with X, Y (contact), Z coordinates

**Layered Mode:**
1. Divide Z range into equal layers (e.g., 3 layers: top, middle, bottom)
2. For each layer depth:
   - Repeat single-layer probe at that Z level
   - Store results separately per layer
3. Merge all layers into unified `layeredFaceResults` array

**Output:**
- Array of face probe points: `[{x, y, z, topZ, sampleCoord}]`
- Layered results (if enabled)
- Face mesh for 3D visualization

### Mode 3: Outline Scan

**Purpose:** Automatically scans perimeter/outline of a workpiece from inside or outside.

**Configuration:**
- Strategy: `inside` (probe outward from center) or `outside` (probe inward from border)
- Reference point: `center` (scan from center) or `corner` (scan from corner)
- Start position: Current machine position or custom X/Y
- Path type: `cross` (4-axis scan) or `square` (8-direction scan)
- Probe step: Distance between probe attempts along each axis
- Max travel: Maximum distance to probe in each direction
- Contact threshold: Multiple contacts required to confirm edge
- Probe/travel feed rates

**Scan Strategy:**

**Inside Mode:**
1. Start from reference point (center or corner)
2. Probe outward along each axis (+X, -X, +Y, -Y)
3. Record first contact position for each direction
4. Build bounding box from contacts
5. Optionally perform follow-up scans along detected edges

**Outside Mode:**
1. Start from border position
2. Probe inward toward expected workpiece
3. Record contact positions
4. Verify contact with threshold check (multiple hits = confirmed edge)

**Output:**
- Bounding box: `{minX, maxX, minY, maxY, width, height, centerX, centerY}`
- Contact points per direction
- Optional: Direct application to surface grid bounds

### Mode 4: Combined (Surface + Face)

**Purpose:** Runs surface probe followed immediately by face probe in a single operation.

**Workflow:**
1. User configures both surface and face settings
2. Clicks "Run Combined Probe"
3. Surface probe executes first
   - `_smSkipFinishMotion = true` (skips retract/home between phases)
   - Sets `_smProbingCompleteCallback` to chain face probe
4. On surface completion:
   - Callback checks success
   - If successful, automatically starts face probe
   - Face probe uses surface results for top reference Z values
5. Face probe completes
6. Merged results displayed in Combined Results tab

**Benefits:**
- Single button click for full 3D scan
- No manual repositioning between phases
- Automatic top-Z reference for face probe
- Unified visualization of combined mesh

---

## Motion Control System

### Movement Primitives

**1. Absolute Move (`moveAbs`)**
```javascript
await moveAbs(x, y, z, feed)
```
- Uses `G90 G1` (absolute positioning + linear interpolation)
- Waits for Idle after command
- 50ms delay to avoid polling pre-move Idle state

**2. Safe Lateral Move (`smSafeLateralMove`)**
```javascript
await smSafeLateralMove(targetX, targetY, travelFeed, clearanceZ)
```
- Lifts Z to **absolute clearance height** (not relative!)
  - Formula: `currentZ + clearanceZ` (e.g., current -5mm + 10mm clearance = +5mm absolute)
  - Prevents accumulated drift that causes ALARM:4 soft limit errors
- Moves X/Y using `G90 G38.3` (probe-safe travel)
- Detects contact during travel, backs off, lifts, retries
- Up to `maxRetries` attempts (default: 5)

**3. Probe Plunge (`smPlungeProbe`)**
```javascript
await smPlungeProbe(maxPlunge, probeFeed)
```
- Pre-flight: `smEnsureProbeClear()` - verifies probe is open, lifts Z if triggered
- Switches to `G91` (relative mode)
- Issues `G38.2 Z-{maxPlunge}` (probe down, error if no contact)
- Switches back to `G90` (absolute mode)
- Detects contact via:
  - Position change (robust when Pn clears on Idle)
  - Probe pin state (`Pn` flag contains 'P')
- Returns contact position with machine coordinates

**4. Finish Motion (`smFinishMotion`)**
```javascript
await smFinishMotion(travelFeed)
```
- Computes safe retract Z: `max(measured surface Z) + clearance offset`
- Retracts Z to safe height (work coordinates)
- Optionally returns XY to work zero (configurable)
- Skipped in combined mode between phases

**5. Machine-Coordinate Move (`moveMachineZAbs`)**
```javascript
await moveMachineZAbs(z, feed)
```
- Uses `G53` (machine coordinate system)
- Bypasses work coordinate offsets
- Used for machine safe top positioning

### Timing and Synchronization

**Wait Strategies:**

**`waitForIdle(fastPoll)`**
- Polls machine status until `Idle`
- Adaptive polling intervals:
  - Fast-poll mode (probe operations): 1ms → 5ms → 10ms → 15ms → 25ms
  - Normal mode (travel): 10ms → 15ms → 25ms
- Maximum: 12,000 polls (~180s total timeout)
- Throws error if ALARM detected

**`waitForIdleWithTimeout(timeoutMs, fastPoll)`**
- Wraps `waitForIdle` with explicit timeout
- Default timeout: 30s
- Fast-poll flag enables 1ms initial polling for probe trigger responsiveness

**Stop-Aware Waiting:**
- `_waitForIdleOrStop(timeoutMs)` - Accepts Hold or Idle when stop requested
- Distinguishes between safety moves (must reach Idle) and user stop (can exit on Hold)

**Command Delays:**
- 20-50ms sleep after `sendCommand()` before `waitForIdle()`
- Prevents polling the "pre-move" Idle state
- Modal commands (G90/G91) execute instantly, no wait needed

---

## Safety Features

### 1. Stop and Emergency Halt

**`stopNowAndSafeHome(reason)`** - Unified stop handler for all probe modes

**Sequence:**
1. **Set Stop Flags** - `_stopRequested`, `smStopFlag`, `_outlineStopFlag`
2. **Feed Hold** - Send `!` real-time command (halts motion ASAP)
3. **Poll for Hold** - Wait up to 1s for status = `Hold`
4. **Clear Queue** - Try ncSender-compatible safe-stop endpoints:
   - `/api/gcode-job/stop` (ncSender job stop)
   - `/api/probe/stop` (probe-op stop)
   - `/api/gcode/stop` (legacy fallback)
   - **Never auto-sends `~` (cycle start)** - only via explicit user button
5. **Poll for Exit Hold** - Wait up to 4s for Hold to clear
6. **If Still in Hold:**
   - Show Hold Warning panel with two buttons:
     - **"Clear Hold (Stop)"** - Calls safe-stop endpoints again
     - **"Resume (~) — UNSAFE fallback"** - Sends `~` only if Stop unavailable
   - Poll at low frequency (500ms) for up to 10 minutes
   - User must manually clear Hold via panel buttons
7. **Safety Moves** (once Hold clears):
   - Set `_safetyMoveActive = true` (prevents `checkStop()` from aborting safety moves)
   - Retract Z to machine safe top (`G53` absolute machine coords)
   - Return to work X0 Y0 (configurable)
   - Clear `_safetyMoveActive = false`

**Double-Stop Protection:**
- `_stopInProgress` guard prevents overlapping stop sequences
- Ignores duplicate stop clicks

**ALARM Detection:**
- Checked at every poll during stop sequence
- If ALARM detected:
  - Skips safety moves
  - Shows ALARM panel with recovery instructions
  - Navigates to Outline tab (Unlock button visible)

### 2. ALARM Recovery

**Machine Status Panel** - Always-visible status display (or auto-hide when OK)

**ALARM State (Red):**
- Status: `⚠ Controller in ALARM — motion locked out`
- Instructions: Click **Unlock ($X)** then **Home ($H)** if required
- Buttons enabled: Unlock, Home

**OK State (Green):**
- Status: `✓ Status: OK — No ALARM`
- Buttons disabled until ALARM detected

**Unlock Workflow (`sendUnlockCommand`)**:
1. Send `$X` to clear ALARM latch
2. Poll for status = Idle (up to 5s)
3. If Idle reached:
   - Automatically call `retrySafetyMoves()`
   - Complete retract/home sequence
   - Hide ALARM panel
4. If timeout:
   - Keep ALARM panel visible
   - Prompt user to Home ($H) if needed

**Guard Against Concurrent Unlocks:**
- `_unlockPollActive` flag prevents double-click issues

### 3. Probe Safety Checks

**Pre-Plunge Verification (`smEnsureProbeClear`)**:
- Checks probe input state before every plunge
- If triggered (pre-contact):
  - Raises Z by `clearanceZ + 2mm`
  - Waits 200ms for probe to clear
  - Retries up to 3 attempts
  - Throws error if probe stuck triggered

**Travel Contact Detection:**
- G38.3 safe moves detect probe trigger mid-travel
- If triggered:
  - Back off opposite to travel direction by `backoff` distance (default: 5mm)
  - Lift Z by `lift` amount (default: 5mm)
  - Wait 120ms settle time
  - Retry move up to `maxRetries` (default: 5)
- Prevents crashes from unexpected obstacles

**Soft Limit Protection:**
- Absolute Z positioning in `smSafeLateralMove` prevents accumulated drift
- Avoids ALARM:4 (soft limit exceeded) after multiple probe points

### 4. Override Warnings

**Non-100% Override Detection:**
- Checks feed, rapid, spindle overrides at preflight
- Logs warnings (non-blocking):
  - "Feed override is 50% — travel will be slower than commanded."
  - "Rapid override is 80%."
  - "Spindle override is 150%."
- Updates override callouts near Run buttons

**Live Override Display:**
- Real-time callouts: `Overrides: Feed 100%  Rapid 100%  Spindle 100%`
- Amber text for non-default values
- Updated on every `getMachineSnapshot()`

---

## Data Management

### 1. LocalStorage Persistence

**Stored Data:**
- **Settings:**
  - Probe dimensions (`PROBE_DIMENSIONS_KEY`)
  - Surface grid config (`SM_SURFACE_GRID_SETTINGS_KEY`)
  - Jog step presets
  - Panel-specific settings (via `data-persist` attribute)
- **Results:**
  - Top probe results (`TOP_RESULTS_KEY`)
  - Face probe results (`FACE_RESULTS_KEY`, `FACE_LAYERED_RESULTS_KEY`)
  - Surface mesh (`SM_MESH_KEY`)
  - Face mesh (`FACE_MESH_STORAGE_KEY`)
  - Combined mesh (`MESH_STORAGE_KEY`)
- **Position:**
  - Saved location (`SAVED_LOCATION_KEY`)
- **Logs:**
  - Face probe log (`FACE_LOG_KEY`)

**Panel Settings API:**
```javascript
savePanelSettings(panelId)
loadPanelSettings(panelId)
clearPanelSettings(panelId)
```
- Auto-saves all inputs with `data-persist` attribute
- Excludes inputs with `data-no-persist="1"`
- Storage key: `edgeProbePanel.{inputId}`

### 2. File Import/Export

**Mesh Export Formats:**

**JSON Export (`saveMeshToStorage`)**:
```json
{
  "pluginId": "com.ncsender.edgeprobe.combined",
  "pluginVersion": "V21.0",
  "version": "1.7.0",
  "timestamp": "2026-05-03T18:30:00.000Z",
  "gridConfig": {
    "minX": 0, "maxX": 100,
    "minY": 0, "maxY": 100,
    "colSpacing": 5, "rowSpacing": 5,
    "colCount": 21, "rowCount": 21
  },
  "meshData": [[z00, z01, ...], [z10, z11, ...], ...],
  "topResults": [...],
  "faceResults": [...]
}
```

**CSV Export (`exportSurfaceMeshCSV`, `exportCombinedMeshCSV`)**:
```csv
Index,X,Y,Z,Source
1,0.000,0.000,-5.234,surface
2,5.000,0.000,-5.189,surface
...
```

**File Picker Integration:**
- Uses `window.showSaveFilePicker()` (Chromium-based browsers) for OS-native save dialog
- Falls back to blob download for other browsers
- Suggested filenames: `edge-probe-results-YYYY-MM-DD.json`
- Also saves to localStorage as backup

**Import:**
- `loadMeshFromFile()` - JSON file picker
- `importSurfaceMesh()` - JSON import with validation
- Restores grid config and all probe results

### 3. G-code Compensation

**Surface Mesh Compensation (`applyCompensationSurface`)**:

**Algorithm:**
1. Parse original G-code line-by-line
2. For each `G0` or `G1` line:
   - Extract X, Y, Z coordinates
   - If within mesh bounds:
     - Bilinear interpolate Z offset from mesh
     - Add offset to original Z
     - Replace Z value in line
3. Preserve all other lines unchanged (comments, M-codes, etc.)

**Face Mesh Compensation (`applyCompensationFace`)**:
- Similar to surface, but uses face probe results
- Interpolates Y offset based on X position and Z height

**Bilinear Interpolation:**
```javascript
bilinearInterpolateZ(meshData, gridConfig, x, y)
```
- Finds enclosing grid cell
- Computes weights for 4 corner points
- Returns interpolated Z value (or null if out of bounds)

**Mesh Subdivision:**
- `subdivideSurfaceMesh(grid, config, spacing)` - Adds interpolated points between original grid
- Spacing 0 = disabled (use original grid)
- Spacing 2mm = 2mm between subdivided points
- Produces smoother compensation surfaces

**Apply Tab Workflow:**
1. Load G-code from file (`apply-gcode-file-input`)
2. Select mesh source: Surface, Face, or Combined
3. Choose compensation mode: Surface Z adjustment or Face Y offset
4. Click "Compensate G-code"
5. Preview original vs. compensated (line count, coordinate stats)
6. Send to ncSender job queue (plugin mode) or direct to machine (standalone)

---

## Visualization System

### Three.js 3D Rendering

**Architecture:**

**State Management (`_threeState`):**
```javascript
{
  'sm':      { scene, camera, renderer, controls, mesh, ... },  // Surface mesh viz
  'res':     { ... },  // Results tab surface 3D view
  'surf':    { ... },  // Surface mesh tab 3D view
  'face':    { ... },  // Face mesh 3D view
  'resface': { ... },  // Results tab face 3D view
  'comb':    { ... },  // Combined mesh 3D view
  'relief':  { ... }   // Relief 2D/3D view
}
```

**Scene Components:**
- **Scene** - Three.js container
- **Camera** - Perspective camera with auto-aspect
- **Renderer** - WebGL renderer
- **Controls** - OrbitControls for mouse interaction
- **Lights** - Hemisphere + directional lights
- **Meshes** - Geometry + material (wireframe, solid, points)
- **Helpers** - Axes, grid, bounding box

**Initialization (`_threeInit`):**
1. Create scene, camera, lights
2. Attach renderer to target div canvas
3. Configure OrbitControls (zoom, pan, rotate)
4. Start animation loop (`_threeAnimate`)

**Cleanup (`_threeDispose`):**
- Stops animation loop
- Disposes geometry, materials, textures
- Removes renderer canvas from DOM
- Clears state object

### Live Probe Visualization

**Real-Time Updates (`smPvizUpdate`)**:

**States:**
- `traveling` - Show blue sphere at next target position
- `plunging` - Pulsing orange sphere during probe descent
- `contact` - Green sphere at contact point, add to trail
- `error` - Red indicator
- `complete` - Final state, all points visible

**Progress Display:**
- Point counter: "125 / 441 (28%)"
- Status text: "Traveling...", "Probing...", "Contact!", "Complete"
- Percentage bar
- Action label (e.g., "Row transition...")

**Probe Sequence Recording:**
- `smPvizProbeSequence` - Array of `{x, y, z, t}` (position + timestamp)
- Used for replay visualization
- Exportable as HTML replay file (`smSaveReplayHtml`)

### Heatmap and Relief Rendering

**2D Heatmap (`_render2DHeatmap`):**
- Canvas-based color gradient from min to max Z
- Color scale: blue (low) → green → yellow → red (high)
- Drawn to `<canvas>` element per mesh type

**3D Relief (`_renderRelief3D`):**
- Converts heatmap to Three.js PlaneGeometry with height offsets
- Applies same color scale to vertex colors
- Lit from above for depth perception

**Mesh Export:**
- Heatmap images saved as PNG
- 3D view snapshots via renderer.toDataURL

---

## Build System

### Build Scripts

**`build-standalone.sh`** - Web Serial version
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

**`build-standalone-ws.sh`** - WebSocket version
- Identical to above, but uses `websocket-transport.js` instead of `webserial-transport.js`

**Function Override Pattern:**
- Transport files are appended AFTER core.js
- JavaScript last-wins resolution silently replaces functions:
  - `sendCommand()`
  - `_getState()`
  - `_trySafeStopEndpoints()`
  - `requireStartupHomingPreflight()`
- All other code (probe logic, UI, viz) remains identical

**IMPORTANT:**
- **Never edit `standalone.html` or `standalone-ws.html` directly**
- Edit source files in `src-standalone/` or `standalone/src/`
- Re-run build script to regenerate HTML

### Transport Layers

**Web Serial (`webserial-transport.js`):**
- Connects to GRBL via USB using Web Serial API
- Baud rate selector (115200, 230400, 57600, 38400)
- Ctrl-X soft reset on connect
- Real-time '!' feed-hold support
- Status query via '?' real-time command
- FIFO response queues for 'ok' and '<...>' status

**WebSocket (`websocket-transport.js`):**
- Connects to FluidNC, grblHAL, Smoothieware via network
- Configurable host IP and port (saved to localStorage)
- Text-based WebSocket protocol
- Same FIFO queue pattern as Web Serial
- Mini console ring buffer (last 500 lines)
- WCS tracking (G54, G55, etc.)

**Shared Interface:**
Both transports implement:
```javascript
async function sendCommand(gcode, timeoutMs)
async function _getState()
async function _trySafeStopEndpoints(label)
async function requireStartupHomingPreflight(runLabel)
```

---

## Configuration and Settings

### Probe Configuration

**Surface Probe Settings:**
- Grid bounds: `sm-minX`, `sm-maxX`, `sm-minY`, `sm-maxY`
- Grid spacing: `sm-spacingX`, `sm-spacingY`
- Clearance Z: `sm-clearanceZ` (safe travel height above surface)
- Max plunge: `sm-maxPlunge` (maximum probe descent)
- Probe feed: `sm-probeFeed` (G38.2 feed rate)
- Travel feed: `sm-travelFeed` (G38.3 / G1 feed rate)
- Mesh subdivision spacing: `meshSubdivisionSpacing` (0 = off, 2mm = dense)

**Face Probe Settings:**
- X range: `fp-xStart`, `fp-xEnd`
- X points: `fp-xPoints` (manual) or auto-computed from `fp-xTargetSpacing`
- Auto spacing toggle: `fp-xAutoSpacing`
- Y offset: `fp-yOffset` (fixed Y of face)
- Z range: `fp-zStart`, `fp-zEnd`
- Z layers: `faceLayerCount` (1 = single, 2+ = layered)
- Top reference mode: `fp-topRefMode` (every_column / endpoints)
- Probe feed, travel feed, clearance Z, max depth

**Outline Scan Settings:**
- Strategy: `outline-strategy` (inside / outside)
- Reference: `outline-reference` (center / corner)
- Path type: `outline-path-type` (cross / square)
- Probe step: `outline-probe-step` (distance between probes)
- Max travel: `outline-max-travel` (per axis)
- Contact threshold: `outline-contact-threshold` (multiple hits to confirm)

**Travel Contact Recovery:**
- Backoff distance: `travelContactBackoff` (5mm default)
- Lift amount: `travelContactLift` (5mm default)
- Max retries: `travelContactMaxRetries` (5 default)

### Machine Settings

**Jog Settings:**
- XY step: `jogStepXY` (1mm default)
- Z step: `jogStepZ` (2mm default)
- XY feed: `jogFeedXY` (600 mm/min default)
- Z feed: `jogFeedZ` (300 mm/min default)

**Machine Limits:**
- Machine safe top Z: `machineSafeTopZ` (absolute machine coordinate, e.g., -1mm)
- Use machine-home Z retract: `useMachineHomeRetract` (checkbox)

**Finish Motion:**
- Finish home Z: `finishHomeZ` (clearance above max measured surface)
- Return to XY zero: `returnToXYZero` (checkbox)

**Probe Dimensions:**
- Shank diameter: `probeShankDiameter`
- Body diameter: `probeBodyDiameter`
- Upper height: `probeUpperHeight`
- Main body height: `probeMainBodyHeight`
- Stylus length: `probeStylusLength`
- Stylus callout length: `probeStylusCalloutLength`
- Ball tip diameter: `probeBallTipDiameter`
- Total length: `probeTotalLength` (auto-computed)

**Auto-Hide Status Panel:**
- `autoHideStatusPanel` - Hides Machine Status panel when status = OK

### Debug and Diagnostics

**Debug Mode:**
- Checkbox: `debugLogCheckbox`
- Enables `pluginDebug()` output to probe logs
- All debug messages prefixed with `[PLUGIN DEBUG]`
- Color-coded in log: gray text

**Timing Instrumentation:**
- Enabled during surface probe runs
- Tracks:
  - Per-point duration (ms)
  - Probe plunge time (avg, min, max)
  - Z-lift time
  - Lateral move time
  - waitForIdle calls and duration
  - Pre-trigger events (probe stuck triggered)
  - Travel contact events
  - Finish motion time
- Emits summary at end of run:
```
[TIMING] ══════════════════════════════════════════════
[TIMING] Surface probe run COMPLETE — 441 pts in 287.3s
[TIMING] Per-point    : 441 pts · avg=651ms  min=523ms  max=1205ms
[TIMING] Probe plunges: 441 · avg=234ms  min=187ms  max=456ms  total=103254ms
...
[TIMING] JSON: {"outcome":"COMPLETE","totalMs":287342,...}
```

---

## API and Integration

### ncSender Plugin API (Fetch-Based)

**Endpoints:**

**Send Command:**
```javascript
POST /api/send-command
{
  "command": "G1 X10 Y20 F600",
  "meta": {
    "sourceId": "plugin",
    "plugin": "com.ncsender.edgeprobe.combined"
  }
}

Response:
{
  "success": true
}
// or
{
  "error": "Machine in alarm state"
}
```

**Get Server State:**
```javascript
GET /api/server-state

Response:
{
  "machineState": {
    "status": "Idle",
    "WPos": "10.000,20.000,5.000",
    "MPos": "-50.000,-30.000,5.000",
    "WCO": "-60.000,-50.000,0.000",
    "Pn": "",  // or "P" if probe triggered
    "isHomed": true,
    "feedrateOverride": 100,
    "rapidOverride": 100,
    "spindleOverride": 100
  }
}
```

**Safe Stop Endpoints:**
```javascript
POST /api/gcode-job/stop   // Job stop (clears queue)
POST /api/probe/stop       // Probe stop
POST /api/gcode/stop       // Legacy fallback
```

### Standalone Mode APIs

**Web Serial:**
- `navigator.serial.requestPort()` - Prompt user for serial port
- `port.open({ baudRate })` - Open serial connection
- `port.writable.getWriter()` - Get write stream
- `port.readable.getReader()` - Get read stream
- Real-time commands sent as raw bytes: `0x21` (!) for feed-hold

**WebSocket:**
- `new WebSocket('ws://HOST:PORT/ws')` - Connect to controller
- `ws.send('G1 X10\n')` - Send text commands
- `ws.onmessage` - Receive status reports and 'ok' responses

### Plugin Event Handling

**Lifecycle:**
- `pluginCleanupOnClose()` - Called when plugin panel closes
  - Clears in-memory logs and results
  - Removes localStorage probe results
  - Disposes Three.js resources
  - **Does NOT send machine commands** (no disconnect)

**Hook Integration:**
- User-defined hooks can intercept tool calls via settings
- Feedback from hooks treated as user input
- Blocked operations logged and handled gracefully

---

## Usage Guidelines

### Quick Start

**Plugin Mode (ncSender):**
1. Install plugin in ncSender
2. Ensure machine is homed
3. Jog to probe start position
4. Configure probe settings (grid, feeds, clearance)
5. Click "Run Surface Probe" or other mode
6. Monitor live visualization
7. Export results or apply compensation

**Standalone Mode (Web Serial):**
1. Open `standalone.html` in Chrome/Edge
2. Click "Connect Serial", select USB port
3. Controller auto-resets (Ctrl-X)
4. Same workflow as plugin mode

**Standalone Mode (WebSocket):**
1. Open `standalone-ws.html` in any browser
2. Enter controller IP and port (default: 192.168.5.1:81)
3. Click "Connect"
4. Same workflow as plugin mode

### Best Practices

**Before Probing:**
- ✓ Home machine (`$H`)
- ✓ Jog to start position (e.g., corner of workpiece)
- ✓ Zero work coordinates (`G10 L20 P0 X0 Y0 Z0`)
- ✓ Test probe trigger by hand (should show "Triggered" in status)
- ✓ Verify clearance Z is above highest surface point
- ✓ Start with small grid (e.g., 5x5) to test settings

**During Probing:**
- ✓ Monitor live visualization for anomalies
- ✓ Watch for pre-trigger events (probe clearing)
- ✓ Check log for travel contact warnings
- ✓ Stop immediately if probe misses surface (sounds wrong)

**After Probing:**
- ✓ Review Results tab for outliers
- ✓ Export mesh to file (backup before applying compensation)
- ✓ Test compensated G-code on air cuts first
- ✓ Adjust compensation Z offset if needed

**Troubleshooting:**

**ALARM:4 (Soft Limit Exceeded):**
- Cause: Z-axis accumulated drift from relative positioning
- Fix: Code now uses absolute Z positioning in `smSafeLateralMove` (fixed in PR #23)
- Verify: Check `machineSafeTopZ` setting is within machine limits

**Probe Pre-Triggered:**
- Cause: Probe still touching surface before plunge
- Fix: Increase clearance Z, reduce probe step
- Automatic: `smEnsureProbeClear` lifts and retries

**Travel Contact:**
- Cause: Probe hits obstacle during lateral move
- Fix: Increase clearance Z, reduce grid size
- Automatic: Backs off, lifts, retries up to 5 times

**No Contact Within Max Plunge:**
- Cause: Surface lower than expected, or probe missed
- Fix: Increase max plunge depth, verify probe wiring
- Check: Surface height at current XY before starting

---

## Future Development

### Planned Features (from code comments/TODOs)
- Enhanced mesh subdivision algorithms
- Multi-WCS support (auto G54/G55 selection)
- Probe wear compensation
- Thermal drift compensation
- Advanced path optimization (TSP solver for probe order)

### Known Limitations
- GRBL does not expose homed state flag (workaround: manual verification)
- Web Serial requires Chromium-based browser
- LocalStorage 10MB limit (large meshes may exceed)
- No direct machine control in WebSocket mode (send only)

---

## License and Credits

**Author:** Badgerk1
**Plugin ID:** `com.ncsender.edgeprobe.combined`
**Version:** V21.0

**Technologies:**
- Three.js (3D visualization)
- GRBL protocol (machine control)
- Web Serial API (USB connection)
- WebSocket (network connection)
- ncSender plugin API (fetch-based integration)

**Repository:** [Badgerk1/Stand-alone](https://github.com/Badgerk1/Stand-alone)

---

*This documentation is auto-generated from codebase analysis. For specific implementation details, refer to source files in `src-standalone/js/`.*
