# ADR 2026-07-22: Conversation Widgets

- **Status**: Accepted — 2026-07-29; Gesture Dictionary generation and
  source-reference/streaming amendments accepted 2026-07-29; Lexical Gravity
  Spread 02 frame/lens-library amendments accepted 2026-07-31; multi-select
  generated-lens save amendment accepted 2026-07-31; widget checkpoint
  recovery and persistence-lifecycle sequencing amended 2026-08-07
- **Decision owner**: Okey
- **Planning source**: epic and sprint plans drafted 2026-07-22
  ([epic](../../.todo/epics/epic-conversation-widgets-2026-07-22/epic-conversation-widgets-2026-07-22.md));
  this ADR was authored 2026-07-29 at Sprint 01 kickoff, against the pulled
  design spreads (Spread 00 · the widget system, Spread 01 · Gesture
  Playground) and an architecture pass over the shipped Workshop code.
- **Delivery**: [Conversation Widgets epic](../../.todo/epics/epic-conversation-widgets-2026-07-22/epic-conversation-widgets-2026-07-22.md),
  Sprints 01, 02A–02B-B, 02D, and 03–04. Sprint 01 (widget host + Gesture
  Playground) proves the one-shot rail; Sprint 02A formalizes widget state
  ownership; Sprint 02B builds the standing rail with Lexical Gravity; Sprint
  02B-B must recover recognized prior widget checkpoints before exit; Sprint
  02D establishes the copyable widget persistence lifecycle before Sprint 03.
  The former optional Sprint 02C was superseded by the completed Workshop
  Architecture Refactor and removed.
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
| **one-shot** (this turn) | thread-artifact | The shipped Sprint 12 Phase 6B rail: staged host-side in `WorkshopSessionService.pendingMessageAttachments`, ids minted `ta-N` (monotonic, never reused), framed by `buildWorkshopThreadArtifactFrame`, and committed only after the turn succeeds. The artifact belongs to exactly one **room turn**: it is delivered once to every host/guest retained conversation through that participant's room offset, then never re-shipped to that participant. Direct tool conversations remain private. |
| **durable** (passage-scoped prose directive) | standing context | A **new reserved frame** (Sprint 02B), *not* the context-attachment budget — see decision 10. Edit-in-place between runs with a shift marker, in the `WorkshopConversationSettingsService` mold (serialized, between-runs-only, per-key persistence). |
| **resource** (durable truth outside the thread) | project file | The commit leaves a visible thread event; the knowledge lives in the project. Concept-spring territory (Decisions, Scratch Pad); no code in this epic's committed sprints. |

The widget host runs the pre-commit UI, produces a validated payload, and
drops it on the rail its lifetime selects. It invents **no** new
thread-influence plumbing.

The one-shot rail is room-wide, not target-private. The original addressed
persona receives the frame with the live send. Other hosts and guests receive
the same frame when the owning room turn reaches them through catch-up or a join
snapshot. Persisted turns keep display-safe references; a host-private
`threadArtifacts` ledger keeps the bounded body keyed by `ta-N` so prompt
rendering can reconstruct the trusted frame without exposing prompt-bearing
content in the webview snapshot. Per-participant room offsets are the
exactly-once boundary. Only direct tool turns and unpublished capability work
remain principal-private.

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
- **Standing → edit-in-place the live directive** (Sprint 02B). One active
  directive per shaping family on the passage; editing swaps the standing
  frame **between runs** and emits a "shifted from X to Y" marker — the same
  event class and discipline as behavior transitions
  (`WorkshopTurn.behaviorTransition` → `<workshop-interaction-transition>`).
  Pre-commit tweaking is free; only the commit pays.

### 5. Three identities, three jobs

- `turnId` — the visible transcript event (existing
  `turn-<n>-<role>-<ts>` mint).
- `artifactId` — what entered retained history (existing `ta-N` mint for
  one-shot; the standing directive id arrives with Sprint 02B).
- `widgetConfigId` — re-openable authoring state, minted `wc-N` from a new
  monotonic counter in the session aggregate, persisted under
  `counters` with a referential-integrity rule like `ta-N`'s
  ("counter never trails an existing id").

Clone-and-recommit mints all new identities (linked by
`clonedFromConfigId`); standing edit-in-place retains its config id and
increments a `revision`.

### 6. Config, not just output, is session-owned and persisted by stable id

The full Draft — inputs, writer instructions, selected host source references,
the generated Gesture Dictionary Markdown, the generated menu, the selections,
and the note —
persists in a **typed `widgetConfigs` collection** on the session aggregate,
serialized in `WorkshopSessionStateV1` as an **optional key** (absent
hydrates empty, so pre-widget checkpoints stay readable under the exact-key
shape validator), exported by `exportCommittedState`, hydrated by
`hydrateCommittedState`, and projected into `getSnapshot()` as bounded,
display-safe summaries for configs referenced by the visible turn window.
Opening a chip fetches its full config by stable id. Widget commit/edit paths use
Sprint 10's ordered autosave seam (`markDirty` after the run settles —
`exportCommittedState` throws during an active run by design). There is no
generic extension bag and no second webview-owned persistence store.

VS Code Settings may remember last-used values only to seed a **new**
instance; an opened session restores its exact committed configs without
mutating those defaults.

Lexical Gravity's custom lens library is project-owned reusable source:
`Build lens` lets the writer select one or more generated takes and writes each
validated selection to its own `prose-minion/lenses/<slug>.json` resource in one
save action. A widget commit still snapshots one resolved lens
inside the session config alongside its four writer-facing values, so later
project-file edits affect future selections without rewriting saved history or
changing the standing frame reconstructed on restore.

### 7. New reserved frames register with the neutralizer, in the same change

Any widget frame name joins `RESERVED_PERSONA_FRAME`
(`utils/workshopPromptFrames.ts`) — longest-name-first where prefixes
collide — and the enumerated literal list in
`workshopPromptFrames.test.ts`, in the same change as the frame builder,
never after. A persona quoting a writer's widget output cannot spoof or
re-inject a frame.

### 8. Deterministic scaffold vs. model call is an explicit seam

Grouping, selection state, counts, caps, response framing, and payload assembly
are deterministic code. Only semantic generation hits the model. For Gesture
Playground, one model call produces a writer-facing Gesture Dictionary
Markdown scan followed by the JSON menu in one versioned composite response.
After that succeeds, **More gestures** uses the visible dictionary, menu, and
draft fields as stateless prior-turn context; a compact prompt returns only
additional takes, which the host merges and exact-deduplicates while preserving
the writer's selections. **Regenerate all** explicitly re-rolls both artifacts;
**commit never re-runs the model**. Unselected menu
options and other exploration cloud are excluded from the committed rail
directive. The full Gesture Dictionary is excluded by default, but the writer
may explicitly opt to include it as a reference section in the same atomic
one-shot artifact. The choice persists in the Draft so clone-and-recommit
restores it exactly. The UI discloses that including the dictionary spends
context once for each host/guest when that room turn reaches them.
Model-facing caps live in `shared/constants/promptBudgets.ts` (the
`promptBudgets` architecture witness rejects module-local `MAX_*`
constants). Structured model output is parsed with the house pattern —
exact unique sentinels, bounded non-empty Markdown, strict `JSON.parse`, exact
versioned shape validation, and a narrow partial-display boundary. A missing,
empty, over-budget, or malformed dictionary frame is fatal to the whole
response. When the dictionary is valid and bounded but the menu frame or JSON
is missing or invalid, the host may salvage the dictionary **for display
only**, returns no menu, and disables commit. No malformed or partial menu may
quietly become selectable writer state (the `CategorySearchService` /
`WorkshopActionableFindings` discipline).

The canonical prompt bundle is
`resources/system-prompts/gesture-dictionary/00-gesture-dictionary.md` plus its
non-circular reference exemplar. It restores the Writer's Dictionary's full
Sense Explorer and useful lexical lanes in gesture-native form, then performs
the embodied scan. Its final three sections are deliberately ordered:
**Cliché & Convention Pressure → Freshness Strategies → Scene Synthesis
Brief**. The visible scan is a writer-facing analysis artifact, never described
or requested as private internal reasoning.

Gesture Dictionary generation has a route-specific **50,000 output-token
ceiling** in `promptBudgets`. The engine preserves untouched provider content
for structured parsing; presentation cleanup and the human truncation footer
never enter the sentinel/JSON parser. Supplying the widget's private token
callback activates the existing OpenRouter SSE path. The webview receives only
throttled, token-keyed telemetry — stage, output characters, and a clearly
labeled estimate of *visible* output tokens — plus an indeterminate progress
bar. Raw partial dictionary/menu text stays host-private until validation.
Exact provider completion usage remains terminal because reasoning-token usage
cannot be inferred from visible stream characters.

For Lexical Gravity, the six built-in lens fields, POS/reach buckets, semantic
gradient, substitutions, and cliché contrasts are deterministic and instant.
Changing lens, weight, reach, or metaphor pull makes no model call. `Preview
the pull` is one explicit fast-tier request cached by that four-value config;
`Build lens` is a separate bounded multi-variant request followed by explicit
writer selection. Neither action touches standing state; only Install/Apply
commits the directive.

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

*(Resolves epic open question 1, binding on Sprint 02B.)* A standing prose
directive is **not** a context attachment: it must be consulted only at
prose-generation time, killable in one click, and re-shipped each run while
active. It therefore ships as its own reserved frame with its own budget
line in `promptBudgets`, not as an entry in the context-attachment list or
its aggregate word cap. `<workshop-session-attunement>` is the *shape*
precedent, not the home. Spread 02 resolves the concrete Lexical Gravity
envelope as `<prose-directive family="lexical-gravity" id="pd-N">`; future
standing families reuse that envelope with a host-minted closed `family`
(`prose-controller` for Sprint 03) and host-minted `id`. The delimiter is
registered with the reserved-frame neutralizer in the same change.

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

Recommend/prefill follows the actionable-findings mold end to end. One shared
contract is appended to both host and guest persona prompts; individual persona
files do not carry divergent copies. When a persona recommends Gesture
Playground, its response must end with one exact, bounded multiline tail:

```text
### Try a widget
<workshop-widget-recommendation version="1">
<widget-id>
gesture-playground
</widget-id>
<target-phrase>
[exact phrase copied from the supplied passage]
</target-phrase>
<writer-instructions>
[substantial, scene-specific creative direction]
</writer-instructions>
<surrounding-context>
[generous consecutive source prose around the phrase]
</surrounding-context>
<source-references>
[none, or one exact active-excerpt/context-attachment:ctx-N identifier per line]
</source-references>
<character-notes>
[substantial, evidence-grounded character notes for this beat]
</character-notes>
</workshop-widget-recommendation>
```

All four prose inputs plus the source-reference field are required and remain
editable in the widget:

- **Target phrase** copies the exact passage phrase rather than paraphrasing it.
- **Writer instructions** supply several substantive sentences about the
  dramatic job, invariants, exclusions, and promising creative territory.
- **Surrounding context** supplies a generous consecutive stretch of source
  prose around the phrase, preserving its wording rather than summarizing it.
- **Source references** contain `none` or host-minted `active-excerpt` /
  `context-attachment:ctx-N` addresses. They let the widget read the current
  full session copy directly without making the persona transcribe a chapter
  or context file into its response.
- **Character notes** supply detailed, evidence-grounded information about the
  immediate pressure, intention or defense, relationship dynamics,
  self-control, habits or constraints, and relevant voice/history. Reasonable
  inference must remain distinguishable from supplied fact.

The instruction is deliberately **quality-first and non-thrifty**: personas
should use the available field budgets to provide enough grounded material for
the dictionary model to understand the beat without reconstructing it from
scraps. References are additive: they reduce duplicate transcription but never
excuse thin writer instructions, local surrounding prose, or character notes.
Generous does not mean padded or invented; context remains source prose, and
character notes remain grounded in supplied evidence.

The host-side parser requires the version, heading, tags, field order, unique
markers, non-empty values, final-tail placement, a live registry id, and
centralized per-field bounds. Missing, duplicated, reordered, trailing, empty,
over-budget, or otherwise malformed controls reject **wholesale**; no partial
seed is admitted. Syntactically valid references are also checked against the
current session when the persona turn lands; invented addresses are rejected.
At Generate time the host resolves selected addresses to the current excerpt
and attachment bodies under a separate aggregate evidence bound. Paths never
cross the widget contract, and a source removed after recommendation fails
visibly rather than silently drifting. The validated result rides as a typed
optional field on `WorkshopTurn`
(`widgetRecommendation: { widgetId, seed? }`). The reserved
control tail is stripped from transcript content whether parsing accepts or
rejects it, so neither successful machine framing nor malformed debris appears
as persona prose. The webview renders a presentation-only chip, and its seed
prefills an *editable* Draft — the persona sets the table, the writer decides
what commits.

### 14. One deterministic registry

The widget registry moves from the presentation layer to
`shared/constants/workshopWidgets.ts`, beside `workshopTools.ts` and under
its rule: one deterministic table for ids ↔ labels ↔ rail ↔ group ↔
availability, rendered by the webview browser and consulted by handlers, so
the two cannot drift. Icons stay presentation-side
(`workshopToolIcons.ts` pattern). Unshipped widgets stay **visible and
disabled** in the browser — the menu is a roadmap, not a lie.

## Sprint 01 concretions

*The five contested calls below went through the architecture lane
(Forge Crew, Marcus 🏛️) at kickoff — overall verdict
**proceed-with-changes**; the changes are folded in.*

### The widget commit is one atomic host-side route, never a pending pill

The shipped Phase 6B doctrine (written on `executeMessage`) is that
explicit composer sends ship the staged message attachments and
deterministic actions never consume them. A widget commit is a
host-authored turn, so it must not run through
`pendingMessageAttachments`: the writer's staged file pills would silently
ride the widget turn (and be manifest-stamped against the wrong speech
act), and — because the pending list is persisted — a failed commit would
leave an orphaned widget artifact that rides the writer's next plain send.

Instead, `WORKSHOP_COMMIT_WIDGET` is one atomic route that **shares the
mechanisms and bypasses the list**: it mints from the same
`threadArtifactCounter` (`ta-N` stays globally unique for tombstone
surgery), frames through `buildWorkshopThreadArtifactFrame`, ships via a
new `executeOptions.widgetArtifact` on the existing send seam (with
`includeMessageAttachments: false`), and on success stamps the
writer-origin manifest exactly as `commitMessageAttachments` does. The
durable retry token for a failed commit is the persisted `widgetConfig`
Draft — a better one than a pending pill.

### The frame gains a host-minted `kind` attribute

`<thread-artifact id="ta-N" kind="widget:gesture-playground">`. The house
rule was never "no attributes" — it was "no writer-controlled attributes"
(the interaction frame already carries four closed-enum attributes under
that exact justification). Conditions honored in the same change: the
builder **throws** on any kind not derived from the closed widget
registry (as it already throws on malformed ids), and the doc-comment
house rule on the builder is amended to say "id plus host-minted kind
from the closed widget registry". The neutralizer already swallows
attributes on quoted `thread-artifact` frames, and Sprint 01 introduces
**no new reserved frame name** — decision 7 is satisfied trivially.

### `WorkshopWidgetHandler` is constructed inside `WorkshopHandler`

The sibling-handler precedent is `WorkshopSessionMessageHandler`:
`WorkshopHandler` constructs it directly and hands it closures over its
own private seams at construction time. `WorkshopWidgetHandler` follows
suit — constructor-injected `sendRoomMessage` closure over
`executeMessage`, routes registered through the same
`registerRoutes(router, registerMutation)` shape, commit gated as a
mutation. No post-construction binding step, and no widget wiring in
`MessageHandler` (the composition root stays ignorant of workshop
internals per ADR 2026-06-18). Extracting the send seam into a
collaborator service is **rejected for this sprint** — `executeMessage`
is entangled with run lifecycle and room delivery, and extracting it
under a feature deadline is how god-file surgery goes wrong; it stays
with the 2026-07-25 debt ticket as a pure move.

### Model tier: a fifth `ModelScope`, `'widget'`

Added now, not deferred: `ModelScope` is a closed union with a uniform
bundle path, and the widget host contract is a Sprint 01 deliverable that
Sprint 02B's live regeneration builds on — shipping the generate route on
scope `'assistant'` would bake the wrong scope into the contract and force
Sprint 02B to change route, contract, and a settings default in one move.
`proseMinion.widgetModel` joins the settings surface as an independent
quality-tunable scope. Gesture Dictionary generation is a long-form semantic
synthesis and framed-output task; the recommended default moves from Haiku to
**Sonnet 5**. Cost efficiency is secondary to producing options the writer
would keep.

### Turn linkage, config shape, and the snapshot bound

- The widget commit turn is a **normal user message turn** decorated with
  a display-safe optional field — no new `WorkshopTurnArtifact` member.
  The field is **rail-discriminated from day one**:
  `widgetCommit: { widgetId, widgetConfigId, rail: 'thread-artifact',
  artifactId, selectionCount }`, with the standing arm reserved for
  Sprint 02B. `artifactId` intentionally duplicates what a refs join could
  derive — direct address beats a join; do not "deduplicate" it.
- `widgetConfigs` entries carry `revision: 1` from day one (decision 6
  names revisions; one integer now beats an optional-field migration in a
  frozen-V1 grammar later).
- **Snapshot bound**: `getSnapshot()` ships only lightweight config summaries
  referenced by turns inside the snapshot window. The full Draft is fetched
  on demand when a chip opens. Clone-and-recommit accumulates configs without
  retiring them, so durable storage remains complete while routine webview
  broadcasts stay bounded.

### The registry move inverts the type dependency

`workshopWidgets.ts` today types its rows against the sheet-browser
component's types — moving it as-is would point `shared/constants` at
`presentation`. The move re-homes the canonical types in shared:
`WorkshopWidgetId` (union), `WorkshopWidgetDescriptor`
(id/label/rail/group/tag/`live`), and the catalog live in
`shared/constants/workshopWidgets.ts` beside `workshopTools.ts`; the
sheet browser **maps** descriptors into its own card types; icons stay
presentation-side. The canonical id equals the design's frame identity —
`gesture-playground` — and the frame kind is derived mechanically as
`widget:<id>`, so the registry check on the frame builder means something.
The persona-recommendation parser rejects `widgetId`s that are not `live`
in the registry, so comp-only widgets can never render dead chips.

## Consequences

- Sprint 02B inherits a proven host: registry, pre-commit modal lifecycle,
  Draft persistence, chip rendering, and the neutralizer discipline — and
  adds only the standing frame, its coordinator, and the
  active-directive/kill UI.
- Old checkpoints hydrate unchanged (optional collection). New checkpoints
  written after Sprint 01 are readable by older builds only if those builds
  tolerate unknown optional keys — they do not (exact-key validator), which
  is acceptable under the alpha no-backward-compatibility policy.
- The `thread-artifact` frame's contract gains a second host-minted
  attribute; the frame builder throws on non-registry kinds and the frame
  tests pin the discipline. No neutralizer change is needed in Sprint 01
  (no new reserved name; the existing pattern swallows attributes).
- More widgets are expected: a new one-shot widget brings a pre-commit
  surface, a payload validator, a registry row, and prompts — and touches
  neither the rails nor the host.
