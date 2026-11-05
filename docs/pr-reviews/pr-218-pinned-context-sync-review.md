# PR #218 review: Pinned Context sync into Bookmark Recall

## Verdict

**Approved in this review at `f8f3d16651755c09daf60b7bfa2e49551cf38e1b`. No actionable introduced defect or blocking integration finding.** The sync preserves Bookmark Recall's reviewed behavior and brings in the Pinned Context live-pass corrections as intended.

This is the report and PR-comment disposition, not a formal GitHub APPROVED review state or authorization to merge. The connected account is the PR author. No product edits, merge, deployment or live provider calls were performed.

- **PR:** [#218](https://github.com/okeylanders/prose-minion-vscode/pull/218)
- **Base:** `epic/workshop-bookmark-recall` at `78fe28d4c4067a88055f372302252853a18b23f6`
- **Incoming source:** `epic-pinned-context` at `b9d8498fb3516df5f8dca550e158664df4f1a193`
- **Head branch:** `epic/workshop-bookmark-recall-sync-pinned-context-217`
- **Reviewed:** 2026-11-05
- **Scope:** all 14 changed files, independent tree reconstruction, both overlapping budget files, adjacent pin/write/seed contracts, Bookmark Recall and session-store preservation, affected automated behavior, and exact-source CI.

## Integration evidence

1. **The integrated tree is exactly the clean three-way result.** `git merge-tree --write-tree 78fe28d4 b9d8498f` succeeds with no conflicts and returns `1e48955f4803740c9f00bfbee39c3e2c9b52456c`, exactly the reviewed head's tree. No manual merge deviation or dropped hunk was found.
2. **All 12 non-shared incoming changed files match the incoming epic byte-for-byte.** The two shared files are `promptBudgets.ts` and its architecture test. Relative to the target base, they change only Pinned Context's file/byte bounds and the associated assertion.
3. **Bookmark Recall D3 is preserved:** 50 recent sessions, 10 named sessions, 60 items, 24,000 list characters, 4,000 message characters, 200 query characters, and maximum offset 999,999. The recall implementation, session-store/page implementation, Open-at-bookmark controller, and its earlier corrections are unchanged from the target base.
4. **Pin behavior remains bounded and atomic.** The 1,000-item message-shape ceiling is separate from the 50-file durable bound. Path deduplication precedes final-count refusal. The word budget, catalog and containment checks, revision guards and commit-time room checks remain intact.
5. **No new architectural owner or host coupling is introduced.** The changed implementation stays in its established handler, Pinned Context service and shared-budget owners. Architecture boundary tests pass.

## Independent controls

The [PR #217 boundary probe](probes/pr-217-pin-boundaries.test.ts.txt) was rerun against this integration: **5 tests passed**, covering 1,000/1,001 request boundaries on both routes, duplicate/final-count semantics, exactly 50 catalog files, and the documented safe UTF-8 refusal.

A new [50-file seed probe](probes/pr-218-seed-integration.test.ts.txt) adds **4 passing tests** on the integrated branch:

- First room, New and full reset each seed all 50 files in order.
- The unchanged word budget still skips a 30,000-word pinned file when only 20,000 words remain, then attaches all 49 later small files.

To reproduce the new probe, copy it to `packages/core/src/__tests__/application/services/workshop/pinnedContext/review218SeedIntegration.test.ts`, then run `npx jest --runInBand --runTestsByPath` with that path. Both artifacts are kept as `.txt` outside production test discovery; neither changes production coverage counts.

## Nonblocking notes and scope limits

### N-01: content sync, not recorded merge ancestry

The PR text calls `f8f3d166` a merge commit, but the Git object has **one parent**, `78fe28d4`. The incoming `b9d8498f` is not an ancestor; their merge base remains `f2980986`. The current tree is correct, so this does not block the content sync. It does mean future epic integration cannot rely on Git ancestry to know these incoming commits were already merged. Describe this as a squash-style/content sync, or preserve the intended ancestry in a separately authorized history change. This review does not rewrite it.

### Existing UTF-8 byte-bound limitation

The upstream [PR #217 N-01](pr-217-pinned-context-live-pass-review.md#n-01--low--pre-existing-maximum-path-byte-sizing-assumes-ascii) and [tracked follow-up](../../.todo/tech-debt/2026-11-05-pinned-context-utf8-byte-bound.md) are carried forward correctly. Maximum-length Unicode or JSON-escaped paths can reach the independent encoded-byte ceiling before the file/path-count ceiling; preparation safely refuses before writing. The ADR now states the ASCII qualification. This is not a new integration regression.

The session-store identity fix discussed separately has not landed in the incoming epic and is not supplied by this PR. Native VS Code acceptance, native Windows filesystem behavior and the remaining live-pass checklists are not claimed by these automated checks.

## Verification

- **Checkout:** isolated exact-source checkout. Dependency manifests match the existing installed dependency tree; Jest, TypeScript and webpack resolve this checkout's sources. Local Node was 24.22.1; CI used the repository's Node 18 configuration.
- **Local typecheck:** core host, core webview and extension shell passed.
- **Local affected/integration tests:** **61 suites / 798 tests passed**, including Pinned Context handlers, library, seed, codec/store and UI; Bookmark Recall, paging/identity and Open-at-bookmark behavior; prompt synchronization and architecture boundaries.
- **Independent controls:** **2 suites / 9 tests passed**, counted separately.
- **Local lint:** **0 errors / 1,165 warnings**, matching the existing baseline.
- **Local build:** both webpack bundles and Tailwind sentinel verification passed; the existing three webview size/performance warnings remain.
- **Whitespace:** `git diff --check` passed.
- **Exact-source CI:** [run 42073828579](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42073828579), [verify job 127408589593](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42073828579/job/127408589593), completed successfully. Typechecks, **745 suites / 10,415 tests / 59 snapshots**, lint **0 errors / 1,165 warnings**, both bundles and sentinel verification passed.
- **CI identity:** checkout logs explicitly identify merge candidate `6d1bee4c6ae25a34c9b6aca636e3839e5f3d595f`, combining reviewed source `f8f3d166` with target `78fe28d4`. This is not an earlier-head result.
- The report-only publication will receive a separate CI run; its final result belongs in the PR discussion.
