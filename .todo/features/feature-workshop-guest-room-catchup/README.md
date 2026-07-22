# Feature: Workshop Guest-to-Guest Room Catch-Up

**Date Identified**: 2026-07-22
**Status**: Proposed
**Priority**: Medium
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
universal `id` from `nextTurnId(...)`. The current guest state already keeps
per-recipient acknowledgement state:

- `lastSeenHostTurnId` — host turns delivered to that guest;
- `deliveredToHostThroughTurnId` — that guest's exchanges delivered to the
  host.

Universal turn IDs identify records, but do not establish whether a particular
recipient successfully received them. A per-guest delivery checkpoint remains
necessary for idempotence and retry safety.

## Proposal

Replace the host-only guest catch-up with a bounded **room catch-up** on the
guest's next message:

1. Rail selection stays local and immediate. It does **not** invoke a hidden
   host model call, emit a synthetic host reply, or spend tokens.
2. When the writer sends to Guest B, audit the shared turn log after B's room
   checkpoint.
3. Include eligible, speaker-labeled turns from the host and other live/
   historical guests, while excluding B's already-retained own conversation
   and direct-tool sidecar traffic.
4. Pack the delta with the existing bounded transcript machinery and send it
   beside the writer's new message.
5. Advance B's checkpoint only after B's response succeeds, and only through
   turn IDs actually included in the bounded frame. Omitted turns remain
   pending for a later catch-up.

The host's existing bounded guest handoff remains independent: it still gets
unseen guest exchanges when the writer next messages the host. Receiving the
same guest exchange as bounded evidence in two different participant
conversations is intentional; their retained contexts are separate.

## Why a Checkpoint, Not Just IDs

The shared log's IDs make the audit deterministic, but an ID alone cannot say
whether Guest B saw it. Store an acknowledgement checkpoint such as
`lastSeenRoomTurnId` (or an equivalent delivered-turn cursor) per guest. This
gives the desired idempotence:

- cancelled/failed turns leave the checkpoint unchanged, so the next attempt
  safely retries the same evidence;
- successful deliveries do not repeat already delivered turns;
- bounded overflow remains pending rather than being silently marked seen.

## Guardrails

- Do not turn participant-rail clicks into host synthesis requests. That would
  add hidden AI turns, cost, latency, and ambiguous transcript semantics.
- Do not advance a checkpoint merely because the rail target changed; delivery
  occurs only when a guest prompt successfully completes.
- Keep the catch-up explicitly labeled as quoted room context, not instructions
  or proof that the recipient personally witnessed omitted turns.
- Define visibility deliberately: host + other guests are room conversation;
  direct tool sidecars remain transcript-free instruments.
- Preserve current excerpt-version and disposed-guest semantics; a stale or
  replaced conversation must not receive a room delta.
- Retain the existing host handoff cursor separately; guest-to-guest visibility
  must not consume evidence before the host sees it.

## Related Files

- `packages/core/src/application/services/workshop/WorkshopSessionService.ts`
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`
- `packages/core/src/application/handlers/domain/WorkshopHandler.ts`
- `packages/core/src/__tests__/application/services/workshop/WorkshopSessionService.test.ts`
- `packages/core/src/__tests__/application/handlers/domain/WorkshopHandler.test.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopParticipantRail.tsx`

## Completion Criteria

- [ ] Sending a message to Guest B after a direct Guest A exchange gives B a
      bounded, speaker-labeled catch-up containing A's unseen exchange.
- [ ] A host turn that Guest B missed is included in the same room catch-up.
- [ ] Guest B's own prior conversation and direct-tool exchanges are excluded.
- [ ] Catch-up uses universal turn IDs plus a per-guest acknowledgement
      checkpoint; retries are idempotent and only successfully delivered IDs
      advance the checkpoint.
- [ ] Bounded overflow reports omission and remains eligible for a later
      delivery.
- [ ] Returning to the host still delivers Guest A/B exchanges through the
      existing host handoff exactly once per host cursor.
- [ ] Target switching alone makes no provider call and appends no hidden turn.
- [ ] Focused aggregate, prompt-builder, and handler tests cover A → B,
      A → host, retries/cancellation, bounded overflow, and disposed guests.
