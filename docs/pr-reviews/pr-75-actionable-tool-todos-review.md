# PR Review — feat(workshop): add writer-controlled actionable todos

**Author:** okeylanders · PR #75 · `sprint/workshop-editor-tab-08-actionable-tool-todos` → `epic/workshop-editor-tab`
**Reviewed:** 2026-07-13 · 10-agent panel + Sensei synthesis (`/mr-review`)

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope, superseded, or praise (no action needed).

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Stale-excerpt findings keep an enabled "Add" button whose click can only ever throw | Sam, Bria | 🎯 | **Open** |
| 2 | 🟠 High | Wholesale `### Next steps` rejection is invisible — no log at any of the 3 call sites | Oliver | — | **Open** |
| 3 | 🟠 High | Character-budget truncation branch in `buildWorkshopTodoEvidence` is never exercised by tests | Cal | — | **Open** |
| 4 | 🟡 Standard | Findings extraction is caller discipline across 3 files, not a structural invariant of the aggregate | Marcus | — | **Deferred** — holds today; revisit when a fourth completion path is added |
| 5 | 🟡 Standard | `WorkshopSessionService` at ~897 lines (guideline < 500); todo lifecycle is a natural extraction | Marcus | — | **Deferred** — extraction candidate for a follow-up sprint |
| 6 | 🟡 Standard | Stored `stale` field is dead on arrival; `cloneTodo` is the only honest source of truth | Parker | — | **Open** |
| 7 | 🟡 Standard | DOM-query coupling via hardcoded `data-turn-id` / element id with no shared constant | Parker | — | **Open** |
| 8 | 🟡 Standard | 200-item `WORKSHOP_TODO_BOUNDS.items` cap is untested | Cal | — | **Open** |
| 9 | 🟡 Standard | 6,000-char section-length rejection path is untested (blank-line padding case) | Cal | — | **Open** |
| 10 | 🟡 Standard | Edit/Save task buttons missing the `aria-label` every sibling icon-button carries | Stan | — | **Open** |
| 11 | 🟡 Standard | `handleTodoAction` folds input validation and session errors into one try/catch, unlike sibling guard-clause shape | Stan | — | **Open** |
| 12 | 🟡 Standard | "Add all" fans out into N sequential IPC round trips + N full-snapshot broadcasts | Tim | — | **Deferred** — fine at N ≤ 12; batch if the findings bound grows |
| 13 | 🟡 Standard | Todo-action success log omits which task was touched (`todoId`/`findingKey`) | Oliver | — | **Open** |
| 14 | 🟡 Standard | `openContext` silently no-ops on missing DOM node while sibling `showTodoSource` toasts | Oliver | — | **Open** |
| 15 | 🟡 Standard | `onOpenContext` optional with `onOpenTools` fallback — the fixed `+` bug is one missing prop from returning | Bria | — | **Open** |
| 16 | 🟢 Nit | `WORKSHOP_TODO_BOUNDS` (a session bound) declared in the parser module | Stan | — | **Open** |
| 17 | 🟢 Nit | Nested ternary re-derives the action→status mapping the switch already established | Parker | — | **Open** |
| 18 | 🟢 Nit | Per-turn `Set` construction re-scans all todos per render (sub-ms today) | Tim | — | **Deferred** — free fix, no present cost |
| 19 | 🟢 Nit | Sprint checklist `+`-routing box left unchecked despite shipped implementation | Bria | — | **Open** — confirm deliberate scope-narrowing |
| 20 | 🟢 Praise | Todo evidence builder reuses established budget-packing machinery + registers new frame tags | Marcus | — | **N/A** |
| 21 | 🟢 Praise | Todo aggregate guards the stale/idempotency/provenance invariants that cause 3am pages | Blake | — | **N/A** |

---

## Blast Radius

- 35 files changed · +1,760 / −58 lines
- New files: 6 (3 source — `WorkshopActionableFindings.ts`, `WorkshopTodoList.tsx`, `useWorkshopThreadAutoscroll.ts` — plus 3 test suites) · Migrations: no · New surface: 1 application-service module, 1 component, 1 hook, 1 message route (`WORKSHOP_TODO_ACTION`)
- Diff is ~2.7k lines; all reviewers received the complete diff (no truncation) plus full on-disk files.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B− |
| 🛡️ Security | A |
| 🧪 Tests | C+ |
| 📖 Quality | B− |
| ⚡ Performance | B |
| 🎯 Domain | B− |

---

## Executive Briefing

No blockers. Three 🟠 High items, one with panel consensus:

🟠 **[Sam + Bria · 🎯 Consensus]** Stale-excerpt "Add" always throws — after an excerpt replacement, old report bubbles keep fully enabled Add/Add-all buttons; the aggregate's stale guard means the click can only ever produce a generic error toast. The invariant holds; the affordance lies.

🟠 **[Oliver]** Wholesale rejection is invisible — a slightly malformed `### Next steps` footer (checkbox syntax, one duplicate, one nested line) yields "no Add button appeared" with categorically nothing in the Output Channel to explain why. One trace line at the three extraction call sites makes it diagnosable.

🟠 **[Cal]** The truncation branch is theater — the evidence-budget test's tiny fixture text means the 12-item cap always engages before the 12,000-char budget; realistic ~1,100-char blocks would hit the character break first, and that branch has never run under test.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟡 Standard — Extraction/aggregate boundary is only half-drawn

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:32` — The aggregate imports `WORKSHOP_TODO_BOUNDS` for its own invariant but stops short of calling `extractWorkshopActionableFindings()` itself. Every completion path pairs raw `content` with separately-derived `actionableFindings` at the call site (`WorkshopAnalysisSidePass.ts:85`, `:108–110`; `WorkshopRunCompletion.ts:125`). Extraction is pure and deterministic — consistent with the aggregate's own "pure aggregate" contract — so the invariant "findings always match the content they were parsed from" could be structural (computed once, inside `completeToolReport`/`recordCapabilityArtifact`/`completeRun`) rather than caller discipline spread across three files. A fourth completion path added later has no compiler-enforced reason to remember.

### 🟡 Standard — The aggregate keeps absorbing responsibilities past the project's own size guideline

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:104` — Already 750 lines at the epic merge point, past CLAUDE.md's "God Component: any file > 500 lines?" checklist line; this PR adds the full todo lifecycle (lines 577–679, 861–868) and lands at ~897. The aggregate now owns excerpt versioning, context-brief revisions, sidecar bookkeeping, delivery cursors, capability artifacts, *and* todo CRUD/reorder/staleness. The PR already demonstrates the right instinct in extracting `WorkshopActionableFindings.ts`; the todo lifecycle touches only `this.todos`/`this.todoCounter` and would be a natural second extraction — a small collaborator the session composes.

### 🟢 Praise — Todo evidence-shaping correctly reuses the established budget-packing pattern

`packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts:60` — `buildWorkshopTodoEvidence` mirrors the existing handoff machinery: reserved header allowance, all-or-nothing per-item inclusion so provenance is never separated from task text, `neutralizeReservedPersonaPromptDelimiters` on every untrusted field, and its new frame tags registered in `workshopPromptFrames.ts` rather than left as a new injection seam.

> *"The todo aggregate is solid stonework, but it's stonework laid on a foundation that's already load-bearing five other rooms — time to think about a second floor, not just another wall."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

### 🟢 Praise — Todo aggregate guards the invariants that usually cause the 3am page

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:591` — The stale-excerpt guard runs before the idempotent-existing return and before the 200-item bound, so a superseded excerpt can neither re-promote nor leak into host evidence; snapshots recompute `stale` per current version; `buildWorkshopTodoEvidence` never separates task text from its immutable source and never ships `todo.id`. Two suspected bugs were chased and verified false: dictionary capability artifacts never receive findings (no phantom Add button), and plain host messages never inherit a sidecar's `reportTurnId` (no provenance misattribution). The risky paths — mid-run mutation, excerpt replacement, provider-id leakage — are covered by the new tests. Nothing to fix before merge.

> *"I went looking for the incident and the aggregate already closed the door I usually get paged through — clean to ship."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — "Add" stays clickable on a stale-excerpt report and always throws [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:244` — `addTodoFromFinding` (`WorkshopSessionService.ts:591–593`) throws `'Cannot add a task from a stale excerpt turn'` whenever the source turn predates the pinned excerpt — guarded and tested. But nothing upstream checks `excerptVersion` before rendering the affordance: the findings block renders whenever `turn.actionableFindings` is truthy, and each Add button is disabled only by `promoted` (`WorkshopThread.tsx:58–62` builds `promotedFindingKeys` with no staleness check). Run a tool on excerpt v1, leave a finding un-promoted, replace the excerpt — the old bubble keeps a live, enabled "Add" whose click posts `WORKSHOP_TODO_ACTION` → throws → generic `ERROR('workshop.todo', …)` toast. Very reachable: iterating the pinned excerpt mid-session is a first-class workflow per this sprint's own product decisions. Thread the current excerpt version (or a per-finding `stale` flag) into the bubble and disable with a "stale excerpt" tooltip.

> *"Found the trap door — the report bubble keeps a perfectly healthy-looking 'Add' button standing guard over a claim the aggregate revoked the moment the excerpt moved on."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — `stale` is stored as if it were state, but only `cloneTodo` is ever right

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:630` — At the point `stale: sourceTurn.excerptVersion !== this.excerptVersion` runs, the guard at 591–593 just proved it `false` — the stored value is dead on arrival and goes wrong the moment `replaceExcerpt` bumps the version. Every correct external read comes from `cloneTodo` (line 866) recomputing it: two silent sources of truth for one derived fact. A future method inspecting `this.todos` directly would get a wrong answer with no compiler complaint. Simpler: type the private field `Omit<WorkshopTodoItem, 'stale'>[]` and let `cloneTodo` be the only place `stale` exists — matching what the field's own doc comment ("derived") already claims.

### 🟡 Standard — New DOM-query coupling bypasses this file's own ref pattern

`packages/core/src/presentation/webview/WorkshopApp.tsx:339` — `showTodoSource` queries `[data-turn-id="…"]` (produced once in `WorkshopTurnBubble.tsx:146`) and `openContext` queries `getElementById('pm-ws-context-brief-input')` — hardcoded strings with no shared constant, in a file that already models `useRef` four lines up. No other parent in `presentation/webview/` queries a child's DOM this way. Renaming the attribute silently degrades `showTodoSource` to "outside the current reload window" for every turn, forever. Cheapest fix: hoist the attribute name into one exported constant both files import.

### 🟢 Nit — Nested ternary re-derives a mapping the switch already established

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:590` — `complete`/`reopen`/`dismiss` fall through to one block, then re-discriminate via a two-deep ternary where `'reopen'` becomes `'open'` only by falling out of both branches. Three explicit cases each calling `setTodoStatus` with its own literal say the same thing with one decision point.

> *"The `stale` field docs itself as derived and then gets stored anyway — that's a tell that the type is doing theater while `cloneTodo` does the actual work."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — Character-budget truncation path in buildWorkshopTodoEvidence is never exercised

`packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts:92` — The "omits whole tasks at the item bound" test builds `items + 2` todos with tiny text (`Task ${index}`), so `includedItems` is capped by the upstream `.slice(0, items)` — never by the character accumulator this line implements. Realistic blocks embed `todo.text` and `source.findingText`, each up to 500 chars, plus fixed labels — ~1,100+ chars per block, so 12 max-size items (~13,200 chars) blow the 12,000-char budget before the item cap engages. No test forces this break, so an off-by-one in `contentCharacters` or a `>=`/`>` flip ships silently — the exact "provenance never separated from text" guarantee at the boundary that matters in production.

### 🟡 Standard — The 200-item WORKSHOP_TODO_BOUNDS.items cap is untested

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:600` — Searched the test suite for `WORKSHOP_TODO_BOUNDS` or any near-200 scenario — not found. A `>=`→`>` regression or an accidental guard removal during a refactor of the dedup check just above would pass every existing test.

### 🟡 Standard — Section-length rejection (6,000 chars) in extractWorkshopActionableFindings is untested

`packages/core/src/application/services/workshop/WorkshopActionableFindings.ts:54` — The oversized-payload test exercises `itemCharacters + 1` and `items + 1`, never `sectionCharacters`. It's a genuinely distinct path: `section` includes blank lines; `meaningfulLines` filters them — so 12 valid items padded with blank lines can trip the section bound while passing both other checks. A plausible "simplification" computing length from `meaningfulLines.join('\n')` would silently disable the guard.

> *"Boundary checks that are only tested one-sided — reject-above but never confirm-at — are half a test; the threshold itself is where regressions actually live."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — Edit/Save task buttons drop the aria-label every icon-only sibling button carries

`packages/core/src/presentation/webview/components/workshop/WorkshopTodoList.tsx:106` — Every other icon-only button in this same component ("Mark task complete"/"Reopen task", "Move task up/down", "Dismiss task") pairs `title` with `aria-label`; `WorkshopComposer.tsx` establishes the same pairing project-wide. The new Save (106) and Edit (110) buttons carry only `title` — a screen reader announces nothing. Add `aria-label="Save task"` / `aria-label="Edit task"`.

### 🟡 Standard — handleTodoAction mixes input-validation with session-op error handling under one try/catch, unlike every sibling

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:567` — Siblings validate payload shape first with early-return `sendError` guards, then try/catch only the session call (`handleSelectPersona`) or skip try/catch entirely (`handleSetChatTarget`, `handleSetContextBrief`, `handleQuickAction`). Here five cases of shape validation (`throw new Error(...)`) and the actual mutation share a single try/catch, so a malformed payload and a legitimate session failure (stale excerpt, unknown task) are indistinguishable in control flow. Split shape validation into per-case guards to match the established shape.

### 🟢 Nit — WORKSHOP_TODO_BOUNDS lives in the findings-extraction module instead of beside the aggregate it bounds

`packages/core/src/application/services/workshop/WorkshopActionableFindings.ts:8` — `WORKSHOP_SNAPSHOT_TURN_WINDOW = 100` already shows where a session bound goes: declared in `WorkshopSessionService.ts`, next to the list it caps. `WORKSHOP_TODO_BOUNDS` is enforced entirely inside the aggregate yet declared in the parser module — though the shared `itemCharacters` value is a plausible reason it stayed.

> *"We already have `WORKSHOP_SNAPSHOT_TURN_WINDOW` sitting right there in WorkshopSessionService.ts showing where a session bound goes — and two doors down, `handleSelectPersona` shows exactly how to shape a guard-clause-then-try/catch handler. Next door. Every time."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — "Add all" fans out into N sequential full-snapshot round trips instead of one batched action

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:222` — Each `onAddTodo` is one `postMessage`; host-side each `handleTodoAction` unconditionally calls `postSessionState()`, cloning up to 100 windowed turns + 200 todos. One "Add all" click = 12 webview↔host↔webview round trips and 12 full re-renders where one batched `{ action: 'add_all', sourceTurnId, findingKeys }` + one broadcast would land atomically. At N=12 the dominant cost is structured-clone IPC overhead, not compute — it won't hang the host, but items visibly pop in one at a time, and it multiplies if the findings bound is ever raised.

### 🟢 Nit — Per-turn `Set` construction re-scans all todos on every snapshot

`packages/core/src/presentation/webview/components/workshop/WorkshopThread.tsx:58` — Inside `turns.map`, so a full render does O(turns × todos) ≈ 20,000 comparisons + up to 100 fresh `Set` allocations, recomputed on every session broadcast (fresh array identities defeat the memo anyway). Sub-millisecond in V8 — flagged only because the fix is free: one `Map<turnId, Set<findingKey>>` built in a single O(todos) pass before the map.

> *"Twenty thousand comparisons and twelve IPC round trips are both trivial today — I'm flagging the pattern, not the ticket."* — Tim

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — Whole-section finding rejection is invisible at every call site

`packages/core/src/application/services/workshop/WorkshopRunCompletion.ts:125` — The parser rejects a malformed `### Next steps` section wholesale on ANY bad line — correct, deliberate safety design, and rightly silent as a pure function. But none of its three call sites (`completeWorkshopRun`; `WorkshopAnalysisSidePass` lines 85, 108) do anything with the outcome besides attach it. All three already log liberally for adjacent events (zombie completions, sidecar replacement, cancellation) — never for "content contained `### Next steps` and it parsed to 0 findings." When a model emits a slightly malformed footer — very plausible: checkbox syntax, one duplicate, one nested continuation — the writer's only symptom is "no Add button showed up," and the Output Channel has nothing. One trace line per call site (heading present? item count? accepted vs rejected) makes it fully diagnosable at no cost to the reject-wholesale behavior.

### 🟡 Standard — handleTodoAction's success log can't identify which task was touched

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:610` — Siblings log the specific value that changed (`handleSetContextBrief`: char count; `replaceExcerpt`: version + retired count; cancel/preempt: `requestId`). With up to 200 tasks and 6 action kinds, this line records only the verb and source — "I clicked complete on task 3 but task 5 got marked done" leaves a wall of identical lines. `action.todoId`/`sourceTurnId`/`findingKey` are already in scope.

### 🟡 Standard — openContext has no fallback trail; its sibling in the same commit does

`packages/core/src/presentation/webview/WorkshopApp.tsx:274` — `openContext` silently no-ops via optional chaining if the textarea id lookup fails; `showTodoSource`, added in the same PR with the identical lookup-and-focus pattern, explicitly toasts on the not-found case. Today the panel is always mounted — but the `+` button was just repurposed into the core context entry point, and a lazy-mount or id rename turns it into an entirely silent dead button: no toast, no log, no message.

> *"Three roads to the same silence: a rejected section, an untraceable click, and a button that forgot how to complain."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — The "+" button's dead-tools-fallback still exists in the type contract

`packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx:96` — Acceptance criterion: the Tools button is the *sole* tool-browser entry point. `WorkshopApp.tsx` wires `onOpenContext` unconditionally, so today's behavior is correct — but the prop is typed optional and `onClick={onOpenContext ?? onOpenTools}` falls back to the exact pre-sprint bug if it's ever omitted, and the new composer test always passes both callbacks. Is the fallback intentional defensive coding, or should `onOpenContext` be required (fallback deleted) so the type system enforces the invariant rather than one wiring site?

### 🟢 Nit — Sprint checklist still shows the `+` routing item unchecked despite being implemented and tested

`.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/08-actionable-tool-todos.md:64` — The only unchecked UI item, yet the same diff's Kickoff Implementation Record says "The `+` routing bug itself is fixed" and ships the test + wiring. Likely deliberate: what shipped (focus the Context Brief) is narrower than the literal task text ("Context Selector / project-file browser"), which the clarifications defer. Worth confirming that reading rather than the box simply being missed.

### 🟢 Nit — "Add"/"Add all" stay clickable on stale-excerpt turns; rejection surfaces as an error toast [🎯 Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx:244` — The aggregate boundary is sound (stale findings can never enter evidence), but the bubbles never receive the current excerpt version, so Add stays enabled under superseded reports and rejection arrives as a generic ERROR toast after the round trip. Not an acceptance-criteria violation — is the toast UX the intended final polish, or what's left before the sprint's own F5-smoke checkbox?

> *"The stale-excerpt guard rejects the mutation correctly — it just waits until after the click to break the news, which is a very 'trust, but verify at the database' way to build a UI."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Guard Was Right, the Door Didn't Know It

Illuminated by: Sam + Bria consensus; Bria's optional-fallback; Parker's dead `stale` field

Three findings, one shape: the logic that decides "no" was written correctly and even tested, but that decision never traveled to the place a human or a type system would act on it first. A button stays clickable because staleness is only known after the click; a prop stays optional because "this is the only path in" was never written into the signature; a derived fact gets stored, so two places could hold the answer and only one is honest. Correctness enforced at the last possible moment reads, from the outside, exactly like a bug.

→ Carry forward: When you add a guard or a derived fact, ask "where else does this answer need to already be known — before the click, before the optional prop is skipped, before the field is read?" — and move the check there too, or make the wrong state unrepresentable.

### Lesson 2 — A Correct "No" Still Owes You a Receipt

Illuminated by: Oliver (all three findings)

Failing closed is good design; failing closed *silently* is a design only the author can debug. The parser's wholesale rejection is the safe choice, but "no Add button appeared" plus an empty Output Channel describes a system that protects data while erasing its own reasoning. And when two features built in the same sprint handle the same failure mode two different ways, that's not a style question — it's evidence that "how do we report a no" isn't yet a decision, just a habit that varies by author.

→ Carry forward: For every branch that silently returns, no-ops, or rejects — ask "if this fires in someone else's install six weeks from now, what evidence exists besides my memory of writing it?" If none, add one log line at the point of decision.

### Lesson 3 — Toy Fixtures Test Toy Boundaries

Illuminated by: Cal (all three findings)

When a guard has two limits — a count and a size — a fixture picked for convenience will almost always trip the *cheaper* one first, leaving the expensive, production-relevant one theoretically covered but never actually run. The suite goes green, coverage goes up, and the exact edge that matters stays unverified. Passing tests measured against the wrong boundary are a false-confidence machine, not a safety net.

→ Carry forward: When a guard has more than one limit, write at least one fixture deliberately sized to cross each limit *independently* — one that hits the size bound under the count bound, and one that does the reverse.

### Lesson 4 — If Three Callers Must Remember, One Will Forget

Illuminated by: Marcus #1; Stan's bounds-placement nit

An invariant lives wherever you put the code that enforces it — and if that place is "every caller remembers to do the right thing in the right order," the invariant really lives in someone's memory, not in the system. The same instinct shows up in where a constant is declared: put a session-level bound in the parser module and you've quietly told the next reader the parser owns that rule, when it doesn't. Both are the same failure of geography — the rule and its true owner live in different files.

→ Carry forward: Before adding a "the caller must call X first" step, ask whether X can fold into the thing being constructed instead — and declare shared constants where their *owner* lives, not where they were convenient to reach.

### Lesson 5 — The Canonical Example Was Already in the File

Illuminated by: Stan (aria-labels, handler shape); Parker (DOM coupling)

None of these are unknown patterns — the aria-label convention, the guard-clause shape, the ref-based coupling — they sit three lines away in the same file or its nearest sibling. Drift like this doesn't come from not knowing better; it comes from writing the new thing by feel instead of by comparison. The codebase had already taught the lesson once. It just wasn't consulted the second time.

→ Carry forward: Before writing a new button, handler, or cross-component reference, find its nearest sibling on purpose and diff your instinct against it — "does mine match, and if not, why is mine right?"

> *"The review found no cracks in the foundation — only in the signage pointing to where the foundation already is."* — Sensei

---

## The Closer

### 🔮 Fortune Cookie

*He who guards the vault flawlessly but leaves the doorbell lit will spend his evenings answering rings that can only ever be refused.*

---

## Summary

Nearly there — no blockers, and the two reviewers who hunt catastrophe (Blake on correctness, Patricia on the injection surface) both returned clean passes with explicit praise for the aggregate's invariants and the prompt-boundary neutralization. The work before merge is concentrated in one consensus UX gap (stale-excerpt Add buttons that can only fail), one observability hole (silently rejected `### Next steps` sections), and one test that never actually reaches the boundary it claims to protect. Everything else is polish and well-reasoned deferrals. Fix the three 🟠 items and this ships with confidence.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
