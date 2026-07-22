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
| [Show vs. Tell Playground](show-v-tell-playground.md) | Local continuum playground for generated variations | Validate its boundary with Prose Controller's standing scene/summary lever. |

## Promotion rule

Before a spring becomes a sprint, it needs:

1. a named owner of durable state;
2. a rail or an explicit reason it does not use one;
3. writer/persona launch and commit permissions;
4. context-budget and compaction behavior;
5. a smallest concrete slice that proves the concept without generalizing the
   host speculatively.
