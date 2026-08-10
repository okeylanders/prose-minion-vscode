# Concept Spring: Show vs. Tell Playground

**Status**: Promoted to [Sprint 05 — Show vs. Tell](../sprints/05-show-vs-tell.md)
**Priority**: Medium
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

## Relationship to Lexical Gravity Application Gears

Show/tell is orthogonal to Lexical Gravity's application gear:

| Lexical Gravity gear | What it permits | Independent evidence choice |
|---|---|---|
| `lexical` | Surface vocabulary, reach, substitutions, and metaphor pull only | Direct explanation or embodied evidence |
| `interpret` | Local semantic sharpening without restructuring the beat | Direct explanation or embodied evidence |
| `recompose` | Reorder existing attention, beats, syntax, rhythm, or paragraph shape around an interpretation | Direct explanation or embodied evidence |

`recompose` must not become a synonym for Tell. A recomposed passage can enact
the interpretation through observable behavior, image, spatial relation,
sequence, withheld response, or consequence without inserting interpretive
commentary. Conversely, direct Tell may be the honest compact choice even when
the passage structure remains unchanged.

The playground owns the local experiment: *how much reader inference should
this selected beat require?* Lexical Gravity owns an independent Tell/Blend/Show
value for how **its own** lexical or interpretive pressure lands. Prose
Controller may own a broader narrative-handling value. They share vocabulary,
not state: LG and Prose Controller may intentionally pull in different
directions, while the local playground remains a one-shot comparison surface.

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
- Which acceptance fixture best proves that Lexical Gravity Recompose can move
  structure toward embodied showing rather than explanatory interpretation?
