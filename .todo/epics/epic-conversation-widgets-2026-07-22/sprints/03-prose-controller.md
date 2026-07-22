# Sprint 03: Prose Controller

**Status**: Planned
**Priority**: Medium
**Branch**: `sprint/conversation-widgets-03-prose-controller` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 8-12 days
**Depends on**: Sprint 02 (standing prose-directive rail + coordinator) merged into `epic/conversation-widgets`
**ADR**: [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md)

## Goal

Add **Prose Controller**, the second prose-shaping widget, to prove the standing
rail generalizes across structurally different widgets. Where Lexical Gravity
governs *what semantic field* the passage's prose reaches toward, Prose
Controller opens a broader set of craft levers for *how the passage is made*:
diction and register, syntax, rhythm, density, figurative texture, narrative
handling, and punctuation.

The interface should feel like an interactive **Art of the Craft textbook**, not
a mixing desk whose mystery sliders happen to be labeled "lyrical." Every lever
teaches what it changes, shows the passage's current tendency when measurable,
demonstrates the likely gain and cost, and lets the writer preview an example
before committing a compact directive. It reuses the Sprint 02 standing rail,
coordinator, chip, and kill-switch wholesale.

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
- **The UI is organized as craft chapters with progressive disclosure**, not a
  flat wall of controls. A chapter starts neutral, explains its vocabulary,
  shows a compact current → target readout, and exposes advanced levers only
  when opened. Reset works per chapter and for the whole controller.
- **Craft chapters (v1):**
  - **Diction & register** — plain ↔ ornate, concrete ↔ abstract, colloquial ↔
    formal, familiar/short-rooted ↔ Latinate/technical. This controls texture
    and register, not Lexical Gravity's semantic subject field.
  - **Sentence architecture** — short ↔ long, simple ↔ layered,
    coordination ↔ subordination, fragment tolerance, and uniform ↔ varied
    sentence lengths.
  - **Rhythm & sound** — clipped ↔ flowing cadence, stress/beat regularity,
    repetition/anaphora, and light sound-pattern bias (alliteration,
    assonance, consonance). These remain directions, never syllabic quotas.
  - **Lexical & modifier density** — relative dial-up/down of nouns, active or
    stative verbs, adjectives, adverbs, and prepositional phrases as biases,
    not hard POS quotas.
  - **Figurative & sensory texture** — metaphor/simile density, image
    concentration, sensory-channel breadth, and literal ↔ figurative treatment.
    Lexical Gravity answers *toward what field* a metaphor pulls; this chapter
    answers *how much figurative and sensory work* the prose performs.
  - **Narrative handling** — scene ↔ summary, compressed ↔ expanded story time,
    exterior observation ↔ interior access, and near ↔ distant psychic
    distance. These are passage-generation biases, not changes to the persona's
    conversational voice.
  - **Punctuation & emphasis** — periods, commas/conjunctions, semicolons,
    colons, em-dashes, parentheses, paragraph breaks, and white-space bias.
- **Semantic scales over false precision.** The UI may use stepped controls
  (`restrained`, `balanced`, `pronounced`) or a visual continuum, but the
  committed payload records named intentions rather than pretending that a
  model can honor "63% lyrical" exactly.
- **Every lever teaches its tradeoff.** Each control supplies: a concise
  definition; "useful when" guidance; a caution at either extreme; and a small
  before/after example. Interdependent controls surface relationships (for
  example, long subordinated sentences often slow perceived pace) without
  silently moving another control.
- **Presets are transparent starting recipes, not opaque styles.** Candidate
  presets such as `Spare`, `Propulsive`, `Meditative`, and `Lush` expand into
  visible lever values which the writer can change. No living-author imitation
  presets and no hidden prompt prose.
- **Knobs are biases, expressed to the model as directional guidance with
  optional live preview**, not deterministic post-processing of prose. The widget
  does not rewrite the persona's output; it shapes what the persona is asked to
  produce.
- **Deterministic scaffold reuse.** Live preview uses the existing measure-tool
  metrics (POS counts, sentence-length distribution, punctuation histogram) to
  show the writer where the passage currently sits vs. the requested bias; only
  the example rewrites hit the model, behind an explicit recompute action or
  debounce like Sprint 02. Qualitative craft levers that cannot be measured
  honestly show explanation and examples rather than a fabricated score.
- **The rich surface compiles to a small directive.** Neutral controls disappear;
  related non-neutral choices are collapsed into concise instruction-shaped
  guidance; contradictions fail validation or are surfaced for the writer to
  resolve. The textbook stays in the UI and does not ride the prompt rail.
- **Current → preview → compare.** The writer can compare the untouched passage
  with one generated example and see which active levers the example is meant
  to demonstrate. A preview is illustrative, not a promise or a hidden editor
  mutation.
- **Show/tell has two honest lifetimes.** Narrative handling supplies a broad
  standing scene/summary/evidence bias. The separate
  [Show vs. Tell Playground](../concepts/show-v-tell-playground.md) is a local,
  one-shot experiment for a selected beat. They share vocabulary, not state.
- **Reuse Sprint 02 rail wholesale.** New reserved frame variant (or a shared
  prose-directive frame carrying a `kind`) — decided in the ADR — but the
  coordinator, between-runs discipline, chip, shift marker, indicator, and kill
  switch are reused, not forked.
- **Core-only logic**; only the composer/indicator mount touches the adapter.

## Scope / Deliverables

1. **Prose Controller textbook UI**: seven craft chapters, progressive
   disclosure, definitions/cautions/examples, semantic scales, chapter/all
   reset, and transparent starter presets.
2. **Current → target → preview comparison**: deterministic passage readouts
   where supported plus explicitly generated example rewrites behind a
   recompute/debounce boundary.
3. **Validated directive compiler + frame**: omit neutral values, collapse
   related choices, detect contradictions, and emit compact guidance on the
   standing rail through the shared coordinator.
4. **Commit / edit-in-place / kill** via the Sprint 02 infrastructure; persisted
   config by stable id.
5. **Coexistence with Lexical Gravity**: both directives active, both chips
   present, precedence per ADR.
6. **Persona recommend/prefill** for Prose Controller.
7. Tests: directive payload validation and neutral-value elision; contradiction
   handling; preset expansion; coexistence (two active directives -> two
   frames, correct precedence); deterministic-readout functions; edit-in-place
   shift marker for the controller; kill path.

## Out of Scope

- Any change to the standing-rail coordinator's core semantics (that stabilized
  in Sprint 02; changes here are a smell — capture as debt).
- Deterministic prose rewriting / enforcement (knobs are biases, not filters).
- An exhaustive craft curriculum or completed exercise tracking (the Learner
  concepts own structured teaching beyond each lever's embedded explanation).
- Local selected-text replacement (Show vs. Tell Playground and future focused
  playgrounds own that interaction).
- Named user recipes, recipe sharing, or a preset marketplace.
- New persona-facing capabilities.

## Completion Criteria

- A writer can understand and set meaningful levers across all seven craft
  chapters, see an honest current/target comparison where measurable, preview
  an illustrative rewrite, and understand the likely gain and cost before
  committing.
- The committed frame contains only the compact non-neutral guidance—not UI
  copy, metrics, examples, or the full controller state—and subsequent prose
  *for the passage* reflects the bias with persona voice/behavior unchanged.
- Transparent presets expand into editable controls; reset returns the emitted
  directive to empty; contradictory choices cannot slip into the frame
  unnoticed.
- Lexical Gravity and Prose Controller run simultaneously without clobbering each
  other; both chips and kill switches work independently.
- The standing rail required no core-semantic changes to accept the second
  widget (proving generalization); if it did, the delta is documented as debt.
- No `vscode` in core; architecture witness green; typechecks, lint, build,
  tests pass.
