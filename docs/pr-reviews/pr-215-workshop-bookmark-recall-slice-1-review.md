# PR #215 review: Workshop Bookmark Recall, Slice 1

**Disposition: one P2 correction requested.** The audience boundary, qualified refs, persistence, operation wiring, read marks, and bounded-list behavior reviewed cleanly. The one-bookmark renderer can falsely tell a persona that a long message is complete when its continuation reaches the offset ceiling.

- **PR:** [#215](https://github.com/okeylanders/prose-minion-vscode/pull/215)
- **Reviewed implementation head:** `1b2c2580fcf9fbc2256e9ff8f4c1f32614eca2be`
- **Head branch:** `epic/workshop-bookmark-recall-slice-1-recall-operation`
- **Base:** `epic/workshop-bookmark-recall` at `8e9b612ef6b191612bef07379daa18bde8e8a021`
- **Reviewed:** 2026-11-05
- **Scope:** the 66-file Slice 1 diff, its accepted ADR and implementation choices, existing recall behavior affected by the capability split, and independent boundary probes. This report does not approve later slices or authorize a merge.

## F-01 (P2): Distinguish an exhausted continuation offset from the end of a message

**Anchor:** [`WorkshopRecallBookmarkList.ts:239–246`](https://github.com/okeylanders/prose-minion-vscode/blob/1b2c2580fcf9fbc2256e9ff8f4c1f32614eca2be/packages/core/src/application/services/workshop/recall/WorkshopRecallBookmarkList.ts#L239-L246); [`continuation():333–336`](https://github.com/okeylanders/prose-minion-vscode/blob/1b2c2580fcf9fbc2256e9ff8f4c1f32614eca2be/packages/core/src/application/services/workshop/recall/WorkshopRecallBookmarkList.ts#L333-L336).

`messageWindow` uses the existence of `next` to decide whether to print “This is the end of the message.” But `continuation` also returns `undefined` when the next offset exceeds `bookmarkFromMax` (999,999), even though `to < text.length`.

A valid Wayfinding-format session with a bookmarked **1,010,000-character reply** reproduces this through the normal `store.saveNamed → coordinator.initialize → service.bookmarks` path. A request for its qualified ref at `<from>996000</from>` returns:

- `Characters 996,000–1,000,000 of 1,010,000`
- 4,000 characters of the message
- `This is the end of the message.`

There are **10,000 characters still undisplayed**. The normal continuation chain ends, and the next offset, `1000000`, is rejected as `invalid-from`. This is not a corrupt or oversized-session fixture: production checkpoint decoding and the ordinary store both accept it.

The six-digit ceiling itself is an explicit Slice 1 implementation choice. Its implementation note promises that past the ceiling a cut message says it cannot be read further by ref. The renderer contradicts that promise and gives the model a false completeness claim. This review does **not** require silently raising that accepted ceiling.

**Requested correction:** print the completion line only when `to >= text.length`. When text remains but a continuation cannot be emitted, state the truncation and the actual limiting reason. Keep the remaining-text count/range accurate. Add a regression across 999,999 and 1,000,000 using an accepted persisted message; also retain a genuine final-window control. If the ceiling is later widened, move its budget, grammar, prompt and sync tests together.

**Reproducible witness:** [pr-215-bookmark-offset-ceiling.test.ts.txt](probes/pr-215-bookmark-offset-ceiling.test.ts.txt). Its two passing assertions record the defect on the reviewed head; the corrected production test should assert the opposite completion behavior. The file explains how to run it.

## What reviewed cleanly

- The live bookmark reader uses the same participant-visibility rule as room delivery. A reader never receives another principal's private card or private tool exchange; an absent principal receives room-visible rows only.
- Mixed public/private results retain the host-owned publication-withheld stamp. They are not filtered into a publishable body. Publication, catch-up, join snapshots and persisted integrity honor the stamp.
- An independent retention probe strengthens the production test: after save/reset/open, the private sentinel is present in the owning guest's actual retained provider history and own join snapshot, absent from the host's retained provider history and other readers' catch-up/join snapshots.
- Source-qualified refs distinguish saved and current bookmarks with matching bookmark ids; New, Open and Branch rejection paths remain covered.
- Bookmarked messages use the shared transcript projection, not capability evidence bodies. The byte-identical-request pin protects ordinary bookmark changes from automatic prompt injection.
- Full and discussion-detail reads, including collapsed tool reports and multi-session reads, carry bookmark marks within packing bounds. Export and preview projection remain unchanged.
- Operation-family lists, codec dispatch, persistence artifact, factory wiring, prompts and architecture boundaries are covered. New recall modules remain below 500 lines.

## Recorded scope limits

- The implementation's accepted decisions remain in place: one bookmark per continuation call; saved refs that are now open or absent are stale; bookmark calls use the shared five-call ceiling rather than `transcript.read`'s separate per-turn total; the historical fixture is derived, not captured from a release.
- Current-room-only recall still requires the saved corpus's single-workspace availability. An independent no-workspace probe confirmed the live reader can see a bookmark while the service returns `no-workspace`. The recall prompt already describes this family-wide restriction, so it is recorded as a product limitation, not a second blocking finding.

## Verification

- Verified **3,008 text source, test, configuration and documentation blobs** in the local review snapshot against this exact head's Git tree. Read the repository's relevant rules and the accepted Slice 1 contract.
- **Local typechecks:** all three passed.
- **Local lint:** passed, **0 errors / 1,165 warnings**, matching exact-head CI.
- **Local focused regression run:** **41 production suites / 656 tests passed**, in isolated four-suite batches. This includes every changed test and the existing recall suite set.
- **Independent probes:** the two ceiling witnesses passed; the current-only/no-workspace witness passed; the strengthened retention suite passed all three tests.
- **Exact-head CI:** [run 42032255186](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42032255186), `verify`, passed all three typechecks, **735 suites / 10,328 tests / 59 snapshots**, lint, both webpack bundles, and bundle verification.
- A local aggregate attempt was interrupted after worker `SIGKILL`s, and a broad in-band attempt exited 137. Those are not counted as full local passes. The isolated focused run completed cleanly; full-suite verification above is the exact-head CI result.
- No live provider calls or native VS Code acceptance pass were performed. No implementation code was changed, no formal approval was submitted, and no merge was performed.

## Resolution ledger

| Finding | Status |
|---|---|
| F-01: false completion at bookmark offset ceiling | Fixed (author response below) |

## Author response (2026-11-05)

### F-01: fixed

A window now says "This is the end of the message." only when it reaches the message's end (`windowEnd` in `WorkshopRecallBookmarkList.ts`). Otherwise it writes the continuation when `<from>` can take the next offset. When neither applies, it says how much is left and why the rest can't be read by ref:

- `[message cut: the message continues for 6,001 more characters; reading by ref stops at character 999,999, so the rest cannot be read by ref]`
- an unwritable ref keeps its own reason, which matches the list's cut notice.

The 999,999 ceiling stays where it is. The prompt now teaches the notice: "when what is left starts past 999,999, the read says how much is left and that it cannot be read by ref". `transcriptRecallPromptSync.test.ts` pins that number to `bookmarkFromMax`.

**Regression tests.** They are in `WorkshopRecallBookmarkList.test.ts`, under "at the `<from>` ceiling (PR #215 F-01)". They use the Wayfinding fixture, saved with a 1,010,000-character bookmarked reply and decoded through the production checkpoint decoder.

| Case | Result |
|---|---|
| `<from>995999</from>` | ends at 999,999 with a continuation that decodes |
| `<from>996000</from>` and `<from>999999</from>` | say what is left, never "end", with no continuation; `<from>1000000</from>` is still `invalid-from` |
| Control: a 1,000,000-character message read from 996,000 | still ends with "This is the end of the message." |

**Verification.**
- The ceiling test fails on the reviewed head and passes with the fix.
- Typecheck and lint are clean.
- The recall suites (27 suites, 393 tests), the prompt sync test, the persona suites that read this prompt, and `boundaries.test.ts` all pass.
