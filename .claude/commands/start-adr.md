# Start Epic from ADR

You are helping the user implement an epic based on an Architecture Decision Record (ADR).

## Your Task

Follow these steps in order:

### Step 1: Select ADR
Ask the user which ADR they want to implement. List available ADRs from `docs/adr/` directory.

### Step 2: Review ADR
Read the selected ADR file and summarize:
- The decision being implemented
- Key technical approaches
- Major components involved

### Step 3: Ask About Branch Strategy
**IMPORTANT**: Ask the user:
> "Should all sprints for this epic be implemented in a single epic branch (e.g., `epic/feature-name`) or should each sprint have its own branch (e.g., `epic/feature-name/sprint/01-name`, `epic/feature-name/sprint/02-name`)?"

Wait for their answer before proceeding.

### Step 4: Create Epic Structure
Based on the ADR, create the epic documentation structure in `.todo/epics/[epic-name]/`:

1. **README.md** - Epic overview with:
   - Overview section
   - Goals
   - Sprint breakdown (brief description of each sprint)
   - Completion criteria
   - Related ADRs reference

2. **sprint-XX.md** files - One per sprint with:
   - Goals (specific deliverables)
   - Tasks (checkboxes)
   - Technical Notes
   - Completion Criteria

### Step 5: Commit Epic Docs
After creating the epic documentation:
1. Stage all files: `git add .todo/epics/[epic-name]/`
2. Commit with message: `[EPIC: UPPERCASE-NAME] docs: create epic structure for [Epic Name]`
3. Stay on main branch (do NOT switch yet)

### Step 6: Ask to Start
Ask the user:
> "Epic documentation created and committed to main. Ready to start implementation? (yes/no)"

If yes, proceed to Step 7. If no, stop here.

### Step 7: Create Branch and Begin

1. Create the epic/sprint branch based on the user's earlier choice:
   - Single branch strategy: `git checkout -b epic/[epic-name]`
   - Multiple branch strategy: `git checkout -b epic/[epic-name]/sprint/01-[sprint-name]`
2. Confirm the branch was created
3. Ask which sprint to start with (typically Sprint 01)
4. Begin working on the first task from that sprint

## Important Guidelines

- **Use existing epic examples** from `.todo/epics/centralized-logging/` as templates
- **Follow commit conventions**: All commit messages must use `[EPIC: UPPERCASE-NAME]` or `[SPRINT XX]` prefix
- **Be thorough**: Break down complex features into manageable sprint tasks
- **Ask questions**: If the ADR lacks details, ask the user for clarification
- **Stay organized**: Each sprint should have clear, achievable goals

## Example Flow

### Single Epic Branch Strategy

```text
Claude: Which ADR would you like to implement? I found:
- ADR 003: Centralized Polling System
- ADR 004: Centralized Logging System (✅ Complete)
- ADR 005: Domain Hooks Pattern

User: ADR 003

Claude: [Reviews ADR 003 and summarizes]

Claude: Should all sprints for this epic be implemented in a single epic branch
(e.g., `epic/centralized-polling`) or should each sprint have its own branch
(e.g., `epic/centralized-polling/sprint/01-name`)?

User: Single epic branch

Claude: [Creates epic structure]
Created:
- .todo/epics/centralized-polling/README.md
- .todo/epics/centralized-polling/sprint-01.md
- .todo/epics/centralized-polling/sprint-02.md
- .todo/epics/centralized-polling/sprint-03.md

Committing to main...
✅ Committed: [EPIC: POLLING] docs: create epic structure for Centralized Polling System

Epic documentation created and committed to main. Ready to start implementation? (yes/no)

User: yes

Claude: Creating epic branch...
✅ Switched to branch 'epic/centralized-polling'

Which sprint should we start with? (typically Sprint 01)

User: Sprint 01

Claude: Starting Sprint 01: Core PollingManager Infrastructure
[Begins implementation]
```

### Multiple Sprint Branch Strategy

```text
User: Multiple sprint branches

Claude: [Creates epic structure and commits to main]

✅ Committed: [EPIC: POLLING] docs: create epic structure for Centralized Polling System

Epic documentation created and committed to main. Ready to start implementation? (yes/no)

User: yes

Claude: Creating sprint branch...
✅ Switched to branch 'epic/centralized-polling/sprint/01-core-infrastructure'

Starting Sprint 01: Core PollingManager Infrastructure
[Begins implementation]
```
