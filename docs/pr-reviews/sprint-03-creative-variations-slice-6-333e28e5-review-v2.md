# Commit Review v2 — feat(workshop): add Creative Variations persona prefill

**Author:** Okey Landers · **Commit:** `333e28e5` on `sprint/conversation-widgets-03-creative-variations`
**Reviewed:** 2026-08-13 · **Mode:** Full (`--last-commit`) · **Parent:** `41f5b717` (sole parent, clean)

**Scope note.** Reviewed as the diff `333e28e5^..333e28e5` only. Three untracked working-tree
artifacts were excluded and left untouched: `.todo/tech-debt/2026-08-13-fresh-host-time-frame-dropped.md`,
`Prose Minion.zip`, and `docs/architecture/2026-08-13-workshop-prompt-assembly/`. No merge-commit
caveat applies. The working tree matched the commit, so files were read from disk. Slice 5 is the
accepted baseline; Slice 7 hardening and current-state documentation are out of scope.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason ·
**Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise,
superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Prompt-size pin deleted, not re-pinned, in the commit that grew it 62% | Cal, Stan, Blake, Tim | 4 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-02 | 🟠 High | Provenance decay writes a false "Pasted passage" claim into the durable record | Bria | 1 runway-prompted | — | **Addressed** |
| F-03 | 🟡 Standard | Frame ceiling is a hand-maintained twin of a compiler-enforced registry; neither relationship nor fit is tested | Marcus, Cal | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-04 | 🟡 Standard | Widgets-browser ask copy solicits the constraints the frame instruction forbids inferring | Bria, Patricia | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-05 | 🟡 Standard | Two dispatches fail open where four fail closed | Marcus, Oliver | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-06 | 🟡 Standard | Rejection log and writer notice never name the widget | Oliver | 1 independent | — | **Addressed** |
| F-07 | 🟡 Standard | Boundary descriptor blind to Creative's un-namespaced vocabulary | Marcus | 1 runway-prompted | — | **Addressed** |
| F-08 | 🟡 Standard | `creativeSourceReferenceCharacters` names a bound it does not impose | Stan, Parker | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-09 | 🟡 Standard | Persona honesty paragraph is unreachable whenever context travels | Parker, Cal | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-10 | 🟡 Standard | Persona chip can win a race against a reopen the writer asked for first | Sam | 1 independent | — | **Addressed** |
| F-11 | 🟡 Standard | Decode-time ownership check escalates one bad field into total session loss | Patricia | 1 independent | — | **Addressed** |
| F-12 | 🟡 Standard | Architecture allowlist grants three tokens the file no longer contains | Stan | 1 runway-prompted | — | **Addressed** |
| F-13 | 🔵 Nit | Blank-bubble fallback cannot see ownership refusal | Sam | 1 independent | — | **Addressed** |
| F-14 | 🔵 Nit | Modal asserts a provenance fact the host never verifies | Patricia | 1 independent | — | **Addressed** |
| P-01 | 🟢 Praise | Catalog-derived chip presentation with a return-type-enforced exhaustive switch | Parker, Sam, Marcus | 3 independent | 🎯🎯 Strong Consensus | **N/A — preserve** |
| P-02 | 🟢 Praise | Persona ownership minted and gated from a single object literal | Blake, Patricia | 2 independent | 🎯 Consensus | **N/A — preserve** |
| P-03 | 🟢 Praise | Two-tier required/bounded split encodes the "blank is meaningful" locked decision | Bria | 1 runway-prompted | — | **N/A — preserve** |
| P-04 | 🟢 Praise | Compile-forced totality of writer-facing rejection copy | Oliver | 1 runway-prompted | — | **N/A — preserve** |
| P-05 | 🟢 Praise | Reserved-delimiter fitness test derives expectations from registry entries | Marcus, Patricia | 2 independent | 🎯 Consensus | **N/A — preserve** |
| P-06 | 🟢 Praise | Raised ceiling is zero-cost — measured at 2.25 ms worst case | Tim | 1 runway-prompted | — | **N/A — preserve** |

## Resolution notes — 2026-08-14

These statuses describe the remediation worktree after reviewed commit
`333e28e5`; the finding narratives above remain the historical review of that
commit.

- **F-01, F-03, F-08:** each recommendation registry entry now owns its exact
  frame ceiling. The generic pre-id envelope is derived from the registry and
  the selected feature is rechecked after id extraction. Tests prove a
  maximum-field Creative frame fits, a smaller Gesture ceiling rejects inside
  the coarse envelope, and the complete Creative source-reference field is
  bounded in the same unit declared to the model. The assembled prompt is
  pinned at **7,823 characters**. The originating 2026-07-31 tech-debt item is
  marked complete.
- **F-02, F-09, F-14:** `persona-prefill` is now a durable custody record with
  canonical `personaId` and one-way `editedByWriter`; edits no longer become the
  false claim `pasted`. Provider prompts omit display provenance entirely. The
  modal gives persona custody precedence even when context travels and makes no
  unverified claim that the passage came from room material.
- **F-04:** the Host-preparation ask now requests only constraints the writer
  actually stated and explicitly leaves invariant/aim fields blank otherwise.
- **F-05, F-06, F-13:** opening and source-reference dispatches are exhaustive;
  known-widget rejection notices and bounded logs name the exact widget; a
  frame-only response gets nonblank display copy even when session ownership
  later refuses the recommendation, and the log records
  `participant_not_persona`.
- **F-07, F-12:** the architecture scanner now recognizes Creative's bare
  fields, reasons, and frame tags at generic seams. The three stale hardcoded
  display-name permissions were removed from `WorkshopTurnBubble`.
- **F-10:** a pending committed-config reopen now wins over a later Creative
  persona-chip click, with an explicit writer-facing refusal.
- **F-11:** checkpoint shape validation still validates the recommendation but
  permits local recovery. Normalization drops only a non-persona-owned
  recommendation, records `discarded-nonpersona-widget-recommendation`, and the
  strict current-state assertion remains unchanged after normalization.

Verification: targeted remediation **13 suites / 256 tests**; full Jest **208
suites / 2,293 tests / 2 snapshots**; core, webview, and extension TypeScript;
ESLint **0 errors / 956 existing warnings**; production resource staging, both
webpack bundles, and bundle sentinel; `git diff --check`. Webpack retained its
three advisory size warnings.

## Review coverage

- **Read fully:** `CreativeVariationsRecommendation.ts`, `CreativeVariationsConfigCodec.ts`,
  `WorkshopWidgetRecommendationOperations.ts`, `workshopWidgetRecommendationProtocol.ts`,
  `WorkshopRunCompletion.ts`, `WorkshopSessionStateV1Shape.ts`, `WorkshopSessionRecords.ts`,
  `useWorkshopWidgetOpening.ts`, `useCreativeVariationsAuthoring.ts`,
  `WorkshopCreativeVariationsModal.tsx`, `WorkshopTurnBubble.tsx`, `workshopWidgetAskPrefill.ts`,
  `workshopPromptFrames.ts`, `promptBudgets.ts`, `persistedValidation.ts`,
  `WorkshopWidgetAvailabilityPolicy.ts`, plus all 14 changed test files.
- **Siblings read:** `GesturePlaygroundRecommendation.ts`, `LexicalGravityRecommendation.ts`,
  `GesturePlaygroundConfigCodec.ts`.
- **Governing evidence:** sprint contract, implementation runway, Slice 6 handoff, Slice 5
  review + ledger, `pr-99-agent-prepared-widgets` review, `CLAUDE.md`, ADR 2026-07-30,
  `.todo/tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md`.
- **Executed at review time:** focused Jest run — **26 suites / 362 tests passed**. Parser
  boundary probes, prompt-size measurement, frame-scan benchmark, and the composed
  boundary-scanner check were run in temporary files and deleted; `git diff` is empty and the
  working tree carries only the three pre-existing untracked artifacts.
- **Not verified:** human F5 visual inspection of banner/chip/label layout (display capture
  unavailable; the author makes no fixture-only screenshot claim). Live billable provider calls.
- **Blast radius:** 32 files, +1,399 / −58. 15 production, 14 test, 3 evidence. No migrations,
  no new routes, no new message types, one new production module.

---

# Part I — Semantic Runway


**Commit:** `333e28e5` · **Author:** Okey Landers · 2026-08-13T21:43:22-05:00
**Parent:** `41f5b717` (sole parent, clean) · **Branch:** `sprint/conversation-widgets-03-creative-variations`
**Blast radius:** 32 files, +1,399 / −58 — 15 production, 14 test, 3 evidence/planning.
No migrations. No new routes. No new message types. One new production module.
**Excluded from scope:** three untracked working-tree artifacts, untouched by the commit.

**Runway thesis.** This is the third member of an established widget-recommendation family, and
inside its own slice it is the most disciplined of the three: it lets an AI persona do the
tedious transcription work of setting up a Creative Variations sheet while refusing the persona
every unit of authority that costs the writer money, prose, or a decision. The interesting
questions are almost entirely *outside* the feature slice — in what a third member does to
shared family surfaces that were sized for one, and in a tech-debt file that named this exact
commit as the moment those surfaces had to change shape.

---

## 1. Working Definition & Real Job

**Literal code change.** One new module (`CreativeVariationsRecommendation.ts`, 303 lines) that
owns Creative's prompt copy, its 20-marker frame grammar, its field bounds, and a strict parser.
It is registered as the third entry in a closed registry. Around it: a `persona-prefill`
provenance arm, a recommendation-seed type, a persisted-shape validator, a defensive clone arm,
a participant guard on persisted turns, a presentation switch, an opening-controller arm, an
ask-prefill builder, six reserved prompt delimiters, and one new prompt budget.

**Functional capability.** A Host or Guest persona may now end a turn with one exact control
frame proposing Creative Variations, carrying the passage to vary and up to seven other
authoring inputs. The host strips the frame from view, validates every source address against
the live session, and attaches a chip to that exact turn. Clicking it opens a fully editable
sheet with the fields pre-populated and an honest attribution banner. Nothing generates, selects,
accepts a risk, or commits.

**Business problem.** The persona already knows which passage is failing and why — it is three
inches away in the same conversation. Before this commit its only available move was to describe
the widget in prose while the writer re-transcribed a passage the persona could already see. The
commit removes the transcription tax on the widget's most-used path.

**What the wording and structure emphasize.** Every name in the slice pushes toward *inputs*.
The type is `RecommendationSeed`, not `Configuration`. The prompt says "Prepare inputs only:
never generate the workup, choose a take, accept a risk, or commit for the writer." The banner
says "they set the table; generating, selecting, and committing stay yours."

**What the structure suppresses.** The seed type is eight optional scalar fields and nothing
else — there is structurally no place to put a workup, a selection, an accepted risk, a note, a
committed identity, or a provenance claim. That suppression is the feature's central safety
property, and it is enforced by the type rather than by a check that could be forgotten.

**What must survive any valid alternative.** A persona can never cause a billed generation, can
never choose prose on the writer's behalf, can never accept a risk, can never commit, and can
never assert where text came from. Recommendations attach only to the turn that produced them
and only when that turn belongs to a persona.

**Competing interpretation.** One could read this as a *convenience* slice — the last input
affordance before Slice 7's hardening. The evidence resists that reading: three independent
ownership gates, a type designed for what it cannot hold, an unforgeable host-minted provenance,
and a decay transition on that provenance are not the shape of a convenience feature. This is a
trust-boundary slice wearing a convenience feature's changelog entry.

> This commit is not merely wiring a persona-authored prefill into an existing form. Its real job
> is to move *labor* across the human–model boundary while moving *no authority at all*, and to
> do it as the third occupant of shared family surfaces that were built for one.

---

## 2. Declared Intent, Observed Behavior & Open Meaning

**[Declared]** Sprint slice table, line 117: "Add persona recommendation/prefill while keeping
report-prefill deferred." Runway §2.10: "Stage writer-controlled persona recommendation/prefill";
verification "production-policy parser/budget/permission/correlation route tests"; rollback
"remove one recommendation arm." Locked decision, lines 25-28: "Personas may recommend or
prefill; they may not generate, select, or commit variations for the writer."

**[Observed] Alignment is strong on the declared surface.**
- Writer authority: enforced at ingress (`WorkshopSessionService.completeRun:1522`), again at
  persisted-shape validation (`WorkshopSessionStateV1Shape.ts:559-562`), and structurally by the
  seed type. Tests cover the tool-turn refusal from both directions.
- Report-prefill: genuinely absent. No analysis contract, prompt, parser, or result chip changed.
  This is real negative space, not a partial implementation.
- Availability: the production catalog policy governs both prompt inclusion and result dispatch;
  `completeWorkshopRun` closes over the production constant, so the reviewed path *is* the
  shipped path.
- Correlation: the chip carries `turn.personaLabel` from the exact turn, frozen at completion.

**[Observed] Two places where observed behavior exceeds or diverges from declared intent.**

1. **The commit changes a family-wide budget the slice contract does not mention.**
   `WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS` moves from a Gesture-only sum (15,300) to
   `Math.max(gestureSum, creativeSum)` = 51,500. That ceiling is evaluated *before* the widget id
   is known, so it now governs Gesture and Lexical Gravity too. The declared rollback seam
   ("remove one recommendation arm") does not cleanly restore it.

2. **The two prompt surfaces ask the Host for different things.** The Widgets-browser ask copy
   requests "grounded constraints, a creative aim"; the frame instruction says of the same three
   fields "Do not infer a constraint merely because it seems prudent; leave the field empty when
   the writer declared none" and "Leave it empty for random generation." A model receiving both
   must decide whether clicking the browser button *counts as declaring* constraints.

**[Unknown]** Whether the family-ceiling change was an intended budget decision or the
minimal-diff way to express "Creative's frame is bigger." Nothing in the sprint doc, the handoff,
or the commit message discusses it.

**Note on the evidence documents themselves.** The sprint addendum and the handoff both state the
Slice 6 worktree "remains uncommitted and unpushed," and both are inside this commit. They are
accurate as of authoring and stale as of commit.

---

## 3. Business Story & Rulebook

**Actors.** The **writer** holds sole authority to send an ask, open a chip, edit any field,
press Generate (the billed moment), select cards, accept advisory risks, and commit. **Host and
Guest personas** have identical recommendation rights — the code does not distinguish them, and
no document does either. **Tool turns** are an explicitly excluded actor. The **session** is the
authority on which source addresses are real right now. The **availability policy** decides
whether Creative is offered to personas at all.

**Trigger and preconditions.** Two doors. *Door A*: a persona volunteers a frame at the end of a
turn. *Door B*: the writer opens the Widgets browser, clicks "Ask agent to configure, then open,"
and the composer is seeded with an editable request — verified: it calls `seedComposerDraft`, it
does not send.

**The rulebook the code encodes.**

| Field | Tag required | Content required | Bound | A blank field means |
|---|---|---|---|---|
| `subject-passage` | yes | **yes** | 20,000 | — rejects |
| `source-references` | yes | **yes** (`none` counts) | ≤ 8 refs | — rejects |
| `sampling-distance` | yes | **yes** | closed set of 4, case-sensitive | — rejects |
| `take-count` | yes | **yes** | 3 \| 4 \| 5 | — rejects |
| `surrounding-context` | yes | no | 20,000 | nothing should travel |
| `must-survive` | yes | no | 2,000 | **writer declared no preservation constraint** |
| `must-not-change` | yes | no | 2,000 | **writer declared no hard boundary** |
| `creative-aim` | yes | no | 1,000 | **generate at random** |

The two-tier rule — every tag present, only four with content — is what lets blank stay
*meaningful*. It descends directly from the sprint's second locked decision: "a blank field means
no constraint of that kind, and the model does not silently infer one."

**The rule that code cannot enforce.** Deterministic code cannot distinguish a constraint the
writer declared from one the model thought prudent. That rule lives entirely in prompt copy. It
is the single place in the slice where writer authority rests on model compliance — which is
exactly why the Door-B/frame divergence above matters more than its size suggests.

**Value created.** The most-used path drops from full manual transcription to one click, and the
persona's situational knowledge reaches the widget without a round trip through the writer's
keyboard.

**Harm prevented.** A persona generating, selecting, accepting, or committing. A prefill that
lies about where text came from. Silently invented constraints narrowing a creative space the
writer thought was open. Invented or stale source addresses. Prompt injection through reserved
delimiters embedded in writer prose. A late chip click destroying in-progress authoring work.

---

## 4. Narrative Flow: Beginning, Development, Turn & Ending

**Beginning.** A persona finishes streaming. `completeWorkshopRun` holds the raw text, the live
session aggregate, and a run that may already have been preempted.

**Development — escalating commitment, each stage able to reject the whole frame.**
Heading multiplicity → frame ceiling (widget still unknown) → widget id extraction → live and
available check → feature parser: exact marker multiplicity and order, no text outside the frame
or between adjacent tags, required-non-empty, per-field bounds, source-reference grammar,
distance enum, count. Then the one session-aware check: does every referenced address exist right
now? Every rejection is atomic — there is no partial settle anywhere on this path.

**The Turn.** `WorkshopSessionService.completeRun:1522`:
`widgetRecommendation: (isHost || isGuest) && widgetRecommendation ? cloneWidgetRecommendation(...) : undefined`.
That single expression is the commitment point. It is where persona ownership is decided and
where the parser's objects are severed from persisted state by a deep clone. The session
aggregate owns it, and it is the right owner.

**Ending.** The turn persists with a chip. Visible content has the control tail stripped; if that
leaves nothing, a fallback sentence stands in so the writer never sees an empty bubble. A
rejected recommendation logs a reason and the bounded response body, and emits a writer-facing
notice naming the field. The writer may safely believe: this chip belongs to this persona's turn,
its source addresses were valid at that instant, and clicking it will cost nothing.

**Unresolved threads — named, not judged.**
- Source validity is asserted at ingress only. A chip clicked weeks later re-resolves live at
  Generate; the sheet surfaces removed sources as disabled "— unavailable" rows and blocks
  Generate. This is declared design, and the downstream path is genuinely built.
- The banner and the subject label are driven by two different facts — `opening.kind === 'seed'`
  versus `subject.provenance.kind`. After one keystroke they disagree: "Recommended and prefilled
  by Jill" sits above a field labelled "Pasted passage."
- Provenance decay is one-way. Type a character and undo it, and the persona-prefill origin is
  gone permanently.

---

## 5. Codebase Genealogy & Controlling Precedent

**Closest ancestors.** `GesturePlaygroundRecommendation.ts` (origin `0c59f9e3`, moved to a feature
module in `9d47729b`/`ace148a6`) and `LexicalGravityRecommendation.ts`. All three are
`WorkshopWidgetRecommendationEntry` instances in one frozen registry, all parse through the same
neutral protocol primitives, all export `reservedMarkers` consumed by a derived fitness test, and
all face the identical constraint: a model proposes, only the writer disposes.

**Inherited faithfully.** Creative reproduces the sibling shape beat for beat — marker constants,
`Extract<>` alias, field/reason unions, interpolated-budget instruction, `Object.freeze` entry.
`parseSourceReferences` is near-verbatim from Gesture.

**Distinguishing facts that legitimately license deviation.**
1. *Blank is meaningful* — locked by the sprint. This justifies splitting required from bounded,
   which Gesture does not need. This is the most defensible deviation in the commit.
2. *The subject need not appear in the context* — Gesture's `target_missing_from_context`
   cross-check has no Creative analogue by design.
3. *Creative fields are one to two orders of magnitude larger* — subject 20,000 + context 20,000
   against Gesture's target 300. Some ceiling increase is unavoidable.
4. *Creative is the only recommendation member that is also a one-shot commit feature with a
   clone path* — so the only one where a late prefill can destroy billed, uncommitted work.

**Controlling precedent, and this is the sharpest item in the runway.**
`.todo/tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md`, status **In
progress**, origin PR #98 F-19, states verbatim: the prompt-budget suite pins the assembled
contract at 4,811 characters "so any later widget makes its standing cost explicit in review";
and selecting a ceiling by parsed widget id "is the only remaining completion item and **stays
required before a third live widget**"; and "Do this before Prose Controller or any other **third
live widget extends the recommendation grammar**."

Creative Variations is the third live widget and it extends the recommendation grammar. This
commit deletes the 4,811 pin, raises the single pre-ID ceiling via `Math.max`, and does not
select a ceiling by parsed widget id. The debt file's status is unchanged and it is unmentioned
in the sprint doc, the handoff, and the commit message. Whether that is a violated precedent, a
document overtaken by events, or work legitimately belonging to Slice 7 is a review judgement.

**A second conditioned precedent.** Slice 5's ledger defers F-12 with the condition "land before
Slice 6 adds the `seed` arm." The seed arm landed here; the named seam did not. Mitigating fact:
this commit adds no new `commitPending`-guarded mutator, so F-12's stated failure mode did not
materialize.

**Precedent this commit creates — what widget #4 will copy.**
`CreativeVariationsRecommendation.ts` is now the largest, newest, most complete exemplar and will
out-compete Gesture's as the copy target. `widgetRecommendationMeta` in `WorkshopTurnBubble.tsx`
is the genuinely improved surface: label and icon are now catalog-derived, so a fourth widget
touches one compiler-enforced switch instead of four hardcoded ternaries. The ask-prefill guard
now has zero slack — `liveWidgetsWithoutHostPrefill` is `[]`, so the next widget that goes live
without a builder turns that test red immediately.

---

## 6. Structural & Causal Map

```
persona stream text
  └─ completeWorkshopRun ......................... closes over the PRODUCTION policy
      └─ inspectWorkshopWidgetRecommendation
          ├─ heading multiplicity
          ├─ FRAME CEILING (51,500) ............... widget still UNKNOWN  ← shared surface
          ├─ extract widget id
          ├─ live + available check
          └─ ENTRIES[id].inspect() ................ feature-owned, zero sibling imports
      └─ unavailableWidgetSourceReference ........ POSITIVE id list  ← shared surface
      └─ session.completeRun
          └─ (isHost || isGuest) ? clone : undefined ........ THE COMMITMENT POINT
              └─ persisted turn
                  └─ assertTurn: participant must be host|guest
                  └─ assertTurnWidgetRecommendation → Creative seed shape
webview
  └─ chip (label + icon from catalog registries)
      └─ openWidgetRecommendation ................ if/else-if, NO terminal branch
          └─ Creative arm only: refuse if a sheet is open
              └─ useCreativeVariationsAuthoring open-edge effect
                  └─ mints { kind: 'persona-prefill' }  ← host-minted, unforgeable
```

**Dependency direction is clean.** Feature → protocol/messages/budgets; registry → features;
run-completion → registry; presentation → messages + catalog. No sibling-to-sibling edge, no
`vscode` import, no inversion. The one new inward edge (`WorkshopSessionStateV1Shape` →
`CreativeVariationsConfigCodec`) matches the two existing sibling edges exactly.

**Four closed dispatches over the same union, four different disciplines.**

| Dispatch | Discipline | Widget #4 behavior |
|---|---|---|
| `cloneWidgetRecommendation` | `switch` + `assertNever` | compile error |
| `widgetRecommendationMeta` | `switch`, no default, `: string` return | compile error under `strict` |
| `assertTurnWidgetRecommendation` | `if`-chain → `shapeError` | loud runtime failure |
| `openWidgetRecommendation` | `if / else if / else if`, **no terminal branch** | **silent no-op** |

A fifth shared surface behaves the same way: `unavailableWidgetSourceReference` uses a positive
widget-id disjunction, so a future widget with source references that forgets to enroll silently
skips availability validation. Everything else in this family fails closed; these two fail open.

**Generic files that gained Creative vocabulary.** `WorkshopRunCompletion`'s `WIDGET_FIELD_LABELS`
and `INVALID_WIDGET_FIELD_COPY` are flat maps keyed by bare field name *across all widgets* — so
`contextText` and `sourceReferences` are already shared keys and a future same-name collision
resolves silently in favor of whoever wrote it first. `WorkshopTurnBubble`'s net direction is the
opposite and good: its feature knowledge narrowed from four concerns to one.

---

## 7. Contracts, Invariants & Negative Space

**Preconditions at the commitment point.** The run is live and un-preempted; the participant is
host or guest; the parse returned `accepted`; every source address resolves right now.

**Postconditions.** The persisted seed is a deep-cloned, input-only structure. Visible content has
the control tail stripped. Source addresses were valid at that instant only — declared, not
assumed.

**Invariants asserted.**
1. Personas prepare, never commit — enforced three ways, one of them structural.
2. Provenance is host-minted, never wire-supplied — the seed type has no place to put it.
3. Recommendations are persona-owned — asserted at two independent layers.
4. The registry is closed — `satisfies Readonly<Record<RecommendationWidgetId, …>>` makes a
   fourth message-union arm a compile error until an entry exists.

**Negative space — deliberately not supported, and genuinely absent.** No report-prefill. No
editor write path. No partial or card-level regeneration. No bound four-menu frame. No
cross-workup history. No persona ability to generate, select, accept a risk, commit, or claim
provenance. No generic variation framework — Creative's vocabulary stayed in Creative.

**Contract surfaces where optionality exceeds what the parser can produce.** Every seed field is
optional and the persisted validator accepts `{}`, but the parser always emits all eight and
rejects a blank subject. So `recommendation.seed ?? {}`, the `?? 'tail'` / `?? 3` controller
fallbacks, and the `'recommended'` (non-prefilled) chip label serve a state production cannot
currently reach. Note that the `?? 'tail'` and `?? 3` fallbacks invent values a persona did not
declare — the exact move the copy forbids for aim and constraints — and that `tail`/`3` are now
written in three places.

---

## 8. Forces, Tensions & Design Tradeoffs

**The genuine force behind `Math.max`.** The ceiling must be evaluated before the widget id is
known, because the generic layer wants a cheap bound on how much text enters an O(markers × lines)
scan — but it cannot know *which* bound applies until it has read `<widget-id>`. `Math.max`
resolves that tension at zero runtime cost and it scales.

What it spends: the family's protection floor is now set by its most permissive member,
monotonically. The constant's doc comment ("family-wide safety ceiling for the complete
recommendation tail") now under-describes it — the truth is "the loosest member's tail, and
everyone inherits that." And nothing tests the *relationship*; `promptBudgets.test.ts` pins the
value 51,500, while the only ceiling behavior test uses `FRAME_CHARACTERS + 1` and therefore
passes at any constant.

**Alternatives, with costs.**

| Construction | Cost | What it buys |
|---|---|---|
| `Math.max` (chosen) | loosest member sets everyone's floor; ratchets upward forever | zero new contract surface, zero runtime cost |
| Two-phase: coarse `Math.max` envelope + `frameCharacters` on the registry entry, re-checked after id extraction | one new readonly field every feature must supply; two ceilings to explain | each widget's over-budget rejection becomes honest again; the entry contract already owns `reservedMarkers`, `catalogOrder`, `instructionOrder` — a budget belongs in the same place |
| Per-widget lookup only | `extractWorkshopWidgetRecommendationId` runs on unbounded content | simplest; loses the cheap first gate |
| Reorder: id first, then the entry's ceiling | observable change — an over-budget *and* unknown-widget frame flips rejection reason | cleanest ownership; ceiling becomes fully feature-owned |

The two-phase option is the only one that both preserves the pre-parse gate and stops the ratchet.
It is also, notably, what the tech-debt file's Recommendation section already prescribes.

**Other live tensions.**
- *Reuse vs. specialization on provenance.* `persona-prefill` is a real domain concept — it is
  unforgeable, it has a decay transition, and it persists into committed configs. But it is
  modeled on the wrong axis: `pasted` and `excerpt` answer *where text came from*;
  `persona-prefill` answers *who typed it in*. When a persona copies the active excerpt, the
  union cannot say "excerpt text, entered by a persona," so the file address is dropped. And the
  kind carries no attribution payload — `personaLabel` lives on the transient opening, so
  "which persona" is lost at commit while its sibling `excerpt` keeps a precise address.
- *Consistency vs. local correctness on the overwrite guard.* Creative's guard descends from an
  accepted Slice 5 finding (F-05), so the asymmetry has a lineage rather than being arbitrary.
  Creative is also genuinely the only member whose sheet can hold billed, uncommitted generation
  state. But the guard is unconditional on any open sheet — it refuses even a pristine empty one —
  and the rule that would generalize is nowhere named.
- *Strictness registers inside one frame.* `sampling-distance` is exact case-sensitive equality;
  `take-count` goes through `Number()` and accepts `0x3`, `+3`, `03`, `3e0`. The stored value is
  always a legal 3/4/5, so nothing downstream corrupts — and Lexical Gravity uses the identical
  `Number()` pattern, so this is inherited family behavior, not a Creative deviation.

---

## 9. Failure, Recovery & Operational Truth

**Rejection is atomic and visible.** Every failure path returns the whole recommendation to
`rejected`, logs a reason code and a bounded response body, and emits a writer-facing notice
naming the field and its limit. Business rejection ("your persona's setup could not be prepared")
is cleanly distinguished from technical failure.

**Silent-wrongness surface is small and worth naming precisely.** Two shared surfaces fail open
rather than closed: `openWidgetRecommendation`'s missing terminal branch (a future widget's chip
click does nothing, with no error and no log) and `unavailableWidgetSourceReference`'s positive id
list (a future widget silently skips availability validation). Neither is reachable today.

**Deployment and rollback.** The declared rollback is "remove one recommendation arm." That holds
for the registry entry, the clone arm, the shape arm, the presentation arm, the opening arm, and
the ask builder. It does not hold for the family ceiling: removing Creative's term from the
`Math.max` silently re-tightens Gesture and Lexical.

**Persisted-data behavior.** The new participant check makes a stored turn with
`participant: 'tool'` carrying a recommendation fail decode outright, for *any* widget — a
tightening of a Marketplace-published writer-data contract with `schemaVersion` unchanged and no
named entry in checkpoint normalization. `completeRun` has gated tool turns since `0c59f9e3`, so
no honestly-produced session can contain that shape; the question ADR 2026-07-30 raises is
whether a decode-time tightening of a formerly-valid shape wants a named normalization anyway.
Related: `assertTurnWidgetRecommendation` gates persisted recommendations on
`isLiveWorkshopWidgetId` — a durable codec depending on a mutable roadmap flag. The comment
reasons about one direction only.

---

## 10. Security, Trust & Misuse Surface

**The asset** is the writer's authority over their own prose and their own spend. **The trust
boundary** is the model output line, and this commit is fundamentally a hardening of it.

**Attacker-influenced input.** Model output is not attacker-controlled in the classic sense, but
it is unreliable and it quotes writer-supplied prose back verbatim — which is precisely what this
widget asks it to do. The mitigations are real: reserved delimiters embedded in writer material
are neutralized before prompt assembly, and the neutralizer's list is guarded by a fitness test
that derives its expectations from each registry entry's `reservedMarkers` rather than a hand
list. That is the correct shape for this guard.

**Privilege escalation paths, all closed.** A persona cannot forge provenance (no field exists).
A persona cannot attach a chip to a tool turn (gated twice). A persona cannot name a source
address the session did not mint (validated against the aggregate). A persona cannot cause spend
(Generate is writer-only). A forged session file cannot smuggle a tool-owned recommendation past
hydration.

**Residual, proportional to reachability.** A persona *can* prepare a 20,000-character subject
plus 20,000-character context, and the writer's next Generate press spends on all of it — visible
in the sheet, but the cost is prepared by the model and paid by the writer. And the one rule that
protects the writer's creative space from silent narrowing — do not infer constraints — is
enforced by prompt copy alone, which is exactly where the Door-B ask copy pulls the other way.

---

## 11. Data, Time, Scale & Concurrency Horizon

- **Prompt cost is the live scale story.** The recommendation contract is composed at module load
  from every available entry and injected into every persona turn in every session, whether or not
  the writer ever opens a widget. Measured: 4,811 → 7,775 characters, +62%, in the same commit
  that deleted the assertion pinning it. Growth is linear in live widgets against a 13-id catalog.
- **Chip callback identity.** `openWidgetRecommendation`'s dependency array went `[]` →
  `[creativeVariationsOpening, onError]`. `onError` is stable, so identity changes only on Creative
  sheet open/close — but `WorkshopTurnBubble` is `React.memo` and receives this as a prop, so each
  open or close invalidates the memo for every turn in the transcript. O(turns) re-renders, twice
  per sheet. Fine at tens of turns; worth naming as transcripts grow.
- **Chips are permanent and re-clickable**, with source validity asserted only at ingress and
  re-resolved live at Generate. This is what keeps run-completion O(references) instead of
  requiring a sweep over history.
- **Concurrency.** The overwrite guard reads `creativeVariationsOpening` from the callback
  closure rather than a functional updater. Across distinct flushed click events it fires
  correctly; two calls inside one React batch would both see `null`. Reachability unestablished.

---

## 12. The Change Genome: Variation & Reproduction

**Cousin: Show vs. Tell Playground.** Already in the catalog as `show-vs-tell`, `live: false`,
icon mapped, sprint doc written, and named in this sprint's own goal as Creative's "deliberately
specialized sibling." **The single varied axis: requested-output cardinality.** Creative asks for
a scalar count sampled at one distance; Show vs. Tell wants one take per selected showing channel,
so its count is *derived from a set*. Everything else holds constant.

| Contact point | Class |
|---|---|
| Catalog, `WorkshopWidgetId`, icons | **Reuse** — already present |
| `widgetRecommendationMeta` | **Reuse** — the one genuinely fail-closed presentation seam |
| Message union, shape validator, ask-prefill | **Extension** — one arm each, clean |
| `frameCharacters` / `Math.max` | **Contradiction** — a fourth hand-maintained sum in a shared formula, with nothing tying each sum to its own parser's bounded-field list |
| `inspectExactWorkshopWidgetRecommendationFrame` | **Contradiction** — the exactly-one-occurrence rule cannot express a repeated `<channel>` element; the cousin must either adopt the newline-delimited-inside-one-field pattern or fork the primitive |
| `unavailableWidgetSourceReference` | **Contradiction** — positive id list; omission fails open |
| `openWidgetRecommendation` | **Fork** — a fourth near-identical arm, and the author must decide *by taste* whether to copy Creative's guard or the siblings' silent overwrite |
| `parseSourceReferences` | **Fork by copy** — already two near-verbatim copies of one grammar |
| `cloneWidgetRecommendation` arms | **Fork by copy** — gesture and creative arms are byte-identical today |
| `WIDGET_FIELD_LABELS` | **Extension with collision hazard** — flat, keyed by bare field name across widgets |
| `PROMPT_BUDGETS.workshopWidgets` | **Under-abstracted** — a ~90-key flat record disambiguated by prefix convention, pinned wholesale by one enormous test assertion |
| `boundaries.test.ts` allowlist | **Extension, O(widgets × surfaces)** — eight regexes widened here; each widening is an approval, not a check |

**Verdict.** The feature slice reproduces cleanly and honestly — this is a generative pattern, not
a special case, and narrowness was correctly preferred over a premature variation framework. The
*family surfaces* are where the third occupant reveals strain: two fail-open dispatches, one
shared formula, and one shared prompt block with no size guard.

---

## 13. Comparative Models & Borrowed Vocabulary

**Strongest internal parallel: Gesture Playground's recommendation codec.** It contributes the
sharpest question in the review, because Creative both improved on it (required/bounded split) and
diverged from a fix its own review had explicitly praised — pr-99 commended pulling
`sourceReferences` into the bounded-field list, "closing a gap where it was extracted but never
length-checked." Creative extracts and requires it but leaves it out of `boundedFields`, relying on
regex shape and line count instead. *Question contributed:* is the family rule whole-field bound or
per-reference bound — and which will widget #4 copy?

**[External] Design by contract** — precondition, postcondition, invariant, frame condition. The
useful borrowing is the **frame condition**: what must remain *unchanged*. The seed type's real
contract is a frame condition expressed as absence — it cannot carry a workup, a selection, a risk
acceptance, a note, or a provenance. *Question contributed:* which other family surfaces express
their safety as absence, and which express it as a check that a future author could forget?

**[External] Software product lines / variability modeling** — commonality, variation point,
binding time. *Question contributed:* the frame ceiling is currently bound at *module-load time*
as a max over all variants; the honest binding time is *after id extraction*, per variant. Naming
the binding time makes the `Math.max` a deliberate choice rather than a default.

**[Analogy] Chain of custody.** Provenance here is a custody record, not a label: who handled the
text, under whose authority, and does the record survive transformation. It answers the sharpest
question about `persona-prefill` — a custody record that says "a persona handled this" without
saying *which* persona, and which discards the file address when the persona hands over excerpt
text, is a custody record with a gap. *Question contributed:* is `persona-prefill` intended to
answer "who entered this" or "where did this come from," and can both be true at once?

Discarded as decorative: aviation envelopes, medical differential, manufacturing platforms. None
sharpened a question that the software lenses above did not already sharpen better.

---

## 14. Creative Counterfactuals

**Inversion — flip the ceiling and the id.** Extract the id first, then apply that entry's own
ceiling. Deletes `Math.max` entirely and makes each widget's budget a declaration on its own
entry. Cost: id extraction scans an unbounded tail. The honest resolution is three-stage — coarse
absolute guard, then id, then the entry's exact ceiling — which is what the tech-debt file already
recommends.

**Deletion — remove `persona-prefill` entirely** and open seeded drafts as `pasted`. Three modal
branches, a codec arm, and one predicate generalization collapse. What is genuinely lost:
reopening a committed chip in six months would no longer say whether the writer or the persona
wrote the first draft. The deletion test *validates* the field rather than indicting it — the
concept is load-bearing; only its axis is arguable.

**Time-lapse — widget #4 and #5.** Seven touch points, four compiler- or test-enforced, three not.
The three unenforced ones are exactly the surfaces flagged above. Extrapolated: the always-on
prompt block reaches ~13k characters at five live widgets with nothing pinning it; the family
ceiling becomes a max over five hand-maintained sums; `WIDGET_FIELD_LABELS` becomes a flat
cross-widget dictionary at meaningful collision risk.

**Boring alternative.** The least clever implementation that satisfies the invariants is exactly
what was built for the feature slice — a strict parser, an input-only type, a host-minted
provenance, and one registry entry. There is no cleverness to remove here. The boring alternative
for the *shared* surfaces is one field on an interface that already carries four.

---

## 15. Evidence Confidence & Unresolved Questions

**Repository-grounded and independently verified by the orchestrator:** the persona-ownership gate
and its double enforcement; the reserved-delimiter fitness test deriving from registry entries;
prompt-instruction growth 4,811 → 7,775 (measured); the deleted length assertion; oversized-Gesture
frames still rejecting under the new ceiling (traced, `field_too_long`); `take-count` `Number()`
leniency and its identical presence in Lexical Gravity; the ceiling test being self-referential;
the tech-debt file's verbatim "stays required before a third live widget"; Slice 5 F-12's verbatim
deferral condition; Creative's boundary descriptor lacking the un-namespaced token list both
siblings carry; the ask-prefill door seeding the composer rather than sending; 26 suites / 362
tests green on this surface.

**Material inferences, flagged as such:** that the overwrite-guard asymmetry is F-05's descendant
rather than arbitrary; that `persona-prefill` is modeled on the wrong axis; that widget #4 will
copy Creative rather than Gesture.

**Unknowns the evidence cannot settle:** whether the family-ceiling change was deliberate;
whether the 4,811 pin was removed knowingly or as incidental cleanup; whether Slice 7 is scoped to
discharge the debt file's remaining item; whether the widgets browser can be raised over an open
sheet (which decides whether the `launchWidget` reset-skip path is live or latent); whether two
`openWidgetRecommendation` calls can land in one React batch; whether Gesture and Lexical widget
configs have shipped to Marketplace, which pr-99 already logged as unresolved across two sprints.
Human F5 inspection of banner/chip/label layout remains outstanding by the author's own statement.

---

## 16. Past → Present → Horizon Synthesis

**Past.** A recommendation family built for one widget, generalized to two on 2026-08-06 under
review pressure (pr-107 F-01 through F-04), leaving behind a tech-debt file that named precisely
what a *third* widget would require: a ceiling selected by parsed widget id, and a size pin that
would make each new widget's standing prompt cost explicit at review time.

**Present.** The third widget arrives, and inside its own slice it is the best of the three. The
authority model is enforced structurally rather than by convention; provenance is unforgeable and
decays honestly; report-prefill is genuinely absent rather than half-built; Creative vocabulary
stayed in Creative; the presentation switch got *more* generic while gaining a feature. What the
third occupant reveals is that the family's shared surfaces were sized for one: a ceiling that is
now a max over hand-maintained sums, a prompt block that grew 62% with its guard deleted in the
same commit, and two dispatch points that fail open while every other one fails closed.

**Horizon.** Widget #4 is already in the catalog with its sprint doc written. It will copy this
commit's feature slice, which is a good thing, and it will land on the same shared surfaces, which
is where the pressure is. The cheap moment to decide the provenance axis is now, before committed
Creative configs proliferate and the change becomes a released-codec migration. The cheap moment
to bind the ceiling per widget is also now — the entry interface already carries four
feature-declared values and would carry a fifth without complaint.

---

## 17. Runway Synthesis Brief

**Invariants the implementation must preserve.** Personas prepare, never generate, select, accept,
or commit. Provenance is host-minted and unforgeable. Recommendations attach only to the exact
Host/Guest turn that produced them. Every rejection is atomic — nothing partially settles. Source
addresses are session-minted only. Report-prefill stays absent.

**Anchors.** `CreativeVariationsRecommendation.ts` (parser, bounds, prompt copy);
`WorkshopWidgetRecommendationOperations.ts:111-127` (the `Math.max` ceiling) and `:151`/`:160`
(check-before-id ordering); `WorkshopSessionService.ts:1522` (the commitment point);
`WorkshopSessionStateV1Shape.ts:559-562` (new participant check);
`WorkshopRunCompletion.ts:100-121` (cross-widget copy dictionary) and `:303-306` (positive id
list); `useWorkshopWidgetOpening.ts:125-155` (guard + missing terminal branch);
`useCreativeVariationsAuthoring.ts:116-143` (draft minting) and `:378-392` (provenance decay);
`workshopWidgetAskPrefill.ts:16-20` (Door B copy); `promptBudgets.test.ts` (deleted pin);
`boundaries.test.ts:306-348` (feature descriptors) and `:434-590` (allowlist);
`.todo/tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md`.

**Tensions — real tradeoffs, not disguised defects.** Cheap pre-parse gate vs. per-widget honesty
in the ceiling. Minimal-diff `Math.max` vs. a fifth field on the entry interface. Creative-specific
overwrite protection vs. a named family rule. Provenance as origin vs. provenance as custody.
Prompt richness vs. always-on recurring cost.

**Unknowns.** Listed in §15; the three that most affect the verdict are whether the ceiling change
was deliberate, whether the debt file is controlling or overtaken, and whether the widgets browser
can be raised over an open sheet.

**Legitimate variation points.** Per-widget frame budgets on the registry entry. Feature-owned
field-label and rejection-reason copy. A named "sheet holds uncommitted generated state" predicate.
A repeated-value convention for the cousin's variable-arity element.

**Predicted pressures.** *Near:* Slice 7's production-policy route matrix runs against this path
as-is; the ceiling is the one seam that does not revert cleanly. *Middle:* two accumulation
patterns visible at n=3 — the cross-widget copy dictionary and the shared ceiling formula — both
correct now, both junk-drawer-shaped by n=5. *Far:* if `persona-prefill` stays as-is while sessions
accumulate committed configs, adding an attribution payload becomes a released-codec migration.

**Questions for the panel — phrased neutrally, verify independently.**
1. Trace the `Math.max` ceiling yourself. Does raising a shared pre-ID envelope from 15,300 to
   51,500 change any *verdict* for Gesture or Lexical, or only the rejection reason? Then decide
   what, if anything, that warrants.
2. Read the tech-debt file. Is it controlling precedent, a document overtaken by events, or Slice 7
   work? Does the +62% recurring-prompt growth warrant a re-pin regardless of which answer wins?
3. Is the Door-B ask copy asking the Host for something the frame instruction forbids? If a writer
   clicks "Ask agent to configure," have they *declared* constraints?
4. `openWidgetRecommendation` and `unavailableWidgetSourceReference` fail open where four sibling
   dispatches fail closed. Is that reachable today, and is it this commit's to fix?
5. Is `persona-prefill` answering "who entered this" or "where did this come from"? What is lost
   when a persona copies the active excerpt?
6. After one keystroke the banner and the subject label disagree. Is that the intended reading, and
   is "persona drafted, writer edited" representable?
7. Does the new participant check meet ADR 2026-07-30's "formerly valid shape newly required"
   trigger?
8. Can the negative-space scan see `subjectText`, `mustSurvive`, `invalid_distance`, `take-count`
   in a generic file? Compare Creative's boundary descriptor against its two siblings'.
9. Which tests here prove a contract, and which would pass if the behavior were wrong? Look
   specifically at the ceiling test and at what covers commit → reopen of `persona-prefill`.

**Do not overread.**
- The raised ceiling is **not** a correctness or safety regression. It was traced: every
  previously-rejected sibling frame still rejects. File it as coupling and cost, or not at all.
- `take-count`'s `Number()` leniency is **inherited** — Lexical Gravity does the identical thing.
  Rule G applies.
- The seedless / partial-seed defensive paths are **unreachable in production**; the parser always
  emits all eight fields. Do not file them as live bugs.
- `sameSubject`'s rewrite is behavior-preserving; the persona↔persona comparison is unreachable
  because incoming selections are never `persona-prefill`.
- The three untracked artifacts are out of scope. The sprint/handoff docs saying "uncommitted and
  unpushed" were accurate when authored.

---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there** — no Blocking findings and no correctness defects; the feature slice is
the most disciplined of the three recommendation codecs, and both High findings have small,
well-defined repairs.

- 🟠 **F-01 · Prompt-size pin deleted, not re-pinned** `🧭 Corroborated Runway` — the always-on
  persona prompt grew 4,811 → 7,775 characters (+62%, ~2,000 tokens per turn, no prompt cache)
  in the commit that removed the assertion pinning it. A tech-debt file names this exact
  trigger — "stays required before a third live widget." Re-pin at 7,775 (one line, and it
  re-uses the now-orphaned import).
- 🟠 **F-02 · Provenance decay writes a false claim into the durable record** — one keystroke
  converts `persona-prefill` → `pasted`, so a committed config asserts "Pasted passage" over
  text the writer never pasted, with no persona name surviving reopen. "Persona drafted, writer
  edited" is unrepresentable. Cheap to settle now; a released-codec migration later.

Everything else is Standard or below. Nothing here should stop the slice from progressing once
those two are decided.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus | **B** | Feature slice has clean dependency direction and zero sibling coupling; the family's shared surfaces are where the third occupant strains. |
| Critical Correctness — Blake | **A−** | Zero Blocking, zero High. Ownership gated at a single minting site; no partial settle on any rejection path. |
| Edge Cases — Sam | **B+** | Guards held under determined attack; one genuine race found in the window where nothing is on screen. |
| Code Quality — Parker | **B+** | A name that misstates its unit and a ternary ordering that hides new copy, against a genuinely improved presentation seam. |
| Tests — Cal | **B** | 362 green and meaningful, but the ceiling test agrees with itself and the richest persona branch is uncovered. |
| Codebase Fit — Stan | **B−** | The third widget removed the tripwire the repo installed for the third widget; allowlist approvals now outrun the file. |
| Performance — Tim | **A−** | Measured: ceiling change is free (2.25 ms), memo concern is void. The only cost is lost visibility, not lost speed. |
| Security — Patricia | **A−** | The model-output trust boundary is genuinely hardened; one disproportionate blast radius and one unverified sentence. |
| Observability — Oliver | **B** | Rejection copy is compile-forced to be total; the log line cannot tell three widgets apart. |
| Domain Logic — Bria | **B** | The blank-field locked decision is encoded beautifully; provenance and the Door-B copy each decide something product never ruled on. |

## Findings

### F-01 · 🟠 High — Prompt-size pin deleted, not re-pinned, in the commit that grew it 62% `🧭 Corroborated Runway`

**Raised by:** Cal, Stan, Blake, Tim
**Discovery:** 0 independent · 4 runway-prompted
**Confidence:** High · **Severity note:** Cal and Stan scored High; Blake and Tim scored Standard. Recorded as High because the removed assertion was a documented precondition naming this specific commit.
**Evidence:** `packages/core/src/__tests__/architecture/promptBudgets.test.ts:9` — `  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION` (now the only occurrence in the file; the assertion `expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.length).toBe(4_811)` was removed, not updated)
**Affected contract:** operational, test

`.todo/tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md` (status: **In
progress**) states the pin's purpose verbatim — "so any later widget makes its standing cost
explicit in review" — and that selecting a ceiling by parsed widget id "stays required before a
third live widget." Creative Variations is the third live widget and it extends the
recommendation grammar. Searched the diff, the sprint doc, the handoff, and the commit message
for any mention of this debt file, the 4,811 figure, or a per-widget ceiling — not found.

Tim measured the composition by running the real builder at four availability levels: 982 fixed
+ 3,127 gesture + 702 lexical + 2,964 creative = **7,775 characters**, roughly 1,950–2,220 tokens.
`buildWorkshopPersonaSystemMessage` appends it unconditionally to every host and guest system
message, with no setting gate and no widget-usage precondition, and the system message is
`messages[0]` of a persisted conversation — so it is resent every turn, per guest, whether or not
the writer ever opens a widget. Searched for `cache_control` / `prompt_cache` — not found, so it
is full-price input rather than a cached prefix. Three of thirteen catalog ids are live; at the
current mean marginal cost a fully-live catalog projects to ~30,400 characters (~8,000 tokens)
on every persona turn.

The orphaned import is the tell: a decision to stop measuring removes the import too. This reads
as cleanup of a red line rather than a considered policy change.

**Recommendation:** `expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.length).toBe(7_775);` —
one line, restores the review-time visibility the number was built for, and puts the dangling
import back to honest use. Separately, make one doc move: either add the ceiling-by-widget-id
item to the Slice 7 row or update the debt file's status to record that the third-widget trigger
was consciously deferred and why, so the deferral is a decision rather than a silence.

### F-02 · 🟠 High — Provenance decay writes a false claim into the durable record

**Raised by:** Bria
**Discovery:** 0 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring.ts:387-389` — `provenance: current.subject.provenance.kind !== 'pasted'` / `? { kind: 'pasted' }`
**Affected contract:** business, data

Jill prefills a passage; the writer fixes one typo; from that instant the subject's origin is
`{ kind: 'pasted' }` and the label reads "Pasted passage." Because
`WorkshopCreativeVariationsWidgetConfigSnapshot` carries the whole draft, that claim persists into
the committed config and is what the chip re-displays. The writer pasted nothing.

Three consequences, one design question. "Persona drafted, writer edited" — the most common real
state — has no member in the union. The decay is one-way and unconditional: type a character and
delete it and the persona origin does not return. And `personaLabel` lives only on the transient
opening, so on reopen the record asserts that *a* persona prefilled this, in a room that can hold
a Host and several Guests. The commit's own test is named "labels persona-prefilled provenance
without claiming the writer pasted it," which is exactly what happens one keystroke later.

The rule is accidentally implied: the Slice 6 evidence section added in this same commit says
"Editing the subject converts provenance to `pasted`," but no locked decision, the concept doc,
or the runway ever asked for that.

Two constraints on the fix, both established during review. Marcus: minting `excerpt` from
persona-supplied text would forge a file address the host cannot verify, so the "lost excerpt
address" is a safety property, not a modeling gap. Orchestrator validation: the provenance `kind`
is shipped into the generation task JSON at
`packages/core/src/infrastructure/api/services/widgets/creativeVariations/CreativeVariationsService.ts:191-193`
— `provenance: { kind: draft.subject.provenance.kind }` — while
`packages/core/resources/system-prompts/creative-variations/` never documents the field. So the
value reaches the generation model as an undocumented third enum member, and "display-safe"
understates its reach.

Per ADR 2026-07-30, this is cheap while Creative has never shipped and becomes a released-codec
migration once committed configs accumulate.

**Recommendation:** Product decides which question `provenance` answers. If **custody** ("who
entered this"), carry the persona identity and an edited flag — e.g.
`{ kind: 'persona-prefill'; personaLabel: string; editedByWriter: boolean }` — and label it
"Persona-prefilled passage · edited by you." If **origin** ("where the text came from"), delete
`persona-prefill`, open seeded drafts as `pasted`, and let the transient banner carry attribution.
Either is coherent; the current middle is a custody record with no name that rewrites itself into
a false origin claim. Whichever is chosen, document the field in the generation prompt or stop
sending it.

### F-03 · 🟡 Standard — The frame ceiling is a hand-maintained twin of a compiler-enforced registry `🧭 Corroborated Runway`

**Raised by:** Marcus, Cal
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.ts:110-112` — `/** Existing family-wide safety ceiling for the complete recommendation tail. */` / `export const WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS =` / `  Math.max(`
**Affected contract:** maintenance

One screen below this constant, `satisfies Readonly<Record<RecommendationWidgetId, …>>` makes a
fourth message-union arm a compile error until a registry entry exists. The ceiling above it is a
*second* statement of the same family membership, written as hand arithmetic over another
feature's budget keys, with nothing tying the two together. Widget #4 will be forced into the
registry, into `cloneWidgetRecommendation`'s `assertNever`, into `widgetRecommendationMeta`, and
into `assertTurnWidgetRecommendation` — and will silently inherit Creative's 51,500.

Neither the relationship nor the fit is tested. `WorkshopWidgetRecommendationOperations.test.ts:198`
builds its input as `FRAME_CHARACTERS + 1` and asserts back `maximumCharacters: FRAME_CHARACTERS`,
so it is green at 51,500, at 15,300, and at seven. Cal measured a maximal legal Creative frame at
**49,585 against 51,500 — 3.7% slack**, and found the formula structurally undercounts the
source-reference field by ~159 characters and the twenty marker lines by ~426, both absorbed by
the 2,500 allowance. If Slice 7 adds a ninth bounded field and forgets the term, every test stays
green while a legal maximum-size recommendation silently rejects as `frame_too_long`.

The declared rollback — "remove one recommendation arm" — holds for the registry entry, the clone
arm, the shape arm, the presentation arm, the opening arm, and the ask builder, and fails here:
removing Creative's entry leaves a stale term, and removing the term silently re-tightens Gesture
and Lexical.

Explicitly **not** a correctness or safety regression: an oversized Gesture frame was traced under
the new ceiling and still rejects, as `field_too_long` on `writerInstructions` rather than
`frame_too_long`. No previously-rejected frame is now accepted, and Tim benchmarked the enlarged
scan at 2.25 ms worst case. This is ownership and reviewability.

**Recommendation:** Add `frameCharacters` to `WorkshopWidgetRecommendationEntry`, beside the
`reservedMarkers` / `catalogOrder` / `instructionOrder` it already carries; keep `Math.max` as the
coarse pre-ID envelope and re-check the entry's own ceiling after `extractWorkshopWidgetRecommendationId`.
Add one fitness test that assembles a maximal frame from the budget constants and asserts it is
accepted. If this belongs to Slice 7, say so in the sprint doc.

### F-04 · 🟡 Standard — Widgets-browser ask copy solicits the constraints the frame instruction forbids inferring `🧭 Corroborated Runway`

**Raised by:** Bria, Patricia
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/utils/workshopWidgetAskPrefill.ts:13-14` — `'Seed the exact subject passage, useful context and source references, grounded constraints, '` + `'a creative aim, sampling distance, and take count, then offer it for me to review and open. '`
**Affected contract:** business

The sprint's locked decision — "Both fields are optional; a blank field means no constraint of
that kind, and the model does not silently infer one" — is the one rule in this slice that
deterministic code cannot enforce. It lives entirely in prompt copy at
`CreativeVariationsRecommendation.ts:104-106` ("Do not infer a constraint merely because it seems
prudent"; "Leave it empty for random generation"). Everything else a persona could get wrong is
caught by a parser or a type.

Door B pushes the other way. A writer who clicks "Ask agent to configure, then open" has declared
nothing, but the composer is seeded with a message *in the writer's own voice* asking the Host for
"grounded constraints" and "a creative aim." The family contract sentence does not break the tie:
it says emit a complete frame "if the supplied material supports its required fields," and
constraints and aim are not required fields.

Bria traced the lineage, which is the useful part: "grounded" was templated from the Gesture
builder one line up, and Gesture's own instruction *permits* inference ("Distinguish supplied
facts from reasonable scene inference"). Creative is the only family member where the sprint
locked inference out, and the only one whose ask copy requests the load-bearing fields be filled.

Downstream, nothing distinguishes a constraint the writer declared from one the Host inferred at
the writer's own request: the sheet subtitle says takes run "under constraints **you** declare,"
and `declaredInvariantCount` counts persona-written text as declared invariants in the commit
summary.

The counter-argument is on the record: the writer sends the message, sees every field, and can
delete anything, so this may be exactly the ratification product wants. Nobody has ruled.

**Recommendation:** Product rules on whether clicking Door B counts as declaring constraints. If
it does not, the smallest repair is one clause — "…and any constraints I have actually stated;
leave the invariant and aim fields empty if I have not" — plus a test asserting the ask copy never
contradicts the blank-field rule.

### F-05 · 🟡 Standard — Two dispatches fail open where four fail closed `🧭 Corroborated Runway`

**Raised by:** Marcus, Oliver
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts:142-152` — `} else if (recommendation.widgetId === 'creative-variations') {` … the chain ends with no `else`
**Affected contract:** operational, maintenance

The same closed union is dispatched in six places. `cloneWidgetRecommendation` uses
`switch` + `assertNever` (compile error). `widgetRecommendationMeta` uses a `switch` with no
default and a `: string` return (compile error under `strict`). `assertTurnWidgetRecommendation`
ends in `shapeError` (loud runtime failure). `openWidgetRecommendation` ends in nothing: a
writer clicks a chip, no sheet opens, no toast, no console line, no Output Channel entry.

Forty lines below, the config path in the *same file* models the correct handling for exactly
this drift — `console.warn` plus `onError(\`${receivedWidgetId} can't be opened in this
version.\`)` — with the author's own comment that "the wire may be ahead of this webview's
discriminated union."

The same shape now exists one layer down: `WorkshopRunCompletion.ts:303-306` changed
`unavailableWidgetSourceReference` from a single-widget guard into a positive id disjunction, so a
future widget with source references that forgets to enroll silently skips availability
validation rather than failing loudly.

Neither is writer-reachable today — `assertTurnWidgetRecommendation` refuses to decode a persisted
turn whose `widgetId` has no codec, so no session file can deliver a fourth id to the webview.
This is a development-time trapdoor. It belongs to this commit because this is the commit that put
the error channel into that callback and turned the second guard into a list.

**Recommendation:** Close the chain with the same `else` the config path already uses, or convert
it to a `switch` with `assertNever`. Invert the source-reference guard to an exhaustive switch so
widget #4 must *state* whether it carries source references rather than being defaulted into "no."

### F-06 · 🟡 Standard — Rejection log and writer notice never name the widget

**Raised by:** Oliver
**Discovery:** 1 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts:238-243` — `` input.log(`Widget recommendation ${…} ` + `(${label}${rejectionReason ? `; reason=${rejectionReason}` : ''})`); ``
**Affected contract:** operational

The commit's own tests prove it. `WorkshopRunCompletion.test.ts:342` (new, Creative) and `:383`
(pre-existing, Gesture) assert the byte-identical string
`'Widget recommendation rejected (Jill; reason=unavailable_source_reference:context-attachment:ctx-999)'`.
Two widgets, two parsers, one log line, no way to tell them apart.

It goes further than the availability path. Gesture's and Creative's field unions share
`contextText`, `sourceReferences`, `empty`, and `invalid_source_references` outright, so
`field_too_long:contextText:12000/10000` versus `…:25000/20000` is distinguished only by whether
the reader remembers that `gestureContextCharacters` is 10,000 and `creativeContextCharacters` is
20,000. That is a memory test, not evidence.

The writer's side has no numbers at all: "Jill's widget recommendation could not be prepared.
Source references contained unavailable or malformed source references." Jill may have been
setting up any of three widgets.

The id is available. `inspectWorkshopWidgetRecommendation` extracts it at `:160` and dispatches on
it at `:168`, so every `invalid_field`, `field_too_long`, and `invalid_frame` rejection happens
downstream of a known widget id — the rejected arms simply drop it.

**Recommendation:** Add one optional `widgetId` to the rejected arms produced after id extraction
and spend it twice: `; widget=creative-variations` in the log line, and the notice header —
"Jill's Creative Variations setup could not be prepared." `frame_too_long`, `duplicate_heading`,
and `unknown_or_unavailable_widget` genuinely cannot know the id; leaving those unnamed is honest.

### F-07 · 🟡 Standard — Boundary descriptor blind to Creative's un-namespaced vocabulary

**Raised by:** Marcus
**Discovery:** 0 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:340-345` — `semanticTokenSources: [` … `String.raw\`\bCreative\s+Variations\b\`` (four patterns, all namespaced)
**Affected contract:** test, architecture guard

Gesture and Lexical each declare a fifth `semanticTokenSources` pattern enumerating their *bare*
vocabulary — `target_missing_from_context|invalid_source_references` and
`lensSlug|unsupported_lens|invalid_weight|…`. Creative declares none. Marcus ran the composed
scanner and confirmed directly: `subjectText`, `mustSurvive`, `mustNotChange`, `aim`, `distance`,
`requestedCount`, `invalid_distance`, `invalid_requested_count`, `creativeSubjectCharacters`, and
`creativeRecommendationFrameAllowanceCharacters` all return `null`, while
`gestureTargetPhraseCharacters`, `lensSlug`, and `invalid_source_references` all match.

The asymmetry is visible in the two files this commit edited. `WorkshopRunCompletion.ts:105-121`
gained six Creative field labels and two Creative rejection reasons, and the diff widened that
file's allowlist only with the namespaced `creative-variations` — because the bare tokens never
needed approval, whereas the sibling reasons three lines away did. In
`WorkshopWidgetRecommendationOperations.ts`, the allowlist enumerates six `gesture*Characters`
keys because those are seen, while the seven `creative*Characters` keys added in this commit
slipped in unseen.

The descriptor gap is inherited (Slice 2, `d14ab795`) and was harmless while Creative had no bare
vocabulary outside its own module. This commit is the first to rely on it. The consequence is a
silent semantic collision risk in `WIDGET_FIELD_LABELS`, which is a flat cross-widget map now
claiming `aim`, `distance`, and `requestedCount` family-wide for Creative's copy — and the one
guard designed to surface exactly that cannot see it.

**Recommendation:** Add a fifth `semanticTokenSources` pattern to Creative's descriptor
enumerating its un-namespaced vocabulary, run the suite, and approve the resulting occurrences
explicitly. The point of the guard is that each leak is an approval rather than an accident.

### F-08 · 🟡 Standard — `creativeSourceReferenceCharacters` names a bound it does not impose `🧭 Corroborated Runway`

**Raised by:** Stan, Parker
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/creativeVariations/CreativeVariationsRecommendation.ts:281` — `if (!match || match[1].length > BUDGET.creativeSourceReferenceCharacters) {` against `packages/core/src/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundRecommendation.ts:201` — `if (value.length === 0 || value.length > BUDGET.gestureSourceReferenceCharacters) {`
**Affected contract:** maintenance

`promptBudgets.ts:220` and `:239` declare `gestureSourceReferenceCharacters: 500` and
`creativeSourceReferenceCharacters: 500` four lines apart, same stem, same value. For Gesture the
name is exactly true — it bounds the whole field, the field is in `boundedFields`, and the prompt
bullet tells the model the same rule in words. For Creative the identifier bounds `match[1]`, the
captured `ctx-N` id alone; the field is absent from `boundedFields`; and the prompt bullet
silently drops the character clause its sibling states. Reaching the per-id bound would require a
496-digit attachment id, so it is effectively unreachable.

The cost is already banked in the shared ceiling. `WorkshopWidgetRecommendationOperations.ts:117`
adds `gestureSourceReferenceCharacters` once; `:121-122` multiplies
`creativeSourceReferences * creativeSourceReferenceCharacters`. Those arms sit in visually
parallel positions inside one `Math.max` and read as the same calculation while each is correct
only for its own unit — and the Creative arm is still short, because an accepted line carries the
19-character `context-attachment:` prefix.

The field remains bounded in practice by line count plus regex shape, so this is not a
correctness break. It is that `pr-99-agent-prepared-widgets-50b5065-review-v2.md:100` records
pulling `sourceReferences` into the bounded-field list as a review outcome — "closing a gap where
it was extracted but never length-checked" — and widget #4 will copy Creative, the newest and
largest exemplar.

**Recommendation:** Add `{ field: 'sourceReferences', value: sourceReferenceText, maximum: BUDGET.creativeSourceReferences * BUDGET.creativeSourceReferenceCharacters }`
to `boundedFields` so the constant the ceiling budgets is the constant the parser enforces, and
add the character clause to the prompt bullet. If the per-id bound is deliberate instead, rename
the key `creativeSourceReferenceIdCharacters` and correct the ceiling arm — but then the family
carries two rules under two clearly different names, which is the point.

### F-09 · 🟡 Standard — The persona honesty paragraph is unreachable whenever context travels `🧭 Corroborated Runway`

**Raised by:** Parker, Cal
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.tsx:432-435` — `{surroundingContextTravels ? 'The generation sees this passage, …' : personaPrefill ? 'The persona prepared this passage from material available in the room. …'`
**Affected contract:** business, test

Forty-five lines earlier the label asks `personaPrefill` first and resolves
`surroundingContextTravels` inside that branch, which is why the persona gets both
"persona prefill · context supplied separately" and "persona prefill · no surrounding passage."
The paragraph asks the two questions in the reverse order. Same component, same two booleans, two
precedences, no explanation.

The consequence: the new persona sentence renders *only* when no context and no source references
are present, while the sentence itself enumerates "the constraints, context, and source material
shown on this sheet." It describes a sheet it can never appear on. And the persona path is the one
most likely to carry context — the frame instruction actively invites `active-excerpt` and
`context-attachment:ctx-N`, and the parser emits `contextText` on every accepted frame.

The tests confirm the blind spot rather than closing it. `WorkshopCreativeVariationsModal.test.tsx:174`
asserts the new copy against `baseDraft`, whose `surroundingContext` is empty. `WorkshopApp.test.tsx:829`
— the only mounted persona-prefill scenario, and the realistic one — *does* set
`contextText: 'Nate waited across the table.'`, so it renders the generic paragraph and asserts
nothing about it. Searched the tree for any assertion on
`'persona prefill · context supplied separately'` — not found. The sibling `pasted` provenance is
already tested on both sides of this boundary; the new kind got one side.

**Recommendation:** Make the paragraph ask `personaPrefill` first, matching the label, so a reader
learns one precedence rule for the component — and add the missing modal case (`banner: seed`,
`persona-prefill` provenance, non-empty `surroundingContext`) so the persona+context copy has a
witness.

### F-10 · 🟡 Standard — Persona chip can win a race against a reopen the writer asked for first

**Raised by:** Sam
**Discovery:** 1 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts:142-146` — `} else if (recommendation.widgetId === 'creative-variations') {` / `if (creativeVariationsOpening) {` / `onError('Close the current Creative Variations sheet before opening a prefill.');`
**Affected contract:** business

`openWidgetConfig` sets `pendingWidgetConfigId`, fires an async round trip to the extension, and
renders nothing. `creativeVariationsOpening` stays `null` for the whole trip — no backdrop, no
spinner, no disabled state, and `pendingWidgetConfigId` is never surfaced in `WorkshopApp`. The
transcript stays fully live, and both doors into that state live in the same bubble:
`WorkshopTurnBubble.tsx:329-336` renders the committed-config chip and `:537-549` the new
persona-recommendation chip.

The path: the writer clicks the committed Creative chip; nothing appears; the writer clicks the
Creative persona-prefill chip; the new guard sees `null`, passes, and opens the seed sheet. The
config response then lands, the arrival effect sees a non-null opening, emits "Close the current
widget sheet before reopening a committed configuration," and clears the pending id. The writer's
**first** request is discarded in favour of their second, the toast blames a sheet that exists
only because of the second click, and closing it does not retry the dropped reopen.

Why it belongs here: before this commit `openWidgetRecommendation` had no `creative-variations`
branch, so a Creative chip click was a silent no-op and `creativeVariationsOpening` had exactly
one asynchronous writer. This commit adds the second without teaching either about the other.

**Recommendation:** Have the Creative arm also refuse — or cancel — when
`pendingWidgetConfigId !== null`. One clause. The alternative is deciding the later click wins and
clearing the pending id, but either way the two writers should know about each other.

### F-11 · 🟡 Standard — Decode-time ownership check escalates one bad field into total session loss

**Raised by:** Patricia
**Discovery:** 1 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts:560-561` — `if (turn.participant !== 'host' && turn.participant !== 'guest') { shapeError(...) }`
**Affected contract:** data

The check is correct defense-in-depth and should be kept; the objection is to its blast radius.
`shapeError` throws, and `parseWorkshopSessionStateV1` runs at `WorkshopPersistedSession.ts:130`
— **before** `normalizeWorkshopSessionCheckpointForHydration` on line 131 — with no per-field
recovery at that layer. One turn carrying `participant: 'tool'` beside a recommendation makes the
entire session file unopenable: every turn, every committed widget config, every word behind it.

What the control buys is small. Blake traced the producer side: `grep` returns exactly one write
site for `turn.widgetRecommendation`, and `participant` is minted in the same object literal, so
no honestly-produced session can reach this state. The only reachable producer is a hand-edited
or corrupted file — and whoever can edit the session JSON already owns the disk. The adversary
gains nothing; the entire cost falls on a legitimate writer with a damaged file. That inverts the
principle stated five lines above the call site: "each conversation archive entry still performs
its own validation during import so corruption degrades locally."

On ADR 2026-07-30: a tool-participant turn carrying a recommendation was decodable before this
commit and is a hard failure after it. Searched the diff for `schemaVersion` and for
`WorkshopSessionCheckpointNormalization` — neither appears. Oliver confirmed the error message
itself is good: it names the exact path and requirement through the persistence coordinator.

**Recommendation:** Keep the assertion, change the remedy — move the ownership rule into
`WorkshopSessionCheckpointNormalization` as a named, logged normalization that drops the offending
`widgetRecommendation` and leaves the session openable, which is the disposition `completeRun`
would have produced anyway. If hard rejection is genuinely wanted, ADR 2026-07-30 asks for the
`schemaVersion` bump and adjacent migration this commit does not carry.

### F-12 · 🟡 Standard — Architecture allowlist grants three tokens the file no longer contains

**Raised by:** Stan
**Discovery:** 0 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:497` — `allowedToken: /(?:Gesture Playground|Lexical Gravity|Creative Variations|gesture-playground|lexical-gravity|creative-variations|lensSlug)/`
**Affected contract:** test, maintenance

Stan scripted every entry in `WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES` against its own file,
splitting each `allowedToken` into top-level alternatives. Thirty-five of thirty-seven are tight;
`workshopWidgets.ts` carries one stale token predating this commit; `WorkshopTurnBubble.tsx` is
the only entry with a cluster, and this commit created it. `Gesture Playground`, `Lexical Gravity`,
and `Creative Variations` all match nothing in the file — the first two went dead because this
commit's own refactor replaced the hardcoded ternaries with `workshopWidgetLabel(...)`, and the
third was added here and was never live.

The governing comment states the intent: "a new generic owner cannot silently acquire feature
vocabulary just because its path never names that feature." An approval for vocabulary the file
does not contain is standing permission — so this commit's best structural improvement is now
unguarded, and a future author wiring widget #4 can re-hardcode `'Creative Variations'` into the
bubble with the witness staying green.

**Recommendation:** Drop the three display-name alternatives:
`allowedToken: /(?:gesture-playground|lexical-gravity|creative-variations|lensSlug)/`. The stale
token in `workshopWidgets.ts` belongs in a separate cleanup.

### F-13 · 🔵 Nit — Blank-bubble fallback cannot see ownership refusal

**Raised by:** Sam
**Discovery:** 1 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts:254-256` — `const displayContent = recommendationRejected && strippedDisplayContent.trim().length === 0`
**Affected contract:** operational

`recommendationRejected` covers parse rejection and unavailable sources. It cannot cover the third
refusal, which happens later and elsewhere — inside `completeRun`'s `(isHost || isGuest)` gate.
Sam probed the commit's own new tool-turn fixture with a frame-only reply: `turn.content = ""`,
no rejection event, and a log line reading `Widget recommendation accepted (Jill)` for something
that was discarded. Empty bubble, no chip, no notice.

Reachability is genuinely closed today, which is why this is a Nit: `buildWorkshopPersonaSystemMessage`
appends the recommendation contract and `buildWorkshopToolSystemMessage` does not, so the set of
runs that see the frame grammar is exactly the set `completeRun` accepts recommendations from. A
tool would have to hallucinate an exact 20-marker frame. The shape is also inherited — the same
hole existed for Gesture. What is new is that this commit exercises the path for a third widget
and leaves the invisible coupling untested.

**Recommendation:** Assert `turn.content` in the existing tool-turn test so the coupling is pinned.
Optionally extend the fallback to `widgetRecommendation.outcome !== 'absent' && !turn.widgetRecommendation`.

### F-14 · 🔵 Nit — Modal asserts a provenance fact the host never verifies

**Raised by:** Patricia
**Discovery:** 1 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal.tsx:435` — `'The persona prepared this passage from material available in the room. …'`
**Affected contract:** security

The second sentence is scrupulously honest. The first is an affirmative claim about text the model
wrote freely, and nothing checks it: `inspectCreativeVariationsRecommendation` is pure and never
sees the session, and `unavailableWidgetSourceReference` validates source *addresses*, never the
subject body. Searched for any subject-vs-session-material containment check — not found. A model
that invents a passage wholesale produces a frame that parses, persists, and renders under this
sentence.

Kept small for two reasons: Gesture's `target_missing_from_context` is a frame-internal
consistency check between two model-supplied fields, not a session-material check, so the absence
of verification is inherited family behavior; and the sentence only renders in the
`!surroundingContextTravels` branch (see F-09). What is new is the sentence itself — no sibling
makes an origin claim on the model's behalf.

**Recommendation:** Say what the host knows: "A persona filled this in from the conversation —
read it before you generate." Attributes the act without asserting the source.

### Praise

**P-01 · 🎯🎯 Strong Consensus — Catalog-derived chip presentation with a return-type-enforced exhaustive switch** (Parker, Sam, Marcus).
`WorkshopTurnBubble.tsx:66-83`. Sam framed the counterfactual best: the old chip was two binary
ternaries, so adding `creative-variations` and touching nothing else would have shipped a chip
labelled "Lexical Gravity," drawing an orbit, reading `seed.lensSlug` off a Creative seed — valid
looking, completely wrong, and no compiler or test would have said a word. The commit replaced
both with total lookups over all thirteen catalog ids and concentrated the remaining per-widget
copy into a `switch` with no default returning `: string`, which under `strict` makes widget #4 a
compile error. A file that gained a feature and came out knowing *less* about features.

**P-02 · 🎯 Consensus — Persona ownership minted and gated from a single object literal** (Blake, Patricia).
`WorkshopSessionService.ts:1494,1522`. `participant` and `widgetRecommendation` are produced in
the same expression from the same `isHost`/`isGuest`, so ownership is not two facts that can
drift apart. Blake found exactly one write site in the whole of `packages/core/src`.

**P-03 · Two-tier required/bounded split encodes the "blank is meaningful" locked decision** (Bria).
`CreativeVariationsRecommendation.ts:164-169`. Every tag structurally required, only four carrying
content requirements — the only construction under which "blank" stays *meaningful* rather than
*malformed*. Neither sibling needed it and neither has it.

**P-04 · Compile-forced totality of writer-facing rejection copy** (Oliver).
`WorkshopRunCompletion.ts:119-120`. `WIDGET_FIELD_LABELS` and `INVALID_WIDGET_FIELD_COPY` are
indexed by the union across all three widgets, so adding `invalid_distance` without adding copy
is a type error rather than a runtime `undefined` in a sentence the writer reads.

**P-05 · 🎯 Consensus — Reserved-delimiter fitness test derives from registry entries** (Marcus, Patricia).
`__tests__/utils/workshopPromptFrames.test.ts:127-148` builds its expected markers by flat-mapping
every entry's `reservedMarkers` rather than restating a hand list, so a missing alternative fails.
Patricia additionally confirmed the neutralizer runs on the transcript path, so a rejected frame
persisted into a turn still cannot forge a delimiter on the next turn.

**P-06 · The raised ceiling is zero-cost — measured** (Tim).
`Math.max` over two constant sums resolves at module load; the gated scan benchmarked at 2.25 ms
worst case against degenerate 51,500-character input, because the marker loop short-circuits on
the first count mismatch. Whatever the argument about the shared ceiling is, it is not a
performance argument.

## What the Panel Changed About the Runway

**Affirmed.** The central thesis held under ten independent traces: the feature slice moves labor
across the human–model boundary while moving no authority, and the strain is in the family's
shared surfaces rather than in Creative itself. The "do not overread" list held — no reviewer
filed the raised ceiling as a correctness or safety regression, and Tim and Blake independently
confirmed why.

**Refined.** Stan split the tech-debt item into two halves deserving different verdicts: the
ceiling is legitimately Slice 7 work, the pin is not, because pricing this commit was the pin's
entire job. Patricia reframed the participant check from a codec-versioning question into an
availability decision placed ahead of the only layer that could repair it. Oliver sharpened
"names the field" to "names the field and never the widget," and showed the collision is live at
n=3 rather than pending at n=5.

**Rejected — five runway claims corrected by evidence.**
1. Cal: commit → reopen of `persona-prefill` *is* adequately covered, because `assertSubjectShape`
   is the single shared owner across the draft, committed-config, and checkpoint paths. No route
   test is owed.
2. Parker: the guards rewritten from closed to open form both open toward the *safe* answer — an
   unknown fourth kind decays to `pasted` rather than retaining a stale claim. Not material.
3. Marcus: the "lost excerpt address" is a safety property, not a modeling gap. The host cannot
   verify persona-supplied text against a file range, and minting `excerpt` would forge an address.
4. Bria: `?? 'tail'` / `?? 3` are not inventions — the sprint locks "New drafts default to `Tail`,"
   both fallbacks reproduce the fresh-draft constructor exactly, and both fields are
   parser-required so the fallback is unreachable.
5. Tim: the React.memo concern is void. `WorkshopApp` passes freshly-allocated inline arrows to
   `WorkshopThread` on every render, so that memo has never skipped one — and the transcript
   already re-renders once per streaming chunk. The dependency-array change is also
   correctness-mandatory, since `[]` would have captured `creativeVariationsOpening` as
   permanently `null` and the new guard would never have fired.

**Still unknown.** Whether the family-ceiling change was deliberate or the minimal-diff expression
of "Creative's frame is bigger." Whether Slice 7 is scoped to discharge the debt file's remaining
item. Whether Gesture and Lexical widget configs have shipped to Marketplace — an open question
carried forward from the pr-99 review across two sprints. Human F5 inspection of the
banner/chip/label layout remains outstanding by the author's own statement.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — Two derivations of one fact are a promise to disagree

**Illuminated by:** F-03 (Marcus, Cal), F-08 (Stan, Parker), F-09 (Parker, Cal), F-07 (Marcus), and F-02's banner/label split (Bria)

A fact computed in two places stays true exactly as long as one person holds both in mind, and
that person is always the one who just wrote them. The frame ceiling restates by hand what the
parsers already declare; `creativeSourceReferenceCharacters` borrows a sibling's name and quietly
changes its unit; the honesty paragraph and its own label read the same two booleans in opposite
order; the boundary descriptor lists a sibling's vocabulary patterns instead of deriving them.
Not one of these is wrong today, and each can become wrong without anyone editing it — which is
what makes the class worth naming rather than the instances. The counter-move is in this same
commit: `widgetRecommendationMeta` collapsed four hardcoded ternaries into one catalog-derived
switch, a file that gained a feature and came out knowing less about features than before.

**Carry forward:** When a fact lands in a second place, say out loud which copy is the source —
"the registry is the source, the formula reads it" — and if the second place structurally cannot
read the first, that sentence is the specification for the test that keeps them honest.

### Lesson — A test that takes its expectation from the code under test has only agreed with itself

**Illuminated by:** F-03 (Cal, Marcus), F-09 (Cal, Parker), F-12 (Stan)

The ceiling test builds its input as `FRAME_CHARACTERS + 1` and asserts back
`maximumCharacters: FRAME_CHARACTERS`, so it is equally green at 15,300, at 51,500, and at seven;
the only mounted persona test supplies context, so it exercises the single branch the new honesty
copy cannot reach; the architecture allowlist grants three tokens the file no longer contains, so
a genuine refactor left its own improvement unguarded. All three pass, and what they prove is that
the code equals itself. The distinction worth keeping is not derived-versus-hardcoded — the
delimiter fitness test is derived and is the best guard in the commit, because its expectations
come from the feature-owned `reservedMarkers` while the behavior under test is the generic
neutralizer.

**Carry forward:** Ask of each new assertion: what change to production code would turn this red?
If the honest answer is "none, the expectation moves with it," the test is describing the code,
and the guarding fact is elsewhere — for a ceiling, that fact is a maximal legal frame measured
against it.

### Lesson — Put the memo inside the tripwire

**Illuminated by:** F-01 (Cal, Stan, Blake, Tim), F-12 (Stan)

A debt file that names its own trigger condition — "stays required before a third live widget" —
has stated the one thing it cannot do: announce itself at the moment it becomes true. The 4,811
pin was the mechanism and the doc was the reminder, but the mechanism carried no trace of the
reminder, so at the moment of contact it presented as an unexplained magic number attached to a
value that had legitimately changed. That is why the orphaned import is the interesting artifact
here: it shows the deletion read as tidying, which is precisely how a policy dies when the policy
lives somewhere the tidying does not reach.

**Carry forward:** When an assertion exists to make a future cost visible rather than to catch a
bug, put the reason in the assertion's own text — the test title, the constant's name, or the
failure message. A failure message is the only documentation guaranteed to be read at the exact
moment it matters.

### Lesson — Point the noise at whoever can fix it

**Illuminated by:** F-05 (Marcus, Oliver), F-11 (Patricia, Blake), F-06 and F-13 (Oliver), F-10 (Sam)

Two findings look like opposites and are one axis. A dispatch with no terminal branch is a
developer's omission that fails in perfect silence; a decode-time throw over one bad field is a
writer's damaged file that fails by taking the whole session with it. Both have the volume
inverted — the failure only an engineer can cause is inaudible, and the failure only a writer can
suffer is maximal — and between them sit the quieter cases where a log or a toast names the shape
of the event but not which widget, which outcome, or which click. Loudness is not a virtue or a
vice; it is a routing decision.

**Carry forward:** For every new failure path, ask who is standing in front of it and whether they
can act on what they see. Developer mistakes want to be impossible or loud at build time;
writer-data damage wants to degrade to the smallest thing that is actually broken.

### Lesson — The strongest guarantee has nowhere to put the violation

**Illuminated by:** F-02 (Bria, Marcus), F-04 (Bria, Patricia), F-14 (Patricia)

The seed type is the best idea in this commit: eight optional scalars with structurally no place
for a workup, a selection, an accepted risk, or a provenance claim — safety expressed as absence
rather than as a check a later author could forget to run. Every remaining trust-boundary finding
is that same safety carried by a string instead. `persona-prefill` is an enum member answering
"who typed this" inside a union that answers "where did this come from," so the instant both facts
are true, one of them has to be thrown away — and the record that survives makes a claim. The rule
against inferred constraints lives only in prompt copy while the ask copy contradicting it was
templated from a sibling where inference is explicitly permitted, the modal asserts a custody fact
nothing verifies, and the kind justified as display-safe turned out to travel into the generation
task JSON.

**Carry forward:** Before adding a member to an enum, state in one sentence the question that enum
answers, and check the new member answers *that* question rather than an adjacent one; and when a
value is justified as display-only, write down where it is permitted to travel, then grep whether
it has already gone further.

## Horizon Watchlist

Not merge blockers. Real pressures the panel supported but that do not belong in a finding.

- **Widget #4 is already in the catalog.** `show-vs-tell` is live-flagged false with its sprint doc
  written and its icon mapped. Sam traced its shape: it needs a variable-arity `<channel>` element,
  which `inspectExactWorkshopWidgetRecommendationFrame`'s exactly-one-occurrence rule cannot
  express. The `source-references` newline-delimited pattern is the family's implicit answer;
  writing that convention down before the fourth widget is cheaper than after.
- **`PROMPT_BUDGETS.workshopWidgets` is a ~90-key flat record** disambiguated by prefix convention
  and pinned wholesale by one large test assertion. A fourth prefix pushes it past 110 keys.
  Under-abstracted rather than over-abstracted, and not this commit's to fix.
- **`WIDGET_FIELD_LABELS` is keyed by bare field name across all widgets.** `contextText` and
  `sourceReferences` are already shared keys. The first same-name, different-meaning collision
  resolves silently in favour of whoever wrote it first.
- **Fully-live prompt projection.** Three of thirteen catalog ids are live. At the current mean
  marginal cost the recommendation contract reaches ~30,400 characters (~8,000 tokens) on every
  persona turn, with no prompt-cache breakpoint anywhere in the codebase.
- **Modal accessibility.** Sam noted in passing that `useOverlayDismiss` has no focus trap and no
  `inert`, so a keyboard-only writer can Shift+Tab into the composer behind an open sheet, and
  Escape is a bare `window` listener firing on every open overlay at once. Pre-existing, outside
  this commit's scope, worth its own item.
- **Marketplace status of Gesture and Lexical widget configs** remains unresolved across two
  sprints and governs whether ADR 2026-07-30's migration rules bind future codec tightenings.

## The Closer

🔮 **Fortune cookie**

> You built a door that cannot be opened from the wrong side. Now check what the previous door was
> holding shut.

## Final Assessment

**Nearly there.** The feature slice is the strongest of the three recommendation codecs: authority
is enforced structurally rather than by convention, provenance is unforgeable by the model,
report-prefill is genuinely absent rather than half-built, and the presentation layer got *more*
generic while gaining a feature. Ten reviewers found no Blocking issue and no correctness defect,
and five of them corrected the pre-review analysis rather than confirming it.

Two things should be settled before this slice is called done, and both are small. Re-pin the
prompt-size assertion at 7,775 (F-01) — one line that restores a guard the repo installed
specifically for this commit. And rule on what `provenance` is for (F-02), because the current
middle position writes a claim into the durable record that is not true, and the decision is cheap
now and a migration later. The remaining ten Standard findings and two Nits are ordinary follow-up
work; several are one clause or one reordered ternary.

The recurring theme is worth naming plainly: nothing is wrong inside Creative's borders. The
pressure is entirely on shared surfaces that were sized for one widget and are now carrying three.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ ·
Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
