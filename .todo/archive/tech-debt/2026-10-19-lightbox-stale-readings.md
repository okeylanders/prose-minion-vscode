# Lightbox Readings Vanish When the Chapter Changes

**Date Identified**: 2026-10-19 (Lightbox Slice 2B)
**Reviewed**: 2026-10-19
**Status**: Resolved in Lightbox Slice 3, 2026-10-19 (`epic/lightbox-slice-3-gravity`), before its handoff
**Priority**: Was Medium; resolved
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

## Resolution

Resolved on 2026-10-19 in Lightbox Slice 3 (`epic/lightbox-slice-3-gravity`),
ahead of the slice's Build-as-a-lens handoff.

- **Carry-over.** `LightboxService.buildBoard` still mints a new board for
  changed text, but now carries the replaced board's reading groups onto it
  through `LightboxStaleReadings.carryLightboxReadings` (pure). Each group
  that holds readings gets `staleLenses: [{ lens, readAgainst }]`, the hash
  of the text the lens was read against; a lens already stale keeps its
  first hash.
- **Re-verification.** Every found quote is checked again against the new
  paragraphs with the production verifier. A quote still in its paragraph
  stays; one whose paragraph moved follows its words to the nearest
  paragraph that holds them (the host moving its own verified span); one
  whose words are gone becomes a withheld quote with the new reason
  `no-longer-in-chapter` ("No longer in the chapter: the text changed after
  this was read, and these words are gone."). A claim left with no quote is
  withheld by title, and a motif left in one paragraph is withheld as a first
  reading would be. Every counted term is recounted (`LightboxTileCounts`,
  shared with first readings), and the voice's measured figure is measured
  again. Withheld quotes lose their "the words stand in ¶n" addresses, which
  pointed into the old text.
- **A group still being read** when the text changed is set aside as
  `cancelled` with a writer-facing reason; its run read the old text, and
  what it returns is dropped as before (logged). Forwarding such a result
  onto the new board, stale, is a follow-up:
  [2026-10-19-lightbox-forward-in-flight-readings](../../tech-debt/2026-10-19-lightbox-forward-in-flight-readings.md).
- **Clearing the mark.** A full run clears its groups' marks with their
  readings; a tile's re-read clears its own lens's mark; a failed or stopped
  call clears nothing (`LightboxReadingState`).
- **Webview.** A stale lens's frame and a stale reading in the inspector say
  "Stale · Read against an earlier version of this chapter…", the run line
  adds "N lenses stale" and keeps "Re-read", and a withheld quote shows the
  new reason.
- **Handoff.** Build as a lens refuses a stale field, and re-checks the
  field's quotes and the file's hash before anything reaches the Workshop.
- **Tests.** `LightboxStaleReadings.test.ts` covers a moved paragraph, a
  removed quote, a claim and a motif withheld, a group mid-run, marks kept and
  cleared, and the service's changed, unchanged and unread re-reads; the
  webview tests cover the labels and the run line.
