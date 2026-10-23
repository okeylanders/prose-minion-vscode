# A Saved-Board Listing Stats Every File, and Its Summary Cache Has No Bound

**Date Identified**: 2026-10-22 (Lightbox Slice 5A, PR #163 re-review)
**Reviewed**: 2026-10-23 (Lightbox Slice 5A.2: every chapter is listed)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small to Medium

## Problem

PR #163 F-04 removed the 200-file cap: `LightboxBoardFiles.list` reads a
source's folder whole, so every saved board is listed and the same-text
check reads them all. Two costs grow with the history:

- **Every listing stats every file.** A warm listing (every summary
  cached) still calls `stat` once per file, one after another, to check
  each cached summary's size and modification time. The re-review's
  five-file control saw five stats and no payload reads; one changed
  modification time reloaded only that file. The rail asks for the shelf
  on every adoption, save and delete.
- **The summary cache has no bound.** A summary is kept per file id for
  the session, for every source listed, until its file is deleted through
  the store.

This is a scaling consideration, not a measured latency defect: Jest
timings in the cloud workspace say nothing about native VS Code, and a
chapter's history is usually tens of files.

**After Slice 5A.2 (2026-10-23).** The shelf now lists **every chapter's**
boards (`LightboxBoardFiles.listAll`), for the Boards menu and browser, so
each listing reads every chapter folder and stats every board file in the
boards folder, not one source's. Two things offset it: one file per board
(decision 41) means a chapter's history grows by boards, not by saves, and
the summary cache serves every folder. The webview asks for the shelf on
every adoption, save and delete, and again as the browser opens.

## Recommendation

When a history reaches hundreds of files, or a writer reports a slow rail:
- stat in small parallel batches, or keep the folder's own modification
  time and a directory listing, and stat only names that are new;
- bound the cache (least recently listed source first), or keep summaries
  only for the sources a retained board names;
- keep the listing complete: never cap what is listed or what the
  same-text check reads (PR #163 F-04).

## Related Files

- `packages/core/src/infrastructure/storage/LightboxBoardFiles.ts` (`list`, `listAll`, `summaryOf`)
- `packages/core/src/infrastructure/storage/LightboxBoardStore.ts`

## Completion Criteria

- A warm listing of a large history costs measurably less than one stat per
  file, with a store test that counts file-system calls.
- The summary cache has a stated bound, with a test that it evicts.
- `LightboxBoardStoreHistory.test.ts` still lists every board.
