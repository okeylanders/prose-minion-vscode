# Workshop: Host Persona Cannot See Direct-Tool Exchanges (Tripwire)

**Status**: Tracked — expected closure via Sprint 06B
**Priority**: High (epic-exit blocker if 06B is descoped)
**Date**: 2026-07-11
**Related ADR**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md) (§4)
**Related Sprint**: `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06b-tool-side-pass.md` (epic branch)

## Symptom

After talking directly to a tool and clicking "Back to [persona]", the host
persona has no knowledge of the direct-tool exchange. The writer cannot ask
Jill what she thinks about the tool's results.

## Investigation (2026-07-11)

**This is a design-intentional deferral, not a regression.**

- ADR 2026-07-09 §4 deliberately avoids paying for a persona relay call on
  every direct-tool message. Instead: "When direct mode ends, the next host
  turn receives any new tool exchanges that host has not yet seen as a
  bounded, structured handoff."
- The plumbing exists but is inert: `WorkshopToolSidecar.deliveredToHostThroughTurnId`
  is declared in `packages/core/src/application/services/WorkshopSessionService.ts:36`
  (epic branch) and referenced nowhere else — no code reads or advances the
  delivery cursor.
- Sprint 06B (Status: Planned, depends on merged 06A) owns the implementation
  with locked bounds: newest **8 unseen direct-tool turns** and **20,000
  characters** (whichever first), omitted-turn count + deterministic
  truncation provenance, cursor advanced only after a successful host turn
  adopts the handoff.
- The multi-tool concern is handled by design: sidecars are per-`WorkshopToolId`,
  each with its own delivery cursor, so multiple tools' unseen exchanges hand
  off independently.

## Why This Entry Exists

Tripwire so the gap does not survive the epic. The work itself is scoped in
Sprint 06B; this entry is the verification checklist and the escalation path.

## Completion Criteria

- [ ] After Sprint 06B merges, verify end-to-end: run a tool → direct-chat
      with it → "Back to [persona]" → next host message: the persona
      demonstrably references the direct-tool exchange.
- [ ] Delivery cursor advances (repeating the host turn does not re-deliver
      the same exchanges).
- [ ] Two-tool scenario: exchanges from both sidecars hand off independently.
- [ ] Delete this entry once verified.

**Escalation**: if Sprint 06B is descoped or the handoff is cut from it,
reclassify this as an open bug against the epic's acceptance — the epic should
not close with the host blind to direct-tool context.
