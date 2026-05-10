# Automated Version Bump System

## Overview

This repository includes an automated GitHub Actions workflow that increments the beta version number whenever a pull request is merged to the `main` branch.

## How It Works

### Trigger
The automation runs automatically when:
- A pull request is merged (not just closed) into the `main` branch
- Any branch can trigger it when merged to main

### What Gets Updated

When a PR is merged, the workflow:

1. **Extracts** the current beta version number (e.g., "Beta V1")
2. **Increments** the version (V1 → V2 → V3, etc.)
3. **Updates** the following files:
   - `package.json` - Updates `version` field (e.g., `1.0.0-beta.2`)
   - `src-standalone/config-body.html` - Updates header and footer version tags
   - `README.md` - Updates current version and last updated date
   - `VERSION.md` - Adds new version entry with changelog reference to merged PR
4. **Runs tests** to ensure nothing is broken
5. **Rebuilds** both `standalone.html` and `standalone-ws.html` using build scripts
6. **Commits** all changes with descriptive message
7. **Pushes** directly to `main` branch with `[skip ci]` to avoid infinite loops

### Version Format

- **Display format:** "Beta V1", "Beta V2", "Beta V3", etc.
- **Package.json format:** "1.0.0-beta.1", "1.0.0-beta.2", etc.
- Both formats are kept in sync automatically

## Workflow File

The automation is defined in `.github/workflows/version-bump.yml`

### Key Features

- ✅ **Fully Automated** - No manual intervention needed
- ✅ **Safe** - Only runs on successful merges, includes test validation
- ✅ **Comprehensive** - Updates all necessary files and rebuilds artifacts
- ✅ **Traceable** - Links version bump back to the merged PR
- ✅ **Smart** - Uses `[skip ci]` to avoid triggering other workflows

## Manual Version Bumps (Not Recommended)

If you need to manually bump the version (e.g., for major version changes from Beta to V1.0), you can still follow the process in `VERSION.md`, but this is rarely needed since the automation handles incremental beta versions.

## Disabling Automation

To temporarily disable automatic version bumps:
1. Rename or delete `.github/workflows/version-bump.yml`
2. Or add `[skip version bump]` to your PR title (requires workflow modification)

## Monitoring

After a PR is merged:
1. Go to the "Actions" tab in GitHub
2. Look for the "Auto Version Bump" workflow
3. Check the run details and summary for confirmation
4. The version bump commit will appear in the main branch history

## Troubleshooting

### Workflow Fails
If the version bump workflow fails:
- Check the Actions tab for error logs
- Common issues:
  - Build script failures (check build-standalone.sh/build-standalone-ws.sh)
  - Test failures (workflow won't commit if tests fail)
  - Permission issues (workflow needs `contents: write` permission)

### Version Not Incremented
- Ensure PR was merged (not just closed)
- Check that PR target was `main` branch
- Verify workflow file exists and is valid YAML

### Merge Conflicts
If the version bump commit causes conflicts with other branches:
- Rebase or merge `main` into your feature branch
- The automation ensures main always has the latest version

## Examples

### Example 1: Bug Fix PR
```
PR #45: Fix probe retraction logic
→ Merged to main
→ Automation runs
→ Version bumps: Beta V3 → Beta V4
→ Commit: "chore: Bump version to Beta V4 after merge of PR #45"
```

### Example 2: Feature Addition PR
```
PR #50: Add WebSocket reconnection support
→ Merged to main
→ Automation runs
→ Version bumps: Beta V7 → Beta V8
→ Commit: "chore: Bump version to Beta V8 after merge of PR #50"
```

## Benefits

1. **Consistency** - Version always increments, no skipped numbers
2. **Traceability** - Each version links to the PR that triggered it
3. **No Human Error** - Eliminates forgotten version bumps or typos
4. **Time Savings** - Developers don't need to manually update 6+ files
5. **Always Current** - Built HTML files always reflect latest version

## Future Enhancements

Potential improvements to consider:
- Semantic versioning based on PR labels (feat/fix/breaking)
- Automatic changelog generation from commit messages
- Release notes auto-generation
- Tag creation for each version
- GitHub Release creation with artifacts

---

**Note:** This automation complements the existing manual process documented in `VERSION.md`. The manual process is still available if needed for non-standard version changes.
