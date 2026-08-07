# Sprint 02B: Lexical Gravity + Standing Prose-Directive Rail

**Status**: Complete — merged through PR #98 on 2026-07-31
**Priority**: High
**Branch**: `sprint/conversation-widgets-02b-lexical-gravity-standing-rail` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 6-9 days
**Depends on**: Sprint 02A (widget-state architecture) merged into `epic/conversation-widgets`
**ADR**: [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md)
**Design**: [Spread 02 — Lexical Gravity](../../../../docs/design/Prose%20Minion%20-%20Lexical%20Gravity.html)

## Goal

Build the **standing prose-directive rail** — the durable rail that Lexical
Gravity and Prose Controller share — and prove it with its first real widget,
**Lexical Gravity**. A standing
directive is a passage-scoped instruction consulted **only when a persona
produces prose for the workshopped passage**; it is dormant during pure
conversation or analysis and never touches persona identity or conversation
behavior.

Lexical Gravity lets the writer bias the passage's prose toward an interpretive
lens / world-view — "write this toward a Photography lens" — and hands the room a
compact directive at commit time. This sprint ships **single-lens** only;
blending is Sprint 04.

## Resolved Foundation from Sprint 02A

Sprint 02A merged through [PR #97](https://github.com/okeylanders/prose-minion-vscode/pull/97)
and deliberately shipped no Lexical Gravity behavior. It resolved the state
ownership questions this sprint now builds on:

- `WorkshopWidgetConfigLedger` owns config identity, defensive copies,
  summaries, reset, export, and two-phase hydration installation; widget-local
  clone/summary operations are injected rather than hard-coded to Gesture.
- Gesture Playground owns its persisted draft codec. This sprint adds a
  sibling Lexical Gravity codec and turns the current Gesture-shaped config
  body into the earned `widgetId`-discriminated union.
- `persistedValidation` is the single shared structural grammar; do not create
  another widget/session validation helper.
- The session remains the aggregate and persistence clock. Standing state joins
  the complete Workshop checkpoint; there is no widget repository, extension
  bag, or webview-owned durable store.
- Hydration is prepare-then-install: every validation, normalization, and clone
  finishes before live session fields are assigned.
- No standing-directive coordinator was prebuilt. It arrives here with Lexical
  Gravity as its first concrete producer.

The scope/context IPC extraction is intentionally **not** a dependency of this
feature. That responsibility later moved into the mandatory Workshop
Architecture Refactor and is no longer a Conversation Widgets sprint.

## Design / ADR Reconciliation

Spread 02 is the approved interaction and visual source. The ADR and this plan
remain behavioral truth where the synced prototype still labels a decision as
"leaning" or "open": the reserved frame, cross-family precedence, and
writer-only standing commit are resolved. The spread's older "Sprint 02" label
maps to Sprint 02B after the sequencing split.

## Current Reality

- `WorkshopConversationSettingsService` is the template
  for the coordinator: it serializes durable-setting changes, refuses changes
  during an active run, applies only *between runs*, and swaps a system-prompt
  segment on live conversations via
  `assistantToolService.replaceWorkshopConversationSettings(targets, next)`
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
- Approved design Spread 02 fixes the visible contract: an amber active strip
  docked above the composer; install/shift/kill markers; four writer-facing
  controls (lens, weight, reach, metaphor pull); deterministic Word field /
  Gradient / Substitutions / Clichés tabs; and explicit `Preview the Effect` and
  `Build lens` model seams.
- Interpretive lenses are authored persona identity prose in
  `resources/system-prompts/workshop-personas/<id>.md`. Lexical Gravity does
  **not** read, write, or reference them.

## Locked Decisions

- **Lexical Gravity is a constraint on the emitted prose, not a lens on anyone.**
  It installs a passage-scoped directive consulted at prose-generation time,
  honored uniformly by every persona and every mode. It never modifies persona
  identity or conversation behavior. This is the ADR's orthogonality wall; this
  sprint is where it becomes load-bearing code.
- **The directive rides the reserved `<prose-directive>` frame**, with a
  host-minted closed `family="lexical-gravity"` attribute and stable `pd-N` id.
  It is added to standing context, consulted only at prose-generation time,
  killable independently of excerpt/context attachments, and registered with
  `neutralizeReservedPersonaPromptDelimiters` in the same change.
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
- **Pre-commit exploration does not touch conversation state.** The word cloud,
  gradient buckets, POS tables, weight slider, degrees-of-separation, and
  metaphor checkbox stay local. Deterministic controls make no model call;
  only the explicit preview and lens-builder actions spend model tokens. Prompt-
  rail/context cost lands once, at commit, between runs.
- **The writer-facing config is four values.** `lens`, `weight` (10–100 in
  five-point steps), `reach` (1°–3°), and `metaphorPull` are the only authored
  controls. The persisted widget draft also carries the validated resolved-lens
  snapshot needed to rehydrate and reconstruct the exact committed directive.
- **Deterministic scaffold vs. model call is explicit.** The six built-in lens
  fields, POS buckets by reach, semantic gradient, substitutions, and cliché
  contrasts redraw instantly and never call a model. Changing lens/weight/reach
  or metaphor pull invalidates the old preview; it does not regenerate one.
  `Preview the Effect` is one explicit fast-tier call, cached by the four-value
  config. The committed directive never reruns the preview.
- **The lens library has project-owned truth.** `Build lens` makes one explicit
  model request that returns several bounded, fully drafted lens variants; the
  writer selects one or more and saves the selected set in one action. Each
  validated selection is written to its own `prose-minion/lenses/<slug>.json`,
  making it reusable across sessions. Drafting and choosing remain pre-commit
  play. At install time the session snapshots the
  resolved lens into its config, so later project-file edits seed future work
  without silently rewriting saved session history.
  A generated candidate set remains addressable through partial saves while
  the sheet stays open, so the writer can add more takes without repeating the
  paid build. Looking up an existing subject returns the saved project lens and
  explains that no model call was needed.
- **The committed artifact ≠ the exploration UI.** What rides the rail is a
  compact, instruction-shaped directive (lens, weight, degrees-of-separation,
  metaphor on/off, a short anchor set of preferred substitutions), NOT the whole
  cloud. Keep the two representations firmly separate.
- **Amber active strip + one-click kill.** The writer always sees that a gravity
  is active on the passage in the standing-influence rail above the composer,
  with Edit and one-click kill. A durable, invisible influence is a debugging
  nightmare for the *writer*. Removal is itself a between-runs frame swap.
- **Single lens only this sprint.** Combining lenses is Sprint 04.
- **Personas propose; writers install.** Persona auto-commit of standing state
  is permanently out. Recommendation/prefill may open the same modal, but only
  an explicit writer commit changes the active directive.
- **Core-only logic**; only the composer/indicator mount touches the adapter.

## Scope / Deliverables

1. **Reserved standing frame** `<prose-directive
   family="lexical-gravity" id="pd-N">` + widget-local builder in
   `lexicalGravity/LexicalGravityDirective.ts`, dispatched by
   `WorkshopStandingDirectiveFrames`, consulted at prose-generation time, plus
   closed-family validation and neutralization coverage. The local module keeps
   widget vocabulary beside its codec while the generic renderer owns only
   family dispatch and ordering.
2. **Standing-directive coordinator** (Lexical-Gravity-specific first, shaped for
   Sprint 03 reuse): validate, serialize, between-runs apply, live-conversation
   frame swap, shift-marker emission.
3. **Lexical Gravity widget UI** matching Spread 02: six built-in lenses;
   deterministic Word field / Gradient / Substitutions / Clichés tabs; weight
   slider; 1°–3° reach; metaphor-pull toggle; explicit preview action.
4. **Two explicit model seams**: cached fast-tier `Preview the Effect`, plus
   bounded multi-variant `Build lens` with writer multi-selection and validated
   project-resource persistence under `prose-minion/lenses/`.
5. **Commit path** onto the standing rail via the coordinator; a Lexical
   Gravity local codec; the `widgetId`-discriminated persisted config union;
   normalized session-owned config by stable id/revision, distinct from any
   Settings-backed new-instance defaults.
6. **Presentation-only transcript chip/marker** with **edit-in-place** re-launch
   and an auditable `shifted X → Y` event.
7. **Amber active-directive strip** in the standing-influence rail with Edit
   and one-click kill.
8. **Persona recommend/prefill** for Lexical Gravity (propose + seed).
9. Tests: frame build + closed-family validation + neutralization; coordinator serialization / active-run
   refusal / between-runs apply (mirroring the behavior-service tests);
   edit-in-place identity/revision + shift marker; T3 persistence and standing
   frame reconstruction round-trip; project-lens validation and historical
   snapshot isolation; kill path; explicit model
   call boundaries; deterministic scaffold functions in isolation.

## Out of Scope

- Lens **blending** / multi-lens dominance (Sprint 04).
- Prose Controller knobs (Sprint 03).
- Workshop scope/context IPC extraction, subsequently completed by the
  Workshop Architecture Refactor.

## Completion Criteria

- A writer opens Lexical Gravity, dials a single lens with weight /
  degrees-of-separation / metaphor pull, previews the pull as the lens's canned
  sample before and the model result after, commits, and
  subsequent prose *for the passage* visibly gravitates — while the personas'
  voices and behavior are unchanged.
- The active gravity is visible, editable via the chip (with a shift marker on
  change), and killable in one click.
- Editing/removing happens only between runs; an active run is never interrupted;
  the coordinator refuses mid-run edits exactly as the behavior service does.
- Slider/control iteration fires no model calls; preview and lens building occur
  only through their explicit actions, and reopening shows cached work instantly.
- No `vscode` in core; architecture witness green; typechecks, lint, build,
  tests pass.
