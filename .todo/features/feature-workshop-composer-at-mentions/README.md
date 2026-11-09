# Feature: `@` in the Workshop Composer to Attach a Project File

**Date Identified:** 2026-11-09
**Status:** Idea. Small to medium, mostly presentation: it reuses the existing catalog and attach routes. No ADR, but the token-and-pill question below should be settled before building.
**Priority:** Medium
**Origin:** Okey, 2026-11-09

## In Okey's words

> Using the `@` symbol in chat compose to reference a file available in the
> project.

## Problem

Attaching a file to a message takes a detour: the attach button, then the
project picker, then a search, then a pick, then back to the sentence. A
writer mid-thought ("compare this with chapter 4") loses the sentence on the
way. In editors and chat tools, typing `@` and a few letters is the reflex.

## What is already in place

- **One-shot message attachments.** The composer already attaches a file to
  *this message only*: `onAttachToMessage` opens the shared project picker in
  `'message'` mode, and the file is staged as a removable pill
  (`WorkshopMessageAttachmentSnapshot`). That is separate from room context,
  which is re-sent and budgeted.
- **The routes.**
  - `WORKSHOP_ATTACH_MESSAGE_RESOURCES` stages files by catalog key
    (`ConfiguredResourceRef`, `{ group, path }`), never a path.
  - `WORKSHOP_ATTACH_MESSAGE_FILE` handles the system picker, for files
    outside the configured groups.
- **The catalog.** `WORKSHOP_REQUEST_CONTEXT_CATALOG` /
  `WORKSHOP_CONTEXT_CATALOG` gives `{ group, path, label, sizeBytes }` rows.
  Its contract already says "name matching is client-side: the webview
  already holds the catalog."

So `@` is a faster way into what exists. It needs no new host route.

## Idea

- **Typing `@`** at the start of the composer, or after a space or an
  opening bracket or quote, opens a list of project files. An `@` inside a
  word (an email address) doesn't.
- **Typing filters it** by name, client-side over the catalog, grouped by
  context group (characters, chapters, …), each row with its group and size.
  The last row, **Browse project…**, opens today's picker in `'message'` mode
  for anything else.
- **Picking a file** puts `@alice-ch3.md` in the text where `@…` was typed,
  and stages the file through `WORKSHOP_ATTACH_MESSAGE_RESOURCES`. The pill
  appears as it does today.
- **The persona sees both:** the token in the writer's words, and the
  attachment frame labeled with the same name. So "compare @ch3 with @ch4"
  resolves without guessing.

## Design notes

- **Enter belongs to the list while it's open.** Today Enter sends
  (`WorkshopComposer.tsx`, `handleKeyDown`).
  - While the list is open: ↑ and ↓ move, Enter or Tab picks, and Escape
    closes and keeps what was typed.
  - Enter sends only when the list is closed.
  - Nothing acts during IME composition (`isComposing`).
- **The combobox pattern.** The textarea gets `aria-autocomplete="list"`,
  `aria-controls` and `aria-activedescendant`, the list is a `listbox`, and
  the screen reader hears the count ("6 files").
- **Tokens are unique.** Two files can share a basename (`notes.md` in
  characters and in locations). The token uses the shortest unique path
  (`@characters/notes.md`), and the attachment frame's label matches it
  exactly.
- **No double attach.** Picking a file already staged for this message
  inserts the token, and stages nothing twice (compare by catalog key).
- **The shared picker doesn't change.** The list is a new composer
  component, so `WorkshopContextSelectorParity` and the picker's other tests
  stand as they are.
- **Bounds.** A message attachment already has its truncation rule and size
  in its pill, and `@` adds nothing new there.
- **Placement.** The simplest is a list anchored above the composer, as wide
  as it is. Anchoring at the caret in a textarea needs a mirror-element
  measurement, which can come later.

## Open questions

- **The token and the pill: which is the truth?** In a plain textarea a
  token is just text. Leaning: the pill is the truth and the token is prose.
  Removing a pill leaves the text, and deleting the token leaves the pill.
  Atomic tokens that delete as a unit (like Slack's) need a rich input
  instead of the textarea, which is a bigger change.
- **This message, or the room?** `@` attaches to this message. Offer a way
  to add to room context instead, such as a modifier on the row ("Add to
  room context")?
- **`@` for personas too?** Writers may later want `@Jill` to address a
  guest. If so, reserve the namespace now: the list would show Files and
  People sections.
- **Beyond configured files?** The catalog covers configured context groups.
  Is Browse project… enough for the rest, or should `@` list every text file
  in the workspace?

## Completion Criteria

- [ ] `@` at a word start opens the file list. An `@` inside a word doesn't.
- [ ] Typing filters by name. Picking inserts the token and stages the file
      by catalog key through the existing route. Browse project… opens the
      picker in `'message'` mode.
- [ ] Enter, Tab, ↑, ↓ and Escape behave as above, Enter sends only with the
      list closed, and IME composition is respected (tests).
- [ ] Duplicate basenames get unique tokens matching their frame labels.
- [ ] Picking a file already staged doesn't stage it twice.
- [ ] The combobox's ARIA is tested, and the shared picker's tests are
      unchanged.

## Related

- [Send the Editor Selection With Each Message](../feature-workshop-send-selection-with-message/README.md):
  another new way into message attachments.
- [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md)
  D11: staged message attachments.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx`
  (`handleKeyDown`, `onAttachToMessage`)
- `packages/core/src/presentation/webview/WorkshopApp.tsx`
  (`openContextSelector('message')`)
- `packages/core/src/shared/types/messages/configuredResources.ts`
  (`ConfiguredResourceEntry`)
- `packages/core/src/shared/types/messages/workshop/context.ts`
  (`WorkshopMessageAttachmentSnapshot`)
- `packages/core/src/shared/types/messages/base.ts`
  (`WORKSHOP_ATTACH_MESSAGE_RESOURCES`, `WORKSHOP_REQUEST_CONTEXT_CATALOG`)
- `packages/core/src/presentation/webview/components/workshop/workshopAttachmentPills.ts`
