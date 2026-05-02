#!/bin/bash
# Build standalone.html — a self-contained, browser-openable version of the
# 3D Live Edge Probe tool that connects directly to GRBL via the Web Serial API.
#
# How it works
# ────────────
# Identical to build.sh, except standalone/src/webserial-transport.js is
# appended AFTER all src/js/*.js files inside the same <script> block.
# JavaScript resolves duplicate function declarations last-wins, so the
# transport overrides in webserial-transport.js silently replace the
# fetch-based ncSender calls in src/js/core.js:
#
#   sendCommand()                   → serial write + wait for GRBL 'ok'
#   _getState()                     → send '?' + parse GRBL status report
#   _trySafeStopEndpoints()         → send '!' feed-hold byte directly
#   requireStartupHomingPreflight() → relaxed (GRBL has no homed flag)
#
# All probe math, visualisation, settings, and UI are shared unchanged.
#
# Usage
# ─────
#   bash build-standalone.sh        → generates standalone.html
#
# IMPORTANT
# ─────────
# • Do NOT edit standalone.html directly — your changes will be overwritten.
# • Edit standalone/src/webserial-transport.js or any src-standalone/ file, then re-run.
# • This script never modifies config.html or any existing source file.
# • The plugin source lives in src/ — do NOT mix standalone changes into src/.
# • Standalone-specific changes belong in src-standalone/ only.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

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

echo "standalone.html built successfully"
