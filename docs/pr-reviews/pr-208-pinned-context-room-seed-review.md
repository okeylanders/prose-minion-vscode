# PR #208 review: Pinned Context room seed

- Reviewed head: `b04290829a44e8e2fd34530bc371110dd3262bb0`.
- Target: `epic-pinned-context`, observed at `24540718158940249511e960b0b5599029dd3ecf`.
- Date: 2026-11-05.
- Verdict: **Changes required.** Four reproducible findings: one high-priority cross-project data leak and three medium-priority identity/reporting defects.
- Scope: Slice 2b's seed, library, file reader, matching, budget/refresh handling, reports, delivery, wiring/shutdown, and integration with the corrected Slice 1 store.
- No production fixes, formal GitHub approval, merge, provider calls or deployment performed.

## Dependency and merge state

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
- A memory-bounded full local suite is running. It also discovered the separately added F01 probe; that intentional review failure must not be mistaken for a pre-existing repository test failure. No full local pass is claimed yet.
- GitHub head checks: none returned at review time; PR reported not mergeable.
- No Extension Development Host/manual visual pass or live provider call was performed.

## Reproduction artifacts

The three linked `.test.ts.txt` artifacts are review evidence, not additions to the normal test suite. To run them, copy each beside `pinnedContextSeedHost.ts` under `packages/core/src/__tests__/application/services/workshop/pinnedContext/`, remove the final `.txt`, and use `npx jest --runInBand --runTestsByPath <paths>`.

Review conclusions apply to the implementation SHA above. Corrections and the integrated merge head require re-review.
