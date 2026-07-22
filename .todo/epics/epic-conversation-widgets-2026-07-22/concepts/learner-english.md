# Concept Spring: Learner — English

**Status**: Concept spring
**Priority candidate**: Medium
**Classification**: Exploration surface using a shared Learner shell
**Conversation rail**: None while browsing; optional one-shot artifact when the writer brings something into the room

## Product idea

**Learner — English** is an explorable field guide to how English works. It lets
the writer study a concept, inspect it in the current passage, try a small
exercise, and bring a useful question or observation back into the Workshop.

Initial curriculum areas:

- parts of speech and phrase structure;
- clauses, sentence functions, coordination, and subordination;
- tense, aspect, mood, voice, and agreement;
- modifiers, referents, ambiguity, and common usage traps;
- punctuation as grammar and as rhetorical choice;
- rhetorical figures, sound patterns, and sentence-level emphasis.

The tone is practical and curious, not a red-pen tribunal. English contains
registers, dialects, evolving usage, and deliberate literary departures; the UI
must distinguish a rule, a convention, a house style, and an artistic choice.

## Shared Learner interaction model

The English and Art of the Craft concepts should share one **Learner shell**,
not two independently built modal frameworks:

1. **Learn** — concise concept explanation with annotated examples.
2. **Inspect** — map the concept onto a selected passage.
3. **Practice** — a bounded exercise with revealable feedback.
4. **Bring to the room** — commit a selected observation, question, or exercise
   result as a one-shot thread artifact.

Browsing and practice do not alter conversation state. A committed insight uses
the normal chip and clone-and-recommit semantics.

## Content and model boundary

- Definitions, taxonomies, canonical examples, and answerable exercises come
  from versioned packaged curriculum resources.
- Deterministic parsers/metrics may highlight POS, punctuation, and sentence
  structure, with uncertainty made visible rather than disguised as certainty.
- The model explains, contrasts, generates fresh examples, and responds to the
  passage. It is not the unverified source of grammar rules.
- Generated explanations identify the curriculum topic/version they were
  grounded in; no invented external citation theater.

## Persona interaction

A persona may recommend a topic or open Learner prefilled with a passage and a
question. It may not silently turn a lesson into a standing prose directive.
Learning and shaping are different actions; the writer explicitly chooses
whether to bring an insight into the conversation.

## Smallest useful slice

One curriculum chapter—sentence architecture is a strong candidate—across all
four Learner modes. That proves the shared shell, curriculum-resource contract,
passage annotation, exercise loop, and optional conversation commit before the
curriculum fans outward.

## Promotion questions

- Which English reference philosophy anchors disputed usage: descriptive,
  editorial-house-style, or a clearly labeled mixture?
- How do deterministic annotations represent parser uncertainty?
- Does Learner belong in the composer widget menu, a dedicated learning browser,
  or both entrances into one surface?
