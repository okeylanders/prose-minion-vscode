# MR Review — Sprint 06A: Agent-run engine consolidation and XML capability transport

**Author:** okeylanders · PR #71

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Context source document embedded unbounded, bypassing the 50k-word cap its sibling evidence paths enforce; this PR triples the worst-case resend multiplier | Marcus, Cal, Bria, Blake, Tim | 🎯🎯 Strong | **Addressed** — `boundSourceContent()` trims to `MAX_SOURCE_WORDS = 50_000` behind `applyContextWindowTrimming` (`ContextAssistantService.ts`); new service test asserts the clamp |
| 2 | 🟠 High | Protocol-shaped final prose (a quoted `<prose-minion-tool-call>`) is treated as a tool call → real analysis discarded / content-swapped | Sam, Patricia, Parker | 🎯 | **Addressed** — structural anchors: backtick-preceded markers are mentions (`findExecutableMarkerIndex`), markers deeper than 500 chars are prose; stream guard flushes withheld content on a 'none' verdict; `stripExactRequest` renamed `hideIfProtocolShaped`. Remainder: an *unquoted, unfenced* bare tag mention within the first 500 chars still burns the correction turn (recovers, but costs a call) |
| 3 | 🟠 High | Narrated-intent stream guard silently defeats progressive streaming for answers opening "Let me check…" | Sam | — | **Addressed** — hold window cut 1,000 → 300 chars (`NARRATION_HOLD_CHARS`); progressive-streaming false-trigger test added. Remainder: narrated-sounding answers under 300 chars still buffer to stream end |
| 4 | 🟡 Standard | `ensureInitialized()` caches a rejected promise forever; new fire-and-forget `void` startup call has no `.catch` | Cal, Oliver, Blake | 🎯 | **Addressed** — `startRebuild()` clears the cached promise on rejection (retry test added); all three fire-and-forget sites now `.catch` and log |
| 5 | 🟡 Standard | `GuideCapability` is a shared singleton with last-write-wins mutable allowlist (vs. per-call `ContextFileCapability`); also bypasses the `AIResourceManager` factory | Patricia, Stan | 🎯 | **Addressed** — assistants take an `AgentCapabilityFactory` and mint a fresh capability per run; `createContextFileCapability()` added so both capabilities construct through the manager |
| 6 | 🟡 Standard | A guide that fails to load vanishes from the model's evidence (dev-log only) | Oliver | — | **Addressed** — load failures join the unavailable list in `buildEvidence`, so the model (and briefing) sees the gap; test added |
| 7 | 🟡 Standard | Context source-read failure is downstream-indistinguishable from "no source configured" | Oliver | — | **Addressed** — `sourceUnavailableReason` renders a "could not be read (reason)" Source Document section instructing the model to note the gap; test added |
| 8 | 🟡 Standard | Full rejected-response log dump (may contain manuscript text) is always-on, not opt-in as the PR's own note claims | Patricia | — | **Addressed** — new `proseMinion.debugLogging` setting (default off) gates the dump; the one-line reason code still always logs, plus a pointer to the setting; on/off tests added |
| 9 | 🟡 Standard | WTA gained a ~50-line "Diversity & Creative Sampling" section but the sprint's required A/B comparison task is still unchecked | Bria | — | **Deferred** — needs live A/B runs; tracked in `.todo/tech-debt/2026-07-11-wta-diversity-ab-validation.md` |
| 10 | 🟡 Standard | `finish_reason:'length'` truncation-notice behavior survived the refactor; its regression test did not get re-homed | Cal | — | **Addressed** — truncation-notice regression test re-homed in `AgentRunEngine.test.ts` |
| 11 | 🟡 Standard | The same 4-statement turn-bookkeeping sequence is copy-pasted 3× in `runInitial` | Parker | — | **Addressed** — extracted `runInstructedTurn()`; correction, capability rounds, and both forced-final turns all route through it |
| 12 | 🟡 Standard | Two unrelated "is this becoming XML" mechanisms coexist in `executeTurn` with nothing linking them | Parker | — | **Addressed** — comment explains the capability-less path only smooths the stream (eventual full reveal) while the guard gates protocol content (never revealed) |
| 13 | 🟡 Standard | `saxes` declared in root `package.json` instead of `packages/core/package.json` | Stan | — | **Addressed** — moved to `packages/core/package.json`; lockfile refreshed |
| 14 | 🟡 Standard | `continueConversation` capability gap is already live in Workshop follow-ups today, not just a future limitation | Marcus | — | **Deferred** — ADR-owned, locked for Sprint 07 |
| 15 | 🟢 Nit | `PromptedPassageAssistant.ts` is the only PascalCase filename in `tools/assist/` | Stan | — | **Addressed** — renamed `promptedPassageAssistant.ts`; imports updated |
| 16 | 🟢 Nit | `GuideCapability` double-calls `listAvailableGuides()` per round (harmless via 60s cache) | Tim | — | **Deferred** — cache-dependent, note before touching TTL |
| 17 | 🟢 Praise | Real decomposition: 1178-line god-orchestrator → 530-line engine + focused satellites, each with one reason to change | Marcus | — | N/A |
| 18 | 🟢 Praise | Streaming visibility guard is O(n) amortized, not the classic O(n²) footgun | Tim | — | N/A |
| 19 | 🟢 Praise | Retired `<guide-request>` prompt workflow correctly replaced by run-time capability injection | Bria | — | N/A |

---

## Blast Radius

- 51 files changed · +3,527 / −3,419 lines
- New source: `AgentRunEngine`, `ResourceReadXmlCodec`, `ResourceRequestGate`, `GuideCapability`, `ContextFileCapability`, `AgentRunPolicies`, `AgentRunContracts`, `PromptedPassageAssistant` · Migrations: none · New services: 1 engine + 3 capability/gate classes + 1 passage runner
- Deletes `AIResourceOrchestrator.ts` (1,178 lines) and two legacy regex parsers. New **prod** dependency `saxes@^6.0.0` (moved from devDependency).
- Adapted review: this is a GitHub PR reviewed via `gh` (the skill's `glab` path was swapped for `gh`).

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B |
| 🛡️ Security | B |
| 🧪 Tests | B− |
| 📖 Quality | B− |
| ⚡ Performance | B− |
| 🎯 Domain | C+ |

---

## Executive Briefing

🟠 **[Marcus · Cal · Bria · Blake · Tim — 🎯🎯 Strong Consensus]** Unbounded source document — the Context flow reads the full source file and embeds it verbatim with no cap while every sibling evidence path trims to 50k words; the sprint checklist item forbidding exactly this was checked `[x]` but never enforced, and this PR triples the resend multiplier (up to ~9 turns rebilling the full doc), turning a dormant gap into a context-window-overflow / token-cost risk.

🟠 **[Sam · Patricia · Parker — 🎯 Consensus]** Protocol-shaped final prose gets executed — a genuine answer that merely quotes `<prose-minion-tool-call>` is classified as a request; the engine discards the model's real analysis and swaps in an unrelated correction turn (reproduced) or enters a fulfillment round. No test covers a legitimate answer that quotes the tag.

🟠 **[Sam]** The narrated-intent stream guard (`isNarratedResourceIntent`, unanchored) silently defeats progressive streaming — the PR's own headline feature — for any answer opening "Let me check the pacing…" until 1,000 chars pass. Reproduced; no data loss, but the feature stops working for plausible inputs.

🟡 **[Cal · Oliver · Blake — 🎯 Consensus]** `ensureInitialized()` caches a rejected promise that never self-heals, and the new fire-and-forget `void ensureInitialized()` startup call has no `.catch`. Blake's trace confirms it's not reachable today (the one awaitable that could reject swallows its errors) — cheap hardening, but three lenses snagged on the same seam.

---

## 🏛️ Marcus · Software Architect

"The Cartographer of Layer Boundaries"

### 🟠 High — The one new resource-discipline boundary has an unguarded third door [🎯🎯 Strong Consensus]

`ContextAssistantService.ts:150-152` → `contextAssistant.ts:125-129`. This PR's whole thesis is that resource evidence now flows through one governed seam — `ResourceRequestGate` behind the two capabilities, each hard-capped at 50k words. But `sourceContent` never enters that seam: it's read straight off disk and spliced into `buildUserMessage` with zero trimming, no capability, no policy. The capability boundary governs two of three injection points into the prompt, not three. The ADR's own text admits the risk without the code closing it — consolidation was the natural moment to fold this into the same bounded-evidence discipline.

### 🟡 Standard — `continueConversation` asymmetry is a sound seam, but it's already load-bearing today

`AgentRunEngine.ts:266-270`. Naming the asymmetry in the ADR and locking a Sprint 07 shape (per-turn capability budget, `maxCapabilityRounds: 0` subsuming history-only mode) beats a half-built third mode — good instinct. The nuance for reviewers: `WorkshopHandler` routes *every* host and tool-sidecar follow-up through `continueConversation` today, so a persona mid-conversation cannot request a craft guide right now. The boundary is live in production Workshop chat, and nothing in the UI signals to the writer that follow-up turns lost resource access relative to the opening turn. Confirm that's the intended UX for this ship.

### 🟢 Praise — 1,178 lines → ~530 + six focused satellites is real decomposition, not relabeling

The deleted `AIResourceOrchestrator` interleaved guide/context/plain/retained flows in one file. What replaced it isn't one bigger file wearing a new name: turn mechanics in `AgentRunEngine`, catalog/fulfillment/provenance in two capabilities, allow-list arithmetic in `ResourceRequestGate`, wire format in `ResourceReadXmlCodec`, caller-to-policy matrix as data in `AgentRunPolicies`. `ToolCallStreamVisibilityGuard` is correctly private and un-exported — moving it out would be indirection with no coupling reduction. The rare case where "big-ish file" and "cohesive class" aren't in tension.

> *"The old orchestrator was a junk drawer that also happened to route mail; this one has a drawer for guides, a drawer for context, and a locked box for retained conversations — I'd just check that the source document didn't wander in through the cat flap."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

Traced all four prime suspects. **Cleared as blockers:** the init-poison path (`secretsService.getApiKey()` catches internally and cannot reject; `createResourceBundle` catches its own errors — no reachable throw before `initialized = true`); the retained-conversation cancel cleanup (`deleteConversation` is an unconditional idempotent `Map.delete`, ignores `pinned` — no leak, no double-free); the bounded-round / correction / forced-final state machine (usage accumulated on every turn including inside `recoverInvalidRequest`; loop bounded; no infinite loop, no dropped usage). One real finding remained.

### 🟠 High — Context source document embedded unbounded [🎯🎯 Strong Consensus]

`contextAssistant.ts:128`. `ContextAssistantService` reads the whole file with no cap and hands it to `buildUserMessage`, which drops it verbatim into the user message — no `trimToWordLimit`, no `MAX_CONTEXT_WORDS`, no `applyContextWindowTrimming` gate. `ContextFileCapability.buildEvidence` trims *requested* resources to 50k words; the source document is a second, completely untrimmed channel into the same prompt. For a full-chapter source this either blows the context window (surfaces as a caught "Error generating context" — degraded, not a crash) or silently multiplies token cost. Sprint task #4 required "a bounded, tested contract"; it's checked `[x]` but the bound was never added. The only coverage is a 2-line fixture asserting the doc *is* included — nothing asserts a cap.

### 🟡 Standard — `ensureInitialized` caches a rejected promise forever [🎯 Consensus]

`AIResourceManager.ts:94`. If `rebuildResources()` ever rejects before `initialized = true`, `this.initialization` retains the rejected promise and every later `await` re-awaits it — nothing self-heals until a settings change or reload. Not currently reachable (the only awaitable that could reject swallows errors), so not a blocker. But this PR adds `void aiResourceManager.ensureInitialized()` at the composition root, a fire-and-forget path whose rejection is unobserved, making the never-reset cache the startup contract. Cheap hardening: reset `this.initialization = undefined` in a `catch` so the next call retries.

> *"The context call quietly staples an entire chapter to every request — it'll ship fine on a paragraph and page us the week someone points it at their 90k-word manuscript."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — A final answer that merely quotes the tag name gets discarded, not delivered [🎯 Consensus]

`ResourceReadXmlCodec.ts:96-98`. The marker regex fires on ANY occurrence of `<prose-minion-tool-call` anywhere in the response. **Reproduced directly:** a genuine answer like `` The protocol expects `<prose-minion-tool-call name="resource.read">`, but none was needed, so here is my analysis: the dialogue tags… `` classifies as `{kind:'invalid', reason:'malformed-xml'}` — same bucket as a broken request. Traced the consequence through `runInitial`: that sets `invalidRequest` → `recoverInvalidRequest` appends the model's real analysis to history and throws it away, sends a "resubmit your request" correction, and shows the user the *second*, unrelated turn. In my repro `result.content` was `'Second-turn reply after correction prompt.'` — a full silent content swap plus a burned API call. Every existing mixed-content test uses a *complete* well-formed element in prose; none tests a bare quote of the tag name.

### 🟠 High — Narrated-intent guard silently defeats streaming for ordinary short answers

`AgentRunEngine.ts:75`. `isNarratedResourceIntent` matches `let me\s+(?:…|check|review)\b` with no `$` anchor, so once the *opening* matches, `.test()` stays true for the whole pending buffer. **Reproduced end-to-end:** a 176-char genuine answer streamed in two chunks (`'Let me check the pacing in this scene before giving feedback: '` + the analysis) fired `onToken` exactly **once**, at stream end, with everything glued together — nothing streamed progressively. Content isn't lost, but every response opening with "Let me check/review/consult…" or "I need/want/will… access/load/read…" silently reverts to non-streaming until the 1,000-char flush. No test covers a narrated-sounding opener that never emits a tool call.

> *"Quote the tag name back at us mid-answer and watch your actual analysis get swapped out for a stranger's reply. That's not a trapdoor, that's a trapdoor with a doppelgänger waiting at the bottom."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟠 High — `stripExactRequest` doesn't strip anything — it's a binary kill switch wearing a scalpel's name [🎯 Consensus]

`ResourceReadXmlCodec.ts:231`. The name says "strip the exact request" — surgical removal. The behavior is "if this is protocol-shaped at all (valid `request` OR malformed `invalid`), discard the entire response and return `''`." That's an all-or-nothing gate, and the two swallowed kinds are meaningfully different: a genuine tool call (fine to hide) vs. a garbled or mid-prose-quoted fragment (where the *entire* final answer gets wiped — the behavioral half of Sam's finding). Callers of `capability.stripToolCalls(content)` reasonably expect a redacted substring, not an empty string standing in for a whole response. Rename to `hideIfToolCallShaped` / `blankIfProtocolMarkup`, and have the doc comment say what happens to *inexecutable* protocol-shaped content too.

### 🟡 Standard — The same four-statement turn-bookkeeping sequence is copy-pasted three times in `runInitial`

`AgentRunEngine.ts:219`. Lines 219-226 are a token-for-token duplicate of 209-216; `recoverInvalidRequest` (146-170) is a third variation of the identical shape. If the turn-bookkeeping logic (append assistant turn → append instruction → executeTurn → accumulate usage) ever changes, someone has to remember three places. Pull it into one `runInstructedTurn(...)` helper, then call it from the round loop, the forced-final block (as an actual 2-iteration loop instead of hand-unrolled), and `recoverInvalidRequest` — which also shrinks `runInitial` enough that its four beats read as distinct instead of accidentally identical.

### 🟡 Standard — Two unrelated implementations of "is this becoming XML" sit in the same method

`AgentRunEngine.ts:393`. With a capability, streaming visibility is delegated to the well-named `ToolCallStreamVisibilityGuard`. Without one, `executeTurn` reaches for an ad hoc `'undecided'|'text'|'candidate'` local doing a conceptually similar job — with none of the guard's narration detection and, notably, a divergent ending (eventual full reveal vs. permanent block). A reader has to reverse-engineer that these aren't the same path and that the divergence is intentional. Give the no-capability path a small sibling class, or add one sentence explaining why a capability-less turn only smooths the *stream* rather than gating the *content*.

> *"`stripExactRequest` doesn't strip, it detonates — and three copies of the same four-line ritual are hiding in plain sight, waiting for the day someone edits one and not the other two."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟡 Standard — `ensureInitialized()` failure path is completely untested [🎯 Consensus]

`AIResourceManager.ts:94-99,114`. `rebuildResources()` calls `await this.secretsService.getApiKey()` with no try/catch; a rejection would leave `this.initialization` holding a dead promise that every later call re-awaits forever. `AIResourceManager.test.ts` is 22 lines, one happy-path test. Searched it for a rejected-`getApiKey`/failure/retry scenario — not found. *(Reconciled to Standard per Blake's trace: `getApiKey` swallows errors today, so the poison is latent, not live — but the coverage gap and the new un-`.catch`'d startup call are real.)*

### 🟡 Standard — Unbounded source-document embed — the fix the checklist claimed wasn't made [🎯🎯 Strong Consensus]

`contextAssistant.ts:125-129`. `sourceContent` is embedded verbatim with zero trimming, unlike the two capabilities that cap at 50k words. The one test that touches it (`contextAssistant.test.ts:20-32`) uses a 40-character fixture and asserts the content is *not* trimmed — locking in the unbounded behavior as intended rather than verifying the "bounded, tested contract" the checklist demanded. Searched for `truncat`/`trimToWordLimit`/`MAX_` — not found.

### 🟡 Standard — The truncation notice lost its dedicated coverage in the orchestrator → engine move

`AgentRunEngine.ts:445`. The deleted `AIResourceOrchestrator.test.ts` had two `'should append truncation note when finish_reason is length'` tests. Searched the new `__tests__` tree for `Response truncated` and `finishReason: 'length'` — not found anywhere. The behavior survived (`toVisibleContent`), but its regression test didn't get re-homed; a future refactor of `toVisibleContent` could silently drop it and users would just stop being told their response was cut off.

> *"I read the deleted file's `it()` names before I read the new ones on principle — `finish_reason: 'length'` walked out of that 1085-line file without a coat, and nobody's mentioned it since. I keep receipts."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — `saxes` declared as a root dependency, not a `packages/core` dependency

`package.json:51-52`. Every runtime package `packages/core/src` imports is declared in `packages/core/package.json` — `marked`, `p-limit`, `wink-pos-tagger` all follow that pattern, and `apps/vscode-extension` declares only `@prose-minion/core`. `saxes` is imported once (by `ResourceReadXmlCodec.ts`) yet landed at the root. Webpack bundles it fine today, but it's a real gap against ADR 2026-06-16's "a non-VS-Code host can reuse core": a host consuming `@prose-minion/core` directly wouldn't get `saxes` transitively. Move it to `packages/core/package.json`.

### 🟡 Standard — `ContextFileCapability` bypasses the `AIResourceManager` factory that `GuideCapability` uses

`ContextAssistantService.ts:144`. `AIResourceManager` exposes `createGuideCapability()` so callers don't hand-assemble a capability's deps, and `AssistantToolService` uses it. `ContextFileCapability` implements the same contract but is `new`'d directly, reaching past the manager for `settings`/`outputChannel` (which the manager already holds). A mirrored `createContextFileCapability(provider)` would cost little and mean both capability types are constructed the same way. *(Two sprints from now someone will ask "wait, why does Context work differently?")*

### 🟢 Nit — `PromptedPassageAssistant.ts` breaks the directory's lowerCamelCase filename convention

`tools/assist/` and the wider `tools/` tree name files lowerCamelCase even when the export is PascalCase: `dialogueMicrobeatAssistant.ts`, `proseAssistant.ts`, `contextAssistant.ts`, `writingToolsAssistant.ts`. `PromptedPassageAssistant.ts` is the sole outlier. Cosmetic — rename to `promptedPassageAssistant.ts` next time it's touched.

> *"Two capabilities, one factory method — I've seen this movie before, and it always ends with someone asking 'wait, why does Context work differently?' two sprints from now."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟠 High — The unbounded source document gets rebilled on every one of up to ~9 model calls in a single Context run [🎯🎯 Strong Consensus]

`contextAssistant.ts:125-129`. The missing cap is pre-existing, but this PR changes the *multiplier*. `ConversationManager.getMessages()` returns full unpruned history, and every `executeTurn` in `runInitial` resends it — the first user message with the raw source doc never leaves. For the `context` policy (`maxCapabilityRounds: 2`, `forceFinalResponse`), worst case is **up to 9 `executeTurn` calls**, each rebilling the full source. The deleted orchestrator capped at `MAX_TURNS = 3` — so this PR roughly **triples the worst-case resend multiplier** on an already-uncapped payload. Math: a 5,000-word chapter ≈ 6,650 tokens; at 9 resends that's ~60K tokens of pure duplicate source input from one click, stacking on the (correctly capped) evidence. A 15–20K-word chapter plus a smaller-context model can plausibly exceed the window on a later turn — an API-level failure, not just a slow one. Fix: cap `sourceContent` the same way (`trimToWordLimit`), or send it once and reference by id.

### 🟢 Praise — `ToolCallStreamVisibilityGuard.consume` is O(n) amortized, not O(n²)

`AgentRunEngine.ts:75-84`. I traced this because the shape (regex + `indexOf` on a growing buffer, every token) is the classic streaming-quadratic footgun. It isn't one: once the narration-hold window closes (capped at 1,000 chars), `pending` is sliced back to a ~23-char suffix on every subsequent call, so the checks run against a near-constant string for the rest of the stream. The only non-constant cost is the holding phase — a fixed ~500K char-comparisons worst case, sub-millisecond, paid at most once per turn. No action.

### 🟢 Nit — `GuideCapability` double-calls `listAvailableGuides()` per round

`GuideCapability.ts:28,42`. `appendCatalog` and `fulfill` each call it independently, the latter re-firing every round. Harmless only because `GuideRegistry` (singleton, constructed once) carries a 60s TTL cache and a run finishes well inside that window. Flagging so nobody drops the cache TTL or swaps `GuideRegistry` to non-singleton without noticing this call site now depends on it for its cost profile.

> *"The math checks out on the plumbing — it's the payload that's uncapped, and this PR just built a bigger pump to resend it through."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — Full rejected-response dump to the output channel is unconditional, not opt-in as characterized

`AgentRunEngine.ts:457-482`. `logCapabilityInspection()` is gated only on `capability`/`inspection` being present — no settings check (there's no `verbose`/`debugLogging` contribution point anywhere in the codebase). `outputChannel` is passed unconditionally to every engine, so every rejected/invalid resource request logs the model's complete raw response — including any user manuscript text it echoed — between BEGIN/END markers, with no way to turn it off. Threat model is local (not remote exfiltration), but VS Code output channels are routinely pasted wholesale into public GitHub issues during troubleshooting, and a manuscript excerpt is exactly what people don't expect to leak that way. The code comment ("it may contain quoted user text") shows the author knows. Gate it behind a new `proseMinion.debugLogging` flag. *(Note: the PR's memory-bank doc calls this "opt-in" — the code says otherwise.)*

### 🟡 Standard — Shared `GuideCapability`/gate — allowlist is last-write-wins, not request-scoped [🎯 Consensus]

`AssistantToolService.ts:135-157`. `ResourceRequestGate.allowedPaths` is a single mutable field replaced (not merged, no locking) on every `appendCatalog()`. One `guideCapability` instance is shared across dialogue/prose/writingTools and both webview hosts. Two concurrent runs (sidebar + Workshop, or back-to-back assists) can interleave `appendCatalog`→await→`fulfill` on the same instance, so Run A's `fulfill()` is checked against Run B's catalog snapshot. Masked today because every caller scans the same global `craft-guides/` directory — practical impact currently nil — but the boundary is architecturally decoupled from the single request it gates, with no concurrent-run test. `ContextFileCapability` is correctly per-call; align `GuideCapability` to that before any future work makes the guide catalog caller-scoped.

### 🟡 Standard — Tolerant preamble-slice can convert a quoted example into an executed request

`ResourceReadXmlCodec.ts:96-116`. The codec discards everything before the first tag marker and requires only that nothing follows the *last* closing tag. That correctly rejects mid-prose quotes with real content after them (`mixed-content`), but it doesn't distinguish "the model decided to call the tool" from "the genuine final answer happened to end with a verbatim quotation of the tool-call syntax." If nothing trails the final `</prose-minion-tool-call>`, the segment parses as a valid `resource.read` request and the engine discards the model's prose answer to enter a fulfillment round. Not a path-disclosure bypass (the allowlist re-validates every path — a quoted non-catalog path degrades to `path-not-allowlisted`), so the consequence is content loss / an extra round-trip. This is the same root as Sam's finding, from the "valid request" side.

> *"The allowlist is airtight against the model's requests — I just wish the state backing it were as disciplined as the check itself."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — Fire-and-forget `ensureInitialized()` has no `.catch` and can poison the singleton [🎯 Consensus]

`extension.ts:84` (also `AssistantToolService.ts:107`, `ContextAssistantService.ts:78`). Three call sites fire init without a `.catch`. `rebuildResources()` isn't wrapped in its own try/catch; today its throwable-looking calls happen to swallow their errors, but that's incidental hardening in callees, not a guarantee at this call site. If any future addition throws (or `disposeResources()`'s synchronous `engine.dispose()` loop does), the rejection becomes an unhandled promise rejection invisible to the extension's own `LogSink` — the one place a dev would look — and `initialization` stays permanently rejected until the user opens Settings and hits Save. Contrast `MessageHandler.refreshServiceConfiguration`, which try/catches each step, logs the failing step by name, and posts a status. The startup seam has none of that.

### 🟡 Standard — A guide that fails to load is logged for the dev but silently vanishes from the model's evidence

`GuideCapability.ts:52-64`. `unavailable` is computed purely from catalog membership — it never learns about a path that *was* allowed but whose `loadGuide(path)` threw. That failure is only `appendLine`'d and dropped: `buildEvidence` reports unavailable guides by catalog-rejection only, so a load-time I/O failure produces neither a "here it is" nor an "unavailable" mention in the text the model reads. The model proceeds believing it received everything it asked for; the writer has no signal one of N guides dropped out. The engine's `Delivered X/Y` log is developer-only and requires diffing against a separate `Accepted…` line to even notice.

### 🟡 Standard — Context source-read failure is dev-log-only; the model gets a half-clue, the user gets nothing

`ContextAssistantService.ts:148-158`. When `sourceFileUri` is set but `readFile` throws, `sourceContent` stays `undefined` — the same value as "no source configured" — and the only trace is an `appendLine`. Downstream, `buildUserMessage` renders `## Excerpt Source` (the URI) whenever the URI is truthy but only renders `## Source Document` when content exists, so the model gets a partial signal with zero indication of *why* (bad URI vs. permissions vs. deleted file). `ContextGenerationResult` has no error/warning field, so nothing reaches the webview either. A writer who expected the assistant to read their chapter gets a quietly thinner briefing with no way to know short of opening the Output channel.

> *"Three failure paths, three different ways to vanish before they reach a human — I found them all the same way I find everything: after the writer already noticed something was off and I went spelunking in the output channel hoping past-me left a light on."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — WTA gained a ~50-line "Diversity & Creative Sampling" section without the sprint's own required A/B comparison

`writing-tools-assistant/00-writing-tools-base.md:21-50`. Sprint task 3's "restore a deliberate shared section OR remove the stale references" is checked `[x]` — the section was restored. But the very next bullet — "Run representative manual A/B comparisons… record the chosen behavior and sample rationale" — is still unchecked `[ ]`. No test references "Diversity" for WTA; the ADR amendment records the transport changes but nothing about this prompt-content decision. The section is genuinely load-bearing (it changes instructions for every WTA focus) yet was committed under a "docs: define XML capability transport" message, with the doc's own validation step undone and the Status line not flagging it as open. Intentional deferral to a follow-up, or did it fall through when it landed inside the XML-transport commit?

### 🟡 Standard — Source document embedded verbatim with no bound, despite the doc demanding a "bounded, tested contract" [🎯🎯 Strong Consensus]

`contextAssistant.ts:125-130`. The decision made was "keep it in the semantic request," and it *is* tested — so it's not *silent*. But it is not *bounded*: `ContextAssistantService.ts:151` reads the entire file and passes it straight through with zero truncation, while its sibling capabilities enforce exactly this kind of cap (`MAX_GUIDE_WORDS`/`MAX_CONTEXT_WORDS = 50_000`). There is no `MAX_SOURCE_WORDS` anywhere. Was "bounded" deliberately interpreted as "the source counts toward the model's own window, no explicit trim needed," or is a word-limit guard still owed before this ships?

### 🟢 Praise — Dialogue/Prose "Guide Access Workflow" removal is intentional and correctly compensated

`dialog-microbeat-assistant/00-…md`. Verified this is *not* scope creep: the old static instructions taught the retired `<guide-request>` regex format, and `GuideCapability.appendCatalog()` now injects the equivalent `createResourceReadXmlInstruction` for every caller at run time — matching the locked decision that "a capability owns its complete protocol surface." No functional guide-access regression. Noting only because the sibling Diversity change landed in the same commit lineage without the same rigor.

> *"The catalog-duplication fix got its cap, the Diversity section got its comeback tour — but somewhere between the two, the 'bounded' and the 'A/B tested' promises quietly stayed backstage. Intentional, or did the checklist just blink?"* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Checkbox Is Not the Clamp

Illuminated by: the unbounded-source consensus (Marcus, Cal, Bria, Blake, Tim); Patricia's always-on log dump

A checklist item that names a property — *bounded*, *tested*, *opt-in* — is a promise, not a receipt. The doc said "decide with a bounded, tested contract," someone checked the box, and a test was then written that *locks in* the unbounded behavior it was meant to prevent. That's not dishonesty; it's how work drifts when the label and the code are edited by the same tired hand at different moments and nobody re-derives one from the other. And an old, un-enforced limit doesn't sit still while you refactor around it — this consolidation tripled the resend multiplier, so a dormant risk woke up amplified.

→ Carry forward: When you close a checklist item that names a property, don't accept the commit that *discusses* it — find the line that *enforces* it and put that line number in the PR description. "Show me the clamp" before "show me the conversation about the clamp."

### Lesson 2 — A Fire Alarm That Triggers on the Word "Fire"

Illuminated by: Sam (reproduced), Patricia, Parker

Tolerant parsing is only safe when the thing you're tolerant of can't also be legitimate content. Scanning a whole response for a tag name — rather than parsing a well-formed envelope at a known position — means a model *explaining* the protocol or *quoting* a user's excerpt gets treated as *invoking* it: its real answer discarded, replaced with something unrelated. It's a fire alarm that goes off when anyone in the building says the word "fire," including the safety officer giving the briefing. Parker's naming catch sharpens it: `stripExactRequest` is a binary kill switch wearing a scalpel's name — exactly the misnomer that hides a coarse mechanism from the next reader.

→ Carry forward: For any "does this text contain marker X" check, ask aloud: "could a genuine, on-topic answer contain this exact marker?" If yes, anchor structurally (position, delimiters, escaping) — and add a test where the legitimate answer *mentions* the protocol without invoking it.

### Lesson 3 — Triangulate the Shadow, Even Without the Object

Illuminated by: Cal, Oliver, Blake — on `ensureInitialized()`'s cached rejection

Blake traced the code and proved the failure isn't reachable today. A single-reviewer read stops there: not a bug, close it. But three reviewers, through three different lenses — test confidence, observability, correctness — all snagged on the same seam anyway. That convergence is itself evidence: not about whether the code fails *today*, but about its *shape* — a promise that never self-heals, now wired to a fire-and-forget call with no `.catch`, one refactor from becoming live. Three people finding the same shadow on the wall tells you something real is casting it, before you've found the object.

→ Carry forward: When multiple reviewers flag the same seam without cross-referencing, treat the convergence as a finding on its own merit — don't let one "not currently reachable" close it. And make it a standing rule: every fire-and-forget promise at a startup boundary gets an explicit `.catch` or a comment explaining why it's safe without one.

### Lesson 4 — Migrate the Proof, Not Just the Code

Illuminated by: Cal (the deleted orchestrator test's truncation regression); Sam (the narration guard defeating streaming)

A refactor's claim to "preserve behavior" is only as good as the test that would catch it *not* preserving behavior — and deleting the old file doesn't delete that obligation, it deletes the alarm along with the wiring. The truncation notice apparently still works; nobody can prove it, because its regression test didn't survive the move. The narration guard is the same failure from the other side: a new safeguard shipped without a test for its most plausible false-positive, so the PR's own headline feature silently stops working for natural-sounding answers. Nothing crashed in either case — which is exactly why nobody noticed.

→ Carry forward: Before deleting a file with tests in it, grep its test names against the new suite — "did this assertion move, or just vanish?" And for every new heuristic or guard, write the test that represents its most plausible false *trigger*, not just its intended target.

### Lesson 5 — Siblings Should Age the Same Way

Illuminated by: Stan, Patricia — `GuideCapability` (shared mutable singleton) beside `ContextFileCapability` (per-call)

Two classes implementing the same pattern side by side invite the assumption that they behave the same way — so when one is a global last-write-wins singleton and its sibling is properly request-scoped, the asymmetry reads as a coincidence of implementation, not a red flag. It's masked today only because every caller shares the same catalog; the moment two disagree, one silently sees the other's state. It's a landmine wearing the safe one's uniform — the next engineer is likelier to copy the wrong twin than to notice there are two.

→ Carry forward: When adding a class that mirrors a sibling's interface, explicitly diff their lifecycles — singleton, per-call, request-scoped — and state the reason for any asymmetry in the PR description. "Looks the same" is not "scoped the same."

> *"The bugs that survive review aren't usually the ones nobody saw — they're the ones three people saw, each assumed the others had it handled, and each moved on; write down what you noticed, even when you can't yet prove it matters."* — Sensei

---

## The Closer

### ⭐ Yelp Review — ★★★★☆ (4/5)

**"Great bones, but check your bill on the way out."** Came in for the tasting menu — one kitchen replacing three line cooks who kept reinventing the same sauce — and honestly the plating is beautiful: everything's on its own plate now, the wine pairing (SAX codec) is a real upgrade over the old regex jug, and the chef cleared four of my worried questions before I even asked. Docked a star because the "Context" special quietly ladles an *entire manuscript* onto the plate and charges you per bite, up to nine times, and when I asked to explain the daily specials out loud the waiter mistook my question for an order and took my dinner away. Would return — just ask them to hold the unbounded source document and anchor the parser, and this is a five-star kitchen.

---

## Summary

This is a strong, disciplined consolidation — a 1,178-line god-orchestrator genuinely decomposed into an engine plus focused, single-responsibility satellites, with real test scaffolding and adversarial verification that cleared several suspected blockers. **No blockers found.** But it's not quite merge-ready: three 🟠 High items cluster around two themes worth fixing first — (1) the **unbounded source document** (5-reviewer strong consensus, amplified by this PR's turn-multiplier), and (2) the **protocol-detection heuristics being too eager**, where a genuine answer that quotes or narrates near the tool-call syntax loses content or defeats streaming (both reproduced). Cap the source document like its siblings, anchor the codec's marker detection structurally (and add the false-trigger tests), harden the fire-and-forget init with a `.catch`, and this lands clean.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
