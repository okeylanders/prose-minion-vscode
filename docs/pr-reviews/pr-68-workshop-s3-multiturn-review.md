# MR Review — feat(workshop): Sprint 03 — Multi-turn (follow-ups continue the conversation)

**Author:** okeylanders · PR #68 · base `epic/workshop-editor-tab` ← head `feat/workshop-s3-multiturn`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope / superseded / praise.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | `continueConversation` cancel-race: stream finishing as abort fires appends to stored history but never shows the reply → next follow-up's context has a Q&A the user never saw | Sam | — | **Addressed** — re-checks the actual termination signal after clean streaming completion; regression test proves aborted clean-finish follow-ups leave stored history untouched |
| 2 | 🟠 High | Retain block stores raw `last.content` (un-stripped `<guide-request>`) not `cleanedResponse` → MAX_TURNS-exhausted run bakes a dangling tag into follow-up context | Bria | — | **Addressed** — retained assistant turn now uses the cleaned visible response; regression test covers MAX_TURNS guide-request exhaustion with retention |
| 3 | 🟠 High | Excerpt replacement never severs the retained conversation → follow-up continues reasoning about an excerpt no longer pinned | Marcus | — | **Addressed** — intended scoping confirmed as re-pin severs; `replaceExcerpt` clears/discards any retained conversation for both webview and file-picker pins |
| 4 | 🟠 High | `handlePickExcerptFile` guard not re-checked after `readFile` → a tool run starting mid-read gets its excerpt swapped out from under it | Sam | — | **Addressed** — picker re-checks after stat and after read before mutating; regression test starts a run while read is pending |
| 5 | 🟡 Standard | `handleRunTool`/`handleSendMessage` duplicate the streamed-run lifecycle (finally block / whole skeleton) — extract before Sprint 4 adds a third copy | Marcus, Parker | 🎯 | **Deferred** — extract before the quick-actions third instance lands |
| 6 | 🟡 Standard | "Pin from file…" fully reads + UTF-8-decodes the whole file into the extension host before any size check → misclicked huge file OOMs the host | Patricia | — | **Addressed** — file picker stats before read and rejects files over 5 MiB; test asserts oversized files are not read |
| 7 | 🟡 Standard | Out-of-workspace picks put the raw absolute path (home dir + username) in the header + log | Patricia | — | **Addressed** — out-of-workspace labels render/log as `External file: <basename>`; regression test asserts the absolute path stays out of logs |
| 8 | 🟡 Standard | `seedExcerpt` stamps `source: 'extension.command.workshop_selection'` — a third shape matching neither `webview.workshop` nor `extension.<domain>` | Stan | — | **Addressed** — synthetic seed now uses `webview.workshop`, matching the path it routes through; provider assembly witness guards it |
| 9 | 🟡 Standard | Cancel wire is only exercised against a tool run, never a `handleSendMessage` follow-up | Cal | — | **Addressed** — added follow-up cancel-wire test proving the signal aborts and no assistant reply lands |
| 10 | 🟡 Standard | `handleCancelRequest` miss case (wrong domain / stale requestId) returns with zero log | Oliver | — | **Addressed** — miss cases now log domain/request/active id; existing stale/wrong-domain test asserts the trail |
| 11 | 🟡 Standard | `relativePath` renders in the header subtitle but not the excerpt block (AC asked for both) | Bria | — | **Deferred** — confirm AC intent; shared by both seed paths, low impact |
| 12 | 🟡 Standard | Client-side `turns` list is unbounded and fully re-scanned every broadcast (mirror of the host-side window) | Tim | — | **Deferred** — noise at documented scale; revisit if threads reach thousands in one sitting |
| 13 | 🟢 Nit | `wasCancelled`'s `\|\| options.signal?.aborted` clause is dead code — simplify + rename to `wasAborted` | Parker | — | **Addressed** — collapsed to the unified termination signal via `isAborted()` and renamed the local flag |
| 14 | 🟢 Nit | `WorkshopHandler.test.ts` skipped the sibling sub-`describe` grouping convention | Stan | — | **Addressed** — grouped the suite by routing/session controls, conversation lifecycle, follow-ups, cancel wire, file picker, and disposal |
| 15 | 🟢 Nit | Empty-file guard logs the failure but not which file (`picked.fsPath` in scope) | Oliver | — | **Addressed** — empty-file errors include the sanitized display path; test covers external-path redaction |
| 16 | 🟢 Praise | Retain/continue/discard invariant is airtight under preemption (every ordering traced) | Blake | — | **N/A** |
| 17 | 🟢 Praise | The seam respects the dependency rule — infra stays Workshop-agnostic, session service stays pure, `pickFile` is vscode-free, captured-generation fix at the right layer | Marcus | — | **N/A** |
| 18 | 🟢 Praise | `LiveRun {requestId, phase}` makes illegal states unrepresentable (one atom, one write path, everything downstream derived) | Parker | — | **N/A** |
| 19 | 🟢 Praise | Continuation seam proven against a REAL `ConversationManager` + literal message-role assertion — acceptance criteria, executable | Cal, Bria | 🎯 | **N/A** |
| 20 | 🟢 Praise | Captured-generation regression test asserts on instance identity (asserts gen-3 was never called) — the only version that falsifies the bug | Cal | — | **N/A** |
| 21 | 🟢 Praise | `continueConversation`/`discardConversation` extend the orchestrator idiom instead of forking a parallel mechanism | Stan | — | **N/A** |
| 22 | 🟢 Praise | Snapshot broadcast is O(window=100), not O(history), and off the token clock | Tim | — | **N/A** |
| 23 | 🟢 Praise | `excerptWordCount` memoization verified intact under the fresh-object-every-broadcast churn | Tim | — | **N/A** |
| 24 | 🟢 Praise | `sendError` always logs AND surfaces (no silent-wrong path); the non-error trail carries real requestId/conversationId/tool correlation | Oliver | — | **N/A** |

---

## Blast Radius

- 39 files changed · +2498 / −258 lines · 9 commits
- New files: 4 — 1 prod component (`WorkshopComposer.tsx`), 2 test suites, 1 tech-debt doc + 1 memory-bank record
- Migrations: none (VS Code extension — no database). New services/controllers: none — extends existing `WorkshopHandler`, `AIResourceOrchestrator`, `WorkshopSessionService`, `AssistantToolService`, `ConversationManager`; adds one Platform port method (`ShellService.pickFile`)
- Large PR (>800 lines): the panel focused on the highest-change **production** files — the retain/continue/discard seam and its handler wiring — with the test suites read for coverage judgment.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | B− |
| 🧪 Tests | B+ |
| 📖 Quality | B |
| ⚡ Performance | B+ |
| 🎯 Domain | C |

The two C's are both single, well-argued High findings (one design-seam question, one continuation edge case) against otherwise genuinely strong work — not a distribution of rot.

---

## Executive Briefing

**Zero blocking.** Blake traced every preemption ordering and found the core invariant welded shut. The four 🟠 High findings below are all narrow-trigger and mostly one-line fixes — but three of them cluster around a single fragility worth naming: *the stored conversation and the user-visible thread are maintained by two separate code paths that can silently disagree.*

🟠 **[Sam]** Cancel-race in `continueConversation` — a follow-up cancelled in the instant the stream finishes cleanly appends the exchange to stored history but never shows the reply; the next follow-up's context then contains a Q&A the user never saw. The robust recheck (`wasCancelled`) exists in the same PR, just not reused here.

🟠 **[Bria]** Retained history stores raw `last.content` — a tool run that hits `MAX_TURNS` while still mid-`<guide-request>` bakes a dangling, un-fulfilled tag into the first follow-up's context while the user saw an empty bubble. One-line fix: retain `cleanedResponse`.

🟠 **[Marcus]** Excerpt replacement doesn't sever the retained conversation — pin A → run tool → replace with B, and a follow-up silently continues the A-conversation while the rail shows B. `setExcerpt` and `conversationId` are independently mutable; the discard seam exists (reset uses it) but isn't wired to this trigger. *Confirm intended scoping.*

🟠 **[Sam]** `handlePickExcerptFile` re-guards `activeRun` before and after the picker but not after the `readFile` await — a tool run starting during the read gets its excerpt swapped out mid-analysis, exactly the failure the guard's own comment warns about.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — Excerpt replacement doesn't sever the retained conversation

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:406` (and `:471`)

The ADR's scoping model is explicit — a retained conversation is "one tool run + its follow-ups" — and that's the justification for shipping full, unwindowed history every turn. But `handleSetExcerpt` and `handlePickExcerptFile` never touch `conversationId`. Traced every discard site (tool-run replacement `:224`, zombie refusal `:232`, reset `:482`) — excerpt replacement isn't one of them. So: pin A, run Dialogue (retains C1, history all about A), click "Replace excerpt…" and pin B; `getConversationId()` still returns C1, `hasConversation` stays true, the composer still reads "Ask a follow-up — it continues this conversation…", and a follow-up silently continues C1 reasoning about an excerpt no longer in the rail. `setExcerpt` and `conversationId` are two independently-mutable fields the ADR's prose treats as coupled but the code doesn't enforce. Neither `WorkshopHandler.test.ts` nor `WorkshopSessionService.test.ts` pins an excerpt once `conversationId` is set. The seam already exists — `setExcerpt` (or the handler wrapping it) should discard the prior conversation the way `reset()` does.

### 🟡 Standard — Two streamed-run lifecycles, one un-extracted skeleton [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:142`

`handleRunTool` (142–263) and `handleSendMessage` (270–366) carry the identical skeleton end to end — preempt, mint requestId/controller, stamp `activeRun`, begin the turn, `postTurn`/`postSessionState`/`sendStreamStarted`/`sendStatus`, invoke, branch on cancelled/API-key/success, `completeRun`, `postSessionState`, a catch that abandons and routes AbortError vs. everything else, a finally that clears `activeRun` and blanks the ticker. ~90 lines mirrored twice with no shared primitive; the composer's Sprint-4 "Tools" pill signals a third streamed-run kind (quick actions) is already coming. Extract a `runStreamedTurn`-style helper (begin/post/stream/branch/settle, parameterized by the service call and the success-branch hook) before the third copy makes the duplication load-bearing. Not blocking — both copies are individually correct and tested.

### 🟢 Praise — The seam respects the dependency rule cleanly

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:70`

Dependency direction is honest throughout: `AIResourceOrchestrator`/`ConversationManager` stay Workshop-agnostic (`retainConversation`/`continueConversation`/`pinConversation` are generic infra capabilities, no upward leakage), `WorkshopSessionService` stays pure and I/O-free (holds `conversationId` as a reference, returns discarded ids for the handler to act on), `ShellService.pickFile`/`PickedFile` is a minimal vscode-free port (`boundaries.test.ts` confirms core imports no vscode), and the `assistantOrchestrator` capture fixes the cross-generation bug structurally rather than patching symptoms. The abstraction earns its keep.

> *"Ownership is honest for two of your three exits from a conversation — tool-run replacement and reset both close the door properly — but excerpt replacement walks right past that seam without knocking, and a conversation that outlives the text it was about is a boundary I can't let go unremarked."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟢 Praise — Retain/continue/discard invariant is genuinely airtight under preemption

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:205`

Went in expecting a leaked or wrong-conversation discard; came up empty. Traced every ordering:
- **Preemption of a tool run:** `preemptActiveRun` aborts the controller → the orchestrator's `wasCancelled` guard is true → the `finally` deletes that run's conversation and returns `conversationId: undefined`. The preempted run resolves through the handler's `cancelled` branch, touches no conversation. No leak, no double-discard.
- **Replacement discard targets the right id:** `previousConversationId` is captured synchronously right before `completeRun` adopts the fresh id (no `await` between), and every retained id is freshly unique, so the `!==` discard can never nuke the live conversation.
- **Zombie after reset:** `completeRun` refuses the stale requestId and the else branch discards the zombie's own new id — verified it can't equal the live session id.
- **Cancelled follow-up leaves history untouched:** the two `addMessage` calls sit inside `if (!cancelled)` with no `await` between them — atomic; stored history stays well-formed `[system,(user,assistant)+]`.
- **Throw-outside-try** (`beginToolRun`/`beginMessageRun`): both defused by a preceding synchronous guard with no `await` before the call.

Zero blocking, zero high. (One out-of-scope thread, already filed tech debt: a mid-session config refresh re-captures `assistantOrchestrator`, so a later discard of an old-generation id no-ops and the pinned conversation in the orphaned generation lingers — bounded memory, not corruption.)

> *"Came in with a lantern expecting a body; found the seams welded shut and the tests standing guard — ship it."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — `continueConversation`'s cancel flag can miss a stream that finishes as abort fires

`packages/core/src/infrastructure/api/orchestration/AIResourceOrchestrator.ts:417`

`continueConversation` sets `cancelled = true` only inside the streaming `catch` when the generator throws an AbortError (`:391–394`). But `OpenRouterClient.createStreamingChatCompletion` never checks `signal.aborted` inside its read loop — a `[DONE]` already sitting in a buffered chunk just hits `return`, no exception, regardless of signal state. Since `finish_reason` and `[DONE]` commonly arrive in the same buffered read, there's a real window between the consumer processing `done:true` and calling `.next()` again where a `controller.abort()` (Stop click, or a preempting follow-up) lands with no AbortError. `cancelled` stays `false`, so `:419–420` append user+assistant to the stored conversation anyway. Meanwhile `WorkshopHandler.handleSendMessage` derives its OWN `cancelled` straight from `controller.signal.aborted` (`:307`) — which *is* true — so it takes the cancelled branch (`abandonRun`, `sendStreamComplete(..., true)`), never showing the reply, on its own comment's explicit assumption (`:311–313`) that the two are in sync. They aren't: the next follow-up's history silently includes a Q&A the user never saw. `executeWithAgentCapabilities`'s retain check a few lines earlier (`:299`) rechecks the *actual* signal rather than trusting an exception-derived flag — the robust version of this exact check, in this same PR, just not reused. Untested (both relevant tests `throw` the AbortError rather than completing cleanly).

### 🟠 High — `handlePickExcerptFile`'s mid-run guard isn't rechecked after the file read

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:443`

The handler rechecks `activeRun` before the picker (`:421`) and again after it resolves (`:436` — "re-check the guard"), but there's a third await between that recheck and the mutation: `fileSystem.readFile` (`:443`, genuinely async — slower on large files, remote/SSH/WSL workspaces, AV scanning), and nothing rechecks `activeRun` after it resolves before `setExcerpt` at `:471`. If `handleRunTool` starts while the read is in flight it snapshots the excerpt via `getExcerpt()` at its own top (so the running analysis itself isn't corrupted), sets `activeRun`, and streams. `handlePickExcerptFile` then resumes, sees no guard, and calls `setExcerpt(...)` — replacing the rail's displayed excerpt while a tool is still analyzing the old one. The completed turn describes the now-invisible excerpt, with zero provenance to explain the mismatch — exactly the failure `handleSetExcerpt`'s own guard comment warns about (`:395–400`), reached through the one async gap the picker path forgot to re-guard. The "refuses to pick a file mid-run" test uses a `pickFile` mock that never resolves, so only the top-of-function check is exercised.

> *"Okay, but what happens if the cancel button lands in the one instant between 'stream's basically done' and 'generator hasn't technically said so yet'? Turns out the conversation remembers a reply nobody saw — and two doors down, the excerpt panel has the exact same 'I checked twice, just not the third time' problem."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — The one real duplicate is the `finally` block, not the whole method [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:358` (twin at `:252`)

Verdict on the bigger question first: **don't merge the two methods** — the tool-run-only bits are honestly different (`handleRunTool` carries ~15 lines of conversation adopt/discard that `handleSendMessage` structurally can't have; `handleSendMessage` carries a `ConversationNotFoundError` catch that `handleRunTool` can't hit). The naming carries its weight too. But the `finally` block is the literal same 8 lines in both, guarding the same invariant ("only the run that still owns the slot may blank the ticker") — with the explaining comment surviving in only one copy. Pull it into `private settleActiveRun(requestId)`. Zero behavior change; the invariant's comment lives once.

### 🟢 Nit — `wasCancelled`'s `||` clause can never fire

`packages/core/src/infrastructure/api/orchestration/AIResourceOrchestrator.ts:299`

Traced `createTerminationContext`/`withTerminationSignal`: `termination.signal` is `undefined` only when *neither* `timeoutMs` nor `signal` was passed — i.e., exactly when `options.signal` is also `undefined`. Whenever `options.signal` is passed, the controller aborts the instant it does, so `options.signal?.aborted` can never be `true` while `termination.signal?.aborted` is `false`. The right-hand `||` is dead in all four combinations. Simplify to `termination.signal?.aborted ?? false` (and rename to `wasAborted` — it's also true on timeout, which is exactly what you want for the retain decision).

### 🟢 Praise — `LiveRun {requestId, phase}` is the derived-state pattern the rest of the sprint should imitate

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:43`

This is what "make illegal states hard to represent" looks like in a hook. Instead of a `currentRequestId` string plus a separate `isSettled` boolean that could drift, identity and lifecycle are one atom — you literally cannot have a settled phase without a requestId. The ref-mirror + single `setLiveRun` setter is a legitimate answer to a real StrictMode problem (one write path, not five), and everything downstream (`currentRequestId`, `isRunning`, `hiddenTurns`, `canFollowUp`) is computed, not stored. Good model for the other domain hooks.

> *"Two of these three findings are about a single boolean or a single `finally` block doing double duty across a file — extract the block, delete the redundant clause, and spend the two minutes you saved admiring `LiveRun`, which is the one place this sprint already did exactly that."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟡 Standard — The cancel wire is only ever exercised against a tool run, never a follow-up

`packages/core/src/__tests__/application/handlers/domain/WorkshopHandler.test.ts:668`

Both cancel-wire tests put the in-flight run in place with `handler.handleRunTool`; grepped the whole tree for a test combining `handleSendMessage` + `handleCancelRequest` — none exists. Sprint 3 is the first time `handleCancelRequest`'s single `activeRun` slot can hold a follow-up (`label: FOLLOW_UP_LABEL`, no `toolId`) instead of a tool run — exactly the cross-entry-point wiring that regresses silently. Confidence MEDIUM only because `preemptActiveRun`/`handleCancelRequest` don't branch on `toolId` at all (they touch `requestId`/`controller`, which both run kinds populate identically), so a break is unlikely, not undetectable. One test that begins a `handleSendMessage` run and cancels it, asserting the signal aborts and the thread ends without a stray assistant reply, closes it for good.

### 🟢 Praise — The continuation seam is proven against the real store [🎯 Consensus]

`packages/core/src/__tests__/application/services/AIResourceOrchestrator.test.ts:476`

The test I doubted I'd find: "a cancelled follow-up leaves the stored conversation untouched" doesn't assert `result.cancelled === true` — it re-reads the real `ConversationManager`'s message array (`toHaveLength(3)`). A sloppy atomic-append would pass a mock assertion but fail this. Its sibling ("an aborted tool run does NOT retain") checks `getActiveConversationCount()).toBe(0)`, proving the conversation is actually gone; the pin test runs `clearOldConversations(-1)` through the *real* reaper. The three hardest invariants in the brief answered with a clean yes.

### 🟢 Praise — The captured-generation regression test asserts on instance identity

`packages/core/src/__tests__/infrastructure/api/services/analysis/AssistantToolService.test.ts:77`

The field bug can only be proven wrong by having two distinct mock orchestrators alive and checking which one fired. `makeOrchestrator('gen-1')`/`('gen-3')` plus the `liveOrchestrator` swap does exactly that — asserting `generation3.continueConversation` was *never* touched while gen-1 received the call is the only version that falsifies the bug (a weaker "called with conv-1" assertion passes under the old buggy code). The refresh-recapture sibling closes the other half of the symmetry honestly.

> *"Confidence level: high on the seams that matter — cancelled-follow-up, aborted-retain, and the generation bug all get checked against real stores and real instance identity, not mock-theater; the one spot I'd flag with a shrug is that the composer's stop button never gets pressed mid-follow-up in a test, and I'll grant it clemency only because the code doesn't know the difference either."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟡 Standard — `seedExcerpt`'s synthetic message breaks the `source` tagging convention it claims to follow

`apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts:148`

The doc comment says `seedExcerpt` routes "the exact same path a webview pin takes" — and it does, for payload and guards, but not for the envelope's `source`. Every genuine `WORKSHOP_SET_EXCERPT` carries `source: 'webview.workshop'` (`useWorkshop.ts`'s `post()` helper stamps it; `MessageHandler.test.ts:205` asserts it). `seedExcerpt` invents `'extension.command.workshop_selection'` — neither `webview.*` (this message is webview-shaped, going through `handleMessage`) nor the established `extension.<domain>` shape. `MessageRouter.ts` and `MessageHandler.ts` both log `message.source`, so this synthetic seed shows up under a return address nothing else uses. Not a runtime break (`handleSetExcerpt` never branches on `.source`), but provenance drift that makes the log trail lie about origin. Pick one shape, not a third.

### 🟢 Nit — `WorkshopHandler.test.ts` is the one handler test file that skipped the sub-`describe` convention

`packages/core/src/__tests__/application/handlers/domain/WorkshopHandler.test.ts:43`

Every sibling handler test groups its `it()`s into nested `describe()`s by behavior area (`AnalysisHandler.test.ts`, `SearchHandler.test.ts`, `ConfigurationHandler.test.ts`, `UIHandler.test.ts`, `MetricsHandler.test.ts` — only the tiny `AccountBalanceHandler.test.ts` skips it). `WorkshopHandler.test.ts` is the *largest* handler test added this sprint — 30 `it()`s from route registration through tool runs, preemption, follow-ups, cancel, file-pick — all flat under one top-level `describe`, with natural seams already present (retention `479–534`, follow-up `546–655`, file-picker `726–814`). The file that would benefit most is the one that doesn't use it.

### 🟢 Praise — `continueConversation`/`discardConversation` extend the orchestrator idiom

`packages/core/src/infrastructure/api/orchestration/AIResourceOrchestrator.ts:349`

Slots in next to `executeWith*` rather than growing a parallel mechanism: same `createTerminationContext`/`withTerminationSignal` seam, the identical for-await-with-AbortError-catch shape used three times already, the same log idiom, the same `ExecutionResult` return (reusing `appendTruncationNote`). `AssistantToolService`'s wrappers mirror `analyzeDialogue`'s structure; `generateRequestId` is a character-for-character match of the module-scoped-counter idiom in `ContextHandler`/`DictionaryHandler`. The `assistantOrchestrator`-capture fix is exactly the boundary bug the "sibling services rebuild ALL bundles" gotcha predicts, fixed at the right layer.

> *"Ninety percent of this diff read like it grew up in this repo — then `seedExcerpt` showed up with a return address nobody else uses, and now `MessageRouter`'s log is going to spend eternity asking 'who's extension.command.workshop_selection?'"* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — Client-side `turns` list is unbounded and fully re-scanned every broadcast

`packages/core/src/presentation/webview/hooks/domain/useWorkshop.ts:220`

New in this diff (replaces Sprint 2's wholesale `setTurns`), and a fair fix — a windowed host snapshot would otherwise shrink a longer client thread. But the side effect: `prev` (the webview's retained turn list) never shrinks for the session's life, and every `WORKSHOP_SESSION_STATE` broadcast pays an `O(prev.length)` filter over it; `handleTurn`'s dupe guard (`:249`) does the same `O(prev.length)` `.some()` per completed turn. At documented scale (tens-to-hundreds of turns) this is comfortably sub-millisecond — call it ~80k `Set.has`/`.some` checks over an entire marathon session, i.e. noise. Flagged only because it's the client-side mirror of the exact problem `WORKSHOP_SNAPSHOT_TURN_WINDOW` already solved host-side: the host bounds the *wire*, nothing bounds what the client *retains*. Same "documented, Deferred" bucket as token-history growth — revisit if a thread is ever left running to the thousands in one sitting.

### 🟢 Praise — Snapshot broadcast is O(window), not O(history), and never touches the token clock

`packages/core/src/application/services/WorkshopSessionService.ts:219`

`slice(-100)` + `map(cloneTurn)` costs O(100) regardless of history length, and every call site (`postSessionState()`) fires at run-begin/run-end and one-shot mutations — ~2× per turn, never per-token. Cheap *and* rarely invoked, the two best properties a hot-path fix can have (and this isn't even a hot path). This windowing landed in PR #67; #68 only added the O(1) `hasConversation` field — confirmed for the record that Sprint 3 didn't quietly break it.

### 🟢 Praise — `excerptWordCount` memoization verified intact — not regressed

`packages/core/src/presentation/webview/WorkshopApp.tsx:172`

`cloneExcerpt` allocates a fresh excerpt object every `getSnapshot()`, and `handleSessionState` calls `setExcerpt` unconditionally per broadcast — so `workshop.excerpt` gets a new reference ~twice per turn, which would bust a naive `useMemo([workshop.excerpt])`. Pulling `.text` to a bare string first means the dep compares by *value*, so the O(excerpt-length) word-split still recomputes only on an actual re-pin, exactly as PR #67 #11 intended. Verified, not guessed.

> *"The host learned to stop re-reading its own diary every page turn — the client's still re-reading the whole thing from page one, it's just that at chapter three nobody notices the extra half a millisecond."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟡 Standard — "Pin from file…" reads and fully decodes the file into memory before any size check

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:443`

`VsCodeFileSystem.readFile` is a bare pass-through to `vscode.workspace.fs.readFile` — the whole file becomes one `Uint8Array`, no cap. The handler then decodes the entire buffer to a JS string (`:444`) and only afterward calls `countWords` (`:460`), which splits the full string; the head-slice guardrail is *words*, applied strictly after the full read + full decode. The picker's filter includes `'All files': ['*']` (`:428`), so nothing stops a user selecting a multi-hundred-MB or multi-GB file (a log dump, a misclicked video, an oversized doc). Worst case: full read → full UTF-16 decode (~2× for ASCII) → one or two full-file word arrays, all in the extension-host process — an OOM there takes down every other extension in that host. Practical and reproducible today, but the blast radius is entirely the user's own machine and own action — a hardening gap, not a High. Cheap fix: `fileSystem.stat()` (already on the port) before `readFile`, reject/warn past a byte ceiling — gate on bytes, not words-after-the-fact.

### 🟡 Standard — Out-of-workspace file picks put the raw absolute path in the header and log

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:470`

`Workspace.asRelativePath` passes straight through to `vscode.workspace.asRelativePath(uri, false)`, which returns the path effectively unchanged when it's outside every workspace folder — so any file pinned from outside the workspace (which this picker allows) yields a full OS-absolute path, typically carrying the OS username (`/home/<user>/…`, `C:\Users\<user>\…`). That renders verbatim in the Workshop header (`WorkshopApp.tsx:209`) and logs to the Output channel (`:472–474`). (`sourceUri` is also stored but never rendered — so `relativePath` is the only exposing surface.) Low practical severity in a single-user local tool, but a realistic disclosure the moment someone screen-shares, demos, or screenshots for a bug report — the same field is clean for in-workspace files. A basename-only or explicit "external file" fallback closes it without losing provenance.

> *"Nothing here is a breach — the only adversary in this threat model is a fat-fingered file picker — but 'decode the whole file before you know its size' and 'put my home directory in the header' are exactly the quiet, self-inflicted corners that turn a happy path into a bad demo day."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟡 Standard — Cancel requests that don't match the active run vanish with zero trail

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:374`

`handleCancelRequest` is brand-new this PR. Every other guard branch in this file logs (empty text, missing conversation, mid-run re-pin all route through `sendError`, which logs unconditionally). This is the exception: if `domain !== 'workshop'` or the incoming `requestId` doesn't match `activeRun` (a plausible race — Stop clicked just as the run finishes, a double-click, a stale message after preemption cleared `activeRun`), the method returns having logged nothing; only the successful-match branch gets a line. Benign today, but it means "I hit Stop and it kept going" is unanswerable from the output channel — you can't tell "the message never arrived" from "it arrived but the ids didn't line up," because both look identical (silence). One `appendLine` in the miss case closes the gap.

### 🟢 Nit — Empty-file guard logs the failure but not which file

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:451`

`sendError` always logs, so this is honestly surfaced — just anonymously. `picked.fsPath` is in scope (used two branches later for the truncation log) but isn't passed as `details` here, unlike the read-failure catch right above it which does thread its context. Try a couple of files back-to-back and the log can't tell you which was empty. Pass `picked.fsPath` as `details`.

### 🟢 Praise — `sendError`'s log-and-surface coupling makes "silently wrong vs. honestly broken" a non-question

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:612`

Every error shown to the user in this handler is also a log line — there's no path where the error rail fires without a matching `appendLine`. On top of that the non-error trail is genuinely good: preemption (`:532`), cancellation (`:192–194`, with requestId + label + discarded-char count), zombie completions (`:234–236`), conversation replacement (`:225–227`, `oldId → newId` + tool label) all carry real correlation. The `ConversationNotFoundError` catch (`:339–351`) is the whole pattern working together — requestId and conversationId both logged, session state honestly cleared instead of a silent cold-restart, a truthful user message instead of a mystery retry. This is what I want to inherit when it's my pager going off.

> *"Ninety percent of this file leaves a note before it goes dark — I can live with the ten percent, but I'd still like the Stop button to say something before it goes quiet too."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟠 High — Retained history can diverge from what the user saw when a tool run maxes out its guide-request loop

`packages/core/src/infrastructure/api/orchestration/AIResourceOrchestrator.ts:293, 301`

AC1 promises a follow-up "reflects the prior turn (genuine continuation)" — and the new suite proves it beautifully for the common path (`[system,user,assistant,user]` with the retained assistant content intact). But the retain block stores the *raw* `last.content` into history, not the `cleanedResponse` that `stripResourceTags` produces two lines earlier and that the UI actually renders. There's already a same-file test showing these diverge: *"should stop at MAX_TURNS (3) even if AI keeps requesting guides"* (`:153`) — when the guide loop is cut off mid-request, `cleanedResponse` becomes `''` while `last.content` keeps the literal tag. That test doesn't use `retainConversation`, so the combination is untested — but if a Workshop tool run hit the same edge, the history handed to the *first* follow-up would carry a dangling, un-fulfilled `<guide-request>` tag as the assistant's "prior turn" while the user's screen showed an empty/truncated bubble. Model memory and user transcript tell two different stories on the very next message. Narrow trigger (needs a guide-hungry model exhausting 2 fulfillment rounds and still asking), so not blocking — but a real, untested gap in the "genuine continuation" contract, and a one-line fix (retain `cleanedResponse`).

### 🟡 Standard — `relativePath` never renders in the excerpt block itself, only the header subtitle

`packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx:63`

The AC says pinning a file shows `relativePath` "in the header subtitle **and excerpt block**." Confirmed via `git diff`: the Sprint 3 changes add the truncation paragraph and the "Pin from file…" buttons, but `ExcerptPanel.tsx` (the "Working Excerpt" block) never reads `excerpt.relativePath` — only `excerpt.text` and, conditionally, `excerpt.truncation`. `relativePath` renders exactly once, in `WorkshopApp.tsx:209`'s header. Not a file-picker regression — editor-selection seeding has the identical gap (both share the same model and single render site) — so it reads more like aspirational AC text than something this PR broke. The header sits directly above the rail, so a user is unlikely to be confused; flagging because the AC text is unambiguous about two locations and the code has one.

### 🟢 Praise — The continuation seam is pinned by a test that asserts business behavior [🎯 Consensus]

`packages/core/src/__tests__/application/services/AIResourceOrchestrator.test.ts:449`

Rather than asserting `continueConversation` was "called," the suite runs against a REAL `ConversationManager`, seeds an actual retained conversation, sends a follow-up, and inspects the literal message-role sequence handed to the model — directly verifying AC1's "genuine continuation, not a cold restart" in domain language. The siblings (cancelled follow-up leaves history untouched, discarded conversation throws the typed error, post-discard run gets a fresh id) map one-to-one onto the documented conversation policy. This is the acceptance criteria, executable.

> *"The follow-up loop does exactly what the ticket promised in every case the tests bothered to check — I just went looking for the one corner nobody checked, and found where the model's memory and the user's screen quietly stop agreeing with each other."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — Two Scribes, One Ledger

Illuminated by: Sam's cancel-race, Bria's raw-content

When the same fact is written down by two independent hands — what the model remembers, what the user saw — it does not stay consistent out of good intentions. It stays consistent only when one view is *derived* from the other. Both High findings are the same bug in different coats: the stored thread and the visible thread were computed by separate paths, so they were free to disagree, and the disagreement stays silent until a later turn makes the model recite a Q&A the human never witnessed. That is not a rendering bug; that is the code quietly gaslighting its own user.

→ Carry forward: When you persist a copy of something the user also sees, name the single artifact both are views of — then derive both from it, rather than each computing its own truth.

### Lesson 2 — Every Await Is a Door

Illuminated by: Sam's excerpt-swap (the un-re-checked third await), Sam's cancel-race timing

An `await` is not a pause; it is you setting down the tools and stepping out of the room. The board you measured before you left can be swapped while you're gone — a run can start mid-`readFile`, a stream can finish in the very instant an abort fires. `handlePickExcerptFile` re-measures before the picker and after the picker, then cuts after the file read without measuring again: two doors guarded, the third left open. State you validated before a suspension point is a memory on the far side of it, not a fact.

→ Carry forward: At each await, ask "what did I assume before this line that another turn could invalidate while I'm suspended?" — and if it's load-bearing, re-check *after*, not only before.

### Lesson 3 — A Comment Is a Wish; a Type Is a Vow

Illuminated by: Marcus's un-severed conversation, Parker's LiveRun praise

When two pieces of state must move together, prose that says so is a hope, not a hinge. This one PR shows both faces: `LiveRun {requestId, phase}` fuses identity and lifecycle into a single atom so an illegal state literally cannot be spelled — while `setExcerpt` and `conversationId` stay two independently-mutable fields that the ADR treats as coupled and the code lets drift, so you can swap the excerpt and keep reasoning about the old one. A documented invariant is exactly as strong as the next engineer's memory of having read the document.

→ Carry forward: When you write "these two always change together" in a comment or ADR, treat it as a design smell — ask whether the type system can make them inseparable so the sentence becomes unnecessary.

### Lesson 4 — You've Already Solved It Once

Illuminated by: the panel's cross-cutting note — Sam's `wasCancelled` recheck, the mid-run guard, Marcus's unused discard seam

In a codebase this mature, the dangerous bug is rarely the problem you couldn't solve — it's the one you solved cleanly ten lines away and didn't recognize recurring. The robust recheck existed in `executeWithAgentCapabilities`; the re-guard existed around the picker; the discard seam existed in reset. Every gap here is a place an established mitigation wasn't carried to a structurally identical trigger. You learned to taste for salt at one station and plated three others without tasting — the technique was already in your hands.

→ Carry forward: The moment you write a guard, a recheck, or a teardown, grep for its siblings — "how many other sites have exactly this shape?" — before you move on.

### Lesson 5 — Guardrails Lag the Road

Illuminated by: Cal's untested cancel wire, Oliver's silent miss-path

The surface you added this sprint is the one you understand least and have defended least — and it is carrying traffic today. The cancel wire is brand-new, and it is simultaneously the least-tested (never fired against a follow-up, the first sprint the single run-slot can even hold one) and the least-observable (its miss branch returns with zero log). New capability and new blind spot ride in on the same commit, and "I hit Stop and it kept going" becomes a question the output channel cannot answer.

→ Carry forward: Before merging any brand-new control surface, ask two questions *of that surface specifically*: "what's the first test that fails if this breaks?" and "when a user says it didn't work, which log line proves what actually happened?"

> *"Code, like a conversation, is only ever as trustworthy as the agreement between what it remembers and what it showed you — tend that one seam faithfully, and most of the ghosts never wake."* — Sensei

---

## The Closer

### 🚪 Knock knock

> Knock knock.
> *Who's there?*
> Conversation.
> *Conversation who?*
> Exactly — that's what the first follow-up said, right up until you captured the orchestrator generation.

---

## Summary

**Nearly there — a confident, well-tested PR with a short, coherent punch list.** Zero blocking: Blake traced the retain/continue/discard invariant airtight under every preemption ordering, the seam's layering is clean (Marcus), the tests check real stores and instance identity rather than mock-theater (Cal), and performance is genuinely bounded (Tim). The four High findings are all narrow-trigger and mostly one-line fixes — and three of them rhyme: *the stored conversation and the user-visible thread are maintained by two paths that can silently disagree* (Sam's cancel-race, Bria's raw-content) plus excerpt-replacement not severing the conversation (Marcus). Land those four, add the cancel-wire test and its miss-path log, and gate the file read on bytes, and this merges clean. Nothing here is rot — it's a mature seam with a few doors that were guarded twice and cut on the third.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
