# Feature: Read Aloud, Measured Cadence for Prose

**Date Identified:** 2026-11-20
**Status:** Idea. Medium: a deterministic scansion engine with pronunciation data, then the surfaces that use it. ADR first: it adds a sizeable data dependency and a new measure several features would share.
**Priority:** Medium
**Origin:** Okey, 2026-11-20, after a Workshop exchange where reading a line aloud made him add a syllable

## In Okey's words

> I think I might add an additional tool called "Read Aloud" that does
> syllable analysis like we did here.

## The exchange that started it

Okey's lines, rewritten here with made-up names:

> The Hare didn't answer. His eyes went to Alice. A nod.

Reading aloud, Okey wanted "His eyes went **straight** to Alice." The
persona explained why his ear was right:
- **Twin cadence.** The first two sentences had six syllables each, with
  nearly the same stress pattern.
- **A sag.** "Went to" put two soft syllables in the middle, so the eyes
  drifted where the scene wanted a throw.
- **A beat at the center.** "Straight" broke the twin and planted a stress
  mid-line: *EYES, STRAIGHT, A-lice*.

The persona got the counts right that time. But it counted by ear, as a
model reads: in tokens, not sounds. It also warned that models miscount
words like *every*, *fire* or *different*, and invent stress patterns with
confidence.

## What exists today

- **A rough syllable estimate,** for readability scores only
  (`passageProseStats`' `estimateSyllables`, a heuristic).
- **The Dictionary's Pronunciation section:** IPA, syllables and stress for
  one word, written by the model.
- **The Lightbox's rhythm reading:** how each paragraph ends (Lands, Holds,
  Opens), read by the model, and measured sentence lengths.
- **The part-of-speech tagger** (`wink-pos-tagger`, through `wordFrequency`).
- **No pronunciation data,** and nothing that measures stress.

## Idea

### 1. A scansion engine, measured by host code

The model never counts. Host code measures, and the model interprets what
was measured.

- **Syllables and stress from a pronunciation dictionary:** CMUdict, about
  134,000 words with their stress marks.
- **Words it doesn't know** (character names, coinages) get a syllable count
  from a fallback counter. Their stress is marked unknown, never guessed.
- **Function words take a weak beat.** The tagger demotes articles,
  prepositions, pronouns, auxiliaries and conjunctions, so "to" in "went to"
  reads weak, as it is spoken. It also picks a heteronym's stress by part of
  speech (REcord the noun, reCORD the verb).
- **Per sentence:** the syllable count and a stress map, like
  "his EYES went STRAIGHT to A-lice".
- **Measures over the maps:**
  - **Twin cadences:** neighbouring sentences with the same count and the
    same stress positions.
  - **Sags:** a run of unstressed syllables past a set length.
  - **Terminal stress:** whether a sentence ends on a stressed syllable or
    falls away after it.
  - **Breath length:** syllables between pauses (commas, dashes, stops).
  - **Mouth traps:** consonant sounds piled across a word boundary, read
    from the dictionary's phonemes.
- **Limits are stated, not hidden.** Dictionary stress is how a word is
  said alone, and speech shifts it; dialects differ; a name not in the list
  has no stress. The tool says so where it applies.

### 2. The model reads the measures, never the raw text alone

What code can't judge is whether the rhythm fits the meaning. As the
persona argued, footfalls, rises and stresses do character work, and the
question is whether they line up with what's happening:
- whether a soft middle suits a drifting glance or undercuts a throw;
- whether a twin cadence is a deliberate echo or an accident;
- whether a sentence lands on the word that matters;
- whether a character's rhythm matches who they are in the moment: steady,
  startled, cornered, at ease.

So the model gets the passage and the host's maps and measures. Every
claim names its sentence and the measure behind it, and every number comes
from the host. It says what it hears and why, in the "describe, then
suggest" register the Lightbox and Craft Flags already use.

### 3. Where it shows: a microscope first, a chapter pass later

The persona asked whether this should be a microscope for a highlighted
passage, or a chapter pass that flags only the 5–8 spots where the mouth
trips. Recommended: both, in this order.

1. **A persona capability,** say `cadence.scan`. It is free and instant,
   with no model call: it returns the host's maps and measures for a
   passage, bounded by sentences. A persona discussing a line works from
   real stress data instead of guessing it. It is the smallest piece, and
   it improves exactly the conversation that started this.
2. **A sidebar "Read Aloud" tool on a selection.**
   - The measured view comes instantly: stress marks over words, counts
     per sentence, twins and sags highlighted.
   - A **Listen** button adds the model's reading of it, with its price
     shown first.
3. **Later: a chapter pass where the model chooses what to highlight**
   (R1, below). Code measures every sentence; the model picks the spots
   and how many.

## Decisions (Okey, 2026-11-20)

| # | Decision | Notes |
|---|---|---|
| R1 | **In the chapter pass, the model chooses what to highlight and how many,** with a warning not to go overboard. Host code doesn't pick the candidates. | Rules can find a twin cadence; only a reading can tell whether the rhythm does the character's work, or fights what's happening. |

## The chapter pass (R1)

- **Code measures the whole chapter.** It's free. Each sentence gets a
  host-minted id, its syllable count, a compact stress pattern, and its
  measures (twin of the one before, sag length, falling ending, breath
  length, consonant pileups).
- **The model reads the chapter beside that table,** in one call, priced and
  confirmed first, as Craft Flags runs.
- **It chooses the spots and how many.** The prompt asks for the few places
  where rhythm matters most to the moment, says a handful is usual and
  none is a fine answer, and warns against flagging every irregular line.
  - The number is an ask, not a gate, in the Lightbox's sense ("asks, not
    gates"). A safety ceiling well above the ask, never stated in the
    prompt, drops and counts anything past it.
- **Each pick says what the rhythm is doing to the moment:**
  - the sentence ids it covers;
  - the measure that shows it, by name (the number is the host's);
  - what is happening there, and in whom;
  - whether the rhythm **serves** the moment or **works against** it.
    Showing where cadence already does character work is as useful as
    showing where it trips.
- **Host code checks every pick.** Ids must exist, a named measure must be
  one the table holds, and any quote must be in the text. A pick that
  fails is dropped and counted.
- **Where it lives:** a Craft Flags category ("cadence", flags only, on the
  later sentence) or a Lightbox lane. That is still open.

## Data and dependencies

- **`cmu-pronouncing-dictionary`** (npm, ISC code, CMU's own BSD-style
  license for the data) is about 4.7 MB unpacked.
  - Precompute a compact table at build time: each word's syllable count,
    stress digits and consonant shape.
  - Load it lazily on the extension host, never in the webview.
  - The ADR confirms both licenses.
- **`syllable`** (npm, MIT, about 19 KB) is the fallback counter for words
  the dictionary lacks.

## Open questions

- **The name.** "Read Aloud" suggests the extension speaks. Either keep it
  and add a Play button (below), or call it "Cadence" or "Scansion".
- **Actually reading aloud?** The webview's speech synthesis could play the
  passage. Voices vary by platform, so check it in VS Code's webview first.
- **Names the dictionary lacks.** Fiction is full of them. A per-project
  pronunciation list (like Proofread's word list: "Hatter: HAT-ter") would
  give them stress. Leaning: yes, small.
- **Which comes first:** the persona capability alone, or the sidebar tool
  with it? Leaning: the engine and the capability first, then the tool.
- **Where the chapter pass lives:** Craft Flags or the Lightbox, once the
  microscope has proved itself.
- **"Serves" picks in the editor.** As Craft Flags squiggles, praise may
  read oddly. If it lives there, "serves" picks might show only in a
  summary, not as flags.

## Completion Criteria

- [ ] Syllables and stress come from the pronunciation data. Unknown words
      get a fallback count and an unknown stress, never a guessed one
      (tests on made-up and real words).
- [ ] Function words are demoted, and heteronyms take their stress from the
      tagger (tests).
- [ ] Twin cadences, sags, terminal stress, breath length and consonant
      pileups are measured by host code (tests on *Alice*-style passages,
      including this note's example).
- [ ] The model's reading cites sentences and measures, and states no
      number of its own (test).
- [ ] The chapter pass sends every sentence's measures, lets the model choose
      its picks (stance included), and drops and counts picks past the
      safety ceiling or citing ids and measures the table lacks (tests).
- [ ] The pronunciation table loads lazily on the host, and the bundle size
      is recorded in the PR.
- [ ] Logs carry counts only, never the passage.

## Related

- [Passage Search](../feature-passage-search/README.md): another tool that
  reads with a model and checks with code.
- Craft Flags (ADR 2026-10-21, Slice 3c) and the Lightbox's group D: where
  a chapter pass could live.

## Related Files

- `packages/core/src/tools/measure/passageProseStats/index.ts` (`estimateSyllables`)
- `packages/core/src/tools/measure/wordFrequency/` (the tagger)
- `packages/core/src/tools/utility/dictionaryUtility.ts` (the Pronunciation section)
- `packages/core/src/shared/types/messages/lightboxCraftTiles.ts` (rhythm endings)
- `packages/core/src/shared/types/workshopCapabilities.ts` (where `cadence.*` would join)
