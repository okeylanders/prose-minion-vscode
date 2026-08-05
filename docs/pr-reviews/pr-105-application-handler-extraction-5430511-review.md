# MR Review — Workshop Sprint 04: extract application handler slices

**Author:** okeylanders · PR [#105](https://github.com/okeylanders/prose-minion-vscode/pull/105) (Open)
**Branches:** `sprint/workshop-architecture-refactor-04-handlers` → `epic/workshop-architecture-refactor`
**Base:** `04afb67` · **Head:** `5430511` · **Reviewed:** 2026-08-05 · **Mode:** Full panel (10 specialists + Sensei)

> Sprint 04 of the seven-sprint Workshop architecture epic (after #101 fitness witnesses, #102 feature
> slices, #103 shared ownership, #104 presentation extraction). Like #104, this PR ships its own intent
> document — a 706-line runway with status `IMPLEMENTED AND VERIFIED`. The panel **consumed** that runway as
> declared intent, then tested its claims against the code. Where the runway's own glyphs disagreed with the
> diff, the panel said so (F-15).

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **N/A** = praise or not actionable.
Signal legend: 🎯 Consensus = 2+ reviewers independently · 🧬 Pre-existing = carried verbatim from the deleted monolith, not introduced here.

| ID | Sev | Finding | Reviewer(s) | Signal | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | 🔴 Blocking | Spoofed `file://` excerpt source + `REREAD` is an unconfined arbitrary-file-read; contents reach the webview *and* the LLM prompt | Patricia | 🧬 Pre-existing | **Open** — author's call (see note) |
| F-02 | 🟠 High | "What's running?" derived twice in opposite precedence → two different refusal messages for one dual-active moment | Marcus | — | **Open** |
| F-03 | 🟠 High | The new four-slice sibling boundary has no fitness-function witness (only last sprint's widgets are guarded) | Marcus | — | **Open** |
| F-04 | 🟠 High | The named `handleSetExcerpt` race window's second guard has no test — its resource-path twin got the exact right one | Cal | — | **Open** |
| F-05 | 🟠 High | `cancelRun`'s `false` return is discarded — a stale context-wizard cancel leaves zero trail; its room-run twin logs | Oliver | — | **Open** |
| F-06 | 🟡 Standard | Resource-load-failure translator has two byte-identical homes where the monolith had one | Parker | — | **Open** |
| F-07 | 🟡 Standard | `executeMessage` still 456 lines re-deciding host/tool/guest 16× — inherited, untouched by the split | Parker | 🧬 Pre-existing | **Open** |
| F-08 | 🟡 Standard | Shared harness builds a `WorkshopWidgetRuntime` mock that violates its own type behind `as unknown as` | Parker | 🧬 Pre-existing | **Open** |
| F-09 | 🟡 Standard | `uri-unreadable` — the one fail-safe branch with zero tests in an otherwise deliberate six-outcome matrix | Cal | — | **Open** |
| F-10 | 🟡 Standard | `matchConfiguredSource` is now public and returns the host-only `absolutePath`; its "never crosses to webview" guard-comment was dropped, not relocated | Patricia | — | **Open** |
| F-11 | 🟡 Standard | New per-slice `sendError` `owner` tag isn't wired for 2 of 5 siblings — one live mislabeled `[WorkshopHandler]` line | Oliver | — | **Open** |
| F-12 | 🟡 Standard | `registerRoutes` drops the unused `router` param every sibling keeps — three call shapes now across seven siblings | Stan | — | **Open** |
| F-13 | 🟡 Standard | New slices import via short `@handlers/` alias; every sibling *and this PR's own harness* use long `@/application/handlers/` | Stan | — | **Open** |
| F-14 | 🟡 Standard | `.aggregate` / `.assembly` / `.roomRun` — new test-suffix vocabulary defined by no ADR or guide | Stan | — | **Open** |
| F-15 | 🟡 Standard | Runway diagram stamps `WorkshopSessionMessageHandler.ts` a **pure** move, but the diff evicts a 7-line type export (type-only) | Bria | — | **Open** |
| P-01 | ⭐ Praise | Two-slot mutation gate, cancel/dispose asymmetry, and persistence ordering all survive intact — plus the PR added the coverage the monolith never had | Blake | 🎯 Consensus | N/A — preserve |
| P-02 | ⭐ Praise | The one race the runway feared is intact, wired through the new indirection, and covered by a live (not mocked) router test | Sam | 🎯 Consensus | N/A — preserve |
| P-03 | ⭐ Praise | Run-state and transport ports are honestly narrow (single-method `WorkshopRunGate`, `Pick`-narrowed effects, grep-verified pure intake service) — and the claims are tested | Marcus | — | N/A — preserve |
| P-04 | ⭐ Praise | Wizard-cancellation coverage wasn't moved, it was merged into a strictly stronger test | Cal | — | N/A — preserve |
| P-05 | ⭐ Praise | `boundText` consolidation cut redundant `countWords` passes 3× → 1× — a free win from the split | Tim | — | N/A — preserve |
| P-06 | ⭐ Praise | The 48-route reconciliation holds four ways; `boundaries.test.ts` is a live witness, not a rubber stamp | Bria | — | N/A — preserve |

**Note on F-01.** Patricia flags this at Blocking severity on its own merits — a practical arbitrary-file-read reachable with two ordinary messages. Its provenance is the honest complication: the vulnerable code is **byte-identical to the deleted monolith** (`WorkshopHandler.monolith.ts:2445-2454`), so this PR *preserves* the hole rather than introducing it. The severity of the hole and the culpability of this PR are different axes. The decision this raises for the author: because the extraction is the first time this logic sits in an independently testable seam built for exactly this scrutiny, **this PR is arguably the right place to add the confinement check and its test** — or to record a fast-follow security ticket with eyes open. It is not a reason to hold the *architectural* work, but it should not merge silently.

## Orchestrator verification (independent, at `5430511`)

- `npx jest --runInBand` — **183 suites / 1,877 tests / 1 snapshot, all pass** (77.7 s). +8 suites / +30 tests vs. the Sprint 03 baseline.
- `npm run typecheck` — clean across all three workspace projects.
- Route arithmetic re-counted by hand: 9 (`WorkshopHandler`) + 13 (`WorkshopContextHandler`) + 6 (`WorkshopExcerptScopeHandler`) + 1 (`WorkshopTodoHandler`) = **29 direct registrations**, matching the deleted monolith name-for-name; full family ledger = 48.
- F-01, F-02, F-04, F-05 spot-traced independently against the head working tree — all confirmed at the cited lines.

---

## Blast Radius

- **36 files changed · +8,862 / −6,293**
- New files: 17 · Deleted: 4 · Renamed: 1 (R097) · Migrations: none (VS Code extension; persisted session schema unchanged, invariant 5 confirmed)
- New handler slices: 4 (`WorkshopHandler` 1,527 · `WorkshopContextHandler` 861 · `WorkshopExcerptScopeHandler` 479 · `WorkshopTodoHandler` 99) + `WorkshopHandlerContracts.ts` (30) · one application service evolved (`WorkshopContextResourceService` 117 → `WorkshopContextIntakeService` 379)
- A 2,995-line monolith deleted and re-landed as a feature module; a 3,035-line monolithic test suite replaced by seven focused suites + a 327-line router-dispatching harness.

---

## Report Card

| Category | Grade | Why |
| --- | --- | --- |
| 🏛️ Architecture | **C+** | Clean one-directional dependency graph and honestly narrow ports (P-03), but two real structural gaps: a run-state fact with two owners (F-02) and a new boundary with no witness (F-03). |
| 🛡️ Security | **F\*** | One Blocking arbitrary-file-read (F-01). *The asterisk is load-bearing:* it's a pre-existing hole carried forward verbatim, not a regression this PR introduced. Grade reflects the hole's severity, not this PR's culpability. |
| 🧪 Tests | **C+** | Strong, deliberate suite (P-01, P-04, P-06) — but the one race the runway names by method has its second guard left untested (F-04), plus one uncovered fail-safe branch (F-09). |
| 📖 Quality | **B−** | Three Standards, all honest (F-06/07/08); two are inherited debt the split relabeled rather than resolved. No new complexity introduced. |
| ⚡ Performance | **A** | Zero concerns. The split reproduced the monolith's exact costs and handed back a small refund (P-05). |
| 🎯 Domain | **B+** | The declared record reconciles against the code four independent ways (P-06); one diagram glyph overstates a move as "pure" (F-15). |

---

## Executive Briefing

The extraction itself is clean — behavior is preserved and independently verified. What the panel surfaced is almost entirely the gap between *"behavior preserved"* and *"the new seam's promises witnessed."* Prioritized:

🔴 **[Patricia]** Arbitrary-file-read via spoofed excerpt source — a malicious webview pins `kind:'file'` with any `sourceUri`; `REREAD` reads it back with no confinement, into the webview and the LLM prompt. Pre-existing, but now sitting in a testable seam. **Author's merge call.**

🟠 **[Marcus]** The excerpt-mutation gate and the session-operation label derive "what's running?" in opposite precedence — in the reachable dual-active state a writer gets two different explanations for one refusal. One `currentRunKind()` both closures call fixes it.

🟠 **[Cal]** The `handleSetExcerpt` race the runway lost sleep over: the PR built the exactly-right deferred-promise test — for the resource-path twin only. The plain-excerpt path's post-await guard is dead code as far as any test can tell.

🟠 **[Oliver]** A stale context-wizard cancel discards `cancelRun`'s `false` and leaves no trail, while its room-run twin three lines down logs unconditionally — right where a racing cancel would need a signature.

🟠 **[Marcus]** The four-slice boundary is hand-verified clean but unguarded: `boundaries.test.ts` still only forbids cross-imports for last sprint's widgets. A four-line addition extends the pattern this PR already uses everywhere else.

> **The cluster worth seeing:** F-02, F-04, P-01, and P-02 all orbit the same excerpt-mutation gate. Blake and Sam independently proved it *works* (🎯 Consensus); Marcus found its dual-active messages disagree; Cal found its second guard untested. The gate is correct — its edges are what remain.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — "What's running?" is derived twice, in opposite order [F-02]

`WorkshopHandler.ts:253` · Nothing gates a room run against `contextHandler.isRunning()`, and `handleRunContextWizard` only checks its own `wizardRun` — so a tool run and a Context wizard can be concurrently active (by design, invariant 3's two stream domains). Given that reachable state, `WorkshopHandler` computes "what's running" twice with opposite precedence: the excerpt gate (253-257) checks `this.activeRun` **first** (`MID_RUN_EXCERPT_GUARD_MESSAGE`), while `activeRunLabel` (282-286) checks `this.contextHandler.isRunning()` **first** (`'Context wizard'`). Concretely: in the same dual-active moment, a writer blocked from replacing the excerpt sees "A tool is still running…" while a writer blocked from renaming a session sees "Wait for the current Context wizard…" — two independently-derived answers to one question. No mutation slips through (message-accuracy, not corruption), and no new suite drives both runs together. One private `currentRunKind(): 'tool' | 'wizard' | undefined` that both closures call puts the precedence in exactly one place.

### 🟠 High — The new sibling boundary has no fitness witness [F-03]

`boundaries.test.ts:486` · Hand-verified clean: grepping each slice body (not just imports) for the others returns zero hits — only the central `WorkshopHandler` constructs the three siblings. A genuinely one-directional graph. But the only test forbidding sibling-to-sibling imports (line 479) is scoped by regex to `GesturePlayground`/`LexicalGravity` — last sprint's widgets. The route-ownership ledger (64-146) would only fail if a route's *owner* changed, not if `WorkshopExcerptScopeHandler` imported `WorkshopContextHandler` to read a private field directly. This PR ships two other real witnesses for its other claims (session-envelope ownership at 462, intake purity at 471) — the "claim → witness" pattern is established here, just not extended to this boundary. Reuse the `importsFeature` regex against `Context|ExcerptScope|Todo`.

### ⭐ Praise — The ports are honestly narrow, and the claims are tested [P-03]

`WorkshopHandlerContracts.ts:27` · `WorkshopExcerptScopeHandler` never receives `WorkshopContextHandler` or its `wizardRun` — it receives exactly one method, `excerptMutationBlockedReason()`, defined in the one place with legitimate visibility into both signals. Each slice takes `Pick<WorkshopRoomEffects, …>` narrowed to only the callbacks it uses. `WorkshopContextIntakeService`, read in full, imports no `MessageType`, no `MessageRouter`/`MessageTransport`, no `WorkshopSessionService`, no `LogSink` — genuinely route/transport/session/UI-effect-free, matching invariant 8 exactly. And unlike some architecture docs, these aren't just asserted: `boundaries.test.ts` greps for the forbidden identifiers and pins all 48 routes to an owner.

> *"The bones are sound and the ports are honestly narrow, but the house now asks 'what's running?' from two different rooms and gets two different answers, and the boundary tests still only watch the doors built last sprint."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### ⭐ Praise — The extraction closed the door behind itself [P-01] [🎯 Consensus]

`WorkshopHandler.ts:253` · Came hunting for the four classic extraction failures; found none. **Invariant 2:** the gate still reads BOTH slots — `this.activeRun` locally and `this.contextHandler.isRunning()` — through a dispatch-time closure, no stale snapshot; both refusal constants byte-identical to the monolith; all 12 call sites moved intact (mapped one-for-one against base lines). The documented `handleSetExcerpt` race stays closed: every post-await re-check is followed by a *synchronous* `tryReplaceExcerpt`, so gate→mutate stays atomic within one microtask. **Invariant 3:** `cancelRun` aborts without clearing, `dispose` aborts AND clears — the deliberate asymmetry survives, slot released only on requestId match in `finally`. **Invariant 4:** no sibling rebuilds session-state posting; all eight receive one `postSessionState` delegating to the single impl that sets `contextBudget = activeContextBudget()` — the manifest cannot silently empty. **Invariant 1:** all 12 moved `markDirty` sites present, every one still mutate → markDirty → postSessionState. And a note for the record: the composed two-slot gate was **never tested** in the 3,035-line monolith suite — `WorkshopHandler.assembly.test.ts:407-467` now exercises it through the production router. This extraction added the coverage that would have caught its own worst failure mode.

> *"I came looking for the dropped await and the half-moved gate; this one closed the door behind itself and left the lights on — I'll be sleeping through the night."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### ⭐ Praise — The trap door the runway feared holds, live-tested [P-02] [🎯 Consensus]

`WorkshopHandler.ts:253` · Went hunting for the exact failure the runway names as its top fear (§3.2: "Pinning an excerpt during the wizard stopped being refused… the wizard branch was dropped when the wizard moved"). In the monolith, `rejectExcerptMutationWhileRunning()` checked `activeRun` then `wizardRun`, each with its own message. After the move, `WorkshopExcerptScopeHandler` has neither field — it calls a `runGate.excerptMutationBlockedReason()` port, whose one implementation still reads BOTH signals in the same order with both messages verbatim. The companion fear — cancel-then-regenerate overlapping two wizards — is also resolved: `cancelRun` aborts but leaves `wizardRun` set until the run's own `finally`; `dispose` is the one path that clears immediately. Not just a static read — `assembly.test.ts` exercises both through the real `WorkshopHandler` + real `MessageRouter`. Ran both suites plus the full excerpt/context/todo/intake set (13 files, 179 tests) against head — all pass.

> *"I went looking for the trap door in the wizard-vs-excerpt race — the exact one the runway doc admits it lost sleep over — and after tracing it through two files, a closure, and a live router test, the floor just… holds."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — The failure translator has two homes instead of one [F-06]

`WorkshopExcerptScopeHandler.ts:378` · This 16-line `reportConfiguredResourceLoadFailure` is byte-identical to `WorkshopContextHandler.ts:845-860` (a `diff` of the two ranges is empty). The monolith had exactly one copy serving all four call sites; the split gave each slice its own. Both classes already hold the collaborator that owns the sibling method this one wraps — `WorkshopContextIntakeService`. Move it there, or into the `WorkshopHandlerContracts.ts` both already import from. One owner instead of two.

### 🟡 Standard — `executeMessage` still re-decides host/tool/guest 16× in 456 lines [F-07]

`WorkshopHandler.ts:824` · Exactly the monolith's size — the extraction pulled context/excerpt/todo into siblings but never touched this method. Inside it, `target.kind` is tested or switched at sixteen points to resolve host-vs-tool-vs-guest for validation, delivery prep, turn creation, message building, publishing, and bookkeeping — the same three-way decision re-litigated as you scroll. Inherited, not new breakage — but the runway's claim for this file is "coherent room/run/session core," and this is the method where that claim gets tested. Resolve the per-target bundle once at the top so the rest reads target-agnostic.

### 🟡 Standard — The shared harness mock violates its own type [F-08]

`WorkshopHandlerTestHarness.ts:47` · `WorkshopWidgetRuntime` requires `standingDirectives` and a shaped `lexicalGravity`; this factory omits `standingDirectives` and nests a stray `directives` key one level too deep, hidden by `as unknown as`. `WorkshopHandler` wires `widgetRuntime.standingDirectives` straight into `new WorkshopStandingDirectiveHandler(...)`, so the first test that routes `WORKSHOP_APPLY_STANDING_WIDGET` through this harness throws on `undefined`. Byte-identical to the deleted monolith fixture — but this PR rewrote the harness around "focused coverage," and it's the file every future test author copies first.

> *"The extraction relabeled the junk drawer nicely, but the same failure-translation helper still lives in two files and 'the one composer action' still re-decides host vs. tool vs. guest sixteen times across 456 lines — I had to read executeMessage three times just to answer what a tool-target send actually skips."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The named race window's second guard has no test [F-04]

`WorkshopExcerptScopeHandler.ts:106` · The review brief names this by method: "a race can re-open between the two await boundaries in `handleSetExcerpt`." The guard-await-guard shape is real and unchanged from the monolith. What's new is the PR's own answer: `WorkshopExcerptScopeHandler.test.ts:118` uses a `deferred<T>()` promise to hold `handleSetExcerptResource`'s catalog load open, flips `runRefusal` mid-flight, and proves the *second* guard catches the race — exactly the right technique, applied to the wrong-only method. Grepped every new suite for a controllable `matchConfiguredSource` feeding a `WORKSHOP_SET_EXCERPT` (not `_RESOURCE`) dispatch — found none. Every existing `SET_EXCERPT` test catches the *first* guard or uses the mock's one-tick auto-resolve, which can't race anything. The plain-excerpt path's second guard is dead code as far as any test can tell; hoist or drop it and nothing fails.

### 🟡 Standard — One fail-safe branch missing from a deliberate matrix [F-09]

`WorkshopContextIntakeService.ts:339` · `matchConfiguredSource` returns six outcomes; the PR built a Phase-6 test block pinning each fail-safe by name — unmatched, ambiguous, catalog-unreadable, matched — 4 of 6 covered twice over. The fifth, `uri-unreadable` (thrown by `fileURLToPath` on a malformed `sourceUri`), has zero tests anywhere — grepped the full diff and both new suites; only the three production lines that define and consume it. Same silent-degrade shape as its tested siblings, a pure monolith carryover — but the PR built a whole section around "don't guess when resolution is unsafe" and left the one branch that throws on bad input as the gap.

### ⭐ Praise — Cancellation coverage was merged into something stronger [P-04]

`WorkshopHandler.assembly.test.ts:459` · The old suite's `'cancels a wizard without attaching its eventual result'` was the one title my old-vs-new diff couldn't match verbatim — Rule A says chase it before calling it lost. It wasn't: both its assertions survive verbatim, folded into `'keeps a cancelled wizard in its slot until that run settles'`, which *adds* the slot-occupancy behavior invariant 3 asks for (a second `runWizard()` while cancellation is pending still hits `'already running'`; only after settle does a third get through). One test now proves both "no phantom attachment" and "slot held until settle" where the monolith needed two.

> *"Happy path only? No — this suite mostly did its homework, but I still found the one guard nobody handed a deferred promise to, and that's always where the pager goes off."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟡 Standard — `registerRoutes` drops the param every sibling keeps [F-12]

`WorkshopExcerptScopeHandler.ts:73` · Every pre-existing sibling declares `registerRoutes(router: MessageRouter, registerMutation: …)` — including `WorkshopStandingDirectiveHandler.ts:37-40`, the closest comparison, whose body *also* uses only `registerMutation` and never calls `router.register()`, yet still keeps the param. The two new slices drop it. The result shows at the call site (`WorkshopHandler.ts:368-375`): the composition method now juggles three call shapes across seven siblings — `registerRoutes(registerMutation)`, `registerRoutes(router, registerMutation)`, and `registerRoutes(router)`.

### 🟡 Standard — Import-alias split runs inside this PR's own diff [F-13]

`WorkshopContextHandler.ts:13` · `WorkshopStandingDirectiveHandler`, `WorkshopSessionMessageHandler`, and both widget handlers import `MessageRouter`/`MessageTransport` as `@/application/handlers/…`. The two new slices use the shorter `@handlers/…`. Both resolve — but the split runs inside this PR: the brand-new `WorkshopHandlerTestHarness.ts:5` uses the long form, so the diff disagrees with itself.

### 🟡 Standard — Three new undocumented test-suffix words [F-14]

Searched the diff, memory-bank, sprint doc, and ADR for `aggregate.test` / `assembly.test` / `roomRun.test` outside path headers — not found. The runway's D2 row describes splitting "by owner" conceptually but never names the scheme. No other domain uses it; every sibling test, including `WorkshopStandingDirectiveHandler.test.ts` in the same directory, is a plain `HandlerName.test.ts`. Jest discovers them fine — but the next Workshop test author has three unexplained categories to guess between.

> *"WorkshopHandler.ts and the test harness written to exercise it — same PR, same afternoon — can't agree on how to import MessageRouter, which is the kind of drift I'd expect between two eras of the codebase, not two files in one diff."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### ⭐ Praise — The split handed back a refund [P-05]

`WorkshopContextIntakeService.ts:89` · The monolith's `boundThreadArtifact` computed `countWords(content)` up to three times per call in the common path — once in `knownTotalWords ?? countWords(content)`, again in the cap check, a third time in the return. The new shared `boundText()` memoizes it once into `measuredWords` and reuses it. At a typical few-thousand-word attach, that's 2 fewer linear scans per attach — sub-millisecond, irrelevant next to the LLM round trip, so it moves no latency percentile today. Flagged only because it's a genuine free win; everywhere else I traced (dispatch wrapping, catalog reads, the effect closures, the pre-existing `catalog.entries().find()` loop) the split reproduced the monolith's exact call counts and loop shapes.

> *"I went looking for the extraction tax and found a refund instead — three countWords passes down to one, everything else exactly as expensive as it was in the monolith, no more, no less."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🔴 Blocking — Spoofed excerpt source is an arbitrary-file-read primitive [F-01] [🧬 Pre-existing]

`WorkshopExcerptScopeHandler.ts:235` · A compromised webview fully controls `payload.source` on `WORKSHOP_SET_EXCERPT`. `coerceWorkshopExcerptSource` (`shared/types/messages/workshop.ts:731-734`) accepts `kind:'file'` with any non-empty `sourceUri` — no scheme check, no workspace confinement. `handleSetExcerpt` runs it through `matchConfiguredSource`; when the URI doesn't match the catalog (the normal case for `file:///home/user/.ssh/id_rsa`), the service returns `'unmatched'` and hands the source back **unchanged** — the attacker's URI survives verbatim into the persisted excerpt. A follow-up `WORKSHOP_REREAD_EXCERPT` reads `excerpt.source.sourceUri`, converts it via `fileURLToPath` at line 235 with zero re-validation, and calls `loadFile` → `fileSystem.readFile`. The VS Code adapter (`VsCodeFileSystem.ts:31-32`, a bare `vscode.workspace.fs.readFile(vscode.Uri.file(filePath))`) enforces no confinement — any path the OS user can read, size-capped but not path-restricted. The content becomes `excerpt.text`, which `postSessionState()` broadcasts to the webview **and** which `handleRunContextWizard` sends verbatim to the configured LLM — two exfiltration channels. `MessageRouter`/`MessageHandler` do no envelope validation that catches this (Rule B checked — no global guard). Reachable with two ordinary messages, no timing tricks.

**Provenance:** byte-identical to `WorkshopHandler.monolith.ts:2445-2454`; the mechanics are exercised (without any confinement assertion) by a test moved verbatim into `WorkshopExcerptScopeHandler.aggregate.test.ts:88-101`. This PR does not introduce the hole — but it doesn't close it either, and this move is the first time the logic sits in an independently testable seam built for exactly this scrutiny.

### 🟡 Standard — A widened `absolutePath` exposure lost its guard-comment [F-10]

`WorkshopContextIntakeService.ts:372` · In the monolith, `withConfiguredResource` was a **private** method that discarded the matched summary (carrying host-only `absolutePath`) after stamping `{group, path}` — and carried an explicit invariant comment: "that path never crosses to the webview or a prompt." Diff-searched (`grep "never crosses to\|HOST-ONLY"`): that comment appears only on deleted lines — dropped, not relocated. The new `matchConfiguredSource` is **public** and its `'matched'` branch returns the full `summary`. The sole current caller only logs `.group`/`.path`, so no live leak — but the type now makes `summary.absolutePath` one property-access away from any future caller, with no comment left warning that this is the one path the design promised would never leave the host.

> *"Passes the scanner, doesn't pass the attacker who notices `coerceWorkshopExcerptSource` trusts any `file://` URI it's handed and `WORKSHOP_REREAD_EXCERPT` will happily read it back into the prompt."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — A stale wizard cancel leaves no trail [F-05]

`WorkshopHandler.ts:1290` · `cancelRun(requestId): boolean` returns `false` on a requestId mismatch — the unit suite asserts exactly this (`WorkshopContextHandler.test.ts:187`). The only production caller, `handleCancelRequest`, discards that return and just returns (1289-1292) — no log, no webview message. Three lines down, the sibling branch for a mismatched `domain: 'workshop'` cancel logs `[WorkshopHandler] Cancel ignored: …` unconditionally (1306-1308). So an identically-shaped stale cancel gets a trail for the room run and nothing for the context wizard. Byte-identical to the monolith — but this is the sprint where `cancelRun` got promoted to a documented boolean contract, and no test drives a mismatched `workshop-context` cancel through the router to confirm anything lands. If a writer's cancel click races a completing wizard and something's wrong underneath, this is where the trail runs out.

### 🟡 Standard — The new `owner` tag isn't wired for 2 of 5 siblings [F-11]

`WorkshopHandler.ts:279` · `sendError` grew an `owner` param this sprint so the output channel names which file failed now that one class is five. Three of five closures pass it (`WorkshopContextHandler`, `WorkshopExcerptScopeHandler`, `WorkshopTodoHandler`) and the team tests for it. `WorkshopSessionMessageHandler` (279-280) and `WorkshopGesturePlaygroundHandler` (299) never do, so anything through them logs as `[WorkshopHandler]` — a 2am grep lands you in the 1,527-line orchestrator instead of the real file. Live impact is one site (`handleListSessions`'s catch), which already prints a second correctly-tagged line beside the mislabeled one, so nothing is lost — just duplicated and inconsistent. The gesture half is dead wiring until an error path gets added there.

> *"Four of five siblings learned to sign their log lines; the wizard's stale cancel still leaves no signature at all — that's the one that pages me at 2am."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟡 Standard — The "pure move" glyph doesn't match its own diff [F-15]

`docs/architecture/2026-08-04-workshop-sprint-04-handler-runway.md:97` · The runway's target-subtree diagram marks `WorkshopHandler.ts` and `WorkshopContextIntakeService.ts` both `[>][~]` (moved AND modified) but marks `WorkshopSessionMessageHandler.ts` `[>]` alone, and the legend frames its R097 rename as a directory-only move. The actual diff deletes the file's own `export type WorkshopMutationRouteRegistrar` (7 lines) and replaces it with an import from `WorkshopHandlerContracts`. That's F7's registrar relocation, which the runway's *own* slices table attributes to a different slice than D4's pure move. The doc's numbers already betray it: base 309 → head 305 is exactly the −4 this hunk produces, printed in the same diagram row. Zero runtime risk — type-only, erased at compile time — but the glyph the runway chose doesn't match what the diff shows.

### ⭐ Praise — The ledger reconciles four independent ways [P-06]

`boundaries.test.ts:459` · Given this panel's #104 history of records drifting from code, went looking hard for the same pattern; it didn't hold up. (1) Manual grep-count of registrations in the four new files = 29, exactly the monolith's 29, name-for-name, none dropped or duplicated. (2) The full family ledger sums to 48. (3) `boundaries.test.ts:414-459` is a live witness — it regexes real `registerMutation`/`router.register` calls out of every file under the handler root and asserts the scraped result equals the hand-declared ledger, plus a mutation/direct split and a duplicate check. (4) Every file line count in the runway (1,527/861/479/99/30/379) matches `wc -l` exactly, and the aggregate test-case counts match `it(` counts once the parameterized cases expand. An unusually well-kept ledger.

> *"Forty-eight routes landed exactly where the ledger promised and even the test counts add up to the digit — so of course the one thing that slipped was a seven-line type export, quietly evicted from the file the diagram swears was never touched."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Move Is Not the Audit

Illuminated by: F-01 (Patricia), F-07 (Parker)

Extraction work quietly answers one question — *did this arrive intact* — while leaving a more important one unasked: *does this still deserve to exist exactly as it is, now that it's finally small enough to see clearly?* A monolith hides its oldest assumptions inside sheer volume; the moment a seam is cut around one of them, that assumption becomes cheap to test, isolate, and reconsider for the first time in its life. A move that only proves parity treats a rare moment of clarity as pure plumbing.

→ Carry forward: When you extract something, ask once, on purpose — *does this still earn its current shape, now that I can finally look at it alone?* — and treat "nothing to see here, it moved unchanged" as a claim worth testing, not a badge of a clean diff.

### Lesson 2 — A Safeguard Is a Rollout, Not an Event

Illuminated by: F-03 (Marcus), F-04 & F-09 (Cal), F-05 & F-11 (Oliver)

In several places here the right instinct already existed *somewhere* in the PR — a boundary test for one seam, a race test for one path, a diagnostic tag reaching three of five siblings, a return value honored by one caller — and simply hadn't reached its structural twin yet. From a distance, a safeguard applied once looks identical to one that's load-bearing everywhere; the difference only shows when someone asks whether the same shape of risk exists anywhere else. Coverage that's half-finished is easy to mistake for coverage that's done.

→ Carry forward: The moment you finish a test, tag, or check for one instance of something, ask what else has that identical shape — then either extend the same care there, or write down, on purpose, why it doesn't apply.

### Lesson 3 — One Fact, One Owner

Illuminated by: F-02 (Marcus), F-06 (Parker), F-12 & F-13 (Stan)

When more than one place independently answers the same underlying question — *is something running, how does a sibling register, which home owns this logic* — those answers drift apart over time, not from inattention but because no single place was ever assigned to know. The route ledger in this PR shows the alternative: one hand-declared source of truth, checked live against what's actually registered, so the two can never quietly disagree. Symmetry among siblings is a promise they can be reasoned about interchangeably, and it's only as strong as whatever keeps checking it's still true.

→ Carry forward: When you notice the same fact derived, or the same logic written, in more than one place, ask whose job it is to know that thing — and if the honest answer is "nobody's, we each just wrote it," give the job to one place and have the rest call it.

### Lesson 4 — What Isn't Checked, Drifts

Illuminated by: F-10 (Patricia), F-15 (Bria) — set against the `boundaries.test.ts` and live-router-test praise

A comment explaining why a path is safe, a diagram claiming a move was pure — both describe intent at the moment someone wrote them, and neither is enforced by anything afterward. The strongest claims in this PR are the ones backed by something that runs and fails on its own the moment reality changes; the others depend on a future reader remembering to keep prose in sync with a diff. The panel didn't distrust the comment or the diagram out of suspicion — they simply couldn't find anything downstream that would catch it going stale.

→ Carry forward: Before writing a safety claim into a comment or a doc, ask whether it could be a test or a check instead — and if it genuinely can't, say so explicitly, so the next reader knows they're trusting memory rather than machinery.

### Lesson 5 — Small Files, Long Shadows

Illuminated by: F-08 (Parker), F-14 (Stan)

A large, unwieldy method draws the eye because it's large; a small workaround in a shared test fixture doesn't, because it's easy to miss — but the fixture is what every future contributor opens first and copies, while the large method might sit untouched for another year. The parts of a codebase built to be reused as a template carry more downstream weight than their size suggests, and whatever pattern lives there gets propagated on purpose, by people doing exactly what good practice tells them to: follow precedent.

→ Carry forward: When reviewing shared scaffolding — fixtures, harnesses, naming conventions — weigh it by how many future files will start life as a copy of it, not by how many lines it takes up.

> *"The diff was clean. The questions left unasked were not."* — Sensei

---

## The Closer

### 🔮 Fortune Cookie

> The house you rebuilt stands true and plumb — but a door you left unlocked before the renovation is still unlocked, and the new rooms have no one watching who comes and goes.

---

## Summary

This is a clean, well-witnessed extraction — the panel's two most adversarial reviewers (Blake and Sam) independently tried to break the invariant the sprint feared most and both walked away convinced, the route ledger reconciles four ways, the full suite is green, and typecheck is clean. **Nearly every finding is one of two shapes:** a pre-existing condition the move faithfully carried forward (the file-read hole, `executeMessage`, the harness type-lie), or a witness/test/consistency gap around a *new* seam whose behavior is otherwise correct and verified. The extraction preserved behavior; what remains is proving the new seams' promises the same way the route ownership is proved.

**Merge posture:** the architectural work is sound and nearly ready. The one item that shouldn't merge *silently* is F-01 — not because this PR caused it, but because this PR is the first place it can be fixed and tested in isolation. Decide it deliberately: close the confinement gap here, or open a fast-follow with eyes open. The four 🟠 Highs are all small, surgical fixes (one `currentRunKind()`, one four-line boundary test, one deferred-promise test, one honored return value); none require rework, and all extend patterns this PR already uses elsewhere.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
