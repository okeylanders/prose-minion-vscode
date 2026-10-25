# A Reopened Board's Passages Are Found by Today's Rules

**Date Identified**: 2026-10-22 (Lightbox Slice 5A)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to Medium

## Problem

A saved board opens exactly as saved: its figures, readings and rule ids
are the file's (epic decision 29). Its host-side parts are not saved; they
are rebuilt from its saved text when it opens
(`savedLightboxBoardParts`): the paragraph texts its offsets name, and the
inspector's passage index, which counts words with this build's word
frequency and finds instances with this build's finders.

While every rule id the board records is this build's, the two agree. Once
a rule changes (a new `sentences` or `beingVerbs` id, say), a board saved
under the old rule shows its old figure ("was ×53") beside a well that
lights the instances today's rule finds, which may number differently. The
Slice 4E promise, that the number lit is the number the board counts, then
holds only for boards measured under this build's rules.

## Recommendation

When a reopened board's rule ids differ from this build's, either:
- refuse the passage wells for figures the changed rule measures, with a
  host reason ("measured under an earlier rule"), or
- keep the old finders behind their ids (only if a rule change is rare and
  small).

Slice 5B labels comparisons across rule ids the same way; do this with it.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxBoardAssembly.ts` (`savedLightboxBoardParts`)
- `packages/core/src/infrastructure/lightbox/LightboxPassageIndex.ts`
- `packages/core/src/application/handlers/domain/LightboxPassageHandler.ts`
- `packages/core/src/infrastructure/lightbox/LightboxMeasureRules.ts`

## Completion Criteria

- A board saved under a rule id this build does not have never shows a
  well whose instances disagree with its figure without saying why, with a
  test that opens a board recording another rule id.
