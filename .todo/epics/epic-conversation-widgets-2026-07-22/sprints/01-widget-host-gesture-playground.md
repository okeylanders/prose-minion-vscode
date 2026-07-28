# Sprint 01: Widget Host + Gesture Playground

**Status**: Planned
**Priority**: High
**Branch**: `sprint/conversation-widgets-01-widget-host-gesture-playground` -> PR into `epic/conversation-widgets`
**Estimated Effort**: 4-6 days
**Depends on**: Workshop Sprint 10 persistence merged; ADR [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md) authored and accepted
**ADR**: same

## Goal

Prove the entire Conversation Widget spine on the *cheapest* rail, using one
concrete widget. Build **Gesture Playground** — a narrow, one-model-call
gesture/expression menu — and extract the reusable **widget host** from it once
it works. No standing directives, no live regeneration, no sliders. The point is
the skeleton: composer menu → pre-commit interactive UI → validated payload →
one-shot thread-artifact frame → re-openable chip → clone-and-recommit.

Gesture Playground is deliberately *narrower than the Writer's Dictionary tool*
(which does this at ~10x the needed size). It takes a target phrase, the
surrounding context, and character notes; returns a menu of alternatives to the
phrase; the writer selects the directions they like; the commit hands the
persona "here are the gesture directions I want *here*."

## Current Reality

- The composer (`WorkshopComposer.tsx`) already has a `+` menu splitting "Attach
  to this message" vs "Add to standing context," and a mode chip opening a
  pre-commit modal (`WorkshopConversationBehaviorModal.tsx`). The "button that
  opens a widget menu" and the "interactive modal before commit" lifecycle both
  have working precedent.
- Thread-artifacts already exist: staged host-side via
  `pendingMessageAttachments` (`workshop.ts:419–447`), surfaced as
  `<thread-artifact id="ta-N">` by `buildWorkshopThreadArtifactFrame`
  (`WorkshopPromptBuilder.ts:328`), addressable by stable id, ride exactly one
  turn, never re-shipped.
- Reserved frames are neutralized in model-quoted text by
  `neutralizeReservedPersonaPromptDelimiters` (`utils/workshopPromptFrames.ts`).
- `WorkshopSessionService` owns all host-side session state the webview
  reconciles against.
- A neutral prompted-passage runner exists (the tools use it); Gesture
  Playground's single model call should route through core services, not a new
  bespoke client.

## Locked Decisions

- **Build Gesture Playground slightly bespoke first, then lift the host.** Do not
  design the generic `ConversationWidget` abstraction before one concrete widget
  exists. The host contract is *extracted*, not *speculated*.
- **The widget host contract** (target shape, refined during extraction):
  - `id`, `label`, `icon`, `blurb` for the composer menu.
  - `initialDraft(seed?)` — `seed` is the optional persona-supplied prefill.
  - a React pre-commit surface bound to a `Draft`.
  - `commit(draft) -> WidgetCommit` producing `{ threadMessage, influence?,
    influenceLifetime }`. For Sprint 01, `influenceLifetime` is always
    `this-turn` and `influence` rides the thread-artifact rail.
- **Gesture Playground input**: `{ targetPhrase, context, characterNotes }`.
  Seed `targetPhrase` from the current editor/excerpt selection when present.
- **Gesture Playground interaction**: one model call returns a menu of gesture /
  expression alternatives (grouped, e.g. "the eyes," "the whole face," "the
  POV-reader's read"); the writer multi-selects the directions to keep; optional
  free-text note.
- **Commit** stages a one-shot thread-artifact: a compact directive ("gesture
  directions I want for '<phrase>': …selected items…") plus a visible composer
  message. It rides exactly one turn, then becomes ordinary history.
- **Every commit persists its full `Draft` under a `widgetConfigId` in
  `WorkshopSessionService`** so the chip re-hydrates the authoring UI. The
  typed config collection joins Sprint 10's complete product snapshot and
  shared ordered autosave seam; named-session and restart restore preserve the
  exact historical draft. Any Settings-backed last-used values seed only brand
  new instances.
- **Three identities, three jobs:** `turnId` is the visible transcript event,
  `artifactId` is the trusted one-shot history occurrence, and
  `widgetConfigId` is its re-openable authoring state.
- **The thread chip is presentation-only.** Webview renders a clickable marker
  over the committed turn; the model never sees the chip. Clicking re-opens
  Gesture Playground seeded from the persisted `Draft`.
- **Re-launch = clone-and-recommit.** Editing the past artifact in place is out
  of scope and, for one-shot artifacts, incorrect. The old chip persists as a
  historical marker; re-launch copies its exact Draft into a new
  `widgetConfigId`, mints a new artifact and turn, and may record
  `clonedFromConfigId`.
- **Persona protocol (minimum viable):** support *recommend* (a soft chip in a
  persona message that opens the widget) and *prefill* (persona-supplied `seed`).
  *launch* falls out of *recommend*. *auto-commit* is out of scope this sprint.
- **Core-only logic.** Widget host + Gesture Playground logic live in
  `packages/core`; only the composer mount touches the adapter. No `vscode`
  import in core.

## Scope / Deliverables

1. Composer **widget menu** affordance (button + menu listing registered
   widgets), mounted in `WorkshopComposer.tsx`.
2. **Widget host**: a registry + pre-commit modal lifecycle + the `WidgetCommit`
   contract, extracted from Gesture Playground.
3. **Gesture Playground** widget: input form, one model call, grouped menu,
   multi-select, commit.
4. **Thread-artifact commit path** reusing the existing staged-artifact rail
   (`pendingMessageAttachments` / `buildWorkshopThreadArtifactFrame`).
5. **Persisted widget config** by stable id in `WorkshopSessionService` +
   complete snapshot serialization/hydration, ordered autosave, and
   reconciliation to the webview.
6. **Presentation-only chip** in the transcript with clone-and-recommit
   re-launch.
7. **Persona recommend/prefill**: a persona message can carry a widget
   recommendation chip and an optional seed.
8. Frame neutralization coverage for any new reserved delimiter introduced.
9. Tests: host registry + commit contract; thread-artifact payload shape;
   live and named-session persistence round-trip; chip re-hydration seeds the
   exact Draft while clone-and-recommit mints new config/artifact/turn ids and
   preserves lineage; Settings defaults never overwrite restored config;
   neutralization guard.

## Out of Scope

- Standing directives / durable rail (Sprint 02).
- Sliders, live regeneration, generative previews (Sprint 02+).
- Persona auto-commit.
- Editing a committed artifact in place.

## Completion Criteria

- A writer opens the widget menu, picks Gesture Playground, plays with it,
  commits, and sees a persona incorporate the gesture directions on the next
  turn.
- The committed turn shows a chip; clicking it re-opens the widget with the exact
  prior selections; committing again creates a *new* turn without rewriting
  history.
- A persona can recommend Gesture Playground (and optionally prefill it) from
  inside a message.
- No `vscode` import in core; architecture witness green; typechecks, lint,
  build, and the new tests pass.
- The host contract is documented well enough that Sprint 02 can add a
  standing-rail widget without touching Gesture Playground.
