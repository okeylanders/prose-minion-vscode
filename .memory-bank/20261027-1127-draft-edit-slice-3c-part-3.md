# Draft Edit Slice 3c, part 3: gesture strain

**Date:** 2026-10-27
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox` at
`98819b34` (the PR #178 merge: Slice 3c part 2, register shift).
**Decision record:** ADR 2026-10-21, "Amendment 2026-10-26: Slice 3c",
"Part 3: gesture strain" (`50d0610a`).
**Slice doc:** `.todo/epics/epic-draft-edit-2026-10-25/slice-3c-craft-flags.md`,
"Part 3: as built".

## The writer's decision

The model judges every gesture flag, a thin beat's included; host code only
counts each stock beat beside the note. Asked 2026-10-27. The writer chose
this over the recommended "host flags close repeats" and over a host
density threshold. It replaces the slice doc's host-flagged threshold.

## What was built

- **Category `gesture`** in `CRAFT_FLAG_CATEGORIES`, with kinds
  `impossible`, `complicated`, `thin` and `redundant`
  (`GESTURE_STRAIN_KINDS`, `GESTURE_STRAIN_DEFINITIONS` in
  `domain/models/CraftFlag.ts`).
- **Stock beats** (`utils/craftFlags/stockBeats.ts`):
  - `STOCK_BEATS` is a closed list with forms written out: nod, shrug, sigh,
    smile, grin, frown, wink, smirk, head shake, eye roll.
  - `stockBeatsIn(words)` gives the beats a quote names, in order.
  - `stockBeatCounts(text, skipped)` counts each beat once, lazily, by
    `phraseRepeats`' forward walk (`matchesOutside` and `joinedRanges`, now
    exported).
- **The note:** a gesture flag naming a beat carries `beats` (plural, count)
  in place of the phrase count: "Nods appear 4 times in this document, and
  smiles 2 times." Only beats that recur are named.
- **Not the tagger:** wink-pos-tagger measured 0.1 to 0.3 s per 25,000
  words on Node 18.20.8, and the narration baseline already holds it to a
  budget.
- **Speech:** `CRAFT_FLAG_LEAVES_SPEECH.gesture` is true. A gesture in a
  dialogue beat is outside the quotation marks, so it is read.
- **Prompts:** `craft-flags/30-gesture.md` and `31-gesture-example.md`. The
  example adapts *Alice* with one flag of each kind. The sister's four nods
  are counted, and her spoken "shrugging your shoulders" is left alone.
- **The shared prompt** now reads "Flag each use you find, unless the
  category's own section says which uses to flag."
- **Setting:** `proseMinion.craftFlags.categories` gains `gesture`, on by
  default.
- **Architecture guard:** `boundaries.test.ts` reads `GESTURE_*` and
  `Gesture[A-Z]` names as the Gesture Playground's. Gesture strain's four
  tokens are listed as collisions (`WORKSHOP_NON_FEATURE_SEMANTIC_COLLISIONS`).
- **Tests:** the Craft Flags run harness moved to `craftFlagsHarness.ts`,
  shared by `CraftFlagsUseCase.test.ts` and `CraftFlagsGesture.test.ts`.

## Verification

- Mutations: 15, all caught. One survived at first: the live-text count
  test added a nod at the document's start, so the shifted speech ranges
  happened to give the same count from the gesture's own text. The test
  now adds it at the end.
- Node 18.20.8 mirror on `12a5cef5`: typecheck, lint (0 / 1,133) and build
  pass; 576 suites / 8,117 tests / 59 snapshots (base 574 / 8,089).
- Astra's review (`cb360ee8`): no blocking findings. Two optional P3 notes,
  both defects in this PR's commits, taken in `8a91b197`:
  - N-01: a beat's overlapping aliases count once (`matchesOutside`'s
    `once`), and the compound eye roll takes `ed`;
  - N-02: `complicated`'s definition passes its own fence, and every kind's
    host why is held to it.
  Node 18 after: 576 suites / 8,120 tests / 59 snapshots.

## Follow-ups

- The fixture run's hits and false positives, for all three categories.
- A gesture that contradicts its line, after the fixture run.
- The Gesture Playground handoff, after the Workshop seam (Slice 4).
- Continuity (part 4); then Slice 3b part 3.
