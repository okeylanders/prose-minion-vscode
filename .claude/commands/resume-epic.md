# Resume Epic

You are helping the user resume work on an in-progress epic.

## Your Task

Follow these steps in order:

### Step 1: List Available Epics

Scan `.todo/epics/` directory for active epics (not in `.todo/archived/epics/`).

For each epic, read the epic document to determine:
- Epic name
- Status (🟢 Active, ⏳ Pending, ✅ Complete)
- Sprint progress (X/Y sprints complete)
- Priority

List them with status indicators:
```
Available Epics:
1. [🟢 Active] Technical Debt Cleanup (2/3 sprints, HIGH)
2. [⏳ Pending] v1 Polish & UX (3/4 sprints, MEDIUM)
3. [⏳ Pending] Search Architecture (5/8 phases, MEDIUM)
```

Ask: "Which epic would you like to resume?"

---

### Step 2: Analyze Epic Status

Once the user selects an epic, perform a comprehensive analysis:

#### 2.1: Read Epic Documentation
- Read main epic document (`.todo/epics/[epic-name]/epic-[name].md`)
- Read all sprint documents
- Identify completed vs. pending sprints

#### 2.2: Check Git Commits
Run `git log --oneline -20` and identify commits related to this epic:
- Sprint commits (e.g., `[Sprint-01]`, `[Sprint 02]`)
- Epic commits (e.g., `[Epic: Name]`)
- Recent activity timeline

#### 2.3: Read Memory Bank Entries
Scan `.memory-bank/` for entries related to this epic:
- Sprint completion entries
- Epic planning entries
- Architecture reviews
- State snapshots

Look for patterns like:
- `YYYYMMDD-HHMM-*[epic-slug]*`
- `YYYYMMDD-HHMM-sprint-NN-*`

#### 2.4: Check Test Suite Status
Run `npm test 2>&1 | head -50` to verify:
- All tests passing
- Current test count
- No broken functionality

#### 2.5: Generate Status Report

Provide a comprehensive report similar to this format:

```markdown
## Epic Status: [Epic Name]

**Branch**: [Detected or TBD]
**Epic Status**: X/Y Sprints Complete (Z%)
**Test Suite**: ✅ NNN/NNN tests passing

---

### ✅ Completed Work

#### Sprint 01: [Name]
- Status: ✅ COMPLETE (Date, Time)
- Commit: [hash]
- Duration: ~X hours
- Memory Bank: [link]

**Achievements**:
- ✅ [Achievement 1]
- ✅ [Achievement 2]

[Repeat for each completed sprint]

---

### 📋 Pending Work

#### Sprint N: [Name]
- Status: ⏳ PENDING
- Estimated Duration: X hours
- Sprint Doc: [link]

**Scope**: [Brief description]

---

### 📈 Progress Metrics

| Metric | Value |
|--------|-------|
| Sprints Complete | X/Y (Z%) |
| Total Tests | NNN (was MMM, +X new) |
| Architecture Debt Resolved | X/Y items |

---

### 🚀 Next Steps

**Option 1: Continue Sprint N** (Recommended if in progress)
**Option 2: Start Sprint M** (If Sprint N complete but not documented)
**Option 3: Review and Merge** (If epic complete)
```

---

### Step 3: Check Current Branch

Run `git branch --show-current` to detect the current branch.

#### Case A: Already on Epic Branch
If current branch matches the epic (e.g., `epic/technical-debt-cleanup-2025-11-15`):
- ✅ Report: "You're already on the epic branch: [branch-name]"
- Skip to Step 4

#### Case B: Not on Epic Branch
If current branch does NOT match:
1. Run `git branch --list "epic/*"` to scan for epic branches
2. Look for branches matching the epic name pattern

**If epic branch exists**:
- Report: "Epic branch found: [branch-name]"
- Ask: "Would you like to switch to [branch-name]? (yes/no)"
- If yes: `git checkout [branch-name]`
- If no: Ask about strategy (see Case C)

**If NO epic branch exists** (Case C):
- Report: "No epic branch found for this epic."
- Ask about branch strategy:

```
No epic branch found. How would you like to proceed?

1. Create new epic branch: epic/[epic-name]
2. Create sprint branch: epic/[epic-name]/sprint/NN-[sprint-name]
3. Stay on current branch: [current-branch]
4. Specify custom branch name

Which option? (1-4)
```

Wait for user response and execute accordingly.

---

### Step 4: Create Memory Bank Resume Entry

After branch is sorted, create a memory bank entry documenting the resume:

**Filename format**: `.memory-bank/YYYYMMDD-HHMM-resume-epic-[epic-slug].md`

**Required timestamp**: Use actual current date/time in `YYYYMMDD-HHMM` format

**Content template**:
```markdown
# Resume Epic: [Epic Name]

**Date**: YYYY-MM-DD HH:MM
**Epic**: [Epic Name]
**Branch**: [branch-name]
**Session**: Epic Resume

---

## Resume Context

**Why Resuming**: [Brief context - e.g., "Continuing after Sprint 02 completion" or "Resuming after break"]

**Current State**:
- **Sprints Complete**: X/Y (Z%)
- **Last Completed Sprint**: Sprint NN ([name])
- **Last Commit**: [hash] ([message])
- **Test Status**: ✅ NNN/NNN passing

---

## Work Completed So Far

[Summary of completed sprints from analysis]

---

## Next Sprint: Sprint N

**Status**: [In Progress / Pending / Ready to Start]
**Estimated Duration**: X hours
**Sprint Doc**: [link]

**Scope**: [Brief description of what this sprint will accomplish]

**Tasks**:
- [ ] [Task 1]
- [ ] [Task 2]

---

## Session Plan

**Immediate Next Steps**:
1. [First action - e.g., "Review Sprint 03 tasks"]
2. [Second action - e.g., "Extract useEffect logic in usePublishingSettings"]
3. [Third action - e.g., "Run tests to verify no regressions"]

**Estimated Session Duration**: X-Y hours

---

## References

- **Epic Doc**: [link]
- **Sprint Doc**: [link]
- **Related ADRs**: [links]
- **Architecture Debt**: [links if applicable]
- **Previous Memory Bank Entries**: [links to related entries]

---

**Session Started**: YYYY-MM-DD HH:MM
**Branch**: [branch-name]
**Status**: 🟢 Ready to resume Sprint N
```

Commit this memory bank entry:
```bash
git add .memory-bank/YYYYMMDD-HHMM-resume-epic-[epic-slug].md
git commit -m "docs: log epic resume session for [Epic Name]"
```

---

### Step 5: Confirm Next Actions

After creating the memory bank entry, confirm with the user:

```
Epic resume logged in memory bank: .memory-bank/YYYYMMDD-HHMM-resume-epic-[epic-slug].md

📋 Next Sprint: Sprint N - [Sprint Name]
⏱️ Estimated Duration: X hours
📍 Current Branch: [branch-name]
✅ Test Status: NNN/NNN passing

Ready to begin Sprint N? (yes/no)
```

If yes, proceed to Step 6.
If no, ask what they'd like to do instead.

---

### Step 6: Begin Next Sprint

1. Open the next sprint document for reference
2. Review the sprint tasks with the user
3. Ask: "Which task should we start with? (Or should I start with Task 1?)"
4. Begin implementation based on sprint plan

---

## Important Guidelines

### Analysis Quality
- **Be thorough**: Read commits, memory bank, epic docs, AND sprint docs
- **Check tests**: Always verify test suite status before resuming
- **Timeline awareness**: Note when work was last done (days/weeks ago?)
- **Context preservation**: Reference previous memory bank entries

### Branch Management
- **Always check current branch first** before suggesting switches
- **Scan for existing branches** before creating new ones
- **Ask about strategy** if no epic branch exists (don't assume)
- **Respect user choice**: If they want to stay on current branch, allow it

### Memory Bank Entry
- **REQUIRED timestamp format**: `YYYYMMDD-HHMM` (4-digit year, 2-digit month/day, 2-digit hour/minute)
- **Current date/time**: Use actual current date/time, not placeholder
- **Session context**: Explain why resuming (e.g., "after break", "continuing Sprint 02")
- **Actionable plan**: Include specific next steps, not vague goals
- **Links**: Reference epic docs, sprint docs, ADRs, architecture debt items

### Commit Conventions
- Memory bank entry commit: `docs: log epic resume session for [Epic Name]`
- Use lowercase "docs:" prefix for documentation commits
- Keep commit message concise but descriptive

---

## Example Flow

### Example 1: Resume Active Epic (Already on Branch)

```text
Claude: Scanning active epics...

Available Epics:
1. [🟢 Active] Technical Debt Cleanup (2/3 sprints, HIGH priority)
   - Last activity: 2025-11-15 14:30
   - Branch: epic/technical-debt-cleanup-2025-11-15
   - Next: Sprint 03 - useEffect Extraction

2. [⏳ Pending] v1 Polish & UX (3/4 sprints, MEDIUM priority)
   - Last activity: 2025-11-02
   - Next: Sprint 03 - Focused Dialogue Buttons

Which epic would you like to resume?

User: 1

Claude: [Performs comprehensive analysis]

## Epic Status: Technical Debt Cleanup

**Branch**: epic/technical-debt-cleanup-2025-11-15 ✅ (current)
**Epic Status**: 2/3 Sprints Complete (67%)
**Test Suite**: ✅ 207/207 tests passing

[... detailed analysis ...]

You're already on the epic branch: epic/technical-debt-cleanup-2025-11-15

Creating memory bank resume entry...
✅ Created: .memory-bank/20251117-1430-resume-epic-technical-debt-cleanup.md
✅ Committed: docs: log epic resume session for Technical Debt Cleanup

📋 Next Sprint: Sprint 03 - useEffect Extraction Pattern
⏱️ Estimated Duration: 2-4 hours
📍 Current Branch: epic/technical-debt-cleanup-2025-11-15
✅ Test Status: 207/207 passing

Ready to begin Sprint 03? (yes/no)

User: yes

Claude: Opening Sprint 03 document...

Sprint 03 tasks:
1. Extract useEffect logic in domain hooks (8 hooks)
2. Establish naming pattern (request*, sync*, initialize*)
3. Run tests to verify no regressions
4. Document pattern in CLAUDE.md

Which task should we start with? (Or should I start with Task 1?)
```

---

### Example 2: Resume Epic (Not on Branch)

```text
Claude: Available Epics:
1. [🟢 Active] Technical Debt Cleanup (2/3 sprints)

Which epic would you like to resume?

User: 1

Claude: [Performs analysis]

## Epic Status: Technical Debt Cleanup
[... analysis ...]

Current branch: main
Epic branch found: epic/technical-debt-cleanup-2025-11-15

Would you like to switch to epic/technical-debt-cleanup-2025-11-15? (yes/no)

User: yes

Claude: ✅ Switched to branch 'epic/technical-debt-cleanup-2025-11-15'

Creating memory bank resume entry...
[... continues ...]
```

---

### Example 3: Resume Epic (No Branch Exists)

```text
Claude: Available Epics:
1. [⏳ Pending] v1 Polish & UX (3/4 sprints)

Which epic would you like to resume?

User: 1

Claude: [Performs analysis]

Current branch: main
No epic branch found for this epic.

How would you like to proceed?

1. Create new epic branch: epic/v1-polish-2025-11-02
2. Create sprint branch: epic/v1-polish-2025-11-02/sprint/03-dialogue-buttons
3. Stay on current branch: main
4. Specify custom branch name

Which option? (1-4)

User: 1

Claude: Creating epic branch...
✅ Switched to branch 'epic/v1-polish-2025-11-02'

Creating memory bank resume entry...
[... continues ...]
```

---

## Edge Cases to Handle

### No Active Epics Found
If `.todo/epics/` is empty or all epics are complete:
```
No active epics found in .todo/epics/

All epics appear to be complete or archived. Would you like to:
1. Start a new epic (use /start-epic command)
2. Check archived epics (.todo/archived/epics/)
3. Resume a specific sprint without epic structure

Which option?
```

### Epic Marked Complete but User Wants to Resume
If epic status shows "✅ Complete" but user selects it:
```
⚠️ Warning: This epic is marked as COMPLETE.

Last completed: [date]
Status in epic doc: ✅ Complete

Are you sure you want to resume this epic? This might indicate:
- Epic needs additional work (re-open it)
- Documentation needs updating
- You meant to select a different epic

Continue resuming? (yes/no)
```

### Test Suite Failing
If `npm test` shows failures:
```
⚠️ Warning: Test suite has failures!

Tests: X failed, Y passed, Z total

This might indicate:
- Recent changes broke tests
- Tests need updating
- Environment issues

How would you like to proceed?
1. Fix failing tests first (recommended)
2. Continue anyway (not recommended)
3. Investigate test failures

Which option?
```

---

## Notes

- **Use existing epic examples** from `.todo/epics/` and `.memory-bank/` as templates
- **Always include timestamps** in memory bank filenames (YYYYMMDD-HHMM format)
- **Comprehensive analysis**: Read commits, memory bank, epic docs, sprint docs, AND test status
- **Branch safety**: Never force-create branches; always check for existing branches first
- **Session logging**: Memory bank entry is REQUIRED, not optional
- **Be helpful**: If epic structure is missing or incomplete, offer to fix it
