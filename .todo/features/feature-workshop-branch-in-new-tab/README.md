# Feature: Branch or Rewind Into a New Workshop Tab

**Date Identified:** 2026-11-25
**Status:** Idea. Small to medium, on top of [Workshop tabs](../feature-multiple-workshop-and-lightbox-tabs/README.md) (#9, Astra, `epic/workshop-tabs`). An addendum to the tabs ADR and to ADR 2026-09-30's D2, not a new ADR.
**Priority:** Medium
**Origin:** Okey, 2026-11-25: "Branch|Rewind in new workshop tab"

## What happens today

- **Rewind cuts the room in place.** Everything after the turn is gone from
  this room. On a saved session that is destructive to the file's future,
  so the confirm points the writer to Branch to keep both (ADR 2026-09-30
  §6).
- **Branch saves a new session from the cut, then opens it in this tab.**
  It never writes its source, but the source leaves the screen.
- **Branch refuses an unsaved room** (D2): "Save this session before
  branching." The only reason is that an unsaved room's one durable copy
  was `current.json`, and opening the branch would overwrite it.
- **The tabs ADR expected this follow-up.** D5: "Keep the existing Branch
  command's destination behavior. A separate Branch into New Tab command can
  be considered after ordinary independent tabs work."

## The insight: these are one operation

"Rewind in a new tab" means "show me this room from that turn, and keep the
original." That is what branching is. So there is one new operation:

**Branch in new tab.** The source tab stays exactly as it is. A new tab
opens holding the room cut at that turn, by the same transform Rewind and
Branch use (`rewindWorkshopSession`).

## Why tabs make it better than Branch

- **It works from an unsaved room.** With tabs, every unsaved room has its
  own rolling checkpoint slot (tabs ADR D3), so nothing is overwritten. D2's
  refusal doesn't apply to this destination.
- **An unsaved room is durable now.** It survives a reload, and a closed
  tab's room is listed in **Reopen Closed Workshop Room…** (D3, D3a).
- **Side by side.** The writer can compare the two directions, or ask the
  same question differently in each.
- **A warm cache.** With [#37](../feature-workshop-session-cache-key/README.md)'s
  K1, a branch keeps the routing key, so the new tab's first reply can read
  the source's cached prefix from the same provider.

## Idea

1. **What the new tab holds** (B1, Ada's lean): **an unsaved room, from any
   source, saved or not.**
   - It works the same everywhere, and a quick try leaves no "— branch 3"
     file behind.
   - Save makes it a named session when it's worth keeping.
   - Its tab title says where it came from ("Alice's tea party — branch,
     unsaved"), as the tabs ADR asks titles to tell rooms apart.
   - Because it copies the live room and writes no named file, Branch's
     saved-source checks (saved, file on disk unchanged) don't apply. The
     writer gets the room they see.
2. **Where it is offered** (B2, Ada's lean). No new button in the row: the
   [row-thinning note](../feature-workshop-bubble-action-row-thinning/README.md)
   says it is already busy.
   - **"Branch from here" gains a chevron** with two items: "Branch here
     (saved session)", today's behavior; and "Branch in new tab".
   - **Ctrl/Cmd-click on Branch** is the shortcut, as a browser opens a
     link in a new tab. It is never the only way in.
   - **Rewind's confirm gains "Branch in new tab instead".** That is
     exactly "rewind, but keep this one", offered at the moment the writer
     asks to rewind. It replaces the copy that points to Branch today.
3. **What the writer sees.** The new tab opens in the same editor group and
   takes focus.
   - A writer-bubble cut puts the message text back in the **new** tab's
     composer, through the shared restore (`WORKSHOP_COMPOSER_DRAFT_RESTORED`).
   - The source tab's composer and draft are untouched.
   - Seeds and handoffs follow the most recently focused tab, so they go to
     the new tab next (tabs ADR D5).
4. **The rules it keeps.**
   - It is refused while the source has a run active, through the same
     rewindability check (`busy`).
   - The source is never written and keeps its ownership claims.
   - A to-do receipt's Undo stays with the room that made it; the copy
     offers none, as Branch's copies don't today.
   - Held passage-search results stay with the source room's instance.
   - With no workspace folder or several roots, the new room lives in
     memory, like any other tab (D3b). Branch is disabled there today; this
     could work.

## Decisions to make

| # | Question | Ada's lean |
|---|---|---|
| B1 | Is the new tab's room unsaved, or a saved "— branch" session as Branch makes? | Unsaved, from any source; Save when it's worth keeping. Alternative: a saved branch from a saved source and an unsaved one from an unsaved source, which keeps Branch's meaning but gives two behaviors. |
| B2 | Where is it offered? | A chevron on Branch, Ctrl/Cmd-click as the shortcut, and "Branch in new tab instead" in Rewind's confirm. |

## Completion Criteria

- [ ] Branch in new tab from a saved room and from an unsaved one opens a
      new tab holding the cut room, and the source room, its file and its
      claims are unchanged (tests).
- [ ] A writer-bubble cut restores the message to the new tab's composer
      only (test).
- [ ] Refused while the source is running, with the existing reason (test).
- [ ] The new tab's room survives a reload and a close and reopen (test,
      through the tabs epic's slot rules).
- [ ] Rewind's confirm offers "Branch in new tab instead"; the chevron and
      Ctrl/Cmd-click reach the same operation by keyboard and pointer
      (tests).
- [ ] The tabs ADR and ADR 2026-09-30 D2 are amended. The help section on
      Rewind and Branch explains it.
- [ ] Logs carry ids and outcomes, never a title or a message.

## Related

- [Workshop tabs](../feature-multiple-workshop-and-lightbox-tabs/README.md)
  (#9) and its ADR, `docs/adr/2026-11-25-workshop-tabs.md` on
  `epic/workshop-tabs` (D3, D3a, D3b, D5).
- [ADR 2026-09-30: Workshop Rewind and Branch](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md)
  (§6, §7, D2, D4).
- [A session keeps its cache key](../feature-workshop-session-cache-key/README.md)
  (#37): the warm first reply.
- [Thin the bubble's action row](../feature-workshop-bubble-action-row-thinning/README.md).

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
  (`WorkshopRewindAction`, `WorkshopBranchAction`)
- `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts`
  (`branchFrom`, `rewindTo`)
- `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts`
  (`rewindWorkshopSession`)
- The tabs epic's panel registry and room factory, on `epic/workshop-tabs`
