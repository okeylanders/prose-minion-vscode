# Sprint 03: Prose Controller

**Status**: Planned
**Priority**: Medium
**Branch**: `sprint/conversation-widgets-03-prose-controller` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 02 (standing prose-directive rail + coordinator) merged into `epic/conversation-widgets`
**ADR**: [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md)

## Goal

Add **Prose Controller**, the second prose-shaping widget, to prove the standing
rail generalizes across structurally different widgets. Where Lexical Gravity
governs *what words* the passage's prose reaches for, Prose Controller governs
*how the words are arranged* — rhythm, density, and punctuation. It reuses the
Sprint 02 standing rail, coordinator, chip, and kill-switch wholesale; the new
work is the knob set and its directive payload.

Lexical Gravity and Prose Controller coexist as **distinct active directives** on
the same passage — a writer can run both — each with its own chip and kill
switch, both consulted at prose-generation time.

## Current Reality

- Sprint 02 shipped the reserved standing frame, the between-runs coordinator
  (in the `WorkshopConversationBehaviorService` mold), edit-in-place + shift
  markers, the presentation-only chip, and the active-directive indicator + kill
  switch. Prose Controller is a second *producer* onto that infrastructure.
- The measure tools already compute deterministic prose metrics (POS via wink,
  sentence stats, punctuation counts, style flags). These are the natural
  deterministic scaffold for Prose Controller's live preview — reuse them; do not
  re-implement counting in the widget.

## Locked Decisions

- **Prose Controller is a standing prose directive, same rail as Lexical
  Gravity.** Same orthogonality wall: it constrains emitted prose for the
  passage, honored uniformly by every persona and mode; it never touches persona
  identity or conversation behavior.
- **Two active directives are allowed simultaneously** (Lexical Gravity + Prose
  Controller), each independently editable and killable. The ADR's precedence
  rule governs conflicts (e.g. a punctuation-heavy controller vs. a terse lexical
  field) — Prose Controller must state its directive without silently overriding
  Lexical Gravity.
- **Knob set (v1):**
  - **Lyricism** — plain ↔ lyrical.
  - **Part-of-speech density** — relative dial-up/down of prepositions,
    adjectives, nouns (and verbs) as a *bias*, not a hard quota.
  - **Sentence style** — length and construction (short/declarative ↔
    long/conjunctioned/subordinated).
  - **Metaphor & simile density** — sparse ↔ dense (distinct from Lexical
    Gravity's directional *metaphor pull*: this is *how much*, that is *toward
    what*).
  - **Punctuation style** — bias toward periods, em-dashes, comma-conjunctions,
    semicolons.
- **Knobs are biases, expressed to the model as directional guidance with
  optional live preview**, not deterministic post-processing of prose. The widget
  does not rewrite the persona's output; it shapes what the persona is asked to
  produce.
- **Deterministic scaffold reuse.** Live preview uses the existing measure-tool
  metrics (POS counts, sentence-length distribution, punctuation histogram) to
  show the writer where the passage currently sits vs. the requested bias; only
  the example rewrites hit the model, debounced/recompute-gated like Sprint 02.
- **Reuse Sprint 02 rail wholesale.** New reserved frame variant (or a shared
  prose-directive frame carrying a `kind`) — decided in the ADR — but the
  coordinator, between-runs discipline, chip, shift marker, indicator, and kill
  switch are reused, not forked.
- **Core-only logic**; only the composer/indicator mount touches the adapter.

## Scope / Deliverables

1. **Prose Controller widget UI**: the five knob groups above, with live
   deterministic readout (current passage stats) and model-generated example
   rewrites (debounced).
2. **Directive payload + frame** on the standing rail (shared coordinator).
3. **Commit / edit-in-place / kill** via the Sprint 02 infrastructure; persisted
   config by stable id.
4. **Coexistence with Lexical Gravity**: both directives active, both chips
   present, precedence per ADR.
5. **Persona recommend/prefill** for Prose Controller.
6. Tests: directive payload validation; coexistence (two active directives ->
   two frames, correct precedence); deterministic-readout functions;
   edit-in-place shift marker for the controller; kill path.

## Out of Scope

- Any change to the standing-rail coordinator's core semantics (that stabilized
  in Sprint 02; changes here are a smell — capture as debt).
- Deterministic prose rewriting / enforcement (knobs are biases, not filters).
- New persona-facing capabilities.

## Completion Criteria

- A writer sets lyricism, POS density, sentence style, metaphor/simile density,
  and punctuation style, previews example rewrites, commits, and subsequent
  prose *for the passage* reflects the bias — with persona voice/behavior
  unchanged.
- Lexical Gravity and Prose Controller run simultaneously without clobbering each
  other; both chips and kill switches work independently.
- The standing rail required no core-semantic changes to accept the second
  widget (proving generalization); if it did, the delta is documented as debt.
- No `vscode` in core; architecture witness green; typechecks, lint, build,
  tests pass.
