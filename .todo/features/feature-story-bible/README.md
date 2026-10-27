# Feature: story bible (facts across chapters)

**Status:** Queued (2026-10-27), from Draft Edit Slice 3c part 4.
**Priority:** Low. Craft Flags' continuity covers one chapter; this is the
next step, not a gap in what shipped.
**Related:** [Slice 3c: Craft flags](../../epics/epic-draft-edit-2026-10-25/slice-3c-craft-flags.md)
("Continuity", "Out of scope"); ADR 2026-10-21, "Part 4: continuity".

## Problem

Craft Flags' continuity reads one chapter at a time, and never across a
scene break within it. The slips a writer most fears cross chapters:
- a character's eyes are grey in chapter 2 and green in chapter 9;
- a scar moves sides;
- a sister becomes a cousin.

No single call can read a whole manuscript. Comparing chapter against
chapter would cost a call per pair.

## Shape (to decide in an ADR)

A project resource of facts, kept by the writer, that a run reads beside a
chapter:
- names and their facts: hair, eyes, height, scars, kin, where they live;
- places and objects that recur.

Slice 3b's word list (`proseMinion.proofread.wordList`) is its first piece:
names the project accepts. Open questions:
- Who writes it: the writer, or a model that proposes facts the writer
  accepts?
- Where it lives: a project file the Workshop and the Lightbox can read too.
- How a fact is cited when a chapter contradicts it: the flag sits in the
  chapter, and the related place is the bible's entry.

## Related files

- `packages/core/src/application/services/draftEdit/CraftFlagsUseCase.ts`
- `packages/core/src/application/services/draftEdit/craftFlagsPlacement.ts`
  (related places: `DocumentAnnotation.related` can point to another
  document only once the port allows it)
- `packages/core/src/utils/proofread/proofreadWordList.ts`

## Completion criteria

- An ADR decides the resource's format, who edits it, and how a run reads
  and cites it.
- A contradiction between a chapter and the bible is flagged in the
  chapter, linked to the bible's entry, with the same flag-only rules as
  continuity (never which is right, dialogue left alone).
- No live or billable provider calls in tests; public-domain fixtures only.
