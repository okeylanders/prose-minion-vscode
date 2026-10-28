# Lightbox Run Accounting on Its Exceptional Paths

**Date Identified**: 2026-10-19 (PR #149 third re-review, "Nonblocking exceptional-path accounting observations")
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one tally label or status, one catch, two tests)

## Problem

PR #149's F-10 fix made every started Lightbox run finish, whatever its
setup or reply check throws. Two of those new host-failure outcomes are
accounted for loosely. Neither sends an extra or unpriced call, and the
writer-facing failure text is accurate in both; the numbers around it are
not.

1. **The run line overcounts calls after a setup failure.**
   `lightboxQuoteTally` counts every group whose status is `ok` or `failed`
   as a call (`lightboxReadings.ts:116–123` at `56cb431`; lines 119–126 on
   this branch). When the run's setup throws, every group fails before
   anything is sent, so the run line says "3 calls" beside the correct
   explanation that nothing was sent. The tally predates F-10; the
   pre-send failure path exposes it.
2. **A reply-check exception drops the group's usage and model.** The
   outer catch in `LightboxReadingRunner.settleGroup`
   (`LightboxReadingRunner.ts:383–388` at `56cb431`; lines 386–391 on this
   branch) builds the failure with `failedLightboxGroup(call, message)`,
   without the `ExecutionResult` the call already returned. With a checker
   exception injected after group A completed, the engine recorded
   $0.03 / 3,600 tokens, but the board total and the handler's finish log
   showed only groups B and C ($0.02 / 2,400 tokens), and A's outcome had no
   model. The engine's own usage total and the processed-chip fanout stay
   correct, and the Lightbox UI does not yet show a group's actual usage or
   model.

## Recommendation

- **Run line:** label the count as groups or attempts, or carry a dispatch
  status on each group outcome (sent or not) and count only sent calls, so
  a setup failure reads "nothing sent", not "3 calls".
- **Reply check:** keep the result metadata across the catch. Either
  `runGroup` returns the `ExecutionResult` it obtained before checking, or
  the catch receives it, and the failure is built with
  `failedLightboxGroup(call, message, result)` so usage and model survive.

## Related Files

- `packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxReadings.ts`
  (`lightboxQuoteTally`, the `calls` count)
- `packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts`
  (`settleGroup`, `readingTools`)
- `packages/core/src/infrastructure/lightbox/LightboxReadingRunContracts.ts`
  (`failedLightboxGroup(call, error, result?)`)
- `packages/core/src/infrastructure/lightbox/LightboxGroupReply.ts`
  (`readLightboxGroupReply`, where a check can throw)
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxRunCompletion.test.ts`
  (the setup and check failure cases)
- [PR #149 review](../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md),
  third re-review, "Nonblocking exceptional-path accounting observations"

## Completion Criteria

- After a setup failure that sends nothing, the run line does not claim any
  call was made; a test pins its text.
- After a reply check throws on a call that came back, the group's outcome
  keeps that call's usage and model, the board total and the finish log
  include them, and a regression test injects the checker exception and
  asserts all three.
- Ordinary reads, provider failures and cancellations keep their current
  counts and totals.
