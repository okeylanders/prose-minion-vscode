# Epic: Conversation Widgets

**Created**: 2026-07-22
**Status**: Active. Okey lifted the Workshop feature freeze on 2026-08-06 after
the Workshop Architecture Refactor completed Phases 0-7. Sprint 01 merged
2026-07-30; Sprints 02A and 02B merged 2026-07-31; Sprint 02B-A landed; Sprint
02B-B is complete, including widget codec recovery and F5 acceptance. Sprint
02D establishes the persistence grammar/integrity family boundary before Prose
Controller or any other persisted widget begins.
**Progress**: ADR authored and accepted 2026-07-29 (architecture-lane review
folded in). Sprint 01 merged through [PR #96](https://github.com/okeylanders/prose-minion-vscode/pull/96)
into `epic/conversation-widgets`:
design Spreads 00+01 synced, widget registry + host contracts, `widget`
ModelScope, atomic commit route, Gesture Playground end to end (browser →
pre-commit modal → one composite generation call → commit → chip →
clone-and-recommit),
persona recommend/prefill, session-persisted `widgetConfigs`. Sprint 02A merged
through [PR #97](https://github.com/okeylanders/prose-minion-vscode/pull/97):
widget config lifecycle moved behind a session-owned ledger, Gesture gained a
local persisted codec, hydration regained a structural prepare/install boundary,
and shared shape grammar consolidated into `persistedValidation`. Sprint 02B
merged through [PR #98](https://github.com/okeylanders/prose-minion-vscode/pull/98):
single-lens Lexical Gravity, the standing prose-directive rail, project lens
resources, and writer-owned edit/kill lifecycle. Sprint 02B-A is the active
follow-up: agent-prepared widget handoff, default-on proactive assistance, and
Lexical Gravity/browser UX polish. Sprint 02B-B replaces the word-field-only
lens codec with an interpretive grammar before later widget behavior proceeds;
its [Widget Codec Recovery Mode](sprints/02b-b-widget-codec-recovery-mode.md)
exit plan now salvages recognized v1 session snapshots instead of rejecting the
whole room. The old optional Sprint 02C scope/context extraction was completed
under the mandatory
[Workshop Architecture Refactor](../epic-workshop-architecture-refactor-2026-08-03/epic-workshop-architecture-refactor.md)
and its superseded sprint file was removed. Sprint 02D records the accepted
F-07/F-09 foundation. Sprints 03 and 04 have not started.
**ADRs**: [2026-07-22 — Conversation Widgets](../../../docs/adr/2026-07-22-conversation-widgets.md) — **Accepted 2026-07-29**;
[2026-07-31 — Workshop Widget State Ownership](../../../docs/adr/2026-07-31-workshop-widget-state-ownership.md) — **Accepted 2026-07-31**;
[2026-08-01 — Lexical Gravity Interpretive Grammar](../../../docs/adr/2026-08-01-lexical-gravity-interpretive-grammar.md) — **Accepted**; implementation in PR #110 with interactive F5 acceptance verified;
[2026-08-03 — Workshop Feature Family and Module Boundaries](../../../docs/adr/2026-08-03-workshop-feature-family-and-module-boundaries.md) — **Accepted; Phase 7 completed and feature gate lifted**
**Integration branch**: `epic/conversation-widgets`

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
   | **one-shot** (this turn) | **thread-artifact** — `<thread-artifact id="ta-N">`, belongs to exactly one room turn, and is delivered once to each host/guest through that participant's room offset | `pendingMessageAttachments`, the host-private committed `threadArtifacts` ledger, and `buildWorkshopThreadArtifactFrame` |
   | **durable** (passage-scoped prose directive) | **standing context** — a passage-scoped `<prose-directive family="…" id="pd-N">` consulted only at prose-generation time; **not** attunement, **not** behavior | "Add to standing context" composer slot; `<workshop-session-attunement>` is the *shape* precedent, not the home |

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
   `replaceWorkshopConversationBehavior`. Pre-commit changes remain local;
   Apply swaps the live frame between runs.

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
   Only semantic word-selection and phrase rewrites hit the model. Each widget
   scope uses a model appropriate to its quality and contract requirements; the
   Gesture Dictionary recommends Sonnet 5. The unselected menu cloud is
   scaffolding excluded from the rail directive at commit (while remaining in
   the re-openable session config). What rides by default is a compact,
   instruction-shaped directive; the writer may explicitly include the full
   Gesture Dictionary as reference material in that same room-wide artifact.

   Spread 02 makes the Lexical Gravity boundary concrete: its built-in word
   fields, POS/reach buckets, gradients, substitutions, and cliché contrasts
   are deterministic. Slider/toggle changes make no call. `Preview the Effect`
   and `Build lens` are the only explicit model seams; the latter returns
   several bounded variants and lets the writer save one or more validated
   selections to individual `prose-minion/lenses/<slug>.json` resources in one
   action.

9. **Core stays host-agnostic.** The widget host, the registry, and every
   widget's logic live in `packages/core`. Only the composer's *mounting* touches
   `apps/vscode-extension`. No `vscode` import crosses into core.

10. **Widget state extends the accepted session-persistence spine.** Re-openable
   authoring configs and standing directives are explicit typed collections in
   the complete Workshop serializer, with absent collections hydrating empty.
   Stable turn/artifact/config ids survive round-trip. Widget commit, edit, and
   kill paths use Sprint 10's shared ordered autosave-dirty seam. There is no
   generic extension bag and no second webview-owned persistence store.

   Project lens files are reusable source material, not historical session
   truth. A committed Lexical Gravity config snapshots the resolved lens needed
   to reconstruct its exact frame; editing a project lens affects future
   selections without silently rewriting saved sessions.

## Sequencing

Build the framework on the simplest rail first (one concrete widget, slightly
bespoke), then lift the host. Build the standing rail *with* its first real
widget, not as naked infrastructure. Then prove the standing rail generalizes
with a second widget before adding v2 richness.

| # | Sprint | Rail | Proves |
|---|--------|------|--------|
| 1 | [Widget host + Gesture Playground](sprints/01-widget-host-gesture-playground.md) | thread-artifact | The whole spine on the one-shot rail: composer menu → pre-commit UI → validated payload → one-shot thread-artifact → re-openable chip → clone-and-recommit. |
| 2A | [Widget state architecture](sprints/02a-widget-state-architecture.md) | none (refactor) | Session ownership stays singular while widget config lifecycle and persisted field rules gain focused seams before the second widget. |
| 2B | [Lexical Gravity + standing prose-directive rail](sprints/02b-lexical-gravity-standing-rail.md) | standing context | The durable rail exists, built with its first real widget: four-value single-lens config, deterministic lexical-field scaffold, explicit preview/build model seams, project lens library, edit-in-place + shift marker, amber active strip + one-click kill. |
| 2B-A | [Agent-prepared widgets + UX polish](sprints/02b-a-agent-prepared-widgets-and-polish.md) | host handoff + standing UI | A selected live widget can become an editable request to the current Host; personas gain a writer-controlled, default-on proactive-assistance permission; the browser and Lexical Gravity surface match the refined design and use lifecycle language instead of payment metaphors. |
| 2B-B | [Lexical Gravity interpretive grammar](sprints/02b-b-lexical-gravity-interpretive-grammar.md) | standing context + lens resources | The lens codec represents attention, semantic positions, dynamics, and entailments before lexical realization; independent Lexical/Interpret/Recompose and Tell/Blend/Show axes determine how that reading acts and becomes legible. Preview makes the mapping inspectable. This gates later widget behavior sprints. |
| 2B-B exit | [Widget Codec Recovery Mode](sprints/02b-b-widget-codec-recovery-mode.md) | checkpoint hydration | Gesture and Lexical codecs own their checkpoint normalizations; recognized prior drafts recover through those feature routines, Lexical Gravity v1 retains its original lexical-only standing behavior, and material recovery is reported once to the writer. |
| 2D | [Widget persistence grammar and integrity](sprints/02d-widget-persistence-grammar-and-integrity.md) | none (persistence foundation) | Persisted widget codecs gain distinct checkpoint-shape, normalization, current-shape, and semantic-integrity operations; shared JSON primitives stop multiplying before Prose Controller. |
| 3 | [Prose Controller](sprints/03-prose-controller.md) | standing context | The standing rail generalizes across an interactive craft-textbook controller for diction, syntax, rhythm, density, narrative handling, figurative texture, and punctuation. |
| 4 | [Lexical Gravity: lens blending](sprints/04-lexical-gravity-lens-blending.md) | standing context | Multi-lens blending with explicit **dominance** weighting (never an unweighted average). |

Each implemented feature sprint lands as its own PR into
`epic/conversation-widgets`. Feature sequencing is frozen until the Workshop
Architecture Refactor Phase 7 explicitly lifts the gate. That gate is closed;
Sprint 02B-B is active, its recovery plan is an exit condition, and Sprint 02D
must land before Sprint 03. Final step after Sprint 04
(or the agreed cut line): one PR
`epic/conversation-widgets →` the workshop integration line.

## The prose-shaping family

Lexical Gravity (Sprints 02B and 04) and Prose Controller (Sprint 03) form a
complementary pair of passage-scoped prose directives that share the standing
rail but answer different questions:

- **Lexical Gravity** — *how a chosen world-view organizes attention, movement,
  and words*: position scene elements through an interpretive grammar, then
  realize that movement through a weighted lexical field with
  degrees-of-separation and optional explicit metaphor pull.
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
| [Creative Variations Playground](concepts/creative-variations-playground.md) | Conversation Widget | One-shot thread artifact; structured alternatives, writer selection, and clone-and-recommit. |
| [Topic Relationship Explorer](concepts/topic-relationship-explorer.md) | Conversation Widget (Learner-leaning) | One-shot thread artifact; ordered `topic-dossier` with span-verified contacts and grounding tags. |
| [Genre Relationship Explorer](concepts/genre-relationship-explorer.md) | Conversation Widget (chapter-scale) | One-shot thread artifact, **plus** an optional standing-influence pin nested inside the same commit. |
| [Writer's Dictionary](concepts/writers-dictionary.md) | Conversation Widget — **report widget** | The run *is* the commit; fifteen typed blocks ride one turn, uncapped. Never stands. |
| [Gesture Dictionary](concepts/gesture-dictionary-widget.md) | Conversation Widget — **report widget** | Same rail; surfaces the generation currently buried inside Gesture Playground. |
| [Genre Dictionary](concepts/genre-dictionary.md) | ⚠️ Speculative — no design spread | Proposed report widget; may turn out to be a craft guide instead. |

**The report widget is a real category.** The three dictionaries share a shape no
other widget has: a bounded subject, one call, an ordered document, **no
curation step**, and never standing. Their pre-commit surface is nothing but
their inputs, which is why the run *is* the commit. A dictionary describes a
territory; it never takes a position on the writer's prose — so none of the three
may ever pin. Standing behavior stays on Lexical Gravity's rail, where a lens is
*authored*: chosen, weighted, killable.

**Implemented, not a spring.**
[Gesture Dictionary — Semantic Runway](concepts/gesture-dictionary-semantic-runway.md)
lives in `concepts/` but is **implemented** (2026-07-29): it is a Sprint 01
generation-quality upgrade — one composite call producing a writer-facing
Gesture Dictionary followed by a strictly validated JSON menu — not a
widget-shaped idea awaiting promotion. It is listed here so the folder has no
orphans.

**Prose Controller is not a concept spring.** It remains committed Sprint 03
work, but its plan now specifies an "Art of the Craft"-style control surface
with deeper, teachable style levers rather than a thin bank of sliders.

## Related / deferred (not committed widget sprints)

- **Dictionary participant — RESOLVED 2026-07-30: it is a widget after all.**
  This entry previously read *"do not build it as a widget"*, on the grounds that
  a "chat with the dictionary" surface is a *participant* (a retained
  conversational sidecar) with a popup, and that forcing it into the widget
  commit model would break the "play → commit → rail" architecture.

  **Design Spread 10 is the ADR that answers it, and the answer is that it was
  never a participant.** The Dictionary is the first **report widget**: a
  one-shot whose pre-commit surface is nothing but its inputs. The run *is* the
  commit, so there is no play-then-commit gap to model and no chat to retain —
  the architectural objection dissolves rather than being overridden. The
  original objection was to a *conversational sidecar*, which is not what the
  design proposes.

  Now tracked as a concept spring: [Writer's Dictionary](concepts/writers-dictionary.md).
  The "report widget" category it establishes is reused by
  [Gesture Dictionary](concepts/gesture-dictionary-widget.md) and the speculative
  [Genre Dictionary](concepts/genre-dictionary.md).
- **More widgets are expected.** The host contract (Sprint 01) and the standing
  rail (Sprint 02B) are the two reusable substrates; later widgets pick a rail and
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

## Resolved questions

ADR 2026-07-22 decisions 10–12 close the former open questions:

- **Reserved budget/frame:** standing prose directives use the bounded
  `<prose-directive family="…" id="pd-N">` frame, not the excerpt/context-
  attachment budget. They are consulted only at prose-generation time and
  killed independently.
- **Cross-family precedence:** Prose Controller governs sentence mechanics and
  punctuation; Lexical Gravity governs word choice and metaphor pull. The
  frames state that division rather than silently arbitrating it.
- **Standing-state authorship:** personas may recommend and prefill, but never
  auto-commit standing state. An explicit writer commit installs or changes a
  durable directive.
