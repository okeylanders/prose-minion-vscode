# Rewound one-shot widget commits leave their released config unreachable

**Date Identified**: 2026-09-30
**Reviewed**: 2026-10-01
**Status**: Resolved in Workshop Rewind and Branch, Sprint 03 (kickoff decision 3), with one accepted residue
**Priority**: Medium
**Estimated Effort**: Small (one result field plus a webview opening path, with tests)
**Found by**: Workshop Rewind and Branch, Sprint 02 ([epic](../epics/epic-workshop-rewind-and-branch-2026-09-30/README.md))

## Problem

Rewinding past a one-shot widget commit releases the config's commit linkage,
following the `rollbackThreadCommit` template
(`releaseDroppedThreadCommit` in `session/WorkshopSessionRewind.ts`). The
widget-commit message is deliberately not re-seeded into the composer: the
released config is meant to be the retry token, and widget copy belongs to the
widget sheet.

The writer has no way to reach that token. The thread opens a widget config
only from the commit bubble's chip (`WorkshopTurnBubble` →
`onOpenWidgetConfig(widgetCommit.widgetConfigId)`) or from a standing-directive
marker. `WorkshopSessionService.getSnapshot()` publishes only the configs that
windowed turns or standing directives reference. After the rewind, the commit
bubble is gone and the config is absent from the snapshot. Nothing is lost,
because the host still holds the config by id, but the writer must rebuild the
widget from scratch to retry.

A failed widget run does not have this gap, because the writer is still in the
widget flow when the commit rolls back.

## Recommendation

Carry the released config ids out of the transform (for example
`summary.releasedWidgetConfigIds`) and, for a writer-origin rewind, reopen the
widget sheet on the released config through the existing
`useWorkshopWidgetOpening.openWidgetConfig` path. Alternatively, name the widget
in the action result with a "Reopen" affordance. The first matches the D1 spirit
of a writer-bubble edit: what was removed comes back to where it is edited.

## Related Files

- `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts` (`getSnapshot`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopSessionMessageHandler.ts` (`handleRewindSession`)
- `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts`

## Completion Criteria

- A writer can retry a rewound widget commit from its released config without
  rebuilding it.
- A test covers a rewind past a one-shot commit that reopens, or offers to
  reopen, that config. A standing directive is never affected, because the
  directive floor already refuses those cuts.

## Resolution (2026-10-01)

Confirmed at Sprint 03 kickoff and recorded in ADR 2026-09-30, [Sprint 03 kickoff decisions](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#sprint-03-kickoff-decisions), item 3. The first recommendation landed, scoped to the widget message itself.

- **Transform.** `rewindWorkshopSession` reports `summary.releasedWidgetConfigIds`. When the cut is a writer-bubble cut on a widget commit's own message, it also returns `widgetRestore { widgetConfigId }`, the widget twin of `composerRestore`.
- **Route.** For a writer-origin rewind (and Branch, which shares the transform), `WorkshopSessionMessageHandler` posts `WORKSHOP_WIDGET_CONFIG_RESTORED`.
- **Webview.**
  - `useWorkshopWidgetHost` holds the restored id, and `useWorkshopWidgetOpening` reopens it through the existing `openWidgetConfig` path.
  - The sheet opens as a clone of the released draft. The banner reads "Reopened from a message you rewound" instead of claiming an old chip remains.
  - The widget message's action reads "Edit from here", and its confirmation says the widget reopens.

**Accepted residue.** A cut that skips past a commit, for example a rewind to an earlier reply, releases the config silently. Its retry token stays host-side with no thread entry point. This is deliberate: the writer chose to go back past that widget, and an unrequested sheet after an ordinary rewind would surprise them.

Regression tests:

- `WorkshopSessionRewind.test.ts` and the oracle: released ids, and a restore only for the widget message.
- `WorkshopSessionRewindCoordinator.test.ts`: writer origin only.
- `WorkshopRoutes.rewind.test.ts`: the posted restore.
- The widget host, opening controller, router, bubble, confirm-copy and modal suites.
- `WorkshopApp.test.tsx`: the full edit flow.
