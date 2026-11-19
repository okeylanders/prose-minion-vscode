# Earlier turns are re-read whole after every session state

**Date Identified**: 2026-11-18
**Status**: Deferred (until the live pass says it is heavy, or Q7 is answered)
**Priority**: Low
**Estimated Effort**: Medium
**Source**: [ADR 2026-11-17](../../docs/adr/2026-11-17-everyday-conveniences-round-two.md), "Consequences and risks" (item A) and Q7

## Problem

`useWorkshopEarlierTurns` re-reads the whole loaded run, page by page,
after every `WORKSHOP_SESSION_STATE` in the same room (ADR D5). A writer
who has loaded 500 earlier turns causes five page reads (each up to
`PROMPT_BUDGETS.workshopThread.pageBytes`, 1 MiB) after each state change:
a send, a reply settling, a reaction. The reads are read-only and bounded,
but most of them return what the webview already holds. The ADR named the
cost and left the fix unbuilt.

## Recommendation

- If the live pass finds it heavy: put a stamp on the snapshot (a ledger
  generation per page range) and skip a page whose stamp is unchanged.
- If Okey answers Q7 the lighter way (load once, mark "as of when
  loaded"), close this note instead.

## Related Files

- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopEarlierTurns.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/earlierTurns/workshopEarlierTurnsRun.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopEarlierTurnsHandler.ts`

## Completion Criteria

- Either unchanged pages are skipped (test: a state change with nothing new
  reads no page), or Q7 is answered and this note is closed.
