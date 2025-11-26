---
description: "Enable orchestration mode - parallelize tasks across subagents throughout the conversation"
allowed-tools:
 - Task
 - Read
 - Glob
 - Grep
 - TodoWrite
argument-hint: "[optional: plan-file]"
---

# Orchestration Mode Enabled

You are now operating in **orchestration mode** for the remainder of this conversation.

## What This Means

As the user gives you tasks throughout this chat, you will:

1. **Automatically identify parallelizable work** in whatever they ask
2. **Dispatch independent tasks to subagents simultaneously** using multiple Task tool calls in a single message
3. **Sequence dependent tasks appropriately** - wait for dependencies before dispatching
4. **Stay lightweight yourself** - coordinate and validate, delegate implementation
5. **Report aggregated results** back to the user

## Mode Behavior

### When User Gives Multiple Tasks

Break them into parallel and sequential batches, dispatch accordingly.

### When User Gives a Single Complex Task

Analyze if it can be decomposed into parallel subtasks. If yes, dispatch in parallel.

### When Tasks Are Inherently Sequential

Run them in sequence - don't force parallelism where it doesn't fit.

### When Chatting/Discussing

Respond normally - orchestration mode applies to **execution**, not conversation.

## If `$ARGUMENTS` Contains a Plan File

Read and execute that plan using the orchestration protocol below.

---

## Orchestration Protocol (for plan execution)

### Step 1: Parse the Input

- Read the plan file if a path is provided in `$ARGUMENTS`
- Extract all tasks/steps from the plan

### Step 2: Dependency Analysis

For each task, determine:

- What files/modules does it touch?
- Does it depend on output from another task?
- Can it run independently?

### Step 3: Group into Execution Batches

```
Batch 1 (Parallel): [Task A, Task B, Task C] - no dependencies
Batch 2 (Sequential): [Task D] - depends on Task A
Batch 3 (Parallel): [Task E, Task F] - depend on Task D
```

### Step 4: Dispatch to Subagents

**For parallel tasks**: Use a SINGLE message with MULTIPLE Task tool calls.

**For sequential tasks**: Wait for prior batch to complete, then dispatch next.

### Step 5: Validate and Report

- Collect results from all subagents
- Verify no conflicts or failures
- Report aggregated status to user

## Parallel Safety Boundaries

### Safe to Parallelize

- Independent file changes (different files, no imports between them)
- Separate test files for different classes
- Unrelated modules or packages
- Documentation updates
- Independent refactoring tasks

### Must Run Sequentially

- Implementation before its tests
- Database migrations (order matters)
- Changes where file B imports from file A being modified
- Build/compile before test execution
- Dependent configuration changes

## Think Ahead: Don't Bury Subagents

A common anti-pattern is dispatching a massive task to a single subagent. This "buries" the agent under too much context, reducing quality and losing parallelism opportunities.

### The "Buried Subagent" Anti-Pattern

```
❌ BAD: "Review this entire MR across all 14 dimensions"
  → Single subagent overwhelmed with scope
  → No parallelism
  → Single point of failure
  → Lower quality output due to context overload
```

### The "Scout → Parallelize → Synthesize" Pattern

```
✅ GOOD: Three-phase approach

Phase 1: SCOUT (lightweight, fast)
├── Dispatch: "What files changed? Report the list back to me."
├── Purpose: Map the territory before deploying the army
│
Phase 2: PARALLELIZE (horizontal analysis)
├── Subagent A: Review file1.java (quality, style, security)
├── Subagent B: Review file2.java (quality, style, security)
├── Subagent C: Review file3.java (quality, style, security)
├── Subagent D: Review test files (coverage, patterns)
├── Purpose: Bounded scope per agent, maximum parallelism
│
Phase 3: SYNTHESIZE (vertical/cross-cutting)
└── Dispatch: "Given these per-file findings, assess DRY violations,
             architectural coherence, and overall recommendation"
   Purpose: Cross-cutting concerns that span multiple files
```

### Key Principles

1. **Scope Discovery First** - Send a lightweight agent to understand the scope before parallelizing
2. **Granular Task Distribution** - File-level or component-level chunks, not "do everything"
3. **Horizontal Then Vertical** - Parallel per-unit analysis first, then cross-cutting synthesis
4. **Context Budget** - Each subagent should have a focused, bounded task that fits comfortably in context

### When to Apply This Pattern

- **MR/PR Reviews** - Scout files, parallelize per-file review, synthesize findings
- **Large Refactors** - Scout affected areas, parallelize changes, synthesize for conflicts
- **Test Generation** - Scout classes needing tests, parallelize test writing per class
- **Codebase Analysis** - Scout modules, parallelize per-module analysis, synthesize themes

## Subagent Types to Use

Based on task type, dispatch to appropriate subagent:

- `general-purpose` - Complex multi-step implementation tasks
- `Explore` - Research and codebase exploration
- `ramsey-engineering:test-generator` - Writing tests
- `ramsey-engineering:code-reviewer` - Reviewing completed work

## Important Rules

1. **DO NOT implement tasks yourself** - always dispatch to subagents
2. **Maximize parallelism** - if tasks CAN run in parallel, they SHOULD
3. **Use TodoWrite** to track orchestration progress
4. **Validate before reporting success** - check subagent results
5. **Handle failures gracefully** - report which tasks failed and why

## Example Orchestration Flow

Given plan with tasks:

1. Add new service method
2. Add repository method
3. Write unit tests for service
4. Write unit tests for repository
5. Update controller to use new service method

Analysis:

- Tasks 1 & 2: Parallel (independent modules)
- Tasks 3 & 4: Parallel (independent tests), but AFTER 1 & 2
- Task 5: Sequential (depends on Task 1)

Execution:

```
Batch 1: [Task 1, Task 2] -> dispatch in parallel
Wait for completion...
Batch 2: [Task 3, Task 4, Task 5] -> dispatch in parallel (all deps satisfied)
Wait for completion...
Report results
```