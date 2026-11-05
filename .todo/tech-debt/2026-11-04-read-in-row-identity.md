# Read-In Rows Have No Identity of Their Own

**Date Identified**: 2026-11-04 (Workshop Wayfinding Slice 3)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to medium: a host-minted row id, written only when present (D9), and the reader's request moved to it

## Problem

A manifest row (`ContextSourceEntry`) has no id. The reader names the row it
opened by `deliveredAt` plus `{ group, path }`, and the host takes the newest
`resource` row that matches (`findContextSourceRead`,
`infrastructure/api/orchestration/ContextSourceRecord.ts`).

`deliveredAt` is the engine's `Date.now()` when the run's sources were
collected. Two rows can share it in two cases:

- one round delivers the same file twice;
- two rounds of one run collect within the same millisecond.

When that happens, the reader shows the newest row's line range and "changed
since" for either row. Both rows describe the same file read in the same run,
so what the writer sees is close, but it isn't exact.

## Related files

- `packages/core/src/infrastructure/api/orchestration/ContextSourceRecord.ts`
- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts` (`toContextSourceEntries`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopReadInRoutes.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopReadIn.ts`

## Smallest credible improvement

1. Mint a per-conversation row id beside `art-N`, for example `src-N`.
2. Write it on new rows only.
3. Have the reader send it whenever the row has one.
4. Fall back to `deliveredAt` for rows stored before the change.

## Completion criteria

- Two rows that share a delivery time each open with their own provenance.
- A test covers that case.
- Rows stored before the change read and save unchanged.
