# PR Review — Post-#60: OpenRouter account balance + React 18 + App.tsx router extraction + facelift

**Author:** okeylanders · Post-#60 work on `epic/monorepo-ports-and-adapters` (no single PR — the 17 commits that landed on the epic branch after the Stage-2 monorepo move)
**Reviewed:** 2026-06-18 (multi-agent pass — 10 reviewers + Sensei)
**Base:** PR #60 merge commit `ad413e80a` · **Head:** epic `5ab6671`
**Status:** ✅ **Fixups landed in `19bbd99`** (same `epic` branch) — every actionable finding addressed on-branch; **no 🔴 blockers were raised** (Blake cleared every correctness path). **The one 🟠 High fixed:** `proseMinion.ui.sidebarTheme` added to `MessageHandler.UI_KEYS` so a Settings-panel change broadcasts to the webview (parity with its sibling `ui.showTokenWidget`). **All other Standards/Nits fixed** except the conscious deferrals listed below (composition-root injection, `reason` closed-union, the key-transition floor edge, the sticky-last-cost product call, and three cosmetic/negligible nits) — each with rationale. New: `balanceFormat.test.ts` (the previously-untested 6-branch headline logic) + behavioral STATUS-route tests + a both-failed service test. Post-fixup: **47 suites / 359 tests · 3 typechecks clean · `npm run lint` 0 errors**. The original review (below) stands as the record; see **Resolution Status** at the bottom for per-item disposition.

> ⚠️ Diff is +4293 / −863 across **59 files**, above the ~800-line focus threshold — but ~1,800 of those lines are `package-lock.json` (React 18) + `index.css` retokenization. Agent attention was weighted to the ~3,600-line logic surface: the new OpenRouter account-balance vertical slice, the `App.tsx`→`useAppMessageRouter` extraction, and the theme/settings wiring. The checked-out epic tree was read on disk to verify behavior claims.

---

## Blast Radius

- **59 files** · **+4293 / −863** · **17 commits**. Migrations: **none**.
- New runtime surface: an **OpenRouter account-balance vertical slice** — `infrastructure/account/{OpenRouterAccountClient,AccountBalanceService,accountTypes,index}`, `application/handlers/domain/AccountBalanceHandler`, `shared/types/messages/accountBalance`, `presentation/webview/hooks/domain/useAccountBalance`, `presentation/webview/components/balances/{AccountBalanceWidget,balanceFormat,index}`, wired in `MessageHandler` (the post-AI-request refresh is armed from `applyTokenUsage`). New handler: `AccountBalanceHandler`. New service: `AccountBalanceService`.
- Other themes: **React 18** (`index.tsx` → `createRoot`; lockfile), an **`App.tsx` refactor** (the ~140-line inline message-router literal lifted into a pure `buildAppMessageRoutes` in `hooks/useAppMessageRouter.ts`; SVG logo → `PmLogo.tsx`), and a **theme/palette facelift** (`useThemeSettings`, `ThemeToggle`, `Icon`, `AllToolsModal`, `TabBar`, a large `index.css` retokenization, palette default flipped to `follow-vscode`).
- Tests added in range (5): `AccountBalanceService`, `OpenRouterAccountClient`, `AccountBalanceHandler`, `useAccountBalance`, `useAppMessageRouter`. (No test for `balanceFormat` or the `AccountBalanceWidget` UI at review time.)
- Character: a clean, fail-safe, well-documented single-provider port of FrameMinion's ADR-010 balance feature, plus a behavior-preserving router extraction and a cosmetic reskin.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B− |
| 🛡️ Security | B |
| 🧪 Tests | B− |
| 📖 Quality | B− |
| ⚡ Performance | B+ |
| 🎯 Domain | B− |

Solid B/B− across the board: a well-built, fail-safe feature with no blockers. The grades sit at B− not from breakage but because the polish gaps cluster in three predictable places — what the tests *assert* vs *touch*, the *edges* of the state space (zero / negative / no-cost / both-failed), and a couple of *claimed-but-unenforced* "single source of truth" lines.

---

## Status by item

| # | Severity | Finding | Reviewer(s) | Status |
|---|----------|---------|-------------|--------|
| 1 | 🟠 High | **`proseMinion.ui.sidebarTheme` missing from `MessageHandler.UI_KEYS`.** Registered in package.json + emitted in `SETTINGS_DATA`, but absent from the config-watcher key array, so a change made in the **VS Code Settings panel** returns `false` from `shouldBroadcastUISettings` and never reaches the webview (stale until reload). Its sibling `ui.showTokenWidget` walks the full path. | Stan (rated 🔴 Blocking) | ✅ Fixed in `19bbd99` — added to `UI_KEYS`. (Stan argued Blocking; orchestrator scoped 🟠 High — consequence is a stale cosmetic setting that self-heals on reload, not data corruption/exception.) |
| 2 | 🟡 Standard | **STATUS source-routing tested for existence, not behavior** — the route's own docblock names STATUS a top refactor-risk, yet no test asserts which domain handler fires for `extension.dictionary` vs `extension.analysis` vs the default. | Cal · Sam (🎯 Consensus) | ✅ Fixed in `19bbd99` — 3 behavioral tests (dictionary, search, unrecognized→analysis fallback). |
| 3 | 🟡 Standard | **`useAccountBalance` drops the tripartite `persistedState` leg** every sibling hook declares — defensible (balance is ephemeral) but unannounced; the next author copying it inherits a non-compliant shape. | Marcus · Stan (🎯 Consensus) | ✅ Fixed in `19bbd99` — explicit documented `persistedState: Record<string, never>`; spread into App's `usePersistence`. |
| 4 | 🟡 Standard | **`openRouterHeadline` — pure 6-branch display fn — has zero tests** while everything around it got covered. The easiest thing to unit-test was left untested. | Cal | ✅ Fixed in `19bbd99` — new `balanceFormat.test.ts` covers every branch + signed formatting. |
| 5 | 🟡 Standard | **No injection seam for the balance slice in `MessageHandler`** — it `new`s both `AccountBalanceService` and its client internally rather than receiving them from the composition root (`ProseToolsViewProvider`), unlike FrameMinion. The application layer took on infrastructure wiring. | Marcus | ↪ Deferred — pre-existing pattern (`CategorySearchService` does the same in this file); a composition-root move is a larger refactor tracked for a follow-up. No behavior risk. |
| 6 | 🟡 Standard | **`$X.toFixed(3)` bypasses the `fmtUsd` "single source of truth"** (2dp) for the "Last request" line; the strip also re-derives the headline logic instead of calling `openRouterHeadline`. The DRY claim isn't enforced. | Parker | ✅ Fixed in `19bbd99` — added `fmtUsdMicro` (3dp) to `balanceFormat`; the widget routes through it. (Strip↔pill headline unification left as a smaller follow-up; both still agree numerically — see #8.) |
| 7 | 🟡 Standard | **Unpriced real request clears the prior shown cost** — `lastRequestCostUsd = undefined` wipes a previously-shown "$0.014". | Bria | ⏸️ Deferred (declined, with rationale) — "—" is the *correct* honest display for **Last request**: surfacing a prior request's cost under that label would misattribute it. Kept as-is. |
| 8 | 🟡 Standard | **Negative balance** (`totalCredits − totalUsage` < 0) rendered as `$-0.50` labeled "Account balance"; zero and debt share one tone + one label. | Sam · Bria (🎯 Consensus) | ◐ Partial in `19bbd99` — signed formatting fixed (now `-$0.50` via a shared `signedUsd` helper, pinned by a test). The zero-vs-overdrawn **copy** distinction (a product-wording call) is deferred. |
| 9 | 🟡 Standard | **Key `false→true` forced refresh can be eaten by the 1s `MIN_FORCED_INTERVAL_MS` floor** if it lands just after a cached `no_key` → widget can show "no key" for up to 120s. | Sam | ⏸️ Deferred — narrow timing window (the floor is human-paced; the transition is machine-paced). Candidate fix: exempt the key-transition forced refresh from the floor, or don't serve a cached `no_key`/`unavailable` to a forced call. Tracked. |
| 10 | 🟡 Standard | **`useThemeSettings` comment/code drift** — header says "'warm-dark' (default)"; the runtime default is `follow-vscode` (recent flip). | Parker | ✅ Fixed in `19bbd99` — comment corrected. |
| 11 | 🟡 Standard | **`AccountBalanceHandler` `outputChannel?` optional** while all 5 sibling handlers require it. | Stan | ✅ Fixed in `19bbd99` — required; `?.` dropped; tests pass a log mock. |
| 12 | 🟡 Standard | **`resolveOpenRouter` silent when both `/key` + `/credits` fail** — no service-level summary; the cache then serves `unavailable` for 120s with no further log, so an on-call sees silence, not a cause. | Oliver | ✅ Fixed in `19bbd99` — one summary log line at the failure transition; a both-failed→unavailable test asserts it. |
| 13 | 🟡 Standard | **`reason` forwarded to the webview is typed open `string`** with no boundary re-validation — all values are safe literals today, but a future contributor could echo an upstream body/key fragment. | Patricia | ↪ Deferred — no current vuln (rendered as React text, all literals); closing it properly = a closed string-literal union for `reason` in `accountTypes.ts`, tracked as hardening. |
| 14 | 🟢 Nit | **`console.log` in the `SAVE_RESULT_SUCCESS` route** — lifted verbatim but made permanent in a named module. | Marcus | ✅ Fixed in `19bbd99` — replaced with a documented no-op (route kept so the contract stays explicit + the route-set test stays green). |
| 15 | 🟢 Nit | **`STREAM_STARTED/CHUNK/COMPLETE` repeat the same domain-dispatch if/else 3×.** | Parker | ↪ Deferred — cosmetic; behavior-preserving lifted code. Avoided churn in the freshly-extracted router. |
| 16 | 🟢 Nit | **Forced-over-non-forced-in-flight coalescing path untested.** | Cal | ↪ Deferred — very narrow; happy-path coalescing + rate-limit floor are covered. |
| 17 | 🟢 Nit | **`runRefresh`'s catch is structurally dead** (`settle()` absorbs throws so `fetchAll` never rejects) — a log line that can't fire. | Oliver | ◐ Addressed-adjacent — the real observability gap is fixed by #12; the defensive catch is **kept intentionally** (so a future `settle`-contract change can't surface an unhandled rejection). |
| 18 | 🟢 Nit | **`buildAppMessageRoutes` rebuilds 26 closures per render** → the `[handlers]` effect runs every commit. | Tim | ↪ Deferred — negligible at a one-sidebar interaction model; pre-existing; `useMemo` if App renders ever get hot. |
| 19 | 🟢 Nit | **React 18 StrictMode double-fires the mount balance request** (dev only). | Tim | ↪ No action (informational) — dev-only; the service's `pending` coalescing dedupes to one HTTP hit. Worth knowing the guarantee lives in the service, not the hook. |
| 20 | 🟢 Nit | **`Icon` `dangerouslySetInnerHTML` has no runtime `undefined` guard** for a future `as`-cast. | Patricia | ✅ Fixed in `19bbd99` — `PATHS[name] ?? ''`. |
| P1 | 🟢 Praise | **The slice is correctly isolated & fail-safe** — per-call `/key`+`/credits` isolation, handler never throws to the router, keys never leave the host, `dispose()` cancels the timer + drops listeners. | Blake | — |
| P2 | 🟢 Praise | **Every fan-out path is bounded** — trailing debounce + `pending` coalescing + `AbortSignal.timeout(8s)`; a hung billing endpoint can't pin the shared promise. | Tim | — |
| P3 | 🟢 Praise | **Key-leakage path cleanly closed end-to-end** — the key lives only inside the two `fetch` calls; logs carry only the numeric status; the lone webview-supplied input is a cache-bypass boolean. | Patricia | — |
| P4 | 🟢 Praise | **`logBroadcastError` + WARN/DEBUG tagging** are the right instinct for a level-less `LogSink`. | Oliver | — |
| P5 | 🟢 Praise | **The `isRealRequest` guard** correctly partitions real completions from zero-token activation/reset (skips both the refresh and the last-cost write). | Bria | — |

---

## Executive Briefing

🟠 **[Stan — rated Blocking; orchestrator set High]** `proseMinion.ui.sidebarTheme` missing from `MessageHandler.UI_KEYS` — a theme change from the VS Code Settings panel never broadcasts to the webview (stale until reload), unlike its sibling `ui.showTokenWidget`. One-line fix.

🎯 **[Cal · Sam — Consensus] · Standard** STATUS route tested for *existence*, not *behavior* — no assertion that `extension.dictionary` reaches the dictionary handler vs the analysis default; the docblock itself names it the top refactor-risk spot.

🎯 **[Marcus · Stan — Consensus] · Standard** `useAccountBalance` silently drops the tripartite `persistedState` leg every sibling honors — the next author who copies it inherits a non-compliant shape.

🟡 **[Cal] · Standard** `openRouterHeadline` — a pure 6-branch display fn — has zero tests, while the service/client/handler/hooks around it are all covered.

🟡 **[Bria] · Standard** On a real-but-unpriced request, `lastRequestCostUsd` is set to `undefined`, clearing a previously-shown cost — "last known cost" isn't sticky.

> **Blake found nothing blocking.** Per-call isolation holds, `fetchAll` never rejects, the handler never throws to the router, keys never leave the host, `dispose()` cancels cleanly. *"Walked every limb of this slice with a flashlight at 3am and the goblins stayed home — ship it."*

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### ✅ Fixed — `useAccountBalance` omits the tripartite `persistedState` leg [🎯 Consensus]

`useAccountBalance.ts` — every other domain hook exports `State & Actions & { persistedState }`. Dropping it is defensible (balances are re-fetched on mount), but unannounced; a one-line comment or an explicit empty `persistedState` signals "understood, not forgotten." *(Fixed in `19bbd99` — documented `AccountBalancePersistence = Record<string, never>`, returned `{}`, spread into App's `usePersistence`.)*

### ↪ Deferred — No injection seam for `AccountBalanceService` in `MessageHandler`

`MessageHandler.ts:308` — the application layer `new`s both the service and its client internally; FrameMinion's ADR-010 routes them through the composition root. `CategorySearchService` is a pre-existing precedent, so this isn't a regression — but it's the first *new* pattern post-#60. *(Deferred — composition-root move is a larger refactor; no behavior risk.)*

### ✅ Fixed (Nit) — `console.log` promoted into a permanent module

`useAppMessageRouter.ts` — the `SAVE_RESULT_SUCCESS` route logged to the browser console; lifted verbatim, but extraction gave it permanence. *(Fixed in `19bbd99` — documented no-op.)*

> *"The thing that gives me pause is that `MessageHandler` is playing composition root for this slice — the application layer now owns infrastructure wiring that belongs one level up."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟢 Praise — The slice is correctly isolated and fail-safe

Traced every path that could corrupt data or throw. `settle()` converts any client throw into `{ ok:false, status:'unavailable' }`, so a `/credits` 403 keeps `/key` data and a regressed client can't reject the shared `pending` promise. The handler swallows failures into an `unavailable` payload; keys are read host-side only; `isRealRequest` gates both the refresh and the last-cost write on zero-token activation/reset. *Noted, non-blocking:* two simultaneous **forced** callers racing a non-forced in-flight fetch can each launch a separate fetch — a rare duplicate billing hit, not a correctness issue.

> *"Walked every limb of this slice with a flashlight at 3am and the goblins stayed home — ship it."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### ⏸️ Deferred — Key `false→true` forced refresh can be eaten by the 1s floor

`useAccountBalance.ts:78` — if a user saves a key within ~1s of the cached `no_key` response, the key-transition's forced refresh hits `MIN_FORCED_INTERVAL_MS` and is served the cached `no_key` — "no key" can persist up to 120s. The floor is right for human-paced manual refreshes but also gates this machine-paced transition. *(Deferred — narrow window; candidate fix: exempt the transition from the floor, or don't serve a cached negative to a forced call.)*

### ◐ Partial — Negative balance renders `$-0.50` [🎯 Consensus with Bria]

`balanceFormat.ts:47` — `remaining = totalCredits − totalUsage` can go negative; `fmtUsd` yielded `$-0.50`. *(Fixed in `19bbd99` — now `-$0.50` via a shared `signedUsd` helper, pinned by a test; the zero-vs-debt label copy is deferred — see Bria #8.)*

> *"Okay but what happens when the key save races the mount response by 800 ms — `MIN_FORCED_INTERVAL_MS` eats the forced refresh and the widget serenely insists there is no key for the next two minutes."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### ✅ Fixed — `$X.toFixed(3)` bypasses the `fmtUsd` "single source of truth"

`AccountBalanceWidget.tsx:69` — `balanceFormat.ts` is declared the one place USD formatting lives, but the "Last request" line rolled its own 3dp format. *(Fixed in `19bbd99` — `fmtUsdMicro` added to `balanceFormat`; the widget routes through it.)*

### ✅ Fixed — `useThemeSettings` comment/code drift

`useThemeSettings.ts:10` — header said "'warm-dark' (default)"; the runtime default is `follow-vscode`. *(Fixed in `19bbd99`.)*

### ↪ Deferred (Nit) — `STREAM_*` repeat the same domain-dispatch 3×

`useAppMessageRouter.ts:97` — a small `routeByDomain` helper would collapse the copy-paste. *(Deferred — cosmetic; avoided churn in the freshly-lifted, behavior-preserving router.)*

> *"The file tells you `fmtUsd` is the single source of truth, and then two lines later formats a dollar amount without it — that's not a single source of truth, that's a suggestion board."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### ✅ Fixed — `openRouterHeadline`: 6-branch pure function, zero tests

`balanceFormat.ts:28` — `Searched diff for balanceFormat in __tests__/ — not found.` Branches for null/no_key/unavailable/credits/keyLimit-fallback/`limit===0`/negative; a collapsed branch ships silently. *(Fixed in `19bbd99` — `balanceFormat.test.ts` covers all of them + the signed format.)*

### ✅ Fixed — STATUS source-routing untested [🎯 Consensus with Sam]

`useAppMessageRouter.test.ts` — the suite covered STREAM and ERROR routing but not STATUS, which the docblock names highest-risk. *(Fixed in `19bbd99` — behavioral tests for the dictionary + search routes and the analysis fallback.)*

### ↪ Deferred (Nit) — Forced-over-non-forced coalescing path untested

`AccountBalanceService.test.ts:65` — the mid-flight forced-on-non-forced edge isn't exercised. *(Deferred — very narrow; happy-path coalescing + the rate-limit floor are covered.)*

> *"The comment says STATUS is where a refactor is most likely to go wrong — and then the test watches STATUS enter the room, nods politely, and never asks where it's going."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### ✅ Fixed — `proseMinion.ui.sidebarTheme` missing from `UI_KEYS` *(Stan: 🔴 Blocking)*

`MessageHandler.ts:154` — `Searched diff for UI_KEYS — never updated.` Absent from the config-watcher key array, so an external Settings-panel change never reaches the webview, while its sibling `ui.showTokenWidget` walks the full path. *(Fixed in `19bbd99` — orchestrator scoped it 🟠 High: stale cosmetic setting until reload, not corruption/exception.)*

### ✅ Fixed — `AccountBalanceHandler` `outputChannel?` optional vs every sibling required

`AccountBalanceHandler.ts:25` — `UIHandler`, `MetricsHandler`, `SearchHandler`, `ConfigurationHandler`, `FileOperationsHandler` all require it. *(Fixed in `19bbd99` — required; `?.` dropped; tests updated.)*

### ✅ Fixed — `useAccountBalance` omits `persistedState` [🎯 Consensus with Marcus]

(Same as Marcus; cited against `useAnalysis`/`useSearch`/`useSelection`/`useThemeSettings`.) *(Fixed in `19bbd99`.)*

> *"Every `UI_KEYS` is an implicit contract that someone remembered to sign — `showTokenWidget` remembered to sign it and `sidebarTheme` quietly walked past."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### ↪ Deferred (Nit) — `buildAppMessageRoutes` rebuilds 26 closures per render

`useAppMessageRouter.ts:216` — new map each render → the `[handlers]` effect runs every commit. O(1), GC'd promptly, negligible at a one-sidebar model, and pre-existing. *(Deferred — `useMemo` if App renders ever get hot.)*

### ↪ No action (Nit) — React 18 StrictMode double-fires the mount request

`useAccountBalance.ts:71` — dev-mode double-invoke; the service's `pending` coalescing dedupes to one HTTP hit. The "no double-fetch" guarantee lives in the **service**, not the hook. *(Informational.)*

### 🟢 Praise — Every fan-out path is bounded

Debounce (`clearTimeout` per call) + `pending` coalescing + `AbortSignal.timeout(8s)` compose cleanly; a hung billing endpoint can't pin the shared promise (worst case 16s, bounded + documented).

> *"At N=7 fine, but the `[handlers]` effect churn is one of those problems that was already there before anyone named it."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### ↪ Deferred — `reason` is an open `string` forwarded to the webview

`AccountBalanceService.ts:177` — `Searched diff for raw-body echoing — not found`; every `reason` today is a hardcoded literal (only the numeric HTTP status interpolated), rendered as React text — no XSS, no current leak. The concern is forward-looking: an open `string` with no boundary re-validation. *(Deferred — hardening = a closed string-literal union in `accountTypes.ts`; tracked, no current vuln.)*

### ✅ Fixed (Nit) — `Icon` `dangerouslySetInnerHTML` had no runtime `undefined` guard

`Icon.tsx:86` — type-safe today, but a future `as`-cast path would render `undefined`. *(Fixed in `19bbd99` — `PATHS[name] ?? ''`.)*

### 🟢 Praise — Key-leakage path cleanly closed end-to-end

The key lives only inside `fetchKeyLimit`/`fetchCredits`, goes straight into the `Authorization` header, never reaches a log line or result struct; `logHttpFailure` logs only the numeric status; the lone webview input is a cache-bypass boolean.

> *"The difference between 'theoretically the reason field could someday leak' and 'the reason field is leaking right now' is the difference between a finding and a fire — and this diff earns the former at most."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### ✅ Fixed — `resolveOpenRouter` silent when both sub-calls fail

`AccountBalanceService.ts:171` — the widget shows "—" with no service-level summary, and once the `unavailable` payload is cached the channel goes quiet for 120s. *(Fixed in `19bbd99` — one summary log line at the failure transition + a both-failed→unavailable test.)*

### ◐ Addressed-adjacent (Nit) — `runRefresh`'s catch is structurally dead

`AccountBalanceService.ts:137` — `settle()` absorbs throws so `fetchAll` never rejects. *(The real gap is fixed by #12; the defensive catch is **kept intentionally** so a future `settle`-contract change can't surface an unhandled rejection.)*

### 🟢 Praise — `logBroadcastError` + WARN/DEBUG tagging

The right instinct for a level-less `LogSink`: fire-and-forget config broadcasts get rescued from silent `void`; a `/credits` 403 (normal) lands DEBUG while a 5xx lands WARN.

> *"Two separate 500s in the client logs, silence at the service layer, a cached '—' for the next two minutes — I'm not saying it's broken, I'm saying I can't tell."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### ⏸️ Deferred (declined) — Unpriced request clears the previously-shown cost

`MessageHandler.ts:409` — on a real request where the provider omits `costUsd`, `lastRequestCostUsd = undefined` clears a prior "$0.014". *(Declined — "—" is the correct honest display for **Last request**: showing a prior request's cost under that label would misattribute it. Kept as-is.)*

### ◐ Partial — Negative balance labeled "Account balance" with no debt distinction [🎯 Consensus with Sam]

`AccountBalanceWidget.tsx:131` — `$0.00` and `-$5.00` shared one tone + one label. *(Signed formatting fixed in `19bbd99`; the zero-vs-overdrawn **copy** distinction is a product-wording call, deferred.)*

### 🟢 Praise — `isRealRequest` guard correctly partitions real vs zero-token calls

`MessageHandler.ts:407` — activation init and reset (both zero-token) cleanly skip both `scheduleRefresh()` and the last-cost write; the comment is honest about what `undefined` means.

> *"'Account balance: $-5.00' is technically correct the way a doctor saying 'you have negative health' is technically correct."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Checklist Illusion

Illuminated by: Stan's `UI_KEYS` gap, Parker's comment drift

A multi-step pattern ("add a setting", "lift a module") *feels* done the moment the primary artifact exists — and a head-checklist has no checkboxes, only a feeling of doneness. The `UI_KEYS` omission is the canonical form: every visible step was taken, the happy path worked, and the gap only surfaces in one specific interaction.

→ Carry forward: When you complete a multi-step pattern, write the checklist *explicitly* and tick each item in the commit message. If `AGENTS.md` names the steps, treat it as a literal checklist.

### Lesson 2 — Existence vs. Behavior

Illuminated by: Cal + Sam (STATUS), Cal (`openRouterHeadline`)

A test that exercises a path proves it doesn't crash; it does not prove the path does the right thing. Writing an assertion is harder than writing a call — it forces you to articulate *what should happen* — so we skip it and test by touch.

→ Carry forward: After writing a test, ask: *"If I swapped in the two most likely wrong implementations, would this test catch it?"* If no, you're documenting a call, not protecting a contract.

### Lesson 3 — The Quiet Cache

Illuminated by: Oliver (silent unavailable), Sam (key-transition floor), Bria (undefined clears cost)

Fail-safe and observable are different properties, and this slice optimized hard for the first. A cache serving `unavailable` for 120s with no logs, a cost that silently clears, a floor that swallows a transition — each does the *safe* thing without *saying* anything. Silence isn't neutral; it asserts "nothing is wrong," which is false.

→ Carry forward: For every path that degrades silently, ask: *"What does an on-call see in the logs 20 minutes later?"* If "nothing useful," log at the degradation site.

### Lesson 4 — Claimed Truth vs. Enforced Truth

Illuminated by: Parker (`balanceFormat`/`fmtUsd`), Marcus (tripartite shape), Patricia (open `string`)

"Single source of truth" in a comment or filename is an aspiration, not a guarantee. `balanceFormat.ts` is the right idea; the `toFixed(3)` two files over is the wrong application of it — and the gap is a *missing enforcement seam*, not a wrong value.

→ Carry forward: When you write "single source of truth," immediately ask *"what stops a future contributor from duplicating this?"* If the only answer is "they'll read the comment," add a type or test that makes duplication fail.

### Lesson 5 — Edge Citizenship

Illuminated by: Sam + Bria (negative balance), Oliver (both-failed)

We design for the center of the state space and treat the edges as rare specials. But negative balance, zero cost, and "both providers fail" aren't corner cases — they're the states that matter *most* when something is wrong. "$-0.50" in a cheerful font is the software equivalent of a weather app saying "It's raining!" in sunny-day styling.

→ Carry forward: After a feature, enumerate the full state space — zero, negative, undefined, failed — and check each renders with the right *tone*, *label*, and *data*. Edges deserve their own design.

> *"A refactor that moves code into better structure is only finished when it also moves the contracts — the tests, the comments, the checklists, the type constraints — into equally better structure alongside it."* — Sensei

---

## The Closer

### 🐾 If this MR were an animal…

…it would be an **octopus**. Each arm acts on its own (per-call `/key`+`/credits` isolation, no shared failure), it guards its ink so nothing sensitive escapes (keys never leave the host), and it changes color to match its surroundings (`follow-vscode`). Three hearts keep it alive under load — the debounce, the pending-coalescing, and the abort timeout. The only catch: every so often it clamps onto a stale snack (a cached `no_key`) and won't let go for a full two minutes, and at the edges of its tank it'll cheerfully display `$-0.50` as though that were a perfectly normal number to be holding. *(Post-fixup: the `$-0.50` now reads `-$0.50`, and the stale-snack edge is documented for a follow-up.)*

---

## Summary

A strong, fail-safe, well-documented feature with **no blockers** — Blake cleared every correctness path, Patricia closed the key-leak boundary, Tim confirmed the fan-out is bounded. The one item worth fixing before further work — the **`UI_KEYS` sidebarTheme sync gap** — is fixed, along with the highest-value follow-ups (a `balanceFormat` unit test, a behavioral STATUS-route test, the negative-balance formatting, the both-failed observability log, and the tripartite-shape + handler-consistency tidy-ups). The conscious deferrals (composition-root injection, the `reason` closed-union, the key-transition-floor edge, the sticky-last-cost product call, and three negligible/cosmetic nits) are tracked above as the area's known debt. Post-fixup the gate is green: **47 suites / 359 tests · 3 typechecks clean · lint 0 errors.**

---

## Resolution Status

All fixups in **`19bbd99`** (same `epic` branch). Post-fixup: **47 suites / 359 tests · `npm run typecheck` (core + webview + ext) clean · `npm run lint` 0 errors**.

- **#1 🟠 `UI_KEYS` sidebarTheme — ✅ Fixed.** Added `'proseMinion.ui.sidebarTheme'` to `MessageHandler.UI_KEYS`; an external Settings-panel change now broadcasts `SETTINGS_DATA` to the webview, matching `ui.showTokenWidget`.
- **#2 🟡 STATUS behavior test [🎯] — ✅ Fixed.** Three behavioral cases in `useAppMessageRouter.test.ts`: `extension.dictionary`→dictionary, `extension.search`→search, unrecognized→analysis fallback.
- **#3 🟡 `useAccountBalance` persistedState [🎯] — ✅ Fixed.** Documented `AccountBalancePersistence = Record<string, never>`; returns `{}`; spread into App's `usePersistence`.
- **#4 🟡 `balanceFormat` tests — ✅ Fixed.** New `balanceFormat.test.ts` pins every `openRouterHeadline` branch + `fmtUsd`/`fmtUsdMicro` (incl. signed/zero/negative).
- **#5 🟡 Composition-root injection — ↪ Deferred.** Pre-existing pattern (`CategorySearchService`); larger refactor; no behavior risk.
- **#6 🟡 `fmtUsd` DRY — ✅ Fixed.** Added `fmtUsdMicro`; the "Last request" line routes through it (no inline `toFixed(3)`).
- **#7 🟡 Sticky last-cost — ⏸️ Deferred (declined).** "—" is the correct honest display for "Last request"; surfacing a prior request's cost would misattribute it.
- **#8 🟡 Negative balance [🎯] — ◐ Partial.** Signed format fixed (`-$0.50`, test-pinned); zero-vs-debt copy distinction deferred (product wording).
- **#9 🟡 Key-transition refresh floor — ⏸️ Deferred.** Narrow window; candidate fix (exempt the transition / don't serve a cached negative to a forced call) tracked.
- **#10 🟡 Theme comment drift — ✅ Fixed.** Comment now says `follow-vscode (default)`.
- **#11 🟡 Handler `outputChannel` — ✅ Fixed.** Now required; `?.` dropped; handler tests pass a log mock.
- **#12 🟡 Both-failed observability — ✅ Fixed.** One service-level summary log at the failure transition; a both-failed→unavailable test asserts status + the log.
- **#13 🟡 `reason` open-string — ↪ Deferred.** No current vuln (literals, React-text rendered); closed-union hardening tracked.
- **#14 🟢 `console.log` — ✅ Fixed.** Replaced with a documented no-op (route kept so the route-set test stays green and the contract stays explicit).
- **#15 🟢 STREAM_* repetition — ↪ Deferred.** Cosmetic; behavior-preserving lifted code.
- **#16 🟢 Coalescing test — ↪ Deferred.** Very narrow; happy-path coalescing covered.
- **#17 🟢 `runRefresh` dead catch — ◐ Addressed-adjacent.** Real gap fixed by #12; defensive catch kept intentionally.
- **#18 🟢 Closure churn — ↪ Deferred.** Negligible/pre-existing.
- **#19 🟢 StrictMode double-fire — ↪ No action.** Dev-only; absorbed by service coalescing (informational).
- **#20 🟢 `Icon` undefined guard — ✅ Fixed.** `PATHS[name] ?? ''`.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
