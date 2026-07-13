# Feature: Workshop Participant Rail (Who's in the Room)

**Status**: Implemented on `sprint/workshop-editor-tab-06b-tool-side-pass` (2026-07-11) — pending manual UX verification in the Extension Development Host
**Priority**: Medium-High
**Date**: 2026-07-11
**Origin**: Epic Workshop Editor Tab — UX observation while testing direct-tool mode with Cliché
**Related ADR**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md) (§3 participants, §4 chat target)
**Related**: [feature-workshop-direct-mode-clarity](../../archive/features/feature-workshop-direct-mode-clarity/README.md) — design these together

## Problem / Motivation

Today the only way to enter direct-tool mode is the "Talk directly to `<Tool>`"
button on that tool's report artifact. As the thread grows, the artifact
scrolls away — the writer has to hunt up-thread to find the Cliché bubble just
to re-address the tool. The session's structure (one persona host + N live
tool sidecars) is real host-side state, but it is invisible unless you
remember where each report landed.

## Proposal

A compact **participant rail** in the composer area (where the direct-mode
banner sits today) showing everyone in the room:

- **Persona chip first** (always present): the session host, e.g. Jill.
  Clicking it returns to host — this *replaces* the text "Back to Jill" link.
- **One chip per live tool sidecar** (e.g. Cliché, Continuity), in run order.
  Clicking a chip sends `WORKSHOP_SET_CHAT_TARGET { kind: 'tool', toolId }`.
- **Active target** gets the highlighted/pulsing treatment from
  [feature-workshop-direct-mode-clarity](../../archive/features/feature-workshop-direct-mode-clarity/README.md);
  the rail *becomes* the mode indicator, likely subsuming the banner entirely.

### Why this is cheap

`WorkshopParticipantsSnapshot` already exposes exactly this data —
`host.personaId` + `hasConversation`, `toolSidecars[{toolId, hasConversation}]`,
and `chatTarget` (`WorkshopSessionService.snapshotParticipants()`, epic branch
~line 308). Target switching already goes through the validated
`WORKSHOP_SET_CHAT_TARGET` message in both directions. **No new backend
contract is required** — this is presentation-only over existing state.

## Guardrails

- **Not a persona picker.** Persona switching is locked mid-session (ADR §1);
  the persona chip is the return-to-host affordance, never a persona browser
  trigger while a conversation exists. Do not let the rail drift toward the
  "agent graph management" anti-pattern the ADR explicitly rejects.
  (Deliberate v2 amendment tracked separately:
  [feature-workshop-persona-guest-sidecars](../feature-workshop-persona-guest-sidecars/README.md)
  would add *guest* chips without ever changing the host.)
- Chips render only *live* sidecars (`hasConversation`). Disposal (reset,
  excerpt replacement, superseded run) must remove the chip on the next
  snapshot — no dead chips that fail on click.
- A fresh run of the same tool replaces its sidecar; the chip persists and
  simply targets the newest conversation.
- Keep the per-artifact "Talk directly to `<Tool>`" button — it is useful
  provenance-local context ("question *this* report"). The rail is the
  always-available path, not a replacement.

## UX Notes

- A11y: rail as `radiogroup` or toolbar with `aria-pressed`; full keyboard
  operability; focus stays sane when the active chip changes.
- Overflow: up to 14 tools could theoretically have sidecars; chips should
  wrap or scroll horizontally without pushing the composer around.
- Active-chip animation must respect `prefers-reduced-motion` (see the
  direct-mode-clarity entry).

## Related Files (epic branch `epic/workshop-editor-tab`)

- `packages/core/src/presentation/webview/WorkshopApp.tsx` — direct-mode
  banner + composer area
- `packages/core/src/application/services/workshop/WorkshopSessionService.ts` —
  `snapshotParticipants()`
- `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06b-tool-side-pass.md`
  — hardens snapshot sidecar exposure ("availability for direct follow-up,
  and active-target state") and `WORKSHOP_SET_CHAT_TARGET`

## Sequencing

Best built immediately after Sprint 06B, which hardens the exact snapshot
fields and target-switching semantics the rail renders. Design together with
feature-workshop-direct-mode-clarity as one composer-area pass — if the rail
lands, that entry's banner treatment likely collapses into the rail's
active-chip state plus a pill-styled persona chip.

## Completion Criteria

- [x] Rail shows persona + all live tool sidecars; active target visually
      unmistakable.
- [x] Clicking chips switches target both directions without hunting for
      report artifacts.
- [x] Disposed sidecars disappear from the rail on next snapshot; no chip
      ever targets a dead conversation.
- [x] Keyboard + screen-reader operable; reduced-motion respected.
- [x] Persona chip never opens persona selection mid-session.

## Implementation Notes (2026-07-11)

- New `WorkshopParticipantRail.tsx` renders directly off
  `useWorkshop().toolSidecars` + `chatTarget` — presentation-only over the
  snapshot, exactly as proposed. Rail hides until the first sidecar exists
  (host-only room is already named by the composer placeholder + header).
- Placement (composer-messaging v2): the rail sits BELOW the thread/composer
  divider, grouped with the input it routes into; the centered status ticker
  sits above the divider.
- The `pm-ws-direct-mode` banner (and its `returnToHost` link) is REMOVED —
  the rail's active chip is the mode indicator; a visually-hidden
  `role="status"` span preserves the screen-reader announcement.
- Active tool chip pulses via a compositor-only opacity animation on a
  pseudo-element ring; `prefers-reduced-motion` falls back to the static
  accent treatment. Chips wrap (no horizontal scroll) for the 14-tool case.
- A sidecar with `availableForDirectFollowUp: false` renders disabled with an
  explanatory title, so a lost conversation can't be clicked into.
- Tests: `WorkshopParticipantRail.test.tsx` (render order, both-direction
  switching, active-target no-repost, unavailable-chip disable, status
  announcement). Remaining: manual pass for visual treatment, focus behavior,
  and reduced-motion in the Extension Development Host.
