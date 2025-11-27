# Release VSCode Extension

Prepare and publish a release for the Prose Minion VSCode extension.

**Usage:**
- `/release-vsce` or `/release-vsce begin` - Start a new release from the beginning
- `/release-vsce pause` - Pause release and save progress to memory bank
- `/release-vsce resume` - Resume from last checkpoint

**Arguments:** $ARGUMENTS

---

## Release State Management

Before proceeding, determine the release state:

### If `$ARGUMENTS` is "pause"
1. Create a memory bank entry immediately: `.memory-bank/YYYYMMDD-HHMM-release-vsce-paused.md`
2. Include:
   - Current step number and name
   - All completed steps with outcomes
   - Any pending decisions or blockers
   - Version number determined (if reached that step)
   - Files modified so far
   - Any audit findings
3. Tell the user: "Release paused. Run `/release-vsce resume` to continue from Step [X]."
4. **STOP HERE** - Do not proceed with any steps

### If `$ARGUMENTS` is "resume"
1. Search `.memory-bank/` for most recent `*release-vsce*.md` file
2. Read the file to determine:
   - Last completed step
   - Version number (if determined)
   - Any pending decisions
3. Tell the user what step you're resuming from
4. **Skip to that step** and continue from there

### If `$ARGUMENTS` is blank, "begin", or anything else
1. Check for any existing paused release: `grep -l "release-vsce" .memory-bank/*.md | tail -1`
2. If found, ask user: "Found paused release from [date]. Resume? (yes/no)"
   - If yes, treat as "resume"
   - If no, proceed with new release (will overwrite progress)
3. If no paused release found, proceed with Step 0

---

## Step 0: Pre-Flight Checks

**Checkpoint: PREFLIGHT**

Before starting, verify the environment is ready:

```bash
# 1. Check we're on main branch
git branch --show-current

# 2. Check for clean working directory
git status --porcelain

# 3. Pull latest changes
git pull origin main

# 4. Check current version in package.json
grep '"version"' package.json
```

**Requirements:**
- [ ] On `main` branch
- [ ] Working directory is clean (no uncommitted changes)
- [ ] Up to date with remote
- [ ] Note current version: `____`

If any check fails, inform the user and **STOP**. User must resolve before continuing.

---

## Step 1: Analyze Changes Since Last Release

**Checkpoint: ANALYSIS**

### 1.1 Get Last Tagged Release

```bash
# List all tags with dates
gh release list --limit 10

# Get the latest tag
LAST_TAG=$(gh release list --limit 1 --json tagName -q '.[0].tagName')
echo "Last release: $LAST_TAG"

# Get the commit for that tag
git rev-list -n 1 $LAST_TAG
```

### 1.2 Gather All Changes

Run these commands to collect change information:

```bash
# Commits since last tag
git log $LAST_TAG..HEAD --oneline

# PRs merged since last tag (if using GitHub)
gh pr list --state merged --base main --search "merged:>$(git log -1 --format=%ci $LAST_TAG | cut -d' ' -f1)"

# Files changed since last tag
git diff --stat $LAST_TAG..HEAD
```

### 1.3 Review Memory Bank Entries

```bash
# Find memory bank entries since last release
# (Look at dates in filenames newer than last release date)
ls -la .memory-bank/
```

Read relevant memory bank entries to understand context of changes.

### 1.4 Check Changelog Sync Status

Read and compare:
- `CHANGELOG.md` (consumer-facing)
- `docs/CHANGELOG-DETAILED.md` (engineer-facing)
- `README.md` (headline features at top)

Note any discrepancies between:
- Changes in git history not in changelogs
- Changes in changelogs not matching git history
- Version numbers that don't match

### 1.5 Create Analysis Summary

Create a summary of findings:

```markdown
## Release Analysis Summary

**Last Release:** vX.Y.Z (YYYY-MM-DD)
**Commits Since:** [count]
**PRs Merged:** [list]

### Changes by Category:
- **Features:** [list new features]
- **Fixes:** [list bug fixes]
- **Refactors:** [list refactors]
- **Docs:** [list doc changes]
- **Tests:** [list test changes]

### Breaking Changes:
- [list any breaking changes, or "None"]

### Changelog Sync Issues:
- [list any discrepancies found]
```

---

## Step 2: Determine Version Bump

**Checkpoint: VERSION**

Based on the analysis from Step 1, determine the appropriate version bump.

### Semantic Versioning Rules

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking changes (API, behavior) | **MAJOR** (X.0.0) | Removing a feature, changing defaults significantly |
| New features (backward compatible) | **MINOR** (x.Y.0) | Adding Context Search, new settings |
| Bug fixes, patches | **PATCH** (x.y.Z) | Fixing race conditions, UI bugs |

### Version Determination

1. Review the changes from Step 1
2. Identify the highest-impact change type
3. Propose version: `v[NEW_VERSION]`

**Ask user to confirm:** "Based on my analysis, I recommend version `vX.Y.Z` ([MAJOR/MINOR/PATCH]). Proceed? (yes/no/suggest alternative)"

### Update Version Numbers

Once confirmed, update these files:

**1. package.json:**
```json
"version": "X.Y.Z"
```

**2. src/extension.ts** - Find and update:
```typescript
outputChannel.appendLine('>>> Version X.Y.Z <<<');
```

---

## Step 3: Update Documentation

**Checkpoint: DOCS**

### 3.1 Update README.md

Add headline changes at the top of the features section. Stack new items above old ones.

**Pattern:**
```markdown
## What's New in vX.Y.Z

- **Feature Name**: Brief description of what it does
- **Fix**: What was broken and is now fixed
```

### 3.2 Update CHANGELOG.md (Consumer-Facing)

Add new version section at the top, following existing format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- **Feature Name**: User-facing description of new capability

### Fixed
- Description of what was broken and how it's now fixed

### Changed
- Description of behavior changes

---
```

**Guidelines:**
- Focus on WHAT changed, not HOW
- Use plain language (avoid technical jargon)
- Group by: Added, Fixed, Changed, Removed
- Include relevant links to docs/features

### 3.3 Update docs/CHANGELOG-DETAILED.md (Engineer-Facing)

Add comprehensive technical section at the top:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Overview
Brief summary paragraph.

**Key Highlights:**
- Emoji **Feature** - One-liner

---

### Features

#### Feature Name (PR #XX)
**What It Does:**
Detailed explanation.

**Technical Implementation:**
- Files modified
- Architecture patterns used
- Performance considerations

**Files Added/Modified:**
- `path/to/file.ts` - What changed

**References:**
- ADR: [link]
- Epic: [link]
- Memory Bank: [link]

---

### Fixed

#### Bug Name
- **Issue**: What was broken
- **Fix**: How it was fixed
- **Impact**: User-facing improvement
- **Commit**: `abc123`

---
```

**Guidelines:**
- Include technical details (files, patterns, architecture)
- Link to ADRs, epics, memory bank entries
- Include commit hashes for fixes
- Document breaking changes for contributors

---

## Step 4: Run Tests and Build

**Checkpoint: TESTS**

```bash
# Run full test suite
npm test

# Check test count and coverage
npm run test:coverage

# Run production build
npm run build
```

**Requirements:**
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Build completes successfully
- [ ] Note test count: `____`
- [ ] Note coverage: `____%`

If tests fail, **STOP** and inform user. Fix issues before continuing.

---

## Step 5: Security Audit

**Checkpoint: AUDIT**

```bash
# Run npm audit
npm audit

# Check for high/critical vulnerabilities
npm audit --audit-level=high
```

### For Each High/Medium Vulnerability:

1. **Determine if it applies to our use case:**
   - Read the vulnerability description
   - Check how we use the affected package
   - Is the vulnerable code path actually executed?

2. **Check test coverage:**
   - Is the dependency's usage covered by our tests?
   - If not, note this as a gap

3. **Document finding:**
   ```markdown
   ### Vulnerability: [NAME]
   - **Package:** [package@version]
   - **Severity:** [HIGH/MEDIUM]
   - **Applies to us:** [YES/NO - explanation]
   - **Test coverage:** [YES/NO]
   - **Action:** [Fix now / Accept risk / Defer]
   ```

If critical vulnerabilities apply to our use case, **STOP** and fix before continuing.

---

## Step 6: Light Code Review

**Checkpoint: REVIEW**

Use a subagent to perform a light code and architecture review:

```
Launch subagent (Explore type) with prompt:
"Perform a light code review of changes since the last release tag.

Focus on:
1. Breaking changes that might affect users
2. Regressions in existing functionality
3. Architecture pattern violations (check CLAUDE.md for patterns)
4. Security concerns (API keys, user data, permissions)
5. Performance regressions
6. Missing error handling

Do NOT review:
- Code style (that's what linters are for)
- Test coverage (handled separately)
- Documentation quality

Report format:
- CRITICAL: [Must fix before release]
- WARNING: [Should fix, but can ship]
- INFO: [Nice to fix, low priority]

If no issues found, report 'No critical issues found.'"
```

**If CRITICAL issues found:** Stop and fix before continuing.
**If WARNING issues found:** Ask user if they want to fix now or proceed.

---

## Step 7: Create Memory Bank Entry

**Checkpoint: MEMORY_BANK**

Create comprehensive release notes in memory bank:

**File:** `.memory-bank/YYYYMMDD-HHMM-release-vX.Y.Z-preparation.md`

```markdown
# Release Preparation: vX.Y.Z

**Date:** YYYY-MM-DD
**Previous Version:** vA.B.C
**New Version:** vX.Y.Z

---

## Changes Summary

### Features
- [list]

### Fixes
- [list]

### Breaking Changes
- [list or "None"]

---

## Audit Results

### npm audit
- High: [count]
- Medium: [count]
- Applicable to us: [list or "None"]

### Code Review
- Critical: [list or "None"]
- Warnings: [list or "None"]

---

## Test Results
- Tests: [count] passing
- Coverage: [X]%

---

## Files Modified
- package.json (version bump)
- src/extension.ts (version string)
- CHANGELOG.md
- docs/CHANGELOG-DETAILED.md
- README.md

---

## Next Steps
- [ ] Commit and push
- [ ] Package vsix
- [ ] Manual testing
- [ ] Create GitHub release
- [ ] Publish to marketplace (when requested)
```

---

## Step 8: Commit and Push

**Checkpoint: COMMIT**

```bash
# Stage all changes
git add package.json src/extension.ts CHANGELOG.md docs/CHANGELOG-DETAILED.md README.md .memory-bank/

# Commit with release message
git commit -m "$(cat <<'EOF'
chore(release): prepare vX.Y.Z

## Changes
- [brief list of major changes]

## Version Updates
- package.json: X.Y.Z
- extension.ts: X.Y.Z
- CHANGELOG.md: Added vX.Y.Z section
- CHANGELOG-DETAILED.md: Added vX.Y.Z section

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push to main
git push origin main
```

---

## Step 9: Package and Manual Test

**Checkpoint: PACKAGE**

```bash
# Create vsix package
npm run package

# List the created package
ls -la *.vsix
```

**Tell the user:**

```
📦 Package created: prose-minion-vscode-X.Y.Z.vsix

Please test manually:
1. Uninstall existing Prose Minion extension
2. Install vsix: code --install-extension prose-minion-vscode-X.Y.Z.vsix
3. Reload VSCode

Test checklist:
- [ ] Extension activates without errors
- [ ] Settings overlay opens (gear icon)
- [ ] API key can be saved/cleared
- [ ] Metrics tab works (offline feature)
- [ ] Word search works (offline feature)
- [ ] If API key set: Dictionary lookup works
- [ ] If API key set: Context assistant works
- [ ] Version shows correctly in Output Channel

When testing is complete, tell me:
- "tests passed" - to continue to tagging
- "found issue: [description]" - to pause and fix
```

**Wait for user response before continuing.**

---

## Step 10: Create GitHub Release

**Checkpoint: RELEASE**

Only proceed when user confirms tests passed.

```bash
# Create the tag
git tag vX.Y.Z

# Push the tag
git push origin vX.Y.Z

# Create GitHub release with notes
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes "$(cat <<'EOF'
## What's New

[Copy key changes from CHANGELOG.md]

## Installation

Install from [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion-vscode)

Or download the `.vsix` file below and install manually:
```
code --install-extension prose-minion-vscode-X.Y.Z.vsix
```

## Full Changelog

See [CHANGELOG.md](https://github.com/okeylanders/prose-minion-vscode/blob/main/CHANGELOG.md) for complete details.
EOF
)" \
  --attach prose-minion-vscode-X.Y.Z.vsix
```

**Tell the user:**

```
✅ GitHub Release created: vX.Y.Z
🔗 https://github.com/okeylanders/prose-minion-vscode/releases/tag/vX.Y.Z

The release includes:
- Release notes
- Downloadable .vsix file
- Tag pointing to this commit

📢 To publish to VSCode Marketplace, say: "publish to marketplace"

⚠️ I will NOT publish without your explicit request.
```

---

## Step 11: Publish to Marketplace (On Request Only)

**Checkpoint: MARKETPLACE**

**⚠️ ONLY proceed with this step when user explicitly requests it.**

```bash
# Publish to VSCode Marketplace
npx vsce publish
```

**After successful publish:**

```
✅ Published to VSCode Marketplace!

🔗 https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion-vscode

The extension should appear within 5-10 minutes.

## Post-Publish Verification
- [ ] Extension page shows new version
- [ ] Version number is correct
- [ ] Description and screenshots are intact
- [ ] Install button works

## Release Complete! 🎉

Final memory bank entry created with full release summary.
```

### Create Final Memory Bank Entry

Update the preparation entry or create new:

**File:** `.memory-bank/YYYYMMDD-HHMM-release-vX.Y.Z-complete.md`

```markdown
# Release Complete: vX.Y.Z

**Date:** YYYY-MM-DD
**GitHub Release:** https://github.com/okeylanders/prose-minion-vscode/releases/tag/vX.Y.Z
**Marketplace:** https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion-vscode

---

## Release Summary

### Version
- Previous: vA.B.C
- New: vX.Y.Z
- Type: [MAJOR/MINOR/PATCH]

### Key Changes
- [list]

### Statistics
- Commits since last release: [count]
- PRs merged: [count]
- Tests: [count] passing
- Coverage: [X]%

---

## Timeline
- Preparation started: [timestamp]
- Tests passed: [timestamp]
- GitHub release: [timestamp]
- Marketplace publish: [timestamp]

---

## Notes
[Any issues encountered, lessons learned, follow-up items]
```

---

## Error Handling

### If any step fails:

1. Note the error and current step
2. Ask user how to proceed:
   - "retry" - Retry the failed step
   - "skip" - Skip and continue (use with caution)
   - "pause" - Save progress and stop
   - "abort" - Stop entirely (manual cleanup may be needed)

### If user says "pause" at any point:

1. Immediately create memory bank checkpoint
2. Note exact step and sub-step
3. List any temporary state that needs preservation
4. Provide resume instructions

---

## Quick Reference

| Step | Checkpoint | Description |
|------|------------|-------------|
| 0 | PREFLIGHT | Branch, clean, up-to-date |
| 1 | ANALYSIS | Gather all changes since last release |
| 2 | VERSION | Determine and update version |
| 3 | DOCS | Update README, CHANGELOG, CHANGELOG-DETAILED |
| 4 | TESTS | Run tests and build |
| 5 | AUDIT | npm audit + vulnerability review |
| 6 | REVIEW | Light code review via subagent |
| 7 | MEMORY_BANK | Create release preparation entry |
| 8 | COMMIT | Commit and push changes |
| 9 | PACKAGE | Create vsix, user manual testing |
| 10 | RELEASE | Create GitHub release with tag |
| 11 | MARKETPLACE | Publish (on explicit request only) |
