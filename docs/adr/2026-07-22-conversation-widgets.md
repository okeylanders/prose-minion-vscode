# ADR: Conversation Widgets

- **Status**: Accepted — 2026-07-29
- **Decision owner**: Okey
- **Planning source**: epic and sprint plans drafted 2026-07-22
  ([epic](../../.todo/epics/epic-conversation-widgets-2026-07-22/epic-conversation-widgets-2026-07-22.md));
  this ADR was authored 2026-07-29 at Sprint 01 kickoff, against the pulled
  design spreads (Spread 00 · the widget system, Spread 01 · Gesture
  Playground) and an architecture pass over the shipped Workshop code.
- **Delivery**: [Conversation Widgets epic](../../.todo/epics/epic-conversation-widgets-2026-07-22/epic-conversation-widgets-2026-07-22.md),
  Sprints 01–04. Sprint 01 (widget host + Gesture Playground) proves the
  one-shot rail; Sprint 02 builds the standing rail with Lexical Gravity.
- **Context**: The Workshop has two kinds of thing: **tools** (deterministic
  one-shot analyzers, stateless, identical in every mode) and **plain
  messages** (freeform persona turns). This ADR adds the third: the
  **Conversation Widget** — an interactive surface the writer *plays with
  before it commits*, whose commit drops a visible event into the thread
  plus an optional shaping payload that biases what the room produces.
  The composer already ships the door (a Widgets button opening a
  "coming soon" `WorkshopWidgetsModal`); this ADR makes the door honest.

## The shape of a widget

A widget is reached from the composer's Widgets button. It opens a
pre-commit interactive UI bound to a local **Draft**. Nothing touches the
conversation until the writer commits — Cancel/Esc costs nothing, and only
the commit pays context. On commit it lands on the **rail its lifetime
selects**, leaves a clickable **chip** on the committed turn, and — for
prose-shaping widgets — installs a directive the personas consult when they
write prose.

Personas can also drive widgets: **recommend** one (a soft chip in a persona
message that opens the widget) and **prefill** one (a persona-supplied seed
the writer can edit). *Launch* falls out of recommend. **Auto-commit is
excluded for standing directives permanently** (resolved below) and excluded
for one-shot widgets until a concrete widget earns it.

## Load-bearing decisions

These are the walls. They hold across every sprint; everything else is
decoration that can move.

### 1. Widgets never cross the persona boundary

A widget does not modify persona identity/lens, nor conversation *behavior*
(mode / expression / attunement). Persona cognition remains authored
identity prose (`resources/system-prompts/workshop-personas/<id>.md`) and
stays untouchable. Prose-shaping widgets constrain the **prose emitted for
the workshopped passage**, consulted only at prose-generation time, honored
uniformly by every persona and every mode. A widget is a knob on the
**work**, never on the **participant**.

### 2. Rail selection is by lifetime, and the one-shot rail already exists

| Lifetime | Rail | Mechanism |
|---|---|---|
| **one-shot** (this turn) | thread-artifact | The shipped Sprint 12 Phase 6B rail: staged host-side in `WorkshopSessionService.pendingMessageAttachments`, ids minted `ta-N` (monotonic, never reused), framed by `buildWorkshopThreadArtifactFrame`, rides exactly one turn, committed off the pending list only after the turn succeeds, never re-shipped. |
| **durable** (passage-scoped prose directive) | standing context | A **new reserved frame** (Sprint 02), *not* the context-attachment budget — see decision 10. Edit-in-place between runs with a shift marker, in the `WorkshopConversationSettingsService` mold (serialized, between-runs-only, per-key persistence). |
| **resource** (durable truth outside the thread) | project file | The commit leaves a visible thread event; the knowledge lives in the project. Concept-spring territory (Decisions, Scratch Pad); no code in this epic's committed sprints. |

The widget host runs the pre-commit UI, produces a validated payload, and
drops it on the rail its lifetime selects. It invents **no** new
thread-influence plumbing.

**Report widgets ride the one-shot rail.** The Writer's Dictionary
(design Spread 10) resolves the epic's "dictionary participant" divergence
flag: it is a *report widget* — the run **is** the commit, the whole report
rides one turn, nothing stands. No participant machinery, no popup sidecar.

### 3. Every commit leaves a re-openable chip; the chip is presentation-only

The model sees the frame. The writer sees a clickable chip layered over the
transcript — rendered from a display-safe typed field on the turn, mounted
the way `WorkshopQuickActionBar` mounts (a deterministic sibling of the turn
card). The chip costs **zero** model context. Clicking it re-hydrates the
full authoring UI from the persisted Draft — not a dead summary.

### 4. Re-launch semantics differ by rail

- **One-shot → clone-and-recommit only.** History is never rewritten: the
  persona already responded to the old artifact, and editing that turn would
  desync the transcript from what the model saw. The old chip stays as a
  historical marker; clicking it copies the exact Draft into a *new*
  `widgetConfigId` (lineage recorded in `clonedFromConfigId`) and a fresh
  commit mints a new artifact and turn at the head.
- **Standing → edit-in-place the live directive** (Sprint 02). One active
  directive per shaping family on the passage; editing swaps the standing
  frame **between runs** and emits a "shifted from X to Y" marker — the same
  event class and discipline as behavior transitions
  (`WorkshopTurn.behaviorTransition` → `<workshop-interaction-transition>`).
  Pre-commit tweaking is free; only the commit pays.

### 5. Three identities, three jobs

- `turnId` — the visible transcript event (existing
  `turn-<n>-<role>-<ts>` mint).
- `artifactId` — what entered retained history (existing `ta-N` mint for
  one-shot; the standing directive id arrives with Sprint 02).
- `widgetConfigId` — re-openable authoring state, minted `wc-N` from a new
  monotonic counter in the session aggregate, persisted under
  `counters` with a referential-integrity rule like `ta-N`'s
  ("counter never trails an existing id").

Clone-and-recommit mints all new identities (linked by
`clonedFromConfigId`); standing edit-in-place retains its config id and
increments a `revision`.

### 6. Config, not just output, is session-owned and persisted by stable id

The full Draft — inputs, the generated menu, the selections, the note —
persists in a **typed `widgetConfigs` collection** on the session aggregate,
serialized in `WorkshopSessionStateV1` as an **optional key** (absent
hydrates empty, so pre-widget checkpoints stay readable under the exact-key
shape validator), exported by `exportCommittedState`, hydrated by
`hydrateCommittedState`, and included in `getSnapshot()` so the webview
re-hydrates chips without extra round trips. Widget commit/edit paths use
Sprint 10's ordered autosave seam (`markDirty` after the run settles —
`exportCommittedState` throws during an active run by design). There is no
generic extension bag and no second webview-owned persistence store.

VS Code Settings may remember last-used values only to seed a **new**
instance; an opened session restores its exact committed configs without
mutating those defaults.

### 7. New reserved frames register with the neutralizer, in the same change

Any widget frame name joins `RESERVED_PERSONA_FRAME`
(`utils/workshopPromptFrames.ts`) — longest-name-first where prefixes
collide — and the enumerated literal list in
`workshopPromptFrames.test.ts`, in the same change as the frame builder,
never after. A persona quoting a writer's widget output cannot spoof or
re-inject a frame.

### 8. Deterministic scaffold vs. model call is an explicit seam

Grouping, selection state, counts, caps, and payload assembly are
deterministic code. Only semantic generation hits the model. For Gesture
Playground: one model call produces the menu; Regenerate re-rolls it;
**commit never re-runs the model**. The exploration cloud is thrown away at
commit — what rides the rail is a compact, instruction-shaped directive.
Model-facing caps live in `shared/constants/promptBudgets.ts` (the
`promptBudgets` architecture witness rejects module-local `MAX_*`
constants). Structured model output is parsed with the house pattern —
fence-stripping, strict `JSON.parse`, shape validation, **wholesale
rejection** of malformed output (the `CategorySearchService` /
`WorkshopActionableFindings` discipline: partial model output must not
quietly become writer state).

### 9. Core stays host-agnostic; handlers stay out of the god files

The widget registry, host contract, session state, prompt frames, and every
widget's logic live in `packages/core`. No `vscode` import crosses into
core; the `boundaries` witness enforces it. New IPC routes go in a **new
sibling handler** (`WorkshopWidgetHandler`, the
`WorkshopSessionMessageHandler` mold) — per the 2026-07-25 god-files debt,
`WorkshopHandler` and `WorkshopSessionService` absorb only what genuinely
belongs to the aggregate (state fields + accessors), nothing else. Services
are constructed in `extension.ts` and travel in `CoreServices`; nothing is
`new`-ed in providers or handlers.

### 10. Standing directives get their own reserved frame, not the attachment budget

*(Resolves epic open question 1, binding on Sprint 02.)* A standing prose
directive is **not** a context attachment: it must be consulted only at
prose-generation time, killable in one click, and re-shipped each run while
active. It therefore ships as its own reserved frame with its own budget
line in `promptBudgets`, not as an entry in the context-attachment list or
its aggregate word cap. `<workshop-session-attunement>` is the *shape*
precedent, not the home.

### 11. Directive families coexist; precedence is stated, not silently resolved

*(Resolves epic open question 2, binding on Sprints 03–04.)* Lexical
Gravity (*what words*) and the Prose Controller (*how the passage is made*)
are distinct families — one active directive each, separate chips, separate
kill switches. Their frames state the division of labor to the model
explicitly: on direct conflict, the Prose Controller governs sentence
mechanics and punctuation; Lexical Gravity governs word choice and
metaphor pull. Dominance weighting (Sprint 04) applies *within* the Gravity
family only — never an unweighted average, and never a cross-family
arbitration the writer didn't state.

### 12. Personas may propose standing state, never install it

*(Resolves epic open question 3.)* Persona auto-commit of a **standing**
directive is permanently out: standing state is durable and must be
writer-authored, so personas may only *recommend* (optionally with a
prefill seed) and the writer commits. One-shot auto-commit remains out of
scope until a concrete widget makes the case in its own sprint doc.

### 13. The persona protocol is parsed, typed, and fail-closed

Recommend/prefill follows the actionable-findings mold end to end: a
bounded instruction tells the persona the exact emission syntax; a strict
host-side parser rejects malformed output **wholesale**; the validated
result rides as a typed optional field on `WorkshopTurn`
(`widgetRecommendation: { widgetId, seed? }`); the webview renders a
presentation-only chip. The model never names buttons, and no recommendation
text survives into writer state unvalidated. Seeds prefill an *editable*
Draft — the persona sets the table, the writer decides what commits.

### 14. One deterministic registry

The widget registry moves from the presentation layer to
`shared/constants/workshopWidgets.ts`, beside `workshopTools.ts` and under
its rule: one deterministic table for ids ↔ labels ↔ rail ↔ group ↔
availability, rendered by the webview browser and consulted by handlers, so
the two cannot drift. Icons stay presentation-side
(`workshopToolIcons.ts` pattern). Unshipped widgets stay **visible and
disabled** in the browser — the menu is a roadmap, not a lie.

## Sprint 01 concretions

*The contested calls below were reviewed with the architecture lane
(Forge Crew, Marcus) at kickoff; verdicts are recorded inline.*

<!-- MARCUS-VERDICTS -->

## Consequences

- Sprint 02 inherits a proven host: registry, pre-commit modal lifecycle,
  Draft persistence, chip rendering, and the neutralizer discipline — and
  adds only the standing frame, its coordinator, and the
  active-directive/kill UI.
- Old checkpoints hydrate unchanged (optional collection). New checkpoints
  written after Sprint 01 are readable by older builds only if those builds
  tolerate unknown optional keys — they do not (exact-key validator), which
  is acceptable under the alpha no-backward-compatibility policy.
- The `thread-artifact` frame's contract gains a second host-minted
  attribute (see verdicts); the neutralizer and frame tests pin the
  discipline.
- More widgets are expected: a new one-shot widget brings a pre-commit
  surface, a payload validator, a registry row, and prompts — and touches
  neither the rails nor the host.
