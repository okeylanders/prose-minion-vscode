# Epic: Conversation Widgets

**Created**: 2026-07-22
**Status**: Planning
**Progress**: Epic and sprint plans drafted. No code yet. ADR pending (author before Sprint 01).
**ADRs**: [2026-07-22 — Conversation Widgets](../../../docs/adr/2026-07-22-conversation-widgets.md) *(to author first — the two load-bearing decisions live here)*
**Integration branch**: `epic/conversation-widgets` *(to branch from the workshop line once the ADR lands)*

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

5. **Config, not just output, is persisted by stable id in `WorkshopSessionService`.**
   The chip re-hydrates the authoring UI, not a dead summary. Extends the
   thread-artifact "addressable by stable id" pattern from one-shot payload to
   re-openable payload-with-authoring-state.

6. **New reserved frames register with the neutralizer.** Any widget frame must be
   neutralized by `neutralizeReservedPersonaPromptDelimiters`
   (`utils/workshopPromptFrames.ts`) so a persona quoting a user's widget output
   cannot spoof/re-inject a frame. Ships in the same change as the frame, never
   after.

7. **Deterministic scaffold vs. model call is an explicit seam inside each widget.**
   POS tables, gradient buckets, sliders, punctuation counts — deterministic.
   Only semantic word-selection and phrase rewrites hit the model. Live iteration
   uses a fast/cheap model; the committed "full workup" may use a better one. The
   exploration UI is scaffolding thrown away at commit; what rides the rail is a
   compact, instruction-shaped directive — never the whole cloud.

8. **Core stays host-agnostic.** The widget host, the registry, and every
   widget's logic live in `packages/core`. Only the composer's *mounting* touches
   `apps/vscode-extension`. No `vscode` import crosses into core.

## Sequencing

Build the framework on the *cheapest* rail first (one concrete widget, slightly
bespoke), then lift the host. Build the standing rail *with* its first real
widget, not as naked infrastructure. Then prove the standing rail generalizes
with a second widget before adding v2 richness.

| # | Sprint | Rail | Proves |
|---|--------|------|--------|
| 1 | [Widget host + Gesture Playground](sprints/01-widget-host-gesture-playground.md) | thread-artifact | The whole spine on the cheap rail: composer menu → pre-commit UI → validated payload → one-shot thread-artifact → re-openable chip → clone-and-recommit. |
| 2 | [Lexical Gravity + standing prose-directive rail](sprints/02-lexical-gravity-standing-rail.md) | standing context | The durable rail exists, built with its first real widget: passage-scoped prose directive, coordinator in the `WorkshopConversationBehaviorService` mold, edit-in-place + shift marker, active-directive indicator + one-click kill. Single lens. |
| 3 | [Prose Controller](sprints/03-prose-controller.md) | standing context | The standing rail generalizes across a second, structurally different shaping widget (syntax/rhythm/density/punctuation knobs), reusing Sprint 02's rail and coordinator. |
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
- **Prose Controller** — *how the words are arranged*: lyricism, part-of-speech
  density, sentence style, metaphor/simile density, punctuation style.

They coexist as distinct active directives on the passage (a writer can run both
at once), each with its own chip and kill switch, both consulted at
prose-generation time.

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
  supply a pre-commit UI + payload validator.

## Architectural invariants (inherited from the Workshop epic)

- **Nothing is `new`-ed in the provider or handler.** All services come from the
  `CoreServices` bundle built in `extension.ts`. The ADR 2026-06-18 architecture
  witness (`__tests__/architecture/`) stays green.
- **Session state lives host-side** in `WorkshopSessionService`, never in the
  webview.
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
