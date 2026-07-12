# Feature: Workshop Guest Persona Sidecars (Second Opinions in the Room)

**Status**: Formalized — [ADR 2026-07-11 — Workshop Guest Persona Sidecars](../../../docs/adr/2026-07-11-workshop-guest-persona-sidecars.md) + [Sprint 09](../../epics/epic-workshop-editor-tab-2026-07-03/sprints/09-persona-guest-sidecars.md); archive when Sprint 09 completes
**Priority**: Medium
**Date**: 2026-07-11
**Origin**: Epic Workshop Editor Tab — "can the user sidecar another persona?"
**Related ADR**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md) (§1 locks single host; this proposes *guests*, not host swaps)
**Related**: [feature-workshop-participant-rail](../feature-workshop-participant-rail/README.md) (rail would gain guest chips),
[feature-workshop-excerpt-revision-loop](../feature-workshop-excerpt-revision-loop/README.md) (shared "one memory model for the room" principle)

## Current State (nothing like this is planned)

- The epic has exactly one persona: the host, locked per session (ADR §1).
- Sprint 07 gives the *host* capabilities (dictionary, analysis tools) — not
  persona-to-persona conversation.
- Sprint 08 feeds tool-report todos to the host — still one persona.
- The participant rail (as filed) deliberately guards against persona
  picking. This feature is the explicit v2 amendment to that guardrail.

## Problem / Motivation

A writer mid-conversation with Jill may want Margot's read on the POV
question that just came up — a second opinion *with the context of the
discussion so far*, not a cold start. Today the only options are: new
session (loses everything) or asking Jill to impersonate Margot (identity
dishonesty the epic rightly forbids).

## Proposed Model

**Guest persona sidecars**, symmetric with tool sidecars but seeded
differently:

- The user (not the host) launches a guest persona from the rail/browser.
  The host stays the host; guests are additional participants.
- **Snapshot-on-join**: the guest's fresh conversation is seeded with a
  bounded, *speaker-labeled* transcript of the host thread ("Writer:",
  "Jill:", "Cliché (report):") plus the pinned excerpt. Post-06B
  `WorkshopTurn` participant metadata makes this labeled transcript
  deterministically derivable — no model call needed.
- **Isolated thereafter** (no live sync): host turns are NOT relayed into
  guest threads. Live sync would multiply token cost per participant — the
  same relay-cost trap ADR §4 avoided for direct tool mode.
- **Cursor-based catch-up, both directions**, generalizing 06B's delivery
  cursor: returning to a guest later delivers a bounded delta of host turns
  it missed; returning to the host delivers unseen guest exchanges as
  bounded handoff evidence (identical bounds machinery: N turns / char cap,
  cursor advances on successful adoption).
- Tools remain instruments: **no transcript seeding for tool sidecars** —
  they get the excerpt and instructions, not the gossip. (Confirms the
  existing design; only personas read the room.)

## Trust & Identity Constraints (for the ADR)

- The transcript frame is quoted data: extend the excerpt-frame
  neutralization pattern to a `<workshop-transcript>` frame; the guest is
  told "you are Margot; this is a transcript of the writer's conversation
  with Jill" so it critiques rather than adopts the host's voice.
- Anti-agent-graph bounds: cap concurrent guests (1–2); guests cannot
  launch personas (no recursion); whether guests get Sprint 07 capabilities
  is an explicit ADR decision, not an inheritance default.
- Host identity never changes; "New session" remains the only host-switch
  boundary.
- Rail renders guests as chips with the same live/disposed honesty rules as
  tool sidecars.

## Open Questions

- Does the host ever *hear about* guest exchanges automatically (handoff on
  next host turn, as proposed) or only when the writer asks? Symmetry with
  tool handoff says automatically-but-bounded.
- Guest lifetime: session-long, or disposable like superseded tool
  sidecars? Excerpt replacement presumably invalidates guests under the same
  memory model chosen in feature-workshop-excerpt-revision-loop.
- Snapshot bound sizing: the 8-turn/20k-char tool-handoff bound is likely
  too small for a meaningful join snapshot; needs its own budget.

## Completion Criteria

- [ ] ADR settles the guest model (join snapshot, isolation, catch-up
      cursors, capability access, caps) consistently with the room's memory
      model.
- [ ] A writer can summon a second persona mid-session, get a
      context-aware opinion labeled by speaker, and return to the host
      without losing either thread.
- [ ] Guest threads are honest: what the guest has/hasn't seen is
      deterministic and visible; no implied live omniscience.
- [ ] Tool sidecars remain transcript-free instruments.
