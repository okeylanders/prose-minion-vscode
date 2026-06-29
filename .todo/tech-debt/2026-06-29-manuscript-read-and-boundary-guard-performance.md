# Manuscript Read and Boundary Guard Performance

**Date Identified**: 2026-06-29
**Reviewed**: 2026-06-29
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Small

## Problem

Two low-impact performance notes were deferred during the migration review:

- Some manuscript/reference reads are sequential and could be parallelized.
- The architecture boundary guard scans source files synchronously.

At the current repository size and workflow, neither issue is measurable enough
to justify immediate churn.

## Recommendation

Revisit only if profiling, CI time, or user-facing latency shows this path
matters. Prefer a tiny targeted change: `Promise.all` for independent reads, or a
faster source-file discovery path for the guard.

## Related Files

- `packages/core/src/infrastructure/text/TextSourceResolver.ts`
- `packages/core/src/__tests__/architecture/boundaries.test.ts`

## Completion Criteria

- Evidence exists that the current behavior is worth changing.
- Independent reads are parallelized without altering error semantics.
- Boundary guard remains easy to understand and fails with actionable messages.
