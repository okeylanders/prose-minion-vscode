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

The order everywhere is Decision · Canon · Theme · Preference · Idea · Open
thread: settled, then how the writer works, then unsettled.

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
- `WorkshopMemorySheet`: Theme ("What the story is about.") and Idea ("A
  possibility, not chosen yet."). The kind grid is three columns by two; at
  760px and below it stays two columns, three rows. Checked in Chromium at a
  688px sheet and at 360px.
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
- Lightbox's `open-thread` (`lightboxPlotTiles.ts`) is a separate vocabulary
  and is untouched.

## Tests

- `ProjectMemoryCodec.test.ts`: round-trips every kind in `PROJECT_MEMORY_KINDS`
  under both statuses, and pins the list and its order.
- `WorkshopMemorySheet.test.tsx`: six kind cards in order with their
  descriptions, and Theme and Idea pick like any other kind.
- `workshopMemoryManagerView.test.ts`: groups six memories, given in reverse,
  into the six groups in order. The unreadable-kind reason names all six.
- `projectMemoryPromptSync.test.ts`: the kinds section names exactly
  `PROJECT_MEMORY_KINDS`, in order. An idea is described as unsettled, never
  canon or a decision, and superseded when chosen. The canon/theme and
  idea/open-thread lines are present.
- `projectMemoryProposalPromptSync.test.ts`: already holds the named kinds to
  exactly `PROJECT_MEMORY_KINDS`; now it also pins the theme and idea boundary
  lines.

## Verification

See the coordinator message for the head and counts.

- `npm run typecheck`: clean.
- ESLint on the changed files: 0 errors. The 2 warnings are the existing
  `open-thread` keys (`WorkshopMemoryRow`, `MEMORY_KIND_WORDS`); the new label
  map's key has the same disable comment as the card and the sheet.
- Full jest: see below.
- No `from 'vscode'` in `packages/core/src`. No changed TS/TSX module is over
  500 lines (largest: 303, a test).
- Nothing new is logged. The fixtures use *Alice* names.
