# Sprint 03: Creative Variations Explorer

**Status**: In progress — Slice 6 review findings remediated and ready for re-review; live for integrated hands-on testing
**Priority**: High
**Branch**: `sprint/conversation-widgets-03-creative-variations` -> PR into `epic/conversation-widgets`
**Depends on**: Sprint 02D merged into `epic/conversation-widgets`; the widget host, session-owned config ledger, one-shot thread-artifact rail, and clone-and-recommit lifecycle are all proven
**Design source**: [Creative Variations Playground](../concepts/creative-variations-playground.md)
**Implementation runway**: [Creative Variations implementation runway](../../../../docs/architecture/2026-08-10-creative-variations-implementation-runway.md)

## Goal

Give the writer a comparison studio for a selected or pasted passage: optionally
declare what must survive and what must not change, generate three to five genuinely
different takes, compare the useful ones, and commit only the chosen direction
or explicitly selected prose to one room turn. It is not an automatic rewrite
button and it never mutates the editor.

This is the first reusable variation-family member. It proves a typed,
bounded variation workup without teaching generic code what a creative
invariant, a sampling aim, or a literary tradeoff means. [Show vs. Tell](05-show-vs-tell.md)
will be its deliberately specialized sibling.

## Locked decisions

- **One-shot rail, writer-owned commit.** The widget follows Gesture Playground:
  pre-commit exploration -> selected workup -> thread artifact -> re-openable
  chip -> clone-and-recommit. Personas may recommend or prefill; they may not
  generate, select, or commit variations for the writer.
- **Declared invariants are two distinct fields.** `must survive` names the
  facts, character state, emotional truth, or effect each take must carry;
  `must not change` names hard boundaries such as POV, tense, plot outcome, or
  exact dialogue. Both fields are optional; a blank field means no constraint
  of that kind, and the model does not silently infer one.
- **The first release starts with one open aim.** It offers an optional custom
  aim plus one verbalized sampling distance: `Familiar`, `Adjacent`,
  `Tail`, or `Far tail`. A blank aim is projected into the generation request
  as `Generate at random.` New drafts default to `Tail`. This is creative pressure,
  not an analysis-type preset menu. The bound four-menu frame, partial
  regeneration, and report-prefill handoffs are later slices. The first slice
  keeps the core comparison promise rather than shipping a control museum.
- **Result shape is typed and bounded.** Each card has a stable position, named
  approach, proposed prose, compact tradeoff, and explicit invariant flags.
  A closed response parser validates count and character limits before a card
  renders; there is no generic Markdown-heading parser.
- **Invariant evidence is typed, not magical.** A model flag contains only the
  invariant field, `advisory-risk | hard-conflict`, and a bounded note. The host
  derives workup/card/flag ids after validation; the model cannot supply them.
  Every flag must reference a nonblank writer field; `hard-conflict` is valid
  only against `must not change`. This makes the writer-control boundary
  enforceable without claiming deterministic code can discover a semantic
  conflict the model did not declare. Response validation is atomic: one flag
  against a blank field invalidates the whole closed workup rather than silently
  salvaging a partial model response; the rejection copy names that condition.
- **Distinctness is earned on screen.** A deterministic post-generation readout
  reports pairwise textual overlap. An exact normalized prose duplicate rejects
  the whole workup; high non-identical overlap remains visible as a warning. The
  readout diagnoses collapsed alternatives but does not rank the writer's
  choices or silently discard a non-identical card.
- **Commit is compact.** The discarded generation cloud never reaches the room.
  Commit requires at least one selected card. Each selected card carries
  direction by default; full prose is an explicit per-card promotion and shares
  the same bounded artifact budget. Advisory risks require explicit per-risk
  acceptance before that card may commit and ride the artifact in either carry
  mode. A card carrying a model-declared `hard-conflict` flag against `must not
  change` is commit-ineligible. Every whole-workup regeneration has a fresh
  host-minted workup id and atomically clears selections, carry modes, and risk
  acceptances before the new cards settle. The writer turn carries the existing
  bounded display-safe subject preview so a direction has a referent; the source
  passage itself remains excluded from the compact artifact.
- **Exact reopen preserves authoring truth, not transient chrome.** The persisted
  draft contains inputs, display-safe provenance, generated workup, selections,
  each selected card's carry mode, accepted advisory-risk ids, and the writer
  note. Focus, scroll position, open comparison panels, and similar presentation
  state remain ephemeral.

## Scope / deliverables

1. Feature-owned persisted draft codec, hydration normalization, current-shape,
   and semantic-integrity arm in the closed widget lifecycle.
2. Selection/paste intake with honest surrounding-context/provenance labeling,
   two optional invariant fields, an optional custom aim with an explicit
   random fallback, verbalized distance defaulting to `Tail`, and a
   three-to-five count. The subject passage is the only required authoring input.
3. One cancellable model call with a closed result schema, visible progress and
   failure state, exact-duplicate rejection, plus versioned deterministic
   pairwise textual-overlap calculation and high-overlap warnings.
4. Structured variation cards, multi-select, side-by-side comparison, explicit
   per-card carry mode, advisory-risk acceptance, hard-conflict blocking,
   bounded artifact rendering, atomic commit, and chip re-open.
5. A narrow shared variation-workup mechanical seam only if it can serve Sprint
   05 without knowing Creative Variations vocabulary. Feature prompts, invariant
   semantics, flags, and card interpretation remain feature-owned.
6. Tests for invalid/oversized responses, cancellation and stale-result
   correlation, exact duplicates versus high overlap, advisory-risk acceptance,
   blank-invariant flag rejection, hard-conflict blocking, compact mixed-mode
   commit payloads, the exact durable reopen boundary, clone behavior, and no
   editor mutation.

## Implementation slices and review gates

All slices land on `sprint/conversation-widgets-03-creative-variations` and stop
at the stated behavior boundary for review before the next slice begins. On
2026-08-13 Okey authorized enabling the catalog entry in Slice 4 so each
integrated user-facing slice can be tested in the real app as it lands. The
production-backed availability policy is now the test path too; there is no
test-only liveness shim. Later slices add their behavior without re-gating the
surface.

| Slice | Review boundary |
|---|---|
| 0 | Freeze the approved product and architecture contract; record baseline witnesses. |
| 1 | Extract the shared one-shot commit route and transaction without changing Gesture behavior. |
| 2 | Add Creative Variations contracts, budgets, codec, persistence lifecycle, and integrity. |
| 3 | Add prompt bundle, strict response codec, cancellation/correlation, and textual-overlap v2. |
| 4 | Add selection/paste intake, authoring controller, cards, comparison, and accessible presentation. |
| 5 | Add compact commit, chip reopen, and clone-and-recommit. |
| 6 | Add persona recommendation/prefill while keeping report-prefill deferred. |
| 7 | Complete architecture witnesses, run the final production-policy route matrix and full verification, then update current-state docs. |

### Slice 4 accepted baseline — 2026-08-13

The Slice 4 review at `1f04653a` and its remediation are the accepted
implementation baseline for Slice 5. The production catalog entry remains live
for integrated hands-on testing. The commit-unavailable posture recorded below
was the deliberate Slice 4 boundary and is superseded by Slice 5.

- `useCreativeVariations` owns the webview request token, generate/cancel wire,
  host workup-id latch, and stale progress/result rejection. It reuses
  `creativeVariationsGenerationDraft`; it does not reproduce the derivation.
  That derivation makes the passage the sole required input: a blank aim becomes
  `Generate at random.` for the request, while blank invariant fields remain
  empty and therefore declare no preservation constraints.
- `useCreativeVariationsAuthoring` owns transient draft, intake, invalidation,
  generation presentation state, selections, carry modes, and accepted risks.
  Its persistence contract is explicitly empty and it has no transport
  vocabulary.
- `dispatchWorkshopSelectionData` is the closed Workshop-side exact target router for the
  existing selection wire. Editor-derived provenance keeps only display-safe
  path/range fields while the text remains exact; clipboard and edited text are
  marked pasted.
- `WorkshopApp` composes the transport and controller, mounts the controlled
  modal, supplies the clipboard effect and widget model-selector quartet, and
  routes Creative Variations progress/results. Changing the host-owned widget
  model invalidates the dependent transient workup. The overlap warning uses
  the named score constant (`80`).
- At the Slice 4 gate, the controlled modal exposed an explicit
  `commitAvailable` boundary, passed `false`, rendered an associated unavailable
  explanation, and supplied no commit callback. Slice 5 replaces that posture
  with the real correlated commit lifecycle.

Verification at this review gate:

- focused Slice 4 remediation and boundary set: 18 suites, 202 tests passed;
- full Jest: 206 suites, 2,215 tests, and 2 snapshots passed;
- all core, webview, and extension TypeScript configurations passed;
- ESLint: 0 errors, 955 repository warnings;
- production build, resource staging, webpack compilation, and bundle sentinel
  passed; webpack retained its three advisory webview-size warnings;
- the F5 development watch compiled both bundles successfully with polling
  limited to macOS by default and available elsewhere by explicit override;
- `git diff --check` passed.

The current CLI environment cannot launch the integrated VS Code extension
surface, so no screenshot was substituted from a fixture. The mounted Workshop
integration test now launches Creative Variations through the same live catalog
policy as an F5 extension session.

### Slice 5 implementation evidence — 2026-08-13

Slice 5 is **ready for review**. It is not reviewed or complete, and the
worktree remains uncommitted and unpushed.

- The exact Creative commit arm carries the authored draft, a fresh webview
  token, and optional clone provenance. `useCreativeVariations` owns request
  correlation; stale and wrong-widget results cannot settle the active attempt.
- `CreativeVariationsArtifact` is the sole deterministic artifact projection
  used by the host compiler and the modal usage meter. It carries only selected
  directions or explicitly promoted prose, nonblank declared invariants,
  accepted selected advisory risks, and the optional note.
- `CreativeVariationsOneShotCommit` owns Creative semantic eligibility and the
  exact artifact-budget check. The closed one-shot operation registry adapts
  that feature result into the existing feature-neutral coordinator, which
  creates the retry config, artifact, writer turn, acceptance linkage, and
  published session state.
- The host independently rejects unavailable/tool targets, active room runs,
  active generation, duplicate commit work, malformed drafts, ineligible
  selections, and over-budget artifacts before room mutation. A durable retry
  config may remain after a pre-acceptance delivery failure, while a participant
  reply failure after acceptance does not roll back the committed turn.
- `useCreativeVariationsAuthoring` remains a transport-free controller with an
  empty persistence contract. It locks close and destructive authoring while a
  commit is pending, preserves exact authored state on refusal, and closes only
  after host acceptance. Blank authored aims stay blank in the durable config.
- The existing thread-artifact chip fetches the full `wc-N` config. Clone opening
  restores durable authoring truth with idle transient state; recommit records
  `clonedFromConfigId` and mints a new config, artifact, and room turn without
  editing the historical records.
- The live catalog now mounts the real commit button, pending/error presentation,
  exact usage meter, and accessible first blocker. Persona preparation remains
  unavailable until Slice 6, and no editor-write path was introduced.

Verification at this review gate:

- focused Slice 5 contract/compiler, transport/controller, host/coordinator,
  persistence/reopen, mounted Workshop, and architecture set: 15 suites and
  177 tests passed;
- full Jest: 207 suites, 2,242 tests, and 2 snapshots passed;
- all core, webview, and extension TypeScript configurations passed;
- ESLint: 0 errors and 960 repository warnings;
- production resource staging, both webpack bundles, and the bundle sentinel
  passed; webpack retained its three advisory webview-size warnings;
- the exact root F5 prelaunch command (`npm run watch`) compiled both
  development bundles successfully;
- `git diff --check` passed.

VS Code accepted the Extension Development Host launch command, but display
capture/automation was unavailable in the current execution environment. No
fixture-only screenshot is represented as integrated UI evidence. The mounted
Workshop integration test exercises the live catalog, fixture-backed generation,
selection, commit acceptance, visible thread chip, exact reopen, and clone
recommit flow without a paid provider call.

### Slice 5 review remediation evidence — 2026-08-13

Slice 5 is **complete**. The accepted implementation landed at `4210cdc5`, its
review remediation at `5bb4eb09`, and the runway/live-availability alignment at
the Slice 6 starting baseline `41f5b717`.

- The host now rejects live widget ids lacking one-shot operations before
  consulting the partial generation-activity map. Unexpected commit-route
  failures produce a correlated retryable result, result posts are awaited and
  logged on rejection, and opening the Creative sheet resets stale transport
  state after a lost acknowledgement.
- A named Creative eligibility service supplies both host refusal messages and
  webview blocker codes. Exact advisory-risk set equality, selected-card
  membership, hard-conflict exclusion, tool-target refusal, and artifact
  compilation failure are represented consistently at both boundaries.
- The controller captures clone provenance when it seeds the draft, defers
  model invalidation across a pending commit, and refuses late clone responses
  while another Creative sheet is already open. The coordinator validates clone
  id shape, existence, and widget ownership before any durable mutation.
- The room-facing writer turn includes the bounded subject preview recorded in
  the Locked decision above. The deterministic artifact projection remains
  unchanged and compact.
- The dead `commitAvailable` posture is removed. Corrective rollback logging now
  names the retained retry config and verifies that turn/artifact linkage is
  absent.
- Commit-path and mounted regressions cover unsupported live arms, unexpected
  failures, lost-result reset, clone provenance and validation, forged workup
  identity, pending model invalidation, exact risk equality, artifact compiler
  failure, tool-target accessibility, and the picker-to-invalidation loop.

Verification at this re-review gate:

- focused remediation plus architecture: 10 suites and 159 tests passed;
- full Jest: 207 suites, 2,256 tests, and 2 snapshots passed;
- all core, webview, and extension TypeScript configurations passed;
- ESLint: 0 errors and 952 repository warnings;
- production resource staging, both webpack bundles, and the bundle sentinel
  passed; webpack retained its three advisory webview-size warnings;
- the exact root F5 prelaunch command (`npm run watch`) compiled both
  development bundles successfully and was stopped intentionally afterward;
- `git diff --check` passed.

Review F-09 (autosave overlap re-derivation), F-12 (named commit-freeze seam),
and F-16 (compiler arm-guard symmetry) retain their accepted deferrals. F-17
remains N/A under the accepted Slice 4 blocker-union convention. Human F5
visual inspection and screenshots remain outstanding because display capture is
unavailable in this environment; no fixture-only substitute is claimed.

### Slice 6 implementation evidence — 2026-08-13

Slice 6 landed as `333e28e5`. Its review findings are remediated in the current
worktree and ready for re-review; the remediation remains uncommitted and
unpushed.

- Creative Variations contributes one named, strict recommendation codec to the
  closed family registry. Its complete final control frame carries the exact
  subject passage, optional exact surrounding context, live source references,
  both invariant fields, optional aim, sampling distance, and take count.
  Missing, duplicated, malformed, unavailable, or over-budget data rejects the
  whole recommendation; prompt delimiters embedded in writer material are
  neutralized before model assembly.
- The production catalog-backed availability policy decides whether Creative
  appears in the persona prompt and whether its returned frame may dispatch.
  The parser never treats an unavailable id as a recommendation, and run
  completion validates every referenced excerpt or context attachment against
  the current session before attaching the chip.
- Only Host and Guest turns may persist a recommendation. A direct tool run may
  return a syntactically valid frame, but the control tail is stripped and no
  tool-owned chip is attached. Strict current-state validation rejects forged
  ownership; checkpoint import locally normalizes away only the offending
  recommendation so the rest of the session remains recoverable.
- The recommendation seed is input-only. It has no provenance, generated
  workup, selection, risk acceptance, note, or commit authority. Opening the
  exact correlated chip mints display-safe `persona-prefill` custody with the
  canonical persona id and an unedited state in the writer-owned controller,
  copies source references defensively, leaves
  generation idle, and preserves blank optional fields as honest no-constraint
  or random-aim semantics.
- The Creative modal labels persona-prepared input honestly. Editing the subject
  preserves persona custody and records that the writer edited it; committing
  and reopening preserve both facts. An already-open or pending-reopen Creative
  sheet refuses a late prefill instead of silently overwriting the writer's
  earlier request or current authoring work.
- The generic turn chip now derives label and icon from the widget registries and
  uses an exhaustive feature-local meta switch. The Widgets browser also enables
  its explicit Host-preparation door for Creative, seeding an editable request
  that expressly forbids generation, selection, acceptance, or commit.
- Analysis/report-prefill contracts and report prompts remain untouched. That
  handoff still requires analysis-owner agreement and remains deferred.

Verification at this review gate:

- staged focused gates passed: 10 suites / 192 tests for the principal Slice 6
  paths, 7 suites / 153 tests for mounted/persistence/prompt/architecture
  integration, and 3 suites / 36 tests for the catalog Host-prefill seam;
- full Jest: 208 suites, 2,282 tests, and 2 snapshots passed;
- all core, webview, and extension TypeScript configurations passed;
- ESLint: 0 errors and 956 repository warnings;
- production resource staging, both webpack bundles, and the bundle sentinel
  passed; webpack retained its three advisory webview-size warnings;
- `git diff --check` passed.

The mounted Workshop test proves exact older-turn/persona correlation, click to
prefill, preservation of all seed values, visible persona attribution, and the
absence of automatic generate or commit messages. No paid provider call or
fixture-only screenshot is represented as integrated UI evidence.

### Slice 6 review remediation evidence — 2026-08-14

All fourteen review findings in
`docs/pr-reviews/sprint-03-creative-variations-slice-6-333e28e5-review-v2.md`
are addressed in the current worktree.

- Every recommendation registry entry now owns an exact response-frame ceiling.
  The coarse pre-id envelope is derived from those entries, and the selected
  feature is rechecked after id extraction. A maximum-field Creative frame and
  a smaller-feature rejection witness pin the relationship. The recurring
  recommendation instruction is pinned at 7,823 characters, completing the
  2026-07-31 prompt-assembly tech debt.
- Persona provenance is explicitly custody rather than guessed source origin:
  canonical `personaId` plus one-way `editedByWriter`. It never decays into the
  false `pasted` label, and display provenance no longer enters provider JSON.
- Host ask copy, persona/context honesty copy, widget-named rejection notices,
  exhaustive dispatch, pending-reopen correlation, bare-vocabulary architecture
  guards, source-reference units, and the frame-only ownership-refusal path all
  have direct regression witnesses.
- Corrupt checkpoint ownership now degrades locally: checkpoint validation
  keeps validating the seed, normalization discards only the non-persona-owned
  recommendation and records the action, then strict current-state validation
  runs unchanged.

Remediation verification:

- targeted remediation: 13 suites / 256 tests passed;
- full Jest: 208 suites / 2,293 tests / 2 snapshots passed;
- all core, webview, and extension TypeScript configurations passed;
- ESLint: 0 errors and 956 repository warnings;
- production resource staging, both webpack bundles, and the bundle sentinel
  passed; webpack retained its three advisory webview-size warnings;
- `git diff --check` passed.

## Out of scope

- Bound-frame menus, partial regeneration, history across multiple workups, and
  automatic application to the source document.
- Retrofitting Stock & Signature, Decision Points, Freshness, or other reports
  to emit widget-prefill metadata; that requires prompt-owner agreement.
- A standing directive or any change to persona identity, behavior, or room
  state outside the committed one-shot artifact.

## Completion criteria

- A writer can compare several meaningfully different takes under visible,
  declared constraints and commit one or more chosen cards. New selections carry
  direction; only individually promoted cards carry full prose.
- Every advisory risk on a selected card is explicitly accepted before commit;
  any model-declared `hard-conflict` flag against `must not change` keeps that
  card ineligible.
- A malformed, duplicate, oversized, cancelled, or stale workup cannot settle
  into the current authoring state or create a room turn. High non-identical
  overlap warns without ranking, removal, or implicit regeneration.
- The persisted authoring truth reopens exactly; transient chrome does not.
  Recommitting the reopened draft mints a new config, artifact, and turn.
- The widget is a named feature slice: adding Show vs. Tell later does not
  require Creative Variations to learn its continuum or prompt vocabulary.
- Architecture witnesses, focused tests, typechecks, lint, build, and
  `git diff --check` pass.
