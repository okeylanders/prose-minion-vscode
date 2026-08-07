# MR Review v2 — Lexical Gravity v2: interpretive grammar and application gears

**Author:** Okey Landers · **PR:** [#110](https://github.com/okeylanders/prose-minion-vscode/pull/110) · **Branches:** `sprint/conversation-widgets-02b-b-lexical-gravity-interpretive-grammar` → `epic/conversation-widgets`
**Reviewed head:** `dde10a41` · **Reviewed:** 2026-08-07 · **Mode:** Full (semantic runway + 10 specialists + Sensei)

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason ·
**Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise,
superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🔴 Blocking | `npx jest` red at head; 3 suites run zero assertions, one shelters a stale expectation | Blake, Cal | 1 independent · 1 runway-prompted | — | **Addressed** — all missing fixtures and the stale rail label corrected |
| F-02 | 🟠 High | Rebuilding a v1 lens named after a built-in destroys the file and hides the replacement | Sam | 1 runway-prompted | — | **Addressed** — built-in collisions refused before generation or write |
| F-03 | 🟠 High | Pre-v2 draft in a persisted session rejects the whole checkpoint; no repair path, no test | Blake, Cal, Stan | 1 independent · 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — strict ADR §6 policy documented beside the codec and pinned by tests |
| F-04 | 🟠 High | An invalid v2 lens file is invisible to the writer (`readLens` returns `{}` for two facts) | Oliver, Parker | 1 independent · 1 runway-prompted | — | **Addressed** — unreadable project files are writer-visible and non-rebuildable |
| F-05 | 🟡 Standard | Non-canonically-named v1 file gets a Rebuild button that can never succeed | Blake, Marcus, Bria, Sam | 4 runway-prompted | 🧭 Corroborated Runway | **Addressed** — non-canonical names surface as non-rebuildable file errors |
| F-06 | 🟡 Standard | `version: 1` is the sole predicate authorizing the only irreversible write | Patricia | 1 independent | — | **Addressed** — overwrite now requires recognizable v1 lens identity and shape |
| F-07 | 🟡 Standard | Widget drafts have no semantic-validation layer | Marcus | 1 runway-prompted | — | **Deferred** — forward-looking; decide before Prose Controller |
| F-08 | 🟡 Standard | Generation and validation envelopes disagree; neither prompt states the numbers | Tim, Sam | 1 independent · 1 runway-prompted | — | **Addressed** — prompts state bounds; build/preview ceilings cover validated output plus reasoning |
| F-09 | 🟡 Standard | Two persistence primitives invented widget-local | Stan | 1 runway-prompted | — | **Deferred** — one duplication may be the honest price; record against Prose Controller |
| F-10 | 🟡 Standard | Four independently-versioned things all spell themselves `2` | Parker | 1 runway-prompted | — | **Addressed** — lens, preview, and response-envelope clocks named independently |
| F-11 | 🔵 Nit | Weight scale recalibrated while the ADR asserts Weight's meaning is unchanged | Bria | 1 runway-prompted | — | **Addressed** — ADR records the five-band presentation recalibration |
| P-1 | 💚 Praise | Preview validity is a property of the (lens, preview) pair | Marcus | 1 runway-prompted | — | N/A — preserve |
| P-2 | 💚 Praise | Both empty states narrated in the writer's vocabulary | Parker, Bria | 1 independent · 1 runway-prompted | — | N/A — preserve |
| P-3 | 💚 Praise | Re-assert-before-publish atomic write | Stan | 1 independent | — | N/A — preserve |
| P-4 | 💚 Praise | Model→filesystem and model→webview boundaries held completely | Patricia | 1 runway-prompted | — | N/A — preserve |
| P-5 | 💚 Praise | Directive budget raise is measured, and the measurement is why it is defensible | Tim | 1 runway-prompted | — | N/A — preserve |
| P-6 | 💚 Praise | Preview rejection log pairs validator reason with an actionable remedy | Oliver | 1 independent | — | N/A — preserve |

### Remediation record — 2026-08-07

- **F-01:** Added `applicationMode` to every stale standing-directive/widget-opening fixture, including two additional rail fixtures found by the full suite, and kept the exact writer-facing summary assertion.
- **F-02 / F-05 / F-06:** Rebuild now requires a canonical, recognizable v1 lens and refuses a slug that collides with a built-in before model spend. Tests prove rejected files retain their bytes and no rename occurs.
- **F-03:** Kept the ADR's strict pre-v2 checkpoint policy. A v1 word field cannot be defaulted into honest v2 roles, axes, dynamics, and guardrails; current Lexical Gravity configs round-trip, while a pre-v2 draft's rejection is explicit and executable.
- **F-04:** Catalog reads now distinguish absence from refusal. Invalid or non-canonical project files reach the Library as `foundVersion: null`, show the validation reason, and expose no overwrite action.
- **F-08:** Both prompts state their validator ceilings. The three-candidate build budget is 24,000 output tokens, covering the measured ~20,000-token maximal valid envelope. Preview is 5,000 because [OpenRouter counts reasoning as output and maps low effort to roughly 20% of `max_tokens`](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), leaving room for the 12,000-character response envelope.
- **F-10 / F-11:** Named the independent lens, preview, and response-envelope version clocks; accepted the ADR and documented why the writer-facing Weight bands changed without changing Weight's domain meaning.
- **F-07 / F-09:** Remain deliberately deferred as recorded above; this remediation did not pre-empt the Prose Controller boundary decision.
- **Validation:** 189 Jest suites / 1,962 tests / 1 snapshot, all three TypeScript projects, quiet ESLint, production extension + webview build, bundle sentinels, and `git diff --check` pass. Interactive F5 acceptance and live billable model calls remain outside this remediation.

## Review coverage

- **Read fully:** `LexicalGravityConfigCodec.ts`, `LexicalGravityDirective.ts`, `LexicalGravityLenses.ts`, `LexicalGravityStandingDirectiveOperations.ts`, `WorkshopLexicalGravityHandler.ts`, `LexicalGravityModelService.ts`, `LexicalGravityLensRepository.ts`, `WorkshopLexicalGravityModal.tsx`, `WorkshopLexicalGravityLensLogic.tsx`, `WorkshopLexicalGravityPreviewReading.tsx`, `useLexicalGravity.ts`, `shared/types/messages/workshop/lexicalGravity.ts`, `promptBudgets.ts`, both `lexical-gravity` system prompts.
- **Read as siblings/callers:** `GesturePlaygroundConfigCodec.ts`, `GesturePlaygroundService.ts`, `WorkshopGesturePlaygroundHandler.ts`, `WorkshopSessionCheckpointNormalization.ts`, `WorkshopSessionStateV1.ts`, `WorkshopSessionStateV1Shape.ts`, `WorkshopSessionPersistenceCoordinator.ts`, `WorkshopSessionStore.ts`, `persistedValidation.ts`, `pathContainment.ts`, `AssistantToolService.ts`, `MarkdownRenderer`.
- **Diff reviewed:** all 34 changed files.
- **Tests:** all changed suites read; full `npx jest` executed against head; `npm run typecheck` executed.
- **Docs:** ADR 2026-08-01, ADR 2026-07-30, ADR 2026-07-31, sprint 02B-B, `CLAUDE.md`.
- **Not assessed:** interactive F5 acceptance in the Extension Development Host; live billable model calls (the sprint's costume-test criterion is therefore unverified by this review, as it is by the sprint).
- **Blast radius:** 34 files, +3115 / −318. One widget slice, one shared budget table, three architecture witnesses, two system prompts, and ~190 lines of documentation for an unrelated feature (context-cache token visibility, docs only).
- **Existing human review comments on the PR:** none.

---

# Part I — Semantic Runway

## Semantic Runway — Lexical Gravity v2: interpretive grammar and application gears

**PR:** #110 · **Author:** Okey Landers · **Branches:** `sprint/conversation-widgets-02b-b-lexical-gravity-interpretive-grammar` → `epic/conversation-widgets` · **Head:** `dde10a41`
**Evidence date:** 2026-08-07 · **Blast radius:** 34 files, +3115/−318. One Workshop widget slice (contracts, codec, directive renderer, model service, project-file repository, handler, four presentation modules, two system prompts), one shared budget table, three architecture witnesses, and ~190 lines of documentation for an unrelated feature.

**Runway thesis.** This change converts a lens from a *vocabulary* into a *theory of meaning*, and then makes the model's application of that theory an inspectable artifact the writer can audit. The `interpret`/`recompose` gear is the visible new control, but the load-bearing move is that a lens now declares roles, axes, and dynamics, and a Preview must position passage elements *into that declared structure* — so "vocabulary wearing a costume" becomes mechanically detectable rather than a matter of taste. A second, quieter job rides along: establishing how this codebase treats a writer-owned file whose format it has just obsoleted.

---

## 1. Working Definition & Real Job

**Literal code change.** `WorkshopLexicalGravityLens.version` goes `1` → `2` and gains a required `logic` object: `premise`, `attention.{foregrounds,backgrounds}`, `axes`, `roles`, `dynamics`, `guardrails` — every collection bounded 2–4 with per-field character budgets. `WorkshopLexicalGravityDraft` gains `applicationMode: 'interpret' | 'recompose'`. `WorkshopLexicalGravityPreview` stops being `{configKey, text}` and becomes a five-field structured artifact with cross-field nullity rules. The catalog read gains a third outcome — "incompatible resource" — and the repository gains its first writer-authorized overwrite of a user-authored file.

**Functional capability.** A writer can (a) inspect a lens's world-view before installing it, via the new Lens Logic panel; (b) choose whether the lens performs close revision or structural recomposition; (c) see *what the lens noticed* — element → role → axis position, the selected dynamic, the open entailment — beside the rewritten prose; and (d) rebuild a legacy v1 lens file in place without deleting it by hand.

**Business/operational problem.** [Declared, ADR:26-29] A word field "can tint a sentence without changing the reader's model of the scene." The prior widget could produce photography nouns sprinkled over unchanged staging and call it a photographic reading. The ADR names this the *costume test* (ADR:786-798). The problem is not that the output was bad; it is that the writer had no way to tell a genuine interpretive change from a lexical one.

**What the wording and structure emphasize.** The vocabulary is relentlessly semantic: `premise`, `entailment`, `narrativeAffordance`, `openEntailment`, `significance`. The lexical machinery still exists but has been demoted in the UI copy to a "lexical realization layer — deterministic scaffold" and in the directive to a section that renders *after* the grammar. [Observed] `WorkshopStandingDirectiveService.test.ts` now asserts the ordering explicitly: `frames[0].indexOf('Interpretive premise:')` must be less than `indexOf('Degree 1:')`. Ordering has been promoted to a tested contract, which is the clearest signal of what the authors believe the change is about.

**What it suppresses.** Nothing about consequence is quantified. The sprint doc repeatedly refuses a "consequence meter, score, or persisted scene-charge ledger" (sprint:146-150). Weight, reach, and metaphor pull are each explicitly re-stated as *not* stakes values. The design is deliberately withholding a number the domain seems to invite.

**What must survive any valid alternative.** The model may never invent a prop, secret, intention, relationship, or plot event. The writer's v1 file must survive a failed rebuild byte-for-byte. A lens that cannot map honestly must be permitted to do nothing.

**A credible competing interpretation.** One could read this MR as primarily *prompt engineering with a type system bolted on* — the gear is enforced only by prose in two prompt strings, and nothing structurally distinguishes an `interpret` output from a `recompose` one. On that reading, the 260 new lines of validation buy consistency of the *reported map* while the actual prose transformation — the thing the feature is for — remains entirely on trust. This reading is not wrong; it identifies the real seam. But it undervalues what the validated map does: by forcing the model to name which passage element occupies which declared role before it writes, the design uses the artifact as a *lever* on the prose, not merely a receipt for it.

> This MR is not merely adding a `logic` object and a gear toggle. Its real job is to make the model's interpretation a declared, validated, writer-auditable artifact — so a lens can be held to its own theory — while preserving the writer's ownership of their prose, their scene facts, and their files.

---

## 2. Declared Intent, Observed Behavior & Open Meaning

**Aligned.** The strict v2 grammar, the Lens Logic inspector, the preview reading UI, the gear, and the rebuild flow all exist as described. The semantic no-op is genuinely first-class: empty `semanticPositions` forces a null dynamic, which forces a null entailment (`LexicalGravityConfigCodec.ts:213-232`), and the UI states it affirmatively — "That is a valid result."

**Gaps between declared and observed.**

- [Observed] The PR body lists `npm test -- --runInBand` among completed validation. Three test suites currently fail to compile against head (`WorkshopStandingDirectiveHandler.test.ts`, `useWorkshopWidgetOpening.test.ts`, `useWorkshopStandingDirectives.test.ts`), all on the newly required `applicationMode`. `npm run typecheck` genuinely passes, because the typecheck projects do not cover `packages/core/src/__tests__`. The claim and the artifact disagree, and the reason they disagree is itself informative.
- [Observed] The v1 preview prompt required preserving "approximate length, and sentence count." V2 requires only "approximate length," and a new architecture witness *asserts the phrase is absent*. This loosens the contract for `interpret` as well as `recompose`, and neither the ADR nor the sprint doc records it.
- [Observed] `weightLabel` was recalibrated: "forward" now begins at 36 rather than 55, and two new bands (`insistent`, `saturating`) appear. The ADR insists Weight's *meaning* is unchanged; the writer-facing scale nonetheless moved.
- [Observed] The ADR's status line still reads `Proposed` while the sprint records the gate lifted and the work landed.

**Resolved on inspection.** The sprint doc warns "Do not simply raise the standing-directive budget until the renderer proves the required bound," and `lexicalDirectiveCharacters` moves 3,000 → 16,000. The proof exists: `LexicalGravityConfigCodec.test.ts:149-225` constructs a maximal valid v2 lens and asserts the rendered frame is `> 12_000` and `<= 16_000`, and `assertLexicalGravityLensRenderable` enforces the bound on every lens at validation time. This is a measured bound with ~4k headroom, not a speculative raise.

**Unknown.** Whether the F5 acceptance pass — including the sprint's own "remove the conspicuous photography words and see if the reading survives" criterion — has been run. The sprint status still reads "F5 acceptance pending."

---

## 3. Business Story & Rulebook

**Actors.** The *writer* is the only decision-maker: they choose the lens, the gear, the three dials, and — newly — whether to destroy one of their own files. The *passage* is the subject, and the modal copy is emphatic that this is "a knob on the **work**, never on the participant." The *model* is a constrained interpreter with an explicit right to refuse. Workshop *personas* are excluded by the sprint's out-of-scope list; notably, `WorkshopLexicalGravityRecommendationSeed` carries `lensSlug`, `weight`, `reach`, and `metaphorPull` but **not** `applicationMode` — a persona may propose a lens and its dials, but not the gear.

**Rules newly encoded.**

- A lens declares 2–4 each of axes, roles, dynamics, guardrails, foregrounds, backgrounds. Ids are lowercase kebab-case and unique *within their collection* — an axis and a dynamic may share the id `focus`.
- Axis poles are a distinct 2-tuple, compared case-insensitively.
- A Preview may declare at most 6 positions; each `roleId` must be declared by the resolved lens, `axisId`/`axisPosition` are both-or-neither, and `selectedDynamicId` must be declared or null.
- Empty positions ⇒ null dynamic ⇒ null entailment. The converse is unconstrained: positions with no dynamic is a legal "reading without a move."
- Exactly one generated take may replace a v1 file — enforced in the handler *and* collapsed in the UI's candidate toggle.
- A lens is invalid if its worst-case directive frame would exceed the prompt budget. Prompt-renderability is now a *validity* condition of a persisted resource.

**Value created.** The lens becomes inspectable before install and after preview, so the costume test moves from the author's intuition to the writer's screen. The gear yields a genuinely second product from the same reading. Legacy lenses become recoverable in place.

**Harm prevented.** Invented scene facts (prompt + directive + per-lens guardrails + a legitimate no-op). Writer file loss (validate → temp write → re-assert → rename; original preserved on any failure). Silent format drift (the model literally cannot emit a lens the repository would refuse).

---

## 4. Narrative Flow: Beginning, Development, Turn & Ending

**Beginning.** The writer opens the modal. Five controls now, not four. Beneath the picker, a Lens Logic panel renders the chosen lens's premise in quotation marks and tabs through Attention / Axes / Roles / Dynamics / Guardrails. Alongside the installable lenses sit greyed `v1` tiles: "word field only — not installable."

**Development.** The writer sets gear, weight, reach, metaphor pull; any change calls `invalidatePreview()`, because `applicationMode` is now part of `configKey`. They request a Preview. The host validates the draft *before* spending a model call, stamps `configKey` and `sourceText` itself, and sends the lens as quoted task data. The model returns a sentinel-framed JSON composite. The host extracts the frame, parses it, exact-keys it, and then re-runs the *entire persisted-draft codec* over the result — including referential checks that the cited role, axis, and dynamic ids are ones this lens actually declares.

**The turn — and there are two, different in kind.**

The *soft* turn is the gear. Interpret and recompose license different violence against the passage from the same semantic reading, and flipping the switch invalidates the cached preview. Nothing is destroyed; a preview is discarded.

The *hard* turn is `rename(temporary, destination, { overwrite: true })` in `replaceIncompatibleForQuery`. Everything before that line is recoverable — validation, the temp write, and two separate re-assertions that the target is still a v1 file. After it, the writer's original bytes are gone, with no backup and no undo. This is the only irreversible act in the feature, and the implementation is visibly aware of it: the UI states the atomicity guarantee to the writer in plain language before they commit.

**Ending.** On Apply, the draft — including its full `resolvedLens` and cached preview — enters session state, and the standing directive is regenerated with the interpretive grammar rendered ahead of the lexical anchors, an explicit application-order instruction, and a gear paragraph. The directive stays dormant during analysis and conversation and wakes only when prose is composed or revised.

**Unresolved threads.** Two generated takes are discarded silently on a rebuild save. A second Build for the same subject silently returns the existing lens rather than fresh takes. A v2 project lens that fails validation is a logged skip the writer never sees — visible on disk, absent from the picker, with no message.

---

## 5. Codebase Genealogy & Controlling Precedent

**Closest ancestor: Gesture Playground.** Every file here has a Gesture twin at the same depth — codec, directive, model service, handler, hook. This is siblinghood by construction, not resemblance: ADR 2026-07-31 names Gesture "an appropriate first-widget implementation" and Lexical Gravity "the next committed widget," and extracted the widget-config ledger precisely so the second widget would not copy the first's shape into shared modules.

**The controlling precedent, and the deviation.** Gesture faced this MR's exact problem twice: a widget draft gaining a newly required field. Its answer, in `GesturePlaygroundConfigCodec.ts:48-53`, is to declare the new fields **optional** at the shape boundary with an explicit comment — "Both fields joined the evolving development checkpoint after the first Gesture drafts. Hydration supplies safe defaults before current integrity is enforced" — and then default them in `normalizeGesturePlaygroundDraftForHydration`, recorded as the named repairs `defaulted-widget-dictionary-sharing` and `defaulted-widget-source-references`.

This MR takes the opposite route for the same class of change: `applicationMode` joins the **required** set, `preview.sourceText` moves from optional to required, and `preview` gains four more required fields. `WorkshopSessionCheckpointNormalization.ts` is untouched and still branches only on `widgetId === 'gesture-playground'`.

**Is the deviation justified?** [Declared] Yes, explicitly: ADR §6 states "Pre-v2 development session snapshots are likewise not a supported persistence contract," and `CLAUDE.md`'s alpha guidance says breaking changes are free. ADR 2026-07-30 permits both routes and does not say which a required-field addition demands. So this is a distinguishing fact the authors stated, not an oversight. What the record does *not* contain is the writer-visible consequence of choosing it — which the panel can now supply.

**Conflicting authority worth naming.** Two atomic-write idioms now exist (`WorkshopSessionStore` vs. this repository, the latter uniquely re-asserting its precondition between write and publish); two path-guard idioms (shared `isPathWithinRoot` vs. a bespoke basename/slug round-trip); two sentinel-frame idioms (a private `extractFrame` here, inline marker detection in Gesture's handler).

**New precedent most likely to be copied.** Prose Controller is pre-declared with five throwing placeholder methods in the standing-directive registry — it will be filled by copying this widget. The most copyable artifacts are the atomic temp-write/assert/rename dance, the sentinel-frame extractor, the `latestBuild` correlation slot, and three generic validators (`assertUniqueBoundedStrings`, `assertCollectionLength`, `assertNullableBoundedString`) that currently live inside a widget-local codec despite being entirely widget-agnostic.

---

## 6. Structural & Causal Map

Four webview→host routes live in the widget's own handler; only `SAVE_LENSES` is registered as a guarded session mutation. A fifth doorway — Apply — bypasses this handler entirely and enters through the shared standing-directive transaction. So the widget has two independent entries into the host: its own IPC slice for catalog and model work, and the generic transaction for installation.

```
Catalog:  list() ──> three-way classification
            ├─ version===1  ──> incompatibility record (file untouched)
            ├─ valid v2 + slug===filename ──> lens
            └─ anything else ──> logged skip (invisible to the writer)

Preview:  draft ──> validate ──> model ──> extractFrame ──> JSON.parse
            ──> exactObject(5 keys) ──> validateLexicalGravityDraft(whole draft)
            ──> referential check against THIS draft's resolvedLens

Rebuild:  assertIncompatibleResource ──> buildLenses ──> latestBuild{rebuildResourceName}
            ──> save(exactly 1) ──> validate ──> temp write
            ──> assertIncompatibleResource AGAIN ──> rename(overwrite:true)
```

The structurally novel move is that **preview validity is not a property of the preview object; it is a property of the (lens, preview) pair.** The validator is parameterized by the resolved lens in the same draft.

A second notable inversion: the codec imports the *directive renderer*, because `assertLexicalGravityLensShape` calls `assertLexicalGravityLensRenderable`. Prompt-renderability has been folded into structural validity. This makes an unrenderable lens unrepresentable — no mid-conversation "directive too long" surprise — at the cost of building a full worst-case frame for every lens on every catalog read, up to the 200-file ceiling.

**Failure translation is deliberately asymmetric.** Model failures collapse to one generic sentence for the webview while the real reason and a bounded body dump go to the LogSink. Repository failures are forwarded to the writer verbatim. The asymmetry is defensible — model response bodies are untrusted text that must not be rendered into a webview — but it means a *systematically* failing lens is indistinguishable from a transient one without opening the Output panel.

---

## 7. Contracts, Invariants & Negative Space

**Invariants asserted.** `draft.lensSlug === resolvedLens.slug`. Preview ids ⊆ lens-declared ids. `preview.configKey` equals a freshly recomputed five-value key. Every persisted lens renders within budget. A rebuilt lens's slug equals its filename's basename, preserving the catalog's slug/filename agreement.

**Preconditions for the one destructive act.** Single-root workspace; filename passes the basename/slug round-trip; the target still parses as `version === 1`; exactly one candidate selected; the candidate validates under the filename-derived slug.

**Postcondition.** The old bytes are gone. There is no backup and no in-app undo.

**Negative space — deliberately not in scope.** Multi-lens blending (Sprint 04). Prose Controller. A consequence meter, score, or scene-charge ledger. Any change to persona identity, expression calibration, or conversation behavior. Automatic or unprompted migration of writer-owned v1 files. Do not manufacture findings in these areas.

**Not a contract.** Nothing structurally distinguishes an `interpret` result from a `recompose` result. The gear is enforced by prose in exactly two places: the preview system prompt and one paragraph of the directive frame.

---

## 8. Forces, Tensions & Design Tradeoffs

**One codec, two consumers — the central bet.** The same grammar validates a file the writer owns and a payload a stochastic model produced. This buys a single definition of "a valid lens," and it means the model cannot emit something the repository would refuse. The cost is that the two populations have different failure economics: a model failure is cheap and retryable; a disk failure means a file the writer authored is now unloadable — and lands in the silent-skip bucket.

**Strictness vs. model variability.** Fail-closed everywhere: sentinels must bracket the body exactly, `exactObject` rejects unknown keys, Build demands exactly three candidates with distinct variants, one bad `roleId` invalidates an entire preview. There is no coercion or repair anywhere. This is consistent with the project's stated posture — deterministic code validates, the model judges — and the exchange is a higher per-attempt failure rate concentrated on weaker models, surfaced to the writer as a single generic retry line.

**The semantic no-op is what makes strictness humane.** Without a legal way to say "this passage offers no honest mapping," maximal strictness would pressure the model toward invention — the exact harm the feature exists to prevent. The no-op is the release valve, and it is enforced in the codec rather than merely requested in the prompt.

**Precision about what a machine can check; silence about what the feature is for.** The validation is exact about the semantic *map* and says nothing about the prose *transformation*. That asymmetry is honest — you cannot type-check "this recomposition enacts the dynamic" — but it means the feature's central claim rests on prompt text and writer judgment.

**Alternate constructions.**
- *Separate wire codec from disk codec.* Independent strictness dials; a place for model-quirk tolerance that does not weaken the persisted contract. Costs a second definition to keep in sync and the guarantee that model output is directly persistable. The single-codec choice looks like the right first bet for alpha.
- *Rename-aside instead of overwrite.* Move the v1 file to a `.v1.json` sidecar before publishing, buying an undo for the only irreversible act. Costs a new orphan-file class the catalog must classify.
- *Persist the rebuild intent rather than holding it in `latestBuild`.* Survives a window reload; costs trusting a webview-supplied filename on the write path, which the current design deliberately refuses.
- *Version-negotiated v1/v2 union.* Explicitly rejected by ADR §6. Worth recording that this rejection is precisely what makes the whole incompatibility-and-rebuild apparatus necessary.

---

## 9. Failure, Recovery & Operational Truth

**The rebuild path is the best-engineered failure story here.** Validate → temp write → re-assert the precondition → rename → delete temp on any failure. A dedicated test asserts the legacy bytes survive a failed replacement. The residual TOCTOU window between the second assertion and the rename is narrow, and the code is honest that it is a check rather than a lock — there is no lock primitive available through the `FileSystem` port.

**The session-hydration path is the sharp edge.** `assertLexicalGravityDraftShape` runs inside `assertWorkshopSessionStateShape`, which `parseWorkshopSessionStateV1` executes *before* any normalization. Traced to both call sites:

- **`openNamed`** — the throw rolls back and rethrows. A named session containing a pre-v2 Lexical Gravity draft cannot be opened at all.
- **`initialize`** (current/autosave checkpoint) — the throw is caught and logged, `currentCheckpointError` is set, rolling autosave is paused, and Workshop starts from an empty room. The on-disk checkpoint is deliberately protected from overwrite, so nothing is destroyed — but the room does not come back, and the only explanation is in the Output channel.

Both are reachable only if such a checkpoint exists. Conversation Widgets have not shipped, and the ADR declares pre-v2 snapshots unsupported. Whether any such checkpoint exists locally is [Unknown] and is the question that sets the severity.

**Degradation elsewhere is graceful.** A `list()` throw falls back to six built-ins with an error string; the writer keeps working. Preview and Build each hold one AbortController and abort the prior run. Save is the only write path and is not abortable.

---

## 10. Security, Trust & Misuse Surface

The trust boundary that matters is *model output → local filesystem*, and it is held well. Model responses are treated as untrusted throughout: quoted as task data in the user message, never echoed to the webview, bounded before parsing, exact-keyed after. The rebuild target is never taken from the model — it is a webview-supplied filename that must survive a basename/slug round-trip (`name === path.basename(name)` and `lexicalGravityLensSlug(slug) === slug`), which rejects traversal, hidden files, and uppercase alike. The candidate's own `slug` is *overwritten* with the filename-derived slug before writing, so a model cannot choose where its output lands.

One reachable oddity: a file containing `version: 1` short-circuits *before* validation, so a `version: 1` file with otherwise arbitrary content becomes a "rebuildable" resource, and `legacyRebuildQuery` will lift its `originQuery` or `name` string into the build subject. The string is bounded and enters the prompt as quoted JSON task data, so the exposure is prompt-content, not code execution — but it is the one place where unvalidated file content reaches a model call.

Repository error messages are forwarded to the webview verbatim; they are host-authored and interpolate only the validated `safeName`, which is worth keeping true as the file grows.

---

## 11. Data, Time, Scale & Concurrency Horizon

**Prompt weight.** The standing directive rides *every* prose-composing turn, and its ceiling moved 3,000 → 16,000 characters with a measured ~12k worst case. The per-directive bound is enforced twice over. What no bound covers is the *aggregate*: two standing directive families in one room, plus pinned context, plus prior turns. The standing-directive family enum already anticipates `prose-controller`.

**Catalog scale.** `list()` reads up to 200 files, validating each — and validation now renders a worst-case 16k directive per file. The 200-file truncation is a silent `.slice()`.

**Concurrency.** One `latestBuild` slot means a second Build discards the first's unsaved candidates, while the modal tells the writer "Unsaved takes stay available until you close this sheet." Two concurrent saves of disjoint candidate ids both pass the expiry guard, because `savedCandidateIds` is mutated only after the await; the create-only `overwrite: false` rename makes the loser fail and roll back, and the UI's `savingCandidates` flag is what actually prevents the case.

**Blending is the horizon that presses hardest.** Preview ids resolve against exactly one `resolvedLens`, and ids are unique only *within* a collection — two blended lenses may both declare `focus`. The `configKey` is five scalars joined by `|`, bounded at 256 characters, and assumes one lens. This MR did not foreclose blending; it chose the coordinate system blending will have to live in.

---

## 12. The Change Genome: Variation & Reproduction

**Cousin: lens blending.** Axis varied — exactly one: resolved-lens cardinality per draft, one → many. Same widget, same grammar, same five gears, same storage, same protocol.

| Contact point | Class |
|---|---|
| Message payloads (`preview`, `apply`, `saved`) | **Reuse** — lens-shaped but not lens-count-shaped |
| Standing-directive family registry | **Reuse** — a blend is still family `lexical-gravity` |
| Directive frame renderer | **Extension** — two premises, up to 8 of each collection, plus a reconciliation instruction the frame has no vocabulary for |
| `assertLexicalGravityLensRenderable` | **Extension** — budget validation must move from lens-time to draft-time; a lens that passes alone can fail in a blend |
| `configKey` | **Extension** under a hard bound — 256 chars was chosen for one slug |
| `draft.lensSlug` + `resolvedLens.slug` cross-check | **Contradiction** — singular by construction |
| `roleId`/`axisId`/`selectedDynamicId` resolution | **Contradiction** — the strictest and most valuable rule in the PR is exactly the one that does not survive the axis change |
| Repository filenames | **Fork** — a blend is a draft composition, not a file |
| Codec tests | **Fork** — they assert singular-lens invariants directly |
| The modal's `contrast` picker | **Premature-generalization risk, inverted** — it already models "a second lens" for the substitutions table; the pressure will be to make it load-bearing |

**Verdict.** This MR creates a **generative pattern for one lens** and a **deliberately narrow special case with respect to many**. That is the honest trade: narrowness here is not immaturity, it is the reason the referential validation can be strict at all. But the panel should notice that the feature's best idea and its least extensible one are the same idea.

**Inversion.** If the host sent the lens's declared ids as an enumerated menu and asked the model to fill slots rather than free-form its own positions, hallucinated ids would become unrepresentable and `lexicalPreviewPositions: 6` would be derivable from `roles.length` rather than a separate constant that can disagree with it. The cost is that the honest no-op becomes harder to express and the model loses the freedom to report the same role twice.

**Deletion.** Remove `applicationMode` entirely and what breaks is: one UI switch, one directive paragraph, one `configKey` segment, one enum, one summary field, one test. Nothing in storage, the repository, or the lens grammar. That is a genuinely clean seam — the gear is orthogonal, which is a compliment to its design and also the reason its absence from the recommendation seed is a question rather than a bug.

**Time-lapse.** By the fourth widget: the atomic-write dance and the sentinel-frame extractor have been copied at least once each; `latestBuild` has been copied *and diverged*, because some widget will want more than one outstanding build; and `PROMPT_BUDGETS.workshopWidgets` — already 40+ `lexical*` keys in a flat interface — has someone proposing per-widget nesting.

---

## 13. Comparative Models & Borrowed Vocabulary

**Internal parallel — Gesture Playground's optional-field normalization.** The strongest and most decision-relevant comparison in this review, treated in §5. It contributes the question: *when a widget draft gains a required field, is "optional key + named hydration repair" the house rule, or was it a one-time accommodation?*

**Software parallel — Design by Contract.** [Analogy] The useful distinction it imports is between a *precondition the caller must meet* and a *frame condition the operation must not disturb*. `replaceIncompatibleForQuery` is unusually explicit about both: its precondition (still v1) is asserted twice, and its frame condition (the old file survives any failure) has a dedicated test. Contributed question: does any other write path in this repository state its frame condition as clearly, and should the session-decode path state one?

**Cross-industry — chain of custody.** [Analogy] The lens file is evidence with provenance: `originQuery` records the subject that produced it, `source: 'project'` records its authority, and the filename is its identity. The rebuild flow deliberately preserves identity while replacing content. Contributed question: after a rebuild, can a writer reconstruct what the file used to be? Today the answer is no — the custody chain records the new artifact but keeps no trace of the one it replaced.

Discarded as decorative: biology/evolvability (the Change Genome section already does that work in plainer language), and aviation envelopes (the operational envelope here is a character count, not a flight regime).

---

## 14. Creative Counterfactuals

**Constraint swap.** If project lens files had to remain readable by *both* v1 and v2 code — say, because a companion tool consumed them — the whole incompatibility apparatus would collapse into a required additive migration, and `logic` would have to be optional-with-default. The fact that this constraint does *not* apply is what earns the clean break; it is worth checking that nothing outside this repo reads `prose-minion/lenses/*.json`.

**Boring alternative.** The least clever implementation satisfying the invariants: keep Preview as prose, add a separate optional "explain what you noticed" call, and leave the lens as a word field plus a free-text `premise` string. It would deliver most of the writer-visible inspectability at a fraction of the validation surface — and would fail the one thing this design actually achieves, which is that the reported map and the rewritten prose are guaranteed to come from the same model turn under the same declared vocabulary.

---

## 15. Evidence Confidence & Unresolved Questions

**Repository-grounded (high confidence).** The full diff; the codec, repository, handler, model service, directive renderer, and presentation modules read directly; the Gesture Playground sibling; the session decode and both hydrate call sites; `npm run typecheck` passing and three jest suites failing to compile, with exact TS errors captured; the worst-case directive measurement in the codec test.

**Material inferences.** That the `configKey` equality check is tautological on the model path and load-bearing only on the persisted path. That total-rejection preview semantics concentrate failure on weaker models. That the silent-skip bucket becomes more populated now that the codec is stricter.

**Competing interpretations left open.** Whether this MR is best read as a semantic-grammar change with prompt enforcement, or as prompt engineering with a validation shell. Both readings survive the evidence; §1 states the case for the first.

**Missing artifacts.** No F5 acceptance record. No measurement of Build/Preview *validity rate* under the v2 grammar against the models Workshop actually offers — the prompt-budget measurement exists, but response-validity is a different number. No evidence about whether any local session checkpoint contains a pre-v2 Lexical Gravity draft.

**Needs author or product confirmation.** The dropped sentence-count promise; the weight-label recalibration; whether personas should be able to seed the gear; whether the context-cache documentation belongs on this branch.

---

## 16. Past → Present → Horizon Synthesis

**Past.** A first widget (Gesture) established the slice shape, the codec primitives, and — twice — a house answer for drafts gaining required fields. A refactor epic froze feature work until the responsibility map closed; this is the first feature to land after the thaw. The lens itself began as a word field sized for a 3,000-character directive, and the sprint was written specifically to fix the representation *before* a third widget copied it.

**Present.** The lens becomes a theory rather than a vocabulary, and the model's application of that theory becomes an artifact the writer can read. Strictness is pushed as far as it goes and then given a release valve — the honest no-op — so that rigor does not become pressure to invent. The one irreversible act in the feature is wrapped in more care than anything else in the diff. Two things are left on trust: that the prose actually enacts the reported map, and that no writer is holding a session checkpoint the new codec will refuse.

**Horizon.** Prose Controller will be built by copying this slice, which makes the widget-local placement of four genuinely generic helpers a decision with a shelf life. Blending will collide head-on with single-lens id resolution — the feature's best rule and its least extensible one being the same rule. And once this ships, `prose-minion/lenses/*.json` becomes a writer-owned format on disk, at which point the incompatibility-and-rebuild machinery built here stops being overhead and starts being the thing that lets a v3 exist at all.

---

## 17. Runway Synthesis Brief

**Invariants the implementation must preserve.**
1. A writer's v1 file survives any failed rebuild, byte for byte.
2. The model may never invent a prop, secret, intention, relationship, or plot event.
3. A lens that cannot map honestly may produce a semantic no-op rather than inventing.
4. Preview ids are meaningful only against the lens in the same draft.
5. A persisted lens must always render within the directive budget.
6. Round-trip persistence reconstructs the exact v2 standing frame.

**Anchors.** `LexicalGravityConfigCodec.ts` (validation grammar; `assertLexicalGravitySemanticPositions`, `assertSelectedDynamic`, `lexicalGravityConfigKey`) · `LexicalGravityLensRepository.ts:137-175` (the overwrite) and `:256-268` (the name guard) · `WorkshopLexicalGravityHandler.ts:157-240` (`latestBuild`, rebuild correlation) · `LexicalGravityModelService.ts` (frame extraction, codec round-trip) · `LexicalGravityDirective.ts` (frame order, gear paragraph) · `WorkshopSessionStateV1Shape.ts:353` and `WorkshopSessionCheckpointNormalization.ts` · `GesturePlaygroundConfigCodec.ts:48-53` (the precedent) · `promptBudgets.ts` (3,000 → 16,000).

**Tensions (real tradeoffs, not disguised defects).** One codec serving disk and wire. Fail-closed strictness against stochastic output. Narrow single-lens precision against a declared blending future. Validation precision about the map paired with silence about the prose. Widget-local placement of generic helpers, one widget before the duplication becomes visible.

**Unknowns.** Whether any local checkpoint holds a pre-v2 draft. Whether F5 acceptance ran. Build/Preview validity rate under v2. Whether reasoning tokens count against the preview's 3,600 ceiling. Whether anything outside this repo reads the lens files.

**Legitimate variation points.** Gear semantics per lens. Additional lens `logic` collections. Per-widget budget nesting. Blend id qualification. Backup-on-rebuild policy.

**Predicted pressures.** *Near:* the session-decode question; the aggregate directive budget in a long room. *Middle:* Prose Controller copying this slice; blending colliding with single-lens id resolution. *Far:* the lens file as a published writer-owned format with its own version discipline.

**Questions for the panel.**
1. What is the intended writer experience when a persisted session holds a pre-v2 Lexical Gravity draft, and is the Gesture precedent (optional key + named normalization) the house rule or a one-time accommodation?
2. The PR body lists `npm test` as completed validation; three suites fail to compile on the new required field while `typecheck` passes because it excludes `__tests__`. Is the coverage gap between those two commands worth closing?
3. Is total rejection of a preview containing one undeclared `roleId` the intended contract, or would per-position drop-with-notice better serve the feature's meaning?
4. Should a v2 project lens that fails validation stay a silent logged skip, now that the codec is strict enough for a hand-edited file to land there?
5. A v1 file whose name is not a canonical slug is cataloged as incompatible — and therefore shows a "Rebuild and overwrite" button — but `incompatibleResourceName` will reject it. Is that button reachable?
6. Built-ins shadow project lenses on slug collision. If a writer rebuilds a v1 `photography.json`, does the result become invisible?
7. Do `handleBuild`'s unconditional replacement of `latestBuild` and the modal's "unsaved takes stay available" agree about what a second Build does?
8. Should the four generic validators and the sentinel-frame extractor move to shared ground before Prose Controller, or is one more duplication the honest price of not generalizing early?
9. Is there any aggregate ceiling on combined standing-directive content in one prompt, or is the per-directive 16,000 the only bound?
10. Should the ADR move from `Proposed` to `Accepted`, and do the dropped sentence-count promise and the recalibrated weight labels belong in it?

**Do not overread.**
- The modal reading `applicationMode` from `initialDraft` rather than `initialSeed` is **consistent** with `WorkshopLexicalGravityRecommendationSeed`, which has no such field. It is a design question about personas, not a bug.
- The retirement of the stylesheet byte-preservation receipt test **followed that test's own written instruction**. It is not a weakened guard.
- Blending, Prose Controller, consequence meters, and persona behavior are explicitly out of scope. Do not manufacture findings there.
- The 16,000-character budget raise **is** measured, by `LexicalGravityConfigCodec.test.ts:149-225`. Do not report it as speculative.
- The context-cache token-visibility ADR and feature README are documentation only; no code for that feature ships here.

---

# Part II — The Review

## Executive Briefing

**Verdict:** Nearly there — the design is strong and unusually well-evidenced, but the suite is red at head and two paths can lose or hide a writer's file silently.

- 🔴 **F-01 · `npx jest` is red at head; three suites run zero assertions** — Three suites fail to *compile* on the newly required `applicationMode`, so the guards for the standing-directive handler, the widget-opening controller, and the rail formatter are silently dark. One of them shelters a stale assertion that will go red the moment the fixture is fixed. Fix the four fixtures and the label expectation before merge.
- 🟠 **F-02 · Rebuilding a v1 lens named after a built-in destroys the file and hides the replacement** — The overwrite succeeds, the original bytes are gone with no backup, and the resulting project lens is then dropped from the catalog by the built-in-wins rule. No message on either side. Refuse the rebuild instead of performing it.
- 🟠 **F-03 · A pre-v2 draft in a persisted session rejects the whole checkpoint** `🧭 Corroborated Runway` — `openNamed` rethrows, so the session can never be reopened; the autosave path pauses and starts an empty room. Declared in ADR §6 and developer-scoped, but the sibling widget solved the identical problem with an optional key plus a named repair, and pinned it with tests.
- 🟠 **F-04 · An invalid v2 lens file is invisible to the writer** — `readLens` returns bare `{}` for both "absent" and "refused." The catalog with no project lenses and the catalog where every project lens failed validation render identically. This change is what makes that common.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus 🏛️ | **B+** | Clean widget slice with a genuinely well-named domain abstraction; one real question about which validation layer the new referential rules belong to. |
| Critical Correctness — Blake 🔥 | **C+** | No logic defect in the core grammar, but the suite is red at head on the change's own fixtures and one path loses a writer's file irrecoverably. |
| Edge Cases — Sam 🔍 | **C+** | The happy paths are solid; two reachable dead-ends and one silent-destruction path sit just off them. |
| Code Quality — Parker 📖 | **B** | Vocabulary is consistent from prompt to type to screen — rare. Two comprehension debts: a three-outcome read encoded as two optionals, and four unrelated `2`s. |
| Tests — Cal 🧪 | **C** | The codec is examined thoroughly; the session that stores it is not examined at all, three suites are unread, and a stale assertion is being sheltered by a compile error. |
| Codebase Fit — Stan 🗂️ | **B** | Follows aliases, budgets-as-contract, and architecture-witness discipline throughout. The one deviation is justified and declared — just not where the next engineer will be standing. |
| Performance — Tim ⚡ | **A−** | Measured, not asserted: real directive frames are ~1,250 tokens at about a cent a round. One genuine mismatch between the generation and validity envelopes. |
| Security — Patricia 🛡️ | **B+** | Model→filesystem and model→webview boundaries are held deliberately and completely. The destructive path's identity guard is one field deep. |
| Observability — Oliver 🌙 | **C+** | Model-failure logging is a pattern worth copying. The silent skip and the unlogged overwrite are the two places a writer cannot reconstruct what happened. |
| Domain Logic — Bria 🎯 | **A−** | The locked Interpret/Recompose decision is honored end to end, and the semantic no-op is delivered as a real writer outcome. One accidentally-implied rule, one doc nit. |

## Findings

### F-01 · 🔴 Blocking — `npx jest` is red at head; three suites run zero assertions, one sheltering a stale expectation

**Raised by:** Blake, Cal
**Discovery:** 1 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.test.ts:254` — `})).toBe('Photography · 60% · 2° · metaphor');`
**Affected contract:** The repository's test suite as a merge gate; the writer-facing standing-directive rail label.

Three suites fail to compile against head `dde10a41` on the newly required `applicationMode`:

- `__tests__/application/handlers/domain/workshop/WorkshopStandingDirectiveHandler.test.ts:28` — TS2741
- `__tests__/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.test.ts:42` and `:51` — TS2741
- `__tests__/presentation/webview/hooks/domain/workshop/useWorkshopStandingDirectives.test.ts:243` — TS2345

A suite that fails to compile executes zero assertions — `npx jest` on the three reports `Tests: 0 total`. So the standing-directive apply/remove lifecycle witnesses, the widget-opening controller, and the rail formatter are dark, and all three are surfaces this change modifies.

Cal found the sharper fact. `formatLexicalGravitySummary` now interpolates the gear (`LexicalGravityDirective.ts:118`), and the service-side twin was updated to match (`WorkshopStandingDirectiveService.test.ts:92` → `'… Photography · interpret · 60% · 2° · metaphor'`). Its webview counterpart was not. Adding `applicationMode` to that fixture makes the assertion **fail** — it survives only because a compile error is running interference. The label contract has two witnesses that now disagree, invisibly.

`npm run typecheck` genuinely passes; `packages/core/tsconfig.json` excludes `src/__tests__` and its own comment delegates their type-checking to ts-jest — the command that was not run. The PR body lists `npm test -- --runInBand` as completed validation.

**Recommendation:** Add `applicationMode: 'interpret'` to the four fixtures and update `useWorkshopStandingDirectives.test.ts:254` to the new label. Do not relax it to `toContain`.

### F-02 · 🟠 High — Rebuilding a v1 lens named after a built-in destroys the file and hides the replacement

**Raised by:** Sam
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/handlers/domain/workshop/widgets/lexicalGravity/WorkshopLexicalGravityHandler.ts:96-99` — `const bySlug = new Map(builtIns.map((lens) => [lens.slug, lens])); projects.lenses.forEach((lens) => { if (!bySlug.has(lens.slug)) {bySlug.set(lens.slug, lens);} });`
**Affected contract:** After a writer-authorized rebuild, the replacement lens is selectable.

Two intentional, individually tested rules collide. Built-ins win slug collisions — an anti-counterfeit rule with its own witness at `WorkshopLexicalGravityHandler.test.ts:283`. And `replaceIncompatibleForQuery` forces `slug = path.basename(safeName, '.json')` (`LexicalGravityLensRepository.ts:146`) before `rename(temporary, destination, { overwrite: true })` (`:169`).

Walk them together. A v1 `photography.json` surfaces as a rebuild tile. The writer builds, selects one take, and the overwrite succeeds — the only irreversible act in the feature, no backup, no undo. On the next `handleRequestLenses`, `bySlug` already holds built-in `photography`, so the new project lens is dropped from the payload. It is also no longer a v1 tile, because the file is now version 2. The original bytes are gone and the replacement appears nowhere, with no message on either side. In-session it looks fine only because `availableLenses` folds in `extraLens`; close the sheet and it is gone.

Reachability is narrow but real: all six built-in slugs (`photography`, `music`, `mathematics`, `weather`, `botany`, `architecture`) shipped in one commit, so this is not historical drift — it requires a hand-authored or hand-renamed v1 file in a directory the ADR treats as writer-owned. It is also exactly the fixture `LexicalGravityLensRepository.test.ts:214-224` uses for the whole incompatibility flow.

**Recommendation:** In `handleBuild`'s rebuild branch, reject when `builtInLexicalGravityLens(path.basename(rebuildResourceName, '.json'))` exists, telling the writer to rename the file first. Keeps the anti-counterfeit rule and stops the overwrite being spent on an outcome the catalog will suppress.

### F-03 · 🟠 High — A pre-v2 draft in a persisted session rejects the whole checkpoint, with no repair path and no test `🧭 Corroborated Runway`

**Raised by:** Blake, Cal, Stan
**Discovery:** 1 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:156` — `['lensSlug', 'applicationMode', 'weight', 'reach', 'metaphorPull', 'resolvedLens'],`
**Affected contract:** Workshop session checkpoint decode.

`assertLexicalGravityDraftShape` now requires `applicationMode` plus five preview keys, and is reached from `WorkshopSessionStateV1Shape.ts:353` inside `assertWorkshopSessionStateShape` — which `parseWorkshopSessionStateV1:162` runs *before* `clonePersistedJson` and before any hydration normalization. One stale widget config rejects the entire checkpoint.

Consequence differs by door. `openNamed` (`WorkshopSessionPersistenceCoordinator.ts:424-426`) rolls back and rethrows — that named session cannot be opened again without hand-editing JSON. `initialize` (`:241-247`) catches, logs `"Current session restore failed; rolling autosave paused"`, and starts an empty room; the bytes survive but the room does not come back.

The sibling answered this exact class of change twice, the other way: `GesturePlaygroundConfigCodec.ts:48-53` declares later-added fields **optional** with an in-file comment — "Hydration supplies safe defaults before current integrity is enforced" — then repairs them in `normalizeGesturePlaygroundDraftForHydration:269`, registered as named tokens in `WorkshopSessionCheckpointNormalization.ts:25-26`, and pinned by two executable tests at `WorkshopWidgetConfigs.test.ts:447` and `:469`.

This change's opposite choice is legitimate and declared (ADR 2026-08-01 §6; Conversation Widgets have not shipped, so the blast radius is developer machines). What is missing is that the policy is recorded only in an ADR two directories away, with no in-file note and no test either affirming or documenting it. `WorkshopWidgetConfigs.test.ts` — which owns every widget-config persistence round-trip — uses `gesture-playground` exclusively.

**Recommendation:** Pick one and write it down where the next widget author will stand. Either follow the sibling (optional key, defaulted via a named `defaulted-lexical-application-mode` repair), or keep the strict choice and add (a) a two-line comment at `LexicalGravityConfigCodec.ts:156` citing ADR §6, and (b) a test in `WorkshopWidgetConfigs.test.ts` that pins the intended outcome — a round-trip that survives, and a pre-v2 draft that throws. A test that pins the throw is a decision on the record; silence is not.

### F-04 · 🟠 High — An invalid v2 lens file is invisible to the writer

**Raised by:** Oliver, Parker
**Discovery:** 1 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts:329-331` — `if (tolerateInvalid) { this.log.appendLine(\`[LexicalGravityLensRepository] Skipped ${displayName}: ${message}\`); return {}; }`
**Affected contract:** `WorkshopLexicalGravityLensesDataPayload` — the catalog's writer-visible account of what is on disk.

`readLens` returns bare `{}` for two opposite facts: *the file is not there*, and *the file is there, the writer authored it, and we refused it*. At the type level those are now indistinguishable, so no caller can surface the second without re-deriving it from a log line. The catalog with zero project lenses and the catalog where every project lens failed validation render identically — no error, no count, no note.

This change is what makes the scenario common. The codec went from a word field to a required `logic` object with 2–4-bounded collections, per-string budgets, kebab-case id rules, and a renderability check folded into structural validity. Every one of those is a new way for a previously-fine file to land in the tolerate-and-skip bucket.

The telling detail is that the change *did* build a first-class writer-facing channel for this — and wired only the case it could name in advance. `WorkshopLexicalGravityLensIncompatibility.foundVersion` is typed `number | null` (`lexicalGravity.ts:143`) and the repository only ever emits `1`; the null branch was shaped for "we could not determine what this file is" and that case was routed to the log instead.

A partial mitigation shows the data is already at hand: `findForQuery` calls `readLens` with `tolerateInvalid: false` and throws a verbatim reason that does reach the writer — but only if they happen to type that exact subject into Build. Discovery by coincidence.

**Recommendation:** Have the tolerate branch return the record it already has the shape for — `{ resourceName, foundVersion: null, rebuildQuery, message }` — instead of `{}`. The picker already renders that list. Parker's stronger form: make the outcomes a discriminated union (`'lens' | 'incompatible' | 'absent' | 'unreadable'`) and rename the method for what it now does, so the fact stays in the type.

### F-05 · 🟡 Standard — A v1 file whose filename is not a canonical slug gets a Rebuild button that can never succeed `🧭 Corroborated Runway`

**Raised by:** Blake, Marcus, Bria, Sam
**Discovery:** 4 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts:307` — `if (parsed.version === 1) {` (no name check) versus `:259-266` — `if (name !== path.basename(name) || name !== \`${slug}.json\` || !slug || lexicalGravityLensSlug(slug) !== slug) { throw new Error('Lexical Gravity rebuild target must be one cataloged lens filename'); }`
**Affected contract:** Every incompatibility record `list()` emits must be actionable by the write path.

`readLens` short-circuits on `version === 1` *before* any name reasoning — note the asymmetry three lines later, where the v2 branch does enforce `lens.slug !== fileSlug` and skips the file. So `Photography.json`, `harbor copy.json`, or `my lens.json` all become first-class incompatibility records, and the modal renders a "Rebuild and overwrite" button for every record unconditionally (`WorkshopLexicalGravityModal.tsx:656-660`). Clicking through reaches `assertIncompatibleResource` → `incompatibleResourceName`, which throws *"rebuild target must be one cataloged lens filename"* — about a file the picker just catalogued and printed by name. `rebuildTarget` is sticky, so every subsequent Build in that sheet also fails until the writer finds the cancel control.

No data is harmed — the failure fires before the model call and before any write. What is spent is trust, and the only in-app migration path for that class of file is a closed loop. The business rule *"only canonically-named legacy files are recoverable"* is accidentally implied by the ordering of two guards and declared nowhere.

**Recommendation:** Apply the same filename/slug agreement check in the v1 branch that the v2 branch already applies, so a non-canonical legacy file becomes a logged skip rather than a broken offer. If such files should stay recoverable, publish to the canonical `<slug>.json` and remove the original — a product call.

### F-06 · 🟡 Standard — `version: 1` is the sole predicate authorizing the only irreversible write

**Raised by:** Patricia
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts:306-312` — `const parsed = JSON.parse(raw) as Record<string, unknown>; if (parsed.version === 1) {`
**Affected contract:** The precondition on `replaceIncompatibleForQuery` — "the target is still a v1 lens."

The path guard is airtight; the *identity* guard is one field deep. `incompatibleResourceName` proves the target is a filename in the lenses directory. Nothing proves the target is a **lens**. Any `*.json` under `prose-minion/lenses/` whose top level carries `"version": 1` — regardless of all other content — is classified rebuildable, surfaced with an overwrite button, and destroyed on save. The same one-field predicate is what the careful TOCTOU-closing re-assertion re-checks, so the atomic dance faithfully protects an unproven claim.

Compounding it: the tile's primary label is `resource.rebuildQuery`, which `legacyRebuildQuery` lifts from the target file's own `originQuery` or `name` — so for a non-lens file the writer's consent is informed by a string chosen by the file being destroyed.

Attacker control is low and reachability is real: this is a writer footgun before it is an exploit, the directory is the writer's own, and Workspace Trust gates the extension in an untrusted folder. Standard, not High, for that reason.

**Recommendation:** Before returning the incompatibility record, require two or three v1-distinctive properties — e.g. `degrees` is an object keyed `1/2/3` and `gradient` is a non-empty string array. Anything else falls through to the existing logged-skip path, where an unrecognizable file already belongs.

### F-07 · 🟡 Standard — Widget drafts have no semantic-validation layer, so referential rules land in the pre-normalization structural pass

**Raised by:** Marcus
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:595` — `if (!roleIds.has(position.roleId as string)) { shapeError(\`${positionPath}.roleId\`, 'an id declared by the selected lens'); }`
**Affected contract:** The documented two-pass validation architecture.

`WorkshopSessionStateV1.ts:154-158` states the intended layering in prose — structural first, then semantic/referential on a defensive clone — and `parseWorkshopSessionStateV1` implements exactly that. But the semantic pass (`WorkshopSessionStateV1Integrity.ts`) only reasons about cross-entity references and never opens a widget draft. There is no semantic layer for widget internals at all, so when this change introduced a genuinely referential rule, the only place it could go was the structural pass — the one gate that runs before normalization and whose only outcome is throw-or-pass on the whole checkpoint.

The rule itself is the best thing in the diff (see Praise). The concern is forward-looking: Prose Controller is pre-declared with five throwing placeholders and will be built by copying this slice. If widget drafts permanently have one validation pass, every future widget's referential rule inherits the same all-or-nothing decode behavior, and the documented contract quietly stops describing the code.

**Recommendation:** Decide and record whether widget drafts get a semantic pass. Cheapest honest version: a `validate…ForIntegrity(draft)` entry point called from `WorkshopSessionStateV1Integrity`, with `assert…Shape` kept to keys/types/bounds. If one pass is the deliberate house rule, amend the comment at `WorkshopSessionStateV1.ts:154-158`.

### F-08 · 🟡 Standard — Generation and validation envelopes disagree, and neither prompt states the numbers

**Raised by:** Tim, Sam
**Discovery:** 1 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/shared/constants/promptBudgets.ts:243` — `lexicalBuildOutputTokens: 8_000,`; and `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:572-573` — `if (!Array.isArray(value) || value.length > BUDGET.lexicalPreviewPositions) { shapeError(path, \`an array of 0–${BUDGET.lexicalPreviewPositions} mappings\`); }`
**Affected contract:** The generator is told the rules its output is validated against.

Tim measured rather than estimated. A maximal codec-valid lens serializes to **21,984 characters** (~6,500–7,300 tokens); three of them are ~65,952 characters, ~20,000 tokens — against an 8,000-token ceiling. The validity envelope is 2.5× the generation envelope, and a single maximal lens nearly exhausts a budget that must carry three. `00-build-lens.md` specifies collection *counts* but no character guidance; the only thing holding output near the observed 4,009–4,293 chars per built-in is the schema example's implicit anchoring. A verbose model fails deterministically, not transiently, and `finishReason === 'length'` discards the whole 8,000-token generation with a retry message that cannot help.

Sam found the mirror image on Preview. The codec rejects outright at `semanticPositions.length > 6`, `element > 160`, `significance > 320`, `openEntailment > 500`, `text > 1_200` — and `01-preview.md` states every *referential* rule and no numeric one. The sibling one file over spells its bounds out exactly, so the convention already exists. A four-role, three-axis lens on a dense passage invites a seventh mapping; "why this mapping matters" passes 320 characters without effort. There is no coercion or truncation — the whole preview dies and collapses to a generic retry line.

Adjacent, harmless: `lexicalBuildResponseCharacters: 200_000` is ~7× unreachable given an 8,000-token cap.

**Recommendation:** State the codec's numbers in both prompts — the values already exist in `PROMPT_BUDGETS`. Separately, confirm whether OpenRouter reasoning tokens count against `lexicalPreviewOutputTokens: 3_600` for the models Workshop offers (`reasoning: { effort: 'low' }` is set); if they do, raise it to ~5,000.

### F-09 · 🟡 Standard — Two persistence primitives invented widget-local, one a null-shaped twin of a shared helper

**Raised by:** Stan
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:555-562` — `function assertCollectionLength(value, path, minimum, maximum, label)`; and `:642-649` — `function assertNullableBoundedString(...)` `if (value !== null)`
**Affected contract:** `persistedValidation.ts` as the single vocabulary for Workshop shape assertions.

`persistedValidation.ts:1-8` states its own charter and already owns 20 exports at exactly this altitude. Bounded-array-length is now spelled three times inline in `GesturePlaygroundConfigCodec.ts:113-118, 132-137, 159` with an identical message template, and once more through a private helper here — the same knowledge duplicated, not just the same text. The nullable helper is sharper: the shared module encodes absence as `undefined` (`optionalBoundedStringAt:105-114`), and this change introduces `null`-as-absent into a Workshop persisted shape for the first time while naming the helper locally.

**Recommendation:** Promote both to `persistedValidation.ts` as `boundedArrayAt` and `nullableBoundedStringAt`, and have Gesture's three inline checks call the first. If one more duplication is the preferred price, record it in `.todo/tech-debt/` keyed to Prose Controller so the third copy is a decision rather than a default.

### F-10 · 🟡 Standard — Four independently-versioned things all spell themselves `2`

**Raised by:** Parker
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts:177` — `if (parsed.version !== 2 || !Array.isArray(parsed.candidates))` and `:191` — `version: 2,`
**Affected contract:** The lens document version, the preview artifact version, the model build-envelope version, and the sentinel protocol version.

Fourteen lines apart inside one function, `parsed.version` is the wire envelope's version and `version: 2` is the lens's. They are separate facts, they currently agree, and nothing in either line says so. The same number also appears at `LexicalGravityConfigCodec.ts:69` and `:195`, `LexicalGravityLenses.ts:9`, `lexicalGravity.ts:65` and `:98`, plus four sentinel constants. This is duplicated knowledge whose duplication is invisible precisely because the duplicates are *not* the same fact.

This change proved the version boundary matters — it built a whole incompatibility-and-rebuild apparatus so a v3 can exist. That apparatus deserves a version it can name.

**Recommendation:** Give each its own named constant beside the thing it versions — `LEXICAL_GRAVITY_LENS_VERSION`, `LEXICAL_GRAVITY_PREVIEW_VERSION`, `LENS_RESPONSE_ENVELOPE_VERSION` — so agreement becomes a visible choice. The sentinel strings can keep their inline `V2`; they are protocol text that must match the prompt files byte-for-byte.

### F-11 · 🔵 Nit — The writer-facing Weight scale was recalibrated while the ADR asserts Weight's meaning is unchanged

**Raised by:** Bria
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal.tsx:85-86` — `weight <= 15 ? 'trace' : weight <= 35 ? 'subtle' : weight <= 65 ? 'forward' : weight <= 85 ? 'insistent' : 'saturating';`
**Affected contract:** ADR §4 — "Weight controls how strongly or frequently that grammar influences prose."

`weightLabel` is the only place the app tells a writer what the number means, and the host still sends the bare integer, so no model behavior moved. What moved is the writer's reading of a value they already saved: a persisted draft at 40 read "present, not loud" before and reads "forward" after; 70 went from "forward" to "insistent." Five bands where there were four. This is defensible — Weight's *scope* genuinely widened, since the directive went from influencing "diction and imagery" to influencing "prose," and high Weight in `recompose` now carries authority over beat order and revelation sequence. But the ADR asserts the meaning is unchanged and the label table is the writer's only view of it.

**Recommendation:** One line in the ADR's §4 Weight bullet recording that the bands were re-drawn against the widened scope, so "meaning unchanged" is not read as "scale unchanged." Doc-only.

### Praise — patterns worth copying into Prose Controller

**P-1 · Preview validity is a property of the (lens, preview) pair, not of the preview alone** — Marcus.
`LexicalGravityConfigCodec.ts:203-206` parameterizes the validator by the resolved lens carried in the same draft, and `LexicalGravityModelService` reuses it so wire output is judged in the coordinate system the persisted artifact will live in. This is the move that makes the costume test mechanical rather than tasteful: a model cannot report a position in a role the chosen lens never declared. `logic`, `roles`, `axes`, `dynamics` are concepts in the domain, not in the code. When blending arrives, keep this shape and qualify ids by lens slug rather than relaxing the check.

**P-2 · Both empty states are narrated in the writer's vocabulary** — Parker, Bria.
`WorkshopLexicalGravityPreviewReading.tsx:17-24` resolves every `roleId`/`axisId` through the lens's declared names, with the raw id as fallback rather than default — no machine id ever reaches the screen. And both empty branches are *narrated*: the no-op says "the lens left the passage alone rather than inventing props, motives, or plot events. That is a valid result," and positions-without-a-dynamic says "positioning only; no state change was honest for this beat." The criterion most likely to be satisfied on paper and betrayed in the UI is instead enforced in the codec *and* reassured on screen — which is what stops strictness from becoming pressure to fabricate.

**P-3 · The re-assert-before-publish atomic write** — Stan.
`LexicalGravityLensRepository.ts:161-173` writes the temp file, re-checks the precondition, *then* renames — with a comment explaining the invariant rather than the mechanics. Every prior temp-write/rename in this repo validates once, before the write. This is the better idiom for the only destructive operation in the feature, and the residual TOCTOU window is acknowledged rather than papered over. Copy this one, not `WorkshopSessionStore`'s, when Prose Controller gains a project-file writer.

**P-4 · The model→filesystem and model→webview boundaries are held deliberately and completely** — Patricia.
The candidate's own `slug` is overwritten by the filename-derived value before write, so the model cannot choose where its output lands. Every lens-derived string entering the directive passes through `quote()`, which truncates *and* runs `neutralizeReservedPersonaPromptDelimiters` — `prose-directive` is in that reserved set, so a lens cannot close its own frame. That is complete coverage across a renderer whose budget just went 3,000 → 16,000. On the webview side every new semantic field renders as a React text node; only `preview.text` reaches the DOMPurify'd `MarkdownRenderer`.

**P-5 · The directive budget raise is measured, and the measurement is the reason it is defensible** — Tim.
Real frames render 4,818–5,058 characters — ~1,250 input tokens, roughly $0.004 per call, about a cent per three-persona round. The 16,000 ceiling is 3.2× the realistic frame, and reach barely moves it. `LexicalGravityConfigCodec.test.ts:149-225` is what turns a 5.3× constant raise from an assertion into a fact.

**P-6 · The preview rejection log pairs the validator's reason with `finishReason` and a writer-actionable remedy** — Oliver.
`LexicalGravityModelService.ts:147` logs exactly the pair that separates "the model ran out of tokens" from "the model cited a `roleId` this lens never declared" — two failures with completely different fixes. The bounded body dump stays out of the webview, and the writer-facing sentence names a remedy ("choose another model") rather than only announcing damage.

## What the Panel Changed About the Runway

**Affirmed.** The runway's central reading — that this change's real job is making the model's interpretation a declared, validated, auditable artifact — held across every lane. Its account of the rebuild path's engineering care was confirmed independently by Blake, Stan, and Patricia.

**Refined.** Three corrections improved on the map:

- Marcus checked the base branch and proved the codec→directive dependency is **inherited**, not introduced — `assertLexicalGravityLensRenderable` was already imported at line 24 before this change. Verified; it should not be charged here.
- Stan dissolved two of the runway's four "competing precedents." The sentinel-frame duplication is inheritance (`extractFrame` already existed and was merely re-parameterized), and the path-guard comparison was a category error: `isPathWithinRoot` answers containment while `incompatibleResourceName` answers filename-identity. Different questions.
- Bria adjudicated the runway's declared-vs-observed gaps and dissolved most of them. Dropping "and sentence count" is *forced* by recompose rather than accidental, and `interpret` retains an equivalent constraint in different words. The recommendation seed's omission of the gear is correctly scoped by the sprint's own out-of-scope list. The rebuild path bypassing the duplicate guard is correct by construction — a file with that slug is the whole scenario.

**Rejected.** Sam refuted two runway-suggested paths on evidence: the "second Build discards unsaved takes" concern is unreachable, because the Build control is disabled while a build token is set; and cross-collection id collision resolves correctly, since every lookup is per-collection.

**Answered by measurement.** The runway listed the aggregate directive budget as an open worry. Tim measured it: ~1,250 tokens per frame, ~2,500 for two families. Not worth a guard rail today. He also answered a question the runway did not think to ask — that `lexicalBuildOutputTokens` is 2.5× below the codec's own validity envelope, which makes part of the "model validity rate" unknown arithmetic rather than model behavior.

**Still unknown.** Whether any local checkpoint actually holds a pre-v2 draft. Whether F5 acceptance — including the sprint's own costume test — has been run; searched for a `costume` artifact outside documentation and found none, though the sprint says so itself in its status line.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A green light only certifies what the command actually looked at

**Illuminated by:** F-01 (Blake, Cal)

Two verification commands ran the same code in the reader's mind and different code in fact: `typecheck` excludes `src/__tests__`, delegating that type-checking to ts-jest — that is, to the command whose output nobody read. The suites did not fail loudly; they failed to *compile*, which means they executed zero assertions and reported no absence. And beneath one of them sat a stale label assertion that will go red the moment the fixture is fixed, so the compile error was not merely hiding silence — it was sheltering a real disagreement between two witnesses of the same contract. A gate's scope is part of its result.

**Carry forward:** When a validation command is cited as evidence, name what it *excludes* in the same breath — and treat "suite failed to compile" as strictly worse news than "suite failed," because a red test told you something and a dark one didn't.

### Lesson — When you tighten a gate, you have to build the door that tells someone they were turned away

**Illuminated by:** F-04 (Oliver, Parker), F-03 (Blake, Cal, Stan), F-05 (Blake, Marcus, Bria, Sam)

This change made four things strict at once: a lens file, a persisted draft, a preview payload, and a rebuild target. It also built a genuine writer-facing incompatibility channel — and wired it to exactly the one rejection reason that could be named in advance. Everything else fell into channels that predate the strictness: a bare `{}` that renders identically to "no project lenses exist," a whole-checkpoint throw whose only explanation is the Output panel, a Rebuild button offered for a file the write path will refuse. The telling artifact is `foundVersion: number | null` — a null branch shaped for exactly the unreachable case, which suggests the shape of the answer was already understood.

**Carry forward:** For each new rejection a change introduces, finish the sentence "the user learns this by ___." If the answer is a log line, or "the thing is simply absent," the rejection isn't done yet.

### Lesson — Let the depth of a guard match the reversibility of what it authorizes

**Illuminated by:** F-06 (Patricia), F-02 (Sam), and P-3 (Stan)

The single irreversible act in this feature is protected by a beautifully engineered *path* guard and a one-field *identity* guard: any JSON carrying `"version": 1` qualifies, and the consent label shown to the writer is lifted from a string inside the file about to be destroyed. Sam then found the other half — a rebuild that fully succeeds can still be swallowed, because built-ins win the slug collision the rebuild guarantees. Two independent guards were each locally sound; the gap lived in the asymmetry between how carefully the write was performed and how thinly the target was identified.

**Carry forward:** For any destructive operation, ask the three questions separately — *am I allowed to write here*, *is this genuinely the thing I meant*, and *will the result be visible afterward*. They fail independently.

### Lesson — Knowledge is only a constraint where the thing that must obey it can read it

**Illuminated by:** F-08 (Tim, Sam), F-10 (Parker), F-09 (Stan), and the precedent half of F-03 (Stan)

Four patterns, one shape. The codec knows the character envelope; the prompt that asks the model to hit it never states a number, and Tim measured the gap at 2.5×. Four unrelated version numbers all spell themselves `2`, two of them fourteen lines apart in one function, agreeing today by coincidence. Two persistence primitives were invented widget-local rather than added to the shared vocabulary that already holds their near-twins. And a defensible departure from the sibling's precedent lives only in an ADR two directories away — where the next person copying this slice will not be standing.

**Carry forward:** When a rule lives in one file and must be honored in another, ask what would carry it across — a shared constant, a named type, a comment at the point of obedience, or a test. An ADR is a record of a decision; a test is a decision that shows up when you break it.

### Lesson — Validity is sometimes a property of the pair, not of the object

**Illuminated by:** P-1 (Marcus), P-2 (Parker, Bria)

The structurally strongest idea here is that a preview is not valid or invalid on its own — it is valid *with respect to the lens in the same draft*. Parameterizing the validator by that lens turned a matter of taste into something a machine can decide, and reusing it on the wire means model output is judged in the coordinate system the persisted artifact will live in. Just as instructive is what makes that strictness humane: the design gives the model a legal way to say nothing, and narrates it to the writer as "That is a valid result." Rigor without an honest no-op becomes pressure to fabricate. Note too that the feature's best rule and its least extensible rule are the same rule — a real cost knowingly paid, not a defect.

**Carry forward:** When a check feels like it needs judgment, ask what second thing it should be judged *against* — and then ask what the legitimate empty answer is, and whether anything can express it.

*The panel's sharpest corrections this round came from measurement rather than argument — Tim's character count, Stan's dissolution of two suspected precedents, Sam's proof that a feared race was unreachable — a quiet reminder that the fastest way to close a review question is usually to go and look.*

## Horizon Watchlist

Not merge blockers. Real pressures the panel supported but which do not warrant action now.

- **Blending (Sprint 04) will collide with single-lens id resolution.** Preview ids resolve against exactly one `resolvedLens`, ids are unique only *within* a collection, and `configKey` is five scalars bounded at 256 characters. Two blended lenses may both declare `focus`. The decision to make — merged id space, lens-qualified ids, or a per-position lens name — is already implied by this change's coordinate system.
- **Prose Controller will be built by copying this slice.** Five throwing placeholders already exist in the standing-directive registry. The atomic-write dance, the sentinel-frame extractor, and the `latestBuild` correlation slot are the most copyable and least widget-specific code here.
- **The aggregate standing-directive budget.** No combined ceiling exists; two families at ~1,250 tokens each is ~2,500 and not worth a guard today. Revisit if a fourth family lands or if any family ever renders unbounded writer text.
- **`prose-minion/lenses/*.json` becomes a published writer-owned format at first Marketplace release,** at which point ADR 2026-07-30's version discipline applies to it and not only to session JSON. The machinery built here is what will make a v3 possible.
- **`PROMPT_BUDGETS.workshopWidgets` is already 40+ `lexical*` keys in a flat interface.** Per-widget nesting will be proposed by the third or fourth widget.
- **The costume test has no executable witness.** The sprint's fifth accountability criterion — that a lens still reads as interpretive after its conspicuous domain words are removed — is the feature's central claim and currently rests on F5 acceptance that the sprint itself records as pending.

## The Closer

🚪 **Knock, knock.**
*Who's there?*
**Version.**
*Version who?*
**Version 1 — and that's all I had to say to get you to overwrite the file.**

## Final Assessment

This is strong, careful work with an unusually good idea at its center: validating a preview against the lens that produced it turns "is this a real interpretation or vocabulary in a costume?" into a question a machine can answer, and giving the model a legal way to say nothing is what keeps that rigor from becoming pressure to invent. The engineering around the one irreversible act — validate, temp-write, re-assert, publish — is better than the house idiom and should become it.

Merge is gated on small, concrete things rather than design rework. Green the suite and fix the stale label assertion it is sheltering (F-01). Refuse a rebuild whose result the catalog would suppress (F-02) and decide what a pre-v2 checkpoint should do, in code and in a test rather than only in an ADR (F-03). F-04 through F-11 are follow-ups, though F-04 is cheap enough to be worth doing now: the writer-facing channel already exists and needs one branch wired into it.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
