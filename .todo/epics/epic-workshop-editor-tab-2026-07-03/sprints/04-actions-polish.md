# Sprint 04: Actions & Polish

**Status**: Not Started
**Priority**: Medium
**Branch**: `feat/workshop-s4-actions-polish` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 2–4 days
**Depends on**: Sprint 03

## Goal

Make the Workshop feel like the approved prototype. Add the deterministic
per-tool quick-action bar, the tools modal, variation cards with Copy / Save to
notes, toasts, the welcome/empty state, and full status/token integration.
File `.todo` entries for everything the ADR parked out of scope so it's tracked,
not smuggled.

## Current Reality

- Sprints 1–3 give us a booting surface, host-side session state, streaming
  turns, and multi-turn continuation. What's missing is the contextual
  affordance layer the prototype leans on.
- The prototype's `pm-direction-b.js` `ASSIST` table is the source of truth for
  the quick-action map — per-tool follow-up chips with prompt templates.
- "Save to notes" reuses existing note-writing plumbing; **Apply to draft is
  explicitly out of scope** (needs range/dirty-buffer design via
  `FileOperationsHandler` later).

## Tasks

- [ ] Add `WORKSHOP_QUICK_ACTION` to `workshop.ts`.
- [ ] Static quick-action map in code: `toolId → action labels → prompt
      templates`, ported from the prototype's `ASSIST` table. Deterministic
      routing; **no model-generated labels**.
- [ ] Render the contextual quick-action bar beneath each assistant turn;
      a chip dispatches `WORKSHOP_QUICK_ACTION`, which routes through the
      Sprint-3 continuation path (a quick action is a templated follow-up).
- [ ] Tools modal: a palette/modal for selecting the active tool from the 14.
- [ ] Variation cards: render variations with Copy and "Save to notes" actions.
      (No Apply-to-draft — filed as `.todo`.)
- [ ] Toasts for copy / save / error acknowledgements.
- [ ] Welcome / empty state for a fresh session (no excerpt, no turns).
- [ ] Full status-ticker and token integration (`useAnalysis` status patterns,
      `useTokenTracking`).
- [ ] Persistence hardening: confirm reload/reopen restores thread, excerpt,
      active tool, and conversation id via the host-side aggregate +
      `retainContextWhenHidden`.
- [ ] File `.todo` entries for the parked items:
      - `apply-to-draft` (write-back via `FileOperationsHandler`)
      - `WebviewPanelSerializer` (persistence across VS Code restarts)
      - sidebar reskin (Frame Minion across the sidebar)
      - Model Browser (header dropdown → full browser)
      - branch board (Direction C) on variation cards
- [ ] Register the sidebar-Assistant button that opens the Workshop (the
      user-facing entry point beyond the command palette).

## Acceptance Criteria

- Each assistant turn shows the correct per-tool quick-action chips; clicking
  one runs a templated follow-up in the same conversation.
- The tools modal switches the active tool; variation cards Copy and Save to
  notes work; toasts confirm.
- Fresh sessions show the welcome state; status and token widgets are live.
- Reload/reopen restores the full session (thread, excerpt, tool, conversation).
- All parked items have `.todo` files; none are silently dropped.
- Lint, typecheck, tests, build, bundle verification green. Note final
  `dist/webview.js` size delta in the PR.

## Notes / Guardrails

- Quick actions are deterministic UI — the LLM never generates a button label
  in v1. If you're tempted, that's a post-v1 experiment.
- Apply-to-draft stays out. Copy + Save to notes only. Write-back is its own
  design problem.
- Prefer reusing note-writing and status/token rails over new plumbing — the
  epic's whole thesis is "one new slice, everything else reused."
