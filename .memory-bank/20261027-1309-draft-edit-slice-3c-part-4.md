# Draft Edit Slice 3c, part 4: continuity

**Date:** 2026-10-27
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox` at
`684bad24` (the PR #179 merge: Slice 3c part 3, gesture strain).
**Decision record:** ADR 2026-10-21, "Amendment 2026-10-26: Slice 3c",
"Part 4: continuity" (`5c98abf1`).
**Slice doc:** `.todo/epics/epic-draft-edit-2026-10-25/slice-3c-craft-flags.md`,
"Part 4: as built".

## Decisions

The writer decided continuity's approach with the other categories
(2026-10-26), as the slice doc describes it:
- the flag goes on the later place, with the earlier one linked;
- nothing is paired across a scene break;
- a narration fact is never set against a spoken one.

The ADR rows decide the build. No new question was put to the writer.

## What was built, in commits

1. **`e318ddb8`: shared sections.** The Lightbox's section detector moved to
   `utils/chapterSections.ts` (`detectChapterSections`), with neutral types
   in `shared/types/chapterSections.ts`. The Lightbox's message types alias
   them.
   - The blank-line rule moved to `utils/blankLineParagraphs.ts`.
     `splitLightboxParagraphs` wraps it and keeps its rule id, with the same
     output, so the recorded fingerprint holds.
   - `chapterSectionStarts(text, ignored)` gives each section's start as an
     offset.
   - A guard keeps Draft Edit off `@/infrastructure/lightbox/`.
2. **`a07db8bd`: related ranges on the port.** `DocumentAnnotation.related`.
   - `shiftRanges` moves each related range and drops the flag when an edit
     touches any.
   - `PlacedText.related` and `placesOf` hold every side to its text in
     `moveIssues`, and check it in `outsideProtected`.
   - `VsCodeIssueAnnotator` shows them as `DiagnosticRelatedInformation`.
3. **`0c21ad63`: continuity.**
   - Kinds are `body`, `object`, `place`, `time` and `people`.
   - The codec reads `earlier` and `holds`, and counts a `suggestion` as
     ignored.
   - Placement anchors both sides. It drops a pair across a section
     (`acrossBreak`), out of order or overlapping (unanchored), or touching
     speech or protected text on either side.
   - The use case sends `breaks`, masked, and prices them.
   - The note gives the holds line and no phrase count.
   - Prompts 40 and 41; the setting's enum and default.

## Verification

- Mutations: 16, all caught. One survived at first: the related-text check
  in `moveIssues` was hidden by a test whose edit also moved the flag's own
  side. The test now uses a same-length replacement.
- Node 18 mirror: see the PR.

## Follow-ups

- The fixture run's hits and false positives, for all four categories.
- Continuity across chapters: a story bible, queued separately.
- Then Slice 3b part 3.
