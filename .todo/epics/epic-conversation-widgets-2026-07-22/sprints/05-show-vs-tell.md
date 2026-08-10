# Sprint 05: Show vs. Tell Playground

**Status**: Planned
**Priority**: Medium
**Branch**: `sprint/conversation-widgets-05-show-vs-tell` -> PR into `epic/conversation-widgets`
**Depends on**: [Sprint 03 — Creative Variations](03-creative-variations.md) proving the bounded one-shot variation workup, and [Sprint 04 — Prose Controller](04-prose-controller.md) establishing the durable narrative-handling vocabulary
**Design source**: [Show vs. Tell Playground](../concepts/show-v-tell-playground.md)

## Goal

Let the writer explore one selected beat along a five-position continuum from
compressed explanation to embodied dramatization, see the gain and cost of each
move, choose useful local directions, and commit a one-shot artifact. Showing
and telling are both tools; the UI must never pretend the continuum is a virtue
slider.

## Locked decisions

- **A specialized Creative Variations sibling.** Sprint 03 may provide a
  mechanical typed-workup/selection seam, but this feature owns the continuum,
  channel vocabulary, prompts, response interpretation, and tradeoff readout.
  It is not a generic Creative Variations skin.
- **One-shot, not standing.** Prose Controller's broad narrative-handling bias
  and this feature's local beat experiment share vocabulary but never state.
  No selected variation silently changes an active Controller directive.
- **Writer selects the useful comparison.** Personas may recommend or prefill;
  they cannot auto-commit. Commit never replaces editor text.
- **Five named positions.** `state it`, `summarize`, `hinge`, `evidence`, and
  `inhabit` communicate the current aim and its tradeoff; a percentage slider
  would hide the teaching model.

## Scope / deliverables

1. Feature-owned draft codec and lifecycle registry arm.
2. Selected beat, surrounding context and POV constraint, must-survive and
   must-not-change fields, channel emphasis, length budget, and five-position
   continuum.
3. One cancellable, typed generation returning grouped alternatives with craft
   tradeoffs; multi-select, comparison, compact one-shot commit, and chip
   reopen/clone.
4. Shared vocabulary tests proving Show vs. Tell remains independent of Lexical
   Gravity's application gear and evidence mode, while complementing Prose
   Controller's standing narrative-handling controls.

## Out of scope

- Editor replacement, automatic rewriting, or a standing show/tell directive.
- A general-purpose variation framework that absorbs the feature's craft
  semantics.
- Lens-stack behavior; Lexical Gravity selection remains Sprint 06 work.

## Completion criteria

- A writer can intentionally choose explanation, summary, a hinge, evidence,
  or inhabitation and understand the pacing, clarity, intimacy, ambiguity, and
  scene-time tradeoffs.
- All generated/committed variants preserve the declared constraints or expose a
  visible writer decision; no variation is silently treated as canon.
- The feature reuses only truthful mechanical variation seams and remains a
  separately named, independently testable widget slice.
