# Workshop session retains all turns in memory until reset

**Status:** Open
**Priority:** Low
**Source:** PR #72 review, finding #12 (Tim ⚡ / Cal 🧪)

## Problem

`WorkshopSessionService.turns` grows unbounded for the life of a session:
`getSnapshot()` windows what it *sends* (`WORKSHOP_SNAPSHOT_TURN_WINDOW = 100`),
but the aggregate itself never trims — content strings for every turn are
retained until `reset()`. This is a memory concern, not CPU: all per-action
scans are O(N) over the turn list and called at human frequency.

Tim's verdict at review time: *"Come back when `this.turns` has seen a few
hundred thousand entries — right now it's not even breathing hard."* Deferred
deliberately; a marathon session measured in days could eventually notice.

## Constraint to respect when fixing

The direct-handoff delivery cursors (`deliveredToHostThroughTurnId`) and
`collectUnseenDirectExchanges()` resolve turn ids against `this.turns` by
index. Any internal trimming must not evict turns that are still after a
sidecar's delivery cursor, or undelivered direct exchanges would be lost —
the exact bug class PR #72 findings #1/#2 fixed.

## Related files

- `packages/core/src/application/services/WorkshopSessionService.ts`

## Completion criteria

- Internal retention policy (e.g. trim delivered/pre-cursor turns beyond a
  bound, or an explicit archival structure) with tests proving no undelivered
  direct exchange is ever evicted.
