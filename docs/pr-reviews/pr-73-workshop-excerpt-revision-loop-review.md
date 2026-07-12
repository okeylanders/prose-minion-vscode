# MR Review — Workshop excerpt revision loop and room memory

**Author:** Okey Landers · PR #73 · `sprint/workshop-editor-tab-06c-excerpt-revision-loop` → `epic/workshop-editor-tab`

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Context brief trimmed on host path but sent **untrimmed** on every tool run (breaks the UI's "first 10,000 words" promise) | Tim, Sam | 🎯 | **Open** |
| 2 | 🟠 High | Context brief delivered **twice** in one opening message after a failed/cancelled first host turn | Bria | — | **Open** |
| 3 | 🟠 High | `collectPendingHostUpdates` throws `TypeError` in the no-excerpt state (`undefined === undefined` guard hole) | Blake | — | **Deferred** — unreachable today; fix the 1-line guard before Sprint 07 builds on this aggregate |
| 4 | 🟠 High | Architecture guard regex has real evasion routes (`let`, un-`readonly` fields, `_MAX`/`_CAP`/`_CEILING`) | Cal | — | **Open** |
| 5 | 🟠 High | Model hot-swap in-flight invariant ("keeps model captured at dispatch") has zero test coverage | Cal | — | **Deferred** — invariant holds today; add a regression test to lock it |
| 6 | 🟠 High | Pending host-update transaction has **zero log trail** across its whole lifecycle | Oliver | — | **Open** |
| 7 | 🟡 Standard | Pending-update → frame mapping block duplicated verbatim across two call sites (tri-state re-encoding undocumented at source) | Marcus, Parker | 🎯 | **Open** |
| 8 | 🟡 Standard | Pure `buildWorkshopHostUpdateFrame` placed on infra service, not the `WorkshopPromptBuilder` module where its siblings live | Marcus | — | **Open** |
| 9 | 🟡 Standard | `buildWorkshopHostMessage(text, handoff, false, frame)` — positional boolean/string param soup; wants an options object | Parker | — | **Open** |
| 10 | 🟡 Standard | `ContextBriefPanel` silently discards keystrokes typed during the save round-trip (`useEffect([value])` clobber) | Sam | — | **Open** |
| 11 | 🟡 Standard | Bare self-closing reserved tag (`<pinned-excerpt/>`) bypasses the delimiter neutralizer; one-char fix | Patricia | — | **Open** |
| 12 | 🟡 Standard | Model hot-swap failure doesn't name the failing scope; mid-loop throw leaves `resolvedModels` stale (engine on B, UI reports A) | Oliver | — | **Open** |
| 13 | 🟡 Standard | `buildWorkshopHostUpdateFrame` untested for the majority shape (revision present, brief absent) | Cal | — | **Open** |
| 14 | 🟢 Nit | `WorkshopPendingHostUpdates.revision` (a whole excerpt) vs. `contextBrief.revision` (a counter) — same word, two shapes | Parker | — | **Open** |
| 15 | 🟢 Nit | `promptBudgets.ts` is the only `shared/constants/` file using runtime `Object.freeze`; siblings use `readonly` | Stan | — | **Open** |
| 16 | 🟢 Nit | `WorkshopTurnBubble` calls `useMemo` after a conditional early return (Rules-of-Hooks); repo eslint has no `react-hooks` plugin | Sam | — | **Open** |
| 17 | 🟢 Nit | Centralized pin log dropped the char/word size the two prior log lines carried | Oliver | — | **Open** |
| 18 | 🟢 Nit | Token-floor after the contextBrief raise (~14.6k → ~26k tokens/host turn) — on record, not a defect | Tim | — | **N/A** — disclosed & intentional |
| 19 | 🟢 Praise | Generation-safe pending transaction holds under independent tracing; no true blockers | Blake | — | **N/A** |
| 20 | 🟢 Praise | The cancellation-keeps-pending test genuinely proves the hard path, not just the happy one | Cal | — | **N/A** |

---

## Blast Radius

- 44 files changed · +1,263 / −180 lines
- New files: 4 (`promptBudgets.ts`, `ContextBriefPanel.tsx`, `promptBudgets.test.ts`, `ContextBriefPanel.test.tsx`) · Migrations: no · New services/controllers: none (methods added to existing `WorkshopSessionService`, `AssistantToolService`, `AIResourceManager`)
- Diff exceeds ~800 lines — agent context was anchored on the highest-churn implementation files.
- Verification reported by author: typecheck ✅ · 84 suites / 643 tests ✅ · lint 0 errors ✅ · build ✅

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B− |
| 🛡️ Security | B− |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | C+ |
| 🎯 Domain | C+ |

---

## Executive Briefing

🟠 **[Tim + Sam · 🎯 Consensus]** Context brief untrimmed on the tool path — the 10,000-word cap is enforced only on the host turn; every Prose/Dialogue/Cliché run ships the full brief verbatim, making the UI's "host and tools will receive the first 10,000 words" a false promise for the tool half.

🟠 **[Bria]** Context brief delivered twice after a failed first host turn — the pending flag survives a plain cancel/failure (only `ConversationNotFoundError` clears it), so the retry's opening message carries the brief both as the `contextBrief` param and inside the `<workshop-host-update>` frame, one copy claiming to "supersede" a brief that never existed.

🟠 **[Blake]** `collectPendingHostUpdates` `TypeError` in the no-excerpt state — `undefined === undefined` passes the guard and runs `cloneExcerpt(this.excerpt!)` on `undefined`. Unreachable today (all callers require a pin first); a latent trap for Sprint 07's memory work.

🟠 **[Cal]** Two confidence gaps that hide future regressions — the architecture guard's regex misses `let`, un-`readonly` fields, and `_MAX`/`_CAP` names (the exact re-scattering it exists to prevent), and the model hot-swap's in-flight invariant has no test holding it.

🟠 **[Oliver]** The headline pending-update transaction is invisible to the log — no queue/deliver/commit trail, while its sibling handoff feature logs every step; "the persona still describes my old draft" is undiagnosable from the output channel.

---

## 🔥 Blake · Staff Engineer

*"She's Been Paged for This Before"*

### 🟠 High — `collectPendingHostUpdates` throws `TypeError` when no excerpt is pinned

`packages/core/src/application/services/WorkshopSessionService.ts:183` — The guard `this.pendingRevisionVersion === this.excerpt?.version` evaluates `undefined === undefined` → `true` in the default (no-pin) state, then runs `cloneExcerpt(this.excerpt!)` on `undefined`. `cloneExcerpt` (line 640) dereferences `excerpt.truncation`, throwing *"Cannot read properties of undefined."* The `!` non-null assertion is a lie in exactly the case the guard was meant to reject. **Not a merge-blocker:** both current callers (`executeMessage`, `handleRunTool`) require a pinned excerpt first, so it's unreachable today and no test walks the path. It matters because it's a broken invariant in a shared aggregate, and Sprint 07 is explicitly chartered to build on this memory model. One-line fix: `this.excerpt !== undefined && this.pendingRevisionVersion === this.excerpt.version`.

*(Verified by the orchestrator: `cloneExcerpt(undefined)` throws on `excerpt.truncation`.)*

### 🟢 Praise — the generation-safe design holds

The pending → deliver → commit-on-success transaction, the collapse-to-newest rule, and the model hot-swap all survived independent step-by-step tracing. No true blockers.

> *"The guard that's supposed to say 'nothing pending' instead says 'clone the excerpt that doesn't exist' — disarmed today only because every caller happens to frisk the door first, and that luck expires the moment Sprint 07 walks in."* — Blake

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟠 High — Context brief can be delivered twice in one opening message

`packages/core/src/application/services/WorkshopSessionService.ts:177` — The sprint's own test checklist requires the pending update be *"delivered exactly once via the shared path."* `setContextBrief` queues `pendingContextBriefRevision` whenever `hasHostConversation() || activeRun?.target === 'host'` — including while the *first-ever* host message is in flight, before a `conversationId` lands. Nothing clears that flag when the first attempt fails or is cancelled: `abandonRun()` only clears `activeRun`, and only the `ConversationNotFoundError` catch branch (`WorkshopHandler.ts:430`) calls `clearAllConversations()`. On retry, `hostConversationId` is still undefined, so `executeMessage` (`WorkshopHandler.ts:390-394`) calls `startWorkshopPersonaConversation` with **both** `contextBrief: this.session.getContextBrief()` **and** a `modelMessage` that already baked the brief into a `<workshop-host-update><context-brief>` frame. `buildWorkshopPersonaUserMessage` then also emits a top-level `<context-brief>` — the persona receives the brief twice, one copy insisting it "supersedes the earlier brief" in a conversation with no earlier brief. `handleSetContextBrief` has no `activeRun` guard (unlike `handleSetExcerpt`), and the Save button isn't gated on `isRunning`, so this is reachable through the UI today. Widen the clear (in `setContextBrief`'s in-flight branch or the generic catch) to self-heal the way the `ConversationNotFoundError` path does.

*(Verified by the orchestrator against `WorkshopHandler.ts:384-398`.)*

> *"Two context briefs walk into a writer-message frame — one insists it supersedes the other, but they're both the same brief, and I'd love to know if that was on purpose."* — Bria

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — Workshop tool runs never trim the context brief to its budget [🎯 Consensus]

`packages/core/src/application/services/RunWorkshopToolSidePass.ts:248` — Two delivery paths, one cap. The host path (`buildWorkshopPersonaUserMessage` / `buildWorkshopHostUpdateFrame`) clamps to `PROMPT_BUDGETS.contextBrief.words` (10,000). The tool path reads `session.getContextBrief()` — the full, untrimmed text — and hands it to `analyze*`, which forward it into `PromptedPassageAssistant.buildUserMessage` where only a whitespace `.trim()` happens. So every Prose/Dialogue/Cliché/Continuity run ships the whole brief verbatim, while `ContextBriefPanel.tsx` tells the writer "the host and tools will receive the first 10,000 words." The architecture guard can't catch it — a call site *missing a trim entirely* (rather than defining a local constant) sails past its regex.

### 🟡 Standard — `ContextBriefPanel` silently reverts in-flight keystrokes after Save

`packages/core/src/presentation/webview/components/workshop/ContextBriefPanel.tsx:21` — Type "Hello", Save (posts the brief, draft stays local, typing not blocked), keep typing → draft is "Hello World". The extension echoes `session.contextBrief = "Hello"` back; because `value` genuinely changed, `useEffect([value])` fires `setDraft("Hello")`, discarding "World" with no warning. Sibling `ExcerptPanel` seeds its draft only on an explicit `beginEditing()` and never re-hydrates from an async echo while editable.

### 🟢 Nit — `useMemo` after a conditional early return (Rules-of-Hooks)

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:91` — The `excerpt_revision` divider branch returns before `React.useMemo` runs, so those turns run zero hooks and others run one. Harmless today (bubbles are keyed by immutable `id`; a turn's `artifact` never changes), but it's a textbook violation that `npm run lint` can't see — the repo's eslint has no `react-hooks` plugin. The next hoisted hook reintroduces React's "rendered fewer hooks than expected" crash, uncaught.

> *"I love it when the safety net turns out to be a word-trim that only guards half the bridge — the tools just stroll right past the sign that says '10,000 words, please.'"* — Sam

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The architecture guard's regex has real evasion routes

`packages/core/src/__tests__/architecture/promptBudgets.test.ts:9` — The guard advertises "fail on any new module-local limit," but `CONSTANT_DECLARATION` only matches `const`/`readonly` and `LOOKS_LIKE_LIMIT` only matches `_MAX_`/`_LIMIT` mid-string. Three ways past it, verified by running the regexes: `let MAX_WORDS = 10`, a `private static MAX_ITEMS = 5` field, and — most surprisingly — `const PERSONA_BRIEF_MAX = 500` (trailing-underscore-less `_MAX`, plus `_CAP`/`_CEILING`/`_THRESHOLD`). The exact regression this exists to prevent (Sprint 07/09 quietly re-introducing a ceiling) slips through.

### 🟠 High — Model hot-swap's in-flight safety claim has zero coverage

`packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts:115` — `ARCHITECTURE.md` and `OpenRouterClient.setModel`'s doc comment both promise "an in-flight request uses the model captured when its HTTP request was dispatched." The only `setModel` tests assert post-swap state (engines not replaced, `getModel()` updated). Nothing exercises a request in flight *during* a swap; the promise rests entirely on `createChatCompletion` reading `this.model` synchronously before the first `await` — true today, and exactly the kind of thing a future refactor (lazy body build, model resolved after an await) silently breaks into a "wrong model answered my request" bug report.

### 🟡 Standard — `buildWorkshopHostUpdateFrame` untested for the common shape

`packages/core/src/__tests__/infrastructure/api/services/analysis/AssistantToolService.test.ts:130` — The tri-state contract is tested at both extremes (brief + revision; brief `null`, no revision) but never for the majority production case: a revision with the brief untouched (`contextBrief` key absent), which short-circuits a different branch. `WorkshopHandler.test.ts` can't fill the gap — its `beforeEach` mocks the real builder out.

> *"I've traced every generation-commit gate down to the line that guards it — the confidence gaps I flagged are about the paths nobody walked, not the ones that are actually broken."* — Cal

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟡 Standard — Pure prompt-frame builder lives on the infra service, not the builder module

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:492` — `buildWorkshopHostUpdateFrame` never touches `this`, makes no provider call, and just trims/neutralizes/frames text — structurally identical to `buildWorkshopToolEvidence`, `buildWorkshopDirectHandoff`, and `buildWorkshopHostMessage`, all pure exported functions in `WorkshopPromptBuilder.ts`. `buildWorkshopHostMessage` even *consumes* this function's output. One coherent concern split across two layers for no architectural reason; move it beside its siblings.

### 🟡 Standard — Duplicated "collect pending → build frame" block [🎯 Consensus]

`packages/core/src/application/services/RunWorkshopToolSidePass.ts:72` — The same seven-line block (same variable names, same `contextBrief.text ?? null` collapse) appears in `WorkshopHandler.ts:344-354` and here. It mirrors the pre-existing handoff duplication at the same two sites, so the PR didn't invent the pattern — but it had the chance to fold both into one `resolveHostUpdateFrame(...)` helper and instead compounded it, right before Sprint 07 adds a third call site to this same delivery path.

> *"The budget table finally gave every prompt bound one address — now give the frame that reads it one address too."* — Marcus

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — Duplicated tri-state re-encoding, undocumented at the source [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:347` — `pendingHostUpdates.contextBrief ? pendingHostUpdates.contextBrief.text ?? null : undefined` is copy-pasted into `RunWorkshopToolSidePass`. The duplicated thing isn't syntax, it's a *decision*: remapping `WorkshopPendingHostUpdates` (object + `text: undefined`) into `WorkshopHostUpdateFrameInput` (`undefined` = no update, `null` = cleared, string = new). That rule is documented once, at the destination type — a reader hits `?? null` cold, twice. Pull it into one `toHostUpdateFrameInput(...)` beside its type, or let the builder accept the pending object directly.

### 🟡 Standard — `buildWorkshopHostMessage` positional param soup

`packages/core/src/application/services/WorkshopPromptBuilder.ts:180` — Both call sites now read `buildWorkshopHostMessage(text, handoff, false, hostUpdateFrame)` and `(evidence, pendingHandoff, true, hostUpdateFrame)`. Neither bare boolean means anything without flipping to the definition, and a positional string just got bolted on next to it. With exactly two call sites, switch to `buildWorkshopHostMessage(writerMessage, { handoff, writerMessageIsTrustedEnvelope, hostUpdate })`.

### 🟢 Nit — `revision` means two things four lines apart

`packages/core/src/application/services/WorkshopSessionService.ts:65` — Top-level `revision?` is a whole `WorkshopExcerpt` (which already carries `.version`); nested `contextBrief.revision` is a bare counter. The codebase already uses "version" for monotonic ids — rename the outer field to `excerpt?: WorkshopExcerpt` and free `revision` to mean only "counter."

> *"Reusing 'revision' for both an object and its own counter in one interface reads fine until you're debugging it at 11pm and start doubting which one you're holding."* — Parker

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟠 High — Context brief is unbounded and re-sent in full on every tool call [🎯 Consensus]

`packages/core/src/application/services/RunWorkshopToolSidePass.ts:248` — Pre-PR this argument slot was `undefined` (cost zero). Now it threads `session.getContextBrief()` unconditionally, and neither `setContextBrief` (no length bound) nor the sink (`.trim()` only) caps it — the UI merely *warns* above 10,000 words. Paste 30,000 words of story bible and every tool run injects ~39,000 tokens; each run is a fresh stateless one-shot, so 5 runs = ~195,000 tokens of byte-identical repeated input with no prompt-cache reuse. Won't break anything at current scale (one user, a few runs), but it's real, avoidable OpenRouter spend and it silently violates the cap the UI advertises — enforced only on the host path.

### 🟢 Note — Per-turn token floor after the contextBrief raise (on record)

`packages/core/src/shared/constants/promptBudgets.ts:60` — On the (correctly bounded) host path, raising `contextBrief` from 1,200 → 10,000 words moves the mandatory excerpt+brief floor from ~14,600 to ~26,000 tokens per host turn (~1.8×). Disclosed and intentional ("at the writer's request"), so not a defect — but with opt-in `guides` + `contextFiles` (50k words each) the worst-case single host message is ~156,000 tokens. Cheap to know now, expensive to discover when Sprint 07 starts composing these in one turn.

> *"Before this PR a tool run's context argument cost zero tokens; now it costs an uncapped ~13,000-plus per call with no reuse — the host path remembers to trim, the tool path forgot."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟡 Standard — Bare self-closing reserved tags bypass the frame neutralizer

`packages/core/src/utils/workshopPromptFrames.ts:3` — The lookahead `(?=\s|>)` requires whitespace or `>` right after the tag name. A bare self-closing form — `<pinned-excerpt/>` or `<workshop-host-update/>` with no space before `/` — has `/` next, so the lookahead fails and the literal passes through **unescaped**. Verified by execution: `neutralize("<workshop-host-update/>")` returns it unchanged, while the spaced form `<pinned-excerpt attr="x"/>` and the classic `</pinned-excerpt><pinned-excerpt data-forged>` spoof are correctly escaped. Any of the four attacker-reachable surfaces (pasted/file excerpt, `relativePath`, brief, composer message) can carry this substring into the host prompt. Practical impact is narrower than a full spoof — it's a marker-confusion primitive, not a frame takeover (can't forge attributes) — but it's a concrete hole in a control the code documents as a "global escape." Fix: `(?=[\s/]|>)`, which re-catches both self-closing cases without altering the other correct behaviors.

> *"A delimiter defense that only stops the attack you tested for is a delimiter defense with a known expiration date."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — The pending host-update transaction has zero log trail

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:422` — The PR's headline feature queues, delivers, and clears a revision/brief across success, failure, and cancellation — and not one of its call sites (`WorkshopHandler.handleSendMessage`, `RunWorkshopToolSidePass.run`) logs anything. Its sibling, Direct Handoff, logs `[WorkshopHandler] Direct handoff prepared: N unseen → …` on every attempt. So when a writer reports "the persona still describes my old draft," the channel shows only a generic failure line — nothing distinguishes "the revision safely stayed queued and will retry" from "it was silently never queued." The whole new state machine is invisible while its twin is fully instrumented.

### 🟡 Standard — Hot-swap failure doesn't name the scope; partial swap leaves `resolvedModels` stale

`packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts:119` — Model settings are free-text (no `enum`/`minLength`); `""` is a plausible hand-edit and `OpenRouterClient.setModel` throws on it. If a later scope in the loop throws: (1) the catch logs `Model hot-swap failed: OpenRouter model id cannot be empty` with **no scope name**, so on-call infers the culprit by elimination; (2) `this.resolvedModels = { ...selections }` runs only after the loop, so scopes that already swapped leave `resolvedModels` — which populates the UI dropdown — pointing at the old model, engine on B while UI reports A, unlogged.

### 🟢 Nit — Centralized pin log dropped the size field

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:662` — The two replaced log lines both carried `${text.length} chars`; the new line gains version + retired-sidecar count (genuinely more diagnostic) but drops size, so "how big was the text just pinned" is no longer answerable from the log alone.

> *"The pending-update transaction is the feature everyone will ask about at 2am, and right now the log has nothing to say about it either way."* — Oliver

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟢 Nit — `promptBudgets.ts` is the lone `Object.freeze` in `shared/constants/`

`packages/core/src/shared/constants/promptBudgets.ts` — Every sibling (`workshopTools`, `workshopPersonas`, `workshopQuickActions`, `resultToolNames`, `wordSearchDefaults`) expresses immutability purely with `readonly`/`Readonly<>` at the type level. This file adds a runtime `Object.freeze` on top — harmless, and the sprint did ask for a "frozen, typed" module, but it introduces a second immutability idiom into a drawer that had one settled answer.

> *"Five siblings shook hands on `readonly`; this one brought a padlock nobody else in the drawer owns."* — Stan

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — One Guarded Door Is Not a Guarded House

Illuminated by: Tim+Sam #1, Patricia #11, Cal #13

A limit, a sanitizer, or a test protects data at the exact point it sits — and nowhere else. When the same payload can enter through two doors (the host path and the tool path, the `<tag>` and `<tag/>` form, the brief-present and brief-absent shape), a guarantee at one door isn't a guarantee — it's a coin flip that the caller walked through the guarded entrance. The UI's promise ("host *and* tools get 10,000 words") is the tell: the sentence describes a symmetry the code only half-built.

→ Carry forward: When you write a cap, a neutralizer, or a guard, trace every path the data can travel and ask "does each pass through here?" — and when you test one shape of an input, test its mirror in the same breath.

### Lesson 2 — Text Can Repeat; Knowledge Should Not

Illuminated by: Marcus+Parker #7, Marcus #8, Parker #9

The tri-state re-encoding is one piece of *knowledge*, smeared across two call sites with a third arriving in Sprint 07, while the rule that governs it lives only at the destination type. Duplicated text is cheap; duplicated knowledge is the expensive kind, because it drifts. A pure transform wants one named home, in the layer where its pure siblings already live, behind a signature that says what its arguments mean rather than a tail of bare positionals.

→ Carry forward: Before the second copy of an encoding rule, extract it to a named function beside its kin — and when an argument list grows a boolean or nullable string, reach for an options object so the call site reads as a sentence.

### Lesson 3 — Confidence Is Not Enforcement

Illuminated by: Blake #2, Cal #4, Cal #5, Oliver #6

A `!`, a guard's regex, a "true today" invariant, and a sibling's log trail are all *claims of confidence* — and each here promises more than it delivers. The non-null assertion swears the excerpt exists in exactly the state where it doesn't; the regex swears it catches every re-scattered ceiling while missing `let` and `PERSONA_BRIEF_MAX`; the hot-swap invariant swears the model is captured at dispatch with no test to hold it; the transaction swears it works with no log to prove it did. The signal of safety has quietly diverged from the fact of safety.

→ Carry forward: For every confidence-signal you write — assertion, guard, "can't happen" comment — name what actually enforces it, and ask whether a test would fail if that enforcement broke. If the answer is "nothing" or "no," you've written a wish, not a guard.

### Lesson 4 — What You Set on Success, Clear on Every Exit

Illuminated by: Bria #3, Oliver #12

Setting state is the happy path; correctness lives in the exits you didn't celebrate. The pending-brief flag is raised when a host run starts but lowered only in the `ConversationNotFoundError` branch — so a plain cancel or failure leaves it standing, and the brief arrives twice claiming to "supersede" a copy that never existed. The mid-loop model swap has the same shape: throw halfway and half the scopes are on model B while the dropdown still reports A.

→ Carry forward: The moment you set mutable state or a pending flag, enumerate every way control can leave — success, no-op, cancel, throw — and make each restore the invariant, whether by `finally`, rollback, or an all-or-nothing commit.

### Lesson 5 — The Code Next Door Is Your Cheapest Spec

Illuminated by: Sam #10, Stan #15, Sam #16, Oliver #17

Most of these aren't bugs invented from scratch — they're *divergences* from a pattern the repo already got right one file over. `ExcerptPanel` seeds its draft only on explicit edit; its twin re-seeds on every server echo and eats keystrokes. Five constant files use `readonly`; this one reaches for `Object.freeze`. The prior pin logs carried size; the centralized one dropped it. When your feature has a sibling in the tree, that sibling is a free specification — and the difference between you and it is usually the smell.

→ Carry forward: Before you call a new component done, diff it against its nearest sibling — same seeding discipline, same immutability idiom, same log payload, same hook order — and justify every difference as intent, not accident.

> *"A codebase keeps its promises the way a person does — not in the vow made once at the well, but at the second door, the failure branch, and the quiet sibling nobody was watching, the places that reveal whether you actually meant it."* — Sensei

---

## The Closer

### 🎋 Haiku

> Snow buries the draft —
> the host recalls each version,
> tools drink the flood twice.

---

## Summary

A disciplined, well-tested PR with a genuinely sound core: the generation-safe pending transaction, the collapse-to-newest rule, and the in-place model hot-swap all held up under independent tracing — **no blocking bugs, no data-corruption paths.** The findings cluster, tellingly, around a single theme Sensei named: guarantees enforced at one door but not its twin. Two behavioral HIGHs actually change what the model receives and are worth fixing before merge — the context brief sent untrimmed on the tool path (#1, breaking the UI's own promise) and the double-delivery on a retried first turn (#2) — alongside Patricia's one-character neutralizer fix (#11) and Oliver's missing log trail (#6, cheap, high-value). The latent `TypeError` (#3) and the two test/guard gaps (#4, #5) don't block this merge but are load-bearing for Sprint 07, which is explicitly built on this aggregate — fold in the one-line guard now if it's cheap. Everything else is quality and consistency polish. **Verdict: nearly there — address the two prompt-correctness HIGHs and the security one-liner, then ship.**

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
