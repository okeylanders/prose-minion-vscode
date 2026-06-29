# TypeScript Project References

**Date Identified**: 2026-06-29
**Reviewed**: 2026-06-29
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Medium

## Problem

The monorepo uses a shared `tsconfig.base.json` and workspace-specific
typechecks, but it does not use TypeScript project references with `tsc -b` and
`composite`.

ESLint and architecture tests currently enforce the important boundaries. Project
references could add compiler-level package boundaries and incremental builds,
but they also require careful config changes and may add friction for a small
two-package workspace.

## Recommendation

Revisit project references when either build speed, editor performance, or
package-boundary enforcement becomes painful enough to justify the config churn.

## Related Files

- `tsconfig.base.json`
- `packages/core/tsconfig.json`
- `packages/core/tsconfig.webview.json`
- `apps/vscode-extension/tsconfig.json`
- `tsconfig.test.json`

## Completion Criteria

- Decision documented: adopt or explicitly continue deferring.
- If adopted, `npm run typecheck` uses the project-reference graph.
- Jest, webpack, and path aliases still resolve correctly.
- Architecture boundary tests remain green.
