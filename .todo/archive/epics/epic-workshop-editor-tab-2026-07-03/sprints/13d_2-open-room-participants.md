# Sprint 13D_2: Open Room Participants

**Status**: Complete — Extension Development Host smoke performed
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-13d_2-open-room-participants` -> PR into `epic/workshop-editor-tab`
**Depends on**: Sprint 13D / PR #90
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md)
**Governed by**: [ADR 2026-07-26 — Workshop Open Rooms Admit Persona Guests](../../../../../docs/adr/2026-07-26-workshop-open-room-participants.md)
**Design load**: Low — existing invitation, scope, and context-meter surfaces

## Goal

Finish the open-room participant contract: let the writer invite and continue
with persona guests without an excerpt, keep the guest's initial context
truthful and symmetric with the host, and remove two misleading pieces of
composer status copy.

## Scope

### Open the open room

- Show **Invite guest** in a ready open conversation even when no excerpt is
  pinned.
- Admit host and persona-guest messages through one aggregate subject guard:
  open scope or a valid excerpt.
- Keep direct tool sidecars and writer-launched analysis tools excerpt-gated.
- Build guest joins with the bounded room snapshot, either the pinned excerpt
  or the open-conversation honesty frame, and the current standing context.
- Seed the retained guest's context-source manifest with exactly the pin and/or
  standing attachments delivered at join.

### Fix lifecycle-only catch-up copy

- Keep session-start and session-resume markers in the room ledger.
- Do not show `Catching <participant> up on the room…` when those markers are
  the only pending delivery.
- Preserve that copy for actual unseen writer, participant, tool-report, or
  context-change turns.

### Name the context owner

- In an excerpt-free open room, show the active participant's name in the
  context meter (for example, `Jill`).
- Leave the no-excerpt explanation to the existing header and scope strip.

## Exit criteria

- [x] A writer can invite a persona guest from an open room.
- [x] The guest join prompt says no excerpt was provided and includes standing
  context without pretending it is a passage.
- [x] The guest can continue in that open room and use capabilities that are
  valid without an excerpt.
- [x] Direct tool sidecars remain unavailable without an excerpt.
- [x] A session lifecycle marker alone uses ordinary streaming/continuation
  status, while real pending room activity still uses catch-up status.
- [x] The open-room context meter identifies the active participant without
  repeating `No excerpt yet`.
- [x] Focused tests, typecheck, lint, architecture checks, and the full suite
  pass.

## Verification

- Focused Workshop contract after PR #91 review fixes: 308 tests passed.
- Full Jest suite after PR #91 review fixes: 1,446 tests passed across 133
  suites; snapshot passed.
- `npm run typecheck`: passed for core, webview, and extension.
- `npm run lint`: passed with the repository's existing warnings and no errors.
- `npm run build`: production extension/webview bundles compiled and bundle
  sentinel verification passed; webpack reported only its existing size
  warnings.
- `git diff --check`: passed.
- Extension Development Host smoke exercised open-room invitation, target
  switching, and the bare participant context label. The smoke exposed a
  five-slot identity-dot collision; the final fix gives all twelve canonical
  personas distinct stable slots and is covered by component/utility tests.
- Final re-review hardening makes the guest join writer-source snapshot a
  required adoption input; missing provenance can no longer silently become an
  empty manifest.
