# Excerpt POV Metadata

**Status**: Open
**Priority**: Low
**Discovered**: Sprint 05 (Show vs. Tell) Slice 0, 2026-10-08

## Problem

Show vs. Tell's POV constraint field is writer-editable and can be prefilled
by a persona, but it cannot be seeded from the room excerpt. Workshop excerpts
carry no point-of-view metadata, so every new draft starts at `unspecified`
unless the writer or a persona fills it in. Creative Variations has the same
gap: POV only appears there as free text in *must not change*.

## Related files

- [Sprint 05 — Show vs. Tell](../epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md) (POV constraint input)
- `packages/core/src/shared/types/messages/workshop/context.ts` (excerpt contracts)

## Options

1. A writer-declared POV on the excerpt or project (mode plus focal
   character), stored with the excerpt context.
2. A deterministic or model-assisted POV guess. A guess must be labelled as
   inferred and must never be treated as a constraint until the writer
   confirms it.

## Completion criteria

- Excerpts can carry an honestly-labelled POV, either declared by the writer
  or inferred and then confirmed.
- Show vs. Tell seeds its POV field from that metadata, labelled with its
  provenance, without overriding a writer's or persona's explicit value.
