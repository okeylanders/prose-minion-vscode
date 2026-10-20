# Dialogue % Ignores Single-Quoted Dialogue

**Date Identified**: 2026-10-19 (split from [Dialogue % Misses Curly Quotes](2026-10-19-prose-stats-dialogue-curly-quotes.md))
**Reviewed**: 2026-10-20 (Lightbox Slice 4)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to Medium (a text-level heuristic, plus fixtures)

## Problem

The shared dialogue matcher (`@/utils/dialogueSpans`) counts only double
quotes, straight `"…"` and curly `“…”`. Manuscripts that use single quotes for
dialogue (`‘…’`, common in UK publishing) still report little or no dialogue
on the Metrics tab, in the publishing-standards comparison and, from Lightbox
Slice 2A, in the per-paragraph dialogue share.

From Lightbox Slice 4 the matcher also anchors the subtext lens: a pair's
*said* line must lie inside a dialogue span (`LightboxDialogueAnchor`). In a
single-quoted manuscript every said line is outside any span, so every
pair is withheld with "said line is not inside dialogue", by name. The
withholding is honest (no pair is shown on a line code could not place),
but the lens yields nothing for UK-style text until this is fixed.

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
- `packages/core/src/infrastructure/lightbox/LightboxDialogueAnchor.ts` (subtext's said-line anchor)

## Completion Criteria

- A UK-style single-quoted fixture reports a nonzero dialogue %.
- Every existing double-quote test passes unchanged.
- A dialogue-free chapter with curled elisions (`‘cause`, `‘em`) reports 0%.
- A subtext pair on a single-quoted line in a UK-style fixture is kept.
