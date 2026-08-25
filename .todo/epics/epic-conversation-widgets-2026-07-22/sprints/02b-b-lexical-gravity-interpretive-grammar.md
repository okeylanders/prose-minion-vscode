# Sprint 02B-B: Lexical Gravity Interpretive Grammar

**Status**: Complete — v2 backend, Claude Design presentation, widget codec recovery exit plan, and F5 acceptance verified 2026-08-07
**Priority**: High
**Branch**: `sprint/conversation-widgets-02b-b-lexical-gravity-interpretive-grammar` -> `epic/conversation-widgets`
**Estimated Effort**: 5-8 days
**Depends on**: Sprint 02B-A and completed [Workshop Architecture Refactor Phase 7](../../epic-workshop-architecture-refactor-2026-08-03/sprints/07-architecture-closure.md)
**ADR**: [2026-08-01 — Lexical Gravity Interpretive Grammar](../../../../docs/adr/2026-08-01-lexical-gravity-interpretive-grammar.md)
**Exit plan**: [Widget Codec Recovery Mode](02b-b-widget-codec-recovery-mode.md)
**Next foundation**: [Sprint 02D — Widget Persistence Grammar and Integrity](02d-widget-persistence-grammar-and-integrity.md)

## Goal

Replace Lexical Gravity's word-field-shaped lens contract with a versioned,
strictly validated **interpretive grammar**. A lens must tell the model what the
domain notices, how it positions scene elements, which state changes belong to
the domain, and what those changes imply. The existing word field becomes the
last-mile realization layer.

This sprint establishes that foundation before Prose Controller, the later
Lexical Gravity stack, or another widget copies the current representation.

The architecture feature gate is closed. Okey explicitly resumed feature work
on 2026-08-06 after Phase 7 accepted the final responsibility map and closure
evidence.

## Exit Gate: Recover Prior Widget Checkpoints

On 2026-08-07, a valid live development checkpoint proved review F-03's
predicted failure: one embedded Lexical Gravity v1 config caused the entire
rolling room to be rejected while its browser sidecar still listed the session.
The associated named checkpoint carried the same valid v1 config and would fail
through the Open path as well.

Sprint 02B-B therefore does not exit with strict checkpoint rejection as its
final policy. Implement the linked recovery plan before completion:

- recognize only the exact old v1 Lexical draft shape;
- preserve its original lexical-only standing behavior without inventing v2
  roles, axes, dynamics, or entailments;
- preserve the room, config/directive linkage, transcript, and conversation
  archive;
- emit named normalization evidence and a consume-once writer notice; and
- prove rolling and associated named checkpoints converge through ordered
  autosave.

This automatic recovery applies only to session-embedded resolved-lens
snapshots. Writer-owned v1 project lens files retain the explicit
rebuild/selection/atomic-replacement workflow.

F-07 and F-09 are accepted but intentionally follow in Sprint 02D, where the
recovery seam becomes a complete copyable persistence lifecycle before Prose
Controller.

## Implementation progress — 2026-08-06

- Locked the shared v2 lens, Preview, and incompatibility contracts.
- Converted all six built-ins to validated interpretive grammars.
- Advanced lens building and Preview to strict sentinel-framed v2 JSON.
- Added semantics-first standing-frame rendering and measured its worst-case
  valid prompt bound.
- Added actionable, non-mutating version-1 project-resource diagnostics.
- Preserved the existing modal structure so Claude Design can integrate the
  Lens Logic presentation against the locked contract without a competing UI
  diff.
- Installed the Lens Logic and Preview Interpretation presentation, then added
  persisted Interpret/Recompose application gears so the same semantic reading
  can drive either restrained revision or structural rewriting. The 2026-08-07
  exit decision adds Lexical as a first-class third gear for surface-only pull.
- Added an explicit, correlated rebuild flow that lets the writer choose one v2
  take and atomically overwrite the exact incompatible v1 resource without
  deleting it first.

## Locked decisions

- Project and catalog lenses advance from version `1` to strict version `2`;
  there is no optional-logic project-lens union. A session snapshot may retain
  the exact recognized v1 resolved lens only in the explicit Lexical recovery
  arm, where Lens Logic is honestly unavailable.
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
- Application gear is a hard Lexical/Interpret/Recompose switch. Lexical applies
  the word field without Lens Logic; Interpret applies an inspectable semantic
  reading through local revision; Recompose may reorganize existing beats to
  enact that reading. Weight remains influence strength/frequency; reach remains
  lexical distance; metaphor pull remains permission for explicit comparison.
  None is repurposed as a consequence score or show/tell control.
- Evidence mode is a separate Tell/Blend/Show switch governing how **LG's own**
  influence becomes legible in prose. It is not a fourth application gear.
  Recompose changes compositional permission; Show changes evidence style, so
  Recompose+Show can enact an interpretation through action, image, behavior,
  sequence, silence, and consequence. Prose Controller may later carry an
  independent narrative-handling instruction in deliberate tension with LG.
- Preview returns a strict composite artifact: concise positioning, selected
  dynamic, open entailment, and rewritten prose. No private reasoning is
  requested or displayed.
- The UI gains a first-class **Lens Logic** view before Word Field. The writer can
  inspect what the lens foregrounds, its axes, its dynamics, and their
  entailments before installing it.
- Prompt budgets are measured from worst-case valid v2 fixtures. Do not simply
  raise the standing-directive budget until the renderer proves the required
  bound.
- V1 project lens files remain untouched during load and are reported with an
  actionable rebuild message. A writer-authorized rebuild may overwrite the
  exact revalidated v1 filename atomically; no heuristic or model call happens
  during repository load or session hydration.

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
- Update the Sprint 06 stack plan so independently preserved interpretive
  grammars can be selected by local passage fit.
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
- A model-selected multi-lens stack.
- Prose Controller implementation.
- Automatic migration or unprompted rewriting of user-owned v1 project
  resources. Session-embedded v1 checkpoint recovery is separately required by
  the Sprint 02B-B exit plan.
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
  changing reach affects lexical specificity without disabling Lens Logic in
  Interpret/Recompose; metaphor-off still applies the interpretive grammar in
  those gears.
- Lexical gear produces a useful superficial change with no semantic positions,
  selected dynamic, or entailment. Interpret/Recompose remain strict Lens Logic
  modes.
- A Recompose acceptance fixture can realize the interpretation through shown
  evidence rather than added explanation; changing composition does not imply
  moving toward Tell.
- Tell/Blend/Show composes independently with every application gear, participates
  in Preview invalidation, and defaults to Blend for prior v2 and recovered v1
  checkpoints.
- A lens that cannot map honestly may produce a semantic no-op rather than
  inventing scene facts.
- V1 resources fail with an exact, actionable message and are not modified
  unless the writer explicitly chooses one generated replacement take.
- A recognized Lexical Gravity v1 session config restores in lexical-only mode
  with its room and standing behavior intact, while unknown/corrupt shapes still
  protect the checkpoint.
- Material widget recovery is reported once to the writer; current and
  associated named checkpoints advance through the existing ordered autosave
  path.
- Round-trip persistence reconstructs the exact v2 standing frame.
- Typechecks, lint, builds, architecture witnesses, and affected tests pass.
