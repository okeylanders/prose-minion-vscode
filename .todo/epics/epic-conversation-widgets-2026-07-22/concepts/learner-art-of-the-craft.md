# Concept Spring: Learner — Art of the Craft

**Status**: Concept spring
**Priority candidate**: Medium
**Classification**: Exploration surface using the shared Learner shell
**Conversation rail**: None while browsing; optional one-shot artifact when the writer brings something into the room

## Product idea

**Learner — Art of the Craft** is an explorable storytelling textbook inside the
Workshop: concepts, annotated examples, passage inspection, small experiments,
and conversations with the room about what a technique is doing.

Candidate curriculum:

- point of view, psychic distance, and narrative authority;
- scene, summary, exposition, and compression;
- showing, telling, implication, and dramatic evidence;
- character desire, obstacle, change, and interiority;
- dialogue, subtext, beats, and silence;
- tension, stakes, suspense, and revelation;
- description, imagery, setting, motif, and sensory selection;
- pacing, paragraph movement, rhythm, and emphasis;
- structure at beat, scene, chapter, and story scale;
- revision strategies and diagnostic questions.

The curriculum teaches choices and consequences, not universal commandments.
"Show, don't tell" is examined as a context-dependent tradeoff rather than
printed on a stone tablet and dropped on the manuscript.

## Shared Learner interaction model

This uses the same Learner shell proposed by [Learner — English](learner-english.md):

1. **Learn** a craft concept through compact, layered material.
2. **Inspect** how it operates in the current passage.
3. **Practice** with a bounded experiment or comparison.
4. **Bring to the room** by committing a chosen question, observation, or
   experiment as a one-shot artifact.

The curriculum pack, annotations, exercises, and model grounding differ; the
host lifecycle and interaction grammar do not.

## Relationship to other widgets

- **Prose Controller** applies durable passage-level style biases. Learner
  explains the craft levers and their consequences; it does not install them.
- **Show vs. Tell Playground** performs a focused local experiment. Learner
  supplies the broader theory, diagnosis, and practice path.
- **Gesture Playground** generates local alternatives. Learner may link to it
  as an exercise without duplicating it inside the textbook.

Cross-links launch the specialized surface with an explicit prefill. They do
not auto-commit or silently change standing directives.

## Content and model boundary

- Stable concepts, curated examples, cautions, and exercise rubrics live in
  versioned craft-guide resources.
- Deterministic passage metrics are reused where they genuinely illuminate a
  topic; not every craft question should be flattened into a score.
- The model provides situated explanation, contrasting examples, questions,
  and feedback grounded in the selected curriculum material.
- The UI labels authored curriculum separately from generated commentary.

## Smallest useful slice

One chapter—**Scene, Summary, Show, and Tell**—using all four Learner modes and a
prefilled launch into Show vs. Tell Playground. This gives the shared curriculum
shell a real cross-widget boundary to prove.

## Promotion questions

- Are existing `craft-guides/` resources suitable curriculum sources, or do
  they need a more structured chapter/example/exercise schema?
- How much of a copyrighted craft tradition can be represented safely as
  original synthesis rather than quotation or imitation?
- Should completed exercises have any durable project record, or remain
  ephemeral unless deliberately brought into the room or Scratch Pad?
