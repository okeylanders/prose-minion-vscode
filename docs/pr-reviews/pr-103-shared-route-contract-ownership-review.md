# PR Review — Sprint 02: Shared Route and Contract Ownership

**Author:** okeylanders · **PR:** [#103](https://github.com/okeylanders/prose-minion-vscode/pull/103) (Open)
**Branches:** `sprint/workshop-architecture-refactor-02-shared-ownership` → `epic/workshop-architecture-refactor`
**Base:** `0f35294` · **Head:** `fbaeb23` · **Scope:** 43 files · +2,163 / −572
**Reviewed:** 2026-08-04 · **Mode:** `/mr-review` — PR mode, Forge crew (10 specialists + Sensei)

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Signal | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Overlapping removals overwrite the single `pendingRemovalRef`; the ack that actually removed the directive is discarded and the writer sees "was already removed" | Sam | 1 independent | **Addressed** — token-keyed pending removals settle independently; duplicate same-family requests are refused and each pending rail row is disabled |
| F-02 | 🟠 High | Correlation makes mismatched acks silent by design — no toast, no log, no timeout, no spinner reset, across three hooks | Oliver | 1 independent (same seam as F-01) | **Addressed** — all three owners log rejected relevant acks; standing removals also time out after 10 seconds, release pending UI, and show an error toast |
| F-03 | 🟡 Standard | `widgetIdForFamily` runs outside the `try` on the one route whose contract is "always answer"; a registry miss posts no ack at all | Blake, Patricia | 🎯 2 independent | **Addressed** — lookup moved inside the response guard; unknown registry families fail with a domain error and still receive a correlated failure ack |
| F-04 | 🟡 Standard | Standing rail still imports the application-layer operations singleton directly, dragging ~526 lines of backend validation into the webview bundle | Marcus, Tim | 🎯 2 independent | **Addressed** — summary formatting now reaches the rail through `useWorkshopStandingDirectives`; the rail no longer imports the backend operations/validation graph |
| F-05 | 🟡 Standard | The new registry claims to mirror `WorkshopWidgetConfigOperations` but uses a mapped type + `satisfies` + an unsafe cast where the exemplar uses `switch` + `never` | Parker | 1 independent | **Addressed** — apply preparation now uses an explicit request union plus exhaustive `switch`/`never` dispatch, with no cast |
| F-06 | 🟡 Standard | Five near-identical family/widgetId narrowing guards with five different error strings in the Lexical operations entry | Parker | 1 independent | **Addressed** — identity and rendering narrowing now live in two shared checked helpers used by every operation |
| F-07 | 🟡 Standard | The handler's own cross-widget guard has no test forcing it to fire — the mock always returns a matching `widgetId` | Cal | 1 independent | **Addressed** — regression forces a cross-widget result and asserts the failure ack plus committed-state resync |
| F-08 | 🟡 Standard | `useWorkshopStandingDirectives` omits the tripartite `State` interface every sibling hook exports | Stan | 1 independent | **Addressed** — exported State/Actions/Persistence now expose the pending widget identities as domain state |
| F-09 | 🟡 Standard | Post-commit identity guard in `handleApply` throws after the atomic mutation lands and skips `postSessionState` — carried forward unchanged from pre-PR code | Sam | 1 independent | **Addressed** — committed turn/session/dirty state is synchronized before the defense-in-depth identity guard can reject the ack |
| F-10 | 🟢 Nit | `describe()` renders a full prompt frame just to log its length, and re-checks a condition its callee already threw on | Tim, Parker | 🎯 2 independent | **Addressed** — description uses the checked config's lens, weight, and reach without rendering a prompt frame |
| F-11 | 🟢 Nit | The `onBlocked` path is the one failure path in the new handler that never touches the output channel | Oliver | 1 independent | **Addressed** — blocked apply/remove mutations log the action and gate reason before posting the failure ack |
| F-12 | 🟢 Nit | The sprint landed as one commit though ADR §9 forbids moves and behavior changes sharing a commit, and the sprint doc planned six reviewable slices | Ada (orchestrator) | 1 independent | **Deferred** — the reviewed commit is already published; resolution work lands as a separate commit rather than force-rewriting PR history |
| F-13 | 🟢 Praise | Exactly one action result per request token on every exit path, including the mutation-gate rejection path; feature literals crossed into generic code as data, not defaults | Blake | 1 independent | **N/A** |
| F-14 | 🟢 Praise | The pre-implementation runway's risk list (F1/F2/F5/F6/F7/F8) is genuinely closed, verified against the diff rather than the sprint doc's checkmarks | Marcus | 1 independent | **N/A** |
| F-15 | 🟢 Praise | Correlation tests assert *rejection* of stale and foreign acks, not just acceptance of matching ones | Cal | 1 independent | **N/A** |
| F-16 | 🟢 Praise | The second-family fixture drives a synthetic family through the real injected seam rather than asserting on file diffs | Cal | 1 independent | **N/A** |
| F-17 | 🟢 Praise | Config-edit ownership is enforced server-side against the session, never trusted from the payload | Patricia | 1 independent | **N/A** |
| F-18 | 🟢 Praise | Diagnostic detail from the old feature handler survived the extraction intact | Oliver | 1 independent | **N/A** |
| F-19 | 🟢 Praise | Zero gaps between the sprint's stated requirements and the code, including the D2 union, the ledger P2→P6 move, and the ADR §1 feature freeze | Bria | 1 independent | **N/A** |

---

## Resolution notes

Resolved 2026-08-04. Focused verification covers concurrent and duplicate removals,
acknowledgement rejection and timeout visibility, runtime registry misses, the
post-commit cross-widget guard, rail pending state, and the closed-registry
architecture witness. F-12 remains historical: preserving published review
history is safer than force-rewriting the branch after review.

---

## Blast Radius

- 43 files · +2,163 / −572 · **1 commit**
- New production files: 5 · New test files: 3 · Migrations: none · Persisted shapes: **unchanged**
- Composition root (`extension.ts`): **untouched**, as the sprint promised
- Wire contract: 4 message renames, 5 payload unions, 1 new correlation field — free under alpha rules

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B+ |
| 🛡️ Security | B |
| 🧪 Tests | B+ |
| 📖 Quality | B− |
| ⚡ Performance | B |
| 🎯 Domain | A |

---

## Executive Briefing

🟠 **[Sam]** **Overlapping removals drop the acknowledgement that mattered** — a single `pendingRemovalRef` is overwritten by a second `remove()`; the first result (the one that actually removed it) is discarded and the writer sees "was already removed."

🟠 **[Oliver]** **Correlation made mismatched acknowledgements silent by design** — no toast, no log, no timeout, no spinner reset. Three silent-drop sites created by one new pattern.

🟡 **[Blake + Patricia]** 🎯 **`widgetIdForFamily` runs outside the try** on the one route whose entire contract is "always answer." Unreachable today; wrong shape regardless.

🟡 **[Marcus + Tim]** 🎯 **The rail still reaches past its own hook into application services** — and Tim traced the cost: ~526 lines of backend validation code dragged into the webview bundle to reach one formatter.

🟡 **[Parker]** **The registry doesn't read like the registry it claims to mirror** — mapped type + `satisfies` + an unsafe cast, over a single-member union, where the exemplar next door uses a `switch` and a `never`.

---

## 🏛️ Marcus · Architecture & Design

### 🟡 Standard — Rail component still reaches past Domain Hooks into Application services [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopStandingDirectiveRail.tsx:8`

The `onRemove` path is genuinely fixed — D1's presentation-side ownership gap is closed. But `directiveConfig` still imports `WORKSHOP_STANDING_DIRECTIVE_OPERATIONS`, an application-layer singleton, and calls `.formatSummary()` at render time. Not a new violation — the prior code imported `formatLexicalGravitySummary` from the same layer — but this PR touched this exact import line and had the natural opening to route formatting through `useWorkshopStandingDirectives` alongside `remove` and `handleActionResult`, finishing D1's "both sides" story instead of half-finishing it.

### 🟢 Praise — The runway's risk list is genuinely closed, not claimed closed

I traced each HIGH/MED risk from the pre-implementation runway against the diff rather than the sprint doc's checkmarks. F8: the handler echoes the request's own identity on failure instead of defaulting to `'lexical-gravity'`. F2: both feature hooks gate on `requestToken && widgetId`. F5: Frames, Presentation, and the rail all delegate to the closed registry — no `if`/`throw`, no silent `default: return ''`. F6: `WorkshopWidgetRuntime.standingDirectives` is a sibling, not nested under Lexical. F7: the exception ledger was updated in the same commit rather than silently dropped. This is the rare refactor PR where the "what we found vs. what we shipped" story holds up under an independent read.

> *"The bones here were mapped before they were built, and for once the load-bearing walls match the blueprint — my only nit is a rail component still borrowing the application layer's phone instead of dialing through the hook standing right next to it."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

### 🟡 Standard — `handleRemove` resolves widget identity outside the try [🎯 Consensus]

`packages/core/src/application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts:103`

Every other ack-bearing statement in this file is inside a try that guarantees exactly one `WORKSHOP_WIDGET_ACTION_RESULT`. This one is not. `widgetIdForFamily` is `entries[family].widgetId` — an unguarded index. Contrast `handleApply`, where the equivalent `prepareApply(...)` is correctly inside the try. Not reachable today: `WorkshopStandingDirectiveOperationEntries` is a `Record<Family, Entry>`, so a missing entry fails to compile. Searched diff for a test covering an unmapped family on remove — not found. One-line fix. Not a merge blocker; it is the one asymmetry on a path whose whole contract is "exactly one ack."

### 🟢 Praise — Correlation covers the blocked-mutation path, where this bug class usually hides

The `registerMutation` 4th-parameter change from `(message: string)` to `(reason, message)` is what makes the gate path correlatable. I traced every exit from `handleApply`, `handleRemove`, and `handleCommit` — including `onRoomAccepted` → later failure, guarded by the `accepted` flag: exactly one action result per request token on every path. The transaction kernel is untouched. And the feature literals that moved into generic code moved as **data** on the request (`editConflictMessage`, `alreadyActiveMessage`), not as defaults. That's the correct shape.

> *"One unguarded lookup on the only path whose whole job is 'always answer.' Move it two lines down and I'll go back to bed."* — Blake

---

## 🔍 Sam · Bug Hunter

### 🟠 High — Single `pendingRemovalRef` drops the acknowledgement for an in-flight removal

`packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.ts:47`

`remove()` unconditionally overwrites the ref; `handleActionResult` only accepts an ack matching the *current* value. The rail's button has no per-item in-flight disable — `disabled` is the global `showLiveTurn || roomMutationLocked`, and `roomMutationLocked` tracks runs, wizards, and session actions, **not** a pending removal. So: click 1 → `ref = tokenA`; click 2 before the ack → `ref = tokenB`. The backend serializes correctly and posts `{tokenA, removed: true}` then `{tokenB, removed: false}`. The tokenA ack — the one that actually did the work — fails the identity check and is silently discarded. The writer sees "was already removed." No data corruption; the acknowledgement UX just lies about which request changed state. Worth a queue or in-flight guard before a second family makes this rail routinely show 2+ removable directives.

### 🟡 Standard — Throw-after-commit skips the resync

`packages/core/src/application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts:72`

By the time `directives.apply()` resolves, `commitStandingDirectiveMutation` has already run. If this guard fired, the catch posts `ok: false` but never calls `postTurn`/`postSessionState`/`markDirty` — session mutated, client told it failed, no resync. The pre-PR code has the identical shape in `WorkshopLexicalGravityHandler.handleApply`. **Carried forward, not introduced.** Flagged at Standard because today's single-entry registry makes it unreachable — but it's exactly the trap a second family's new wiring could hit.

> *"Found the trap door on the remove rail — it's not the empty-list case, it's the two-carts-on-one-track case: fire remove twice before the first ack lands, and the ref that's supposed to remember 'who I'm waiting for' just forgets the first cart entirely."* — Sam

---

## 📖 Parker · Code Quality

### 🟡 Standard — Registry style diverges sharply from the convention it names

`packages/core/src/application/services/workshop/directives/WorkshopStandingDirectiveOperations.ts:18-27, 106-118`

The sprint doc calls this "a closed registry mirroring `WorkshopWidgetConfigOperations`," but they don't read alike. The exemplar is a plain object of functions with `switch (input.widgetId) { … default: return unsupportedConfig(input) }` — compiler-verified `never` fall-through, no casts. This file uses a mapped type keyed by `Payload['widgetId']`, a `satisfies`-typed preparer record, and — because TS can't call a union of narrowed signatures — casts the lookup back to a non-narrowed one. That cast is exactly what the neighbouring `switch`/`never` avoids for free, and `WorkshopApplyStandingWidgetPayload` currently has **one** member, so all this machinery type-checks a single-key object. Drop the mapped type and dispatch with the same `switch` shape: same exactness, zero casts, reads like its neighbour.

### 🟡 Standard — Five near-identical family guards in the Lexical entry

`packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityStandingDirectiveOperations.ts:20-25`

`render`, `summarize`, `markerContent`, `formatSummary`, and `describe` each re-derive the same narrowing with slightly different member lists and error text ("has the wrong config" / "has the wrong identity" / "cannot format"). One piece of knowledge encoded five ways; a sixth method can silently forget it. A single `asLexicalGravityDirective(directive, config?)` helper says it once.

### 🟢 Nit — `describe()` does redundant work, twice over

`packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityStandingDirectiveOperations.ts:82-86`

Parker: `renderLexicalGravityDirective` already throws on a wrong `widgetId`, so the re-check right after is dead on the failure path. Tim: it also renders the *entire* prompt frame purely to report `frame.length` in a log line.

> *"The apply-preparer needs a mapped type, a `satisfies`, and an unsafe cast to do what its neighbour does with a `switch` and a `never` — that's not exactness, that's a costume for exactness."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

### 🟡 Standard — The handler's own cross-widget guard has no test forcing it to fire

`packages/core/src/application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts:71-73`

This is defense-in-depth against a service bug making one family's apply settle another's config — directly on-point for the sprint's own "cross-feature acknowledgements cannot settle another feature" criterion. The only `handleApply` test mocks `directives.apply` to always return a matching `widgetId`, so the branch never executes. A regression that dropped or reworded this check would go undetected.

### 🟢 Praise — Correlation tests assert rejection, not just acceptance

`packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.test.ts:45-70`

Both the standing hook and `useLexicalGravity` tests fire a stale-token result **and** a wrong-widgetId result, assert nothing settles, and only then send the matching one. That's the harder, more valuable half of a correlation test — most PRs prove only that the happy path settles. This one proves the trapdoor and the railing.

### 🟢 Praise — The second-family fixture exercises the real seam

Rather than asserting on file-diff line counts (which the epic criterion literally names), the test drives a wholly synthetic `prose-controller` family through `apply`/`remove` using only the injected operations seam. Combined with the `Record<WorkshopStandingDirectiveFamily, …>` typing — genuinely exhaustive, a new family without an entry fails to compile — that's real confidence the registry is closed and extensible, not a passing string-scan.

> *"The stale-token check isn't decoration here — I traced it, and it actually gets asserted false before the real one gets asserted true. Now go write the one test that watches your own guard clause throw."* — Cal

---

## 🗂️ Stan · Codebase Standards

### 🟡 Standard — `useWorkshopStandingDirectives` skips the tripartite State interface

`packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.ts:24`

Every other domain hook exports all three interfaces even when one is empty — including this file's own sibling `useWorkshopWidgetHost.ts`, which exports `State`, `Actions`, and `Persistence` at lines 11, 17, 23. `WorkshopWidgetHostPersistence` is declared empty with an explanatory comment, and that comment is reused verbatim here for Persistence — but State is dropped entirely, and the composed return type is `Actions & { persistedState }`. `CLAUDE.md` documents the pattern as all three, always exported.

> *"We already have the 'declare it empty and comment why' move sitting right there in this same file for Persistence — just apply it to State too."* — Stan

---

## ⚡ Tim · Performance

### 🟡 Standard — The rail pulls backend validation code into the webview bundle [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopStandingDirectiveRail.tsx:8`

Before this PR the rail imported only `formatLexicalGravitySummary` — a pure formatter. Now it imports the `WORKSHOP_STANDING_DIRECTIVE_OPERATIONS` singleton, built from the Lexical entry, which does a **value** import of `validateLexicalGravityDraft` from `LexicalGravityConfigCodec.ts`. The import carries no `type` keyword and `validateLexicalGravityDraft` is called inside `prepareApply` on a live registry entry, so it cannot be tree-shaken. That's `LexicalGravityConfigCodec.ts` (308 lines) plus its downstream `persistedValidation.ts` (218 lines) newly reachable from the webview bundle, to get at one formatting function. No runtime cost at this scale — two families, one directive each. Pure bundle weight plus a layering smell.

> *"Two families, one directive each — the math says this is free today. The bundle-size math says otherwise, and nobody's paying that in a profiler."* — Tim

---

## 🛡️ Patricia · Security

### 🟡 Standard — `family` is dereferenced into the registry before any validation [🎯 Consensus]

`packages/core/src/application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.ts:101-104`

`message.payload.family` arrives off the webview→host IPC boundary as `unknown` at runtime — the type is compile-time only. `widgetIdForFamily` indexes the closed registry with no guard, *before* the try. The throw propagates to `MessageHandler.handleMessage`'s top-level catch, which is why this isn't Blocking — the host never crashes. The narrower real consequence: no `WORKSHOP_WIDGET_ACTION_RESULT` is posted, so `pendingRemovalRef` is never cleared and the specific toast never fires; the writer sees only a generic error banner. Practical risk is low — no hostile third party, only our own bundled webview originates these. A stale webview bundle after a partial reload would hit exactly this path.

### 🟢 Praise — Config-edit ownership is correctly scoped

`packages/core/src/application/services/workshop/directives/WorkshopStandingDirectiveService.ts:60-69`

A caller-supplied `widgetConfigId` is accepted for in-place revision only if it matches `active.widgetConfigId`, where `active` is looked up server-side via `session.getStandingDirective(family)` — never trusted from the payload. Combined with the `widgetConfigInput.widgetId !== widgetId` check above it, cross-family config confusion is genuinely hard to construct.

> *"The registry lookup trusts the wire before the try block does — the top-level catch saves the host, but not the toast the user was waiting for."* — Patricia

---

## 🌙 Oliver · Observability

### 🟠 High — Stale/mismatched tokens are dropped with zero trail anywhere

`packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.ts:60`

The early-`return` is the entire fate of a non-matching acknowledgement — no toast, no state update, nothing posted back for the `LogSink` to catch. Before this PR, `useLexicalGravity` set `actionResult` unconditionally, so an ack was always visible even if occasionally stale. Correctness improved; the failure trail got **worse**. The refs back the correlation but aren't wired to any loading state, so a writer who clicks remove and gets no ack sees nothing: button doesn't reset, no error, no timeout. Same shape in `useLexicalGravity` and `useGesturePlayground` — three silent-drop sites from one new pattern.

### 🟢 Nit — The `onBlocked` path never touches the output channel

Unlike every other failure path in the new handler, which routes through `errorMessage()` and logs. The writer does get a clear toast, and this mirrors the pre-existing session-mutation pattern, so it's not raised higher — but the handler is new and could have closed the gap while it was being written.

### 🟢 Praise — Diagnostic detail survived the move intact

Compared against the pre-PR `WorkshopLexicalGravityHandler.handleApply` line for line. Revision number, directive-id → config-id mapping, and the feature-supplied `describe()` detail ("lens X, N chars") all made the trip to the generic handler unchanged. This is exactly the kind of extraction where detail quietly evaporates, and it didn't here.

> *"The host logs like a good citizen; the webview just lets the ack vanish into the void, no note left behind."* — Oliver

---

## 🎯 Bria · Domain Logic

**No findings.** Every questioned area was traced against the diff and each implementation matches its stated requirement: D2's commit payload is a genuinely extensible union, not silently collapsed. The `apply-standing`/`remove-standing` `widgetId` asymmetry is correctly explained by the persisted-shape constraint — the config union has no Prose Controller arm, the family union does. The exception ledger's P2→P6 move matches the sprint doc's deferred list exactly. The Prose Controller registry entry refactors pre-existing placeholder throw behavior rather than shipping new feature logic, so ADR §1's freeze holds. The mutation-gate rejection paths never hardcode `'lexical-gravity'`.

> *"I went looking for the trapdoor between 'family-generic' and 'secretly Lexical' — turns out this crew actually welded it shut."* — Bria

---

## 🎓 Sensei · The Teacher

### Lesson 1 — Precision at the boundary is not free; it's paid for in visibility

Illuminated by: Sam's overlapping removals, Oliver's silent drops

Token correlation made the system more *correct* — a stale ack can no longer overwrite live state — but correctness and observability are different axes, and improving one can starve the other. Before, a wrong-but-visible update at least told you something happened. Now a mismatched ack returns early and tells you nothing. The mechanism went from "sometimes wrong" to "sometimes silent," and silent is the worse failure mode: nobody notices until a writer says "I clicked remove and nothing happened."

→ Carry forward: whenever you add a guard whose job is to *reject* something, ask out loud — when this branch fires, does anything see it? If no, it needs a log line or a UI signal before it ships.

### Lesson 2 — The runway finds what you thought to name, not what the fix introduces

Illuminated by: F1–F9 closing cleanly, while both HIGH findings arise from the mechanism the runway prescribed

A risk runway is a map of anticipated terrain. It's excellent at confirming known cliffs were fenced. It cannot see the cliff the fence itself creates, because the fence didn't exist when the map was drawn. Correlation-by-token was the runway's own answer to an earlier risk, and both HIGH findings are second-order consequences of that answer — not gaps in the original analysis. That isn't a failure of the process; it's the boundary of what pre-implementation analysis can do at all.

→ Carry forward: after implementing a mitigation, run one more pass asking "what new failure mode does *this fix* introduce?" Treat the mitigation as fresh code deserving its own mini-runway, not a checkbox against the original risk.

### Lesson 3 — A thing that calls itself a mirror should survive being held up to one

Illuminated by: Parker's registry-pattern and five-guard findings

When code declares an intent — "mirrors `WorkshopWidgetConfigOperations`," "closed registry" — that declaration becomes a contract with the reader, and a mapped-type-plus-cast reads very differently from the exhaustive switch it claims kinship with. Likewise, five hand-written narrowing guards with five different error strings aren't five domain decisions. They're one type-system demand answered five times by hand, which means one true guard and four impostors waiting to drift.

→ Carry forward: when you claim a file mirrors another, open the exemplar side by side before committing. When a guard repeats near-verbatim, ask whether the compiler asked once and you answered N times.

### Lesson 4 — A route whose contract is "always answer" earns its own paranoia

Illuminated by: Blake and Patricia both flagging the pre-try registry lookup

Two reviewers from different lanes converged on the same three lines without coordinating — a strong signal the code is teaching something structural. When every statement in a function lives inside a try except one, the exception isn't a style choice; it's a seam where the function's implicit promise quietly stops being true. That it's unreachable *today* doesn't change the shape of the promise. It just means the crack hasn't been walked on yet.

→ Carry forward: in any handler whose contract is "always respond," treat every statement between request-received and response-sent as inside the try by default. Moving something out should be deliberate and named, not a leftover of typing order.

### Lesson 5 — A sprint plan is a promise about reviewability

Illuminated by: six planned slices landing as one commit, against the ADR's own moves-≠-behavior rule

A plan naming six independently reviewable slices makes an implicit claim to future reviewers and to future-you running `git blame`: you will be able to isolate cause from consequence here. Collapsing it into one commit doesn't undo the work, but it spends the plan's most valuable asset — bisecting intent from implementation later, when the reason for a line is no longer in anyone's head.

→ Carry forward: when a plan commits to N reviewable slices, treat commit boundaries as a deliverable, not a cleanup step.

> *"The fence you build against yesterday's danger has its own shadow — the discipline is in noticing you're now standing in it."* — Sensei

---

## The Closer

### 🎋 Haiku

> Two names for one door —
> the handler learns its own name;
> the ack finds no one.

---

## Summary

This is the strongest PR of the epic so far. Every load-bearing claim the sprint doc makes survived independent verification: the transaction kernel is untouched, no persisted shape moved, `extension.ts` wasn't edited, feature literals crossed into generic code as *data* rather than defaults, and the second-family fixture drives a real seam instead of asserting on diff lines. Blake found no blockers; Bria found no requirement gaps.

The two 🟠 High findings share one seam — the new correlation refs — and neither is a correctness bug in the mechanism itself. They're the shadow it casts: an in-flight guard for overlapping removals, and some trail when an ack is dropped. Both are small, local to the webview hooks, and worth doing before merge since the whole point of the sprint was acknowledgements settling correctly.

**Resolution outcome (2026-08-04): merge-ready.** F-01 through F-11 are addressed; F-12 is deferred because correcting historical commit shape would require force-rewriting the already-published review branch.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
