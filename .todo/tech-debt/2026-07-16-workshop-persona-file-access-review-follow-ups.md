# Workshop persona file-access review follow-ups

**Status:** Planned
**Priority:** Medium
**Source:** [PR #77 review](../../docs/pr-reviews/pr-77-persona-file-access-review.md)

## Problem

PR #77's merge-blocking correctness, provenance, input-bound, and coverage
findings were addressed on the Sprint 11 branch. Six non-blocking findings
remain deliberately deferred because they require broader architecture,
security-policy, caching, or model-behavior decisions rather than review-sized
patches.

The review ledger remains the detailed evidence source; this file keeps the
follow-up work in the active `.todo` system after the PR merges.

## Follow-up work

- [ ] Replace `WorkshopCapabilityResult.metadata: Record<string, unknown>`
      with a discriminated per-operation metadata union, then split webview row
      formatting by capability family. Covers review finding 6.
- [ ] Consolidate `WorkshopCapabilityXmlCodec.isSafeResourcePath` with the
      established path-containment trust primitive so relative-path policy has
      one owner and one test table. Covers finding 7.
- [ ] Cache ancestor stats by unique directory and move configured-resource
      provider caching to a safe session/workspace lifetime with explicit
      invalidation. Covers finding 12.
- [ ] Revalidate configured-resource containment/symlink state immediately
      before `readFile` to close the catalog-to-read TOCTOU window. Covers
      finding 13.
- [ ] Decide and document the Workshop Markdown anchor/URI policy, then enforce
      it in DOMPurify and test allowed and rejected destinations. Covers
      finding 14.
- [ ] Give resolver failure and a genuinely empty catalog distinct,
      request-correlated availability diagnostics. Covers finding 16.

## Related files

- `packages/core/src/shared/types/workshopCapabilities.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`
- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts`
- `packages/core/src/infrastructure/context/ContextResourceResolver.ts`
- `packages/core/src/presentation/webview/components/shared/MarkdownRenderer.tsx`
- `packages/core/resources/system-prompts/workshop-personas/base.md`

## Completion criteria

- Each item above is implemented or split into a more specific `.todo` artifact
  with an explicit owner and verification plan.
- Boundary, security, cache invalidation, UI formatting, and prompt-behavior
  changes receive focused regression coverage appropriate to their lane.
- The PR #77 review ledger links to the final implementation or replacement
  tracking artifact for every deferred finding.
