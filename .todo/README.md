# .todo Directory Structure

This directory tracks active product work, technical debt, and archived planning
records for the Prose Minion VS Code extension.

## Directory Organization

```text
.todo/
├── epics/              # Active multi-sprint initiatives
├── features/           # Active standalone feature ideas, one folder per feature
├── tech-debt/          # Active maintenance concerns
├── metrics-module/     # Active metrics specs and research
├── archive/            # Completed or superseded work
│   ├── epics/
│   ├── features/
│   ├── specs/
│   └── tech-debt/
└── README.md
```

## What Goes Where

### Epics

Use `.todo/epics/` for multi-sprint initiatives with architecture, sequencing,
or cross-cutting scope. Epics may contain sprint documents, decision notes,
screenshots, fixtures, and completion summaries.

Create:

```text
.todo/epics/epic-short-name-YYYY-MM-DD/
```

### Features

Use `.todo/features/` for standalone product or UX work that may need supporting
artifacts. Features are always folders, even when the initial note is small,
because they often grow screenshots, mockups, examples, review notes, or assets.

Create:

```text
.todo/features/feature-short-name/
├── README.md
└── assets/             # Optional: screenshots, mockups, supporting docs
```

The feature README should include status, motivation, scope, open questions,
acceptance criteria, and related files.

### Tech Debt

Use `.todo/tech-debt/` for concrete maintenance concerns with a specific failure
mode or cleanup opportunity.

Default to one Markdown file:

```text
.todo/tech-debt/YYYY-MM-DD-short-name.md
```

Use a folder only when the debt needs supporting files such as screenshots,
benchmark output, sample fixtures, or a multi-document investigation:

```text
.todo/tech-debt/YYYY-MM-DD-short-name/
├── README.md
└── evidence/
```

Each debt item should include the problem, recommendation, related files, risk,
priority, status, and completion criteria.

### Archive

Use `.todo/archive/` for completed, released, resolved, or superseded work.
Preserve enough history for future agents to understand why the work existed,
but move still-active follow-ups into `.todo/epics`, `.todo/features`, or
`.todo/tech-debt` before archiving.

## Adding New Items

1. Choose the smallest honest container: epic, feature folder, or tech-debt file.
2. Give the item a stable name and date where useful.
3. Link related ADRs, PR reviews, files, screenshots, and memory-bank entries.
4. State the current status: `Planned`, `Identified`, `Deferred`, `In Progress`,
   `Blocked`, `Resolved`, or `Archived`.
5. Write completion criteria before implementation begins.
6. If the item is discovered during unrelated work, capture it and keep moving
   unless it blocks the current task.

## Archiving Rules

Archive an item when:

- The work shipped, merged, or was explicitly superseded.
- No active follow-up remains inside the item.
- Any remaining work has been split into fresh `.todo` entries.
- The item status says `Archived`, `Released`, `Resolved`, or equivalent.
- A memory-bank entry exists for substantial completed work or release activity.

Do not archive:

- Partially complete epics with unfinished sprints.
- Product ideas that still need design decisions.
- Tech debt that still describes a current problem.
- Planning folders that still own active follow-up work.

When archiving a large folder, add an `ARCHIVE.md` or update its README with:

- Archive date
- Release or PR where it landed
- Summary of what completed
- Links to any follow-up items moved elsewhere

## Memory Bank

Use `.memory-bank/` for session continuity snapshots and release/completion
records. File names use:

```text
YYYYMMDD-HHMM-short-title.md
```

Create or update a memory-bank entry when:

- A release is prepared or completed.
- An epic or major feature is completed or archived.
- Architecture changes land.
- A long debugging session discovers important context future agents will need.
- Work pauses in a state that would be expensive to reconstruct later.

Memory entries should capture facts, decisions, verification run, known follow-up
work, and links back to `.todo`, ADRs, or PR reviews. Do not use memory-bank as a
replacement for active work tracking; live tasks belong in `.todo`.

## Current Active Inventory

### Active Epics

- `.todo/epics/epic-architecture-health-pass-v1.3/`

### Active Features

- `.todo/features/feature-full-tab-conversation-agent/`
- `.todo/features/feature-desktop-shell-adapter/`

### Active Tech Debt

See `.todo/tech-debt/README.md` for the active debt inventory.

## Related Documentation

- ADRs: `docs/adr/`
- Architecture overview: `docs/ARCHITECTURE.md`
- Memory bank: `.memory-bank/`
- Agent setup: `.ai/central-agent-setup.md`

---

**Last Updated**: 2026-06-29
