# ADR 2026-10-21: Sentence Closing Marks and Speech Tags

**Status:** Proposed (2026-10-21); implemented on `epic/lightbox-sentence-rule`, stacked on Slice 4E (PR #159)
**Date:** 2026-10-21
**Epic:** [Lightbox](../../.todo/epics/epic-lightbox-2026-10-19/README.md)
**Relates to:** [ADR 2026-10-19: Lightbox](2026-10-19-lightbox-inspiration-board.md), D4: the per-paragraph metrics share the prose-stats rules. This ADR changes the sentence rule they share, not who shares it.
**Resolves:** [A closing quotation mark after a sentence's end counts as a sentence](../../.todo/archive/tech-debt/2026-10-21-prose-sentences-closing-quote.md)
**Evidence:** [Sentence rule evidence](../pr-reviews/evidence/sentence-rule/README.md)

## Context

One splitter decides what a sentence is: `proseSentenceSpans` in
`packages/core/src/tools/measure/passageProseStats/index.ts`. Every figure
that counts sentences reads it:

- the prose-stats sentence count, words per sentence, readability, grade and
  pacing (the Metrics tab, the publishing-standards comparison, and the
  Lightbox headline);
- each Lightbox paragraph's sentences and words per sentence (the ribbon's
  rhythm lane, the inspector's paragraph line);
- the Rhythm & handoffs lens's sentence lengths, and the sentence summary
  (longest, very short);
- the sentence-length standout, its instances and its quote check;
- a handoff's adjacency (`LightboxSentencePairs`);
- the writer-baseline average (`countLightboxFigures`);
- Slice 4E's passage index and sentences well, with its "N instances in M
  sentences" header;
- the collision witness for borrowed fields, and the synopsis's
  four-sentence bound.

The rule ended a sentence at its run of `.`, `!` or `?`. It had two
problems with dialogue.

- **A closing mark after the ender began the next sentence.**
  - `“Oh dear!”` alone was "2 words in 2 sentences · 1 word per
    sentence": the `”` was a sentence of its own.
  - `“Oh dear!” she said.` was `“Oh dear!` and `” she said.`, and the
    `”` counted as a word of the second.
  - The writer saw this on a real chapter in Slice 4E: a two-word
    paragraph of dialogue read "2 sentences", and a sentences-well row
    began with "”".
- **A speech tag was a sentence of its own.** `“Wait!” she cried.` was two
  sentences, the second "she cried.". Standard punctuation (Chicago) reads
  speech and its lower-case tag as one sentence.
  - The writer's chapter is about half dialogue. It read 6.1 words per
    sentence against a 12–16 standard.

## Decision

**1. A sentence keeps the closing marks written directly after its
ender.**

1. **Enders are unchanged.** A sentence ends at a run of `.`, `!` or `?`.
   An ellipsis written `...` is such a run. `…` (U+2026) is not, and never
   ended a sentence.
2. **Closing marks join it.** The run of `”`, `’`, `"`, `'`, `)` and `]`
   written directly after the ender, with no space between, is part of the
   sentence, in any order and any length:
   - `“Wait.”`, `‘Stop.’` and `'Stop.'`;
   - `(See below.)` and `[It was not.]`;
   - nested quotations: `“He said ‘Stop!’”`, and `‘He said “Stop!”’`.
3. **Apostrophes are kept only inside that run.** `'` and `’` also mark
   elisions (`goin’`, `’Twas`). Inside the run, an apostrophe follows the
   ender or another closing mark, never a letter, so it cannot be an
   elision. An elision's apostrophe stays where it is:
   - `goin’ home` and `doin’!` keep theirs inside the word;
   - `’Twas`, after a space, opens the next sentence as before.

   The narrowest safe rule would keep only `.’` and `!’`, an apostrophe
   directly after the ender. This one takes the same reasoning one step
   further, to `”’` after `!`, the British nesting. There the apostrophe
   follows a closing mark, which no elision does.
4. **A stretch of nothing but space and closing marks is no sentence.**
   `“Oh dear! ”`, with a space before the `”`, is one sentence, not two.
5. **A closing mark after a space is not taken.** `“Oh dear! ” she said.` is
   still `“Oh dear!` and `” she said.`. The space makes the mark ambiguous,
   and the same position holds `’Twas`.
6. **The guillemet `»` is not a closing mark.** The splitter has no opening
   marks, and the dialogue matcher deliberately ignores guillemets
   (`dialogueSpans.ts`). Taking `»` alone would treat one convention unlike
   the rest of the tool.

**2. A lower-case speech tag continues the sentence of its speech.**

This is the coordinator's default, made because it matches standard
punctuation and the writer's chapter is about half dialogue.

7. **The join.** A sentence goes on across ender, closing quotation mark,
   space and a lower-case letter. Each of these is one sentence:
   - `“Wait!” she cried.`;
   - `“Who are you?” said the Caterpillar.`;
   - `“I was thinking...” she trailed off.`;
   - `“I’m going.” she said, and went.`, a lower-case tag after `.”`.

   `“Wait.” She turned.` stays two.
8. **Only a quotation mark carries it.** The first mark of the run joined
   in rule 2 must be a quotation mark: `”`, `’`, `"` or `'`, directly
   after the ender.
   - A bare `!` or `?` before lower-case text ends a sentence (`Wait! she
     cried.`).
   - So does a bracket (`(See below.) then …`).
   - So does a quotation mark after a space (`Oh! ” she said`).
9. **Elisions never trigger it.**
   - An apostrophe before the ender (`goin’! he said`) is not after it.
   - In `‘Nothin’ doin’!’ ’twas all`, the space is followed by an
     apostrophe, not a lower-case letter.
10. **A line break joins; a paragraph break does not.** A hard-wrapped
    line is still the same sentence. A blank line ends it, so the
    whole-text count and the per-paragraph counts agree.
11. **The known limit: a capitalised tag is a sentence of its own.**
    `“Wait!” Alice said.` is two sentences. Telling it from `“Wait!” Alice
    turned.` needs a parser, and this rule is punctuation only.

**3. Nothing else changes.**
- **No abbreviations.** `Mr.` still ends a sentence.
- **No repair of a missing space.** In `late.’Twas`, the apostrophe now
  stays with `late.`. In `stopped."Wait,"`, the `"` stays with
  `stopped.`. Each text still counts the same sentences and words; only
  the mark's side of the cut moved.
- **A lower-case word after a closing quote always joins**, tag or not.
  Across the whole of *Alice*, every such join continues its sentence:
  `“Do bats eat cats?” for, you see,`, `“Hjckrrh!” from the Gryphon`.
  The text punctuates these as one sentence, and so does the rule. A
  writer who starts a new sentence in lower case after a quotation would
  see it joined.

**Where it is pinned.**
- `sentenceClosingMarks.test.ts` pins rules 1–6, and
  `sentenceSpeechTags.test.ts` rules 7–11.
- `LightboxSentenceClosingMarks.test.ts` and
  `LightboxSentenceSpeechTags.test.ts` pin every reader.
- Each case a rule moves states what the earlier rule gave, and fails on
  it. The cases it leaves alone pass on both:
  - for closing marks: `…`, `Mr.`, a mark after a space, an elision with
    no ender;
  - for speech tags: a capitalised tag, a bare ender, a bracket, an
    elision, a paragraph break.

## Consequences

**Measured figures change.** This is a change to the measurements, and it
is meant to be. The [evidence](../pr-reviews/evidence/sentence-rule/README.md)
tabulates each fixture at three points: the original rule, closing marks
alone, and both.

**What closing marks moved:**
- **Whole-text figures barely move.** These are Metrics, the headline, the
  standards comparison and the writer's average.
  - A closing mark that began a sentence also began that sentence's words,
    so it counted alone only after the last sentence of a text.
  - On the worked examples' ¶1–¶8 (ending "true.)") the count went 17 →
    16. On the whole book, 1,629 → 1,628.
- **Per-paragraph figures move a lot in dialogue.**
  - Every paragraph that ended with a closing mark counted one sentence
    too many.
  - On the whole book, the paragraph sentences summed 2,028 → 1,702.
- **Rows and quotes.**
  - A sentences-well row no longer begins with "”".
  - A handoff quote that includes its closing mark is found exactly in one
    sentence.

**What speech tags moved:**
- **Whole-text figures move.**
  - The book goes 1,628 → 1,389 sentences, and 16.2 → 19.0 words per
    sentence.
  - The Tea-Party (Chapter VII, about half dialogue) goes 32 → 27
    sentences, and 13.6 → 16.1.
  - The worked examples go 16 → 15 sentences, and 31.8 → 33.9.
- **Per-paragraph figures move again,** and the very short sentences fall
  most: on the book, 428 → 193.
- **Wells, standouts and handoffs.**
  - A well's "M sentences" can fall where an item stood in both speech
    and tag: the book's "alice" 378 → 377; Chapter I's Weak Verbs 48 → 47.
  - A sentence-length standout measures the whole sentence, speech and
    tag together.
  - A handoff between speech and its own tag is no longer a handoff
    between sentences.
- **Count agreement** still holds on every listed entry, including the
  dialogue-heavy Tea-Party in both quotation settings.
- **The group F worked example** was regenerated from its builder after
  each change: 17 → 16 → 15 sentences, and 29.9 → 31.8 → 33.9 words per
  sentence. Its response cites the board's figure. Groups A–E did not
  move.

**Nothing persisted needs migrating.**
- **Boards are not saved yet.** Slice 5 (saved boards) has not landed, and
  a board is measured afresh each time it is built. `boardVersion` is still
  the draft `0`.
- **The webview saves no figures.** It saves the filter, the selected item
  and the lenses switched off. Paragraph numbering is the blank-line rule,
  which is unchanged, so a selected paragraph still names the same
  paragraph.
- **The writer-baseline cache** is in memory only.
- **Tiles already brought to a Workshop session** keep the figures they
  were brought with, such as "Sentence length: 29.9 words per sentence".
  That text quotes the board as it stood. It is not a measurement, and
  nothing re-measures it.

Slice 5's saved-board format starts after this change. Its boards never
straddle the rules, so they need no label for them.

**What remains for the writer's 6.1.**
- Genuinely short lines of speech, `...`, `Mr.` and capitalised tags
  still lower the figure.
- How much each contributes on her chapter is not measured here. Her
  chapter will read the new rule the next time it is boarded.
