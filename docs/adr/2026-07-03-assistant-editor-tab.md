# ADR 2026-07-03: Assistant as a Full Editor Tab (the Workshop)

**Status:** Accepted
**Date:** 2026-07-03
**Design source:** [docs/design/Prose Minion - Assistant Tab.html](../design/Prose%20Minion%20-%20Assistant%20Tab.html) — the approved "Direction B (Split & Pinned)" interactive prototype, pulled from claude.ai/design project `1219f905-e11d-4b1a-9fc9-f72634b10f4c` on 2026-07-03 (see [docs/design/README.md](../design/README.md))
**Builds on:** [ADR 2026-06-16 — Monorepo Ports & Adapters](2026-06-16-monorepo-ports-and-adapters.md), [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](2026-06-18-messagehandler-composition-root-consolidation.md)
**Extended by:** [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md)

## Context

Today's Assistant lives in the sidebar and is **one-shot**: paste an excerpt,
press a tool button, receive a single result panel. Each press is a fresh
request; there is no follow-up, no "now tighten it," no conversation. The
sidebar column is also simply too narrow for iterating on a passage — the
excerpt, the analysis, and the variations all fight for the same 350px.

The design work (Direction B) reframes the Assistant as a **full VS Code
editor tab** — working title **Workshop**:

- A **left rail** pins the working excerpt, the context brief (with resource
  chips), and a tool palette, so the source material never scrolls away.
- The **right side** is a conversational thread: tool runs and free-text
  follow-ups stream in as turns, each analysis followed by a **contextual
  quick-action bar** (per-tool follow-up chips like "Generate 3 tighter
  variations" / "Add a gesture beat" / "Keep as-is").
- The header carries the brand, a **model selector**, the **OpenRouter
  balance widget**, and a **New session** reset.

What makes this feasible now rather than a moonshot — the audit findings:

1. **The 14 design tools already exist.** The prototype's tool catalog maps
   1:1 onto the current contracts: `dialogue` and `prose` plus the twelve
   `WritingToolsFocus` modes (`gestures`, `cliche`, `repetition`,
   `decision-points`, `show-and-tell`, `choreography`, `stock-and-signature`,
   `placeholders`, `style`, `editor`, `continuity`, `fresh`) in
   [analysis.ts](../../packages/core/src/shared/types/messages/analysis.ts),
   each backed by an existing system-prompt directory. No new AI tooling is
   required — only a new surface over it.
2. **Streaming is built.** `streaming.ts` already defines
   `STREAM_STARTED`/`STREAM_CHUNK`/`STREAM_COMPLETE` with `requestId`
   correlation, a `StreamingDomain` that includes `'analysis'`, and
   cancellation. The thread UI consumes what already flows.
3. **Multi-turn plumbing exists at the orchestration layer.**
   `ConversationManager`
   (`packages/core/src/infrastructure/api/orchestration/`) already holds
   per-conversation message histories keyed by conversationId; today's
   handlers just never continue one.
4. **The chrome widgets are built.** Balance → `useAccountBalance` +
   `AccountBalanceHandler`; model selection → `useModelsSettings`
   (`assistantModel` scope); status ticker → `useAnalysis` patterns.

What does **not** exist: any editor-tab webview surface (the extension
registers exactly one `WebviewViewProvider` for the sidebar), and any notion
of a *session* above the infrastructure layer (thread of turns, pinned
excerpt, active tool, quick actions).

## Decision

Build the Workshop as a **new domain slice + a second webview surface**,
following every existing pattern rather than inventing parallel ones.

### 1. New host surface: a `WebviewPanel` in the adapter

- `apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts`
  — owns a single `vscode.window.createWebviewPanel('proseMinion.workshop', …)`
  instance (reveal-if-exists, `retainContextWhenHidden: true` for v1).
- A new command `prose-minion.openWorkshop` (command palette + a button in
  the sidebar Assistant tab + an editor context-menu entry that seeds the
  pinned excerpt from the current selection, reusing the
  `handleAssistantSelection` seeding path).
- The panel reuses the **existing webview bundle** (`dist/webview.js`). The
  HTML generator sets a surface flag (`<div id="root" data-pm-surface="workshop">`);
  the webview entry point renders `<WorkshopApp/>` or the existing `<App/>`
  based on it. One bundle, two roots — no second build pipeline.
- All services come from the existing `CoreServices` bundle built in
  `extension.ts`. **Nothing is `new`-ed in the provider or handler** (the
  ADR 2026-06-18 architecture witness must stay green).

### 2. New domain: `workshop` (12th domain slice)

Mirroring the domain-organization pattern on both sides:

- **Messages** — `packages/core/src/shared/types/messages/workshop.ts`:
  `WORKSHOP_RUN_TOOL` (toolId + excerpt ref), `WORKSHOP_SEND_MESSAGE`
  (free text follow-up), `WORKSHOP_QUICK_ACTION`, `WORKSHOP_RESET_SESSION`,
  `WORKSHOP_SET_EXCERPT`, `WORKSHOP_TURN` (extension→webview: a completed
  turn), plus reuse of the existing streaming suite (`domain: 'analysis'`
  gains a sibling `'workshop'` in `StreamingDomain`).
- **Handler** — `WorkshopHandler` in
  `packages/core/src/application/handlers/domain/`, constructor-injected
  (`MessageTransport`, `LogSink`, the assistant tool service, and a new
  `WorkshopSessionService`), registered in `MessageHandler` exactly like the
  other 11.
- **Session service** — `WorkshopSessionService`
  (`application/services/`): owns the session aggregate — pinned excerpt +
  source metadata, context brief reference, ordered turns
  (`user | assistant`), active tool, and the derived quick-action set. It
  drives `ConversationManager` for genuine multi-turn continuations (system
  prompt = the active tool's prompt; follow-ups append to the same
  conversation instead of restarting it). **This is the architectural
  centerpiece: session state lives host-side, not in React state**, so a
  webview reload/reopen restores the thread.
- **Hook** — `useWorkshop` in `presentation/webview/hooks/domain/` with the
  tripartite State/Actions/Persistence interfaces; `WorkshopApp` composes
  it with the existing `useAccountBalance`, `useModelsSettings`,
  `useTokenTracking`, and `useMessageRouter`.

### 3. Quick actions are deterministic; content is not

Per-tool follow-up chips are a **static map in code** (toolId → action
labels → prompt templates), exactly as prototyped in `pm-direction-b.js`'s
`ASSIST` table — deterministic routing, LLM only for the response content.
No model-generated button labels in v1.

### 4. Design language scope

The Workshop ships in the **Frame Minion design language** from
`pm-mock.css` (warm-brown tokens, coral accent, the balance widget, result
panels keeping their monospace character) — ported as CSS
custom-properties/classes into the webview stylesheet, scoped under the
workshop root. **The sidebar reskin and the Model Browser are explicitly
out of scope** — separate follow-ups, so this ADR doesn't conflate a new
surface with a restyle of the old one. A temporary look divergence between
sidebar and Workshop is acceptable in alpha.

### 5. Out of scope for v1 (tracked, not smuggled)

- **Apply to draft** (writing a variation back into the source file) — v1
  ships Copy + "Save to notes" only; write-back needs its own design for
  ranges/dirty buffers and will go through `FileOperationsHandler` later.
- **Branch board** (Direction C) and branching semantics on variation cards.
- **Session persistence across VS Code restarts** (`WebviewPanelSerializer`)
  — v1 persists within the window via host-side session state +
  `retainContextWhenHidden`.
- **Model Browser** — the header keeps the existing dropdown pattern.

## Consequences

**Positive**
- The Assistant becomes iterative — the core writing loop ("analyze →
  variations → tighten → compare") happens in one thread with the excerpt
  pinned in view, which is the actual job the sidebar could never do.
- The slice rides existing rails end-to-end: tools, prompts, streaming,
  cancellation, token tracking, balance, model scoping. The genuinely new
  code is one provider, one handler, one service, one hook, one React root.
- Host-side session state makes the thread testable (service-level unit
  tests, no React needed) and reload-safe — the same lesson ADR 2026-06-18
  encoded for caches.
- The domain-mirroring table stays honest: `useWorkshop` ↔ `WorkshopHandler`.

**Costs / risks**
- `retainContextWhenHidden` keeps the panel's webview process alive in the
  background — acceptable for a single panel, revisit with the serializer.
- Two React roots in one bundle grows `dist/webview.js`; measure, and split
  entries only if it actually hurts (avoid premature build surgery).
- `ConversationManager` has never been driven multi-turn by a handler;
  expect small gaps (e.g. token budgeting across turns, conversation
  disposal on reset) — sized inside Sprint 2, and its `console.*` logging
  should move to the injected `LogSink` while we're in there (ADR
  2026-06-18, Step 2 leftover).
- A 12th domain nudges `MessageHandler` wiring bigger; the consolidation
  ADR made that a mechanical, tested seam — this is the first real proof.

## Sequencing (proposed epic: `epic-workshop-editor-tab-2026-07-03`)

Implementation split the original dense middle sprint and later added the
persona-hosted conversation expansion. The live seven-sprint sequence is tracked
in the [epic plan](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md); the three steps below preserve the
original decision record.

Each sprint independently shippable behind the command:

1. **Sprint 1 — Shell.** Command + `WorkshopPanelProvider` + surface-flag
   routing to a `WorkshopApp` root; FM tokens ported; static layout (header
   with model select/balance/New session, left rail, empty thread, composer
   disabled). Assembly + architecture tests extended to the new provider.
2. **Sprint 2 — Session domain.** `workshop.ts` messages, `WorkshopHandler`,
   `WorkshopSessionService` + `ConversationManager` integration; run-tool
   turns streaming into the thread; free-text follow-ups; reset; selection
   seeding from the editor context menu. Service-level tests for the session
   aggregate.
3. **Sprint 3 — Actions & polish.** Quick-action bar (deterministic map),
   tools modal, variation cards (Copy / Save to notes), toasts, status/token
   integration, welcome state, persistence hardening; `.todo` entries filed
   for the out-of-scope items (apply-to-draft, serializer, sidebar reskin,
   Model Browser).

## Alternatives considered

- **Direction A (pure conversation thread) / Direction C (branch board).**
  Rejected by design review — A loses the pinned excerpt (the whole point of
  a wide surface), C is the most novel interaction model and the riskiest
  first step. B was approved; C's branching can layer onto B's cards later.
- **Grow the sidebar Assistant instead of a new surface.** Rejected: the
  split layout fundamentally needs editor-tab width; cramming a thread into
  350px reproduces today's problem with more steps.
- **Webview state as the session store (React-only, `vscode.setState`).**
  Rejected: makes the session untestable outside React, dies with the panel,
  and puts the source of truth on the wrong side of the message boundary.
  Host-side service + dumb view is the house pattern.
- **A second webview bundle/entry for the Workshop.** Rejected for v1:
  doubles build config and watch overhead before there's evidence of a size
  problem. The surface flag costs one conditional.
- **Model-generated quick actions.** Rejected for v1: non-deterministic UI,
  extra latency and cost per turn; the static per-tool map already matches
  the approved prototype exactly.
