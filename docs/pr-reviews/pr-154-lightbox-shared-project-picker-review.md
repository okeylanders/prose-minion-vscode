# PR Review — Lightbox Shared Project Picker

**Author:** okeylanders · **PR:** [#154](https://github.com/okeylanders/prose-minion-vscode/pull/154) (open, unmerged at review)
**Branches:** `epic/lightbox-source-picker` → `epic/lightbox`
**Reviewed implementation head:** `2cf1f97835df378302c8174b17adb08dd8239824`
**Verified base / merge-base:** `59b57b6dc6bab58464b84b33fcd9c8063e6e43bb`
**Scope:** 89 files · +6,330 / −555 · 11 commits
**Reviewed:** 2026-10-20 · **Reviewer:** Astra
**Mode:** independent source/spec review; actual host-route counterexamples; original-base Workshop parity controls; rebuilt-production-bundle DOM/protocol probes; supplied PNG inspection and byte/pixel comparison; full base/head gates

## Summary

**Verdict: Request changes.** The shared extraction preserves the Workshop's three picker modes, but the new Lightbox path has two medium-priority correctness problems: old catalog/search replies can replace current picker results, and the Context picker confuses different files that have the same relative display path in different workspace roots.

Both findings are independently reproduced. Neither is a source-ticket ownership bypass, arbitrary filesystem access, or a live-provider issue. The host still resolves selections against a fresh catalog and enforces its real shelf budget. The problems are nonetheless user-facing: the picker can erase valid current results or disable a file the shelf has not attached.

This is not Slice 5 acceptance. The separate writer real-chapter output checkpoint remains required before freezing the board-file format. Native VS Code acceptance, OS file-dialog behavior and live-model quality remain unverified.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Catalog/search responses are not correlated to the current opening/request; late replies overwrite newer results | **Open — fix before approval** |
| F-02 | Medium / P2 | Context attachment state treats a display path as file identity, disabling a distinct same-named file in another root | **Open — fix before approval** |
| N-01 | Low / P3 · nonblocking | The documented 500px Workshop backdrop hit-test is not represented in the reproducible evidence | **Qualify the statement or retain its witness** |

The PR remained open at `2cf1f97` with unchanged base `59b57b6` at the final 16:45 UTC review check and the 18:10 UTC pre-publication recheck. No PR discussion or author response existed at either check. Earlier PR #152/#153 reports and their author responses are unchanged.

## F-01 — Correlate catalog/search replies before replacing picker state

**Primary location:** [`useLightboxProjectFiles.ts:106–117`](https://github.com/okeylanders/prose-minion-vscode/blob/2cf1f97835df378302c8174b17adb08dd8239824/packages/core/src/presentation/webview/hooks/domain/useLightboxProjectFiles.ts#L106-L117).

Opening clears local state and sends an empty catalog request, but it does not create an opening/request identity; closing only changes `openPicker` ([lines 83–95](https://github.com/okeylanders/prose-minion-vscode/blob/2cf1f97835df378302c8174b17adb08dd8239824/packages/core/src/presentation/webview/hooks/domain/useLightboxProjectFiles.ts#L83-L95)). Every catalog and search reply then unconditionally replaces the stored answer. The actual host routes independently await work and publish every completed answer, gated only by disposal ([`LightboxHandler.ts:259–288`](https://github.com/okeylanders/prose-minion-vscode/blob/2cf1f97835df378302c8174b17adb08dd8239824/packages/core/src/application/handlers/domain/LightboxHandler.ts#L259-L288)). The new message contracts carry no request or opening identifier.

### Reproduction A: a canceled opening erases the fresh catalog

1. Open the source picker; hold its first `openCatalog()` promise.
2. Cancel and reopen. Let the second catalog complete successfully with `chapters/fresh.md`.
3. Reject the first held catalog promise after the second success.
4. The real handler posts the successful fresh catalog, then `{ entries: [], unreadable: true }` for the old request.
5. The exact built production webview replaces its currently visible categories with “Could not read your configured resource folders. Use Explore below.” No third request is pending, so it remains wrong until another user action.

The same failure can cross from a dismissed source picker into a later Context opening because both use this hook. This contradicts the hook's stated “latest opening”/fresh-list invariant; clearing state at open is insufficient.

### Reproduction B: an old query removes already returned current matches

1. In Names + content, issue `amberneedle`, then `violetneedle` after each debounce has fired.
2. Return `violetneedle` with `characters/Notes/cast.md`; the current content row appears.
3. Return the older `amberneedle` result afterward.
4. The hook replaces the retained `violetneedle` answer. The shared component's query-equality check correctly refuses to merge the old answer, but now the valid newer answer is gone. It shows “No matching names or content…” despite the unchanged query and previously successful result. If the old answer was bounded, its unrelated safety-bound warning is also shown.

A separate held-load probe through the actual host search route confirms it emits newer `beta` followed by older `alpha` when file reads finish in that order. The production DOM counterexample is therefore exercising a real transport outcome, not an impossible message order.

**Impact:** a slower old request can hide valid current files, substitute stale catalog metadata, or leave a misleading empty/error state. Fresh host resolution still protects boarding: this finding does not claim the stale UI can bypass catalog containment or steal source ownership.

**Required change:** correlate requests and replies to both the current modal opening and latest catalog/search operation, and ignore obsolete answers without erasing a newer accepted result. Make Close/Clear invalidate pending work appropriately. Query-string equality alone is not enough for repeated identical queries or close/reopen. Add held-promise tests for late success and late failure, source→Context reopening, different-query order reversal, and repeating the same query in a new opening. Only display `bounded` for the accepted current result.

**Base distinction:** the Workshop already has the single-result-slot/query-filter limitation. This review does not label that as a regression caused by extraction. Lightbox had no catalog modal on the base; its new hook/routes introduce the same failure into newly added functionality, and their explicit fresh-opening behavior is not met.

## F-02 — Use host file identity, not display text, for “attached”

**Primary location:** [`LightboxProjectPicker.tsx:90–100`](https://github.com/okeylanders/prose-minion-vscode/blob/2cf1f97835df378302c8174b17adb08dd8239824/packages/core/src/presentation/webview/components/lightbox/LightboxProjectPicker.tsx#L90-L100).

The wrapper builds `onShelf` from `context.files[].displayPath` and disables any catalog row whose `entry.path` matches. A display path intentionally omits its workspace root and is not a file identity. The host shelf correctly deduplicates by absolute `sourceKey`, not display text.

### Reproduction with the real resource and intake chain

Use two workspace roots in order, `/root-a` and `/root-b`, each containing `Notes/cast.md` with different text:

1. Configure the Characters group for `Notes/*.md`. The real `ContextResourceResolver` lists the root-A file; its current pre-existing relative-key deduplication chooses the first matching root. `WorkshopContextIntakeService` and `LightboxProjectFiles.resolve({ group: 'characters', path: 'Notes/cast.md' })` resolve `/root-a/Notes/cast.md`.
2. Add `/root-b/Notes/cast.md` through the native Context picker. The real `TextSourceResolver` calls `workspace.asRelativePath(file, false)`, so the published shelf entry is `{ displayPath: 'Notes/cast.md', ... }`, backed by root B's absolute key.
3. Open Add from project, then Characters. The new production wrapper disables root A's row and labels it “attached”, even though only root B is on the shelf.
4. Calling the project intake with that same catalog key accepts root A as a second distinct file. Both entries coexist, proving this is a false UI refusal rather than an intended duplicate restriction.

The host witness uses the actual resolver, catalog/intake services and shelf with only platform filesystem/workspace/picker ports substituted. A separate exact-production-bundle DOM witness verifies the disabled row and “attached” label for those valid wire payloads. The original-base native intake control accepts both roots too.

**Impact:** a legitimate configured context file is unavailable through the new modal whenever another attached file shares its root-relative name. The writer must use Explore instead or remove a different file. The UI incorrectly contradicts the host's admitted-file identity.

**Required change:** supply a host-derived opaque identity or host-derived attachment flag that is unambiguous across roots, and compare that rather than display text. Preserve key-only selection payloads and do not expose absolute paths merely to solve the UI comparison. Add a real multi-root test that natively attaches root B, then verifies root A's catalog row remains selectable; separately verify a genuinely attached root-A row remains disabled.

The resolver's older cross-root catalog collapse is a distinct pre-existing limitation, not an additional finding in this PR. F-02 concerns the newly added disabled-state decision for the one catalog entry that is actually listed.

## Scope, architecture and independently verified behavior

Read the PR description/diff, repository `AGENTS.md`, Lightbox ADR D1/D9/D10/D12, current epic notes, existing #152/#153 reports, the documented shared-picker naming debt, and the committed evidence harness/README. No checkout-local `.agents/skills` directory was present.

- **One shared picker:** `ProjectResourcePickerModal` is callback-only and sends no messages. The Workshop wrapper retains excerpt/single, context/multiple and message/multiple behavior; Lightbox uses its own routes. Shared resource types are a structural rename, not a Workshop wire-format change. The content-search loop is mechanically extracted with the same trimming, limits, skip rules and candidate order. `WorkshopModalShell`/catalog-service naming debt is already recorded and is not elevated into a blocker here.
- **Source ownership preserved:** the project choice validates its key synchronously, takes `beginSourceRequest()` before catalog lookup, and uses the same file-boarding path. Held promises independently confirm overtaking by newer native/host/project choices, catalog failure after an older pending source, panel disposal/replacement, workspace removal before read, and inability to borrow a host ticket from a wire payload. Native dismissal creates no source intent. Existing cross-entry Open File tests run in the full suite.
- **File identity:** Node/VS Code punctuation-encoding variants converge; file versus selection and differing selection ranges remain separate. Literal percent sequences, `#`, `?`, and backslash filenames do not collapse onto different paths. The authored drive-letter normalization case also remains covered. This is bounded normalization evidence, not native testing on every OS/filesystem.
- **Context admission remains host-owned:** the global Lightbox shelf intentionally persists across source changes. Concurrent adds cannot bypass the absolute-key duplicate check or exceed the 50,000-word ceiling; selection order controls sequential intake. Catalog-time switches to the chosen file as the active source are refused before its text is read. Existing tests cover readable/nonempty/not-own-source constraints, partial notices, fresh estimates and context-only quotes being withheld as chapter evidence.
- **Existing limits are not new regressions:** if the active source changes to the candidate after the own-source guard but while its text read is pending, that file can still reach the global shelf. The same native-picker sequence reproduces on exact base and head. A shelf entry can also become the source later because the shelf survives source changes by design. This PR does not solve those older semantics; they are not counted as F-03 or as proof of a new ownership defect.
- **Modal lifecycle:** independent production DOM checks cover cancel without a choice, cancellation of a not-yet-fired search debounce, preservation of the current source/standing refusal/context shelf through canceled openings, fresh reopen, selection reset, single source choice, Context confirm, key-only payloads, both native-explore routes and no run/send side effects. Existing app/shared-modal tests cover top-overlay Escape and opener-focus restoration. They do not replace real keyboard/focus acceptance in VS Code.
- **#152/#153 boundary smoke:** full route/command suites retain source-ticket ordering. A 14-assertion production-bundle replay retains carried Subtext's said-first evidence, correct typography match label, and stale Bring gating. A retained 49-assertion Lightbox/Workshop DOM smoke keeps pin/Escape, overlays, confirmed Spark dismiss/undo, IDs-only Bring, unrelated-result guards, tray/source changes and staged-attachment removal. No old report was rewritten.

## Original-base Workshop parity and visual evidence

The final two parity suites and their two snapshot files were copied into a disposable archive of exact base `59b57b6`; no base implementation or expected snapshot was changed. The same files pass unchanged on original base and head: **2 suites / 10 tests / all 57 snapshots**. No snapshot update flag was used. The history also places witness commits before extraction, but the actual original-base run, not the author's assertion or history alone, establishes this result.

These witnesses exercise all three modes through real modal and `WorkshopApp` renders: browse/back, loading/empty states, toggle ordering, attached rows, local/content search and debounce, category filters, approximate context budget warning, message slot cap, callbacks, routes, Explore, close/reopen and Escape/focus behavior. They preserve observed baseline behavior, including the limitations discussed above; parity is not proof that the baseline had no defects.

All **48 moved CSS rule blocks** retain their ordered declarations after normalizing the scope selector from Workshop surface to full-tab frame. The four supplied Workshop excerpt before/after PNG pairs (browse and search at 1440/1000) are **byte-identical, with zero differing pixels**. Actual supplied Workshop pixels and 500px Lightbox source/search/Context pixels were opened and inspected. The narrow supplied Lightbox images keep the modal controls/footer visible; long paths ellipsize. The 1440px Context rail shows three entries and the wrapped source-action row.

The committed evidence has **23 records/images**: 15 Lightbox states at three widths and eight Workshop before/after records. It uses synthetic catalog/search replies and directly injected shelf answers. Therefore its Context rail shot establishes rendering and posted requests, not filesystem admission or real native dialog behavior. It does not click a source and follow a real host-board operation. Workshop attach/message, 500px Workshop, other modal styles, and native theme/focus behavior lack before/after pixel coverage.

Both freshly built production bundles match the documented SHA-256s exactly:

- Head: `b749c99b5db99e4b32633c1262fbc60ea7b7302a8644897f0dda357793ddbfe5`
- Base: `1f78a57895662bd001d4d69037b98e887c2c6183af4bce2eb49bba24dd55129b`

This ties the supplied evidence to reproducibly built source bytes. It does not make supplied screenshots into fresh captures. The comparator and harness are evidence-producing tools, not strict automatic gates: they print differences/errors rather than reliably failing on them. Actual comparisons and records were inspected.

### N-01: qualify the narrow Workshop hit-test claim

[`README.md:84–86`](evidence/lightbox-source-picker/README.md) states the 500px backdrop is topmost in both Lightbox and Workshop, checked with `elementFromPoint`. The retained harness captures Workshop only at 1440/1000, and contains no `elementFromPoint` assertion or stored result. No 500px Workshop fact exists. This does not establish a rendering bug; it means that particular coverage cannot be credited to the reproducible artifacts. Add its case/assertion or label it as a separate manual observation.

## Fresh verification

Runtime: Node `v24.19.0`, npm `11.9.0`. Head/base checks use isolated worktrees, unchanged lockfile dependencies and no tracked implementation edits. Independent scratch probes are excluded from ordinary suite totals.

| Check | Independently observed result |
| --- | --- |
| Head full Jest suite | **395 suites / 5,587 tests / 59 snapshots passed**, 201.093 seconds |
| Exact base full Jest suite | **389 suites / 5,516 tests / 2 snapshots passed**, 201.681 seconds |
| Base and head `npm run typecheck` | **Passed all three stages**: core, webview, extension |
| Base and head `npm run build`, including `verify:bundle` | **Passed**; three existing webpack size/performance warnings |
| Base/head ESLint JSON comparison | **0 errors / 1,133 warnings each**; file/rule/severity/message multiset identical |
| `git diff --check 59b57b6..2cf1f97` | **Passed** |
| Original-base and head Workshop parity | **2 suites / 10 tests / 57 unchanged snapshots passed on each** |
| Independent actual host/service probes | **3 suites / 21 tests passed**, including diagnostic reproductions of F-01/F-02 and inherited-limit controls |
| Same applicable host/search controls on exact base | **2 suites / 8 passed / 12 head-only skipped** |
| Exact rebuilt-production-picker DOM | **37 assertions passed**, covering lifecycle plus three explicit defect observations; these do not assert the defects are fixed |
| Retained production DOM boundary smoke | **14 carried-Subtext assertions + 49 Lightbox/Workshop assertions passed** |
| Exact implementation-head GitHub CI | [PR verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39457800960/job/118749124198) **passed** install, typecheck, tests, lint and build |

Cross-version scratch host/search probes disable ts-jest diagnostics solely to bridge changed test-harness exports; they do not replace the successful repository typechecks.

The first head full-suite attempt was killed with exit 137 during an overlapping build; it had no assertion failure before termination and is **not** counted as a pass. The completed full-suite runs above run serially. A transient reviewer dependency-materialization error (`.bin/tsc` copied as a file rather than its original symlink) was corrected before typecheck reruns; it was not an implementation failure.

Fresh Chromium harness replay could not launch in this environment: the sandbox reported a socket permission failure, and an escalated launch failed at the read-only session mount before browser startup. The supported already-running cloud browser separately refused local `file:` URLs under its protocol policy. Those denials were not bypassed, and no fresh screenshots were produced. Supplied pixels, exact artifact hashes and JSDOM protocol observations are kept distinct from browser/native acceptance.

No user-computer access, live/billable provider calls, private manuscripts, implementation edits, PR comments/formal reviews, merge or deployment were performed. This report is the review deliverable; publication and any report-head CI are handled separately. Reviewed implementation remains `2cf1f97`.

## Next step

Fix F-01 and F-02, then rerun their adversarial order/multi-root witnesses along with the unchanged Workshop parity suite and ordinary gates. Keep the native VS Code acceptance and writer real-chapter output checkpoint explicitly open. Neither green CI nor pixel-identical excerpt screenshots substitute for those decisions.
