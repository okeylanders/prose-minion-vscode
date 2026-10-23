# Several Lightbox Modules Sit Just Under the 500-Line Limit

**Date Identified**: 2026-10-21 (Lightbox Slice 4F)
**Reviewed**: 2026-10-22 (Lightbox Slice 5A, its PR #163 corrections, and Slice 5A.1); 2026-10-23 (Slice 5A.2)
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

**After PR #163's corrections (2026-10-22).** The store's split is done:
its folder naming, reads, listings and summaries moved to
`LightboxBoardFiles.ts` (227 lines), and `LightboxBoardStore.ts` is 349
(was 490) with private staging and its commit retry. The adoption
generation added `adoptionOf` to `LightboxService.ts` (484, +9) and one
line to `LightboxReadingHandler.ts` (484, +1); `LightboxBoardLibrary.ts`
is 365. The barrel's unions are still to move before 5B.

**After Slice 5A.1 (2026-10-22).** The barrel's split is done, first and in
its own commit: the Lightbox re-exports and its parts of the two routing
unions moved to `messages/lightboxBarrel.ts` (105 lines), and `index.ts` is
413 (was 496). The store's rewrites in place went to their own module,
`LightboxBoardRewrite.ts` (267), and the library's names and spark marks to
`LightboxBoardEdits.ts`, so `LightboxBoardStore.ts` is 394 and
`LightboxBoardLibrary.ts` 397. Board names added nine lines to
`LightboxService.ts` (491) and the spark's save four to
`LightboxReadingHandler.ts` (488). Still nearest the limit:

| Module | Lines |
|---|---|
| `packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts` | 498 (unchanged) |
| `packages/core/src/infrastructure/lightbox/LightboxService.ts` | 491 |
| `packages/core/src/application/handlers/domain/LightboxReadingHandler.ts` | 488 |
| `packages/core/src/application/handlers/domain/LightboxHandler.ts` | 486 (unchanged) |
| `packages/core/src/infrastructure/lightbox/LightboxReadingTiles.ts` | 478 (unchanged) |

Before 5B adds to the service or the reading handler, move the service's
rebuild-and-carry step out (the recommendation below), and the reading
handler's Spark lane and context routes.

**After Slice 5A.2 (2026-10-23).** One file per board added the save in
place and its fallback to the store, and every chapter's listing and the
picked file's read to its files. The store's contracts moved to
`LightboxBoardStoreContracts.ts` (90) and a new file's write to
`LightboxBoardNewFile.ts`, and the library's saving to
`LightboxBoardSaves.ts`; the service's import lines were compacted. Now:

| Module | Lines |
|---|---|
| `packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts` | 498 (unchanged) |
| `packages/core/src/infrastructure/lightbox/LightboxService.ts` | 490 (+the saved revision, `boardOfFile`) |
| `packages/core/src/infrastructure/storage/LightboxBoardStore.ts` | 489 (was 394: in-place saves, `listAll`, `locate`, `readOutside`) |
| `packages/core/src/application/handlers/domain/LightboxReadingHandler.ts` | 488 (unchanged) |
| `packages/core/src/application/handlers/domain/LightboxHandler.ts` | 486 (unchanged) |

Before 5B adds Compare's reads to the store, move its listings
(`listAll`, `locate`, `readOutside` and the claim settling they share)
into `LightboxBoardFiles.ts` or a module of their own.

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
