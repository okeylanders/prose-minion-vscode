# Start Epic

You are helping the user start or resume work on an existing epic.

## Your Task

Follow these steps in order:

### Step 1: Select Epic

List available epics from `.todo/epics/` directory with status information:

- Epic name
- Number of sprints
- Which sprints are complete/in-progress

Ask the user which epic they want to work on.

### Step 2: Review Epic Structure

Read the epic README.md and sprint files, then summarize:

- Epic goals and scope
- Available sprints with brief descriptions
- Current progress (which sprints are complete/in-progress)
- Related ADRs (if any)

### Step 3: Ask About Branch Strategy

**IMPORTANT**: Ask the user:

> "Should all sprints for this epic be implemented in a single epic branch (e.g., `epic/feature-name`) or should each sprint have its own branch (e.g., `epic/feature-name/sprint/01-name`, `epic/feature-name/sprint/02-name`)?"

Wait for their answer before proceeding.

### Step 4: Ask Which Sprint to Start

Ask the user:

> "Which sprint should we start with?"

List the available sprints to help them choose.

### Step 5: Create Branch and Begin

1. Create the epic/sprint branch based on the user's earlier choice:
   - Single branch strategy: `git checkout -b epic/[epic-name]`
   - Multiple branch strategy: `git checkout -b epic/[epic-name]/sprint/[NN]-[sprint-name]`
2. Confirm the branch was created
3. Begin working on the first task from that sprint

## Important Guidelines

- **Follow commit conventions**: All commit messages must use `[EPIC: UPPERCASE-NAME]` or `[SPRINT NN]` prefix
- **Stay organized**: Work through sprint tasks methodically
- **Ask questions**: If sprint scope is unclear, ask the user for clarification
- **Update sprint docs**: Check off tasks as you complete them

## Example Flow

### Single Epic Branch

```text
Claude: Which epic would you like to work on? I found:
- epic-unified-settings-architecture-2025-11-03/ (5 sprints, Sprint 01 complete)
- epic-search-architecture-2025-10-19/ (3 sprints, all complete ✅)
- epic-v1-polish-2025-11-02/ (4 sprints, Sprint 01-02 complete)

User: epic-unified-settings-architecture-2025-11-03

Claude: [Reviews epic structure]

Epic: Unified Settings Architecture
Status: In Progress (1/5 sprints complete)

Goals:
- Standardize all settings using domain hooks pattern
- Fix critical SearchTab settings bugs
- Achieve 100% persistence coverage

Available Sprints:
- Sprint 01: SearchTab Urgent Fix ✅ COMPLETE
- Sprint 02: Backend Semantic Methods (pending)
- Sprint 03: Frontend Domain Hook Extraction (pending)
- Sprint 04: Settings Panel Integration (pending)
- Sprint 05: Cleanup & Documentation (pending)

Related ADRs:
- ADR 2025-11-03: Unified Settings Architecture

Claude: Should all sprints for this epic be implemented in a single epic branch
(e.g., `epic/unified-settings-architecture`) or should each sprint have its own branch?

User: Single epic branch

Claude: Which sprint should we start with?

User: Sprint 02

Claude: Creating epic branch...
✅ Switched to branch 'epic/unified-settings-architecture-2025-11-03'

Starting Sprint 02: Backend Semantic Methods
[Begins implementation]
```

### Multiple Sprint Branches

```text
Claude: [Same epic selection and review as above]

Claude: Should all sprints for this epic be implemented in a single epic branch
or should each sprint have its own branch?

User: Multiple sprint branches

Claude: Which sprint should we start with?

User: Sprint 02

Claude: Creating sprint branch...
✅ Switched to branch 'epic/unified-settings-architecture-2025-11-03/sprint/02-backend-semantic-methods'

Starting Sprint 02: Backend Semantic Methods
[Begins implementation]
```
