# Slice 4: Context Sheet Marks

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D4 (derived), D7 (the mark)
**Status:** Waits on Slice 3 (the hook), and on Wayfinding's context sheet on
`main`. Pin and Unpin from a pill wait on question 6.

## Outcome

In the Workshop's context sheet, a pinned pill shows a small pin mark. Its
tooltip says the file comes back in every new session, and that removing it
here removes it from this conversation only. If Okey answers yes to
question 6, the pill's menu also offers **Pin for new sessions** or **Unpin**.

## Build

- The mark is derived with `workshopPinnedContextMatches` over the hook's
  entries and the pill's attachment (ADR D4). Nothing is stored in the
  session.
- It is drawn in the pill as 0d draws it, with the glyph 0d chose. The
  pill's accessible name gains ", pinned".
- Pin and Unpin from a pill (question 6) post Slice 3's
  `WORKSHOP_PIN_CONTEXT_ATTACHMENTS` and `WORKSHOP_UNPIN_CONTEXT`. They add
  no route.
- The pill's Remove is unchanged.

## Tests

- The mark follows the list: pinning shows it, and unpinning clears it in
  the same room.
- A file attached under a catalog key and pinned under the same path
  matches. So does a workspace file pinned by `relativePath`. Two different
  paths never match.
- The accessible name and tooltip.
- If question 6 is yes: Pin and Unpin from a pill, including the refusal
  past the budget, shown where the pill is.

## Completion criteria

- [ ] The mark and tooltip match the approved design.
- [ ] No session-format change (`WorkshopSessionStateV1Shape` untouched).
- [ ] The epic's verification passes, with counts recorded here.

## Progress

- **2026-11-04.** Slice doc written with the spec.
