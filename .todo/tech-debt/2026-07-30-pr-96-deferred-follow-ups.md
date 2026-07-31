# PR #96 Deferred Follow-ups

**Status:** Active
**Priority:** Medium
**Origin:** [PR #96 review](../../docs/pr-reviews/pr-96-gesture-playground-review.md)

## Files first

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/resources/system-prompts/gesture-dictionary/`
- `packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts`

## Follow-ups

### Widget-config ledger extraction (#12)

**Addressed 2026-07-31.** `WorkshopWidgetConfigLedger` now owns the config
collection/counter, defensive clones, commit linkage, bounded summaries, reset,
export, and hydration replacement. `WorkshopSessionService` remains the
aggregate boundary and delegates its existing API. The extraction landed as
Sprint 02A before the known second lifecycle; it was not a line-count-only
split. See [Workshop god files](2026-07-25-workshop-god-files.md) for the broader
remaining responsibility work.

### Full-generation prompt caching (#17)

The new stateless `More gestures` route avoids resending the large canonical
dictionary prompt for the common follow-up case. The initial full generation
still sends it. Evaluate provider-supported prompt caching when the widget
provider abstraction exposes a portable cache contract; do not encode
OpenRouter-specific cache controls in the domain service.

### Relative-duration bucket edges (#20)

Change `relativeDuration` so values immediately below one hour/day do not
render as `60 minutes` or `24 hours`. Add tests at 59m29s/59m30s/60m and
23h29m/23h30m/24h before changing the shared renderer.

## Completion criteria

- [ ] Each item lands in a focused change with behavior-level tests.
- [ ] Prompt caching remains provider-portable or explicitly adapter-owned.
- [x] Widget-ledger extraction preserves checkpoint and snapshot behavior.
- [ ] Relative-duration labels remain monotonic at unit boundaries.
