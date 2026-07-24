# Epic: Conversation Widgets

**Created**: 2026-07-22
**Status**: Planning
**Progress**: Epic and sprint plans drafted; concept springs catalogued. No code yet. ADR pending (author before Sprint 01).
**ADRs**: [2026-07-22 — Conversation Widgets](../../../docs/adr/2026-07-22-conversation-widgets.md) *(to author first — the two load-bearing decisions live here)*
**Integration branch**: `epic/conversation-widgets` *(to branch from the completed Workshop line after Sprint 10 persistence and the widget ADR land)*

## Goal

Add a third kind of thing to the Workshop, alongside **tools** (deterministic
one-shot analyzers) and **plain messages** (freeform persona turns): the
**Conversation Widget** — an interactive surface the writer *plays with before
it commits*, whose commit drops two things into the thread at once: a visible
event **and** an optional shaping payload that biases what the room produces.

A widget is reached from a button on the composer. It opens a pre-commit
interactive UI (sliders, checkboxes, generated previews). Nothing touches the
conversation until the writer commits. On commit it lands on the correct
**rail** for its lifetime, leaves a clickable **chip** in the thread, and — for
prose-shaping widgets — installs a passage-scoped directive the personas consult
when they write prose.

Personas can also drive widgets: *recommend* one ("want to play with Lexical
Gravity here?"), *launch* one empty, *prefill* one with values already set, or
(rarely) *auto-commit* one without a modal. A widget is producer-agnostic — the
persona and the user reach the same `WidgetCommit` contract.

## The three things, disambiguated

| | Trigger | UX | Commits | Effect on thread |
|---|---|---|---|---|
| **Tool** (assist/measure) | invoke → run | none pre-commit | a result artifact | none; stateless, identical in every mode |
| **Plain message** | type → send | freeform text | the text | persona reacts once |
| **Widget** (this epic) | open → **play** → commit | **interactive, stateful, pre-commit** | a visible event **+** an optional shaping payload | rides a rail; leaves a re-openable chip |

## Load-bearing decisions (the ADR — hold across every sprint)

These are the walls. Everything else is decoration that can move.

1. **Widgets never cross the persona boundary.** A widget does not modify persona
   identity/lens, nor conversation *behavior* (mode / expression / attunement).
   The interpretive-lens cognition is authored persona identity prose
   (`resources/system-prompts/workshop-personas/<id>.md`) and stays untouchable.
   Prose-shaping widgets constrain the **prose emitted for the workshopped
   passage**, consulted only at prose-generation time, honored *uniformly by
   every persona and every mode*. A widget is a knob on the **work**, never on
   the **participant**. (Lexical Gravity is not a lens on anyone; it is a
   direction the passage's prose should gravitate.)

2. **Rail selection is by lifetime, and both rails already exist.**

   | Lifetime | Rail | Existing precedent |
   |---|---|---|
   | **one-shot** (this turn) | **thread-artifact** — `<thread-artifact id="ta-N">`, rides exactly one turn, becomes ordinary history, never re-shipped | `pendingMessageAttachments` (`workshop.ts:419–447`), `buildWorkshopThreadArtifactFrame` |
   | **durable** (passage-scoped prose directive) | **standing context** — a passage-scoped frame consulted only at prose-generation time; **not** attunement, **not** behavior | "Add to standing context" composer slot; `<workshop-session-attunement>` is the *shape* precedent, not the home |

   The widget host's job is to run the pre-commit UI, produce a validated
   payload, and drop it on the rail its lifetime selects. It is **not** inventing
   thread-influence plumbing — that is built.

3. **Every widget commit leaves a re-openable chip; the chip is presentation-only.**
   The model sees the frame (thread-artifact or standing directive). The *user*
   sees a clickable chip layered over the transcript in the webview. The chip
   costs **zero** model context. Clicking it re-hydrates the full interactive UI
   from persisted config.

4. **Re-launch semantics differ by rail:**
   - **Thread-artifact widgets → clone-and-recommit only.** Never edit history.
     The persona already responded to the old artifact; rewriting that turn
     desyncs the transcript from what the model saw. The old chip stays as a
     historical marker; clicking it seeds a *new* commit at the head.
   - **Standing widgets → edit-in-place the live directive.** There is one active
     directive per shaping family on the passage; editing it swaps the standing
     frame **between runs** and emits a "shifted from X to Y" marker — the same
     event class and cache cost as a mode/expression change via
     `replaceWorkshopConversationBehavior`. Pre-commit tweaking is free; only the
     commit pays.

5. **Config, not just output, is session-owned and persisted by stable id.**
   The chip re-hydrates the exact authoring UI, not a dead summary. VS Code
   Settings may remember last-used values only to seed a *new* widget instance;
   opening a session restores its committed configs and standing directives
   without mutating those defaults.

6. **Occurrence, artifact, and authoring identity stay separate.** `turnId`
   identifies the visible event, `artifactId` identifies what entered retained
   history, and `widgetConfigId` identifies re-openable authoring state.
   Clone-and-recommit mints all new identities (optionally linked by
   `clonedFromConfigId`); standing edit-in-place retains its config/directive id
   and increments a revision.

7. **New reserved frames register with the neutralizer.** Any widget frame must be
   neutralized by `neutralizeReservedPersonaPromptDelimiters`
   (`utils/workshopPromptFrames.ts`) so a persona quoting a user's widget output
   cannot spoof/re-inject a frame. Ships in the same change as the frame, never
   after.

8. **Deterministic scaffold vs. model call is an explicit seam inside each widget.**
   POS tables, gradient buckets, sliders, punctuation counts — deterministic.
   Only semantic word-selection and phrase rewrites hit the model. Live iteration
   uses a fast/cheap model; the committed "full workup" may use a better one. The
   exploration UI is scaffolding thrown away at commit; what rides the rail is a
   compact, instruction-shaped directive — never the whole cloud.

9. **Core stays host-agnostic.** The widget host, the registry, and every
   widget's logic live in `packages/core`. Only the composer's *mounting* touches
   `apps/vscode-extension`. No `vscode` import crosses into core.

9. **Widget state extends the accepted session-persistence spine.** Re-openable
   authoring configs and standing directives are explicit typed collections in
   the complete Workshop serializer, with absent collections hydrating empty.
   Stable turn/artifact/config ids survive round-trip. Widget commit, edit, and
   kill paths use Sprint 10's shared ordered autosave-dirty seam. There is no
   generic extension bag and no second webview-owned persistence store.

## Sequencing

Build the framework on the *cheapest* rail first (one concrete widget, slightly
bespoke), then lift the host. Build the standing rail *with* its first real
widget, not as naked infrastructure. Then prove the standing rail generalizes
with a second widget before adding v2 richness.

| # | Sprint | Rail | Proves |
|---|--------|------|--------|
| 1 | [Widget host + Gesture Playground](sprints/01-widget-host-gesture-playground.md) | thread-artifact | The whole spine on the cheap rail: composer menu → pre-commit UI → validated payload → one-shot thread-artifact → re-openable chip → clone-and-recommit. |
| 2 | [Lexical Gravity + standing prose-directive rail](sprints/02-lexical-gravity-standing-rail.md) | standing context | The durable rail exists, built with its first real widget: passage-scoped prose directive, coordinator in the `WorkshopConversationBehaviorService` mold, edit-in-place + shift marker, active-directive indicator + one-click kill. Single lens. |
| 3 | [Prose Controller](sprints/03-prose-controller.md) | standing context | The standing rail generalizes across an interactive craft-textbook controller for diction, syntax, rhythm, density, narrative handling, figurative texture, and punctuation. |
| 4 | [Lexical Gravity: lens blending](sprints/04-lexical-gravity-lens-blending.md) | standing context | Multi-lens blending with explicit **dominance** weighting (never an unweighted average). |

Each sprint lands as its own PR into `epic/conversation-widgets`. Final step
after Sprint 04 (or the agreed cut line): one PR `epic/conversation-widgets →`
the workshop integration line.

## The prose-shaping family

Sprints 2–4 form a complementary pair of passage-scoped prose directives that
share the standing rail but answer different questions:

- **Lexical Gravity** — *what words*: bias lexis toward an interpretive
  lens / world-view (Photography, Mathematics, Music…), with weight and
  degrees-of-separation, optional metaphor pull.
- **Prose Controller** — *how the passage is made*: diction/register, sentence
  architecture, rhythm/sound, lexical/modifier density, figurative/sensory
  texture, narrative handling, and punctuation/emphasis.

They coexist as distinct active directives on the passage (a writer can run both
at once), each with its own chip and kill switch, both consulted at
prose-generation time.

## Concept springs (exploration, not committed sprints)

The [`concepts/`](concepts/README.md) folder holds promising widget-shaped ideas
before they earn a sprint. A concept spring may refine into a Conversation
Widget, a resource-backed surface, or a different Workshop primitive; appearing
here does **not** commit it to this epic's delivery sequence.

| Concept | Current classification | Likely lifecycle |
|---|---|---|
| [Decisions](concepts/decisions-widget.md) | Conversation Widget + derived transcript view | Append-only thread artifact; deterministic scan assembles the decision list. |
| [Project Scratch Pad](concepts/project-scratch-pad.md) | Resource-backed widget | Project JSON resource; each append also leaves a visible thread event. |
| [Learner: English](concepts/learner-english.md) | Learning surface using the widget host | Exploration is free; selected lessons/questions may commit as one-shot artifacts. |
| [Learner: Art of the Craft](concepts/learner-art-of-the-craft.md) | Learning surface using the widget host | Same Learner shell with a storytelling-craft curriculum pack. |
| [Show vs. Tell Playground](concepts/show-v-tell-playground.md) | Conversation Widget | One-shot thread artifact; clone-and-recommit. |

**Prose Controller is not a concept spring.** It remains committed Sprint 03
work, but its plan now specifies an "Art of the Craft"-style control surface
with deeper, teachable style levers rather than a thin bank of sliders.

## Related / deferred (not committed widget sprints)

- **Dictionary participant** — a "chat with the dictionary" surface in the
  participant rail. **Flagged as an architectural divergence:** this reads as a
  *participant* (a retained conversational sidecar, like a persona guest or tool
  sidecar) with a popup, **not** as a thread-artifact widget. Forcing it into the
  widget commit model would break the "play → commit → rail" architecture. Track
  it separately (candidate: a bounded conversational participant reusing the
  existing sidecar machinery + a popup surface). Captured here so it is not lost;
  **do not** build it as a widget. Decision to be made in its own ADR/feature.
- **More widgets are expected.** The host contract (Sprint 01) and the standing
  rail (Sprint 02) are the two reusable substrates; later widgets pick a rail and
  supply a pre-commit UI + payload validator. Resource-backed and learning
  surfaces must state honestly where their durable truth lives and what, if
  anything, they commit to the conversation.

## Architectural invariants (inherited from the Workshop epic)

- **Nothing is `new`-ed in the provider or handler.** All services come from the
  `CoreServices` bundle built in `extension.ts`. The ADR 2026-06-18 architecture
  witness (`__tests__/architecture/`) stays green.
- **Session state lives host-side** in `WorkshopSessionService`, never in the
  webview.
- **Persistence remains complete and typed.** Widget state participates in
  Sprint 10's product-snapshot plus conversation-archive restore. Provider
  history persists too, but it is never the only durable home for canonical
  widget configuration or standing-directive state.
- **Settings are defaults, sessions are historical truth.** Last-used values
  may seed a new instance; an opened session restores its exact committed
  configs without changing global Settings.
- **`packages/core` never imports `vscode`.**
- **Behavior changes only between runs.** Standing-widget commits inherit the
  active-run guard and serialization discipline already coordinated by
  `WorkshopConversationBehaviorService`.

## Open questions (resolve in the ADR)

- Does a standing directive belong in the same standing-context frame budget as
  excerpt/context attachments, or its own reserved frame? (Leaning: own reserved
  frame, so it can be consulted only at prose-generation time and killed
  independently.)
- Precedence when both Lexical Gravity and Prose Controller are active and imply
  conflicting choices (e.g. a punctuation-heavy controller vs. a terse lexical
  field). Who wins, and is it stated to the model or resolved deterministically?
- Persona auto-commit: is it ever allowed to install a *standing* directive
  without an explicit user modal, or only propose it? (Leaning: propose only;
  standing state is durable and must be writer-authored.)
