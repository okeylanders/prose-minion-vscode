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
| Medium | [Streaming lifecycle duplication](2025-12-05-streaming-hook-duplication.md) | Identified |
| Low | [AI service refresh duplication](2026-06-26-ai-service-refresh-duplication.md) | Identified |
| Low | [Secret-change key filtering](2026-06-26-secret-change-key-filtering.md) | Identified |
| Low | [MessageHandler self-heal cleanup](2026-06-26-messagehandler-self-heal-cleanup.md) | Identified |
| Low | [Word Search defaults product decision](2026-06-29-word-search-defaults-product-decision.md) | Deferred |
| Low | [TypeScript project references](2026-06-29-typescript-project-references.md) | Deferred |
| Low | [Logging and AI alias modernization](2026-06-29-logging-and-ai-alias-modernization.md) | Deferred |
| Low | [App-side VS Code Jest mock](2026-06-29-app-side-vscode-jest-mock.md) | Deferred |
| Low | [Manuscript read and boundary guard performance](2026-06-29-manuscript-read-and-boundary-guard-performance.md) | Deferred |
| Low | [Build command gate semantics](2026-06-29-build-command-gate-semantics.md) | Deferred |
| Low | [Workshop bounded turn packer](2026-07-14-workshop-bounded-turn-packer.md) | Deferred |

## Review Guidance

- Review active debt when nearby code changes, not merely on a calendar.
- Archive completed and superseded documents promptly.
- Do not treat line count, abstraction count, or test coverage percentage as a
  defect without a concrete failure mode.
- When a broad item produces a specific actionable concern, split out the
  focused concern and narrow the parent document.
