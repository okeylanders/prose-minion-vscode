# Handoff cursors advance past turns the envelope never shipped

**Status**: Resolved in Sprint 13D (`63fe132`)
**Priority**: High
**Discovered**: 2026-07-26, during the PR #89 (Sprint 13C) fix-verification pass
**Owner candidate**: Sprint 13D (the delivery-offset rewrite already replaces this machinery)

## Problem

`WorkshopSessionService.commitHostGuestHandoff()` advances a guest's
`deliveredToHostThroughTurnId` to the **newest delivered index**, not the newest
*contiguous* one:

```ts
if (index !== undefined && index > newestIndex && turn?.participant === 'guest' && …) {
  newestIndex = index;
  newestTurnId = turnId;
}
```

Meanwhile `buildGuestTranscriptFrame()` (`WorkshopPromptBuilder.ts`) drops
**oldest-first** when it hits either the 8-turn window or the ~19,200-character
budget. So when the frame trims an early exchange, the commit still jumps the
cursor to the newest turn that shipped — and everything the frame dropped is
permanently behind the cursor. It is never redelivered.

This directly contradicts the invariant the sibling method documents in its own
docstring:

> Deriving the commit from the SHIPPED set — never from the unseen set — means
> windowing and character budgeting can only defer an exchange to the next
> handoff, not silently mark it delivered (PR #72 review #1).

It does not defer. It drops. The same max-index scan exists in
`commitHostHandoff()` for direct-tool sidecars.

## Reproductions (verified against the real service)

1. One guest exchange, no interleaving, a ~25k-character reply → the frame omits
   the writer's prompt, ships only the reply, and the commit jumps past the
   prompt. `collectUnseenGuestExchangesForHost()` is then empty.
2. Five short exchanges → exchange 1 vanishes (8-turn window).
3. Four ~6k-character exchanges → reply 1 vanishes (character budget).

## Related second-order case

The PR #89 fix to `collectUnseenGuestExchangesForHost()` walks backwards past a
guest's **own capability artifacts** to find the owning writer turn. It stops at
any other turn kind. A `session` / `context_change` turn minted mid-guest-run
(`WorkshopSessionService` context-change path) reproduces the original
prompt-loss symptom, because the context handlers carry no
`rejectExcerptMutationWhileRunning()` guard — only a webview-side `disabled`
flag, which lands after a message round-trip.

The durable fix for both is the same: stop inferring pairing from adjacency, and
advance the cursor only through the newest **contiguous** delivered turn.

## Provenance

**Not introduced by PR #89.** `WorkshopPromptBuilder.ts` and
`commitHostGuestHandoff()` are untouched by that branch — confirmed via
`git diff origin/epic/workshop-editor-tab...`. PR #89 fixed a *different*
adjacency break in the collector and is strictly an improvement over its base.

## Why 13D is the right home

Sprint 13D replaces this machinery wholesale per
[ADR 2026-07-24](../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md):
one reader-owned offset per participant, a single delivery protocol, and a
**single offset-advance call site**. Fixing the max-index scan in place would be
work thrown away. What 13D must not do is carry the same max-index shape into
the new single call site.

## Completion criteria

- The single offset-advance site advances only through the newest contiguous
  delivered turn; a trimmed exchange remains unseen and is redelivered next turn.
- A regression test proves an over-budget or over-window exchange is **deferred**,
  not consumed — asserting the dropped turn is still returned on the next collect.
- Pairing no longer depends on turn adjacency.
- The `PR #72 review #1` invariant is restated on the new call site and is true.

## Resolution

Sprint 13D deleted both max-index handoff committers and replaced them with
`WorkshopRoomDeliveryService.commit()`. The surviving site accepts only the
exact oldest contiguous prefix of the reader's eligible projection; a hole
throws and leaves the offset unchanged. The service tests preserve all three
reproductions (one ~25k reply, five short exchanges, four ~6k exchanges), plus
an explicit hole/retry proof. The architecture suite guards the single
catch-up construction and single offset-advance call sites.

## Related

- `docs/pr-reviews/pr-89-guest-agency-review.md` — findings #1 and #7
- `docs/pr-reviews/pr-72-*` — the original invariant
- `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/13d-room-catchup-release-polish.md`
