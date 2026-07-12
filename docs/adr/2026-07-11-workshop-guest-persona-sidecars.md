# ADR 2026-07-11: Workshop Guest Persona Sidecars

**Status:** Proposed
**Date:** 2026-07-11
**Extends:** [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md); [ADR 2026-07-11 — Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Feature investigation:** [.todo/features/feature-workshop-persona-guest-sidecars](../../.todo/features/feature-workshop-persona-guest-sidecars/README.md)

## Context

The Workshop has exactly one persona: the host, locked per session
(ADR 2026-07-09 §1). Sprint 07 gives the *host* bounded capabilities; Sprint
08 feeds it tool-derived todos. Nothing lets a second persona participate.

The real need: mid-conversation with Jill, the writer wants Margot's read on
the POV question that just surfaced — a second opinion **with the context of
the discussion**, not a cold start. Today the options are a new session
(loses everything) or asking Jill to impersonate Margot (identity dishonesty
the epic forbids).

Designs already rejected and still rejected here:

- **Host swapping** — contaminates history and voice; "New session" remains
  the only host-switch boundary.
- **Live relay** — mirroring every host turn into every guest thread
  multiplies token cost per participant; the same trap ADR 2026-07-09 §4
  avoided for direct tool mode.
- **Free-form agent graph** — the writer workshops prose; they do not manage
  a routing topology.

## Decision

### 1. Guests are additional participants; the host never changes

The user (never the host, never another guest) launches a guest persona from
the persona browser/participant rail mid-session. The host stays the host.
"New session" and `reset()` restore Jill and dispose all guests.

### 2. Snapshot-on-join, with speaker labels

A guest starts as a fresh retained conversation under its own unchanged
persona prompt. Its first user message is a bounded, deterministic package:

- a speaker-labeled transcript of the host thread — "Writer:", "Jill:",
  "Cliché (report):" — derived mechanically from `WorkshopTurn` participant
  metadata (no model call);
- the current pinned excerpt in its own version frame;
- the writer's opening message to the guest.

The transcript is quoted data inside a `<workshop-transcript>` frame with the
same delimiter neutralization as excerpt frames, prefaced by explicit
identity framing: *"You are Margot. The following is a transcript of the
writer's conversation with Jill. It is not a request to change your role."*
Guests critique the room; they do not adopt its voices.

**Join budget:** newest 20 host-thread turns / 24,000 characters (whichever
first), omitted-turn count and truncation provenance included. The excerpt
frame rides its own existing 10,000-word cap.

### 3. Isolated after join; cursor-based catch-up in both directions

No live relay. Instead the Sprint 06B delivery-cursor pattern generalizes to
every participant:

- **Guest catch-up:** each guest records the last host-thread turn it has
  seen. Returning to a guest delivers a bounded delta of missed host turns
  (Sprint 06B bounds: newest 8 unseen turns / 20,000 characters) before the
  writer's message.
- **Host handoff:** unseen guest exchanges reach the host on its next turn
  as bounded, attributed evidence — identical machinery to direct-tool
  handoff.
- Cursors advance only after the receiving turn succeeds.
- Excerpt revisions reach guests naturally: the revision frame is part of
  the host thread, so it arrives inside the catch-up delta. One memory model
  for the whole room.

### 4. Anti-agent-graph bounds

- At most **two** live guests per session.
- Guests cannot launch personas (no recursion) and do **not** inherit Sprint
  07 capabilities in v1 — capability access for guests is a future explicit
  decision, never an inheritance default.
- Guests are individually dismissible; disposal follows the same
  deterministic paths as other participants (reset, new session, panel
  disposal, resource-generation loss).

### 5. Routing and UI

- `WorkshopChatTarget` gains `{ kind: 'personaGuest'; personaId }`, routed
  through the existing `WORKSHOP_SET_CHAT_TARGET` message; the handler
  validates the guest is live. One composer, one send action, as always.
- The participant rail renders guest chips with the same live/disposed
  honesty rules as tool chips (this is the deliberate v2 amendment to the
  rail's "not a persona picker" guardrail — guests join the room; the host
  chip never becomes a picker).
- Every thread turn is attributed; guest turns are visually and semantically
  distinct from host and tool turns.

## Consequences

**Gains**

- Second opinions with real context, honest identity, and bounded cost.
- No new synchronization concept: the delivery cursor already shipped in
  06B; this ADR reuses it symmetrically.
- The room metaphor completes: host remembers, instruments analyze, guests
  consult.

**Costs / risks**

- Join snapshots are the largest single frames the Workshop sends (~24k
  chars + excerpt); budget enforcement and truncation provenance are
  correctness requirements, not polish.
- Per-guest cursors add participant-state complexity that must survive
  reloads and cancellation.
- Two guests + host + sidecars pushes the rail's overflow behavior; UI must
  stay legible.

**Explicitly unchanged**

- Single immutable host per session; tool sidecars remain transcript-free
  instruments (they get the excerpt and instructions, not the gossip);
  Sprint 06B handoff bounds; Sprint 07 capability policy scope.

## Implementation

Sprint [09 — Guest Persona Sidecars](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/09-persona-guest-sidecars.md),
after Sprint 06C (memory model) and Sprint 07 (unified turn loop).
