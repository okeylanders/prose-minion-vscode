# PR #204: Pinned Context format and store review

- Review date: 2026-11-05.
- PR: https://github.com/okeylanders/prose-minion-vscode/pull/204
- Initial reviewed implementation: `182fcd1b4eb2175ee47f9912941546e3c2d2b75f`.
- Latest re-reviewed implementation: `52da65ea1194a1f3620b82e9143f142c682af0c1`.
- Target: `epic-pinned-context`, observed at `94a33df5bb139a679dcd0f7a66bdded9c195f4c4`.
- Contract: Pinned Context ADR D5/D6 and `slice-1-format-and-store.md`.
- **Verdict: changes required.** See the latest re-review below: the original claim-preservation and codec findings are fixed; a narrowed stale-owner race and a recovery size-bound regression remain. This is a review report, not a formal GitHub approval, merge, or production-code change.

## Re-review at `52da65ea` (2026-11-05)

**Current verdict: changes still required.** F-02, F-03 and N-01 are closed by reproduction. F-01's ordinary within-lease race is prevented, but a narrower lease-expiry interleaving still displaces a committed list. A new recovery-path size-bound regression is F-04. The original review below is retained as history.

### F-01 — P2 remaining: a post-check stalled create still takes a successor rewrite's saved name

**Location:** `WorkshopPinnedContextStore.ts:386–397`; `WorkshopPinnedContextLock.ts:82–84`. Severity is reduced from the original P1 because takeover now requires a lease-expiring stall.

The lock check and the committing filesystem operation are separate. The new store comment at lines 55–61 acknowledges a stall after the check but incorrectly says the claim/no-overwrite rules protect it. They protect a standing pathname, not the logical list while another rewrite holds it under a claim.

Reproduced against `52da65ea`, independently twice:

1. A first save passes `stillHeld`, then stalls inside its final staged-file rename, before that rename takes effect.
2. Advance the shared clock past the 30-second lease.
3. Another window takes over and successfully creates the list with Alice.
4. That window starts a rewrite adding Hatter and claims the saved file.
5. Resume the stale create while the saved name is empty. It returns `ok: true` and installs only `late.md`.
6. The legitimate rewrite returns `io`, and Alice's committed active list is displaced.

No injected I/O errors are required. This is an async filesystem operation that completes after a lease takeover, not an extra application-level await added after the check. It recreates the original bad outcome under the stated residual window; it is not merely a spurious retry.

**Required outcome:** fence a stale owner's actual commit, or use a recovery/ownership policy that does not allow a possibly executing owner to overlap its successor's claimed rewrite. Another pre-rename read alone does not close this interval. If the architecture deliberately accepts this residual, document the actual list-displacement consequence and obtain an explicit scope decision rather than claiming it cannot happen.

### F-04 — P2: the new leftovers policy bypasses the file-byte guard

**Location:** `WorkshopPinnedContextStore.ts:153–156` and its call to `claims.settle` before `stat`; `StoredFileClaims.removeLeftovers` reads the standing file and claims through `bytesOf` without a bound.

With a standing `pinned-context.json` one byte over 128 KiB and one abandoned claim, `read()` calls `readFile` on the oversized standing file during claim settlement, before reaching the usual `stat` guard. It eventually returns `unreadable / too-large` and logs that it was not read, but the unbounded read already happened. A very large corrupt or hand-edited list can therefore consume unbounded memory despite this slice's explicit bound. The regression probe asserts that the standing filename never appears in `readFileCalls`; it fails.

**Required outcome:** enforce a size check before the recovery/preservation reads too, preserving bytes conservatively when comparison would exceed a bound. Include oversized standing-file and oversized-claim fixtures. The new lock reader (`WorkshopPinnedContextLock.ts:153`) also reads and parses arbitrary-size lock files without a `stat` bound; bound that auxiliary read while hardening the recovery path.

### Resolved and verification

- **F-02 closed:** the original refused-claim probe now passes after the I/O fault clears and the lease expires; non-identical bytes are retained separately.
- **F-03 and N-01 closed:** the original sigma and C1-control probes both pass. Native Windows checks remain an explicitly documented live-pass item.
- `npm run typecheck`: pass.
- Pinned Context plus shared storage callers: **11 suites / 249 tests passed**, covering Project Memory and Lightbox storage as well as this slice.
- Original fixed-behavior probes: **3 passed** (F-02, F-03, N-01).
- New residual/regression probes: **2 failed**, one per open finding above. A second independent run reproduced both.
- Lint and boundary checks are running at this re-review publication; implementation CI run `41948951894` is also running. The previous implementation and report-only heads had full green CI (694 suites / 9,784 tests / 59 snapshots).

The new evidence is in `docs/pr-reviews/probes/pr-204-pinned-context-rereview-regressions.test.ts.txt`. Copy it to the storage test directory with a `.test.ts` suffix to run it. The original `.txt` evidence remains unchanged. No production code, formal approval or merge was submitted by this review.

## Initial review at `182fcd1b`

## F-01 — P1: A delayed first save can replace the logical list during another window's rewrite

**Location:** `packages/core/src/infrastructure/storage/WorkshopPinnedContextStore.ts:350–368`, especially the unchecked final rename at 367.

`writeNew` validates the absent revision only before staging. Its final no-overwrite rename treats the saved filename being empty as proof that the list is still absent. That name is also empty while `StoredFileRewrite` holds an existing list under its claim.

Deterministic two-window reproduction, with no simulated filesystem errors:

1. Window B reads `absent` and begins pinning `Characters/late.md`; hold its staging write.
2. Window A creates the list with `Characters/alice.md`, successfully.
3. Window A starts adding `Characters/hatter.md`; hold it after it claims the saved file.
4. Resume B. Its no-overwrite rename succeeds because the claimed list's public filename is empty. B returns `ok: true` at the stale absent revision.
5. Resume A. A's legitimate rewrite fails with `io`. The active list is now only `Characters/late.md`; Alice's committed list is displaced to a set-aside file.

This violates D5's revision conflict rule and silently unpins the already committed list from the active configuration. The normal two-create collision test does not cover create-versus-claimed-rewrite.

**Required outcome:** serialize absent creation and existing-file rewrites through the same durable per-list ownership protocol, or otherwise make this interleaving impossible. A stale create must return `changed`/`busy` without taking a live rewrite's saved name. A standalone check before the rename still needs a race argument; do not just move the time-of-check window.

## F-02 — P2: An uncommitted changed claim is later deleted as a committed leftover

**Location:** `WorkshopPinnedContextStore.ts:148–152` (claims configuration), with `StoredFileRewrite.release` and `StoredFileClaims.removeLeftovers`.

The new store uses the default claims policy, which deletes every abandoned claim beside a standing file. A claim can instead contain newer writer bytes that were refused by the rewrite. `release` tries the saved name and one set-aside name, but if those renames fail, the bytes remain under their claim. This store provides no `leftovers` verification/preservation policy, unlike Project Memory.

Deterministic reproduction:

1. Read list A for an update. Before the atomic claim, an external edit changes the file to list B.
2. The rewrite claims B, detects that it differs from the bytes it read, and refuses to commit.
3. A competing list C occupies the saved name. Simulate a temporary rename failure while releasing B to the saved name and fallback.
4. The update returns `changed`, and B is initially retained under its claim.
5. Clear the simulated fault, advance beyond the 30-second lease, and call `read()`.
6. `removeLeftovers` permanently deletes B, although no rewrite incorporating B ever committed.

**Required outcome:** retain or restore an uncommitted/conflicting claim after a failed release. Only remove bytes proven to be an earlier version of a committed write; because this format has no ancestry metadata, conservative preservation is preferable to assuming every old claim is disposable. Test recovery after the I/O fault clears, not just the immediate failed release.

## F-03 — P2: Lowercasing is not the promised Windows filename comparison

**Location:** `packages/core/src/shared/types/workshopPinnedContext.ts:72–74`.

`workshopPinnedContextPathKey` uses `toLowerCase()`. This leaves Greek sigma forms `σ` and `ς` distinct, although a Windows case-insensitive filename comparison treats them as the same uppercase character `Σ`. The codec accepts `Notes/σ.md` and `Notes/ς.md` in one Windows list. The shared key will also be used for room-file matching in Slice 2b, so it can duplicate a pinned file or miss its existing attachment.

**Required outcome:** define and implement the supported Windows filename equivalence, with non-ASCII cases in the test table. Do not assume Unicode full uppercasing or lowercasing exactly matches every Windows filesystem rule.

The decoder acceptance and differing keys were reproduced on Linux with the explicit `windows` parameter. A native Windows filesystem was not available for this review; the native comparison should be included in platform verification.

## N-01 — P3: The documented control-character rule is broader than the validator

`workshopPinnedContextPathFault` rejects C0 and DEL, but accepts C1 controls U+0080–U+009F. For example, `Notes/\u0085.md` is accepted. Either include C1 in the guard or narrow the format's documented promise explicitly. This is a smaller format-contract issue, not the persistence blocker.

## Verification and scope

The runtime source files under `packages/` and `apps/`, their configs, and package lock were materialized for the exact reviewed head and checked against Git blob hashes. Existing installed dependencies matched the unchanged package lock. No production files were edited for the review.

- `npm run typecheck`: **pass**, all three targets.
- Focused production checks: **5 suites / 146 tests passed**, including codec, store, store races, architecture boundaries, and prompt budgets.
- Independent store regressions: **2/2 fail**, demonstrating F-01 and F-02.
- Independent codec edge regressions: **2/2 fail**, demonstrating F-03 and N-01.
- Full production Jest suite: the single-process run was killed by the environment before completion (no test assertion failure reported). Retrying with two workers and a 256 MiB worker recycling threshold; excludes the four deliberately failing review probes.
- Baseline lint: **0 errors / 1,165 warnings**, with review probes excluded; matches the PR baseline.
- Exact-head CI run `41945946775`: in progress at publication. Install and typecheck succeeded; tests running, lint/build not yet completed.
- No native VS Code UI or Windows filesystem execution was performed. This slice changes no UI or composition-root wiring.

The passing supplied tests cover ordinary create/rewrite/revision conflicts, strict malformed-file refusal, maximum entry and byte counts, workspace withdrawal, basic claim recovery, and shutdown. They do not cover the two persistence interleavings above.

## Reproductions

The companion text file `docs/pr-reviews/probes/pr-204-pinned-context-regressions.test.ts.txt` contains the four failing regression tests. To run, copy it to `packages/core/src/__tests__/infrastructure/storage/ReviewPinnedContext204.test.ts`, then run:

```sh
npx jest --runInBand --runTestsByPath packages/core/src/__tests__/infrastructure/storage/ReviewPinnedContext204.test.ts
```

The text suffix keeps deliberately failing review evidence out of the ordinary test/lint pipeline. Fixes should promote the relevant cases into the permanent store/codec suites. Re-review is required against the correction commit, including the full required checks.
