# Slice 5: Saved Boards and Draft Compare

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D12
**Status:** Planned (last, by writer decision 5)

## Before starting

This slice fixes the board as a file format, so it begins only after the
writer has reviewed Slices 2B–4 output on real chapters. Record that review
in the epic's progress notes: what the writer changed, removed or asked to
keep. Then adjust the board contract **before** writing the codec. Fields
that did not earn their place are removed now, while that is still free.

## Outcome

Boards save automatically after a completed reading run. They reopen with
the tab, and they survive window reloads. The Boards rail lists the saved
boards for the open source, newest first. **Compare** picks an earlier board
and shows:

- measured deltas on the stat tiles;
- the earlier tension arc as ticks on the ribbon;
- fields, motifs and lineage items that appeared or vanished;
- a one-line drift summary, as a reading.

When the paragraph count changed between the boards, the paragraph-aligned
views are labeled approximate.

## Host

- `infrastructure/storage/LightboxBoardCodec.ts` (pure):
  - `formatVersion: 1`, exact-key decoding, and invalid entries counted and
    dropped;
  - no migrations: this is the first released shape;
  - separate from the Workshop session codec, as transcript export is.
- `infrastructure/storage/LightboxBoardStore.ts`:
  - files at `prose-minion/boards/<source-slug>/<timestamp>.board.json`;
  - availability follows `LexicalGravityLensRepository` (no folder or
    several folders means session-only, stated in the UI);
  - writes are serialized and atomic, through the same commit-point pattern
    as `DictionaryHistoryStore`;
  - it never overwrites a file it cannot read;
  - logs never carry the writer's text.
  - It is built in `extension.ts` and added to `CoreServices`.
- Routes:
  - `LIGHTBOX_REQUEST_BOARDS` / `LIGHTBOX_BOARDS` (summaries);
  - `LIGHTBOX_OPEN_BOARD`;
  - `LIGHTBOX_DELETE_BOARD`;
  - `LIGHTBOX_COMPARE` / `LIGHTBOX_COMPARISON`.
- The comparison is computed by the host and is deterministic, except for the
  drift line, which comes from one small call that the writer presses for.
- The ADR's "readings are lost on reload" consequence is removed, and the
  ADR is amended with the final format.

## Tests

- Codec: round trip; unknown `formatVersion`; invalid entries dropped and
  counted; a fixture written by this slice's build becomes the regression
  fixture for any future migration.
- Store: availability modes, atomic write, unreadable file preserved.
- Compare: identical boards; paragraph count changed (approximate label);
  fields added and removed.

## Done when

A board survives a window reload. Two drafts of the same chapter compare,
with the deltas and the drift shown.
