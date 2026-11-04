# PR #194 review: Project Memory Slice 1, store and format 1

**Verdict: changes requested before merge into `epic/workshop-project-memory`. Five independently reproduced P2 implementation findings remain open.**

**PR:** [#194](https://github.com/okeylanders/prose-minion-vscode/pull/194)  
**Reviewed:** 2026-11-04  
**Reviewed implementation:** `5008f071f0b5fb3b093f0e9bb2eb44e86bad86e7`  
**Target branch:** `epic/workshop-project-memory`  
**Base:** `8fb016fa3e767964fe8c53c778d6453f8507667d`  
**CI merge:** `886b58446264d0a0107db90d6fb480dba8bde052`  
**Spec reviewed:** [PR #192](https://github.com/okeylanders/prose-minion-vscode/pull/192), head `3d5042e871572a2c5f8c9ec13991d9151f47f5fe`

This is a branch review report, not a formal GitHub review submission or authorization to merge. The implementation and base were rechecked immediately before publication and remained unchanged. Merge also waits on #192 and resolution of its outstanding design decisions.

## Resolution ledger

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

#192 remains a separate merge dependency. Its six outstanding decisions concern mode scope, INDEX.md, reopen deltas, pinned budget, publication of memory reads, and readers outside Workshop. This review does not decide those questions for the writer.

## Shared Lightbox extraction

The extracted claim lifecycle and stage/claim/commit logic were compared with the prior Lightbox implementation. No introduced Lightbox regression was found in ownership, lease recovery, leftover retirement, rewrite release, fallback naming, commit order or staging-ID order. The neutral modules introduce no Lightbox/ProjectMemory imports, and the existing Lightbox tests were not changed. The findings above concern the new memory caller and codec contracts.

## Verification

- [CI run 41834996816](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41834996816/job/126591488785) passed core/webview/extension typechecks, **639 suites / 9,071 tests / 59 snapshots**, lint, both production builds and bundle verification.
- CI lint: **0 errors / 1,153 warnings**.
- Exact-head TypeScript modules were transpiled and executed in Node with an in-memory filesystem. Independent production-code probes reproduced F-01 through F-05. These observations confirm defects, not fixes.
- Additional codec probes covered CRLF/CR bodies, blank bodies, trailing terminators, BOM bodies, timestamps and ordinary provenance without another finding.
- The full Jest suite was not rerun locally because the review workspace lacked dependencies. No native VS Code or live-provider result is claimed.

This commit changes only the report. The recorded CI results belong to the reviewed implementation's merge commit; required checks for the later report-only branch head remain authoritative. Re-review each correction on its new exact head before closing findings.
