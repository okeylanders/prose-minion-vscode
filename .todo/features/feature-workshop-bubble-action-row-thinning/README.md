# Feature: Thin the Workshop Bubble's Action Row

**Status:** Idea, not started
**Priority:** Low
**Filed:** 2026-11-12, from Reply Edit Actions (ADR 2026-11-10, Q6), where it was deferred by Okey's choice until the edit-offer chips were live.

## Problem

Okey, 2026-11-10: "Our bubbles are getting busy." Reply Edit Actions added
its chips without adding a row: the footer (`WorkshopTurnFoot`) holds the
edit-offer chips, the widget recommendation chip and the reaction corner.
The action row above it was left as it was. It still carries every per-turn
action at once (copy, save, bookmark, memory, rewind, branch and the rest),
and each new feature has added to it.

## Idea

Look at the action row on its own, now that the footer exists:

- which actions are used on most replies, and which a handful of times a
  session;
- whether the rare ones belong behind one "more" menu;
- whether any belongs in the footer beside the chips, or on the bubble's
  hover alone.

Nothing here is decided. It wants mockups against real threads before an ADR.

## Related files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/presentation/webview/components/workshop/editOffers/WorkshopTurnFoot.tsx`
- [ADR 2026-11-10](../../../docs/adr/2026-11-10-workshop-reply-edit-actions.md), U1 and Q6
- [Reply Edit Actions epic (archived)](../../archive/epics/epic-workshop-reply-edit-actions-2026-11-10/README.md)

## Completion criteria

- A before-and-after mockup of the action row on a persona reply, a writer
  message and a narrow column.
- Every action still reachable by keyboard, with its accessible name
  unchanged.
- No bubble has more rows than it has today.
