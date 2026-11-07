# Feature: Several Workshop and Lightbox Tabs at Once

**Date Identified:** 2026-11-07
**Status:** Idea. Epic-sized, the Workshop half especially: one live room becomes one room per tab. ADR first.
**Priority:** Medium
**Origin:** Okey, 2026-11-07

## In Okey's words

> This may be a big request, but loading multiple Workshop and Ideabox tabs
> at the same time.

("Ideabox" is read here as the **Lightbox**, the other full tab.)

## Problem

Each full tab is one per window. Opening the Workshop or the Lightbox again
reveals the tab that is already open. So a writer can't:

- keep one room on chapter 3 and another on the series bible;
- run a Lightbox board on chapter 3 beside chapter 4's;
- try the same question with two personas side by side.

Switching means saving, opening the other session or source, and switching
back.

## Why it is one tab today

- **The panels.** `WorkshopPanelProvider` and `LightboxPanelProvider` each
  hold one `panel?`, and `openOrReveal()` reveals it when it exists.
- **The Workshop's room is one per window.** `extension.ts` builds one
  `WorkshopSessionService` (line 287) and one
  `WorkshopSessionPersistenceCoordinator`. The unnamed room is one file,
  `current.json`. 37 files read "the live room" in some form:
  - pinned context's `askLiveRoom()`;
  - recall's `recallScope()` and the open room's bookmarks
    (`readLiveRoomBookmarks`);
  - seed delivery;
  - `roomRevision`.
- **The Lightbox's board is one per window.** One `LightboxService`
  (line 499) owns the writer's source intent, the tickets that decide which
  source request may adopt a board (`beginSourceRequest`), the adoption
  (`adoptionOf`), the reload pointer, and "one run at a time".

## What is already ready for it

- **One `MessageHandler` per panel.** Each panel builds its own, so routes
  are already per tab.
- **Tabs come back after a reload,** through `deserializeWebviewPanel`.
- **The Lightbox keeps several boards.** `LightboxRetainedBoards` is a map
  with a limit, evicting the least recently adopted. What is singular is
  which one is *current*.
- **The board store already handles several writers.** Another window's
  store shares the folder, so saves are staged under UUIDs, rewrites are
  claimed, and saves land at the revision a window read. Two tabs in one
  window are an easier case of two windows.
- **Seed delivery already names its receiver.** Each Workshop mount announces
  a receiver id, and every claim names it. Targeting one of several tabs
  builds on that.
- **Named sessions are files,** so two tabs can hold two of them without a
  new format.

## Shape (for the ADR)

### The Lightbox: a board owner per tab (the smaller half, first)

- **Shared per window:** `LightboxService` keeps the measurement and the
  retained boards, and the store and library keep their one queue.
- **Per tab:** source intent and tickets, the current board and its
  adoption, the run, and the reload pointer. These move to a per-tab owner
  keyed by a tab id. The tab id lives in the panel's restored state, never in
  a message from the webview.
- **The source-ownership rules hold per tab:**
  - a ticket is taken before the first await;
  - only the newest ticket adopts;
  - an overtaken seed opens nothing.
  - "Open File in Lightbox" opens in the focused Lightbox tab, or a new one.

### The Workshop: a room per tab

- **A room registry.** Each tab owns a room: its session state, room
  revision, current file and room-replacement transaction, keyed by a room
  id. Built once in `extension.ts`.
- **Shared per window:** the session store (one queue), the recall service
  (one cache), the pinned-context store, project memory and the helper.
- **Everything that asks for "the live room" names one.** That covers
  pinned context, recall's open-room bookmarks, memory proposal provenance,
  the helper's memory draft, export, and the shutdown flush (every room).
  - Step one changes no behavior: thread the room id through with one room.
- **Several unsaved rooms (T1, Okey 2026-11-07: "we have to support
  that").** Each tab's unsaved room has its own current file. One naming,
  to be settled in the ADR, is a GUID per room (`current-<uuid>.json`).
  Session files are Marketplace writer data (ADR 2026-07-30), so whatever
  the naming, an existing writer's `current.json` must still restore,
  exactly as it does today. Either it is read as the first room, or a
  one-time migration moves it to the new name.
- **One tab per named session.** Opening a session another tab holds
  reveals that tab, the way VS Code reveals an open file. Two rooms writing
  one session file would overwrite each other.
- **Seeds pick a tab.** Bring to Workshop, a Lightbox tile and Send Selection
  to Workshop go to the most recently focused Workshop tab, or to a new one
  if none is open. Whether to ask instead is an open question.

### Slices (a sketch for the epic)

| # | Slice | Outcome |
|---|---|---|
| 0 | Spec | ADR and epic |
| 1 | Lightbox tabs | A per-tab board owner, a New Lightbox tab command, per-tab restore |
| 2 | One room, by id | The Workshop's room behind a registry holding one room. Everything that reads the live room names it. No behavior change. |
| 3 | Workshop tabs | A second room, its current file, per-tab restore, New Workshop tab |
| 4 | Rules between tabs | One tab per named session, seed targeting, Branch into a new tab |
| 5 | Live pass | Several tabs of each, a reload, a shutdown |

## Decisions (Okey, 2026-11-07)

| # | Decision | Left for the ADR |
|---|---|---|
| T1 | **More than one unsaved Workshop room**, each in its own tab, is required. | How current files are named (GUIDs, for example) and how today's `current.json` carries over. |

## Open questions

- **A closed tab's unsaved room (T1).** Today, closing the Workshop keeps
  `current.json`, and reopening restores it. With a current file per room,
  does a closed tab's room stay, listed in the session browser as unsaved
  and reopenable? Or is it discarded on close, after a confirmation?
  Without a rule, unsaved room files pile up.
- **The same chapter in two Lightbox tabs?** Allowed, so two boards can be
  compared, or reveal the tab that has it?
- **Branch into a new tab?** Branch already never writes its source, so
  "branch here and keep the original open beside it" fits well.
- **Seeds: ask or guess?** Send to the last focused Workshop tab, or show a
  small "Send to: chapter 3 room / bible room" choice when several are
  open?
- **How many tabs?** Each is a webview with its own React app. Cap it, or
  leave it to the writer?
- **What a tab is named.** The tab title needs to tell rooms apart: the
  session's name, or the excerpt's file?
- **Cost visibility.** Turns can now run in two rooms at once. Does the token
  widget sum across tabs, or show each tab's own?

## Completion Criteria

- [ ] An ADR settles the per-tab owners, what stays shared, the room
      registry, `current.json`'s place, named-session exclusivity and seed
      targeting.
- [ ] Two Lightbox tabs hold two boards. Each one's source choices, run and
      restore are its own, and the source-ownership witnesses hold per tab.
- [ ] Two Workshop tabs hold two rooms. A turn, Rewind, Branch, a pin or a
      memory proposal in one never touches the other (witnessed).
- [ ] Two unsaved rooms in two tabs each keep their own current file, and
      both restore after a reload (T1).
- [ ] An existing writer's `current.json` restores unchanged, from a fixture
      of today's file, whatever naming the ADR picks.
- [ ] Opening a named session another tab holds reveals that tab.
- [ ] A reload restores every tab to its own room or board. Shutdown flushes
      every room and drains every board's owed writes.

## Related

- [ADR 2026-10-19: Lightbox](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md):
  D1 and D12 (source ownership, saved boards, the multi-window store) and
  D11 (seed delivery and receivers).
- [ADR 2026-09-30: Workshop Rewind and Branch](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md):
  the room-replacement transaction, which becomes per room.
- [ADR 2026-11-04: Workshop Pinned Context](../../../docs/adr/2026-11-04-workshop-pinned-context.md):
  "a write belongs to the room it was asked in", already room-scoped in spirit.
- [ADR 2026-07-30: Session Codec Evolution](../../../docs/adr/2026-07-30-workshop-session-codec-evolution.md):
  why `current.json` must keep restoring.

## Related Files

- `apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts` and
  `LightboxPanelProvider.ts` (`panel?`, `openOrReveal`, `deserializeWebviewPanel`)
- `apps/vscode-extension/src/extension.ts` (the singletons, lines 287–700)
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`
- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts` (`current.json`)
- `packages/core/src/infrastructure/lightbox/LightboxService.ts` and `LightboxRetainedBoards.ts`
- `apps/vscode-extension/src/application/extensionShutdown.ts`
