# Feature: `@` in the Workshop Composer to Attach a Project File

**Date Identified:** 2026-11-09
**Status:** Idea. Small to medium, mostly presentation: it reuses the existing catalog and attach routes. No ADR; the token-and-pill question is settled (A1).
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

## Decisions (Okey, 2026-11-10)

| # | Decision | What it means |
|---|---|---|
| A1 | **The pill is the truth.** Deleting a token leaves the file attached. | The token is prose in a plain textarea. Removing a pill leaves the text as it is, and deleting `@ch3` from the sentence leaves the pill. No rich input is needed. |
| A2 | **`@persona` is coming.** Reserve the namespace now. | The list is built with sections from the start: **Files** now, **People** later. A file token can never be read as a persona token (below). |

### Keeping file tokens and persona tokens apart (A2)

- **A file token always has a `.` or a `/`:** its extension
  (`@alice-ch3.md`), or its group path when it has none
  (`@characters/jill`).
- **A persona token never has either** (`@Jill`).
- So a reader of the message, the persona or any later parser, can tell the
  two apart from the token alone, before People exists.
- **A test pins the rule** for every token the file list can insert,
  duplicate basenames and extensionless files included.

## Open questions

- **This message, or the room?** `@` attaches to this message. Offer a way
  to add to room context instead, such as a modifier on the row ("Add to
  room context")?
- **What `@persona` does** (A2, later). Address a guest, invite one, or
  only mention them? That belongs to its own feature. This one only keeps
  the namespace free.
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
- [ ] Every file token holds a `.` or a `/`, so none can read as a persona
      token (A2). The list renders its Files section in a sectioned list
      that People can join.
- [ ] Deleting a token leaves its pill, and removing a pill leaves the text
      (A1).
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
