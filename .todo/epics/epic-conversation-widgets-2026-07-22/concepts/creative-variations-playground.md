# Concept Spring: Creative Variations Playground

**Status**: Promoted to [Sprint 03 — Creative Variations](../sprints/03-creative-variations.md)
**Priority**: High
**Classification**: Conversation Widget
**Likely rail**: One-shot thread artifact
**Depends on**: Widget host + Gesture Playground (Sprint 01)

## Product idea

**Creative Variations Playground** gives a writer several genuinely different
takes on the same selected or pasted material while preserving the work's
declared invariants. It establishes the typed Workshop surface that existing
"Creative Variations" sections in tools such as Stock & Signature, Decision
Points, and Freshness may eventually hand off into, instead of making a report
formatting convention carry an interactive lifecycle.

It is a comparison studio, not an automatic rewrite button: the writer supplies
the moment and its constraints, sees a bounded set of distinct approaches with
their effects, chooses useful directions, then commits a compact artifact for
the next room turn.

## Inputs

- selected text from the excerpt/editor, or pasted text;
- surrounding passage context when available;
- one optional `must survive` field for facts, character state, emotional truth,
  or reader effect every take must preserve; blank means no declared constraint;
- one `must not change` field for optional hard boundaries such as POV, tense,
  plot outcome, or exact dialogue; the model never invents either field;
- one optional custom aim plus a verbalized sampling distance: `Familiar`,
  `Adjacent`, `Tail`, or `Far tail`; a blank aim generates at random and new
  drafts default to `Tail`;
- requested count, bounded to three to five alternatives.

Open-chat use is allowed for pasted material, but the widget must label the
absence of passage context honestly.

## Generated workup

One explicit model call produces three to five alternatives. Each item has a
stable position, a short named approach, the full proposed text, and a compact
tradeoff note describing what changes in reader effect, pacing, implication, or
character signal. The generator is instructed to make the approaches meaningfully
distinct, not merely synonym swaps at different temperatures.

The UI renders the validated workup as structured cards. Do not depend on a
generic Markdown-heading parser for this widget: the model result crosses a
typed, bounded response schema before presentation.

## Commit and lifecycle

- The writer selects one or more cards and may add a note. Each selected card
  carries direction by default; full prose requires an explicit per-card choice.
- Advisory risks require explicit per-risk acceptance before their card may
  commit. A card carrying a model-declared `hard-conflict` flag against `must
  not change` remains visible but is commit-ineligible. Whole-workup regeneration
  replaces the workup and risk ids and clears selections, carry modes, and risk
  acceptances.
- Commit creates a one-shot thread artifact containing only the selected
  carry content, essential constraints, accepted advisory risks, and writer note
  — never the whole discarded generation cloud.
- A presentation-only chip reopens the exact saved authoring truth: inputs,
  display-safe provenance, generated workup, selections, per-card carry modes,
  accepted advisory risks, and note. Focus, scroll, and expanded panels remain
  ephemeral. Revisiting clones and recommits; it never rewrites an earlier turn.
- Copying a full variation is available from the widget. Applying it back to a
  source document remains behind the separately tracked **Workshop Apply to
  Draft** safety design.
- A permitted persona may recommend or prefill the widget. It cannot silently
  generate, select, or commit the writer's creative choice.

## Relationship to existing surfaces

- **Gesture Playground** is the first narrow proof of the host: target phrase
  -> bounded menu -> writer selection -> one-shot artifact.
- **Creative Variations Playground** is the reusable local variation surface:
  a passage, beat, phrase, or idea -> alternatives with effects -> selected
  directions.
- **Show vs. Tell Playground** is a specialized Creative Variations sibling:
  its continuum and craft vocabulary determine the generated alternatives.
- Tool reports may continue to expose variations, but they should eventually
  link or prefill this widget rather than each inventing a bespoke interactive
  lifecycle.

## Smallest useful slice

After Sprint 01, ship selected/pasted seed + intent/invariants + one
three-to-five variation generation + structured cards + multi-select + one-shot
artifact commit + persisted draft/chip reopen. Defer comparison history across
multiple runs, partial/card-level regeneration, direct editor apply, and durable
prose directives.

## Promotion disposition

1. **Satisfied.** The Conversation Widgets ADR is accepted and Sprint 01 proved the
   widget host, typed config persistence, chip, and clone-and-recommit rails.
2. **Carried into Sprint 03.** The generator's structured result must have a
   closed schema, item/count/character bounds, cancellation, and visible failure.
3. **Carried into Sprint 03.** Commit payload and prompt-frame budget are
   specified separately from the larger exploration result.
4. **Satisfied as an authority rule; exercised in Sprint 03.** Permitted persona
   recommendation/prefill remains subordinate to writer generate/select/commit.
5. **Deferred.** Before a later report-prefill slice, Stock & Signature, Decision
   Points, Freshness, and other analysis owners must agree which instructions
   become typed widget-prefill metadata versus report prose.
