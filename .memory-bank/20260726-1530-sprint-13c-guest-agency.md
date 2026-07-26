# Sprint 13C: Guest Agency — implemented

**Date**: 2026-07-26
**Branch**: `sprint/workshop-editor-tab-13c-guest-agency` → PR into `epic/workshop-editor-tab`
**Spec**: `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/13c-guest-agency.md`
(status updated to Implemented; deliberate mock departures recorded there)

## What landed

### UI (high design fidelity to the 2026-07-24 comps)

- **Split-sheet pickers**: `WorkshopModalShell` gained `variant="sheet"`
  (fixed header / scrolling body / docked footer; `.pm-ws-modal-sheet`).
  `WorkshopPersonaBrowserModal` deleted, replaced by:
  - `WorkshopInviteGuestModal` — select-then-send (card click = modal-local
    check, no provider call), footer opening-message dock glued to
    `Read in <Persona>`, amber `Default message` → green `Personalized` nudge
    chip (click = select-all), one-shot soft confirm on an untouched default
    (announced via `role="status"`), host/in-room/room-full cards state why.
  - `WorkshopChooseHostModal` — same card vocabulary, current host
    pre-selected + tagged `Current`, footer note + `Choose/Keep <Name>`,
    header points at More info, Esc reverts by closing.
  - Shared `WorkshopPersonaSheetGrid` (locked cards use `aria-disabled` +
    visible tag + reason, never silent `disabled`).
- **Generated guest openings**: `defaultWorkshopGuestOpening(personaId?)` from
  per-persona `guestOpeningFocus` ("Hey Felix! read the room and help me with
  the rhythm here."). Never references an excerpt. Selection change rewrites
  only untouched copy; any edit pins the writer's text.
- **Rail divider (ADR 2026-07-24 §9)**: rail is now labeled
  `role="group"` Participants / Instruments with a real `role="separator"`;
  invite chip lives in Participants.
- **Composer reflow (writer request + `.wk-crow` comp)**: textarea full-width
  on top; `+` / Add excerpt / mode chip / Tools / send in a controls row
  docked beneath (`.pm-ws-comp-controls`).
- New `alert` / `info` icons in the shared Icon set.

### Capability ownership (ADR 2026-07-24 §2)

- `WorkshopPersonaCapabilityTurn`: + `owner: WorkshopCapabilityPrincipal`
  (`host | personaGuest(personaId)`) and retained `conversationId`.
- `WorkshopCapabilityArtifactDetails.invokedBy` **persists the invoking
  principal**; shape validator accepts/validates it; hydration migration
  `defaulted-capability-principal` stamps `{kind:'host'}` on pre-13C
  checkpoints (host was the sole invoker).
- `recordCapabilityArtifact`: input `hostRequestId` → `requestId`; the guard
  now requires the principal to own the active run (guest artifact only lands
  in that guest's turn).
- **Privacy**: `isHostThreadTurn` excludes guest-invoked capability artifacts —
  they never reach host prompts, other guests' catch-up, or guest→host
  handoff; the writer still sees them in the ledger.
- **Guest wiring**: `WorkshopHandler` mints a participant capability for host
  AND personaGuest sends, and for the invite join;
  `startWorkshopGuestConversation` accepts a capability (workshop-host run
  policy when present). Per-turn budgets/cancellation ride the existing
  factory counters + AbortSignal.

## Verification

- `npm run typecheck` (core, webview, ext) — clean.
- `npx jest` — 129 suites / 1394 tests pass, including new suites:
  InviteGuestModal (10), ChooseHostModal (6), rail separator tests, session
  principal/privacy tests, hydration-migration test, guest-capability policy
  test.
- `npm run lint` — 0 errors (warnings match pre-existing repo pattern).
- `npm run build` — webpack + verify-bundle OK.
- **Outstanding**: manual EDH pass (F5) for visual fidelity + reduced-motion.

## Follow-ups / notes

- 13D still owns: `audience()` predicate, `includeGuestTurns` removal, room
  ledger delivery offsets, single-delivery-site architecture guard.
- `AGENT_RUN_POLICIES.workshopHost` now also governs capability-bearing guest
  runs; consider renaming (e.g. `workshopParticipant`) in 13D cleanup.
