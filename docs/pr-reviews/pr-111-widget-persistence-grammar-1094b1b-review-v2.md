# MR Review v2 — Sprint 02D: establish widget persistence grammar and integrity

**Author:** Okey Landers · **PR:** [#111](https://github.com/okeylanders/prose-minion-vscode/pull/111) · **Branches:** `sprint/conversation-widgets-02d-widget-persistence-grammar` → `epic/conversation-widgets`
**Head:** `1094b1bb` · **Reviewed:** 2026-08-08 (America/Chicago) · **Mode:** Full

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | The persisted-widget set is enumerated three times; the compiler checks one | Marcus, Bria, Cal | 3 runway-prompted | 🧭 Corroborated Runway | **Addressed** — shape narrowing and the architecture witness now consume the registry-owned predicate |
| F-02 | 🟡 Standard | The two lifecycle arms disagree on whether `normalizeForHydration` proves its own postcondition | Sam | 1 runway-prompted | — | **Addressed** — Gesture normalization now asserts its current-shape postcondition |
| F-03 | 🟡 Standard | The lifecycle's four operations are named three different ways across three layers | Parker, Stan | 1 independent · 1 runway-prompted | — | **Addressed** — lifecycle vocabulary is aligned around checkpoint/current shape, normalization, and integrity assertions |
| F-04 | 🟡 Standard | "Unknown role, axis, or dynamic" is proven only for role; the axis rules are unexercised | Cal | 1 runway-prompted | — | **Addressed** — role, axis, co-nullity, and dynamic failures now prove shape/integrity phase attribution |
| F-05 | 🟡 Standard | `validateIntegrity`'s current-shape precondition is positional, not typed | Blake | 1 runway-prompted | — | **Deferred** — no fourth caller exists; revisit with the fifth read path |
| F-06 | 🟡 Standard | Refusal moved to the far side of conversation import; the preflight comment overstates its guarantee | Bria | 1 independent | — | **Addressed** — parse contract now states that its result is not hydration-ready; ordering remains follow-up scope |
| F-07 | 🟡 Standard | The restore-failure banner names a read error for a semantic failure and withholds the diagnostic | Oliver | 1 runway-prompted | — | **Addressed** — host diagnostic is carried through the message contract and rendered as a restore failure |
| F-08 | 🟡 Standard | Recovery logging discards the widget/config identity its sibling notice carries | Oliver | 1 independent | — | **Deferred** — accepted follow-up; do not let it wait for the third widget |
| F-09 | 🟡 Standard | The architecture guard permits two feature tokens that appear nowhere in the guarded file | Stan | 1 runway-prompted | — | **Addressed** — removed the unused draft-token alternatives |
| F-10 | 🟡 Standard | `normalizeLexicalGravityDraftForHydration` cannot tell its own story | Parker, Marcus | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — documented the temporary semantic witness; decomposition remains follow-up scope |
| F-11 | 🔵 Nit | A bare `catch` reports every renderability failure as "directive too long" | Sam, Oliver | 2 independent | 🎯 Consensus | **Addressed** — renderability diagnostics now retain the renderer's actual error |
| F-12 | 🔵 Nit | The renamed `it.each` proves neither half of its new name | Cal | 1 runway-prompted | — | **Addressed** — split shape and integrity cases; integrity failures now prove live-state non-mutation |
| F-13 | 🔵 Nit | `boundedArrayAt`'s `label` names the JSON type at eleven call sites and contradicts the path at one | Parker | 1 runway-prompted | — | **Addressed** — callers now supply domain nouns and exact-cardinality diagnostics say `exactly` |
| P-1 | 💚 Praise | The corruption test asserts the writer-facing all-or-nothing invariant, not that a guard ran | Blake, Bria | 2 independent | 🎯 Consensus | N/A — preserve |
| P-2 | 💚 Praise | The widget phase split descends the aggregate's own precedent rather than importing a pattern | Marcus | 1 independent | — | N/A — preserve |
| P-3 | 💚 Praise | The error string survived the switch→registry rewrite byte-for-byte; both guard registries updated | Stan | 1 independent | — | N/A — preserve |
| P-4 | 💚 Praise | The shape→integrity split re-anchored rules for two non-persistence lens callers | Sam | 1 independent | — | N/A — preserve |
| P-5 | 💚 Praise | Set-based integrity hands the next widget a linear precedent, not a quadratic one | Tim | 1 independent | — | N/A — preserve |
| P-6 | 💚 Praise | The `hasOwnProperty` guard closes the prototype chain the switch→lookup swap reopened | Patricia | 1 runway-prompted | — | N/A — preserve |

### Remediation receipt — 2026-08-08

All actionable findings are addressed. F-05 remains deliberately deferred until
a fifth persisted-state read path makes the current-shape precondition worth
encoding in the type system; F-08 remains the accepted recovery-identity
follow-up before a third persisted widget lands. The separately reviewed
rejected-model-response recovery commits were not changed by this pass.

Verification after remediation: all three TypeScript projects passed; all 192
Jest suites passed (2,003 tests, 2 snapshots); ESLint completed with 0 errors
(933 pre-existing warnings); production build/bundle sentinels passed; and
`git diff --check` passed.

## Review coverage

**Read fully:** `WorkshopWidgetPersistenceLifecycle.ts` (new), `persistedValidation.ts`, `WorkshopSessionStateV1Integrity.ts`, `WorkshopSessionCheckpointNormalization.ts`, `LexicalGravityConfigCodec.ts`, `GesturePlaygroundConfigCodec.ts`, `WorkshopPersistedSession.ts`, the deleted `WorkshopWidgetCheckpointRecovery.ts`, all five changed test files, and the Sprint 02D doc.

**Diff reviewed:** all 19 changed files (+758 / −401).

**Read for context:** `WorkshopSessionService.hydrateCommittedState`, `WorkshopSessionPersistenceCoordinator.hydrate` and its two call sites, `WorkshopSessionStore` read/write paths, `WorkshopSessionStateV1Shape.ts`, `boundaries.test.ts`, `WorkshopWidgetRecommendationOperations.ts`, `personaSchematics.ts`, `promptBudgets.ts`, `WorkshopApp.tsx` banner rendering, `sprints/03-prose-controller.md`, ADR 2026-07-30, `CLAUDE.md`.

**History:** `dbcfc9e5`, `3e4ff436`, `25e313c2`, `d964b021`, and `1094b1bb^` file states for scope verification.

**Not verified:** the PR's claimed 1,989 tests / 2 snapshots (suite count verified at 191 via `jest --listTests`; the suite was not executed). No interactive F5 acceptance. No live model calls. No external/web research was run — no published-source claims appear in this review.

**Blast radius:** one module deleted, one created; no `schemaVersion` change, no message-contract change, no UI component change, no dependency change. All production changes sit inside `packages/core/src/application/services/workshop/`.

---

# Part I — Semantic Runway

## Semantic Runway — Sprint 02D: establish widget persistence grammar and integrity

**PR:** #111 · **Author:** Okey Landers · **Branches:** `sprint/conversation-widgets-02d-widget-persistence-grammar` → `epic/conversation-widgets` · **Head:** `1094b1bb` · **Evidence date:** 2026-08-08
**Blast radius:** 19 files, +758 / −401. One module deleted, one created. No `schemaVersion` change, no message-contract change, no UI change, no new dependency. Everything touched sits inside `packages/core/src/application/services/workshop/` plus two architecture tests and three planning documents.

**Runway thesis.** This is a precedent-hygiene change disguised as a persistence change. Two persisted Workshop widgets grew habits — semantics mixed into raw JSON shape validation, and mechanical array/null grammar reinvented per feature — that a third widget was about to inherit. The MR does not add a rule, remove a rule, or change what a writer sees; it moves existing rules across a phase boundary and makes the *set* of phases a compile-time obligation, so that the third widget copies a complete pattern instead of two accidents. Judge it primarily on whether the boundary it draws is the right one and whether it holds under a third tenant — not on throughput, and not on new capability, because it claims none.

---

### 1. Working Definition & Real Job

**Literal code change.** `WorkshopWidgetCheckpointRecovery.ts` (three parallel `switch (widgetId)` statements, `default: throw`) is deleted. `WorkshopWidgetPersistenceLifecycle.ts` replaces it with a single closed object literal keyed by `WorkshopWidgetConfigSnapshot['widgetId']`, constrained by `satisfies` against a mapped type whose each arm is typed with that arm's own draft via `Extract<…, { widgetId: Id }>['draft']`. Each arm supplies four operations: `assertCheckpointShape`, `normalizeForHydration`, `assertCurrentShape`, `validateIntegrity`. Two mechanical helpers — `boundedArrayAt`, `nullableBoundedStringAt` — are promoted into the shared `persistedValidation.ts` grammar and adopted by both feature codecs. Both codecs split their validation into a structural family and a named integrity family. `validateWorkshopSessionStateV1` gains a `skipWidgetDraftIntegrity` option and invokes widget integrity per config.

**Functional capability.** Semantic rules about a widget draft — "this preview's `roleId` must be declared by the selected lens", "these selections must be drawn from the generated menu", "this config key must match the current six-value identity" — now run *after* recognized older drafts have been normalized to current shape, rather than during raw JSON recognition. The practical effect: a draft that predates a field can be repaired first and judged second, instead of being condemned for failing a rule it structurally could not satisfy.

**Business/operational problem.** [Declared — sprint doc lines 11-24] Not a writer-reported defect. The problem is that Sprint 03 (Prose Controller) is the third persisted widget, and the two existing ones constitute the precedent it will copy. PR #110's review recorded this as F-07 (widget drafts have no semantic-validation layer, raised by Marcus) and F-09 (two persistence primitives invented widget-local, raised by Stan); both were accepted as Planned for this sprint and are flipped to Addressed here.

**What the wording and structure emphasize.** The sprint doc's Decision Map is a vertical pipeline diagram, and the code reproduces it literally. The emphasis is on *phases having names* and on the registry being **closed** — the doc says so three times and the PR body repeats it: "deliberately closed rather than a plugin system or schema DSL." The negative-space section (sprint doc 114-124) is unusually explicit about what `persistedValidation.ts` must never know.

**What it suppresses.** The change is presented as boundary work, which pulls attention away from the fact that it also *relaxes* the earliest gate: `parseWorkshopSessionStateV1` no longer rejects widget semantic corruption on its own. The PR body's "run widget integrity after checkpoint normalization and before the live Workshop aggregate is installed" is accurate; what it does not say is that a public exported parse function became more permissive as a consequence, and that the safety of the arrangement now rests on call-site ordering at three sites.

**What must survive any valid alternative.** (a) No live Workshop aggregate is ever installed from a semantically incoherent widget draft. (b) Recognized development-era drafts still recover rather than being rejected. (c) `current.json` is never overwritten from a state that failed validation. (d) The generic persistence grammar knows no feature vocabulary. (e) Adding a third widget must not require editing the first two.

**Competing interpretation.** A reader could argue this MR's real job is *type-system theater* — that a `switch` with `default: throw` was already correct at runtime, and 154 lines of mapped types, `Extract<>` indirection, and a double cast buy a compile error that a two-line test could also buy. That reading is worth holding, and it is partly answered by the fact that the registry's exhaustiveness is genuinely stronger than the switch's (build-time vs. runtime), and partly *not* answered, because `lifecycleFor`'s `as unknown as` erases exactly the per-arm correlation the mapped type establishes.

> This MR is not merely a dispatcher rewrite. Its real job is to make the persisted-widget lifecycle a named, complete, compiler-enforced contract before a third widget copies an incomplete one — while preserving every existing accepted shape and every existing error meaning.

### 2. Declared Intent, Observed Behavior & Open Meaning

**Aligned.** [Observed] The four-operation registry exists and is exhaustiveness-enforced (`WorkshopWidgetPersistenceLifecycle.ts:54-87`). The two primitives are shared and adopted (`persistedValidation.ts:77-133`; adopted at `GesturePlaygroundConfigCodec.ts:109,120,135,153` and throughout `LexicalGravityConfigCodec.ts`). Lexical's role/axis/dynamic/nullity/config-key correlations left `assertLexicalGravityDraftShape` for `assertLexicalGravityDraftIntegrity` (`LexicalGravityConfigCodec.ts:267-286, 363-414, 968-1002`). Gesture's selection-membership, duplicate, and serialized-length rules left the shape pass for `assertGesturePlaygroundDraftIntegrity` (`GesturePlaygroundConfigCodec.ts:170-224`). Widget integrity is invoked from the aggregate integrity pass (`WorkshopSessionStateV1Integrity.ts:257-263`). Architecture witnesses exist (`__tests__/architecture/workshopWidgetPersistenceLifecycle.test.ts`; `boundaries.test.ts:345-352, 506-512`).

**Gap 1 — "no intended writer-visible feature change" is true only because a stricter gate lives upstream.** [Observed] The MR's own test edit is the tell: a suite formerly asserting `parseWorkshopSessionStateV1(state)` throws was renamed from "rejects `$label` at persistence ingress" to "rejects `$label` before live hydration" and now must run `parse + hydrateCommittedState` to observe the throw (`WorkshopWidgetConfigs.test.ts:476-487`). Widget semantic violations are no longer rejected by the exported parse function alone. In production this is invisible because both read paths reach `hydrate()` only through `decodeWorkshopPersistedSessionCheckpoint`, which already ran full integrity (`WorkshopPersistedSession.ts:126-138` → `WorkshopSessionStore.ts:697,723` → `WorkshopSessionPersistenceCoordinator.ts:248,431`). The safety is real; it is just located somewhere other than where the function's name suggests.

**Gap 2 — a preview that is about to be discarded must still pass full integrity.** [Observed] `normalizeLexicalGravityDraftForHydration`'s pre-evidence-mode branch builds a `semanticWitness` with a synthesized current config key, runs `assertLexicalGravityDraftIntegrity` on it (`LexicalGravityConfigCodec.ts:576-588`), and then sets `preview: undefined` eleven lines later (`:599`). A stale preview whose semantics are incoherent therefore fails the entire session load rather than being dropped with the notice the branch already emits. Defensible as "a corrupt preview means the file is untrustworthy," but the sprint doc does not state it and the code does not comment it.

**Gap 3 — the Reproduction Test holds in letter, understates in count.** [Declared — sprint doc 172-183] Adding Prose Controller should require "its named persisted draft codec and tests; its four lifecycle operations; one deliberate union arm and closed-registry entry; and its own contradiction/integrity rules," and "must not require edits to Gesture Playground or Lexical Gravity feature files." [Observed] The feature-file claim holds. But `WorkshopSessionStateV1Shape.ts:367-370` independently hardcodes `config.widgetId !== 'gesture-playground' && config.widgetId !== 'lexical-gravity'` plus a cast to the same literal pair, is not derived from the registry, and is untouched by this MR — and the new architecture test hardcodes the pair a third time. The persisted set is now written down in three places, only one of which the compiler checks.

**Gap 4 — ledger self-certification.** [Observed] The PR flips PR #110's F-07 and F-09 from Planned to Addressed and marks the sprint Complete, inside the PR that implements them. Consistent with prior sprints in this epic; recorded here as a fact, not a criticism.

**Unknown.** Whether any real development checkpoint on the author's machine holds a shape that this MR newly refuses. The relevant candidate is a v1 lens carrying `applicationMode` but no `evidenceMode`, which falls between the checkpoint-shape branches (`LexicalGravityConfigCodec.ts:228-241`) and is rejected rather than recovered.

### 3. Business Story & Rulebook

**Actors.** The *writer* owns the data and is the beneficiary of the invariant. *Future widget authors* — concretely, whoever implements Prose Controller next sprint — are the beneficiaries of this MR specifically; the writer sees nothing new today. *Agent personas* produce widget drafts (recommendation seeds, generated previews) but are not actors in the lifecycle. *Prose Controller* is the named excluded actor: present in the widget catalog and in the standing-directive family enum (`WorkshopSessionStateV1Shape.ts:385-386`), deliberately absent from the persistence registry, with a test asserting its absence.

**Trigger and preconditions.** The writer reopens VS Code (rolling `current.json`) or opens a named session. A file exists, parses as JSON, is within size and nesting bounds, and declares `schemaVersion: 1`.

**Decisions and rules the code now makes.**
- Every arm of the persisted widget union must supply four named operations; omission is a build failure, not a runtime surprise.
- Leniency is phase-scoped: the checkpoint boundary may recognize prior shapes; post-normalization shape and integrity are strict and current-only.
- Unknown widget ids fail closed with `Unsupported persisted Workshop widget: <id>` — message preserved verbatim from the deleted dispatcher, which matters to anyone grepping logs.
- The shared grammar module may know arrays, strings, `null`, lengths, paths, and diagnostic phrasing, and must know no role, axis, lens, gesture menu, chapter, lever, or migration policy.
- Bounds are inclusive at both ends; `boundedArrayAt` additionally validates its own arguments and throws a distinct programmer-error `Error` (not a `shapeError`) for invalid bounds.

**State transitions.** raw JSON → checkpoint-shaped → defensively cloned → normalized (with named normalization outcomes and writer-facing recovery notices) → current-shaped → semantically coherent → installed live. Failure at any stage aborts the whole session load; the file on disk is not overwritten, and rolling autosave pauses with `currentCheckpointError` recorded (`WorkshopSessionPersistenceCoordinator.ts:252-261`).

**Value created / harm prevented.** Value: a future widget author inherits one complete pattern rather than reverse-engineering two partial ones. Harm prevented: a semantically incoherent draft partially mutating the live room, and — over the longer arc — a third widget teaching the codebase that semantics belong in JSON shape checks.

**Legitimate exceptional states.** A recognized older draft that normalizes with notices (the Lexical v1-lens recovery notice is writer-facing prose). A session that fails validation and degrades to "start fresh, autosave paused, error logged" rather than losing the file.

### 4. Narrative Flow: Beginning, Development, Turn & Ending

**Beginning.** `WorkshopSessionStore.readCurrentWithRecovery` / `readNamedWithRecovery` reads a file and calls `decodeWorkshopPersistedSessionCheckpoint`.

**Development.** Envelope assert → `parseWorkshopSessionStateV1` (lenient checkpoint widget shape; defensive clone; aggregate integrity with `allowLegacyOpenSessionWithExcerpt: true` **and now** `skipWidgetDraftIntegrity: true`) → `normalizeWorkshopSessionCheckpointForHydration`, which routes each config through `recoverWorkshopWidgetConfigCheckpoint` → `assertCurrentWorkshopSessionStateV1` → `validateWorkshopSessionStateV1` with widget integrity on.

**Turn.** The commitment point is unchanged and remains `WorkshopSessionService.hydrateCommittedState`'s ledger `prepareState` installs (`WorkshopSessionService.ts:1774+`). Everything before it is preparation on clones; nothing observable is half-installed. What this MR moved is *where widget integrity sits relative to that point* — from parse ingress to post-normalization, still strictly before install.

**Ending.** The room appears with widgets restored and recovery notices surfaced; or the load aborts, the file is untouched, autosave pauses, and the writer starts fresh.

**Unresolved thread.** `WorkshopSessionPersistenceCoordinator.hydrate` (`:628-696`) re-parses the already-decoded state at `:637` with integrity skipped, then mints conversation ids via `importWorkshopConversationArchive` and renders standing-directive frames at `:657-663`, and only then calls `hydrateCommittedState` inside a try/catch that discards the minted ids on throw. In production this is harmless because the state arriving at `hydrate()` has already cleared full integrity one layer up. The thread is unresolved not as a defect but as a *legibility* matter: the ordering is safe because of a fact that lives in two call sites' provenance rather than in `hydrate()`'s signature or comment.

### 5. Codebase Genealogy & Controlling Precedent

**Closest ancestor — the aggregate's own phase split.** [Observed] `WorkshopSessionStateV1Shape.ts` (structural, exact-key, recursive) vs `WorkshopSessionStateV1Integrity.ts` (semantic, referential, on a defensive clone) already encode exactly this distinction one level up, documented in prose at `WorkshopSessionStateV1.ts:157-175`. This MR descends that precedent into widgets. That is the strongest lineage argument available in this repo: the pattern is not imported, it is inherited. **Distinguishing fact:** the aggregate split into two *files*; the widgets split into two function families inside one file, leaving `LexicalGravityConfigCodec.ts` at 1,085 lines.

**Controlling precedent for the registry shape.** [Observed] `WorkshopWidgetRecommendationOperations.ts:56-62` already holds a closed, frozen, widget-id-keyed dispatch record with near-identical framing ("The only generic-to-feature recommendation dispatch point… must supply one named entry and make this Record compile"). `shared/personas/personaSchematics.ts:40` states the repo's canonical form outright: closed `satisfies` catalog plus a companion test for what structural assignability cannot express. This MR follows both. Two deviations: it is not `Object.freeze`d, and it uses a mapped type rather than `Record<Id, Entry>` — the latter being a genuine capability gain (per-arm draft correlation), not restyling.

**Exhaustiveness convention.** The deleted file's `switch` was the odd one out; `satisfies` catalogs are already the house idiom. This MR migrates toward convention rather than away from it.

**Governing ADR.** [Observed] `docs/adr/2026-07-30-workshop-session-codec-evolution.md` was amended in `d964b021` ("docs(workshop): lock widget recovery runway") — *before* this commit — to describe delegating "recovery and semantic integrity to a closed registry of feature-owned codecs." So the ADR was pre-aligned; this MR implements a declared runway rather than silently superseding a decision. It correctly does not move `schemaVersion`: per the ADR and CLAUDE.md, that clock advances only when a Marketplace release changes persisted semantics or makes a formerly valid shape newly required.

**Scar tissue.** `WorkshopWidgetCheckpointRecovery.ts` lived three commits: born `dbcfc9e5`, hardened `3e4ff436` (itself a review remediation), deleted here. The `Shape`/`Integrity` pair it now mirrors was itself hardened in `25e313c2` after a prior review round. This lineage is review-driven, which is consistent with F-07 originating from review rather than design.

**New precedent this MR creates**, ranked by copy likelihood: (1) the whole lifecycle-registry module shape, including `lifecycleFor`'s `hasOwnProperty` + `as unknown as` lookup; (2) the four-verb vocabulary, whose prefix is mixed — three `assert*`, one `validate*`, with `validateIntegrity` bound to a function named `assert…Integrity`; (3) `boundedArrayAt`'s `label` parameter, three-way expectation phrasing, and self-validating bounds, which introduce a second error class into a file that otherwise funnels everything through `shapeError`; (4) `skipWidgetDraftIntegrity` as the second phase-control boolean on one validator; (5) an architecture test that hardcodes the persisted id list.

**Naming drift.** The lifecycle module imports `WorkshopWidgetDraftRecoveryResult` from a file still named `WorkshopWidgetCheckpointRecoveryContracts.ts` — the consumer was renamed away from "recovery," the contract file was not.

### 6. Structural & Causal Map

Four entry paths reach widget validation:

- **A — named/current restore.** `WorkshopSessionStore` → `decodeWorkshopPersistedSessionCheckpoint` (`WorkshopPersistedSession.ts:126-138`): parse (skip integrity) → normalize → assertCurrent → validate **with integrity**.
- **B — strict current parse / write gate.** `parseWorkshopPersistedSession` (`:205-211`), used by `WorkshopSessionStore.validateSessionForWrite` (`:921`): parse (skip) → assertCurrent → validate **with integrity**. Nothing incoherent is written back either.
- **C — live hydration.** `WorkshopSessionService.hydrateCommittedState` (`:1762-1774`): validate (skip, allow legacy) → normalize → assertCurrent → validate **with integrity** → ledger installs.
- **D — persistence coordinator.** `hydrate()` (`:628-696`): re-parse (skip) → `importDescriptors` → `ensureAssistantReady` → `importWorkshopConversationArchive` with rendered standing-directive frames → `hydrateCommittedState` in try/catch discarding minted conversation ids on throw. `hydrate()` is private with two call sites (`:248`, `:431`), both fed from `decodeWorkshopPersistedSessionCheckpoint`, whose returned `workshop` field is the already-normalized, already-integrity-validated state. So path D's skip is redundant in production, not load-bearing.

**Dependency direction.** Unchanged and inward-clean. `WorkshopSessionStateV1Shape` → registry → feature codecs; `WorkshopSessionStateV1Integrity` → registry → feature codecs. Feature codecs import nothing from the aggregate layer. The registry remains the single aggregate-layer module that names widget features, which is why `boundaries.test.ts` carries a per-file allowance for it.

**Type architecture, layer by layer.** (1) `PersistedWorkshopWidgetId = WorkshopWidgetConfigSnapshot['widgetId']` narrows from the catalog id to persisted arms — this is what makes the `prose-controller`-throws test meaningful rather than tautological. (2) The mapped type + `satisfies` buys build-time exhaustiveness, strictly stronger than the deleted switch's runtime `default: throw`. (3) Per-arm `Extract<…>['draft']` buys correlation: `'lexical-gravity'`'s `validateIntegrity` must accept `WorkshopLexicalGravityDraft`. (4) `lifecycleFor`'s `as unknown as` (`:126-136`) erases (3) at the runtime boundary. Because `assertCheckpointShape`, `normalizeForHydration`, and `assertCurrentShape` already take `unknown`, **`validateIntegrity` is the only operation the erasure actually loosens** — it widens a parameter position from a typed feature draft to `unknown`, which a single `as` would reject.

**What guarantees a current-shaped draft at the integrity call?** Nothing in the type system. Two runtime facts do it: every integrity-on call site pairs `assertCurrentWorkshopSessionStateV1` on the immediately preceding line (`WorkshopPersistedSession.ts:132-133`, `:208-209`, `WorkshopSessionService.ts:1772-1773` — three for three), and each `assertCurrent` runs per-config `assertWorkshopWidgetDraftShape`. Additionally, `WorkshopSessionStateV1Integrity.ts:257-263` passes `config.widgetId` and `config.draft` as *separate arguments*, discarding the discriminated-union correlation the snapshot type carried. That decorrelation is pre-existing for the shape asserts, but this MR extends it to the one operation whose implementation assumes a narrowed type.

### 7. Contracts, Invariants & Negative Space

**Preconditions.** `validateWorkshopWidgetDraftIntegrity(widgetId, draft, path)` requires `draft` to be current-shaped for `widgetId`; feature integrity functions dereference immediately without guarding (`LexicalGravityConfigCodec.ts:271-272`). Violating it produces a `TypeError`, not a path-labelled `shapeError`. `validateWorkshopSessionStateV1(state)` with integrity on requires the caller to have already run `assertCurrentWorkshopSessionStateV1`.

**Postconditions.** After integrity passes, every persisted widget draft is both structurally current and semantically coherent against its own referenced objects.

**Invariants.** No live aggregate installed from an incoherent draft. No file overwritten from a state that failed validation. No feature vocabulary inside `persistedValidation.ts`. The persisted widget set is closed and enumerated by the registry.

**Negative space — what this MR deliberately does not do.** No plugin API, runtime registration, generic schema DSL, or independent widget repository. No new public session schema version. No change to the writer-visible behavior of the Sprint 02B-B recovery routine. No movement of session persistence I/O or aggregate ownership out of `WorkshopSessionService` / `WorkshopSessionPersistenceCoordinator`. No implementation of Prose Controller. Reviewers should not manufacture scope from these; they are declared exclusions (sprint doc 161-171).

### 8. Forces, Tensions & Design Tradeoffs

**Closed registry vs. plugin API.** Closed is correct at two widgets and probably at five. A closed table buys build-time exhaustiveness that a runtime `register()` API structurally cannot — a plugin system's completeness check degrades to a startup assertion or a test. The cost is that the aggregate layer keeps naming features, paid for with one governed `boundaries.test.ts` exception. Good exchange.

**Compatibility-aware ingress vs. strict post-normalization boundary.** The substantive move. Before: one boundary at parse, so a recognized-but-stale draft had to either pass semantic checks it structurally could not satisfy, or the checks had to be weakened for everyone. After: lenient shape at ingress, strict semantics after repair. The cost is a widened window plus a `skipWidgetDraftIntegrity` option that must be passed correctly at four sites — and whose default (integrity on) is the safe one, while the *omission* risk runs the other way: a future read path that forgets to run integrity fails open silently.

**Shared mechanical grammar vs. feature-owned semantics.** F-09's promotion is uncontroversial and well-tested. F-07's split is the larger payoff and the thing that makes the codec copyable.

**Type discipline vs. runtime ergonomics.** The mapped type establishes per-arm correlation; the erased lookup discards it so the four exported entry points can accept the wider `WorkshopWidgetId`. Whether that width is required by callers is the sharpest open question in the change, because `WorkshopSessionStateV1Shape.ts:367-370` already narrows to the literal pair before calling.

**Strictness vs. proportionality.** Failing an entire session load over the semantics of a preview the next statement discards is the one place the design spends writer goodwill for reviewer-legible strictness.

**Alternate constructions.** (1) Drop the redundant re-parse at `WorkshopSessionPersistenceCoordinator.ts:637` and take the already-decoded state — removes the only place where an unvalidated pre-import state even *appears* to exist; costs a belt-and-braces. (2) Brand the output of `assertCurrentWorkshopSessionStateV1` and require the brand for integrity-on validation — makes the ordering invariant structural; costs a branded type threaded through aggregate signatures. (3) Pass the config rather than `(widgetId, draft)` to integrity — restores discriminated-union correlation and lets the erasure stay honest; costs the registry a dependency on the snapshot shape and diverges the integrity entry point from the two shape entry points, which genuinely only have a draft in hand. (4) Two registries, shape/recovery and integrity — each fully typed with no erasure; costs the single four-operation completeness witness, which is the change's best property.

### 9. Failure, Recovery & Operational Truth

Failure at any validation stage aborts the whole session load. `initializeOnce` catches, logs, pauses rolling autosave, and records `currentCheckpointError` (`WorkshopSessionPersistenceCoordinator.ts:252-261`); `openNamed` additionally captures and restores a rollback of `activeNamedSessionId` and friends (`:428, :438`). The file on disk is not overwritten. Path D's try/catch discards minted conversation ids; it does not undo `ensureAssistantReady` side effects, which appear inconsequential but were not traced.

**Diagnostics.** Errors are path-prefixed (`Workshop session state.widgetConfigs.wc-1.draft.preview.semanticPositions[0].roleId must be an id declared by the selected lens`), which is genuinely good for an author debugging a checkpoint. Two observability questions the panel should test rather than assume: whether a validation refusal is *writer-legible* (Output channel vs. a Workshop surface) and whether a writer whose autosave has silently paused knows it; and whether `boundedArrayAt`'s programmer-error `Error` (invalid bounds — e.g. the natural `Infinity` for "unbounded") is distinguishable at catch sites from a genuine corrupt-checkpoint `shapeError`, or whether a coding mistake would present to the writer as "your session is corrupt."

**Business rejection vs. technical failure.** Well separated in principle — `shapeError` for data, plain `Error` for programmer error and unknown widget ids — but the two classes converge at the same catch sites.

### 10. Security, Trust & Misuse Surface

Proportionality first: this is a single-user local VS Code extension reading JSON from the writer's own workspace. There is no tenancy, no authorization, no attacker-controlled remote input on this path. The realistic trust boundary is "a file on disk that may be corrupt, hand-edited, machine-migrated, or written by a different build," and the design's posture toward it — fail closed, never overwrite, never half-install — is correct. Existing size and nesting bounds (`WorkshopSessionStore.ts:694-696`) and `MAXIMUM_PERSISTED_JSON_DEPTH` remain in force. The one genuinely security-adjacent property worth checking is that no validation path can be induced to *write* a repaired-wrong state over a good file; paths A and B both suggest not. Reviewers should resist inflating anything here into a High severity without a concrete local vector.

### 11. Data, Time, Scale & Concurrency Horizon

Bounded document, single writer, validation once per hydration, `serializeSessionOperation` guarding concurrency. The added per-config integrity pass is O(configs × draft size) over an already-bounded document; the double validation in path D is free at this scale. Performance is not a live concern here and arguments framed as if it were should be discounted. The honest horizon pressures are structural, not numeric: a fifth read path choosing `skipWidgetDraftIntegrity` incorrectly; a sixth widget turning `WorkshopWidgetCheckpointNormalization` into an 18-member flat union in which every widget's normalization vocabulary is visible to every other widget's consumers; and, if sessions ever become importable across machines or writers, path D's "the decoder already validated" assumption being invalidated by a new ingress written against `hydrate()`'s signature.

### 12. The Change Genome: Variation & Reproduction

**Cousin feature:** Prose Controller (`sprints/03-prose-controller.md`), varying exactly one axis — *what the integrity phase is about*. Gesture's integrity is referential (selections ⊆ menu; keys unique and within budget). Lexical's is identity-and-reference (config-key agreement; ids declared by the lens). Prose Controller's declared integrity is **contradiction between independently-valid levers**: seven craft chapters of continuous dials whose individual values are all in range while the combination ("clipped cadence" plus "layered subordination") is incoherent. That is a genuinely different shape from "does this id exist in that list," which makes it a fair test of the seam.

**Contact points.**
- Union arm + registry entry — **Extension.** The mapped `satisfies` fails the build until registered. This is the mechanism working exactly as intended.
- `WorkshopSessionStateV1Shape.ts:367-370` — **Contradiction.** A second, independent closed list of the same two widgets, not derived from the registry, with nothing failing to compile when the registry grows. A Prose Controller draft would be accepted by the registry and rejected here. Sharper still: the very next function's directive-family enum at `:385-386` already names `prose-controller`, so the same file simultaneously knows and disowns the third widget.
- `WorkshopWidgetCheckpointNormalization` union — **Extension**, tolerable at three, pressure at six.
- The architecture test's `toEqual([...])` and `prose-controller`-throws case — **Fork by hand.** Expected for a witness, but the second case freezes a roadmap fact into an architecture test that will read as a regression when it is actually the feature landing.
- `persistedValidation.ts` — **Reuse**, with a caveat: Prose Controller's continuous dials will want numeric-range or stepped-enum grammar that does not yet exist. Adding it is inside declared negative space and fine; a contradiction *matrix* is not JSON grammar and must not leak in.
- Cross-build compatibility — **Fork risk.** No `schemaVersion` movement means a session written by a build with a `prose-controller` config, opened by a prior build, fails at `WorkshopSessionStateV1Shape.ts:367-370` for the whole session rather than the widget. Whether that matters is a product question about whether builds are ever mixed.

**Copy pressure already realized.** The source-reference serialized-character accounting exists verbatim in `GesturePlaygroundConfigCodec.ts:177-192` and `WorkshopGesturePlaygroundHandler.ts:700-725`, with a third, semantically different use of the same constant at `GesturePlaygroundRecommendation.ts:201` (per-string cap there, whole-list cap in the other two). This MR split shape from integrity but did not pull the handler's live-input validation onto the integrity function it now duplicates.

**Verdict on the genome.** The MR creates a genuinely generative pattern at the registry, and leaves one contradiction (the shape file's parallel list) that will surface precisely when the pattern is first exercised. Its narrowness is honest, not timid.

### 13. Comparative Models & Borrowed Vocabulary

**Strongest internal parallel — the aggregate's own `Shape` / `Integrity` pair.** Contributes the sharpest question: the parent split into two *files* with two boundary-guard entries; the children split into two function families inside one 1,085-line file. Was single-file deliberate, so the third widget's author sees a whole persisted contract in one place — or is a `LexicalGravityConfigIntegrity.ts` the intended next step?

**[Analogy] Design by contract.** Precondition, postcondition, invariant, frame condition. Contributes: `validateIntegrity`'s precondition ("draft is current-shaped") is real, load-bearing, and expressed nowhere except call-site adjacency. Design by contract's standing question — *who is responsible when a precondition is violated, the caller or the callee?* — is exactly the question the erased `(draft: unknown)` signature declines to answer.

**[Analogy] Software product lines / variability modeling.** Commonality, variation point, variant, binding time. Contributes: the registry is a well-formed variation point with compile-time binding; `WorkshopSessionStateV1Shape.ts:367-370` is an *unbound* second variation point over the same feature set. Variability modeling's core discipline is that a feature set should be enumerated once; this codebase enumerates it three times.

[No external citations. Web research was not run for this review; no published-source claims are made.]

### 14. Creative Counterfactuals

**Inversion.** Flip the flag: `withWidgetDraftIntegrity` opt-in rather than `skipWidgetDraftIntegrity` opt-out. The two skip sites become plain calls; the three integrity sites state their intent. The ordering invariant then reads "integrity is something you ask for after proving shape" rather than "integrity is on unless you remember to turn it off." Nothing else moves.

**Deletion.** Remove `LexicalGravityConfigCodec.ts:272-275` (the `applicationMode !== 'lexical'` guard for v1 lenses). Everything still compiles. `assertLexicalGravityDraftShape` explicitly permits a v1 lens (`:256-257`) alongside an optional current-shaped preview, and preview integrity dereferences `lens.logic.roles` through a `lens as WorkshopLexicalGravityLens` cast (`:377-386`). The only thing preventing a `TypeError` there is that the guard throws first — two unrelated conditions in two functions that happen to be complements. And no recovery-path fixture can produce the offending draft, because branch 1 of normalize hardcodes `applicationMode: 'lexical'` (`:543`). The guard is load-bearing for null safety and is not documented as such.

**Time-lapse.** Six widgets, eighteen months: an 18-member flat normalization union; the `as unknown as` seam copied into a second registry because the erased interface is convenient; the shape file's `!==` chain grown to six and eventually forgotten, shipping a widget the registry accepts and the shape layer rejects. The pressure at that point is the schema DSL this sprint deliberately refused — and the refusal will still be right. The cheap insurance is deriving the shape file's list from `persistedWorkshopWidgetLifecycleIds()` now, while there are two entries and the duplication looks harmless.

**Boring alternative.** Keep the switch; add a third case per operation; add a unit test asserting each persisted id is handled. That buys most of the runtime safety and none of the build-time exhaustiveness, and it is exactly what the MR is trading 154 lines to avoid. The trade is defensible; the panel should say whether it is *earned*.

### 15. Evidence Confidence & Unresolved Questions

**Repository-grounded.** The four read paths and their orderings; the registry's type layers and the erasure at `lifecycleFor`; the three-way enumeration of the persisted widget set; the shape/integrity split in both codecs; the test rename and its widened assertion; the `boundaries.test.ts` regex delta; the ADR pre-amendment in `d964b021`; the deleted file's three-commit lineage.

**Material inferences.** That path D's skip is redundant rather than load-bearing (rests on `hydrate()` being private with two provenance-known call sites). That the `applicationMode` guard is the sole null-safety barrier for the v1-lens preview path. That `boundedArrayAt`'s 500-character source-reference budget is unreachable given a max of 8 references at ~27 characters each.

**Competing interpretations.** Type-system rigor vs. type-system theater (§1). Strict-is-honest vs. strict-is-disproportionate for the discarded-preview integrity check (§2 Gap 2).

**Missing artifacts / not verified.** The claimed verification numbers (191 suites / 1,989 tests) were not re-run at `1094b1bb`. No interactive F5 acceptance. No live model calls. Whether any real checkpoint holds a shape this MR newly refuses. Where a validation refusal surfaces to the writer. Whether `ensureAssistantReady()` has effects outliving a failed hydration.

**Needs author or product confirmation.** Whether the discarded-preview strictness is intended policy. Whether the `Workshop…Draft` alternative added to the `boundaries.test.ts` regex is intentional forward permission or residue. Whether mixed-build session portability is a real scenario.

### 16. Past → Present → Horizon Synthesis

**Past.** Two widgets arrived under schedule pressure, each solving persistence locally. A prior review named the two habits that produced — semantics inside shape, grammar reinvented per feature — and deferred both to a sprint. The ADR was amended in advance to bless a closed registry of feature-owned codecs. The aggregate layer had already solved the same problem one level up, in two files, after its own review round.

**Present.** The MR descends the parent's phase split into the children and makes the phase *set* a compile-time obligation. It changes no rule and no writer-visible behavior; it relocates rules across a boundary and relocates one gate later in the pipeline, with the earlier gate's strictness now supplied by an outer caller. The type architecture is genuinely stronger than what it replaces at the registry, and genuinely weaker than it appears at the lookup. The persisted widget set is enumerated three times, and the compiler checks one of them.

**Horizon.** Next sprint exercises the seam. The registry will hold; the parallel list in the shape file will be the thing that bites, at exactly the moment the sprint's Reproduction Test claims it should not. Further out, the flag's polarity and the flat normalization union are the two shapes most likely to age badly, and the erased lookup is the construct most likely to be copied verbatim into the next closed registry someone writes.

### 17. Runway Synthesis Brief

**Invariants the implementation must preserve.** No live aggregate installed from a semantically incoherent draft. No file overwritten from a failed validation. Recognized prior drafts still recover, with writer-facing notices. No feature vocabulary in `persistedValidation.ts`. The persisted widget set is closed. Existing accepted data and existing error meanings unchanged by the F-09 promotion.

**Anchors.** `WorkshopWidgetPersistenceLifecycle.ts:54-87` (registry), `:126-136` (erased lookup). `WorkshopSessionStateV1Integrity.ts:25-30, 257-263`. `WorkshopSessionStateV1Shape.ts:367-370` and `:385-386`. `LexicalGravityConfigCodec.ts:222-241` (checkpoint branches), `:267-286` (draft integrity), `:512-613` (normalize), `:576-599` (semantic witness then discard), `:968-1002` (positions/dynamic integrity). `GesturePlaygroundConfigCodec.ts:47-72` (checkpoint vs current key sets), `:170-224` (integrity). `persistedValidation.ts:77-133`. `WorkshopSessionPersistenceCoordinator.ts:628-696`. `WorkshopSessionService.ts:1762-1774`. `WorkshopPersistedSession.ts:126-138, 205-211`. `boundaries.test.ts:345-352`. `__tests__/architecture/workshopWidgetPersistenceLifecycle.test.ts`. `WorkshopWidgetConfigs.test.ts:254-286, 476-487`.

**Tensions (real tradeoffs, not disguised defects).** Compile-time exhaustiveness vs. the runtime erasure that pays for it. Lenient ingress vs. a later strict gate. Fail-closed strictness vs. proportionality on discarded data. Single-file codec cohesion vs. the parent's two-file precedent. Closed registry vs. the third enumeration site it does not yet own.

**Unknowns.** Whether any real checkpoint is newly refused. Where refusals surface to the writer. Whether `Infinity`/invalid bounds errors are distinguishable at catch sites. Whether the `boundaries.test.ts` regex widening is intentional. Whether mixed-build portability matters. Whether the claimed test counts hold at head.

**Legitimate variation points.** The registry (by design). Per-widget integrity semantics — Prose Controller's contradiction rules are *supposed* to look nothing like Lexical's reference rules. New mechanical primitives in `persistedValidation.ts`, provided they stay domain-free.

**Predicted pressures.** Near: the third widget meets the shape file's parallel list. Middle: a fifth read path chooses the flag; the normalization union flattens further. Far: cross-machine session portability invalidates path D's provenance assumption.

**Questions for the panel (neutral).**
1. Is there any path — present or plausibly next — that reaches `validateWorkshopWidgetDraftIntegrity` without a prior current-shape assertion, and what does it produce if so?
2. Is the wider `WorkshopWidgetId` parameter on the four exported entry points required by any caller, or could narrowing to `PersistedWorkshopWidgetId` remove the `as unknown as` cast?
3. Should `WorkshopSessionStateV1Shape.ts:367-370` derive from `persistedWorkshopWidgetLifecycleIds()`, given `:385-386` already names the third widget?
4. Is failing a whole session load over the semantics of a preview that is immediately discarded (`LexicalGravityConfigCodec.ts:576-599`) intended policy?
5. Does the `applicationMode !== 'lexical'` guard at `:272-275` function as the null-safety barrier for the casts at `:377-386`, and is that relationship expressed anywhere?
6. Should `skipWidgetDraftIntegrity` invert to an opt-in, so a new read path must state its choice rather than inherit a default?
7. Does the `boundaries.test.ts` regex need the `Workshop(?:GesturePlayground|LexicalGravity)Draft` alternative, given no such token appears in the guarded file?
8. Now that integrity owns source-reference accounting, should `WorkshopGesturePlaygroundHandler.ts:700-725` call it rather than hold a third copy — and is `gestureSourceReferenceCharacters` a per-reference or whole-list cap?
9. What does a writer see when a session is refused, and do they know autosave has paused?

**Do not overread.** This is a local single-user extension: do not manufacture tenancy, authorization, or scale findings. The MR declares extensive negative space (no plugin API, no schema DSL, no `schemaVersion` change, no Prose Controller) — do not treat declared exclusions as omissions. The pre-existing literal pair at `WorkshopSessionStateV1Shape.ts:367-370` is inherited, not introduced; flag it only for the scope in which this MR makes it newly consequential. Performance is not a live concern on this path. And the runway's own reading of path D as "redundant, not load-bearing" is an inference from `hydrate()`'s privacy and two call sites — test it rather than adopt it.

---

# Part II — The Review

## Executive Briefing

**Verdict:** Merge-ready — no Blocking or High findings survived validation, and the four correctness hypotheses the panel was pointed at were each traced and disproven.

There is nothing here that must be fixed before merge. The panel produced ten Standard findings and three Nits, and the single most consequential one is a maintenance contradiction that will surface in the *next* sprint, not this one:

- 🟡 **F-01 · The persisted-widget set is enumerated three times** `🧭 Corroborated Runway` — the registry the sprint built to be the single closed source of truth is not consumed by the one production file that re-derives the same list by hand. Prose Controller will compile, register, and then be rejected at decode with "a widget with a persisted config codec." This is the sprint's own Reproduction Test failing, and this PR is the natural place to close it.

Everything else is follow-up-shaped. Blake, Tim, and Patricia each ran their lane to the end and reported no findings in it — a genuine result here, not a shortfall.

## Report Card

| Domain | Reviewer | Grade | Rationale |
| --- | --- | --- | --- |
| Architecture | Marcus 🏛️ | B+ | The seam is right and descends real precedent; it just never publishes the closure it establishes. |
| Critical Correctness | Blake 🔥 | A | Four hypotheses traced, four disproven. Write path still fails closed; no reachable null-deref; no bad-bounds vector. |
| Edge Cases | Sam 🔍 | B+ | Most side doors bolted, and Sam documented which. One real asymmetry between the two lifecycle arms. |
| Code Quality | Parker 📖 | B− | Behavior is right; the naming loses the exact distinction the sprint exists to draw, and the reference normalizer is a wall. |
| Tests | Cal 🧪 | B− | Real witnesses where it counts, but two sprint verification bullets are broader than the tests behind them. |
| Codebase Fit | Stan 🗂️ | A− | Migrates toward the house idiom, preserves error strings, updates both guard registries. One unearned guard permission. |
| Performance | Tim ⚡ | A | Twelve passes over a ≤10 KB draft, once per session open. Counted; it's nothing. |
| Security | Patricia 🛡️ | A | Write gate has parity, size/depth guards unbypassed, and the prototype-chain hazard of the rewrite was already closed. |
| Observability | Oliver 🌙 | B | The autosave-paused banner is better than feared; the failure-time message tells the wrong story and hides the good one. |
| Domain Logic | Bria 🎯 | B+ | Five of seven deliverables land cleanly and D4 is stronger than claimed. Two documentation claims outrun the code. |

## Findings

### F-01 · 🟡 Standard — The persisted-widget set is enumerated three times; the compiler checks one `🧭 Corroborated Runway`

**Raised by:** Marcus, Bria, Cal · **Discovery:** 3 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts:367` — `if (config.widgetId !== 'gesture-playground' && config.widgetId !== 'lexical-gravity') {`
**Affected contract:** Maintenance / architecture — single ownership of the persisted-widget variation point; Sprint 02D Deliverable 3 and the Reproduction Test

The MR's best property is that `WORKSHOP_WIDGET_PERSISTENCE_LIFECYCLES` makes the persisted set a build-time obligation. But the module publishes that knowledge in exactly one consumable form — `persistedWorkshopWidgetLifecycleIds()` — and its only consumer is the new architecture test. No production code reads it.

The consequence is structural. All four exported entry points are typed `widgetId: WorkshopWidgetId` — the full catalog union — when no caller passes anything wider than the two persisted arms. Because the entry point accepts a roadmap id and rejects it only at runtime, `assertWidgetConfig` hand-writes its own closed list plus a cast to the same literal pair, and `boundaries.test.ts:353-356` now formally sanctions the shape file as a feature-naming site. The duplication is institutional.

Trace the third widget. Prose Controller gains a union arm; the mapped `satisfies` correctly fails the build until a registry entry lands; `WorkshopSessionStateV1Shape.ts:367` still compiles unchanged and rejects every `prose-controller` config with *"a widget with a persisted config codec."* The same file already names `prose-controller` in its directive-family enum six lines later (`:385-386`) — it simultaneously knows and disowns the widget. Bria confirmed against the sprint text: the Reproduction Test promises "one deliberate union arm and closed-registry entry," and this is a second registration site it does not count.

Cal ran the same mutation from the test side and found the witness names the wrong file. `persistedWorkshopWidgetLifecycleIds()` returns `Object.keys(...)`, so the `expect(new Set(ids).size).toBe(ids.length)` assertion is unfalsifiable; and "exactly once per union arm" is genuinely enforced by `satisfies` at `:87`, which the test does not observe — it restates the same literal list a third time. On the Prose Controller mutation the test *would* fail, but on its hardcoded array, pointing at the registry rather than at the shape gate that actually broke.

Under Rule G the literal pair is inherited — only the import line changed here. It belongs in this PR because this is the commit that created the accessor, declared the registry the single closed enumeration, and wrote the Reproduction Test this site will falsify.

**Recommendation:** Export a registry-derived predicate (`isPersistedWorkshopWidgetId`) and have `assertWidgetConfig` call it instead of the literal chain — the lifecycle already fails closed on unregistered ids, so the guard buys only a differently-worded error. Then replace the architecture test's literal array with a derived assertion: iterate `persistedWorkshopWidgetLifecycleIds()` and assert each id clears the shape gate while a roadmap id does not. That single test fails loudly and correctly on the mutation above and retires both the tautology and the third copy.

### F-02 · 🟡 Standard — The two lifecycle arms disagree on whether `normalizeForHydration` proves its own postcondition

**Raised by:** Sam · **Discovery:** Runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundConfigCodec.ts:327-331` — `draft: cloneGesturePlaygroundDraft(normalized),` (no current-shape assertion) vs. `.../lexicalGravity/LexicalGravityConfigCodec.ts:550` — `assertLexicalGravityDraftShape(draft, 'Recovered Lexical Gravity draft');`
**Affected contract:** Maintenance — the four-verb lifecycle this sprint exists to make copyable

Both arms declare the same `normalizeForHydration` signature and model its postcondition differently. Lexical proves its output is current-shaped before returning, on both recovery branches. Gesture asserts only the lenient checkpoint shape on the way in and never re-asserts on the way out.

Sam walked it: not exploitable today, and the reason matters. `cloneGesturePlaygroundDraft` rebuilds an object literal from exactly the ten current keys and coerces `includeDictionaryInCommit` with `=== true`. The current shape is guaranteed — by the *clone* function, not by the lifecycle contract. That is an accidental guarantee sitting one function away from the one that promises it.

The path that makes it matter: the checkpoint gate is lenient by design and has already been widened twice (`includeDictionaryInCommit`, `sourceReferences`, each with a matching normalize predicate). Add an eleventh checkpoint-optional field, forget the corresponding line in `cloneGesturePlaygroundDraft`, and the field is silently dropped with nothing asserting otherwise — the aggregate's `assertCurrentWorkshopSessionStateV1` won't catch it either, because a missing optional field is exactly what current shape permits. Lexical's arm would fail loudly.

Worth noting in the author's favour: this MR *strengthened* Gesture's normalize input side. The pre-MR version took an already-typed draft, ran no checkpoint assertion, and returned the caller's own object unchanged when no normalization occurred. The new one takes `unknown`, asserts checkpoint shape, and always clones defensively.

**Recommendation:** Add `assertGesturePlaygroundDraftShape(normalized, 'Recovered Gesture Playground draft')` before the clone at `:328`, matching `LexicalGravityConfigCodec.ts:550`. One line, after which the four-verb contract means the same thing in both arms.

### F-03 · 🟡 Standard — The lifecycle's four operations are named three different ways across three layers

**Raised by:** Parker, Stan · **Discovery:** 1 independent · 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle.ts:93-107` — `export function assertWorkshopWidgetDraftShape(…) { lifecycleFor(widgetId).assertCurrentShape(draft, path); }` alongside `assertWorkshopWidgetDraftCheckpointShape`
**Affected contract:** Maintenance — the phase vocabulary this sprint exists to establish

The registry's internal keys name the phases honestly: `assertCheckpointShape` / `normalizeForHydration` / `assertCurrentShape` / `validateIntegrity`. The four exported entry points rename all four, and one rename drops the discriminating word. `assertCurrentShape` is exported as `assertWorkshopWidgetDraftShape` — no phase in the name — while its sibling keeps `Checkpoint`. The two are the arms of a single `if (checkpoint)` at `WorkshopSessionStateV1Shape.ts:371-375`, so a maintainer reads them side by side and infers the opposition is *checkpoint vs. generic* rather than *checkpoint vs. current*. The entire leniency argument of this sprint lives in that missing word.

Stan traced the `assert*`/`validate*` split and found the repo does have a meaning for `validate*`, and it isn't "integrity": `validateLexicalGravityDraft` and `validateLexicalGravityLens` each run shape *and* integrity, clone, and return a typed value — composite and value-producing. `assert*` means a single named phase, path-labelled, void, throws. `validateWorkshopWidgetDraftIntegrity` is neither composite nor value-producing, and it delegates to ten functions this MR itself named `assert…Integrity`.

Stan also named the fair counter-precedent, which is the strongest one available: the aggregate layer this MR descends pairs `assertCurrentWorkshopSessionStateV1` (shape) with `validateWorkshopSessionStateV1` (integrity). The registry is faithfully mirroring its parent while the feature codecs beneath it say `assert`. That is exactly the problem — the registry is where the two vocabularies meet, and it resolves the collision by using both and saying nothing.

Parker adds a type-layer instance of the same duplication: `WorkshopWidgetPersistenceLifecycleFor<Id>` and the erased `WorkshopWidgetPersistenceLifecycle` state the same four-operation fact twice, differing only in two parameter types. A fifth operation must be added in both, and nothing fails if you forget the erased one — undercutting the "omission is a build failure" property the module's own doc comment claims.

**Recommendation:** Rename the export to `assertWorkshopWidgetCurrentDraftShape` (or rename the registry key to `assertShape` and let the pair read `…DraftShape` / `…DraftCheckpointShape` deliberately) — either resolution, but state which word carries the phase. Rename `validateIntegrity` / `validateWorkshopWidgetDraftIntegrity` to `assertIntegrity` / `assertWorkshopWidgetDraftIntegrity` to match the ten functions it delegates to, and add one line to the registry doc comment recording that the aggregate's `validate*` means "composite pass" while widget-local `assert*` means "one named phase." Derive the erased interface from the typed one rather than restating it.

### F-04 · 🟡 Standard — "Unknown role, axis, or dynamic" is proven only for role

**Raised by:** Cal · **Discovery:** Runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:988` — `if (position.axisId !== null && !axisIds.has(position.axisId)) {`
**Affected contract:** Test contract — Sprint 02D's stated verification scope

The sprint's verification bullet reads "A Lexical preview citing an unknown role, axis, or dynamic is rejected by the integrity phase, not the raw JSON-shape phase." Cal searched the whole suite: `axisId` appears only as `null` or as the valid `'time'` / `'record-state'`. No fixture supplies an unknown axis. Two integrity rules are therefore unexercised in either phase — the unknown-axis check at `:988` and the `axisId`/`axisPosition` co-nullity rule at `:980`. Delete either line and every test in the repository still passes.

The dynamic case is exercised but not phase-attributed: `LexicalGravityConfigCodec.test.ts:466-467` asserts through `validateLexicalGravityDraft`, which runs shape *and* integrity in sequence, so it proves rejection without distinguishing which phase rejected. Only the role case gets the paired `assertLexicalGravityDraftShape(...).not.toThrow()` / `assertLexicalGravityDraftIntegrity(...).toThrow()` treatment at `:461-463` — which is exactly the right shape for a test of a phase split.

**Recommendation:** Extend the existing `:458` block, which already has `base` in hand, with two more mutations — an unknown `axisId` with a non-null `axisPosition`, and an `axisId`/`axisPosition` nullity mismatch — each asserted with the same shape-passes / integrity-throws pair, and re-assert the dynamic case through the split entry points. Four lines; three rules move from unproven to proven. Or narrow the sprint bullet to "unknown role."

### F-05 · 🟡 Standard — `validateIntegrity`'s current-shape precondition is positional, not typed

**Raised by:** Blake · **Discovery:** Runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopWidgetPersistenceLifecycle.ts:109-115` — `export function validateWorkshopWidgetDraftIntegrity(widgetId: WorkshopWidgetId, draft: unknown, path: string)`
**Affected contract:** Operational — error class and diagnostic quality at the checkpoint-failure catch site

Not reachable today, and Blake proved it rather than assuming it. All three integrity-on call sites place `assertCurrentWorkshopSessionStateV1` on the immediately preceding statement (`WorkshopPersistedSession.ts:132-133`, `:208-209`, `WorkshopSessionService.ts:1772-1773`), and that assertion runs per-config `assertWorkshopWidgetDraftShape`. There is no fourth caller in `packages/core/src` or `apps/`.

What makes it worth recording: the guarantee is positional. `lifecycleFor`'s erasure widens `validateIntegrity` from a typed feature draft to `unknown` — and because the other three operations already take `unknown` legitimately, this is the *only* operation the erasure loosens. A fifth read path that calls `validateWorkshopSessionStateV1(state)` without a prior `assertCurrent` compiles clean and produces `TypeError: Cannot read properties of undefined (reading 'version')` at `LexicalGravityConfigCodec.ts:272` instead of a path-labelled `shapeError`. That reaches the same catch as a corrupt checkpoint and presents to the writer as "your session is corrupt."

**Recommendation:** Follow-up, not this PR. State the precondition in a doc comment on `validateWorkshopWidgetDraftIntegrity`. Note that narrowing the parameter to `PersistedWorkshopWidgetId` does *not* remove the cast (see "What the Panel Changed About the Runway"), though it would remove the shape file's need to hand-narrow, which is F-01.

### F-06 · 🟡 Standard — Refusal moved to the far side of conversation import, and the preflight comment overstates its guarantee

**Raised by:** Bria · **Discovery:** Independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionStateV1.ts:159` — `Widget-local integrity waits until recognized prior drafts have normalized to current shape. Conversation import may safely happen only after the full hydrate preflight succeeds.`
**Affected contract:** The PR's "no intended writer-visible feature change" claim, for the writer whose session is refused

Before this PR, Lexical Gravity's preview semantics ran inside the checkpoint shape pass, so a preview citing an unknown `roleId` threw out of `parseWorkshopSessionStateV1`. The MR's own test change proves the shift: `WorkshopWidgetConfigs.test.ts:279-284` now lets `parseWorkshopSessionStateV1(state)` succeed and asserts the throw comes from `hydrateCommittedState`.

In `WorkshopSessionPersistenceCoordinator.hydrate()`, that preflight is line 641 and `hydrateCommittedState` is line 678. Between them sit `ensureAssistantReady()` (`:654`) and `importWorkshopConversationArchive` with rendered standing-directive frames (`:661`). A writer restoring a corrupt session now pays an assistant-readiness round trip and a full conversation import-then-discard cycle before seeing the same refusal. No corruption — the catch at `:690` discards the minted ids and the mutation-safety witness proves the room is untouched — but it is a real difference in the refusal experience. And the comment rewritten in this very PR now asserts a guarantee its own function defers two lines later.

Marcus independently established the mitigating fact: in production `hydrate()` is private with two call sites, both fed from `decodeWorkshopPersistedSessionCheckpoint`, whose returned `workshop` field is the already-normalized, already-integrity-validated state. The second parse is redundant, not load-bearing.

**Recommendation:** Correct the comment at `:155-160` to say what the preflight now covers and what it defers — that belongs in this PR. Separately consider dropping the redundant re-parse at `WorkshopSessionPersistenceCoordinator.ts:637` in favour of the already-decoded state, which would remove the only place an unvalidated pre-import state even appears to exist; that is a fair follow-up.

### F-07 · 🟡 Standard — The restore-failure banner names a read error for a semantic failure and withholds the diagnostic

**Raised by:** Oliver · **Discovery:** Runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/WorkshopApp.tsx:903-909` — `Automatic recovery is paused because <code>current.json</code> could not be read.`
**Affected contract:** Operational — writer-facing diagnostics

Oliver traced the good news first, and it materially reduces the worst-case worry: a writer whose autosave silently paused *is* informed. `isCurrentCheckpointProtected()` feeds a persistent `role="alert"` banner rendered on every Workshop paint, and a second banner fires on the first mutation afterward carrying the actual error text. The `openNamed` path reaches `postActionFailure('open', error)` with its message intact.

What is not covered is the accuracy of the first thing the writer reads. When a widget draft fails integrity, the throw reaches `initializeOnce`'s catch, which records `currentCheckpointError` and appends the full path-prefixed message to the Output channel. The webview then shows exactly one thing: *"current.json could not be read."* The file was read. It parsed. It cleared envelope, shape, clone, and aggregate integrity. What failed was a semantic rule about one widget's draft — and the excellent message (`…widgetConfigs.wc-1.draft.preview.semanticPositions[0].roleId must be an id declared by the selected lens`) is never shown, while the sibling banner eleven lines away both shows error text and falls back to *"Check the Prose Minion output for details."*

The wording is inherited from Sprint 02B-B. It belongs here by proportion: this MR is what makes semantic integrity a named first-class phase of restore, so the probability that this banner fires for a non-read reason went up.

**Recommendation:** Surface `currentCheckpointError` in the `currentCheckpointProtected` banner the way the save-status banner does, and soften the cause to "could not be restored." One template change; the state is already on the message.

### F-08 · 🟡 Standard — Recovery logging discards the widget and config identity its sibling notice carries

**Raised by:** Oliver · **Discovery:** Independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:952-956` — `` `[WorkshopSessionPersistence] Development checkpoint normalized ` + `(normalizations=${normalizations.join(', ')})` ``
**Affected contract:** Operational — diagnosability of a *successful* recovery

The parallel structure tells the story. `WorkshopWidgetRecoveryNotice` carries `code`, `widgetId`, `configId`, and `message`, and that identity survives to the writer's toast. The normalization list travelling beside it in the same result object is bare strings, run through `unique()` before logging. A room with two `lexical-gravity` configs where both drafts were repaired logs one line: `normalizations=recovered-widget-lexical-gravity-v1`. Which config? Unknowable.

Worse, the codes that emit no notice at all — `defaulted-widget-lexical-gravity-evidence-mode` is silent — are exactly the ones where the log is the sole evidence a mutation happened. A writer reports "my Lexical Gravity widget came back in a mode I didn't set"; the author has a log line naming the widget but not which config, and no before/after.

Inherited shape — the deduped join predates this MR. It becomes newly consequential because this MR makes per-widget normalization a permanent, registry-guaranteed phase every future widget must implement.

**Recommendation:** Log widget normalizations per config — `(configId=wc-1, widgetId=lexical-gravity, normalizations=…)` — and drop `unique()` for the widget-scoped subset. Follow-up is acceptable; do not let it wait for the third widget.

### F-09 · 🟡 Standard — The architecture guard permits two feature tokens that appear nowhere in the guarded file

**Raised by:** Stan · **Discovery:** Runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:348` — `allowedToken: /(?:Workshop(?:GesturePlayground|LexicalGravity)Draft|…`
**Affected contract:** Architecture guard — reviewability of feature vocabulary in generic paths

Verified: `WorkshopGesturePlaygroundDraft` and `WorkshopLexicalGravityDraft` do not appear in `WorkshopWidgetPersistenceLifecycle.ts`. The module imports `WorkshopWidgetConfigSnapshot` and derives drafts via `Extract<…>['draft']` — deliberately avoiding naming the feature types, which is the better design and the reason the permission is unnecessary.

The rest of the regex delta is earned: widening `Draft(?:Checkpoint)?Shape` to `Draft(?:CheckpointShape|Integrity|Shape)` covers the genuinely new integrity imports. The `Workshop…Draft` alternative is residue, most likely from an earlier draft of the registry that named the types directly.

Stan was precise about blast radius rather than inflating it: `matchesApprovedFeatureToken` anchors with `^(?:…)$`, so this admits exactly two tokens, not a prefix family. The cost is not exploitability — it is that this list's stated job is "a new generic owner cannot silently acquire feature vocabulary just because its path never names that feature." The adjacent entry for `WorkshopSessionStateV1Shape.ts`, written the same day, carries no such alternative; that is the minimality standard in this very list.

**Recommendation:** Drop the `Workshop(?:GesturePlayground|LexicalGravity)Draft|` alternative. If it was deliberate forward permission, record that in the entry's `reason:` field, which exists for exactly this.

### F-10 · 🟡 Standard — `normalizeLexicalGravityDraftForHydration` cannot tell its own story `🧭 Corroborated Runway`

**Raised by:** Parker, Marcus · **Discovery:** 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:576-584` — `const semanticWitness = { ...priorDraft, evidenceMode: 'blend' as const, preview: { ...preview, configKey: currentIdentity } } as WorkshopLexicalGravityDraft;`
**Affected contract:** Maintenance — this is the file Prose Controller's author will copy

101 lines, three fall-through branches distinguished only by their conditions and never named, and a local called `semanticWitness` whose purpose — fabricate a draft that could not exist on disk, purely so an integrity function has something well-formed to judge — appears nowhere in the code. The comment that does exist explains the *discard* eleven lines later, which is the easy half; the synthesis is the half that needs explaining and is silent.

Three concentric symptoms of one representation problem. **Three config-key functions differing only in arity** (`lexicalGravityConfigKey` 6 values, `…PreEvidenceConfigKey` 5, `…LegacyV1ConfigKey` 4) — the knowledge "a config key is the identity fields joined by `|`" is written three times, so a seventh identity field means finding all three and deciding per call site. **Cast chains standing in for named types** — `checkpoint as unknown as Omit<WorkshopLexicalGravityDraft, 'evidenceMode'>` appears verbatim twice; that *is* the prior draft shape and deserves a name. **Branch bodies that say what they do but not what they are** — "a v1 lens with no modes at all," "a pre-evidence-mode draft," "already current."

Marcus reached the same code from the architecture side, reading the witness as the recovery phase borrowing the integrity phase's authority over a value it has already decided to discard. **Blake narrowed the scope decisively:** the pre-MR `assertLexicalGravityDraftShape` already called `assertCurrentLexicalGravityPreview(draft, path)`, so the strictness is *relocated, not introduced* — any severity attached to the policy itself belongs to a prior sprint. What remains actionable is legibility, and both reviewers land on the same repair.

**Recommendation:** Comment the witness in this PR — *"a synthesized current-shaped draft whose only purpose is to let integrity judge the preview's semantics; it is never returned"* — and if the strictness is deliberate whole-file-trust policy, say so there too. As follow-up: name the recognized prior shapes as types, give the config-key trio a shared root that makes the versioning visible, and split the body into `recoverLegacyV1LensDraft` / `defaultEvidenceModeOnPriorDraft` so the top level reads as three guarded returns.

### F-11 · 🔵 Nit — A bare `catch` reports every renderability failure as "directive too long" `🎯 Consensus`

**Raised by:** Sam, Oliver · **Discovery:** 2 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:1019-1026` — `} catch {` … `` `a lens whose reach-3 directive fits within ${BUDGET.lexicalDirectiveCharacters} characters` ``
**Affected contract:** Operational — diagnostic honesty

The catch is unqualified and unbound, so any throw from the renderer is reported as a length-budget failure with the original discarded. A writer whose project lens file is refused would shorten prose that was never the problem; an author debugging it measures the directive, finds it well under budget, and has nothing else. Reached from `LexicalGravityLensRepository` (lens files on disk) and `LexicalGravityModelService` (model output), and now duplicated in the legacy-v1 arm.

Relocated by this MR rather than introduced — it moved out of the shape pass into integrity with identical reachability. Flagged because the point of the split is that integrity errors are the legible ones, and this is the one that lies. Low severity because the budget cause is by far the likeliest.

**Recommendation:** Bind the error and append its message, or check the rendered length directly and let anything else propagate. Same edit in both arms.

### F-12 · 🔵 Nit — The renamed `it.each` proves neither half of its new name

**Raised by:** Cal · **Discovery:** Runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/__tests__/application/services/workshop/WorkshopWidgetConfigs.test.ts:481-483` — `new WorkshopSessionService(() => 10_000).hydrateCommittedState(`
**Affected contract:** Test contract

The rename from *"rejects $label at persistence ingress"* to *"rejects $label before live hydration"* was necessary — the gesture relationships moved into integrity, so the old assertion would fail. Accommodating a deliberate phase move is legitimate. The accounting is uneven. **Lost:** the old body pinned rejection to the decode boundary, a genuinely stronger contract. The new body wraps decode and hydrate in one `expect`, so it cannot say which phase rejected and would pass unchanged if all five rules migrated back into raw shape. **Not gained:** the new name's claim — the body constructs a *fresh* service, so there is no prior state to preserve and nothing compared.

The test 200 lines above does both correctly: it calls `parseWorkshopSessionStateV1` *outside* the `expect` (real phase attribution) and asserts `exportCommittedState()).toEqual(before)` against a pre-populated session.

**Recommendation:** Follow the pattern at `:254` — hoist the parse out of the `expect` and hydrate into the pre-populated `session` with a `before` snapshot. Four lines, applied once, upgrading five cases.

### F-13 · 🔵 Nit — `boundedArrayAt`'s `label` names the JSON type at eleven call sites and contradicts the path at one

**Raised by:** Parker · **Discovery:** Runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts:199` — `boundedArrayAt(item.cliches, \`${path}.cliches\`, 1, BUDGET.lexicalCliches, 'contrasts');`
**Affected contract:** Operational — the diagnostic text shown when a checkpoint is refused

Read the messages aloud. `…logic.axes must be an array of 2–4 axes` ✅. `…draft.menu must be an array of 4–6 groups` ✅. `…draft.selections must be an array of 1–8 strings` — the label names the JSON type, not the thing, and all eleven `assertBoundedStrings` call sites inherit it, so `guardrails`, `foregrounds`, and `gradient` all report as anonymous "strings." `…cliches must be an array of 1–8 contrasts` — the label contradicts the path; the reader is told to look at `cliches` and given a count of `contrasts`.

Separately, the `minimum === maximum` branch pluralizes unconditionally. No current call site passes `(1, 1)`, but the branch exists for exact-arity fields and the first one that wants exactly one item prints `an array of 1 strings`. Worth a beat now, while the helper has six callers instead of sixty.

**Recommendation:** Rename the parameter `itemNoun`, document that it names domain items rather than JSON types, and thread the real noun through `assertBoundedStrings`. Make `cliches`/`contrasts` agree. Phrase the exact-arity branch `exactly ${minimum} ${label}` or singularize it.

## Praise

- **P-1 · `🎯 Consensus` (Blake, Bria) — the corruption test asserts the invariant, not the mechanism.** `WorkshopWidgetConfigs.test.ts:285` snapshots committed state before and asserts `expect(session.exportCommittedState()).toEqual(before)` after the throw, at two sites. Moving validation later in a pipeline is exactly the change that historically buys partial mutation; this asserts the writer-facing all-or-nothing property directly, and it survives any future refactor of *where* integrity runs. Copy it into Prose Controller's first integrity test.
- **P-2 (Marcus) — the widget phase split descends the aggregate's own precedent.** `WorkshopSessionStateV1Shape.ts` / `WorkshopSessionStateV1Integrity.ts` already encode this distinction one level up. Pushing the identical vocabulary down rather than inventing a widget-specific one is what makes the pattern copyable by someone who has read only one of the two.
- **P-3 (Stan) — the rewrite carried its conventions.** `Unsupported persisted Workshop widget:` survived a full switch→registry rewrite byte for byte, and the module rename was propagated through *both* `boundaries.test.ts` registries — including `PROSE_CONTROLLER_GENERIC_SEAM_ENTRIES`, the machinery that makes the Reproduction Test checkable at all. A rename that silently dropped that entry would have quietly disarmed it.
- **P-4 (Sam) — the split re-anchored rules for its non-persistence callers.** Pulling uniqueness, axis-pole distinctness, and renderability out of `assertLexicalGravityLensShape` would have silently *deleted* all of them for `LexicalGravityLensRepository` (lens files on disk) and `LexicalGravityModelService` (model output), which never touch the session codec — and no persistence test would have failed. Sam checked every caller: zero rules lost.
- **P-5 (Tim) — set-based integrity hands the next widget a linear precedent.** Both integrity families pre-build `Set`s rather than scanning inside loops, staying O(n+m). Prose Controller's declared integrity is pairwise contradiction checking, which is exactly where a naive nested scan appears and stops being free.
- **P-6 (Patricia) — the prototype-chain hazard of the rewrite was already closed.** A `switch` compares values, so a `widgetId` of `"constructor"` from a JSON file could never resolve. Replacing it with a dynamic object index reintroduces the prototype chain, and a naive `if (!registry[widgetId]) throw` would have sailed past. The `Object.prototype.hasOwnProperty.call` form is correct for `"constructor"`, `"toString"`, and `"__proto__"` alike, and survives a registry that ever gains a `hasOwnProperty` key.

## What the Panel Changed About the Runway

**Affirmed.** The phase relocation moved the gate to the right owner — integrity after normalization is the only ordering under which a recognized older draft can be repaired before it is judged. No production path reaches widget integrity without a prior current-shape assertion (Blake and Sam traced this independently). The write gate retains parity: all four write entry points funnel through one validator running full integrity, and Patricia confirmed there is no fifth. The runway's insistence that performance is not a live concern was affirmed by Tim after he counted the passes.

**Refined.** The runway framed the discarded-preview strictness (§2 Gap 2) as something this MR establishes; Blake showed the pre-MR shape pass already ran preview validation on the same about-to-be-discarded data, so it is relocated, not introduced. Stan defended `skipWidgetDraftIntegrity` against the runway's implicit "boolean soup" framing: it is a second member of a documented named options interface, which is the repo's own antidote to boolean soup — the polarity question remains legitimate design discussion, but it is not a convention deviation. Oliver resolved §9's two observability questions asymmetrically: the writer *does* know autosave paused, better than the runway feared, but the refusal message is misleading. Sam relocated the runway's fragility claim one level down — the unproven invariant is not the call-site ordering but Gesture's normalize postcondition.

**Rejected.** The runway's Q2 suggested narrowing the entry points to `PersistedWorkshopWidgetId` "could remove the `as unknown as` cast." Marcus refuted this on type theory: indexing a two-arm registry with a union-typed key yields a union of function types whose callable parameter position is the *intersection* of the arms' drafts — `GesturePlaygroundDraft & LexicalGravityDraft`, uninhabited. The erasure is structural to any runtime-keyed lookup, and the module's comment at `:58` is honest about it. What narrowing *would* fix is the parameter width that forces the shape file's hand-written list — which is F-01, a different problem with a different repair. Stan also retracted three of his own briefed suspicions on evidence: `Object.freeze` (the repo's two precedents disagree with each other, so there is no convention to cite), the stale `WorkshopWidgetCheckpointRecoveryContracts.ts` filename (its *contents* still export recovery types, so the name matches), and the 1,085-line codec (1,022 before this commit; inherited under Rule G).

**Still unknown.** Whether any real development checkpoint holds a shape this MR newly refuses. Whether the `Workshop…Draft` guard alternative was intentional forward permission. Whether the claimed 1,989-test count holds at head (suite count verified at 191; the suite was not run). Whether mixed-build session portability is a real scenario.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A fact is single-sourced only where the compiler can count

**Illuminated by:** F-01 (Marcus, Bria, Cal), F-09 (Stan), P-3 (Stan)

The set of persisted widgets is written down three times, and exactly one of those can fail a build. The other two are *descriptions* of the truth wearing the costume of the truth — a hand-written literal in the shape gate, an array in the guard test — and the moment they drift, the failure surfaces as a wrong-sounding rejection rather than a red compile. Note that the sprint even shipped the derivation (`persistedWorkshopWidgetLifecycleIds()`) and then left it unconsumed: the single source existed, but nothing downstream was made to drink from it.

**Carry forward:** When you write a registry, immediately grep for every other place the same set is spelled out — and for each one ask "if I add a member here only, what turns red?" If the answer is "nothing," that site is a comment, and it should either consume the registry or stop claiming to know the set.

### Lesson — A guarantee that lives one function away is a coincidence with good manners

**Illuminated by:** F-02 (Sam), F-05 (Blake), F-06 (Bria), F-10 (Parker, Marcus)

Four findings share one shape: a contract that holds today because of where code happens to sit. Gesture's normalizer returns a current-shaped draft because a clone function next door enumerates the right ten keys. `validateIntegrity`'s precondition holds because three call sites each put the assertion on the immediately preceding line. A doc comment promises a preflight its own body defers two lines later. Each is correct; none is *enforced*. Proximity is the weakest form of invariant, because it degrades silently — nothing breaks when the distance grows, which is precisely why the distance grows.

**Carry forward:** When you find yourself writing "this is safe because the caller already…", write the assertion instead of the sentence — or, where the type system can carry it, return a type only the checked path can construct.

### Lesson — Precision is only real at the boundary where it is consumed

**Illuminated by:** F-03 (Parker, Stan), F-07 and F-08 (Oliver), F-11 (Sam, Oliver), F-13 (Parker)

This sprint's whole purpose was to establish a phase distinction, and the vocabulary is crisp at the registry keys and degrades at every boundary it crosses. The export drops the word "Current," the very distinction being built. The path-prefixed error message is excellent and never reaches the writer, whose banner blames a file read that succeeded. The recovery log knows the config id and doesn't carry it, while its sibling notice does. The bare `catch` knows the real error and reports a guess. Information isn't preserved by existing somewhere in the system; it's preserved by surviving the *last* hop to whoever needs it.

**Carry forward:** For any distinction you introduce, trace one concrete instance all the way out — to the exported name, to the user-visible string, to the log line — and check it is still legible at the far end. If it isn't, the split exists only inside the module that made it.

### Lesson — A test for a seam must be able to fail on the seam

**Illuminated by:** F-04 and F-12 (Cal), against P-1 (Blake, Bria) and P-4 (Sam)

The unknown-role test proves the phase: shape passes, *then* integrity throws. That is the shape of a test for a split. Its neighbours don't — no fixture supplies an unknown axis, so deleting the axis rule leaves the suite green; and the renamed `it.each` wraps decode and hydrate in one `expect`, proving something rejected without proving which phase or that live state survived. Compare P-1, which asserts the writer-facing invariant itself. When the point of a change is *where* a rule fires, a test that only asserts *that* something failed is agnostic to the entire change.

**Carry forward:** For each new rule, ask the delete test: "if I remove this right now, what goes red?" And for each phase boundary, make the assertion straddle it — the earlier phase passes, the later one throws.

*The four lessons are really one viewed from four sides: this sprint spent its effort making a distinction real, and every finding marks a place where the distinction is true but not yet load-bearing — which is exactly the work a third widget will turn from an intention into a pattern.*

## Horizon Watchlist

None of these are merge blockers. They are pressures the runway and panel supported but that do not warrant action now.

- **The third widget is the seam's first real test.** F-01 predicts precisely where it bites. Everything else about the registry should hold.
- **`WorkshopWidgetCheckpointNormalization` is a flat union of every widget's normalization vocabulary.** Tolerable at three arms; at six, every widget's consumers see every other widget's codes.
- **`skipWidgetDraftIntegrity` fails open when omitted.** Two call sites today. The fifth read path is the moment to consider inverting the polarity or replacing it with a named phase enum — Stan's defense of the options-interface shape stands either way.
- **Path D's "the decoder already validated" guarantee lives in call-site provenance.** If Workshop sessions ever become importable across machines or writers, a new ingress written against `hydrate()`'s signature is the thing most likely to invalidate it quietly. Patricia noted the same horizon reaches `readSessionFileForBrowser`, which checks size but not nesting depth before `JSON.parse`.
- **`widgetConfigs` is validated with unbounded `arrayOf` while every array inside a draft is bounded** (Tim). Costs nothing while configs arrive only from a human clicking.
- **The source-reference character accounting now exists in three places** with two different meanings for `gestureSourceReferenceCharacters` — a whole-list cap in the codec and handler, a per-string cap in the recommendation path. Worth settling before a fourth copy.

## The Closer

🔮 **Fortune cookie**

> You built the room a single door and a compiler to guard it. Two other doors remain, and neither has been told the guard exists.

## Final Assessment

Merge-ready. No Blocking or High findings survived validation, and the four correctness hypotheses the panel was pointed at were each traced to source and disproven — the write gate still fails closed, the v1-lens null-dereference is unreachable, no bad-bounds vector exists, and no production path reaches integrity unshaped. The design is sound and its lineage is honest: it descends a precedent the codebase already owned rather than importing a new one, and its type discipline is genuinely stronger than the switch it replaces.

What the panel found is a change that is *true but not yet load-bearing* in several places. Three fixes are cheap enough to fold in before merge and would materially improve what the next sprint inherits: consume the registry at `WorkshopSessionStateV1Shape.ts:367` (F-01), assert Gesture's normalize postcondition (F-02, one line), and correct the preflight comment that now overstates its guarantee (F-06). The naming settlement (F-03) and the axis test (F-04) are worth doing before Prose Controller copies this file, in this PR or immediately after. Everything else is honest follow-up.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
