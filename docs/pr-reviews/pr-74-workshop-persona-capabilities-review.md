# MR Review — Add Workshop persona-callable capabilities

**Author:** okeylanders · PR #74 · `sprint/workshop-editor-tab-07-persona-capabilities` → `epic/workshop-editor-tab`

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | Forged `<workshop-capability-result>` survives excerpt neutralization | Patricia | — | **Open** |
| 2 | 🟠 High | Dictionary artifact silently discarded on stale run; log says success; guard untested | Oliver, Cal | 🎯 | **Open** |
| 3 | 🟠 High | `application/services/workshop/` subfolder half-move; test tree no longer mirrors source | Stan, Marcus | 🎯 | **Open** |
| 4 | 🟠 High | Streaming guard leaks rejected-request narration into visible chat | Sam | — | **Open** |
| 5 | 🟠 High | Literal `<prose-minion-tool-call` mention in a legitimate answer discards the whole answer | Sam | — | **Open** |
| 6 | 🟠 High | Correction/forced-final branches never tested through `continueConversation` | Cal | — | **Open** |
| 7 | 🟡 Standard | `recordArtifact` returns a turn — "artifact" now has three meanings in one feature | Parker | — | **Open** |
| 8 | 🟡 Standard | `WorkshopSessionService` grew +138 lines to 750 (God Component axis) | Parker | — | **Deferred** — split is a refactor, not a merge gate; track as tech-debt |
| 9 | 🟡 Standard | `requestLogSummary` copy-pasted verbatim into both sibling capabilities | Parker | — | **Open** |
| 10 | 🟡 Standard | Capability request type in `shared/types/` vs codec-colocated precedent | Stan | — | **Deferred** — defensible given `messages/workshop.ts` also consumes it; decide the convention once |
| 11 | 🟡 Standard | `instructions` exact-1,000-char accept boundary untested | Cal | — | **Open** |
| 12 | 🟡 Standard | Full-snapshot deep-clone re-render fires up to 4×/turn | Tim | — | **Deferred** — ≤~200ms worst case, dwarfed by LLM latency at current scale |
| 13 | 🟡 Standard | Cumulative evidence resend ≈9–10k extra tokens on heaviest turn | Tim | — | **Deferred** — bounded by the hard 3-call cap; revisit if budgets grow |
| 14 | 🟡 Standard | Rejected/malformed capability calls log without request or persona id | Oliver | — | **Open** |
| 15 | 🟡 Standard | Analysis artifacts render "Continuity · Continuity · requested by Jill" | Bria | — | **Open** |
| 16 | 🟢 Praise | Transactional per-turn commit + cancellation atomicity verified end-to-end | Blake | — | **N/A** |
| 17 | 🟢 Praise | Engine unification closes a real structural gap | Marcus | — | **N/A** |
| 18 | 🟢 Praise | Parallel dictionary fan-out preserved through the capability path | Tim | — | **N/A** |

---

## Blast Radius

- 47 files changed · +2,464 / −415 lines
- New production files: 4 (`WorkshopPersonaCapability`, `WorkshopCapabilityXmlCodec`, `WorkshopAnalysisSidePass`, `workshopCapabilities.ts`) plus 7 new test suites · Migrations: n/a · New application services wired at the composition root: 3
- Roughly half the diff is tests; PR reports 88 suites / 689 tests green
- Diff exceeds the 800-line focus threshold — reviewer context was concentrated on the highest-change files (engine, codec, capability orchestrator, session service)

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B |
| 🛡️ Security | F |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | B |
| 🎯 Domain | B |

The F is a single regex line away from an A−: one confirmed neutralization gap in an otherwise carefully-defended trust boundary.

---

## Executive Briefing

🔴 **[Patricia]** Forged `<workshop-capability-result>` survives excerpt neutralization — the new trust-envelope tag was never added to `RESERVED_PERSONA_FRAME` in `workshopPromptFrames.ts` (verified: the regex lists only the five pre-existing tags), so a pasted document containing a forged evidence block reaches the persona prompt unescaped and impersonates system-verified results. No test covers the tag.

🟠 **[Oliver + Cal, 🎯 Consensus]** When the active run goes stale mid-capability, the dictionary branch of `recordCapabilityArtifact` silently discards the artifact — no log (the analysis branch logs its refusal), while the outer capability log prints `outcome=success`. The mismatch guard has no direct test. Writer sees an empty thread; log says everything worked.

🟠 **[Stan + Marcus, 🎯 Consensus]** The new `application/services/workshop/` subfolder is a half-finished move — the four existing Workshop services (including `WorkshopSessionService`, which the new code depends on) stay flat one level up, and the new test files no longer mirror the source tree as CLAUDE.md requires.

🟠 **[Sam]** The shared streaming-visibility guard tolerates narration the Workshop codec forbids: preamble like "I want to look up that word first." streams live into the writer's chat, then the entire response is invalidated as `mixed-content` and corrected. No streaming-path test exists for the `workshopHost` policy.

🟠 **[Cal]** The correction-retry and forced-final branches of the unified turn loop are only exercised through `runInitial` — `continueConversation` never drives them, so a regression that re-diverges the two entry points would go uncaught.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — New Workshop capability files split from their siblings into a fresh subfolder [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:24` — `WorkshopSessionService` and `RunWorkshopToolSidePass` — the existing Workshop application services this PR extends — live flat in `application/services/`. The three new files go into a new `application/services/workshop/` subfolder while the service they depend on stays one level up. Both groups are Workshop-domain services injected into the same handler and constructed at the same composition root, so a reader now has two places to check. Grouping the capability cluster is a reasonable instinct — but if the intent is a durable `workshop/` module, the pre-existing files should move alongside it in a follow-up so the domain has one home, not two.

### 🟢 Praise — Engine unification closes a boundary it used to leave open

`packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:196` — Collapsing `runInitial` and the old `continueConversation` into one `executeConversationTurn` closes a real architectural gap rather than refactoring for its own sake: before this PR, retained continuations ran a bare `executeTurn` with no capability parameter at all, so a continuation could never process a capability round even if policy allowed one. Now both entry points share one bounded capability/correction loop and one atomic commit path (`pendingMessages` only reaches `ConversationManager.addMessages` on success), so cancellation/failure semantics can't drift between the two call paths the way they structurally could before.

> *"The bones are sound, and the engine unification actually closes a boundary it used to leave open — my one note is that the new `workshop/` subfolder is a half-finished move, not a wrong one; go back and bring its older siblings home."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

### 🟢 Praise — Transactional per-turn commit and cancellation atomicity hold

`packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:341` — The claim under review ("transactional retained-history commits on success only") checks out end-to-end. Intermediate tool-call/evidence turns accumulate only in the in-memory `pendingMessages` array; `ConversationManager` is untouched until the single `addMessages` at commit, gated on `!cancelled`. `getMessages` returns a defensive copy and `addMessages` appends `pendingMessages` (not the full recomputed message list), so no duplication on continuation and no partial write on cancel/throw. Verified the cancel-mid-fulfill and forced-final-budget paths in `AgentRunEngine.test.ts` and the preempt-race artifact refusal in `WorkshopPersonaCapability.test.ts`. Session-thread artifacts persisting across a later cancel is the documented "honest completed artifacts" design, not a leak. No blocking correctness, data-integrity, or exception path found.

> *"I went looking for the 3am page in the commit boundary and the cancellation race — this one actually closes the door behind itself. Ship it."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — Streaming guard leaks rejected-request narration into the visible chat

`packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:78` — `ToolCallStreamVisibilityGuard` is shared by every capability catalog, and its tolerance was built for `resource.read`, whose codec genuinely accepts a preamble before a trailing valid call. The Workshop codec rejects ANY preamble outright (`markerIndex !== 0` → `mixed-content`), and the persona prompt says a call must be the entire response. But the guard's narration regex only suppresses a narrow verb whitelist (`access|load|read|request|pull|consult|check|review`) — so "I want to *look up* that word first." streams live to the writer via `onToken` even though the whole response is about to be invalidated and corrected. The webview keeps that streamed buffer visible until the authoritative turn lands: the writer transiently sees text the protocol explicitly disallows and that never appears in the committed turn. No test in `AgentRunEngine.test.ts` exercises the streaming path against the `workshopHost` policy.

### 🟠 High — A literal mention of the protocol tag in a legitimate final answer discards the whole answer

`packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts:163` — `findExecutableMarkerIndex` only exempts a marker immediately preceded by a backtick. Any other literal `<prose-minion-tool-call` occurring anywhere in the response — e.g. the persona explaining the format in a blockquote, per the base prompt's own "offer prose in blockquotes rather than code fences" instruction — makes `inspect()` return `mixed-content` instead of `none`. That burns the single per-turn correction; if the model repeats the same phrasing (nothing was actually wrong with its answer), the engine substitutes the canned fallback and the genuine answer is discarded entirely. `stripToolCalls` compounds this by wiping the *entire* content on any marker hit rather than excising the fragment. No test constructs a legitimate final response containing a literal non-backtick marker. (Confidence: MEDIUM — requires the model to produce the literal tag in prose, which the prompt discourages but the same prompt's blockquote guidance makes plausible.)

> *"Found the trap door — it's not in the parser's XML strictness at all, it's in the streaming guard that was built to be forgiving right where the Workshop codec insists on being merciless."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — `recordArtifact` doesn't return an artifact

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:106` — `recordArtifact` returns `WorkshopTurn | undefined` — it commits a session turn, and the caller then reaches into that turn to hand-build the actual `CapabilityArtifact`. "Artifact" already has two other meanings in this feature (`WorkshopTurnArtifact`, the turn-kind discriminant; `CapabilityArtifact`, the engine contract shape) — this is the third distinct sense of the same word. Rename to `recordCompletedTurn`/`commitTurn` and reserve "artifact" for the type actually named `CapabilityArtifact`.

### 🟡 Standard — `WorkshopSessionService` grows further past the God Component line

`packages/core/src/application/services/WorkshopSessionService.ts:358` — Already over CLAUDE.md's 500-line flag before this PR (612 lines); now 750 (+138, +23%). The same sprint already extracted `WorkshopAnalysisSidePass` as a focused collaborator — capability-artifact recording (turn assembly + sidecar cursor adoption + deep-clone helpers) is a similarly separable concern and would be a cleaner home than the session god-file.

### 🟡 Standard — `requestLogSummary` copy-pasted verbatim across sibling capabilities

`packages/core/src/infrastructure/api/orchestration/capabilities/GuideCapability.ts:113` — `ContextFileCapability.ts:85` defines the identical method body character-for-character, in the same PR that refactored both to share `ResourceRequestGate`. This belongs as one exported helper (next to `ResourceReadRequest` in the codec, or a default on the gate) instead of two new duplicated methods in one commit.

> *"Three different things get called 'artifact' in this one feature and a 750-line session file just grew again — it all works, but I shouldn't have to keep a glossary open to review it."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — Correction turn and max-rounds forced-final never exercised via `continueConversation`

`packages/core/src/__tests__/application/services/AgentRunEngine.test.ts:491` — The tests give real confidence that `runInitial` resets the 3-call budget, forces final prose at the boundary, and that the correction turn recovers or falls back — but every one of those scenarios is driven through `runInitial`. The only continuation-entry tests are one successful capability call and one mid-capability cancellation; neither exercises `recoverInvalidRequest` nor the max-rounds forced-final branch, even though "initial and continuation share one bounded loop" is the PR's headline claim. Both entry points still hand-roll their request shapes before delegating — a regression that re-diverges them would only be caught if it broke the initial-turn tests too. Add one continuation-entry test driving an invalid request to a correction turn, and one driving 3 calls to forced-final.

### 🟡 Standard — `instructions` exact-ceiling accept case is untested

`packages/core/src/__tests__/application/services/WorkshopCapabilityXmlCodec.test.ts:89` — The `it.each` confirms all four `+1` rejects, but the paired "accepts every ceiling exactly" test only builds `word`/`context`/`purpose` at their exact ceilings — never an `analysis.run` call with `instructions` at exactly 1,000. Nothing proves the boundary isn't off-by-one in the accept direction for this field.

### 🟡 Standard — `recordCapabilityArtifact`'s stale-guard has no direct test [🎯 Consensus]

`packages/core/src/application/services/WorkshopSessionService.ts:361` — Searched the three relevant suites for a case driving the mismatch branch (`requestId`/`target`/`excerptVersion`) — not found; both existing calls go through the matching, accepted path. The older `completeToolReport` guard it mirrors *does* have a dedicated zombie-report test, but this guard adds an `excerptVersion` condition the old one doesn't check — exactly the mechanism the ADR credits with keeping pending frames honest across a mid-turn excerpt revision, currently proven only by inference from a fully-mocked engine test.

> *"Three findings, and every one of them is a boundary or a second door nobody walked through twice — the loop that's supposed to be 'the same' on both entry points only proved itself on one."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟠 High — New `workshop/` subfolder breaks the flat `application/services/` convention [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:44` — See how `WorkshopSessionService.ts`, `WorkshopPromptBuilder.ts`, `WorkshopRunCompletion.ts`, and `RunWorkshopToolSidePass.ts` handle this? All Workshop-domain services, all flat in `application/services/` — no subfolder, ever, for any domain in that directory. This PR mints `application/services/workshop/` for exactly three files while leaving the very service they depend on one level up. Same domain, two directory depths, no doc or ADR establishing the new nesting rule.

### 🟠 High — New test files don't mirror the source tree

`packages/core/src/__tests__/application/services/WorkshopAnalysisSidePass.test.ts:1` — CLAUDE.md's Test Organization section is explicit: tests mirror the source tree ( `__tests__/infrastructure/api/orchestration/capabilities/ContextFileCapability.test.ts` mirrors its source path-for-path). These three new tests land flat in `__tests__/application/services/` while their sources live in `application/services/workshop/`. The mirror broke the moment the source-side subfolder decision was made without the test side following.

### 🟡 Standard — Capability request type lifted to `shared/types` instead of colocated with its codec

`packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts:4` — `ResourceReadXmlCodec.ts` defines `ResourceReadRequest`/`ResourceReadInspection` in the codec file and its capabilities import them from there — the established shape for "a capability-request type shared between a codec and its capability." This PR instead puts `WorkshopCapabilityRequest` in a standalone `shared/types/workshopCapabilities.ts`. Reasonable given `messages/workshop.ts` also needs the artifact-details type — but it's a second, different resolution to a problem the codebase already solved once.

> *"We already solved 'codec needs a shared request type' once, with `ResourceReadXmlCodec.ts` — this PR just solved it again, differently, two folders over."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — Every mid-turn capability completion replaces all ~100 rendered turn objects

`packages/core/src/application/services/WorkshopSessionService.ts:603` — `getSnapshot()` deep-clones every turn in the 100-turn window per call, and the capability loop now fires `sessionChanged` → full `postSessionState()` after *each* round — up to 4× in one user turn versus ~1–2× before this sprint. Every turn object is a fresh reference, so `React.memo` on `WorkshopTurnBubble` can't skip any bubble and ~100 re-render with regex re-scans. The math: maybe 10–50ms of webview main-thread work × 4 — well under 200ms, dwarfed by the multi-second LLM round trips gating each round. Does not matter today; revisit only if the snapshot window or `callsPerTurn` grow.

### 🟡 Standard — Per-round capability loop resends cumulative evidence with heavier payloads

`packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:236` — The resend-everything-per-round pattern predates this PR (guides/context already loop at 2 rounds), but this PR raises the Workshop host to 3 rounds with materially larger evidence bodies (a full-entry or analysis report can be several thousand tokens). Worst case — lookup + full-entry + analysis in one turn — total extra resent tokens land around 9–10k across ~4–5 completions: a few cents per heavy turn, bounded by the hard cap and reset each turn since only final prose commits to history. Matters only if `callsPerTurn` or evidence sizes grow. (Confidence: MEDIUM on the token arithmetic.)

### 🟢 Praise — Parallel dictionary-block execution preserved through the new capability path

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:216` — `generateParallelDictionary`'s `Promise.all` block fan-out is called directly, so the persona-triggered full entry gets the same parallel execution as the writer-triggered path — no accidental serialization introduced by the capability dispatch. *(Orchestrator note: Tim reported `DictionaryService.ts` as untouched; it was in fact modified — but only to thread an `AbortSignal` through an options object. The fan-out is verified intact, so the praise stands as corrected.)*

> *"Bounded by a hard three-call ceiling and reset every turn — the math stays comfortably under the noise floor of a multi-second LLM round trip, so I'll let the token budget speak for itself."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🔴 Blocking — Forged `<workshop-capability-result>` evidence block survives excerpt neutralization

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:340` — This PR introduces `<workshop-capability-result>` as the trust envelope the model is instructed to believe verbatim ("separately attributed capability evidence… do not invent omitted or failed results"). Outbound evidence is escaped correctly via `escapeXml` — that side is sound. The gap is inbound: pinned-excerpt/context-brief text is scrubbed for exactly five reserved tag names (`workshopPromptFrames.ts` — `pinned-excerpt|context-brief|writer-message|workshop-tool-evidence|workshop-host-update`), and the list was never extended to include `workshop-capability-result` (or `prose-minion-tool-call`). A writer who pins or pastes a document containing a literal forged capability-result block gets it delivered unescaped inside `<pinned-excerpt>`. It's never independently *executed* (the codec only scans the model's own completions) — but it's structurally identical to real evidence, and the persona is explicitly primed to trust content in that exact shape, so attacker-authored "evidence" (including embedded instructions) can impersonate a verified capability result the system never ran. Breaks the sprint's own locked invariant that reserved frame delimiters inside quoted excerpts are encoded before prompt assembly. No test in `workshopPromptFrames.test.ts` or `WorkshopCapabilityXmlCodec.test.ts` exercises the new tag. **Orchestrator-verified against `workshopPromptFrames.ts:2-3` at HEAD.** Fix is small: add the new tag(s) to `RESERVED_PERSONA_FRAME` plus a regression test.

> *"The evidence you send back is escaped; the evidence an attacker sends in through the front door isn't."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — Persona dictionary artifacts vanish with no trail when the active run goes stale mid-flight [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:302` — The `analysis.run` branch routes through `WorkshopAnalysisSidePass.adoptPersonaReport`, which explicitly logs its refusal when `recordCapabilityArtifact` returns `undefined` (run preempted/reset/excerpt changed mid-call). The dictionary branch calls `recordCapabilityArtifact` directly and does nothing with an `undefined` result — no log, no bookkeeping. `WorkshopSessionService` has no `LogSink` at all, so nothing downstream covers the gap. The outer `fulfill()` log still fires with `outcome=success` — the Output Channel reads as if the lookup succeeded, but no turn is pushed and the writer's thread never shows the result the persona says it fetched. At 2am the report is "Jill said she checked the dictionary but nothing showed up," and the log offers a false success, not a trail. No test exercises this branch.

### 🟡 Standard — Rejected/malformed persona capability calls log with no request or persona id

`packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts:541` — Successfully-dispatched calls get a fully attributed line (`request=… persona=… capability=… outcome=… durationMs=…`), but an invalid/malformed call never reaches `fulfill()` — it's rejected in the engine's generic `logCapabilityInspection`, which only knows the catalog name and rejection reason. That's exactly the scenario most worth tracing (a model attempting something outside its schema or budget), and attribution currently requires manual timestamp adjacency, which breaks the moment log lines interleave. The sprint's own bar ("log request id, persona id, capability… outcome") isn't met for this outcome specifically.

> *"A 'success' line in the log and an empty thread on screen — that's not a trail, that's a decoy."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — Analysis capability artifact label duplicates the tool name

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:109` — The sprint's example format is "Writer's Dictionary · liminal · requested by Jill" — a category, then a *distinct* specific item. For `analysis.run`, `toolLabel` and `capability.requestSummary` are both `workshopToolLabel(toolId)`, so a persona-requested Continuity run renders as "Continuity · Continuity · requested by Jill" — the two segments are identical for every analysis tool. The turn-bubble test only asserts the dictionary case. Is the duplication intentional (uniform format), or should `requestSummary` carry the `instructions` snippet for `analysis.run` the way `word` does for dictionary calls?

> *"The dictionary artifact says 'liminal,' the analysis artifact says 'Continuity · Continuity' — technically an attributed label, but it's attributing the obvious to itself."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The New Room Needs the Old Locks

Illuminated by: Patricia #1

A security boundary implemented as an enumerated list — "these five tags get neutralized" — silently promises to cover every tag that will ever carry trust, but the list only knows what it was told on the day it was written. When a new privileged envelope is added, the instinct is to wire it into the places that *produce* and *consume* it, because that's where the feature visibly lives. The defense lives somewhere else, in code nobody touched this sprint, so it never appears in the diff at all. The boundary didn't fail because it was weak; it failed because it was invisible from where the work was happening.

→ Carry forward: when you introduce a new reserved or trusted token, grep for every existing list of reserved tokens *before* writing the feature, and treat updating each one as a checklist item in the same commit — not a follow-up.

### Lesson 2 — Twins Drift the Moment Only One Gets Fed

Illuminated by: Oliver #2 (🎯 with Cal); Parker #9; Bria #15

Dictionary and analysis are meant to be siblings answering to the same contract, but three reviewers independently found the same shape of gap between them: one branch logs its refusal and one doesn't; one produces a distinct label and one echoes itself; shared log logic was copy-pasted rather than extracted — in the very PR that unified their gate. "The same code, twice" feels like consistency in the moment of writing but has no mechanism holding it consistent afterward. Every future edit to one copy is a coin-flip on whether it reaches the other.

→ Carry forward: the instant you write near-identical logic into a sibling file, extract the shared piece in the same commit — or write the divergence down explicitly so it reads as a decision, not an oversight.

### Lesson 3 — A Half-Finished Move Is Two Addresses

Illuminated by: Stan #3 (🎯 with Marcus)

New code took the new subfolder; the siblings it depends on stayed where they'd always been — natural, because the new lines are unclaimed territory while relocating four existing files feels like scope creep. But a structural convention that only applies to the newest arrival isn't a convention yet; it's a fork. The next person adding a fourth capability has to guess which address is canonical.

→ Carry forward: when a PR introduces a new structural pattern, either bring the existing siblings along in the same change, or write the follow-up ticket directly into the PR description — a stated plan, not a discovered accident.

### Lesson 4 — A Borrowed Guard Remembers Its First Job

Illuminated by: Sam #4, #5

The streaming guard and the tool-call stripper were built to answer a question for the resource.read codec, under that codec's tolerances — preamble is fine, a marker hit means one specific thing. Reused for the Workshop codec, which is stricter and different, they carried the old assumptions along invisibly: narration streams live and then gets retracted; a sentence that merely *mentions* the marker syntax nukes the entire response. A guard is a set of assumptions wearing code, and assumptions don't announce themselves when they cross into a new context.

→ Carry forward: before reusing a cross-cutting guard or sanitizer at a new call site, write down the specific assumptions it depends on — what counts as clean, what counts as a hit, what happens on partial match — and check each against the new site's actual tolerance.

### Lesson 5 — Testing the Claim, Not Just the Code

Illuminated by: Cal #6

The PR's own headline is "one loop, both entry points" — but the correction and forced-final branches are only ever tested through one of those doors. Once two paths share an implementation, exercising either one *feels* like proving the shared part works. But the promise of unification isn't "the code is shared" — it's "the behavior is the same no matter which door you came through," and that is only shown by walking through the door you didn't just finish building.

→ Carry forward: when a PR states its win as "X now works for both A and B," write the test from that exact sentence — one assertion per named path — before calling the claim proven.

> *"The strongest architectures are the ones we test as if we don't trust our own symmetry — because the moment we believe two things are twins, we stop checking whether they still are."* — Sensei

---

## The Closer

### 🚪 Knock knock joke

Knock knock.
*Who's there?*
`<workshop-capability-result>`.
*`<workshop-capability-result>` who?*
Great question — shame the excerpt neutralizer never asked it.

---

## Summary

Nearly there — one small, sharp fix away. The core engineering is genuinely strong: Blake verified the transactional commit and cancellation claims end-to-end and found zero blockers, and Marcus confirmed the engine unification closes a real structural gap. The single 🔴 is a one-line regex extension plus a regression test (add `workshop-capability-result` to `RESERVED_PERSONA_FRAME`), and the consensus 🟠s — the silent dictionary-artifact discard and the half-finished `workshop/` folder move — are each an afternoon, not a redesign. Fix the blocker, add the two missing continuation-path tests, and this merges with a clear conscience.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
