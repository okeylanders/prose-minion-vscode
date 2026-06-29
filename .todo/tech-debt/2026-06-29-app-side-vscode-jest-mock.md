# App-Side VS Code Jest Mock

**Date Identified**: 2026-06-29
**Reviewed**: 2026-06-29
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Small

## Problem

The Jest configuration can discover future tests under `apps/vscode-extension`,
but the current VS Code API mock is scoped to the core test setup. The first
adapter-side test that imports a module touching `vscode` will need an app-side
mock seam.

There are no app-side adapter tests today, so this is not currently blocking.

## Recommendation

Add the app-side mock when introducing the first VS Code adapter test. Keep it
small and focused on the APIs the adapter actually uses.

## Related Files

- `jest.config.js`
- `packages/core/src/__tests__/setup.ts`
- `apps/vscode-extension/src/`

## Completion Criteria

- App-side tests that import VS Code adapter code can run under Jest.
- Mocked APIs fail loudly when an unimplemented VS Code method is used.
- Existing core tests remain unaffected.
