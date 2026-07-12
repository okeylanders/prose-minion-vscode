# Workshop Excerpt Revision Loop — Sprint 06C

**Date:** 2026-07-12
**Branch:** `sprint/workshop-editor-tab-06c-excerpt-revision-loop`
**Status:** Implemented and verified locally

## What Landed

- Central prompt-side budget table at
  `packages/core/src/shared/constants/promptBudgets.ts`, character trim
  provenance, and an architecture guard against new local prompt limits.
- Monotonic excerpt versions stamped on excerpts and every Workshop turn.
- Excerpt replacement preserves the persona host, retires tool sidecars and
  direct mode, emits a deterministic divider, and queues only the newest
  revision for the next successful host turn.
- Pending revision/context delivery is generation-safe: failures and
  cancellation do not consume it; a successful host message or synthesis does.
- Editable paste-only Context Brief with bounded host/tool delivery and honest
  UI trim/pending state. Its prompt budget was raised to 10,000 words at the
  writer's request. The Context Selector file-attachment modal remains in
  `.todo/features/feature-workshop-context-selector/README.md`.

## Decisions and Invariants

- The host remains the room's memory; tools are fresh, stateless instruments.
- Replacement performs no model call and never mutates retained history.
- Context survives excerpt replacement and clears on New Session.
- Tool runs read the current context brief when invoked.
- Model-selection changes mutate the existing scope engine's OpenRouter model;
  retained conversations survive because the engine/conversation manager is
  not rebuilt. Duplicate sidebar/Workshop watcher events are idempotent.
- Workshop errors render after the latest thread turn and participate in
  autoscroll so failures cannot hide above a long conversation.
- Static prompt ceilings belong only in `PROMPT_BUDGETS`; Sprint 07 and 09
  planning docs now point new ceilings there.

## Verification

- `npm run lint` — 0 errors (603 existing warnings)
- `npm run typecheck` — passed
- `npm test -- --runInBand --silent` — 84 suites / 643 tests passed
- `npm run build` — passed; bundle sentinel verification passed
- Production bundle sizes: extension 2,322,175 bytes; webview 590,206 bytes
- `git diff --check` — passed

## References

- [Sprint 06C](../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/06c-excerpt-revision-loop.md)
- [Excerpt Revision ADR](../docs/adr/2026-07-11-workshop-excerpt-revision-and-room-memory.md)
- [Architecture](../docs/ARCHITECTURE.md)
