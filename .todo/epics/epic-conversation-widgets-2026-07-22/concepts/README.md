# Conversation Widget Concept Springs

**Status**: Exploration
**Parent**: [Conversation Widgets epic](../epic-conversation-widgets-2026-07-22.md)

These are deliberately lighter than sprint plans. They capture the product
shape, the likely architecture, and the questions that must be answered before
an idea is promoted into the epic sequence.

A concept does not need to pretend it is a Conversation Widget if its real
durable truth lives elsewhere. The host can supply a discoverable interactive
surface while the concept declares its actual lifecycle:

- **Conversation artifact** — committed into retained history; one-shot.
- **Standing directive** — durable passage-shaping context; between runs only.
- **Project resource** — durable workspace data read or written on demand.
- **Exploration surface** — no conversation effect until the writer explicitly
  brings a result or question into the room.

## Current springs

| Concept | Shape | Promotion gate |
|---|---|---|
| [Decisions](decisions-widget.md) | Append-only decision artifacts plus an assembled-list tab | Reconcile transcript scanning with compaction and restored sessions. |
| [Project Scratch Pad](project-scratch-pad.md) | Project-scoped JSON entries with writer/persona read and append | Lock multi-root ownership, atomic writes, and capability permissions. |
| [Learner: English](learner-english.md) | English-language curriculum and passage exploration | Define the shared Learner shell and trustworthy packaged curriculum. |
| [Learner: Art of the Craft](learner-art-of-the-craft.md) | Storytelling-craft curriculum and passage exploration | Share the Learner shell without collapsing the two curricula into one vague tutor. |
| [Show vs. Tell Playground](show-v-tell-playground.md) | Promoted to Sprint 05 | Validate its local continuum boundary against Prose Controller's standing scene/summary lever. |
| [Creative Variations Playground](creative-variations-playground.md) | Promoted to Sprint 03 | Prove typed generation, compact one-shot commit, and a copyable variation-workup seam. |
| [Topic Relationship Explorer](topic-relationship-explorer.md) | A named topic derived against the passage as an ordered, span-verified dossier | Settle who owns the `relation` enum, and keep Ask from becoming a second chat. |
| [Genre Relationship Explorer](genre-relationship-explorer.md) | A chapter surveyed against its shelf-neighbors; two-sided tells with ¶ addresses | Settle who owns the `dimension` enum, and scope the standing pin as a second slice. |

The three **dictionary** springs — [Writer's](writers-dictionary.md),
[Gesture](gesture-dictionary-widget.md), and [Genre](genre-dictionary.md) — are
indexed together under [the dictionary family](#the-dictionary-family) below,
because what they share as *report widgets* matters more than their subjects.

## Implemented (not awaiting promotion)

| Item | What it is | Status |
|---|---|---|
| [Gesture Dictionary — Semantic Runway](gesture-dictionary-semantic-runway.md) | Sprint 01 generation-quality upgrade: one composite call yielding a writer-facing Gesture Dictionary, then a strictly validated JSON menu synthesized from it | **Implemented 2026-07-29** |

It sits in this folder rather than under `sprints/` because it is a prompt and
generation-contract concern that outlived its sprint plan, and because it is the
first member of the emerging **dictionary family** (see below). It is not a
widget and has no promotion gate.

## The dictionary family

Three dictionaries are now in play across this epic, and they are **not** the
same kind of thing. Keeping them distinct matters, because two are generation
substrates and one is a widget:

| Dictionary | Subject it maps | Status |
|---|---|---|
| **[Writer's Dictionary](writers-dictionary.md)** | a phrase's **lexical** field | Content ships today (utility tab + `dictionary-fast/00–15`); the *widget form* is the spring. Design Spread 10. |
| **[Gesture Dictionary](gesture-dictionary-widget.md)** | a gesture's **embodied** field | Generation ships today but is [buried inside Gesture Playground](gesture-dictionary-semantic-runway.md); the spring surfaces it as its own widget. |
| **[Genre Dictionary](genre-dictionary.md)** | a genre's **conventional** field | ⚠️ **Speculative** — no design spread, no code, and an open question about whether it should be a craft guide instead. |

All three are **report widgets**: a bounded subject, one call, an ordered
document, no curation step, and **never standing**. The run *is* the commit. That
shared shape is the evidence that "report widget" is a real category rather than
a carve-out invented for the dictionary.

The distinction that matters most: **a dictionary describes a territory; it never
takes a position on the writer's prose.** That is why none of the three may ever
pin. Standing behavior belongs to Lexical Gravity's rail, where a lens is
*authored* — chosen, weighted, killable. A lookup has no such handle.

## Promotion rule

Before a spring becomes a sprint, it needs:

1. a named owner of durable state;
2. a rail or an explicit reason it does not use one;
3. writer/persona launch and commit permissions;
4. context-budget and compaction behavior;
5. a smallest concrete slice that proves the concept without generalizing the
   host speculatively.
