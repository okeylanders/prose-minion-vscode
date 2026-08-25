# Sprint 06: Lexical Gravity — Model-Selected Lens Stack

**Status**: Planned — follows Sprints 03–05
**Priority**: Low (v2 richness after the widget family proves itself)
**Branch**: `sprint/conversation-widgets-06-lexical-gravity-stack-model-choice` -> PR into `epic/conversation-widgets`
**Depends on**: Sprint 02B-B interpretive grammar, Sprint 02D persistence grammar, and the completed Sprints 03–05 feature contracts
**ADRs**: [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md); [2026-08-01 — Lexical Gravity Interpretive Grammar](../../../../docs/adr/2026-08-01-lexical-gravity-interpretive-grammar.md)

## Goal

Replace the planned weighted blend editor with a writer-authored stack of
independent Lexical Gravity directives. The writer may keep several lenses live;
at prose time the model chooses whether any one lens genuinely fits the local
beat and, when it does, applies that lens's existing interpretive grammar and
lexical realization. The stack is a set of alternatives, not a recipe for
averaging them together.

## Locked decisions

- **Independent directives, never a blended config.** Every stacked lens keeps
  its own config id, directive id, preview, chip, edit path, and kill switch.
  Adding a lens must not rewrite an existing lens's persisted draft.
- **Model-selected relevance, not weight arithmetic.** The prose-time contract
  states the active lenses separately and asks the model to select zero or one
  whose grammar is materially appropriate for the local beat. It does not sum
  weights, impose a dominance order, merge word clouds, or combine lens logic
  merely because several directives are present.
- **Existing per-lens controls keep their meaning.** A lens's weight, reach,
  application gear, evidence mode, and metaphor pull remain local to that one
  directive; none becomes a relative inter-lens weight.
- **Stack order is not priority.** Display order may support chronology and
  editing, but the prompt must not imply first/last wins. The model's choice is
  justified by passage fit, not UI order.
- **No forced use.** If no lens fits honestly, the model leaves the beat alone;
  it must not invent scene facts or fuse unrelated lenses to demonstrate the
  stack.
- **A hard stack cap is an implementation gate.** Sprint 06 derives it from
  worst-case validated directive-frame and prompt-budget evidence. It is not
  assumed from the old three-lens blending sketch.

## Scope / deliverables

1. Replace the one-active-directive-per-family assumption with a keyed Lexical
   Gravity directive collection while preserving Prose Controller as a distinct
   family and its existing precedence boundary.
2. Stack presentation: individual active strips, edit/reopen, and remove for
   each directive; no dominance controls or 100-percent allocator.
3. A stack-aware prompt frame with an explicit relevance-selection rule and no
   hidden ordering semantics. Existing per-lens preview remains individual; no
   synthetic blended preview is introduced.
4. Session shape, hydration, integrity, and migration witnesses: every current
   single Lexical Gravity directive restores as a one-item stack without a
   writer-visible behavior change.
5. Prompt-budget, route, rendering, persistence, and behavioral tests for
   zero-match, one-match, remove-one, edit-one, stale apply, cap rejection, and
   independent coexistence with Prose Controller.

## Decisions required before implementation

- Same-lens collision policy: reapplying the same resolved lens shifts its
  active directive or creates a separately named entry.
- Exact stack cap after measuring worst-case validated lens frames.
- Writer-visible explanation, if any, for the model's selected lens on a given
  prose turn; do not manufacture hidden rationale as product evidence.

## Out of scope

- Dominance weighting, a 100-percent split, weighted merged directives, or
  blend-specific clouds/gradients.
- Cross-family arbitration: Prose Controller still owns sentence mechanics and
  punctuation while Lexical Gravity owns lexical/interpretive pressure.
- Automatic editor application or a model-selected change to persona identity
  or room behavior.

## Completion criteria

- A writer can keep several independently authored Lexical Gravity directives
  active, inspect/edit/remove each one, and trust that their configs remain
  separate historical truth.
- The prose-time prompt makes zero-or-one relevance selection testable and never
  communicates a false dominance or averaging rule.
- Old single-directive sessions hydrate as a one-item stack; cap, budget, and
  no-invented-facts witnesses pass.
- No `vscode` enters core; architecture witnesses, typechecks, lint, build, and
  tests pass.
