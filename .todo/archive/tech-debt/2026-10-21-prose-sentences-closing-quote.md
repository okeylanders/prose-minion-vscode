# A Closing Quotation Mark After a Sentence's End Counts as a Sentence

**Date Identified**: 2026-10-21 (Lightbox Slice 4E)
**Status**: Resolved 2026-10-21 on `epic/lightbox-sentence-rule`, stacked on Slice 4E (PR #159); see [Resolution](#resolution)
**Priority**: Was Medium; resolved
**Estimated Effort**: Small to medium (the rule is one function; every figure that counts sentences moves with it)

## Problem

`proseSentenceSpans` (`packages/core/src/tools/measure/passageProseStats/index.ts`)
ends a sentence at its run of `.`, `!` or `?`. A closing quotation mark
or bracket after that ender is not part of the sentence. It starts the
next one instead.

Two effects follow:
- **At the end of a paragraph, it is a sentence of its own.** It holds no
  word, but its trimmed text is not empty, so it counts.
  - `“Oh dear!”` is "2 words in 2 sentences · 1 word per sentence".
  - This is the writer's ¶76 case from Slice 4E: two words of dialogue,
    "2 sentences".
- **Inside a paragraph, it opens the next sentence.** `“Oh dear!” she
  said` is `“Oh dear!` and `” she said`.

Who reads this rule:
- the prose-stats sentence count (Metrics and the board's headline);
- each paragraph's sentence count and words per sentence (the board's
  paragraph metrics, the rhythm lane and the inspector's paragraph claim);
- the sentence lengths of the Rhythm & handoffs lens;
- the sentence-length standout;
- a handoff's adjacency check;
- Slice 4E's sentences well, whose rows can begin with "”" (see the
  [4E evidence](../../../docs/pr-reviews/evidence/lightbox-slice-4e-visual/README.md),
  the `word` state's third row).

The well uses this rule on purpose. Its "N instances in M sentences" then
counts the same sentences the board counts, and a display-only patch would
make the two disagree.

## Recommendation

Let a sentence keep the closing marks that follow its ender with no space
between them: `”`, `’`, `"`, `'`, `)` and `]`, and their runs. A
closing-only remainder then disappears, and is no sentence.

Treat it as a change to measured figures:
- Metrics' sentence counts, words per sentence and readability move.
- The board's per-paragraph figures move, and so does the writer's
  baseline average.
- Handoff pairs and sentence-length standouts may change.

Pin it with the existing prose-stats tests and literal before and after
figures on the *Alice* fixtures. Slice 5's saved boards should not
straddle the change unlabelled.

## Related

- `packages/core/src/tools/measure/passageProseStats/index.ts` (`proseSentenceSpans`)
- `packages/core/src/infrastructure/lightbox/LightboxParagraphs.ts` (`lightboxSentenceWords`)
- `packages/core/src/infrastructure/lightbox/LightboxPassageIndex.ts` (`sentences`)
- `.todo/epics/epic-lightbox-2026-10-19/slice-4e-inspector-aids.md`

## Done when

`“Oh dear!”` is one sentence, a sentence never begins with the closing
mark of the one before it, and every figure that counts sentences has been
re-pinned on purpose.

## Resolution

Resolved on 2026-10-21 on `epic/lightbox-sentence-rule`, from Slice 4E's
head `058feb5`. The decision is recorded in
[ADR 2026-10-21: Sentence closing marks](../../../docs/adr/2026-10-21-sentence-closing-marks.md).

- **The rule.** A sentence keeps the run of `”`, `’`, `"`, `'`, `)` and `]`
  written directly after its `.`, `!` or `?`. A stretch of nothing but space
  and closing marks is no sentence.
  - An apostrophe joins only inside that run, so an elision (`goin’`,
    `’Twas`) never moves.
  - A mark after a space is not taken.
  - `»` is not a closing mark: the splitter has no openers, and the dialogue
    matcher ignores guillemets.
  - Abbreviations, ellipses and lower-case continuations are unchanged, so
    `“Wait!” she cried.` is still two sentences, `“Wait!”` and `she cried.`
- **Every reader was checked,** and pinned with literal values that fail on
  the former rule (`LightboxSentenceClosingMarks.test.ts`):
  - the paragraph metrics and the rhythm lane;
  - the sentence summary;
  - the writer-baseline counts;
  - the sentence-length standout's instance check;
  - handoff adjacency;
  - the passage index and the sentences well;
  - two readers this note did not name: the collision witness
    (`LightboxTileGates`) and the synopsis bound (`LightboxPlotCodec`).

  The rule itself is pinned in `sentenceClosingMarks.test.ts`.
  `LightboxCountAgreement.test.ts` adds the dialogue-heavy Tea-Party
  (Chapter VII), in Gutenberg's single quotes and in curly double quotes.
- **The figures, re-pinned on purpose.** The
  [before/after evidence](../../../docs/pr-reviews/evidence/sentence-rule/README.md)
  tabulates every move on the *Alice* fixtures.
  - Whole-text counts drop by at most one in ordinary prose. On the worked
    examples' ¶1–¶8 they went 17 → 16 sentences and 29.9 → 31.8 words per
    sentence.
  - Per-paragraph counts drop wherever a paragraph ends with a closing mark.
    On the whole book, 2,028 → 1,702.
  - The group F worked example's request was regenerated from its builder.
- **`“Oh dear!”` is one sentence** of 2 words. No sentence begins with the
  closing mark of the one before it, which is checked on every fixture.
- **Extended the same day with speech tags,** by the coordinator's default
  (standard punctuation; the writer's chapter is about half dialogue).
  - A sentence goes on across ender, closing quotation mark, space and a
    lower-case letter, so `“Wait!” she cried.` is one sentence. A
    capitalised tag stays its own sentence: that is the known limit.
  - Interleaved ends such as `!"?”` are one end.
  - Whole-text figures move this time: the book goes 1,628 → 1,388
    sentences. The ADR and the evidence give each change's figures apart.
