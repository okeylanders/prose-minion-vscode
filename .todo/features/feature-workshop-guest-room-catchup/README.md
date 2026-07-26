# Feature: Workshop Guest-to-Guest Room Catch-Up

**Date Identified**: 2026-07-22
**Status**: Implemented in [Sprint 13D](../../epics/epic-workshop-editor-tab-2026-07-03/sprints/13d-room-catchup-release-polish.md); manual release smoke pending
**Priority**: High — room behavior is release-polish work once guests are visible participants
**Estimated Effort**: Medium
**Origin**: Writer UX review of direct switching between live guest personas
**Related**: [Guest Persona Sidecars](../feature-workshop-persona-guest-sidecars/README.md),
[Participant Rail](../feature-workshop-participant-rail/README.md)

## Problem / Motivation

Guest personas currently have a hub-and-spoke memory model. When the writer
switches directly from Guest A to Guest B, Guest B receives a bounded catch-up
of host-thread turns only. Guest A's writer exchange and reply are invisible
to Guest B until the writer later messages the host, which receives the guest
exchange as its own bounded handoff.

This is technically consistent with isolated retained guest conversations, but
it is surprising in a participant rail that visually presents guests as being
in the same Workshop room.

## Existing Spine

No duplicate transcript store is needed. `WorkshopSessionService` already owns
the session-wide ordered `turns: WorkshopTurn[]` log; every turn receives a
universal `id` from `nextTurnId(...)`.

Universal turn IDs identify records, but do not establish whether a particular
recipient successfully received them. A per-recipient delivery position remains
necessary for idempotence and retry safety.

The design investigation for this feature found that the existing scheme —
three cursors owned by *relationships* (`lastSeenHostTurnId`, and two
`deliveredToHostThroughTurnId` families) — cannot absorb a fourth relationship
without inheriting three live defects. The resolution is
[ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md),
which is the governing contract; this document records the motivating problem.

## Proposal

Replace the host-only guest catch-up with a **room catch-up** on the guest's
next message:

1. Rail selection stays local and immediate. It does **not** invoke a hidden
   host model call, emit a synthetic host reply, or spend tokens.
2. When the writer sends to Guest B, walk the shared ledger forward from B's
   own reading position.
3. Include every turn whose `audience` is `room` and whose speaker is not B —
   host turns, other guests' exchanges, tool reports, and evidence-bearing
   capability results published with a committed participant reply. Exclude
   B's own turns, direct-tool sidecar conversation, catalog/search traffic,
   and failed, cancelled, stale, or uncommitted capability work owned by
   another principal.
4. Deliver that contiguous prefix, whole turns only, beside the writer's new
   message.
5. Advance B's offset only after B's response succeeds, and only through the
   prefix actually delivered.

The host is a reader on the same terms. "What the host has seen of Guest A" is
the host's own reading position, not a cursor stored on Guest A.

## Why an Offset, Not Just IDs

The shared log's IDs make the audit deterministic, but an ID alone cannot say
whether Guest B saw it. Each participant stores one `lastSeenRoomTurnId`. That
gives the desired idempotence:

- cancelled/failed turns leave the offset unchanged, so the next attempt safely
  retries the same evidence;
- successful deliveries do not repeat already delivered turns;
- because the offset can only mean "everything before this," it may never jump
  a turn that was not delivered.

## Guardrails

- Do not turn participant-rail clicks into host synthesis requests. That would
  add hidden AI turns, cost, latency, and ambiguous transcript semantics.
- Do not advance an offset merely because the rail target changed; delivery
  occurs only when a prompt successfully completes.
- Keep the catch-up explicitly labeled as quoted room context, not instructions
  or proof that the recipient personally witnessed anything omitted.
- Never split a turn. Head-truncating another participant's speech is a
  misquote, not a bound.
- Every delivery goes through the one shared site — including the tool
  side-pass, which currently commits its own cursor out of band.
- Preserve current excerpt-version and disposed-guest semantics; a stale or
  replaced conversation must not receive a room delta, and a re-invited persona
  starts from a join snapshot rather than an inherited offset.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`
- `packages/core/src/__tests__/application/services/workshop/WorkshopSessionService.test.ts`
- `packages/core/src/__tests__/application/handlers/domain/WorkshopHandler.test.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopParticipantRail.tsx`

## Completion Criteria

- [x] Sending a message to Guest B after a direct Guest A exchange gives B a
      speaker-labeled catch-up containing A's unseen exchange.
- [x] A host turn that Guest B missed is included in the same room catch-up.
- [x] Guest B's own prior conversation, direct-tool sidecar conversation,
      catalog/search traffic, and failed/cancelled/uncommitted capability work
      owned by other principals are excluded.
- [x] Evidence-bearing resource reads, dictionary results, and
      participant-requested analysis results become room evidence only when the
      invoking participant's final reply commits.
- [x] Catch-up uses universal turn IDs plus one `lastSeenRoomTurnId` per
      participant; retries are idempotent and only the delivered prefix
      advances the offset.
- [x] No frame splits a turn, within or across deliveries.
- [x] Returning to the host delivers Guest A/B exchanges exactly once, through
      the host's own offset.
- [x] Target switching alone makes no provider call and appends no hidden turn.
- [x] The tool side-pass delivers through the single shared site; an
      architecture guard asserts one catch-up call site and one offset-advance
      call site.
- [x] Focused aggregate, prompt-builder, and handler tests cover A → B,
      A → host, retries/cancellation, atomic turns, disposed and re-invited
      guests, and a session file carrying the legacy cursor keys.
