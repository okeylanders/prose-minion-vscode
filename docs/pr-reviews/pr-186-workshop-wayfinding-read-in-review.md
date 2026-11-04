# PR #186 review: Workshop Wayfinding Slice 2, Read in and the reader

**Disposition: changes requested. One independently reproduced P2 reader race. Review is continuing.**

**Reviewed implementation head:** `5932927f6fa3955dd03b251950e22b4088bee478`  
**Base:** `d45d57c2774335186169ba9f7576c4046c99c80e`  
**PR:** [#186](https://github.com/okeylanders/prose-minion-vscode/pull/186) · **Reviewed:** 2026-11-03

This early report is being published while the rest of the implementation and its integration are still under review. It is not a formal GitHub review, approval or authorization to merge.

## F-01: P2: an earlier request for the same file can supply the reopened reader

**Locations:** [`useWorkshopReadIn.ts:64–83`](https://github.com/okeylanders/prose-minion-vscode/blob/5932927f6fa3955dd03b251950e22b4088bee478/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopReadIn.ts#L64-L83), [`WorkshopTextSheet.tsx:223–234`](https://github.com/okeylanders/prose-minion-vscode/blob/5932927f6fa3955dd03b251950e22b4088bee478/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L223-L234).

A response is accepted solely by `{ group, path }`. That pair identifies a resource, not a particular request or reader lifetime. Closing and reopening the same resource creates a second request with the same pair, so a late first response is indistinguishable from the second. The text sheet seeds its displayed value on the first accepted response and does not replace it when the second arrives.

**Independent production-App reproduction:**

1. Open a read-in resource, starting request A. Close the sheet while A is pending.
2. Reopen that same resource, starting request B.
3. Deliver A's old content, then B's newer content.
4. The reopened reader still displays A's content after B completes. The full `WorkshopApp` regression probe fails the expected B-content assertion, showing the old A content.

The reader says it shows the file as it is now, and its editor action can open the newer file. A stale or out-of-order response can therefore mislead the writer even after the current request has completed. The same pair-matching issue applies to A → B → A navigation.

**Requested correction:** give each request a unique correlation identity or equivalent generation that travels through the host response; accept only the currently pending request for the current reader lifetime. Invalidate it on close and replacement, and ensure the displayed sheet body can never be seeded by an earlier request. Cover Close → reopen same resource and A → B → A with both response orders, plus a current-request success control. Consider room replacement and chat-target changes as part of the same lifecycle.

## Verification and limits so far

A full-App independent regression reproduces F-01: **1 expected failure**. Six focused existing suites pass **124 tests**. These are separate observations, not a claim that the full repository suite or native VS Code acceptance has passed. The implementation is still under review, including resource authorization, race isolation, badge state and integration. No implementation change, formal review, merge or paid provider call was made.


## Completed review and verification

The functional, state, resource-access and presentation review found no additional actionable issue beyond F-01. Review covered configured-resource resolution and refusals, read ceilings, sanitization, reader actions, the shared source partition, badge baselines, target and room changes, and the existing attachment flow. In particular, the apparent row-identity collision across configured groups was not reproducible through the production catalog: it deduplicates normalized paths across groups, and configured rows use full paths.

Independent checks on `5932927f`:

- **19 production suites / 329 tests pass**, covering reader/UI, badge/controller, partition, context gauge, capability/codec/intake, routes and architecture boundaries.
- **4 separate state probes pass**, covering initial hidden-tab hydration, metadata/reorder/removal, participant A → B → A, repeated deliveries, non-opening kinds, room replacement and badge clearing.
- The separate full-App F-01 probe remains an **expected failure**, not part of the passing totals. The access review also ran targeted containment/symlink, sanitizer and modal tests.
- [CI run 41735806530](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41735806530) passed on synthetic merge `ac9fe10` of implementation `5932927f` into `d45d57c`: **599 suites / 8,499 tests / 59 snapshots**, typecheck, lint and both webpack builds.

Report commit `d561a243` changes no executable source. Native VS Code editor-column behavior, real keyboard/screen-reader acceptance and live writer acceptance were not exercised. Correct F-01, then re-review the new exact head and its CI. No formal GitHub review, approval or merge was made.

## Author response (2026-11-03)

F-01 is fixed in `7a153fd` and `1687b0a`, on top of the coordinator's merge
of the epic (`8d27899`, which brought Slice 6). Nothing above this section was
edited.

The pair names a file, not a request, so the fix gives every request its own
identity. **`WORKSHOP_REQUEST_READ_IN_RESOURCE` carries a webview-minted
`requestId`, and the host echoes it on `WORKSHOP_READ_IN_RESOURCE_CONTENT`.**
This is the Lightbox's correlation pattern (PR #154 F-01): a per-webview
random prefix plus a counter, so a reloaded webview never takes an answer
meant for the one before it.
- `useWorkshopReadIn` holds one pending request and takes a reply only when
  its `requestId`, group and path all match. It takes that reply once: a
  duplicate or a straggler never replaces it.
- The pending id is dropped on close, and replaced when another row opens.
- **Room replacement and chat-target changes** (`1687b0a`): the context-sheet
  controller takes `readInScopeKey`, which is the room generation plus the
  chat target's identity. When it changes, an open reader closes and its
  pending request is dropped, so a late reply lands nowhere. Other sheets
  stay open. The reader's heading names who read the file, so it doesn't
  outlive that participant or room.
- **Seeding.** The sheet unmounts on close, so each opening seeds from its
  own first body. Only the current request's reply can supply that body.
- The host ignores a content request with no usable id (missing, empty, not a
  string, over 128 characters) and reads nothing, because no webview could
  match its reply.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests |
| --- | --- | --- | --- | --- |
| F-01 | P2 | **Fixed** (`7a153fd`, `1687b0a`) | The content request carries `requestId`, and the reply echoes it. `useWorkshopReadIn` accepts only the pending request's first reply. Close, opening another row, room replacement and a chat-target change each drop the pending id; the last two also close the reader. The host ignores id-less requests. The id's length limit is listed with the Lightbox's in `promptBudgets.test.ts`'s `NON_PROMPT_LIMITS`. | `WorkshopApp.readIn.test.tsx` (production App): Close → reopen the same file with the earlier reply first, and with it last (**your probe**). A → B → A with earlier replies in request order, in reverse, and first-A-last, then the current answer, then a straggler. A late reply after a room replacement, and after a chat-target change. The current-request success case stays as the control. `useWorkshopReadIn.test.ts`: the same orders at the hook, plus a duplicate reply and a cleared reader. `useWorkshopContextSheet.test.ts`: a scope change closes the reader and drops its request, and leaves other sheets open. `WorkshopReadInRoutes.test.ts`: each request's id is echoed, and requests with a missing, empty, non-string or over-long id are ignored without reading |

### What fails on `5932927`

These are the new test files run against `5932927`'s source in a scratch
worktree:
- **All seven new F-01 App cases fail**, and the four existing App cases pass.
  The earlier-reply-first Close → reopen case shows A's content, as your
  probe did. The other six also trip on the new id assertions, because
  `5932927` sends no `requestId`.
- `useWorkshopReadIn.test.ts` doesn't compile there, because the reply payload
  has no `requestId`.

On the fixed head, removing only the hook's request-id check brings back the
earlier-reply-first failure.

### Verification at `1687b0a`

- `npx jest`: **606 suites / 8,601 tests / 59 snapshots**, all passing.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,136 warnings, the same count as the merged head
  `8d27899`.
- `git diff --check`: clean. No `from 'vscode'` in core.


## Re-review at `0f940b6` (2026-11-03)

**Disposition: F-01's original late-response race is fixed; one additional P2 reader-state issue remains.** This is a branch report, not a formal GitHub review, approval or authorization to merge.

F-01 now has a unique request ID echoed by the host. Independent full-App probes pass the original close/reopen witness, all six A → B → A response permutations with mixed successes and refusals, duplicate replies, mismatched IDs/pairs, and late responses after room or target replacement. Host probes confirm invalid IDs are rejected before catalog access and the ID survives success and error paths. **57 production tests and 30 separate access/correlation probes pass.**

### F-02: P2: replacing an open reader can retain the preceding file's body

**Locations:** [`useWorkshopContextSheet.ts:204–220`](https://github.com/okeylanders/prose-minion-vscode/blob/0f940b627f8f7e656e151f16c367376c96dbf289/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopContextSheet.ts#L204-L220), [`WorkshopApp.tsx:1378–1383`](https://github.com/okeylanders/prose-minion-vscode/blob/0f940b627f8f7e656e151f16c367376c96dbf289/packages/core/src/presentation/webview/WorkshopApp.tsx#L1378-L1383), [`WorkshopTextSheet.tsx:223–234`](https://github.com/okeylanders/prose-minion-vscode/blob/0f940b627f8f7e656e151f16c367376c96dbf289/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L223-L234).

A full-App probe opens and finishes loading resource A, then activates resource B without closing the sheet. The B request has a fresh ID and its response is correctly accepted, and the dialog heading changes to B, but the preview remains A's text. The sheet stays mounted and seeds its local draft only once per opening, so changing the sheet mode/ref in place does not seed B. The independent expected-B assertion fails with A's content.

The ordinary pointer path is blocked by the full-screen backdrop. The keyboard path is supported by source and DOM inspection: the modal is a `div` with `aria-modal`, the background rows remain enabled and not inert, and [`useOverlayDismiss`](https://github.com/okeylanders/prose-minion-vscode/blob/0f940b627f8f7e656e151f16c367376c96dbf289/packages/core/src/presentation/webview/hooks/useOverlayDismiss.ts#L46-L55) handles Escape but does not trap Tab. Thus a user can tab out of the modal and activate a background row. The native Chromium keyboard sequence was **not** independently exercised because Chromium could not start in the review environment; the wrong-body result itself is independently reproduced in the production App. This state issue was present in the original Slice 2; it was not introduced by the request-ID correction.

Please prevent the title/body mismatch when the reader target changes, for example by making a new target a new sheet lifetime or explicitly reseeding the read-only body. Also address the modal's background keyboard access as appropriate. Add an App regression that loads A, activates B without an intervening close, receives B, and verifies B's heading and body together; check reverse order and retained editable-sheet behavior. A focus-trap test or native keyboard acceptance should establish the intended modal interaction.

**CI:** [run 41740258255](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41740258255) passed on synthetic merge `dc6ee80` of `0f940b6` into `07d24e7`: **606 suites / 8,601 tests / 59 snapshots**, typecheck, lint and both builds. The full local suite was not rerun independently. Native VS Code editor-column and screen-reader acceptance remain unverified. No implementation change, formal approval or merge was made.

## Author response to the re-review (2026-11-03)

F-02 is fixed in `3c184c2`. Nothing above this section was edited.

- **Each reader request is its own sheet lifetime.** The context-sheet
  controller returns `sheetKey`, and `WorkshopApp` keys `WorkshopTextSheet`
  with it. A reader's key is its current request (`read-in:<requestId>`, or
  the pair before the hook's state for it lands), so activating another row
  remounts the sheet, which seeds from that request's own reply. All authoring
  modes share the key `sheet`, so they behave exactly as before.
- **Background keyboard access.** `WorkshopModalShell` had no focus trap and
  no `inert` background; that gap is shared by every Workshop modal. Following
  the scope you set, the shell gains an opt-in `trapFocus`, which wraps Tab
  and Shift+Tab at the dialog's first and last tab stops. Only
  `WorkshopTextSheet` turns it on. Every other modal's markup and behavior are
  unchanged, and `FullTabShell`, which the Lightbox shares, is untouched. The
  shared gap is filed as
  [tech debt](../../.todo/tech-debt/2026-11-03-workshop-modal-focus-containment.md).

| ID | Severity | Disposition | Fix | Regression tests | On `0f940b6` |
| --- | --- | --- | --- | --- | --- |
| F-02 | P2 | **Fixed** (`3c184c2`) | `sheetKey` per reader request remounts the sheet for a new target. Opt-in `trapFocus` on `WorkshopModalShell`, on for the text sheet only. | `WorkshopApp.readIn.test.tsx`, activating the row directly behind the open sheet: **your probe** (A loaded, then B: heading and body both B); B opened while A is still loading shows the loading line, never A's text; B-then-late-A and late-A-then-B both show only B. `WorkshopTextSheet.test.tsx`: Tab from the last stop and Shift+Tab from the first stay in the dialog, for the reader and for an authoring sheet, and Tab between inner stops is left to the browser. `useWorkshopContextSheet.test.ts`: authoring modes share one key across mode changes; each reader request keys apart | **Fail:** both App cases where A had loaded, and both focus cases. **Pass, as controls:** the two orders where A never loaded, since nothing was seeded. The controller suite doesn't compile there, because `sheetKey` doesn't exist yet. The existing editable-sheet tests pass on both heads |

**Verification at `3c184c2`:**
- `npx jest`: **606 suites / 8,608 tests / 59 snapshots**, all passing.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,136 warnings, unchanged.
- `git diff --check`: clean. No `from 'vscode'` in core.

Native keyboard and screen-reader acceptance remain Slice 8's.


## Independent re-review of `8c15a70` (2026-11-03)

**Disposition: F-01 and F-02 are resolved; no new actionable defect found in the correction.** This report is not a formal GitHub approval or authorization to merge.

- **F-02:** The original full-App loaded-A → B wrong-body reproduction now passes unchanged. The reader gets a fresh sheet lifetime for each request, so B's heading and body both show B. Independent controls cover same-file reopening, pending and reversed replies, a refusal clearing the old body, and retained authoring drafts. The text-sheet focus trap wraps Tab and Shift+Tab in the tested App DOM, including preview/source and changing enabled controls; Escape and opener focus restoration still work.
- **F-01:** The prior close/reopen, all six A → B → A reply orders, late successes and refusals, duplicates, mismatched IDs/pairs, room/target replacement, and host ID-validation probes remain passing after the remount/focus changes. Configured-resource authorization and read-cap regressions also pass.

**Independent verification on `8c15a70`:** the F-02 correction has **4 production suites / 53 tests** and **8 separate full-App probes** passing; access/correlation verification has **9 suites / 163 tests** passing, including **30 independent probes**. These groups overlap; they are not additive totals. Native Chromium Tab traversal was not exercised because the browser could not start under the review environment's socket restrictions; the focus evidence is App DOM/event testing and source inspection. Native VS Code editor-column and screen-reader acceptance remain unverified.

[CI run 41742363318](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41742363318) passed on synthetic merge `050f822` of `8c15a70` into `07d24e7`: **606 suites / 8,608 tests / 59 snapshots**, typecheck, lint and both builds. The full local suite was not rerun independently. No implementation change, formal approval, merge or paid provider call was made during this re-review.


### N-01: Positive tabindex in rendered Markdown can evade the focus wrap (P3)

The new trap's `tabbableWithin` orders elements by DOM position rather than browser tab order ([`WorkshopModalShell.tsx:103–110`](https://github.com/okeylanders/prose-minion-vscode/blob/8c15a70ee32d8d85d7361476d58c39ded9ba380b/packages/core/src/presentation/webview/components/workshop/WorkshopModalShell.tsx#L103-L110)). The production Markdown sanitizer retains `<a href="#entry" tabindex="1">Priority link</a>`. In an independent full-App probe that link renders in Preview, has `tabIndex === 1`, can receive focus, and Shift+Tab is not prevented because the header Close button is considered the first element. Positive tabindex changes native tab order, so that control can be the actual first stop and the wrap can fail. This is a nonblocking focus-hardening note, not a recurrence of F-02's wrong-body defect. Consider stripping positive tabindex from rendered content or ordering tabbables as the browser does; add a focused regression.

The probe establishes rendered DOM, focus and lack of event cancellation in jsdom. Actual native Tab movement was not verified because Chromium could not start in the review environment. This note qualifies the earlier statement that no new actionable issue was found: no further blocking issue was found, but this P3 edge remains.

## Author response to N-01 (2026-11-04)

Nothing above this section was edited.

| ID | Severity | Disposition | Fix | Regression test | On `8c15a70` |
| --- | --- | --- | --- | --- | --- |
| N-01 | P3 | **Fixed** (`fe0d47d`) | `tabbableWithin` orders stops as the browser does: positive `tabIndex` ascending (ties in document order, by a stable sort), then `tabIndex` 0 in document order. The trap wraps at the first and last of that order. The shared Markdown sanitizer is unchanged. Stripping positive `tabindex` from rendered content is filed as [tech debt](../../.todo/tech-debt/2026-11-04-markdown-positive-tabindex.md). | `WorkshopTextSheet.test.tsx`: a reader whose rendered file holds `<a href="#entry" tabindex="1">`. Shift+Tab from the link wraps to the last stop (Close), and Tab from Close goes to the link | **Fails** (`8c15a70`'s `WorkshopModalShell.tsx` with this test). Passes at `fe0d47d` |

**Verification at `fe0d47d`:**
- `npx jest`: **606 suites / 8,609 tests / 59 snapshots**, all passing.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,136 warnings, unchanged.
- `git diff --check`: clean.


## Re-review of `28b873c` (2026-11-04)

The original N-01 witness is fixed: the previously uncancelled Shift+Tab is now prevented. The updated witness and **10 independent controls** pass, including positive-index ordering/ties, hidden and disabled exclusions, ordinary reader controls and authoring Preview/Apply. **4 production suites / 54 tests** and webview typecheck pass. F-01/F-02's reader correctness fixes are unchanged. Native Chromium Tab traversal was not exercised; the following residual note is grounded in the production App's DOM and key-event behavior.

### N-02: Background positive tabindex can interleave with the modal's local order (P3)

The trap sorts its own controls but intercepts only the local first/last boundary. A positive-tabindex control outside the modal can fall between two of its controls in the browser's document-wide order. In an independent full-App probe, a rendered transcript link outside the reader has `tabindex="2"`; the reader Preview contains a link with `tabindex="1"`. Both survive sanitization, the outside link has no inert ancestor and can be focused, and Tab on the focused reader link is **not prevented** because it is not the local last stop. Native sequential order places the outside positive-2 link after the reader positive-1 link and before the reader's ordinary zero-index controls. Thus local sorting alone does not fully establish focus containment. Actual native transition remains unverified due the review environment's Chromium socket restriction.

Consider preventing and directing every Tab step within the computed local order, making the background inert while the sheet is open, or another solution that accounts for document-wide positive indices. A regression should cover an outside positive-index control interleaved with a reader control. This is a nonblocking focus-hardening note; it does not reopen the resolved stale-body findings.

[CI run 41745159699](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41745159699) was in progress at report time. No implementation change, formal approval or merge was made during this re-review.

## Author response to N-02 (2026-11-04)

Nothing above this section was edited.

| ID | Severity | Disposition | Fix | Regression tests | On `28b873c` |
| --- | --- | --- | --- | --- | --- |
| N-02 | P3 | **Fixed** (`cf1b8c4`) | With `trapFocus` on, the dialog handles **every** Tab and Shift+Tab. It calls `preventDefault`, finds the active element in its own browser-ordered stops (N-01), and focuses the next or previous stop, wrapping at the ends. From outside its stops, Tab goes to the first and Shift+Tab to the last. The page-wide tab order never takes part. Still opt-in; other modals are unchanged. | `WorkshopTextSheet.test.tsx`: **your case**, with a `tabindex="2"` link behind the sheet and the sheet's own `tabindex="1"` link. Tab from the sheet link goes to the next sheet stop (the header Close), never outside, and Shift+Tab comes back. Both containment tests now step through every middle stop forward and back, in local order. Focus outside the stops starts at the first or last. The wrap and N-01 tests still pass | **Fail:** the interleave test, and both containment tests' new stepping assertions. **Pass:** the outside-focus case, because `28b873c` already sent that to the ends. The F-02 test's old assertion, that Tab between inner stops is "left to the browser", no longer describes the design, so it now asserts local stepping |

**Verification at `cf1b8c4`:**
- `npx jest`: **606 suites / 8,611 tests / 59 snapshots**, all passing.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,136 warnings, unchanged.
- `git diff --check`: clean.


## Re-review of `a7b0222` (2026-11-04)

N-02's global-order witness is fixed: Tab is now intercepted and directed among the dialog's own controls. The updated witness and **12 independent full-App controls** pass; **4 production suites / 56 tests** and webview typecheck pass. One new nonblocking accessibility regression follows.

### N-03: Manual traversal skips native Markdown disclosure controls (P3)

[`WorkshopModalShell.tsx:63–80`](https://github.com/okeylanders/prose-minion-vscode/blob/a7b02223bdcd77e81051b8bbd5970353be528ba8/packages/core/src/presentation/webview/components/workshop/WorkshopModalShell.tsx#L63-L80) now handles every Tab itself, but its [tab-stop selector](https://github.com/okeylanders/prose-minion-vscode/blob/a7b02223bdcd77e81051b8bbd5970353be528ba8/packages/core/src/presentation/webview/components/workshop/WorkshopModalShell.tsx#L104) does not include native `<summary>` elements. Rendered Markdown can contain `<details><summary>Character details</summary>Backstory.</details>`: it survives sanitization, the summary has `tabIndex === 0`, and it can receive focus. In an independent full-App probe, Tab from the preceding Preview control is prevented and focus jumps directly to Open beside, skipping the summary, so a keyboard user cannot reach that disclosure through this trap.

This is introduced by replacing native middle-step Tab behavior with the manual traversal. Include native disclosure controls in the dialog's tab order and test a sanitized Markdown details/summary alongside ordinary links and controls. Consider other native focusable elements and disabled/hidden ancestors when defining the traversal. This is a P3 focus-hardening note, not a recurrence of the resolved reader-content issues. The DOM and event result are reproduced; native Chromium traversal remains unverified because of the review environment's socket restriction.

[CI run 41747153971](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41747153971) was in progress when checked. No implementation change, formal approval or merge was made during this re-review.


**Additional N-03 witness:** This is a native-tabbability enumeration problem, not only a missing `summary` selector. A separate full-App probe renders `<fieldset disabled><button>Unavailable action</button></fieldset>` in the reader. The button's own `disabled` property is false while `matches(':disabled')` is true because its fieldset is disabled. The trap selects that unfocusable button, prevents Tab, and focus stays on the preceding Preview control. Both this and the skipped-summary assertion fail on `a7b0222`. A correction should cover effective disabled state as well as all supported native focusable elements; closed or otherwise non-visible ancestors should also be considered and tested where native behavior is available.
