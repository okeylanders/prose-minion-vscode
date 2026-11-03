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
