# Slice 4: Context Sheet Marks

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D4 (derived), D7 (the mark)
**Branch:** `epic-pinned-context-slice-4-sheet-marks`
**Status:** Waits on Slice 3 (the hook). Wayfinding's context sheet is in the
epic since the merge at `17d52cf`. Question 6 is decided: Pin from a pill, as
drawn.

## Outcome

In the Workshop's context sheet, a pinned pill shows a small pin mark. Its
tooltip says the file comes back in every new session, and that removing it
here removes it from this conversation only. A hovered, unpinned file pill
offers a small **Pin** button (question 6, as drawn in `Workshop.dc.html`).
Unpinning stays in the tab.

## Build

- The mark is derived with `workshopPinnedContextMatches` over the hook's
  entries and the pill's attachment (ADR D4). Nothing is stored in the
  session.
- It is drawn in the pill as 0d draws it: a small accent `pin` after the
  word count, with `role="img"` and the name "Pinned". The pill's
  accessible name gains ", pinned".
- **Pin** shows on a file pill that isn't pinned, on hover and focus, as 0d
  draws it. Its name is "Pin *label* for new sessions". It posts Slice 3's
  `WORKSHOP_PIN_CONTEXT_ATTACHMENTS` with the pill's attachment id, and adds
  no route. A text note or a wizard pill never offers it.
- A pinned pill offers no Unpin. The tab owns unpinning.
- The pill's Remove is unchanged.

## Tests

- The mark follows the list: pinning shows it, and unpinning clears it in
  the same room.
- A file attached under a catalog key and pinned under the same path
  matches. So does a workspace file pinned by `relativePath`. Two different
  paths never match.
- The accessible name and tooltip.
- Pin from a pill: it pins, the mark appears, and the button goes. The
  refusal past the budget or the 20-file bound is shown where the pill is.
  Text notes, wizard pills and pinned pills offer no Pin.

## Completion criteria

- [ ] The mark and tooltip match the approved design.
- [ ] No session-format change (`WorkshopSessionStateV1Shape` untouched).
- [ ] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-04.** Slice doc written with the spec.
