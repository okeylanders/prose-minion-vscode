# Tech Debt: One Claimed-File Primitive for the Board and Memory Stores

**Status:** Open (after Workshop Project Memory ships)
**Priority:** Low
**Origin:** [ADR 2026-11-04: Workshop Project Memory](../../docs/adr/2026-11-04-workshop-project-memory.md), D10

## Problem

Two stores write writer data in the workspace with the same discipline:

- **Staged writes:** a private random name, then a rename that never
  overwrites.
- **Claimed rewrites and deletes,** with a 30-second lease.
- **Abandoned claims** are put back, or removed beside a standing file.
- **A folder read error** is `unknown`, never empty.

The Lightbox's modules are board-shaped. `LIGHTBOX_BOARD_CLAIM` hard-codes the
board file name (`packages/core/src/infrastructure/storage/LightboxBoardClaims.ts:47`).
So Project Memory writes its own siblings (`ProjectMemoryClaims`,
`ProjectMemoryRewrite`, `ProjectMemoryNewFile`) that follow the same rules.
That's two copies of subtle concurrency code.

## Related Files

- `packages/core/src/infrastructure/storage/LightboxBoardClaims.ts`,
  `LightboxBoardRewrite.ts`, `LightboxBoardNewFile.ts`
- `packages/core/src/infrastructure/storage/ProjectMemory*.ts` (Slice 1)

## Completion Criteria

- One primitive (claim, staged new file, claimed rewrite, claimed delete),
  parameterized by the saved-name pattern.
- Both stores use it, and both stores' existing tests pass unchanged.
- No behavior change to either store.
