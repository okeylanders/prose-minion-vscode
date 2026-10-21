# ADR 2026-10-21: Sentence Closing Marks

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

The rule ended a sentence at its run of `.`, `!` or `?`. A closing
quotation mark or bracket written after that ender then began the next
sentence:
- `“Oh dear!”` alone was "2 words in 2 sentences · 1 word per sentence", the
  `”` a sentence of its own;
- `“Oh dear!” she said.` was `“Oh dear!` and `” she said.`, and the `”`
  counted as a word of the second.

The writer saw this on a real chapter in Slice 4E. A two-word paragraph of
dialogue read "2 sentences", and a sentences-well row began with "”".

## Decision

**A sentence keeps the closing marks written directly after its ender.**

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
7. **Nothing else changes.**
   - **No abbreviations.** `Mr.` still ends a sentence.
   - **No lower-case continuation.** `“Wait!” she cried.` is still two
     sentences, `“Wait!”` and `she cried.`. Only the `”` moved: it
     belonged to the second sentence and now belongs to the first. Joining
     a lower-case speech tag to its speech is a different rule. It would
     change many more figures, and it is not decided here.
   - **No repair of a missing space.** In `late.’Twas`, the apostrophe
     now stays with `late.`. In `stopped."Wait,"`, the `"` stays with
     `stopped.`. Each text still counts the same sentences and words as
     under the former rule; only the mark's side of the cut moved.

The rule is pinned in `sentenceClosingMarks.test.ts`, and each reader is
pinned in `LightboxSentenceClosingMarks.test.ts`. Each case the rule moves
states what the former rule gave, and fails on it. The cases it leaves
alone (`…`, `Mr.`, a mark after a space, an elision with no ender beside
it) pass on both rules.

## Consequences

**Measured figures change.** This is a change to the measurements, and it
is meant to be:

- **Whole-text figures barely move.** These are Metrics, the headline, the
  standards comparison and the writer's average.
  - A closing mark that began a sentence also began that sentence's words.
    So it counted alone only after the last sentence of a text.
  - In ordinary prose the count drops by at most one, so words per
    sentence rises slightly.
  - On the worked examples' ¶1–¶8, which end on "true.)", it went 17 → 16
    sentences and 29.9 → 31.8 words per sentence, and pacing became "Very
    slow". On the whole book it went 1,629 → 1,628, with words per sentence
    unchanged at 16.2.
- **Per-paragraph figures move a lot in dialogue.** These are the rhythm
  lane, the inspector's paragraph line, the sentence lengths, and the
  sentence summary.
  - Every paragraph that ended with a closing mark counted one sentence
    too many, and the speech tag after a `”` counted the `”` as a word.
  - On the whole book, the paragraph sentences summed 2,028 → 1,702, with
    326 of 815 paragraphs moved. On the Tea-Party, they went 40 → 32.
- **Standouts and handoffs may change.**
  - A sentence-length standout's reference and instances can move.
  - A handoff quote that includes its closing mark is now found exactly
    in one sentence. Before, it was found only unwrapped from its marks.
- **The sentences well's rows no longer begin with "”".**
  - Its header counts sentences that hold an instance. A closing-only
    stretch held none, so the header did not move on any fixture.
  - Count agreement still holds on every listed entry, now checked on
    dialogue-heavy text too.
- **The worked example for group F was regenerated.** Its request states
  the board's sentence figures, and its response cites 31.8 where it cited
  29.9. Groups A–E did not move.

The full before/after table is in the
[evidence](../pr-reviews/evidence/sentence-rule/README.md).

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
straddle the two rules, so they need no label for them.

**What this does not fix.** The writer's real chapter, about 48% dialogue,
showed 6.1 words per sentence against a 12–16 standard. That is a
whole-text figure, so this change moves it by at most one sentence.
- **One known contributor remains: lower-case continuation (7), left
  unchanged.** On the Tea-Party excerpt, 5 of its 32 sentences begin in
  lower case after `!”` or `?”`, such as "said the Hatter." and "thought
  Alice.". Joining each to the speech before it would read 16.1 words per
  sentence instead of 13.6.
- Genuinely short lines of speech, `...` and abbreviations such as `Mr.`
  lower the figure too. How much each contributes on the writer's chapter
  is not measured here.
- Lower-case continuation is the next rule to decide, if the writer wants
  it. It changes the same figures again, and it needs its own before/after
  pass.
