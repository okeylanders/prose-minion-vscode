# Release preparation — awaiting version confirmation

**Date:** 2026-10-04 12:43 CDT
**Branch:** `release/vNEXT`, tracking `origin/release/vNEXT`
**Source:** `9d77ad755c530e961d81abdd03c7c092548e6986`
**Previous release:** v2.7.0, published 2026-10-02 CDT, tag `364b76c4`
**Proposed version:** v2.8.0 (minor); not yet confirmed
**Current workflow gate:** Step 2, version confirmation. Validation was performed independently while the asynchronous version question remained pending.
**Requested stopping point:** Prepare/validate/package the release branch, then stop so Okey's designer can update the Workshop preview/startup modal and add graphics. No merge, tag, GitHub release, or Marketplace publication is authorized by this preparation request.

## Completed

- Confirmed clean `main`, pulled fast-forward-only from origin (already current), and created/pushed `release/vNEXT`.
- Previous paused checkpoints are superseded by completed release records. The existing release/v2.7.0 branch/worktree was not changed.
- Read GitHub releases and merged PRs. Ten commits after v2.7.0; principal new PR is [#123](https://github.com/okeylanders/prose-minion-vscode/pull/123), merged 2026-10-04. PR #122 from the date-window query predates the release tag and is excluded.
- Analyzed current ADRs, feature record, memory notes, PR #123 resolution ledger and both fix reviews. No open High findings remain from the fix reviews.
- Detected dependency installation drift (DOMPurify 3.4.12 installed vs 3.4.14 locked). Ran `npm ci` from the unchanged committed lockfile, then reran validation. `npm ls --all` passed afterward.
- Tests and coverage: 236 suites / 2,943 tests / 2 snapshots passed. Coverage: 85.09% statements, 76.64% branches, 85.46% functions, 85.40% lines. Project coverage excludes presentation and infrastructure/api; these percentages do not establish cache-policy branch coverage.
- All three typechecks passed; production build and bundle sentinels passed; lint: zero errors, 1,096 existing warnings. Webpack retains three size/performance warnings. Installation reported engine warnings on local Node 23.10.0; installation and checks completed successfully.
- Both `npm audit --json` and `npm audit --audit-level=high` exited 1: 44 affected packages (42 high, one moderate, one low), zero critical. High/moderate nodes are all dev dependencies. Root advisories: brace-expansion, braces, markdown-it, DOMPurify; high severity propagates through tooling parents. No dependency upgrades made.
- Focused independent read-only release review plus orchestrator verification: no new critical blocker; known warnings remain. `git diff --check` passed.

## Analysis summary

- **Features:** Retained Claude and supported Alibaba/Qwen cache requests; provider affinity; Claude 5m/default or 1h setting; estimated composer cache window, including GPT-5.6+ native estimates; standing context 100K words; seven 10K-word message attachments.
- **Fixes:** Acknowledged attachment deltas and removals, shared chat/tool-synthesis context snapshot, generation-safe acknowledgement and retries; per-inference model-window preflight; structured refusals/draft restoration; alias metadata precedence; prompt/validator/Gesture budget sync.
- **Refactors:** Closed provider request-policy registry and named context-delivery collaborator at existing boundaries.
- **Docs/tests:** ADRs, architecture/feature records, review follow-ups and comprehensive regression additions. Two commits are preceding-release publication/archive records.
- **Compatibility:** Old sessions load. Newly written sessions can contain optional `hostContextDelivery`; older exact-key readers reject that field. Git-synced machines must all upgrade. No released schema migration is introduced by release preparation.
- **Docs gap:** Consumer changelog, detailed changelog, and README do not yet cover PR #123. Draft additions exist in temporary files below; actual release docs/version files have not changed pending confirmation.

## Findings and dispositions

- **CRITICAL:** None identified.
- **WARNING:** Remote host/webview clock skew affects the estimate (F-05); workspace TTL can override overlay/global preference (F-17); estimator calibration/numerical capacity remains pending (F-28); other PR ledger follow-ups retain their status. No warning fixes made during release preparation.
- **WARNING:** Dependency audit is not clean. Every high/moderate affected package has a usage/test/action disposition in the updated dependency follow-up. Defer focused tooling maintenance; no blanket forced audit fix. Refresh disposition before publication.
- **INFO:** Live Claude/Qwen cold-write/warm-read and TTL acceptance remains pending. No paid calls were made. The estimate is not proof of cache reuse.

## Local modified files (not yet committed)

- `.todo/tech-debt/2026-10-02-release-dependency-audit-follow-up.md`
- `docs/pr-reviews/release-2026-10-04-prompt-caching-review.md`
- This checkpoint.

## Drafts and diagnostics

Proposed v2.8.0 docs (change version if Okey chooses another):

- `/private/tmp/prose-minion-release-consumer-notes-draft.md`
- `/private/tmp/prose-minion-release-detailed-notes-draft.md`
- `/private/tmp/prose-minion-release-readme-highlight-draft.md`

Temporary logs: `/private/tmp/prose-minion-release-{test-locked,coverage,typecheck-locked,build-locked,lint-locked,install,audit-high}.log`; raw audit `/private/tmp/prose-minion-release-audit.json`. Committed source tests/ADRs/review and this record are the durable evidence; scratch logs are optional.

## Next steps after version confirmation

1. Rename `release/vNEXT` to the accepted version and update tracking. Push the accepted branch; remove only the temporary vNEXT remote per skill (respect automatic approval if it rejects deletion).
2. Update root/core/extension package versions and matching lockfile root/workspace entries together. Extension output already reads manifest version; there is no hardcoded banner to edit. Search current intentional version references without rewriting historic release records.
3. Apply drafted changelog sections and README highlights. Keep the prior v2.7.0 highlights under an "Also" heading. Avoid claiming designer artwork or live provider acceptance is done.
4. Write final preparation checkpoint, stage only intended files, commit/push release preparation. Package through root `npm run package`; it reruns typecheck/tests and VSCE's production build. Inspect VSIX manifest, resource/notice asset parity, and exclusions; record SHA-256.
5. Stop on the release branch for the designer. This intermediate VSIX will need rebuilding after artwork changes. Do not merge/tag/publish. Manual packaged-extension approval remains required before a later merge.

## Designer handoff

- Modal: `packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx` (current tour still leads with v2.7.0).
- Notice version/shot registry: `packages/core/src/shared/constants/workshopNotices.ts` (current `v5`; bump when updated so existing users see it).
- Screenshots: `apps/vscode-extension/assets/workshop-notices/` (runtime assets intentionally packaged).
- Webview URI assembly: `apps/vscode-extension/src/application/providers/webviewHtml.ts`.
- README art: `screenshots/readme/` and `apps/vscode-extension/README.md`.

Confirm whether Okey's "preview modal" refers to this startup tour or the separate edit/preview sheet before the designer changes its content. Release preparation itself makes no modal changes.

## Version gate resolved

Okey confirmed v2.8.0. Preparation and packaging are complete; the branch is now
`release/v2.8.0`. See [20261004-1252-release-v2.8.0-preparation.md](20261004-1252-release-v2.8.0-preparation.md) for final validation, artifact hash, and
the requested designer handoff. The pending state above is historical.
