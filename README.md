# Stand-alone

**Web-based 3D Live Edge Probe for GRBL-compatible CNC machines**

A comprehensive probing application that provides advanced 3D surface and edge probing capabilities. Runs as a Sender plugin, or standalone via USB (Web Serial) or network (WebSocket).

---

## Features

- **3D Surface Probing** - Automatic mesh generation with serpentine scanning pattern
- **Face/Edge Probing** - Vertical surface mapping with optional layered depth scanning
- **Outline Scanning** - Automatic workpiece perimeter detection (inside/outside strategies)
- **Combined Mode** - Surface + Face probing in a single operation
- **Real-time 3D Visualization** - Three.js-based live probe visualization
- **G-code Compensation** - Adjust toolpaths for uneven surfaces
- **Multiple Connection Modes** - Plugin (Sender), USB Serial, or Network (WebSocket)
- **Advanced Safety** - ALARM recovery, feed hold, probe trigger validation
- **Data Management** - Export/import results as JSON or CSV

---

## Quick Start

### Plugin Mode (Sender)
1. Install plugin in Sender
2. Open "3D Live Edge Probe" panel
3. Jog to start position, configure settings
4. Click "Run Surface Probe"

### Standalone Mode (USB Serial)
1. Open `standalone.html` in Chrome or Edge
2. Click "Connect Serial", select port
3. Configure settings, click "Run Surface Probe"

### Standalone Mode (Network)
1. Open `standalone-ws.html` in any browser
2. Enter controller IP and port (e.g., 192.168.5.1:81)
3. Click "Connect", configure settings
4. Click "Run Surface Probe"

---

## Documentation

Comprehensive documentation is available in the following files:

### 🤖 [AUTOMATION.md](./AUTOMATION.md)
**Automated version management system:**
- Auto-increments beta version on every merge to main
- Updates all files and rebuilds automatically
- No manual version bumps needed!

### 📘 [FUNCTIONALITY.md](./FUNCTIONALITY.md)
Complete guide to all features, modes, and capabilities:
- System architecture and module structure
- Probing modes (Surface, Face, Outline, Combined)
- Motion control system and primitives
- Safety features and ALARM recovery
- Data management and export formats
- Visualization system (3D, heatmaps, relief)
- Build system and configuration
- API and integration details

### 🔧 [PR_FIXES_HISTORY.md](./PR_FIXES_HISTORY.md)
**Critical for AI assistants working on this codebase!**
- Documented PR fixes and tested solutions
- Root cause analysis for major bugs
- Before/after comparisons with test data
- Patterns that work vs. things that didn't work
- Testing checklist for new features
- Contributing guidelines

**Key fixes documented:**
- PR #23: ALARM:4 soft limit fix (absolute Z positioning)
- PR #22: Fast-poll mode for probe trigger response
- General patterns and best practices
- Known working solutions
- Things that did NOT work (avoid repeating mistakes)

### 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
Technical architecture and design decisions:
- High-level system layers
- Module structure and responsibilities
- Data flow diagrams
- State management patterns
- Communication architecture (transport abstraction)
- Build system architecture
- UI component structure
- Extension points for adding features

---

## Building

Edit source files in `src-standalone/` or `standalone/src/`, then rebuild:

```bash
# Web Serial version (USB)
bash build-standalone.sh

# WebSocket version (network)
bash build-standalone-ws.sh
```

**⚠️ Never edit `standalone.html` or `standalone-ws.html` directly** - your changes will be overwritten by the build scripts.

---

## Testing

This project includes comprehensive automated tests using Jest.

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Coverage

Current test coverage includes:
- ✅ Core module (state management, position parsing, ALARM detection)
- ✅ Probe engine (grid calculations, serpentine paths, interpolation)
- ✅ Settings & exports (CSV/JSON export, G-code parsing, validation)
- 🚧 Integration tests (coming soon)
- 🚧 Transport layer tests (coming soon)

See **[TESTING.md](./TESTING.md)** for complete testing documentation, writing tests, and contributing guidelines.

---

## Requirements

- **Browser:** Chrome, Edge, or Chromium-based (Web Serial requires Chromium)
- **Controller:** GRBL 1.1+ compatible (GRBL, FluidNC, grblHAL, Smoothieware)
- **Machine:** Homed CNC with probe input configured
- **Probe:** Touch probe or edge finder with normally-open trigger

---

## System Requirements

### For Plugin Mode
- Sender installed and running
- GRBL-compatible controller connected via USB

### For Standalone USB Mode
- Chrome or Edge 89+ (Web Serial API required)
- Direct USB connection to GRBL controller

### For Standalone Network Mode
- Any modern browser
- Network-enabled controller (FluidNC, grblHAL, etc.)
- Controller accessible via WebSocket (default port: 81)

---

## Project Structure

```
Stand-alone/
├── src-standalone/           # Main source code (shared)
│   ├── config-*.html         # HTML structure
│   ├── styles.css            # All styling
│   └── js/                   # JavaScript modules
│       ├── core.js           # Machine communication, state
│       ├── probe-engine.js   # Surface grid probing
│       ├── top-probe.js      # Top surface operations
│       ├── face-probe.js     # Face/edge operations
│       ├── outline-probe.js  # Outline scanning
│       ├── finish-motion.js  # Post-probe positioning
│       ├── visualization.js  # Three.js rendering
│       └── ...               # Other modules
│
├── standalone/               # Transport layers
│   └── src/
│       ├── webserial-transport.js   # USB Serial
│       └── websocket-transport.js   # Network
│
├── build-standalone.sh       # Build Web Serial version
├── build-standalone-ws.sh    # Build WebSocket version
├── standalone.html           # Generated USB build
├── standalone-ws.html        # Generated network build
│
└── Documentation/
    ├── FUNCTIONALITY.md      # Complete feature guide
    ├── PR_FIXES_HISTORY.md   # Fixes, solutions, testing
    └── ARCHITECTURE.md       # Technical architecture
```

---

## Usage Examples

### Surface Probe
1. **Setup:** Jog to corner of workpiece, zero work coordinates
2. **Configure:** Set grid bounds (minX, maxX, minY, maxY) and spacing
3. **Run:** Click "Run Surface Probe"
4. **Export:** Save mesh as JSON or CSV
5. **Apply:** Load G-code, apply compensation, send to machine

### Face Probe
1. **Setup:** Jog to face location, zero work coordinates
2. **Configure:** Set X range, Y offset, Z range, layer count
3. **Run:** Click "Run Face Probe"
4. **Visualize:** View 3D face mesh in Results tab
5. **Export:** Save face results for later use

### Outline Scan
1. **Setup:** Jog to starting position (center or corner)
2. **Configure:** Strategy (inside/outside), max travel, probe step
3. **Run:** Click "Run Outline Scan"
4. **Apply:** Auto-populate surface grid bounds from detected outline

### Combined Probe
1. **Configure:** Both surface and face settings
2. **Run:** Click "Run Combined Probe"
3. **Automatic:** Surface probe → Face probe (no manual repositioning)
4. **Result:** Unified 3D model of surface + face

---

## Safety Features

- **Preflight Checks:** Validates homed, probe clear, no ALARM
- **ALARM Recovery:** Automatic unlock + retry safety moves
- **Feed Hold:** Immediate stop with queue clearing
- **Probe Validation:** Pre-plunge checks with auto-clear
- **Travel Contact Detection:** Backs off and retries on obstacles
- **Soft Limit Protection:** Absolute positioning prevents drift
- **Emergency Stop:** Feed hold + safety retract to X0 Y0 Z-safe

---

## Troubleshooting

### ALARM:4 (Soft Limit Exceeded)
- **Cause:** Z-axis drift from accumulated rounding errors
- **Fix:** Now uses absolute Z positioning (fixed in PR #23)
- **Verify:** Check `machineSafeTopZ` is within machine limits

### Probe Pre-Triggered
- **Cause:** Probe touching surface before plunge
- **Fix:** Increase clearance Z, or reduce probe step
- **Automatic:** `smEnsureProbeClear` lifts and retries up to 3 times

### No Contact Within Max Plunge
- **Cause:** Surface lower than expected, or probe wiring issue
- **Fix:** Increase max plunge depth, verify probe connection

### Travel Contact
- **Cause:** Obstacle during lateral move
- **Fix:** Increase clearance Z, reduce grid bounds
- **Automatic:** Backs off, lifts, retries up to 5 times

See **[PR_FIXES_HISTORY.md](./PR_FIXES_HISTORY.md)** for detailed troubleshooting and tested solutions.

---

## Performance

Typical probe times (21x21 grid = 441 points):
- **Surface probe:** ~4-8 minutes (depends on probe feed, clearance Z)
- **Face probe:** ~2-5 minutes (depends on X points, Z layers)
- **Combined:** ~6-13 minutes (surface + face, no manual repositioning)

Factors affecting speed:
- Probe feed rate (slower = more accurate, but slower)
- Clearance Z height (higher = more travel time)
- Grid spacing (tighter = more points)
- Travel contact recovery (adds 2-5s per recovery)

---

## Contributing

When contributing to this project:

1. **Read Documentation First:**
   - Review [FUNCTIONALITY.md](./FUNCTIONALITY.md) for feature details
   - Check [PR_FIXES_HISTORY.md](./PR_FIXES_HISTORY.md) for known issues/solutions
   - Study [ARCHITECTURE.md](./ARCHITECTURE.md) for design patterns

2. **Follow Established Patterns:**
   - Use absolute positioning for repeated moves
   - Use fast-poll mode for probe operations
   - Implement proper error handling and recovery
   - Add timing instrumentation for performance-critical code

3. **Test Thoroughly:**
   - Small grid (5x5) for quick validation
   - Large grid (21x21+) to catch accumulation errors
   - ALARM recovery scenarios
   - Multiple connection modes (plugin, USB, network)

4. **Update Documentation:**
   - Add new features to FUNCTIONALITY.md
   - Document fixes in PR_FIXES_HISTORY.md
   - Update architecture diagrams if structure changes

5. **Build and Verify:**
   - Run both build scripts
   - Test generated HTML files
   - Verify function overrides work correctly

---

## License

MIT License - see repository for details

---

## Version

**Current:** Beta V1
**Last Updated:** 2026-05-10

---

## Support

- **Issues:** [GitHub Issues](https://github.com/Badgerk1/Stand-alone/issues)
- **Documentation:** See FUNCTIONALITY.md, PR_FIXES_HISTORY.md, ARCHITECTURE.md
- **Forum:** (Add link if applicable)

---

*For AI assistants: Please read [PR_FIXES_HISTORY.md](./PR_FIXES_HISTORY.md) before making changes to understand what has been tried, what works, and what doesn't work.*
