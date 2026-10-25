# The Configured Catalog Lists Only One of Two Same-Named Files Across Workspace Folders

**Date Identified**: 2026-10-20 (PR #154 review, F-02; `epic/lightbox-source-picker`)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Medium (the catalog key is a cross-feature contract)

## Problem

`ContextResourceResolver.collectResources` dedupes matches by their
workspace-relative path, lowercased (`normalizeKey`), across every open
workspace folder. In a multi-root workspace where two folders each hold
`Notes/cast.md`, the configured catalog lists only the first folder's file;
the second cannot be chosen from any "Choose from project" picker (the
Workshop's context selector, the Lightbox's source and Context pickers) or
reached by a persona's `resource.*` capability. The writer has to use
"Explore project folders…" to reach it.

The catalog key (`ConfiguredResourceRef`: `{ group, path }`) carries no
folder, so the collapse is the key's limit as much as the resolver's: two
listed files could not be told apart by key today.

This is older than the shared picker and is not a regression from PR #154.
PR #154 F-02 fixed the picker's *attached* state, which compared display
paths and so disabled the listed file whenever another folder's same-named
file was on the Lightbox's context shelf; rows now compare a host-keyed file
identity (`LightboxFileKey`). The listing itself still shows only one of the
two files.

## Recommendation

Decide whether multi-root catalogs should list both files. If so, add the
workspace folder to the catalog key (or a folder-qualified display path, as
VS Code's `asRelativePath(file, true)` gives), update the Workshop and
Lightbox resolution paths and the persona capability's key grammar together,
and keep the single-root display unchanged. If not, say so in the picker
(for example, a note when a listed path exists in more than one folder).

## Related Files

- `packages/core/src/infrastructure/context/ContextResourceResolver.ts` (`collectResources`, `normalizeKey`)
- `packages/core/src/shared/types/messages/configuredResources.ts` (`ConfiguredResourceRef`)
- `packages/core/src/application/services/workshop/WorkshopContextIntakeService.ts` (`WorkshopContextIntakeCatalog`)
- `packages/core/src/application/handlers/domain/LightboxProjectFiles.ts`
- `packages/core/src/__tests__/presentation/webview/LightboxProjectPickerMultiRoot.test.tsx` (the two-folder fixture)

## Completion Criteria

- A two-folder workspace with the same relative path in both lists either
  both files, distinguishable by key, or one with a visible explanation.
- The Workshop context selector parity witnesses pass, or change on purpose.
