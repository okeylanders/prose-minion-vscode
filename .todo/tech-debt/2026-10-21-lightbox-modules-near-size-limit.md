# Several Lightbox Modules Sit Just Under the 500-Line Limit

**Date Identified**: 2026-10-21 (Lightbox Slice 4F)
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small to Medium (one split per module, each behind its existing tests)

## Problem

Each new tile kind joins every union, map, gate, carry, inspector and Bring
path, and the modules that route by kind keep growing. After Slice 4F:

| Module | Lines |
|---|---|
| `packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts` | 498 |
| `packages/core/src/shared/types/messages/index.ts` | 488 |
| `packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxItems.ts` | 481 |
| `packages/core/src/infrastructure/lightbox/LightboxReadingTiles.ts` | 467 |
| `packages/core/src/infrastructure/lightbox/LightboxReadingCodec.ts` | 460 |
| `packages/core/src/presentation/webview/hooks/domain/lightbox/controllers/useLightboxInspector.ts` | 442 |

`packages/core/src/shared/constants/promptBudgets.ts` is a data table that
was already over 500 lines (607) before the slice; it is 625 now.

Slice 5 (saved boards) will add to at least `lightboxItems.ts` and
`LightboxReadingTiles.ts`, and will cross the limit.

## Recommendation

Before Slice 5 adds to them:
- `lightboxItems.ts`: move each family's ref parsing and resolution into
  its own module (craft steering's already lives in `lightboxSteering.ts`),
  leaving the registry.
- `LightboxReadingTiles.ts`: move the per-lens `block()` dispatch and its
  imports into a small router module.
- `useLightboxInspector.ts`: move the per-kind details into the families'
  pure modules, as `lightboxSteeringDetails` does.
- `LightboxReadingRunner.ts`: move the group F scheduling out.
Split `promptBudgets.ts` by surface (Workshop, Lightbox) if the boundary
test allows it.

## Related Files

- The modules in the table above
- `packages/core/src/__tests__/architecture/boundaries.test.ts` (`LIGHTBOX_MODULES`)

## Completion Criteria

- Every listed module under 450 lines, with no behaviour change and every
  existing test passing.
