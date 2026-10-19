# The Engine Logs a Provider's Error Type Verbatim After an Interrupted Stream

**Date Identified**: 2026-10-19 (PR #149 re-review, privacy scope)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one closed vocabulary, one log line, one test)

## Problem

When a provider stream fails with an `OpenRouterApiError` after visible
content has streamed, `AgentRunEngine` keeps the incomplete answer and logs
the failure to the Output channel (`AgentRunEngine.ts:867–870`):

```ts
`(status=${error.status ?? 'unknown'}, type=${error.errorType ?? 'unknown'}); `
```

`errorType` is whatever string the provider sent as `metadata.error_type`
(`OpenRouterClient.ts:434–436`). It is never checked against a vocabulary,
trimmed or bounded, so a provider-chosen value, multiline or long, reaches
the log as written. The PR #149 re-review showed a synthetic multiline value
arriving there while the Lightbox's own outcome stayed sanitized.

The Lightbox's failure paths (PR #149 F-05) reduce provider errors to
host-owned categories and a bounded status before anything is logged or
shown, but that review explicitly left the shared engine's logging alone.
Every engine caller (Workshop, Assistant tools, Dictionary, the Lightbox)
shares this line, so it is a cross-cutting gap, not a Lightbox one.

## Recommendation

Log a host-owned word instead of the provider's string:

- Map `errorType` onto the closed set the engine already branches on in
  `toUnavailableError` (`authentication`, `payment_required`,
  `token_limit_exceeded`, `rate_limit_exceeded`, `network`,
  `provider_overloaded`, `provider_unavailable`, `timeout`, `server`,
  `unmapped`), and anything else onto `other`.
- Keep the status as a bounded integer (or `unknown`).
- Leave the retained incomplete response and its finish reason unchanged.

## Related Files

- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts`
  (lines 867–870: the interrupted-stream log; `toUnavailableError`: the
  vocabulary)
- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts`
  (lines 434–436: where `errorType` is read from the provider's payload)
- `packages/core/src/__tests__/application/services/AgentRunEngine.test.ts`
  (the interrupted-stream case)
- `packages/core/src/infrastructure/lightbox/LightboxCallFailure.ts` (the
  Lightbox's own closed categories, for reference)
- [PR #149 review](../../docs/pr-reviews/pr-149-lightbox-first-readings-review.md),
  "Privacy scope"

## Completion Criteria

- A provider `error_type` outside the closed vocabulary, including a
  multiline or very long value, never appears in the Output channel; the
  interrupted-stream line names a host-owned word and a bounded status.
- A test streams visible content, fails with such an `error_type`, and pins
  the logged line, alongside the existing retained-response assertions.
- Known types still log their own names, and the unavailable-error mapping
  is unchanged.
