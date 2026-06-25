# PR Review — #62: Restore single composition root and typed MessageHandler seams

**Author:** okeylanders · PR #62 on `sprint/messagehandler-composition-root-consolidation`
**Reviewed:** 2026-06-25 (multi-agent pass — 10 reviewers + Sensei)
**Base:** `main` @ `2942db1b` · **Head:** `478b2960`
**Status:** 🟢 **Merge-ready — no 🔴 blockers, no 🟠 highs.** Blake cleared every correctness path; the panel's one cluster is a 🎯🎯 strong-consensus **Standard** (the `StandardsService.getGenres()` error-path divergence — old code surfaced a webview ERROR on a repo-load failure, new code returns an empty list silently). One reviewer-rated **High** was **dropped on review as a false positive** (see ledger D1): the `assistantToolService` status emitter *is* re-wired on every webview re-resolve — via `AnalysisHandler`'s constructor, one level below where the trace stopped. The remaining items are test-coverage gaps and cosmetic nits. The review below is the record; dispositions are recommendations for the author (no fixups have landed yet).

> ℹ️ Diff is +1494 / −224 across **34 files**, but ~970 of those lines are docs/memory-bank/feature-briefs/2 PNGs. Agent attention was weighted to the **~524-line code surface** (24 files): the `MessageHandler` refactor, the new `MessageHandlerContracts` typed seams, `extension.ts` composition root, and the provider lifecycle. The branch was read on disk at the PR head to trace behavior claims.

---

## Blast Radius

- **34 files** · **+1494 / −224** · **4 commits**. Migrations: **none**. New services: **none** (this is a refactor).
- **Code surface:** 24 files (+524 / −213). New code files: **`MessageHandlerContracts.ts`** (the `CoreServices` bundle + `MessageTransport`/`ResultCache`/`SecretsPort` contracts) and **`MessageHandler.test.ts`** (first assembly suite — 4 cases).
- **The refactor's three moves:** (1) hoisted `TextSourceResolver`, `CategorySearchService`, `AccountBalanceService`/`OpenRouterAccountClient` construction out of `MessageHandler` and into `extension.ts`'s `CoreServices` bundle; (2) replaced the **module-global** `sharedResultCache` with an **instance-bound** `this.resultCache`; (3) typed every domain handler's outgoing seam (`(message: any) => Promise<void>` → `MessageTransport`) and narrowed `secretsService: any` → `SecretsPort`.
- **New guard rails:** an architecture witness (`boundaries.test.ts`) that fails if `MessageHandler` re-`new`s infrastructure, plus assembly / cache-isolation / refresh-gate / disposal tests.
- **Docs:** ADR flipped Proposed → Accepted; ARCHITECTURE.md, AGENTS guidance, CHANGELOG updated; 2 memory-bank checkpoints; 2 **docs-only** feature briefs (streaming progress stats, debug/output title-bar action).
- **Character:** a disciplined, well-tested, well-documented architectural consolidation that lands exactly what its ADR promised. Behavior-preserving on the happy path; the only behavioral seam worth a second look is a narrow failure-path divergence in publishing-standards loading.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B+ |
| 🛡️ Security | A− |
| 🧪 Tests | B |
| 📖 Quality | B+ |
| ⚡ Performance | A |
| 🎯 Domain | B |

The grades sit high because the PR *is* a structural improvement and Blake found nothing blocking. They aren't straight-A because the panel found a real (if narrow) failure-path divergence (`getGenres`), three genuine test-coverage gaps around the new shared-singleton lifecycle, and one architectural watch-item (mutable per-webview callbacks living on extension-lifetime singletons).

---

## Status by item

| # | Severity | Finding | Reviewer(s) | Disposition |
|---|----------|---------|-------------|-------------|
| 1 | 🟡 Standard | **`StandardsService.getGenres()` returns `[]` on repo-load failure where the old per-request path surfaced a webview ERROR.** Old `PublishingHandler` did `new PublishingStandardsRepository(...).getGenres()` inside its try/catch → a construction failure threw → `sendError('publishing', …)` reached the webview. New path: `loadStandards()` swallows the construction error (logs at cold-boot, leaves `standardsRepo` undefined) → `getGenres()` hits `if (!this.standardsRepo) return []` → handler posts a **success** payload with zero genres. Silent empty panel instead of an error. | Bria · Blake · Marcus · Sam · Oliver · Cal **🎯🎯 Strong Consensus** | **Open — recommend fix.** Narrow path (constructor rarely throws — the file read is lazy in `getGenres()`, so a *request-time* read failure still rejects → ERROR). Lowest-effort fix: have `getGenres()` throw / return `null` so `PublishingHandler`'s existing catch routes the error, or log at the guard. |
| 2 | 🟡 Standard | **Shared services carry per-webview mutable status-emitters.** `CategorySearchService`, `AssistantToolService`, `DictionaryService` are built once at the composition root but their `statusEmitter` is set per `MessageHandler` construction and cleared on dispose. Ownership is split: the root owns the object, `MessageHandler` owns a critical callback. Works today because dispose→rebuild is atomic in `resolveWebviewView`; nothing type-level stops a stale emitter. | Marcus | **Open — architectural watch-item.** Correct at current scope; note for the next contributor. Candidate: pass the emitter per-call rather than as mutable singleton state. |
| 3 | 🟡 Standard | **Triple-write to `resultCache`.** `sendStatus`/`sendError`/`applyTokenUsage` write `this.resultCache.*` directly, then call `this.postMessage(...)`, whose spy-switch writes the **same** keys again. Two answers to "who owns cache population." | Parker | **Open — optional cleanup.** Idempotent (same value), so harmless; removing the direct writes and letting the switch be the single writer improves the contract's legibility. |
| 4 | 🟡 Standard | **Dispose test covers a single handler only.** The PR's headline lifecycle risk is the *second* webview reusing the shared `accountBalanceService`; the suite asserts `dispose()` fires once but never builds a second handler on the same assembly to prove re-subscription works. | Cal | **Open — recommend test.** A second `createHandler(assembly,…)` after `dispose()` asserting `addRefreshListener` re-registers and callbacks are independently live would pin the reuse claim. |
| 5 | 🟡 Standard | **`boundaries.test.ts` infra-construction guard reads only `MessageHandler.ts`.** The `\bnew\s+(TextSourceResolver\|…)\b` regex is correct but file-scoped; a *domain handler* that `new`s infrastructure passes silently. The sibling vscode-import guard correctly scans the whole tree via `collectSourceFiles`. | Cal | **Open — recommend widening** the scan to `application/handlers/` (at least) so the invariant's scope matches the guard's scope. |
| 6 | 🟡 Standard | **Callback-detach `catch {}` in `dispose()` silently skips the rest if any setter throws.** The five `setXxx(undefined)` calls share one try-block; an early throw leaves later services with stale bound closures. | Oliver | **Open — optional.** Throw is improbable (the setters assign a field + iterate a small map) and self-heals on the next construction (everything re-wires). Per-setter try or a logged catch would name the culprit if it ever fires. |
| 7 | 🟡 Standard (Medium) | **`platform.secrets` and `SecretStorageService` both derive from `context.secrets` via two paths; no test pins them to the same store.** Theoretical: a future maintainer swapping `platform.secrets` for a double wouldn't realize `SecretStorageService` was built from it. | Patricia | **Open — optional hardening.** A one-line comment ("intentionally the same `SecretStorage` backing both") + an assertion closes the latent-confusion gap. No active vector. |
| 8 | 🟢 Nit | **`PublishingHandler.test.ts` still casts `postMessage` as `any`** — 19 lines into the first test of the very `MessageTransport` seam this PR introduced. | Stan | **Open — trivial.** Mirror the new `MessageHandler.test.ts` cast (`as … PromiseLike<unknown>` / `as unknown as MessageTransport`). |
| 9 | 🟢 Nit | **Stale `SPRINT 05` comments survive** in `MessageHandler.ts` (file header + method tags) and now mislabel the bundle-injection path as "direct service injection." | Parker | **Open — trivial.** Strip the sprint tags; the ADR/CHANGELOG carry the history. |
| 10 | 🟢 Nit | **`as unknown as CoreServices` in the assembly test** defeats the compiler — adding a required field to `CoreServices` won't fail the test, blunting the guard the suite is meant to be. | Parker · Cal | **Open — optional.** A `Partial<CoreServices>` factory or per-field `jest.fn()` typed to the interface restores the guard. |
| 11 | 🟢 Nit | **Balance-dispose `catch {}` guards operations that can't throw** (`Set.delete`, `clearTimeout` + `Set.clear`). Silence doing theater. | Oliver | **Open — informational.** Contrast with #6, where the silence actually matters. |
| 12 | 🟢 Nit | **`getNonce()` uses `Math.random()`** (not cryptographically strong) for the CSP nonce. | Patricia | **Out of scope — pre-existing.** `Searched diff for getNonce — not present.` Unchanged by this PR; flag for a follow-up, not this gate. |
| D1 | ⚪ **Dropped** | ~~**`assistantToolService.setStatusEmitter` cleared on dispose, never re-wired → guide-loading status goes dark after the first webview re-resolve** (rated 🟠 High).~~ | Sam | **Dropped on review — false positive.** The emitter **is** re-injected on every `MessageHandler` build by `AnalysisHandler`'s constructor (`AnalysisHandler.ts:43`), which `MessageHandler` constructs at `MessageHandler.ts:175`. The trace searched the `MessageHandler` constructor body and concluded "never re-wired"; the re-wire lives one constructor deeper. All three emitters re-attach on construction (dictionary `:187`, category `:204`, assistant via `AnalysisHandler`) and detach on dispose. Symmetric. No regression. |
| P1 | 🟢 Praise | **No blockers.** Every correctness path holds; the constructor arg reorder (`transport, outputChannel, platform` → `transport, platform, outputChannel`) is correctly wired at **both** call sites (provider + test) — and `Platform`/`LogSink` are structurally distinct, so even a swap would fail compile. | Blake | — |
| P2 | 🟢 Praise | **`AccountBalanceService.dispose()` is a soft reset, not a teardown** — `clearTimeout` + `listeners.clear()`, no "disposed" flag, cache retained. The shared service is fully reusable on re-resolve; the next webview even gets a warm balance instead of a cold billing hit. | Blake · Marcus · Tim · Bria **🎯 Consensus** | — |
| P3 | 🟢 Praise | **Composition-root win, quantified.** Three per-construction allocation sites (`TextSourceResolver`, `CategorySearchService`, `AccountBalanceService`/client) and a **per-request** `new PublishingStandardsRepository(...)` + file read collapse to once-at-activation; the module-global cache becomes per-instance isolation. | Tim | — |
| P4 | 🟢 Praise | **API key never leaves the host.** Read host-side, used only in `Authorization` headers, never placed in an outbound message; `SecretsPort` narrows the surface from `any` to the three operations callers need; `MessageTransport` typing blocks free-form objects slipping key material to the webview. | Patricia | — |
| P5 | 🟢 Praise | **Barrel + detach discipline.** New contracts re-exported as `export type` (not `export *`); every handler imports `@handlers/MessageHandlerContracts`; the `setStatusEmitter(undefined)` detach is applied consistently across all three emitter-bearing services with test coverage. | Stan | — |

---

## Executive Briefing

**No 🔴 blockers and no 🟠 highs.** Blake walked every correctness path and the goblins stayed home. The items below are the ones worth the author's attention before (or shortly after) merge.

🎯🎯 **[Bria · Blake · Marcus · Sam · Oliver · Cal — Strong Consensus] · Standard** `StandardsService.getGenres()` returns `[]` when the standards repo failed to load, where the old per-request path surfaced a webview ERROR — a silent empty panel replaces an error banner. Narrow (the repo constructor rarely throws; request-time read failures still reject and error correctly), but it's the one behavioral seam the refactor didn't carry across.

🎯 **[Blake · Marcus · Tim · Bria — Consensus] · Praise** The shared-`AccountBalanceService` disposal concern resolves clean: `dispose()` is a soft reset, the service is reusable across webview lifetimes, and the cache survives. The lifecycle the PR set up is sound.

🟡 **[Cal] · Standard ×2** Two coverage gaps around the new shared-singleton lifecycle: the dispose test never exercises the *second*-webview reuse path, and the `boundaries.test.ts` infra-construction guard reads only `MessageHandler.ts` (a domain handler that `new`s infra would slip past it).

🟡 **[Marcus] · Standard** Architectural watch-item: extension-lifetime singletons now carry per-webview mutable status-emitters — fine while dispose→rebuild stays atomic, worth a comment for the next contributor.

⚪ **[Sam — dropped] · was rated High** "Guide-loading status goes dark after re-resolve" — verified false: `AnalysisHandler`'s constructor re-injects the emitter on every `MessageHandler` build. Recorded so the trace is on the record, not silently swallowed.

> **Blake found nothing blocking.** Constructor reorder lines up at both sites, the disposal seam is reusable on purpose, the only divergence is an empty dropdown in a path that barely fires. *"Nothing here pages me — sleep easy and ship it."*

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟡 Standard — Per-webview mutable emitters on extension-lifetime singletons

`MessageHandler.ts:204` — `CategorySearchService` (and its `AssistantToolService`/`DictionaryService` siblings) is constructed once in `extension.ts` and shared, but `setStatusEmitter(this.sendSearchStatus.bind(this))` mutates a field on that singleton per `MessageHandler` construction, cleared on dispose. The object's ownership lives at the composition root; a behavioral callback's ownership lives in `MessageHandler`. It's correct today *only* because `resolveWebviewView` disposes the old handler and builds the new one atomically — there's no type-level invariant preventing a second handler (or a test) from leaving a stale emitter wired. The composition-root consolidation is the right move; this is the seam most likely to surprise the next contributor.

### 🟢 Praise — The disposal boundary is correctly designed

The CONTEXT flagged `MessageHandler.dispose()` calling the *shared* `accountBalanceService.dispose()` as a potential hazard. Traced it: `dispose()` clears the timer and the listener Set with no "disposed" flag — `cache`, `pending`, and the client survive. On re-resolve the new handler re-subscribes and the service works fully; the cache even warms the next webview. `MessageHandler` owns the callback lifetime, `AccountBalanceService` owns the fetch/cache lifetime. That's the right shape.

> *"The bones of this refactor are load-bearing — the composition root is finally doing its job — but a mutable per-session callback riding a singleton is less a wall and more a standing agreement not to bump into it."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟢 Praise — Constructor arg reorder correctly wired at both call sites

`ProseToolsViewProvider.ts:56` — new signature is `(services, transport, platform, outputChannel)`. Verified per Rule A: the provider passes `coreServices, transport, platform, outputChannel`; `MessageHandler.test.ts:296` passes `services, postMessage, platform, log`. Both match. `Searched diff for a third 'new MessageHandler(' — not found.` `Platform` and `LogSink` are structurally distinct, so even a swapped pair would fail compile rather than mis-wire at runtime.

### 🟢 Praise — Nothing corrupts, nothing throws, nothing breaks contract

Walked the instance-cache move (every `sharedResultCache.*` → `this.resultCache.*`, including the `ConfigurationHandler` injection), the shared-service disposal (reusable soft reset), and the `StandardsService.getGenres()` swap (the constructor stores refs and load is lazy, so `standardsRepo` is set before any request — the empty-list path is a rare construction-failure edge, not corruption). The one divergence (getGenres empty-vs-error) is a UX regression in a barely-fired path, below the blocking bar.

> *"Nothing here pages me — the disposal seam is reusable on purpose, the reorder lines up at both sites, and the only divergence is an empty dropdown in a path that barely fires; sleep easy and ship it."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### ⚪ Dropped on review — "Guide-loading status goes dark after re-resolve" (was rated 🟠 High)

`MessageHandler.ts` — Sam traced the dispose path (`assistantToolService.setStatusEmitter(undefined)`) and searched the `MessageHandler` constructor for a matching re-wire, found none, and concluded the emitter stays `undefined` after re-resolve. **The orchestrator re-traced and dropped it:** the re-wire lives one constructor deeper — `AnalysisHandler`'s constructor (`AnalysisHandler.ts:43`) calls `this.assistantToolService.setStatusEmitter(...)`, and `MessageHandler` builds a fresh `AnalysisHandler` on every construction (`MessageHandler.ts:175`). So all three emitters re-attach on each build. No regression. Recorded here because a careful "absent" claim deserves a careful refutation — see Sensei, Lesson 1.

### 🟡 Standard — `getGenres()` empty-vs-error divergence [🎯🎯 Strong Consensus]

`StandardsService.ts:139` — `if (!this.standardsRepo) return []`. Traced: a repo-load failure in the old code threw from the per-request `new …Repository().getGenres()` into `handleRequestPublishingStandardsData`'s catch → webview error. New code returns `[]` → success payload, empty list, no signal. (Shared with Bria/Blake/Marcus/Oliver/Cal — see ledger #1.)

> *"I followed the thread into the dispose and yelled 'the emitter's gone!' — then the orchestrator opened the AnalysisHandler door and there it was, getting re-tied on every build. The trapdoor was real; it just had a net under it."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — The result cache is written twice on every internally-originated message

`MessageHandler.ts:325` (and `:340`, `:376`) — `sendStatus`/`sendError`/`applyTokenUsage` each assign `this.resultCache.*` directly, then call `this.postMessage(...)`, whose spy-switch (`:603+`) assigns the same keys again. A reader tracing "who populates the cache" gets two answers depending on which call site they hit first. The writes are idempotent so nothing breaks — but the domain handlers rely solely on the switch, and these three callers should too. Drop the direct assignments; keep only the `sendError` domain-clear logic (which the switch already mirrors).

### 🟢 Nit — Stale `SPRINT 05` comments outlived the thing they described

`MessageHandler.ts:6–8, 173, 421` — comments still announce "direct service injection" and "ProseAnalysisService facade removed," which this PR replaced with *bundle* injection. The labels now actively misdirect.

### 🟢 Nit — `as unknown as CoreServices` quietly disarms the assembly test's own guard

`MessageHandler.test.ts:110` — the double-cast means adding a required field to `CoreServices` won't fail this suite, which is precisely the contract the suite exists to protect.

> *"It works, but the cache is written twice on every status message, `postMessage` already does it, and I had to read three methods to learn which write actually sticks."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟡 Standard — The dispose test fires once; the risk lives on the second webview

`MessageHandler.test.ts:375` — the suite proves `dispose()` calls `accountDispose` once on a single handler. The PR's actual new hazard is reuse: `extension.ts` builds `accountBalanceService` once, the provider hands the *same* instance to each new `MessageHandler`. The service *is* reusable (traced), but no test demonstrates it — and if a future `dispose()` ever set a "dead" flag, a second-webview break would ship green. Build a second handler on the same assembly after dispose and assert re-subscription.

### 🟡 Standard — The architecture guard is narrower than the invariant it guards

`boundaries.test.ts:79` — reads a single file (`MessageHandler.ts`). The invariant ("the application layer doesn't `new` infrastructure") spans `application/handlers/`. The sibling vscode-import guard right above it scans the whole tree via `collectSourceFiles`; this one should at least scan the handlers dir, or it becomes theatrical the moment someone adds `HandlerV2.ts`.

### 🟢 Nit — `PublishingHandler` test never exercises the `getGenres` null-guard branch

`PublishingHandler.test.ts:18` — the fake `getGenres` always resolves `[]`, so the empty-on-load-failure behavior (ledger #1) is unverified in either direction.

> *"The dispose test fires once. The bug lives on the second webview. I've seen this movie."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟢 Nit — We minted `MessageTransport` in this PR, then left `as any` on the first test that uses it

`PublishingHandler.test.ts:19` — `jest.fn().mockResolvedValue(undefined) as any, // postMessage`. The brand-new `MessageHandler.test.ts` (same PR) casts its mock to the explicit transport shape; AGENTS.md says verbatim "Type `postMessage` as `MessageTransport` — never `any`." `Searched diff for this file — the as any comment survived the constructor update directly above it.` Smallest possible fix; it just shouldn't contradict the PR's own thesis nineteen lines in.

### 🟢 Praise — Barrel discipline is exactly right

`packages/core/src/index.ts:29` — the four new contracts are re-exported as `export type` (not `export *`, not value exports), the runtime classes (`CategorySearchService`, `TextSourceResolver`, `AccountBalanceService`, `OpenRouterAccountClient`) as plain exports for the composition root, and every new handler imports `@handlers/MessageHandlerContracts` rather than a relative path. The letter of the policy, landed.

### 🟢 Praise — The detach pattern finally makes the family match

All three emitter-bearing services had their `setStatusEmitter` signatures widened to optional and are detached with `undefined` in `dispose()`, with the `categorySetStatusEmitter` test asserting it. The documented teardown pattern, applied completely.

> *"We established `MessageTransport` in this very PR — and then left `as any` on the `postMessage` mock in the first test that runs it. That's the kind of thing that gets screenshotted at the retro."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟢 Praise — Per-request file I/O in PublishingHandler is gone

`PublishingHandler.ts` — the old path allocated `new PublishingStandardsRepository(extensionPath, fileSystem)` and read the standards JSON on **every** `REQUEST_PUBLISHING_STANDARDS_DATA`. It now delegates to the `StandardsService` repo built once at construction. N file reads per session → 1 at activation. Small N at this single-sidebar scale, but the old pattern was architecturally wrong; the elimination is clean.

### 🟢 Praise — Three allocation sites per handler build → zero; one module-global → instance field

`MessageHandler.ts` — `TextSourceResolver`, `CategorySearchService`, `AccountBalanceService`/client were each `new`-ed per `MessageHandler` construction (i.e., per webview open). Now shared from the root. The `sharedResultCache` module global (a real latent bug — a quick dispose/reopen would replay a prior session's ERROR) is now a per-instance field. Memory is held for the extension lifetime instead of the webview lifetime, but nothing grows unbounded (the balance cache is a single TTL'd object).

> *"Three allocation sites per handler construction became zero; one file read per request became zero; one module-global cache became an instance field — I have done the math, and I approve of the remainder."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟡 Standard (Confidence: Medium) — Two straws in one `SecretStorage` well, unpinned

`extension.ts:65, 74` — `platform.secrets = context.secrets`, then `new SecretStorageService(platform.secrets)`. Same underlying store today; the port indirection is correct. **Theoretical, not a live vector:** a future maintainer swapping `platform.secrets` for a test/file-backed double wouldn't realize `SecretStorageService` was built from it, splitting secret reads across two backends. No test asserts they're the same store. A one-line comment + an assertion closes the latent confusion.

### 🟢 Praise — The API key never leaves the host, and the seam got narrower

`OpenRouterAccountClient.ts` — the key is read host-side, used only in `Authorization` headers, and never placed in any outbound payload (`AccountBalancePayload` carries sanitized numbers/enums; `handleRequestApiKey` answers with a boolean). Narrowing `secretsService: any` → `SecretsPort` removes every `SecretStorageService` method a handler didn't need, and `MessageTransport`'s `ExtensionToWebviewMessage` constraint blocks free-form objects from smuggling key material through `postMessage`. `Searched diff for any outbound field carrying apiKey — not found.`

> *"The key never left the host before, and it still doesn't — but two callers now drink from the same well through different straws, and someday someone hands them different cups without noticing."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟡 Standard — One silent catch on teardown actually matters

`MessageHandler.ts:666` — the five `setXxx(undefined)` detaches share one `try { … } catch { /* noop */ }`. If `assistantToolService.setStatusEmitter(undefined)` (which internally also re-touches `aiResourceManager.setStatusCallback`) ever throws mid-sequence, the remaining detaches are skipped *and* the on-call sees nothing about a half-finished teardown. The blast radius is bounded — the next construction re-wires everything — but a per-setter try (or a logged catch) would hand you the culprit at midnight instead of a guess.

### 🟡 Standard — `getGenres()` → `[]` is a silent success where the user needed a signal

`StandardsService.ts:138` — the repo-load failure is logged once at cold-boot, then `getGenres()` returns `[]` with no request-time log, and `PublishingHandler` posts a *successful* empty payload. The on-call has one activation-log line to correlate against a user action that looks like it worked. One `appendLine` in the guard branch closes it without changing behavior. (Shared — ledger #1.)

### 🟢 Nit — The other teardown catch guards operations that can't throw

`MessageHandler.ts:678` — `disposeBalanceListener()` is a `Set.delete`; `accountBalanceService.dispose()` is a `clearTimeout` + `Set.clear`. The catch has no teeth; worth noting only in contrast to the one above that does.

> *"The cold-boot log is one line in ten thousand; the 2am request is the one that needed to scream."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟡 Standard — The ADR promised a pure refactor; the failure path renegotiated the contract [🎯🎯 Strong Consensus]

`StandardsService.ts:138` — the ADR's "Implementation outcome" lists "Reused `StandardsService` … instead of constructing a repository per request" as behavior-preserving. It is, on the happy path. But the **failure** path changed: a missing/corrupt standards file that the old code surfaced as a webview ERROR now renders as an empty genre dropdown with no error. Not corruption, not an exception — a UX/observability regression in the one state that matters most when something's actually wrong. The other ADR checklist items verify cleanly: single composition root restored (the boundary test guards `MessageHandler`; `ProseToolsViewProvider` only threads the bundle through), instance-bound cache delivered, and the two feature briefs are genuinely docs-only — `Searched the code diff for any streaming-stats / debug-output implementation — not found.`

### 🟢 Praise — The "no leak across webview lifetimes" promise holds where it counts

The `ResultCache` is genuinely per-instance now; the `AccountBalanceService` balance cache *is* shared across lifetimes, but that's deliberate and benign (TTL-guarded, and a warm balance beats a cold fetch on every reload). The composition-root intent is kept honestly.

> *"The old code failed loudly on a missing standards file; the new code returns an empty genre list with a smile — same repo, different manners."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — Absence Is a Claim About Where You Looked

Illuminated by: Sam's dropped High (the re-wired emitter)

The strongest-feeling bug in this review was real to its finder and false in the code: "the emitter is never re-wired" was true of the place searched and untrue of the program. A constructor that delegates to `new AnalysisHandler(...)` *is* re-establishing the wiring — just one frame deeper than the eye stopped. "Missing" is never a property of the code alone; it's a property of the code *and the boundary of your search*.

→ Carry forward: before you write "X is never re-established," follow every constructor and factory the scope invokes. The thing you're looking for is often being done on your behalf, one call down.

### Lesson 2 — Move the Construction, Move the Contract

Illuminated by: the `getGenres` consensus (Bria · Blake · Marcus · Sam · Oliver · Cal)

Relocating *where* something is built almost always relocates *how it fails*. The genres still load; what changed is that a load failure used to throw into a handler that turned it into a visible error, and now it returns an empty list that looks like success. A refactor that preserves the happy path while quietly altering the failure path is only half a refactor — and it's the unverified half that pages someone.

→ Carry forward: for every call you move, ask not just "does this still return the right value?" but "does this still *fail* the same way, with the same signal, to the same observer?"

### Lesson 3 — Shared Lifetime, Borrowed State

Illuminated by: Marcus (mutable emitters on singletons), Cal (the untested second webview)

Promoting an object to a singleton changes its *lifetime* but not its *statefulness*. A service that used to be born and die with one webview now outlives many — and any mutable per-session callback it carries is now an agreement that teardown and setup will always stay perfectly ordered. That agreement holds here because one method enforces it atomically. The danger isn't today; it's the day a second caller, or a test, holds the object across that seam.

→ Carry forward: when you hoist construction upward, enumerate the mutable state the object now carries across the lifetimes that used to each get a fresh copy — and decide, deliberately, who owns resetting it.

### Lesson 4 — A Guard Is Only as Wide as Its Scan

Illuminated by: Cal (the file-scoped boundary test)

The architecture witness that protects "no infrastructure construction in the application layer" reads exactly one file. The invariant lives across a directory. A guard narrower than its rule isn't protection — it's a green check that goes on lying the moment someone adds a sibling. The vscode-import guard one block above got this right by scanning the whole tree; the pattern was already in the room.

→ Carry forward: when you write an invariant test, scope its *scan* to the invariant's *reach*, not to the single file where the violation happened to live this time.

> *"The refactor moved the furniture into better rooms. The lessons are in the doors — whether they still lock, whether the new room is shared, and whether the lock you tested is the only lock on the floor."* — Sensei

---

## The Closer

### 🚪 Knock knock

> Knock knock.
> *Who's there?*
> `sharedResultCache`.
> *`sharedResultCache` who?*
> Exactly — there's no `sharedResultCache` anymore. It's `this.resultCache` now, and unlike the old one, it doesn't let itself into the next webview's house.

*(PR #62 → 62 % 6 = 2 → Knock knock. The module-global replay cache that could leak a prior session's results into a fresh webview is this PR's headline fix — now per-instance, and it stays home.)*

---

## Summary

A disciplined, well-tested, well-documented architectural consolidation that lands exactly what ADR 2026-06-18 promised: `extension.ts` is the single composition root again, the boundaries are typed (`MessageTransport`/`SecretsPort`/`CoreServices`), the replay cache is instance-bound, and an architecture witness guards the invariant going forward. **No blockers, no highs** — Blake cleared every correctness path, Tim confirmed the allocation wins, Patricia confirmed the key never leaves the host, and the one reviewer-rated High was a false positive (the emitter re-wires via `AnalysisHandler`). The single behavioral seam worth closing is the **`getGenres()` empty-vs-error divergence** (🎯🎯 six reviewers): a repo-load failure now shows an empty panel instead of an error. Pair that with the two **test-coverage gaps** (second-webview reuse; the file-scoped boundary guard) and the architectural **watch-item** (mutable emitters on shared singletons), and you have a tidy, optional follow-up list rather than anything that blocks the merge. Ship it; fold in the `getGenres` signal and the two tests when convenient.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
