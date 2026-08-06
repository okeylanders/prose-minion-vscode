# MR Review v2 — refactor(workshop): normalize Sprint 06 contracts, tests, and docs

**Author:** okeylanders · **PR:** #107 · **Branches:** `sprint/workshop-architecture-refactor-06-normalization` → `epic/workshop-architecture-refactor`
**Head:** `9d47729` · **Base:** `b577d60e` · **Reviewed:** 2026-08-06 · **Mode:** Full (runway-corroboration)
**State at review:** draft · CI `verify` green

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason ·
**Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise,
superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Witness selects by feature *name*, not feature *semantics* | Oliver, Sam, Patricia | 3 independent | 🎯🎯 Strong Consensus | **Open** |
| F-02 | 🟠 High | Neither approval tier constrains what it claims | Cal, Sam, Stan, Parker | 4 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-03 | 🟡 Standard | Reserved-marker neutralization list orphaned by the split | Patricia | 1 independent | — | **Open** |
| F-04 | 🟡 Standard | Half-derived prompt: list is generated, count is prose | Bria, Tim, Marcus | 2 independent · 1 runway-prompted | 🎯 Consensus | **Open** |
| F-05 | 🟡 Standard | Registry landed in `utils/`, imports upward, no ADR §7 record | Marcus, Stan, Tim | 1 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-06 | 🟡 Standard | Three of four Lexical Gravity rejection branches untested | Cal, Blake | 1 independent · 1 runway-prompted | — | **Open** |
| F-07 | 🟡 Standard | Empty `<lens-slug>` conflated with `unsupported_lens` | Sam | 1 runway-prompted | — | **Open** |
| F-08 | 🟡 Standard | `WorkshopGestureOpening` survived the rename pass | Parker, Oliver | 2 independent | 🎯 Consensus | **Open** |
| F-09 | 🟡 Standard | Doc-agreement witness pins substrings and fails opaquely | Cal, Parker, Oliver | 3 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-10 | 🟡 Standard | Criterion 3, the ADR, and the witness say three different things | Bria | 1 runway-prompted | — | **Open** |
| F-11 | 🟡 Standard | New feature slices ship without mirrored test files | Stan | 1 independent | — | **Open** |
| P-01 | ✅ Praise | Migration provably behavior-preserving; the protocol seam is why | Blake, Bria, Tim, Marcus, Patricia | 1 independent · 4 runway-prompted | — | **N/A — preserve** |
| P-02 | ✅ Praise | Rejection failure trail is honest across four layers | Oliver | 1 runway-prompted | — | **N/A — preserve** |
| P-03 | ✅ Praise | `BUILT_IN_LENS_SLUGS` gate intact, with defense in depth downstream | Patricia | 1 independent | — | **N/A — preserve** |

## Review coverage

- **Read fully:** `boundaries.test.ts`, `utils/workshopWidgetRecommendation.ts`, `utils/workshopWidgetRecommendationProtocol.ts`, `utils/workshopPromptFrames.ts`, `GesturePlaygroundRecommendation.ts`, `LexicalGravityRecommendation.ts`, `LexicalGravityConfigCodec.ts`, `shared/constants/workshopWidgets.ts`, `shared/constants/resultToolNames.ts`, `shared/constants/promptBudgets.ts`, all nine `messages/workshop/*.ts`, `WorkshopStandingDirectiveOperations.ts`, `WorkshopWidgetConfigOperations.ts`, `WorkshopRunCompletion.ts`, the 925-line pre-implementation runway, ADR 2026-08-03, sprint 06 record, `AGENTS.md`
- **Diff reviewed:** all 58 changed files across eight focused slices
- **Verified independently by the orchestrator:** the 202 → 201 export-symbol audit and its exact delta; the 29/8 approval-list count; all three F-01 counterexamples confirmed to match `WORKSHOP_FEATURE_VOCABULARY` zero times
- **Not executed:** the test suite (CI `verify` already green; declared 187 suites / 1,925 tests is **[Declared]**, not observed here)
- **Blast radius:** 58 files, +4,240 / −2,691, 2 commits. No `MessageType`, wire, or persisted-shape change.

---

# Part I — Semantic Runway

> Written before the panel ran, from the diff plus the author's 925-line pre-implementation
> runway. Published as-issued; where the panel corrected it, that is recorded in
> *What the Panel Changed About the Runway*.

**Runway thesis.** Sprints 01–05 moved code; Sprint 06 moves *claims*. Its deliverable is the
removal of every place where two artifacts describe the same architecture differently — and its
characteristic failure mode is silent: a list is emptied, a document is corrected, an audit
certifies both, and the discrepancy that survived is now blessed. The change is therefore judged
less on whether the split is correct (it is mechanically verifiable) and more on whether the
*witnesses* it installs can see the violation class they certify.

## 1. Working Definition & Real Job

Delete `shared/types/messages/workshop.ts` (2,014 lines) and redistribute it across nine modules
behind a new subdomain barrel. Move Lexical Gravity's numeric value grammar into
`LexicalGravityConfigCodec`. Move both live widgets' recommendation prompt copy and field parsers
into named feature slices behind one frozen registry. Rename five `WorkshopGesture*` types, delete
one retired alias. Invert the feature-vocabulary fitness witness and empty the migration exception
ledger. Realign two test files, four documents, three debt records.

**Functional capability: none.** [Observed] No `MessageType` value, payload field, envelope shape,
persisted shape, or `schemaVersion` change. Exported contract surface 202 → 201 symbols, the delta
exactly five declared renames plus one declared deletion.

**What the structure emphasizes.** Ownership. Nearly every move is a statement about *who is
allowed to know what*. **What it suppresses:** size — ~85% of the line count is a verifiable file
split plus documentation; the semantic weight lives in roughly 1,000 lines.

> This MR is not merely a file split. Its real job is making the epic's ownership claims
> *checkable by something other than the person who made them*, while preserving every wire shape,
> persisted shape, and the `@messages` barrel as the single import surface.

## 2. Declared Intent, Observed Behavior & Open Meaning

| Declared | Observed against the diff | Status |
|---|---|---|
| Nine responsibility-owned modules behind the stable `@messages` barrel | Nine files present; symbol audit 202 → 201 | **Aligned** |
| Normalize Gesture Playground names, remove the retired alias | Exactly 5 renames + 1 deletion, no orphans | **Aligned** |
| Feature value grammar and prompt ownership into named slices behind one exact closed registry | Grammar left `workshopWidgets.ts`; registry is a frozen `Record` keyed by the message union | **Aligned; see Q3** |
| Approvals are narrow and stale entries fail | Witness and stale-entry detection exist. **Of 29 approved surfaces, 21 carry no `allowedLine`** | **Partially — Q1** |
| The ledger is empty because the inverse case is actively checked | `WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS = []`, asserted `toEqual([])` | **Aligned only if Q1 resolves** |

[Unknown] The original runway is dated the same day as the implementation and its status line reads
`IMPLEMENTED AND VERIFIED`. Where it asserts an outcome, treat that as **[Declared]**.

## 3. Business Story & Rulebook

**Actors.** The writer (human, in VS Code); the persona (an LLM producing a response); the Workshop
room; the widget.

**The one live rule this MR touches.** A persona may end a response with exactly one
`### Try a widget` control frame. Rules preserved: at most one recommendation per response
(`duplicate_heading`); the section must fit a character ceiling (`frame_too_long`); the widget id
must be live *and* recommendation-capable; Lexical Gravity may only name a **built-in starter lens**
(`unsupported_lens`) because an arbitrary project lens's body would otherwise enter a system prompt;
rejection is fail-closed and total, and the reserved heading owns the response tail even when the
frame rejects.

**Value created:** the writer gets a proposal, never an installation. **Harm prevented:** a persona
silently installing a lexical field that steers all subsequent prose — and, more sharply, injecting
arbitrary lens content into a system prompt.

## 4. Narrative Flow

**Beginning.** A persona composes a response, already instructed by
`WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION`, assembled from each registry entry's `catalogSummary`
and `instruction`. **Development.** `inspectWorkshopWidgetRecommendation` normalizes line endings,
locates the single reserved heading, measures the section against the ceiling, extracts the widget
id, gates it through `isLiveWorkshopWidgetId` and `isRecommendationWidgetId`. **Turn.**
`WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES[widgetId].inspect(sectionLines)` — the commitment point this
MR *created*; before, this was an inline `switch`. **Ending.** Either an `accepted` recommendation
carrying a typed seed, or a `rejected` outcome with a specific reason; the control frame is stripped
from the transcript and a placeholder replaces an empty remainder before retained provider history.

**Unresolved thread.** The character ceiling is computed *before* the turn from budget keys
belonging to one feature. The ending is governed by a number the beginning inherited from Gesture
Playground.

## 5. Codebase Genealogy & Controlling Precedent

**Controlling precedent: `WorkshopStandingDirectiveOperations.ts`** — a `Readonly<Record<Family,
Entry>>` keyed by a closed union, one behavior interface per family, the live family imported from
its feature slice, an explicit throwing placeholder for the not-yet-live family, `never`-typed
exhaustiveness at the switch.

[Observed] The reproduction is close but not identical in two respects:

1. The standing registry lives in `application/services/workshop/directives/` and imports sideways
   into feature slices in the *same layer*. The new recommendation registry lives in `utils/` and
   imports **upward**. Before this MR, `utils/workshopWidgetRecommendation.ts` imported only from
   `@messages` and `@shared/constants/*`. The `utils/` → `application/` edge is **new**.
2. The standing registry carries an explicit throwing placeholder for `prose-controller`. The
   recommendation registry has none; its closure is enforced by the union rather than by an entry.

**New precedent this MR creates.** Two, and both will be copied: the nine-module subdomain tree, and
the approval list in `boundaries.test.ts` — including, by example, how narrowly a generic module
must scope its right to name a feature.

## 6. Structural & Causal Map

```
persona response
  └─> inspectWorkshopWidgetRecommendation          utils/workshopWidgetRecommendation.ts
        ├─ heading / duplicate gate
        ├─ ceiling gate            <── PROMPT_BUDGETS.workshopWidgets (gesture* keys only)
        ├─ id extraction           <── workshopWidgetRecommendationProtocol.ts  (pure, no imports)
        ├─ live-id gate            <── shared/constants/workshopWidgets.ts      (ids + labels only)
        └─ WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES[id].inspect      ← the new commitment point
              ├─ GesturePlaygroundRecommendation.ts    application/services/workshop/widgets/…
              └─ LexicalGravityRecommendation.ts       application/services/workshop/widgets/…
                    └─ LexicalGravityConfigCodec.ts    ← value grammar's new home
```

[Observed] **No cycle.** Feature slices import the pure protocol module, never the registry. The
protocol module is the seam that makes the split acyclic. Data flows generic → feature; import
direction now flows `utils/` → `application/services/`.

## 7. Contracts, Invariants & Negative Space

**Invariants that must survive.** Single `@messages` import surface (the five prior deep importers
were repointed) · no `MessageType` value change · settings defaults pinned to `package.json` by two
defaults-sync witnesses that import via `@messages` and were therefore **unmodified** by the split ·
fail-closed total rejection · the exception ledger may only shrink, with its enabling change in the
same commit.

| Generic owner | May know | Must not know |
|---|---|---|
| `shared/constants/workshopWidgets.ts` | ids, labels, rails, groups, `live` flags | any feature's value grammar |
| `utils/workshopWidgetRecommendation.ts` | frame envelope, id field, ordered markers, budget, generic rejections | either feature's prompt copy, field markers, or validation |
| `messages/workshop/widgets.ts` | rails, config-snapshot base, explicit unions | any feature's draft *shape* |

[Observed] The budget sits inside "may know" — but the budget itself names a feature.
`WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS` sums six `gesture*` keys and governs *both*
widgets. Inherited and identical before the MR.

**Explicitly out of scope.** The `WorkshopHandler` → `WorkshopRoomHandler` naming verdict (D3) and
the god-files debt record — both deferred to Phase 7 by accepted decision.

## 8. Forces, Tensions & Design Tradeoffs

Detection vs allowlist honesty — the witness cannot exist without an allowlist, and an allowlist is
a second thing to keep true; the live question is not whether to pay that cost but *at what
granularity*. Layer purity vs registry locality. Closure by union vs closure by placeholder. Alpha
freedom vs contract stability — five renames and a deletion cost nothing here; that freedom expires.

## 9. Failure, Recovery & Operational Truth

No runtime or persistence change, so the operational surface is narrow. The honest operational
question is about the *witness*: a fitness function that passes while the property it names is false
produces no signal, and its silence is indistinguishable from health. A *false positive* costs a
developer five minutes and an allowlist entry. A *false negative* costs the epic its central claim,
silently, at the moment Phase 7 lifts the freeze.

## 10. Security, Trust & Misuse Surface

One real trust boundary lives in this diff and it moved: the persona-controlled recommendation
frame. `BUILT_IN_LENS_SLUGS` prevents a persona naming an arbitrary project lens whose body would
enter a system prompt. That set moved from the generic parser into the feature slice. The gate's
*semantics* — set membership, rejection reason, ordering relative to other field validations —
require verification rather than the assumption that a move preserved them.

## 11. Data, Time, Scale & Concurrency Horizon

Largely not material. No persistence, concurrency, or new I/O. The one horizon pressure worth naming
is *allowlist entropy*: 29 approved surfaces today, and every future feature family adds candidates.

## 12. The Change Genome: Variation & Reproduction

**Cousin feature: Prose Controller** — already in the codebase as a throwing placeholder in the
standing registry, varying along one axis: it is a *third* member of families the code models as
pairs. The reproduction test: add `messages/workshop/proseController.ts` → **Extension**; add arms
to the explicit unions → **Extension**; add entries to both registries → **Extension**; add
`MessageType` entries → **Extension**; add its name to the witness allowlist **only if** a generic
module must legitimately name it.

**Step 5 is the load-bearing test.** With 21 of 29 approvals being whole-file exemptions, would a
Prose Controller author even *discover* that they had leaked? The clearest **Contradiction**
candidate is the budget keys — a third widget inherits a ceiling built from the first widget's
fields.

## 13. Comparative Models & Borrowed Vocabulary

**Internal (strongest): `WorkshopStandingDirectiveOperations.ts`.** Contributes: should the
recommendation registry ship a throwing placeholder, or is union-keyed closure strictly better?

**[Analogy] Fitness functions.** The vocabulary that matters is *selection rule* — a fitness function
is only as good as the candidate set it scans. The old witness selected by path and a false generic
has a generic path. **Did the approval mechanism reintroduce a narrower version of the same blind
spot?** A whole-file exemption is, structurally, a per-file re-creation of "this path is not a
candidate."

**[Analogy] Chain of custody.** An exception ledger is an evidence log. *Absence of evidence* vs
*evidence of absence* is the most useful distinction to carry into this review.

## 14. Creative Counterfactuals

**Inversion:** if approvals defaulted to line-scoped and required an explicit `wholeFile: true` with
a written reason, which of the 21 would survive the writing of that reason? **Deletion:** delete the
approval list and let the witness fail on all 29 — probably 4–6 genuine composition roots remain;
that gap measures how much the list is doing. **Time-lapse:** two more widgets, ~40 entries, who
reads it? **Boring alternative:** inline marker comments at each approved line, trading a central
inventory for locality.

## 15. Evidence Confidence & Unresolved Questions

**[Observed]** symbol audit 202 → 201 with exact declared delta; nine modules present; ledger empty;
29 approval entries of which 21 lack `allowedLine`; the `utils/` → `application/` edge is new; the
gesture-derived ceiling is unchanged; no cycle; CI green.

**[Inferred]** that the ~126-line surplus in the recommendation migration is module boilerplate
rather than behavior change — *the panel's job to confirm or refute, not to assume.*

**Needs author confirmation:** whether whole-file approvals were a deliberate granularity choice or
the path of least resistance while getting the witness green.

## 16. Past → Present → Horizon Synthesis

**Past.** An epic that reduced every red-band file except the one holding the protocol, and a guard
family that selected candidates by path while the violations it was meant to catch had generic paths
by definition. **Present.** The protocol is nine modules; value grammar and prompt copy have named
owners; the selection rule is inverted; the ledger is empty. Whether "empty" means "nothing is
wrong" rather than "nothing is looking" depends on how narrowly the approvals are drawn.
**Horizon.** Prose Controller lands against this shape and will copy the subdomain tree, the
registry, and the allowlist convention. Whatever granularity is normal here becomes the standard.

## 17. Runway Synthesis Brief

**Invariants.** Single `@messages` surface · no wire/persisted change · settings defaults pinned ·
fail-closed total rejection · built-in-lens-only gate · ledger may only shrink with its enabling
change.

**Tensions.** Detection vs allowlist honesty · layer purity vs registry locality · closure by union
vs closure by placeholder.

**Legitimate variation points.** Per-feature `inspect`, markers, instruction copy, and value grammar.
These *should* differ.

**Questions for the panel.** Q1 approval granularity · Q2 the new `utils/` → `application/` edge ·
Q3 registry vs precedent, part by part · Q4 the gesture-derived ceiling · Q5 behavior diff of the
~394-out/~520-in migration · Q6 what the doc-agreement witness proves · Q7 rename completeness.

**Do not overread.** The split's size (verifiably a move) · doc/test realignment · the
`WorkshopHandler` naming tension and god-files record (settled by D3) · absence of runtime behavior
change.

---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there** — the change does what it says and the panel proved it, but the two
witnesses installed to make its central claim checkable cannot see the violation class they certify.

- 🟠 **F-01 · Witness selects by feature *name*, not feature *semantics*** `🎯🎯 Strong Consensus` — three reviewers independently found generic modules holding feature semantics that spell no feature name, including one file *this MR created*. The empty exception ledger is certified by a scan with a live blind spot. Widen the vocabulary or pin the leaked unions before Phase 7 audits this.
- 🟠 **F-02 · Neither approval tier constrains what it claims** `🧭 Corroborated Runway` — 21 whole-file exemptions return before reading a line (the migrated parser can be pasted back into the file it left, with zero test failures); the 8 "narrow" approvals test the whole line, not the token. Three regexes and one token-scoped comparison buy back the property.

No Blocking findings. The contract split, the rename set, the prompt copy, and the trust gate were
each verified behavior-identical at source.

## Report Card

| Domain | Grade | Rationale |
|---|---|---|
| Architecture — Marcus 🏛️ | **B** | The protocol seam is genuinely excellent and acyclic by construction; the registry sits one layer too deep with no ADR §7 record, unlike the deviation this same commit documented correctly. |
| Critical Correctness — Blake 🔥 | **A** | Behavior diffed rather than assumed: prompt byte-identical, all 28 split export bodies byte-identical, markers and rejection order unchanged, `Number()` coercion untouched. |
| Edge Cases — Sam 🔍 | **B−** | An empty `<lens-slug>` reports as the trust-boundary violation; the `allowedLine` mechanism approves lines rather than tokens, demonstrated by running the witness. |
| Code Quality — Parker 📖 | **B** | Nine module headers state their boundaries honestly; one rename survivor and four approval `reason` strings describe a narrower grant than they give. |
| Tests — Cal 🧪 | **C+** | The suite cannot detect this MR being undone; three of four Lexical Gravity rejection branches have never executed. The +28-line codec boundary test is exactly right and pins the wrong half. |
| Codebase Fit — Stan 🗂️ | **B−** | Approval granularity is internally consistent across all five registries; the precedent's second witness and the folder's test-mirror convention did not travel with the pattern. |
| Performance — Tim ⚡ | **A** | Measured, not guessed: prompt 4,789 chars both sides, witness costs 15.76 ms across 320 files, and an argued case *against* memoizing. |
| Security — Patricia 🛡️ | **B−** | The `BUILT_IN_LENS_SLUGS` gate verified intact in all three properties with defense in depth downstream; the reserved-marker list lost its coupling to the markers it reserves. |
| Observability — Oliver 🌙 | **B+** | The rejection trail is the most honest thing in the diff and survived the move; the new witnesses fail by printing 43 KB of markdown with no filename. |
| Domain Logic — Bria 🎯 | **B+** | Persona instruction byte-identical across 54 elements; criterion 3, the ADR, and the witness state three different rules for one checked box. |

## Findings

### F-01 · 🟠 High — The witness selects by feature *name*, not feature *semantics* `🎯🎯 Strong Consensus`

**Raised by:** Oliver, Sam, Patricia
**Discovery:** 3 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:261-262` — `const WORKSHOP_FEATURE_VOCABULARY =` / `  /(?:Lexical\s*Gravity|lexicalGravity|lexical-gravity|LEXICAL_GRAVITY|Gesture\s*Playground|gesturePlayground|gesture-playground|GESTURE_PLAYGROUND)/;`
**Affected contract:** test/fitness contract — the executable form of epic completion criterion 3

The witness states its own guarantee at `:273-276`: *"a new generic owner cannot silently acquire
feature vocabulary just because its path never names that feature."* The candidate set backing that
claim is one regex matching eight literal spellings of two proper nouns. Three reviewers, working
different lanes, each found a generic module already holding feature semantics that the regex
cannot see. **All three were re-verified by the orchestrator: each file matches
`WORKSHOP_FEATURE_VOCABULARY` exactly zero times.**

- **Oliver** — `shared/constants/resultToolNames.ts:15` declares
  `GESTURE_DICTIONARY_RESULT_TOOL_NAME = 'gesture_dictionary'`. The gesture dictionary is
  unambiguously a Gesture Playground concept: built by `GesturePlaygroundService.ts:145`, rendered
  in `WorkshopGesturePlaygroundModal.tsx:76`, budgeted as `gestureDictionaryCharacters`. Generic
  path, scanned by the witness, **not** on the approval list, zero offender lines. Near-miss by one
  word.
- **Sam** — `utils/workshopWidgetRecommendationProtocol.ts`, a 150-line module *this MR created*,
  docstring "Feature-neutral protocol primitives", holds both features' complete field and failure
  inventories: `'lensSlug' | 'weight' | 'reach' | 'metaphorPull'` and `'unsupported_lens' |
  'invalid_weight' | 'invalid_reach' | 'invalid_metaphor_pull'`, plus Gesture's equivalents. Sam
  probed the consequence: appending `export const LENS_SLUGS = [...]; export const WEIGHT_STEP = 5;`
  to that module leaves the witness green — Lexical Gravity's value grammar back in `utils/`,
  precisely the class ADR fitness function #4 exists to prevent.
- **Patricia** — `utils/workshopPromptFrames.ts` holds twelve of the two widgets' field markers
  inside `RESERVED_PERSONA_FRAME`, and contains no feature-name string at all. The generic file
  carrying the densest concentration of feature-owned protocol vocabulary in the repository is
  invisible to the ownership check by construction.

Run the reproduction test against this. A Prose Controller author adds `'proseControllerTarget'` and
`'invalid_prose_mode'` to the protocol unions. No test fails, no approval entry is required, no
reviewer is prompted — step 5 of the reproduction test never fires, because the author never writes
the feature's name. The old blind spot was *a false generic has a generic path*. The new one is
*a false generic can use generic words*.

This lands at High rather than Standard because the same commit empties
`WORKSHOP_LEGACY_OWNERSHIP_EXCEPTIONS` to `[]` and asserts `toEqual([])` at `:951`. The only prior
record of known leaks was retired in favor of a scan with a live blind spot, and Phase 7 is
scheduled to lift a freeze on the strength of that assertion.

**Recommendation:** Two complementary repairs, both small. (1) Widen the vocabulary to bare stems
with a collision guard — `/…|\b(?:lexical|gesture)[A-Z]\w*|\b(?:LEXICAL|GESTURE)_\w+|(?:lexical|gesture)-[a-z]+/`
— then triage the fallout; `lexicalDensity` (prose metrics, a genuinely different domain, and
almost certainly why the narrow regex was chosen) needs an explicit exclusion. (2) Move the
per-feature members of both protocol unions into the feature slices, leaving the protocol module
with only the generic reasons — which makes the union say what its docstring already claims. If
widening is too disruptive to land here, at minimum document the blind spot in the witness's doc
comment: a witness that states its limits still produces signal; one that does not produces
confidence.

---

### F-02 · 🟠 High — Neither approval tier constrains what it claims `🧭 Corroborated Runway`

**Raised by:** Cal, Sam, Stan, Parker
**Discovery:** 0 independent · 4 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:721` — `if (approval && approval.allowedLine === undefined) { return []; }` and `:724-725` — `const unapprovedLines = approval?.allowedLine ? featureLines.filter(({ text }) => !approval.allowedLine!.test(text))`
**Affected contract:** test/fitness contract — approval granularity

`WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES` holds **29** entries: **8** with `allowedLine`, **21**
without (orchestrator-verified; the runway's 28/20 was wrong). Both tiers are porous, for different
reasons.

**The whole-file tier returns before reading anything.** Cal traced the highest-risk case: paste
`BUILT_IN_LENS_SLUGS`, the four Lexical Gravity markers, and the body of
`inspectLexicalGravityRecommendation` back into `utils/workshopWidgetRecommendation.ts` and dispatch
inline — undoing this MR's central migration. The scan reaches `:720`, finds the approval, sees
`allowedLine === undefined`, and returns `[]` before reading a line. The 485-line characterization
test is black-box and indifferent to whether the parser is inlined or dispatched. **Zero tests
fail.** Stan sharpened it: at base `b577d60`, the retired ledger entry for this exact file carried
`marker: /For Lexical Gravity/`, and that string is still the opening of
`LEXICAL_GRAVITY_RECOMMENDATION_INSTRUCTION`. The MR retired a precise negative marker on this file
and replaced it with an approval that cannot see what the marker watched.

**The narrow tier approves the line, not the token.** Sam ran the witness with one line mutated.
`workshopWidgets.ts:59` is `id: 'gesture-playground',` — approved. Rewritten as
`id: 'gesture-playground', weightRange: LEXICAL_GRAVITY_WEIGHT, reachValues: LEXICAL_GRAVITY_REACH.values,`
the witness **passes**. The identical text on its own line **fails**. Same file, same content, same
`reason` string that explicitly says *"not feature value grammar"* — the only variable is a newline.
`unusedApprovedSurfaces` does not help: the entry is still "used."

Two supporting observations. Stan: the precedent registry `WorkshopStandingDirectiveOperations.ts`
appears **twice** in this file — a whole-file approval *and* membership in
`WORKSHOP_GENERIC_STANDING_COPY_SURFACES`, which separately forbids feature writer-facing copy. The
new registry got the approval and not the guard. Parker: four `reason` strings describe a line while
granting a file — `SettingsOverlay.tsx` reads *"writer-facing model-setting description"* and covers
700 lines of settings UI; the type's own doc at `:267` says *"Omit only when the complete file is the
named integration seam."*

Stan's counterpoint is worth preserving and does not change the finding: the whole-file/line split
is *not* arbitrary — across all five closed registries the rule is consistent (a registry that
imports its feature slices gets whole-file; one whose feature lines are only record keys gets
`allowedLine`). The defect is not inconsistency; it is that neither tier enforces its stated scope.

**Recommendation:** Three repairs, each independently useful. (1) Add `allowedLine` to the files this
MR purified — `utils/workshopWidgetRecommendation.ts`, `shared/types/messages/workshop/widgets.ts`,
`shared/constants/promptBudgets.ts`. (2) Make `allowedLine` govern the token: remove the
`allowedLine` match from the line, then re-test the residue against `WORKSHOP_FEATURE_VOCABULARY`;
approve only when nothing unapproved survives. (3) Generalize
`WORKSHOP_GENERIC_STANDING_COPY_SURFACES` to `WORKSHOP_GENERIC_COPY_SURFACES` and add the
recommendation registry, so the file that just shed both features' prompt copy is asserted not to
reacquire it.

---

### F-03 · 🟡 Standard — The markers moved to the feature slices; the list that reserves them stayed behind

**Raised by:** Patricia
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/utils/workshopPromptFrames.ts:6` — `…|lens-slug|weight|reach|metaphor-pull|thread-artifact|…`
**Affected contract:** security — the prompt-injection boundary preventing writer/manuscript/attachment content from forging or closing a host-authored persona frame

`neutralizeReservedPersonaPromptDelimiters` is the control that stops quoted writer content from
impersonating host framing. It is applied to the pinned excerpt, every context attachment, the writer
message, todo text, the room transcript, and the writer profile
(`WorkshopPromptBuilder.ts:73,80,128,315,433,443,499`). Its entire authority is one hand-maintained
alternation of reserved tag names — twelve of which are the two widgets' field markers.

This MR made every one of those markers feature-owned property: `LENS_SLUG_START` …
`METAPHOR_PULL_END` now live in `LexicalGravityRecommendation.ts:20-27`, `TARGET_PHRASE_START` …
`CHARACTER_NOTES_END` in `GesturePlaygroundRecommendation.ts:17-26`. Before, they sat in a sibling
file in the same directory as the regex. They now sit three directories away in the application
layer, with no import, no shared constant, and no derived test binding the copies. The only pin is a
hardcoded literal list in `__tests__/utils/workshopPromptFrames.test.ts:124-155` — a third hand-copy
of the same names.

The reachable consequence is the cousin variant. When Prose Controller adds its markers to its own
slice, nothing fails: not `tsc`, not the boundaries witness (see F-01 — this file is never even a
candidate), not `workshopPromptFrames.test.ts`. Its tags are then unreserved, so a manuscript excerpt
or context attachment containing that literal tag reaches the persona un-encoded inside
`<pinned-excerpt>` or `<context-attachments>` — including a closing form, which is the escape
primitive the whole reserved-frame family exists to deny.

A second manifestation belongs in the repair: `GesturePlaygroundRecommendation.ts:56` now owns
*"Use this reserved heading and these tags exactly once, alone on their lines…"* — a **family-wide**
rule reachable in the system prompt only while the Gesture entry stays in `INSTRUCTION_ENTRIES`. It
is the prompt-side half of an anti-nesting defense whose parse-side half stayed generic. Patricia
confirmed this degrades compliance only; `duplicate_heading` and `invalid_frame` still reject
fail-closed.

**Recommendation:** Export each slice's marker tuple (they already exist as
`LEXICAL_GRAVITY_MARKERS` / `GESTURE_PLAYGROUND_MARKERS`) and assert in `workshopPromptFrames.test.ts`
that every registry entry's markers are neutralized, iterating
`WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES` rather than a literal list. That makes the third widget's
author fail a test instead of relying on them to open a file they have no reason to know about.
Separately, move the family-wide reserved-heading sentence into the generic contract preamble.

---

### F-04 · 🟡 Standard — Half-derived prompt: the widget list is generated, the widget count is prose `🎯 Consensus`

**Raised by:** Bria, Tim, Marcus
**Discovery:** 2 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/utils/workshopWidgetRecommendation.ts:61` — `` `The writer has two interactive widgets you may recommend: ${CATALOG_ENTRIES `` 
**Affected contract:** business — the persona instruction contract

Before this MR the introduction was one literal string carrying both the number and both widget
names, so adding a widget forced the author to retype the sentence and the count self-corrected by
co-location. This MR derives the list from `CATALOG_ENTRIES` and leaves `two` as prose. A third entry
yields *"The writer has two interactive widgets you may recommend: A; B; C."* — the contract with the
model opening on a self-contradiction. No test fails; the existing assertions are `toContain`
fragments that never touch the introduction.

Marcus traced the same root cause through the registry's own claim. Its comment at `:40-41` says *"A
new live recommendation arm must supply one named entry and make this Record compile"* — but
membership actually lives in four places, only one of which `tsc` enforces:

```
:43  WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES  = { gesture, lexical }   ← tsc-forced
:50  CATALOG_ENTRIES                         = [gesture, lexical]     ← nothing forces
:54  INSTRUCTION_ENTRIES                     = [lexical, gesture]     ← nothing forces
:61  'The writer has two interactive widgets…'                        ← nothing forces
```

A Prose Controller author adds the `Record` key because the compiler demands it, passes typecheck,
lint, and tests — and ships a widget that parses correctly, is fully dispatchable, and whose frame
grammar never reaches the persona. A silently dead feature whose registry comment told the author
that compiling was the contract.

Tim measured the scale: the assembled block is 4,789 characters (~1,200 tokens) on every persona
system message, uncached, against a system prompt of roughly 35–45 KB. **Not a cost problem** — the
count word is the sharp edge, not the bytes. `prose-controller` already exists in
`workshopWidgets.ts:160-169` with `live: false`, so this is one sprint out.

Bria found the third manifestation, and it is the one that will mislead someone:
`.todo/tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md:33-36` calls the
per-widget ceiling *"the only remaining completion item"*, while its own criteria 1 ("Only live
registry entries contribute recommendation prompt fragments") and 5 are also unmet. That record is
the declared gate in front of Prose Controller (`:49`), so its understatement is what the next author
will act on.

**Recommendation:** Derive the count from `CATALOG_ENTRIES.length` or drop the number — *"The writer
has the following interactive widgets you may recommend:"*. One line, and the sentence can never
disagree with the registry again. Separately, either derive `CATALOG_ENTRIES` from
`Object.values(WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES)` with an explicit ordering field, or amend the
comment at `:40-41` to name all four co-requirements and cite the debt record — the claim should not
be broader than the enforcement. And correct the debt record's "only remaining completion item" to
name criteria 1 and 5; deferring the work is fine, mis-recording it as done is not.

---

### F-05 · 🟡 Standard — The registry landed in `utils/`, imports upward, and the deviation went unrecorded `🧭 Corroborated Runway`

**Raised by:** Marcus, Stan, Tim
**Discovery:** 1 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/utils/workshopWidgetRecommendation.ts:16` — `} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundRecommendation';`
**Affected contract:** architecture / maintenance

**What the repo actually enforces, since that decides whether this is a rule break or a precedent.**
Marcus read `.eslintrc.json` (one `no-restricted-imports` block, scoped to
`apps/vscode-extension/src/**`), all eleven architecture test files, `AGENTS.md`, and
`docs/ARCHITECTURE.md`: **no rule constrains imports out of `packages/core/src/utils/`.** So this
edge breaks nothing. It is precedent-setting, and it is the only one of its kind — no other file
under `utils/` imports `@/application`, and this file previously imported only downward.

Both architecture documents describe the directory as a leaf (`docs/ARCHITECTURE.md:78`,
`.ai/central-agent-setup.md:82` — *"utils/ # Shared helpers"*), and the repo's own review checklist
asks *"Dependency Elevators: Any imports going 'up' the layer stack?"* The file is no longer a shared
helper; it is the binding site where generic dispatch commits to two named features.

Stan identified the true sibling, correcting the runway's genealogy:
`application/services/workshop/widgets/WorkshopWidgetConfigOperations.ts` — same widget family, same
doc-comment framing, importing from the *same two slice folders*, sitting one directory above them.
The runway named the standing-directive registry, which is the shape precedent but the distant
cousin; picking it is part of why `utils/` looked defensible.

Both reviewers priced the move and found the runway's cost estimate high. Of four production
consumers, three need only pure string helpers: `WorkshopApp.tsx:60-62` imports exactly one symbol
(`stripWorkshopWidgetRecommendationControl`, seven lines, whose only dependency is
`TRY_WIDGET_HEADING`); `WorkshopRunCompletion.ts` and `index.ts` take `inspect`/`strip`. Tim traced
the concrete consequence of the current placement: because the registry constants are eagerly
evaluated at module scope, the **webview's** module graph now reaches
`GesturePlaygroundRecommendation` → `LexicalGravityRecommendation` → `LexicalGravityConfigCodec` →
`LexicalGravityDirective` → `persistedValidation` in order to import a seven-line string function.
Both reviewers confirmed the closure is currently pure TypeScript with no present cost — and that
`webpack.config.js` produces two bundles with no size budget, so nothing would detect it changing.

What makes this a finding rather than a preference is the missing paperwork, and the contrast is
inside this same commit. ADR §7 requires documented deviations, and the ninth message module got the
full treatment: `docs/adr/2026-08-03-…:194-202` adds *"One Phase-6 deviation is accepted"* with a
written rationale, `ARCHITECTURE.md` gained the tree, and `boundaries.test.ts:915-925` pins the
nine-module listing exactly. The deviation that actually crosses layers got a `reason:` string in a
test allowlist.

**Recommendation:** Pick one and write it down. **Either** move the registry to
`application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.ts` beside its twin and
relocate `strip`/`sanitize` into `workshopWidgetRecommendationProtocol.ts` (three import sites;
presentation and infrastructure both go layer-clean), **or** keep `utils/` and add a second ADR §7
Phase-6 deviation bullet naming the cross-layer import and its justification, exactly as the
`settings.ts` bullet does. If keeping it, add the `utils/` boundary to `boundaries.test.ts` so the
next elevator is a decision rather than a drift.

---

### F-06 · 🟡 Standard — Three of four Lexical Gravity rejection branches have never executed

**Raised by:** Cal, Blake
**Discovery:** 1 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation.ts:104` — `if (!isLexicalGravityWeight(weight)) {`
**Affected contract:** test contract protecting the persona-supplied recommendation trust boundary

Searched all of `packages/` for `invalid_weight`, `invalid_reach`, `invalid_metaphor_pull`: three
hits in the parser, three in the protocol union, three in the writer-facing label map at
`WorkshopRunCompletion.ts:108-110`. **Zero in `__tests__`.**

`lexicalRecommendationFrame` is invoked exactly twice in the repository — the happy path
(`workshopWidgetRecommendation.test.ts:167`) and `lensSlug: 'falconry'` (`:180`) — inside one `it`
named *"accepts the closed Lexical Gravity prefill while leaving installation to the writer."* The
fixture crosses one of the four boundaries the word "closed" names. Weight is `'40'`, reach `'3'`,
metaphor-pull `'true'` — all interior values.

The mutation: delete `LexicalGravityRecommendation.ts:104-127`, all three guards. The happy-path
assertion still yields its seed; the falconry assertion still rejects at the lens gate. Suite green.
A persona-supplied `<weight>9999</weight>` then reaches `WorkshopLexicalGravityDraft`. Equally
undetectable: mispairing a label, e.g. `field: 'weight'` with `reason: 'invalid_reach'`, which flows
verbatim into `INVALID_WIDGET_FIELD_COPY` and tells the writer the wrong thing about their own
transcript.

The gap is **inherited** — the test file is unmodified by this MR. It belongs here because the MR's
stated safety evidence is green CI over 187 suites, and this is precisely the half of the migration
`tsc` cannot check: hand-copied marker arrays and hand-written rejection literals in a file that did
not exist before `9d47729`. Cal noted the asymmetry sharply: the +28-line `LexicalGravityConfigCodec`
test is genuinely good work — `[9, 11, 63, 101]` crosses minimum, step, and maximum — but it pins the
*predicates*. Nothing pins that the parser still calls them. The gesture arm, by contrast, is
exercised across seven distinct rejection paths.

**Recommendation:** Three lines in the existing `it` — `lexicalRecommendationFrame({ weight: '63' })`
→ `invalid_weight`, `{ reach: '4' }` → `invalid_reach`, `{ metaphorPull: 'yes' }` →
`invalid_metaphor_pull`, asserting the exact `{ field, reason }` pair. It converts the parser from
"moved and hoped" to "moved and pinned."

---

### F-07 · 🟡 Standard — An empty `<lens-slug>` is reported as the trust-boundary violation

**Raised by:** Sam
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation.ts:96` — `if (!BUILT_IN_LENS_SLUGS.has(lensSlug)) {`
**Affected contract:** operational (rejection telemetry) and writer-facing copy

`inspectExactWorkshopWidgetRecommendationFrame` blank-checks only the *between-field* gaps —
`boundaryGaps` takes markers at even indices (`workshopWidgetRecommendationProtocol.ts:126-130`), so
field *bodies* are never checked for emptiness. A persona emitting `<lens-slug>` immediately followed
by `</lens-slug>` clears frame validation; the field helper returns `''`; and
`BUILT_IN_LENS_SLUGS.has('')` is false.

| frame | result | writer sees | log line |
|---|---|---|---|
| empty `<lens-slug>` | `invalid_field / lensSlug / unsupported_lens` | "Lens named a lens that personas are not allowed to seed." | `reason=invalid_field:lensSlug:unsupported_lens` |
| `<lens-slug>falconry</lens-slug>` | identical | identical | identical |

The two are indistinguishable in both the writer notice and the summary log at
`WorkshopRunCompletion.ts:216-226`. That log key is the only aggregate signal for the one real trust
boundary in this diff, and it is now shared with the most ordinary malformed-frame case.

The sibling path disagrees: `GesturePlaygroundRecommendation.ts:121-128` checks `value.length === 0`
first and emits `reason: 'empty'`, which is declared in the shared union and has writer copy — but no
Lexical Gravity field can reach it. Two slices, one reason vocabulary, divergent semantics for the
same input class.

**Inherited** — ordering is unchanged from the base. This MR is the natural repair site because it
rewrote the function into a slice that now owns the gate alone, and because F-06 shows the pinning
that would have caught it is absent.

**Recommendation:** Add an emptiness pass before the value gates, matching the Gesture Playground
ordering: `[['lensSlug', lensSlug], ['weight', weightText], ['reach', reachText], ['metaphorPull',
metaphorText]].find(([, v]) => v.length === 0)` returning `reason: 'empty'`. Pairs naturally with
F-06's tests.

---

### F-08 · 🟡 Standard — `WorkshopGestureOpening` survived the rename pass `🎯 Consensus`

**Raised by:** Parker, Oliver
**Discovery:** 2 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts:17` — `export type WorkshopGestureOpening =`
**Affected contract:** maintenance / naming — the MR's declared thesis

The five contract renames are clean and complete; `WorkshopGesturePlayground*` is applied without a
survivor among them. This is about the sibling nobody put on the list.

The diff is unusually eloquent: it rewrites lines 19–20 — the two union arms *inside*
`WorkshopGestureOpening` — to the new fully-qualified names, and stops one line short of the
declaration header. The result, four lines apart in one file: `export type WorkshopGestureOpening =`
at `:17` and `export type WorkshopLexicalGravityOpening =` at `:22`. The short form propagates
through the same file's public shape (`gestureOpening` `:44`, `closeGesture` `:56`, `onCloseGesture`
`:39`) into `WorkshopApp.tsx:236`, where `onCloseGesture: gesturePlayground.consumeWidgetActionResult`
puts the abbreviation and the canonical name in one expression.

The 202 → 201 symbol audit was correct and this symbol is genuinely outside it — the audit scoped to
the `@messages` contract surface, and this type is presentation-internal. The audit was accurate; its
boundary was narrower than the MR's thesis. The declared standard is
*"Lexical Gravity is never abbreviated"*, and the sibling type obeys it on the very next line.

Oliver reached the same symbol from the other direction: it is a bare `WorkshopGesture*` name of
exactly the form this MR spent five renames eliminating, and the witness installed to prevent that
class recurring does not recognize the form (F-01).

**Recommendation:** Rename `WorkshopGestureOpening` → `WorkshopGesturePlaygroundOpening`,
`gestureOpening` → `gesturePlaygroundOpening`, `closeGesture`/`onCloseGesture` →
`closeGesturePlayground`/`onCloseGesturePlayground`. Three source files plus two test files,
compile-time only — the same *"`tsc` catches every miss"* argument that justified the other five.

---

### F-09 · 🟡 Standard — The doc-agreement witness computes an inventory, then asserts substrings instead `🧭 Corroborated Runway`

**Raised by:** Cal, Parker, Oliver
**Discovery:** 0 independent · 3 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:930` — `expect(document).toContain('shared/types/messages/workshop/');` and `:933` — `expect(document).not.toMatch(/\| \`useWorkshop\` \|/);`
**Affected contract:** documentation-agreement test contract; diagnosability of a new CI guard

The first half is strong: `messageModules` is read from disk via `readdirSync` (`:894`) and compared
to an exact nine-name list, so the module tree cannot drift unnoticed. The second half does something
different under the same test name.

**The computed inventory is never used against the documents.** Cal's mutation: both documents
publish the nine-name tree in machine-readable form (`ARCHITECTURE.md:267-275`,
`.ai/central-agent-setup.md:101-108`) and `ARCHITECTURE.md:81` publishes the count. Delete the
`settings.ts` row and change the count to "8 subdomain modules" — every assertion in the loop still
passes, because the directory string and the four hook tokens live elsewhere in the file. And
`settings.ts` is precisely the module added by an accepted human decision, so it is the row most
likely to be dropped in a future edit.

**The negative guard is inert against one of the two files it loops over.** Parker traced it:
`docs/ARCHITECTURE.md` uses markdown tables (14 rows matching `^| \`use`), so the regex is live there.
`.ai/central-agent-setup.md` has **zero** such rows — it documents hooks as an ASCII tree — so the
assertion can never fire against it. That file *does* contain the bare token in prose at `:154`
(*"retired `useWorkshop` facade"*), correctly. It is also redundant where it works: `:762-765` already
asserts the hook file is absent from disk, which is the fact that matters.

**When it fails, it fails opaquely.** Oliver measured the failure output: Jest's `toContain` string
branch prints the full received string with no truncation, and because both documents are anonymous
`string` bindings inside a `for…of`, the output contains **no filename**. `.ai/central-agent-setup.md`
is 43,669 characters. An engineer who renames a table row six months from now gets 43 KB of markdown,
a substring, and no indication which of two documents or which of five assertions tripped. This
deviates from the house style in this very file — `:946-949` wraps into a labelled object, and the new
inverted witness at `:729-733` deliberately asserts a three-key object precisely so its diff is
self-describing.

**Recommendation:** One line buys the agreement the name claims —
`for (const module of messageModules) { expect(document).toContain(module); }`, reusing the value the
test already computed. Then make failures name themselves: iterate
`[{ name: '.ai/central-agent-setup.md', text: agentGuide }, { name: 'docs/ARCHITECTURE.md', text:
architecture }]`, collect `missingDocReferences` as `` `${name}: ${token}` ``, and assert a labelled
object. Drop the negative regex — `:762-765` already owns hook retirement.

---

### F-10 · 🟡 Standard — Criterion 3, the ADR, and the witness state three different rules for one checked box

**Raised by:** Bria
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `.todo/epics/epic-workshop-architecture-refactor-2026-08-03/sprints/06-contract-test-doc-normalization.md:81` — `- [x] Generic modules import feature code only through approved closed registries.`
**Affected contract:** business/process — the epic's acceptance criteria and what "verified" means

Bria scanned every non-feature-path source file for imports of feature modules. Twelve generic
modules import feature code; roughly half through closed registries or closed dispatch. The rest
import a named feature module directly with no registry between — e.g.
`useWorkshopStandingDirectives.ts:14` imports `LexicalGravityDirective`, and
`MessageHandlerContracts.ts:36-37` imports `GesturePlaygroundService` and `LexicalGravityModelService`.
(`WorkshopHandler.ts` deliberately excluded — D3 owns it.)

The code is not wrong; the sentence is. `docs/adr/2026-08-03-…:227` states the rule as *"approved
closed registries as the only generic-to-feature **dispatch** points"* — read as *dispatch*, the tree
complies. The criterion generalized "dispatch" to "import," which composition roots and type-only
contracts were never meant to satisfy. The witness installed to certify it measures a third thing:
feature **vocabulary per line**. Searched `.eslintrc.json`, `boundaries.test.ts`, and the docs — no
import-direction check for generic→feature exists anywhere.

So criterion 3 is checked against a proxy, and by F-02 the proxy is switched off precisely where the
criterion lives: `utils/workshopWidgetRecommendation.ts` carries a whole-file approval.

**Recommendation:** Restate criterion 3 in the ADR's own words — *"generic modules **dispatch** to
feature code only through approved closed registries; direct imports are limited to composition roots
and type contracts"* — so the checked box matches what is true and what is checked. If "import" was
meant literally, that is a real gap needing an import-edge witness, not a vocabulary scan. Author owns
which reading was intended.

---

### F-11 · 🟡 Standard — The two new feature slices ship without the mirrored test files their siblings have

**Raised by:** Stan
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundRecommendation.ts:80` — `export function inspectGesturePlaygroundRecommendation(`
**Affected contract:** test / maintenance

`GesturePlaygroundRecommendation.ts` (220 lines) owns five per-field character bounds,
source-reference parsing, evidence-grounding normalization, and that widget's prompt copy.
`LexicalGravityRecommendation.ts` (150 lines) owns the `BUILT_IN_LENS_SLUGS` gate and the field
parser. Neither has a test file. All 485 lines of behavior coverage remain in
`__tests__/utils/workshopWidgetRecommendation.test.ts`, which this MR did not touch.

The convention is explicit — `.ai/central-agent-setup.md:675`, *"All tests in a separate dir mirroring
the source tree"* — and the sibling folder proves it: `__tests__/…/widgets/gesturePlayground/` already
holds `GesturePlaygroundConfigCodec.test.ts` and `GesturePlaygroundDirective.test.ts`, a 2-of-2 mirror
before this MR and 2-of-3 now. The same MR followed the convention for the *other* Phase-6 extraction:
when the value grammar moved into `LexicalGravityConfigCodec.ts`, its test moved too. Value grammar
got the mirror; prompt grammar did not.

Coverage is intact today — the cost is precedent. The next engineer extracting a widget slice finds
two files with neighbors and one without, and the one without is the newest, so it reads as the
current answer.

**Recommendation:** Split the feature-owned cases into
`__tests__/…/widgets/{gesturePlayground,lexicalGravity}/*Recommendation.test.ts`, leaving
heading/duplicate/ceiling/live-id/strip/sanitize with the registry. If keeping one suite is
deliberate, add it to the `ownedTests` array at `boundaries.test.ts:897-900` so the choice is recorded
where the next reader will look.

---

### P-01 · ✅ Praise — The migration is provably behavior-preserving, and the protocol seam is why

**Raised by:** Blake, Bria, Tim, Marcus, Patricia
**Discovery:** 1 independent · 4 runway-prompted
**Evidence:** `packages/core/src/utils/workshopWidgetRecommendation.ts:50-57` — `const CATALOG_ENTRIES = [GESTURE…, LEXICAL…]` / `const INSTRUCTION_ENTRIES = [LEXICAL…, GESTURE…]`

Four reviewers independently reconstructed the migration rather than trusting it, and the results
converge:

- **The assembled persona instruction is byte-identical.** Blake and Tim each rebuilt
  `WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION` from both revisions with real budget values: **4,789
  characters, 54 lines, `===` equal.** Bria diffed it element by element: 54 elements, zero
  differences, down to the em-dashes and the `.toLocaleString('en-US')` separators. Token delta zero.
- **That was not luck.** The original interleaved two *different* orderings — Gesture first in the
  catalog sentence, Lexical first in the instruction body. Preserving it required shipping two
  separately-ordered arrays over the same two entries. A single
  `Object.values(WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES)` would have been the obvious move and would
  have silently reordered ~3,800 characters of persona-facing instruction, changing model behavior
  with no test failing and no line-count evidence in the diff.
- **Everything else diffed clean.** Marker sets element-for-element identical; frame validation runs
  multiplicity → order → outside-frame → boundary-gap in the same sequence; `Number()` coercion
  untouched; `duplicate_heading` and `frame_too_long` identical including the pre-dispatch position of
  the ceiling check; **all 28 split value-export bodies byte-identical, none added or dropped.**
- **One behavioral delta exists and is honest:** `isRecommendationWidgetId` now rejects a
  live-but-non-recommendation id *before* frame validation, where the old code ran marker validation
  first. Unreachable today, and it fails closed in the safer direction.

**The structural reason it held:** feature slices import `workshopWidgetRecommendationProtocol` — one
import, a type module — and never the registry. The graph is `registry → slices → protocol →
@messages`, acyclic by construction rather than by discipline. Marcus verified *what* was put in the
protocol is the stable shared concept (marker vocabulary, the exact-frame primitive) separated from
the unstable one (the binding). It matters concretely: the registry destructures `catalogSummary` off
both entries at module-eval time, so a cycle would have been a `TypeError` on load.

**Carry this into Prose Controller:** put the shared frame grammar in the pure protocol module and let
the feature slice own only its marker array and field validation. That is the property that made a
394-out/520-in migration verifiable by hand.

---

### P-02 · ✅ Praise — The rejection failure trail is honest across four layers and survived the move

**Raised by:** Oliver
**Discovery:** 1 runway-prompted
**Evidence:** `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts:221-232` — `` `Widget recommendation ${unavailableWidgetSource ? 'rejected' : widgetRecommendation.outcome} ` ``

When `unsupported_lens` fires, four things happen and all four are truthful: the outcome is a
discriminated union carrying *why*, not a boolean; a structured log lands with the reason flattened to
`invalid_field:lensSlug:unsupported_lens` followed by a bounded dump of the offending response; the
writer gets a real toast with cause (*"named a lens that personas are not allowed to seed. Ask Jill to
try again."*); and `:237-239` catches the nastiest case — the frame stripped the whole tail and left
an empty turn — substituting explicit copy rather than a blank bubble. `outcome: 'absent'` logs and
toasts nothing, so "chose not to recommend" and "recommended and we rejected it" are genuinely
distinguishable in both directions.

Why it belongs in *this* MR: the migration moved every rejection producer into feature slices, and
this survived because the rejection *union* stayed in the pure protocol module while the generic
consumer maps it through frozen, index-checked copy tables — so a new field or reason added by a
future slice fails `typecheck` rather than falling through to generic copy. Structural exhaustiveness
on the diagnostic surface, not just the parsing one. The corroborating evidence is the strongest part:
the 19 `rejection:` assertions in `workshopWidgetRecommendation.test.ts` are **not in this MR's diff at
all**. A 900-line ownership migration validated by a test file nobody had to edit.

---

### P-03 · ✅ Praise — The `BUILT_IN_LENS_SLUGS` gate survived exactly, with defense in depth downstream

**Raised by:** Patricia
**Discovery:** 1 independent
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation.ts:96` — `if (!BUILT_IN_LENS_SLUGS.has(lensSlug)) {`

Patricia compared the gate against the base revision rather than assuming a move preserved it. Three
properties had to survive and all three did: **set contents identical** (same six slugs); **rejection
identical** (`unsupported_lens`, still mapped to unchanged writer copy); and **ordering identical, the
load-bearing part** — the lens gate still runs *first* among field validations, and whole-frame shape
validation still runs before any field is read. Field bodies are never interpreted before the envelope
is proven exact. The value grammar it leans on moved byte-identically.

She then traced the accepted seed downstream and found the gate is defense in depth rather than the
sole control: `lensSlug` is a *selector*, never a payload — the modal resolves it against the writer's
own catalog, the codec requires `resolvedLens.slug === lensSlug`, and the text that reaches a system
prompt is built from `draft.resolvedLens` with per-field truncation and
`neutralizeReservedPersonaPromptDelimiters` on every interpolation, under a hard budget throw. Install
requires the writer. **"Propose but never install" holds at the code level, not just the instruction
level.**

## What the Panel Changed About the Runway

**Affirmed.** The acyclic protocol seam (Marcus and Blake each verified it from the protocol module's
single import). The thesis that this sprint's real job is making claims checkable. The trust-boundary
identification in §10 — Patricia verified all three properties §10 demanded. The "do not overread"
list held: no reviewer wasted a finding on the split's size or re-litigated D3.

**Refined.** The runway's §13 named the right variable — *"a fitness function is only as good as the
candidate set it scans"* — and then dropped it, locating the remaining risk entirely in approval
granularity. Sam, Oliver, and Patricia put it back: the candidate *vocabulary* is the sharper blind
spot, and it is live today. The runway's §5 genealogy picked the wrong controlling precedent (Stan:
`WorkshopWidgetConfigOperations.ts` is the true sibling). Its §8 priced "layer purity vs registry
locality" high — three of four consumers need only pure helpers. Its §11 called the scale horizon "not
material," which is what let the hardcoded `two` through.

**Rejected.** **Q4 is not a defect, and the runway overweighted it.** Blake computed the ceiling at
15,300 characters; a maximum gesture frame is ~13,550 and a valid Lexical Gravity frame ~150. No valid
frame of either widget can be rejected, and no oversized LG frame can pass, because every LG field is
closed-set validated. Patricia and Sam reached the same conclusion independently. The runway's
`[Inferred]` guess in §15 — that the ~126-line surplus was boilerplate — was correct, and Blake proved
it rather than leaving it inferred. **The count in §2 and §15 was wrong:** 29 approval entries with 21
whole-file exemptions, not 28/20 (Parker and Cal each caught it; orchestrator re-verified).

**Still unknown.** Whether whole-file approval granularity was a deliberate choice with a rationale or
the path of least resistance while getting the witness green. Stan's evidence suggests deliberate and
internally consistent; F-02 shows it under-enforces either way. The author owns that answer, and it
determines whether F-02's repair is "fix an oversight" or "tighten an accepted tradeoff."

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A guard is only as sharp as the proxy it stands on

**Illuminated by:** F-01 (Oliver, Sam, Patricia); the runway's own §13 diagnosis

The old witness used *path* as a proxy for ownership, and the runway named its failure exactly: a
false generic has a generic path by definition. The inversion replaced it with *name* as a proxy for
semantics — a sharper proxy, and still a proxy, which is why three reviewers independently found
feature semantics sitting in modules that spell no feature name. Fixing a detector rarely removes its
blind spot; it relocates it, and the relocation is easy to mistake for closure precisely because the
old false negatives really are gone.

**Carry forward:** The moment a detector's selection rule changes, finish this sentence in writing
before merging — *"a violation this witness cannot see would look like ___"* — then spend ten minutes
hunting for one that already exists.

### Lesson — The exemption list is the guard, at whatever resolution it grants

**Illuminated by:** F-02 (Cal, Sam, Parker)

An allowlist is not a hole in a fitness function; it is the part of the function that says *not here*,
and its granularity sets the whole instrument's real resolution. Twenty-one whole-file entries are,
structurally, twenty-one small re-creations of the path rule the inversion was built to retire. The
narrow tier shows the same gap in miniature: an approval whose `reason` describes one token but whose
mechanism tests a whole trimmed line has documented one contract and enforced a wider one — and only
the wider one runs.

**Carry forward:** For each entry, complete *"tomorrow someone could add ___ to this surface and
nothing fails."* An entry you cannot finish that sentence for is drawn tightly enough.

### Lesson — Absences leave no diff, so they arrive without ceremony

**Illuminated by:** F-02 (Stan), F-05

Two findings here are shaped like nothing at all: a second witness that stood beside the precedent
registry and did not travel with the approval it accompanied, and a file that stayed in `utils/` while
its imports turned upward. Neither appears as a changed line, and neither drew the ritual this same
commit performed correctly for a deviation that *was* countable — the ninth message module
contradicted a number written in the ADR and got a rationale, a docs update, and an executable check.
Review attention follows changed lines, which makes the decisions that consist of not-changing the
ones most likely to travel alone.

**Carry forward:** When copying a pattern, list what stood *beside* the original; when leaving
something where it is, write the sentence you would have written for moving it.

### Lesson — Adjacency was doing work nobody assigned it

**Illuminated by:** F-03, F-04, F-07, F-09

Before the split, the widget count and the widget list were one literal string edited in one motion;
both features' field parsing shared a switch, so a sibling's empty-field check sat in peripheral
vision; the reserved delimiter names lived near the markers they reserved. None of that was a
mechanism anyone chose, and a move deletes it without leaving a line to review. What replaces it has
to be derivation or a test — and derivation applied to half of something is the worst of the three
states, because the fresh half now vouches for the stale one: a correctly derived list sits beside a
hand-written "two," and one witness computes a nine-module inventory from disk before asserting
hand-written substrings instead.

**Carry forward:** For each thing you move, ask what was keeping it true. If the answer is "it was
near the other thing," name its replacement before the move lands.

### Lesson — A module can import nothing from a feature and still be its warehouse

**Illuminated by:** F-01 (Sam); P-01

The structural achievement in this change is real and worth keeping: the split is acyclic by
construction rather than by discipline, because feature slices import a pure protocol module and never
the registry. But dependency purity and knowledge purity are different properties, and an import graph
can only see the first — that same protocol module holds both features' complete field and
rejection-reason unions while describing itself as feature-neutral in its own docstring. A file's
imports say who it depends on; its contents say who it belongs to.

**Carry forward:** For anything named shared, generic, neutral, or protocol, ask: *if this feature were
deleted tomorrow, would this file change?* If yes, it owns feature knowledge whatever its imports say.

> Building an instrument that can one day contradict you is a generous act, and worth noticing: every
> lesson above is reachable only because that instrument now exists to be argued with.

## Horizon Watchlist

Not merge blockers. Carried forward because the runway or the panel supported them and they will
matter before Phase 7 closes.

- **Allowlist entropy.** 29 approved surfaces today. Every feature family adds candidates, and nothing
  bounds growth or granularity drift. At ~40 entries, who reads it?
- **The gesture-derived frame ceiling.** `WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS` sums six
  `gesture*` budget keys and governs every widget. Blake proved it harmless at N=2 with three orders of
  magnitude of headroom. A third widget inherits a ceiling built from the first widget's fields, and
  `promptBudgets.ts` is currently whole-file approved with its twenty feature-prefixed keys invisible
  to the witness.
- **The assembled instruction has no budget key and no size test.** ~1,200 tokens on every persona
  system message, uncached, growing linearly with live recommendation-capable widgets.
  `.todo/tech-debt/2026-07-31-workshop-widget-recommendation-prompt-assembly.md` owns this and gates
  Prose Controller.
- **Closure by union vs closure by placeholder.** The recommendation registry's union-keyed closure is
  arguably stronger than the precedent's throwing placeholder for *dispatch*, but the precedent's
  registry is the sole membership source and this one is not (F-04). Worth settling before a third
  family makes the divergence permanent.
- **Bundle composition.** The webview reaches `application/services/` through the registry to import a
  seven-line string function. No present cost, and `webpack.config.js` has no size budget that would
  detect it becoming one.

## The Closer

⭐⭐⭐⭐ **Four stars.** I ordered the nine-course contract split and every course arrived exactly as
described — 4,789 characters of persona instruction plated identically to the kitchen's own
photograph, right down to an ordering asymmetry the sous-chef could easily have "corrected." The
complaint is the smoke detector the owner installed above the new stove and showed us proudly: it
listens beautifully for anyone shouting *"Lexical Gravity"* or *"Gesture Playground"*, and it is
mounted directly above three pans currently labelled `lensSlug`, `metaphor-pull`, and
`gesture_dictionary`. Would return, would eat here again, would very much like the detector to learn a
few more words before the third burner goes in.

## Final Assessment

**Nearly there.** The mechanical work is not merely fine, it is unusually well done: the contract split
is a verified move, the prompt copy is byte-identical across a three-file ownership migration, the
trust gate kept all three of its properties, and the pure protocol seam makes the whole thing acyclic
by construction. Nothing in the product is broken, and no finding here is Blocking.

What holds it short of merge-ready is that the sprint's *thesis* — that emptying the exception ledger
is safe because something is now looking — is not yet fully earned. F-01 and F-02 are both about the
instrument rather than the code, and both are small repairs: widen one regex, scope three approvals,
make `allowedLine` govern the token instead of the line, and add the copy-surface guard the precedent
already carries. Land those and the ledger's emptiness means what the PR body says it means. F-03
should ride along, because it is the same class with a security consequence and a third widget will
trip it. Everything from F-04 down is genuinely optional-before-merge, though the four-character fix in
F-04 costs less than reading this paragraph.

One process note worth keeping: the pre-implementation runway predicted this sprint's failure mode
correctly and in advance — *"an exception list is emptied, a document is updated, Phase 7 audits both,
and the discrepancy that survived is now certified."* It just aimed the guard at the previous blind
spot. That is not a failure of the runway; it is what runways are for, and the reason the panel could
find this at all is that someone built the instrument to be argued with.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ ·*
*Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
