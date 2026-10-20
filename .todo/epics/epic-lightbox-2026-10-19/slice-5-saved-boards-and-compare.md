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

**The writer's checkpoint is passed (2026-10-20).** After real-chapter
passes the writer said the board "is working great", and asked for new
lenses first (Slices 4B–4D, epic decision 14), so this slice starts after
4D and its format holds them.

## What the format must hold (2026-10-20)

Fixed before the codec is written, so later boards need no migration:

- **Every tile kind** on the board when this slice starts: the measured
  tiles and every reading kind through Slice 4D (Groups A–F, including the
  craft, story and Opinion kinds), each with its host-derived fields
  (counts, column keys, tiers, the Opinion's citations), its withheld
  claims and blocks, frictions, quote checks and stale marks. The kind
  union is closed, so the codec is exhaustive over it like every other map.
- **The measured layers**: the paragraph model with each paragraph's
  sentence lengths, the ribbon, the measured set (including the numbers and
  the writer's average as measured, with its source counts), and the
  **Sections layer** from Slice 4C.
- **A list of sources**, not one: `sources: LightboxSource[]` with each
  paragraph addressed by `{ source, index }` (or an equivalent offset table),
  even though every board written by this slice has exactly one source. A
  multi-file board can then come later without a migration
  ([feature note](../../features/feature-lightbox-ribbon-structure/README.md)).
- Which Opinion view the writer looked at is **not** saved (a webview
  preference).

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
