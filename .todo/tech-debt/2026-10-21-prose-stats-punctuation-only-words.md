# A Lone Straight Quote Counts as a Word in the Vocabulary Figures

**Date Identified**: 2026-10-21 (PR #161 review, N-01)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one token rule, its tests, and re-pinned vocabulary figures)

## Problem

`proseStatsWords` (`packages/core/src/tools/measure/passageProseStats/index.ts`)
is the tokenizer for the vocabulary figures. It splits on whitespace and
keeps each token's letters `a–z` and straight apostrophes. A straight `'`
standing alone, or `''`, is therefore a word. That holds for:
- unique words;
- hapax and its list (`measured.hapax`, Slice 4E);
- lexical density;
- type-token ratio.

`'Oh dear! '` (a space before the closing quote) counts three words:
`'oh`, `dear` and `'`. The last is listed as a word used once.

The rule is pinned on purpose (`index.test.ts`, "trims nothing": `' 42`
gives `'`), and the hapax list counts exactly what the stats row counts.
So this is an inherited contract, not a slip.

**Why it surfaced.** PR #161 stopped counting a stretch of only space and
closing marks as a sentence. A lone `'` then stood in no sentence, and the
sentences well lost its witness. PR #161 fixed the well, which shows such
an instance in its own stretch, "outside any sentence" (N-01). It left the
vocabulary rule alone.

## Recommendation

Decide whether a token with no letter is vocabulary.
- **If it is not**, drop it in `proseStatsWords` after stripping (keep
  tokens holding at least one letter).
- Then re-pin the figures that move: unique words, hapax count and list,
  lexical density and type-token ratio, with literal before/after values on
  the *Alice* fixtures. `'` itself is rare there.
- The hapax list and the stats row stay in agreement by construction,
  since they share the tokenizer.
- The well's outside-a-sentence row would then be reachable only by hand,
  and would stay as the honest fallback.

## Related

- `packages/core/src/tools/measure/passageProseStats/index.ts` (`proseStatsWords`)
- `packages/core/src/infrastructure/lightbox/LightboxInstances.ts` (the hapax well's finder)
- `packages/core/src/infrastructure/lightbox/LightboxPassages.ts` (outside rows)
- `docs/pr-reviews/pr-161-sentence-boundary-review.md` (N-01)

## Done when

The vocabulary figures' rule for punctuation-only tokens is decided. If it
changes, every vocabulary figure that moved is re-pinned on purpose.
