# Filesystem Missing-File Error Contract

**Status:** Partially mitigated in PR #98; stable port contract remains
**Priority:** Low
**Origin:** Workshop storage-bounds review

## Problem

Core storage code recognizes missing files by matching provider error-message
text such as `ENOENT` and `not found`. The VS Code filesystem adapter currently
passes provider errors through without a stable error code, so a remote
filesystem provider with different wording could turn an ordinary missing
checkpoint into a read failure.

## Related files

- `packages/core/src/platform/FileSystem.ts`
- `apps/vscode-extension/src/platform/vscode/VsCodeFileSystem.ts`
- `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts`
- `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts`
- `packages/core/src/infrastructure/storage/fileSystemErrors.ts`

PR #98 centralizes the temporary message classifier so new project-backed
libraries do not grow their own subtly different regex. That is a containment
measure, not the host-agnostic error contract described below.

## Completion criteria

- Define a host-agnostic missing-file error contract on the `FileSystem` port.
- Normalize VS Code `FileSystemError.FileNotFound` into that contract.
- Replace storage-layer message regexes with the stable contract.
- Cover local and remote-provider-shaped missing-file errors in adapter/store tests.
