# Concept Spring: Gesture Dictionary — Semantic Runway for Gesture Playground

**Status**: Implemented 2026-07-29; rich persona-prefill amendment included
**Classification**: Quality-first Gesture Playground generation upgrade
**Depends on**: Widget host + Gesture Playground (Sprint 01)
**Canonical charter**: `packages/core/resources/system-prompts/gesture-dictionary/00-gesture-dictionary.md`
**Canonical exemplar**: `packages/core/resources/system-prompts/gesture-dictionary/01-gesture-dictionary-example.md`

## Product decision

Gesture Playground will no longer ask the model to jump directly from a target
phrase to a small JSON menu. One provider call produces:

1. a substantial, writer-facing Gesture Dictionary in Markdown; then
2. a strictly validated JSON menu synthesized from that completed semantic
   surface.

The dictionary is a visible analysis artifact and reference work the writer can
expand in the modal. It is not private internal reasoning or hidden scratch
work. Its order matters because the later menu is conditioned on the earlier
writer-facing scan.

Quality is the primary constraint. This widget is invoked occasionally, its
per-run cost is small, and a cheap unusable answer is worse than a more
expensive useful one.

## Four distinct inputs

The authoring surface separates:

1. **Target phrase** — the gesture, expression, or embodied beat.
2. **Writer instructions** — the creative aim, constraints, exclusions, or
   question.
3. **Surrounding context** — source prose only.
4. **Character notes** — character and relationship evidence only.

This removes the current need to smuggle an instruction into target or context.
The prompt gives writer instructions explicit precedence and treats context and
notes as evidence, not protocol instructions.

For a direct writer-opened widget, the UI may retain its documented optional
fields. A **persona-generated prefill** has a stronger contract: host and guest
personas must supply all four fields, and the writer may then edit any of them.
The persona instruction explicitly rejects thrift. It asks for several
substantive sentences of creative direction, a generous consecutive stretch of
source prose around the target, and detailed character/relationship evidence
for the beat. The aim is to give the dictionary model a full semantic runway,
not make it infer a scene from a phrase and two fragments. Generosity is still
bounded and grounded: no padding, invented source prose, or fabricated project
facts.

## Host and guest recommendation contract

Hosts and guests receive the same shared recommendation instruction. It is
appended to their assembled system prompts rather than copied into each persona
resource, so every Workshop participant speaks one protocol.

When a persona judges that Gesture Playground would materially help, it may
append one recommendation as the final content in its response:

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
<character-notes>
[substantial, evidence-grounded character notes for this beat]
</character-notes>
</workshop-widget-recommendation>
```

The multiline format lets source prose carry quotes, punctuation, and paragraph
breaks without JSON escaping. It is nevertheless a strict machine contract:
the heading and markers appear exactly once and in order, the frame owns the
response tail, every field is non-empty, the widget id is live, and each value
fits its centralized character budget. The parser fails closed on duplicate,
missing, reordered, trailing, empty, unknown, or over-budget content; it never
constructs a partial seed. Once the reserved heading appears, the control tail
is stripped from transcript content on both acceptance and rejection. The
writer sees a recommendation chip and editable inputs, not protocol markup.

## Canonical semantic runway

The canonical charter combines two bodies of useful work rather than choosing
between them.

### Lexical and semantic surface

The original Writer's Dictionary contributes functions that made its contextual
recommendations unusually strong:

1. **Working Definition & Dramatic Job**
2. **Wording & Grammatical Family** — gesture-native parts of speech and
   morphology
3. **Sense Explorer** — a full distinct section, not a brief interpretation:
   every numbered sense includes a definition, fiction example, 8–12 wording
   alternatives/near-synonyms, 4–6 contrasts/antonyms where meaningful, and
   nuance/usage notes
4. **Register & Connotation**
5. **Narrative Texture & Symbolic Associations**
6. **Collocations, Idioms & Stock Renderings**
7. **Character Voice Variations**
8. **Cultural & Contextual Watchpoints** — a cautious gesture-native analogue
   to translations/cognates
9. **Semantic Gradients**
10. **Sound & Rhythm on the Page** — consonant texture, syllable weight, and
    sentence rhythm; rhyme trivia stays out

### Embodied and scene-specific scan

The Gesture Dictionary then moves from language into body and scene:

11. **Physical Mechanics**
12. **POV & Relationship Lens**
13. **Embodiment Pathways**
14. **Character Refraction**
15. **Genre Refractions**
16. **Usage & Continuity Watchpoints** — viewpoint access, blocking, scale,
    repetition, ambiguity, generic anatomy, and adverb traps
17. **Confidence & Advisory Notes** — claims about anatomy, prevalence,
    culture, or physiology that need caution or verification

The final three sections remain deliberately ordered:

18. **Cliché & Convention Pressure**
19. **Freshness Strategies & Neighboring Families**
20. **Special Focus: Scene Synthesis Brief**

Convention pressure comes before escape routes so the scan does not end by
priming clichés. The scene brief is the final Markdown before the JSON so the
most recent context is concrete: invariants, anchors, exclusions, and
opportunities.

## Exact composite response

The model emits one versioned protocol:

```text
===GESTURE_DICTIONARY_V1===
[writer-facing Markdown]
===END_GESTURE_DICTIONARY_V1===
===GESTURE_MENU_V1===
{"version":1,"groups":[{"heading":"...","options":["..."]}]}
===END_GESTURE_MENU_V1===
```

The two outputs must remain separate. Putting thousands of Markdown words in a
JSON string would multiply escaping and truncation failures.

The parser should normalize line endings and surrounding whitespace, then:

- require each exact sentinel once and in order;
- reject non-whitespace outside the frames;
- require a non-empty dictionary within the centralized 32,000-character
  admission bound;
- parse an outer JSON object carrying exactly `version` and `groups`;
- require `version === 1`;
- retain the existing fail-closed group, option, length, and duplicate checks;
- treat a missing, empty, malformed, or over-budget dictionary as fatal;
- when the dictionary is valid but the menu frame or JSON is invalid, return
  the dictionary for display only, with no menu and no commit path;
- print the complete rejected response to the Prose Minion Output channel.

The dictionary body is bounded opaque Markdown. The parser does not reject
useful output for a missing icon or shortened section, but it does not accept a
menu without the promised visible runway. The salvage rule never admits partial
menu content into selectable writer state.

## Prompt bundle and exemplar

There is one canonical charter and one canonical exemplar. Runtime generation
loads both deterministically for every widget model; behavior must not branch
on brittle model-name guesses.

The exemplar uses `she folded her arms`, not the eye-widening phrase that
motivated the feature. It demonstrates the protocol without circularly teaching
the exact target used to judge the old prompt. It also exercises the complete
Sense Explorer, professional habit, physical continuity, observer knowledge,
objects, negative space, convention pressure, and menu synthesis.

## Quality and model posture

- **Recommended default model**: move the widget scope from Haiku to
  **Sonnet 5**. The composite task requires long-form instruction fidelity,
  semantic synthesis, and reliable framed JSON; it is no longer a fast-model
  showcase.
- **Dictionary length**: roughly 2,500–3,500 substantive words for a rich
  contextual target; shorter when the target is simple or context-free; hard
  ceiling around 4,000 words and 32,000 admitted characters.
- **Menu**: 4–6 groups, 3–5 options per group, options under 220 characters.
- **Output budget**: large enough to protect the menu after the dictionary;
  14,000 tokens is the initial planning value and should be verified against
  reasoning-token behavior across supported providers.
- **Temperature**: begin near the Writer's Dictionary posture (`0.4–0.5`).
  The semantic runway supplies diversity; high sampling primarily increases
  framing drift. Raise only if fixed-fixture evaluation shows menu convergence.
- **Writer instructions**: centralized character budget, initially around
  1,000 characters.

## Persistence, UI, and commit boundary

- `writerInstructions`, `dictionaryMarkdown`, and the generated menu belong to
  the persisted Draft so a committed chip reopens the exact authoring surface.
- The dictionary appears collapsed by default in the modal's scrolling center,
  above the menu. Rendering uses the safe Markdown path with no raw HTML.
- Suggestion chips may seed the instructions field: replace it entirely, keep
  it but make it fresher, make it subtler, tie it to character, shift into POV,
  or use another body/object signal.
- Regenerate replaces both dictionary and menu in one call.
- Commit never re-runs the model.
- The dictionary and unselected menu remain exploration cloud. Only selected
  options plus the writer's optional note ride the thread-artifact rail.

## Evaluation gate

Evaluate the old direct-menu prompt against the canonical runway with the same
model and representative fixtures. Record:

- parser acceptance and truncation;
- contextual specificity;
- diversity of creative routes;
- cliché avoidance without purple-prose substitution;
- physical and POV continuity;
- percentage of options the writer would actually keep;
- tokens and cost as observed context, not the deciding score.

The default-model and temperature choices should follow this evidence, with
quality weighted above marginal token savings.
