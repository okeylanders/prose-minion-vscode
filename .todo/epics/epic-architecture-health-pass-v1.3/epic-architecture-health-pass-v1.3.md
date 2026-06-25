# Epic: Architecture Health Pass (v1.3)

**Created**: 2025-11-21
**Reviewed**: 2026-06-25
**Status**: Near Complete
**Progress**: 17/18 sprints complete

## Current Scope

The implementation work from the first three sub-epics and the first three
Polish & UX sprints is complete and has been moved to:

`../../archive/epics/epic-architecture-health-pass-v1.3-2025-11-21/`

One sprint remains:

- [CSS Pattern Standardization](sub-epic-4-polish-ux/sprints/04-css-pattern-standardization.md)

## Completed Work

### Foundation Cleanup

- Result formatter decomposition
- Shared message-type and import hygiene
- Typed hook-object props and reduced prop drilling

### Component Decomposition

- Component directory organization
- Shared `ScopeBox`, `LoadingIndicator`, and `WordCounter`
- Search and metrics panel extraction

### Standards & Testing

- Standards-service responsibility cleanup
- Centralized token-usage reporting
- Infrastructure API reorganization
- Settings-hook documentation and tests
- Named callback extraction for domain effects

### Polish & UX

- Error boundaries
- React memoization pass
- Streaming responses and request cancellation

## Remaining Outcome

Establish and document the current styling convention:

- Custom CSS for reusable component semantics
- Tailwind utilities for one-off layout and spacing
- `--pm-*` design tokens for theme-aware colors
- Inline styles only for genuinely dynamic values

`SettingsOverlay` will serve as the reference cleanup rather than triggering a
repository-wide visual rewrite.

## Related Active Debt

- [Settings integration tests](../../tech-debt/2025-11-06-settings-integration-tests.md)
- [Large-file responsibility review](../../tech-debt/2025-11-19-large-file-review-needed.md)
- [AIResourceOrchestrator loop duplication](../../tech-debt/2025-11-25-ai-resource-orchestrator-loop-duplication.md)
- [Cancel-message duplication](../../tech-debt/2025-12-05-cancel-message-duplication.md)
- [Streaming lifecycle duplication](../../tech-debt/2025-12-05-streaming-hook-duplication.md)

These are follow-up debt, not unfinished acceptance criteria for the completed
sprints.
