# Technical Debt

This directory contains active, concrete maintenance concerns that are not part
of the current feature scope. Resolved items belong in
`.todo/archive/tech-debt/`.

## What Belongs Here

A debt item should identify:

- A specific design or maintenance problem
- Current evidence in the repository
- The smallest credible improvement
- Risks and tradeoffs
- Related files or tests
- A status and review date

Feature requests, speculative redesigns, and completed sprint plans belong
elsewhere.

## Document Template

```markdown
# Descriptive Title

**Date Identified**: YYYY-MM-DD
**Reviewed**: YYYY-MM-DD
**Status**: Identified | In Progress | Deferred | Resolved
**Priority**: High | Medium | Low
**Estimated Effort**: ...

## Problem

## Recommendation

## Related Files

## Completion Criteria
```

## Workflow

1. Confirm the problem still exists in the current codebase.
2. Update stale paths, assumptions, and scope before scheduling work.
3. Prefer a focused debt item over a broad “clean up this area” instruction.
4. Implement on an isolated branch with relevant verification.
5. Mark the document resolved and move it to `.todo/archive/tech-debt/`.

## Active Inventory

| Priority | Item | Status |
|---|---|---|
| Medium | [Settings integration tests](2025-11-06-settings-integration-tests.md) | Deferred |
| Low | [Large-file responsibility review](2025-11-19-large-file-review-needed.md) | Deferred |
| Low | [AIResourceOrchestrator loop duplication](2025-11-25-ai-resource-orchestrator-loop-duplication.md) | Identified |
| Low | [Cancel-message duplication](2025-12-05-cancel-message-duplication.md) | Identified |
| Medium | [Streaming lifecycle duplication](2025-12-05-streaming-hook-duplication.md) | Identified |

## Review Guidance

- Review active debt when nearby code changes, not merely on a calendar.
- Archive completed and superseded documents promptly.
- Do not treat line count, abstraction count, or test coverage percentage as a
  defect without a concrete failure mode.
- When a broad item produces a specific actionable concern, split out the
  focused concern and narrow the parent document.
