# Concept Spring: Show vs. Tell Playground

**Status**: Concept spring
**Priority candidate**: Medium
**Classification**: Conversation Widget
**Likely rail**: One-shot thread artifact

## Product idea

**Show vs. Tell Playground** lets the writer move a selected beat along a
continuum from compressed explanation to embodied dramatization, generate
several meaning-preserving variations, compare what each version gains and
costs, and hand chosen directions back to the room.

It follows Gesture Playground's local shape: select text → generate a bounded
menu → choose useful alternatives/directions → commit a one-turn artifact →
clone-and-recommit if revisited.

## The central design rule: not a morality slider

Showing and telling are both tools. The control should read more like:

```text
compress / explain  <———>  dramatize / embody
```

The UI names tradeoffs: speed, clarity, intimacy, emphasis, ambiguity, scene
time, and reader inference. It never labels one end "bad writing."

## Inputs and controls

- selected phrase, beat, or paragraph;
- surrounding passage and POV constraints;
- intended fact/emotion/turn that must survive every variation;
- continuum position;
- channels to emphasize: observable action, sensory evidence, interiority,
  dialogue/subtext, summary/exposition;
- compression budget or approximate target length;
- optional note about what must not change.

## Generated workup

One explicit generation produces grouped alternatives such as:

- clean direct tell;
- compressed narrative summary;
- action/gesture evidence;
- sensory embodiment;
- interior inference;
- dialogue or subtext;
- mixed version that tells the bridge and shows the fulcrum.

Each alternative carries a short craft note describing its tradeoff. The writer
may select one or more directions and add a note. Commit sends a compact local
directive and the selected variation references; it does not silently replace
editor text.

## Relationship to Prose Controller and Learner

- **Show vs. Tell Playground** is local and one-shot: experiment with this
  selected beat now.
- **Prose Controller** may hold a broad standing scene/summary or evidence bias
  across generated passage prose.
- **Learner — Art of the Craft** teaches the underlying distinction and may
  launch this playground prefilled.

The same craft vocabulary should be shared, but the lifetimes stay different.

## Persona interaction

A persona may recommend or prefill the playground when it spots a productive
choice. Direct auto-commit is unnecessary for the first slice: variations are
valuable precisely because the writer compares them before choosing.

## Smallest useful slice

Selection + intent field + five-position continuum + one generation + grouped
alternatives + multi-select commit on the thread-artifact rail. Copy/insert into
the editor, automatic passage rewriting, and standing-bias integration remain
out of scope.

## Promotion questions

- Does commit carry selected prose variants, abstract directions, or both under
  a strict size ceiling?
- How much surrounding context is enough to preserve POV and meaning without
  turning a local playground into a full rewrite tool?
- Which continuum vocabulary should be shared with Prose Controller so the two
  surfaces teach one coherent model?
