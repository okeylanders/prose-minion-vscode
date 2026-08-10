# Sprint 03: Creative Variations Explorer

**Status**: Planned — next implementation slice
**Priority**: High
**Branch**: `sprint/conversation-widgets-03-creative-variations` -> PR into `epic/conversation-widgets`
**Depends on**: Sprint 02D merged into `epic/conversation-widgets`; the widget host, session-owned config ledger, one-shot thread-artifact rail, and clone-and-recommit lifecycle are all proven
**Design source**: [Creative Variations Playground](../concepts/creative-variations-playground.md)

## Goal

Give the writer a comparison studio for a selected or pasted passage: declare
what must survive and what must not change, generate three to five genuinely
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
  exact dialogue. The model does not silently infer either.
- **The first release starts with one open aim.** It offers a named creative
  direction and three to five alternatives; the bound four-menu frame, partial
  regeneration, and report-prefill handoffs are later slices. The first slice
  keeps the core comparison promise rather than shipping a control museum.
- **Result shape is typed and bounded.** Each card has a stable position, named
  approach, proposed prose, compact tradeoff, and explicit invariant flags.
  A closed response parser validates count and character limits before a card
  renders; there is no generic Markdown-heading parser.
- **Distinctness is earned on screen.** A deterministic post-generation readout
  reports pairwise similarity. It diagnoses collapsed alternatives but does not
  rank the writer's choices or silently discard a flagged card.
- **Commit is compact.** The discarded generation cloud never reaches the room.
  A chosen card carries direction by default; full prose is explicit and shares
  the same bounded artifact budget. Accepted invariant flags become writer-owned
  context rather than hidden model assumptions.

## Scope / deliverables

1. Feature-owned persisted draft codec, hydration normalization, current-shape,
   and semantic-integrity arm in the closed widget lifecycle.
2. Selection/paste intake with honest surrounding-context/provenance labeling,
   two invariant fields, named creative direction, and a three-to-five count.
3. One cancellable model call with a closed result schema, visible progress and
   failure state, plus deterministic distinctness calculation.
4. Structured variation cards, multi-select, side-by-side comparison, explicit
   carry mode, bounded artifact rendering, atomic commit, and chip re-open.
5. A narrow shared variation-workup mechanical seam only if it can serve Sprint
   05 without knowing Creative Variations vocabulary. Feature prompts, invariant
   semantics, flags, and card interpretation remain feature-owned.
6. Tests for invalid/oversized responses, cancellation and stale-result
   correlation, invariant-flag acceptance, compact commit payloads, persisted
   reopen/clone behavior, and no editor mutation.

## Out of scope

- Bound-frame menus, partial regeneration, history across multiple workups, and
  automatic application to the source document.
- Retrofitting Stock & Signature, Decision Points, Freshness, or other reports
  to emit widget-prefill metadata; that requires prompt-owner agreement.
- A standing directive or any change to persona identity, behavior, or room
  state outside the committed one-shot artifact.

## Completion criteria

- A writer can compare several meaningfully different takes under visible,
  declared constraints and commit only what they choose.
- A malformed, duplicate, oversized, cancelled, or stale workup cannot settle
  into the current authoring state or create a room turn.
- The persisted draft reopens exactly; revisiting mints a new config and turn.
- The widget is a named feature slice: adding Show vs. Tell later does not
  require Creative Variations to learn its continuum or prompt vocabulary.
- Architecture witnesses, focused tests, typechecks, lint, build, and
  `git diff --check` pass.
