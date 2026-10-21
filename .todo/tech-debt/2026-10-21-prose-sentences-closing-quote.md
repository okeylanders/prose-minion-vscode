# A Closing Quotation Mark After a Sentence's End Counts as a Sentence

**Date Identified**: 2026-10-21 (Lightbox Slice 4E)
**Status**: Identified
**Priority**: Medium
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
  [4E evidence](../../docs/pr-reviews/evidence/lightbox-slice-4e-visual/README.md),
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
