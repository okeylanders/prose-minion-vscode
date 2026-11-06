# PR #234: Persona File Edits Slice 4b review

## Verdict

**Changes requested: F-02 (P2), a refused preview cannot be retried after the first correction. F-01 is closed at `4c894d7d`.** No production code was changed by this review. No merge was performed.

- PR: <https://github.com/okeylanders/prose-minion-vscode/pull/234>
- Initial reviewed code: `f8d46cce66e9bcc94b6db0b5013761c5eebccd32`
- Correction reviewed: `4c894d7d49c8da69dd2804a78e87a7c907f24124`
- 4b-only diff: `d0c172b7..f8d46cce`; 4a is the separately reviewed #233 dependency.
- Initial review: <https://github.com/okeylanders/prose-minion-vscode/pull/234#pullrequestreview-5794537859>
- Correction review: <https://github.com/okeylanders/prose-minion-vscode/pull/234#pullrequestreview-5794568568>
- Before this pass, #234 had no reviews, comments or inline threads.

The review covers the hook, card/view/diff rendering, per-card requests and room lifecycle, App/router/Thread wiring, shared state wording, approval controls, and the combined host contract. The host's claim/checkpoint/gateway implementation is owned by the #233 review. This report does not replace that dependency's acceptance or Slice 5's native-host pass.

## F-01 (P2, closed): A retained open rewrite disclosure does not request the replacement room's preview

**Anchor:** [`WorkshopFileEditOperation.tsx:92–101`](https://github.com/okeylanders/prose-minion-vscode/blob/f8d46cce66e9bcc94b6db0b5013761c5eebccd32/packages/core/src/presentation/webview/components/workshop/fileEdits/WorkshopFileEditOperation.tsx#L92-L101).

The preview is requested only from the disclosure's `onToggle`. A room replacement can retain the same turn ids and proposal indexes, as with opening a related saved room, branching or rewinding retained history. `WorkshopThread` keys by turn id and `WorkshopTurnFileEdits` keys by proposal index, so the open `<details>` remains mounted. Meanwhile, [`useWorkshopFileEdits.ts:167–182`](https://github.com/okeylanders/prose-minion-vscode/blob/f8d46cce66e9bcc94b6db0b5013761c5eebccd32/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopFileEdits.ts#L167-L182) correctly discards the old room's cached and pending previews.

The result is an open panel showing **“Reading the file…” with no preview request in flight**. No toggle occurs merely because the room changed. It never finishes until the writer discovers that closing and reopening the disclosure starts a new request. The same defect occurs whether the old room's preview was already ready or still loading. A late old-room answer is correctly ignored, but does not repair the missing new-room request.

### Reproduction and correction contract

1. Render a pending rewrite card in room 5 and open “Before and after.”
2. Either answer its preview or leave the read in flight.
3. Deliver the replacement room 6 snapshot with the same turn/card ids.
4. The same `<details>` is still open, its contents say “Reading the file…,” and the only posted preview request names room 5.
5. Closing and reopening finally posts for room 6.

**Required correction:** give the disclosure the same room-scoped lifecycle as its preview cache. It may close/remount on replacement, or stay open and request the current room's preview. Do not retain old-room before/after text to conceal the problem, and do not weaken late-answer rejection. Cover both ready and in-flight old-room reads with the real App/router path.

[Independent two-case witness](probes/pr-234-room-disclosure-probe.test.tsx.txt): copy to `packages/core/src/__tests__/presentation/webview/Review234Independent.test.tsx`, then run:

```sh
npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/presentation/webview/Review234Independent.test.tsx
```

Both cases pass at the reviewed code by asserting the defect, not a fixed implementation. The witness uses the production App, routing, hook, thread and card; only the host message bridge is controlled. Remove the temporary test copy afterward.

## Correction review: F-01 closed; F-02 (P2) introduced in `4c894d7d`

`PendingRewrite` now keeps disclosure-open state and requests a missing preview while open. The new App tests cover both a ready and an in-flight preview across room replacement, reject the late old-room answer, and leave a closed disclosure unread. Those cases pass, closing F-01.

**F-02 anchor:** [`WorkshopFileEditOperation.tsx:104–114`](https://github.com/okeylanders/prose-minion-vscode/blob/4c894d7d49c8da69dd2804a78e87a7c907f24124/packages/core/src/presentation/webview/components/workshop/fileEdits/WorkshopFileEditOperation.tsx#L104-L114).

The correction replaces the old unconditional request-on-open with `open && !preview`. A refused read leaves a truthy `{ status: 'refused', ... }` in `previews`. The hook deliberately removes the card from `askedPreviews` so the writer can try again, but the component no longer calls it when reopened. A transient unreadable/catalog/host failure therefore sticks for the rest of this room, even after the underlying issue clears.

**Independent reproduction:** open a pending rewrite, answer `refused`/`unreadable`, close it, then reopen. Only one `WORKSHOP_FILE_EDIT_PREVIEW` was sent. The real-App test expecting the second request fails at `4c894d7d` (expected 2, received 1); its seven ordinary App tests pass.

**Required correction:** keep the automatic new-room/missing-preview request and also retry a refused preview on an explicit user reopening. A refused panel left open must not automatically retry on every render. Test reopening after refusal, no repeated read while left open, both room-replacement cases, and closed disclosure behavior.

[Retry regression test](probes/pr-234-refused-preview-retry.test.tsx.txt): copy to the same temporary `Review234Independent.test.tsx` path and use the command above. Unlike the initial F-01 witness, this test asserts the required behavior and fails while F-02 is present.

## Reviewed behavior with no additional new blocker found

- Apply, Review and Decline send only request id, room generation, turn id, index and action. The webview cannot choose another URI or replace the stored operations. The display path is shown without rendering the host's document URI.
- The hook synchronously marks a card busy before posting, suppressing repeated same-tick presses. Different cards retain independent requests, feedback and previews. Unknown, duplicate, old-room and wrong-kind answers are ignored. At the initial head a refused preview could be retried and a stale preview could not; F-02 tracks the correction's regression in the former.
- The card's state comes from the host snapshot, not optimistic client state. Actions appear only for `pending`. `applying`, `partial` and `unknown` do not offer blind retry. Busy actions are inert and focusable; room mutations disable them. A running reply supplies the shared run-active wording.
- The host sets/posts `applying` before checkpointing, then posts its recorded settlement before the result. The dependent #233 implementation checks its durable checkpoint and authority before dispatch. The local focused suite includes its real staging → session → handler → persistence → gateway → applier integration tests; the separate [#233 review](https://github.com/okeylanders/prose-minion-vscode/blob/f768b08c8545be36dadaae36d7e654b94a647ec4/docs/pr-reviews/pr-233-file-edit-apply-checkpoint-review.md) adds independent host-boundary probes and approves that slice.
- Rewrite before/after is read on disclosure, while settled bounded landed records use their own saved before/after. No automatic file read occurs merely because a pending card mounts. Refused feedback is intentionally ephemeral, as documented by the slice.
- All operation variants and state badges render through the shared model. The word diff preserves both original strings, bounds its LCS table and falls back to exact coarse changes above that bound. An additional seeded run reconstructed both sides exactly for 2,500 pairs, including whitespace, CRLF and Unicode.
- The new modules are small, feature-owned and host-agnostic. App, Thread and TurnBubble changes stay at wiring seams. No new core `vscode` import or broad architecture exception was needed.

## Nonblocking notes and the live-pass boundary

1. **Mixed partial/unknown wording:** the shared `partial` line says “the rest were not,” even when a per-operation badge reads “Not known.” This is inherited from the shared host/gateway vocabulary and is also noted in #233's review. Prefer wording that does not claim uncertain operations definitely failed. Do not infer that a remaining edit is safe to repeat.
2. **Keyboard review of long text:** the new diff and before/after blocks cap height at 240px with `overflow: auto`, while their `<p>`/`<pre>` elements have no explicit tab stop. Include keyboard-only access to content below the fold in the Chromium 114 floor pass, not just modern-browser behavior. This is a live-pass check, not a browser-verified finding in this review.
3. **Native acceptance remains pending:** Refactor Preview focus/checkboxes/discard, actual dirty-buffer visibility, narrow layouts, themes and screen-reader announcements must still be exercised in the Extension Development Host. No live model call or native VS Code acceptance is claimed. A local synthetic browser fixture was prepared, but Chromium could not launch in this environment (`socket() failed: Operation not permitted`), so no screenshots or visual pass are represented as completed.

## Verification

At code head `f8d46cce`, using Node `v24.22.1` locally:

- Focused file-edit suite: **28 suites / 455 tests passed**.
- All three typecheck targets: **passed**.
- Lint: **0 errors / 1,165 warnings**, matching the stated baseline.
- Independent real-App disclosure witness: **2/2 reproduced F-01**.
- Seeded diff reconstruction: **2,500/2,500 pairs passed**.
- Full local suite: **785 suites / 10,979 tests / 59 snapshots passed** (280.925 seconds).
- Local production build: the first attempt was killed with exit 137 while the full suite was running. After the suite completed, `NODE_OPTIONS=--max-old-space-size=2048 npm run build` **passed**, including the bundle sentinel check. The initial killed attempt is not a source failure or a passing build.
- Exact-code-head [CI run 42140517987](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42140517987): **passed**. Its Node 18 `verify` job completed typecheck, full tests, lint and both production webpack bundles successfully.
- Report-only commit verification is recorded in the PR conversation after publication.

At correction `4c894d7d`, the focused suite passes **28 suites / 458 tests**, and all three typecheck targets pass. Its real-App suite passes **7 tests**, including all three new lifecycle tests. The additional retry witness **fails** for F-02. The original-head full-suite/build results above are not represented as a full validation of newer source.

Only this report and the text reproduction artifacts are published. Passing existing automated gates does not close F-02 or establish native-host acceptance.
