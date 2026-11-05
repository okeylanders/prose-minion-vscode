# PR #216 review: Workshop Bookmark Recall, Slice 2

## Verdict

**Current verdict: changes requested at `f02a835a1cc6b41345964e48268847314573c826`.** Original F-01 and F-02 are independently verified resolved. The correction introduces F-03 (P2), an unbounded whole-corpus identity scan on every page; F-04 (P3) records a remaining false actionable row for a large legacy duplicate. See the independent re-review below. This is a report disposition, not a formal GitHub review-state change or authorization to merge. The original-head findings and author response remain as history.

- **PR:** [#216](https://github.com/okeylanders/prose-minion-vscode/pull/216)
- **Original implementation head reviewed:** `13df46bf9ff777ee767a5c304260c7fbf9035945`
- **Base:** `epic/workshop-bookmark-recall` at `ddf83567fbf3901ae216a2c1de8ede6e72aa83fd`
- **Head branch:** `epic/workshop-bookmark-recall-slice-2-bookmarks-screen`
- **Reviewed:** 2026-11-05
- **Scope:** all 63 changed files, the accepted ADR D8 and Slice 2 implementation choices, affected store/recall boundaries, browser/preview integration, and interrupted Open flows.

## F-01 — P2: bookmark paging bypasses duplicate-session identity protection

**Anchor:** [`WorkshopSessionStore.ts:645–650`](https://github.com/okeylanders/prose-minion-vscode/blob/13df46bf9ff777ee767a5c304260c7fbf9035945/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L645-L650). Related: [`WorkshopRecallBookmarkPage.ts:77–94`](https://github.com/okeylanders/prose-minion-vscode/blob/13df46bf9ff777ee767a5c304260c7fbf9035945/packages/core/src/application/services/workshop/recall/WorkshopRecallBookmarkPage.ts#L77-L94).

`readPageEntry` puts each summarized file into the store's shared `namedSessionPaths` cache before recall performs its exact read. Two files claiming the same durable session ID overwrite that mapping. `findNamedSession` trusts the cached path if its decoded ID matches, bypassing the full scan that normally raises `WorkshopNamedSessionIdentityConflictError`.

This changes more than what the browser displays: subsequent Open, rename and delete use that same exact-resolution path. Merely browsing the new read-only screen can turn an ambiguous identity into an arbitrarily selected file.

**Reproduced with the real store and normal 25-file pages:**

1. Create 200 newer unique sessions plus two older valid files with the same ID, titled “Newer duplicate” and “Older duplicate”.
2. The existing `list()` returns only the 200 unique sessions. An exact read of the duplicate ID correctly rejects the conflict.
3. Walk the new bookmark pages. The duplicate page reports “Older duplicate” as both successfully read and unreadable: the first summary was retained, but the second file overwrote its exact-read path.
4. The same exact read now succeeds and selects “Older duplicate”.

A second case puts 224 unique sessions before the pair, splitting the duplicates across normal pages 9 and 10. Both pages show “Newer duplicate”, neither reports an unreadable file, and the second page hits the recall document cache. Exact resolution afterward selects “Older duplicate”. Per-page `seen` cannot establish identity uniqueness across pages.

The ordinary browser already contains a similar cache-seeding shortcut. These probes deliberately put both conflicting files beyond its 200-file cutoff: the conflict is rejected after the old browser runs and accepted only after the new paging path reaches them. This finding concerns the newly added path, not a claim that all pre-existing cache behavior originated in this PR.

**Requested correction:** do not promote unverified page summaries into the authoritative exact-action cache. Keep page-local reads distinct from identity resolution, and refuse or explicitly account for ambiguous IDs across the whole walk. Bookmark paging must not change a subsequent exact operation from conflict to success. Test both duplicates on one page and across page boundaries, with both files beyond the old cutoff.

**Reproducible witnesses:** [pr-216-bookmark-identity.test.ts.txt](probes/pr-216-bookmark-identity.test.ts.txt). Both passing tests record the defect on the reviewed head; corrected production regressions should require conflict protection to remain intact.

## F-02 — P2: a superseded bookmark Open hijacks a later ordinary Open

**Anchor:** [`useWorkshopBookmarkOpenAt.ts:73–93`](https://github.com/okeylanders/prose-minion-vscode/blob/13df46bf9ff777ee767a5c304260c7fbf9035945/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopBookmarkOpenAt.ts#L73-L93). The App drops the pending jump on explicit Cancel only, at [`WorkshopApp.tsx:994–997`](https://github.com/okeylanders/prose-minion-vscode/blob/13df46bf9ff777ee767a5c304260c7fbf9035945/packages/core/src/presentation/webview/WorkshopApp.tsx#L994-L997).

The controller retains a bookmark target until any `open` action succeeds or fails. It does not tie that result to the requested session or discard the target when another room action supersedes its confirmation. Any later changed `roomRevision` then satisfies the jump guard.

**Reproduced through the real App, session controller, router and host:**

1. Choose **Open at bookmark** in “Tea party”. Its Open confirmation appears.
2. With focus on a confirmation button, press the existing **Ctrl+Shift+N** shortcut. It replaces that confirmation with **New session**.
3. Accept New. The host resets the room; the original Tea party Open was never sent.
4. Later choose ordinary **Open session** for “The garden”. Its successful result arms the abandoned Tea party bookmark and scrolls/focuses that old turn ID in The garden.

The expected-behavior regression fails because `scrollIntoView` is called once during ordinary Open. The nine existing real-App bookmark cases still pass. Turn IDs are session-local and Branch preserves existing turns, so using the old ID in a different room can select unrelated content or request the wrong turn preview. Explicit Cancel is covered, but replacing a confirmation is not equivalent to Cancel in the current wiring.

**Requested correction:** make the pending jump belong to one specific Open operation and destination. Clear it when its confirmation or action is superseded, and require the completion/snapshot to belong to that target before jumping. Add this New-shortcut interruption and a later ordinary-Open control alongside the existing refusal/Cancel tests.

**Reproducible witness:** [pr-216-superseded-bookmark-open.patch](probes/pr-216-superseded-bookmark-open.patch). In a disposable checkout of the reviewed head, apply it with `git apply`, then run `npx jest --runInBand --runTestsByPath packages/core/src/__tests__/presentation/webview/WorkshopApp.bookmarkBrowser.test.tsx -t independent`. It adds the reset route to the existing real bridge and one expected-behavior test. It fails on the undesired jump, after verifying New ran and the abandoned Open did not.

## What reviewed cleanly

- The writer-facing live read includes the full ledger and private exchanges without widening persona access. Persona reads still use the existing audience filter; no new prompt injection path was found.
- Saved/live row and preview messages reuse the transcript projection and named-field preview copy. The sentinel tests retain the host-private body boundary.
- Normal paging reaches beyond 200 files, maintains cursor order, reports unreadable files, and respects the accepted soft byte bound. Closing/superseding pages cancels host work and drops stale replies at the client.
- The recall scope extraction preserves existing invalidation behavior. Composition still constructs one recall service in the adapter and passes it through `CoreServices`.
- Search covers loaded saved rows and complete live messages, with explicit remaining-session coverage. Session-qualified row keys distinguish ordinary repeated bookmark IDs.
- Normal saved/live Preview, in-window and out-of-window Open at bookmark, refusal, explicit Cancel, focus restoration, and shared-browser read-only behavior pass their focused regressions.
- Existing Workshop, Lightbox and memory browser tests remain unchanged and pass locally.

## Verification

- Clean isolated Git checkout of the exact implementation head; no product code changed for this review.
- **Local typecheck:** all three projects passed.
- **Local lint:** passed, **0 errors / 1,165 warnings**, matching the baseline.
- **Local build:** both webpack bundles and the Tailwind bundle-sentinel verification passed. The webview retains its three size/performance warnings.
- **Local focused production tests:** **24 suites / 323 tests passed**, in eight isolated three-suite batches. This includes every changed test plus existing Workshop/Lightbox/memory/shared browser and context/turn-preview regressions.
- **Independent witnesses:** two real-store identity witnesses pass while recording F-01; one real-App expected-behavior test fails on F-02. These are not counted as green product coverage.
- **PR CI for this exact source head:** [run 42049741315](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42049741315), `verify`, passed all typechecks, **743 suites / 10,390 tests / 59 snapshots**, lint and both webpack bundles. Its checkout was GitHub's merge candidate `93bcdf8dff49e0410fc95e494629ad55a52b23f2`, combining the stated source head and base, not a different implementation revision.
- Report-only publication will have its own CI run; this implementation result does not substitute for that later commit's verification.

## Accepted decisions and limits

The fourth cancel route, sibling handler, shared constants location, last-file byte-budget crossing, writer-visible private live bookmarks, temporary one-session coverage discrepancy, and cold saved-turn previews are documented accepted choices, not additional findings.

Native VS Code layout/keyboard acceptance remains the planned Slice 4 live pass. The interruption above is independently reproducible in the existing App/JSDOM harness and is not a claim of native browser QA. No live provider calls, production changes, formal approval or merge were performed.

## Resolution ledger

| Finding | Status |
|---|---|
| F-01: ambiguous page summaries alter exact identity resolution | Independently resolved at `f02a835a` for the paging path; shared pre-existing exact-cache behavior is outside this correction |
| F-02: superseded bookmark Open reuses its jump on another Open | Independently resolved at `f02a835a` |
| F-03: every page fully scans the legacy corpus outside its budget | Open, P2 |
| F-04: a larger legacy duplicate leaves a false actionable row | Open, P3 |

## Author response (`72f92970`)

| Finding | Resolution | Regression tests |
|---|---|---|
| F-01 | **Scope.** The fix stays inside this slice's paging code: `WorkshopSessionStorePage.ts`, the `listPage` seam, and the page read in `WorkshopSessionStore.ts`. The shared exact-read path cache is being fixed upstream in Pinned Context, and will reach this epic through an epic merge. `findNamedSession`, `list()`, `rememberNamedSessionPath`, the cache key and the identity-conflict handling are untouched.<br><br>**What changed.**<ul><li>**No cache writes.** `listPage` and its page reads no longer write `namedSessionPaths`, so paging can't prime the cache.</li><li>**Ids counted folder-wide.** Each page counts, over every file in the folder, the id each file claims (its search index, or the browser's bounded read). It marks an entry `ambiguous` when another file claims the same id.</li><li>**Ambiguous entries are never read.** Recall names them unreadable on whichever page they land, and never loads them. A duplicate is therefore never resolved to one file, and never counted as both read and unreadable, on one page or across two.</li><li>**Page-local reads.** A page reads its sessions with a new port method, `readPagedSession(cursor, sessionId)`. It reads the file the page's own entry names, and doesn't touch the cache.</li></ul> | `WorkshopSessionStorePage.identity.test.ts`, which turns your witnesses into regressions with the real store and recall service under the normal 25-file pages.<ul><li>"leaves an id two files claim unresolved after 200 newer files (on one page)" and "…after 224 newer files (split across two pages)": the exact read throws `WorkshopNamedSessionIdentityConflictError` before paging and again after a full walk; both files are named unreadable, and neither is counted as read.</li><li>"marks both claiming entries ambiguous at the store, on every page they land".</li><li>"reads a page's session only from the file its entry names" (rejects a path, `current.json`, or another file's id).</li></ul>`WorkshopTranscriptRecallBookmarkPage.test.ts` also now asserts that paging never calls `readNamed`. |
| F-02 | **What changed.** `useWorkshopBookmarkOpenAt` binds its pending jump to its own Open of its own session. It follows that Open through the session surfaces' `sessionConfirm`, `sessionActionPending` and `sessionActionResult`, in four phases (starting → confirming → opening → opened; `nextPhase`, pure).<br><br>It drops the jump as soon as anything else takes its place:<ul><li>a declined confirmation;</li><li>a confirmation replaced by New, Rewind or another session's Open;</li><li>a refused Open;</li><li>another action finishing in place of its Open;</li><li>an Open that never started.</li></ul>It jumps only after its own Open succeeded and a new room is on screen. `WorkshopApp` no longer needs to wrap Cancel. | Your real-App witness is kept in `WorkshopApp.bookmarkBrowser.test.tsx`, as "drops a bookmark Open the New shortcut supersedes, so a later ordinary Open does not jump (PR #216 F-02)". It fails on `13df46bf` (checked by restoring that revision's code) and passes now; the nine earlier App cases pass too.<br><br>`useWorkshopBookmarkOpenAt.test.ts` is rewritten. It covers confirmed and unconfirmed Opens, refusal, a declined confirmation, and New, another Open or Rewind replacing the confirmation followed by a later ordinary Open (no jump). It also covers another action finishing first, and an Open that never started. |

**The cost of F-01's fix.** A page now reads every file's id: its search index, or a bounded parse for an index-less legacy file. That is the same reading the exact-read scan already trusts, done once per page.

**Verification at `72f92970`:**
- typecheck: all three projects clean;
- lint: 0 errors / 1,165 warnings (baseline);
- jest: full suite with `--maxWorkers=4`, **744 suites / 10,399 tests / 59 snapshots**, all passing;
- no `vscode` import in core.


## Independent correction review — `f02a835a` (2026-11-05)

Reviewed the 16-file correction delta from `99172e5b`, including product fix `72f92970` and its author response. The original report-only head's CI also passed independently: [run 42059432450](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42059432450).

**F-01 resolved for exact-action safety.** The page now reads its own cursor through `readPagedSession`, which neither consults nor seeds `namedSessionPaths`. The original real-store 200/224-file witnesses, adapted to require the correction, pass: normal duplicates are excluded and exact reads reject the identity conflict both before and after paging. Cursor traversal, `current.json` and mismatched IDs are refused. The original cache corruption is closed; the two new issues below concern the replacement identity scan.

**F-02 resolved.** The original Tea party → New → ordinary The garden Open witness now passes through the real App/router/host bridge. The controller clears a target when its confirmation is replaced or cancelled and follows the matching confirmation into the pending Open. Independent real-App controls also pass for an Open from an empty room with no confirmation and Cancel followed by a fresh bookmark Open. No stale jump was reproduced in these flows.

### F-03 — P2: the identity scan bypasses page bounds and repeats on every Load More

**Anchor:** [`WorkshopSessionStorePage.ts:127–129`](https://github.com/okeylanders/prose-minion-vscode/blob/f02a835a1cc6b41345964e48268847314573c826/packages/core/src/infrastructure/storage/WorkshopSessionStorePage.ts#L127-L129), calling [`WorkshopSessionStore.ts:683`](https://github.com/okeylanders/prose-minion-vscode/blob/f02a835a1cc6b41345964e48268847314573c826/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L683).

After filling a bounded page, `claimsById` iterates the entire folder. An index-less legacy file's identity requires reading and parsing its full session through `browserSummaryForFile`. Those reads do not consume the page's file or byte budget, and no identity result is retained for the next page.

**Measured with the real store and unchanged 25-file/32 MiB limits:** 80 valid sessions each contain a real 1 MiB bookmarked reply, with no search-index sidecars. The first page returns 25 entries but performs **105 successful full-file reads / 110,402,125 bytes**. The second page again performs **105 reads / 110,402,125 bytes**. Both measurements exclude recall's subsequent document reads. These are accepted checkpoint bodies, not malformed files or whitespace padding.

Consequently the first screen load scans the full legacy corpus before showing a page, and a complete walk reparses the corpus for each 25-file page, making aggregate full-file work quadratic in corpus size. Per-file size checks and cancellation do not impose a total per-page bound.

The author response openly records the scan cost, but the retained [ADR D8](../adr/2026-11-05-workshop-bookmark-recall.md#d8-the-bookmarks-screen-read-only-through-the-recall-service) still requires host resource limits per page. This is not the accepted last-file crossing of the byte limit: it reads every remaining file, however many there are. Nor is an exact Open's full scan the same interaction as a deliberately paged read-only browser.

**Requested correction:** keep identity discovery within a bounded, cancellable, resumable read plan, and do not repeat full legacy JSON parsing on each Load More. If identity completeness requires a separate preparation stage, expose its coverage and limits honestly rather than performing unbounded work behind a bounded-page claim. Preserve duplicate-ID safety while restoring the page resource contract. Add an I/O-count/byte regression using index-less valid sessions.

### F-04 — P3: an unreadable identity is treated as proof of no duplicate

**Anchor:** [`WorkshopSessionStore.ts:678–684`](https://github.com/okeylanders/prose-minion-vscode/blob/f02a835a1cc6b41345964e48268847314573c826/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L678-L684).

`readFileIdentity` uses the 5 MiB browser bound for an index-less file and returns `undefined` when it cannot summarize it. `claimsById` ignores that outcome. Exact session decoding accepts up to 25 MiB, so a valid duplicate can be invisible to the new uniqueness check.

**Reproduced:** a small checkpoint and a checkpoint containing a real 6 MiB reply share an ID. The normal exact decoder accepts the larger file; exact ID resolution correctly rejects the conflict both before and after paging. Yet the bookmark page reports `read=1`, `unreadable=1` and emits the smaller session's bookmark as a normal actionable row. Its cold saved preview and Open then fail their exact identity check.

This is lower impact than original F-01: paging no longer changes exact resolution and no arbitrary destructive action is enabled. It is a false readable/actionable row and an incomplete claim that all duplicate IDs are marked ambiguous.

**Requested correction:** distinguish an identity that could not be established from a known nonmatching ID. Do not mark a row confidently readable when uniqueness has not been verified; account for the unresolved identity explicitly without solving it by adding another unbounded parse. Cover a valid checkpoint between the browser and exact-read limits.

**Both new witnesses:** [pr-216-correction-boundaries.test.ts.txt](probes/pr-216-correction-boundaries.test.ts.txt). They pass while recording current defects; corrected regressions should require bounded work and truthful identity/readability status.

### Correction verification

- All three local typechecks passed.
- Local lint on the clean tracked correction passed: **0 errors / 1,165 warnings**. An earlier run included four warnings from a temporary review probe; those are excluded from this result.
- **10 local production suites / 192 tests passed**, covering every changed test, composition/boundary guards and session-surface behavior.
- The original two identity witnesses pass with corrected expectations. The real-App run passes all ten shipped cases plus two independent repeated/interrupted-flow controls; those overlapping runs are not added to the production count.
- The two stronger boundary witnesses above pass with size in actual accepted reply content.
- [Correction-head PR CI 42061446542](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42061446542) passed: all types, **744 suites / 10,399 tests / 59 snapshots**, lint **0 errors / 1,165 warnings**, both bundles and bundle verification. Its merge candidate `1d99b19` combines this source head with base `ddf83567`.
- This report update will have a separate publication-head CI run. No implementation edits, native VS Code acceptance, live provider calls or merge were performed by the reviewer.
