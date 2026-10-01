# Rewound one-shot widget commits leave their released config unreachable

**Date Identified**: 2026-09-30
**Reviewed**: 2026-09-30
**Status**: Identified
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
