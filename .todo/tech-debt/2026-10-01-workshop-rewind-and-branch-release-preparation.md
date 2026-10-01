# Workshop Rewind and Branch is on `main` but in no release

**Date Identified**: 2026-10-01
**Reviewed**: 2026-10-01
**Status**: Blocked — waits on the [manual smoke](2026-10-01-workshop-rewind-and-branch-main-smoke.md)
**Priority**: Medium
**Estimated Effort**: Small (the usual release preparation)
**Found by**: Workshop Rewind and Branch epic closure ([epic](../archive/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md))

## Problem

Both changelogs carry the epic under `[Unreleased]` ([CHANGELOG.md](../../apps/vscode-extension/CHANGELOG.md) and [CHANGELOG-DETAILED.md](../../docs/CHANGELOG-DETAILED.md)), and every package is still at 2.6.2. Sprint 03 left the version to release preparation on purpose, so once [PR #121](https://github.com/okeylanders/prose-minion-vscode/pull/121) merges, `main` carries Rewind and Branch without a release that names them.

This is also the first release whose saved sessions earlier builds can't open ([ADR 2026-09-30 §9](../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#9-codec)). Writers who sync sessions through Git must update every machine first, and the release notes must keep saying so.

## Recommendation

Prepare the release the usual way, following the [v2.6.2 preparation](../../.memory-bank/20260929-1333-release-v2.6.2-preparation.md):

- Name the version. Rewind and Branch are new features, so it's at least a minor release.
- On a `release/vX.Y.Z` branch, update the root, core and extension versions, their lockfile entries and the README. In both changelogs, turn `[Unreleased]` into that version and date.
- Keep the upgrade notes and the Git-sync warning intact.
- Include whatever else `[Unreleased]` holds by then, for example Craft Steering ([PR #118](https://github.com/okeylanders/prose-minion-vscode/pull/118)) if it merges first.
- Package the VSIX, tag, publish to GitHub and the Marketplace, and record the preparation and completion memory-bank entries.

## Related Files

- `apps/vscode-extension/CHANGELOG.md` and `docs/CHANGELOG-DETAILED.md`: the `[Unreleased]` sections.
- `package.json`, `packages/core/package.json`, `apps/vscode-extension/package.json` and `package-lock.json`: the version.
- [Manual smoke](2026-10-01-workshop-rewind-and-branch-main-smoke.md): the gate.

## Completion Criteria

- The manual smoke is recorded as passing.
- Both changelogs name the version and date, and keep the Git-sync upgrade warning.
- All package versions match it.
- The release is published, with preparation and completion memory-bank entries.
- This item moves to `.todo/archive/tech-debt/`.
