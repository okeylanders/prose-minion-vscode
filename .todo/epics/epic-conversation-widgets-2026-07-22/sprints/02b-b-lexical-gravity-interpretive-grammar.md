# Sprint 02B-B: Lexical Gravity Interpretive Grammar

**Status**: Planned — ADR proposed 2026-08-01
**Priority**: High — gate before other widget behavior sprints
**Branch**: `sprint/conversation-widgets-02b-b-lexical-gravity-interpretive-grammar` -> stacked on Sprint 02B-A until PR #99 merges, then retarget to `epic/conversation-widgets`
**Estimated Effort**: 5-8 days
**Depends on**: Sprint 02B-A
**ADR**: [2026-08-01 — Lexical Gravity Interpretive Grammar](../../../../docs/adr/2026-08-01-lexical-gravity-interpretive-grammar.md)

## Goal

Replace Lexical Gravity's word-field-shaped lens contract with a versioned,
strictly validated **interpretive grammar**. A lens must tell the model what the
domain notices, how it positions scene elements, which state changes belong to
the domain, and what those changes imply. The existing word field becomes the
last-mile realization layer.

This sprint establishes that foundation before Prose Controller, lens blending,
or another widget copies the current representation.

## Locked decisions

- `WorkshopLexicalGravityLens.version` advances from `1` to `2`; there is no
  optional-logic v1/v2 runtime union.
- The required `logic` object contains premise, foreground/background attention,
  semantic axes, roles, dynamics with entailments and narrative affordances, and
  guardrails. The ADR owns the field grammar.
- Semantic positioning of actual scene elements is transient derived work. It is
  returned by Preview for inspection but is not stored in the reusable lens or
  committed widget config.
- Existing degree/POS fields, gradient, substitutions, clichés, metaphor, and
  sample remain as lexical realization data.
- The directive applies lens logic before selecting lens vocabulary. It may
  create open narrative pressure only when grounded in existing scene facts and
  a meaningful character concern.
- Weight remains influence strength/frequency; reach remains lexical distance;
  metaphor pull remains permission for explicit comparison. None is repurposed
  as a consequence score.
- Preview returns a strict composite artifact: concise positioning, selected
  dynamic, open entailment, and rewritten prose. No private reasoning is
  requested or displayed.
- The UI gains a first-class **Lens Logic** view before Word Field. The writer can
  inspect what the lens foregrounds, its axes, its dynamics, and their
  entailments before installing it.
- Prompt budgets are measured from worst-case valid v2 fixtures. Do not simply
  raise the standing-directive budget until the renderer proves the required
  bound.
- V1 project lens files remain untouched and are reported with an actionable
  regeneration message. No heuristic or model call happens during repository
  load or session hydration.

## Delivery sequence

### 1. Contract fixtures before production edits

- Hand-author Photography and Music v2 fixtures.
- Exercise one shared passage under v1 and v2 prompt sketches.
- Record whether the v2 result still changes attention/relationship when obvious
  field words are removed.
- Use those fixtures to settle bounds and exact validation errors before changing
  persisted production types.

### 2. V2 type and codec

- Add the exact `WorkshopLexicalGravityLensLogic` types to `@messages`.
- Replace the v1 lens validator with exact v2 validation: keys, bounds, tuple
  length, unique ids, collection cardinality, and defensive cloning.
- Add the new prompt-budget constants and architecture-witness coverage.
- Convert all six built-in lenses to v2 and prove each validates and renders
  within budget.
- Update repository load/save and explicit v1 incompatibility reporting.

### 3. Lens-builder protocol

- Advance the system prompt and sentinels to `LEXICAL_GRAVITY_LENSES_V2`.
- Require three genuinely distinct interpretive grammars, not three renamed word
  palettes.
- Parse and validate atomically; no partial candidate with missing logic reaches
  the UI or project repository.
- Retain origin-query metadata and multi-select save behavior from Sprint 02B-A.

### 4. Standing directive

- Render premise, attention, axes, roles, and a bounded set of dynamics and
  entailments before lexical anchors.
- Instruct semantic positioning -> one fitting dynamic -> lexical realization in
  that order.
- Preserve the orthogonality wall: dormant during analysis/conversation and
  active only while composing or revising passage prose.
- Preserve facts and allow a no-op when the scene offers no honest mapping.

### 5. Inspectable preview and UI

- Advance Preview to a strict v2 composite response.
- Add writer-facing Lens Logic and Preview Interpretation regions.
- Keep generated positioning ephemeral and bounded.
- Invalidate cached v1 previews when lens schema/config changes.

### 6. Documentation and tests

- Update the case-study language from word field alone to interpretive grammar +
  semantic positioning + lexical realization.
- Update the Sprint 04 blend plan so dominance layers interpretive grammars.
- Add codec, repository, parser, directive, UI, round-trip, budget, and
  architecture tests.

## Primary files

- `packages/core/src/shared/types/messages/workshop.ts`
- `packages/core/src/shared/constants/promptBudgets.ts`
- `packages/core/src/application/services/workshop/lexicalGravity/LexicalGravityConfigCodec.ts`
- `packages/core/src/application/services/workshop/lexicalGravity/LexicalGravityLenses.ts`
- `packages/core/src/application/services/workshop/lexicalGravity/LexicalGravityDirective.ts`
- `packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts`
- `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts`
- `packages/core/resources/system-prompts/lexical-gravity/00-build-lens.md`
- `packages/core/resources/system-prompts/lexical-gravity/01-preview.md`
- `packages/core/src/presentation/webview/components/workshop/WorkshopLexicalGravityModal.tsx`

## Out of scope

- A consequence meter, score, or persisted scene-charge ledger.
- Multi-lens blending.
- Prose Controller implementation.
- Automatic migration or rewriting of user-owned v1 project resources.
- Changes to persona identity, expression calibration, or conversation behavior.

## Completion criteria

- Every built-in and project-generated lens has validated v2 interpretive logic
  plus its lexical realization field.
- A writer can inspect how a lens organizes attention and possible movement
  before installation.
- Preview identifies grounded semantic positions and a chosen dynamic separately
  from the rewritten prose.
- The Photography acceptance fixture creates an attention relationship or open
  entailment that remains legible after conspicuous photography words are
  removed.
- Low and high weight differ in influence intensity, not invented stakes;
  changing reach affects lexical specificity without disabling lens logic;
  metaphor-off still applies the interpretive grammar.
- A lens that cannot map honestly may produce a semantic no-op rather than
  inventing scene facts.
- V1 resources fail with an exact, actionable message and are not modified.
- Round-trip persistence reconstructs the exact v2 standing frame.
- Typechecks, lint, builds, architecture witnesses, and affected tests pass.

