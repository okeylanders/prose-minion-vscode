# Feature: Lightbox Ribbon Structure

**Status**: Proposed
**Priority**: Medium
**Date**: 2026-10-20
**Origin**: The writer's new-sections draft (`docs/design/lightbox/NewLenses.dc.html`), left out of Slices 4B–4D on purpose
**Related**:
[Lightbox epic](../../epics/epic-lightbox-2026-10-19/README.md),
[ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md) D4 (the ribbon) and D12 (saved boards),
[Slice 4C](../../epics/epic-lightbox-2026-10-19/slice-4c-story-lenses.md) (the measured Sections lane and read movements),
[Slice 5](../../epics/epic-lightbox-2026-10-19/slice-5-saved-boards-and-compare.md) (a format with a list of sources)

## Problem / Motivation

The ribbon draws one column per paragraph up to 96 paragraphs. Above that,
each column covers an even run of paragraphs (D4): rhythm averaged, tension
maximized, focus lit if any paragraph in the run is touched. That is honest,
but at book length a column is an arbitrary slice that crosses scene and
chapter breaks, so the ribbon says little about the chapter's own shape.
Slice 4C detects real structure (headings, scene breaks, chapter lines) and
reads movements, but only draws them as lanes over the same even columns.

## Proposal

### The two-level ribbon

- Above 96 paragraphs, when the measured Sections layer (Slice 4C) finds
  structure, the ribbon's columns are **sections**, not even runs: one
  column per section, each labelled with its heading or break.
- A section column **expands in place**: clicking it (or Enter) opens that
  section's paragraphs as their own columns within the ribbon, keeping the
  other sections collapsed on either side; Escape or the section's label
  collapses it. Hover, pin and lighting work at both levels.
- When a section holds more than 96 paragraphs itself, it expands to even
  runs within the section, never across its edges.
- **With no structure found**, the ribbon keeps even runs and says so
  honestly: "≈N ¶ per column" in the ribbon's header, never implying a
  structure the text does not have.
- Every positional reading (tension, endings, engagement, pressure) keeps
  following content keys, so expanding never moves a score onto another
  paragraph.

### Multi-file boards

- A board of several files (a part, an act, a draft folder) collapses to one
  column per **file** at the top level, each expanding to its sections and
  then its paragraphs.
- Paragraph addresses become `{ source, index }`, which Slice 5's format
  already allows (a list of sources), so no migration is needed.
- Out of scope until the multi-chapter work: readings across files, and
  any baseline comparison between them (ADR open question 2).

### Movements as a read overlay

- The read movements (Slice 4C) can be shown as an **overlay** on the
  ribbon: hatched bands over the columns they span, in the read register,
  toggled on and off. They never become the ribbon's columns: columns are
  measured structure, movements are a reading of it.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxParagraphs.ts` (`bucketParagraphs`, `buildLightboxRibbon`)
- `packages/core/src/presentation/webview/components/lightbox/LightboxRibbon.tsx`
- `packages/core/src/presentation/webview/hooks/domain/lightbox/controllers/useLightboxFocus.ts` (`lightboxLitColumns`)
- Slice 4C's `LightboxSections` (planned)

## Completion Criteria

- A board of more than 96 paragraphs with headings shows one column per
  section and expands any section in place, by mouse and keyboard.
- A board with no structure says "≈N ¶ per column".
- Tension, endings, engagement and pressure stay on their paragraphs at
  every level, with a test per lane.
- A multi-file board collapses to files, with addresses that need no
  migration of a Slice 5 board.
- Movements draw as a toggled read overlay, never as columns.
