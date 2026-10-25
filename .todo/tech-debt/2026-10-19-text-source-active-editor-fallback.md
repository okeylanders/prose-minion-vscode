# A Missing Relative Path Silently Measures the Active Editor's File

**Date Identified**: 2026-10-19 (Lightbox Slice 2A)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small (one branch in the resolver, its message, tests)

## Problem

`TextSourceResolver.resolveSingleFilePath` (the `activeFile` mode behind the
Metrics and Search tabs) tries a typed path as absolute, then as
workspace-relative in each folder, then through `findFiles`. When none of
those finds a file, it does not fail: it falls through to the active editor
and returns that file's path.

So a typo in the path box, or a file renamed since it was typed, measures a
different file than the one named, with no message. The result's
`displayPath` is the active file's, which a writer can miss.

The Lightbox avoids this branch: it always resolves an absolute path (a picked
file's `fsPath`, or a `file:` URI converted host-side), and the absolute branch
refuses a missing file ("Active file not found.").

## Recommendation

Fall back to the active editor only when no path was typed (`pathText` empty
or whitespace). When a typed path matches nothing, throw a validation error
that names the path, add its prefix to `TEXT_SOURCE_VALIDATION_ERROR_PREFIXES`,
and cover both cases in the resolver's tests.

## Related Files

- `packages/core/src/infrastructure/text/TextSourceResolver.ts`
- `packages/core/src/__tests__/infrastructure/text/TextSourceResolver.test.ts`
- `packages/core/src/application/handlers/domain/MetricsHandler.ts`
- `packages/core/src/application/handlers/domain/SearchHandler.ts`

## Completion Criteria

- A typed path that matches no file is refused with a message naming it.
- An empty path still uses the active editor, as today.
