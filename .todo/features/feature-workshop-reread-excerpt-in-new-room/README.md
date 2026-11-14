# Feature: Re-read From File in a New Room That Kept Its Excerpt

**Date Identified:** 2026-11-11
**Status:** Idea. Small, webview-only: the host already allows it.
**Priority:** Medium. It's a step a writer takes every time they start a new room on a chapter they've been editing.
**Origin:** Okey, 2026-11-11

## In Okey's words

> When starting a new session and keeping the excerpt and context, on the
> new screen there's no easy button to just re-read the excerpt and bump the
> version. I have to re-select it from the list. We should keep the re-read
> button there.

## Why it happens

`ExcerptPanel` shows **Re-read from file** only when the room already has a
conversation *and* the excerpt came from a file:

```tsx
// ExcerptPanel.tsx
{roomHasMemory && fileBacked ? (
  <button … onClick={onRereadFile}>Re-read from file</button>
) : (
  /* Paste or type, Choose from project… */
)}
```

A new room that kept its excerpt has no conversation yet, so
`roomHasMemory` is false. The card offers **Paste or type** and **Choose
from project…**, and the writer has to find the same file in the list again
to pick up their edits.

There are two places this bites:

1. **A new room with the excerpt carried** (`WorkshopSessionStart` `carry`):
   the pinned card, before the first message.
2. **"Continue with *title* vN"**, the button shown when a passage carried
   over (`onContinueWithExcerpt`). It continues with the stored version,
   with no way to take the file's current text instead.

## The host already allows it

`WORKSHOP_REREAD_EXCERPT` (`WorkshopExcerptScopeHandler.handleRereadExcerpt`)
doesn't need a conversation. It refuses only:
- while a run is going;
- when the excerpt isn't file-backed;
- when the file can't be authorized.

When the file is unchanged it says so (`sourceFingerprint`) instead of
bumping the version. So the fix is in the webview.

## Idea

- **On a file-backed excerpt, show Re-read from file whenever the excerpt
  is file-backed,** with or without a conversation.
  - Before the room's first message, keep **Choose from project…** beside
    it, since picking another file is still a fresh choice then.
  - Once the room has a conversation, today's locked card stays as it is.
- **On "Continue with *title* vN",** when that passage is file-backed, add
  **Continue with the file's current text**. It continues, then re-reads, so
  edits land as vN+1, and unchanged text says so and stays vN.
- **The version carries.** A carried v3 that the file changed becomes v4,
  so the version stays continuous across rooms, as Okey asked ("bump the
  version").

## Open questions

- **Is "Continue with the file's current text" worth a second button,** or
  should Continue always re-read a file-backed passage and say "unchanged"
  when it is? Leaning: always re-read. It's what a writer who edited the
  chapter wants, and an unchanged file costs nothing.

## Completion Criteria

- [ ] In a new room with a carried, file-backed excerpt, Re-read from file
      shows before the first message, and an edited file lands as the next
      version (test).
- [ ] Continue on a file-backed carried passage takes the file's current
      text (or offers to), and says when it's unchanged.
- [ ] A room with a conversation shows today's card, unchanged.
- [ ] A pasted (non-file) excerpt shows no Re-read.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx`
  (`roomHasMemory && fileBacked`, `onContinueWithExcerpt`)
- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts`
  (`WORKSHOP_REREAD_EXCERPT`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopExcerptScopeHandler.ts`
  (`handleRereadExcerpt`)
