# Add minCharacterLength Impact Description for N-Grams

**Date Created**: 2025-11-11
**Status**: ✅ **SUPERSEDED**
**Priority**: Low
**Estimated Effort**: 15-30 minutes
**Superseded By**: [UX Polish Epic - Sprint 01](../epics/epic-ux-polish-2025-11-17/sprints/01-ngram-filter-description.md)

---

## Status

✅ **SUPERSEDED** - This feature is now part of:
- **Epic**: [UX Polish Enhancements](../epics/epic-ux-polish-2025-11-17/epic-ux-polish.md)
- **Sprint**: [Sprint 01 - N-Gram Filter Description](../epics/epic-ux-polish-2025-11-17/sprints/01-ngram-filter-description.md)
- **ADR**: [ADR-2025-11-17: UX Polish Enhancements](../../docs/adr/2025-11-17-ux-polish-enhancements.md)

Please refer to the sprint document for implementation details.

---

## Problem

The Settings Overlay includes a description for the `minCharacterLength` setting under Word Frequency, but it doesn't explain how this setting impacts bigrams and trigrams analysis.

Users might not understand that the filter applies an **all-or-nothing rule** for n-grams: ALL words in a bigram/trigram must meet the minimum character length for the entire phrase to be included.

## Current Implementation

**Location**: `src/presentation/webview/components/SettingsOverlay.tsx`

The current description for `minCharacterLength` focuses on individual word filtering but doesn't mention n-grams impact.

## Proposed Enhancement

Add a note to the `minCharacterLength` setting description explaining:

1. **All-or-nothing filter**: For bigrams/trigrams, ALL component words must meet the minimum length
2. **Practical impact**: Setting to 4+ characters effectively filters out most prepositional phrases ("in the", "of the", "to the") since prepositions and articles are typically short
3. **Example**: With `minCharacterLength = 4`:
   - ✅ Included: "walked through" (both ≥ 4)
   - ❌ Excluded: "walked in" (second word < 4)
   - ❌ Excluded: "walked through the" (third word < 4)

## Suggested Description Addition

```
**Note**: For bigrams and trigrams, ALL words in the phrase must meet
the minimum length. Setting this to 4+ characters will filter out most
prepositional phrases like "in the", "of the", and "to the".
```

## Acceptance Criteria

- [ ] Description added to Settings Overlay under `minCharacterLength` setting
- [ ] Clear explanation of all-or-nothing filter behavior
- [ ] Example showing practical impact on n-grams
- [ ] UI remains clean and readable (consider collapsible tooltip or info icon if text is too long)

## References

- Implementation: `src/tools/measure/wordFrequency/index.ts:270-282` (computeNGrams method)
- Settings UI: `src/presentation/webview/components/SettingsOverlay.tsx`
- Filter logic: `.every(w => w.length >= minCharLength)` (line 275)
