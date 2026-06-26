# PR Review — #64: Fix API key warning and AI service self-healing

**Author:** okeylanders · PR #64 on `fix/api-key-warning-and-ai-selfheal`
**Reviewed:** 2026-06-26 (multi-agent pass — 10 reviewers + Sensei)
**Base:** `main` @ `8f8a51b8` · **Head:** `a0a506c7`
**Status:** 🟡 **Changes recommended before merge — no blockers.** Blake walked every correctness path and nothing pages her: the self-heal listener mirrors the existing balance-listener lifecycle exactly, `dispose()` is symmetric, the `SecretsPort` contract is satisfied by the concrete `SecretStorageService`, the fire-and-forget `void refreshServiceConfiguration()` can't reject (it owns its own try/catch), and the `startsWith` sentinel can only ever swallow the warning it was built to swallow. Patricia clears the secret surface end-to-end. But the panel converged hard on one theme: **the fix is locally correct and globally incomplete.** The warning is produced by three services and persisted by three structurally-identical webview hooks — and only `useAnalysis` got the guard. **Nine of ten reviewers independently flagged that `useDictionary` and `useContext` still persist and reseed the exact warning this PR exists to kill.** The shared constant and the guard pattern both already exist; they simply weren't carried next door. Add to that: the headline guard ships without a regression test. None of this is a blocker — it's a fix that needs to finish the sentence it started.

> ℹ️ Small, tightly-scoped diff — **+80 / −8 across 8 files**, one commit, no new files, no migrations. Two threads braided together: (1) a **stale-warning persistence guard** (shared `API_KEY_NOT_CONFIGURED_HEADING` constant + `isConfigWarning` guard in `useAnalysis`, with the three backend services swapped to the constant), and (2) a **secret-change self-heal** (`SecretsPort.onDidChange` + a `MessageHandler` subscription that refreshes the AI services). Agents read the branch on disk at the PR head to trace every behavior claim, including the two untouched sibling hooks and the `refreshConfiguration` call chain.

---

## Blast Radius

- **8 files** · **+80 / −8** · **1 commit**. Migrations: **none**. New services/controllers: **none**. New files: **none**.
- **Production code (6):** `analysis.ts` (new shared `API_KEY_NOT_CONFIGURED_HEADING` constant), `MessageHandlerContracts.ts` (`SecretsPort.onDidChange`), `MessageHandler.ts` (self-heal subscription + teardown), `AssistantToolService.ts` / `ContextAssistantService.ts` / `DictionaryService.ts` (warning copy now references the constant), `useAnalysis.ts` (the `isConfigWarning` seed + persist guard).
- **Tests (1):** `MessageHandler.test.ts` — adds a self-heal assembly test + dispose/recreate listener assertions.
- **The two moves:** (1) **stop persisting the transient "no API key" warning** so a once-shown warning can't outlive the key being configured and reappear on reload; (2) **self-heal the assistant/dictionary/context services** when the stored secret changes, instead of leaving them stuck on stale secret state until a model-setting change or reload.
- **Character:** a small, well-intentioned, well-wired fix that solves its problem cleanly for one of three symmetric surfaces. The architecture of the seam is sound; the rollout is partial.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C+ |
| 🛡️ Security | A− |
| 🧪 Tests | C |
| 📖 Quality | C+ |
| ⚡ Performance | B− |
| 🎯 Domain | C+ |

Security sits high because the secret surface is genuinely clean — nothing logs the key, `persistedState` carries no credential, and the new `onDidChange` wrapper actually *narrows* exposure by discarding the VS Code event. Everything else is pulled down by one structural fact rather than scattered defects: the change was reasoned about at a single site, not at the level of the pattern it belongs to. Tests carry the sharpest cost — the behavior the PR's title promises has no test at all.

---

## Findings at a glance

| # | Severity | Finding | Reviewer(s) |
|---|----------|---------|-------------|
| 1 | 🟠 High 🎯🎯 | **`useDictionary` and `useContext` still persist + reseed the API-key warning** — the exact bug the PR fixes for `useAnalysis`, untouched in the two siblings | Marcus · Sam · Parker · Cal · Stan · Tim · Patricia · Oliver · Bria **Strong Consensus** |
| 2 | 🟠 High | **The headline `isConfigWarning` guard ships with no test** — `useAnalysis.test.ts` is untouched; the only new test covers the self-heal wiring | Cal |
| 3 | 🟡 Standard 🎯 | **Self-heal heals the backend, not the screen** — a mid-session key add refreshes the services but never clears the warning already rendered in-session | Sam · Oliver · Bria **Consensus** |
| 4 | 🟡 Standard 🎯 | **The shared sentinel lives in the wrong room** — `API_KEY_NOT_CONFIGURED_HEADING` is cross-cutting but filed under `analysis.ts` | Marcus · Parker **Consensus** |
| 5 | 🟡 Standard | **`refreshServiceConfiguration` wraps four services in one try/catch** — partial failure doesn't name the failing service, and success leaves no trail | Oliver |
| 6 | 🟡 Standard | **`refreshServiceConfiguration` triggers `initializeResources()` four times** — negligible at the rare secret-change frequency; copies an existing redundancy | Tim |
| 7 | 🟡 Standard | **`SecretsPort.onDidChange` discards the changed key** — fires for any secret write, encoding a "one secret forever" assumption as the interface grows | Marcus |
| 8 | 🟡 Standard | **The self-heal test couples to async depth** — a single `setImmediate` flush assumes the exact sequential await-count of `refreshServiceConfiguration` | Cal |
| 9 | 🟢 Nit | **`disposeSecretListener` is shaped differently from its sibling `disposeBalanceListener`** | Stan |
| 10 | 🟢 Nit | **The self-heal constructor comment is prose-heavy** — motivation that belongs in the PR description | Parker |
| 11 | 🟢 Nit | **`useContext` will need the `@messages` constant import** when the guard lands there | Stan |
| P1 | 🟢 Praise | **Nothing blocks** — clean listener lifecycle, symmetric dispose, contract satisfied, no teardown race | Blake |
| P2 | 🟢 Praise | **The key never reaches a log or `persistedState`** — and `onDidChange` narrows exposure by discarding the event | Patricia |

---

## Executive Briefing

**No 🔴 blockers.** Blake walked the correctness paths and the goblins stayed home; the self-heal wiring is clean and the secret surface is tight. The two items below are the ones worth the author's attention before merge — and they're really one story told twice: the fix was reasoned about at one site, not at the level of the pattern.

🟠 **[Strong Consensus — 9 reviewers]** **The fix is one-third applied.** The "no API key" warning is produced by all three AI services and persisted by all three webview hooks (`useAnalysis`, `useDictionary`, `useContext`), which share an identical seed-and-persist shape. Only `useAnalysis` got the `isConfigWarning` guard. `useDictionary` (`utilitiesResult`, L347) and `useContext` (`contextText`, L268) still persist the warning and reseed it on reload — the precise bug this PR declares fixed. The shared constant and the guard both already exist; they weren't carried next door.

🟠 **[Cal]** **The headline guard has no test.** `isConfigWarning` — the seed+persist guard that *is* the PR's stated purpose — ships with zero coverage: `useAnalysis.test.ts` is untouched and `useContext.test.ts` doesn't exist. The one new test asserts that four mock `refreshConfiguration` functions were called (wiring), not that a persisted warning is actually dropped (behavior). A single `renderHook` test seeding `persisted.analysisResult` with the warning and asserting `result === ''` would defend the fix — and a sibling test would have caught Finding 1.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟡 Standard — The shared sentinel is filed under one of its consumers [🎯 Consensus]

`packages/core/src/shared/types/messages/analysis.ts:17` — `API_KEY_NOT_CONFIGURED_HEADING` is, by its own JSDoc, cross-cutting: "backend services prefix their warning copy with it" (all three) and "the webview uses it to recognize a config warning." Yet it lives in `analysis.ts`, a module whose namespace is dialogue/prose/writing-tools analysis. `DictionaryService` and `ContextAssistantService` already import it from there through the barrel, and the moment `useDictionary`/`useContext` adopt the guard (Finding 1), they too will reach into the *analysis* namespace for a config-domain sentinel — a quiet dependency-direction smell. The string value isn't the problem; the address is. A neutral home — `base.ts`, a small `warnings.ts`, or `config.ts` — makes the "shared, not duplicated" claim the comment makes actually true at the module level. One-line move, cheapest now before three more hooks notarize the wrong import path.

### 🟡 Standard — `SecretsPort.onDidChange` discards the changed key

`packages/core/src/infrastructure/secrets/SecretStorageService.ts:58` — `return this.secrets.onDidChange(() => { listener(); });`. The platform seam (`SecretStore.onDidChange(listener: (e: unknown) => …)`) carries an event, and the underlying VS Code event includes the key that changed. The wrapper drops it, and `SecretsPort.onDidChange(listener: () => void)` gives the application layer no way to ask. Today this is benign — `openRouterApiKey` is the only secret stored — but the PR is the exact moment the interface is being extended, and it bakes in a silent "there will only ever be one secret" assumption. Threading the key through the port now (`listener: (key: string) => void`, filtered to `openRouterApiKey` in the impl) makes the seam honest and forward-safe at no downstream cost. As written, an unrelated future credential write would trigger a full AI-service refresh.

> *"The seam is sound and the wiring is clean — what gives me pause is that the constant meant to unify three rooms is currently living in one of them, and the port quietly assumes the house will never get a second door."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟢 Praise — The self-heal listener is defended end to end; nothing blocks

`packages/core/src/application/handlers/MessageHandler.ts:277` — I walked every path the change opens. **Teardown race:** `dispose()` (L692–696) calls `secretSubscription.dispose()`, so no listener fires post-dispose; the only in-flight case — a `void refreshServiceConfiguration()` already dispatched when dispose runs — calls `refreshConfiguration()` on services owned by the composition root (dispose only clears callbacks, it doesn't tear those services down), so a late refresh hits live objects and is harmless, and because `refreshServiceConfiguration` owns its own try/catch (L427–437) the `void` can never reject into an unhandled rejection. **Contract:** `SecretsPort.onDidChange` (Contracts L36) is satisfied exactly by the concrete `SecretStorageService.onDidChange` (L57–61), wired at the composition root — no `onDidChange is not a function` at construction. **Sentinel:** `isConfigWarning` uses `startsWith(API_KEY_NOT_CONFIGURED_HEADING)`; the only way it swallows a "real" result is if a genuine analysis literally begins with that warning sentence — implausible, and the warning's sole producer is the no-key path itself. The new self-heal test plus the dispose/recreate assertions cover the wiring. (The dictionary/context persistence gap in Finding 1 is real, but it lives in files this PR doesn't touch and corrupts no data — it's a completeness gap, not a page.)

> *"Nothing here pages me — ship it. Just don't tell me the warning's dead until it's dead in all three windows."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟡 Standard — The backend heals; the warning on screen doesn't [🎯 Consensus]

`packages/core/src/application/handlers/MessageHandler.ts:277` — okay, follow me. A user opens the analysis (or dictionary, or context) tab with no key, sees `⚠️ OpenRouter API key not configured`, then pastes their key into settings. `SecretStorageService.onDidChange` fires → `void refreshServiceConfiguration()` → the four services re-initialize. The backend is now healthy... and the screen still says "not configured." Searched the diff for any `ANALYSIS_RESULT`/`DICTIONARY_RESULT`/`CONTEXT_RESULT` (or a `setResult('')`) posted from the self-heal path — not found. The warning sits in the hook's `result`/`contextText` state until the user manually re-runs a tool. The persist guard means it won't survive a *reload*, but in the live session the healed system keeps showing the old wound. Not data loss — the next action works — but "self-heal" reads, from the user's chair, as "still broken until I poke it again." A companion message that clears the transient warning after a successful refresh would finish the recovery.

> *"Found the trap door — it's not in the wiring, it's in the gap between 'the services healed' and 'the screen heard about it.' The backend moves on; the warning just sits there, perfectly preserved."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟠 High — The guard lives in one hook; the bug lives in three [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/hooks/domain/useDictionary.ts:132` & `:347` — the PR adds `isConfigWarning` inline in `useAnalysis.ts` and guards both the seed (L108–110) and the persist (L292). Good. But `useDictionary` and `useContext` are the *same* hook wearing different labels — seed from `persisted?.x ?? ''`, persist `x: result` — and both go unguarded (`useDictionary` L132/L347, `useContext` L84/L268). `DictionaryService` and `ContextAssistantService` were both edited *in this very PR* to emit the `API_KEY_NOT_CONFIGURED_HEADING` warning, so the producers are wired and the consumers aren't. Searched the diff for `isConfigWarning` outside `useAnalysis.ts` — not found. The right shape isn't to copy the two-liner three times; it's to lift `isConfigWarning` to a shared hook util (or export it from `@messages` beside the constant) and call it in all three. As it stands, the fix reads as finished but is one-third done.

### 🟢 Nit — The self-heal comment is a motivation essay

`packages/core/src/application/handlers/MessageHandler.ts:273` — the four-line comment block ("The balance widget already reads the key live; this gives the assistant, dictionary, and context paths the same recovery…") is doing two jobs: explaining *what* (one sentence) and justifying *why this mechanism* (three more). The justification belongs in the PR description; the pattern is already established by `disposeBalanceListener` six lines up. Trim to a single sentence of intent and let the dispose-side comment ("can't trigger a service refresh after teardown") stand — that one earns its place.

> *"It works, but the guard lives in one hook and the bug lives in three — the constant is shared, the fix isn't."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The behavior the PR exists for has no test

`packages/core/src/__tests__/presentation/webview/hooks/domain/useAnalysis.test.ts` — the PR's stated headline is "stops persisting the transient warning." That behavior is the `isConfigWarning` guard on `useState` init (L108–110) and on `persistedState` (L292). `useAnalysis.test.ts` is **not modified by this PR** — searched the diff, it's untouched — and its existing blocks cover type contracts and streaming cancellation, neither of which mounts the hook with a persisted warning. So if `isConfigWarning` were deleted, inverted, or the two guards swapped, no test would notice. The setup already mocks `usePersistedState`; a ~10-line `renderHook` test passing `{ analysisResult: '⚠️ OpenRouter API key not configured\n\n…' }` and asserting `result.current.result === ''` and `persistedState.analysisResult === ''` closes it. The same test, written for the siblings, is exactly what would have caught Finding 1.

### 🟡 Standard — The self-heal test couples to the refresh's async depth

`packages/core/src/__tests__/application/handlers/MessageHandler.test.ts:253` — `await new Promise(resolve => setImmediate(resolve));`. The test fires the secret-change listener, then drains the queue with one `setImmediate` because `refreshServiceConfiguration` awaits four services in sequence behind a `void`. It passes today, and it does assert real call-counts (not just wiring) — that part is legitimate. But the comment promises it "flush[es] the full microtask queue," which `setImmediate` doesn't guarantee in general; the test quietly depends on the method's exact sequential shape. Exposing `refreshServiceConfiguration` as a directly-awaitable seam (or returning the promise instead of `void`-ing it) would make the test assert the behavior instead of racing the scheduler.

> *"The fix the title promises is the one behavior no test will defend — and the test we did write proves the wires are connected, not that the right thing flows through them."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟠 High — We have two sibling hooks that need the exact same guard, right next door [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/hooks/domain/useContext.ts:84`/`:268` & `useDictionary.ts:132`/`:347` — the three domain hooks are deliberate siblings: same `usePersistedState` shape, same `handleXResult → setResult`, same `persistedState` round-trip. That symmetry is a feature of this codebase — until a change breaks it. This PR fixed `useAnalysis` and left its two twins divergent, so a reader comparing the three now finds one that scrubs the warning and two that don't, with no comment explaining why. `useDictionary.test.ts` even exists already, so the dictionary gap had a natural home for a guarding test. The constant is exported, the producers are wired, the pattern is proven one file over — this is the kind of inconsistency that makes the next reader distrust all three.

### 🟢 Nit — `disposeSecretListener` doesn't match its sibling's shape

`packages/core/src/application/handlers/MessageHandler.ts:270`–`281` — `disposeBalanceListener` takes the return of `addRefreshListener` directly (it's already a `() => void`), while `disposeSecretListener` introduces a local `secretSubscription` and wraps `.dispose()` in a lambda (because `onDidChange` returns a `PlatformDisposable`). Both are idiomatic for their respective return types and the teardown is symmetric — not a bug — but two shapes for conceptually one operation, six lines apart, is a small double-take. A one-line note on the type difference, or a tiny `toDisposeFn(d)` helper, would keep the constructor reading as one pattern.

> *"We literally have two sibling hooks one directory over that need the identical guard — we shipped the constant, updated both backend services, wrote a doc comment about why it matters, and then left the twins just... watching."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — `refreshServiceConfiguration` initializes resources four times where once would do

`packages/core/src/application/handlers/MessageHandler.ts:426` — I traced the chain before grading it. `aiResourceManager.refreshConfiguration()` runs `initializeResources()`; then each of the three service refreshes (`assistantToolService`, `dictionaryService`, `contextAssistantService`) independently calls `aiResourceManager.initializeResources()` *again* inside its own init. Net: `initializeResources()` runs four times per secret change — four secret reads, four dispose-and-recreate cycles — and the sequential ordering buys no dependency guarantee, because the services don't read orchestrators the explicit first call set up; they rebuild them. Now the math that matters: this fires on a **secret change** — set / clear / first-launch migration — i.e., roughly once per session. Wall-clock cost: invisible. And the PR didn't invent this; it faithfully mirrors the same redundancy `ConfigurationHandler` already has on model-change. So: real, worth a follow-up ticket to let the manager's refresh gate the services, not worth blocking a rare-path fix.

> *"Four awaits, four `initializeResources()` calls, fired once in a blue API-key moon — the dependency graph doesn't demand the sequence, the architecture just never noticed it was paying four times for one setup. At this frequency the audit cost of the redundancy already exceeds its runtime cost."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟢 Praise — The key never reaches a log, and `persistedState` carries no credential

`packages/core/src/application/handlers/MessageHandler.ts:278` — the self-heal callback logs a fixed string (`[MessageHandler] API key changed, refreshing AI services`) — no interpolation, no event object, nothing stringifiable that could carry the secret. And it *can't* leak even by accident: `SecretStorageService.onDidChange` (L57–61) discards the VS Code event entirely before forwarding, so the new seam actually narrows exposure rather than widening it. The `refreshServiceConfiguration` catch logs `error.message`, never the key; `SecretStorageService`'s own `console.error` calls log the caught error, and in `setApiKey` the in-scope `key` is never referenced in the catch. On the webview side, `persistedState` stores only display text, tool name, guides, and status — no token, ever — and the `isConfigWarning` sentinel is a user-visible heading, not secret material. Clean surface.

### 🟢 Praise — The warning scrub holds at both seams

`packages/core/src/presentation/webview/hooks/domain/useAnalysis.ts:109` & `:292` — the guard fires on both the seed (ejecting a previously-persisted warning before re-seeding state) and the persist (never writing it back out). Nothing sensitive transits either seam. The only note for the threat model is a non-finding: the same scrub should reach dictionary/context (Finding 1) — a correctness gap, not a secrets one.

> *"The log says the key changed, not what it changed to — that's the right amount of silence, and everything downstream honors it."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟡 Standard — One catch for four services: partial failure is anonymous, success is silent

`packages/core/src/application/handlers/MessageHandler.ts:426` — the trigger log is genuinely good: when the key changes you get `[MessageHandler] API key changed, refreshing AI services`. Then the trail goes cold. `refreshServiceConfiguration` awaits four services inside one try/catch; if `aiResourceManager.refreshConfiguration()` throws, the catch fires *immediately* — the other three never run — and the log says only `Failed to refresh service configuration: <message>`, naming neither the service that failed nor the three that were skipped. If all four succeed, there's no completion line at all. So a user reports "I added my key and analysis still doesn't work," and on-call has: one "refreshing" line and either a generic failure or nothing. Wrapping each await so the log names the failing service, plus a single `AI services refreshed successfully` on completion, turns "something may have run" into a trail you can actually follow. The method predates this PR, but the new trigger makes it the thing on-call reaches for when a key change doesn't take.

> *"The trigger log tells you the gun fired. Whether the bullet landed — and which of the four barrels jammed — you'll have to guess."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟠 High — "Stops persisting the transient warning" is true for analysis only [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/hooks/domain/useDictionary.ts:347` & `useContext.ts:268` — read the description literally: "Stops persisting the transient 'no API key' warning **as an analysis result**." That scoping phrase is doing quiet work. The warning isn't an analysis-only artifact — `DictionaryService.getApiKeyWarning()` and `ContextAssistantService.getApiKeyWarning()` emit the same heading, and the dictionary (`utilitiesResult`) and context (`contextText`) hooks persist and reseed it with no guard. So the user-visible promise ("a stale no-key warning won't haunt you on reload") holds on one of three tabs. Is that a deliberate "analysis first, siblings next" call, or did the wording quietly narrow the fix to match where the work happened to land? Either way it's worth stating out loud, because from a user's seat the dictionary tab still has the bug the PR title claims to have closed.

### 🟡 Standard — "Self-heal" heals the service layer, not the user's experience [🎯 Consensus]

`packages/core/src/application/handlers/MessageHandler.ts:277` — "self-heal after the stored secret changes" implies the user recovers, not just the services. The backend does recover; the rendered warning doesn't (Sam traced the same gap). The honest scope is "the services self-heal" — the screen waits for the next manual run. Worth confirming that's the intended experience, or pairing the refresh with a UI-clear so the recovery is the whole story.

> *"The title says self-heal. The dictionary tab says 'not configured.' Probably fine. Probably just very specifically scoped to the word 'analysis.'"* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — Fix the Pattern, Not Just the Instance

Illuminated by: Findings 1, 3, 4 — Marcus · Sam · Parker · Cal · Stan · Tim · Patricia · Oliver · Bria

When a behavior is wrong in one place, the first question isn't "how do I fix this?" but "where else does this same structure live?" The guard landed in `useAnalysis` because that's the hook in front of us — but the bug was never in `useAnalysis`; it was in a *shared shape* (seed-from-persisted, persist-back) reused across three hooks. Reasoning locally about a cross-cutting concern is one of the most natural and most expensive errors in software: the file you edited compiles, the test you ran passes, and the bug ships twice more in the siblings you never opened.

→ Carry forward: before closing a fix, finish the sentence "this same structure also exists at ___." If you can't end it with "nowhere else," the fix isn't done.

### Lesson 2 — Test the Claim, Not the Plumbing

Illuminated by: Findings 2, 8 — Cal

A test that asserts a mock was called proves the wires are connected; it says nothing about whether the right thing flows through them. The new test confirms four refresh functions fired — but the PR's actual promise, "the warning is no longer persisted," has no assertion anywhere. That's the difference between testing that a door opens and testing that the right room is behind it. Call-count tests are integration smoke tests in unit-test clothing: confident about mechanics, silent about meaning.

→ Carry forward: for every PR, ask "if the behavior I'm promising broke silently — not the wiring, the user-visible outcome — would a test catch it?" If not, that's the test that's missing.

### Lesson 3 — Shared Concepts Deserve Shared Addresses

Illuminated by: Findings 4, 7 — Marcus · Parker

`API_KEY_NOT_CONFIGURED_HEADING` living in `analysis.ts` isn't untidiness — it's a claim about who owns the concept, and the claim is wrong. Filing a cross-cutting sentinel under one consumer teaches every future reader that this is an analysis idea, not a configuration one. The same quiet misstatement appears in `SecretsPort.onDidChange` discarding the key: the interface encodes "there will only ever be one secret" at the precise moment the codebase is extending past that assumption. Both are concepts that have outgrown their housing without the housing being updated.

→ Carry forward: when a constant, interface, or policy gains a second caller, ask "does its home reflect what it *is*, or just where I first needed it?" Move it before the coupling hardens.

### Lesson 4 — Closing the Loop Means Closing It for the User

Illuminated by: Finding 3 — Sam · Oliver · Bria

`refreshServiceConfiguration` faithfully heals the backend — services reconfigured, new key in place, system ready. And the user is still staring at a warning the system now knows is stale. This is a recurring shape of incomplete change: we tend the state we own (our services, our data) and forget the state we already *emitted* (the rendered UI, the sent response, the cached value). A fix that repairs the engine but not the dashboard is, from where the user sits, only half a fix.

→ Carry forward: for any state change you've already communicated outward — to a UI, a client, a log, a cache — ask "does this also need to retract or update what I previously emitted?"

> *"The warning was only three lines of code, but it lived in three places, and we visited one of them — which is how most software gets complicated: not in leaps, but in partial visits."* — Sensei

---

## The Closer

### 🎬 Movie tagline

> *In a world where one warning haunts three windows... one hook learned to forget. **THE OTHER TWO REMEMBER EVERYTHING.** This summer, the backend heals. The screen does not get the memo. — `useAnalysis: First Blood, Part ⅓`*

*(PR #64 → 64 % 6 = 4 → Movie tagline. Framed around the dominant theme: a fix that heals one of three symmetric surfaces and leaves its twins exactly as they were.)*

---

## Summary

A small, well-intentioned, cleanly-wired fix that does two honest things — stop persisting the transient no-key warning, and self-heal the AI services when the secret changes — and Blake cleared every correctness path, so **there are no blockers**. The panel's signal is unusually coherent: nine of ten reviewers landed on the same structural truth, that the change was reasoned about at one site rather than at the level of the pattern it belongs to. Before merge, the two things worth doing are (1) carry the `isConfigWarning` guard to `useDictionary` and `useContext` — ideally by lifting it to a shared util — so the bug the title promises to kill is actually dead on all three surfaces, and (2) add the one `renderHook` test that proves a persisted warning is dropped. The rest — the constant's home, the four-into-one refresh logging, the over-broad `onDidChange`, the in-session UI clear — are clean Standard-tier polish that can ship now or be tracked. Finish the sentence the fix started, and it's ready.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
