<p align="center">
  <img src="../assets/prose-minion-book.png" alt="Prose Minion" width="120"/>
</p>

<p align="center">
  <strong>Prose Minion AI Agents Setup</strong><br/>
  Guide for working with Claude, Cline, and project documentation
</p>

---

# AI Agents Setup

This document describes how to work with AI coding assistants on the Prose Minion project and where to find project knowledge resources.

## Supported AI Agent Tools

The project supports multiple AI coding assistants, each with its own symlinked configuration file pointing to a central source:

| Agent Tool | Symlink Location | Source File | Status |
|------------|------------------|-------------|--------|
| **Codex** | `AGENTS.md` | `.ai/central-agent-setup.md` | ✅ Symlinked |
| **Claude Code** | `.claude/CLAUDE.md` | `.ai/central-agent-setup.md` | ✅ Symlinked |
| **Cline** | `.clinerules/prose-minion-agent.md` | `.ai/central-agent-setup.md` | ✅ Symlinked |

All three symlinks point to the **same central configuration file**, ensuring consistency across all AI tools.

## Central Agent Setup

**Source File**: `.ai/central-agent-setup.md`

This file contains:
- Project context and architecture
- Coding conventions
- Common patterns
- Tool usage guidelines
- Example workflows

### Why Symlinks?

- **Single source of truth** - Update `.ai/central-agent-setup.md` once, all agents see the changes
- **Multi-tool support** - Works with Codex, Claude Code, and Cline simultaneously
- **Accessible** - Each tool finds its config in the expected location
- **Version controlled** - Track agent setup evolution
- **Maintainable** - No duplicate configuration files

### How the Symlinks Work

```bash
# All three point to the same file:
AGENTS.md → .ai/central-agent-setup.md
.claude/CLAUDE.md → .ai/central-agent-setup.md
.clinerules/prose-minion-agent.md → .ai/central-agent-setup.md
```

When you edit the central file, all three symlinks reflect the changes immediately.

### Updating Agent Setup

```bash
# Edit the source file
code .ai/central-agent-setup.md

# All symlinks automatically reflect changes
cat AGENTS.md                                    # Same content
cat .claude/CLAUDE.md                            # Same content
cat .clinerules/prose-minion-agent.md            # Same content
```

### Creating Symlinks (If Needed)

If symlinks are missing, recreate them:

```bash
# Codex symlink
ln -sf .ai/central-agent-setup.md AGENTS.md

# Claude Code symlink
mkdir -p .claude
ln -sf ../.ai/central-agent-setup.md .claude/CLAUDE.md

# Cline symlink
mkdir -p .clinerules
ln -sf ../.ai/central-agent-setup.md .clinerules/prose-minion-agent.md
```

## Project Documentation Structure

The project maintains several documentation systems for different purposes:

### 1. **Architecture Decision Records (ADRs)**

**Location**: `docs/adr/`

**Purpose**: Document architectural decisions with rationale and consequences

**Format**:
- Status: Proposed | Accepted | Deprecated | Superseded
- Date: YYYY-MM-DD
- Context: Why was this decision needed?
- Decision: What was decided?
- Consequences: What are the impacts?
- Alternatives Considered: What else was evaluated?

**Recent ADRs**:
- `2025-10-26-webview-settings-module.md` - Settings overlay implementation
- `2025-10-26-message-architecture-organization.md` - Domain-organized messages
- `2025-10-26-token-usage-and-cost-widget.md` - Token tracking UI
- `2025-10-24-word-frequency-enhancements.md` - Enhanced word frequency features

**When to Create an ADR**:
- Significant architectural changes
- Technology choices (libraries, frameworks)
- Design pattern decisions
- Breaking changes
- Major refactorings

### 2. **Memory Bank**

**Location**: `.memory-bank/`

**Purpose**: Session notes and context for AI assistants

**Format**: `YYYYMMDD-HHmm-description.md`

**Contents**:
- Session focus and goals
- Key changes made
- Open questions
- Next steps
- Discoveries and insights

**Example**:
```
.memory-bank/
├── 20251027-0915-settings-header-and-context-paths.md
├── 20251026-2015-sprint-5-settings-overlay-progress.md
└── ...
```

**Usage**:
- Quick context for resuming work
- Breadcrumbs for AI assistants
- Session summaries
- Not formal documentation (more like lab notes)

### 3. **Epic and Sprint Planning**

**Location**: `.todo/epics/`

**Purpose**: Track larger initiatives across multiple sprints

**Structure**:
```
.todo/epics/
└── epic-search-architecture-2025-10-19/
    ├── epic-search-architecture.md      # Epic overview and plan
    └── sprints/
        ├── 01-search-module.md
        ├── 02-word-search-integration.md
        ├── 03-metrics-ux-improvements.md
        ├── 04-token-widget.md
        └── 05-settings-module.md
```

**Epic Document Contains**:
- Vision and goals
- Success criteria
- Sprint breakdown
- Timeline
- Dependencies

**Sprint Documents Contain**:
- Sprint goal
- Tasks
- Affected files
- Acceptance criteria
- Progress updates

### 4. **Pull Request Templates**

**Location**: `docs/pr/`

**Purpose**: Pre-written PR descriptions ready to copy/paste

**Example**:
```
docs/pr/
└── sprint-05-settings-module-and-context-paths.md
```

## Working with AI Assistants

### Context Loading Strategy

When starting a new session with Claude or Cline:

1. **Start with AGENTS.md** - Loads core project context
2. **Reference specific ADRs** - For architectural context
3. **Check Memory Bank** - For recent session notes
4. **Review Sprint Docs** - For current goals

### Example Prompts

**Loading Project Context**:
```
Read AGENTS.md to understand the project architecture and conventions
```

**Getting Recent Context**:
```
Check the latest memory bank entry in .memory-bank/ 
to see what was worked on recently
```

**Understanding a Decision**:
```
Read docs/adr/2025-10-26-webview-settings-module.md 
to understand why we chose this approach
```

**Sprint Context**:
```
Review .todo/epics/epic-search-architecture-2025-10-19/sprints/05-settings-module.md
to see the current sprint goals
```

### Best Practices

**DO**:
- ✅ Load AGENTS.md at session start
- ✅ Reference specific ADRs for context
- ✅ Update Memory Bank after sessions
- ✅ Check sprint docs for current goals
- ✅ Ask agent to read relevant files

**DON'T**:
- ❌ Assume agent knows project without loading docs
- ❌ Make architectural changes without checking ADRs
- ❌ Skip updating Memory Bank after significant work
- ❌ Ignore sprint acceptance criteria

## Creating New Documentation

### When to Create an ADR

```bash
# Create new ADR
code docs/adr/YYYY-MM-DD-descriptive-name.md
```

Use the template:
```markdown
# ADR: Descriptive Title

Status: Proposed
Date: YYYY-MM-DD

## Context
[Why is this decision needed?]

## Decision
[What are we deciding to do?]

## Alternatives Considered
[What else did we evaluate?]

## Consequences
[What are the impacts of this decision?]

## Implementation Notes
[Technical details, file references]

## Links
[Related docs, sprint docs, branches]
```

### When to Create a Memory Bank Entry

```bash
# After a significant session
code .memory-bank/$(date +%Y%m%d-%H%M)-session-description.md
```

Include:
- Focus of the session
- Key changes made
- Open questions
- Next steps

### When to Create a Sprint Doc

```bash
# For each sprint in an epic
code .todo/epics/epic-name-YYYY-MM-DD/sprints/NN-sprint-name.md
```

Include:
- Sprint goal
- Tasks list
- Acceptance criteria
- Progress updates

## Directory Reference

```
prose-minion-vscode/
├── .ai/                      # AI agent configurations
│   └── central-agent-setup.md
├── .memory-bank/             # Session notes for AI context
│   └── YYYYMMDD-HHmm-*.md
├── .todo/                    # Planning and tracking
│   └── epics/
│       └── epic-*/
│           ├── epic-*.md     # Epic overview
│           └── sprints/      # Sprint breakdowns
├── docs/                     # User and developer docs
│   ├── adr/                 # Architecture Decision Records
│   ├── pr/                  # PR description templates
│   ├── DEVELOPER_GUIDE.md   # This guide
│   ├── ARCHITECTURE.md      # System design
│   ├── CONFIGURATION.md     # Settings reference
│   ├── TOOLS.md            # Tool documentation
│   └── PROSE_STATS.md      # Metrics algorithms
└── AGENTS.md                # Symlink to .ai/central-agent-setup.md
```

## Tips for Effective AI Collaboration

### 1. Set Clear Context

Before asking for code changes:
```
I'm working on Sprint 5 (Settings Module). 
Read .todo/epics/epic-search-architecture-2025-10-19/sprints/05-settings-module.md
to understand the goals, then help me with...
```

### 2. Reference Decisions

When discussing architecture:
```
According to docs/adr/2025-10-26-message-architecture-organization.md,
we organize messages by domain. How should I add...
```

### 3. Document Your Session

At end of session:
```
Create a memory bank entry summarizing:
- Context Paths UI improvements completed
- Glob pattern primer added
- Next: Add screenshots to README
```

### 4. Maintain Continuity

Next session:
```
Read the latest memory bank entry to catch up on what was done last time
```

## Common Workflows

### Starting a New Feature

1. Check if there's a sprint doc for it
2. Read relevant ADRs for architectural context
3. Load AGENTS.md for project conventions
4. Create ADR if making significant architectural decisions
5. Update Memory Bank when done

### Debugging an Issue

1. Check Memory Bank for recent related work
2. Review ADRs for design decisions that might relate
3. Check sprint doc acceptance criteria
4. Load AGENTS.md for debugging patterns

### Code Review Prep

1. Review changed files against ARCHITECTURE.md
2. Check that changes align with relevant ADRs
3. Verify sprint acceptance criteria are met
4. Update Memory Bank with PR context

## Additional Resources

- **AGENTS.md** (symlink) - Quick access to agent setup
- **.ai/central-agent-setup.md** - Source of truth for agent configuration
- **docs/adr/** - All architectural decisions
- **.memory-bank/** - Session history and context
- **.todo/epics/** - Epic and sprint planning

## Getting Help

- Check the Memory Bank for recent context
- Review ADRs for architectural decisions
- Reference sprint docs for current goals
- Read AGENTS.md for project conventions
