# Version History - Standalone Beta

**Current Version:** Beta V1

---

## Version Tracking

This document tracks the version history of the standalone 3D Live Edge Mesh application. The version number appears in:
- Header subtitle: `src-standalone/config-body.html` line 13
- Footer: `src-standalone/config-body.html` line 1865

**After changing the version:**
1. Edit `src-standalone/config-body.html` (both locations)
2. Run `bash build-standalone.sh`
3. Run `bash build-standalone-ws.sh`
4. Commit with message indicating version change and what was fixed/added

---

## Beta Version Log

### Beta V1 (2026-05-10)
**Status:** Initial beta release

**Features:**
- Tool Change & Re-Zero workflow with return to X0 Y0
- Position-based probe contact detection
- Surface probe with grid configuration
- Face probe with layered depth scanning
- Outline scanning (inside/outside)
- Combined probe mode
- 3D visualization with Three.js
- G-code compensation (surface and face)
- Real-time probe status and logging
- Web Serial (USB) and WebSocket (network) support

**Recent Fixes (PRs #36-37):**
- Fixed probe retraction validation logic (position-based detection)
- Added return to X0 Y0 after tool change Z re-zero
- Improved contact detection reliability

**Known Limitations:**
- Beta software - testing in progress
- Report issues to repository issue tracker

---

## How to Increment Version

When a fix or feature is added:

1. **Determine new version number:**
   - Bug fix: Beta V1 → Beta V2
   - Feature addition: Beta V2 → Beta V3
   - Continue until ready for release: Beta V10 → V1.0 (stable)

2. **Update version in source:**
   ```bash
   # Edit src-standalone/config-body.html (2 locations)
   # Line ~13: Header version tag
   # Line ~1865: Footer version text
   ```

3. **Rebuild both variants:**
   ```bash
   bash build-standalone.sh
   bash build-standalone-ws.sh
   ```

4. **Update this file:**
   - Add new version section with date
   - List what changed
   - Update "Current Version" at top

5. **Commit and push:**
   ```bash
   git add .
   git commit -m "Bump version to Beta VX - [description of change]"
   git push
   ```

---

## Version Naming Convention

- **Beta V1-V9:** Initial beta testing phase
- **Beta V10+:** Advanced beta (most features working)
- **V1.0:** First stable release (all features tested and working)
- **V1.1, V1.2, etc.:** Minor updates to stable release
- **V2.0:** Major feature additions

---

## Testing Checklist Before Version Bump

Before incrementing version, verify:
- [ ] Feature/fix tested successfully
- [ ] No regressions in existing functionality
- [ ] Build scripts complete without errors
- [ ] Both standalone.html and standalone-ws.html updated
- [ ] Documentation updated (if applicable)
- [ ] Commit message describes the change clearly
