# Sprint 02: Lexical Gravity + Standing Prose-Directive Rail

**Status**: Planned
**Priority**: High
**Branch**: `sprint/conversation-widgets-02-lexical-gravity-standing-rail` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 6-9 days
**Depends on**: Sprint 01 (widget host + thread-artifact commit) merged into `epic/conversation-widgets`
**ADR**: [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md)

## Goal

Build the **standing prose-directive rail** — the durable rail that Sprints 2–4
share — and prove it with its first real widget, **Lexical Gravity**. A standing
directive is a passage-scoped instruction consulted **only when a persona
produces prose for the workshopped passage**; it is dormant during pure
conversation or analysis and never touches persona identity or conversation
behavior.

Lexical Gravity lets the writer bias the passage's prose toward an interpretive
lens / world-view — "write this toward a Photography lens" — and hands the room a
compact directive at commit time. This sprint ships **single-lens** only;
blending is Sprint 04.

## Current Reality

- `WorkshopConversationBehaviorService` (new this workshop line) is the template
  for the coordinator: it serializes durable-setting changes, refuses changes
  during an active run, applies only *between runs*, and swaps a system-prompt
  segment on live conversations via
  `assistantToolService.replaceWorkshopConversationBehavior(targets, next)`
  without restarting the conversation.
- Behavior/transition frames are built in `WorkshopPromptBuilder`
  (`buildWorkshopInteractionFrame`, `buildWorkshopBehaviorActivationFrame`,
  `buildWorkshopInteractionTransitionFrame`) and stamped per writer turn by
  `WorkshopHandler.behaviorFramesFor`. The `<workshop-interaction-transition>`
  frame is the precedent for a "something durable shifted here" marker.
- `<workshop-session-attunement>` is the *shape* precedent for a validated,
  bounded, session-scoped frame — but it is **delivery guidance** (how a persona
  talks), which is exactly what a prose directive must NOT be. Lexical Gravity
  gets its **own reserved frame**, not attunement.
- The composer `+` menu already distinguishes "Add to standing context" —
  the honest UI home for a durable passage directive.
- Interpretive lenses are authored persona identity prose in
  `resources/system-prompts/workshop-personas/<id>.md`. Lexical Gravity does
  **not** read, write, or reference them.

## Locked Decisions

- **Lexical Gravity is a constraint on the emitted prose, not a lens on anyone.**
  It installs a passage-scoped directive consulted at prose-generation time,
  honored uniformly by every persona and every mode. It never modifies persona
  identity or conversation behavior. This is the ADR's orthogonality wall; this
  sprint is where it becomes load-bearing code.
- **The directive rides its own reserved standing frame** (working name
  `<workshop-prose-gravity>`), added to standing context, consulted only at
  prose-generation time, killable independently of excerpt/context attachments.
  Registered with `neutralizeReservedPersonaPromptDelimiters` in the same change.
- **A coordinator in the `WorkshopConversationBehaviorService` mold** owns the
  active directive: validate the committed payload (fail-closed), serialize
  edits, refuse mid-run changes, apply between runs, and swap the standing frame
  on live conversations. Reuse the replacement/target-collection pattern; do not
  reinvent it.
- **Edit-in-place is the standing-widget re-launch semantic.** There is one
  active Lexical Gravity directive on the passage. Clicking the chip edits the
  live directive; committing swaps the frame between runs and emits a "gravity
  shifted from X to Y" transition marker (mirroring
  `<workshop-interaction-transition>`). The directive/config id remains stable
  and its revision increments. Same cache cost class as a mode change.
- **The session owns the committed directive.** VS Code Settings may retain the
  last-used Lexical Gravity values as defaults for a new directive, but opening
  a session restores its exact normalized config without rewriting Settings.
  Sprint 10 rebuilds the standing frame from that config; a serialized old
  system message is never its source of truth.
- **Pre-commit exploration is free.** The word cloud, gradient buckets, POS
  tables, before/after examples, weight slider, degrees-of-separation, and
  metaphor checkbox all live in the widget UI and touch no conversation state
  until commit. Cost lands once, at commit, between runs.
- **Deterministic scaffold vs. model call is explicit.** POS bucketing, the
  gradient table structure, and the word schedule are deterministic; only the
  semantic word-selection and the before/after phrase rewrites hit the model.
  Live iteration (slider drags) uses a fast/cheap model **behind a debounce or an
  explicit "recompute"**; never a call per slider pixel. The last-generated
  workup is cached so reopening is instant.
- **The committed artifact ≠ the exploration UI.** What rides the rail is a
  compact, instruction-shaped directive (lens, weight, degrees-of-separation,
  metaphor on/off, a short anchor set of preferred substitutions), NOT the whole
  cloud. Keep the two representations firmly separate.
- **Active-directive indicator + one-click kill.** The writer always sees that a
  gravity is active on the passage and can remove it in one click (a durable,
  invisible influence is a debugging nightmare for the *writer*). Removal is
  itself a between-runs frame swap.
- **Single lens only this sprint.** Combining lenses is Sprint 04.
- **Core-only logic**; only the composer/indicator mount touches the adapter.

## Scope / Deliverables

1. **Reserved standing frame** `<workshop-prose-gravity>` + builder in
   `WorkshopPromptBuilder`, consulted at prose-generation time, plus
   neutralization coverage.
2. **Standing-directive coordinator** (Lexical-Gravity-specific first, shaped for
   Sprint 03 reuse): validate, serialize, between-runs apply, live-conversation
   frame swap, shift-marker emission.
3. **Lexical Gravity widget UI**: lens/world-view picker; generated word cloud;
   gradient mapping table ("capture vs. seize vs. grab"); full word schedule by
   POS; before/after phrase examples; weight slider; degrees-of-separation
   control; metaphor-pull checkbox.
4. **Live generation path** with debounce/recompute + caching, routed through
   core services on a fast model; final-workup generation option.
5. **Commit path** onto the standing rail via the coordinator; normalized
   session-owned config by stable id/revision in `WorkshopSessionService`,
   distinct from any Settings-backed new-instance defaults.
6. **Presentation-only chip** with **edit-in-place** re-launch + shift marker.
7. **Active-directive indicator + one-click kill.**
8. **Persona recommend/prefill** for Lexical Gravity (propose + seed).
9. Tests: frame build + neutralization; coordinator serialization / active-run
   refusal / between-runs apply (mirroring the behavior-service tests);
   edit-in-place identity/revision + shift marker; T3 persistence and standing
   frame reconstruction round-trip; Settings-default isolation; kill path; the
   deterministic scaffold functions (bucketing/gradient) in isolation.

## Out of Scope

- Lens **blending** / multi-lens dominance (Sprint 04).
- Prose Controller knobs (Sprint 03).
- Persona **auto-committing** a standing directive without a modal (leaning:
  never; propose only — decide in ADR).

## Completion Criteria

- A writer opens Lexical Gravity, dials a single lens with weight /
  degrees-of-separation / metaphor pull, previews before/after, commits, and
  subsequent prose *for the passage* visibly gravitates — while the personas'
  voices and behavior are unchanged.
- The active gravity is visible, editable via the chip (with a shift marker on
  change), and killable in one click.
- Editing/removing happens only between runs; an active run is never interrupted;
  the coordinator refuses mid-run edits exactly as the behavior service does.
- Slider iteration never fires a model call per pixel; reopening shows the cached
  workup instantly.
- No `vscode` in core; architecture witness green; typechecks, lint, build,
  tests pass.
