# MR Review — Monorepo ports & adapters: vscode-free core + account balance + React 18 + facelift

**Author:** okeylanders · PR #61 → `main`
**Reviewed:** 2026-06-18 (pre-merge multi-agent pass — 10 reviewers + Sensei)
**Base:** `main` (`828187d`) · **Head:** `epic/monorepo-ports-and-adapters` (`3d89140`)
**Status:** ✅ **Fixups landed in `270974e`** — no blockers were raised; the 🟠 High and 8 of the actionable Standards/Nits are fixed on-branch, the remaining 3 consciously deferred with rationale (one to the ADR 2026-06-18 consolidation epic, one behavior-preserving, one matching the file's own deferred comment). Post-fixup: **48 suites / 368 tests · 3 typechecks clean · lint 0 errors** (+9 new tests). The original review below stands as the record; see **Resolution Status** at the bottom for per-item disposition.

**Landing:** PR #61 merges this epic into `main` as a **merge commit (no squash)**. The constituent-chunk reviews ([pr-59](pr-59-ports-and-adapters-core-vscode-free-review.md), [pr-60](pr-60-stage-2-monorepo-move-review.md), [pr-60B](pr-60B-account-balance-and-facelift-review.md)) and this landing review are the committed record of the epic.

> ⚠️ **Aggregate landing PR.** 377 files / +12,867 / −3,909 / 50 commits, but **~95% is mechanical**: the `src/**` → `packages/core/src/**` relocation, `resources/` move (114 files), `package-lock.json` (React 18), and `index.css` retokenization. The constituent chunks were already multi-agent-reviewed with fixups merged — see [pr-59](pr-59-ports-and-adapters-core-vscode-free-review.md), [pr-60](pr-60-stage-2-monorepo-move-review.md), [pr-60B](pr-60B-account-balance-and-facelift-review.md). Agent attention was weighted to the **net-new logic surface** (~2,964 lines): the OpenRouter account-balance vertical slice, the `Platform` ports + VS Code adapters, the `App.tsx`→`useAppMessageRouter` extraction, and `MessageHandler`'s config-watcher seam. The **`MessageHandler` second-composition-root drift, `sharedResultCache` module singleton, and `any`-typed handler seams are consciously DEFERRED** per [ADR 2026-06-18](../adr/2026-06-18-messagehandler-composition-root-consolidation.md) and were excluded from scope — agents were instructed not to re-litigate them.

---

## Blast Radius

- 377 files changed · +12,867 / −3,909 lines · 50 commits
- New files: account-balance slice (`AccountBalanceService`, `OpenRouterAccountClient`, `accountTypes`, `AccountBalanceHandler`, `balanceFormat`, `useAccountBalance`, `AccountBalanceWidget`), 7 `Platform` port interfaces + 5 `VsCode*` adapters, `useAppMessageRouter`, `pathContainment`, the `@prose-minion/core` barrel
- Migrations: **none** · New services/handlers: **3** (`AccountBalanceService`, `OpenRouterAccountClient`, `AccountBalanceHandler`) + 7 ports
- Characterization: clean conflict-free landing of an already-reviewed epic; the review's value is net-new integration/correctness signal, not re-coverage of the move.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B− |
| 🛡️ Security | B |
| 🧪 Tests | C+ |
| 📖 Quality | B− |
| ⚡ Performance | B+ |
| 🎯 Domain | B− |

---

## Status by item

| # | Severity | Finding | Reviewer(s) | Consensus | Status |
|---|----------|---------|-------------|-----------|--------|
| 1 | 🟠 High | `total_usage` absent/NaN → 0 overstates displayed `remaining` balance (asymmetric with guarded `total_credits`) | Sam | | ✅ Fixed in `270974e` |
| 2 | 🟡 Standard | `isRealRequest`/`scheduleRefresh` seam: untested gate + two-jobs-one-gate + debounce re-arm churn | Cal, Bria, Tim | 🎯🎯 Strong | ◐ Partial in `270974e` |
| 3 | 🟡 Standard | Forced-over-non-forced coalescing branch untested (correct per Blake, but the one unpinned concurrency case) | Cal, Blake | 🎯 Consensus | ✅ Fixed in `270974e` |
| 4 | 🟡 Standard | `fmtUsdMicro` — misleading SI name (3dp ≠ micro) + omitted from `balances/index.ts` barrel | Parker, Stan | 🎯 Consensus | ✅ Fixed in `270974e` |
| 5 | 🟡 Standard | `AccountBalanceHandler.postMessage` typed `=> void` drops the transport Promise (siblings use `Promise<void>`) | Stan | | ✅ Fixed in `270974e` |
| 6 | 🟡 Standard | `PromptLoader`/`GuideLoader` `path.join(promptPath)` lacks the `isPathWithinRoot` guard `UIHandler` got | Patricia | | ✅ Fixed in `270974e` |
| 7 | 🟡 Standard | `runRefresh` catch returns without notifying listeners (stale widget; inconsistent with handler's `unavailable` post) | Oliver | | ✅ Fixed in `270974e` |
| 8 | 🟡 Standard | `Platform.secrets` declared + populated + threaded but never read; secrets flow via parallel `secretsService: any` | Marcus | | ↪ Deferred (ADR 2026-06-18) |
| 9 | 🟡 Standard | `STATUS` route falls back to `analysis` for unknown source (behavior preserved verbatim from the App.tsx lift) | Parker | | ⏸️ Deferred (behavior-preserving) |
| 10 | 🟢 Nit | `pendingForced`/`forced`/`forceRefresh` — three spellings of one concept in 30 lines | Parker | | ✅ Fixed in `270974e` |
| 11 | 🟢 Nit | `isPathWithinRoot` not symlink-aware (matches the file's own deferred comment; FM uses a 2nd `realpath` layer) | Patricia | | ⏸️ Deferred (per file comment) |
| 12 | 🟢 Nit | `resolveWebviewView` clobbers prior `MessageHandler` without pre-dispose (safe today under `retainContextWhenHidden`) | Marcus, Blake | | ✅ Fixed in `270974e` |
| 13 | 🟢 Praise | Account-balance lifecycle/disposal + error isolation airtight | Blake | | ✅ |
| 14 | 🟢 Praise | `/key`+`/credits` parallelized with per-call fault isolation | Tim | | ✅ |
| 15 | 🟢 Praise | Key→webview boundary structurally provable — no payload field can hold a key | Patricia | | ✅ |

---

## Executive Briefing

🟠 **[Sam]** `total_usage` zero-fallback overstates the balance — when `/credits` omits/NaNs `total_usage`, `remaining = totalCredits − 0` shows the user their *full* credits with spend erased. The twin field `total_credits` has an explicit guard; `total_usage`, parsed three lines away, has none. Real-world trigger is low (OpenRouter reliably returns the field) but the asymmetry is concrete and it's a money number.

🟡 **[Cal · Bria · Tim — 🎯🎯 Strong Consensus]** The `MessageHandler.applyTokenUsage` → `isRealRequest`/`scheduleRefresh` seam is the most-touched region: the `totalTokens>0` gate that suppresses the activation/reset refresh is untested (a contract enforced only by a comment), it conflates "a real spend happened" with "show last cost" (a future flat-fee/zero-token model skips both), and the debounce re-arms per token event. All correct at current model scope; none pinned.

🟡 **[Cal · Blake — 🎯 Consensus]** The forced-over-non-forced coalescing branch (`forceRefresh && !this.pendingForced`) is the one concurrency case with no test — Blake traced it as correct (one redundant billing GET, never wrong data), but every *other* concurrency path is tested and this one guards the "never serve pre-spend data" invariant.

🟡 **[Patricia]** `PromptLoader`/`GuideLoader` join a caller-supplied `promptPath` to the extension root with no containment guard, while `UIHandler` was hardened with `isPathWithinRoot` in three places. The guard exists, is tested, and is applied next door — defense-in-depth, not a live exploit (the model-named-file vector is non-trivial), but a conspicuous inconsistency.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — `Platform.secrets` is populated but never consumed [Item 8]

`packages/core/src/platform/Platform.ts` — The `Platform` bundle declares `readonly secrets: SecretStore`, the composition root populates it (`secrets: context.secrets`), and `ProseToolsViewProvider` threads it through — but **no code in `packages/core` ever reads `platform.secrets`.** Every secret access in `MessageHandler` flows through the separately-injected `secretsService: any` (constructor). The port shape exists and is wired, but its consumer is a different, untyped channel: two independent doors to the same `vscode.SecretStorage`, one labelled-and-locked, one unmarked-and-open. When the deferred `secretsService: any` is eventually typed, this discrepancy resurfaces as "which path owns secrets." Fix: either remove `secrets` from `Platform` (let `SecretStorageService` satisfy `ApiKeyProvider` directly), or fold its construction into the `Platform` assembly and delete the duplicate constructor param.

### 🟢 Nit — `resolveWebviewView` clobbers prior handler without pre-dispose [Item 12]

`apps/vscode-extension/src/application/providers/ProseToolsViewProvider.ts:70` — `this.messageHandler = new MessageHandler(…)` is assigned without a preceding `this.messageHandler?.dispose()`. Benign today: `retainContextWhenHidden: true` means VS Code never re-resolves without an intervening `onDidDispose` (Blake independently confirmed this). But the `configWatcher` correctly disposes-before-reassign two lines up — the handler should mirror it so the invariant is explicit against future registration changes.

> *"The port exists, the field is populated, the wiring is present — but no consumer reads it; the architecture has two doors to the same room, one labelled and locked, one unmarked and open."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

### 🟢 Praise — Account-balance lifecycle + error isolation are clean [Item 13]

`packages/core/src/infrastructure/account/AccountBalanceService.ts` — Traced every focus path. The debounce timer + listener set are torn down **twice over**: `MessageHandler.dispose()` calls `disposeBalanceListener()` AND `accountBalanceService.dispose()` (`clearTimeout` + `listeners.clear()`), and that dispose is wired at `ProseToolsViewProvider.onDidDispose` — so a fired-after-teardown post can't happen (`runRefresh`'s loop iterates an emptied Set). `applyTokenUsage`'s `scheduleRefresh` is gated on `isRealRequest` (`totalTokens>0`), so the constructor's zero-reset can't arm a spurious refresh nor touch the not-yet-assigned service. `/key` and `/credits` are isolated via `Promise.all` over `settle()`-wrapped results; a `/credits` 403 keeps `/key` data; genuine `no_key` requires BOTH. `AccountBalanceHandler.handleRequest` catches and posts an `unavailable` payload — never throws to the router. The one wrinkle (a forced `getBalances` atop a non-forced in-flight fetch can start two concurrent billing fetches) yields correct data, just an extra GET — not a blocker (see Item 3).

> *"Nothing here pages me at 3am — the timers die with the view and the only 'bug' is one redundant billing GET that returns the right number anyway."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — `total_usage` absent/NaN silently defaults to 0, overstating `remaining` [Item 1]

`packages/core/src/infrastructure/account/OpenRouterAccountClient.ts` (in `fetchCredits`):

```ts
const totalUsage = isFiniteNumber(data.total_usage) ? (data.total_usage as number) : 0;
return { ok: true, data: { totalCredits, totalUsage, remaining: totalCredits - totalUsage } };
```

When `total_usage` is absent, NaN, or non-numeric, `totalUsage` silently falls to `0` and `remaining` equals `totalCredits` in full — the user's spend is erased from the display. A user who consumed $3.00 of a $5.00 balance would see "$5.00" in both the collapsed pill (`openRouterHeadline → credits.remaining`) and the expanded strip. The asymmetry with `total_credits` is the tell: that field has an explicit guard ("silent-zero would render as a misleading negative" — the inline comment's own words) and returns `unavailable` when absent. `total_usage` has the **opposite** failure mode (misleading *positive*) and no guard. No test exercises `total_credits` present + `total_usage` absent/NaN/string. Fix: a symmetric guard (return `unavailable` when `total_usage` is non-finite), or an explicit + tested carve-out documenting that zero-fallback is intentional for genuinely-new accounts. *(Real-world trigger is low — OpenRouter reliably returns the field — but it's a money number and the inconsistency is concrete.)*

> *"The comment already found the trap door for `total_credits` and bolted it shut — it just forgot to look at the hinges on the other side."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — `STATUS` fallback routes unknown source to `analysis` [Item 9]

`packages/core/src/presentation/webview/hooks/useAppMessageRouter.ts` (~line 131):

```ts
} else {
  // Default to analysis for backward compatibility
  analysis.handleStatusMessage(msg, context.loadingRef);
}
```

Any `STATUS` message with an unrecognized `source` silently calls `analysis.handleStatusMessage`, which can set `analysis.isLoading = true` and leave it stuck. A future `extension.publishing`/`extension.ui` status source would silently spin the Analysis tab's loading indicator. *(Context: this was lifted verbatim from the App.tsx inline router — behavior-preserving by design, not a regression — but the lift promoted a stray "backward compatibility" default into a permanent module; the source set is closed-but-undocumented.)* Fix: drop the fallback arm (or log it), and list any legitimately-analysis sources explicitly.

### 🟡 Standard — `fmtUsdMicro` name implies SI micro (10⁻⁶) but means 3dp [Item 4]

`packages/core/src/presentation/webview/components/balances/balanceFormat.ts:28` — `fmtUsdMicro(value) → signedUsd(value, 3)`. A `$0.014` cost is 1.4 cents — milli-scale, not micro. The name misleads the next author into reaching for a 6dp formatter. `fmtUsdPrecise`/`fmtUsdFine`/`fmtUsdMilli` communicate "more decimals for small values" without borrowing a prefix that means something else.

### 🟢 Nit — Three spellings of one concept in 30 lines [Item 10]

`AccountBalanceService.ts` — `forceRefresh` (param) / `forced` (param) / `pendingForced` (field) all name "this fetch was initiated as a forced refresh." `pendingForced` reads ambiguously; `pendingIsForced` makes the boolean nature explicit at the read site `if (forceRefresh && !this.pendingIsForced)`.

> *"'Backward compatibility' is not a reason to forward a message to the wrong handler forever; that's just calling a bug a feature and checking it in."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟡 Standard — Forced-over-non-forced coalescing branch untested [Item 3]

`__tests__/infrastructure/account/AccountBalanceService.test.ts` — The suite tests concurrent non-forced coalescing and forced rate-limiting *after a cached result*, but not the `forceRefresh && !this.pendingForced` branch: a forced `getBalances(true)` arriving while a **non-forced fetch is still in flight**. That branch (`await this.pending.catch(…)` then a fresh `startFetch(true)`) is the entire reason a caller can't receive pre-spend data after an AI request. Refactor the flag away and nothing fails. *Searched the test for `pendingForced` / `forced.*non-forced` — not found.*

### 🟡 Standard — Throwing-listener isolation untested [Item 2]

`runRefresh`'s per-listener `try/catch` ("A thrown listener is logged but does not block other listeners" — the JSDoc's own promise) has no test. Two listeners, first throws, assert the second still fires. *Searched for `throw` / `multiple listeners` — not found.*

### 🟡 Standard — `isRealRequest` zero-token gate untested [Item 2]

`MessageHandler.applyTokenUsage` — the `totalTokens>0` guard that prevents the activation/reset (all-zeros) call from arming a billing refresh has no test. Flip `>` to a bug or remove the guard and the activation-reset would fire a debounced refresh on every construction. *(MessageHandler has no unit test — known/deferred per ADR 2026-06-18 — so this needs a `scheduleRefresh`-not-called seam that doesn't yet exist.)*

> *"You documented the invariant in the JSDoc and then left it on the honor system."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — `AccountBalanceHandler.postMessage` typed `=> void` drops the Promise [Item 5]

`packages/core/src/application/handlers/domain/AccountBalanceHandler.ts:23` — `private readonly postMessage: (message: AccountBalanceDataMessage) => void`. Every sibling handler in this folder types it `=> Promise<void>` (`AnalysisHandler`, `DictionaryHandler`). The narrowed `void` means `post()`'s `this.postMessage(...)` discards the `Promise<void>` the real `MessageHandler.postMessage` returns — a transport failure during the post-AI-request refresh vanishes without hitting the output channel. Type it `=> Promise<void>` and `void`/`await` it in `post()`, matching the sibling signature and the "log failures" discipline in `runRefresh`.

### 🟢 Nit — `fmtUsdMicro` omitted from the `balances/index.ts` barrel [Item 4]

`balanceFormat.ts` exports `fmtUsd`, `fmtUsdMicro`, `openRouterHeadline`; the barrel re-exports only the first and third. `AccountBalanceWidget.tsx` imports `fmtUsdMicro` via a direct `./balanceFormat` path, bypassing the barrel every other directory honors (`shared/index.ts` re-exports all 15 of its symbols).

> *"`AnalysisHandler` and `DictionaryHandler` are right next door and both say `Promise<void>` — they've been waiting patiently for `AccountBalanceHandler` to catch up."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟢 Praise — `/key` + `/credits` parallelized with per-call fault isolation [Item 14]

`AccountBalanceService.ts` — `Promise.all([settle(fetchKeyLimit), settle(fetchCredits)])` runs both billing sub-calls concurrently, each fault-isolated so a `/credits` 403 still yields key-limit data. At this scale (single provider, one webview, one TTL-cached fetch / 120s) the parallelism budget is spent precisely, nothing left on the table.

### 🟡 Standard — Route map rebuilt every render [Item, perf note]

`useAppMessageRouter.ts` — `buildAppMessageRoutes(deps)` allocates a fresh ~30-key object per App render, immediately stored in `handlersRef.current` (never diffed). GC pressure is negligible at single-sidebar scale and the pre-lift behavior was identical — **not a regression**. Worth a one-line comment so a future contributor doesn't "fix" it with per-route `useCallback` that makes it worse.

### 🟡 Standard — `scheduleRefresh` re-armed per token event [Item 2]

`MessageHandler.applyTokenUsage` — each `totalTokens>0` event does `clearTimeout` + `setTimeout`; if streaming ever emits N intermediate usage events, that's O(N) timer churn for one eventual fetch. Immaterial now (the callback fires ~1–2× per completed request). Document the "fires at most once per completed request" assumption; if streaming goes high-frequency, add an `if (this.refreshTimer) return` early-return guard.

> *"Two calls, one await, per-call fault isolation: the parallelism budget here is spent precisely and nothing is left on the table."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — `PromptLoader`/`GuideLoader` path-join without containment guard [Item 6]

`packages/core/src/tools/shared/prompts.ts:19` (and `guides.ts:27`, identical):

```ts
const fullPath = path.join(this.extensionPath, 'resources', 'system-prompts', promptPath);
```

`promptPath` flows from the tool-orchestration layer; `path.join` normalizes `..`, so a value like `../../../etc/hostname` resolves cleanly outside the intended root. The sibling `UIHandler` was hardened with `isPathWithinRoot` in **three** places (PR #59 fixup); the helper exists, is imported, is unit-tested — it simply wasn't applied to these two bundled-resource loaders, **both of which were content-modified in this PR**. Practical exploitation requires influencing the AI-supplied filename (prompt injection into the model's output, non-trivial) and grants arbitrary-file *read* the extension process can reach (`.env`, other extensions' local state) — **not** direct key exfiltration (the key lives in `context.secrets`, not a readable file). Defense-in-depth + consistency: apply the guard the rest of the codebase already uses.

### 🟢 Nit — `isPathWithinRoot` is not symlink-aware [Item 11]

`pathContainment.ts` — `path.resolve` resolves `..` syntactically but doesn't follow symlinks; a link planted inside the root pointing at `/etc/passwd` passes the string check. The sibling Frame Minion project documents exactly this and adds an `fs.realpath` second layer. This file's own comment already flags the fold-in as the intended end state ("when that shared helper lands…this can fold into it") — flagging as deferred, not net-new.

### 🟢 Praise — Key→webview boundary is structurally airtight [Item 15]

`shared/types/messages/accountBalance.ts` — `AccountBalancePayload` carries only `{ openrouter: OpenRouterBalance, fetchedAt: number }` where every field is a number, a `ProviderStatus`/reset enum, or a **static** `reason` string literal (templates contain only an HTTP status integer; `errMessage()` is log-only). The type system enforces at compile time that no field can hold a key or raw body. The independence of the two calls (each reads the secret fresh, uses it only in the `Authorization` header, extracts only parsed field values) closes the accidental-log vector too.

> *"The scanner sees a clean payload shape; the attacker sees two unguarded `path.join` calls in the prompt loader whose `promptPath` the model names — exactly the surface the PR hardened everywhere else."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — `runRefresh` error branch notifies no listeners [Item 7]

`AccountBalanceService.ts` (`runRefresh`):

```ts
try {
  payload = await this.getBalances(true);
} catch (error) {
  this.log?.appendLine(`[AccountBalanceService] Scheduled refresh failed: ${errMessage(error)}`);
  return; // ← returns without notifying listeners
}
```

Today `fetchAll → settle` absorbs all throws and returns an `unavailable` result, so this branch is **unreachable** — but if a future `settle` regression makes it reachable, the listeners never fire and the widget keeps showing stale data with only a single log line, while the *handler's* own catch (`handleRequest`) posts an explicit `unavailable` sentinel. Inconsistent failure shape between the two refresh paths. Fix: notify listeners with the `unavailable` sentinel here too, matching the handler.

### 🟢 Praise (was a Nit) — `logBroadcastError` wiring is correct

`MessageHandler.handleConfigurationChange` — the delayed `void (async () => …)().catch(logBroadcastError(...))` correctly converts synchronous throws inside the IIFE into rejections the `.catch` records, so a "settings changed but the webview didn't update" is diagnosable. Looks swallow-prone on a skim; it isn't.

> *"The balance widget will spin forever and the output channel has one line; hope you remember the service-tier contracts at 2am."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — `isRealRequest` conflates refresh-trigger and last-cost display [Item 2]

`MessageHandler.applyTokenUsage` — one `totalTokens>0` gate serves two stated intents: (1) distinguish a real call from the synthetic all-zeros activation/reset so the debounce doesn't arm on startup; (2) let `lastRequestCostUsd` be `undefined` (rendered "—" not "$0.000") when the provider omits cost. Harmless for today's model surface (all OpenRouter text LLMs report nonzero tokens), but the `scheduleRefresh()` condition logically means "a real spend occurred" (better expressed as `costUsd !== undefined`), while the cost-display condition is separate. A hypothetical flat-fee / image-gen model returning `totalTokens: 0` + nonzero `costUsd` would silently skip **both** the cost update and the balance refresh. Separable semantics sharing one gate; the current model scope is the only thing keeping them from diverging.

> *"The `totalTokens > 0` guard is doing two jobs and wearing both hats convincingly — right up until a flat-fee model walks through the door and both hatracks come up empty."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Asymmetry Audit

Illuminated by: Sam (`total_usage` vs `total_credits`), Patricia (`PromptLoader` vs `UIHandler`), Oliver (service-catch-silent vs handler-catch-posts)

When you write a guard, a type, or an error handler for one thing, you've implicitly made a claim about its siblings — and the code three lines away is the most natural place to find the same gap, because you were solving the same class of problem and then stopped. Asymmetric treatment of parallel constructs isn't just a bug; it's evidence the first fix was treated as local rather than generalizable.

→ Carry forward: After hardening any field/path/error-path, look left and right in the same function and ask "what else here deserves the treatment I just gave this one?" Treat the guard as a pattern, not a patch.

### Lesson 2 — One Name, One Job

Illuminated by: Cal/Bria/Tim (`isRealRequest`), Parker (`fmtUsdMicro`)

A single boolean or name doing two jobs — "is this a real spend?" AND "should the display show a cost?" — feels like economy but is ambiguity. The two concerns drift apart the moment a flat-fee model or a streaming event arrives, and the name no longer tells you which half broke. A name borrowing a unit prefix (`micro`) to mean something else (milli-scale formatting) poisons the next author's mental model before they read a line.

→ Carry forward: When you add a comment to explain what a name or gate "really means," treat that as the signal to split it. Comments explain intent; names should make intent obvious without help.

### Lesson 3 — Compat Stubs Calcify

Illuminated by: Parker (the `STATUS` "backward compatibility" fallback)

A fallback written to preserve backward compatibility is a bet that the behavior it enables will go away. When the bet isn't tracked — no comment naming the deletion condition, no test asserting what makes it safe — the fallback quietly becomes permanent, and the next author inherits it as law. A stray default is now a load-bearing wall no one is sure they can move.

→ Carry forward: Every compat shim deserves a comment naming the condition under which it can be deleted, and ideally a test that fails when that condition is met. "Backward compatible" without a horizon is just "unreviewed permanent behavior."

### Lesson 4 — The Unconsumed Port Smells Like Premature Architecture

Illuminated by: Marcus (`Platform.secrets`), Stan (`fmtUsdMicro` barrel gap)

A port, barrel export, or interface field declared but never consumed is a promise the codebase makes to itself that it can't yet keep. The danger isn't the dead code — it's that the next author reads it as an established contract and builds on a foundation never load-tested. Ports-and-adapters is powerful precisely because each port should have exactly one consuming caller proving it carries weight.

→ Carry forward: Before committing a new abstraction, trace its full path — declared → constructed → injected → **read**. If the chain breaks anywhere, complete it or don't ship the declaration. A half-wired seam misleads more than no seam.

### Lesson 5 — Test the Seam, Not Just the Sunny Path

Illuminated by: Cal (`isRealRequest` gate, forced-coalescing branch), Tim (debounce re-arm)

The most important things to test aren't the happy paths — they're the gates and branches that exist *specifically* to handle unusual conditions: "skip refresh on activation," "coalesce two concurrent forced fetches," "re-arm only once." These are the cases the author thought hard enough about to comment on — which makes them the cases most likely to break silently when surrounding code changes.

→ Carry forward: When you write a comment explaining why a branch exists, immediately ask "what test would catch it if this comment became a lie?" If you can't write that test in five minutes, the behavior isn't pinned.

> *"The best review is the one that teaches you to recognize the shape of a mistake before you make it again — not just the name of the one you made this time."* — Sensei

---

## The Closer

### 🎋 Haiku

```
Ports drawn, walls made clean—
one coin miscounts the spring rain;
the monk re-tallies.
```

---

## Summary

**Merge-ready, no blockers.** This is a clean landing of an epic whose chunks were already vetted three times over, and it shows — Blake cleared every correctness path, disposal is airtight, the key→webview boundary is structurally provable, and the `/key`+`/credits` slice is textbook fault-isolation. The one finding worth a fixup before or shortly after merge is the asymmetric `total_usage` zero-fallback (Item 1) — low real-world trigger, but it's a money number with a guarded twin three lines away. The rest is a coherent cluster of "one more guard / one more test / one clearer name" Standards on the account-balance seam, plus a defense-in-depth containment gap (Item 6) the codebase already knows how to close. Knock out Items 1–6 in a follow-up and this slice is exemplary.

---

## Resolution Status

Fixups landed in **`270974e`** on `epic/monorepo-ports-and-adapters`. Post-fixup gate: **48 suites / 368 tests · 3 typechecks clean · lint 0 errors** (+9 tests).

**✅ Fixed**

- **#1 [Sam] `total_usage` zero-fallback** — `OpenRouterAccountClient.fetchCredits` now applies the SAME finite-number guard to `total_usage` as `total_credits`: a non-finite value maps to `unavailable` (malformed) instead of a silent `0` that erased spend and overstated `remaining`. +3 tests (absent / NaN-string / genuine `total_usage: 0` zero-spend account).
- **#3 [Cal · Blake] Forced-coalescing branch** — added a test that drives `getBalances(false)` into flight, then `getBalances(true)` on top, asserting **two distinct fetches** (not coalesced) and that the forced caller receives the fresh post-spend data.
- **#4 [Parker · Stan] `fmtUsdMicro`** — renamed to `fmtUsdPrecise` (the extra digit is milli-scale, not SI micro) and added to the `balances/index.ts` barrel; widget + test updated.
- **#5 [Stan] handler postMessage type** — `AccountBalanceHandler.postMessage` is now `PromiseLike<unknown>` and `post()` voids the result with a `.catch` that logs a rejected transport, matching `AnalysisHandler`/`DictionaryHandler` and the "log failures" discipline.
- **#6 [Patricia] loader containment** — `PromptLoader`/`GuideLoader` now reject any `promptPath`/`guidePath` that escapes the bundled resources root via `isPathWithinRoot` (the guard `UIHandler` already uses), **before** any FS access. +4 loader-containment tests (in-root loads; `../` traversal rejected with `readFile` never called).
- **#7 [Oliver] silent `runRefresh` failure** — the catch now notifies listeners with the `unavailable` sentinel (the shape the handler's own catch posts) instead of returning silently, so the widget can't get stuck on stale data with only a log line.
- **#10 [Parker] naming** — `pendingForced` → `pendingIsForced` (reads as an adjective at the `!this.pendingIsForced` site).
- **#12 [Marcus · Blake] pre-dispose** — `resolveWebviewView` now calls `this.messageHandler?.dispose()` before re-assigning, mirroring the `configWatcher` guard so a re-resolve can't orphan the balance timer/listener.

**◐ Partial**

- **#2 [Cal · Bria · Tim] the `isRealRequest`/`scheduleRefresh` seam** — the **throwing-listener isolation** half is now tested (a throwing listener doesn't block siblings and is logged). The remaining two halves are **deferred**: (a) a unit test that the zero-token activation/reset call does NOT arm a refresh, and (b) Bria's semantic split (`scheduleRefresh` keyed on "real spend" / `costUsd !== undefined` rather than `totalTokens > 0`). Both need a seam to construct/observe `MessageHandler` in isolation, which is exactly what the **ADR 2026-06-18 composition-root consolidation** introduces — doing them now would either duplicate that work or change refresh-trigger behavior for a hypothetical flat-fee model with no current consumer. Tim's debounce-churn note is correct-at-scale and left as a documented assumption.

**↪ / ⏸️ Deferred (with rationale)**

- **#8 [Marcus] `Platform.secrets` unconsumed** — ↪ Deferred to the **ADR 2026-06-18** consolidation epic. The fix (route secrets through the port or delete the field) belongs with the broader `secretsService: any` typing + composition-root work that ADR already scopes; doing it piecemeal here would pre-empt that design.
- **#9 [Parker] `STATUS` unknown-source fallback** — ⏸️ Deferred. The arm was lifted **verbatim** from the pre-extraction App.tsx inline router; changing the dispatch is a behavior change to a closed, known source set, out of scope for a behavior-preserving landing. Tracked for a follow-up that enumerates the legitimate analysis sources explicitly.
- **#11 [Patricia] `isPathWithinRoot` not symlink-aware** — ⏸️ Deferred, consistent with the file's own comment ("Mirrors the FrameMinion `isPathWithinRoot`… when that shared helper lands this can fold into it"). The `fs.realpath` second layer folds in with the shared-helper consolidation; the string check closes the `../` vector that Item 6 actually exercises.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
