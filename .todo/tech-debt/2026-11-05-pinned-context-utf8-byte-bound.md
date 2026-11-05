# Pinned Context: reconcile encoded-byte and path bounds

- **Status:** Open; non-blocking, pre-existing limitation.
- **Priority:** Low.
- **Source:** [PR #217 review, N-01](../../docs/pr-reviews/pr-217-pinned-context-live-pass-review.md#n-01--low--pre-existing-maximum-path-byte-sizing-assumes-ascii).

## Problem

The 4,096-character path limit counts UTF-16 code units. The 256-KiB list limit counts UTF-8 bytes. The claim that every 50-entry maximum-length list fits is proved only with ASCII paths. Fifty accepted 1,829-code-unit Unicode paths serialize to 272,985 bytes and are safely refused by preparation. The same class of limitation existed at the earlier 20-file/128-KiB bounds; this is not a new persistence regression.

## Relevant files

- `packages/core/src/shared/constants/promptBudgets.ts`
- `packages/core/src/shared/types/workshopPinnedContext.ts`
- `packages/core/src/infrastructure/storage/WorkshopPinnedContextCodec.ts`
- `packages/core/src/__tests__/infrastructure/storage/WorkshopPinnedContextCodec.test.ts`
- `docs/adr/2026-11-04-workshop-pinned-context.md`

## Completion criteria

Choose and document a coherent contract: either derive sufficient encoded-byte capacity for every allowed path list, or explicitly describe the byte limit as an additional bound. Cover non-ASCII paths and JSON escaping, retain safe refusal before writes, and align the ADR, comments and tests. Do not imply that this follow-up blocks the 22-file live-pass fix.
