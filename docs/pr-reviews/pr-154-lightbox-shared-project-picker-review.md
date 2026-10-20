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

## Author response (2026-10-20)

**F-01, F-02 and N-01: addressed.** The fixes are `044907b` (F-01), `1c2897a` (F-02) and `50520c9` (N-01). `6e2befd` lists F-01's new request-id bound with the prompt-budget guard's other non-prompt limits, and `8eccf49` updates the ADR, the agents guide and the epic README. Nothing above this section was edited.

### F-01: answers correlated with their opening and request

**Root cause.** The finding is correct. `useLightboxProjectFiles` treated every `LIGHTBOX_PROJECT_CATALOG` and `LIGHTBOX_PROJECT_CATALOG_SEARCH_RESULTS` as the answer to the request on screen, and the contracts carried nothing that could say otherwise. The host's routes await independently and post every completed answer, so the hook's single slot took whichever answer finished last. The shared component's query check kept an old query's matches out of the rows, but it could not stop the hook from overwriting the newer result, and nothing told one opening from the next.

**Correlation design.**
- **The webview mints the ids.** Each id is `lbp-<random>:<opening>:<kind>-<n>`. The random prefix is drawn once per webview, so a reloaded webview never takes an answer meant for the one before it. `<opening>` moves on every open and every close, and `<n>` counts every request the hook has made.
- **At most one answer is pending per kind.** The hook keeps one pending catalog id and one pending search id.
  - `open(picker)` starts a new opening. Its catalog id becomes the only pending answer, and the catalog, the unreadable flag and the search result are cleared.
  - `close()` starts a new opening and drops every pending answer.
  - `search(query)` replaces the pending search id, so an older query's answer is dropped. A stored result for a different query (trimmed, case-folded) is taken down at once, with its bounded note.
  - `clearSearch()` drops the pending search and the stored result.
- **An answer is taken only when its id is the one pending.** Once taken, nothing is pending for that kind, so a duplicate is dropped too. Any other answer is ignored and leaves what is on screen alone. Query equality plays no part, so the same query in a new opening, or retyped after a clear, is a new request.
- **The host echoes the ids.** `LightboxProjectFiles.catalogReply` and `searchReply` echo `requestId` on the answer. A request with no id, or one over 200 characters, is logged and answered with nothing, because no webview could claim the answer.
- **Shared code is unchanged.** `ProjectResourcePickerModal`, the Workshop's routes and the parity snapshots are as they were at `2cf1f97`.
- **`bounded`.** It shows only on the stored result, and that result is now always the accepted answer to the latest search this opening sent.
  - One residual remains, and it is the shared component's. The component owns the query text and the 350 ms debounce. While a newly typed query waits out the debounce, the previous query's accepted answer is still stored. Its matches are not merged, because of the component's query check, but its bounded note can show until `search()` fires and takes it down.
  - Closing that window needs a per-keystroke callback from the shared component, which would change the Workshop. The Workshop has the same single-slot behavior, which the review's base distinction already notes.

**Tests.** `LightboxProjectPickerReplies.test.tsx` (7 tests) renders the real `LightboxApp` over the real `LightboxHandler`, `LightboxService` and `WorkshopContextIntakeService`. It holds catalog opens through `lightboxHandlerHarness` and delivers host answers in the order each case needs. `LightboxProjectSource.test.ts` gains a host test. I ran all eight over `2cf1f97`'s sources with type diagnostics off. Each failed at its behavioral assertion:

| Test | Result on `2cf1f97` |
| --- | --- |
| A canceled opening's late failure | The catalog on screen was replaced by the failure's empty, unreadable one |
| A canceled opening's late success, with a stale listing | Categories became the stale "Themes" |
| Source picker → Context picker reopened | The Context picker's catalog was emptied by the source picker's late failure |
| `amberneedle` answered after `violetneedle` | The `violetneedle` match vanished |
| The same query in a new opening, with different file text by the time the old one reads | The old opening's answer (`second.md`) replaced the new one's (`first.md`) |
| A search cleared while it ran, then retyped | The cleared search's match showed before the new search answered |
| Bound note only for the current answer | The older query's bounded answer raised the note over the current, unbounded one |
| Host echoes ids as sent, ignores an id-less request | Answers carried no `requestId`, and id-less requests were answered |

The existing webview tests now echo the posted id from the host, and the existing host tests send one.

### F-02: host file identity, not display text

**Root cause.** The finding is correct. `LightboxProjectPicker` built its "on the shelf" set from `LightboxContextFile.displayPath` and compared it with each row's `path`. A display path omits its workspace folder, while the shelf dedupes by absolute path (`sourceKey`). So a second folder's same-named file disabled the first folder's row, which the host would have accepted.

**Identity design.**
- **The key.** The new `infrastructure/lightbox/LightboxFileKey.ts` exports `lightboxFileKey(absolutePath)`. It is an HMAC-SHA256 of the path under a 32-byte secret drawn once per extension session, truncated to 32 hex characters. The same file gets the same key, different files get different keys, and a key cannot recover a path or test a guessed one.
  - The secret is module state, so no service is constructed in `MessageHandler` or at the composition root.
  - It is never posted or logged.
- **Both sides key the same string.** `LightboxProjectFiles` keys each catalog row from the resolver's `absolutePath`. `LightboxContextShelf` keys each file at add time from the very `sourceKey` it dedupes by, whichever door added it.
  - So a row shows "attached" exactly when the shelf would refuse that file as "already in the context". I did not normalize the key separately, because a key normalized differently from the shelf's dedupe could disagree with the host.
- **Choices are unchanged.** They still name `{ group, path }` only, and no absolute path crosses the wire.
- **No host-side recompute is needed.** The attached state is derived in the webview on every render, from two host-derived inputs:
  - the catalog, fetched fresh on each opening;
  - the shelf with its keys, which `LIGHTBOX_CONTEXT_FILES` reposts after every add and removal.

  In practice the shelf cannot change while the picker is open. The Lightbox is a single tab, the picker's confirm and Explore both close it, and the rail's Remove sits behind the backdrop. If a shelf update did arrive, the next render would compare against it.
- **The cross-folder collapse is recorded, not fixed.** The resolver's older collapse, which lists only the first folder's file, is out of scope as you said. It was not tracked, so it is now [Low debt](../../.todo/tech-debt/2026-10-20-context-catalog-cross-root-collapse.md).

**Tests.** `LightboxProjectPickerMultiRoot.test.tsx` (2 tests) builds two workspace folders, each with `Notes/cast.md`. It uses the real `ContextResourceResolver`, `WorkshopContextIntakeService`, `TextSourceResolver`, `LightboxContextShelf`, `LightboxService`, `LightboxReadingRunner`, `LightboxHandler` and `LightboxReadingHandler`, rendered through `LightboxApp`. Only the platform ports are fakes: the file system, the workspace, the settings and the system picker. The engine is never reached.

| Test | Result on `2cf1f97` |
| --- | --- |
| Attach root B natively; root A's row stays selectable; adding it keeps both (the shelf holds both texts, and the rail lists `Notes/cast.md` twice); root A's row is then attached | Root A's row was disabled after root B's native attach |
| Attach root A natively; its row is attached, its catalog key equals the shelf file's, and no `/root-a` or `/root-b` path is posted | The catalog row had no `fileKey` |

Existing context-file fixtures and assertions gained their keys. The catalog's field list in `LightboxProjectSource.test.ts` now includes `fileKey`, and the boundary list includes `LightboxFileKey.ts`.

### N-01: the backdrop check is now in the harness

The harness now takes the Workshop's before and after shots at 500 px as well as at 1440 and 1000. Every shot with a dialog records `backdrop` in `facts.json`:
- `onTop` is true when `document.elementFromPoint` returns the backdrop at each of eight points outside the dialog;
- `coversViewport` is true when the backdrop's box spans the window.

Both are true in all 24 dialog shots: 12 Lightbox, and 12 Workshop before and after. The README cites those facts instead of a run-time observation.

The harness also plays the host as it now behaves: it echoes ids and adds stand-in keys. `compare.py` now also counts pixels inside the dialog's box:
- **Inside the dialog:** 0 differing pixels in all six Workshop pairs, and the dialog markup is identical.
- **Outside the dialog:** up to 20 pixels in the header's pills, under the backdrop, vary by one level between two runs of the same bundle (base or head). The README therefore no longer claims byte-identical Workshop runs. The Lightbox shots were byte-identical across the two runs.

Against the first evidence set, only `context-attach-1000` changed: 10 pixels of raster noise at the logo's edge, under the backdrop. `facts.json` only gained the new fields and entries. The regenerated set was built from the fix head's bundle, `webview.js` SHA-256 `56749f8e761a1c38d762233ee947506a31a1d7c1cea829ac7961d6b88031e826`, which the final build reproduced.

### Contract changes

| Contract | Change |
| --- | --- |
| `LIGHTBOX_REQUEST_PROJECT_CATALOG` | Payload goes from `{}` to `LightboxRequestProjectCatalogPayload`, `{ requestId }` |
| `LIGHTBOX_SEARCH_PROJECT_CATALOG` | Payload goes from `{ query }` to `LightboxSearchProjectCatalogPayload`, `{ requestId, query }` |
| `LIGHTBOX_PROJECT_CATALOG` | Gains `requestId`; `entries` become `LightboxProjectCatalogEntry[]`, which adds `fileKey` |
| `LIGHTBOX_PROJECT_CATALOG_SEARCH_RESULTS` | Gains `requestId` (`LightboxProjectCatalogSearchResultsPayload`) |
| `LightboxContextFile`, in `LIGHTBOX_CONTEXT_FILES` | Gains `fileKey` |
| `LightboxProjectFiles` (host) | `catalog()` and `search()` become private behind `catalogReply(request)` and `searchReply(request)` |
| `LightboxContextShelf` (host) | `list()` and `add()` return each file's `fileKey` |

- There is a new type, `LightboxProjectRequestCorrelation`, and a new module, `LightboxFileKey.ts`.
- No message type or route was added. `LIGHTBOX_CHOOSE_PROJECT_SOURCE` and `LIGHTBOX_ADD_PROJECT_CONTEXT` still carry catalog keys only.
- `configuredResources.ts` and every Workshop contract are unchanged.
- Nothing here is persisted. The shelf lives in memory, and keys last one session.

### Verification

| Check | `2cf1f97` (this review) | Fix head `8eccf49` |
| --- | --- | --- |
| Full Jest | 395 suites / 5,587 tests / 59 snapshots | **397 suites / 5,597 tests / 59 snapshots passed** |
| Workshop parity | 2 suites / 10 tests / 57 snapshots | **Unchanged.** No `.snap`, shared-picker or Workshop component or handler file changed since `2cf1f97` |
| `npm run typecheck` | Passed | **Passed**: core, webview and extension |
| `npm run lint` | 0 errors / 1,133 warnings | **0 errors / 1,133 warnings**, identical per file, rule and severity to `59b57b6` |
| `npm run build`, including `verify:bundle` | Passed | **Passed**, with the same three webpack size warnings |
| `git diff --check` | Clean | **Clean**, from `59b57b6` and from `2cf1f97` |

- The suite gains 2 suites and 10 tests, and every snapshot is unchanged.
- `044907b` on its own fails the prompt-budget guard; `6e2befd` lists the bound.
- `packages/core/src` still has no `vscode` import.
- The run used Node 22.22.0 and npm 10.9.4. No live or billable call was made, and no lockfile changed.
- This response is the only commit after `8eccf49`, and it changes nothing but this report.
