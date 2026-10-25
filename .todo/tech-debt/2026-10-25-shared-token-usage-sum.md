# Adopt the shared token-usage sum

**Status:** Identified
**Priority:** Low
**Source:** Draft Edit Slice 1c ([ADR 2026-10-21](../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md))

## Problem

Three fan-out callers sum provider usage, each with its own copy of the rule:

- `infrastructure/lightbox/LightboxReadingRunContracts.ts` (`sumUsage`);
- the Dictionary's parallel generation;
- Draft Edit's `utils/tokenUsage.ts` (`sumTokenUsage`).

They have already drifted. The Lightbox counts a missing `costUsd` as zero,
which understates a run's cost when one call reported none. `sumTokenUsage`
makes the total unknown instead, so the summary shows nothing rather than a
low figure, the honesty rule the Dictionary history ADR states for a single
request. Since PR #171 F-05 it also treats a call whose reply carried no
usage record at all as unknown, and counts it in `requestCount`.

Proofread did not adopt or move the Lightbox's copy: Lightbox PR #170 was in
review, and the helper is feature-owned.

## Recommendation

Once the Lightbox's in-flight slices have merged, have the Lightbox and the
Dictionary call `sumTokenUsage`, and delete their copies. Decide explicitly
whether an unknown cost should read as unknown everywhere; it should, by the
honesty rule.

## Related files

- `packages/core/src/utils/tokenUsage.ts`
- `packages/core/src/infrastructure/lightbox/LightboxReadingRunContracts.ts`
- `packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts`

## Completion criteria

- One summing helper. Every fan-out caller uses it, passing `undefined` for
  a call that came back without usage, never dropping it.
- A test pins the unknown-cost rule (`__tests__/utils/tokenUsage.test.ts`
  pins it for the helper today).
