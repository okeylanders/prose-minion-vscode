# PR #194 review: Project Memory Slice 1, store and format 1

**Verdict: implementation ready for merge into `epic/workshop-project-memory`, subject to the current head's required CI. All reproduced findings are closed; no remaining actionable blocker was found.**

**PR:** [#194](https://github.com/okeylanders/prose-minion-vscode/pull/194)  
**Re-reviewed:** 2026-11-04  
**Current reviewed implementation:** `798d32f9a2f8e3eea0fb8f631d3f54379136191a`  
**Target branch:** `epic/workshop-project-memory`  
**Base reported by PR API:** `8fb016fa3e767964fe8c53c778d6453f8507667d`  
**Previous passing CI merge (eba4fc8b, not the current implementation):** `af39fd0256f9fdecf69bdc202f03b8c7be22683d`, combining reviewed head with target `9ba38154e883c2b29dce3d5455fef45b8271f80e` according to checkout logs  
**Initial reviewed implementation:** `5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7`  
**Initial CI merge:** `886b58446264d0a0107db90d6fb480dba8bde052`  
**Current spec checked:** merged [PR #192](https://github.com/okeylanders/prose-minion-vscode/pull/192), head `daa7859302a5a3e3cca296ccecbe222c112736e2`

This is a branch review report, not a formal GitHub approval or authorization to merge. #192 has merged and its ADR records the writer's decisions on all six questions. The earlier dependency/question gate is therefore no longer an open gate in this review; all reproduced implementation findings are now independently closed. Required CI for the current head remains the merge gate.

## Independent closure review at 798d32f9

The `3fc18e9` correction adds a memory-specific leftover predicate to the shared claim lifecycle. Cleanup and delete-retirement now remove a claim only when it decodes as the same memory ID as the standing/deleting file. Different-ID and unreadable bytes are restored to a free ordinary filename, or retained when restoration is blocked. The unconfigured Lightbox cleanup policy is unchanged.

**F-02 is independently closed.** The prior transient-release-failure witness now preserves both memories after the lock clears and lease recovery runs. This closes the final reproduced blocker; F-01, F-03, F-04, F-05, F-06, N-01 and N-02 retain their prior closure status.

### Closure verification

Executed exact-head production modules with the repository's in-memory filesystem fixture, including independent actual-store and claim-lifecycle probes:

- Original occupied-name collision and transient release lock: both memory IDs survive; refused bytes move to a free ordinary file.
- Persistent rename lock: refused bytes remain byte-identical across 31 seconds and a full day, with a `set-aside` row while beside the occupant.
- Fresh-store recovery works after unlocking. A fresh store cannot delete the occupant while restoration is blocked; it returns `failed` and preserves both copies.
- After unlocking, deleting the occupant preserves the unrelated refused bytes separately.
- The same preservation and deletion controls pass for invalid UTF-8/unreadable bytes.
- Multiple abandoned claims without a standing file recover distinct IDs and unreadable content without loss; newest takes the saved name.
- Genuine same-ID rewrite leftovers still clean up, including during deletion.
- The shared default policy without a leftover predicate retains prior Lightbox settling and retirement behavior.
- Prior codec/size witnesses and the 36 focused codec/domain assertion groups plus all 4,096 four-node graph comparisons still pass. The F-06 overlap witness remains corrected under its stated timestamp ordering policy.

**CI:** [run 41880864217](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41880864217) for `798d32f9` was queued at publication. The last completed implementation CI at `eba4fc8b` passed **640 suites / 9,112 tests / 59 snapshots**, typechecks, lint and builds; it is historical evidence, not a substitute for the current checks. This report-only publication also requires its own branch-head CI.

Full local Jest, native VS Code and live-provider testing are not claimed. The previously documented equal-timestamp/clock-skew ordering limitation remains nonblocking and unchanged.

## Re-review at eba4fc8b (history)

The following review and author correction notes are retained as history. The independent closure above supersedes their open/closed wording.


**Current status:** F-01, F-03, F-04, F-05, F-06 and N-01 are closed. N-02 now follows the requested newest-claim ordering policy. F-02 remains open only for preservation after failed release attempts.

### F-02 remains open, P2: a transient release failure must not turn a refused delete into later data loss

**Location:** [StoredFileClaims.ts:265–272](https://github.com/okeylanders/prose-minion-vscode/blob/eba4fc8b8d5ea4cd1e75428ffcb657edbb4da5d4/packages/core/src/infrastructure/storage/StoredFileClaims.ts#L265-L272).

The original occupied-path reproduction is now fixed: `0909c1c` restores the refused bytes to a free fallback filename. That control survives a subsequent lease-settling listing.

However, `releaseRefused` still leaves an ordinary, purgeable claim if its immediate attempts fail. The catch treats all filesystem errors as name collisions. This does not require four competing writers to steal successive names: one temporary source-file lock can make the rename attempts fail with `EPERM`. After the lock clears, a later listing sees the standing occupant and deletes the refused claim as an earlier committed version.

**Exact-source actual-store reproduction:**

1. Repeat the prior occupied-path case: the delete requested `mem-000001`, actually claimed `mem-abcdef`, and `mem-fedcba` now occupies its saved pathname.
2. Make claim-to-file release renames fail with `EPERM` while a temporary lock is held. The original name and three immediate fallbacks are attempted, then the delete returns `{ kind: 'changed' }`. The refused bytes remain in the claim.
3. Clear the lock, advance the injected clock by 31 seconds, and call `list()`.
4. Only `mem-fedcba` survives. The log's “kept under its claim” copy has been deleted by normal leftover cleanup.

The same harness without the transient failure preserves both memories. An independent claim-layer probe also reproduced loss with the original name occupied and only the three fallback moves locked. This is still the F-02 preservation defect, narrowed to unsuccessful release, rather than a new unrelated requirement.

**Required correction:** give uncommitted/refused claim bytes a durable preservation or recovery distinction that prevents ordinary rewrite-leftover cleanup from deleting them. Merely increasing the synchronous retry count does not provide that distinction. Include a regression where release fails temporarily, service recovers, and a subsequent listing or another store's recovery preserves the refused bytes beside the occupant.

### F-06 closed against the requested ordering policy

`daf4668` sorts claims by descending timestamp, with the same deterministic filename tie-break as recovery. The original real-store overlapping-successful-rewrite reproduction now returns `Latest committed summary`, `pinned: true`; both writes succeed. The author added overlap, directory-order and equal-timestamp ordering regressions.

**Residual limitation, not a new blocker:** a filename tie-break is deterministic but does not establish chronological order for two operations within one millisecond, or across skewed clocks. An equal-millisecond overlap with a lexically greater older claim can still select that older version. This is inherited from the existing recovery ordering policy and is outside the narrower F-06 correction requested here; avoid treating the sorting rule as a total guarantee of real-time recency.

### Verification at eba4fc8b

- [CI run 41874821296, verify job](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41874821296/job/126731265608) passed **640 suites / 9,112 tests / 59 snapshots**, typechecks, lint and builds. Lint: **0 errors / 1,156 warnings**.
- Independently executed exact-source store and claim-layer controls plus the transient-release-failure witness. The original collision is fixed; unsuccessful release still loses data.
- Replayed the original F-06 no-failure overlap witness against this head: corrected. Standing/held duplicate-ID conflict behavior remains correct.
- Full local Jest and native/live-provider testing remain unavailable and are not claimed. CI totals are observed from the job logs.
- This report's publication is report-only; the ensuing head has its own required CI.

## Author resolution ledger after the second correction

| ID | Priority | Status |
|---|---|---|
| F-02 | P2 | Fixed in `3fc18e9`: a claim beside a standing memory is removed only when its bytes are that memory's earlier version (same id, both readable), by settling and by a delete's retirement alike (`StoredFileClaims` `leftovers` check, which only memory sets). Any other bytes are restored under a free ordinary name, or kept when they cannot be, whatever their age, and the listing shows them as a `set-aside` row until then. The review's EPERM steps are regressions: recovered by the same store, by another store, and never recovered (bytes survive and are shown, and a delete of the occupant fails rather than take them). Lightbox unchanged, its tests unedited. |
| F-01, F-03, F-04, F-05, F-06, N-01, N-02 | | Closed at `eba4fc8b` (above). |

## Prior re-review at b8846c46 (history)

The following section records the preceding review and the subsequent author's correction ledger. The current status above supersedes its open/closed wording.


The seven corrective commits and subsequent documentation update were inspected against the original report. F-01, F-03, F-04 and F-05 are independently verified fixed. The original simple F-02 substitution cases now return `changed` and restore bytes, but the collision case below still loses the rejected file. N-01's cycle handling is verified. N-02 now retains metadata and detects duplicate IDs across standing and held rows, but its new claim-selection path introduces F-06.

### F-02 remains open, P2: preserve rejected delete bytes when the saved name is occupied

**Location:** [StoredFileClaims.ts:220–224](https://github.com/okeylanders/prose-minion-vscode/blob/b8846c46c78e7daabcb79d6107e22174c676fd75/packages/core/src/infrastructure/storage/StoredFileClaims.ts#L220-L224).

The new verification correctly refuses claimed bytes that do not match the requested memory. Its release only attempts the original saved pathname. If another file now occupies that name, the refusal returns `changed` but leaves the rejected bytes under an ordinary claim filename. After the lease expires, `settleFolder` treats that claim beside a standing file as a committed rewrite's old version and deletes it. The log promises recovery, but the actual recovery deletes the data.

**Exact-source store reproduction:**

1. Create `mem-000001`.
2. Between its delete lookup and claim rename, substitute a readable `mem-abcdef` at that pathname.
3. After the claim rename but before rejection can restore it, put `mem-fedcba` at the original pathname.
4. `delete('mem-000001')` returns `{ kind: 'changed' }`; the refused `mem-abcdef` remains in the claim.
5. Advance the injected clock by 31 seconds and call `list()`. Only `mem-fedcba` remains: `mem-abcdef` has been permanently removed.

The control with no occupant at the original pathname preserves `mem-abcdef`, confirming the added verification works but its collision recovery is incomplete. This is a continuation of F-02, not a failure of the new identity predicate itself.

**Required correction:** release rejected claims through a collision-safe fallback and ensure any unresolved rejected claim cannot be purged as a committed-rewrite leftover. Cover both another valid ID and unreadable claimed bytes, with an occupied saved name, through a subsequent lease-settling read. The shared rewrite release already illustrates why a fallback is needed.

### F-06, P2: use the newest claim for a busy memory's metadata

**Location:** [ProjectMemoryFiles.ts:111–118](https://github.com/okeylanders/prose-minion-vscode/blob/b8846c46c78e7daabcb79d6107e22174c676fd75/packages/core/src/infrastructure/storage/ProjectMemoryFiles.ts#L111-L118), specifically line 116.

`heldClaims` selects the first directory entry for each saved filename. More than one claim can exist during ordinary successful asynchronous rewrites: a previous committed rewrite may still be deleting its old claim when the next window claims the current file. Directory enumeration order does not identify the current version. The observer can therefore publish older summary, pin and body data as the live busy memory, undoing the continuity guarantee N-02 was meant to supply.

**Exact-source, real-store reproduction with no filesystem failure:**

1. Start with summary `A summary`, `pinned: false`.
2. Window A rewrites it to `Latest committed summary`, `pinned: true`. Allow the new file to commit, but hold the asynchronous deletion of its old claim pending.
3. Advance the injected clock by 1 ms. Window B starts another rewrite of the current file, changing status to archived.
4. While B owns its newer claim and has not committed, a third store lists the folder.
5. The busy row reports `A summary` and `pinned: false`, rather than the latest committed metadata. Both writes subsequently return `replaced`.

A separate reproduction using a failed old-claim cleanup produces the same result. Neither case depends on manually creating otherwise impossible claim state. Duplicate IDs between a standing file and a held file are correctly conflict-filtered in the revised code and are not an additional finding.

**Required correction:** choose the newest claim for each absent saved filename, with a deterministic timestamp tie-break consistent with recovery, rather than the first directory entry. Test overlapping successful rewrites with delayed cleanup, reversed directory order, and equal timestamps.

### Re-review verification

- [CI run 41870246498, verify job](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41870246498/job/126715028825) completed successfully: **640 suites / 9,105 tests / 59 snapshots**, all three typechecks, lint, both builds and bundle verification. Lint reported **0 errors / 1,156 warnings**. The checkout log identifies the exact integration merge recorded above.
- Exact-head production TypeScript was executed in Node with the repository's in-memory filesystem fixture. Original F-01–F-05 witnesses were replayed; their original simple failure cases no longer reproduce.
- Independent actual-store probes reproduced the remaining F-02 recovery collision and F-06 overlapping-rewrite cases above, including controls.
- Codec/domain checks passed **36 focused assertion groups**, including scalar/control/list injection, immutable metadata, line endings/body bounds and turn-number bounds. Cycle handling matched a transitive-closure reference for **all 4,096 directed four-node graphs**.
- The full Jest suite was not run locally because the review workspace lacked dependencies. Full-suite totals above are observed GitHub CI results, not a claim of a local run. No native VS Code or live-provider testing is claimed.
- The report-only commit containing this update needs its own required CI; this result applies to the implementation head and integration merge specified above.

## Earlier resolution ledger, with author correction notes

| ID | Priority | Independent status at b8846c46 |
|---|---|---|
| F-01 | P2 | Verified fixed by pre-serialization validation and decoded-memory equality. |
| F-02 | P2 | Fixed in `0909c1c`: refused claimed bytes go back under the saved name, else a free fallback name (`StoredFileDeleteCheck.fallbackPath`), as an ordinary file, never left under a claim to be purged; the re-review's steps (another id, and unreadable bytes, with the saved name occupied, then a listing 31 seconds on) are regressions. Lightbox passes no check. |
| F-03 | P2 | Verified fixed for uppercase/mixed-case Markdown claim detection and recovery. |
| F-04 | P2 | Verified fixed by memory-safe error categories throughout create, rewrite and delete. |
| F-05 | P2 | Verified fixed by write byte limit and bounded source-turn fields. |
| F-06 | P2 | Fixed in `daf4668`: of several claims of one saved name, the newest by its time is read, ties broken as recovery breaks them (the greater claim name); the re-review's overlapping rewrites through three stores, and both directory orders at different and equal times, are regressions. |
| N-01 | P3 | Verified addressed for cyclic supersession links. |
| N-02 | Spec/API | Fixed with F-06 in `daf4668`: the busy row is the newest claim's version. |

## Initial review and author correction history

The sections below retain the initial findings at `5008f071` and the author's correction ledger at `b8846c46`. Statements of “Fixed” in that historical author ledger describe the submitted corrections, not independent closure; the current verdict and ledger above supersede them.

## Author correction ledger

| ID | Priority | Finding | Status |
|---|---|---|---|
| F-01 | P2 | Frontmatter interpolation bypasses field and immutable-metadata checks | Fixed in `ae95975`: `prepareProjectMemoryFile` refuses a non-string, a line break or a control character in any field (a comma in a list entry) before interpolation, then requires the decoded file to be the very memory meant; the review's string is a create and replace regression with no file change |
| F-02 | P2 | Delete can remove a different or unreadable file substituted after ID lookup | Fixed in `4d836d9`: `deleteClaimed` takes a `verify` that reads the claimed bytes before anything goes; memory's requires them to read with the same id, else they are put back and the delete answers `changed`; race tests for another id and unreadable bytes |
| F-03 | P2 | Uppercase Markdown claims are invisible to busy detection and recovery | Fixed in `2728e6c`: `PROJECT_MEMORY_CLAIM` matches the extension in any case, as `isMemoryFileName` does; busy, put-back and retirement tested for `note.MD` and `Mixed.Md` |
| F-04 | P2 | Filesystem error messages leak title-derived paths into logs | Fixed in `6f320b6`: a `formatError` hook on `StoredFileClaims` (used by the shared rewrite); memory logs `fileSystemErrorCategory` (a code, never a message) in its own lines too; the Lightbox keeps its messages; path-bearing errors tested in create, rewrite and delete |
| F-05 | P2 | A successful write can immediately be unreadable under the byte limit | Fixed in `c898333`: the encoded bytes are held to `PROJECT_MEMORY_FILE_BYTES` before create or replace stages anything (`file-too-large`), and turn ids' digit runs are bounded (9 and 16); the review's turn is refused with no write, and a memory at every bound round-trips |
| N-01 | P3, before Slice 2 | Supersession helper does not honor the ADR's cycle rule | Fixed in `7824c22`: `supersededProjectMemoryIds` takes each memory's id and supersedes nothing on a cycle; A↔B and A→B→C→A tested |
| N-02 | Spec/API reconciliation | Busy listing omits metadata that D10 says the catalog retains | Fixed in `5f92624` (coordinator's decision, keep the metadata): a memory under a live claim stays in `memories`, read from the claim's bytes, `busy: true`; `read` still answers busy; an unreadable claim is an unreadable row |

## F-01: P2: validate scalar fields before serializing frontmatter

**Location:** [ProjectMemoryCodec.ts:157–158](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryCodec.ts#L157-L158). Related validation: [ProjectMemoryStore.ts:227–234](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryStore.ts#L227-L234).

The encoder interpolates field strings without rejecting line breaks. A title containing the remaining required headers followed by a closing frontmatter fence serializes into a different valid memory. The store checks that the serialized result decodes, but that does not establish that it represents the supplied object. Its immutable `id`/`created` check runs before serialization.

**Reproduction:** create an ordinary proposed memory, then call `replace` with a callback changing only `title` to this string:

```text
Hello
kind: canon
summary: changed
status: active
pinned: true
created: 2000-01-01T00:00:00Z
updated: 2000-01-01T00:00:00Z
origin: writer
---
```

The actual store returned `replaced`. The stored title became `Hello`, creation time changed from `2026-11-04T09:30:00Z` to `2000-01-01T00:00:00Z`, pinning became true, origin changed from `proposed` to `writer`, and source turns became empty. The genuine later headers were moved into the body. The same serialization boundary is used by create.

**Required correction:** validate the original scalar fields, including CR/LF rejection, before interpolation. Recheck identity/immutable metadata on the decoded result rather than relying only on decode success. Add create and replace regressions showing injected multiline fields are rejected without a file change.

## F-02: P2: revalidate the claimed file before deleting it

**Location:** [ProjectMemoryStore.ts:278–282](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryStore.ts#L278-L282).

`delete(id)` resolves the ID through a listing, then passes the path to `deleteClaimed`. The latter claims and deletes whatever now occupies that path; it never compares or decodes the claimed bytes. Unlike a rewrite, this operation does not confirm that it still owns the memory the caller requested.

An external edit, replacement or rename between lookup and claim can therefore cause deletion of a different ID, or of content the store can no longer read. That violates identity-by-frontmatter and the rule that unreadable files are never deleted.

**Reproduction:** create `mem-000001`; immediately before the deletion's source-to-claim rename, substitute a valid memory with ID `mem-abcdef` at the same path. `delete('mem-000001')` returns `deleted`, and the replacement memory is gone. This was exercised through the actual store and filesystem test double.

**Required correction:** validate the claimed bytes against the read/identity before retiring leftovers or removing the claim. If the file changed, release safely and retry or refuse. Add a race test for a different ID and another for newly unreadable bytes.

This is a new memory-store integration defect, not a claim that the mechanical Lightbox extraction changed its prior behavior.

## F-03: P2: recognize claims for uppercase Markdown extensions

**Location:** [ProjectMemoryFiles.ts:40](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryFiles.ts#L40). File eligibility: [lines 147–149](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryFiles.ts#L147-L149).

`isMemoryFileName` accepts `.MD` case-insensitively, while `PROJECT_MEMORY_CLAIM` recognizes only lowercase `.md`. An eligible writer-renamed `note.MD` becomes `.note.MD.claim-...` during a rewrite or delete, but that claim is invisible to busy detection and lease recovery.

**Reproduction using the production claim implementation and exact regex:**

| Saved file | During live claim | After 31 seconds |
|---|---|---|
| `note.md` | `busy` | Restored to its saved filename |
| `note.MD` | `absent` | `settleFolder` returns false; hidden claim remains |

An interrupted operation can leave the only copy hidden indefinitely.

**Required correction:** make claim matching consistent with accepted Markdown filename casing. Cover live busy detection, abandoned recovery, and retirement for uppercase/mixed-case extensions.

## F-04: P2: keep paths out of memory failure logs

**Location:** [ProjectMemoryStore.ts:350–351](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryStore.ts#L350-L351). The same issue applies to the shared rewrite/delete failure paths using `storedFileErrorMessage`.

The memory-specific `logName` callback hides explicit filenames, but raw filesystem error messages bypass it. Those messages commonly include the affected path; the memory filename contains the title's slug.

**Reproduction:** have the staging write reject with a representative ENOSPC error containing its target path. Saving a draft titled `Alice private plot twist` logs:

```text
[ProjectMemoryStore] Could not stage a new memory: ENOSPC: no space left on device, open '/workspace/prose-minion/memory/.alice-private-plot-twist-000001.md.tmp-2'
```

This violates the explicit D10 contract that logs contain IDs, counts and reasons, not title/body/summary text.

**Required correction:** use a memory-safe formatter or configured error-redaction hook that preserves a bounded error category while omitting paths and arbitrary provider text. Test realistic path-bearing errors in create, rewrite and delete. Preserve Lightbox's behavior separately where required.

## F-05: P2: enforce the byte ceiling before both write paths

**Location:** [ProjectMemoryStore.ts:182–189](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryStore.ts#L182-L189); replace has the same issue at [230–244](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/infrastructure/storage/ProjectMemoryStore.ts#L230-L244).

The write check only calls `decodeProjectMemory`. The 256-KiB file limit is enforced later by folder reading, not by the codec or the write path. Source-turn IDs accept arbitrarily long digit sequences, so the field-count bounds do not bound serialized bytes.

**Reproduction:** use one source turn of `turn-` + 270,000 digits + `-assistant-1` in an otherwise ordinary proposed draft. The actual store returns `created`. Its next `list()` returns no readable memory and an unreadable entry with reason `too-large`.

This requires abnormal input, but the current validators accept it and the successful-save contract is false.

**Required correction:** check encoded byte length against `PROJECT_MEMORY_FILE_BYTES` before create and replace stage anything, and/or introduce sufficient identifier bounds. Retain an aggregate byte check so future fields cannot reopen the mismatch. Regression tests should show rejection without a write and normal boundary-sized roundtrips.

## Spec/API points to settle before dependent slices

### N-01: P3: supersession cycles

[projectMemory.ts:105–107](https://github.com/okeylanders/prose-minion-vscode/blob/5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7/packages/core/src/shared/types/projectMemory.ts#L105-L107) returns the union of all `supersedes` targets. An A-to-B / B-to-A cycle returns both IDs, although D4 says neither is superseded in a cycle. The helper's input type omits each memory's own ID, so it cannot implement that rule. There is no production consumer in this slice. Correct or explicitly defer this operation before Slice 2 uses it to filter the catalog; do not silently rely on the present result as final domain semantics.

### N-02: busy listing metadata

D10 says a live claim's bytes keep the memory listed and in the catalog while direct read answers `busy`. The implemented listing's busy rows carry only a filename and optional ID, and omit the memory from `memories`. Reconcile that contract before the catalog is built: either retain the necessary metadata in the store result or explicitly change the ADR's guarantee.

At the initial review, #192 and six design decisions were outstanding. That historical gate was resolved before the independent re-review above.

## Shared Lightbox extraction

The extracted claim lifecycle and stage/claim/commit logic were compared with the prior Lightbox implementation. No introduced Lightbox regression was found in ownership, lease recovery, leftover retirement, rewrite release, fallback naming, commit order or staging-ID order. The neutral modules introduce no Lightbox/ProjectMemory imports, and the existing Lightbox tests were not changed. The findings above concern the new memory caller and codec contracts.

## Initial verification

- [CI run 41834996816](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41834996816/job/126591488785) passed core/webview/extension typechecks, **639 suites / 9,071 tests / 59 snapshots**, lint, both production builds and bundle verification.
- CI lint: **0 errors / 1,153 warnings**.
- Exact-head TypeScript modules were transpiled and executed in Node with an in-memory filesystem. Independent production-code probes reproduced F-01 through F-05. These observations confirm defects, not fixes.
- Additional codec probes covered CRLF/CR bodies, blank bodies, trailing terminators, BOM bodies, timestamps and ordinary provenance without another finding.
- The full Jest suite was not rerun locally because the review workspace lacked dependencies. No native VS Code or live-provider result is claimed.

This commit changes only the report. The recorded CI results belong to the reviewed implementation's merge commit; required checks for the later report-only branch head remain authoritative. Re-review each correction on its new exact head before closing findings.
