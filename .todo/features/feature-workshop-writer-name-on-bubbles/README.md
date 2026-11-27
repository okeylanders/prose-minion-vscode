# Feature: The Writer's Name on Their Own Bubbles

**Date Identified:** 2026-11-27
**Status:** Idea. Small. No ADR.
**Priority:** Medium
**Origin:** Okey, 2026-11-27

## In Okey's words

> If the user's (my) name is entered in the settings then my bubbles should
> show my name just like it shows Jill and/or other personas. That should
> easily backfill too.

## What exists

- **The name is already a setting.** About you
  (`proseMinion.workshop.writerProfile`) holds `preferredAddress`, the name
  personas call the writer (`WorkshopWriterProfile`,
  `shared/types/messages/workshop/settings.ts`; at most 80 characters).
- **Persona bubbles show a name;** the writer's bubble
  (`WorkshopWriterMessage`) shows none.

## Idea

- **The writer's bubble shows `preferredAddress`** where a persona's shows
  its name.
- **Read at render time, never stored on a turn.** Every bubble, old ones
  included, shows the current name, and a rename updates them all. Nothing
  changes in the session file.
- **Display only.** It never reaches a model. So it shows whenever a name
  is filled in, whether or not About you is switched on for personas (W1).
- **No name, no label,** as today.

## Decisions to make

| # | Question | Ada's lean |
|---|---|---|
| W1 | Show the name only while About you is on? | No: whenever it's filled in. Showing your own name to yourself shares nothing. |
| W2 | Use it in transcript exports too? | Yes, in place of "You". An export is the writer's own document. |

## Completion Criteria

- [ ] With a name set, every writer bubble shows it, earlier turns included;
      with none, nothing shows (tests).
- [ ] Changing the name updates every bubble without touching the session
      file (test).
- [ ] The name enters no model request (test).
- [ ] Exports follow W2.
- [ ] The help section on About you mentions it.

## Related Files

- `packages/core/src/shared/types/messages/workshop/settings.ts` (`WorkshopWriterProfile`)
- `packages/core/src/presentation/webview/components/workshop/reactions/WorkshopWriterMessage.tsx`
- `packages/core/src/application/services/workshop/export/` (W2)
