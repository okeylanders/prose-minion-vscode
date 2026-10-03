# Dictionary suggested-book reliability

**Date Identified**: 2026-10-02
**Reviewed**: 2026-10-02
**Status**: Identified — provider-output follow-up; no release blocker identified
**Priority**: Medium
**Estimated Effort**: Evaluate before selecting a fix

## Evidence

During v2.7.0 artwork preparation, the design agent reported two unverified
suggestions in Okey's real Fricative Dictionary output: “Sound Writing: The Art of
Descriptive Audio” attributed to Robert R. Haines, and “The Language of Film”
attributed to Robert Stam. This record preserves the report; it does not assert
that an exhaustive catalog search was performed by the release agent.

The standard Topic prompt and Fast Topic block already require real titles and
authors known confidently, and allow omission when uncertain. A prompt instruction
alone cannot establish bibliographic accuracy. Existing automated tests verify
prompt composition and section delivery, not whether generated books exist.

The published README crop excludes the reported suggestions. The tour entry
shows the first topic only. No prompt behavior was changed during release.

## Recommendation

Evaluate representative standard and Fast outputs across selected providers.
Check title/author pairs against authoritative publisher or library catalogs,
retain the effective model/mode and response evidence, and distinguish invented
titles from incorrect attribution. Use that evidence to choose a narrow change
such as removing unchecked suggestions or adding a verification boundary.
Do not treat adding another confidence instruction as proof of a fix.

## Related files

- `packages/core/resources/system-prompts/dictionary-utility/02-encyclopedia-entry.md`
- `packages/core/resources/system-prompts/dictionary-fast/16-topic-related-lexicon-block.md`
- [Artwork record](../../.memory-bank/20261003-0115-release-v2.7.0-readme-and-tour.md)

## Completion criteria

- Representative output and title/author verification results are recorded.
- The chosen behavior is reflected in standard/Fast prompts or verification code.
- Regression checks cover that behavior without pretending unit tests prove all future model output.
