# Archive Completed Epic

You are helping the user archive a completed epic by moving its documentation from `.todo/epics/` to `.todo/archive/epics/` while ensuring all work is complete.

## Your Task

Follow these steps in order:

### Step 1: List Available Epics
Display all epics currently in `.todo/epics/` and ask the user which one to archive.

### Step 2: Verify Epic Completion

Before archiving, perform **ALL** of the following validation checks:

#### A. Check Epic README Completion Criteria
Read the epic's `README.md` and verify:
- All completion criteria checkboxes are marked `[x]` (completed)
- If any are unchecked `[ ]`, list them and ask user if they want to proceed anyway

#### B. Check All Sprint Files
For each `sprint-XX.md` file in the epic:
- Verify all task checkboxes are marked `[x]` (completed)
- Verify all completion criteria checkboxes are marked `[x]` (completed)
- If any are incomplete, list them and ask user if they want to proceed anyway

#### C. Verify Memory Bank Entry Exists
Search `.memory-bank/` for entries related to the epic:
- Look for files with epic name or sprint references in filename
- Look for files with dates matching recent commit history
- Read the most recent relevant memory bank entry and confirm it documents epic completion
- If no memory bank entry found, warn user and ask if they want to proceed anyway

#### D. Verify Git Commit History
Check recent commits for epic-related work:
```bash
git log --oneline -20 --grep="EPIC:"
```
- Confirm commits exist with `[EPIC: EPIC-NAME]` or `[SPRINT XX]` prefixes
- Show the user the last 5-10 epic-related commits
- Ask user to confirm these represent completed work

#### E. Check Associated ADR Status
Read the epic's README to find the related ADR(s):
- Read each related ADR file
- Check the **Status** field (should be `✅ Accepted` or similar for completed work)
- If ADR status is not marked as complete (e.g., still `🚧 Proposed`), note this for the user

### Step 3: Present Validation Summary

Show the user a clear summary:

```
📋 Epic Completion Validation: [Epic Name]

Epic README:
  ✅ All completion criteria marked complete
  OR ⚠️ Missing: [list incomplete items]

Sprint Files:
  ✅ Sprint 01: All tasks complete
  ✅ Sprint 02: All tasks complete
  OR ⚠️ Sprint 03: [list incomplete items]

Memory Bank:
  ✅ Found: .memory-bank/DD-MM-YYYY-epic-name.md
  OR ⚠️ No memory bank entry found for this epic

Git History:
  ✅ Found 15 commits with [EPIC: NAME] prefix
  Last commit: [date] - [message]

Associated ADR:
  ✅ ADR XXX: Status is "✅ Accepted"
  OR ⚠️ ADR XXX: Status is "🚧 Proposed" (not marked complete)
```

Ask the user: **"All validation checks passed. Proceed with archiving? (yes/no)"**

If validation failed, ask: **"Some validation checks failed. Proceed anyway? (yes/no)"**

If user says no, stop here.

### Step 4: Update ADR Status (if needed)

If the associated ADR status is NOT marked as complete:
1. Ask user: **"Should I update the ADR status to '✅ Accepted'? (yes/no)"**
2. If yes, update the ADR's **Status** field to `✅ Accepted`
3. Update the **Last Updated** date to today's date
4. Show the user what was changed

### Step 5: Create Archive Directory Structure

Create the archive directory if it doesn't exist:
```bash
mkdir -p .todo/archive/epics/[epic-name]
```

### Step 6: Move Epic Documentation

Move ALL files from the epic directory while preserving structure:
```bash
mv .todo/epics/[epic-name]/* .todo/archive/epics/[epic-name]/
```

This should move:
- `README.md`
- All `sprint-XX.md` files
- Any other files in the epic directory

### Step 7: Remove Empty Epic Directory

```bash
rmdir .todo/epics/[epic-name]
```

### Step 8: Commit Changes

Create a commit documenting the archive:
```bash
git add .todo/archive/epics/[epic-name]/
git add .todo/epics/  # To capture removal
git add docs/adr/XXX-*.md  # If ADR was updated
git commit -m "[EPIC: EPIC-NAME] docs: archive completed epic

Moved epic documentation to archive:
- Epic: [Epic Name]
- Sprints completed: [count]
- Related ADR: [ADR number and title]
- Memory bank: [reference to entry if exists]

All tasks and completion criteria verified.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 9: Confirm Success

Show the user:
```
✅ Epic archived successfully!

Moved from: .todo/epics/[epic-name]/
Moved to: .todo/archive/epics/[epic-name]/

Files archived:
- README.md
- sprint-01.md
- sprint-02.md
- [etc.]

ADR updated: [if applicable]
Commit created: [commit hash]
```

## Important Guidelines

- **Never skip validation**: All checks in Step 2 must be performed
- **Ask for confirmation**: Don't proceed without explicit user approval
- **Preserve structure**: Archive must maintain exact same directory structure
- **Update ADR**: Mark associated ADR as complete if not already done
- **Document thoroughly**: Commit message should reference all relevant context
- **Handle errors gracefully**: If git commands fail, explain error to user

## Error Handling

### If epic doesn't exist
```
❌ Epic not found: .todo/epics/[epic-name]/
Available epics:
- [list available epics]
```

### If archive already exists
```
⚠️ Archive already exists: .todo/archive/epics/[epic-name]/
This epic may have been archived already. Options:
1. Overwrite existing archive
2. Cancel operation
```

### If git commit fails
```
❌ Failed to commit archive. Error:
[git error message]

Files have been moved but not committed. You can:
1. Manually fix the issue and commit
2. Restore files with: mv .todo/archive/epics/[epic-name]/* .todo/epics/[epic-name]/
```

## Example Flow

```text
User: /archive-epic

Claude: Which epic would you like to archive? I found:
1. centralized-logging
2. client-portal

User: centralized-logging

Claude: Validating epic completion...

📋 Epic Completion Validation: Centralized Logging System

Epic README:
  ⚠️ Missing completion criteria:
    - [ ] Unit tests for Logger service passing
    - [ ] Memory bank entry created

Sprint Files:
  ✅ Sprint 01: All tasks complete
  ✅ Sprint 02: All tasks complete
  ⚠️ Sprint 03: 1 incomplete task
    - [ ] Run final build to verify no console.log violations

Memory Bank:
  ✅ Found: .memory-bank/16-11-2024-centralized-logging-system-implementation.md

Git History:
  ✅ Found 12 commits with [EPIC: LOGGING] prefix
  Last commit: 16-11-2024 - "[EPIC: LOGGING] fix: migrate all remaining console.log statements to Logger"

Associated ADR:
  ⚠️ ADR 004: Status is "🚧 Proposed" (not marked complete)

Some validation checks failed. Proceed anyway? (yes/no)

User: yes

Claude: Should I update ADR 004 status to '✅ Accepted'? (yes/no)

User: yes

Claude: [Updates ADR status]
Updated ADR 004:
- Status: 🚧 Proposed → ✅ Accepted
- Last Updated: 2025-11-16

Moving epic to archive...
✅ Epic archived successfully!

Moved from: .todo/epics/centralized-logging/
Moved to: .todo/archive/epics/centralized-logging/

Files archived:
- README.md
- sprint-01.md
- sprint-02.md
- sprint-03.md

ADR updated: docs/adr/004-centralized-logging-system.md
Commit created: a1b2c3d
```

## Notes

- Archive directory structure: `.todo/archive/epics/[epic-name]/`
- Archived epics can be referenced later for historical context
- Memory bank entries stay in `.memory-bank/` (not archived)
- ADR files stay in `docs/adr/` but are marked as complete
- Use BASH tool for all file operations (mkdir, mv, rmdir, git commands)
- Always verify files were moved successfully before removing source directory
