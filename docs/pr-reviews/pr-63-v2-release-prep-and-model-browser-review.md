# PR Review — #63: Prepare Prose Minion 2.0 release (Model Browser + streaming stats)

**Author:** okeylanders · PR #63 on `release/2.0-prep`
**Reviewed:** 2026-06-25 (multi-agent pass — 10 reviewers + Sensei)
**Base:** `main` @ `0cffc919` · **Head:** `3321621e`
**Status:** 🟢 **Merge-ready — review fixups landed in `926faea`.** Blake walked every correctness path and found nothing that pages her: the curated⨝live model join never throws (failure is caught and degraded to a fallback), every live-derived field is guarded, the streaming timers are cleaned up, and the `token`→`chunk` rename has zero stale references. The panel's real signal was a single coherent theme rather than a list of bugs: **the live-data join was well-built and well-defended on the happy path, but its degraded path — network failure → fallback — was silent and untested.** The fixup pass closed exactly that seam: the live-fetch failure now surfaces in the Output channel, the catalog transform has behavioral tests, the category browser waits for live data, the offline fallback is cached, the double cache-bust is gone, and the stale search-chip bug is fixed. See **Fixup Resolution** below for per-item dispositions and validation.

> ℹ️ Diff is **+2005 / −174 across 34 files**, but roughly **half is docs**: a 222-line memory-bank checkpoint, a 171-line feature brief, README/CHANGELOG/CHANGELOG-DETAILED/RECOMMENDED_MODELS rewrites, two PNGs, and ~120 lines of *mechanical* `family:` additions to the curated model arrays. Agent attention was weighted to the **~700-line real code surface**: `ConfigurationHandler` (the curated⨝live join), the new `ModelBrowserModal.tsx` (309 lines), `ModelSelector`, `useStreaming` + `streamingStatsFormatter`, `useModelsSettings`, the `ModelOption` message contract, and the prop-threading across the streaming hooks/tabs. The branch was read on disk at the PR head to trace behavior claims.

---

## Blast Radius

- **34 files** · **+2005 / −174** · **7 commits**. Migrations: **none**. New services: **none**.
- **New files (4):** `ModelBrowserModal.tsx` (the searchable model gallery), `streamingStatsFormatter.ts` + its test, and `assets/frame-minion-icon.png` — plus docs (`.memory-bank/`, `.todo/feature-model-browser/`).
- **The PR's five moves:** (1) **Model Browser** — `<select>` → searchable modal with provider/family pivots, joining the curated list against live OpenRouter `/models` pricing/context/release data; (2) **streaming progress stats** — `useStreaming` now tracks `chunkCount`/`elapsedMs`/`initialLatencyMs`/`chunksPerSecond`, with the user-facing word honestly changed from "tokens" to "chunks"; (3) **debug Output title-bar command** (`prose-minion.showOutputChannel`, `$(bug)` icon); (4) **All Tools Modal copy audit** (16 card descriptions reworded to match prompt behavior); (5) **marketplace docs + model-catalog refresh** (absolute GitHub URLs because VSCE packages from `apps/vscode-extension`, FrameMinion sister-extension callout, GLM 5.2 + Qwen3.7 Plus added, Mistral 2411→2512, three stale models dropped).
- **Contract changes:** `OpenRouterModel` gains `created`/`family`/`knowledge_cutoff`/`expiration_date`/`isFallback`; new `CuratedOpenRouterModel`; `ModelOption` gains eight metadata fields; `RequestModelDataMessage` gains a `refresh?: boolean` payload; `ModelDataPayload` gains `categoryOptions`.
- **Character:** a broad, confident release-prep PR. The headline feature is genuinely well-architected — the join lives in the right layer, the `$0.00` failure mode is suppressed end-to-end, and the component stays a pure renderer. What it lacks is a voice for when the live fetch fails.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B |
| 🛡️ Security | A− |
| 🧪 Tests | C+ |
| 📖 Quality | B |
| ⚡ Performance | B− |
| 🎯 Domain | B |

Grades sit mid-high because the PR ships a real, well-layered feature and Blake found nothing blocking. They aren't higher because **Tests** carries the headline cost — the entire curated⨝live transform (`buildModelOption`, `hasLivePricing`, `getReleaseDate`, the `isFallback` branch, `categoryOptions`) has zero behavioral coverage — and three Standard-tier degraded-path concerns (silent fetch failure, double cache-bust, silent category fallback) cluster around the same seam.

---

## Status by item

| # | Severity | Finding | Reviewer(s) | Disposition |
|---|----------|---------|-------------|-------------|
| 1 | 🟠 High | **Live `/models` fetch failure is invisible in the Output channel.** `OpenRouterModels.fetchModels()` logs failures via `console.error` (host dev-console), not the `LogSink`/Output channel the new `$(bug)` command reveals. A user following the troubleshooting path sees an empty channel and concludes the extension is healthy while every card silently reads "pricing unavailable." | Oliver | ⚪ **Resolved (`926faea`).** `fetchModels` now takes an optional `LogSink` and, on the fallback path, logs the failure cause to the Output channel; `sendModelData` passes `this.outputChannel`. |
| 2 | 🟠 High | **The headline `sendModelData` transform has zero behavioral tests.** `ConfigurationHandler.test.ts` asserts only route registration. The join, `isFallback` zeroing of pricing, `created:0` → `1970-01-01`, custom-model injection, and `categoryOptions` are all untested — and all failure modes are *silent* (wrong data, no throw). | Cal | ⚪ **Resolved (`926faea`).** Added 5 behavioral tests: live-pricing join, `isFallback` suppression + degraded WARN, `created:0` release-date edge, custom-model injection, and the refresh-on-open cache contract. |
| 3 | 🟡 Standard 🎯🎯 | **Category model browser silently falls back to curated-only data** (no pricing/context/release) until `MODEL_DATA.categoryOptions` arrives — indistinguishable from a live response that genuinely has no data. No readiness flag. | Marcus · Sam · Bria **Strong Consensus** | ⚪ **Resolved (`926faea`).** `useModelsSettings` exposes `categoryOptionsReady`; `CategorySearchPanel` holds the browser trigger disabled until live category options arrive (same first-paint behavior as the other scopes). |
| 4 | 🟡 Standard 🎯 | **Refresh fires a full ~500KB catalog fetch on every browser open *and* again on select** (double cache-bust), and the network-failure fallback is never cached so offline interactions retry the network on every call. | Tim · Bria **Consensus** | ⚪ **Resolved (`926faea`).** Refresh point fixed at **browser-open** (per author's decision) — `handleSetModelSelection` no longer re-busts the cache; the offline fallback is now cached. *(Session TTL not needed once the double-fetch is gone.)* |
| 5 | 🟡 Standard | **`sendModelData` logs success even when all 82 models are fallbacks.** On-call sees "Sending MODEL_DATA with 82 options" with no degraded-state signal. | Oliver | ⚪ **Resolved (`926faea`).** `sendModelData` logs a WARN when the whole catalog is fallback, naming the degraded state instead of a bare success line. |
| 6 | 🟡 Standard | **Stale group chip hides matching models during search.** Drill into "Anthropic", type "deepseek": `activeGroup` never resets on `query` change, so `visibleGroups` is empty and "No models match that search" renders while the DeepSeek chip shows its count. | Sam | ⚪ **Resolved (`926faea`).** A render-derived `effectiveActiveGroup` falls back to "All" when the selected group leaves the result set — matches surface instead of the empty-state lie; no `setState`, no flash. |
| 7 | 🟡 Standard | **`ModelOption` now serves two identities** — the wire-transport payload *and* the card view-model — accreting eight optional fields plus a redundant `pricing?`/`pricingAvailable?` guard pair. | Marcus | **Open — design watch-item.** Split a lean transport `ModelOption` from a richer `ModelCard` when convenient; the hook is the assembly point. |
| 8 | 🟡 Standard | **`buildModelOption` / `buildCustomModelOption` share 9 of 11 fields.** ~35-line sibling for a 3-line difference; the shape changed twice in this PR and both had to track it. | Parker | **Open.** Synthesize a `CuratedOpenRouterModel` stub inline and delete `buildCustomModelOption`. |
| 9 | 🟡 Standard | **`mb-grid` doesn't compose the mirror target's `tm-grid`.** Cards correctly compose (`tm-card mb-card`); the grid wrapper uses `mb-grid` alone instead of `tm-grid mb-grid`. `AllToolsModal.tsx:119` is the next-door pattern. | Stan | **Open — minor.** Compose the shared base class. |
| 10 | 🟡 Standard | **`ModelBrowserModal` imports from `@shared/types`, not the documented `@messages` barrel.** Mitigated: sibling `ModelSelector` and other webview components do the same, so it's consistent-with-siblings but diverges from CLAUDE.md. | Stan | **Open — team decision.** Bless `@shared/types` for webview components, or normalize to `@messages`. |
| 11 | 🟢 Nit 🎯 | **`appendToken` survived the `token`→`chunk` rename.** Param is `chunk`, JSDoc says "chunk", everything else renamed — only the method name is the odd one out. | Parker · Stan **Consensus** | **Open.** Rename to `appendChunk` (internal; call sites are the three streaming hooks). |
| 12 | 🟢 Nit | **Two buttons open the same modal** — "All tools" (header, `AnalysisTab.tsx:482`) and the new "More Tools" (primary row, `:513`), identical guards and title. | Parker | **Open.** Keep one, or give them distinct purposes. |
| 13 | 🟢 Nit | **One-render flash of the empty state on pivot switch** — the reset-on-pivot effect fires post-commit; for one frame `activeGroup` is stale against the new groups. | Sam | ⚪ **Resolved (`926faea`).** The same `effectiveActiveGroup` fix collapses the stale frame — the pivot switch falls back to "All" during render, not after the effect. |
| 14 | 🟢 Nit | **Zero-chunk stream completion leaves `StreamingContent` stuck loading** — `chunkCount === 0` gates the spinner independent of `isStreaming`; nothing calls `reset()` in that path. Low real-world probability. | Sam | **Open — defensive.** Guard the empty-completion case. |
| 15 | 🟢 Nit | **`formatReleaseDate` double-slices** a date the handler already trimmed to `YYYY-MM-DD`; the component re-slices to `YYYY-MM`. Display knowledge split across layers. | Stan | **No change — informational.** |
| 16 | 🟢 Nit | **`showOutputChannel` puts the log channel one click away.** It logs model IDs/scopes/settings keys (never the API key), so the disclosure surface is non-sensitive — worth one line in the threat model. | Patricia | **No change — informational.** |
| P1 | 🟢 Praise 🎯🎯 | **`$0.00` suppression is airtight end-to-end:** `isFallback` → `hasLivePricing()` (checks `isFallback` first) → `pricing: undefined` → modal renders "pricing unavailable". No layer leaks a fake zero. | Blake · Marcus · Patricia · Bria **Strong Consensus** | — |
| P2 | 🟢 Praise | **Nothing blocks.** The join never throws, every live field is guarded, timers are cleaned up, the rename is complete, the `refresh` contract is symmetric. | Blake | — |
| P3 | 🟢 Praise | **Security surface is clean:** `/models` fetch is keyless, catalog strings reach the DOM as React-escaped text (no `MarkdownRenderer`/`dangerouslySetInnerHTML` path), and no secret reaches a log. | Patricia | — |
| P4 | 🟢 Praise | **`showOutputChannel` is a clean observability win** — it logs its own invocation before `show(true)`, so the channel always has a confirming line; sensible `navigation@98` placement. | Oliver | — |
| P5 | 🟢 Praise | **The join is well-layered:** curated metadata stays curated, volatile fields derive from a single cached fetch, the assembly lives in the handler, and the component stays a pure renderer. | Marcus | — |

---

## Fixup Resolution — 2026-06-25

Implemented in `926faea` (items 1–6 + the related nit #13), closing the degraded-path seam the panel converged on:

- **Item 1 + 5 (Oliver) — the failure now speaks.** `OpenRouterModels.fetchModels()` accepts an optional `LogSink` and, on the fallback path, logs the failure *cause* to the Output channel the `$(bug)` command reveals (`console.error` stays for the dev console). `sendModelData` passes `this.outputChannel` and emits a `WARN` when the whole catalog is fallback, so a degraded fetch no longer reads as a plain success line.
- **Item 4 (Tim · Bria) — refresh point fixed at browser-open.** Per the author's decision, `handleSetModelSelection` no longer calls `sendModelData({ refreshCatalog: true })` — a selection reuses the cached catalog instead of triggering a second full ~500KB fetch. The network-failure fallback is now cached (`this.cachedModels = fallback`), so offline interactions stop retrying a known-bad network on every call; reopening the browser remains the explicit retry.
- **Item 2 (Cal) — the transform is witnessed.** `ConfigurationHandler.test.ts` gains five behavioral tests over `sendModelData`: the live-pricing join, `isFallback` pricing suppression *plus* the degraded `WARN`, the `created:0` → no-release-date edge, custom (non-curated) model injection, and the refresh-on-open cache contract (`clearCache` only on explicit refresh).
- **Item 3 (Marcus · Sam · Bria) — no more guessing.** `useModelsSettings` exposes `categoryOptionsReady`; `CategorySearchPanel` holds the category model browser disabled until live category options arrive — the same first-paint behavior the assistant/dictionary/context selectors already have — instead of opening on curated-only data that's indistinguishable from a live-with-no-pricing response.
- **Item 6 + 13 (Sam) — the chip stops lying.** `ModelBrowserModal` derives `effectiveActiveGroup`: when a search (or a pivot switch) leaves the selected group with no matches, it falls back to "All" *during render* — showing every match rather than a "No models match that search" empty state while results sit one chip over. Same derivation collapses the one-frame pivot-switch flash.

Intentionally **not** changed (tracked, non-blocking):

- The `ModelOption` transport/view-model split (#7, Marcus), the twin `buildModelOption`/`buildCustomModelOption` methods (#8, Parker), `mb-grid`↔`tm-grid` composition (#9, Stan), the `@shared/types`-vs-`@messages` convention call (#10, Stan), the lingering `appendToken` name (#11, Parker · Stan), and the two-buttons-one-modal redundancy (#12, Parker) are quality/convention items, deferred to a follow-up so the release stays scoped. The zero-chunk streaming loading state (#14, Sam) is a low-probability defensive edge with no OpenRouter repro.

**Validation after fixups:**

- Typecheck green across core, webview, and extension.
- **50 suites / 397 tests** passing (was 392 — five new transform tests).
- ESLint: **0 errors** (existing warning backlog unchanged; touched files added no new warnings).
- Production webpack build + bundle sentinel verification passing (existing `webview.js` size warning unchanged).

---

## Executive Briefing

**No 🔴 blockers and no correctness 🟠s.** Blake walked every path and the goblins stayed home. The items below are the ones worth the author's attention before merge — all of them orbit the same seam: the live-data join is excellent on the happy path and quiet on the failure path.

🟠 **[Marcus · Sam · Bria — Strong Consensus]** The **category model browser silently falls back to curated-only data** (no pricing, context, or release date) until the first `MODEL_DATA` arrives — and there's no flag to tell "data not loaded yet" from "live data has nothing." Three reviewers hit this independently.

🟠 **[Oliver]** The **live `/models` fetch failure is invisible in the Output channel** the new `$(bug)` command opens — it logs to the host dev-console. The user's troubleshooting path leads to an empty channel while every card reads "pricing unavailable."

🟠 **[Cal]** The **headline `sendModelData` transform has zero behavioral tests.** Route registration is checked; the join, the `isFallback` pricing-zeroing, the `created:0`→`1970` date, and `categoryOptions` are not. Every failure mode here is silent.

🟠 **[Tim · Bria — Consensus]** **Refresh cost:** every browser open busts the cache and re-fetches the full ~500KB catalog, *and* selecting a model fires a second full refetch; the network-failure fallback is never cached, so offline interactions retry the network every call.

🟠 **[Sam]** **Stale group chip hides search matches** — a real interaction bug: filter by one provider, search for another, and the modal shows "No models match that search" while the matching chip sits right there with its count.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — `ModelOption` now wears two coats: wire payload and card view-model

`packages/core/src/shared/types/messages/configuration.ts` — `ModelOption` has always been a transport type (the envelope payload moving display data from handler to hook). This PR extends it with eight new optional fields so it *also* serves as the DTO `ModelBrowserModal` renders from — pricing, context, release date, knowledge cutoff, expiration, plus the `pricingAvailable` / `liveDataAvailable` booleans. One type now does two jobs: the serialized wire shape crossing the webview boundary, *and* the rich object that drives card rendering, sorting, and the group pivots. The redundant `pricing?: {…}` + `pricingAvailable?: boolean` pair exists only because the transport type is moonlighting in presentation. Not a bug — the code is coherent — but the cost is that every change to "what a card needs" now touches both the message contract and the handler. When there's a quiet moment, split a lean `ModelOption` transport from a richer `ModelCard` view model; the hook (`useModelsSettings`) is the natural assembly point.

### 🟢 Praise — The curated⨝live join lives in the right layer

The fundamental decision is sound: curated metadata stays in `CuratedOpenRouterModel`, volatile fields derive from a single cached `/models` fetch, the join happens in `ConfigurationHandler`, and the `isFallback` marker flows cleanly infra → handler → UI. `hasLivePricing()` guards `$0.00`, `clearCache()` only fires on explicit refresh, and the component stays a pure renderer. The bones are right.

> *"The data contract is doing honest work and the failure mode is labeled — what gives me pause is that the message envelope and the card view model are now wearing the same coat, which tends to get expensive when one of them needs alterations."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟢 Praise — The join and the streaming rename are defended end to end

`ConfigurationHandler.ts:375` / `useStreaming.ts` — I walked the whole focus list looking for the page. The join is airtight: `fetchModels()` catches its own failure and returns the fallback (`isFallback:true`, pricing `'0'/'0'`), so `sendModelData`'s `await` always resolves and never propagates. Every live-derived field is gated by `!live.isFallback` / `hasLivePricing()`, so a fallback or a missing join key yields `undefined`, not `"$0.00"`. `formatPrice`/`formatContext`/`formatInitialLatency`/`formatChunksPerSecond` all bail on non-finite input; `sortModels` coalesces undefined dates with `?? ''`. `useStreaming` clears every timer on start/reset/end/unmount, reads `startedAtRef` (a ref — no stale closure) inside the interval, and guards the throughput divide with `elapsedMs > 0`. The `tokenCount→chunkCount` rename has zero stragglers across all three hooks and all three `StreamingContent` call sites. The `REQUEST_MODEL_DATA` `refresh` contract is symmetric across sender and receiver. Nothing corrupts data or throws.

> *"Nothing here pages me — ship it."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟡 Standard — Stale group chip hides matching models during search

`ModelBrowserModal.tsx:161` — `const visibleGroups = activeGroup === 'All' ? groups : groups.filter(group => group === activeGroup);`. What if you drill into the "Anthropic" chip, then type "deepseek"? `filteredModels` rebuilds to DeepSeek-only, `groups` becomes `['DeepSeek']` — but `activeGroup` is still `'Anthropic'`. There's a reset effect on `pivot` change (`:141`) but none on `query` change, so `visibleGroups` filters to `[]` and the `mb-empty` div renders "No models match that search" — while the DeepSeek chip sits right there, correctly labeled with its count. The search *succeeded*; the UI says it failed. Add `useEffect(() => setActiveGroup('All'), [query])`, or reset the group whenever it falls out of the current set.

### 🟢 Nit — Zero-chunk stream completion leaves the spinner up

`StreamingContent.tsx:83` — `{chunkCount === 0 ? (…waiting…)}` is gated independently of `isStreaming`. If a stream starts and completes with no chunks (an immediate provider error, or a cancel acknowledged before the first chunk), `endStreaming` sets `isStreaming=false` and `displayContent=''` but leaves `chunkCount` at 0 — so the loading branch renders for the rest of the component's life, because nothing calls `reset()` in that path. Low probability with OpenRouter (it nearly always sends ≥1 chunk), but the failure path has no test.

> *"Found the trapdoor — it's not in the zero-chunk path, it's right there in the chip filter: type a search term that crosses the active group boundary and the models are invisible behind a perfectly healthy 'No models match that search' lie."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — `buildModelOption` and `buildCustomModelOption` are near-identical twins

`ConfigurationHandler.ts:375` and `:394` — same 11 fields, same helper calls (`hasLivePricing`, `getReleaseDate`, `getProviderName`), same optional-chaining; they differ only in how `id`/`label`/`description`/`family` are sourced when there's no live data. That's a three-line difference dressed up as a 35-line sibling method — and the `ModelOption` shape changed *twice* in this PR, forcing identical edits to both. Synthesize a `CuratedOpenRouterModel` stub inline (`{ id: modelId, name: live?.name ?? modelId, family: live?.family ?? '', description: live?.description ?? 'Custom model (from settings)' }`) and call the single builder — then delete `buildCustomModelOption`. The next field addition touches one place.

### 🟢 Nit — `appendToken` is a method name arguing with its own parameter

`useStreaming.ts:40` — `appendToken: (chunk: string) => void;`. The PR renamed `tokenCount`→`chunkCount`, `streamingTokenCount`→`streamingChunkCount`, and the JSDoc to "Append a new stream chunk" — but left the method name `appendToken`. It's the only "token" survivor in a file full of "chunks." Rename to `appendChunk`; the blast radius is this file plus the three streaming hooks.

### 🟢 Nit — Two buttons, one modal

`AnalysisTab.tsx:513` — the new "More Tools" button (primary row) and the existing "All tools" ghost button (`:482`, in the section header) both call `setShowAllTools(true)` with identical `disabled` guards and titles, ~30px apart. Pick the one that's the intended primary affordance and drop the other, or give them meaningfully distinct purposes.

> *"It works, but `appendToken(chunk)` is a method name arguing with its own parameter, and I had to read it three times before I realized the rename stopped one word short of done."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The headline transform has zero behavioral coverage

`ConfigurationHandler.test.ts` — the existing suite runs `registerRoutes` and asserts the router has the handler. The PR's actual work — `buildModelOption`, `hasLivePricing`, `getReleaseDate`, the `isFallback` guard that switches `$0.00` to "pricing unavailable", the curated⨝live join, the `buildCustomModelOption` path, and the `categoryOptions` branch — has *no* behavioral test. This is ~72 lines of data transformation on the only async path a user trigger exercises, and every failure mode is silent: `isFallback` zeroes all pricing, a non-matching `liveModelsById` key yields `undefined` contextLength, a `created:0` timestamp renders `1970-01-01`. Searched the diff for any test touching these methods — not found. This is the single highest-value test the PR is missing.

### 🟡 Standard — `useModelsSettings` model-data paths and `useContext` contract are untested

`useModelsSettings.test.ts` covers settings/persistence but not the three behaviors this PR added: `handleModelData` setting `liveCategoryModelOptions`, the merge rule at `useModelsSettings.ts:266`, and the `requestModelData(refresh:true)` cache-bust path. Separately, `useAnalysis.test.ts` and `useDictionary.test.ts` were both updated with the four new streaming fields — but `useContext.ts` exposes the *same* four fields, was wired in this PR, and has **no** `useContext.test.ts` at all. The domain-mirroring drift-detection contract simply doesn't exist for context.

> *"I don't need 100% coverage to be confident — I need the tests to exercise the code that can silently be wrong, and right now every path that touches `isFallback`, `liveModelsById`, and `categoryOptions` produces a result no test will ever disagree with."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟡 Standard — `mb-grid` forgot to compose `tm-grid`

`ModelBrowserModal.tsx:246` — the feature brief says the modal "mirrors the established `tm-*` design language" of `AllToolsModal`. The cards remembered: `tm-card mb-card`. The grid wrapper didn't: `<div className="mb-grid">` alone, where the mirror target uses `<div className="tm-grid">` (`AllToolsModal.tsx:119`). Compose the shared base — `tm-grid mb-grid` — so browser-specific layout layers on top of the established grid instead of replacing it.

### 🟡 Standard — The new modal reaches for `@shared/types`, not the documented `@messages` barrel

`ModelBrowserModal.tsx:2` — `import { ModelOption, ModelScope } from '@shared/types';`. CLAUDE.md is explicit: import message contracts from the `@messages` barrel. The mitigating half: sibling `ModelSelector.tsx` (the component this modal is rendered by) imports from `@shared/types` too, as do several other webview components — so the new file is consistent with its neighbors while both diverge from the documented convention. It compiles (the types re-export through `@shared/types`), so this is convention drift, not breakage. Worth a deliberate call: bless `@shared/types` for webview components, or normalize to `@messages` — but pick one, before the new file notarizes the older habit.

> *"We have a `@messages` barrel for exactly this, but the new modal reached for `@shared/types` because its next-door neighbor did — that's how a convention quietly becomes two conventions."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — Every modal open busts the cache and re-fetches ~500KB

`useModelsSettings.ts:210` + the `onOpenBrowser={() => modelsSettings.requestModelData(true)}` call sites — every browser open clears `cachedModels` and fires a full GET to `openrouter.ai/api/v1/models` (~339 models, ~500KB), regardless of how recently it was fetched. The design doc framed `clearCache()` as a *refresh-on-select* affordance (commit against fresh pricing after choosing), not refresh-on-view. A session TTL, or reserving the cache-bust for the post-selection `SET_MODEL_SELECTION` path (which already calls `sendModelData({ refreshCatalog: true })` at `ConfigurationHandler.ts:295`), drops redundant fetches to zero in the common browse-without-selecting case. Fine at one open; chatty at five-to-ten compares.

### 🟡 Standard — The network-failure fallback is never cached → retry on every call

`OpenRouterModels.ts:806` — when `fetch` throws or returns non-2xx, the fallback array is returned *without* setting `cachedModels`, so it stays `null`. The next call (a settings change, a re-open) re-enters `fetchModels()`, finds the cache empty, and hits the network again. Offline or flaky, every model-data interaction sends a fresh, guaranteed-to-fail request and pays the latency. One line fixes it — `this.cachedModels = fallback; return fallback;` — and since the UI already distinguishes fallback via `isFallback`, nothing visible changes.

### 🟢 Nit — The modal's render pipeline is `O(groups × models)`, unmemoized

`ModelBrowserModal.tsx` — each render runs `filter` → `sort` → `new Set` → `new Map`, then inside `visibleGroups.map` a *second* `.filter` over `filteredModels` per group: at "All", 17 groups × 82 models ≈ 1,394 `getGroupLabel` calls, none wrapped in `useMemo`. Imperceptible in a sidebar webview at N=82 — but `groupCounts` already holds the per-group counts, so grouping into a `Map<string, ModelOption[]>` once would erase the quadratic pass. Worth doing before N grows, not blocking.

> *"Three fetches where one would do, a quadratic pass the profiler will never care about at 82, and a fallback that doesn't stick — the math is fine today, the retry behavior is the only one that bites."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟢 Praise — The key never leaves the host; catalog strings render as escaped text

`OpenRouterModels.ts:792` — the `/models` fetch sends only `Content-Type`: no `Authorization`, no `Bearer`, no key. The API key lives in SecretStorage behind `SecretsPort`, injected at the composition root; there's no path by which it reaches `OpenRouterModels`, and `MODEL_DATA` carries only IDs/names/pricing/dates. On the XSS question: `model.description`/`label`/`family`/`knowledgeCutoff`/`expirationDate` all land in React text-node children (`ModelBrowserModal.tsx:290`), which React HTML-escapes — a hostile `/models` response containing `<script>` would render inert. `Icon`'s `dangerouslySetInnerHTML` is bounded to a closed `PATHS` record; `MarkdownRenderer` is never called from this modal. The trust boundary holds.

### 🟢 Nit — The Output channel is now one click away (logs IDs, not secrets)

`extension.ts` — the `$(bug)` command surfaces an existing channel via a low-friction UI path. Reviewed: no secret reaches `appendLine` — model IDs, scopes, and config keys are logged (`selections = ${JSON.stringify(selections)}`), but `getEffectiveModelSelections()` returns only ID strings, and the key-migration log never prints the value. The practical risk is a screenshot exposing model IDs/settings keys, which aren't sensitive. Worth one sentence in the threat model; not a finding.

> *"The `/models` fetch doesn't touch the API key, the DOM renders catalog strings as React text children, and the Output channel logs IDs not secrets — this surface is cleaner than most I've seen in webview extensions."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — The fetch failure logs to the dev console, not the channel the bug-icon opens

`OpenRouterModels.ts:806` — `console.error('Error fetching OpenRouter models:', error);`. When `/models` fails (network, 429, 500), the only diagnostic is a `console.error` to the VS Code Developer Console — *not* the Prose Minion Output channel the new `$(bug)` command reveals. The user's troubleshooting path is: click the bug icon, open Output, see nothing, conclude the extension is healthy. The actual error vanishes from every surface a non-developer can reach. One line closes it: pass a `LogSink` into `fetchModels`, or bubble the error up and let `sendModelData`'s catch log it via `this.outputChannel`. This is the difference between "pricing's been unavailable for an hour and I can't tell why" and a one-line answer.

### 🟡 Standard — `sendModelData` logs success even when every model is a fallback

`ConfigurationHandler.ts:358` — after a fetch failure, `sendModelData` receives 82 models all flagged `isFallback`, builds them with `liveDataAvailable:false`, and logs "Sending MODEL_DATA with 82 options" with no hint of the degradation. The on-call reading the channel can't tell the user is staring at "pricing unavailable" everywhere. A one-line check — count the fallbacks, `appendLine` a WARN when > 0 — turns a silent degradation into a diagnosable state.

> *"console.error host-side, and the user's staring at an Output channel that never hears about it."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟡 Standard — The brief said refresh-on-select; the code refreshes on open *and* on select

`ConfigurationHandler.ts:295` — the feature brief's caching contract is "pricing realtime; context cache-in-list, **refresh on select**." The implementation refreshes twice: opening the browser (`onOpenBrowser` → `requestModelData(true)` → `clearCache()` + fetch *before* the modal renders), and again on confirm (`handleSetModelSelection` → `sendModelData({ refreshCatalog: true })` → a second `clearCache()` + full refetch). So every selection triggers two full catalog fetches. Harmless in practice, but it diverges from the documented single-refresh intent and could flash a loading state on a quick reopen. Worth deciding which refresh is the real one — "fresh prices on open" or "commit against fresh data on select" — and removing the other.

### 🟢 Praise — The `$0.00` failure mode is handled exactly as the brief demanded

The brief's explicit requirement — "the browser must not render `$0.00` as a real price" — holds end-to-end: `fetchModels()` marks the fallback `isFallback:true`, `hasLivePricing()` checks `isFallback` *before* the numbers, `buildModelOption()` passes `pricing: undefined`, and the modal branches on `pricingAvailable` to show dashes and "pricing unavailable." Complete guard chain, infra → handler → contract → component, with no hole. (The All Tools copy audit also checks out — the reworded cards match the actual prompt behavior I spot-checked.)

> *"The brief said refresh-on-select. The code refreshes on open and again on select. Probably fine. Probably just very enthusiastic about fresh prices."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Degraded Path Is Not a Footnote, It Is a User Experience

Illuminated by: Oliver, Tim, Cal, Marcus

We design and test the happy path because it is the path we intended. The failure path — network down, fallback fired, live data absent — is the one the user actually inhabits when things go wrong. When that path is silent (no log, no readiness flag, no cached retry), it doesn't disappear; it *masquerades* as the happy path. The user stares at a healthy-looking UI while the system has already given up.

→ Carry forward: after implementing any fallback, ask — "What would I see in the Output channel right now if I were on-call and this had just fired?" If the answer is nothing, the fallback is half-built.

### Lesson 2 — A Rename That Stops One Word Short Is Still a Lie

Illuminated by: Parker, Stan

A rename feels complete when the visible sites are updated. But a method name is a contract with every future reader, and `appendToken(chunk: string)` with a JSDoc that says "chunk" has performed the ritual without keeping the promise. Small inconsistencies compound: the next developer reads `appendToken`, reaches for "tokens," and the conceptual drift widens.

→ Carry forward: when renaming a concept, grep for the old term across names, parameters, comments, *and* JSDoc — not just call sites. Treat any survivor as an open bug.

### Lesson 3 — Untested Silent Failures Are Invisible Until They Aren't

Illuminated by: Cal, Oliver, Tim

The most dangerous behavior to leave untested isn't the one that crashes — it's the one that silently produces a wrong-but-plausible result. `isFallback` zeroing pricing, a non-matching key returning `undefined`, a `1970` date from a zero timestamp: each looks like normal output until a user notices. Tests that only guard route registration give the *architecture* confidence and leave the *transform* — the logic users depend on — unwitnessed.

→ Carry forward: before closing a PR that adds a data transform, ask "what's the worst thing this can silently produce?" and write one test that proves the system reacts the way you intend.

### Lesson 4 — One Type Wearing Two Hats Will Eventually Split Them for You

Illuminated by: Marcus, Stan

When a wire-transport type quietly accretes presentation fields — optionals added because the component needs them, view logic grafted because it's convenient — it's taking on two identities. Harmless until one identity must change while the other stays stable; then the coupling taxes every edit. Stan's import drift and Marcus's `ModelOption` conflation are the same pattern at different scales: convenience today, rigidity tomorrow.

→ Carry forward: when adding a field to an existing type, ask which identity it serves — "the wire, or the screen?" If the honest answer is "both," that's the moment to split.

### Lesson 5 — Stale State Hides Behind Correct UI

Illuminated by: Sam, Bria, Marcus

A component can be individually correct — rendering exactly what it's given, filtering exactly as told — and still mislead, because the state driving it has gone stale. The chip filter shows "No models match" while the models are right there, invisible behind an `activeGroup` that forgot the search changed. The category browser shows dashes not because data is absent but because live data hasn't arrived and nothing says so. Stale state never announces itself; it lets the UI speak on its behalf.

→ Carry forward: whenever two pieces of state must stay in sync — a filter and a query, a result and a readiness flag, a selection and a cache — name the invariant out loud ("when X changes, Y resets") and check whether something *enforces* it, or whether the code is just hoping.

> *"The system you built for the failure case is not the one users see — they see the happy path rendered in fallback colors, and they call it broken."* — Sensei

---

## The Closer

### 🔮 Fortune cookie

> The model you can price, you trust. The one whose price you cannot see, you should ask why the messenger went quiet — and whether anyone was listening.

*(PR #63 → 63 % 6 = 3 → Fortune cookie. Vague enough to sound profound, specific enough to sting: the live-pricing join is the feature, and its silence on failure is the review.)*

---

## Summary

A broad, confident v2 release-prep PR with a genuinely well-architected headline feature: the Model Browser's curated⨝live join lives in the right layer, suppresses `$0.00` end-to-end, and keeps the component a pure renderer — and Blake cleared every correctness path, so **there are no blockers**. The panel's signal is coherent rather than scattered: the join is excellent on the happy path and *quiet* on the failure path. The four things worth doing before merge all sit on that seam — surface the fetch failure in the Output channel (Oliver), add behavioral tests for the transform (Cal), give the category browser a readiness signal (Marcus · Sam · Bria), and settle the double cache-bust / uncached-fallback refresh story (Tim · Bria). The rest — the stale search chip (a real but contained interaction bug), the twin builder methods, the lingering `appendToken` name, the `tm-grid` composition — are clean polish. Ship it after the degraded-path items are either closed or consciously tracked.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
