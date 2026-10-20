# The Shared Project Picker Still Leans on Workshop-Named Seams

**Date Identified**: 2026-10-20 (Lightbox source picker, `epic/lightbox-source-picker`)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (mechanical renames and one file move, no behavior change)

## Problem

The Workshop's "Choose from project" picker is now a full-tab component that
the Lightbox renders too (`components/fulltab/ProjectResourcePickerModal`).
Its catalog contracts were renamed to neutral types
(`messages/configuredResources.ts`), and its rules moved to the frame
(`styles/fulltab/modal.css`). Two seams it depends on still carry the
Workshop's name:

- **The modal chrome.** The picker renders in `WorkshopModalShell`, which
  still lives at `components/workshop/WorkshopModalShell.tsx`, although every
  full tab's overlays now use it. A shared full-tab component therefore
  imports from the Workshop's folder; the boundary test allows exactly that
  import. The move was left out of this branch because it renames 20
  Workshop importers and carries the file's four `naming-convention` lint
  warnings to a new path, which would break the branch's "lint identical per
  file and rule" gate.
- **The catalog service.** The Lightbox's project files are read through
  `WorkshopContextIntakeService.openCatalog()` (passed into the Lightbox
  handlers as a narrow `catalog` port). It is the right single catalog, but
  its name says Workshop.

Neither changes behavior. They make the dependency direction read wrong:
a Lightbox or shared module naming a Workshop module for something that is
no longer the Workshop's.

## Recommendation

1. Move `WorkshopModalShell` to `components/fulltab/FullTabModalShell.tsx`,
   rename its importers, drop the boundary test's Workshop exception for the
   picker, and record the lint warnings' new path in the PR.
2. Split the configured-catalog part of `WorkshopContextIntakeService`
   (`openCatalog` and `WorkshopContextIntakeCatalog`) into a neutral
   `ConfiguredResourceCatalogService` in `application/services/`, which the
   Workshop's intake service and the Lightbox's `LightboxProjectFiles` both
   take. The intake service is already over 500 lines, so this also shrinks
   it.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopModalShell.tsx`
- `packages/core/src/presentation/webview/components/fulltab/ProjectResourcePickerModal.tsx`
- `packages/core/src/application/services/workshop/WorkshopContextIntakeService.ts`
- `packages/core/src/application/handlers/domain/LightboxProjectFiles.ts`
- `packages/core/src/__tests__/architecture/boundaries.test.ts` (`SHARED_PROJECT_PICKER_MODULES`)

## Completion Criteria

- No module under `components/fulltab/` imports from `components/workshop/`.
- No Lightbox module imports a `Workshop*` service for the catalog.
- The Workshop context selector parity witnesses pass unchanged.
