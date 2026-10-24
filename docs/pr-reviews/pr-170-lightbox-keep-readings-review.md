# PR Review — Lightbox Keep Readings, Slice 4J

**Author:** okeylanders · **PR:** [#170](https://github.com/okeylanders/prose-minion-vscode/pull/170)  
**Branches:** `epic/lightbox-keep-readings` → `epic/lightbox`  
**Reviewed implementation head:** `bbbc47a3b746d9361d077ab89698b1830271c13b`  
**Base and merge-base:** `cf7f2607aceeb0fa107306870d35fb4066035b9b`  
**Scope:** 92 changed files · +17,764 / −270, including generated states and supplied visual evidence  
**Reviewed:** 2026-10-24 · **Reviewer:** Astra  
**Mode:** independent source/contracts review; production-handler, runner, codec, store and reload witnesses; exact rebuilt production-bundle DOM execution; regenerated host states; supplied pixel inspection; full local gates

## Summary

**Request changes. Two P2 findings remain open:** consecutive cut-off lens reruns can send the writer to the wrong recovery note and suppress the newer reply's location; retained readings from an older format-1 board can be falsely attributed to the latest model after a partial whole-group rerun. A P3 gap leaves the full call error repeated in untouched sibling widgets after a single-lens failure.

The retained tiles themselves survive the demonstrated saves and reloads. F-01 is a recovery-location presentation error, **not deletion or corruption of the paid response file**. F-02 is a false model attribution, **not incorrect provider dispatch**. These findings do not dispute keeping old readings until replacement.

Decisions 49/52 and reported writer approval are author-supplied design context, not independent user-acceptance evidence. The implementation's choices to keep an earlier nonempty reading instead of accepting an empty replacement, and to keep template/summary together are reviewed as written, without inventing answers to the PR's questions for the writer.

This review is scoped to this head and base. It is not combined integration clearance for #168/#169, a formal GitHub review, merge authorization, or permission to publish the extension.

## Findings and disposition

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| F-01 | P2 | Open, blocking | Distinct cut-off reruns share the older recovery note, hiding the newer reply's location |
| F-02 | P2 | Open, blocking | Legacy retained readings acquire the latest call's model in the inspector and saved-board row |
| N-01 | P3 | Open, nonblocking | A single-lens failure still repeats its full message in untouched sibling widgets |

## F-01 — Preserve the identity of each cut-off call when resolving its note

**Locations:** [`lightboxCallNotes.ts:71–76`](https://github.com/okeylanders/prose-minion-vscode/blob/bbbc47a3b746d9361d077ab89698b1830271c13b/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxCallNotes.ts#L71-L76), [`lightboxCallNotes.ts:100–105`](https://github.com/okeylanders/prose-minion-vscode/blob/bbbc47a3b746d9361d077ab89698b1830271c13b/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxCallNotes.ts#L100-L105).

`lightboxCallNoteOf` gathers cut reasons from all retained lenses, chooses one reason, and `lightboxPointsToCallNote` considers **any** cut-off prefix equivalent to that reason. Retention allows those reasons to describe different calls with different recovery receipts. Rail order and “cut inside first” are not call identity.

Independent production-host sequence, using only public-domain *Alice* worked examples, stub provider responses, and a recovery-capture stub returning distinct receipt paths:

1. Read group A successfully (`run-1-token`).
2. Re-analyze the motif lens alone (`run-2-token`). Cut its response inside the motifs block. Its earlier tiles stay, and its reason names `/workspace/recovery/call-1.response.txt`.
3. Re-analyze tension alone (`run-3-token`). Cut this distinct response inside the tension block. The two cuts use `examples.A.response.slice(0, raw.indexOf('"motifs"') + 200)` and the corresponding `'"tension"'` key, with `finishReason: 'length'`. Its earlier tiles stay, and its reason correctly names `/workspace/recovery/call-2.response.txt`.
4. Both earlier reasons survive the real autosave and a new host's restore, and the retained tile objects are unchanged.
5. The resulting tension `callNote` nevertheless names **call-1**, because the older motif reason wins the shared-note selection.

The exact rebuilt `webview.js` reproduces the user-visible consequence: tension's **“see its note” focuses the note containing call-1**, while **call-2's path is absent from the entire DOM**. Its own reason is suppressed rather than displayed. The second receipt path is preserved in the saved board data; recovery-file contents were not created by this stub, and the review does not claim that either recovery file was deleted or overwritten.

A same-event control passes: one whole-group cut produces one note, and all four affected lenses point to that same receipt. Thus ordinary consolidation is not the problem; conflating different calls is.

**Requested correction:** correlate a note/pointer with the call or recovery event whose reason it represents, not the common cut-off prefix. Preserve the newer receipt and do not redirect an older retained lens to an unrelated receipt either. A reason without a matching shared note can remain local rather than being falsely suppressed. Retain the two sequential lens-rerun witness, save/reload coverage, focused-pointer assertion, and same-event grouping control.

## F-02 — Preserve the old model before advancing a legacy group's latest-call model

**Locations:** [`LightboxReadingState.ts:112–126`](https://github.com/okeylanders/prose-minion-vscode/blob/bbbc47a3b746d9361d077ab89698b1830271c13b/packages/core/src/infrastructure/lightbox/LightboxReadingState.ts#L112-L126), [`lightboxProvenance.ts:70–76`](https://github.com/okeylanders/prose-minion-vscode/blob/bbbc47a3b746d9361d077ab89698b1830271c13b/packages/core/src/shared/constants/lightboxProvenance.ts#L70-L76).

Format-1 boards from before this slice intentionally have no per-lens provenance. A kept lens copies only an already-present provenance entry, while settlement advances `group.model`. `lightboxLensModel` then falls back to that **new** group model for the unchanged old reading. The known old attribution has been lost from the saved representation.

Independent production-host/store/reload sequence:

1. Open the committed [`board-v1.json` fixture](https://github.com/okeylanders/prose-minion-vscode/blob/bbbc47a3b746d9361d077ab89698b1830271c13b/packages/core/src/__tests__/fixtures/board-v1.json) through `LIGHTBOX_OPEN_BOARD`, retaining its A tiles and `provider/model-v1` unchanged. Other groups are made unread only to isolate the saved-row model list. The file decodes with zero drops and no provenance.
2. Run all of group A with a stub result reporting `provider/model-v2`; cut it inside motifs. The new headline lands, and this slice keeps the earlier motif, tension, gravity and palette tiles.
3. The original motif tile objects and IDs remain unchanged. Only the headline gains new provenance; `group.model` becomes v2.
4. Let the real autosave complete, then restore with a fresh host. The saved file decodes whole, and the old motif IDs still match.
5. The motif inspector now says **“Read by model-v2”** (also confirmed by clicking the retained motif in the rebuilt production bundle), and the saved-board row contains only v2, omitting v1. The correct mixed attribution is new headline by v2 and retained motifs by v1.

A headline-only rerun independently reproduces the same new inspector attribution; a bounded pure-state failure control also reproduces the wrong fallback when a returned failed call reports another model. The generic group-model overwrite in older single-lens code predates #170, so that alone is not presented as a new regression. The decisive changed path is this PR's **whole-group retention of old tiles plus its explicit per-lens attribution contract**. Open-only legacy compatibility tests do not exercise the transition.

**Requested correction:** retain the legacy lens's known model before the group's latest-call model changes, in a representation that remains truthful through save/reload. Do not invent an original run token or landing time that the old file never recorded. Keep the group's latest-call model semantics and cumulative usage separate from the models of the readings actually shown. Retain the format-1 open → partial whole-group replacement → save → restore → inspector/row witness, including an unsuccessful replacement and missing/dropped optional provenance controls.

## N-01 — Apply call-note suppression to untouched sibling notices too

**Locations:** [`lightboxReadings.ts:107–116`](https://github.com/okeylanders/prose-minion-vscode/blob/bbbc47a3b746d9361d077ab89698b1830271c13b/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxReadings.ts#L107-L116), [`lightboxReadings.ts:147–152`](https://github.com/okeylanders/prose-minion-vscode/blob/bbbc47a3b746d9361d077ab89698b1830271c13b/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxReadings.ts#L147-L152).

After the real handler runs only motif and receives an unusable reply, motif has an earlier mark and correctly points to the call note. The untouched gravity/palette lenses have phase `ok` and `notice: group.error`, but no earlier mark. The pointer selection checks `view.notice` only for phase `failed`/`cancelled`; it consequently omits `callNote` for these `ok` siblings. `LightboxReadingFrame` renders their full notices.

The production bundle shows the full reason and recovery path **three times**: the central call note, Lexical gravity, and Palette. A whole-group failure control shows the message once. This is a nonblocking coverage gap in decision 52's all-scopes behavior, not lost reading data. Untouched siblings should either remain untouched without the unrelated notice or point to the same call note, rather than repeat the whole error.

## Positive coverage and boundaries

- The per-lens transition is centralized in `LightboxReadingState`; all scopes use it. Usable replacements clear their own earlier/stale marks; empty, withheld, cut-off and failed outcomes retain existing tiles and their marks. No implementation change was needed to reproduce the findings.
- Template/summary coupling, Opinion retention and basis-rule gating, stale carry, disabled-lens retention, cumulative usage, and late stopped-run rejection were inspected. The paired-block and empty-answer policy choices are not treated as defects merely because another policy is possible.
- `owedBoard` still captures the settled readings/rules and overlays only file/revision/name/Spark marks. The existing queue-overlap/Stop/newer-success tests, including the added later-C save retaining B, are included in the full suite. No additional owed-save regression was established.
- Four independent controls pass: toggling a lens off/on during a held rerun through landing and Stop; refreshing the source while its rerun is held, preserving original provenance and stale marks and rejecting the late reply; and malformed optional provenance dropping/counting one entry while a malformed earlier reason rejects the file.
- Both legacy format-1 fixtures still round-trip unchanged. The optional provenance decoder drops/counts bad entries; malformed earlier marks reject the file. The observed attribution defect is the transition after loading a valid legacy file, not a file-decoding rejection.
- Regenerated all eight supplied host moments through the real handlers/service/runner/store/library. `keep-readings.json` matches the committed bytes exactly.
- Rebuilt the production bundles and exercised their actual DOM with the regenerated states and independent host witnesses. Same-event cut grouping, shared Stop status, valid description targets, Analyze focus across rerun/landing/failure, and note clearing on board navigation were checked. F-01's pointer focus and N-01's duplication are direct DOM observations.
- Inspected supplied pixels across all eleven 1440 px states in a contact sheet and selected 500/1000/1440 px captures at readable size. Those are author-supplied pixels, not newly generated reviewer browser captures. No native VS Code host, Chromium layout/geometry, or screen reader acceptance is claimed.

## Verification

All local executable work used the isolated cloud workspace, Node `24.19.0`, serial full test/typecheck/lint/build gates, a disk-backed Jest cache, a 2 GiB Node heap and one Jest worker with a 1,000 MB idle limit. Dependencies were reused only after matching the lockfile and verifying checkout-local workspace links. No live provider call, private manuscript, implementation edit, merge or deployment was made.

| Check | Independent result |
| --- | --- |
| Full repository Jest | Pass; 510 suites / 7,091 tests / 59 snapshots (380.946 s in this cloud Node 24 single-worker run) |
| Core/webview/adapter typecheck | Pass; core, webview and VS Code adapter |
| Lint | Pass; 0 errors / 1,133 warnings |
| Production build + `verify:bundle` | Pass; existing webpack bundle-size warnings |
| Host evidence builder | Pass; 1 test; output bytes match supplied `keep-readings.json` |
| Independent host regressions | 4 expected-behavior tests fail at the documented defects; 5 controls pass (same-event grouping plus 4 lifecycle/codec controls) |
| Production-bundle DOM | Pass; 13 cases, zero execution/DOM errors; the documented defects are observed-behavior assertions, not expected-correctness passes |
| `git diff --check` | Clean |
| Implementation-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40138631871) at `bbbc47a` |
| Implementation-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40138720056) at `bbbc47a` |

The four failing expected-behavior tests are two provenance paths, distinct-call recovery identity, and single-lens failure duplication. They are independent reviewer tests outside the repository suite, not failing existing repository tests. Initial external-test resolution issues were corrected before these behavioral results were recorded. CI uses Node 18; the local gate above does not independently reproduce the author's Node 18/22 matrix.

Rebuilt SHA-256:

- `webview.js`: `a9aa1ba981388240d987b18843c3aebd095735815fda4ff51f527527fcb85b99`
- `extension.js`: `2c3ff466acbbd8ac0d5d089923ab0f126bb864fcf7906455fdb2195b0672d7ad`

Both match the author's reported bundle prefixes. Passing gates and matching evidence do not cover the repeated-call/legacy-history sequences above. The requested corrections should be checked at their actual new head, with these witnesses retained; any later base integration requires its own delta review.

## Publication scope

Only this review report is to be published. The findings above refer to the implementation head, not the later report-only commit. Post-publication verification must establish that commit's sole parent, exact report bytes, single changed report path, and both exact-head push/pull-request CI runs. No formal review, comment, implementation change, merge or deployment is part of this report.
