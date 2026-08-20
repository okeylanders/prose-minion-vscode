# Confine Workshop excerpt source URIs before re-read

**Status:** Addressed on `release/v2.2.0` — awaiting review and commit
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

## Resolution candidate — 2026-08-20

`WorkshopContextIntakeService.authorizeExcerptReread()` now re-derives file
authority before the route can call `readFile`:

- a current open-workspace path must remain lexically contained and every
  workspace-relative ancestor must stat successfully without a symbolic-link
  bit;
- an external path must exactly match a freshly opened configured-resource
  catalog entry (Windows alone permits the platform's case-folded match);
- webview-supplied `configuredResource` claims are stripped and re-derived;
- non-file URIs, normalized traversal, case-mismatched external paths, symbolic
  links, and unverifiable paths fail closed without replacing the excerpt.

The explicit picker remains the writer-authorized door for initially loading an
external file. Persisted re-read is narrower because its URI crosses the
webview/session boundary without a fresh picker gesture.

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
