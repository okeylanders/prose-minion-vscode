# Sprint 01: Widget Host + Gesture Playground

**Status**: Complete — merged into `epic/conversation-widgets` via PR #96 on 2026-07-30
**Priority**: High
**Branch**: `claude/gesture-dictionary-prompt-qgeuyq`
**Estimated Effort**: 4-6 days
**Depends on**: Workshop Sprint 10 persistence merged; ADR [2026-07-22 — Conversation Widgets](../../../../docs/adr/2026-07-22-conversation-widgets.md) authored and accepted
**ADR**: same — authored and accepted 2026-07-29 with the architecture-lane
review folded into its "Sprint 01 concretions" (atomic commit route instead of
the shared pending list; host-minted `kind` attribute; sibling
`WorkshopWidgetHandler` constructed inside `WorkshopHandler`; new `widget`
ModelScope; rail-discriminated turn linkage with config revisions)

## Completion notes (2026-07-29)

- Design Spreads 00 + 01 pulled into `docs/design/` (epic kickoff sync).
- **One deliberate delta from the locked decisions**: the commit rides the
  `ta-N` mint and frame builder but **bypasses `pendingMessageAttachments`**
  — the shipped Phase 6B doctrine reserves that list for explicit composer
  sends, and its persistence would orphan a widget artifact on a failed
  commit. See the ADR's Sprint 01 concretions.
- **Two small deferrals, tracked honestly**:
  - `targetPhrase` seeding from the live editor selection needs a new host
    round-trip (the existing SELECTION_DATA flow is paste-verification);
    fresh opens start blank for now. Persona prefill and chip clone both seed.
  - No Settings-backed last-used draft values were added (nothing needs one
    yet); sessions restore exact committed configs, and the
    `proseMinion.widgetModel` setting covers the independent widget scope.
- Coverage: registry integrity + kind round-trip; frame-builder closed-set
  validation + quoted-frame neutralization; fail-closed recommendation parser
  with live-gating and the rich host/guest prefill plus closed source refs; menu-parse
  rejection table; `wc-N` minting / clone lineage / shared counter / V1
  round-trip and integrity rejections; handler generate-race + atomic-commit +
  retry-token semantics; modal seed/clone re-hydration and host-confirmed
  close. Architecture witnesses, lint, build, and bundle verification are
  green.
- Follow-on hardening adds the selected widget model to the fixed footer,
  shared-browser launch, private SSE progress telemetry, a centralized
  50,000-token output ceiling, untouched-provider-content parsing, and typed
  host source references. Persona prose remains rich and required; references
  add the current active excerpt or selected `ctx-N` session copies without
  requiring duplicate transcription.

## Goal

Prove the entire Conversation Widget spine on the simplest rail, using one
concrete widget. Build **Gesture Playground** — a quality-first, one-model-call
Gesture Dictionary plus gesture/expression menu — and extract the reusable
**widget host** from it once it works. No standing directives, no live
regeneration, no sliders. The point is the skeleton: composer menu → pre-commit
interactive UI → validated payload → one-shot thread-artifact frame →
re-openable chip → clone-and-recommit.

Gesture Playground borrows the Writer's Dictionary's semantic breadth and
adapts it to embodied beats. It takes a target phrase, separate writer
instructions, surrounding context, and character notes; returns a
writer-facing Markdown scan plus a menu of alternatives; the writer selects the
directions they like; the commit hands the persona "here are the gesture
directions I want *here*."

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
- **Gesture Playground input**:
  `{ targetPhrase, writerInstructions, contextText, characterNotes,
  sourceReferences }`.
  Seed `targetPhrase` from the current editor/excerpt selection when present.
  `sourceReferences` is a bounded closed union of `active-excerpt` and
  host-minted `context-attachment:ctx-N` addresses; it augments rather than
  replaces the four rich prose fields.
- **Gesture Playground interaction**: one model call returns a bounded,
  expandable Gesture Dictionary followed by a strictly framed JSON menu of
  gesture/expression alternatives; the writer multi-selects the directions to
  keep and may add an optional free-text note.
- **Composite parse boundary**: a valid bounded `dictionaryMarkdown` may be
  shown when the menu frame or JSON fails, but that result carries no menu and
  cannot commit. A missing, empty, malformed, or over-budget dictionary is
  fatal to the whole response. Partial or malformed menu content never becomes
  selectable writer state.
- **Persisted Gesture Draft**:
  `{ targetPhrase, writerInstructions, contextText, characterNotes,
  sourceReferences, dictionaryMarkdown, menu, selections, note,
  includeDictionaryInCommit }`. The generated dictionary and menu are retained
  so a chip can restore the exact authoring surface. The unselected menu never
  rides the commit rail; the dictionary is excluded by default and joins the
  artifact only when the writer explicitly opts in.
- **Commit** stages a one-shot thread-artifact: a compact directive ("gesture
  directions I want for '<phrase>': …selected items…") plus a visible composer
  message. It belongs to exactly one room turn and is delivered once to every
  host/guest through that participant's room offset. Direct tool chats remain
  private.
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
  persona message that opens the widget) and *prefill* (persona-supplied
  `seed`). One shared instruction applies to hosts and guests. A Gesture
  Playground recommendation must be the response's strict, bounded multiline
  tail and must include all four editable prose inputs plus the source-reference
  field: the exact target phrase,
  generous writer instructions, generous consecutive surrounding source text,
  selected session-local source addresses (or `none`), and detailed
  evidence-grounded character notes. The instruction explicitly
  says not to be thrifty: provide enough scene-specific material to make the
  downstream dictionary useful, without padding or inventing facts. The
  parser validates the versioned frame, exact tag order and uniqueness,
  non-empty fields, live widget id, final-tail placement, and centralized field
  bounds; any violation rejects the seed wholesale. The reserved control is
  stripped from transcript prose on both acceptance and rejection. *launch*
  falls out of *recommend*. *auto-commit* is out of scope this sprint.
- **Core-only logic.** Widget host + Gesture Playground logic live in
  `packages/core`; only the composer mount touches the adapter. No `vscode`
  import in core.

## Scope / Deliverables

1. Composer **widget menu** affordance (button + menu listing registered
   widgets), mounted in `WorkshopComposer.tsx`.
2. **Widget host**: a registry + pre-commit modal lifecycle + the `WidgetCommit`
   contract, extracted from Gesture Playground.
3. **Gesture Playground** widget: four-part prose input form plus optional
   host-source selections, one streaming composite model call, expandable
   Gesture Dictionary, grouped menu, multi-select, commit.
4. **Thread-artifact commit path** reusing the existing staged-artifact rail
   (`pendingMessageAttachments` / `buildWorkshopThreadArtifactFrame`).
5. **Persisted widget config** by stable id in `WorkshopSessionService` +
   complete snapshot serialization/hydration, ordered autosave, and
   reconciliation to the webview.
6. **Presentation-only chip** in the transcript with clone-and-recommit
   re-launch.
7. **Persona recommend/prefill**: hosts and guests share one bounded,
   fail-closed recommendation contract. A Gesture Playground recommendation
   carries a complete rich seed plus closed source references in a strict
   multiline tail; its control
   framing is stripped before transcript display.
8. Frame neutralization coverage for any new reserved delimiter introduced.
9. Tests: host registry + commit contract; composite frame parsing, including
   display-only dictionary salvage and dictionary-fatal cases;
   thread-artifact payload shape; live and named-session persistence
   round-trip; chip re-hydration seeds the exact Draft while
   clone-and-recommit mints new config/artifact/turn ids and preserves lineage;
   Settings defaults never overwrite restored config; neutralization guard.

## Out of Scope

- Standing directives / durable rail (Sprint 02B).
- Sliders, live regeneration, generative previews (Sprint 02B+).
- Persona auto-commit.
- Editing a committed artifact in place.

## Completion Criteria

- A writer opens the widget menu, picks Gesture Playground, plays with it,
  commits, and sees a persona incorporate the gesture directions on the next
  turn.
- The committed turn shows a chip; clicking it re-opens the widget with the exact
  prior selections; committing again creates a *new* turn without rewriting
  history.
- A host or guest can recommend Gesture Playground from inside a message with
  all four substantive prose inputs and the source-reference field prefilled;
  malformed or partial controls produce no recommendation, control framing
  never leaks into the transcript, and the writer can edit every accepted
  value before generating.
- No `vscode` import in core; architecture witness green; typechecks, lint,
  build, and the new tests pass.
- The host contract is documented well enough that Sprint 02B can add a
  standing-rail widget without touching Gesture Playground.
