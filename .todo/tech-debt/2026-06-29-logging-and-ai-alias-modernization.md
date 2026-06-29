# Logging and AI Alias Modernization

**Date Identified**: 2026-06-29
**Reviewed**: 2026-06-29
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Medium

## Problem

Prose Minion predates some FrameMinion conventions. It currently uses granular
API aliases such as `@services`, `@orchestration`, `@providers`, and `@parsers`
under `infrastructure/api`, and logging is modeled through the narrower
`LogSink` port. Some constructor parameters are still named `outputChannel` even
when their type is now `LogSink`.

This works, but the naming and alias structure are less cohesive than the newer
FrameMinion-style `@ai` and `@logging` barrels.

## Recommendation

Treat this as a focused modernization PR, not incidental cleanup inside feature
work. Decide whether Prose Minion should adopt:

- A richer `LoggingService` wrapper over `LogSink`
- `@logging` and `@ai` barrels
- `outputChannel` to `logger` parameter renames where the type is no longer a
  concrete VS Code output channel

Preserve the host boundary: `packages/core` should still depend on ports and
host-agnostic services, not VS Code APIs.

## Related Files

- `packages/core/src/platform/LogSink.ts`
- `packages/core/src/infrastructure/api/`
- `packages/core/src/application/handlers/`
- `tsconfig.base.json`

## Completion Criteria

- Chosen alias/logging pattern documented.
- Renames and alias changes land with low churn and no behavior changes.
- No `vscode` imports are introduced into `packages/core`.
- Typecheck, tests, lint, and architecture guards pass.
