# MessageHandler Composition-Root Consolidation Complete

**Date:** 2026-06-24 13:07 CDT  
**Branch:** `sprint/messagehandler-composition-root-consolidation`  
**Commit:** `e8de3f3` — `refactor: restore single composition root`  
**Remote:** Branch is pushed and tracks `origin/sprint/messagehandler-composition-root-consolidation`  
**Working tree:** Clean before this memory entry

## Summary

Implemented
[ADR 2026-06-18](../docs/adr/2026-06-18-messagehandler-composition-root-consolidation.md).

`apps/vscode-extension/src/extension.ts` is now the single infrastructure
composition root. `MessageHandler` receives a typed `CoreServices` bundle and is
responsible only for application wiring, route registration, message replay, and
webview-lifecycle callbacks.

## Changes

- Added `MessageHandlerContracts.ts` containing:
  - `CoreServices`
  - `MessageTransport`
  - `SecretsPort`
  - `ResultCache`
- Hoisted construction of these services into `extension.ts`:
  - `TextSourceResolver`
  - `CategorySearchService`
  - `OpenRouterAccountClient`
  - `AccountBalanceService`
- Reduced `ProseToolsViewProvider` to passing `CoreServices`, `Platform`, the
  transport, and logging inward.
- Replaced the module-global result cache with a cache owned by each
  `MessageHandler` instance.
- Replaced `any`-typed post-message seams across all domain handlers with
  `MessageTransport`.
- Replaced the untyped secrets dependency with `SecretsPort`.
- Added callback attach/detach support for:
  - AI status and token usage
  - assistant and dictionary status
  - category-search status
  - account-balance refresh listeners
- Changed `PublishingHandler` to reuse `StandardsService` rather than construct a
  new `PublishingStandardsRepository` per request.
- Updated the core public barrel, architecture documentation, agent guidance,
  detailed changelog, and ADR status.

## Tests and Guards

Added the first `MessageHandler` assembly suite. It verifies:

- the handler can be constructed entirely with injected fakes
- account-balance messages route through the injected service
- startup/reset zero-token updates do not schedule billing refreshes
- real token usage does schedule a refresh
- replay caches are isolated between handler instances
- disposal detaches callbacks/listeners and disposes account-balance resources

The architecture boundary suite now fails if `MessageHandler` resumes
constructing the infrastructure classes moved to `extension.ts`.

## Verification

- **49/49 test suites passing**
- **373/373 tests passing**
- Core, webview, and extension TypeScript checks clean
- ESLint: zero errors
- Production extension and webview bundles built successfully
- Tailwind bundle sentinel verification passed
- Only known webpack bundle-size warnings remain

## Commits in This Work Sequence

- `5569f93` — repository-state memory checkpoint, committed on `main`
- `e8de3f3` — composition-root consolidation, committed on the sprint branch

Local `main` includes the memory checkpoint but GitHub `main` remains at PR #61
until this branch is reviewed and merged.

## Next Step

Open/review and merge the consolidation PR. After it lands:

1. create `release/v2.0.0`;
2. update release prompts and monorepo documentation paths;
3. add the consumer-facing v2 changelog/README material;
4. correct the documented Word Search defaults;
5. run F5 smoke tests under light and dark themes, including live OpenRouter
   balance and post-request refresh;
6. package and release v2.0.0 with explicit publication approval;
7. migrate surviving deferred items out of `migration-and-facelift/` and remove
   that completed campaign folder.

## Resume Point

Continue from clean commit `e8de3f3` on
`sprint/messagehandler-composition-root-consolidation`.
