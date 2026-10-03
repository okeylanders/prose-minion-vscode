# Workshop Rewind and Branch is on `main` but in no release

**Date Identified**: 2026-10-01
**Reviewed**: 2026-10-02
**Status**: Resolved — [v2.7.0](https://github.com/okeylanders/prose-minion-vscode/releases/tag/v2.7.0) published on 2026-10-02
**Priority**: Medium
**Estimated Effort**: Small (the usual release preparation)
**Found by**: Workshop Rewind and Branch epic closure ([epic](../epics/epic-workshop-rewind-and-branch-2026-09-30/README.md))

## Problem as identified on 2026-10-01

Both changelogs carry the epic under `[Unreleased]` ([CHANGELOG.md](../../../apps/vscode-extension/CHANGELOG.md) and [CHANGELOG-DETAILED.md](../../../docs/CHANGELOG-DETAILED.md)), and every package is still at 2.6.2. Sprint 03 left the version to release preparation on purpose, so once [PR #121](https://github.com/okeylanders/prose-minion-vscode/pull/121) merges, `main` carries Rewind and Branch without a release that names them.

Sessions saved by this release also cannot be opened by earlier builds ([ADR 2026-09-30 §9](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#9-codec)). Writers who sync sessions through Git must update every machine first, and the release notes must keep saying so.

## Recommendation

Prepare the release the usual way, following the [v2.6.2 preparation](../../../.memory-bank/20260929-1333-release-v2.6.2-preparation.md):

- Name the version. Rewind and Branch are new features, so it's at least a minor release.
- On a `release/vX.Y.Z` branch, update the root, core and extension versions, their lockfile entries and the README. In both changelogs, turn `[Unreleased]` into that version and date.
- Keep the upgrade notes and the Git-sync warning intact.
- Include whatever else `[Unreleased]` holds by then, for example Craft Steering ([PR #118](https://github.com/okeylanders/prose-minion-vscode/pull/118)) if it merges first.
- Package the VSIX, confirm the packaged extension, tag and publish to GitHub, and record preparation and completion memory-bank entries. Marketplace publication follows an explicit request.

## Related Files

- `apps/vscode-extension/CHANGELOG.md` and `docs/CHANGELOG-DETAILED.md`: the dated v2.7.0 sections.
- `package.json`, `packages/core/package.json`, `apps/vscode-extension/package.json` and `package-lock.json`: the version.
- [Manual smoke](2026-10-01-workshop-rewind-and-branch-main-smoke.md): the gate.

## Completion Criteria

- The manual smoke is recorded as passing.
- Both changelogs name the version and date, and keep the Git-sync upgrade warning.
- All package versions match it.
- The release is published, with preparation and completion memory-bank entries.
- This item moves to `.todo/archive/tech-debt/`.

## Preparation progress — 2026-10-02

The main smoke is confirmed, all three workspace versions and lockfile entries are 2.7.0, and both changelogs now name 2026-10-02. The README describes all three feature families and keeps the all-machines upgrade warning. Clean-install tests, coverage, typechecks, lint and VSIX packaging passed on `release/v2.7.0`. This item stays active until publication.

## Resolution — 2026-10-02

Main includes the release merge, tag v2.7.0 points to it, and the [GitHub release](https://github.com/okeylanders/prose-minion-vscode/releases/tag/v2.7.0) contains the final artwork VSIX. Main CI passed. All versions and dated changelogs agree; the Git-sync upgrade warning is preserved. Marketplace publication remains a separate explicit request.
