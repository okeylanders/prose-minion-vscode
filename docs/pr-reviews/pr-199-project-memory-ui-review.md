# PR #199 review: Project Memory Slice 4b-ui

- **Reviewed:** 2026-11-04
- **PR:** https://github.com/okeylanders/prose-minion-vscode/pull/199
- **Original implementation head:** `dbd57243703d370e5636f60be17b93b804332ca2`
- **Comparison base:** `27da6fee5d7ca97119b563f1b6d121eef524bf9f` (`epic/workshop-project-memory-slice-2a-read-path`, PR #197)
- **Landing target:** `epic/workshop-project-memory` at `f8b2359187762cc93b97f1ec3bf4aa25299c7108`; the retargeted integration was re-reviewed at `119cd49a4fe25e6850519a091493a77969534484`.
- **Current verdict:** **APPROVED at `119cd49a` for the presentation-only slice against epic target `f8b2359`.** F-01, F-02 and N-01 are closed, integration checks pass, and exact-head CI is green. No formal GitHub approval or merge was performed.

## Epic-target integration re-review · 2026-11-04

**Reviewed head:** `119cd49a4fe25e6850519a091493a77969534484`. **Target and merge base:** `f8b2359187762cc93b97f1ec3bf4aa25299c7108` on `epic/workshop-project-memory`, containing the reviewed #197 corrections.

**Verdict: APPROVED for the presentation-only slice against this epic target.** The earlier stack-only limitation is resolved for these exact commits; F-01, F-02 and N-01 remain closed. This is a written review opinion, not a formal GitHub approval or a merge.

- Verified that the updated head includes the target: comparison is ahead with **0 commits behind** and merge base `f8b2359`.
- Since the preceding approved UI head, production changes are the already-reviewed #197 corrections. The additional UI-specific change is a library-to-manager supersession regression covering a cycle, an ignored cyclic edge beside a valid replacement, and an archived intermediary in a chain. These tests correctly follow the library's accepted links rather than re-deriving them in the view.
- Reconstructed and Git-blob-verified all **1,548 core source/test files** and the app manifest against `119cd49a`.
- **20 suites / 233 tests passed**, including the original reviewer transitions, memory view/component tests, real-renderer residency tests, the new supersession integration tests, #197 log/supersession/global-setting tests, shared browser regressions and architecture/style guards.
- Core-host and webview typechecks passed locally.
- Exact-head [CI run 41900691777](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41900691777) completed **successfully**: dependency installation, all three typechecks, full tests, lint and both-bundle build.
- No new actionable integration defect found. Native VS Code/visual QA and the deferred 4b-wire work remain outside this approval, as detailed below.

## Earlier independent re-review · 2026-11-04

**Reviewed correction head:** `3a2db4a73d5a2eab7850b4238f290a3957626524`, against the unchanged #197 base `27da6fee5d7ca97119b563f1b6d121eef524bf9f`.

**Current verdict: APPROVED for this presentation-only slice on its current stack. F-01, F-02 and N-01 are independently closed.** This records a code-review opinion only. No formal GitHub approval or merge was performed, and it does not approve the deferred 4b-wire implementation or future stack-retarget changes.

- **F-01 closed:** the callback map contains only currently writable rows, and a memory row cancels an open rename when it locks. The three original reviewer probes now pass. The author's matrix covers Enter and blur, busy/pending/unavailable, and Active/Past rows; a busy row still opens its file. The shared `SavedItemRow` remains untouched.
- **F-02 closed:** manager wording now distinguishes actual `listed` and `searchable` residency. Without residency it makes no catalog-inclusion promise. The tab's arithmetic is valid for the renderer's explicit ordering: overflowed pinned candidates lead the list, so `min(notLoaded, catalogEntries)` is their listed count. Search-only pinned notes are no longer double-counted by the additional searchable line. Real-renderer tests cover the original 45-note count limit and a token-limit case.
- **N-01 closed:** archived-and-superseded rows show both badges and the superseding titles, and explain that Restore unarchives without undoing supersession.
- No new actionable defect found in the correction diff.

**Re-review verification:**
- All **1,544 core source/test files** matched the correction head's Git blob hashes.
- **16 suites / 219 tests passed**, including the three independent reviewer transitions, new residency regressions, existing Workshop/Lightbox/shared-browser regressions and architecture/style guards.
- Core-host and webview typechecks both passed.
- Targeted correction-area lint: **0 errors, 9 naming warnings**.
- The exact correction-head [CI run 41891384955](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41891384955) completed **successfully**. This is the remote aggregate check; the local full-suite/build limitations below still apply.

**Remaining acceptance boundary:** 4b-wire must derive residency and the two extra estimate fields from the actual renderer, distinguish set-aside entries from same-path standing files, preserve settings drafts while opening the manager, and supply the host's write/identity/workspace guards. After #197 lands, recheck the retargeted diff and exact-head CI before landing. The initial findings and author ledger below are retained as history.

## Original review: scope and overall assessment

Reviewed the isolated 45-file UI diff, the approved Slice 0d design and its documented copy amendments, the memory ADR, the shared saved-item browser integration, the existing renderer's actual frame rules, and the tests. This PR deliberately delivers components and pure presentation models only. Missing routes, mounting, hook, apply-together mode draft, and Edit/New sheet are **not findings**: 4b-wire correctly waits for Slice 3.

The structure is sound. Memory-specific copy and derivation stay out of the shared browser. `afterSection` is opt-in, and the existing Workshop and Lightbox browser tests pass unchanged. Mode remains choosable in unavailable workspaces; conflict/unreadable rows cannot mutate by ambiguous identity; set-aside claims correctly have no misleading Open file action; full-load selection and actual full-load outcome are separate. The explicit distinct-entry-key warning is important and should remain a wiring acceptance criterion.

## Author correction ledger

Each correction landed with a test that failed first. "Fixed" describes the
submitted correction, not independent closure; a re-review closes it.

| ID | Priority | Finding | Status |
|---|---|---|---|
| F-01 | P2 | An open rename still writes after its row becomes locked | Fixed in `e6d62fb8`. When a memory goes busy, an action starts or the workspace goes, the row cancels its open rename, so neither Enter nor the blur that follows sends it. The manager also checks, as it sends, that the row may still be written (listed, not busy, nothing pending, the workspace there). 12 transition tests (Enter and blur × three locks × Active and Past rows) and a busy row's Open file. Kept in the memory modal: the shared `SavedItemRow` is unchanged |
| F-02 | P2 | Full-load overflow is incorrectly promised a place in the catalog | Fixed in `b88728fe`. Rows take an optional `residency` (`full`, `listed` or `searchable`), the renderer's own result, which 4b-wire supplies. Without it a row promises nothing ("so it doesn't load whole"). The tab's and the manager's lines split listed from searchable-only ("43 memories set to load in full don't fit: 40 load as list entries, and 3 are searchable only"), and the tab's "N more are searchable" line no longer counts them twice. The tab derives its split from the estimate, since not-loaded bodies lead the list (D5). The regression runs the real renderer on the review's 45-note case (count-bound: 2 / 40 / 3) and on a token-bound case |
| N-01 | Nonblocking | Archived and superseded are independent | Fixed in `a4819837`. A row both archived and superseded keeps "Superseded by …" and both badges, and says "Restore un-archives it, but the newer memory still replaces it." |

## Findings

### F-01 · P2 · An open rename still writes after its row becomes locked

**Location:** [WorkshopMemoryBrowserModal.tsx:184–185](https://github.com/okeylanders/prose-minion-vscode/blob/dbd57243703d370e5636f60be17b93b804332ca2/packages/core/src/presentation/webview/components/workshop/memory/WorkshopMemoryBrowserModal.tsx#L184-L185), with the unguarded key-to-id dispatch at lines 85–89.

The memory row receives `disabled={writesLocked || row.entry.busy}`, but that only disables the shared row's buttons. `SavedItemRow` does not disable an already-open rename input, and its Enter/blur paths still call the browser's `onRename`. The new memory callback checks only that the key resolves to an id, not whether the current row may be written.

**Reproduction, independently executed against this exact head:**

1. Render an available manager with one non-busy memory.
2. Choose Rename and change the title.
3. Rerender with either:
   - that memory's `busy: true`;
   - `actionPending: true`; or
   - workspace `{ kind: 'unavailable', reason: 'multi-root' }`.
4. Press Enter in the still-open input.
5. In all three cases, `onRename('mem-123abc', 'Changed while free')` fires.

The UI can therefore submit another mutation while claiming that writes are off, including after losing its workspace. This does not establish a store-level data-loss bug: host guards still belong in 4b-wire. It is an independently reproducible violation of this component's pending/busy/unavailable contract, and it should not rely on a later host refusal to behave correctly.

**Requested correction:** guard dispatch using the latest availability, pending state, row existence and row busy state, and settle or safely retain an existing edit when it becomes locked. Do not allow an incidental blur from disabling/cancelling the input to send the draft. Add transition tests for Enter and blur after each lock, including both Active and Past rows. Keep Open file available for a busy memory as intended.

### F-02 · P2 · Full-load overflow is incorrectly promised a place in the catalog

**Primary location:** [workshopMemoryManagerView.ts:237–238](https://github.com/okeylanders/prose-minion-vscode/blob/dbd57243703d370e5636f60be17b93b804332ca2/packages/core/src/presentation/webview/hooks/domain/workshop/memory/workshopMemoryManagerView.ts#L237-L238).

The same claim occurs in `overNote` at lines 178–183 and [workshopMemoryTabView.ts:222–223](https://github.com/okeylanders/prose-minion-vscode/blob/dbd57243703d370e5636f60be17b93b804332ca2/packages/core/src/presentation/webview/hooks/domain/workshop/memory/workshopMemoryTabView.ts#L222-L223).

A `fullLoad: 'doesnt-fit'` row says “so it loads as a list entry.” That outcome is not guaranteed. Overflowed full-load memories are catalog **candidates**, subject to the catalog's own count and token limits. The existing [frame builder:99–105](https://github.com/okeylanders/prose-minion-vscode/blob/dbd57243703d370e5636f60be17b93b804332ca2/packages/core/src/application/services/workshop/memory/ProjectMemoryCatalogFrame.ts#L99-L105) stops adding them when either limit is reached.

**Source-backed reproduction using the real renderer and default budgets:**

- Supply 45 valid active, pinned canon notes, each with an 8,000-character ASCII body, short titles/summaries, matching dates and sequential valid ids.
- The renderer loads **2 whole notes**, **40 catalog entries**, and leaves **3 notes absent from the starting frame**.
- Its estimate is `memories: 45, pinned: 45, pinnedLoaded: 2, pinnedOver: true`; the renderer's entry count is 40.
- The tab nevertheless says “43 memories set to load in full don’t fit, so they load as list entries,” followed by the contradictory “3 more are searchable.”
- Each of the three omitted memories' manager rows also says it loads as an entry.

This incorrectly reassures the writer that a specific memory reaches personas at conversation start. The combined overflow case is not covered by the individual canvas-state fixtures.

**Requested correction:** either pass actual catalog residency into the row inputs and distinguish listed from search-only notes, or use qualified fallback wording that does not promise inclusion. Correct the tab's aggregate line and the manager's aggregate/row lines together. Add a real-renderer-backed combined-overflow regression, including count-bound and token-bound catalog omission.

## Nonblocking observation

### N-01 · Archived and superseded are independent

[workshopMemoryManagerView.ts:250–256](https://github.com/okeylanders/prose-minion-vscode/blob/dbd57243703d370e5636f60be17b93b804332ca2/packages/core/src/presentation/webview/hooks/domain/workshop/memory/workshopMemoryManagerView.ts#L250-L256) hides supersession on an archived-and-superseded row and says “Restore to make this memory active again.” Setting status back to active does not remove supersession under ADR D4, so the row stays in Past and still does not load. Preserve the supersession explanation and qualify the restore result for this combined state. This is not a request to change the domain's restore or supersession rules.

## Verification

**Independently run:**

- Reconstructed the UI diff on the #197 snapshot and checked all **1,543 `packages/core/src` files** against GitHub Git blob hashes for the exact implementation head: no missing files or mismatches before adding the reviewer-only probes.
- `npm run typecheck:core`: passed.
- `npm run typecheck:webview`: passed.
- Focused Jest run: **14 suites / 197 tests passed**, covering the new memory models and components, shared browser and `afterSection`, existing Workshop and Lightbox browser behavior, architecture boundaries, Chromium CSS floor and Workshop style guard.
- The initial boundary test run lacked two architecture documents in the reconstructed checkout. After fetching those exact-head documents, the boundary suite passed. This was a review-checkout omission, not a product defect.
- Targeted lint of the changed production components/models/shared browser/icon module: **0 errors, 14 naming warnings**, including 3 existing shared-control component warnings. This is not a claim about repository-wide warning totals.
- Three additional reviewer transition regressions for F-01: **all fail as expected**, each demonstrating the prohibited callback.
- Standalone actual-renderer and view-model probes reproduced F-02 and N-01.

**Remote CI:** the implementation-head CI run [41887197221](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41887197221), verify job 126774716964, completed successfully. Its npm-ci, all three typechecks, tests, lint and both-bundle build steps all report success. CI success does not cover the extra failing transition/combined-state regressions above.

## Limits and follow-through

- Local execution used Node **24.22.1**, while the author reports Node 22. Exact-lockfile dependencies were reused from the verified #197 environment.
- No independent local full-repository suite, app-shell typecheck or production build was run. The full CI results above are attributed to GitHub, not to this local review.
- No live VS Code extension-host QA or model/provider calls. Chromium screenshot attempts could not start in this container because its process-singleton socket is disallowed; consequently no visual pixel, narrow-window or screen-reader pass is claimed. Static JSX/CSS, roles and accessible names were reviewed; DOM behavior was exercised by Jest.
- Keep host mapping of `pinnedLoadedTokens` and `catalogEntries` tied to the actual renderer, and include F-02's residency/wording correction in that contract.
- The set-aside row and standing file may share a path: the future `entryKey` must distinguish the entries rather than be only a path HMAC.
- No production code was changed in this review. Re-review the corrected head, and recheck CI and the eventual retargeted comparison before a landing decision.
