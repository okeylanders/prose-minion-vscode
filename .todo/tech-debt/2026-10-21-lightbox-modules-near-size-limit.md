# Several Lightbox Modules Sit Just Under the 500-Line Limit

**Date Identified**: 2026-10-21 (Lightbox Slice 4F)
**Reviewed**: 2026-10-22 (Lightbox Slice 5A)
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small to Medium (one split per module, each behind its existing tests)

## Problem

Each new tile kind joins every union, map, gate, carry, inspector and Bring
path, and the modules that route by kind keep growing. After Slice 4F, with
Slice 4E merged in (2026-10-21):

| Module | Lines |
|---|---|
| `packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts` | 498 |
| `packages/core/src/shared/types/messages/index.ts` | 492 |
| `packages/core/src/infrastructure/lightbox/LightboxService.ts` | 486 |
| `packages/core/src/infrastructure/lightbox/LightboxReadingTiles.ts` | 467 |
| `packages/core/src/infrastructure/lightbox/LightboxReadingCodec.ts` | 460 |
| `packages/core/src/presentation/webview/hooks/domain/lightbox/controllers/useLightboxInspector.ts` | 444 |
| `packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxItems.ts` | 437 (481 before 4E moved its term refs out) |

`packages/core/src/shared/constants/promptBudgets.ts` is a data table that
was already over 500 lines (607) before the slice; it is 625 now.

Slice 5 (saved boards) will add to at least `LightboxService.ts` and
`LightboxReadingTiles.ts`, and will cross the limit.

**After Slice 5A (2026-10-22).** 5A moved the service's board assembly to
`LightboxBoardAssembly.ts`, its source key to `LightboxSourceKey.ts` and its
retained boards to `LightboxRetainedBoards.ts` before adding the saved-board
surface, so `LightboxService.ts` went from 486 to 462 lines, then 475 with
the writer-data rule (readings keep the basis rule they were cited under).
It did not add
to `LightboxReadingTiles.ts`. Its new modules, and the ones it touched, now
stand at:

| Module | Lines |
|---|---|
| `packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts` | 498 (unchanged) |
| `packages/core/src/shared/types/messages/index.ts` | 496 (+4: the boards module's export, and the rail in both unions) |
| `packages/core/src/infrastructure/storage/LightboxBoardStore.ts` | 490 (new) |
| `packages/core/src/application/handlers/domain/LightboxHandler.ts` | 486 (unchanged) |
| `packages/core/src/application/handlers/domain/LightboxReadingHandler.ts` | 483 (+18: the run's save) |
| `packages/core/src/infrastructure/lightbox/LightboxReadingTiles.ts` | 478 |
| `packages/core/src/infrastructure/lightbox/LightboxService.ts` | 475 (was 486) |
| `packages/core/src/presentation/webview/hooks/domain/useLightbox.ts` | 469 (unchanged) |

Slice 5B will add Compare's routes to `index.ts` and its file reads to the
store: split the store's listing and summaries out first, and move the
Lightbox unions out of the barrel's `index.ts` into the Lightbox message
modules.

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
- `LightboxService.ts`: move the board's rebuild and carry step out, so
  saving and loading boards has room.
Split `promptBudgets.ts` by surface (Workshop, Lightbox) if the boundary
test allows it.

## Related Files

- The modules in the table above
- `packages/core/src/__tests__/architecture/boundaries.test.ts` (`LIGHTBOX_MODULES`)

## Completion Criteria

- Every listed module under 450 lines, with no behaviour change and every
  existing test passing.
