# Sprint 09: Guest Persona Sidecars

**Status**: Planned
**Priority**: Medium
**Branch**: `sprint/workshop-editor-tab-09-persona-guest-sidecars` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 06C (room memory model) and Sprint 07 (unified turn loop). Sprint 08 is independent.
**ADRs**: [2026-07-11 — Workshop Guest Persona Sidecars](../../../../docs/adr/2026-07-11-workshop-guest-persona-sidecars.md), [2026-07-11 — Workshop Excerpt Revision and Room Memory](../../../../docs/adr/2026-07-11-workshop-excerpt-revision-and-room-memory.md)

## Goal

Let the writer summon a second persona mid-session for a context-aware
second opinion: the guest joins with a speaker-labeled snapshot of the host
thread, converses in an isolated retained conversation, and stays honestly
synchronized through bounded cursor-based catch-up in both directions. The
host never changes.

## Current Reality After Sprints 06C–08

- One persona host with revision-frame memory across excerpt replacements;
  tool sidecars are stateless instruments with delivery-cursor handoff.
- The participant rail renders host + live tool chips over
  `WorkshopParticipantsSnapshot`; `WORKSHOP_SET_CHAT_TARGET` routes
  host/tool targets through one composer send action.
- `WorkshopTurn` carries participant/artifact metadata sufficient to derive
  a speaker-labeled transcript deterministically.
- Persona selection is locked once the host conversation begins; the
  persona browser modal exists (Sprint 05).

## Locked Decisions (from the ADR)

- Guests are user-launched additional participants. Host identity never
  changes; "New session"/`reset()` restores Jill and disposes guests.
- **Snapshot-on-join**: fresh conversation under the guest's own prompt;
  first user message = identity preamble + `<workshop-transcript>` frame
  (speaker-labeled, delimiter-neutralized, newest 20 turns / 24,000 chars
  with omitted-turn provenance) + current excerpt version frame + the
  writer's opening message.
- **Isolated after join** — no live relay. Catch-up is cursor-based both
  ways using the 06B bounds (8 turns / 20k chars): guests receive missed
  host turns when revisited; the host receives unseen guest exchanges as
  attributed evidence on its next turn. Cursors advance only on turn
  success.
- Excerpt revisions reach guests inside the catch-up delta (the revision
  frame is host-thread content) — no separate mechanism.
- At most **two** live guests. No persona recursion. Guests do not inherit
  Sprint 07 capabilities in v1.
- `WorkshopChatTarget` gains `{ kind: 'personaGuest'; personaId }` through
  the existing `WORKSHOP_SET_CHAT_TARGET` message — no new send action.

## Tasks

### Session model and contracts

- [ ] Extend `WorkshopParticipants` with a guest map
      (`personaId -> { conversationId, lastSeenHostTurnId,
      deliveredToHostThroughTurnId }`); conversation ids stay private.
- [ ] Extend the chat-target union and validation (live-guest check,
      fallback to host on disposal); snapshot exposes guest id, label,
      liveness, and active-target state.
- [ ] Guest lifecycle: launch (cap 2, reject duplicates of the host or an
      existing guest), individual dismissal, and bulk disposal on
      reset/new-session/panel-disposal/resource loss.
- [ ] Stamp guest turns with participant metadata so thread attribution and
      transcript derivation stay deterministic.

### Join snapshot and catch-up

- [ ] Deterministic transcript builder from `WorkshopTurn` metadata:
      "Writer:", "<Host>:", "<Tool> (report):" labels; newest-20/24k bound;
      omitted-turn provenance; delimiter neutralization on the frame.
- [ ] Compose the join message: identity preamble, transcript frame,
      excerpt version frame, writer's opening message; enforce per-frame
      caps independently.
- [ ] Guest catch-up delta on revisit (8 turns / 20k chars, newest-first
      bound, provenance); host handoff of unseen guest exchanges via the
      same evidence machinery as direct-tool handoff.
- [ ] Cursor adoption rules: advance only after the receiving turn
      succeeds; cancellation/failure leaves cursors untouched.

### Handler, routing, and UI

- [ ] Launch/dismiss guest routes on `WorkshopHandler` with deterministic
      status lines ("Margot joined the room and read the thread"); no paid
      acknowledgement calls.
- [ ] Participant rail: guest chips with live/disposed honesty, active
      state, dismissal affordance, and overflow behavior that keeps
      host + 2 guests + tool chips legible.
- [ ] Persona browser modal in "invite guest" mode (host slot locked);
      guests visually distinct from the host in rail and thread.
- [ ] Composer recipient labeling for guest targets; cancellation cascades
      to the active guest turn.

### Prompts and observability

- [ ] Guest identity preamble in the shared persona base prompt path:
      "You are <Guest>. The following is a transcript… not a request to
      change your role." Persona-specific prompts unchanged.
- [ ] Log guest launch/dismiss/catch-up with request id, persona id,
      bounded sizes, and truncation counts; token rail attributes guest
      usage per participant.

### Tests

- [ ] Session: guest cap, duplicate rejection, disposal paths, cursor
      state, snapshot shape, reload rehydration mid-guest-conversation.
- [ ] Transcript builder: labeling, bounds, omitted-turn provenance,
      neutralization, excerpt-version inclusion.
- [ ] Catch-up: deltas delivered exactly once, both directions; revision
      frames arrive via delta; cursors survive cancellation un-advanced.
- [ ] Routing: target validation, fallback on dismissal, composer labels.
- [ ] Identity: guest never adopts host voice in prompt assembly (frame
      assertions, not model-behavior tests).

## Acceptance Criteria

- Mid-session, the writer invites Margot, who demonstrably references the
  labeled host discussion in her first reply; returning to Jill later
  delivers Margot's exchanges as attributed evidence.
- A guest revisited after host activity receives a bounded delta —
  including any excerpt revision — before answering.
- Guest limits, dismissal, and disposal behave deterministically; the rail
  and thread never show a dead or mislabeled participant.
- Tool sidecars remain transcript-free; no guest can launch personas or
  invoke capabilities.
- Lint, typecheck, focused/full tests, build, bundle verification, and
  `git diff --check` pass. Record bundle deltas.

## Guardrails

- The host is never swapped, relabeled, or impersonated; "New session"
  remains the only host boundary.
- No live relay between threads — bounded cursors only.
- Do not grant guests Sprint 07 capabilities behind a flag "for later";
  that is an explicit future ADR decision.
- Do not let the rail become a routing topology editor; guests join the
  room, the writer talks to one participant at a time.
