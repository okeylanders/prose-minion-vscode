# Concept Spring: Writer's Dictionary — the first report widget

**Status**: Concept spring
**Priority candidate**: High (the content already ships; this is the widget form)
**Classification**: Conversation Widget — **report widget**
**Likely rail**: One-shot thread artifact, **no ceiling**
**Depends on**: Widget host + Gesture Playground (Sprint 01)
**Design source**: `Prose Minion - Writers Dictionary.html` — Spread 10
(remote only; not pulled into `docs/design/`)
**Already shipping**: the Dictionary utility tab —
`DictionaryService`, `dictionaryUtility`, `DictionaryHandler`, `useDictionary`,
and the prompt sets `dictionary-utility/` and `dictionary-fast/00–15`

## Product idea

The Writer's Dictionary is **already the default dictionary in the app**. This
spring is not about inventing its content; it is about giving that content a
**widget form** so a lookup can land in the Workshop thread as a typed artifact
instead of living only in its own utility tab.

Two fields — a phrase of six words or fewer, and optional context — one call, and
the whole lexical field comes back as a document.

**It is the simplest widget in the registry and breaks the most rules on
purpose.** Every other surface is a play space: generate a cloud, keep a little,
commit a bounded payload. This one is a **lookup**. There is no menu to
multi-select and no ceiling to curate down to, because **a reference document
cannot be curated without becoming a different thing**. So the report lands
whole, rides exactly one turn, and never stands.

## This spread settles the "participant" question

The epic previously deferred the Dictionary with *"do not build it as a
widget"* — reading it as a **participant with a popup** (a retained
conversational sidecar) that the play-then-commit model would break.

**Spread 10 is the ADR that answers it, and the answer is that it was never a
participant.** It is the first **report widget**: a one-shot whose pre-commit
surface is nothing but its inputs. The run *is* the commit, so there is no
play-then-commit gap to model, and the architectural objection dissolves rather
than being overridden. The epic's deferred note has been amended accordingly.

## Inputs — two fields and two prices

- **Phrase, six words hard.** The cap is what keeps the widget a dictionary.
  Feed it a sentence and the only report it can write is a critique of that
  sentence — which is four other widgets' job.
- **Context, optional, and it is the whole difference.** Without it you get a
  reference entry; with it you get sense-marking, examples in your register, a
  watchpoint aimed at your own line, and the **Special Focus** block. The label
  says what it buys; the counter says whether the block will exist.
- **No model picker.** Tier is a property of the two run buttons, not a dropdown
  — which is what lets the panel stay at two fields.
- **The source line is provenance**: the phrase arrives from an editor selection
  in a named file, so a report can be traced back to the sentence that provoked
  it, and re-running after a revision is an obvious act.

### The refusal

Over six words, Run is **disabled, not hidden**, with the reason above it and a
live `8 / 6 words` counter. The refusal **routes**: Gesture Playground for a
beat, Show vs. Tell for a told line, Lexical Gravity for a field of diction.

*Why refuse rather than cope:* the most likely misuse is the one that still
"works". A model handed nine words will happily produce a fifteen-section report
about a sentence — fluent, confident, and no longer a dictionary.

## The schema — `writer-dictionary v0`

Fifteen ordered blocks, validated one at a time, streamed in order. These map
**one-to-one onto the shipped `dictionary-fast/01–15` prompt files**, so the
widget form is a re-typing of existing content, not new lexicography.

| # | Block | Notable guard |
|---|---|---|
| 1 | `definition` | ≤400 chars; must name what the phrase is **not** (nearest fossilised compound) — that's where the value is |
| 2 | `pronunciation` | IPA well-formed; phonetic, syllables, stress, one articulation note |
| 3 | `pos` | 1–2 readings; a useful ambiguity is stated, never resolved |
| 4 | `sense` | 2–4; exactly one *may* be marked as the excerpt's sense — **only when context was supplied** |
| 5 | `register` | label + valence + 3 sliders, 0–100, **claimed, never presented as measured** |
| 6 | `texture` | sensory, mood levers, symbolism, genre pointers |
| 7 | `collocations` | clichés tagged *avoid* with a function-based swap |
| 8 | `morphology` | core verb + family + ≤3 coinages, tagged |
| 9 | `voices` | 8–12, **no ranking field exists** — a wall to measure register against, not suggestions |
| 10 | `soundplay` | rhymes, slant, alliterative, meter |
| 11 | `translations` | 3–5, gloss + register note, **verify-tagged on both tiers** |
| 12 | `watchpoints` | 3–5; **the only block that may cite your line — must quote verbatim or be dropped** |
| 13 | `gradient` | 5–9 ordered rungs, the phrase's rung marked; **intensity, never quality** |
| 14 | `focus` | **0 or 1 — context-conditional**; withheld entirely without context |
| 15 | `advisory` | 1–4, **required**; the report fails validation without it |

**Context-conditional is a schema feature.** Block 14 existing or not existing is
a *typed* consequence of an input — far stronger than asking the model to "be
more specific if the user gave details".

**Nothing in the schema rates the writer's prose.** No quality field exists
anywhere; the closest thing is a gradient rung, which is intensity. Same
invariant the Explorers hold: describe, never grade.

## The report, rendered

- **Typed blocks, not rendered markdown.** The utility tab prints a markdown
  document with emoji headings; as a widget the same content deserializes into
  named slots, **every head carrying its schema key**, so a missing section reads
  as *withheld* rather than as prose that trailed off.
- **Lands collapsed, expands in place.** A 1,430-word document would bury the
  transcript; the thread gets a card with phrase, section count, and weight. The
  model, meanwhile, received all of it.
- **Two sections open by default** — definition and senses. Opening all fifteen
  is a wall; opening one is a peephole.
- **Copy and save sit on the card.** Saving writes
  `resources/dictionary/<phrase>.md` — a project file, deliberately **not** the
  same act as installing an influence.

### Tier note — a real divergence from the design

The spread describes the fast tier as a smaller model whose thin sections are
withheld by name. **In the shipped code the fast path is a parallel fan-out** —
one call per block across `dictionary-fast/`, with per-block retry
(`DictionaryService`, `dictionary-fast-<block>` tool names). The observable
behavior the spread argues for (faster return, sections that can come back
absent) holds either way, but a sprint plan must build against the fan-out that
exists, not the small-model story. **Worth reconciling on the spread.**

## Commit and lifecycle

- One-shot `<thread-artifact kind="widget:dictionary">` carrying **all fifteen
  blocks, verbatim, in order**, with `phrase`, `tier`, `sections`, `words`, and
  `context` attributes.
- Staged through `pendingMessageAttachments` →
  `buildWorkshopThreadArtifactFrame`, with one difference from every sibling:
  **no ceiling.** The frame carries the entire report because the report *is* the
  artifact; the cost is disclosed on the card **before** the press rather than
  metered after it.
- **Re-open restores the inputs, never the answer.** A dictionary Draft is two
  fields; re-shipping a cached report would let stale lexicography ride twice.
- **Jill reads the report; she doesn't become it.** Nothing in the artifact
  instructs her to apply anything.
- **What never rides:** the manuscript (only the pasted context), the saved file,
  and any instruction to use or prefer the report. Reference material, never a
  directive.

## Why it never stands

There is **no pin affordance — not disabled, absent.**

> A dictionary entry describes English; it is not a position on your prose.
> Pinning one would install a vocabulary bias with no author and no scope — the
> model reaching for "unshuttered" in chapter nine because you looked something
> up in chapter one.

Lexical Gravity is the widget for standing diction, and it stands because **a
lens is authored** — you choose it, weight it, and can kill it. A lookup has no
such handle. The one durable door is `save →` a project file: re-usable,
re-attachable, diffable, and getting it into a conversation is always a
deliberate second act.

## Smallest useful slice

Two fields + the six-word guard + two tiers + the fifteen-block schema + a
collapsed report card in the thread + copy + save-to-project + chip re-open of
the inputs. Defer lookup history and any project-wide "words I keep looking up"
surface.

## Promotion gates

1. Sprint 01 host proven.
2. The fifteen-block schema is closed, per-block validated, streamable, and
   withheld-by-name; the refusal state is implemented.
3. The tier story is reconciled with the shipped fan-out (above).
4. **Open — argue before promotion:** whether the report should also stay
   readable **outside** the thread (the utility tab already renders it, and two
   homes for one document is a real cost); whether the fast tier should run at
   all once a section can go missing without the writer noticing; and whether
   the six-word cap wants a stated exception for **titles and proper names**,
   which routinely run longer.

The utility tab keeps its markdown rendering either way — this spring argues only
for the widget form, where the same content is typed blocks with schema keys and
the emoji headings stay behind in the utility.

## Relationship to the other dictionaries

See [the dictionary family](README.md#the-dictionary-family). This is the
**general-purpose** member and the ancestor of the other two:
[Gesture Dictionary](gesture-dictionary-widget.md) borrows its semantic breadth
and re-aims it at the body; [Genre Dictionary](genre-dictionary.md) is the
speculative third.
