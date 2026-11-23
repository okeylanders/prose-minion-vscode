# Feature: Personas Run the Deterministic Measures

**Date Identified:** 2026-11-23
**Status:** Idea. Medium: one read-only capability family over services that already exist. ADR first (a new family), or a section in Passage Search's ADR, since the two should share one scope grammar.
**Priority:** Medium
**Origin:** Okey, 2026-11-23

## In Okey's words

> Are personas able to run metrics, category search, word search? I know we
> opened a door for passage search, but I'm wondering if the same door can
> be opened for other deterministic analyses. This also may come in handy
> for our scansion report.

## What personas can run today

- **`analysis.run` runs the AI assistant passes only:** dialogue, prose, and
  the writing-tools focuses (cliché, continuity, style, repetition,
  gestures…). Each is a model call.
- **They can't run the deterministic tools** the sidebar's Metrics and
  Search tabs use:
  - **prose stats** (`ProseStatsService`): word and sentence counts,
    lengths, dialogue share, pacing, readability, lexical density;
  - **style flags** (`StyleFlagsService`): adverbs, passive voice, filler,
    hedges, intensifiers, weak verbs, placeholders, with examples;
  - **word frequency** (`WordFrequencyService`): top words, parts of
    speech, bigrams and trigrams, hapax, word lengths;
  - **word search** (`WordSearchService`): occurrences in context, and
    clusters.
- **So a persona asked "how often do I use 'just'?" estimates,** and models
  miscount, the same trap Read Aloud's scansion is built to avoid.
- **Category Search isn't deterministic.** It asks the category model to
  sort words, so it is a paid call, like Passage Search.

## Idea

### A `measure.*` family: free, instant, exact

| Call | Runs | Answers questions like |
|---|---|---|
| `measure.stats` | prose stats, optionally against a publishing standard | "Is this chapter long for the genre?" "How much is dialogue?" |
| `measure.flags` | style flags | "Where am I hedging?" "How many adverbs in this scene?" |
| `measure.frequency` | word frequency | "What are my most used words here?" "Any repeated bigrams?" |
| `measure.search` | word search | "How often does 'just' appear, and where?" |
| `measure.cadence` (later) | Read Aloud's scansion | "Where do the stresses fall in these lines?" |

- **No model, no money, no consent step.** Like `resource.read`, each call
  uses one of the turn's capability calls and runs at once.
- **The numbers are the services' own,** the same rules the Metrics and
  Search tabs and the Lightbox use. A persona quotes measurements instead
  of estimating them.
- **Results are compact and bounded:** a short table and a few examples,
  fitted to half the room left (`reads/WorkshopReadWindowFit`). A long list
  continues with a written next call that decodes as written.
- **Read Aloud's capability joins this family.** Read Aloud planned
  `cadence.scan`; it becomes `measure.cadence`, so the scansion report is
  one more measure, not a family of its own.

### One scope grammar, shared with Passage Search

- **A call names what to measure the way Passage Search does (its P4):**
  the room's excerpt, the Selected Text a message carried, a context group
  (characters, chapters…), or one file by catalog key, several at once.
  Never a free path or pattern.
- **Define the scope type once,** for both families, so Passage Search, the
  measures and a future research agent all speak it. Files come from the
  shared catalog, one per operation.

### Category Search joins Passage Search's consent door

Category Search is a paid model call, so it doesn't belong in `measure.*`.
Once Passage Search's persona request exists (its P2: a card with the
price, then Run), Category Search can be a second kind of paid search a
persona asks for through the same card.

## How it fits the house rules

- **A port, not handlers.** The capability reaches the services through a
  narrow port built in `extension.ts` and placed in `CoreServices`. It
  never imports a handler.
- **The family's checklist,** as every new family has:
  - it joins `WORKSHOP_CAPABILITY_OPERATIONS`, every family switch and
    `WORKSHOP_NATIVE_CALL_FIELDS`;
  - its grammar prompt is a tool-use section, held by a sync test;
  - it gets a help section;
  - its result frames are tallied in the context breakdown.
- **Logs** carry the operation and counts, never a word searched, a quote
  or a path.

## Open questions

- **Shared with the room or private?** Measurements are about the writer's
  text and cost nothing. Leaning: published to the room on commit, as file
  reads are, so a guest sees the same numbers.
- **Which publishing standard** `measure.stats` compares against: the one
  set in Settings, or one the persona names? Leaning: the Settings one.
- **One ADR or two?** Leaning: a section in Passage Search's ADR for the
  shared scope type, then a short ADR for `measure.*`.

## Completion Criteria

- [ ] Personas can run stats, flags, frequency and search over the excerpt,
      a message's Selected Text, context groups or files, several at once
      (tests on *Alice*-style fixtures).
- [ ] Every number matches what the Metrics and Search tabs report for the
      same text (test).
- [ ] Results are bounded, fitted to the window, and continuations decode as
      written (tests).
- [ ] The scope type is shared with Passage Search (one definition).
- [ ] The family's grammar, native-call fields, help section and context
      tally are in place, held by their sync tests.
- [ ] Logs carry counts only.

## Related

- [Passage Search](../feature-passage-search/README.md): P2 (the consent
  door Category Search would share) and P4 (the scope grammar).
- [Read Aloud](../feature-read-aloud-cadence/README.md): its capability
  becomes `measure.cadence`.
- [Workshop Research Agent](../feature-workshop-research-agent/README.md):
  another caller of the same measures, later.

## Related Files

- `packages/core/src/infrastructure/api/services/measurement/` (`ProseStatsService`,
  `StyleFlagsService`, `WordFrequencyService`)
- `packages/core/src/infrastructure/api/services/search/` (`WordSearchService`,
  `CategorySearchService`)
- `packages/core/src/application/services/StandardsComparisonService.ts`
- `packages/core/src/shared/types/workshopCapabilities.ts`
- `packages/core/resources/system-prompts/workshop-personas/analysis-capability.md`
- `packages/core/src/shared/types/messages/workshop/participants.ts` (`WorkshopToolId`)
