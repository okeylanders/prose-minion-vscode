# Confine Workshop excerpt source URIs before re-read

**Status:** Open — explicitly deferred from PR #105
**Priority:** High (security)
**Source:** [PR #105 review F-01](../../docs/pr-reviews/pr-105-application-handler-extraction-5430511-review.md)

## Problem

The webview IPC parser accepts any non-empty `file` excerpt `sourceUri`, and
`WorkshopExcerptScopeHandler.handleRereadExcerpt()` later converts that URI to a
filesystem path and reads it without proving that the path belongs to the
workspace or the configured-resource catalog. A spoofed file-backed source can
therefore cause an arbitrary host file to be read into the Workshop excerpt;
that text is then exposed to the webview and can enter a model prompt.

The behavior predates PR #105 and was deliberately excluded from that handler-
extraction remediation so the architectural change could remain scoped. This
entry keeps the security decision in the active work ledger rather than only in
the historical review document.

## Direction

Define one host-owned excerpt-source confinement policy and apply it before
every file-backed re-read. Do not trust the webview-supplied `relativePath` or
`configuredResource` claim as proof. Re-derive authority from the normalized
URI/path against an approved workspace or configured-resource boundary, with
symlink behavior decided explicitly, and fail closed before calling `readFile`.

## Related files

- `packages/core/src/shared/types/messages/workshop/session.ts`
- `packages/core/src/application/handlers/domain/workshop/WorkshopExcerptScopeHandler.ts`
- `packages/core/src/application/services/workshop/WorkshopContextIntakeService.ts`
- `packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopHandler.excerptScope.test.ts`
- `docs/pr-reviews/pr-105-application-handler-extraction-5430511-review.md`

## Completion criteria

- A spoofed `file://` URI outside the approved source boundary is refused before
  any filesystem read.
- Workspace files and configured resources that satisfy the chosen policy can
  still be re-read.
- URI normalization, path traversal, case sensitivity, and symlink behavior
  have explicit tests for the supported host platforms.
- Refusal leaves the current excerpt and session state unchanged, does not send
  file contents to the webview, and does not make them available to a model
  prompt.
- The PR #105 review ledger links to the implementing change when complete.
