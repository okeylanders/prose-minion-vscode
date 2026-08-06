# MR Review — refactor(workshop): normalize feature slices

**Author:** Okey Landers · PR #102 · `sprint/workshop-architecture-refactor-01-feature-slices` → `epic/workshop-architecture-refactor`

**Reviewed:** 2026-08-03 · Merge base `61f3109`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | D1's carve-out applied to the handler layer only; the webview keeps the false specific | Marcus, Blake, Sam, Parker, Bria | 🎯🎯 Strong | **Addressed** |
| 2 | 🟠 High | `WorkshopWidgetHostHandler` accepts a required `LogSink` and discards it | Marcus, Blake, Parker, Stan, Oliver | 🎯🎯 Strong | **Addressed** |
| 3 | 🟠 High | The F2 fix tests the extracted helper, not the composition point F2 named | Cal, Sam | 🎯 | **Addressed** |
| 4 | 🟡 Standard | Dispatcher test covers 1 of 4 writer-facing toast branches | Cal | — | **Addressed** |
| 5 | 🟡 Standard | `WorkshopWidgetHostHandler` has no negative-path test | Cal, Oliver | 🎯 | **Addressed** |
| 6 | 🟡 Standard | Hook split moved state ownership, not render scope | Tim | — | **Deferred** — lateral move, not a regression; revisit if `WorkshopApp` grows always-mounted children |
| 7 | 🟢 Nit | `dispatchWorkshopWidgetActionResult` also owns Lexical toast copy | Parker | — | **Deferred** — disclosed in docstring; revisit when a third widget needs toast text |
| 8 | 🟢 Nit | Mixed relative/aliased imports in the `WorkshopApp` import block | Stan | — | **Addressed** |
| 9 | 🟢 Praise | Validation, codec, and directive crossed as byte-identical pure moves | Patricia | — | **N/A** |

---

## Resolution notes

- #1: moved family-generic config request/response state into
  `useWorkshopWidgetHost`; both feature hooks are now config-lookup-free, guarded
  by an architecture witness.
- #2 and #5: retained the injected `LogSink`, logged invalid and unavailable
  lookup failures without echoing malformed input, and covered both paths.
- #3: extracted `buildWorkshopAppMessageRoutes` as the testable composition seam;
  its test proves config routing and action-result fan-out from the actual route
  map.
- #4: covered non-removal, removed, already-removed, host-error, and fallback
  dispatcher behavior.
- #8: normalized the touched `useWorkshop` import to the semantic alias.

Post-fix verification: 164 Jest suites / 1,802 tests / 1 snapshot; all three
TypeScript projects; ESLint with zero errors (existing warning baseline); and
the production build plus bundle sentinel all pass.

---

## Blast Radius

- 49 files changed · +1,158 / −506 (rename-aware; the raw `gh pr diff` overstates this by showing moves as delete+add)
- New files: 4 production (`WorkshopWidgetHostHandler`, `GesturePlaygroundDirective`, `useGesturePlayground`, `dispatchWorkshopWidgetActionResult`) + 4 test · Migrations: no · New handlers: 1
- Route registration count unchanged; one route (`WORKSHOP_REQUEST_WIDGET_CONFIG`) deliberately changed **owner**
- Predominantly a pure-move refactor. No message renamed, no persisted shape touched.

**Independently verified by the orchestrator (not taken from the PR description):**

| Check | Result |
|---|---|
| Full Jest | 162 suites / 1,793 tests / 1 snapshot — **all pass** |
| Architecture + new Workshop suites | 16 suites / 182 tests — **all pass** |
| `tsc` core | clean |
| `tsc` extension adapter | clean |
| Stale `WorkshopWidgetHandler` references | none remain |
| Directive test split fidelity | 3 out of `WorkshopPromptBuilder.test.ts`, 3 into `GesturePlaygroundDirective.test.ts` |
| Sprint doc completion criteria | checked off **without rewording** — no goalpost moved |

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | A |
| 🧪 Tests | C |
| 📖 Quality | C+ |
| ⚡ Performance | B |
| 🎯 Domain | C |

---

## Executive Briefing

🟠 **[Marcus · Blake · Sam · Parker · Bria — 🎯🎯 Strong Consensus]** **D1 was fixed on the handler and skipped on the hook.** The generic config-lookup route got its generic backend owner (`WorkshopWidgetHostHandler`) exactly as planned — but the symmetric webview state moved wholesale into `useGesturePlayground`. Lexical Gravity's "edit an applied lens" door now runs entirely through the Gesture-named hook, and `closeLexicalGravity` calls `gesturePlayground.clearWidgetConfigData()` to tear down its own modal. Behavior is correct; the structure is not. This is the precise failure the runway's F1 was written to prevent, reproduced one layer up.

🟠 **[Marcus · Blake · Parker · Stan · Oliver — 🎯🎯 Strong Consensus]** **The new exemplary generic handler takes a `LogSink` and throws it away.** `_outputChannel` is underscore-prefixed, never assigned, never called — including on the one failure branch, where a writer sees "That widget configuration is no longer available" and the Output Channel says nothing. Every sibling handler logs. This class is the declared template for P2's generic route owners, so the gap will be copied deliberately.

🟠 **[Cal · Sam — 🎯 Consensus]** **The F2 characterization test guards the helper, not the wiring.** `dispatchWorkshopWidgetActionResult` is tested with `jest.fn()` mocks; the call site in `WorkshopApp.tsx` that supplies the *real* hook references is untested. Swap the two hook references or typo a key in the consumers literal and the suite stays green — which is the exact regression F2 named. The runway offered a `buildAppMessageRoutes` route-map assertion as the alternative; that seam is still uncovered.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — D1's carve-out landed only on the handler side [🎯🎯 Strong Consensus]

[WorkshopApp.tsx:536-539](packages/core/src/presentation/webview/WorkshopApp.tsx#L536-L539)

The runway is explicit that `WORKSHOP_REQUEST_WIDGET_CONFIG` is family-generic, and that leaving it on a feature-named module recreates the "false specific" the sprint exists to remove. D1(a) fixes this on the backend. On the frontend, `requestWidgetConfig`, `widgetConfigData`, `widgetConfigResponseId`, and `widgetConfigError` all moved into `useGesturePlayground` — not into a generic host hook.

`WorkshopStandingDirectiveRail`'s `onEdit` — Lexical Gravity's edit door — resolves through `openWidgetConfig` → `gesturePlayground.requestWidgetConfig`. Lexical's own edit flow now depends on Gesture-named hook state to function. It is invisible to `boundaries.test.ts` for the same structural reason cited for the handler case: the witness scans files whose *path* matches a feature name, and `WorkshopApp.tsx` matches neither.

The tree now *looks* symmetric. Lexical Gravity's edit path is still a tenant of the Gesture package.

### 🟡 Standard — The new generic handler discards a required `LogSink` [🎯🎯 Strong Consensus]

[WorkshopWidgetHostHandler.ts:17](packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts#L17)

Since this is meant to be the model generic handler going forward, it's worth deciding *now* whether the not-found path deserves a log line — rather than letting a silently-unused constructor param become the template P2 copies.

> *"The tree got a matching pair of feature folders, but Lexical Gravity's edit door still walks through Gesture's living room — D1 fixed the lie on one side of the wire and left its twin standing on the other."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟠 High — A false generic replaced by a false specific [🎯🎯 Strong Consensus]

[WorkshopApp.tsx:383](packages/core/src/presentation/webview/WorkshopApp.tsx#L383)

The runway's F1 cited **two** pieces of evidence: `handleRequestConfig` in the handler, **and** `WorkshopApp` fanning `WORKSHOP_WIDGET_CONFIG_DATA` to both modals. D1 fixed the first. The second got the opposite treatment.

Traced end to end: `openWidgetConfig` calls `gesturePlayground.requestWidgetConfig`; the backend replies from the *generic* host handler; the route map sends `WORKSHOP_WIDGET_CONFIG_DATA` to `gesturePlayground.handleWidgetConfigData`; the effect reads `gesturePlayground.widgetConfigData` to choose between `setGestureOpening` and `setLexicalGravityOpening`; `closeLexicalGravity` calls `gesturePlayground.clearWidgetConfigData()`.

Before this PR that state lived in the neutral `useWorkshop`. The extraction moved a family-generic seam *into* a feature-named hook. I ran 79 Workshop/boundaries suites — 1,060 green. **That is the problem.** Nothing on the webview side witnesses this.

Either hoist the config-fetch trio into a `useWorkshopWidgetHost` hook mirroring the handler you just created, or write the deviation into the sprint doc as an explicit D1-partial with the exception ledger entry it deserves.

### 🟡 Standard — `WorkshopWidgetHostHandler` accepts a `LogSink` and throws it on the floor [🎯🎯 Strong Consensus]

[WorkshopWidgetHostHandler.ts:17](packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts#L17)

`WorkshopHandler` dutifully passes `this.outputChannel`, and the new test dutifully supplies a triple-`jest.fn` mock, so the signature reads like the sibling convention while being decorative. Either drop the parameter or spend it on the miss path. A constructor argument that exists only to satisfy a convention is a convention that stopped meaning anything.

> *"You built the generic handler and then handed its webview twin to the Gesture hook — the refactor is honest on the side that has a test and lying on the side that doesn't."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — Lexical's config-edit door is served by the Gesture-named hook [🎯🎯 Strong Consensus]

[WorkshopApp.tsx:373-393](packages/core/src/presentation/webview/WorkshopApp.tsx#L373-L393)

I traced "writer opens a committed Lexical Gravity chip to edit it." `openWidgetConfig` calls `gesturePlayground.requestWidgetConfig` — not anything on `lexicalGravity` — regardless of which feature's chip was clicked. `useLexicalGravity.ts` has no `widgetConfigData`/`requestWidgetConfig` members at all; it never held this data.

It still works — the `widgetId` switch dispatches correctly — so this isn't a runtime break. But a future P2 rename of `useGesturePlayground`'s vocabulary, or a refactor assuming the hook is gesture-only, would silently break Lexical's edit path with no test catching it.

### 🟡 Standard — The generic config request/response has no test at its real composition point [🎯 Consensus]

Searched the diff and working tree for a `WorkshopApp` test file — **none exists**. `useGesturePlayground.test.ts` exercises `handleWidgetConfigData` only through the Gesture lens; `useLexicalGravity.test.ts` never touches `widgetConfigData` since the hook doesn't own it. *(Orchestrator confirmed: `grep widgetConfig useGesturePlayground.test.ts` returns nothing at all.)*

So the exact trap above has zero automated coverage — mirroring the gap F2 called out for the action-result fan-out, which slice 0 fixed. This one was not.

> *"Followed the 'open a committed lens to edit it' door all the way down and it doesn't stop at Lexical Gravity's house — it walks straight into Gesture Playground's hook and helps itself to the furniture."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟠 High — The hook's docstring and file placement claim a scope it doesn't have [🎯🎯 Strong Consensus]

[useGesturePlayground.ts:1](packages/core/src/presentation/webview/hooks/domain/workshop/widgets/useGesturePlayground.ts#L1)

`/** Webview domain hook for Gesture Playground's transient authoring workflow. */`

Opening a Lexical Gravity lens depends on a hook whose docstring, file path, and every neighboring member say "Gesture Playground." That's **not** a deferred vocabulary word — D3 covers `widget*`-prefixed *names*; this is the hook's *scope* silently including a second feature's primary edit path.

### 🟡 Standard — `_outputChannel` is the class admitting the parameter is theater [🎯🎯 Strong Consensus]

The underscore prefix satisfies "don't make it optional" by the letter. The `'That widget configuration is no longer available.'` branch is a real "someone asked for a config that vanished" event worth a trace.

### 🟢 Nit — `dispatchWorkshopWidgetActionResult` does more than its name says

[dispatchWorkshopWidgetActionResult.ts:15](packages/core/src/presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.ts#L15)

"Dispatch" reads as pure fan-out, but the function also owns the writer-facing toast copy for `remove-standing` — a Lexical-specific presentation decision inside a function whose name promises generic routing. The docstring discloses it, so this is honest rather than hidden. But if a third widget needs its own toast text, this grows a second `if`, and "dispatch" stops being true for anyone.

> *"You fixed the handler's false-generic and then let the hook grow the exact same lie one layer up — `openWidgetConfig` still hands Lexical Gravity's edit door to a function whose file, docstring, and every neighbor insist this is Gesture Playground's alone."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The F2 fix tests a helper function, not the composition point it names [🎯 Consensus]

[WorkshopApp.tsx:277](packages/core/src/presentation/webview/WorkshopApp.tsx#L277)

`dispatchWorkshopWidgetActionResult.test.ts` proves the pure function fans a message out to whatever consumers it's handed — with `jest.fn()` mocks. It never touches the wiring that supplies the *real* `gesturePlayground.handleWidgetActionResult` and `lexicalGravity.handleActionResult`. Searched for a `WorkshopApp` test file — none exists, before or after.

So the failure mode F2 was written to catch is still uncaught if the drop happens **at the call site** rather than inside the dispatcher: swap the two hook references, forget to instantiate `gesturePlayground`, or typo a property name in the `WorkshopWidgetActionResultConsumers` literal — every test stays green.

The design doc itself offered the alternative: *"a route-map assertion over `buildAppMessageRoutes`."* That would have covered exactly this seam.

### 🟡 Standard — One of four toast branches is exercised

[dispatchWorkshopWidgetActionResult.test.ts:5](packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/dispatchWorkshopWidgetActionResult.test.ts#L5)

The function has a 4-way branch: `action !== 'remove-standing'` → no toast; `ok:true, removed:true` → "removed."/check; `ok:true, removed:false` → "already removed."/info; `ok:false` → error copy/x/error tone. The single test covers only the third case. Untested: the early-return path, the info-tone copy, and the `message ?? 'Lexical Gravity could not be removed.'` fallback.

This is writer-facing toast text — exactly the surface the PR promises is unchanged.

### 🟡 Standard — The new exemplar handler has no negative-path coverage [🎯 Consensus]

[WorkshopWidgetHostHandler.test.ts:26](packages/core/src/__tests__/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.test.ts#L26)

The only test covers one path: a well-formed `wc-1` that resolves. Two other branches ship untested — a `configId` failing `/^wc-[1-9]\d*$/`, and a valid id `session.getWidgetConfig` can't resolve. Both post the error payload writers actually see when a config disappears.

> *"One green test that's tautological with the implementation isn't a regression suite, it's a witness statement co-signed by the defendant — and the seam that actually named the risk, `WorkshopApp`'s wiring, still has no test at all."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟡 Standard — `WorkshopWidgetHostHandler` takes `outputChannel: LogSink` and throws it away [🎯🎯 Strong Consensus]

[WorkshopWidgetHostHandler.ts:17](packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts#L17)

Every sibling that takes `outputChannel: LogSink` actually calls `this.outputChannel.appendLine(...)` — see [WorkshopSessionMessageHandler.ts:55,101,199,300](packages/core/src/application/handlers/domain/WorkshopSessionMessageHandler.ts#L55) and `WorkshopLexicalGravityHandler`, both of which log at minimum a construction line and an error path. *(Orchestrator confirmed these line numbers directly.)*

CLAUDE.md's line on this — *"Require `outputChannel: LogSink`... don't make it optional"* — is written to **this** pattern. The port isn't decorative; siblings prove it's meant to carry a log line on the failure path. This is a handler that imported the convention's letter without its point.

### 🟢 Nit — `WorkshopApp.tsx` mixes relative and aliased imports for sibling hooks

[WorkshopApp.tsx:116-120](packages/core/src/presentation/webview/WorkshopApp.tsx#L116-L120)

Lines 118-120 (the new `useGesturePlayground`/`useLexicalGravity` imports) correctly use `@hooks/domain/workshop/widgets/...`. Line 116's untouched `useWorkshop` import sits four lines above, still written `./hooks/domain/useWorkshop`. Since this PR already touches the block, it's the natural spot to fix the straggler.

> *"We just spent a whole sprint giving Gesture Playground an honest name, and its new handler still can't be bothered to say anything to the log — some conventions get the ceremony, some get the substance, rarely both in the same file."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — The hook split moved state ownership, not render scope

[WorkshopApp.tsx:189-191](packages/core/src/presentation/webview/WorkshopApp.tsx#L189-L191)

All three hooks are called at the top of the same ~1,800-line component, exactly as before. Any `setState` inside `useGesturePlayground` — e.g. `setWidgetGenerationProgress` on every progress message — still re-runs the entire `WorkshopApp` render function, same as when that state lived in `useWorkshop`.

A lateral move, not a regression. At current volume this is cheap and not worth chasing. It starts to matter if `WorkshopApp` grows more always-mounted children, or if progress emission frequency increases — at which point the fix is co-locating the state inside the modal's subtree, not a top-level hook.

### 🟢 Nit — The dispatcher's per-call allocation is immaterial

Worth flagging only to say explicitly: it doesn't matter. `WORKSHOP_WIDGET_ACTION_RESULT` fires on discrete user actions — a handful per session, not per token. Callback identity is stable too: the three consumers are `useCallback` with narrow deps and `useVSCodeApi` is ref-backed, so `useMessageRouter`'s stable-listener contract holds.

> *"The re-render blast radius didn't get smaller and didn't get bigger — you just relabeled which hook is standing in the blast zone; the one allocation you added is a rounding error next to the streaming path you didn't touch."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟢 Praise — Pure move, validation preserved byte-for-byte

The `wc-[1-9]\d*` config-id gate, the draft-shape codec, and `buildGestureDirective` are all byte-identical relocations. No security-relevant behavior change.

The prompt-injection surface in `buildGestureDirective` — interpolating writer-controlled `selections`/`note`/`targetPhrase` into a directive sent to the model — is real but pre-existing and untouched, consistent with the single-user, no-auth-boundary threat model where the writer is the trusted principal of their own room directive.

> *"I checked whether this move quietly loosened anything — the `wc-[1-9]\d*` gate, the draft codec, the directive builder — and every one of them crossed the wire byte-for-byte; nothing here is the breach report I was looking for."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — The config-not-found path is invisible in the Output Channel [🎯🎯 Strong Consensus]

[WorkshopWidgetHostHandler.ts:17-38](packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts#L17-L38)

The parameter is `_outputChannel`, never referenced, not even assigned to `this`. When `handleRequestConfig` can't resolve a config — bad id shape, or an id that once existed but was deleted — the writer gets a toast, but the developer gets nothing beyond `MessageRouter`'s generic receipt log, which fires on **every** request regardless of outcome and therefore can't distinguish success from failure.

Compare `WorkshopLexicalGravityHandler`, which routes every caught error through a helper that always appends to the channel before returning the error to the caller. That's the convention CLAUDE.md names. And the single new test only exercises the happy path, so nothing currently proves the failure branch is even reachable, let alone observable.

At 2am, an engineer chasing "writer says a widget config vanished" has no line to grep for.

> *"One handler in this refactor got a LogSink and forgot what it's for — the toast fires, the channel stays silent, and I'm left grepping a receipt log that can't tell success from failure."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟠 High — D1's handler-side fix was never mirrored on the webview [🎯🎯 Strong Consensus]

[WorkshopApp.tsx:536](packages/core/src/presentation/webview/WorkshopApp.tsx#L536)

F1/D1 exists because `WORKSHOP_REQUEST_WIDGET_CONFIG` is family-generic and Lexical Gravity's "edit applied lens" door depends on it. The PR built `WorkshopWidgetHostHandler` to fix the handler side — but the whole config-fetch cluster moved into `useGesturePlayground.ts`, whose docstring reads *"Webview domain hook for Gesture Playground's transient authoring workflow."*

Neither the runway's target hook tree (§1.2) nor the sprint doc's accepted decisions scope a webview-side counterpart. **This isn't a recorded deferral** — unlike F5 (directive naming), F6 (hook vocabulary), and F7 (CSS), which were all faithfully written into the sprint doc. It's a gap nobody named.

*Orchestrator's corroboration:* the sprint doc's completion criteria were checked off **without being reworded**, and the three required deferrals genuinely were recorded. No goalpost moved. This one gap is the exception, not a pattern.

> *"Is it intentional that D1 got a handler-side fix and the exact same lie just walked upstairs into `useGesturePlayground`, wearing a docstring that swears it's only about Gesture Playground?"* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — A fix only exists where you told it to

Illuminated by: Findings 1 and 3

A carefully identified risk was correctly fixed at the handler layer and silently reproduced one layer up, in the exact shape the plan warned against — because "we fixed D1" quietly narrowed, mid-implementation, into "we fixed D1 in the backend." Risks named in a planning document are named against a *pattern*, not a *file*. If the pattern can occur in more than one layer, the plan owes each layer an explicit yes-or-no, not an implicit inheritance of the first layer's answer.

→ Carry forward: When a runway names a risk, before closing it out, ask *"where else in the stack does this same shape of decision get made?"* and check each one by name — don't let "fixed" mean "fixed where I was already looking."

### Lesson 2 — A witness can only see what it was built to see

Illuminated by: Finding 1

The architecture fitness witness that should have caught Lexical-Gravity-state-living-in-a-Gesture-hook was blind to it by construction — it scans imports inside files whose *path* matches a feature name, and the offending file matches neither. A passing suite isn't evidence the risk was checked; only that it was checked *by something with jurisdiction over it*. The scariest gap is the one where green looks identical whether the property holds or not.

→ Carry forward: When writing a fitness witness for a named risk, explicitly ask *"what file, if it violated this, would this test fail to notice?"* — and write that file into a negative test case before trusting the witness.

### Lesson 3 — A convention's letter is not its point

Illuminated by: Finding 2

`_outputChannel: LogSink`, required and unused, technically satisfies "require outputChannel, don't make it optional" — and completely defeats the reason that rule exists, which is that failures should leave a trace. Rules written as syntax are trying to encode a behavior; satisfying the syntax while skipping the behavior is code that lies to its own linter. This matters more, not less, because the class was declared the template for future generic-route owners — the gap will get copied on purpose.

→ Carry forward: When implementing a required dependency because "the convention says so," ask what observable behavior the convention is protecting, and go find the failure branch that behavior is supposed to light up.

### Lesson 4 — Test the wiring, not just the wired thing

Illuminated by: Finding 3

The plan asked for a characterization test at "the composition point" precisely because that's where a dropped or swapped arm goes unnoticed. The delivered test exercises the pure dispatch function with mock consumers — proving the machine part works, not that the machine part is connected to the right wire. Those are different questions, and only one was asked.

→ Carry forward: When a risk names a specific location ("the composition point," "the call site"), write the test *at* that location before writing the unit test for the piece you pulled out of it.

> *"The rigor of a plan is only as strong as its narrowest reading — a risk well-named at the start of the day can still find a door left unlocked by dusk, not from carelessness, but from the ordinary human habit of finishing the sentence we started instead of the sentence we meant."* — Sensei

---

## The Closer

### 🐾 Animal

If this MR were an animal, it would be a **hermit crab mid-move**.

It has done the hard, correct, unglamorous thing: identified that its old shell was the wrong shape, found a better one, and made the transfer cleanly with everything intact — 1,793 tests green, both compilers happy, not one stale reference left behind. The new shell genuinely fits better.

But it's a hermit crab, so it carried one thing across that belonged to the old shell and didn't notice: the family-generic config state, still riding in the Gesture-shaped compartment. Soft parts exposed in exactly the spot the survey said to armor.

Finish the move. The shell is right.

---

## Summary

This is a well-executed, well-planned refactor that is **nearly merge-ready** — and unusually honest about itself. The runway document pre-identified the exact risks, the sprint doc's completion criteria were checked off without rewording, three required deferrals were genuinely recorded, and every verification claim in the PR description held up under independent re-run. Patricia found nothing; Tim found nothing that matters; no reviewer found a behavior regression.

The one substantive gap is that **D1 was implemented at the handler layer and not at the presentation layer**, which five of ten reviewers converged on independently. The result is that Lexical Gravity's config-edit path is now owned by a hook named, documented, and filed under Gesture Playground — the precise "false specific" the sprint exists to eliminate, reproduced in the one layer the fitness witness is structurally blind to. It works today; it will not survive P2's rename untouched.

**Recommendation:** either hoist the config-fetch cluster into a `useWorkshopWidgetHost` hook mirroring the handler already built (the symmetric fix, likely under an hour), **or** record it explicitly as a D1-partial with a Phase-2 exception-ledger entry so the next phase inherits a named debt rather than a hidden one. Findings 2 and 3 are cheap and worth folding into the same commit. Everything else can ride.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
