# A Maximal Group D Response Can Exceed the Per-Group Response Cap

**Date Identified**: 2026-10-20 (Lightbox Slice 4B)
**Reviewed**: 2026-10-23
**Status**: Resolved: superseded by Lightbox Slice 4H (2026-10-23)
**Priority**: Low
**Estimated Effort**: Small (measure, then lower bounds or split the group)

## Resolution

Slice 4H removed the failure this item describes. The whole response's
length is now an ask the prompt states (48,000 characters), not a gate:
a longer reply is read, and only one past the safety ceiling (eight
times the ask, 384,000 characters) is refused. The output ceiling rose
to 12,000 tokens, and a reply cut off there keeps the blocks it
finished, withholding only the block it was cut inside, its paid body
still saved for recovery (epic decisions 38 and 40). Measuring the
group's typical output stays with the live pass (Slice 6,
[live-provider pass](../../tech-debt/2026-10-19-lightbox-live-provider-pass.md)).

## Problem

Group D reads three lenses in one call, and its bounds in
`PROMPT_BUDGETS.lightbox` allow a response longer than the group cap the
codec enforces (`groupResponseCharacters`, 32,000 characters; a longer
response fails the whole group as "too long"):

| Block | At its bounds (about) |
|---|---|
| stock: 40 beats, 4 signature, 6 familiar, 3 air-locks, 3 echoes, each quote up to 240 characters | 28,000 characters |
| rhythm: 96 endings, movement, 3 handoffs | 4,700 characters |
| numbers: 6 readings of 3 quotes | 7,200 characters |

That is about 40,000 characters at every bound at once, against a cap of
32,000. The worked example is about 9,000 characters, and real responses
quote far less than 240 characters per quote, so the risk is low; but a
chapter of many long sentences, read generously, could reach it. The prompt
states the cap ("The whole response stays under 32,000 characters."), which
is the only guard today. The output reservation (`groupOutputTokens`,
8,000) matches the cap, so raising one alone does not help.

## Recommendation

Measure group D's real response lengths when Slice 6 measures typical
output tokens. Then either:

- lower the stock bounds (40 beats is generous for a tier mix; 24 is
  likely enough), or
- move the stock lens into a call of its own, if its reading is the long one.

## Related Files

- `packages/core/src/shared/constants/promptBudgets.ts` (`lightbox`:
  `stockBeats`, `signaturePhrases`, `familiarPhrases`, `airLocks`, `echoes`,
  `handoffs`, `numberReadings`, `groupResponseCharacters`,
  `groupOutputTokens`)
- `packages/core/src/infrastructure/lightbox/LightboxReadingCodec.ts` (the
  response cap)
- `packages/core/src/infrastructure/lightbox/LightboxRunEstimate.ts`
  (`LIGHTBOX_TYPICAL_OUTPUT_TOKENS`, guesses for group D)
- `packages/core/resources/system-prompts/lightbox/50-stock-signature.md`
- [Slice 4B](../../epics/epic-lightbox-2026-10-19/slice-4b-craft-lenses.md)

## Completion Criteria

- Group D's bounds, at their maximum with quotes at their maximum length,
  fit within `groupResponseCharacters`, pinned by a test that builds such a
  response and decodes it; or the stock lens runs in a call of its own.
- The typical output tokens for `stock`, `rhythm` and `numbers` are
  measured, not guessed.
