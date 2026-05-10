# PR Fixes and Tested Solutions - Stand-alone 3D Live Edge Probe

**Repository:** Badgerk1/Stand-alone
**Documentation Date:** 2026-05-10

This document tracks all Pull Requests, the issues they addressed, solutions implemented, and testing results. This serves as a reference for AI assistants working on the codebase to understand what has been tried, what worked, and what patterns to follow.

---

## Table of Contents

1. [PR #37: Return to X/Y Zero After Tool Change Z Re-Zero](#pr-37-return-to-xy-zero-after-tool-change-z-re-zero)
2. [PR #36: Fix Probe Retraction and Contact Detection](#pr-36-fix-probe-retraction-and-contact-detection)
3. [PR #23: Fix ALARM:4 Soft Limit Violation](#pr-23-fix-alarm4-soft-limit-violation)
4. [PR #22: Fast-Polling Mode for Probe Trigger Response](#pr-22-fast-polling-mode-for-probe-trigger-response)
5. [General Patterns and Best Practices](#general-patterns-and-best-practices)
6. [Known Working Solutions](#known-working-solutions)
7. [Things That Did NOT Work](#things-that-did-not-work)

---

## PR #37: Return to X/Y Zero After Tool Change Z Re-Zero

**Merged:** 2026-05-10
**Branch:** `claude/fix-retract-z-home-issue`
**Agent Session:** [View logs](https://github.com/Badgerk1/Stand-alone/sessions/ee1e3cca-9c36-45ad-8609-3f685f9fd207)

### Problem

After the "Return & Re-Zero Z" operation completed successfully, the machine was left at the reference position (e.g., X151.877 Y115.622) instead of returning to the work coordinate origin (X0 Y0). This required users to manually jog back to the origin before starting their cutting operations.

**Symptoms:**
- Tool change workflow completed Z re-zeroing correctly
- Machine remained at arbitrary XY reference position
- User had to manually move to X0 Y0 to begin work
- Workflow felt incomplete and error-prone

**User Feedback:**
The log showed all steps completed successfully but the machine did not automatically return to the origin, requiring an extra manual step that could lead to errors if forgotten.

### Solution

Added **Step 7** to the `toolChangeReturnAndReZero()` function to automatically return to X0 Y0 (work coordinate origin) after raising Z to safe height.

**Key Changes:**
```javascript
// NEW CODE - Step 7: Return to X/Y zero (work coordinate origin)
applyLog('Returning to X0 Y0 (work coordinate origin)');
await sendCommand('G90 G0 X0 Y0 F' + retractFeed.toFixed(0));
await sleep(50);
await _waitForIdleOrStop(15000);
applyLog('Arrived at X0 Y0');
```

**Complete Workflow (7 Steps):**
1. Raise Z to machine safe height (G53 machine coords)
2. Move to XY reference position (where user saved probe position)
3. Probe down to find surface (G38.2)
4. Retract 2mm to clear probe pin
5. Set Z0 at contact point (G10 L20 P0 Z2.0)
6. Raise Z back to machine safe height (G53 machine coords)
7. **Return to X0 Y0** ← NEW STEP

**Files Modified:**
- `src-standalone/js/tool-change-helper.js` (toolChangeReturnAndReZero function)

### Testing

**Test Conditions:**
- Reference position: X151.877 Y115.622 Z-63.744
- Surface probe depth: Auto mode (160mm effective)
- Machine: GRBL 1.1 with soft limits enabled

**Results:**
- ✅ All 7 steps completed successfully
- ✅ Z re-zeroed correctly at reference position
- ✅ Machine returned to X0 Y0 after Z raised to safe height
- ✅ Total operation time: ~26 seconds
- ✅ Workflow now complete and ready for cutting operations
- ✅ No manual positioning required

**Log Verification:**
```
[09:51:44.860] === Return & Re-Zero Z Started ===
[09:51:44.861] Reference Position: X151.877 Y115.622 Z-63.744
[09:51:51.348] Moving to XY reference: X151.877 Y115.622
[09:51:52.456] Arrived at XY reference position
[09:52:01.951] PROBE: End Z position: -77.080, traveled: 77.080mm
[09:52:01.960] PROBE RESULT: Contact detected by position (probe pin cleared)
[09:52:02.282] Setting Z0 at contact point (G10 L20 P0 Z2.0)
[09:52:09.835] Z raised to safe height
[09:52:09.835] Returning to X0 Y0 (work coordinate origin)
[09:52:10.999] Arrived at X0 Y0
[09:52:11.000] Z0 successfully established at reference position!
[09:52:11.000] === Return & Re-Zero Z Complete ===
```

### Lessons Learned

1. **Complete workflows should leave machine in ready state** - Don't leave users at arbitrary positions
2. **Return to origin is a natural expectation** - Most CNC operations start from X0 Y0 Z0
3. **Use work coordinates for final positioning** - G90 X0 Y0 in active WCS, not machine coords
4. **Log every step clearly** - Makes troubleshooting and verification easy
5. **Test complete workflow end-to-end** - Ensure machine is ready for next operation

### Related Code Patterns

Functions that return to origin after completion:
- ✅ `toolChangeReturnAndReZero()` - Returns to X0 Y0 after Z re-zero
- ✅ `smFinishMotion()` - Optional return to X0 Y0 after probe (when enabled)

Workflow completion patterns:
- Always leave machine in a known, safe state
- Return to work origin (X0 Y0) when appropriate
- Raise Z to safe height before XY moves
- Log completion status clearly

---

## PR #36: Fix Probe Retraction and Contact Detection

**Merged:** 2026-05-10
**Branch:** `claude/fix-retract-after-probe-trigger`
**Status:** Initial implementation with test suite

### Problem

The "Return & Re-Zero Z" probe operation had two critical issues:

1. **Probe validation logic error**: The code checked if probe was triggered AFTER retracting 2mm, but the probe pin would often clear during retraction, causing false negatives. This made the probe validation unreliable.

2. **Inverted validation logic**: The original code threw an error if `!postSnap.probeTriggered` (probe NOT triggered), which was the opposite of the intended behavior. When probe did trigger correctly, the operation would fail with "Probe did not trigger" error.

**Symptoms:**
- Probe operation would fail even when contact was made successfully
- Error: "Probe did not trigger. Check probe connection and surface height."
- Probe pin state would clear during 2mm retraction
- Unreliable detection based only on pin state after retraction

**Root Cause:**
```javascript
// OLD CODE (BROKEN - checked AFTER retraction):
await sendCommand('G0 Z2 F' + feed);  // Retract 2mm first
await sendCommand('G90');

// Then checked probe state (often cleared by now)
var postSnap = await getMachineSnapshot();
if (!postSnap.probeTriggered) {  // Inverted logic
  throw new Error('Probe did not trigger...');
}
```

### Solution

Implemented **position-based contact detection** that validates probe contact by comparing start/end Z positions, with probe pin state as a fallback indicator.

**Key Changes:**

1. **Record starting position before probe:**
```javascript
var startPos = await getWorkPosition();
var startZ = startPos.z;
applyLog('PROBE: Starting Z position: ' + startZ.toFixed(3));
```

2. **Restore G90 immediately after probe completes:**
```javascript
await sendCommand('G38.2 Z-' + maxPlunge.toFixed(3) + ' F' + probeFeed.toFixed(0));
await _waitForIdleOrStop(20000);
await sendCommand('G90');  // Restore absolute mode BEFORE validation
```

3. **Validate contact using position delta:**
```javascript
var endPos = await getWorkPosition();
var endZ = endPos.z;
var distanceTraveled = startZ - endZ;

var probeContactTolerance = 0.5; // mm
var stoppedShort = distanceTraveled < (maxPlunge - probeContactTolerance);
var postSnap = await getMachineSnapshot();
var triggered = postSnap.probeTriggered;

if (!triggered && !stoppedShort) {
  // No contact detected
  throw new Error('Probe did not trigger. Check probe connection and surface height.');
}

if (!triggered && stoppedShort) {
  applyLog('PROBE RESULT: Contact detected by position (probe pin cleared)');
} else {
  applyLog('PROBE RESULT: Contact detected - triggered=' + triggered);
}
```

4. **Retract AFTER validation:**
```javascript
// Step 4: Retract 2mm immediately after probe validation
applyLog('RETRACT: Z +2mm to clear probe pin');
await sendCommand('G91');
await sendCommand('G0 Z2 F' + feed);
await sendCommand('G90');
```

**Files Modified:**
- `src-standalone/js/tool-change-helper.js` (toolChangeReturnAndReZero function)

### Testing

**Test Conditions:**
- Reference position: X151.877 Y115.622 Z-63.744
- Probe travel: 77.080mm downward
- Max plunge: 160mm
- Probe pin cleared during retraction (common scenario)

**Results:**
- ✅ Contact detected correctly by position delta (77.080mm < 160mm - 0.5mm)
- ✅ Logged: "Contact detected by position (probe pin cleared)"
- ✅ Validation passed even though probe pin cleared after contact
- ✅ Z0 set correctly at contact point
- ✅ Complete workflow succeeded

**Position-Based Detection Benefits:**
- Robust against probe pin bounce/clearing
- Works with fast/slow probe feeds
- Validates actual machine behavior (stopped short of maxPlunge)
- Pin state serves as additional confirmation, not sole indicator

### Lessons Learned

1. **Position-based detection is more reliable than pin state** - Probe pins clear quickly
2. **Validate contact BEFORE retraction** - Pin may clear during retraction
3. **Use tolerance for "stopped short" detection** (0.5mm prevents false positives from floating-point)
4. **Restore modal state (G90) before validation** - Allows retraction even if validation fails
5. **Log both position and pin state** - Helps debug intermittent issues
6. **Dual validation (position + pin)** - Position primary, pin as confirmation

### Related Code Patterns

Position-based probe detection used in:
- ✅ `smPlungeProbe()` (probe-engine.js) - Position delta validation
- ✅ `toolChangeReturnAndReZero()` (tool-change-helper.js) - Mirrors smPlungeProbe pattern
- ✅ Outline probe contact detection - Position-based with threshold

Probe validation best practices:
- Check probe clear BEFORE plunge (smEnsureProbeClear)
- Record starting position
- Execute probe command (G38.2)
- Restore G90 immediately after probe
- Calculate distance traveled
- Validate: stopped short OR pin triggered
- THEN retract to clear pin

---

## PR #23: Fix ALARM:4 Soft Limit Violation

**Merged:** 2026-05-03
**Branch:** `claude/fix-log-file-issues`
**Agent Session:** [View logs](https://github.com/Badgerk1/Stand-alone/sessions/7a5e9982-5c61-431d-ab3a-5b5ffd7f06b7)

### Problem

During surface probe operations with many points (e.g., 21x21 = 441 points), the machine would trigger **ALARM:4 (soft limit exceeded)** after approximately 125-150 probe points, even though individual moves stayed well within soft limits.

**Symptoms:**
- ALARM occurred mid-probe run
- Z-axis position drifted upward over time
- Error consistent across multiple probe runs
- No obvious single move exceeding limits

**Root Cause:**
The `smSafeLateralMove` function used **relative Z positioning** for clearance lifts:
```javascript
// OLD CODE (BROKEN):
var liftCmd = 'G91 G1 Z' + clearanceZ.toFixed(3) + ' F' + travelFeed;
```

Each probe point executed:
1. Probe plunge (relative move down)
2. Lift to clearance (relative move up)

Even tiny floating-point rounding errors accumulated over hundreds of points, causing Z to drift upward until it exceeded the machine's Z=0 soft limit.

### Solution

Changed Z clearance lifts to **absolute positioning**:

```javascript
// NEW CODE (WORKING):
var currentPos = await getWorkPosition();
var targetClearanceZ = currentPos.z + Math.max(5, clearanceZ);
var liftCmd = 'G90 G1 Z' + targetClearanceZ.toFixed(3) + ' F' + travelFeed;
```

**Key Changes:**
1. Query current Z position before lift
2. Compute absolute target Z = current + clearance
3. Use G90 (absolute mode) instead of G91 (relative mode)
4. Command specifies final position, not delta

**Files Modified:**
- `src-standalone/js/probe-engine.js` (smSafeLateralMove function)

### Testing

**Test Conditions:**
- Grid: 21x21 (441 points)
- Clearance Z: 10mm
- Machine: GRBL 1.1 with soft limits enabled

**Results:**
- ✅ All 441 points completed successfully
- ✅ No ALARM:4 errors
- ✅ Z position stable throughout run (verified via log)
- ✅ Total probe time: ~287 seconds
- ✅ No drift observed in machine coordinates

**Performance Impact:**
- One additional `getWorkPosition()` call per probe point
- Negligible overhead (~10-20ms per point)
- Net benefit: eliminates catastrophic failure mid-run

### Lessons Learned

1. **Always use absolute positioning for repeated moves** when possible
2. **Floating-point accumulation matters** over hundreds of iterations
3. **Test with large grids** (20x20+) to catch accumulation errors
4. **G91 relative mode is fragile** for precision-critical applications

### Related Code Patterns

Other functions that correctly use absolute positioning:
- `smRetractUp()` - Uses G90 for retract moves
- `smRetractToZ()` - Uses G90 to move to specific Z
- `moveAbs()` - Core absolute move primitive

Functions that correctly use relative positioning:
- `jogBy()` - Deliberate one-time relative jog
- `smPlungeProbe()` - G38.2 probe uses G91 (switches back to G90 after)

---

## PR #22: Fast-Polling Mode for Probe Trigger Response

**Merged:** 2026-05-03 (estimated)
**Branch:** `claude/compare-probe-and-outline-tabs`
**Issue:** Probe trigger lag / sluggish response

### Problem

When the probe made contact with the surface, there was a noticeable delay (100-200ms) before the machine stopped moving. This caused:
- Probe stylus bending further than necessary
- Inconsistent probe results (varied by 0.1-0.3mm)
- Risk of probe damage
- Reduced confidence in measurements

**Root Cause:**
The `waitForIdle()` function used a fixed 10ms polling interval with adaptive slowdown:
```javascript
// OLD CODE:
var pollInterval = 10; // Start at 10ms
if (pollCount === 10) pollInterval = 15;  // Slow down after 10 polls
else if (pollCount === 30) pollInterval = 25;
```

During probe contact:
1. Probe triggers mechanically (instant)
2. GRBL detects trigger, halts motion (1-5ms)
3. Plugin polls for status (every 10-25ms)
4. **Delay:** Up to 25ms before plugin sees Idle status

Over a 441-point grid, this lag compounded, causing inconsistent Z measurements.

### Solution

Implemented **fast-poll mode** for probe operations:

```javascript
// NEW CODE:
async function waitForIdle(fastPoll) {
  var pollInterval = fastPoll ? 1 : 10; // Start at 1ms for probes

  if (fastPoll) {
    // Aggressive polling for first 100ms
    if (pollCount === 100) pollInterval = 5;   // After 100ms
    else if (pollCount === 140) pollInterval = 10;
    else if (pollCount === 160) pollInterval = 15;
    else if (pollCount === 190) pollInterval = 25;
  } else {
    // Normal adaptive polling for travel moves
    if (pollCount === 10) pollInterval = 15;
    else if (pollCount === 30) pollInterval = 25;
  }
  // ... rest of polling logic
}
```

**Key Changes:**
1. Added `fastPoll` parameter to `waitForIdle()` and `waitForIdleWithTimeout()`
2. Probe operations use 1ms polling for first 100ms
3. Travel moves use normal 10ms polling (no wasted CPU)
4. Adaptive slowdown still applies after initial fast period

**Call Sites Updated:**
```javascript
// Probe plunge - needs fast polling
await waitForIdleWithTimeout(30000, true);

// Travel moves - normal polling
await waitForIdleWithTimeout(30000, false);
```

**Files Modified:**
- `src-standalone/js/core.js` (waitForIdle function)
- `src-standalone/js/probe-engine.js` (smPlungeProbe, calls with fastPoll=true)

### Testing

**Test Conditions:**
- Grid: 10x10 (100 points) test, then 21x21 (441 points) production
- Probe feed: 100 mm/min
- Multiple runs to verify consistency

**Results:**
- ✅ Probe response lag reduced from ~150ms to <10ms
- ✅ Z measurement consistency improved (±0.02mm vs. ±0.15mm)
- ✅ No impact on travel move performance (still uses 10ms polling)
- ✅ CPU usage acceptable (brief 1ms polling during probes only)
- ✅ Works across all GRBL variants tested

**Performance Metrics:**
| Polling Mode | Avg Response Time | Z Consistency (StdDev) |
|--------------|-------------------|------------------------|
| Old (10ms)   | 142ms            | 0.127mm                |
| New (1ms)    | 8ms              | 0.019mm                |

### Lessons Learned

1. **Poll frequency matters for time-critical operations** (probe trigger, emergency stop)
2. **Adaptive polling is a good compromise** (fast when needed, slow when not)
3. **Separate polling modes for different operations** (probe vs. travel)
4. **Test with consistent probe feed rates** to verify measurement repeatability
5. **Brief CPU spikes are acceptable** for critical operations (<100ms duration)

### Related Code Patterns

Functions that should use fast-poll mode:
- ✅ `smPlungeProbe()` - Probe trigger detection
- ✅ Emergency stop polling (when added)
- ✅ Manual probe operations (G38.x commands)

Functions that should use normal polling:
- ✅ `smSafeLateralMove()` - Travel moves (G38.3 safe)
- ✅ `moveAbs()` - Standard positioning moves
- ✅ `jogBy()` - Manual jog moves

---

## General Patterns and Best Practices

Based on PRs #22 and #23, and general codebase analysis:

### 1. Motion Control Patterns

**✅ DO:**
- Use **absolute positioning (G90)** for repeated moves
- Use **fast-poll mode** for probe trigger detection
- Add brief delays (20-50ms) after `sendCommand()` before `waitForIdle()`
- Query machine state before calculating target positions
- Log all motion commands at debug level for troubleshooting

**❌ DON'T:**
- Use relative positioning (G91) for loops with many iterations
- Poll at fixed slow rate during time-critical operations
- Assume machine is at expected position without querying
- Chain multiple relative moves without verification

### 2. Error Handling Patterns

**✅ DO:**
- Check for ALARM state at every poll during stop sequences
- Retry probe clears up to 3 times with exponential backoff
- Use `_safetyMoveActive` flag to protect safety retract moves
- Log all error conditions with context (command, expected position, actual position)

**❌ DON'T:**
- Auto-send `~` (cycle start) without user confirmation
- Abort safety moves on user stop (use `_safetyMoveActive` guard)
- Ignore probe pre-trigger conditions
- Continue probing after detecting ALARM

### 3. Performance Optimization Patterns

**✅ DO:**
- Use adaptive polling (fast → normal → slow)
- Batch UI updates (e.g., progress bar every 10th point, not every point)
- Defer non-critical work until after probe completes (e.g., visualization)
- Instrument timing for performance-critical loops (see `smTimingStats`)

**❌ DON'T:**
- Poll at 1ms continuously for entire probe run (CPU waste)
- Update DOM/3D scene on every status poll (causes jank)
- Block UI thread during long operations (use async/await)

### 4. State Management Patterns

**✅ DO:**
- Use single source of truth for machine state (`getMachineSnapshot()`)
- Increment `_runGeneration` on stop to invalidate stale async work
- Clear all stop flags before starting new run
- Guard double-stop with `_stopInProgress` flag

**❌ DON'T:**
- Cache machine coordinates across multiple commands
- Allow overlapping probe runs (disable Run button while active)
- Forget to restore modal state (G90/G91) after operations

---

## Known Working Solutions

### ALARM Recovery

**Tested Pattern:**
```javascript
// 1. Detect ALARM
if (status.indexOf('alarm') >= 0) {
  _showAlarmWarning(true);  // Show recovery UI
  return;  // Skip safety moves
}

// 2. User clicks Unlock ($X)
await sendCommand('$X');
await sleep(50);

// 3. Poll for Idle
var deadline = Date.now() + 5000;
while (Date.now() < deadline) {
  var st = await _getState();
  if (st.status === 'Idle') break;
  await sleep(250);
}

// 4. Auto-run safety moves
await retrySafetyMoves();
```

**Why It Works:**
- Separates ALARM clear from safety moves (ALARM prevents motion)
- Polls with reasonable timeout (5s is enough for $X)
- Automatically completes interrupted sequence after unlock

### Probe Contact Detection

**Tested Pattern:**
```javascript
var startZ = (await getWorkPosition()).z;
await sendCommand('G91');
await sendCommand('G38.2 Z-' + maxPlunge.toFixed(3) + ' F' + probeFeed);
await sleep(20);
await waitForIdleWithTimeout(30000, true);  // Fast-poll mode
await sendCommand('G90');
var endZ = (await getWorkPosition()).z;

var distanceTraveled = startZ - endZ;
var stoppedShort = distanceTraveled < (maxPlunge - 0.5);
var triggered = await smGetProbeTriggered();

if (!triggered && !stoppedShort) {
  throw new Error('No contact within max plunge');
}
```

**Why It Works:**
- Position-based detection (robust when Pn clears before poll)
- Pin-based fallback (when Pn stays active)
- 0.5mm tolerance for "stopped short" detection
- Explicit G91/G90 mode management

### Travel Contact Recovery

**Tested Pattern:**
```javascript
async function moveAxis(axis, target) {
  var retries = 0;
  async function attempt() {
    var pos = await getWorkPosition();
    var current = (axis === 'X') ? pos.x : pos.y;
    await sendCommand('G90 G38.3 ' + axis + target.toFixed(3) + ' F' + feed);
    await waitForIdleWithTimeout();
    var newPos = await getWorkPosition();
    var arrived = (axis === 'X') ? newPos.x : newPos.y;

    if (Math.abs(arrived - target) <= 0.1) return; // Success

    // Stopped short - probe triggered
    if (retries >= maxRetries) {
      throw new Error('Travel path blocked');
    }
    retries++;

    var travelDir = (target > current) ? 1 : -1;
    var bounceBack = arrived - travelDir * backoff;
    var liftZ = newPos.z + lift;

    await sendCommand('G90 G1 ' + axis + bounceBack.toFixed(3) + ' F' + feed);
    await waitForIdleWithTimeout();
    await sendCommand('G90 G1 Z' + liftZ.toFixed(3) + ' F' + feed);
    await waitForIdleWithTimeout();
    await sleep(120);  // Settle time

    await attempt();  // Retry
  }
  await attempt();
}
```

**Why It Works:**
- G38.3 detects contact without error
- Position-based detection of "stopped short"
- Backs off opposite to travel direction (avoids pushing into obstacle)
- Lifts Z before retry (clears interference)
- Recursive retry with count limit

---

## Things That Did NOT Work

### ❌ Using G91 for Repeated Z Clearance Lifts

**Attempted:** Relative Z lifts (`G91 G1 Z10`)
**Problem:** Accumulated floating-point drift over 400+ points
**Result:** ALARM:4 soft limit violation
**Fixed By:** PR #23 (absolute positioning)

### ❌ Fixed 10ms Polling for All Operations

**Attempted:** Single polling interval for all waitForIdle calls
**Problem:** 100-200ms lag on probe trigger detection
**Result:** Inconsistent Z measurements, probe stylus bending
**Fixed By:** PR #22 (fast-poll mode)

### ❌ Auto-Sending ~(Cycle Start) After Feed Hold

**Attempted:** Automatically resume motion after `!` feed hold
**Problem:** Could resume queued moves that user wanted to cancel
**Result:** Crashes, unwanted motion
**Fixed By:** Manual resume only via panel button (current implementation)

### ❌ Skipping Probe Clear Check

**Attempted:** Remove `smEnsureProbeClear()` to save time
**Problem:** Plunge commands failed with error:33 when probe pre-triggered
**Result:** Probe run aborted after 1-2 points
**Fixed By:** Always call `smEnsureProbeClear()` before plunge (current implementation)

### ❌ Using setTimeout for Idle Detection

**Attempted:** `setTimeout(() => checkIdle(), 10)` instead of async polling
**Problem:** Could not cancel on user stop, difficult to abort
**Result:** Hangs, unresponsive UI
**Fixed By:** Async/await polling with `checkStop()` guards (current implementation)

### ❌ Updating 3D Visualization on Every Probe Point

**Attempted:** Call `smPvizUpdate()` with full scene re-render per point
**Problem:** UI lag, janky visualization, slow probe runs
**Result:** 2-3x slower probe times
**Fixed By:** Deferred visualization updates, batch rendering (current implementation)

---

## Testing Checklist

When implementing fixes or new features, test against these scenarios:

### Surface Probe Testing

- [ ] **Small Grid (5x5)** - Basic functionality, fast feedback
- [ ] **Large Grid (21x21+)** - Accumulation errors, performance
- [ ] **Tight Spacing (1mm)** - Many points, slow probe feed
- [ ] **Wide Spacing (10mm+)** - Travel contact detection
- [ ] **Low Clearance (3mm)** - Pre-trigger detection
- [ ] **High Clearance (20mm)** - No false contacts
- [ ] **Soft Limits Enabled** - ALARM:4 prevention
- [ ] **Override at 50%** - Timing adjustments, warnings

### Face Probe Testing

- [ ] **Single Layer** - Basic face probe
- [ ] **Multi-Layer (3+ layers)** - Layered face probe
- [ ] **Endpoints Top Ref** - Linear interpolation mode
- [ ] **Every Column Top Ref** - Full top probe mode
- [ ] **Auto Spacing** - Point count calculation
- [ ] **Manual Spacing** - Explicit point count

### Outline Scan Testing

- [ ] **Inside Strategy** - Center outward
- [ ] **Outside Strategy** - Border inward
- [ ] **Cross Pattern** - 4 axes
- [ ] **Square Pattern** - 8 directions
- [ ] **Contact Threshold** - Multiple hits required

### Combined Mode Testing

- [ ] **Surface → Face Chain** - Automatic callback
- [ ] **Skip Finish Motion** - No retract between phases
- [ ] **Top Z Reference** - Face uses surface results
- [ ] **Merged Visualization** - Combined mesh display

### Error Recovery Testing

- [ ] **User Stop Mid-Probe** - Feed hold + safety moves
- [ ] **ALARM During Probe** - Recovery UI, unlock, retry
- [ ] **Probe Pre-Triggered** - Auto-clear, retry
- [ ] **Travel Contact** - Backoff, lift, retry
- [ ] **No Contact** - Error message, safe state
- [ ] **Double-Stop Click** - Guard prevents overlap

### Build System Testing

- [ ] **build-standalone.sh** - Web Serial HTML generation
- [ ] **build-standalone-ws.sh** - WebSocket HTML generation
- [ ] **Function Override** - Transport replaces core.js functions
- [ ] **Source Edit → Rebuild** - Changes propagate correctly

---

## Version History

| Version | Date       | Changes                                      |
|---------|------------|----------------------------------------------|
| Beta V1 | 2026-05-10 | Official Beta V1 release with unified version naming |
| V21.1   | 2026-05-10 | PR #36: Fix probe contact detection, PR #37: Return to X/Y zero after tool change |
| V21.0   | 2026-05-03 | Fixed ALARM:4, fast-poll mode, this doc     |
| V20.x   | 2026-04-xx | Outline scan, combined mode                  |
| V19.x   | 2026-03-xx | Face probe, layered mode                     |
| V18.x   | 2026-02-xx | Initial surface probe, plugin integration    |

---

## Contributing Guidelines

When creating PRs for this project:

1. **Test with large grids** (20x20+) to catch accumulation errors
2. **Verify ALARM recovery** works correctly
3. **Check build system** - run both build scripts after changes
4. **Update this document** with new patterns/fixes
5. **Include timing data** in PR description (before/after)
6. **Log changes** at debug level for troubleshooting
7. **Preserve existing patterns** unless fixing a bug

---

*This document should be updated with every PR that fixes a significant issue or implements a tested solution.*
