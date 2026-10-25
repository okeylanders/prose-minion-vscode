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

## Author response (2026-10-24)

**F-01, F-02 and N-01: fixed**, after merging `epic/lightbox` at `13aff89`
(Slice 4K, PR #168) into the branch. Nothing above this section was edited.

| Commit | What |
| --- | --- |
| `d3a464ec` | Merge of `epic/lightbox` at `13aff89` (a merge commit; the conflicts were the epic README and the agents guide only) |
| `b868b4eb` | F-01 and N-01: one note per call or cut reply; a failure says nothing in lenses it never read |
| `8341db94` | F-02: a reading from before Slice 4J keeps the model that read it; the host witnesses for all three |
| this commit | This response, the slice notes, the ADR's 2026-10-24 addendum, the agents guide, the epic, and the evidence README |

### Resolution ledger

| ID | Priority | Disposition | Fix | Regression tests |
| --- | --- | --- | --- | --- |
| F-01 | P2 | **Fixed** | **A note is one event, not one group.** A cut is known by where its reply was saved, which every reason the cut wrote carries after its first sentence (`lightboxCutEvent`, in `lightboxCallNotes.ts`): one reply cut off is one note however many lenses it touched, and two replies are two notes, "Call A · cut off (Theme & motif)" and "Call A · cut off (Tension arc)", the second with its own id (`pm-lb-call-note-A-2`). A failure or a stop is still the group's latest call, matched by its whole message, and stands beside any older cut whose reasons the group still shows. A widget points to the note its own reason is (`lightboxBoardCallNote(board, group, reason)`; `lightboxPointsToCallNote` compares the cut's saved place, never just the prefix), so its link focuses its own reply's note, the frame is described by that note only, and the newer place stands on the board. An older retained lens keeps its own reply's note. A reason with no note (an older call's failure, a block withheld for its own fault) stays in the widget. Two cut replies that could not be saved say the same words, so they share one note, which says exactly what each would. | `LightboxKeptReadingSources.test.ts` (real host):<br>• **Your witness:** read A; Re-analyze the motif alone, cut inside the motifs (call-1); the tension alone, cut inside the tension (call-2); both reasons and both places through the autosave and a fresh host's restore, two notes, the motif pointing to call-1's and the tension to call-2's<br>• **Your control:** one whole-call cut is one note, and the motif, tension, gravity and palette all point to it<br>`LightboxAppCallNoteEvents.test.tsx` (the App, jsdom):<br>• **Focused pointer:** the tension line's "see its note" focuses the note holding call-2's place and not call-1's; the Motifs widget's focuses call-1's, and the frame is described by call-1's note only; each place stands once<br>• the same-event control: one note, every widget's link focusing it<br>`lightboxCallNotes.test.ts`: the cut's identity; two replies, two notes; the control; a failure beside an older cut |
| F-02 | P2 | **Fixed** | **The old model is kept before the group's model moves.** `settleLightboxGroup` gives every reading its group shows a provenance entry when a call settles: a reading with none of its own (a board read before Slice 4J) takes `{ lens, model? }`, the model its group named then, before the group's `model` becomes the new call's (`carriedProvenance`). No run token or landing time is invented: the entry has none, or no model either when the group named none. The format's entry reads that shape explicitly (`run` and `at` both present or both absent; a half entry is dropped and counted). `lightboxLensModel` reads the group's model only for a group with no provenance at all; once a group has some, a lens without an entry has lost it and names no model, never the latest call's. The group's `model` (its latest call's) and summed `usage` keep their meaning. The inspector names the model alone where there is no time ("Read by model-v1"). | `LightboxKeptReadingSources.test.ts` (real host, store and reload):<br>• **Your witness:** the committed `board-v1.json`, only group A read, opened through `LIGHTBOX_OPEN_BOARD`; Run A under model-v2, cut inside the motifs; the headline replaced, the motif's tiles unchanged; after the autosave and a fresh host's restore, the motif, tension, gravity and palette each `{ lens, model: 'provider/model-v1' }`, the inspector "Read by model-v1" for the motif and "Read by model-v2 · …" for the headline, and the row's models `['provider/model-v2', 'provider/model-v1']`<br>• **Unsuccessful replacement:** Run A under model-v2 with an unusable reply: the group's model is v2, the inspector and the row name only v1<br>`LightboxKeepReadings.test.ts` (pure): a partial whole-call rerun, a headline-only rerun, a failed rerun naming another model, a group that named no model, a lost entry, and a native board gaining nothing<br>`LightboxBoardProvenance.test.ts` (codec): the model-only and empty entries read back whole and byte for byte; a run without its time and a time without its run are dropped, counted, and leave that lens's model unknown |
| N-01 | P3 | **Fixed** | **A failure is its own lenses'.** `lensView` gives a failed or stopped group's notice only to a lens with nothing read (one the call left with nothing, or one never read), as a first read shows it; a lens with a reading shows its earlier mark when the call kept it, and nothing when the call never asked for it. So after a lens rerun on its own fails, its siblings say nothing of the failure: the message stands once, in the note. A lens the call left with nothing still points to the note. | `LightboxKeptReadingSources.test.ts`: the motif rerun alone, its reply unusable: one note holding the recovery place; the motif points to it; the headline, tension, gravity and palette show no notice, no earlier mark and no note<br>`LightboxAppCallNoteEvents.test.tsx`: the message once in the DOM after a single-lens failure, the siblings with no line and not described by the note; once after a whole-call failure too<br>`lightboxCallNotes.test.ts`: the siblings; a lens left with nothing still pointing to the note |

**A changed test.** `lightboxReadings.test.ts`'s failed re-read case built
a failed group with no earlier mark on the lens it kept, a shape Slice 4J
never writes, and expected the group's notice on it. It now builds the
board 4J writes (the kept lens marked earlier) and checks that the sibling
the call never asked for says nothing.

**One edge, stated.** A board saved between Slices 4I and 4J whose
Opinion was kept after a failed Opinion call (decision 47) holds the
Opinion with no earlier mark, so it now shows without the reason beside
it; the reason still stands once in the call's note under the run line.
Slice 4J writes the mark.

### Which tests fail on `bbbc47a`

The 2 new and 4 changed suites, copied onto an export of `bbbc47a`:

- **As CI runs them (type-checked), all 6 fail.** `lightboxCallNotes.test.ts`
  and `LightboxBoardProvenance.test.ts` do not compile (the per-event API;
  a model-only entry). The other four fail 12 tests: the pure F-02
  transitions (5), the host witnesses (4 of 5: F-01, both F-02 and N-01),
  the failed re-read (1) and the App's F-01 and N-01 cases (2 of 4).
- **With type checking off**, 21 tests fail in the 6: the 12 above, 6 in
  `lightboxCallNotes` (2 of them earlier tests that now call the per-event
  API) and 3 in `LightboxBoardProvenance`. **Every control passes there**:
  the whole-call cut (host and App), the whole-call failure said once, a
  lens left with nothing pointing to its note, and the codec's existing
  cases.

### Verification at the correction head

| Check | Result |
| --- | --- |
| Full Jest, Node 18.20.8 (`npx -p node@18`) | **515 suites / 7,196 tests / 59 snapshots, all passing** |
| Full Jest after the merge, before the corrections, Node 22 | 513 / 7,172 / 59; one wall-clock bound (`LightboxPassages`' linear-time case) missed beside other work and passed alone |
| Lint | **0 errors / 1,133 warnings**, identical per file, rule and severity to `13aff89` |
| Typecheck | **Pass** under Node 22 and Node 18.20.8 |
| `npm run build` with `verify:bundle`, under Node 22 and Node 18.20.8 | **Pass**, the same hashes both times: `webview.js` `2ffd7bcd56493bdf5fa22fe93ff2c0e293c56ea3cca1c4d2b94c270255c99bb6`, `extension.js` `556346baf03cacf308b65f8cf6c70770e5b14423dcdf034008f246aa9c6dcb05` |
| `git diff --check` | **Clean** |
| Visual evidence | The states rebuild byte for byte. `checks.js` mirrors the new note rules; the corrected bundle gives the same `facts.json`, byte for byte, and an empty `errors.txt`. No evidence state holds two cut replies of one call or a lens rerun on its own, so the captures stand (a new render differs by at most 49 pixels a capture, as two renders of one bundle do) |

Module sizes: `lightboxCallNotes.ts` 171 lines, `lightboxReadings.ts` 285,
`LightboxReadingState.ts` 288, `LightboxBoardCodec.ts` 422,
`useLightboxInspector.ts` 486. `LightboxReadingRunner` is untouched. No
live or billable call; *Alice* fixtures only; model ids are placeholders.

## Independent re-review — 2026-10-24, Astra

**Reviewed correction/integration head:** `bc3ab1cfc185c6c04c0db38c17c70cfec9c79f10`. **Integrated base and merge-base:** `13aff8952f684916050414786003480478f1e9fa` (the corrected #168). The delta from the first report commit `3a2ef12` is 55 files, +3,277 / −405, including that integration and its documentation. The original report and the author's response above are preserved verbatim.

**Disposition: request changes remains, narrowed to F-02's handling of unknown origins. F-01 and N-01 are independently closed.** The ordinary legacy-board attribution witness is fixed, but a missing or codec-dropped origin in an already-provenanced group is subsequently converted into a false known model and saved that way. This is a remaining boundary of F-02, not another provider-selection defect.

### Resolution ledger

| ID | Independent disposition | Result |
| --- | --- | --- |
| F-01, P2 | **Closed** | Both distinct cut-off receipts survive the real save/reload. The rebuilt bundle shows both paths once; each lens's link focuses its own note, and the motif frame is described by its own receipt only. Same-event grouping still produces one note. Removing the older event leaves the remaining pointer attached to the correct, renumbered note; navigation/deletion clears obsolete notes and links. |
| F-02, P2 | **Partially fixed; open** | A genuinely legacy group with absent provenance now carries its original model, without invented run/time, through partial whole-group and headline-only reruns, autosave, reload, inspector and row. However, an origin deliberately left unknown by the new decoder/getter does not stay unknown through the next unrelated settlement. Details below. |
| N-01, P3 | **Closed** | A failed motif-only rerun now displays the full failure once. Untouched sibling readings stay silent; the affected motif points to the note. The whole-group failure and shared Stop controls retain their intended behavior. |

### F-02 remaining: do not turn a missing modern origin into legacy model provenance

**Locations:** [`LightboxReadingState.ts:197–199`](https://github.com/okeylanders/prose-minion-vscode/blob/bc3ab1cfc185c6c04c0db38c17c70cfec9c79f10/packages/core/src/infrastructure/lightbox/LightboxReadingState.ts#L197-L199), called at [line 123](https://github.com/okeylanders/prose-minion-vscode/blob/bc3ab1cfc185c6c04c0db38c17c70cfec9c79f10/packages/core/src/infrastructure/lightbox/LightboxReadingState.ts#L123); related fallback [`lightboxProvenance.ts:87`](https://github.com/okeylanders/prose-minion-vscode/blob/bc3ab1cfc185c6c04c0db38c17c70cfec9c79f10/packages/core/src/shared/constants/lightboxProvenance.ts#L87).

`carriedProvenance` treats **every** missing lens entry as legacy, even when other provenance already establishes a modern mixed-history group. It copies `group.model`, which identifies the latest call, not that missing origin. This contradicts both the new getter's immediate behavior and the correction's explicit rule that a lost entry names no model.

Independent reproduction, through the real codec, handlers, runner, store, library and a fresh host, using only the public-domain fixture and stub replies:

1. Produce correct mixed history using the production transitions: original motif tiles from model-v1, a newer headline from model-v2, and group model-v2. The ordinary legacy snapshot succeeds here first.
2. Change only the motif's saved provenance to a half-entry: give its model-only entry a `run` but no `at`. The codec drops/counts exactly **one** entry, retaining all motif tile data. Headline provenance survives. On open, the motif's model and inspector model line are correctly **unknown/absent**.
3. Re-analyze **headline only** with a response reporting model-v3. No motif is requested or replaced.
4. `carriedProvenance` inserts `{ lens: 'motif', model: 'provider/model-v2' }`. The original motif IDs/data are unchanged, but its unknown origin has acquired the unrelated preceding headline model.
5. Autosave and restore with a fresh host. The new saved file decodes with **zero drops** and retains that false model-only entry. Clicking the motif in the exact rebuilt production bundle now shows **“Read by model-v2”**; the saved-board row lists **v3 and v2**. Correct behavior is headline v3 with the motif origin still unknown, not recovery of v1 from information that was discarded.

A well-shaped partial provenance list with only the motif entry omitted, and therefore **zero initial codec drops**, reproduces the same unknown → false-known transition. A third control makes both entries malformed: the decoder retains `provenance: []`, but the getter's `length > 0` check mistakes that present-empty list for absent legacy provenance and immediately reports v2; later settlement persists it too.

The all-dropped fallback alone is not presented as a newly introduced regression: the previous fallback already had that weakness. The actionable correction delta is the newly added `carriedProvenance` writing a false, valid origin after the new getter has correctly made a partially missing origin unknown. The original review explicitly requested missing/dropped-provenance controls; the added author tests stop at the immediate getter/decode and do not perform the next settlement. All three independent witnesses collect complete saved/reloaded evidence before failing their expected-behavior assertions.

**Required correction:** distinguish genuinely absent legacy provenance from a modern group whose entry was absent/dropped. Only the former may inherit the old group model. Preserve unknown origins through subsequent runs, failed/partial outcomes, save/reload and transitions that clear empty lenses; a present-empty provenance list must not silently regain legacy fallback through field omission. Explicit `{ lens }` entries already provide a truthful unknown representation. Do not infer a model, run or time that is no longer known. Keep the ordinary legacy controls passing while adding the missing/dropped → unrelated rerun → save/reload controls.

This finding concerns persistent attribution metadata and its visible model lines. It is **not** a claim that the motif was rerun, its text was lost, a provider was selected incorrectly, or a recovery file was deleted.

### Actual #168 integration and retained behavior

- The integrated parser, token reader, block re-nester, frame and decoding modules match the corrected `13aff895` base. The eight retained independent #168 repair-boundary assertions pass unchanged, including plain/escaped unfinished duplicates, the deep optional-guard witness and safe-movement controls.
- An additional **combined production-host witness** reads group E, then receives the duplicate-summary cut from #168. No unsafe re-nesting occurs; summary is withheld as cut with its recovery receipt. This slice keeps the old template/summary together with v1 provenance while valid pressure/artifact readings replace under v2. Real save/reload preserves that mixture. A later safely re-nested reply replaces both paired readings under v3, clearing their earlier marks, without another recovery capture.
- The original nine #170 reviewer tests now all pass: distinct cut receipts, same-event grouping, single-lens suppression, both ordinary legacy attribution paths, off/on during held runs through landing and Stop, source refresh rejecting a late reply while carrying stale provenance, and malformed provenance versus earlier-mark decoding. These are separate from the three newly failing unknown-origin sequences above.
- Model-only entries and explicit unknown `{ lens }` entries are legitimate persisted shapes; `run`/`at` must occur together. Existing full provenance is not replaced merely because another lens settles. Opinion basis/freshness, withheld/empty-result retention, source carry and the owed-save capture/queue controls were re-inspected and included in the full gate. No additional owed-save regression was established.
- The author's older 4I–4J kept-Opinion limitation was exercised as a valid legacy-shaped board: the Opinion body remains readable and the failed call's reason remains in the central alert, but the widget has no local earlier label/reason without an earlier mark. That is a compatibility presentation limitation, not loss of the Opinion or suppression of the failure everywhere. No additional blocking finding is assigned to it; this is not writer acceptance of that presentation.

### Fresh verification and boundaries

Local work used the isolated cloud workspace under **Node 24.19.0 / npm 11.9.0**, with serial compile-heavy gates, a 2 GiB Node heap, one Jest worker with a 1,000 MB idle limit, and disk-backed caches. The unchanged lockfile and checkout-local workspace links were re-verified. No live/billable provider call, private manuscript or implementation edit was used.

| Check | Independent result at `bc3ab1c` |
| --- | --- |
| Full repository Jest | Pass: **515 suites / 7,196 tests / 59 snapshots**, 387.503 s in this cloud single-worker run |
| Typecheck | Pass: core host, webview and VS Code adapter |
| Lint | Pass: 0 errors / 1,133 warnings |
| Build and `verify:bundle` | Pass; webpack's three bundle-size/performance warnings |
| Retained independent tests | **17/17 pass**: nine #170 controls/witnesses and eight #168 repair-boundary assertions |
| Added combined parser/paired-retention host witness | **1/1 pass**, including actual save/reload |
| Unknown-origin host regressions | **3/3 fail at the documented expected-behavior assertions**, after successful host/save/reload execution |
| Host evidence builder | Pass; all eight moments regenerate `keep-readings.json` byte-for-byte |
| Exact production-bundle DOM | **21 cases**, zero execution/DOM errors; includes observed defect assertions, not 21 claims of correct behavior |
| `git diff --check` | Clean |
| Correction-head push / pull-request CI | Both success: [push 40142255160](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40142255160), [pull_request 40142258036](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40142258036) |

The three failing tests are external reviewer regressions, not failures in the repository suite. An initial external-module-resolution failure was corrected before their behavioral execution. The DOM evidence checks message rendering, focus targets and descriptions; it is not Chromium layout, native VS Code or screen-reader acceptance. Supplied screenshot bytes are unchanged by this correction; they were not regenerated as reviewer browser captures. No timing claim from this cloud execution is a native-host benchmark.

Rebuilt SHA-256 values match the author's correction hashes:

- `webview.js`: `2ffd7bcd56493bdf5fa22fe93ff2c0e293c56ea3cca1c4d2b94c270255c99bb6`
- `extension.js`: `556346baf03cacf308b65f8cf6c70770e5b14423dcdf034008f246aa9c6dcb05`

This appendix reviews actual #168 integration at the named head/base, not separate #169 model-setting integration or any later merge. Decisions 49/52 and the empty-answer/pairing questions are still not independently accepted on the writer's behalf. Only this append-only report is published; the report commit's exact bytes, sole parent, single changed path and both exact-head CI events are verified separately. No formal review, PR comment, implementation change, merge or deployment is authorized by this report.

## Author response to the re-review (2026-10-25)

**F-02's remaining case: fixed**, after merging `epic/lightbox` at
`f75ed80` (Slice 4L, PR #169) into the branch. Nothing above this section
was edited.

| Commit | What |
| --- | --- |
| `a18150ce` | Merge of `epic/lightbox` at `f75ed80` (a merge commit). The conflicts were the agents guide, the epic README and the ADR. One semantic conflict: the webview now reads the Lightbox's own model selection, so this slice's App tests and evidence harness name it in their model data (three App tests waited for it on the merged tree; they pass with it) |
| `214be5d2` | F-02: an origin a group with provenance lost stays unknown |
| this commit | This response, the slice notes, the ADR's addendum, the agents guide, the epic, and the evidence (rendered again) |

The six shared files that merged cleanly were checked. 4L's changes to the
reading handler, the call controls and the run line only rename the
assistant model as the Lightbox's; the boundaries, runner and Opinion
tests carry both slices. The runner's engine is the `'lightbox'` scope's,
and a group's `outcome.model` is still that engine's provider-reported
`modelId` (`LightboxGroupReply`), so provenance names the Lightbox's model.
On the merged tree, before the fix, the full suite under Node 18.20.8 was
519 suites / 7,247 tests / 59 snapshots, all passing once the App tests
named the Lightbox's selection.

### Resolution ledger

| ID | Priority | Disposition | Fix | Regression tests |
| --- | --- | --- | --- | --- |
| F-02 (remaining) | P2 | **Fixed** | **The field's presence decides what is legacy.** Only a group whose `provenance` field is absent is a board read before Slice 4J; `carriedProvenance` gives its readings the group's model, as before. A group with the field, **even empty**, gives a reading with no entry (one the codec dropped, or one left out) an entry of the lens alone, `{ lens }`: unknown, with no model, run or time, never `group.model`, which is the latest call's. `lightboxLensModel` falls back to the group's model only when `provenance === undefined`, never on an empty list. **The field stays present** once it is: `settleLightboxGroup` and `withoutLenses` (a dropped lens, a lens with no reading cleared when its call starts) keep `provenance: []` rather than dropping it, and the codec writes and reads an empty list back as one. Since every settle gives each reading shown an entry, an unknown origin stays unknown through later runs, failed and partial outcomes, and save and reload. | `LightboxKeptReadingSources.test.ts` (real codec, host, store and fresh hosts):<br>• **Your three sequences**, from the legacy witness's mixed board (headline by model-v2; motif, tension, gravity, palette by model-v1), its file's group A provenance changed, then restored by a fresh host: the motif's entry made half (a run without its time; one entry dropped), left out of a well-formed list (none dropped), and every entry malformed (an empty list kept). Each: the motif unknown on open; a headline-only rerun under model-v3; the autosave and a second fresh host's restore; the motif's tiles unchanged, its entry `{ lens: 'motif' }`, no inspector model line, the headline "Read by model-v3 · …", and the row's models `[v3, v1]` (`[v3]` when every entry was malformed), never v2<br>• **Failed outcome control:** the dropped half-entry board, Run A under model-v3 with an unusable reply: the motif stays `{ lens: 'motif' }`, the headline keeps model-v2, the row `[v2, v1]`<br>`LightboxKeepReadings.test.ts` (pure): an unrelated rerun, then another; a present but empty list (no model at once, and after a call); a failed call keeping the lost origin unknown and the known one known; a lens with no reading cleared when its call starts, the list staying `[]`<br>`LightboxBoardProvenance.test.ts` (codec): an empty list written and read back present, byte for byte, naming no model; every entry dropped leaves `[]`, naming none though the group has a model<br>**Kept passing:** the ordinary legacy witness and its failed control (format-1 open, partial whole-group rerun, headline-only rerun), and every earlier provenance test |

### Which tests fail on `bc3ab1c`

The 3 changed test files, copied onto an export of `bc3ab1c`: **all 10
new tests fail**, typed or not (they compile there), each at the
unknown-origin assertion. The host sequences and the failed control
receive `{ lens: 'motif', model: 'provider/model-v2' }`, the pure cases
the group's model (or no list after a clear), and the codec cases the
group's model for an empty list. **The 39 earlier tests in those files
pass there**, the ordinary legacy cases included.

### Verification at the correction head

| Check | Result |
| --- | --- |
| Full Jest, Node 18.20.8 (`npx -p node@18`) | **519 suites / 7,257 tests / 59 snapshots, all passing** |
| Lint | **0 errors / 1,133 warnings**, identical per file, rule and severity to `f75ed80` |
| Typecheck | **Pass** under Node 22 and Node 18.20.8 |
| `npm run build` with `verify:bundle`, under Node 22 and Node 18.20.8 | **Pass**, the same hashes both times: `webview.js` `55feaac0fa5d28704817228a25991d3cce331c1e2f8e38d292e88b531c49c56d`, `extension.js` `e060a4725fa5cebd54d7d04d41deaa88786d22379d56ff418e9baf06df9ef745` |
| `git diff --check` | **Clean** |
| Visual evidence | The states rebuild byte for byte; the bundle gives the same `facts.json`, byte for byte, and an empty `errors.txt`. The captures were rendered again: 4L's header names the Lightbox's model and moves the page at 500 px |

Module sizes: `LightboxReadingState.ts` 299 lines,
`lightboxProvenance.ts` (constants) 130, (types) 51. No live or billable
call; *Alice* fixtures only; model ids are placeholders.

## Final independent re-review — provenance presence and actual 4L integration (2026-10-25)

**Reviewer:** Astra. **Reviewed head:** `2f4ec86fb60122417dbc7af2b2533af8062a93c8`. **Base and verified merge-base:** `f75ed80f55bd6c8a99ab4f1a967edefe75109606`. Merge `a18150ce` integrates the corrected #169; `214be5d2` fixes the remaining provenance boundary. The complete delta from the preceding report commit `f2caad2b` is 122 files, +8,433 / −227, including the integration's evidence and documentation. All preceding review text and both author responses remain unchanged.

**F-02 is closed. No new blocking finding was established on this integrated head.** This supersedes the preceding request-changes disposition. F-01 and N-01 remain closed. This is an independent code-review conclusion, not a formal GitHub approval or permission to merge.

### Provenance correction

The correction now distinguishes a genuinely legacy **absent** `provenance` field from a modern field that is present, even as `[]`. Only the former may supply its old group model to a retained reading. A missing modern origin becomes `{ lens }`, which truthfully records an unknown model without inventing a run/time. Both settlement and clearing a no-tile lens preserve an existing empty field. The getter, codec and subsequent transitions agree on that distinction.

Independent evidence:

- **All three retained failing host witnesses now pass:** a well-shaped partial list missing the motif, one malformed half-entry dropped by the codec, and every entry malformed/dropped. Each runs the real codec, handlers, runner, store and fresh-host reload. The untouched motif keeps exactly its original tile data; its origin is unknown on open and remains unknown after a headline-only v3 rerun and save/reload. The saved motif entry is `{ lens: 'motif' }`, the inspector has no false model line, and the isolated saved-board row lists only v3. No attempt is made to recover discarded v1 metadata.
- **Both ordinary legacy controls remain green:** an absent-field format-1 board snapshots the old model before the group's model advances, through partial group and headline-only reruns, save/reload, inspector and saved row. Model-only origins retain no invented run/time. Existing full provenance remains untouched for kept readings.
- **Two additional transition controls pass:** clearing the only surviving entry while an unknown sibling still has tiles retains `[]` through Stop, codec roundtrip and a later successful rerun; a running source carry followed by an older owed save preserves its captured present-empty origins despite a later known landing.
- The source audit also followed failed settlement, ordinary/Opinion carry, same-text measurement filtering, spark edits and `owedBoard`. Their group copies preserve field presence. Repository failure, repeated-rerun, codec/empty-array and earlier-mark validation controls pass in the full suite. No remaining false-origin transition was established.

### Combined #169 and retained #168 behavior

The actual integrated manager, model-scope resolver and runner are byte-identical to the corrected `f75ed80f` base. The shared handler and UI changes retain 4J's keep-until-replaced semantics while using the `lightbox` selection for engine access, confirmed estimates and controls. Landing provenance continues to use the engine's provider-reported outcome model, not the picker label.

- Reran the retained **seven manager lifecycle/race scenarios** and **six production-host scenarios with real `p-limit` at default concurrency**, transport stubbed: clear, replacement with overlapping refreshes, kept key, no-key then add, Stop, and clear plus Stop. Already-sent A may land; a retired engine starts no deferred Opinion transport; a fresh press after replacement uses the replacement placeholder credential and newly selected model. The retired engine stays detached.
- Added the same **six combined scenarios with prior A and Opinion readings already present**. The prior Opinion and its provenance survive failed/refused/stopped replacement, with its earlier reason. Disabled A siblings retain their exact tiles and origins. Stop preserves the earlier A reading too. Each resulting board passes the actual persistence codec roundtrip without drops. These probes exercise host/manager/runner behavior, not a live provider or native SecretStorage timing guarantee.
- Regenerated the model-scope host states and exercised the exact rebuilt bundle's Lightbox picker/follow choice, cancellation/reopening, focus return, external setting synchronization, Settings row and Workshop cache indicator. Picking Lightbox does not change the Workshop model or clear that indicator. This is application-state/cache-indicator isolation, not proof of a provider-side cache hit. The prior documented per-call model-hot-swap behavior remains unchanged; this review does not claim run-wide model pinning.
- The repaired #168 parser, token reader, block re-nester, frame and decoder still match the integrated base. The **eight retained repair-boundary assertions** and the combined duplicate-summary cut → paired template/summary retention → save/reload → safe re-nested replacement witness pass. No repaired parser guard was lost in integration.
- F-01/N-01 controls remain green: separate cut replies retain distinct receipt links after real save/reload, a single cut groups once, single-lens failure is not repeated by untouched siblings, each pointer focuses/describes its own note, and note replacement/navigation/deletion removes obsolete references. Off/on, held-run Stop and changed-source late-reply controls pass. No new owed-save regression was established.

### Fresh verification

Local verification used the isolated cloud workspace under **Node 24.19.0 / npm 11.9.0**. Dependency reuse was checked against the unchanged lockfile and checkout-local workspace links. Compile-heavy stages ran serially; full Jest used a 2 GiB heap, one worker, a 1,000 MB idle limit and a disk-backed cache.

| Check | Independent result at `2f4ec86` |
| --- | --- |
| Full repository Jest | Pass: **519 suites / 7,257 tests / 59 snapshots**, 387.1 s in this cloud single-worker run |
| Typecheck | Pass: core host, core webview and VS Code adapter |
| Lint | Pass: 0 errors / 1,133 warnings |
| Production build and `verify:bundle` | Pass; webpack's three size/performance warnings |
| Retained/extended independent Jest probes | **27/27 pass**: 22 earlier #170/#168/#169 controls plus the three formerly failing origins and two new presence-transition edges |
| Default-concurrency production-host and manager checks | **6 retained + 6 combined retention scenarios**, and **7 manager scenarios**, pass |
| Keep-readings host-state builder | Pass; all eight moments regenerate the committed `keep-readings.json` byte-for-byte |
| Model-scope host-state builder | Pass; matches committed state after normalizing its one live source `capturedAt` timestamp |
| Exact production-bundle DOM | **21 reading cases + 10 model/UI checkpoints**, zero runtime/assertion errors |
| `git diff --check` | Clean |
| Implementation-head GitHub CI | Both success: [push 40146044430](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40146044430), [pull_request 40146046588](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40146046588) |

Both independent rebuilt bundle hashes match the author's:

- `webview.js`: `55feaac0fa5d28704817228a25991d3cce331c1e2f8e38d292e88b531c49c56d`
- `extension.js`: `e060a4725fa5cebd54d7d04d41deaa88786d22379d56ff418e9baf06df9ef745`

The supplied re-rendered pixels were inspected directly at representative 500, 1000 and 1440 px states, including retained/failed/stopped readings, Opinion and the model header. The reviewer regenerated host states and tested the exact bundle in JSDOM, not Chromium screenshots or native VS Code. DOM focus/ARIA checks are not screen-reader or geometry acceptance. The older 4I–4J kept-Opinion local-label limitation remains as described in the preceding appendix; no additional blocking finding is assigned to it.

No live/billable provider call, private manuscript, implementation change, formal review, comment, merge or deployment was used. Decisions 49/52, empty-answer/pairing choices and #169's first-open/wording questions are not independently accepted on the writer's behalf. This report covers the actual named combined tree; later changes require their own delta check. Only this append-only report is published, with its exact remote bytes, sole parent, single report path and exact-head CI checked separately.
