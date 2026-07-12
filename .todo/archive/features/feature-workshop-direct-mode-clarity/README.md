# Feature: Workshop Direct-Tool Mode Visual Clarity

**Status**: Complete (2026-07-11, `sprint/workshop-editor-tab-06b-tool-side-pass`) — subsumed by the participant rail plus a live-status ticker pulse. The `pm-ws-direct-mode` banner no longer exists: the rail's active tool chip carries the direct-mode pulse (compositor-only opacity ring; `prefers-reduced-motion` falls back to the static accent treatment), the pill-shaped persona chip is the return-to-host affordance, and the status ticker (`pm-ws-ticker-live`) slowly breathes between muted and accent while a run streams so in-flight work reads as alive. See [feature-workshop-participant-rail](../feature-workshop-participant-rail/README.md) implementation notes.
**Priority**: Medium
**Date**: 2026-07-11
**Origin**: Epic Workshop Editor Tab — UX observation while testing direct-tool mode
**Related ADR**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md) (§4: "Direct-tool mode is never hidden")
**Related**: [feature-workshop-participant-rail](../feature-workshop-participant-rail/README.md) — design these together; if the rail lands, this entry's banner treatment likely collapses into the rail's active-chip state

## Problem / Motivation

When the writer enters direct-tool mode, the composer banner is a plain text
span plus an unstyled button:

```tsx
<div className="pm-ws-direct-mode" role="status">
  <span>Talking directly to {toolLabel}</span>
  <button type="button" onClick={returnToHost}>Back to {activePersona.label}</button>
</div>
```

In practice it is not obvious enough that messages are now routed to the tool
rather than the host persona, and the "Back to [persona]" control reads as
incidental text rather than the deliberate mode-exit it is. The ADR requires
direct mode to be "visibly announced"; the current treatment technically
announces it but does not *feel* like a mode.

## Proposal

1. **"Talking directly to `<Tool>`" indicator**: give it a slow, gentle pulse
   (opacity fade in/out, optionally a subtle color shift) so the active
   re-routing reads as a live state, not static text.
   - Must respect `prefers-reduced-motion` (fall back to a static but
     visually distinct treatment — e.g. accent border/background).
   - Keep `role="status"` semantics; animation is presentation-only.
2. **"Back to [persona]"** becomes a proper pill button (rounded, filled or
   outlined with the theme accent) so the exit affordance is unmistakable.

## Related Files (epic branch `epic/workshop-editor-tab`)

- `packages/core/src/presentation/webview/WorkshopApp.tsx` — direct-mode
  banner (~line 584–589)
- Workshop webview stylesheet — `pm-ws-direct-mode` class
- `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06b-tool-side-pass.md`
  — locks the direct-mode composer announcement surface

## Sequencing Note

Sprint 06B hardens this exact surface ("Direct mode is visibly announced in
the composer and has a deterministic 'Back to `<persona>`' control"). If 06B has
not started when this is picked up, fold these two refinements into 06B's
presentation tasks instead of running a separate pass.

## Completion Criteria

- [x] Direct-mode indicator animates (slow pulse) with a reduced-motion
      fallback; theme-safe in light/dark. *(Delivered as the rail's active
      tool chip pulse + the live ticker's slow color/opacity breathe; the
      Workshop surface is pinned warm-dark in v1, so one palette to verify.)*
- [x] "Back to [persona]" rendered as a pill button with hover/focus states
      and keyboard accessibility preserved. *(Delivered as the rail's
      persona chip — pill-shaped, `aria-pressed`, focus ring per the
      surface's scoped focus story.)*
- [x] A writer glancing at the composer can tell within a second whether the
      next message goes to the tool or the persona. *(The rail sits directly
      above the input; the active chip is the mode.)*
