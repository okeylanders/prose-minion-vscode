# MR Review — Enable provider prompt caching and show estimated cache windows

**Author:** okeylanders · **PR:** [#123](https://github.com/okeylanders/prose-minion-vscode/pull/123) (Open)
**Branches:** `fix/anthropic-prompt-caching` → `main`
**Base:** `1ee010f` · **Head:** `6cc2292`
**Reviewed:** 2026-10-04 · **Mode:** Full (`/mr-review`: 10 parallel specialists, orchestrator verification, then Sensei)

> The diff is 2,285 lines. Every reviewer read the whole unified diff from a saved
> file, plus the sibling and context files listed under *Review coverage*. Each
> finding below was re-checked against the head commit before it went into this
> report. Findings that rest on OpenRouter, Anthropic, Alibaba or OpenAI behavior
> the repo can't prove are capped at Medium confidence and say so.

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict. Update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope, informational, or praise to preserve.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| F-01 | 🟠 High | The 100k-word standing context has no model-window guard. A context edit re-appends the full list to append-only history, and the failed turn retries the oversize prompt | Blake, Tim | 🎯 | **Open**. Medium confidence (provider windows unverified). Guard, warn, or send deltas before doubling |
| F-02 | 🟡 Standard | Persona prompt still tells the model 50,000 words / 420,000 chars. Validator now allows 100k / 840k. Architecture docs still say 50k and "3 items" | Stan, Bria | 🎯 | **Open**. One-line prompt fix. Land the sync test from the July debt note, or log a progress note on it |
| F-03 | 🟡 Standard | The "estimate belongs to another model" gate is written twice, against two sources of "current model", and neither copy is tested | Marcus, Cal, Stan, Parker | 🎯🎯 Strong | **Open**. Cal rated this High; the panel majority rated it Standard |
| F-04 | 🟡 Standard | Gesture Playground's 420k referenced-source cap is now smaller than one legal context attachment | Blake (+ orchestrator, independently) | — | **Open**. Derive it from the budget table and add a guard test |
| F-05 | 🟡 Standard | The countdown subtracts the webview's clock from a timestamp minted on the extension host. These are different machines under Remote-SSH, WSL and dev containers | Sam | — | **Open**. Send a relative remaining duration |
| F-06 | 🟡 Standard | The cache policy chosen, TTL sent, routing key, and reason for a suppressed estimate are never logged | Oliver | — | **Open**. Needed before live acceptance can be read |
| F-07 | 🟡 Standard | The 1h-TTL setting → wire chain is tested in halves, and the engine's settings stub ignores its key | Cal | — | **Open** |
| F-08 | 🟡 Standard | The compression-applied suppression and the requested-vs-response TTL guard are unreachable from tests | Cal | — | **Open** |
| F-09 | 🟡 Standard | The response-model guard reuses the exact-id Alibaba allowlist, so a dated response id silently drops the estimate | Sam | — | **Open**. Medium confidence. Fold into the F-08 test work |
| F-10 | 🟡 Standard | ADR says "rewind preserves its id"; rewind actually mints fresh ids, so the routing key changes | Bria | — | **Open**. Fix the ADR at minimum |
| F-11 | 🟡 Standard | Going from 3 to 7 per-message items at 10k words each silently raises the per-message ceiling from 30k to 70k words, with no aggregate bound | Bria | — | **Open**. Decide whether that's intended and document it, or cap the aggregate |
| F-12 | 🟡 Standard | Cache economics are only half disclosed: cold turns cost +25% (5m) or +100% (1h), cold-write triggers aren't surfaced, and there's no off switch | Tim | — | **Open** for the Settings copy · off switch can be **Deferred** |
| F-13 | 🟡 Standard | Vendor-named `claudeCacheTtl` rides the generic completion seam and bypasses the `ToolOptions` path that temperature/maxTokens use | Marcus, Parker | 🎯 | **Deferred**. The repo has mixed precedent; this is a convention call, so take it on the next touch |
| F-14 | 🟡 Standard | Cache expiry and model id travel as two always-paired optionals, cleared by hand. `toObservation` has 7 positional args. The policy is resolved up to 4× per request | Parker, Marcus | 🎯 | **Open**. Lands naturally with F-03 |
| F-15 | 🟡 Standard | The catch-all policy is named `native` but means "unknown", it sits inside an order-dependent lookup, and its `??` fallback is dead | Parker, Marcus | 🎯 | **Open**. Small |
| F-16 | 🟡 Standard | Live-acceptance runbook is under-specified (no token floor, no where-to-look, no 1h check) and cites machine-local `/private/tmp` logs | Oliver | — | **Open** |
| F-17 | 🔵 Nit | `claudeCacheTtl` declares no `scope`, so a workspace `.vscode/settings.json` can force 1h, which the Settings overlay can't override | Patricia | — | **Open**. One line (`"scope": "application"`) |
| F-18 | 🔵 Nit | The 840k character guard doesn't bound intake. The PR's own 100k-word fixture is 1,000,002 characters | Patricia | — | **Deferred**. Predates this PR; the doubling just makes it visible |
| F-19 | 🔵 Nit | Fractional manifest `order: 8.1`; overlay position differs from the manifest; TTL values retyped in three places | Stan | — | **Open** |
| F-20 | 🔵 Nit | `attachProvider` stores the untrimmed model id while the client trims, so a padded id hides the clock | Sam | — | **Open** |
| F-21 | 🔵 Nit | The 1-second indicator tick is fine at this scale; a minute-boundary timer is optional | Tim | — | N/A. Informational |
| F-22 | 🟢 Praise | Wire format (`cache_control`, text blocks, `session_id`) never leaves the adapter, and history is never mutated | Marcus, Blake | 🎯 | N/A. Preserve |
| F-23 | 🟢 Praise | The routing key hashes a random runtime id; it's never persisted and never stable across sessions | Patricia | — | N/A. Preserve |
| F-24 | 🟢 Praise | Evidence-matrix tests, `Object.freeze` mutation tripwires, 14 ids plus exclusions pinned | Cal | — | N/A. Preserve |
| F-25 | 🟢 Praise | The new setting follows every step of ADR 2025-11-03, with stricter host validation than its siblings | Stan, Patricia | 🎯 | N/A. Preserve |

## Review coverage

**Read fully:** `AGENTS.md`; both new ADRs; ADR 2026-08-06 (cache token visibility);
the `.todo/features/feature-provider-conversation-prompt-cache/` folder; all five new
memory-bank entries; the complete unified diff (41 files); every changed production
file at head.

**Context and sibling files read:** `OpenRouterClient.ts`, `AgentRunEngine.ts`,
`ConversationManager.ts`, `WorkshopRoomHandler.activeContextBudget()`,
`AssistantToolService` (engine selection, budget pass-through, ToolOptions usage),
`ConfigurationHandler`, `useModelsSettings`, `SettingsOverlay`, `WorkshopComposer`,
`WorkshopApp`, `WorkshopSessionService.collectPendingHostUpdates`,
`WorkshopPromptBuilder.buildWorkshopHostUpdateFrame`,
`WorkshopSessionPersistenceCoordinator.rewindTo/installRoom`,
`WorkshopAnalysisInputs` / `WorkshopCapabilityXmlCodec` (character guards),
`WorkshopGesturePlaygroundHandler.resolveSourceMaterials`, `GesturePlaygroundService`,
`resources/system-prompts/workshop-personas/analysis-capability.md`, and
`.todo/tech-debt/2026-07-26-persona-prompt-validator-contract-drift.md`.

**Not reviewed:** live provider behavior. `openrouter.ai` is blocked by this
environment's egress policy, so these remain unverified: whether OpenRouter honors
top-level `cache_control` on every Claude route, whether `session_id` affects routing,
which model id OpenRouter echoes in responses, and what each provider's window
overflow error looks like. This caps F-01, F-09 and part of F-16 at Medium confidence.

**Verified, not quoted.** The PR description's validation claims were re-run at `6cc2292`:

| Check | Result |
| --- | --- |
| `npx jest` | 232 suites / 2,914 tests / 2 snapshots, exit 0 (65 s), matching the PR description exactly |
| `npm run typecheck` (core + webview + ext) | exit 0 |
| `eslint` on the 29 added/modified `.ts`/`.tsx` files | 0 errors, 199 warnings (`--quiet` exit 0) |
| `npm run build` | exit 0; `verify-bundle` OK |
| `packages/core` imports `vscode` | none; the invariant holds |
| Composition root (`extension.ts`) / dependencies | unchanged / zero new |
| Existing PR review comments | none at review time |

---

## Blast Radius

- 41 files changed · +1,482 / −79 lines · 2 commits
- New files: 14 (3 production, 2 test, 2 ADRs, 5 memory-bank, 2 feature docs) · Migrations / persisted-schema changes: none · New services: none (a new policy module and a contracts module inside `infrastructure/api/providers/`)
- Two features in one PR. Prompt caching plus the cache clock is the headline. The **budget doubling** (100k-word standing context, 7 attachments per message) rides along, and it's where the highest-severity finding lives.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B |
| 🛡️ Security | B+ |
| 🧪 Tests | B− |
| 📖 Quality | B− |
| ⚡ Performance | C |
| 🎯 Domain | B− |

*Tests: Cal rated F-03 High; the synthesized severity is Standard, which gives B−. Performance's C comes from the budget doubling (F-01), not from the caching code, which Tim found cheap.*

---

## Executive Briefing

🟠 **[Blake, Tim · 🎯]** **The 100k-word standing context has no model-window guard, and edits double it.** Standing context lives in each participant's first user message, about 130k tokens at the new ceiling. Any attachment edit re-appends the **full** list to append-only retained history (`collectPendingHostUpdates` → `buildWorkshopHostUpdateFrame`: "this list supersedes…"), so one edit puts about 260k tokens on the next request. The pending update is kept when a turn fails, so every retry resends the oversize prompt. At 50k there were roughly two edits of headroom on a 200k model; at 100k there are none.

No 🔴 Blocking findings. The caching mechanism itself is sound. Every reviewer who traced the wire format found it contained (F-22). The short list worth landing before merge is all 🟡, and most items are small:

- **F-02** Update the persona prompt's 50k / 420k ceiling (one line). The July debt note predicted this drift.
- **F-04** Re-derive Gesture Playground's 420k referenced-source cap from the budget table (one line plus a guard test).
- **F-03 / F-14** Name one `cacheWindow` value and one pure visibility predicate, then test the hot-swap case.
- **F-05** Send a relative remaining time, not an absolute timestamp, across the host/webview boundary.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard: The model-mismatch gate exists twice, from two identity sources, and neither is tested [🎯🎯 Strong Consensus · F-03]

`packages/core/src/presentation/webview/WorkshopApp.tsx:1409` and `AgentRunEngine.ts:627`. What gives me pause is that "hide the estimate if it belongs to a different model" has two homes with two definitions of *current*: the engine compares against its trimmed `this.model`, and the webview compares against `modelSelections.assistant ?? settings.assistantModel`. `MessageHandler.refreshModelSelections()` doesn't re-post Workshop session state after a hot-swap. So the webview predicate is the one that actually fires, and the engine copy only matters at the next `postSessionState`. A coverage run puts `AgentRunEngine.ts` L626–630 at zero hits.

The sibling pattern is right there: the pure `contextBudgetView(snapshot, model)` in `@utils/contextBudget`, which `ContextBudget.tsx` consumes. What I'd want instead: one `visibleCacheWindow(snapshot, currentModelId)` beside it, a single owner for the check (the webview has the freshest identity), and one test that swaps the model and asserts the clock disappears.

### 🟡 Standard: The vendor-named TTL bypasses the `ToolOptions` → `AgentRunOptions` path [🎯 · F-13]

`AgentRunEngine.ts:722`. `temperature` and `maxTokens` reach the engine through `ToolOptionsProvider.getOptions()` → `AgentRunOptions` (`AssistantToolService` L429/578/643/699). `claudeCacheTtl` doesn't: the orchestrator reads a settings-key literal itself on every inference. The repo's precedent is mixed (`debugLogging` and `applyContextWindowTrimming` are read directly), so this is a convention call, not a violation. Separately, `reasoning: OpenRouterReasoningOptions` shows how a seam option can stay vendor-neutral while the adapter translates it. A neutral `cacheTtl` on the seam would leave "Claude" only in the label and the policy. Renames are free in alpha.

### 🟢 Praise: Provider wire formats stay behind the adapter, and the registry earns its keep [🎯 · F-22]

`OpenRouterPromptCachePolicy.ts:127`. Outside tests, `cache_control`, `session_id`, `OpenRouterWireMessage` and `OpenRouterTextContentBlock` appear only in `OpenRouterChatContracts.ts` and `OpenRouterPromptCachePolicy.ts`. Retained `OpenRouterMessage.content` stays a `string`. Three real strategies each own `prepare` / `ttlSeconds` / `confirmsActivity` behind one resolver, and splitting transcript types from wire types is what keeps the rewrite non-mutating. *(Nit: the resolver relies on `Object.values()` insertion order; see F-15.)*

> *"The bones are good — the wire format stays politely behind the adapter's door — but someone hung the same 'wrong model?' check on two different walls and forgot to ask whether either one is load-bearing."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

### 🟠 High: Doubled standing context plus the full-list update frame overruns the window, and the turn keeps failing [🎯 Consensus · F-01]

`packages/core/src/shared/constants/promptBudgets.ts:178`. Failure path:
1. A writer attaches about 100k words. It lands in the host's first envelope (`WorkshopRoomHandler.ts:1138`), roughly 130–150k tokens.
2. They add a 300-word note. `collectPendingHostUpdates()` (`WorkshopSessionService.ts:1050`) returns `this.getContextAttachments()`: the whole list, not the delta.
3. `buildWorkshopHostUpdateFrame` (`WorkshopPromptBuilder.ts:512`) appends it again. Nothing tombstones the superseded copy.
4. The next request carries both copies, about 260–300k tokens. A 200k-window model rejects it (the offline fallback assumes 200k, `OpenRouterModels.ts:1193`).
5. `commitPendingHostUpdates` only runs on success, so every retry resends the same frame. The session JSON also grows toward the 25 MiB write ceiling.

Not Blocking: the error is visible and trimming context recovers. The new 100k route test mocks `analyzeProse` and never sends an update frame. Fix: refuse or warn before dispatch when the estimated prompt exceeds `contextLength − output reserve`, or tombstone the superseded frame.

### 🟡 Standard: The Gesture Playground source guard still stops at 420k [F-04 · independently confirmed by the orchestrator]

`promptBudgets.ts:225`. `gestureReferencedSourceCharacters: 420_000` was introduced in the same commit (`bf4dd7b`) as the old `contextAttachments.characters: 420_000`, and the two matched. `resolveSourceMaterials` sends `attachment.content` in full, and `GesturePlaygroundService.ts:260-267` throws `Referenced source material exceeds 420000 characters`. The persona can recommend `context-attachment:ctx-N` "to read in full" (`GesturePlaygroundRecommendation.ts:87`). This repo's own craft-guide prose averages about 6.15 characters per word, so any single attachment over roughly 68k words trips the cap. A persona-recommended widget run on a legally attached long chapter now fails through no fault of the writer; before this PR, the 50k-word ceiling (about 310k characters) always fit. Fix: derive it (`contextAttachments.characters + personaExcerpt.characters`) and pin the relationship in `promptBudgets.test.ts`.

### 🟢 Praise: The transcript never sees the wire format, end to end [🎯 · F-22]

`OpenRouterPromptCachePolicy.ts:53`. `currentMessages()` builds a fresh array. The Alibaba path maps it to new objects, and every other path passes it through untouched. `fetchCompletion` only stringifies it, and history commits only plain-string `pendingMessages`. `recordObservation(undefined)` strips only the estimate and keeps `promptTokens`, so context telemetry doesn't regress. The frozen-array tests prove it.

> *"Caching plumbing's clean. Double the context, resend all of it on every edit, and I'll see you in the incident channel when the first 200k-window model starts saying 'prompt too long'."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟡 Standard: The countdown subtracts one machine's "now" from another machine's "later" [F-05]

`WorkshopCacheIndicator.tsx:34`. I traced the clock across the boundary. `OpenRouterClient.ts:538` mints `requestStartedAt + ttl * 1000` from the **extension host's** `Date.now()`. That absolute epoch rides `ContextBudgetSnapshot` into the webview, which subtracts **its own** `Date.now()`. The manifest has `main` and no `extensionKind`, so under Remote-SSH, WSL and dev containers the host runs remotely while the webview renders locally. Any skew shifts the label one-for-one. A remote clock 3 minutes ahead makes a fresh 5-minute window read "8 min"; one 5+ minutes behind reads "window elapsed" immediately. WSL2 clocks drift after laptop sleep. The tests use one fake clock for both sides, so they can't see this. Fix: compute `remainingMs` host-side when posting, anchor `receivedAt + remainingMs` on the webview clock, and add a skewed-clock test.

### 🟡 Standard: The response-model guard is brittle to dated Alibaba ids [F-09]

`OpenRouterClient.ts:533`. `getOpenRouterPromptCacheTtlSeconds(responseModel)` runs the response id through the request classifier, and for Alibaba that's an exact-id `Set`. I ran the real client against mocked responses: request `qwen/qwen-plus` with response model `qwen/qwen-plus-2025-07-28` (40 cached, 10 written) gives an `undefined` estimate. The same shape for Anthropic and OpenAI still estimates, because those match by prefix or regex. I can't tell from the repo whether OpenRouter echoes the slug or the dated permaslug; if it echoes the slug, this never fires. Fix: compare policy *identity*, not TTL equality, and add a dated-response test.

### 🔵 Nit: `attachProvider` stores the untrimmed model id [F-20]

`AgentRunEngine.ts:253`. `setModel()` trims; `attachProvider()` trims the client's copy and then assigns the raw `model` to `this.model`. A pasted `' anthropic/claude-sonnet-5 '` gives a trimmed `cacheRequestModelId` and an untrimmed engine model, so the gate at L627 hides the clock (reproduced). It fails closed. Fix: normalize once in `attachProvider`.

> *"Found the trap door, and it isn't the empty-list case at all, it's the other end of the SSH tunnel: the countdown subtracts one machine's 'now' from another machine's 'later.'"* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard: `native` is the wrong name for the catch-all, and the registry depends on property order [🎯 · F-15]

`OpenRouterPromptCachePolicy.ts:104`. The ADR calls GPT-5.6+ "native caching", yet `openaiAutomatic` is a separate policy. So `native` actually means "we know nothing about this model". It's also a `() => true` catch-all inside an ordered `Object.values().find()`. A policy added below it can never match, and the `?? PROMPT_CACHE_POLICIES.native` at L114 is dead. Simpler: pull it out as `UNMANAGED_POLICY`, keep only refusing policies in the registry, and use `find(...) ?? UNMANAGED_POLICY`. Related: the shared `prepare(messages, ttl: ClaudeCacheTtl)` makes three policies accept a Claude-only parameter just to ignore it.

### 🟡 Standard: Cache-window data travels as two always-paired optionals through a 7-parameter `toObservation` [🎯 · F-14]

`OpenRouterClient.ts:547`. `estimatedCacheExpiresAt` and `cacheRequestModelId` only mean something together, but the type allows one without the other. They're cleared by hand as a pair at `AgentRunEngine.ts:370` and `:628`, and spread conditionally in two more places. The call sites pass `requestedModel` to `estimateCacheExpiry(...)` and then again as `toObservation`'s seventh positional argument. One request resolves the policy up to four times. `hasOpenRouterKnownCacheActivity` also returns `false` on unknown models even when `cachedTokens > 0`, so it means "activity whose window we know". Simpler: a single `cacheWindow?: { expiresAt; requestModelId }`, one `policy.cacheWindowSeconds(usage, ttl)`, and the estimate logic moved into the policy module.

### 🟡 Standard: The webview copy of the mismatch rule is a three-line inline JSX ternary [🎯🎯 · F-03]

`WorkshopApp.tsx:1408`. `workshop.contextBudget?.snapshot?` is spelled out repeatedly inside a JSX prop, and it took me three reads to see it's a second filter on top of the host's. The two copies already differ: a truthy guard host-side, and `undefined === undefined` caught only by the ternary webview-side. Lift it into `cacheEstimateFor(snapshot, modelId)` above the `return`.

> *"It works, but I had to squint at it three times, and that squint is a tax every future reader pays forever."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟡 Standard: Both model-mismatch gates have zero tests [🎯🎯 Strong Consensus · F-03 · Cal rated High]

`AgentRunEngine.ts:627`. The PR promises to "hide … mismatched models". I searched the tests for `cacheRequestModelId`: it appears only as fixture data and expected output. `getConversationContextBudget` appears only as `jest.fn()` stubs, and `WorkshopApp.test.tsx` has no `contextBudget` or cache hit. The nearest engine test reads `conversations.getContextBudget(...)` straight from the `ConversationManager`, bypassing the wrapper it's supposed to cover. A refactor of either comparison passes CI. Fix: seed a Claude snapshot, `engine.setModel('qwen/qwen-plus')`, expect no estimate, plus the matching positive case. Do the same pair in `WorkshopApp.test.tsx`.

### 🟡 Standard: Compression suppression and the response-TTL guard are unreachable from tests [F-08]

`OpenRouterClient.ts:565` and `:533`. The 13-row evidence table is good. But the only `'applied'` compression test sends no `conversationId` on a native model, so it returns before the guard. Delete the guard and every test stays green. Every cache row also reuses the request model as the response `model`, so the TTL-mismatch branch never fires. Add two rows: Claude + conversationId + write + `context_compression` metadata → no estimate; requested Claude, served `openai/gpt-5.6-terra` → no estimate.

### 🟡 Standard: The `claudeCacheTtl` setting → wire chain is tested in halves, and the stub ignores its key [F-07]

`AgentRunEngine.test.ts:113`. `{ get: () => ttl }` returns the TTL for **any** `get(section, key)` call. A typo in `'claudeCacheTtl'` at `AgentRunEngine.ts:722` would pass, silently pinning every Claude run to `5m` while the Settings UI says 1h. The client test hand-writes the options, so nothing covers the engine-to-wire join. Fix: a key-aware stub, plus one test with a real `OpenRouterClient` on mocked `fetch` behind a real engine, asserting `body.cache_control.ttl === '1h'`.

### 🟢 Praise: These tests catch real breakage [F-24]

The hit / miss / unreported matrix exercises the `recordObservation(undefined)` clearing branch properly. The `Object.freeze` checks in the policy and client suites are real mutation tripwires, the 14 Alibaba ids and both exclusions are pinned, and the indicator suite drives fake timers through expiry and recipient switches.

> *"Fourteen Alibaba ids pinned, two exclusions pinned, and the only thing standing between a hot-swapped model and a ticking clock that lies is a comparison nobody tested."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard: The budget bump left the persona prompt's hand-synced ceiling behind [🎯 Consensus · F-02]

`packages/core/resources/system-prompts/workshop-personas/analysis-capability.md:25` still reads *"Persona-supplied context text may contain at most 50,000 words and 420,000 characters."* `WorkshopCapabilityXmlCodec.ts:348-352` now enforces 100k / 840k from the table. The persona self-limits to half of what the host accepts, with no error, just quiet capability loss. We already have an open note for exactly this: `.todo/tech-debt/2026-07-26-persona-prompt-validator-contract-drift.md` ("Edit the budget constant and the prompt keeps quoting the old figure"). It proposes a `personaPromptBudgetsSync.test.ts` modeled on `architecture/wordSearchDefaultsSync.test.ts`, which would have gone red here. *(The excerpt figures in the same sentence had already drifted before this PR.)*

### 🟡 Standard: The model-match rule is derived inline in JSX; the sibling uses a named predicate [🎯🎯 · F-03]

`WorkshopApp.tsx:1409`. Six lines below it, `writerProfileShared={isWorkshopWriterProfileActive(workshop.writerProfile)}` is a named pure predicate exported from `@messages`, with its own unit test. That's the pattern.

### 🔵 Nit: The setting follows the recipe, but its order and position drift [F-19]

`apps/vscode-extension/package.json:328`. `"order": 8.1` is the only fractional order in the manifest, and integer duplicates are already tolerated. The overlay renders the select *first* in General, ahead of the three siblings that do follow manifest order. `ConfigurationHandler.ts:225` hand-types `'5m' | '1h'` in a file that already imports `coerceClaudeCacheTtl`. `CATEGORY_RELEVANCE_OPTIONS` / `NGRAM_MODE_OPTIONS` in `messages/search.ts` show the one-readonly-list pattern. Credit where due: every ADR 2025-11-03 step was followed, and `coerceClaudeCacheTtl`'s placement has precedent (`coerceWebviewErrorText`, `isHttpUrl`). **[F-25]**

> *"We literally have an open tech-debt note that predicted this exact prompt-versus-budget drift, with a sibling sync test sitting right next door, and the PR strolled past both on its way to a clock icon."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟠 High: 100,000 words with no window guard, and one revision re-appends all of it [🎯 Consensus · F-01]

`promptBudgets.ts:178`. Standing context sits in the **first user message** (`AssistantToolService.buildWorkshopPersonaUserMessage`), not the system prompt. 100k words ≈ 130k tokens, plus the 25k-word excerpt ≈ 33k. `applyContextWindowTrimming` never trims attachments, and `contextLength` only feeds a retrospective meter, so an over-window first request never produces a reading. One revision re-emits the whole list: ≈ 260k tokens. Even when it fits, each revision is a 130k-token cache write (162k input-equivalents at 1.25×, 260k at 2×), and both copies are re-read on every warm turn. On uncached routes it's about 130k at 1× per request, and a host turn can make up to 7 requests. Fix: cap attach at `min(budget, live context_length − maxOutput − excerpt − headroom)` or warn, and send revisions as deltas.

### 🟡 Standard: Cache economics are half disclosed, and there's no off switch [F-12]

`SettingsOverlay.tsx:202`. With prefix P = 130k and a 3k per-turn increment, in input-token-equivalents (multipliers from the PR's own copy):

| Mode | Warm turn | Cold turn | vs. no caching (133k) |
| --- | --- | --- | --- |
| 5m | 16.8k | 166k | cold is **+25%** |
| 1h | 19k | 266k | cold is **+100%** |

Break-even needs ≥22% of turns warm on 5m, or ≥54% on 1h. Against 5m, 1h wins from the second turn if pauses fall between 5 and 60 minutes. A writer who reads a long critique and edits before replying often sits right in that band. Cold writes the UI never mentions: changing interaction mode, expression, depth, writer profile or standing directives swaps `messages[0]` for the host and **every guest**; fresh guests and single-request tool runs pay a write with no read; Alibaba is fixed at 5m with no setting. The manifest enum is only `["5m","1h"]`, so caching is now unconditional for retained Claude. What holds up: rounds within a turn are net positive and stay inside the 20-block lookback. Fix: one break-even sentence in the description, plus an `off` value (can be deferred).

### 🔵 Nit: The 1-second tick is fine [F-21]

`WorkshopCacheIndicator.tsx:20`. Only the indicator span re-renders, and the interval clears at expiry. The hash, map and 4-entry lookup are noise next to stringifying a 600–800 KB body. A minute-boundary `setTimeout` would cut renders 60×. Not worth a ticket.

> *"Cache breaks even at a 22% hit rate, a 200k window breaks at one edited attachment, and the Settings tooltip mentions neither."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟢 Praise: The hashed `session_id` is built from an unguessable, short-lived runtime id [F-23]

`OpenRouterPromptCachePolicy.ts:141`. Ids are minted as `${toolName}-${nextId++}-${Date.now()}-${randomUUID()}` (`ConversationManager.ts:541`). The 122-bit UUID makes the preimage unguessable, so a salt would add nothing. `importConversations` mints fresh ids on every restore, so the provider never sees a long-lived tracking key. The id isn't in session JSON or any webview message, and the test pins "no tool name, ≤ 256 chars". The residual linkage within one room is by design, and OpenRouter already has the content.

### 🔵 Nit: A money-affecting setting inherits workspace scope [F-17]

`apps/vscode-extension/package.json:322`. The webview path is strict. `handleUpdateSetting` rejects anything but `5m` or `1h` *before* marking the echo or persisting, which is stricter than `temperature` and `maxTokens` **[F-25]**. But with no `scope`, a cloned manuscript repo's `.vscode/settings.json` can set `1h`, and `VsCodeSettingsStore.update` only writes Global, so the dropdown can't override it. Worst case is 60% more on cache writes. `assistantModel` and `maxTokens` share this exposure, so it's consistent rather than a regression. Fix: `"scope": "application"`, which is the precedent `proseMinion.workshop.writerProfile` already sets.

### 🔵 Nit: The scaled 840k character guard doesn't bound intake [F-18]

`WorkshopContextHandler.ts:189`. `WORKSHOP_ADD_CONTEXT_TEXT` counts words only. The character limit applies solely to persona-*supplied* `analysis.run` text (`WorkshopAnalysisInputs.ts:188-190`), so inherited context is never character-checked. The PR's own fixture, `'reference '.repeat(99_999) + 'final-marker'`, is 1,000,002 characters and passes. This predates the PR. Fix: reject at intake above `contextAttachments.characters`, and use a fixture under the ratio.

> *"The hash is clean and the setting is strict, and the only thing left to be paranoid about is a paste box with no ruler."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard: Cache decisions and suppressed estimates leave no trail [F-06]

`OpenRouterClient.ts:165` and `:533`. The new policy module has no logging, though the client already holds a `LogSink`. Picture acceptance day: the badge says "0 cached". Four causes look identical from there: the policy never matched, the provider ignored the hint, the route went elsewhere, or the prefix changed. The estimate also vanishes silently for six reasons (no conversation id, unconfirmed activity including Alibaba's read-without-write, unknown TTL, TTL mismatch, compression, missing final observation), plus two model gates. We've already lived this: the Terra memory-bank entry records a big cached badge with no timer, found by eyeball. Recommended signal, one line per retained request with no manuscript text: `cache policy=alibabaExplicit requested=… served=… ttl=300s session=prose-minion:ab12cd34 read=N write=M estimate=no(read-without-write)`. At minimum, log when usage shows cache activity but the code declined to show a timer.

### 🟡 Standard: The acceptance runbook can't be run by the next engineer [F-16]

`docs/adr/2026-10-03-provider-conversation-prompt-caching.md:80`. "Inspect cache writes on the cold response and cache reads on the follow-up" doesn't say where (the turn badge shows reads; writes are only in its tooltip). "Substantial" has no token floor, and nothing checks that `ttl: '1h'` is actually honored. The indicator trusts the *requested* TTL, so a route that drops it would show about 60 minutes against a real 5. The feature README and four memory-bank entries cite `/private/tmp/...` logs that live on one laptop. Fix: a numbered runbook with a prompt-size floor, badge locations, the expected cold-write/warm-read pattern, a 1h check, and the log line above as the pass/fail source.

> *"Six reasons to hide the timer, zero lines in the Output channel, and live acceptance still pending: fails silently, see you in the incident retro."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard: The persona is still told 50,000; the validator says 100,000 [🎯 Consensus · F-02]

`analysis-capability.md:25`. The ticket promises "retaining shared UI/backend limits". The UI meters, host intake and persona validator all read `PROMPT_BUDGETS`; the one hardcoded copy is the one the model reads. Before this PR it matched exactly, so the drift is new. Also stale: `docs/architecture/2026-08-13-workshop-prompt-assembly/03-excerpt-and-context-lifecycle.md:135` (50,000 / 420,000), `:138` ("3 items per message"), and its "~75k words" cost paragraph. The UI copy itself is clean.

### 🟡 Standard: "Rewind preserves its id": the code disagrees [F-10]

`docs/adr/2026-10-03-provider-conversation-prompt-caching.md:63`. `rewindTo` → `exportLiveRoom` → `rewindWorkshopSession` → `installRoom` → `importConversations` → `createConversationId` (`randomUUID()`). So `session_id` changes on every rewind, and rewind is the writer's "retry that turn" gesture, usually inside the cache window. The clock clearing after rewind is correct per the *other* ADR, so the two ADRs disagree with each other. Was stable affinity across rewind intended? If yes, derive the key from a stable participant key plus a room-lifetime nonce. If no, fix the sentence and pin "rewind mints a new routing key".

### 🟡 Standard: Seven attachments quietly means 70,000 words per message [F-11]

`promptBudgets.ts:217`. `words: 10_000` is a per-artifact head slice, and `addMessageAttachment` checks only the count. So the per-message ceiling went from 30k to 70k words (about 93k tokens), and those words land in an append-only user entry that rides every later request. The worst-case first send is now ≈ 195k words. The ticket, both ADRs and the tests describe only the count. If the doubling is intended, write it down. If not, cap the aggregate.

> *"The ticket said seven, the UI says seven, the validator says a hundred thousand, and somewhere a persona is still being told fifty thousand: technically correct is a very roomy neighborhood."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — Equal by Derivation, Not by Coincidence

Illuminated by: F-02, F-04, F-10 (Stan, Bria, Blake, orchestrator)

The old 50,000-word ceiling was never really one number. It was one fact repeated in a validator, a persona prompt, the architecture docs, and a Gesture cap that matched it only because someone once copied the value across. When the source moved, those copies stayed put, like a character whose eye color changes in chapter three but not in chapter twelve. Prose that quotes a number (prompts, ADRs, runbooks) depends on it just as much as code that imports it. When one value is meant to follow another, put that relationship in code: derive it, or pin it with a sync test, so the series bible keeps itself.

→ Carry forward: Before you change any limit, search for the old value in every spelling (`50,000` / `50000` / `420_000` / "3 items") and sort each hit into two piles: *follows this value* or *just happens to match it today*. Derive the first pile from one constant, and add a test for any prose that quotes it.

### Lesson 2 — Doubling the Recipe Doesn't Double the Oven

Illuminated by: F-01, F-11, F-12, F-18 (Blake, Tim, Bria)

Raising standing context to 100k words and attachments to 7 changed the size of what goes in. Nothing downstream grew to match: not the model's window, not the append-only history that resends the full list on every edit, not the retry that resends the oversize prompt, and not the invoice. Changes that ride along with a headline feature borrow its validation without getting their own threat model, and that is how a 30k per-message ceiling became 70k without anyone deciding it should. An optimization whose cold turns cost more deserves its break-even point and its off switch written down next to its upside.

→ Carry forward: For every raised limit or new optimization, take the largest legal input and walk it through the unhappy path: the edit, the failure, the retry, the cold turn. Give every ride-along its own heading in the PR description.

### Lesson 3 — Name the Missing Noun

Illuminated by: F-03, F-13, F-14, F-15 (Marcus, Cal, Stan, Parker)

A rule written twice against two different ideas of "current model". An expiry and a model id cleared together by hand. A seven-parameter `toObservation`. A policy resolved four times per request. In each case the code is circling a concept that has no name yet, like orchestra sections that each tune to their own A. You already do this well at the adapter boundary, where `cache_control` and `session_id` never leak out. Bring that discipline inward: one `CacheWindowEstimate` value, a policy decided once and passed along as a decision, a fallback named for what it means, and vendor-specific settings translated at the edge like every other wire detail.

→ Carry forward: The second time you write the same check, or clear the same pair of fields, stop and ask *"What noun are these lines describing?"* Then give it a type and exactly one owner.

### Lesson 4 — An Estimate Must Show Its Work

Illuminated by: F-05, F-06, F-09, F-16 (Sam, Oliver)

The composer clock is dead reckoning: it works out a position from known speed, heading and elapsed time, and it is only as trustworthy as the ship's log and its single chronometer. Each time it silently hides the timer, it makes a decision nobody can see afterward. That is why "0 cached" has four possible causes and the Terra incident was found by eye. A countdown built from one machine's timestamp and another machine's clock absorbs any skew between them, one second for one second. Evidence kept in one laptop's `/private/tmp` is a log only its author can read.

→ Carry forward: For every branch that quietly declines to show something, ask *"From the logs alone, could I tell which 'no' this was?"* When a time crosses a process or machine boundary, send a duration rather than a clock time.

### Lesson 5 — Test the Hinge, Not Just the Doors

Illuminated by: F-07, F-08, F-03 (Cal, with Parker and Marcus)

The chain from the 1h setting to the wire was tested in two well-built halves, but the stub between them returned the TTL for any key it was asked. A scene partner who answers every cue will never tell you that you skipped a page. A guard no test can reach, or a visibility rule with zero coverage hits, is a promise nobody has checked. The `Object.freeze` tripwires and the evidence matrix show these tests can catch real breakage; the gap is at the seams, where pieces that each work on their own meet.

→ Carry forward: Make stubs strict, so they throw on any key they weren't told to expect. For every guard you add, write the test that makes it say "no" before you rely on it.

> *"Most of craft is remembering where else you said it, and leaving a trail so tomorrow's reader can find it too."* — Sensei

---

## The Closer

### 🔮 Fortune cookie

*You will save a fortune on everything you send twice, right up until you send everything twice.*

---

## Summary

**Nearly there.** The caching half of this PR is well built. Wire formats stay behind the adapter, history is provably never mutated, the routing key is opaque and short-lived, and the PR's validation claims reproduce exactly. Before merge, fix the budget doubling that rode along: either add a model-window guard (or delta revisions) for F-01, or keep 50k until one exists. Fix the persona prompt (F-02) and the Gesture cap (F-04) in the same pass. The clock's remaining work (one named cache-window value with tested visibility, a relative duration across the host boundary, and a one-line log of each cache decision) is small, and it's what will make live acceptance readable.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
