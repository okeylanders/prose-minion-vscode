# Feature: `@persona` in the Workshop Composer

**Date Identified:** 2026-11-18
**Status:** Identified. Split out of [`@` in the Workshop Composer](../feature-workshop-composer-at-mentions/README.md) (decision A2, "later") at the Round Two epic's close.
**Priority:** Low
**Origin:** Okey, decision A2 of item G (PR #271)

## Problem

Item G reserved the namespace and built the `@` list in sections
(**Files** now, **People** later). A file token's first word always holds
a `.` or a `/` (`isWorkshopFileMentionToken`), so a persona token
(`@Jill`) can never read as a file. Nothing yet happens for a person.

## Open questions

- What does `@Jill` do: address a guest already in the room, invite one,
  or only mention them?
- Does it change the chat target for this message only, or for the room?
- Is the token prose (as a file token is, decision A1), or a control?

## Constraints from item G

- The People section joins `WorkshopComposerMentionList`; the shared
  picker and its parity tests stay untouched.
- Nothing reads a token back out of a draft for files (A1). If a persona
  token must be read, that is a new decision, recorded in an ADR.
- Folded matching through `foldedTextSearch`; no pattern built from what
  the writer typed.

## Completion Criteria

- [ ] An ADR decides what a persona mention does.
- [ ] The People section lists the room's participants (and invitable
      personas, if decided), with the keyboard path and ARIA tested.

## Related Files

- `packages/core/src/presentation/webview/utils/workshop/workshopComposerMentions.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopComposerMentions.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopComposerMentionList.tsx`
