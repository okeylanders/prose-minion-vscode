# Feature: A Timestamp on Each Bubble

**Date Identified:** 2026-11-27
**Status:** Idea, decided: Okey took Ada's leans (2026-11-28). Small. No ADR.
**Priority:** Low
**Origin:** Okey, 2026-11-27

## In Okey's words

> Show timestamp next to model in persona bubble: Nov 26, Friday 11:10 AM.
> That should easily backfill too.

## What exists

- **Every turn already carries `timestamp`** (`WorkshopTurn`,
  `shared/types/messages/workshop/session.ts`). So old bubbles backfill
  with nothing stored.
- **A persona bubble shows its model** beside its name.

## Idea

- **Beside the model, the reply's time,** in Okey's order: month and day,
  weekday, time ("Nov 26, Thursday 11:10 AM"). The parts come from
  `Intl.DateTimeFormat` (`formatToParts`) in the writer's own locale, so
  names and the 12- or 24-hour clock follow it.
- **The full date and time as its tooltip,** and in a `<time datetime>`
  element for screen readers.
- **On the writer's bubbles too** (T1), in the same place their name goes
  ([#40](../feature-workshop-writer-name-on-bubbles/README.md)).

## Decisions (Okey, 2026-11-28: Ada's leans, taken)

| # | Question | Decision |
|---|---|---|
| T1 | Persona bubbles only, or the writer's too? | Both, so a room reads as a timeline. |
| T2 | Always the full date, or shorter for today ("11:10 AM")? | The full form Okey asked for, every time: it's unambiguous across sessions. |

## Completion Criteria

- [ ] Every bubble T1 covers shows its turn's time in the locale's format,
      earlier turns included (tests).
- [ ] The tooltip and `<time datetime>` carry the full timestamp (test).
- [ ] Nothing changes in the session file.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/presentation/webview/components/workshop/reactions/WorkshopWriterMessage.tsx`
