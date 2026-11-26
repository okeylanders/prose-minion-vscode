# Feature: Open a Saved Workshop Branch in a New Tab

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

## Agreed behavior

The existing **Branch from here** action saves a uniquely named branch at the selected turn, using the existing naming rules. Open that saved session in a new Workshop tab in the same editor group and give it focus. The source stays open with its full history and current draft. This applies to both pointer and keyboard activation of the existing button.

Branch still requires a saved source and retains the existing checks for an active run or a changed source file. An unnamed room keeps the existing instruction to save before branching. Rewind continues to cut the current room in place.

## Completion criteria

- [ ] Branch from a saved session opens the newly named branch in its own tab, with history cut at the selected turn. The source and branch can continue independently.
- [ ] A writer-bubble cut restores the composer draft in the branch. The source draft survives the action.
- [ ] An unsaved source or active run gets the existing refusal before any file or tab is created.
- [ ] Reloading restores both sessions in their respective tabs. With feature 37, retained conversations keep their routing keys across the cut.
- [ ] Help and the Workshop tabs and Rewind/Branch ADRs describe the new destination.

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
