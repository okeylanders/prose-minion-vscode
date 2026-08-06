# Concept Spring: Gesture Dictionary — surfaced as its own widget

**Status**: Concept spring
**Priority candidate**: High (the generation already ships; this is the surface)
**Classification**: Conversation Widget — **report widget**
**Likely rail**: One-shot thread artifact
**Depends on**: Widget host + Gesture Playground (Sprint 01);
[Writer's Dictionary](writers-dictionary.md) for the report-widget form
**Already shipping, but buried**: the composite generation described in
[gesture-dictionary-semantic-runway.md](gesture-dictionary-semantic-runway.md)
(**implemented 2026-07-29**) — prompts at
`packages/core/resources/system-prompts/gesture-dictionary/`

## The problem

The Gesture Dictionary is **the best reference document Prose Minion produces,
and it is currently reachable only as a side effect.** Today it is generated
inside Gesture Playground as the semantic runway for that widget's menu: one
composite call emits `===GESTURE_DICTIONARY_V1===` (writer-facing Markdown)
followed by `===GESTURE_MENU_V1===` (the strictly validated JSON menu), and the
dictionary is shown as an expandable panel in the Playground modal, excluded
from the commit by default.

That is the right architecture for *Gesture Playground*. It is the wrong
availability for *the dictionary*. A writer who wants twenty ordered sections on
how a gesture behaves on the page currently has to open a menu widget and ignore
the menu.

**This spring surfaces the same artifact as a first-class widget** — the gesture
counterpart to the [Writer's Dictionary](writers-dictionary.md), on the same
report-widget rail.

## Product idea

Same shape as its general-purpose sibling: a short input, optional context, one
call, and a whole document lands in the thread. **The run is the commit.** No
menu, no multi-select, no curation — a reference document cannot be curated
without becoming a different thing.

What differs is the *subject*. The Writer's Dictionary maps a phrase's lexical
field. The Gesture Dictionary maps an **embodied** one: what a gesture means,
what a body actually does to perform it, who can see it, and what it costs on
the page.

## Inputs

- **Target phrase** — the gesture, as written or as named.
- **Writer instructions** — optional aim for the scan.
- **Context text** — the source prose around the target.
- **Character notes** — character and relationship evidence only.

These are the four inputs the shipped generation contract already takes, which
is most of the argument for why this slice is cheap.

**Open — the input guard.** The Writer's Dictionary caps at six words because
past that it becomes a critic. A gesture is often longer than six words
(*"she pressed her thumb into the seam of her palm"*), so the cap must be
re-derived rather than inherited. See promotion gates.

## The schema — twenty ordered blocks

The shipped Markdown already runs in three deliberate movements. As a widget it
becomes typed blocks with schema keys, exactly as Spread 10 does for the
Writer's Dictionary.

**Lexical and semantic surface** — inherited from the Writer's Dictionary and
re-aimed:

1. Working Definition & Dramatic Job
2. Wording & Grammatical Family — gesture-native POS and morphology
3. **Sense Explorer** — a full section, not a brief interpretation: per sense, a
   definition, fiction example, 8–12 wording alternatives, 4–6 contrasts where
   meaningful, nuance notes
4. Register & Connotation
5. Narrative Texture & Symbolic Associations
6. Collocations, Idioms & Stock Renderings
7. Character Voice Variations
8. Cultural & Contextual Watchpoints — the cautious gesture-native analogue to
   translations/cognates
9. Semantic Gradients
10. Sound & Rhythm on the Page — consonant texture, syllable weight, sentence
    rhythm (rhyme trivia stays out)

**Embodied and scene-specific scan** — where it leaves language for the body:

11. Physical Mechanics
12. POV & Relationship Lens
13. Embodiment Pathways
14. Character Refraction
15. Genre Refractions
16. Usage & Continuity Watchpoints — viewpoint access, blocking, scale,
    repetition, ambiguity, generic anatomy, adverb traps
17. Confidence & Advisory Notes — **required**, same conviction as every sibling

**The closing three, deliberately ordered:**

18. Cliché & Convention Pressure
19. Freshness Strategies & Neighboring Families
20. Special Focus: Scene Synthesis Brief

**The order is load-bearing.** Convention pressure comes *before* escape routes
so the scan does not end by priming clichés. The scene brief is last so the most
recent context is concrete: invariants, anchors, exclusions, opportunities.

## The relationship to Gesture Playground

These are two surfaces over one generation, and the split has to stay honest:

| | Gesture Playground | Gesture Dictionary (this) |
|---|---|---|
| What the writer wants | a bounded menu of directions to pick from | the reference document itself |
| What commits | selected menu options; dictionary excluded by default | the whole document; there is no menu |
| Pre-commit surface | play space — multi-select, note, ceiling | inputs only |

**The invariant:** neither surface may fork the prompt. Both call the same
composite contract at `gesture-dictionary/`; the Playground consumes both
protocol blocks, the Dictionary widget consumes the first and **discards the
JSON menu**. If the two ever need different prompts, that is evidence the split
is wrong — reopen this spring rather than duplicating the charter.

**A cheaper alternative worth arguing:** rather than a second widget, the
Playground's existing `includeDictionaryInCommit` flag could simply be promoted
to a full-report commit. That would be less work and less surface area. The case
*against* it — and for this spring — is discoverability: a writer looking for a
gesture reference should not have to know it lives inside a menu tool. **Settle
this before promotion; it is the real decision here.**

## Commit and lifecycle

- One-shot `<thread-artifact kind="widget:gesture-dictionary">` carrying the
  ordered blocks verbatim. Cost disclosed before the press; **no ceiling**, same
  as the Writer's Dictionary, because the report is the artifact.
- Re-open restores the **inputs**, never the answer.
- **Never stands.** No pin, no weight, no lens — a gesture dictionary describes
  bodies, not a position on the writer's prose. Standing embodiment preferences,
  if ever wanted, belong on Lexical Gravity's authored-lens rail.
- Save to a project file is the one durable door.

## Smallest useful slice

The four existing inputs + one composite call + the Markdown half rendered as
typed collapsible blocks + a collapsed report card in the thread + copy +
save-to-project + chip re-open of the inputs. Defer any menu affordance
entirely — the menu is Gesture Playground's job and duplicating it here would
collapse the distinction the table above draws.

## Promotion gates

1. The discoverability-vs-duplication decision above is settled.
2. The Markdown half is deserialized into **typed blocks with schema keys**
   rather than heading-parsed — the same lesson every widget has learned, and
   the one place this slice is genuinely new work, since the shipped path
   renders Markdown.
3. The input guard is re-derived for gestures rather than inheriting the
   six-word cap, with a drawn refusal that routes (Playground for a menu,
   Show vs. Tell for a told line).
4. Advisory (block 17) is required for validity.
5. One charter, two consumers — no prompt fork.

## Relationship to the other dictionaries

See [the dictionary family](README.md#the-dictionary-family).
[Writer's Dictionary](writers-dictionary.md) is the ancestor and supplies the
report-widget form; this is the embodied specialization;
[Genre Dictionary](genre-dictionary.md) is the speculative third.
