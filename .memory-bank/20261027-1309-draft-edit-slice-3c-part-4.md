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
- Node 18.20.8 mirror on `0c21ad63`: typecheck, lint (0 / 1,133) and build
  pass; 579 suites / 8,164 tests / 59 snapshots (base 576 / 8,120).

## Follow-ups

- The fixture run's hits and false positives, for all four categories.
- Continuity across chapters: a story bible, queued separately.
- Then Slice 3b part 3.

## Review (PR #180, Astra, 2026-10-27)

Changes requested: three P2 findings, all on the scene-break rule, and two
P3 notes. All five fixed in this PR.
- **F-01:** a marker inside protected text (a heading in a code block) is
  left out before the signal is chosen. `detectChapterSections` takes an
  optional `ignored` predicate; the Lightbox passes none.
- **F-02:** the settled live text's sections are read again, and a pair a
  section the writer added during the run divides is dropped
  (`withinOneSection`).
- **F-03:** one predicate, `spansSectionStart`, reads the whole pair, from
  its earlier side's start to its later side's end, at placement and after
  the settle.
- **N-01:** `holds` is read from a `Map`, so an inherited name is malformed.
- **N-02:** section starts and break lines walk protected regions once, and
  nothing is read when continuity does not run. Counted-read tests hold it.

The new module is `application/services/draftEdit/craftFlagsSections.ts`.
Mutations: 14, all caught. One survived at first: the live recheck hid
the placement check. A case where a heading added after the pair makes the
live text read no break now holds the placement check on its own.

## Re-review (PR #180, Astra, 2026-10-27)

F-02, F-03, N-01 and N-02 resolved. F-01 stayed open for one case. Prose
over a fenced block's `---` in the same paragraph read as a setext heading,
its underline protected, and hid the real break. The detector's `ignored`
predicate is now asked with every line a marker's syntax spans (a setext
heading's text lines and its underline); Craft Flags leaves out a marker
any of whose lines starts inside protected text. Controls: backtick, tilde
and HTML-comment wrappers, a protected-text-only variation, CRLF, a genuine
setext title with code, and through the use case. Four new mutations, all
caught: one survived at first (the underline alone checked) until a
protected-first-line case pinned it.
