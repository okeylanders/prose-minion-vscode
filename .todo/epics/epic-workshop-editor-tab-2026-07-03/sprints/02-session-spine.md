# Sprint 02: Session Spine (single turn)

**Status**: Complete (merged 2026-07-07, [PR #67](https://github.com/okeylanders/prose-minion-vscode/pull/67) — review: all 14 Open findings addressed on-branch; Deferred #8/#12 carried into Sprint 03, #13 tracked in epic Known Risks)
**Priority**: High
**Branch**: `claude/sprint-02-session-spine-skndyo` → PR into `epic/workshop-editor-tab`
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

- [x] `packages/core/src/shared/types/messages/workshop.ts`: `WORKSHOP_RUN_TOOL`
      (toolId + excerpt ref), `WORKSHOP_RESET_SESSION`, `WORKSHOP_SET_EXCERPT`,
      `WORKSHOP_TURN` (extension→webview: a completed turn). Export from the
      messages `index.ts`. (`WORKSHOP_SEND_MESSAGE` / `WORKSHOP_QUICK_ACTION`
      arrive in Sprints 3–4.) *Also added `WORKSHOP_REQUEST_SESSION` /
      `WORKSHOP_SESSION_STATE` — the reload-safety criterion needs a snapshot
      pair; mount-request is the established idiom (`useModelsSettings`).*
- [x] Add `'workshop'` to `StreamingDomain` in `streaming.ts`. *Cancel wire
      deliberately excluded: `CancellableStreamingDomain` in
      `streamingCancelMessages.ts` documents that the host self-preempts and
      the webview cancel affordance arrives with the composer.*
- [x] `WorkshopSessionService` under `application/services/`: owns the session
      aggregate — pinned excerpt + source metadata, context-brief reference,
      ordered turns (`user | assistant`), active tool. Pure, host-side,
      constructor-injected deps, unit-testable without React or vscode.
- [x] `WorkshopHandler` under `handlers/domain/`: constructor-injected
      (`MessageTransport`, `LogSink`, the assistant tool service,
      `WorkshopSessionService`). Handles `WORKSHOP_RUN_TOOL` → invoke the tool,
      stream chunks under `domain: 'workshop'`, append the completed
      assistant turn to the session, post `WORKSHOP_TURN`. Handles
      `WORKSHOP_SET_EXCERPT` and `WORKSHOP_RESET_SESSION`.
- [x] Register `WorkshopHandler` in `MessageHandler` exactly like the other 11
      (import, field, `new` from injected services, route).
- [x] `useWorkshop` hook under `presentation/webview/hooks/domain/` with the
      tripartite State / Actions / Persistence interfaces. Consume streaming;
      render turns from `WORKSHOP_TURN` + live chunks. Wire the previously-static
      model-select and balance placeholders to `useModelsSettings`
      (`assistantModel` scope) and `useAccountBalance`.
- [x] `WorkshopApp` composes `useWorkshop` with `useAccountBalance`,
      `useModelsSettings`, `useTokenTracking`, `useMessageRouter`. Enable the
      tool palette; run-tool streams into the thread. Composer stays disabled
      (free text is Sprint 3).
- [x] Service-level unit tests for the session aggregate: set excerpt, run a
      tool appends a `user`+`assistant` turn pair, reset clears turns, active
      tool tracked. No React needed. *(8 tests; plus 12 WorkshopHandler tests
      and a MessageHandler-level reload-safety test: two handlers over one
      bundle serve the same session.)*

### Carried from Sprint 01 / PR #66 review (lands WITH this sprint, not after)

- [ ] **Sprint 01 leftover — F5 click-through**: confirm
      `prose-minion.openWorkshop` opens the shell in a real extension host
      (do this FIRST, before wiring anything — headless boot-checks covered
      the bundle, never a live VS Code window).
      **Sprint 02 outcome: environment-blocked, needs a LOCAL F5.** The
      remote container has xvfb but the network policy 403s
      `update.code.visualstudio.com`, so no VS Code binary can be fetched. A
      ready-to-run `@vscode/test-electron` smoke (opens the panel, asserts
      the `prose-minion.workshop` webview tab exists, and proves
      reveal-idempotence — one panel, never two) is included below under
      "F5 smoke recipe"; it was verified up to the download wall.
- [x] **ErrorBoundary coverage in `WorkshopApp`** (#10, Sam): wrap rail /
      thread / composer sections the way `App.tsx` wraps its tabs — required
      the moment dynamic session data can throw mid-render. Static shell was
      verifiably throw-free; this sprint isn't.
- [x] **Single-services witness** (#12, Tim): when the panel gets its
      `MessageHandler`, assert the one `coreServices` bundle is reused — the
      risk isn't two panels, it's two independently-polling
      `AccountBalanceService`s under `retainContextWhenHidden`.
      *Went deeper than the witness: Tim's scenario exposed that the shared
      services' single-slot callbacks + `MessageHandler.dispose()` would let
      one surface's teardown blind the other. See Decisions below.*
- [x] **Scoped `:focus` styles in `workshop.css`** (#14, Sam): the enabled
      tool palette (and later composer) must not depend on index.css's
      unscoped `input:focus` looking right by token-inheritance coincidence.
- [x] **CSPRNG nonce in `webviewHtml.ts`** (#15, Patricia): swap
      `Math.random()` for `crypto` before real model content renders in
      either surface.
- [ ] *(Opportunistic, #11, Cal)*: a small fake-panel fixture would let
      `WorkshopPanelProvider`'s reveal-if-exists / dispose lifecycle get real
      behavior tests — none exist repo-wide for providers yet. *Not taken this
      sprint; the F5 smoke suite below asserts reveal-idempotence in a live
      host, and the MessageHandler reload-safety test covers the
      session-survives-reopen half. A fake-panel fixture remains open.*

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

## Decisions made in-sprint (PR review starting points)

1. **Two webviews, one nervous system — listener sets replace single-slot
   callbacks.** With the panel getting its own `MessageHandler` over the
   shared `CoreServices`, the old wiring had two failure modes: constructor
   *steal* (last-opened surface takes `setTokenUsageCallback` /
   `setStatusEmitter`) and dispose *blinding* (closing the Workshop cleared
   the sidebar's callbacks and disposed the shared `AccountBalanceService`).
   Now: `AIResourceManager.addTokenUsageListener` +
   `addStatusListener` on AssistantTool/Dictionary/CategorySearch services,
   each returning an unsubscribe the owning handler releases on dispose.
   `AccountBalanceService` lifecycle moved to `extension.ts`
   (`context.subscriptions`). Found along the way: `MessageHandler`'s own
   direct AIRM status registration had been dead code since inception —
   `AnalysisHandler`'s emitter overwrote it ten lines later. Removed.
2. **Guide-loading status is gated on an active run per handler** (both
   `AnalysisHandler` and `WorkshopHandler`): the emitters are service-level
   and shared, so un-gated forwarding would strand one surface's "Loading
   craft guides…" in the other with nothing to clear it. Cosmetic corollary:
   dictionary/context runs no longer piggyback the analysis-labelled guide
   ticker (that was an accident of the single slot).
3. **`WORKSHOP_RESET_SESSION` keeps the pinned excerpt** — the acceptance
   criterion says "clears the thread and active tool", and a New Session over
   the same working text is the useful behavior. Re-pinning replaces
   explicitly.
4. **Session snapshots ride the replay cache** (`ResultCache.workshopSession`
   + visibility flush in the panel), so streams completed while the tab was
   hidden reconcile on re-reveal — same idiom as the sidebar's cached results.
5. **API-key warning stays out of the thread**: a run against a missing key
   surfaces through the error rail (`isApiKeyNotConfiguredWarning` reused);
   the session records only the attempted user turn.
6. **Model browser pulled INTO this sprint** (Okey, post-F5 review): the
   header's model chip is now the shared `ModelSelector` + `ModelBrowserModal`
   — the exact component pair the sidebar uses, assistant scope, with only
   the trigger reskinned in workshop.css. This was previously unscheduled
   (the epic's "Model Browser" follow-up line covers the bigger standalone
   feature, not this reuse). File-picker excerpt seeding from the same review
   went to Sprint 3's task list, joining selection seeding.
7. **Bundle delta (production build, Sprint-01 base → Sprint 02):**
   `webview.js` 528,566 → 543,608 bytes (+14.7 KB, +2.8%); `extension.js`
   2,230,883 → 2,240,792 bytes (+9.7 KB, +0.4%). The model-browser wiring
   cost +392 bytes — the modal was already bundled via the sidebar. Nowhere
   near needing the entry split flagged in epic Known Risks.

## F5 smoke recipe (run locally; remote env can't fetch VS Code)

One-time: `npm i -D @vscode/test-electron` (or run from a scratch folder as
below — no repo dependency needed). Build first (`npm run build`), then with
these two files in a scratch dir (`npm init -y && npm i @vscode/test-electron`):

`runSmoke.js`:

```js
const path = require('path');
const { runTests } = require('@vscode/test-electron');
(async () => {
  try {
    await runTests({
      extensionDevelopmentPath: '<repo>/apps/vscode-extension',
      extensionTestsPath: path.resolve(__dirname, 'suite'),
      launchArgs: ['--disable-workspace-trust', '--disable-extensions']
    });
    console.log('[f5-smoke] SUCCESS');
  } catch (err) {
    console.error('[f5-smoke] FAILED:', err?.message ?? err);
    process.exit(1);
  }
})();
```

`suite/index.js`:

```js
const vscode = require('vscode');
const assert = require('assert');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.run = async function run() {
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('prose-minion.openWorkshop'), 'command not registered');

  await vscode.commands.executeCommand('prose-minion.openWorkshop');
  await sleep(3000);

  const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
  const workshopTab = tabs.find((t) => t.label === 'Workshop');
  assert.ok(workshopTab, `no Workshop tab; saw: ${tabs.map((t) => t.label).join(', ')}`);
  assert.ok(String(workshopTab.input?.viewType ?? '').includes('prose-minion.workshop'));

  await vscode.commands.executeCommand('prose-minion.openWorkshop');
  await sleep(1000);
  const count = vscode.window.tabGroups.all.flatMap((g) => g.tabs)
    .filter((t) => t.label === 'Workshop').length;
  assert.strictEqual(count, 1, 'openWorkshop duplicated the panel');
  console.log('[f5-smoke] PASS');
};
```

Run: `node runSmoke.js` (Linux headless: `xvfb-run -a node runSmoke.js`).
Sprint 2 manual pass beyond the smoke: pin a pasted excerpt, run Dialogue &
Beats, watch it stream, reload the webview (Developer: Reload Webviews) and
confirm the thread rehydrates, close/reopen the panel and confirm the same.
