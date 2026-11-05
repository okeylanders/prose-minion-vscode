# PR #210 review: Pinned Context settings tab

## Final correction re-review — 2026-11-05

- **Reviewed implementation:** `0cf6b5be8070a84cc9bf30e52290ab4272f13e5e`.
- Target: `epic-pinned-context`, observed at `7b9fd0b4331f6551aae73a3b547466441831b740`.
- **Verdict: Review clear. No confirmed findings remain.** F01–F07 and N01 are closed at this implementation.
- GitHub reported mergeable/clean, and [exact-head verify CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41969010064/job/127052606981) passed typecheck, tests, lint and both webpack bundles.
- No formal GitHub approval, merge, provider call or deployment performed. This is a review verdict, not a merge action.

### F03 closure

The remaining overlapping-mutation race is fixed by numbering list observations inside the existing store queue. `readObserved()` preserves captured-file checks and returns a strictly increasing observation with each completed queued read. The library carries that observation through its asynchronous description, and the handler includes it in the payload. The hook keeps the highest applied observation rather than assuming request or answer order proves freshness.

An older answer still settles its own request and exposes its outcome/notice, but cannot restore an older list. The original read-versus-write fixes remain intact. Host answers that read no list can omit observations and use the fallback rules; no concrete material regression was found in those paths.

Verified with:
- All five original expected UI probes, unchanged.
- The remaining mutation-order expected probe, unchanged; it now retains the newer empty list.
- The real-host delayed-description ordering control, unchanged.
- Positive observation cases in both arrival orders, including an earlier-issued request whose list observation is newer.
- A newer pushed list surviving older read and mutation replies, while refusal/pending state still settles.
- Unavailable fallback followed by a later observed workspace list.
- Store/library tests and root/room/symlink boundary controls, with captured-root semantics unchanged.

Additional observation probes are preserved as [review evidence](probes/pr-210-observation-boundaries.test.tsx.txt).

### Final verification

- All **1,980 apps/packages blobs** match the reviewed head, verified before and after testing. Independent verification agrees.
- Complete local suite, with temporary review-only probes excluded: **720 suites / 10,054 tests / 59 snapshots passed in one uninterrupted run** (884 seconds). This includes the author's promoted original and mutation-order regression probes.
- `npm run typecheck`: **pass**, all three projects.
- `npm run lint`: **pass**, 0 errors / 1,165 warnings; temporary review-only probes excluded.
- Independent focused UI/host-order replays and observation checks: **5 suites / 19 tests passed**.
- Independent store/library/host boundary checks: **3 suites / 46 tests passed**.
- Exact-head CI: **pass**, including build of both bundles.
- The previous correction's full baseline also completed clean: **718 suites / 10,048 tests / 59 snapshots**, at `c6b24c13`.
- UI validation used React/jsdom and real host/coordinator fixtures. Native VS Code visual interaction, a native Windows runtime and live provider calls were not exercised.

This review applies to the exact implementation above and the tested target. Later implementation or target changes require checking their delta. The following sections preserve the finding history; their earlier changes-required verdicts are superseded by this final result.

---

## First correction re-review (historical) — 2026-11-05

- **Reviewed correction head:** `c6b24c13585f846a5bcebe03362a37f5d43c8adc`.
- Implementation corrections: `5f777852fcb5a976293571363503c7bf3b648d5b`; author verification note: `368ed4047fdef135f04992b8043443657f89038f`. Both are ancestors of the reviewed head. The later `c6b24c13` review-document commit preserved those fixes.
- Target: `epic-pinned-context`, observed at `7b9fd0b4331f6551aae73a3b547466441831b740`.
- **Verdict: Changes still required. F03 remains open for overlapping mutation answers.** F01, F02, F04, F05, F06, F07 and N01 are closed at this correction head.
- No implementation changes, formal approval or merge performed.

### F03 remains open: an earlier picker answer can restore a subsequently unpinned row

**Priority:** Medium / P2. **Location:** `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopPinnedContext.ts:157–160`.

The read-versus-mutation correction works for the original repros. However, the hook now assumes every mutation answer holds the newest list and applies it unconditionally. A mutation's answer describes the list through asynchronous file/catalog reads outside the store queue, so answers from overlapping mutations can complete in the opposite order from their list snapshots.

Confirmed through the real handler/library/store and a failing hook expected-behavior test:

1. A is pinned. Start the nonblocking native picker and select that same file; the write is a successful no-op.
2. Its answer's `describe()` reads the old list containing A, then pauses in `openCatalog()`.
3. With the native picker closed and its answer still loading, Unpin A remains available. It commits and answers with the empty list and newer revision.
4. Release the earlier description. The picker answers successfully with A and the old revision.
5. The hook applies that older mutation answer at lines 157–160, restoring A and count 1 onscreen, although the persisted list is empty.

This is reachable with the intended nonblocking-picker UX; it does not require bypassing the host route gate. The host probe verifies replies `req-1, req-3, req-2` and the final empty disk list. The hook expected-behavior probe expects revision `after` and count 0; it fails with revision `before`.

**Required correction:** reconcile overlapping mutation completions against authoritative current state, or bind returned snapshots to ordering that actually establishes freshness. Do not infer freshness from request issuance or reply completion alone. A post-settlement read may be a valid approach if it handles all outstanding operations, cancellation and subsequent reads without reintroducing the original F03 failures. Preserve the nonblocking picker behavior and the fixed read-versus-write cases.

Evidence:
- [Real host mutation-answer ordering control](probes/pr-210-mutation-order-host.test.ts.txt), passes by observing the stale answer and final empty persisted list.
- [Expected hook reconciliation](probes/pr-210-mutation-order-ui.test.tsx.txt), fails at the reviewed correction head.
- Copy host probe beside `workshopPinnedContextHandlerHost.ts`; copy hook probe into the settings UI test directory; remove `.txt` and run Jest with `--runInBand --runTestsByPath`.

### Closed findings and correction checks

- **F01:** existing exact filesystem source takes precedence over a normalized catalog neighbour. The original selected-source witness now passes.
- **F02:** Attach missing uses the coordinator's room-operation queue. The real failed-Open rollback probe now passes. Its only API adaptation is wiring the newly required `runRoomOperation: work => coordinator.runContextRefresh(work)`; all safety assertions are unchanged.
- **F04:** current-room presence and readable missing count are independent of future seed eligibility. Both original UI cases pass.
- **F05:** Open uses the reader's shared source resolution. The original single-NFD-source Open case passes.
- **F06:** missing/unreadable sources are reported in the left-out results rather than called already present. Both original cases pass.
- **F07:** shared 4,096-character path limit replaces the inconsistent 1,024-character action limit. All three original 1,138-character path actions pass.
- **N01:** picker uses host-platform canonical identity. The original Windows-case disabled-row test passes.
- All **1,978 apps/packages blobs** matched the exact correction head, independently verified before and after host probing.
- `npm run typecheck`: **pass**, all three projects.
- `npm run lint`: **pass**, 0 errors / 1,165 warnings; temporary review probes excluded.
- Independent host replays and supplied fix regressions: **4 suites / 17 tests passed** (original identity 4, original root/room/symlink boundaries 3, rollback 1, supplied fixes 9).
- Original expected UI probes: **5 passed unchanged**. Original long-path probes: **3 passed unchanged**.
- New mutation-order investigation: real-host control and observed-hook control pass; **one expected hook regression test fails** as described above.
- The first-correction full suite subsequently completed at `c6b24c13`: **718 suites / 10,048 tests / 59 snapshots passed**. The historical 711-suite result below applies only to original implementation `9e1fd707`.
- No native VS Code visual pass, native Windows-host run or live provider call was performed.

---

## Initial review (historical, original implementation)

The findings and checks below describe `9e1fd707`; their current status is superseded by the correction re-review above.

- Reviewed head: `9e1fd707e12c0075a33e6045aa6ca2a0b8a9282c`.
- Target: `epic-pinned-context`, observed at `7b9fd0b4331f6551aae73a3b547466441831b740`.
- Date: 2026-11-05.
- **Verdict: Changes required.** Seven medium-priority functional findings and one low-priority picker consistency note.
- Scope: Slice 3's host routes, writes, source/root/room identity, native and catalog pickers, attach-missing, view model/hook, menu counts, reports, wiring, protocol and tests.
- No implementation fixes, formal approval, merge, provider call or deployment performed.

## F01 · Medium · Preserve the exact source selected by the host picker

**Locations:** `WorkshopPinnedContextWrites.ts:143–156,245–247`; `WorkshopPinnedContextFileReader.ts:174–185,194–211`.

The new native-picker route receives an exact filesystem path, reduces it to a relative list entry, then validates/loads that entry through the reader's normalized catalog fallback. That fallback can select a different existing file.

**Reproduction:** on POSIX, both `Characters/caf\u00e9.md` (NFC) and `Characters/cafe\u0301.md` (NFD) exist with different bodies, but only the NFD neighbour is in the configured catalog. Choose the exact NFC file in the host picker. Pin succeeds; Attach missing then installs the NFD neighbour's body and URI instead of the selected file's text. The expected-behavior probe fails.

#208's catalog exact-match correction remains intact: it chooses an exact catalog row when one exists. This is the new host-picker case where the exact selected file exists outside that catalog, while an equivalent-spelled neighbour is catalogued.

**Required correction:** retain the selected file's authoritative identity through validation and future resolution. Do not prefer a normalized catalog neighbour over an existing exact selected source. Preserve compatibility fallback only when it is unambiguous about the actual source, together with the captured-root and symlink defenses.

Probe: [host identity, final case](probes/pr-210-host-identity.test.ts.txt).

## F02 · Medium · Do not lose a successful attach during session replacement rollback

**Locations:** `WorkshopPinnedContextHandler.ts:267–289`; entry-only mutation guard in `WorkshopSliceComposition.ts:403–410`.

Attach missing is checked for an in-progress session operation only at route entry. It then awaits file reads. Another Open can start during that await and capture its rollback checkpoint while the old room identity is still accepted. The post-read `still()` and active-run checks do not cover this pending replacement.

**Reproduction through the real coordinator and the same entry-gate semantics:** begin Attach missing and hold its read result; begin Open of a named session and hold its import after rollback capture; release the attach. It adds the pinned body, marks dirty and reports `ok: true`. Fail the import. Open's rollback restores the earlier checkpoint and erases the reported attachment.

**Required correction:** serialize the asynchronous attach with session replacement using the existing room-operation ownership mechanism, or recheck session-operation availability at the actual mutation boundary. A successful reported attachment must survive a later failed replacement; alternatively refuse before changing the room. Cover successful and failed Open/reset interleavings, not only a room identity that already changed.

Probe: [real coordinator rollback](probes/pr-210-session-operation.test.ts.txt). The assertion permits either safe refusal or preserved serialized success.

## F03 · Medium · Reconcile completed writes after an intervening list refresh

**Location:** `useWorkshopPinnedContext.ts:140–153`.

The hook correlates all ordinary requests through one `waiting` id. A later-issued list read is assumed to represent a later state than an outstanding mutation. That is not guaranteed while the mutation is resolving its files.

**Reproduction:** start catalog pin A, close/reopen the settings tab (which requests list B), and hold A's catalog resolution. B returns the pre-write empty list. A then commits and returns the new list, but its response no longer matches `waiting.current`, so the hook discards it. The disk is pinned while the tab and sessions-menu count remain empty until another refresh. The real host probe establishes reply order `req-1, req-3, req-2`; the hook probe shows the stale revision/count. Native-picker completion has the analogous flaw: its answer can be discarded while a delayed read of the older state is pending.

**Required correction:** track outstanding mutation completion separately from list-request ordering, and reconcile or re-read after a mutation settles. Keep stale read responses from overwriting a committed newer state; do not infer snapshot freshness from request issuance order alone.

Probes: [expected hook behavior](probes/pr-210-settings-ui.test.tsx.txt), [real host ordering](probes/pr-210-ui-host-controls.test.ts.txt).

## F04 · Medium · Separate current-room presence and capacity from future seed eligibility

**Location:** `pinnedContext/workshopPinnedContextTabView.ts:150–153`.

Both the “In this conversation” mark and Attach missing count are gated by `attaches`, which describes whether the file fits a future room's newly read template. The current room keeps independent snapshots.

Two confirmed cases:

1. A matching body is still attached, but its source was deleted or became unreadable. The tab sets `here: false` and says “0 in this conversation”, hiding the retained prompt-bearing body.
2. The template contains A at 70,000 words followed by B at 40,000 words. The current room carries an older, tiny A snapshot and no B. The view excludes B because it would exceed the future template's budget, reports missing count 0 and disables Attach missing. The real handler can attach B successfully to this current room (40,007 words in the fixture).

**Required correction:** derive current-room presence from the actual attachments, independently of source health/future-room fit. Determine current-room missing actions independently as well, leaving the aggregate's current-room budget guard authoritative. Keep the future-conversation warnings as separate information.

Probes: [expected view behavior](probes/pr-210-settings-ui.test.tsx.txt), [real current-room budget control](probes/pr-210-ui-host-controls.test.ts.txt).

## F05 · Medium · Open the source actually resolved for the pinned entry

**Location:** `WorkshopPinnedContextWrites.ts:212–219`.

Open looks up the stored entry, then directly joins its spelling to the root. Description and attachment use the reader's supported normalized catalog resolution instead.

**Reproduction:** only NFD `Characters/cafe\u0301.md` exists and is catalogued; the list stores its NFC spelling `Characters/caf\u00e9.md`. Description and Attach missing correctly resolve the NFD source, but Open passes the nonexistent NFC path to the editor. The expected source-target probe fails.

**Required correction:** resolve Open through the same authoritative source identity used by description/attachment, while preserving root/containment checks and the ability to open an unreadable source for repair. Do not silently open a different file or a nonexistent spelling.

Probe: [host identity, normalized Open case](probes/pr-210-host-identity.test.ts.txt).

## F06 · Medium · Report missing and unreadable files left out by Attach missing

**Locations:** `WorkshopPinnedContextHandler.ts:282–285,413–415`.

Missing/unreadable reads are skipped without entering the result's left-out list. If no ready file is added, the empty counters produce “Every pinned file is already in this conversation”, even when the room is empty.

**Reproduction:** pin one source, let it disappear or become whitespace-only before Attach missing resolves. Both cases leave zero attachments but return that all-present message. With mixed sources, successful additions also omit the failed sources from the result.

**Required correction:** distinguish already-present entries from missing/unreadable/over-budget ones and report their actual categories. A file disappearing after the tab's prior ready listing must not be reported as already attached.

Probe: [host identity, first two cases](probes/pr-210-host-identity.test.ts.txt).

## F07 · Medium · Allow row actions on every path the picker can successfully pin

**Locations:** `WorkshopPinnedContextHandler.ts:62–65,436–437,450`; native pin path in `WorkshopPinnedContextWrites.ts:154–156`.

The handler caps row/catalog keys at 1,024 characters, but the codec and host-picker route accept valid longer relative paths. The same UI can create a pin it cannot subsequently manage.

**Reproduction:** choose a valid 1,138-character relative path formed from ten directory segments, each below filesystem component limits, plus `alice.md`. Host-picker pin succeeds and the list response returns it. Unpin, Move up and Open all then answer malformed-request refusals because that returned key exceeds the handler's limit. Three expected-behavior tests fail.

**Required correction:** use a consistent shared bound that supports persisted entries and paths accepted by every pin route, or use bounded opaque entry keys. Do not strand an already-valid entry by rejecting the key the host just returned.

Probe: [long-path row actions](probes/pr-210-long-path.test.ts.txt).

## N01 · Low · Use canonical path identity for the picker's “Pinned” rows

**Location:** `WorkshopPinnedContextPicker.ts:75–88`.

The picker uses exact `Set.has(entry.path)`, unlike the platform-aware shared host match rule. A Windows pin `characters/alice.md` leaves catalog row `Characters/Alice.md` selectable rather than disabled and marked “Pinned”; NFC equivalents differ similarly. The host's duplicate protection prevents duplicate writes, so this is a UI consistency issue rather than data corruption.

Use the same canonical path rule as the host and pass the host platform explicitly. The expected disabled-row probe fails.

Probe: [expected picker behavior](probes/pr-210-settings-ui.test.tsx.txt).

## Verified behavior and checks

- All **1,970** files under `apps/` and `packages/` matched the exact head's Git blob hashes before probes; changed root configuration/architecture files were fetched at the same head.
- `npm run typecheck`: **pass**, all three projects.
- `npm run lint`: **pass**, 0 errors / 1,165 warnings, with temporary review probes excluded.
- Focused supplied suites: **20 suites / 296 tests passed**, covering pinned context, room seed/start, settings-tab navigation, confirmations and shared picker/footer behavior.
- Independent expected-behavior witnesses: **13 failures** (source selection, session rollback, stale hook results, current-room view/budget, normalized Open, missing/unreadable reporting, long-path actions and canonical picker marking).
- Supporting observed host/UI probes: **7 pass**, including the real out-of-order replies and current-room budget control. Additional safety controls: **3 pass** (room changed during picker; symlink ancestor not read; nested-root A→B→A catalog source not read or written).
- Bound write revisions, captured roots, commit checks, count/word budget checks, file-order mutations, malformed-message refusals, run-time attach rejection, one-shot first-room reporting and picker cancellation were inspected. The original #208 source-binding correction is preserved.
- [Exact-head verify CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41963532681/job/127035178486) passed; GitHub reported mergeable/clean. Green CI does not resolve the reproduced findings.
- Complete local suite at the reviewed implementation, with review probes excluded: **711 suites / 10,021 tests / 59 snapshots passed in one uninterrupted run** (1,435 seconds). The report-only head `bdab66e6` also passed [verify CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41965048184/job/127040020048). Findings remain open.
- UI probes use React/jsdom and real host/coordinator tests. No native VS Code visual pass, native Windows-host run or live model/provider call was performed.

## Reproduction artifacts

The linked `.test.ts.txt` / `.test.tsx.txt` files are review evidence, outside the normal test suite. Copy host probes beside `workshopPinnedContextHandlerHost.ts` in `packages/core/src/__tests__/application/handlers/domain/workshop/`; copy the UI probe into `packages/core/src/__tests__/presentation/webview/components/workshop/settings/`; remove the final `.txt` and run Jest with `--runInBand --runTestsByPath`.

- [Host source identity and result reporting](probes/pr-210-host-identity.test.ts.txt): four failing expected-behavior cases.
- [Session-operation rollback](probes/pr-210-session-operation.test.ts.txt): one failing expected-behavior case.
- [UI/hook/view/picker](probes/pr-210-settings-ui.test.tsx.txt): five failing expected-behavior cases.
- [Long-path row actions](probes/pr-210-long-path.test.ts.txt): three failing expected-behavior cases.
- [Host ordering and current-room budget controls](probes/pr-210-ui-host-controls.test.ts.txt): two passing supporting cases.
- [Root/room/symlink safety controls](probes/pr-210-host-boundary-controls.test.ts.txt): three passing controls.

The verdict applies to the implementation SHA above. Corrections and the resulting integration head require re-review.
