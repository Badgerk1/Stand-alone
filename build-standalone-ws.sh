#!/bin/bash
# Build standalone-ws.html — a self-contained, browser-openable version of the
# 3D Live Edge Probe tool that connects to a network-based GRBL controller via
# WebSocket (no USB / Web Serial required).
#
# How it works
# ────────────
# Identical to build-standalone.sh, except standalone/src/websocket-transport.js
# is appended AFTER all src/js/*.js files inside the same <script> block.
# JavaScript resolves duplicate function declarations last-wins, so the
# transport overrides in websocket-transport.js silently replace the
# fetch-based ncSender calls in src/js/core.js:
#
#   sendCommand()                   → WebSocket send + wait for GRBL 'ok'
#   _getState()                     → send '?' + parse GRBL status report
#   _trySafeStopEndpoints()         → send '!' feed-hold byte directly
#   requireStartupHomingPreflight() → relaxed (GRBL has no homed flag)
#
# Supported boards: any controller that speaks GRBL-protocol text over a plain
# WebSocket connection — FluidNC, Smoothieware, grblHAL network builds, etc.
# The default UI port is 8090 (changeable in the browser header bar).
#
# All probe math, visualisation, settings, and UI are shared unchanged.
#
# Usage
# ─────
#   bash build-standalone-ws.sh     → generates standalone-ws.html
#
# IMPORTANT
# ─────────
# • Do NOT edit standalone-ws.html directly — your changes will be overwritten.
# • Edit standalone/src/websocket-transport.js or any src-standalone/ file, then re-run.
# • This script never modifies config.html, standalone.html, or any source file.
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
    standalone/src/websocket-transport.js \
    src-standalone/config-footer.html \
    > standalone-ws.html

echo "standalone-ws.html built successfully"
