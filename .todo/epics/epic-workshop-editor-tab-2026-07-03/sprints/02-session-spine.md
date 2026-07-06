# Sprint 02: Session Spine (single turn)

**Status**: Not Started
**Priority**: High
**Branch**: `feat/workshop-s2-session-spine` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 2–4 days
**Depends on**: Sprint 01

## Goal

Give the Workshop a nervous system for **one turn**. Introduce the `workshop`
domain (messages + handler + session service), wire the 12th domain into
`MessageHandler`, and make a single tool run stream into the thread with the
excerpt pinned host-side. Session state lives in `WorkshopSessionService`, not
React. **No follow-up continuation yet** — that is Sprint 3's job. Running a
tool a second time starts a fresh turn, not a continuation.

## Current Reality

- 11 domain handlers exist under
  `packages/core/src/application/handlers/domain/`; `MessageHandler.ts` is a
  hand-wired composition root (import → private field → `new` with injected
  deps → route). Workshop is the 12th, and this seam is mechanical.
- Only `StandardsComparisonService` exists under `application/services/`, so
  `WorkshopSessionService` is genuinely new.
- Streaming already exists: `streaming.ts` defines
  `STREAM_STARTED` / `STREAM_CHUNK` / `STREAM_COMPLETE` with `requestId`
  correlation and a `StreamingDomain`. We add `'workshop'` alongside
  `'analysis'`.
- The 14 tools (`dialogue`, `prose`, 12 `WritingToolsFocus` modes) already
  exist in `analysis.ts`, each backed by a system-prompt directory. We route
  to them, not rebuild them.

## Tasks

- [ ] `packages/core/src/shared/types/messages/workshop.ts`: `WORKSHOP_RUN_TOOL`
      (toolId + excerpt ref), `WORKSHOP_RESET_SESSION`, `WORKSHOP_SET_EXCERPT`,
      `WORKSHOP_TURN` (extension→webview: a completed turn). Export from the
      messages `index.ts`. (`WORKSHOP_SEND_MESSAGE` / `WORKSHOP_QUICK_ACTION`
      arrive in Sprints 3–4.)
- [ ] Add `'workshop'` to `StreamingDomain` in `streaming.ts`.
- [ ] `WorkshopSessionService` under `application/services/`: owns the session
      aggregate — pinned excerpt + source metadata, context-brief reference,
      ordered turns (`user | assistant`), active tool. Pure, host-side,
      constructor-injected deps, unit-testable without React or vscode.
- [ ] `WorkshopHandler` under `handlers/domain/`: constructor-injected
      (`MessageTransport`, `LogSink`, the assistant tool service,
      `WorkshopSessionService`). Handles `WORKSHOP_RUN_TOOL` → invoke the tool,
      stream chunks under `domain: 'workshop'`, append the completed
      assistant turn to the session, post `WORKSHOP_TURN`. Handles
      `WORKSHOP_SET_EXCERPT` and `WORKSHOP_RESET_SESSION`.
- [ ] Register `WorkshopHandler` in `MessageHandler` exactly like the other 11
      (import, field, `new` from injected services, route).
- [ ] `useWorkshop` hook under `presentation/webview/hooks/domain/` with the
      tripartite State / Actions / Persistence interfaces. Consume streaming;
      render turns from `WORKSHOP_TURN` + live chunks. Wire the previously-static
      model-select and balance placeholders to `useModelsSettings`
      (`assistantModel` scope) and `useAccountBalance`.
- [ ] `WorkshopApp` composes `useWorkshop` with `useAccountBalance`,
      `useModelsSettings`, `useTokenTracking`, `useMessageRouter`. Enable the
      tool palette; run-tool streams into the thread. Composer stays disabled
      (free text is Sprint 3).
- [ ] Service-level unit tests for the session aggregate: set excerpt, run a
      tool appends a `user`+`assistant` turn pair, reset clears turns, active
      tool tracked. No React needed.

### Carried from PR #66 review (Deferred pile — lands WITH this sprint, not after)

- [ ] **ErrorBoundary coverage in `WorkshopApp`** (#10, Sam): wrap rail /
      thread / composer sections the way `App.tsx` wraps its tabs — required
      the moment dynamic session data can throw mid-render. Static shell was
      verifiably throw-free; this sprint isn't.
- [ ] **Single-services witness** (#12, Tim): when the panel gets its
      `MessageHandler`, assert the one `coreServices` bundle is reused — the
      risk isn't two panels, it's two independently-polling
      `AccountBalanceService`s under `retainContextWhenHidden`.
- [ ] **Scoped `:focus` styles in `workshop.css`** (#14, Sam): the enabled
      tool palette (and later composer) must not depend on index.css's
      unscoped `input:focus` looking right by token-inheritance coincidence.
- [ ] **CSPRNG nonce in `webviewHtml.ts`** (#15, Patricia): swap
      `Math.random()` for `crypto` before real model content renders in
      either surface.
- [ ] *(Opportunistic, #11, Cal)*: a small fake-panel fixture would let
      `WorkshopPanelProvider`'s reveal-if-exists / dispose lifecycle get real
      behavior tests — none exist repo-wide for providers yet.

## Acceptance Criteria

- Selecting a tool with a pinned excerpt streams a result into the thread as a
  turn; token usage and balance update through the existing rails.
- Session state survives a webview reload (host-side aggregate rehydrates the
  thread) — the ADR's reload-safety criterion.
- `WORKSHOP_RESET_SESSION` clears the thread and active tool.
- `MessageHandler` routes all `WORKSHOP_*` messages; architecture tests confirm
  the handler is composed from injected services and `new`-s nothing.
- Service unit tests cover set-excerpt, run-tool turn append, and reset.
- Lint, typecheck, tests, build, bundle verification green.

## Notes / Guardrails

- **Single turn only.** If you call `ConversationManager.addMessage` to continue
  a prior conversation, you're in Sprint 3. Each run-tool here may
  `startConversation` fresh.
- Keep the deterministic quick-action map out of this sprint — chips are Sprint 4.
- Excerpt seeding from the editor selection (context menu) is Sprint 3; here
  `WORKSHOP_SET_EXCERPT` can be driven from the left-rail UI / a test.
