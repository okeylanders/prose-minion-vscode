# Concept Spring: Creative Variations Playground

**Status**: Concept spring
**Priority candidate**: High
**Classification**: Conversation Widget
**Likely rail**: One-shot thread artifact
**Depends on**: Widget host + Gesture Playground (Sprint 01)

## Product idea

**Creative Variations Playground** gives a writer several genuinely different
takes on the same selected or pasted material while preserving the work's
declared invariants. It turns the existing "Creative Variations" sections in
tools such as Stock & Signature, Decision Points, and Freshness into a
deliberate, reusable Workshop surface instead of a formatting convention hidden
inside individual reports.

It is a comparison studio, not an automatic rewrite button: the writer supplies
the moment and its constraints, sees a bounded set of distinct approaches with
their effects, chooses useful directions, then commits a compact artifact for
the next room turn.

## Inputs

- selected text from the excerpt/editor, or pasted text;
- surrounding passage context when available;
- intent and invariants — facts, character state, POV, voice, plot outcome, or
  wording that must survive;
- optional creative pressure such as `less familiar`, `more physical`,
  `raise the commitment`, `quiet it down`, or a free-text direction;
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

- The writer selects zero or more directions and may add a note.
- Commit creates a one-shot thread artifact containing only the selected
  direction(s), their essential constraints, and the writer note — never the
  whole discarded generation cloud.
- A presentation-only chip reopens the exact saved widget draft. Revisiting
  clones and recommits; it never rewrites an earlier room turn.
- Copying a full variation is available from the widget. Applying it back to a
  source document remains behind the separately tracked **Workshop Apply to
  Draft** safety design.
- A persona (host or guest once Sprint 13 guest permissions land) may recommend
  or prefill the widget. It cannot silently generate, select, or commit the
  writer's creative choice.

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
multiple runs, live regeneration, direct editor apply, and durable prose
directives.

## Promotion gates

1. The Conversation Widgets ADR is accepted and Sprint 01 has proven the
   widget host, typed config persistence, chip, and clone-and-recommit rails.
2. The generator's structured result has a closed schema, item/count/character
   bounds, cancellation, and visible failure state.
3. Commit payload and prompt-frame budget are specified separately from the
   larger exploration result.
4. Persona recommendation/prefill permissions are consistent for host and
   guest; writer commit remains the authority boundary.
5. The Stock & Signature, Decision Points, and Freshness prompt owners agree
   which existing Creative Variations instructions become widget-prefill
   metadata versus report-only prose.
