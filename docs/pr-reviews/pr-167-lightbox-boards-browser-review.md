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
