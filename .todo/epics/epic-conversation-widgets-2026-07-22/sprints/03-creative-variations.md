# Sprint 03: Creative Variations Explorer

**Status**: In progress — Slice 4 review remediated and ready for re-review; live for integrated hands-on testing
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
  acceptances before the new cards settle.
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

### Slice 4 remediation evidence — 2026-08-13

The Slice 4 review at `1f04653a` has been remediated in the worktree and is
**ready for re-review**. It is not reviewed or complete. The production catalog
entry remains live for integrated hands-on testing; room commit remains visibly
and accessibly unavailable until Slice 5.

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
- The controlled modal exposes an explicit `commitAvailable` boundary. Slice 4
  passes `false`, renders an associated unavailable explanation, and supplies
  no commit callback; no unrelated room-run or commit-in-flight state is
  impersonated.

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
