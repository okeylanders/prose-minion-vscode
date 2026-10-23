# PR Review — Lightbox Saved-Board Browser, Slice 5A.2

**Author:** okeylanders · **PR:** [#167](https://github.com/okeylanders/prose-minion-vscode/pull/167) (open, unmerged at review)  
**Branches:** `epic/lightbox-boards-browser` → `epic/lightbox`  
**Reviewed implementation head:** `4e0be764157d046fdc07fbbcb2baf1d38b7a7b02`  
**Base and verified merge-base:** `08b0d22600fe97c7941adcc464d06b1cb77d6e28`  
**Scope:** 140 files · +10,002 / −3,052  
**Reviewed:** 2026-10-23 · **Reviewer:** Astra  
**Mode:** independent source/contracts review; deterministic production-host and UI/host regressions; retained storage/codec controls; regenerated host evidence; exact rebuilt-bundle DOM execution; supplied pixel inspection; fresh full gates

## Summary

**Request changes. Three P2 regressions remain open:** a completed reading can be silently omitted from disk when the next run overlaps its queued save; an open rename draft can be redirected to a different board and rewrite the wrong saved file; and a failed rename leaves the new name labelled Saved while hiding the host warning. Four independently reproduced P3 follow-ups are nonblocking. The fresh full gates pass, but do not cover these discriminating sequences.

The one-file-per-board policy, dated first name and replacement of the rail are intentional decision 46 changes, not regressions merely because earlier snapshots or tests expected a new file on every save. The decision and reported writer testing are design context, not independently verified native or real-chapter acceptance.

This review does not include PR #166's separate run-controls branch. No result here is combined integration clearance, a formal GitHub review, a merge instruction, approval for Slice 5B, or authorization to publish the extension. A later base/merge change needs review at its actual integrated head.

## Findings and disposition

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| F-01 | P2 | Open, blocking | A later running state replaces the completed reading owed to a queued save |
| F-02 | P2 | Open, blocking | Board adoption redirects a typed rename to the wrong saved board |
| F-03 | P2 | Open, blocking | Failed rename persistence is hidden while the menu says Saved |
| N-01 | P3 | Open, nonblocking | Successful in-place save does not clear prior failed-save status |
| N-02 | P3 | Open, nonblocking | Already-saved imported board still promises its first store save |
| N-03 | P3 | Open, nonblocking | External-read error logging includes the selected absolute path |
| N-04 | P3 | Open, nonblocking | Deleting the final saved board drops focus outside the dialog |

## F-01 — Save the completed reading, not a later in-flight board

**Location:** [`LightboxBoardSaves.ts:83–107`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/application/services/lightbox/LightboxBoardSaves.ts#L83-L107).

The new `latest()` lookup replaces the completed run's captured board with whatever is live when the store queue and file read finish. A second run can have started meanwhile. Its `running` / pending groups are deliberately not valid saved data, so the in-place rewrite rejects the board and the new-file fallback rejects the same live state.

Independent production-handler sequence, with a stub provider and a held ordinary store read:

1. A measured board already has its file. Hold the store queue on that read.
2. Complete a Characters reading, group B. Its autosave queues behind the read.
3. Start Genre, group C, and hold its response. Release the store queue while C is running.
4. The B save rejects the now-running board. Cancel C before any group comes back, so C schedules no repair save.
5. B remains visible in memory, but the saved bytes and a fresh host restored from disk contain **no completed group B**. The menu still says **Saved**, with `lastSaveFailed: false`; the On screen row reports no read lenses.

The desired persistence assertion fails on this head. The no-second-run control passes. The identical race and failure-recovery tests pass on the source-equivalent base checkout (`bdec17f05`; only the #165 report separates it from `08b0d226`). The old library captured a settled board object, and later run updates replace that object rather than mutate it. This is new loss of completed, potentially paid reading results on reload, not the existing tied-clock recovery debt, and not a native latency claim.

**Requested correction:** keep a valid settled reading snapshot for an already-owed save, even if another run starts while it waits. Continue resolving file/revision ownership and queued name/Spark edits correctly; do not persist transient running state or silently drop the prior save. Make failed-save reporting truthful too. Retain the queue-hold/cancel witness, its no-overlap control and a later-run-success control.

## F-02 — Bind the rename draft to the board it was opened for

**Location:** [`LightboxApp.tsx:418–424`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/presentation/webview/LightboxApp.tsx#L418-L424), with draft retention in [`LightboxBoardNameModal.tsx:46–64`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/presentation/webview/components/lightbox/LightboxBoardNameModal.tsx#L46-L64).

The name sheet survives an on-screen board replacement. Once the writer types, its draft no longer follows the new name, but its submit callback does follow the latest on-screen board. Rename remains available while a recent board is opening.

Independent UI-to-production-host/store sequence:

1. Board A is on screen. Open saved board B from Recent and hold its ordinary filesystem read.
2. Reopen Boards → Rename board while A is still displayed; type a name intended for A.
3. Let B's read complete. B is adopted, but the still-open sheet retains A's typed draft.
4. Submit. The UI sends `LIGHTBOX_RENAME_BOARD` with **B's board id**, `fileId: null`, and A's draft. The real store rewrites **B's saved file** with that name; A's file stays unchanged.

The base-compatible app regression passes on the base and fails here. The prior rail was keyed by board id. This is a wrong-target mutation, not just a stale modal label. A separate source adoption while the sheet is open has the same unbound-target risk.

**Requested correction:** dismiss/reset the sheet on board replacement, or capture and validate the original board/file/adoption target. Never retarget an already-typed draft to another board. Keep the held-read cross-layer witness and an ordinary same-board rename control.

## F-03 — Show rename persistence failures after the name sheet closes

**Locations:** [`LightboxBoardNameModal.tsx:80–83`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/presentation/webview/components/lightbox/LightboxBoardNameModal.tsx#L80-L83), composed by [`LightboxApp.tsx:404–424`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/presentation/webview/LightboxApp.tsx#L404-L424).

The menu name sheet closes immediately after submitting. The saved-board browser is also closed, but it is now the only renderer of `shelf.notice`.

Independent UI-to-production-host/store sequence:

1. Rename a saved on-screen board through Boards → Rename board.
2. Inject EIO only into the real store's staging-file writes.
3. The host keeps the name in memory, safely leaves the original saved file unchanged, and returns `nameKeptFailed`, explicitly warning that the file could not be changed.
4. The sheet has closed. The header shows the new name and **Saved**, while the warning is absent from the DOM. A later reload returns the old name without the writer having seen that the rename failed to persist.

The witness verifies the old file name is unchanged, the host notice exists, and **zero source-refusal messages** are emitted. This is missing mutation-outcome feedback, **not file corruption**. The equivalent app assertion passes on the base, where the visible rail displayed the warning. A second base-discriminating assertion also establishes the hidden shelf-only refusal when a run begins while an open is waiting for its file. Do not generalize this to malformed, missing or otherwise refused source opens: those use the separate source-alert path.

**Requested correction:** retain a visible, accessible mutation/refusal outcome surface even after the initiating sheet or browser closes, and do not imply the new name was saved when only the in-memory change succeeded. Keep the real staging-write failure witness; closing the sheet immediately is not itself the defect.

## N-01 — Clear failed-save status when an in-place save succeeds

**Location:** [`LightboxBoardStore.ts:272–277`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/infrastructure/storage/LightboxBoardStore.ts#L272-L277).

A transient staged-write failure makes an existing board's rewrite and new-file fallback fail, setting `lastSaveFailed`. After the fault clears, a successful in-place autosave returns through the new early `replaced` branch without clearing the flag; only the new-file commit does so. The independent desired assertion fails on this head and passes on the base. Consequently the menu continues saying Save failed, and the browser's warning says the board is session-only, despite a successful saved file. This is a **nonblocking P3 status-recovery defect**, not lost bytes. Clear the flag at a successful commit in both save paths, before publishing the resulting shelf.

## N-02 — Stop promising the imported board's first save after it has saved

**Locations:** [`LightboxBoardLibrary.ts:388–392`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L388-L392), [`lightboxBoardsView.ts:294–297`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxBoardsView.ts#L294-L297).

After an external snapshot's first successful reading save, it has a store file, a revision and an On screen row. Its original external bytes are unchanged. But the notice still says, “Its next save writes it there, as a file of its own,” because `outside` is derived from immutable opening origin rather than current saved ownership. The independent follow-through assertion fails. This is a **nonblocking P3 copy/state defect**: preserve the useful origin history, but distinguish “opened outside” from “not yet saved here.”

## N-03 — Do not include the selected external path through filesystem error text

**Location:** [`LightboxBoardFiles.ts:188–189`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/infrastructure/storage/LightboxBoardFiles.ts#L188-L189), through the catch at lines 173–178.

The new outside-read wrapper substitutes a generic file label, but the shared catch still appends raw `error.message`. An independent local filesystem test creates a made-up file, denies its read permission and passes the actual resulting EACCES through production `readOutside`. The complete selected absolute path is logged. This contradicts the explicit 5A.2 promise that logs never name the picked path. The refusal remains correct and no manuscript body was exposed in the witness. This is a **nonblocking P3 privacy-contract defect**, verified through a local Node filesystem port, not a native VS Code run. Log a host-owned reason or safe error code on external reads instead of raw provider wording, and retain a real path-bearing-error regression.

## N-04 — Keep focus inside the browser after deleting its final board

**Location:** [`LightboxBoardBrowserModal.tsx:103–109`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/presentation/webview/components/lightbox/LightboxBoardBrowserModal.tsx#L103-L109), using the shared fallback in [`SavedItemBrowserModal.tsx:157–166`](https://github.com/okeylanders/prose-minion-vscode/blob/4e0be764157d046fdc07fbbcb2baf1d38b7a7b02/packages/core/src/presentation/webview/components/fulltab/SavedItemBrowserModal.tsx#L157-L166).

Confirm deletion of the final saved board, then deliver the refreshed empty shelf. The shared browser attempts to focus search because there is no next Delete button, but Lightbox has disabled that input when there are no rows. Focus falls to `document.body` outside the still-open dialog. Deleting an interior row correctly focuses the next Delete, and Escape from inline rename correctly restores Rename focus. This is a **nonblocking P3 keyboard-focus defect**, established with DOM focus checks, not a native geometry claim. Keep search focusable or choose another enabled in-dialog fallback when the last row disappears.

## Verification and evidence boundaries

| Check | Independent result on `4e0be7641` |
| --- | --- |
| Full repository Jest, cloud workspace Node 24.19.0 | **499 suites / 6,896 tests / 59 snapshots pass**, 383.188 s reported by Jest |
| Typecheck | **Pass** |
| Lint | **0 errors / 1,133 warnings**, identical to retained #166/#165 baseline by relative file, rule and severity |
| Production build, including `verify:bundle` | **Pass**, existing webpack size warnings only |
| Independent completed-save/recovery probes | **1 pass / 3 desired-behavior failures**, 4 tests in 2 suites, 7.025 s; F-01 and N-01/N-02 above. Three shared tests all pass on the base, 6.66 s |
| Retained #163/#164 codec/storage/recovery probes | **38 tests in 5 suites pass**, 14.085 s; no removed-rail/pagination premise imposed on this slice |
| Regenerated production-host evidence | **1 builder test passes**, 6.734 s; `boards.json` and `log.txt` byte-identical to committed evidence |
| Workshop extraction | **15/15 markup-and-focus states identical** at base/head (11 tests each); **141 moved CSS entries** identical after scope normalization, zero changed entries; structural comparison only, not an independent computed-style/geometry run |
| Independent picker/listing/source controls | **14 pass / 1 desired privacy-contract failure**, 15 tests in 2 suites, 8.205 s; N-03 above |
| Independent UI / actual host-store regressions | **3 controls pass / 6 desired-behavior failures**, 9 tests in 3 suites, 11.048 s; F-02/F-03/N-04 above. All four applicable app tests pass on the base, 8.375 s |
| Exact rebuilt production-bundle DOM | **5/5 ordinary scenarios pass**, zero runtime/assertion errors; repeated search/group changes, recent-five menu, explicit rename/delete cancellation and focus, reopening/reset, changed/outside opens, session-only and no board-name/file-id webview persistence |
| Diff whitespace / implementation scope | **Clean**; no implementation changes |
| Exact implementation-head configured CI | **Both events success**; inspected PR job uses Node 18.20.8 and reports 499 / 6,896 / 59 |

CI: [pull-request run 40014557790](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40014557790), [push run 40014392887](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40014392887).

Rebuilt SHA-256 values match the author evidence:

- `webview.js`: `1f28383f3a8ebffbf6dbe55652411eddbbcb28f30f4287add6cf45c161f37a2e`.
- `extension.js`: `44596e6911cb731f26532f2ca87b645f4fe0188a47d7818da6ceea1d42463b9b`.

The independent desired-behavior failures above are intentional red regressions demonstrating the findings, not passing coverage. Initial evidence-harness module-resolution/type setup failures were corrected before these final runs; no production code was changed. The production JSDOM run reports one unsupported CSS parse warning per scenario, excluded from runtime assertions: it does not validate computed styles.

Heavy jobs were serialized. Disk-backed dependencies were reused after verifying the unchanged lockfile, with current-workspace package links. Only public-domain *Alice* and synthetic data were used; no private manuscript, live/billable provider, formal review, merge, deployment or extension publication occurred. Only this report is published.

Independently inspected seven supplied captures: menu at 500 px, chapter browser at 500 px, delete confirmation at 1000 px, inline rename at 500 px, session-only browser at 1440 px, outside snapshot at 1000 px, and Workshop browser at 500 px. The supplied narrow states are legible and the chapter lines wrap; no additional clipping defect was established. These pixels and JSDOM do not establish native VS Code geometry, native keyboard default behavior, screen-reader behavior or writer acceptance. No denied browser route was retried. All timings are their stated cloud/CI execution context, not native UI latency measurements.

## Contracts retained and boundaries not promoted to findings

- **Architecture and fixtures:** no production core import of `vscode`; no added `any` type; the only changed production module over 500 lines is the already-oversized `MessageHandler`. Both authentic format-1 fixtures are byte-identical to the prior baseline. The base is an ancestor of this head; the clean three-way merge tree equals the head tree and retains the earlier review reports.
- **Existing recovery debt:** #164 N-03's equal-millisecond claim recovery remains the acknowledged, narrow nonblocking debt. The note now explicitly explains that in-place reading saves widen what an older recovered version could contain; this is not treated as a newly assigned implementation defect here.
- **Picker and source safety:** cancellation changes no source intent; concrete selection takes its ticket before reading; newer source choices and refusals beat older reads; a run started during the read blocks adoption. Imported bytes remain unchanged while the saved copy keeps board id and name. Changed, missing and escaping chapter paths retain Bring guards; malformed source data is rejected without exposing manuscript content. All-source summaries contain no source bodies/readings, classify unreadable folders, and include 201 files across three chapters.
- **External reload boundary:** opening an unsaved external snapshot still leaves the previous stored reload pointer until the imported board saves. This is characterized, not promoted into a blocker or a promise of external-file reload retention that the slice does not explicitly make.
- **Listing scale:** all-source listing intentionally expands the scan, and the existing note records sequential stats and an unbounded summary cache. Completeness must not be repaired by restoring a silent cap. The independent warm 201-board listing makes 201 stats and zero payload reads. No native latency claim is made.
- **Saved time:** reading autosaves advance `savedAt`; the older field-only rename/Spark transforms preserve it. The broad 'each save' prose could be clearer, but the retained 5A.1 timestamp contract is not silently converted into a new correctness requirement.

## Correction handoff

1. Fix F-01 without regressing revision ownership, fallback copies, queued metadata edits, or the current-board reload-pointer guard. Retain completed-save overlap/cancel and later-success controls.
2. Fix F-02 with an explicit name-sheet identity boundary, including adoption while a filesystem open is pending.
3. Fix F-03 with visible persistence outcomes after sheet closure. The failing saved file must stay unchanged; the UI must not suggest the in-memory rename was durably saved.
4. Resolve N-01 through N-04 as focused status, copy, privacy and keyboard follow-ups. They do not independently block this slice.
5. Re-run the discriminating regressions plus full gates, and check the actual new head. If #166 or other base changes integrate first, review that combined head and conflict resolution separately. No native/real-chapter or future-slice acceptance is inferred from these checks.

## Author response (2026-10-23)

**All seven findings are fixed.** The commits on top of your report's
commit `77f9ebe` are:
- `2de78db7`: the corrections;
- `b15a5e36`: the merge of `epic/lightbox` at `fcf86ff` (Slice 4I, PR
  #166), which merged first, as you anticipated;
- `fed2e929`: a test of decision 47 through an owed save;
- the commit that adds this response, renders the evidence again, and
  records the corrections in the slice notes, the ADR's D12 addendum, the
  agents guide and the epic.

Nothing above this section was edited.

Each sequence you gave is now a regression test. With the new and changed
tests run on your reviewed code's source files (`77f9ebe`, type checks
off, so each test reports), **21 of the 129 tests in the nine suites
fail**:
- F-01: 3;
- N-01: 2;
- F-02: 6;
- F-03: 5;
- N-02: 2;
- N-03: 1;
- N-04: 1;
- the app's existing rename test, whose message now carries the sheet's
  adoption.

Every control you named passes there, with one exception: the same-board
rename. It fails only because the message it expects carries the
`adoption` the old webview does not send; the sheet stays open and the
rename goes to the same board. Two of your host sequences pass at both
heads:
- **The held-read rename:** the host renamed the board whose id it was
  sent. The wrong target came from the webview's sheet.
- **The staging-write failure:** the host left the file as it was and
  said so. The notice had nowhere to show.

Both are kept as host tests, beside the webview tests that fail there.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | P2 | **Fixed** | **A save writes the board it was owed.** `LightboxBoardSaves.save` captures the settled board when the run finishes. At its turn in the store's queue, `owedBoard(captured, now)` takes the board as it then stands only when nothing on it is reading (`lightboxBoardSettled`: no group `running`, nothing `pending`). Otherwise it takes the captured board, carrying the file, revision and name the board holds now. So the file it rewrites is the board's own, a fallback copy is followed, and a rename or spark mark given while it waited is written. A board replaced in the meantime is written as captured and never pointed at (the reload-pointer guard is unchanged). Nothing transient is persisted.<br>**Truthful status:** the save path moved out of the store into `LightboxBoardSaving.ts` (the store is 429 lines, was 489). It reports each commit and each failure to the store, which sets `lastSaveFailed` on a failed write or on a board that would not read back whole | `LightboxBoardOwedSaves.test.ts` (new):<br>• **Your sequence:** the board's read held, B landed, C started and held, the read released, C stopped before any group came back. B is on disk, a new host restores it, the menu's availability says not failed, and the row on screen lists Characters<br>• a name given while the save waits is the one it writes<br>**Your controls:** no second run; the later run succeeds, and its own save adds C to the same file<br>`LightboxBoardStoreInPlace.test.ts`: a board with a reading in flight is not written, and the save says it failed | `2de78db7` |
| F-02 | P2 | **Fixed** | **The sheet names its target.** `useLightboxBoardsSurface` opens the name sheet for `{ boardId, adoption }`, taken from the shelf answer on screen. `LightboxApp` closes the sheet, sending nothing, when another board or another adoption of the same board comes on screen, so a typed draft is never retargeted. Rename board… is disabled ("A board is opening") while an open or "Open a board file…" waits.<br>**The host checks it too.** `LIGHTBOX_RENAME_BOARD` carries the sheet's `adoption`. A rename of the board on screen (no file) whose adoption has changed is refused with nothing written, and the shelf says "Another board came on screen before the name was given, so nothing was renamed." (`boardChanged`). Source adoption is under the same rule | `LightboxAppSavedBoards.test.tsx`:<br>• **Your held-read sequence:** the sheet closes, sending nothing, when B comes on screen while A's draft is typed; reopened, it starts from B's name<br>• closes on a newer adoption of the same board<br>• Rename held back while a board opens<br>**Your control:** the same board, its shelf pushed again at the same adoption, keeps the sheet and its draft, and renames it<br>`LightboxBoardRenames.test.ts`: your held-read open of board-2, then a rename for board-1, names board-1's file only; a draft for an earlier adoption is refused, and nothing is written; the current adoption is renamed<br>`useLightboxBoards.test.ts`: the rename sends the sheet's board and adoption | `2de78db7` |
| F-03 | P2 | **Fixed** | **Outcomes have a surface of their own.** `useLightboxBoards` takes the host's notice from any answer to an open, delete or rename, even one a newer request has superseded; a plain shelf request leaves it alone. `LightboxBoardsOutcome` shows it under the header, `role="alert"`, with Dismiss, until dismissed or replaced by the next such answer. It outlives the sheet and the browser. It also shows the shelf-only refusal of an open while a run reads the board on screen.<br>**No false "Saved".** The menu says "Name not saved" when the board's name is not the one its file holds.<br>**Source refusals** (malformed, missing) stay on the board's source alert | `LightboxBoardRenames.test.ts`: **your staging-write EIO**, the file byte for byte as it was, `nameKeptFailed`, the row still under its old name, no source refusal<br>`LightboxAppSavedBoards.test.tsx`: after the sheet closes, the banner holds the host's words and the menu says "Name not saved"; the open refused while a run reads is said there, and the next answer with nothing to say clears it; **control:** a malformed source is said on the board, not in the banner<br>`lightboxBoardsView.test.ts`: "Name not saved"<br>`useLightboxBoards.test.ts`: superseded answers, plain shelf answers, Dismiss<br>**Evidence:** the `kept` state | `2de78db7` |
| N-01 | P3 | **Fixed** | The store's `committed()` status clears `lastSaveFailed` on every commit, in place or to a new file. It runs before `onCommitted`, so the shelf the commit publishes is already clear. It logs "Boards are saved again after an earlier failure." | `LightboxBoardStoreInPlace.test.ts`: failing writes, then an in-place save. The flag is clear by the time the caller hears the commit<br>`LightboxBoardOwedSaves.test.ts`: through the host, EIO then a later in-place save | `2de78db7` |
| N-02 | P3 | **Fixed** | `lightboxSnapshotNotice` bases its words on the board's saved ownership now, and keeps the opened-from-outside history separate. Once the board has a file here, it says "It is saved in the boards folder now, as a file of its own; the file it came from is as it was." | `lightboxBoardsView.test.ts`; your follow-through in `LightboxBoardsBrowser.test.ts` | `2de78db7` |
| N-03 | P3 | **Fixed** | A read outside the store logs `(<code>)` from the error's `code`, when it is a plain identifier, and never its message: "Could not read a board file outside the boards folder: (ENOTDIR)" | `LightboxBoardStoreChapters.test.ts`: a real `node:fs` error whose message names the absolute path; the log carries the code and not the path | `2de78db7` |
| N-04 | P3 | **Fixed** | When the browser's search is disabled after the last delete, the shared browser's `returnFocus` path focuses the dialog's Close button. Only the Lightbox opts in, so the Workshop's markup and focus are unchanged | `LightboxBoardBrowserModal.test.tsx`: focus on "Close saved boards"; **control:** search keeps focus when rows remain | `2de78db7` |

### Decision 47 after the merge

4I's decision 47 keeps the old Opinion when the Opinion's call, run on
its own, fails, and the board saved after the failure holds it. Here is
how it fits this slice:
- **One file per board.** 4I's test counted a new file for that save. It
  now checks that the board's one file is rewritten in place and holds
  the failed call with the old Opinion, standing and stale marks
  included, and that a reload restores it. The stopped-call case checks
  that the file is byte for byte as it was.
- **F-01's owed save.** A failed Opinion call's board is settled (the
  call `failed`, nothing `pending`), so the owed save writes it as it
  stands. In `fed2e929`: if the writer runs the Opinion again before that
  save's turn, the save still writes the failed call with the old
  Opinion, never the running board. Stopping the second call then saves
  nothing, and a reload restores the old Opinion. With the save path as
  it was at `77f9ebe`, the running board would not read back whole, and
  the file kept the call as `ok`.

### Verification on the merged head

Each check below ran on the code as pushed, after `npm ci` into the
worktree's own `node_modules`.

| Check | Base `fcf86ff` | This branch |
| --- | --- | --- |
| Full `npx jest`, Node 22.22.0 | 495 suites / 6,905 tests / 59 snapshots (an export, measured) | **504 / 7,000 / 59, all pass** |
| Full `npx jest`, Node 18.20.8 (CI's) | 495 / 6,905 / 59 | **504 / 7,000 / 59, all pass**, first run |
| `npm run lint`, both Nodes | 0 errors / 1,133 warnings | identical per file, rule and severity |
| `npm run typecheck`, both Nodes | — | pass |
| `npm run build` with `verify:bundle`, twice under each Node | `webview.js` `09deafc2…5fdd1` (the export, for the evidence's before) | `webview.js` `1fe072462cbcf8f410b8232ec2535a1f166d10cf9fd559e437445da914e6fe15`, `extension.js` `805bd13410f9f202f1c71bae59929989c396df783a22b9f4eb35c6ead0646d02`, all four times |
| `git diff --check` | — | clean on these commits; since `77f9ebe` the only hits are the two review reports' own Markdown line breaks |

Before the merge, at `2de78db7`, the changed suites and the architecture
guards passed, and so did the typecheck and lint of the changed files.

**Evidence**
([`lightbox-slice-5a2-visual`](evidence/lightbox-slice-5a2-visual/README.md)),
rendered again on this bundle:
- **11 states, 33 captures**, `errors.txt` empty. The new `kept` state is
  your F-03 sequence through the menu's sheet. The host's answer was
  recorded with the staged write failing (EIO), and the file is byte for
  byte as it was. The page shows "Name not saved" and the banner after
  the sheet closes, and it sent the board and adoption the sheet was
  opened for.
- **The ten earlier states' DOM facts are identical** to the render
  before, apart from random request ids. Their pixels moved under 4I's
  run controls.
- **Against `fcf86ff`'s bundle**, 204 errors and exit 1: the ten earlier
  states' 183, and `kept`'s 21.
- **Against your reviewed head's bundle** (`4e0be76`, `1f28383f…7a2e`):
  9 errors, all in `kept`, three at each width (`errors-4e0be76.txt`).
  The menu says "Saved", there is no banner once the sheet closes, and
  the rename names no adoption. The other ten states pass there.
- **The Workshop**, before (`fcf86ff`) and after: markup, every computed
  style and box identical in all fifteen pairs, `workshop-errors.txt`
  empty. In jsdom, 15 of 15 states are identical, focus included.

The evidence and gates prove nothing beyond themselves: this is headless
Chromium and jsdom, not the VS Code webview, and no native, real-chapter
or writer acceptance is claimed. Only public-domain *Alice* and made-up
names were used, with placeholder models. There were no live or billable
calls.

### What changes in the PR body

- **Verification:** the counts and hashes above, with `fcf86ff` as the
  base.
- **"`LightboxBoardStore` is at 489":** it is 429 now, with the save path
  in `LightboxBoardSaving.ts`.
- **"Conflicts with 4I":** 4I is merged.
- **The menu's statuses** gain "Name not saved", and **the outcome
  banner** under the header is new.
- **`LIGHTBOX_RENAME_BOARD`** carries `adoption`.
- **The evidence:** 11 states and 33 captures, and 204 errors against the
  base.
- **Decision 47** is kept through one file per board and the owed save.

"Open a board file…", the one-file-per-board rules and decision 46 are as
the body describes.

## Independent correction and integration re-review — 2026-10-23

**Reviewed correction head:** `14c371869e58dee0e7c7b990ec039024c18e05f1`

**Actual integrated base and verified merge-base:** `fcf86ff8077a9e4e58895860ce78366a64522c39` (merged PR #166)

**Delta reviewed:** `77f9ebeb1f3ae10295679d412a4c34ac1501eea1..14c371869e58dee0e7c7b990ec039024c18e05f1`, 211 files, +11,767 / −536, including the #166 integration, tests, documents and regenerated evidence. Current PR against its base: 150 files, +11,755 / −3,096.

**Reviewer:** Astra · independent re-review, not an author-test-only disposition

### Latest disposition

**Request changes remains: F-01 is partially corrected but still open (P2).** The original in-flight-save failure is fixed, but an independently reproduced cancellation-order variation still loses a completed reading on disk and reload. **F-02, F-03 and N-01 through N-04 are closed.** This latest disposition supersedes the original seven-open ledger; the author’s stated resolution is preserved above as their response, not adopted as independent acceptance.

The entire original report and author response above are preserved. The actual #166 integration was inspected and tested here, rather than inferred from the separate branch reviews. This is technical review of this exact tree, not a formal GitHub approval or instruction to merge, native/real-chapter or writer acceptance, Slice 5B approval, or authorization to publish the extension.

| ID | Independent correction result |
| --- | --- |
| **F-01 — P2, open / partially fixed** | The original running-board rejection and Opinion overlap cases now pass. The added zero-result Stop-before-queue-release ordering below still silently discards the completed reading; its counterpart and both actual-base orderings pass. |
| **F-02 — closed** | Board/adoption capture, replacement dismissal, pending-open/picker disabling and same-adoption draft retention are checked through the app and actual host/store. |
| **F-03 — closed** | The real staging-write EIO leaves the original file unchanged and now has a visible post-sheet outcome; the menu qualifies the name as not saved. |
| **N-01 — closed** | The original failure-then-success witness passes. In-place and new-file commits clear the failure flag before announcing the commit. |
| **N-02 — closed** | The original imported-board follow-through passes: the notice changes after its first store save, and the external original remains byte-identical. |
| **N-03 — closed** | External reads log a bounded error-code token, not a filesystem message; the real path-bearing-error witness and adversarial cases are checked. |
| **N-04 — closed** | Final-row deletion uses the enabled dialog Close control, with next-row and explicit-cancellation controls retained. |

### Integration and correction controls

#### F-01 remains open: a stopped rerun is settled, but does not own a save

**Location:** [`LightboxBoardSaves.ts:150–168`](https://github.com/okeylanders/prose-minion-vscode/blob/14c371869e58dee0e7c7b990ec039024c18e05f1/packages/core/src/application/services/lightbox/LightboxBoardSaves.ts#L150-L168), particularly the `return now` at lines 154–155.

The new `owedBoard` protects the captured completed reading only while the latest board contains a running/pending group. A zero-result Stop removes those markers. The board is now valid to encode, but it is not the completed state that this earlier save owes.

Independent real-handler/store sequence, with synthetic responses and a held ordinary store read:

1. The measured board already has its initial saved file. Hold the store queue on a read of that file.
2. Complete Characters B; its three tiles are visible and its autosave is waiting behind the read.
3. Start B again through the new standalone call scope (`{ mode: 'group', group: 'B' }`, not a per-lens re-read). As decision 42 intends, the on-screen B group is cleared while the response is held.
4. **Stop this rerun before releasing the store read.** The actual progress reports `groupsBack: 0`; Stop owes no new save. Its late provider response is ignored.
5. Release the store queue. `lightboxBoardSettled(now.board)` is true for the cancelled group, so the earlier B save writes that cancelled state instead of its captured completed B. The sole file and a fresh host restored from it contain **cancelled B with zero tiles**. The On screen row has no Characters lens and `lastSaveFailed` is false.

The same test with **release before Stop** saves/restores B as `ok` with all three tiles. Both orderings pass on the actual #166 source-equivalent base (`3cd2be0e`; production-source comparison against merged `fcf86ff` is empty). On corrected #167, only Stop-before-release fails. The original four independent probes and five added rename/Spark/fallback/Opinion controls pass.

This is **not** a request to reverse #166’s intentional on-screen clearing policy. The already-completed reading must reach disk even when the next run lands nothing; whether it does must not depend on which side of a queue release the writer presses Stop. It is a continuation of F-01’s lost-owed-save defect, not a new tied-clock recovery finding. Since these cancelled bytes are valid, the new failed-save flag cannot detect the loss.

**Requested correction:** distinguish the settled state actually owed by a completed run from a later merely-stopped state. Preserve the appropriate completed snapshot while still carrying current file/revision/name ownership and queued Spark edits; keep both ordering controls, the later-success control and the Opinion retention controls. Re-run this regression before closing F-01.

The save correction’s other interactions were exercised, not assumed: queued rename, Spark dismiss and Undo, follow-on revision continuity/reload, and two owed saves following a conflict fallback all pass. Both current and changed-text/stale Opinions survive a failed standalone rerun overlapped by another running retry, then cancellation and reload. Replacing only the save module with the exact pre-correction module produces **two expected Opinion failures**; this is a targeted old-save-path substitution in the current merged host, not a claim that the entire old #167 head had #166’s semantics.

The retained #166 host probes exercise scope rejection/planning, model/estimate ownership and the real $0.063 synthetic-usage witness: the Opinion’s approximate estimate is not a spending cap. One saved-board probe was intentionally adapted from the superseded new-file-per-save expectation to decision 46: the same file changes, sibling groups and unrelated bytes remain intact, the reload pointer follows it, and reload restores both groups. The deletion-during-call control still does not resurrect the deleted file.

UI/host regression tests now prove F-02 and F-03 through actual saved-file effects, not only callback inspection: adoption during a typed draft sends no rename and leaves both saved names intact; staging EIO leaves the saved bytes intact, displays the host warning after sheet closure and says **Name not saved**; a successful retry clears the warning and restores **Saved**. Same-id/new-adoption replacement closes the sheet, a same-adoption update preserves its draft, and Rename is unavailable during a pending open/picker or before the first shelf. Repeated cancellation, retained/superseded known outcomes, Dismiss and duplicate-answer handling pass. Deleting the last row focuses Close, with next-row and Escape controls passing.

The unchanged integrated #166 control semantics are replayed on the exact rebuilt bundle: approximate Opinion price/limit-input qualification, visible-label prefixes in computed accessible names, headline button identity/focus through run/success/failure/cancellation, and earlier-Opinion qualification. This is DOM/state/transport/focus evidence, not native accessibility acceptance.

Production host fixtures were regenerated on this actual merged tree. The 5A.2 `boards.json` and log are byte-identical to the committed correction evidence. The #166 `run-controls.json` is **not** byte-identical to its older committed fixture: all 96 differing JSON paths are in the saved-board mount/shelf summaries (default names, source summaries and one-file ids/counts); every scenario’s board/progress messages and estimates match. Its log differences are saved-name bytes and in-place saves instead of new files. The integrated DOM replay uses the newly generated fixture, rather than silently claiming the old shelf model was current.

### Fresh verification

| Check | Independent result on `14c371869` |
| --- | --- |
| Full Jest, isolated cloud workspace Node 24.19.0 | **504 suites / 7,000 tests / 59 snapshots pass**, 374.941 s |
| Typecheck / production build including `verify:bundle` | **Both pass**, existing webpack size warnings only |
| Lint | **0 errors / 1,133 warnings**, identical to the reviewed #166 correction by relative file, rule and severity |
| Independent persistence / correction controls | **10 pass / 1 desired-behavior failure**, 11 tests in 4 suites, 11.3 s; remaining F-01 above |
| Actual-base cancellation-order controls | **2/2 pass**, 6.179 s |
| Targeted old-save-path Opinion negative control | **2 expected failures**, 7.103 s; the same standing/stale cases pass on the current merged code |
| Retained #166 host and price checks | **20 + 1 tests pass**, 6.91 s and 2.472 s; saved-file expectation deliberately follows decision 46 |
| Retained #163/#164 codec/storage/recovery checks | **38 tests / 5 suites pass**, 14.11 s |
| Regenerated production-host fixtures | **Both builder tests pass**, 7.493 s / 6.421 s; byte and semantic comparisons described above |
| Shared Workshop parity | **15/15 markup-and-focus states identical** against the source-equivalent actual base, 11 tests per side, 5.742 s / 4.624 s |
| Independent UI / actual host-store correction tests | **16/16 pass**, 13.295 s; same tests against original #167 source: **11 expected failures / 5 controls pass**, 12.436 s. One of the 11 is the newly required adoption field on an otherwise valid same-board rename, not a draft-retention failure |
| Exact rebuilt production-bundle DOM | **6/6 board scenarios** and **195 retained #166 correction checks pass**; **395 broader retained #166 checks also pass**, with no runtime/assertion errors; CSS parsing is outside these DOM assertions |
| Independent picker/privacy controls | **48/48 tests in 3 suites pass**, 8.102 s: original 15 plus 33 adversarial error/code cases. The real EACCES privacy witness still fails as expected on the preserved original source |
| Exact implementation-head configured CI | **Both events success**: [PR run 40027797061](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40027797061), [push run 40027791306](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40027791306) |

Rebuilt SHA-256 values match the author’s integrated evidence: webview `1fe072462cbcf8f410b8232ec2535a1f166d10cf9fd559e437445da914e6fe15`; extension `805bd13410f9f202f1c71bae59929989c396df783a22b9f4eb35c6ead0646d02`.

The red F-01 assertion is evidence of the remaining defect, not passing coverage. The new outcome/Name not saved captures at 500 and 1440 px and the outside snapshot at 1000 px were independently inspected: the warning and Dismiss remain legible, and no additional clipping defect was established. These are supplied pixels, not independently rendered native geometry.

The base is an ancestor of this head. The clean three-way merge tree equals the head tree (`6632858ef81a14e08758bd20eecac6682e81acbb`). The merged #166 report, including its independent closing appendix, is retained. Production run-control helpers/components are unchanged from that base; their composition in LightboxApp and the changed board-save policy were reviewed separately. Both authentic format-1 fixtures remain byte-identical. The save-path extraction reduces LightboxBoardStore to 429 lines; no production core `vscode` import or new `any` type was found. Diff whitespace checks identify only the existing review reports' intentional Markdown hard breaks, not implementation whitespace defects.

All heavy work was serialized. Dependencies were reused after matching the unchanged lockfile and installing checkout-local workspace links. Only public-domain *Alice* and synthetic data with stub providers were used. No private manuscript, live/billable provider, implementation change, formal review, merge, deployment or extension publication occurred. Timings describe the named cloud/CI contexts, not native UI latency. JSDOM and supplied captures do not establish native keyboard defaults, geometry or screen-reader acceptance; no denied browser route was retried. The existing #164 tied-clock claim-recovery debt remains separate and is not reopened.

**Next step:** correct the remaining F-01 cancellation-order gap, preserve the now-passing ownership/UI/privacy controls, and re-review the actual next head. No other blocking finding is open in this reviewed integration.
