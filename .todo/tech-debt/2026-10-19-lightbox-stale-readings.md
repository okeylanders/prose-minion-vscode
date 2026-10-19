# Lightbox Readings Vanish When the Chapter Changes

**Date Identified**: 2026-10-19 (Lightbox Slice 2B)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Medium (service carry-over, a re-verification pass, a stale label, tests)

## Problem

ADR 2026-10-19 D4 says a board whose file changes keeps its readings visible,
labeled stale, and re-verifies their quotes before anything goes to the
Workshop. Slice 2B does not do this. `LightboxService` reuses a board's id
and readings only when the text's content hash is unchanged; a changed
chapter gets a new board id and empty readings, so a writer who fixes a typo
and re-reads the file loses paid readings without warning.

A run still in flight when the text changes lands on the old board, which is
no longer retained, and is dropped (the handler logs "its board is gone").

## Recommendation

When a source's hash changes, carry the predecessor's reading groups onto the
new board with a `stale` mark (and the hash they were read against). Re-run
the quote verifier against the new paragraphs: a quote found again keeps its
evidence under its new address; a quote no longer found is withheld with a
"no longer in the chapter" reason. Label stale tiles in the webview and keep
the run line's press as "Re-read". Do this before Slice 3's handoffs, which
must not carry an unverified quote into the Workshop.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxService.ts` (`assemble`, `buildBoard`)
- `packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts`
- `packages/core/src/infrastructure/lightbox/LightboxReadingState.ts`
- `packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxReadings.ts`

## Completion Criteria

- Changing one paragraph keeps the board's readings, marked stale, with
  each quote re-verified against the new text.
- The webview labels stale readings, and a fresh run clears the mark.
- Tests cover a moved paragraph, a removed quote and an unchanged re-read.
