# PR #210 review: Pinned Context settings tab

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

**Locations:** `WorkshopPinnedContextHandler.ts:62–65,433–435,450`; native pin path in `WorkshopPinnedContextWrites.ts:154–156`.

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
- The complete local suite is running with review probes excluded; no full local pass is claimed yet.
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
