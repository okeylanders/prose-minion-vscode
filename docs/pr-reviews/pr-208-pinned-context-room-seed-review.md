# PR #208 review: Pinned Context room seed

- Original reviewed head: `b04290829a44e8e2fd34530bc371110dd3262bb0`.
- Target: `epic-pinned-context`, observed at `24540718158940249511e960b0b5599029dd3ecf`.
- Date: 2026-11-05.
- Current verdict: **Review clear at `d8de4ebc`. F01–F04 closed.** Original findings and both correction rounds are preserved below.
- Scope: Slice 2b's seed, library, file reader, matching, budget/refresh handling, reports, delivery, wiring/shutdown, and integration with the corrected Slice 1 store.
- No production fixes, formal GitHub approval, merge, provider calls or deployment performed.

## Final correction re-review at `d8de4ebc55c52de6bfeee8a30f887801462354c4`

**Verdict: Review clear. F01–F04 are closed; no remaining confirmed blocker in Slice 2b.** No formal GitHub approval or merge is performed by this review.

### F01 closed, including nested workspaces

The second correction, production commit `0ead5d0e`, binds the actual source rather than checking containment alone:

- A catalog row is eligible only when its absolute path, made relative to the captured root, equals that row's own catalog path. A row from another project, including a nested project, cannot masquerade as A's same-relative-path file.
- Workspace reauthorization must return the exact normalized source path built from the captured root. Live-workspace recovery cannot redirect the seed into B.
- The queued list read remains bound to the captured list file. A mismatched file read withdraws the plan, and `describe()` uses the same coherent-root behavior.
- Exact Unicode catalog selection, unambiguous normalized fallback, POSIX literal-backslash identity, kept-body failure reporting, and the existing intake defenses remain intact.

The original seven expected-behavior witnesses pass unchanged, including both nested-workspace intake paths. The author also promoted the two nested witnesses into the normal suite, changing only formatting for lint. Additional boundary probes reject nested/outside/mislabeled/dot-segment/POSIX-backslash catalog identities before load and confirm exact NFC selection through the real resolver. No further blocker was found.

F02–F04 remain closed as recorded in the earlier correction review below.

### Final verification and limits

- All **1,952** source/test/resource files under `apps/` and `packages/` match this exact head's Git blob hashes.
- `npm run typecheck`: **pass**, core/webview/extension.
- `npm run lint -- --ignore-pattern '**/*.review-probe.test.ts'`: **pass**, 0 errors / 1,165 repository warnings. Temporary independent review probes are excluded from lint.
- Final focused run on this head: **19 suites / 239 tests passed**, including 14 repository boundary/seed/store/shutdown suites plus five independent probe suites.
- Independent second-fix replay: original seven witnesses plus 17 supplied regressions, **24 tests passed**; another **27 path/intake/resolver checks passed**.
- Full local suite on production-identical `74b83e40`: **702 suites / 9,788 tests / 59 snapshots passed** in the main invocation. Three suites were terminated by the environment during the initial concurrent startup, before their assertions ran. An isolated retry passed all three suites and **167 tests**, accounting for all **705 suites / 9,955 tests**. This is not claimed as a single uninterrupted green full run.
- The only later source-tree delta is the promoted nested witness suite (two tests), both verified in the final focused run. Thus the latest repository's **706 suites / 9,957 tests** are covered across the full run, retry and new-suite check.
- Earlier parallel typecheck/lint/probe attempts were also environment-killed; the final sequential typecheck/lint and bounded focused runs above completed successfully.
- [Corrected implementation CI at `74b83e40`](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41958238445/job/127018164702) passed. Newer test/report-only heads must retain green exact-head CI before merge; that status is followed on the PR.
- No native Windows-host run, Extension Development Host/manual visual pass, live provider call or deployment was performed. The epic's remaining live acceptance checklist is unchanged.

The target remains `epic-pinned-context`. #208 carries #204's corrected production dependency; #204 was still open at final review, so retain the epic's declared #204-before-#208 merge order. A review-clear verdict is not a formal approval, merge or waiver of the final-head CI gate.

All earlier sections are preserved below as review history, not current open findings.

## Correction re-review at `d8b8d2a4ee1f75b22f7dfc9c6092621f3af1e059`

**Verdict: Changes required. F02, F03 and F04 are closed; F01 remains open for nested workspace roots.** The original five probes pass unchanged, but containment is not the same as source identity.

### F01 remains open · High · A nested workspace still supplies the wrong project's bytes

**Locations:** `WorkshopPinnedContextFileReader.ts:182–194,269–280`.

Both new guards check only `isPathWithinRoot(capturedRoot, returnedPath)`. If project B is a folder inside project A, a path from B passes that guard even though it is not the file A's pinned relative path names.

Two independent, repeated probes use A=`/workspace/novel`, B=`/workspace/novel/other-project`, and A's pinned `Characters/alice.md`. Immediately after A's list is read, the workspace switches to B. One probe opens B's catalog; the other uses an empty catalog and the real intake service's workspace-relative recovery. In both cases the reader loads `/workspace/novel/other-project/Characters/alice.md`, then the fixture returns the workspace to A as the file read settles. Installation attaches:

- body: `Private facts from project B.`;
- URI: `file:///workspace/novel/other-project/Characters/alice.md`;
- relative path: `Characters/alice.md`;
- result: one file attached, no left-out entry.

The scope reports `workspace-changed` throughout the B interval. A's own `Characters/alice.md` exists with different text. This is not a legitimate A pin to `other-project/Characters/alice.md`: the source has been reinterpreted against B. The tests assert that B's file is not even read, and both fail.

**Required correction:** bind catalog provenance and authorized source identity to the captured root plus the resolved relative path. A catalog row's absolute path must identify that row under A, not merely fall somewhere below A. The workspace reauthorization result must identify A's requested source rather than a recovered same-relative-path file under B. Keep exact spelling and unambiguous normalized-catalog fallback behavior, and retain the existing containment/symlink defenses.

Probe: [nested workspace, both intake doors](probes/pr-208-nested-workspace-binding.test.ts.txt). These two cases must pass alongside the original disjoint-root and held-read cases before closing F01.

### Closed findings and verification

- **F02 closed:** separator conversion is now Windows-only. The unchanged POSIX literal-backslash probe passes.
- **F03 closed:** exact catalog paths win; multiple distinct normalized fallback paths are refused. The unchanged NFC/NFD probe and new ambiguity/control cases pass.
- **F04 closed:** all read outcomes retain root-derived source URIs. Missing and unreadable older-display-path aliases correctly report their retained body as kept.
- The additive `store.read({ filePath })` guard correctly refuses a different list at its queued turn. The remaining issue is the later source resolution, not that queue guard.
- All 1,948 `apps/` and `packages/` files were checked against this head's Git blob hashes before probing.
- Typecheck passes across all three projects. Lint passes: 0 errors / 1,165 warnings with temporary review probes excluded (the initial inclusive invocation added five probe-only warnings).
- Focused repository verification: **13 suites / 221 tests passed**.
- Original independent probes plus the 13 supplied correction regressions: **4 suites / 18 tests passed**, independently replayed.
- New nested-root probes: **2 failed**, repeated independently with the real intake authorization paths.
- This exact correction head's [verify CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41956757879/job/127013403803) passed. The earlier complete local baseline run is recorded below; no new full local run is claimed for the correction.
- No production edits, formal approval or merge performed.

After this re-review, `c70695f5` merged the already reviewed Project Memory #206/#207 changes. The compare contains no change to the affected pinned-context source, so the remaining F01 finding still applies. Exact integrated-head checks remain a gate.

The original review and integration record follow for audit history.

## Integration and full-suite update

At `356831da0e4754e91364c04079a94ba6fe714515`, the branch merged the updated epic base. The merge changes documentation only relative to the review-report commit; the production code and all four findings are unchanged. GitHub now reports the PR mergeable/clean, and its [verify check](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41955155333/job/127008187550) passed. These gates do not resolve the behavioral findings.

The complete local run finished: **702 repository suites, 9,913 tests and 59 snapshots passed**. The only failure among the 703 discovered suites was the deliberately added F01 cross-workspace review probe. All five focused independent probes remain reproducible failures as documented below. Verdict remains **Changes required**.

## Dependency and initial merge state

This head carries #204's corrected production commit `92acb2207b5008ea318859b95fd870831e5e9417`. The later #204 head `fea75aa3` differs by its final review-report commit, not a missing production fix. The #203 workspace-promotion guards are also present.

GitHub reported this PR **not mergeable** and returned **no check runs** for `b0429082` during review. Resolve the stacked integration/base conflict and verify the resulting exact head after #204 lands. The local checks below are not a substitute for that integration gate.

## F01 · High · Bind every seed read to the workspace captured by preparation

**Locations:** `WorkshopPinnedContextLibrary.ts:178–208`; `WorkshopPinnedContextRoomSeed.ts:82–103,117–125`.

`prepare` captures an accepted identity for project A, but does not pass that identity or its root into `readForSeed`. The store's `read()` chooses its location at its queued turn, and the library then calls live `availability()` again for the file root. Catalog and intake authorization also follow live workspace state. The final `ask.still()` only compares the endpoints.

**Reproduction:** start `prepare('new')` in A, switch to B before the store's queued read, let the real store/intake/library read B's list and `Private/queen.md`, then switch back to A as that read settles. The scope correctly reports `workspace-changed` while B is active. Nevertheless, install accepts the plan in A and attaches:

- source: `file:///workspace/other/Private/queen.md`;
- content: `Private facts from project B.`;
- report: one pinned file, one attached, no left-out entries.

The independent expected-behavior test fails. This can feed another project's private text into A's next model request. #203's coordinator guards do not prevent it: the workspace is A again before installation/promotion.

**Required correction:** bind the list read, catalog, containment authorization and file reads to the identity/root captured when the seed is requested. Never reinterpret a queued operation under another workspace. Detect or refuse mismatched read provenance even if the workspace returns to A; endpoint equality alone cannot prove where a plan's bytes came from. Apply the same coherent-root discipline to `describe()`, which uses the same split list/root read shape.

Regression coverage must exercise A→B→A while the list is queued and while catalog/file reads are held, not only a switch that remains in B at install.

Probe: [workspace binding](probes/pr-208-workspace-binding.test.ts.txt).

## F02 · Medium · Do not treat a literal POSIX backslash as a directory separator

**Location:** `shared/constants/workshopPinnedContext.ts:25–26`, consumed by `WorkshopPinnedContextRoomSeed.carried`.

`attachmentPathKey` replaces every backslash with `/`, including when `platform === 'posix'`. On POSIX a backslash is a legal filename character. The ordinary file-picker attach path preserves it, even though such a name cannot itself be pinned through the strict pinned-list codec.

**Reproduction:** carry the unpinned file `Characters\\alice.md`, with URI `file:///workspace/novel/Characters%5Calice.md` and body `The unrelated Alice notes.`. Separately pin `Characters/alice.md` with body `Alice is nine.`, then start New.

The matcher says these distinct files are the same. The seed refreshes the carried slot instead of adding the pinned file: the room has one attachment, retains the old label, but now has the pinned file's body and URI. The unrelated carried context is lost. This violates the promise to leave unpinned carried attachments untouched.

**Required correction:** make separator normalization platform/source-aware. Preserve literal POSIX names. If Windows-session portability is needed, distinguish that provenance rather than treating every POSIX backslash as a Windows separator.

Probe: [seed identity, third case](probes/pr-208-seed-identity.test.ts.txt).

## F03 · Medium · Prefer the exact pinned catalog path over the first normalized collision

**Location:** `WorkshopPinnedContextFileReader.ts:131–141`.

The reader builds a map keyed by NFC-normalized path and keeps the first catalog row. On a POSIX filesystem, composed and decomposed filenames can coexist. If the decomposed row appears first, pinning the existing composed filename reads the other file.

**Reproduction:** create both `Characters/cafe\\u0301.md` and `Characters/caf\\u00e9.md` with different bodies, list the decomposed one first, and pin only the exact composed name. The seed attaches the decomposed file's content and source URI while its label is derived from the composed pinned entry. The independent test fails on both body and relative path.

This finding does **not** ask to change Slice 1's deliberate conservative duplicate-rejection policy. Refusing two canonical-equivalent entries in a list is different from arbitrarily selecting the wrong existing file for a single stored path.

**Required correction:** prefer an exact catalog-path match before normalized fallback. If fallback has multiple distinct candidates, reject the ambiguity or prove which source the stored path names; do not pick catalog order. Keep equivalent-spelling compatibility where the source is unambiguous.

Probe: [exact catalog identity](probes/pr-208-unicode-catalog.test.ts.txt).

## F04 · Medium · Preserve carried-source identity when a re-read fails

**Location:** `WorkshopPinnedContextRoomSeed.ts:164–169,184–195`; failure variants in `WorkshopPinnedContextFileReader.ts`.

The seed intentionally recognizes a carried copy by `sourceUri` even when its older display path does not match the pinned entry. But that fallback reads `file.input`, which exists only for a successful read. A missing or unreadable result loses the same source identity and is reported as not attached instead of kept.

**Reproduction:** use the same supported older-display-path case as the PR's successful alias regression: carry `Characters/alice.md` by its correct URI, with `relativePath: 'External file: alice.md'`. Pin that file and make the next read missing or whitespace-only. In both cases the room still carries `Alice is seven.`, but `leftOut` lacks `kept: true`; the result says `not attached`. Both expected-behavior probes fail.

The stale body remains prompt-bearing. A result claiming it is not attached hides that important fact from the writer and defeats the new kept-body reporting promise.

**Required correction:** retain independently derived canonical source identity on failed reads too, and use it to find carried copies. Do not invent a successful body or relax containment. Missing/unreadable aliases must be reported as kept whenever that old body remains in the room.

Probe: [seed identity, first two cases](probes/pr-208-seed-identity.test.ts.txt).

## Verified behavior and architecture

- First/New/full-reset seed; empty/Open/Duplicate/Branch/Rewind/hydrate do not.
- Preparation turns file/list failures into reports instead of rejecting.
- Successful re-read keeps the carried slot; regular missing/unreadable/over-budget matches retain their old body and receive kept wording.
- A large file that cannot fit is skipped and later smaller files are tried. Budget checks exclude the replaced slot's old words; aggregate checks remain authoritative.
- Failed room promotion restores the prior room/checkpoint.
- Initial attachments arrive as one ordinary replace frame in pinned order; the system message stays unchanged; Project Memory's frame remains last.
- Store/library/seed construction stays in the composition root. Pinned store shutdown is drained.
- The seed's report/privacy tests cover category/count logging rather than file labels.
- No production coordinator/session-service growth in Slice 2b.

Known integration items explicitly deferred by this slice, not additional findings here: Slice 3 supplies the real menu count and confirmation copy, exposes/posts the held first-room report, and completes the settings-tab paths. The epic's manual Slice 5 verification remains outstanding.

## Verification

Exact source/test files under `packages/` and `apps/`, relevant epic docs and `.ai/` were checked against the reviewed head's Git blob hashes. Local runtime: Node 24.22.1 with existing lockfile-compatible dependencies.

- `npm run typecheck`: **pass** across core, webview and extension.
- `npm run lint`: **pass**, 0 errors / 1,165 warnings, matching baseline.
- Focused repository tests for pinned context, seed calls/workspace guards, start reports and extension shutdown: **12 suites / 204 tests passed**.
- Independent expected-behavior probes: **5 failed** (F01 one, F02 one, F03 one, F04 two). Observed output confirms the cross-project attachment and the unrelated POSIX slot replacement.
- Memory-bounded full local suite: **702 repository suites / 9,913 tests / 59 snapshots passed**. The one additional discovered F01 review probe failed as expected (overall invocation: 703 suites, 9,914 tests).
- GitHub: initial reviewed implementation had no checks because of the integration conflict. The later documentation-only epic merge `356831da` passed `verify` and is mergeable/clean; findings remain open.
- No Extension Development Host/manual visual pass or live provider call was performed.

## Reproduction artifacts

The three linked `.test.ts.txt` artifacts are review evidence, not additions to the normal test suite. To run them, copy each beside `pinnedContextSeedHost.ts` under `packages/core/src/__tests__/application/services/workshop/pinnedContext/`, remove the final `.txt`, and use `npx jest --runInBand --runTestsByPath <paths>`.

Review conclusions apply to the implementation SHA above. Corrections and the integrated merge head require re-review.
