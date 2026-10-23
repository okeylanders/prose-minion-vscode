**Current independent disposition (second correction re-review, 2026-10-23): Approve with a nonblocking follow-up at `263450c7`.** All six original findings are resolved. N-03 records a narrow equal-time claim recovery risk after multiple filesystem failures; it is not a blocking finding. See the [latest independent re-review](#independent-second-correction-re-review-2026-10-23). Earlier dispositions, reviews and both author responses below are historical and preserved verbatim. Native/writer acceptance remains separate.

**Current independent disposition (correction re-review, 2026-10-23): Request changes at `17e4cd7`.** F-03, F-04, N-01 and N-02 are resolved. F-01 and F-02 remain open on narrower retirement-error and recovery/read-classification paths. See the [independent correction re-review](#independent-re-review-of-the-corrections-2026-10-23). The initial review and author response below are historical and preserved verbatim; writer/native acceptance remains separate.

# PR Review — Lightbox Board Names and Immediate Spark Saves, Slice 5A.1

**Author:** okeylanders · **PR:** [#164](https://github.com/okeylanders/prose-minion-vscode/pull/164) (open, unmerged at review)  
**Branches:** `epic/lightbox-slice-5a1-board-names` → `epic/lightbox`  
**Reviewed implementation head:** `ada5717b16541521b61f7a5b55275df43b581b56`  
**Base / verified merge-base:** `3e5c3a1bc1b864bc0de208fb290f1374a819c363`  
**Scope:** 70 files · +6,978 / −291  
**Reviewed:** 2026-10-22 · **Reviewer:** Astra  
**Mode:** independent source/contracts review; production host/store/hook regressions over synthetic files and stub responses; canonical-basis controls; regenerated host states; exact rebuilt-bundle DOM execution; supplied pixel inspection; fresh full head gates

## Summary

**Verdict: Request changes.** Names, model metadata and the shared changed-file notice fit the existing architecture. Format 1 remains backward compatible, and the eight corrections from the final #163 review retain their independent guards. All repository gates pass. Additional discriminating probes nevertheless find four P2 correction areas: claim recovery can resurrect an explicitly deleted board; interrupted rewrites defeat last-board restoration; a second window's Spark action silently erases another Spark's persisted mark; and a delayed rename acknowledgment can make an untouched editor undo a successful rename.

These are implementation findings, not objections to the declared save defaults. The interrupted-restore finding does **not** mean the saved board's bytes are lost. The Spark finding concerns persisted preferences, not manuscript loss. The report does not independently verify the author's attribution of decisions 33–36 to the writer.

This disposition is not a formal GitHub review, merge instruction, native VS Code verification, real-chapter checkpoint, writer acceptance or approval to proceed to Slice 5B.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Recovery cannot distinguish active, abandoned and already-committed claims, so Delete is reversible without the writer asking | **Open** |
| F-02 | Medium / P2 | Restore clears the last-board pointer while the board still exists in an interrupted rewrite's claim | **Open** |
| F-03 | Medium / P2 | A stale window's single-Spark action overwrites unrelated persisted Spark marks | **Open** |
| F-04 | Medium / P2 | A delayed rename acknowledgment makes an untouched reopened editor submit the previous name | **Open** |
| N-01 | Low / P3 · nonblocking | Invalid blur drops the draft and its promised validation reason | **Open** |
| N-02 | Low / P3 · nonblocking | Deduplicating truncated model labels undercounts distinct models | **Open** |

## F-01 — Preserve the transaction's ownership and deletion boundary during recovery

**Locations:** [`LightboxBoardRewrite.ts:112–123`](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/infrastructure/storage/LightboxBoardRewrite.ts#L112-L123), [commit/cleanup at 192–202](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/infrastructure/storage/LightboxBoardRewrite.ts#L192-L202), and [best-effort deletion at 256–262](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/infrastructure/storage/LightboxBoardRewrite.ts#L256-L262).

`putBack` treats a claim whose visible filename is absent as an abandoned rewrite. That absence does not prove either abandonment or that the old bytes should still be recoverable. Two independent sequences violate the [no-resurrection / claimed-file ownership contract](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/docs/adr/2026-10-19-lightbox-inspiration-board.md#L727-L743).

### A. An ordinary listing steals a live claim, allowing a later commit to undo Delete

1. Store A starts renaming a saved board. Let it claim and validate the original bytes; hold its final staged-file-to-visible-file rename immediately before that filesystem operation completes.
2. Store B lists the same source. The listing restores A's still-active claim to the visible name.
3. B deletes that visible file and returns `{ kind: 'deleted' }`.
4. Resume A's pending final rename. Because the destination is now absent, its no-overwrite commit succeeds and the board reappears with the new name.

**Observed:** the post-delete listing contains the supposedly deleted board. No filesystem error is required. The interleaving uses two real store instances sharing the existing memory filesystem, with a deferred filesystem operation rather than sleeps.

### B. A leftover claim from a successful rewrite resurrects an older version after Delete

1. Rename a saved board from `Original` to `Renamed`.
2. Fail only the cleanup deletion of the old claim. The visible file is correctly `Renamed`, and the rewrite reports success; the cleanup failure is swallowed.
3. A fresh store deletes the visible file successfully, then lists the source.
4. Recovery restores the claim's **old `Original` bytes** as a saved board.

This also represents the state left by an interruption after commit but before claim cleanup. The comment that a leftover claim is never read as a board does not hold once `putBack` restores its filename.

**Passing controls:** normal cleanup followed by Delete does not resurrect; a genuinely abandoned precommit claim can be recovered; final-commit failure preserves the original bytes; recovering a live claim without the intervening Delete blocks the pending commit instead of overwriting the recovered file. The defect is the recovery/deletion composition, not lack of unique staging or use of overwrite.

**Requested correction:** give recovery enough transaction/liveness information to distinguish active, abandoned and committed work. A successful explicit Delete must retire any recoverable predecessor, and a delayed commit must not recreate a board deleted after its claim was recovered. Preserve genuine interrupted-write recovery and the existing no-overwrite/collision guarantees. Add both sequences as regression tests.

## F-02 — Recover or classify a claimed last board before forgetting it

**Locations:** [`LightboxBoardLibrary.ts:251–262`](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L251-L262), and [the empty-shelf early return at 206–218](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L206-L218).

### Independent production-host sequence

1. Board and read the public fixture through the real handlers, allowing the saved file to become the last-on-screen pointer.
2. Simulate closing mid-rewrite after the atomic claim: move that file to a valid private `.claim-…` name, leaving its original bytes intact.
3. Create a fresh host with the same filesystem and workspace memory, then mount the shelf normally.

**Observed:** no current board, an undefined last-on-screen pointer, no visible saved file, and the intact claim still present. `read` reports `missing`, so the new cleanup clears the pointer. With no retained board, the subsequent shelf returns before calling `list`; consequently the recovery promised on folder listing never runs. Restoration is a once-per-session attempt.

**Discriminating control:** explicitly listing that source before the fresh host mounts restores the exact bytes, after which ordinary restore succeeds. This is a startup integration gap, not an unreadable board or a request to restore a truly deleted file.

**Requested correction:** distinguish a temporarily claimed/recoverable file from an actually missing file. Safely recover an abandoned claim, or preserve a retryable/busy state when another writer still owns it, before clearing the pointer. Keep the intentional cleanup of genuinely missing files and the newer-source-choice restore guard. Coordinate this with F-01 rather than blindly restoring every claim during `read`.

## F-03 — Persist the requested Spark change without undoing unrelated marks

**Locations:** [`LightboxBoardEdits.ts:103–114`](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/application/services/lightbox/LightboxBoardEdits.ts#L103-L114) and [`LightboxSparkLane.ts:91–108`](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/infrastructure/lightbox/LightboxSparkLane.ts#L91-L108).

1. Two production hosts/windows open the same saved board containing at least two Sparks, neither set aside.
2. Window A chooses **Not for me** on Spark 1. Await the completed handler and persistence.
3. Without reopening the snapshot, window B chooses **Not for me** on Spark 2. Await completion.
4. Decode the saved file.

**Expected:** both separately requested marks remain. **Observed:** Spark 1 is no longer set aside; only Spark 2 is. The writes do not overlap, and B never requested Undo for Spark 1.

`keepSparks` rereads the latest saved file but `carryLightboxSparkMarks` copies every mark from B's retained snapshot, including `undefined`. Thus the otherwise useful reread/reapply protection is defeated by the broad transform: B's lack of knowledge becomes an unrequested Undo.

The docs accurately describe copying the retained board's marks, and the store says the last rewrite wins. That is not treated here as a promise of a particular merge algorithm. The actionable distinction is that the writer's request is **tile-scoped**, while this implementation silently changes a different tile that was already persisted. The separate last-rename-wins default is not itself a defect, and competing actions on the same Spark may reasonably remain last-wins.

**Passing controls:** if B opens after A's completed dismissal, both distinct marks survive with orders 1 and 2; rapid set-aside followed by Undo in one host persists the final Undo without a new row; a Spark update queued behind rename and a source switch still targets the original board's file correctly.

**Requested correction:** persist the changed tile/dirty marks against the current file, with appropriate dismissal ordering, or detect and report the stale-write conflict rather than silently erasing other marks. Retain the existing queued-save target resolution, source-change isolation, no-extra-row policy and same-action last-wins behavior.

## F-04 — Do not treat an acknowledgment as a new user edit

**Locations:** [`LightboxBoardNameField.tsx:38–60`](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/presentation/webview/components/lightbox/LightboxBoardNameField.tsx#L38-L60), [blur at 98–102](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/presentation/webview/components/lightbox/LightboxBoardNameField.tsx#L98-L102).

1. The board is named A. Rename it to B with Enter; delay the host's shelf acknowledgment.
2. Reopen Rename while the shelf still says A. Do not edit the reopened field.
3. Deliver the successful acknowledgment containing B while that field remains mounted.
4. Leave the field.

**Observed:** the webview sends two rename requests, first B and then A. The draft was initialized once from A, but `settle` compares it to the now-updated `initial` prop B. Merely reopening and leaving becomes an unintended revert of the successful rename. This is reproduced both in a component test and by executing the exact freshly built production webview bundle in JSDOM.

**Passing controls:** a normal Enter sends once even if blur follows; Escape consumes the key, cancels and returns focus; reopening after acknowledgment shows B and permits an intentional rename back to A; same-adoption and cross-adoption shelf ordering remain sound. This is an editor draft/acknowledgment problem, not a failure of those ordering guards.

**Requested correction:** track an editing baseline/dirty state or pending rename state so an untouched field cannot submit a stale value when a host acknowledgment arrives. Preserve genuine user edits, current-file versus older-file targeting, Enter/blur deduplication, Escape and focus return. Cover both the head and saved-row editor, which share this component.

## Nonblocking observations

### N-01 — An invalid blur loses both the draft and its explanation

At [`LightboxBoardNameField.tsx:98–102`](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/presentation/webview/components/lightbox/LightboxBoardNameField.tsx#L98-L102), blur ignores `settle()`'s false result and unconditionally closes. Paste a name containing an embedded tab, then leave the field. No rename is sent, but the field and validation reason disappear. Invalid Enter correctly keeps the draft and shows the one-line rule.

The [slice contract](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/.todo/epics/epic-lightbox-2026-10-19/slice-5-saved-boards-and-compare.md#L510-L516) says leaving saves and a refused name says why in the field. The implementation comment deliberately equates invalid blur with Escape, but that differs from the stated interaction. Preserve an understandable refusal/draft recovery path, or explicitly reconcile the contract. The exact production DOM also reproduces this observation.

### N-02 — Deduplicate model identity before applying visual truncation

[`lightboxModelsNote`](https://github.com/okeylanders/prose-minion-vscode/blob/ada5717b16541521b61f7a5b55275df43b581b56/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxBoardsView.ts#L174-L188) applies `shortModelName` before `Set`. Two distinct model names with the same first 31 characters collapse into one. With those two plus `third-model` and `fourth-model`, the line says **“and 1 more”**, not “and 2 more.” This is independent of the intentional provider-prefix stripping / alias deduplication default.

Deduplicate the intended full provider-less identity before shortening labels. The full-ID tooltip remains available, so this is a low-severity visible identity/count error, not lost saved metadata.

## Verification and evidence boundaries

### Fresh gates on the exact implementation head

| Check | Independent result |
| --- | --- |
| Full Jest | **479 suites / 6,617 tests / 59 snapshots passed**, 349.541 s reported by Jest |
| Typecheck | **Pass** |
| Lint | **0 errors / 1,133 warnings**; exactly the approved #163 baseline by relative file, rule and severity, not just total count |
| Production build | **Pass** |
| Diff whitespace check | **Pass** |
| Independent external Jest regressions | **74 tests: 67 passing controls, 7 desired-behavior failures** supporting the six findings above; 16 suites, 18.669 s |
| Canonical-basis direct Node controls | **Pass**, including naming without changing runtime measurements, rule IDs, item keys or bases |
| Production-host state builder | **Pass**; regenerated `boards.json` and `log.txt` match the committed Slice 5A.1 evidence byte-for-byte |
| Exact production-bundle DOM | **89 positive assertions passed**, plus separately recorded reproductions of F-04 and N-01; these witnesses are not counted as passing desired behavior |

The external regressions comprise **47 retained #163 controls, all passing**, and **27 new checks: 20 controls pass, 7 desired assertions fail**. F-01 has two independent failing sequences. The final failing assertions execute successfully; there are no unresolved compiler/setup errors. An initial external harness pass needed its dependency-resolution link corrected before the final run; an initially copied canonical script still pointed at the older review worktree and was discarded, repointed and rerun with the approved precedence assertions. Those setup runs are not evidence for this disposition.

Tests ran serially in the cloud workspace, using the unchanged lockfile and disk-backed dependencies after checking its exact hash and correcting the workspace package link. Full Jest used a 2 GiB Node heap, one worker, a 1,000 MiB worker idle limit and disk-backed cache. Times above are cloud Jest times, **not native VS Code responsiveness measurements**. The direct Node and JSDOM checks are not native extension sessions.

Rebuilt bundle SHA-256 values:

- `webview.js`: `427e81f8e4de8786eafca652702bbf378e8ea86c0109e30f7f2a38d30256ffaa`
- `extension.js`: `54c130f53ff83c6dd97f8b7e27e4badda962c8be739e6327c45c9641ea5ed115`

Only public-domain Alice text and synthetic names/files/models were used. No private manuscript or live/paid model call was used. The review changes only this report; probes and generated runtime artifacts remain outside tracked implementation files.

### Controls retained and scope not promoted into findings

- **#163 corrections:** the reload pointer on retained-source return; same-ID adoption invalidation for preparing runs and delayed shelves; per-instance staging isolation; complete history/source-slug-collision handling; delete/return shelf invalidation; earlier-rule Bring reason precedence; same-adoption observation ordering; and deep-current pagination all retain passing independent coverage. F-01/F-02 concern the new rewrite/recovery path, not an assertion that those earlier corrections vanished.
- **Names:** retained board versus exact older saved-file targeting, queue-time target/name resolution, unchanged-text reread inheritance, new-current-text unnamed behavior, open/restore inheritance and session-only naming were traced through the changed source and exercised by the full suite. Independent rapid rename and queued Spark/source-switch controls pass. Empty/trimmed names and format-1 compatibility remain coherent.
- **Salvage:** malformed name handling is narrow; a name can be dropped without discarding the board. An independent malformed-name-plus-12-bad-tiles control refuses a lossy rewrite rather than misclassifying all loss as name salvage. Existing unnamed fixture bytes still round-trip; named format-1 data does not alter canonical Opinion identity.
- **Freshness and privacy:** independent rename-reply tests reject older adoptions and observations, accept subsequent legitimate updates, and keep both changed-file notice projections in step. Names render as literal text, not markup. Production DOM and hook controls keep names, prose and saved-file IDs out of persisted webview state; changed logging paths were checked for writer-text exposure.
- **Interaction and pixels:** the rebuilt bundle exercises named, changed, Spark and session scenes, exact row routing, Enter/Escape/focus, notice transitions and Undo transport. Six supplied captures were inspected at 500/1,000/1,440 px: the new names/editor/notices are legible in those samples. The supplied 500 px changed-board capture visibly clips part of the existing estimate button; “no page overflow” is not evidence of no clipping. That unchanged control is not promoted to a new Slice 5A.1 defect. Supplied pixels plus JSDOM do **not** verify native geometry, screen-reader behavior or browser layout.
- **Declared scope:** automatic stopped/partial-run saves, no pruning, one file per ordinary save, in-place name/Spark updates, provider-prefix shortening, the 120-unit name limit and session-only constraints are not called defects merely for being defaults. Writer acceptance of the claimed decisions, native VS Code use, the real-chapter checkpoint and future comparison work remain separate.

## Recommendation

Correct F-01 through F-04 and rerun their discriminating sequences with the listed controls, particularly recovery versus active ownership, a sequential two-window distinct-Spark update, and rename acknowledgment during an untouched reopened edit. Keep N-01/N-02 visible as nonblocking corrections or explicitly reconciled contracts. Preserve the #163 guards, exact-file naming semantics, format-1 fixtures and canonical citation stability while doing so.

## Author response (2026-10-22)

**F-01, F-02, F-03 and F-04: fixed. N-01 and N-02: fixed.** The 500 px
clipping you noted is fixed as well. It is not new in this slice: the
same button clipped at `3e5c3a1`. Four commits sit on top of your
report's commit `815fc05`, then this response:
- `32a45938` fixes F-01, F-02 and F-03, with their tests;
- `3532f949` fixes F-04, N-01 and N-02, and the clipping;
- `53664779` makes the evidence harness fail on a clipped button,
  and re-renders the captures;
- the commit that adds this response records the corrections in the
  slice plan, the ADR's D12 addendum, the agents guide and the epic.

Each sequence you gave is now a regression test. It fails on an export
of your reviewed head `ada5717`, and each control you named passes there
(details below). Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | **Liveness.** A claim's name now records when it was taken: `.<saved name>.claim-<epoch ms>-<UUID>` (new `LightboxBoardClaims`, built only by the store). A claim younger than the lease (`LIGHTBOX_BOARD_CLAIM_LEASE_MS`, 30 s) is live. No other window puts it back, removes it, or lists the board under it, and the file is `busy` for a read, a rewrite and a delete.<br>**Settling.** It happens when a listing finds claims, or when a read, rewrite or delete finds its file gone. With the saved name empty and no live claim, the newest abandoned claim goes back, never over anything. Beside a standing file, an abandoned claim is a committed rewrite's leftover: it is removed, never put back.<br>**Delete takes the claim lock too.** It claims the file as a rewrite does, removes every other claim of that name (young or old), then removes its own. A file another writer has claimed answers `busy` and is not deleted. A delete that cannot remove its claim puts the board back at once and reports `failed`.<br>**A stalled rewrite** checks its claim is still there before its commit point. A claim taken back after the lease therefore commits nothing.<br>**Residual race.** It needs a stall past the lease *and* another window's put-back and delete inside the stalled writer's final rename. It is recorded in the slice notes, not built against: rename and delete give no stronger lock | `LightboxBoardClaims.test.ts`:<br>• **Sequence A:** held at the final rename; the other window's listing does not steal the live claim; its delete is `busy`; the rewrite commits; one board stands, renamed<br>• **Sequence B:** claim clean-up made to fail; a fresh window deletes, both past the lease and at once; then no listing or read brings either version back<br>**Your controls:** clean-up then delete; an abandoned pre-commit claim recovered (by a listing, by a read, the newest of several); a failed commit puts the original back; a claim held past the lease and put back blocks the pending commit<br>**Added controls:** one put back while its bytes were checked is read again and committed; a live claim is never listed and is `busy`; an abandoned leftover beside its file is removed while a live one is left | `32a45938` |
| F-02 | Medium / P2 | **Fixed** | `LightboxBoardStore.read` settles a missing file's claims before it answers:<br>• an abandoned claim is put back and read;<br>• a live one is `busy` (a new `LightboxBoardRead` kind, store only);<br>• `missing` now means neither file nor claim.<br>The restore clears the pointer only on `missing`, so `busy` keeps it, logs, and fails softly; a later session restores the board. Recovery happens in the store's read for that one file, under the same liveness rule, so it does not depend on a listing. The newer-source guard is unchanged: the ticket is taken before the read, and the adoption is checked after it | `LightboxBoardRestoreClaims.test.ts`:<br>• **Your sequence:** the pointed file moved under an abandoned claim; a fresh host restores it, keeps the pointer, and the file is back<br>• a live claim restores nothing and leaves the pointer and the claim; a session past the lease restores it<br>• a source chosen while the restore's read puts the board back keeps the screen<br>**Control:** neither file nor claim still clears the pointer (`LightboxSparkSaves.test.ts`) | `32a45938` |
| F-03 | Medium / P2 | **Fixed** | `keepSparks(boardId)` became `keepSpark(boardId, tileId)`. At the rewrite's turn, the file takes *that* spark's mark as the board has it, through the Spark lane's own `setLightboxSparkDismissed` over the file's readings. A spark set aside takes the order after the file's highest, and no other spark in the file changes. `carryLightboxSparkMarks` is removed. Same-spark actions stay last-wins. The queued-save target and source isolation are unchanged | `LightboxSparkSaves.test.ts`:<br>• **Your sequence:** two hosts on one saved board; A sets spark 1 aside; B, not reopened, sets spark 2 aside; the file holds both, orders 1 and 2<br>**Your controls:**<br>• B opened after A's mark (both, 1 and 2);<br>• set aside then Undo in one host (existing);<br>• a spark set aside behind a held rename and a source switch marks the original board's file, which keeps the name<br>**Added:** B's Undo of A's spark brings it back (last-wins) | `32a45938` |
| F-04 | Medium / P2 | **Fixed** | `LightboxBoardNameField` tracks whether the writer has typed. Until then it sends nothing, and the draft follows the `initial` prop (still selected), so an answer that lands while the field is open shows in it. Once the writer has typed, Enter and leaving send the edit when it differs from the name standing now. Enter/blur dedup, Escape and focus return are unchanged | `LightboxBoardsPanel.test.tsx`, for the head and a row:<br>• **Your sequence:** A to B with Enter; reopen while the shelf says A; the answer B lands; leave. One request, and the field showed B<br>• an edit typed before the answer is kept and sent once<br>**Control:** reopened after the answer, it shows B, and renaming back to A is sent once | `3532f949` |
| N-01 | Low / P3 · nonblocking | **Fixed** (keep the draft) | Leaving with a name the rule refuses keeps the field open with the writer's words, sets `aria-invalid`, and shows the rule's reason, as Enter does. Escape then cancels and returns focus. The contract text already said this | `LightboxBoardsPanel.test.tsx`: a tab in the name, then leave: nothing sent, the field open with its words and the reason; Escape cancels | `3532f949` |
| N-02 | Low / P3 · nonblocking | **Fixed** | `lightboxModelsNote` deduplicates the whole provider-less name, then cuts each for show | `lightboxBoardsView.test.ts`: two names sharing their first 31 characters plus two more read "and 2 more"; the same name from two providers is still one | `3532f949` |
| 500 px clipping | (noted, not promoted) | **Fixed** (it predates this slice) | Before fixing, I checked `3e5c3a1`. Rendering the review's changed-board state against the `3e5c3a1` bundle at 500 px, "Read the rest" ends at x = 522 in a 500 px page, exactly as at `ada5717`. A press's button now wraps its cost under its label (`board.css`: `max-width: 100%`, wrapping, a little vertical padding inside the old minimum height). At 1000 and 1440 px nothing moves | The evidence harness now records each button that runs past the box that clips it, and fails on any. Against the `ada5717` bundle it writes 2 errors (`changed-board@500`, `changed-rail@500`); at this head it writes none | `3532f949`, `53664779` |

### What changes in the PR body's claims

- **The rewrite and its claim.** A claim's name carries the time it was
  taken. A claim younger than 30 s is live and untouchable. Older ones are
  settled: put back when the saved name is empty, removed beside a
  standing file. A rewrite checks its claim before its commit point.
- **Busy.** `busy` now also answers a read (Open, restore) and a delete
  while another window holds the file. Open says "That saved board is
  being changed in another window. Try again in a moment." A restore keeps
  its pointer.
- **Delete.** A delete claims the file first and removes every earlier
  version a rewrite left beside it, so a deleted board never comes back.
  A delete of a board left mid-rewrite (abandoned) deletes it whole.
- **Sparks.** "Not for me" and Undo write only the spark acted on.
- **A window closed mid-rewrite** hides that board for up to 30 s. A
  reload in that time does not restore it, but keeps the pointer, so the
  next session brings it back.

### How each new test was checked against `ada5717`

The new and changed test files ran on an export of `ada5717`, with this
worktree's `node_modules`, ts-jest diagnostics off, a one-line stand-in for
the lease constant, and a claim matcher that also accepts `ada5717`'s claim
names. That way each failure is behavioural. 79 tests: 18 failed and 61
passed.

- **Fail there, as they should (desired behaviour):**
  - **F-01:** sequence A (the live claim stolen, the delete reported, the
    board back); sequence B and its young variant (the old bytes
    restored); a live claim treated as abandoned (put back, listed, not
    busy); an abandoned leftover beside its file not removed; a read that
    does not recover; the newest of several claims; a delete of a board
    left mid-rewrite (`busy` at `ada5717`); a claim put back while its
    bytes were checked (its release logged a stuck claim that another
    window had already put back).
  - **F-02:** all three restore tests.
  - **F-03:** the two-window sequence.
  - **F-04:** the head and the row.
  - **N-01:** the refused name on leaving.
  - **N-02:** the model count.
  - **Not a behaviour change:** the atomic-rewrite test also fails there,
    because it pins the new claim name.
- **Pass there (your controls, and mine):**
  - **F-01:** an abandoned pre-commit claim recovered by a listing; a
    rewrite that cleaned up, then a delete; a failed commit puts the
    original back; a claim held past the lease and put back blocks the
    pending commit; a claim name with no time is left alone.
  - **F-02:** a file with neither name nor claim forgets the pointer.
  - **F-03:** opened after the first mark; one spark's Undo last-wins; a
    spark behind a rename and a source switch.
  - **F-04:** an edit typed before the answer is kept; reopened after the
    answer and renamed back.
  - **Unchanged:** every other rewrite, rename, panel and view test.

### Verification at this head

After `npm ci` into a real `node_modules`, at `3532f949` (the code, unchanged since):
- **`npx jest`:** 481 suites / 6,643 tests / 59 snapshots. At `ada5717`
  it was 479 / 6,617 / 59; at `3e5c3a1`, 474 / 6,541 / 59.
- **`npm run lint`:** 0 errors / 1,133 warnings, identical to `3e5c3a1`
  per file, rule and severity.
- **`npm run typecheck`:** passes.
- **`npm run build` with `verify:bundle`, twice:** passes, with the same
  hashes both times: `webview.js`
  `66c1f405b6ff52a41f5780771482b3383f21bf84479c3d5a47c0f800b103cd35`,
  `extension.js`
  `b72fa49032476d85f838dc1f9002a1ceb082b1117730c2b8a23690797e7d0c39`.
- **`git diff --check 815fc05 HEAD`:** clean. Against `3e5c3a1` it flags
  only the six Markdown hard line breaks in your report's header, which
  I left as written.
- **Evidence:** 18 captures, `errors.txt` empty; the states, rebuilt, are
  byte-identical.

No live or billable call was made.

## Independent re-review of the corrections (2026-10-23)

**Reviewed correction head:** `17e4cd74a81abbe20455f237cba867554ec3fd54`.

**Compared with:** report commit `815fc05a54022609829487a96b9cb208b82ba0af`; base remains `3e5c3a1bc1b864bc0de208fb290f1374a819c363`. All four intervening commits were reviewed: 32 changed files, +1,526 / −334, including the author response and regenerated evidence.

**Independent verdict: Request changes.** F-03, F-04, N-01 and N-02 are resolved. The ordinary F-01/F-02 sequences now pass, but their preservation guarantees remain incomplete on the narrower, independently reproduced paths below. These are not the disclosed lease-expired final-rename race and do not require changing the 30-second lease or adding an automatic restore retry.

The original review and author response above are preserved verbatim. The author's resolution ledger is useful implementation evidence, not a substitute for this independent disposition.

### Resolution ledger

| ID | Independent disposition at `17e4cd7` | Evidence |
| --- | --- | --- |
| F-01 | **Partially corrected; P2 remains open** | Live claims are no longer stolen in the original normal-duration interleaving; one-off cleanup failure followed by successful retirement stays deleted. Persistent predecessor-removal failure or a retirement directory-scan error still reports Delete success and later resurrects the predecessor. |
| F-02 | **Partially corrected; P2 remains open** | Ordinary abandoned-claim restore succeeds; live claims preserve the pointer and restore in a later session. A new claim between recovery and reread, or a failed claim-discovery scan, still causes false `missing` and clears the pointer. |
| F-03 | **Resolved** | Sequential distinct-Spark actions from stale windows preserve both marks; a different window's Undo changes only its requested Spark. Queue/source-switch controls remain passing. |
| F-04 | **Resolved** | Untouched fields follow acknowledgment without submitting; genuine edits, including an intentional reversion, survive acknowledgment and submit once. Head and saved-row paths pass. |
| N-01 | **Resolved** | Invalid blur keeps the draft, validation reason and `aria-invalid`; correction and Escape work. |
| N-02 | **Resolved** | Full provider-less identity is deduplicated before display truncation; distinct long names retain the correct count and provider aliases still deduplicate. |

### F-01 remaining — Retirement failures are still acknowledged as a successful Delete

**Locations:** [`LightboxBoardClaims.ts:100–106`](https://github.com/okeylanders/prose-minion-vscode/blob/17e4cd74a81abbe20455f237cba867554ec3fd54/packages/core/src/infrastructure/storage/LightboxBoardClaims.ts#L100-L106), [directory error handling at 150–155](https://github.com/okeylanders/prose-minion-vscode/blob/17e4cd74a81abbe20455f237cba867554ec3fd54/packages/core/src/infrastructure/storage/LightboxBoardClaims.ts#L150-L155), and [`LightboxBoardStore.ts:324–339`](https://github.com/okeylanders/prose-minion-vscode/blob/17e4cd74a81abbe20455f237cba867554ec3fd54/packages/core/src/infrastructure/storage/LightboxBoardStore.ts#L324-L339).

The correction correctly makes Delete retire predecessor claims before deleting its own claim. However, `retire` ignores a failed predecessor deletion, and its enumeration helper turns any directory error into an empty list. The store then unconditionally deletes its own current-version claim and reports `deleted`.

**Independent sequence A, persistent cleanup failure:**

1. A real store renames `Original` to `Renamed`. Fail deletion of that write's old claim, leaving a correctly committed visible `Renamed` file and the genuine `Original` predecessor claim.
2. A fresh store deletes the board. Keep the **same old claim** unremovable during this attempt; allow the fresh Delete's own claim to be removed.
3. Delete returns `{ kind: 'deleted' }`.
4. Release the old-claim failure, advance the injected clock past the lease, and list/read the board.

**Observed:** the file reappears as **`Original`**, not `Renamed`. The latest version has been removed, and the predecessor is restored despite the successful explicit Delete. This models a claim-specific filesystem failure persisting through both cleanup attempts, not a stall inside the final rename.

**Independent sequence B, failed retirement enumeration:** start with the same genuine leftover, let its cleanup failure end, then fail only the directory scan that Delete performs while holding its own claim. Delete again reports success; the next healthy listing past expiry restores `Original`. No overlapping rewrite is required for either sequence.

**Passing controls:** when retirement succeeds, Delete remains effective past expiry; when deletion of Delete's **own** claim fails, the current implementation correctly returns `failed` and restores the exact latest bytes. All seven adapted original storage probes pass, including live-claim busy handling, normal recovery, failed final commit and malformed-data preservation. The missing symmetry is failure while retiring the other claims.

**Requested correction:** do not treat an unknown/incomplete retirement as success. Distinguish a predecessor that is already gone from one still present or not verifiably retired. Only acknowledge Delete once no predecessor can later be recovered; otherwise preserve/restore the latest board and return a recoverable failure. Cover both removal and directory-enumeration errors, while retaining the successful retirement and own-claim rollback controls.

### F-02 remaining — A second raw read and a failed scan still confuse busy/unknown with absent

**Locations:** [`LightboxBoardStore.ts:226–231`](https://github.com/okeylanders/prose-minion-vscode/blob/17e4cd74a81abbe20455f237cba867554ec3fd54/packages/core/src/infrastructure/storage/LightboxBoardStore.ts#L226-L231), [`LightboxBoardClaims.ts:150–155`](https://github.com/okeylanders/prose-minion-vscode/blob/17e4cd74a81abbe20455f237cba867554ec3fd54/packages/core/src/infrastructure/storage/LightboxBoardClaims.ts#L150-L155), and [the pointer cleanup at `LightboxBoardLibrary.ts:258–265`](https://github.com/okeylanders/prose-minion-vscode/blob/17e4cd74a81abbe20455f237cba867554ec3fd54/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L258-L265).

**Independent normal-filesystem interleaving:**

1. The last-on-screen saved file sits in an abandoned claim, with its bytes intact.
2. A fresh host starts restore. Its store recovers the abandoned claim to the visible filename.
3. Before that store's subsequent raw reread, a second real store begins an ordinary rewrite and takes a **new, live** claim on the recovered file. Hold that writer at reading its claimed bytes.
4. Let restore continue.

**Observed at the store boundary:** `{ kind: 'missing' }`, not `busy`. **Observed through the actual restore handler/library:** no restored board and an undefined reload pointer while the fresh live claim still exists. Release the second writer: it commits normally, but the pointer has already been cleared. Both the store-level and production-host probes reproduce this sequence.

The first `missing` is classified through `settle`, but the second `files.read` returned for `present` is not. No writer stalls past its lease in this interleaving; only the initial, genuinely abandoned claim is old.

**Independent error case:** with the last board intact in an abandoned claim, fail claim-directory enumeration during restore. `entriesOf` returns `[]`, so the store calls it absent and restore clears the pointer. The claim remains intact. A failed scan is not proof that neither the file nor a claim exists.

**Passing controls:** ordinary abandoned-claim restore, explicit-list recovery, live/busy restore with the pointer retained, a fresh session after expiry, and clearing the pointer for a genuinely absent file with no claim. The existing newer-source-choice guards also remain passing.

**Requested correction:** classify every missing result used for restore, including the post-recovery reread, with bounded retry or a non-missing busy/failure outcome when ownership changes. Preserve directory-read errors as uncertainty/failure rather than absence. Clear the pointer only after actual absence is established. This is not a request to retry automatically when the disclosed lease ends, and no loss of saved-board bytes is claimed.

### Fresh verification at the correction head

| Check | Result |
| --- | --- |
| Full Jest | **481 suites / 6,643 tests / 59 snapshots passed**, 341.593 s |
| Typecheck | **Pass** |
| Lint | **0 errors / 1,133 warnings**, identical by relative file, rule and severity to the prior independent run and approved #163 baseline |
| Production build / bundle verification | **Pass** |
| Correction diff whitespace | **Pass** for `815fc05..17e4cd7`; historical report Markdown line breaks are unchanged |
| Independent regressions | **99 tests: 94 pass, 5 desired assertions fail**, 18 suites, 22.783 s; the failures are two F-01 retirement cases and three F-02 store/host witnesses |
| Canonical-basis direct Node controls | **Pass**; name/rule/basis stability and earlier-rule refusal precedence retained |
| Regenerated production-host states | **Pass**; states and log match the committed corrected evidence byte-for-byte |
| Exact rebuilt production-bundle DOM | **131 positive assertions pass**, including former rename/invalid-blur witnesses now asserted as desired behavior |

All **47 preserved #163 controls** pass. All **28 independent UI checks** pass, including both editor targets, dirty edits across acknowledgments, intentional reversion, invalid draft recovery, model identity and Delete cancellation while an invalid editor remains open. The original 5A.1 probes were preserved; correction copies adapt only the claim-name format and the now-disclosed live/expired lease behavior. The added failure probes use real stores/hosts, synthetic filesystem errors and deterministic deferred operations, not fabricated store results or timing sleeps.

Bundle SHA-256 values:

- `webview.js`: `66c1f405b6ff52a41f5780771482b3383f21bf84479c3d5a47c0f800b103cd35`
- `extension.js`: `b72fa49032476d85f838dc1f9002a1ceb082b1117730c2b8a23690797e7d0c39`

The changed supplied 500 px capture was inspected: the previously clipped estimate button's cost now wraps within its card. The added right-edge button-clipping check is relevant, but neither supplied pixels nor JSDOM establishes native VS Code geometry or complete clipping/accessibility coverage. The production-host builder and DOM checks were rerun; no browser was launched for this re-review.

All heavy jobs were serialized. Dependencies and the lockfile are unchanged; the workspace dependency link still resolves to this exact checkout. Timings are cloud Jest timings, not native latency. Public-domain Alice and synthetic names/files/models only; no private manuscript or live/paid call. No implementation file was changed by the review.

The disclosed 30-second lease, soft busy restore without automatic retry, legacy undated-claim policy and residual expired-lease/final-rename race are recorded limitations, not silently claimed solved and not the basis of these two remaining findings. Author-attributed writer decisions, native use, the real-chapter checkpoint and Slice 5B remain separate from technical review.

**Recommendation:** fix the two remaining error/ownership classification gaps, retain the now-passing original sequences and all #163 guards, then rerun the five discriminating assertions and full required gates. No new UI finding is raised in this round.

## Author response to the re-review (2026-10-23)

**F-01 and F-02: fixed on the narrower paths.** One commit, `bad728eb`,
sits on top of your re-review's commit `4e2b18b`, followed by the commit
that adds this response. Your five witnesses are regression tests now.
Each fails on an export of `17e4cd7`, and each control you named passes
there. Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | **`retire` returns a verdict.** It removes every other claim of the saved name, then reads the folder again. It is true only when both reads succeeded and no other claim is left.<br>**A directory read error is unknown, never empty.** `entriesOf` gives `[]` only for a folder that is not there (`isMissingFileSystemPathError`); any other error is `undefined`.<br>**On a false verdict,** the delete renames its own claim back to the saved name, so the latest board stands exactly as it was. It answers `failed`, which the rail words as "That saved board could not be deleted. The output log says why." The writer can try again. If even that put-back fails, the claim is the newest one, and it comes back once the lease runs out. The own-claim rollback is unchanged | `LightboxBoardClaimFailures.test.ts`:<br>• **Your sequence A:** a leftover that will not go through both clean-ups; the delete fails, the renamed bytes stand, and past the lease a listing and a read give "Renamed"<br>• **Your sequence B:** the folder unreadable on the delete's first look while it holds the file; the delete fails, and past the lease the board is still "Renamed"<br>• **Added:** the folder unreadable on the delete's second look<br>**Your controls:**<br>• a successful retirement stays deleted past the lease (`LightboxBoardClaims.test.ts`);<br>• the delete's own claim failing gives `failed`, with the latest bytes back<br>**Added control:** once the leftover goes, the same delete succeeds and nothing comes back | `bad728eb` |
| F-02 | Medium / P2 | **Fixed** | **Every `missing` is classified.** `LightboxBoardStore.settledRead` reads the file and settles its claims on every `missing`, at most three times:<br>• put back: read it again;<br>• a live claim: `busy`;<br>• an unreadable folder (`unknown`): `unreadable`, "Its folder could not be read.";<br>• still moving after three rounds: `busy`.<br>`missing` is returned only when the folder was read and neither the file nor a claim is there. Delete classifies the same way; an unknown folder makes it fail.<br>**Restore** clears the pointer only on `missing`, so `busy` and `unreadable` keep it and fail softly. There is no retry when the lease ends. The newer-source guard is unchanged (ticket before the read, adoption checked after) | `LightboxBoardClaimFailures.test.ts`:<br>• **Your store sequence:** the board put back, then another store's rewrite takes a live claim before the reread; `busy`, then the rewrite commits<br>• **Your error case:** an unreadable folder gives `unreadable`, and the claim is left; a healthy read recovers it<br>`LightboxBoardRestoreClaims.test.ts`:<br>• **Your host sequence:** the restore holds after its put-back; another host's store claims the file; nothing is restored, the pointer and the log say busy; the rewrite then commits and the pointer stays<br>• **Your failed scan:** pointer and claim kept; a later session restores the board<br>**Your controls pass there:** an ordinary abandoned-claim restore, explicit-list recovery, a live claim keeping the pointer, a fresh session after expiry, a truly absent file clearing the pointer, and the newer-source guard<br>**Added control:** a folder that is not there at all reads as `missing` | `bad728eb` |

### What changes in the PR body's claims

- **Delete** now answers `failed` (the board stands, unchanged) whenever it
  cannot show that no earlier version is left. That covers a leftover
  that would not go, and a folder it could not read while it held the
  file. Before, it answered `deleted`.
- **Read, Open and restore** answer `missing` only after the folder has
  been read and shows neither file nor claim. A board claimed again
  between the put-back and the reread is `busy`, and a folder that cannot
  be read is `unreadable`; neither clears the reload pointer.
- **A rewrite** that finds its file gone and its folder unreadable
  answers `failed`, not `missing`.

### How each new test was checked against `17e4cd7`

The two new and changed test files ran on an export of `17e4cd7`, with
this worktree's `node_modules` and ts-jest diagnostics off: 13 tests, 8
failed and 5 passed.
- **Fail there, as they should:**
  - **F-01:** a leftover that will not go; the folder unreadable on the
    delete's first look and on its second. My added control "once the
    leftover goes, the same delete succeeds" fails too, because its first
    step expects the stuck delete to fail.
  - **F-02:** the store's reread; the store's unreadable folder; the
    host's reread; the host's failed scan.
- **Pass there:**
  - the delete's own claim failing;
  - a folder that is not there;
  - the three earlier restore tests (abandoned, live, newer source).
- **Your other controls** (successful retirement past the lease,
  explicit-list recovery, a truly absent file clearing the pointer) are
  earlier tests, unchanged, and pass at both heads.

### Verification at this head

After `npm ci` into a real `node_modules`, at `bad728eb`:
- **`npx jest`:** 482 suites / 6,653 tests / 59 snapshots. At `17e4cd7`
  it was 481 / 6,643 / 59.
- **`npm run lint`:** 0 errors / 1,133 warnings, identical to `3e5c3a1`
  per file, rule and severity.
- **`npm run typecheck`:** passes.
- **`npm run build` with `verify:bundle`, twice:** passes, with the same
  hashes both times.
  - `webview.js`
    `66c1f405b6ff52a41f5780771482b3383f21bf84479c3d5a47c0f800b103cd35`,
    unchanged from `17e4cd7`.
  - `extension.js`
    `e9c04557447d102d91c7e2b7f85f54c75c6d61cfcfe2bd04dbf184900f59dd13`.
- **The whitespace check:** clean from `815fc05`.
- **Evidence:** the host states were rebuilt and are byte-identical, and
  the webview bundle is the one the captures were rendered from, so the
  evidence is unchanged.

No live or billable call was made.

## Independent second correction re-review (2026-10-23)

**Disposition: Approve with a nonblocking follow-up.** The original four P2 findings and two P3 notes are now resolved at `263450c7b09b97b753a8b085ad5c81caf8022bae`. One new, narrowly bounded P3 robustness note, N-03 below, remains. This is technical approval of this slice, not a no-findings report, a formal GitHub review, a merge instruction, writer acceptance, native VS Code verification, the real-chapter checkpoint or approval for Slice 5B.

**Reviewed delta:** `4e2b18b2c39827b249d6b81c8bd1642f8c1007c5..263450c7b09b97b753a8b085ad5c81caf8022bae`, two commits, 11 files, +544 / −54. The base remains `3e5c3a1bc1b864bc0de208fb290f1374a819c363`. I read the latest author response and the amended contracts/decisions, inspected the complete delta, and replayed the preserved independent witnesses rather than relying on the author's regression claims. The earlier reviews and both author responses remain verbatim below the latest-disposition preface.

### Resolution ledger

| ID | Final disposition | Independent verification |
| --- | --- | --- |
| F-01 | **Resolved** | Both prior retirement-error witnesses now return `failed`, preserve the latest named board and remain correct after the lease. The initial live-claim, interrupted-write, successful-retirement and own-claim failure controls also pass. A new second-scan failure probe verifies complete latest bytes are restored, followed by a successful Delete when the fault clears. |
| F-02 | **Resolved** | All three prior failures now pass unchanged: store-level reread after a real second store takes a live claim, the same interleaving through actual host restore, and claim-folder scan failure preserving the reload pointer. Abandoned recovery, live busy, later-session recovery, genuine absence and newer-source ownership controls remain green. |
| F-03 | **Remains resolved** | Different windows' distinct Spark actions and Undo preserve the other Spark's persisted mark; queued save, rename and source-change controls still pass. |
| F-04 | **Remains resolved** | Untouched reopened rename follows the acknowledgment without submitting an old name; genuine edits, Enter/Escape and intentional reversion controls still pass. |
| N-01 | **Remains resolved** | Refused blur retains the draft, validation reason and accessible invalid state; correction and Escape remain usable. |
| N-02 | **Remains resolved** | Full model identity is deduplicated before shortening, with colliding shortened labels still counted separately and provider aliases still deduplicated. |
| N-03 | **Open, Low / P3, nonblocking** | Equal-time claim ordering can lose newer metadata only under the additional failure conjunction described below. |

The storage correction now distinguishes an unreadable directory from established absence. `LightboxBoardClaims.retire` verifies a second directory scan before Delete may commit; failure rolls its own claim back and reports failure. `LightboxBoardStore.settledRead` classifies **every** missing read, up to three attempts; unknown discovery becomes `unreadable` for reads and `failed` for Delete, while the rewrite maps unknown to `failed`. The reload pointer is retained on busy and unreadable results.

Additional independent positive controls cover: exact-byte recovery when both retirement and immediate rollback fail but the latest claim has a genuinely later timestamp; a predecessor removed by another actor before retirement attempts it; unknown discovery causing no mutation for rewrite/Delete/read; and two versus three successive movements yielding a board versus bounded `busy`, followed by a healthy read. These are fault-injected production-store tests, not native filesystem timing measurements.

### N-03 — Equal-millisecond claims can recover older metadata after failed rollback

**Severity: Low / P3, nonblocking.** Location: [`LightboxBoardClaims.ts:151–166`](https://github.com/okeylanders/prose-minion-vscode/blob/263450c7b09b97b753a8b085ad5c81caf8022bae/packages/core/src/infrastructure/storage/LightboxBoardClaims.ts#L151-L166), reached after the failed-retirement rollback in [`LightboxBoardStore.ts:326–329`](https://github.com/okeylanders/prose-minion-vscode/blob/263450c7b09b97b753a8b085ad5c81caf8022bae/packages/core/src/infrastructure/storage/LightboxBoardStore.ts#L326-L329).

**Controlled sequence:**

1. A real store commits an in-place rename from `Original` to `Renamed`, but removal of its predecessor claim fails and continues failing through retirement.
2. A second store tries Delete, takes its own claim containing the latest bytes, cannot retire the predecessor, and correctly answers `failed`. Inject an additional failure of the rename that would put its latest claim back.
3. Give those two claims the **same millisecond timestamp** and IDs for which the older claim sorts later lexically. This is an injected tied clock, not clock reversal and not a native reproduction of the timing.
4. Clear the filesystem faults, advance past the lease, and read through a fresh store. Recovery selects the older claim by the arbitrary lexical tie-break: the name is `Original`, the recovered bytes are not the latest bytes, and the newer claim has been removed.

**Impact and limits:** the demonstrated loss is a saved name; the same in-place metadata shape could affect newer Spark marks. It is **not manuscript loss**, and it is **not resurrection after a successful Delete**: Delete reported failure. It requires persistent predecessor-removal failure, a further rollback failure, equal claim timestamps and the unfavorable ID order. Ordinary user-separated actions generally do not share a millisecond; no frequency or native latency is inferred from the injected clock. The genuinely newer-timestamp rollback/recovery control passes. This narrower conjunction does not reopen the corrected F-01/F-02 blocking paths.

**Follow-up:** do not treat UUID lexical order as evidence of recency when timestamps tie. Preserve ambiguity rather than deleting the unselected equal-time version, or record ordering evidence sufficient to identify the latest version. This can be addressed separately from this slice's technical approval.

### Fresh verification at the exact second correction head

| Check | Result |
| --- | --- |
| Full repository Jest | **482 suites / 6,653 tests / 59 snapshots passed**, 346.370 seconds |
| Preserved independent probes | **99 / 99 passed unchanged**, 18 suites, 22.670 seconds; includes all five prior failures and 47 prior #163 guards |
| Added failure/termination probes | **6 passed / 1 failed**, 16.529 seconds; the single failure is the explicitly nonblocking N-03 tied-clock witness |
| Typecheck | **Passed** |
| Lint | **0 errors / 1,133 warnings**; identical per relative file, rule and severity to the prior reviewed heads |
| Production build, including `verify:bundle` | **Passed** |
| Canonical-basis / earlier-rule controls | **Passed**; names do not change measurement or canonical Opinion standing |
| Regenerated host evidence | **Passed**; board states and log byte-identical to the committed evidence |
| Exact rebuilt production webview in JSDOM | **131 positive assertions passed**, including retained name/edit/model and privacy controls |
| Whitespace / review hygiene | Implementation delta clean; only the report is changed by the review |

Rebuilt SHA-256 values:

- `webview.js`: `66c1f405b6ff52a41f5780771482b3383f21bf84479c3d5a47c0f800b103cd35` (unchanged from the previous correction).
- `extension.js`: `e9c04557447d102d91c7e2b7f85f54c75c6d61cfcfe2bd04dbf184900f59dd13`.

All heavy jobs were serialized in the cloud workspace. The unchanged lockfile and workspace dependency link were reverified. The original format-1 fixture, malformed-name salvage, queued targets, adoption/observation freshness, deep paging, earlier-rule Bring precedence and canonical Opinion controls retain their independent coverage. Only public-domain Alice, synthetic metadata/files and stub responses were used; no private manuscript or live/paid model call.

No new UI or CSS implementation changed in this delta. The rebuilt-bundle DOM run and regenerated host states are fresh; the previously inspected supplied captures are not represented as new native screenshots. The disclosed lease, soft busy/unreadable restore without automatic retry, undated-claim policy and expired-lease/final-rename limitation remain bounded as before. Author-attributed writer decisions and the native/writer checkpoints remain separate.

**Recommendation:** this slice is technically approved with N-03 recorded as a nonblocking follow-up. Retain all six resolved findings' regressions and the new error-classification controls.
