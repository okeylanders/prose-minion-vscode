# Workshop session retains unbounded turns and widget configs until reset

**Status:** Open
**Priority:** Low
**Source:** PR #72 review, finding #12 (Tim ⚡ / Cal 🧪); PR #97 review,
finding #11 (Patricia 🛡️)

## Problem

Two session-owned collections grow unbounded until `reset()`:

- `WorkshopSessionService.turns`: `getSnapshot()` windows what it sends, but
  the aggregate retains every turn body and scans the full collection for some
  actions.
- `WorkshopWidgetConfigLedger.configs`: each authoring config can retain a
  generated dictionary and menu; hydration and autosave clone the entire
  collection. A hand-edited checkpoint can also supply an arbitrarily large
  config array.

This is primarily a memory and persisted-input hardening concern. Ordinary
actions are writer-paced, so realistic sessions remain small; both risks were
deliberately deferred until the retention policy can respect delivery and
history invariants as a whole.

Tim's verdict at review time: *"Come back when `this.turns` has seen a few
hundred thousand entries — right now it's not even breathing hard."* Deferred
deliberately; a marathon session measured in days could eventually notice.

## Constraint to respect when fixing

The direct-handoff delivery cursors (`deliveredToHostThroughTurnId`) and
`collectUnseenDirectExchanges()` resolve turn ids against `this.turns` by
index. Any internal trimming must not evict turns that are still after a
sidecar's delivery cursor, or undelivered direct exchanges would be lost —
the exact bug class PR #72 findings #1/#2 fixed.

Committed turns may reference widget configs through `widgetConfigId`, and
visible chips must remain reopenable. Config trimming or a persisted ingress
cap must preserve every config still referenced by retained turns and define
what happens to older committed widget history.

## Related files

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/widgets/WorkshopWidgetConfigLedger.ts`
- `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts`

## Completion criteria

- Internal retention policy (e.g. trim delivered/pre-cursor turns beyond a
  bound, or an explicit archival structure) with tests proving no undelivered
  direct exchange is ever evicted.
- A deterministic persisted-ingress and in-memory bound for widget configs,
  with tests proving referenced/reopenable configs are not orphaned.
- Autosave and hydration work stays bounded even for malformed or hand-edited
  checkpoints.
