# Dialogue % Ignores Single-Quoted Dialogue

**Date Identified**: 2026-10-19 (split from [Dialogue % Misses Curly Quotes](2026-10-19-prose-stats-dialogue-curly-quotes.md))
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to Medium (a text-level heuristic, plus fixtures)

## Problem

The shared dialogue matcher (`@/utils/dialogueSpans`) counts only double
quotes, straight `"…"` and curly `“…”`. Manuscripts that use single quotes for
dialogue (`‘…’`, common in UK publishing) still report little or no dialogue
on the Metrics tab, in the publishing-standards comparison and, from Lightbox
Slice 2A, in the per-paragraph dialogue share.

Single quotes were left out on purpose. Both marks are also apostrophes:

- Smart-quote editors write elisions with an opening mark: `‘cause`, `‘em`,
  `‘til`, `‘90s`, `rock ‘n’ roll`.
- Plural possessives end in a closing mark followed by a space: `the boys’ bikes`.
  Inside single-quoted dialogue this closes the span early.
- Contractions put `’` between letters: `don’t`. This one is easy to rule out.

No character-level rule tells these apart from speech. In a double-quoted
manuscript, treating `‘` as an opener would turn narration such as
`He told ‘em twice. The Joneses’ dog barked.` into dialogue.

## Recommendation

Decide the convention per text, not per character:

1. Match single quotes only when the text uses them as its dialogue
   convention, for example when word-boundary `‘` openers with a closing `’`
   (not followed by a letter) in the same paragraph outnumber double-quote
   openers.
2. In that mode, require a closer within the paragraph. Unlike a double quote,
   an unclosed `‘` is more likely an elision than multi-paragraph speech.
3. Leave the count for double-quoted manuscripts unchanged. Add fixtures for a
   dialogue-free US chapter with elisions, a UK chapter with nested `“…”`, and
   UK dialogue containing plural possessives.

Keep the decision inside `dialogueSpans.ts` so Metrics and Lightbox stay on one
matcher.

## Related Files

- `packages/core/src/utils/dialogueSpans.ts`
- `packages/core/src/__tests__/utils/dialogueSpans.test.ts`
- `packages/core/src/tools/measure/passageProseStats/index.ts`

## Completion Criteria

- A UK-style single-quoted fixture reports a nonzero dialogue %.
- Every existing double-quote test passes unchanged.
- A dialogue-free chapter with curled elisions (`‘cause`, `‘em`) reports 0%.
