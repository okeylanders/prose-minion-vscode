# Review Workshop resource-search semantics and bounds

**Status:** Open
**Priority:** Medium

## Problem / motivation

Workshop currently exposes two related resource-search paths with different
result semantics:

- Participant `resource.search` combines configured path/label matches with
  content-line matches under one 20-result budget. Catalog matches consume the
  same slots and can prevent content search from running.
- The context-selector modal performs name matching client-side, then returns
  one reference per content-matching file from a host scan of up to 100 files;
  it does not share the participant capability's 20-result ceiling.

Both searches also stop under the 100-file, 256-KiB-per-file, and 2-MiB-total
scan bounds. The context-selector path silently clips queries to 200 characters,
while the participant capability rejects oversized input at its boundary.

The behavior is safe and bounded, but the two meanings of “resource search”
should be reviewed deliberately before they become a durable product contract.

## Questions to resolve

- Should path/label matches and content matches share one result budget?
- Should metadata matches prevent content search, or should each mode receive a
  small independent allowance?
- Should the context selector and participant capability share one search
  service/result contract?
- Should result limits count matching lines, matching files, or both explicitly?
- Should an overlong context-selector query be rejected or visibly reported
  instead of silently clipped?
- Are 20 results, 100 files, 256 KiB per file, and 2 MiB total still the right
  defaults for long-form projects?

## Related files

- `packages/core/src/application/services/workshop/WorkshopResourceCapability.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts`
- `packages/core/src/shared/constants/promptBudgets.ts`
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopContextSelectorModal.tsx`

## Completion criteria

- One documented search contract distinguishes catalog matches, content-line
  matches, and matching-file results.
- Both entry points either share that contract or intentionally document their
  different jobs.
- Every limit and early-stop condition is disclosed in returned metadata/UI.
- Oversized queries are handled consistently without silent clipping.
- Boundary tests cover exactly-at-limit and one-over-limit behavior for matches,
  files, per-file bytes, total bytes, and query length.
