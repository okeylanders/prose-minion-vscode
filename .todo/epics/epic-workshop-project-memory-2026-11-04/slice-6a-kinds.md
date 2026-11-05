# Slice 6a: Theme and Idea

**Status:** In review
**Branch:** `epic/workshop-project-memory-slice-6a-kinds` (from `epic/workshop-project-memory` at `0a0f1a5b`)
**Decision:** [ADR 2026-11-04, Addendum 2026-11-05](../../../docs/adr/2026-11-04-workshop-project-memory.md#addendum-2026-11-05-theme-and-idea)

## Scope

Okey's live-pass ask: add two memory kinds, `theme` and `idea`, beside
`decision`, `canon`, `preference` and `open-thread`. The persona prompts teach
the boundaries:

- **theme:** what the story is about, a meaning or motif it keeps returning
  to. Canon is what happens; a theme is what it means.
- **idea:** a possibility the writer floated and hasn't chosen. Never canon or a
  decision, and not an open thread either: the open thread is the question, and
  the idea is a candidate answer. When an idea is chosen, the decision or canon
  memory that records the choice supersedes it.

The order everywhere is Decision · Canon · Theme · Idea · Open thread ·
Preference: settled, then unsettled, then how the writer works. (The first
brief put Preference fourth; Okey moved it last on 2026-11-05.)

## What changed

- `PROJECT_MEMORY_KINDS` (`shared/types/projectMemory.ts`) holds six kinds in
  that order, with each kind's meaning in its doc comment. Every reader of the
  list takes the new kinds from it: the codec (format 1), the draft check in
  `workshopProjectMemoryWrites.ts`, the proposal protocol and records, the
  `memory.catalog` codec and the library's filter.
- `workshopMemoryWords.ts`:
  - The row words gain `theme` and `idea`.
  - `MEMORY_KIND_GROUPS` is now built from `PROJECT_MEMORY_KINDS` over a label
    map, adding "Themes" and "Ideas", so the manager's order can't drift.
  - The unreadable `kind` reason builds its list from the constant: "decision,
    canon, theme, preference, idea or open-thread".
- `WorkshopMemorySheet` adds Theme ("What the story is about.") and Idea ("A
  possibility, not chosen yet.").
- The kind cards show six across or 3×2, and nothing in between (Okey's rule):
  - The field around the radio group is a named container
    (`.pm-ws-memory-kind-field`, `container: pm-ws-memory-kinds / inline-size`).
  - The grid is `repeat(3, …)` by default. It becomes `repeat(6, …)` only under
    `@container pm-ws-memory-kinds (min-width: 940px)`, which is six 150px cards
    plus five 8px gaps.
  - It never uses `auto-fit` or `auto-fill`, so no row is ever 5+1 or 4+2.
  - Under the existing 760px stack rule, it is 2×3.
- Measured in Chromium:
  - The field is at most 988px wide: the sheet is up to 1040px, minus 26px
    padding on each side. So six across appears only on a wide panel.
  - On one line, the widest card ("A possibility, not chosen yet.") needs 156px
    in the default sans font and 167px with a Segoe-style stack. Keeping every
    description on one line would need about 1,000–1,050px, which the sheet
    never reaches.
  - At 940px, names never wrap, but the Idea and Open thread descriptions take
    two lines. The row stretches the cards to one height. By 988px every
    description fits on one line.
  - Field widths checked: 988 → 6, 940 → 6, 939 → 3, 688 → 3.
- `WorkshopMemoryCard` labels gain the two kinds. In `WorkshopMemoryRow`'s
  icons, theme is `orbit` (a motif the story circles) and idea is `sparkle`.
- `project-memory-capability.md` gains "What each kind means", which says how
  settled each kind is. An idea is unsettled: never canon or a decision, named
  as an idea when raised, and superseded when chosen. The `memory.catalog` kind
  list and the "when to look" line name the new kinds.
- `project-memory-proposals.md` gets two new "when to suggest" lines and a
  six-kind `<kind>` list, with the canon/theme and idea/open-thread boundaries
  and the rule to supersede a chosen idea. Its one worked example (canon) is
  unchanged.
- The ADR gets a dated addendum, and its keys-table row points to it. The
  epic README gets a 6a row. `slice-6-verify-live.md`'s write path gets a
  Theme/Idea check.

## Deviations

- **The catalog frame is unchanged.** It already writes `kind="…"` straight
  from the memory, so `kind="idea"` reaches the persona as is. The prompt, which
  is taught whenever the frame is, says what an idea means. I didn't add
  per-entry wording to the frame: that would put prose in a data block and
  change the frame's token estimates. The "idea is unsettled" test is therefore
  a prompt test (`projectMemoryPromptSync`), not a frame test.
- **Design snapshot and feature note.** `docs/design/workshop-project-memory/`
  and `.todo/features/feature-workshop-project-memory/README.md` keep the four
  kinds they were written with, as snapshots of history.
- The manager has no row of kind chips or filters, only the Kind/Date grouping
  toggle. So the six-or-three rule applies to the sheet alone.
- Lightbox's `open-thread` (`lightboxPlotTiles.ts`) is a separate vocabulary
  and is untouched.

## Tests

- `ProjectMemoryCodec.test.ts`: round-trips every kind in `PROJECT_MEMORY_KINDS`
  under both statuses, and pins the list and its order.
- `WorkshopMemorySheet.test.tsx`: six kind cards in order with their
  descriptions, and Theme and Idea pick like any other kind.
- `workshopMemoryManagerView.test.ts`: groups six memories, given in reverse,
  into the six groups in order. The unreadable-kind reason names all six.
- `workshopMemoryKindGrid.test.ts` (new) pins the grid rule:
  - 3 columns by default;
  - 6 only under the kind field's container query, at `6 × 150 + 5 × 8` px;
  - 2 only under the 760px media rule;
  - never `auto-fit` or `auto-fill`;
  - the sheet's radio group sits in that container.
- `webviewCssFloor.test.ts` passes: `@container` is Chromium 105, inside the
  114 floor.
- `projectMemoryPromptSync.test.ts`: the kinds section names exactly
  `PROJECT_MEMORY_KINDS`, in order. An idea is described as unsettled, never
  canon or a decision, and superseded when chosen. The canon/theme and
  idea/open-thread lines are present.
- `projectMemoryProposalPromptSync.test.ts`: already holds the named kinds to
  exactly `PROJECT_MEMORY_KINDS`; now it also pins the theme and idea boundary
  lines.

## Verification

Under Node, on this branch:

- `npm run typecheck`: clean (core, webview, extension).
- `npm run lint`: 0 errors and 1,165 warnings, the same as the base
  (`0a0f1a5b`). The new label map's `open-thread` key has the same disable
  comment as the card and the sheet.
- Full jest: 692 suites, 9,707 tests and 59 snapshots, all passing.
  `webviewCssFloor` is among them.
- No `from 'vscode'` in `packages/core/src`. No changed TS/TSX module is over
  500 lines; the largest is a 303-line test.
- Nothing new is logged. Fixtures use *Alice* names.
- `WorkshopMemoryBrowserModal.test.tsx` pinned the old group order. It now
  expects Open threads before Preferences.
