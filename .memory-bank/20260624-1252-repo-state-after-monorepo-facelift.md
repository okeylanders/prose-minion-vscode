# Repository State After Monorepo + Facelift Landing

**Date:** 2026-06-24 12:52 CDT  
**Branch:** `main`  
**HEAD:** `2942db1b16eb96d8d41b0e2c9fbfa784b1cd5744`  
**GitHub:** `origin/main` and GitHub `main` confirmed at the same SHA  
**Working tree:** Clean

## Executive Summary

The first large refactor and visual facelift round is complete and merged.

PR [#61](https://github.com/okeylanders/prose-minion-vscode/pull/61),
**“Monorepo ports & adapters: vscode-free core + account balance + React 18 +
facelift,”** merged into `main` on 2026-06-19 as merge commit `2942db1`.

The repository is now an npm-workspaces monorepo:

- `packages/core` contains the host-agnostic application/domain/infrastructure/
  presentation code and imports no `vscode`.
- `apps/vscode-extension` is the VS Code adapter and composition root.
- Core resources are owned by `packages/core/resources` and staged into the
  extension package during build/package.

The landing also includes:

- React 18
- OpenRouter account balance and last-request cost
- the `App.tsx` message-router extraction
- the FrameMinion-inspired sidebar facelift
- the All Tools picker
- package/CI boundary guards
- resource-containment hardening

## Verified Health on 2026-06-24

The full local gate was rerun from clean `main`:

- `npm test -- --runInBand`: **48/48 suites, 368/368 tests passing**
- `npm run typecheck`: **all three TypeScript projects clean**
  - core host
  - core webview
  - VS Code extension
- `npm run lint -- --quiet`: **zero errors**
- `npm run build`: **both production bundles built**
- `verify:bundle`: **all three Tailwind sentinel utilities present**

Webpack reports only the known webview bundle-size warnings.

GitHub was checked directly:

- `main` is still `2942db1`
- PR #61 is merged
- there are no open pull requests
- the only open issue is old issue #48, “Hopefully a custom API can be added”
- the latest GitHub release remains `v1.10.4`

The VS Code Marketplace also remains on `v1.10.4`.

## What Is Complete

### Monorepo and ports-and-adapters migration

Complete and merged:

- platform ports
- VS Code adapters
- `packages/core` / `apps/vscode-extension` split
- TypeScript 5.x migration
- core barrel and app-to-core import boundary
- `AppMessagePort`
- resource staging and VSIX packaging
- CI/prepackage verification gates
- zero `vscode` imports in core, enforced by architecture tests

### Facelift round

Complete and merged:

- React 18 foundation
- account-balance surface
- `--pm-*` design tokens
- new header/navigation/chrome
- tab-body reskin
- All Tools modal
- Assistant primary-action decluttering
- theme default set to follow VS Code

### PR review fixups

The PR #61 blocker/high-value findings were resolved before merge, including:

- malformed OpenRouter usage values no longer overstate remaining credit
- forced refresh coalescing is tested
- loader path containment
- rejected post-message logging
- scheduled-refresh error notification
- pre-resolve `MessageHandler` disposal

## Stale Tracking Versus Real Remaining Work

`migration-and-facelift/plan.md` still shows “Pass 2 Wave 4 — final verify +
docs” unchecked. This is stale bookkeeping: the final gate, packaging, review
fixups, detailed changelog, and PR landing were completed before the June 19
merge and were reconfirmed by this audit.

The genuinely unfinished work is below.

## Recommended Next Engineering Slice

Create:

`sprint/messagehandler-composition-root-consolidation`

Implement
`docs/adr/2026-06-18-messagehandler-composition-root-consolidation.md`.

This is the highest-value remaining foundation work because `MessageHandler`
still acts as a second composition root:

- module-level mutable `sharedResultCache`
- `secretsService: any`
- `postMessage: (message: any)` across older handlers
- internal construction of `TextSourceResolver`
- internal construction of `CategorySearchService`
- internal construction of `AccountBalanceService` and
  `OpenRouterAccountClient`
- `PublishingHandler` constructs its own repository
- no test constructs the full `MessageHandler` assembly

Target result:

1. Introduce and build a `CoreServices` bundle in `extension.ts`.
2. Make the result cache instance-bound.
3. Type the secrets, transport, cache, and handler post-message seams.
4. Hoist infrastructure construction to the true composition root.
5. Inject the existing standards service into `PublishingHandler`.
6. Add the first `MessageHandler` assembly test.
7. Pin the zero-token activation/reset refresh behavior while the new seam is
   available.

Estimated scope from the ADR: approximately one day.

## Then Prepare and Release v2.0.0

The extension and core manifests are already stamped `2.0.0`, and a local
`prose-minion-2.0.0.vsix` exists, but v2 has not been released.

Release prep should happen on `release/v2.0.0` and include:

- update the consumer-facing extension changelog with a v2 section
- update the README headline/“What’s New” material
- correct README Word Search defaults (currently documents `10 / 250`; shipped
  defaults are `3 / 50 / 2`)
- update the release prompts for the monorepo paths
  (`apps/vscode-extension/package.json`, README, changelog, and VSIX location)
- reconcile the root orchestration package version (`1.10.4`) with the intended
  monorepo version policy
- run the complete automated gate
- run an F5/manual smoke under light and dark VS Code themes
- verify a live OpenRouter balance fetch
- run an AI request and verify the approximately 10-second balance refresh
- verify “Last request” cost
- package, user-test, tag, create the GitHub release, and publish only with
  explicit approval

## Other Backlog Items

These are real, but should not block the consolidation slice:

- logging sweep: route core `console.*` calls through `LogSink`
- tighten open string contracts (`reason`, publishing `preset`, envelope
  `source`)
- CSS pattern standardization / remaining inline styles, especially
  `SettingsOverlay`
- decide whether Word Search defaults should deliberately change from shipped
  `3 / 50 / 2` to ADR-era `7 / 150`
- app-side VS Code adapter test/mock seam
- symlink-aware path containment
- unsaved/`untitled:` document behavior
- full-tab Assistant product design
- future `apps/desktop` shell
- optional TypeScript project references

## `migration-and-facelift/` Cleanup Decision

The folder can be removed after:

1. the `MessageHandler` consolidation is merged;
2. the v2.0.0 release and manual smoke are complete;
3. still-live deferred work is moved to canonical `.todo/tech-debt` documents
   or an appropriate ADR;
4. inbound references are updated.

Known inbound references:

- root `package.json` description
- `docs/CHANGELOG-DETAILED.md`
- historical PR reviews that cite
  `migration-and-facelift/tech-debt-and-deferred.md`

Historical PR-review links may be left as historical references only if the
folder is archived rather than deleted. If the folder is deleted, the useful
remaining decisions must be preserved elsewhere first.

### Recommended disposition by file

- `readme.md`: delete; it describes a campaign that is complete.
- `plan.md`: delete after v2; it is operational scaffolding and already stale.
- `status.md`: superseded by this memory entry, the changelog, and git history.
- `decision-tracker.md`: distill any unique durable decisions into ADRs,
  documentation, or this memory record, then delete.
- `tech-debt-and-deferred.md`: migrate only still-live items into `.todo`;
  discard resolved/stale rows, then delete.

The deletion criterion is not “every deferred idea has been implemented.”
Several entries are intentionally future product or architecture work. The
criterion is: **the migration/facelift campaign is closed, and every still-live
obligation has a permanent home.**

## Suggested Sequence

1. Branch and implement the `MessageHandler` consolidation ADR.
2. Review and merge that isolated slice.
3. Create `release/v2.0.0`.
4. Clean release docs, prompts, and version metadata.
5. Run automated and manual verification.
6. Publish v2.0.0 with explicit approval.
7. Migrate surviving debt out of `migration-and-facelift/`.
8. Remove the campaign folder and its inbound references in a small cleanup
   commit.

## Resume Point

Start from clean `main` at `2942db1`.

The next code change should be the composition-root consolidation—not another
feature slice—so future functionality has one honest construction boundary and
a tested assembly seam.
