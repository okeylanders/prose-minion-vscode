# Persona Pronoun Metadata

**Status**: Open — writer decision needed
**Priority**: Low
**Discovered**: Sprint 05 (Show vs. Tell) Slice 5, 2026-10-09

## Problem

The Show vs. Tell recommendation seed banner must read *"Recommended and
prefilled by {persona}"* and derive pronouns from the persona. The persona
catalog holds no pronoun data, so the shipped banner names the persona and uses
no pronoun. The design's *"she proposes and prefills"* wording is not shipped.
Adding pronouns would require a catalog field, and that is a product decision
the writer has not made.

## Related files

- [Sprint 05 — Show vs. Tell](../epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md) (Recommend and prefill; Open follow-ups)
- `packages/core/src/shared/constants/workshopPersonas.ts` (persona catalog; no pronoun field today)
- `packages/core/src/presentation/webview/components/workshop/widgets/showVsTell/` (seed banner copy)
- [Slice 5 handoff](../../.memory-bank/20261009-1900-show-vs-tell-slice5-handoff.md) (Q3 and the pronoun note)

## Options

1. Keep the pronoun-free banner. Zero data changes, and the copy stays neutral.
2. Add an optional, writer-declared pronoun field to persona metadata. Derive
   the banner's pronoun from it only when present, and fall back to the
   pronoun-free copy otherwise. Never infer pronouns from a name.

## Completion criteria

- The writer has recorded a decision (option 1 or 2) in the sprint doc.
- If option 2 is chosen: the field is optional, defaults to absent, is
  validated in the persona catalog, and the banner uses it only when present.
  Tests cover present, absent, and invalid values.
