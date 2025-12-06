# PR Approved - Merge and Release Workflow

Merge an approved PR and optionally create a release.

**Usage:**
- `/pr-approved` - Start the merge workflow for current branch
- `/pr-approved --dry-run` - Preview what would happen without executing

**Arguments:** $ARGUMENTS

---

## Overview

This command handles the full workflow from PR merge to release:

1. Detect branch and create/find PR
2. Handle approval (or proceed without)
3. Merge PR (squash or merge commit)
4. Bump version and update docs
5. Create tag and optionally GitHub release

---

## Step 0: Pre-Flight Checks

**Checkpoint: PREFLIGHT**

```bash
# 1. Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# 2. Check we're NOT on main
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "ERROR: Already on main. Switch to a feature branch first."
  exit 1
fi

# 3. Check for uncommitted changes
git status --porcelain

# 4. Fetch latest from remote
git fetch origin
```

**Requirements:**
- [ ] On a feature branch (not main)
- [ ] Working directory is clean
- [ ] Remote is fetched

If on main, **STOP** and ask user which branch to work with.

---

## Step 1: Find or Create PR

**Checkpoint: PR_SETUP**

```bash
# Check if PR exists for this branch
gh pr view --json number,state,title,url 2>/dev/null
```

### If PR exists:
- Note PR number, title, URL
- Continue to Step 2

### If no PR exists:
Ask user: "No PR found for branch `$CURRENT_BRANCH`. Create one? (yes/no)"

If yes:
```bash
# Get commits on this branch not on main
git log origin/main..HEAD --oneline

# Create PR
gh pr create --base main --head $CURRENT_BRANCH --title "[title]" --body "$(cat <<'EOF'
## Summary
[Brief description of changes]

## Changes
- [list from commits]

---
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Step 2: Check Approval Status

**Checkpoint: APPROVAL**

```bash
# Check PR review status
gh pr view --json reviewDecision,reviews
```

### If approved:
- Note: "PR is approved"
- Continue to Step 3

### If NOT approved:

**Ask user:** "PR is not approved. Options:
1. **proceed** - Continue anyway (will attempt to approve, then merge)
2. **wait** - Stop and wait for approval
3. **abort** - Cancel workflow"

If user says "proceed":
```bash
# Attempt to approve (will fail if you created the PR)
gh pr review --approve 2>&1 || echo "Could not self-approve (expected if you created the PR)"
```

- Continue regardless of approval success

If user says "wait" or "abort": **STOP**

---

## Step 3: Choose Merge Strategy

**Checkpoint: MERGE_STRATEGY**

**Ask user:** "How do you want to merge?
1. **squash** - Squash all commits into one (cleaner history)
2. **merge** - Create merge commit (preserves individual commits)"

Note the choice for Step 4.

---

## Step 4: Perform Merge

**Checkpoint: MERGE**

```bash
# Ensure main is up to date
git fetch origin main

# Get PR number
PR_NUMBER=$(gh pr view --json number -q '.number')
```

### If squash merge:
```bash
gh pr merge $PR_NUMBER --squash --delete-branch
```

### If merge commit:
```bash
gh pr merge $PR_NUMBER --merge --delete-branch
```

**After merge:**
```bash
# Switch to main
git checkout main

# Pull the merged changes
git pull origin main

# Verify merge
git log --oneline -3
```

---

## Step 5: Determine Version Bump

**Checkpoint: VERSION**

### 5.1 Get Current Version

```bash
# Current version
CURRENT_VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo "Current version: $CURRENT_VERSION"

# Last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
echo "Last tag: $LAST_TAG"
```

### 5.2 Analyze Changes

```bash
# Commits since last tag (or all if no tag)
if [ "$LAST_TAG" != "none" ]; then
  git log $LAST_TAG..HEAD --oneline
else
  git log --oneline -10
fi
```

### 5.3 Ask User for Version Type

**Ask user:** "Current version: `$CURRENT_VERSION`. What type of release?
1. **patch** (x.y.Z) - Bug fixes, small changes
2. **minor** (x.Y.0) - New features, backward compatible
3. **major** (X.0.0) - Breaking changes

Or enter a specific version (e.g., `1.4.0`):"

Calculate new version based on response.

---

## Step 6: Update Version Files

**Checkpoint: VERSION_FILES**

### 6.1 Update package.json

Find and update:
```json
"version": "X.Y.Z"
```

### 6.2 Update extension.ts

Find and update the version output line:
```typescript
outputChannel.appendLine('>>> Version X.Y.Z <<<');
```

---

## Step 7: Update Documentation

**Checkpoint: DOCS**

### 7.1 Get Changes Summary

```bash
# PR title and body for context
gh pr view $PR_NUMBER --json title,body

# Files changed in the merge
git diff HEAD~1 --stat
```

### 7.2 Update CHANGELOG.md

Add new version section at top:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- [new features from PR]

### Fixed
- [bug fixes from PR]

### Changed
- [behavior changes from PR]

---
```

### 7.3 Update docs/CHANGELOG-DETAILED.md

Add technical section at top:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Overview
[PR title/description]

**PR:** #[number]
**Branch:** [branch name]

### Changes
- [detailed technical changes]

### Files Modified
- [list key files]

---
```

### 7.4 Update README.md (if significant feature)

If the PR added a notable feature, add to "What's New" section:

```markdown
## What's New in vX.Y.Z

- **[Feature]**: Brief description
```

---

## Step 8: Create Memory Bank Entry

**Checkpoint: MEMORY_BANK**

**File:** `.memory-bank/YYYYMMDD-HHMM-release-vX.Y.Z.md`

```markdown
# Release: vX.Y.Z

**Date:** YYYY-MM-DD
**PR:** #[number] - [title]
**Branch:** [branch name]
**Merge Type:** [squash/merge]

---

## Changes

[Summary from PR]

### Files Modified
- package.json (version bump)
- src/extension.ts (version string)
- CHANGELOG.md
- docs/CHANGELOG-DETAILED.md
- [other files from PR]

---

## Version Bump
- Previous: vA.B.C
- New: vX.Y.Z
- Type: [PATCH/MINOR/MAJOR]

---

## Next Steps
- [ ] Tag created
- [ ] GitHub release (if requested)
- [ ] Marketplace publish (via /release-vsce)
```

---

## Step 9: Commit Version Bump

**Checkpoint: COMMIT**

```bash
# Stage all changes
git add package.json package-lock.json src/extension.ts CHANGELOG.md docs/CHANGELOG-DETAILED.md README.md .memory-bank/

# Commit
git commit -m "$(cat <<'EOF'
chore(release): bump version to vX.Y.Z

## Changes
- [PR title/summary]

## Version Updates
- package.json: X.Y.Z
- extension.ts: X.Y.Z
- Updated changelogs

PR: #[number]

Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push to main
git push origin main
```

---

## Step 10: Create Tag

**Checkpoint: TAG**

```bash
# Create annotated tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push tag
git push origin vX.Y.Z
```

---

## Step 11: GitHub Release Decision

**Checkpoint: RELEASE_DECISION**

**Ask user:** "Tag `vX.Y.Z` created. What next?
1. **release** - Create GitHub release (with release notes)
2. **tag-only** - Keep as tag only (no release page)
3. **release-full** - Create release AND run `/release-vsce` for marketplace"

### If "release" or "release-full":

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes "$(cat <<'EOF'
## What's New

[Key changes from CHANGELOG.md]

## Installation

Install from [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion-vscode)

Or install manually:
```
code --install-extension prose-minion-vscode-X.Y.Z.vsix
```

## Full Changelog

See [CHANGELOG.md](https://github.com/okeylanders/prose-minion-vscode/blob/main/CHANGELOG.md)
EOF
)"
```

**Tell user:**
```
GitHub Release created: vX.Y.Z
https://github.com/okeylanders/prose-minion-vscode/releases/tag/vX.Y.Z
```

### If "tag-only":

**Tell user:**
```
Tag vX.Y.Z created (no GitHub release page).
You can create a release later with: gh release create vX.Y.Z
```

---

## Step 12: Cleanup and Next Steps

**Checkpoint: COMPLETE**

### 12.1 Verify Branch Cleanup

```bash
# Check if feature branch was deleted
git branch -a | grep $CURRENT_BRANCH || echo "Branch cleaned up"

# If still exists locally, delete it
git branch -D $CURRENT_BRANCH 2>/dev/null || true
```

### 12.2 Final Summary

**Tell user:**

```
## PR Merge Complete!

**PR:** #[number] - [title]
**Version:** vX.Y.Z
**Tag:** vX.Y.Z
**Release:** [Yes/No]

### What was done:
- [x] PR merged to main ([squash/merge])
- [x] Version bumped in package.json and extension.ts
- [x] CHANGELOG.md updated
- [x] CHANGELOG-DETAILED.md updated
- [x] Memory bank entry created
- [x] Tag vX.Y.Z created and pushed
- [x] [GitHub release created / Tag only]
- [x] Feature branch deleted

### Next steps:
[If release-full was chosen:]
Ready to publish to marketplace? Run: /release-vsce

[If release was chosen:]
To publish to marketplace later: /release-vsce

[If tag-only:]
To create a release later: gh release create vX.Y.Z
To publish to marketplace: /release-vsce
```

---

## Dry Run Mode

If `$ARGUMENTS` contains `--dry-run`:

1. Execute all read-only commands (git status, gh pr view, etc.)
2. **Do not execute** any write commands (merge, commit, push, tag)
3. Instead, show what WOULD be executed
4. Format output as:
   ```
   [DRY RUN] Would execute: git commit -m "..."
   [DRY RUN] Would execute: git push origin main
   ```

At end of dry run:
```
## Dry Run Complete

This was a preview. No changes were made.
To execute for real, run: /pr-approved
```

---

## Error Handling

### If merge fails (conflicts):

```
Merge failed due to conflicts.

Options:
1. Resolve conflicts manually, then say "continue"
2. Say "abort" to cancel the workflow
```

### If push fails:

```bash
# Check if main has diverged
git fetch origin main
git log HEAD..origin/main --oneline
```

If diverged, ask user:
- "rebase" - Rebase local changes on top of remote
- "force" - Force push (dangerous, confirm twice)
- "abort" - Cancel workflow

### If any step fails:

Note the error and ask:
- "retry" - Retry the failed step
- "skip" - Skip this step and continue
- "abort" - Cancel the workflow

---

## Quick Reference

| Step | Checkpoint | Description |
|------|------------|-------------|
| 0 | PREFLIGHT | Verify on feature branch, clean state |
| 1 | PR_SETUP | Find or create PR |
| 2 | APPROVAL | Check/handle approval status |
| 3 | MERGE_STRATEGY | Choose squash or merge commit |
| 4 | MERGE | Perform merge, switch to main |
| 5 | VERSION | Determine version bump type |
| 6 | VERSION_FILES | Update package.json, extension.ts |
| 7 | DOCS | Update changelogs and README |
| 8 | MEMORY_BANK | Create memory bank entry |
| 9 | COMMIT | Commit and push version bump |
| 10 | TAG | Create and push tag |
| 11 | RELEASE_DECISION | Create GitHub release (optional) |
| 12 | COMPLETE | Cleanup and summary |
