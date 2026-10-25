**Current independent disposition (second re-review, 2026-10-22): Approve on code quality at `2d4d354`.** All eight findings across the earlier rounds are resolved. See the [second independent re-review](#second-independent-re-review-2026-10-22). Earlier disposition statements below are historical and preserved verbatim; writer/native acceptance remains separate.

# PR Review — Lightbox Saved Boards, Slice 5A

**Latest independent disposition:** Request changes at correction head `f3808b4`. All six original findings are resolved; one new P2 freshness issue and one new nonblocking P3 paging issue remain. See the [correction re-review](#independent-re-review-of-the-corrections-2026-10-22). The initial review below is historical.

**Author:** okeylanders · **PR:** [#163](https://github.com/okeylanders/prose-minion-vscode/pull/163) (open, unmerged at review)  
**Branches:** `epic/lightbox-slice-5a-saved-boards` → `epic/lightbox`  
**Reviewed implementation head:** `bc1fdda4f73b86bd14549b9813822fcb0a0fe971`  
**Base / verified merge-base:** `3e6a1561cc60c084fa8493c8582ca829d5ca41fe`  
**Scope:** 115 files · +14,473 / −382  
**Reviewed:** 2026-10-22 · **Reviewer:** Astra  
**Mode:** independent source/contracts review; production-host/store/hook regressions over synthetic files and stub responses; canonical-basis controls; saved-fixture render/passage checks; regenerated host states; exact rebuilt-bundle DOM execution; supplied pixel inspection; fresh full head gates

## Summary

**Verdict: Request changes.** The format-1 coverage and canonical citation basis are substantial and coherent. The full repository suite and build gates pass, but independent probes find four P2 correction areas: returning to an already-saved source does not move the reload pointer; same-ID snapshot replacement defeats two asynchronous ownership guards; separate stores can overwrite each other's staging file; and a silent folder cap makes saved history inaccessible, including a source's entire history when slugs collide.

These are code findings, not a judgment on the writer's preferred save policy. No file loss is claimed for the reload, rail or listing defects: the files still exist. The staging collision is the exception: one caller receives success for bytes belonging to the other caller.

This disposition is not a formal GitHub review, merge instruction, real-chapter checkpoint, native VS Code verification, writer acceptance or approval to proceed to Slice 5B.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Returning to a retained, already-saved source leaves the reload pointer on another board | **Open** |
| F-02 | Medium / P2 | A persistent board ID is not enough to own a preparing press or delayed shelf after another snapshot opens | **Open** |
| F-03 | Medium / P2 | Temporary filenames are unique only inside one store instance; another writer can replace the staged bytes | **Open** |
| F-04 | Medium / P2 | The undisclosed 200-file folder cap hides valid saved boards before source filtering | **Open** |
| N-01 | Low / P3 · nonblocking | Returning A → B → A during Delete reuses a shelf containing the deleted row | **Open** |
| N-02 | Low / P3 · nonblocking | A simultaneous text-stale mark masks the earlier-citation-rule Bring reason | **Open** |

## F-01 — Move the reload pointer even when no new save is needed

**Location:** [`LightboxBoardLibrary.ts:268–273`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L268-L273).

`saveMeasured` returns immediately when the retained board has a `savedFileId`. That avoids a duplicate save, but also bypasses `pointAt`. An unchanged source choice retains its board ID and saved-file ID. The pointer therefore describes the last save/open, not necessarily the last board on screen.

### Independent real-handler sequence

1. Choose chapter A and let its measured board save (`board-1`).
2. Choose chapter B and let its measured board save (`board-2`).
3. Choose unchanged A again. The service correctly shows `board-1`; the saved pointer still names B's file.
4. Create a fresh host over the same filesystem and workspace memory, then mount the shelf. It restores **`board-2`**, not the A left on screen.

The probe uses the actual source handler, service, library, store and restore route. It requires neither a damaged file nor a timing race. The [reload contract and measured-save notes](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/.todo/epics/epic-lightbox-2026-10-19/slice-5-saved-boards-and-compare.md#L301-L308) require the pointer to follow this choice even when nothing is written.

**Requested correction:** handle adoption/on-screen selection separately from deciding whether to save. Point to the retained board's appropriate saved file without writing a duplicate, under the current source-choice ownership guard. Add A → B → unchanged A → reload coverage, including a retained board with readings.

## F-02 — Give asynchronous work an adoption generation, not only a board ID

Keeping a saved board's persistent ID is intentional. Several snapshots of that board therefore share its ID and source hash. Two existing checks treat those values as if they uniquely identify the current on-screen snapshot.

### A. A preparing press starts against the snapshot opened afterward

**Locations:** [`LightboxBoardLibrary.ts:145–154`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L145-L154), its started-run-only check at [263–264](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L263-L264), and [`LightboxReadingHandler.ts:254–259`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/application/handlers/domain/LightboxReadingHandler.ts#L254-L259). The [price key](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/infrastructure/lightbox/LightboxPressSnapshot.ts#L69-L76) contains neither the source-choice ticket nor snapshot/adoption identity.

Create a measured save FIRST and a fully read save READ from the same text. Open READ, obtain its real estimate, and press Characters. Hold the runner's asynchronous `prepare`. Open FIRST while the reservation is still preparing, then release it.

**Observed:** Open succeeds, but the old press also proceeds. There is **one additional stub-provider invocation**, and FIRST's B group changes from `not-run` to `ok`, despite the newer choice to open the measured snapshot. The Opinion variant makes no provider call because FIRST lacks its dependencies, but still changes FIRST's F group from `not-run` to `failed`. These are actual handler/runner results, not merely equal-key assertions. No paid/live call was made; the regular-lens witness reaches the production call path that would invoke the configured provider.

The plan [explicitly says a preparing press is refused when a newer board opens](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/.todo/epics/epic-lightbox-2026-10-19/slice-5-saved-boards-and-compare.md#L309-L312). Started runs remain guarded; the gap is the reservation/preparation interval with an unchanged persistent ID.

### B. A late pushed shelf removes the newer snapshot's changed-file notice

**Locations:** [`LightboxBoardLibrary.ts:176–201`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L176-L201), [`LightboxBoardsHandler.ts:119–136`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/application/handlers/domain/LightboxBoardsHandler.ts#L119-L136), and [`useLightboxBoards.ts:98–101`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/presentation/webview/hooks/domain/useLightboxBoards.ts#L98-L101).

The shelf captures `savable`, awaits a source comparison, then reads the latest `savedFileId`. Its reply can combine an old snapshot's notice with the newer snapshot's on-screen row. Unsolicited replies are accepted solely by board ID.

Independent sequence: run on READ; hold the committed-save push's source resolution after it has read the old bytes; edit the source; open FIRST and receive its correct `file: changed` shelf; release the earlier push. The final pushed shelf says **`snapshot.fileId = READ`, `file = same`**, while its on-screen row correctly points to **FIRST**. The hook accepts that same-ID push. The rail consequently loses the changed-file warning and **Read the current text** action.

Bring still independently revalidates the file, and the ordinary source re-read button remains. This is not evidence of an unsafe handoff or destroyed source text.

**Requested correction for both paths:** retain persistent board identity, but capture and revalidate a host-owned source-choice/adoption generation across each await. A newer source choice/open must invalidate the earlier preparing press. Shelf construction/publication/reception must not publish or accept an older snapshot's state as current merely because IDs match. Add both same-ID races, with ordinary different-ID and no-change controls; do not solve this by silently minting a different persistent identity for each save.

## F-03 — Make staged files private to the writer that commits them

**Location:** [`LightboxBoardStore.ts:403–423`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/infrastructure/storage/LightboxBoardStore.ts#L403-L423).

The queue and temporary counter belong to one store instance. The staging name is `.<timestamp>.board.json.tmp-1` for each instance's first save. The final rename's `overwrite: false` protects an already-existing final file; it does not protect shared staging bytes.

### Independent deterministic interleaving

Two production stores share the same workspace filesystem, each with its own queue. Both save the same source at the same millisecond, so both select the same still-free final name and `tmp-1` sibling.

1. A writes board A to the temporary path; pause before its rename.
2. B writes board B to that **same** temporary path; pause before its rename.
3. A renames successfully and reports `{kind: 'saved'}`.
4. B's rename fails because the temporary path has gone.
5. Decode the one final file: it contains **board B**, not the A that received success.

The witness uses the actual encoder, store and decoder over `MemoryFileSystem`; writer IDs differ so the committed bytes are distinguishable. Its assumptions are **two independent store instances sharing the directory, a same-millisecond filename collision, and overlapping writes**. One composition root alone serializes correctly. Separate extension hosts/windows or another cooperating writer to the same workspace are the relevant cross-instance condition; this was not reproduced in native VS Code, and no claim is made that two concurrent operations inside one store bypass its queue.

**Requested correction:** give each staging operation collision-resistant, writer-private ownership, with a creation strategy that cannot truncate another writer's temporary file. Preserve non-overwriting final commits; a final-name collision may fail/retry safely, but must never report success for somebody else's bytes. Add a two-store shared-filesystem regression, not only same-instance timestamp-suffix tests.

## F-04 — Keep bounded listing work without silently hiding saved history

**Location:** [`LightboxBoardStore.ts:362`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/infrastructure/storage/LightboxBoardStore.ts#L362), with source filtering only afterward at [195–196](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/infrastructure/storage/LightboxBoardStore.ts#L195-L196).

The default reads only the newest 200 filenames in a **slug folder**. There is no continuation, truncation flag or other rail route to the omitted files. The UI reports the returned count as the saved total, or says there are no saved boards. This conflicts with the [rail's ability to open any saved board and let the writer manage deletion](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/.todo/epics/epic-lightbox-2026-10-19/slice-5-saved-boards-and-compare.md#L278-L282).

Independent valid-format witnesses:

- 201 saves of one source: **200 listed**, oldest omitted, `unreadable = 0`, no indication that more exist.
- One older board for `Drafts/alice-1.md`, plus 200 newer boards for the distinct `drafts/alice 1.md`: both normalize to `drafts-alice-1-md`. Listing the first source returns **zero boards**, `unreadable = 0`, even though its one valid file still exists. The cap runs before the source-key filter that otherwise correctly separates them.

These fixtures use real encoded board bytes, changing save timestamps and the neighbor's source path; no provider calls are needed. Files are not deleted. They become inaccessible through the advertised list/open/delete flow until newer files are removed or the writer uses the filesystem directly. The same capped search also cannot reliably answer the measured-save deduplication question.

**Requested correction:** preserve a bounded/paged UI or incremental scan, but expose and retrieve the complete source-specific history. Apply source identity correctly across colliding slugs, make truncation truthful, and ensure the same-text lookup is not silently restricted to the visible page. Add >200-file and colliding-source regressions.

## Nonblocking follow-ups

### N-01 — Invalidate a cached shelf when Delete is pending

[`useLightboxBoards.ts:82–84`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/presentation/webview/hooks/domain/useLightboxBoards.ts#L82-L84) skips fetching when `answeredFor` still names A and clears `pending`; [Delete](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/presentation/webview/hooks/domain/useLightboxBoards.ts#L119-L122) never invalidates that cache. Delete A's row, choose already-retained B, and return to A before the replies land. The successful delete reply is then ignored and A's cached deleted row remains, with no refresh request. The independent hook regression observes exactly `deletedFileVisible: true, refreshedA: false`. Previously saved A/B avoid an incidental new-save push repairing it. Invalidate the mutation-affected shelf or fetch on return. No deletion/data-loss defect is claimed.

### N-02 — Keep the earlier-rule explanation consistent when both stale conditions apply

[`LightboxTileHandoff.ts:135–136`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/infrastructure/lightbox/LightboxTileHandoff.ts#L135-L136) and [`lightboxBring.ts:87–91`](https://github.com/okeylanders/prose-minion-vscode/blob/bc1fdda4f73b86bd14549b9813822fcb0a0fe971/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxBring.ts#L87-L91) prioritize a generic stale-lens reason. With an earlier `opinionBasis` and an Opinion stale-text mark, standing says “Saved under an earlier citation rule,” while both Bring surfaces instead name the earlier chapter text. Independent direct-Node controls reproduce the mismatch. **All paths still refuse safely** and re-reading is the right remedy; align the reason precedence with decision 32's same-reason contract without discarding the board.

## Contracts, completeness and retained boundaries

Read the live PR and empty discussion, `AGENTS.md`/central setup, the current Lightbox ADR and Slice 5A plan, decisions 25 and 27–32, archived rendered-basis debt, new debt records, current contracts/tests and the latest #162 correction report. Disclosed debt is not automatically a defect.

- **Canonical basis, not rendered digest text:** explicit data projections cover item identity, reading words, bounded quote text/paragraphs/notes, counted terms and kind-specific fields, plus measured figures. Independent controls alter number-row labels/unit wording and the digest paragraph-list rendering cap without changing any basis; changing a steering quote note or voice-marker presence changes its basis. Excluded offers/examples, withheld quotes, friction, beyond-bound material and presentation-only fields follow the documented citation scope. Rewording presentation is not a migration trigger.
- **Old/future rules preserve writer data:** the authentic format-1 fixture opens without drops. Both earlier and future well-formed citation IDs preserve the board whole, leave bases incomparable, stale only the Opinion and refuse its Bring. Other rule IDs are retained. Changed-text carry preserves an earlier citation basis rather than relabeling it current; a new successful Opinion read is the renewal path.
- **Codec and salvage:** all 32 A–G reading kinds and measured-layer fields have decoders. Bad individual tiles/notes are counted and dropped; invalid measured/source/group/stale-mark structure refuses the board rather than falsely presenting it as current. Source hashes and source paragraph counts are checked. No development-format migration is smuggled in. Fifteen independent positive service/codec cases cover unusual accepted source strings, CRLF/Unicode, headings/speech, stopped partial runs, all rule IDs, earlier-basis changed-text carry, an 8→1 paragraph shrink and salvage→encode persistence. No supported-service-output rejection was found.
- **Saved rendering/passages:** independent positive checks render every registered tile family from `board-v1.json`, build each applicable reading inspector (set-aside Sparks intentionally have none), and reconstruct term-family passage wells against saved figures and exact saved paragraph text. The disclosed use of current passage finders for an older measured-rule board remains a compatibility boundary, not a newly alleged silent remeasurement of its saved figures.
- **Filesystem/ownership controls:** the one-store queue, timestamp suffixing, file-ID/path containment, non-overwriting finals, invalid-file preservation, active-run open refusal, latest source ticket for open/restore, failed/partial-run saves and session-only no/multi-root paths have source and repository-test coverage. F-02/F-03 identify different gaps rather than claiming those controls are absent.
- **Privacy:** saved files deliberately contain source text in the workspace. The scoped webview persistence does not save the board, source text or saved-file list; host requests use IDs. Error/codec diagnostics do not interpolate rejected field names or manuscript text as normal diagnostic content. This is not encryption, a Git-ignore promise, or a privacy approval for a real manuscript. Only the repository's public/synthetic chapter fixtures were processed.
- **Accepted/deferred scope remains explicit:** save-on-next-run Spark dismissal, focus after confirmed row removal, an uncleared missing restore pointer, near-size-limit modules and current-finder passage drift are disclosed follow-ups. Compare remains Slice 5B. Malformed manually edited files with duplicate IDs or nonmonotone paragraph offsets deserve defensive hardening, but no supported writer path producing them was established, so they are not promoted to blocking findings here.

## Renderer, evidence and accessibility boundary

The production host evidence builder was rerun outside the tracked tree. Its `states/boards.json` is **byte-identical** to the committed evidence. The rebuilt production webview reproduces the author's SHA-256. An independent JSDOM harness makes **55 assertions** against that exact bundle over the regenerated host messages, covering all seven scenarios: rail, opened snapshot, changed file, Read current, delete confirmation, session-only and earlier-rule Opinion. Assertions include saved counts/on-screen rows, notices, stale carry, safe initial Keep focus, accessible confirmation label, no delete before confirmation, Keep dismissal, IDs-only confirmed deletion, no reading request, no runtime errors and no source/file persistence.

Supplied PNGs were inspected across 500/1000/1440 widths; the supplied 21-state facts record no overflow. These are **author-supplied pixels**, not newly captured browser geometry. Independent DOM execution does not establish screen-reader behavior, native focus/scrolling, extension activation, minimum Chromium 114 compatibility or native VS Code acceptance. The disclosed focus-after-confirmed-delete debt remains distinct from the working Keep/Escape behavior.

## Verification

| Check | Independent result |
| --- | --- |
| Full exact-head Jest | **472 suites / 6,512 tests / 59 snapshots passed**, 405.192 s |
| Baseline | Reused independent #162 correction gates, **461 / 6,354 / 59**; verified `00a156a8` → this base differs only in its review report |
| Typecheck | All three projects pass |
| Lint | **0 errors / 1,133 warnings**, identical baseline/head counts by relative file, rule and severity |
| Production build | Pass, including `verify:bundle`; existing three webpack size warnings |
| Independent regressions | F-01/F-03/F-04 behavior witnesses reproduced; both F-02 press variants, its delayed-shelf assertion and N-01's hook assertion fail as described; separate positive codec/render/passage controls pass |
| Canonical-basis/old-rule controls | Direct-Node controls pass; N-02 wording mismatch reproduced separately |
| Host-state regeneration | External builder passes; exact `boards.json` byte equality |
| Exact-bundle DOM | **55 assertions / seven scenarios pass**; runtime/persistence checks included |
| `git diff --check` | Clean |
| Implementation-head CI | [pull_request](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39827365176) and [push](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39827233581) both successful on `bc1fdda4` |

Rebuilt `webview.js` SHA-256: `c7e47504afe36c0e437543ed0adcb538f5248296e484b7b383d9b89cb6a15fcf`.  
Rebuilt `extension.js` SHA-256: `bfc03e8e8b469bbcb56e9f6868daa5cbd66df2ed3fef6ab2d3bd6b0da559e650`.

Checks ran serially in an isolated Linux cloud worktree. Dependencies were reused from the independently tested #162 tree after confirming the unchanged lockfile; workspace links resolve into this checkout. Full Jest used `NODE_OPTIONS=--max-old-space-size=2048`, one worker, `--workerIdleMemoryLimit=1000MB` and a disk-backed cache. The reported suite time is **cloud Jest-VM elapsed time**, not direct-Node or native VS Code latency. No native-performance claim is made. Initial external-probe module-resolution and DOM timezone/settling assumptions were corrected in the external harness, not in repository code, before the results above.

Research probes and generated artifacts remain outside the report-only diff. No implementation, dependency, lockfile, existing review or author-response content is changed. The live head is checked again before publication; report-head push and pull-request CI are tracked separately afterward, without recursively committing CI status into this report.

## Acceptance boundary

The author-recorded decision-25 writer choice, decisions 27–31 coordinator defaults, decision 32 writer-data rule and earlier real-chapter checkpoint narrative are design context, not independently verified user acceptance. This review evaluates the proposed contract and does not choose the writer's answers about changed-file notice placement, saving Spark dismissals, or stopped/failed-run history. Those decisions, a real-chapter writer checkpoint, native checks and Slice 5 readiness remain separate even after code corrections.

No private manuscript, paid/live provider call, user computer, formal GitHub review/comment, merge, deployment or extension publication was used.

## Author response (2026-10-22)

**F-01, F-02, F-03 and F-04: fixed. N-01 and N-02: fixed.** Three commits
on top of your report's commit `a741f85`, then this response:
- `9a116948` fixes the four P2 findings and N-01, with their tests;
- `cfd0f5e1` fixes N-02;
- `9415caee` records the corrections in the ADR's D12 addendum, the slice
  plan, the agents guide, the epic and the size note, and re-renders the
  visual evidence.

Every new behavioural test failed first on an export of your reviewed
head `bc1fdda`, and every new control passed there. Board ids stay
persistent. The changed-file notice stays where it was. Nothing above
this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | Deciding what is on screen is now separate from deciding whether to save. `LightboxBoardLibrary` hears every adoption (built, opened or restored) and, synchronously, from the adoption itself (so under the newest choice), calls `onScreen`. A board a file already holds moves the reload pointer to that file and writes nothing. A built board no file holds saves itself once, and the pointer follows the commit, or the newest file that holds its text. `saveMeasured` is gone; open and restore no longer move the pointer themselves | `LightboxBoardAdoptions.test.ts`: A, B, then unchanged A, then a fresh host over the same file system and memento restores A, with nothing more written; the same with A read first, restored with every group `ok` | `9a116948` |
| F-02 | Medium / P2 | **Fixed** | `LightboxRetainedBoards` numbers every adoption (`adoption`, ascending per session); readings landing keep it; `LightboxService.adoptionOf(boardId)` reads it. **Press:** the snapshot captures it before the first await, and once the prompts load the handler refuses with "The board changed…" (and asks for a fresh estimate) when it moved. It sits beside the estimate key, not in it: a snapshot of the same board has the same id, text and figures, so the estimate shown stays good for a press made after the open. **Shelf:** `shelf()` captures it before its first await and names it; `LightboxBoardsHandler` checks `describesCurrent` with nothing awaited before the post. A push built across a newer adoption is dropped (that adoption pushes its own); a request's answer is built again, at most three times, then logged and left unanswered. `LIGHTBOX_BOARDS` carries `adoption`, and `useLightboxBoards` never takes a lower adoption's shelf for the same board id. Every adoption now pushes a shelf | `LightboxBoardAdoptions.test.ts`: your press sequence for a lens and for the Opinion (FIRST opened while READ's press prepares: no provider call, every group `not-run`, refused); your late-push sequence (FIRST's `changed` notice stands, no READ snapshot posted after it); a request answered across the open, rebuilt for FIRST. Controls: another source chosen (refused, as before); nothing adopted (the press starts, the push is posted); the open landed first (the press at the earlier estimate starts); another board on screen (the push names its own board). `useLightboxBoards.test.ts`: a lower adoption's push is not taken; the same adoption's save, a later adoption's push, and another board's push behave as before | `9a116948` |
| F-03 | Medium / P2 | **Fixed** | A staged file is `.<timestamp>.board.json.tmp-<UUID>` (`randomUUID`; `mintStagingId` injects ids in tests), so no other writer stages under its name. The `FileSystem` port is unchanged: it has no exclusive create, and widening it for every adapter was not needed once the name is the writer's own. The final rename keeps `overwrite: false`. When it fails while the final name now exists and the staged file is still there, the store takes the next free name and runs the commit point again, three attempts in all; otherwise, or after the third, the save fails and its staged file is removed. A save reports only the file its own rename put in place | `LightboxBoardStoreHistory.test.ts`: two stores over one `MemoryFileSystem`, the same millisecond, each commit held until both have staged and chosen the same final name. Two UUID staging names; both saves succeed with different ids; each file decodes to its own writer's board; nothing staged is left. Guard: a name taken at every attempt fails the save and leaves the other writer's files | `9a116948` |
| F-04 | Medium / P2 | **Fixed** | A source's folder is `<source-slug>-<source-hash>`: the slug as before, then the first eight hex digits of the SHA-256 of the source's key, so paths that slug alike never share a folder. `LightboxBoardFiles` (split from the store, which is now 349 lines) reads the folder whole: no cap, the key filter kept, summaries cached by size and modification time. The same-text check reads every file. The rail shows the newest twenty, then "Showing the newest 20 of N." and **Show K older**; the page always reaches the board on screen; the head counts every board | `LightboxBoardStoreHistory.test.ts`: 206 boards of one source listed whole, newest first, the oldest's text found (held, nothing written); colliding slugs with 205 of the neighbour's boards and an unreadable file in its folder: separate folders, each listing and count its own; control: another source's file copied into the folder is still not listed. `lightboxBoardsView.test.ts` and `LightboxBoardsPanel.test.tsx`: the page note, Show older, reaching the board on screen. Evidence: `history`, `history-older` | `9a116948` |
| N-01 | Low / P3 · nonblocking | **Fixed** | `deleteBoard` forgets which board the held shelf answered for, so coming back to that board asks again; the late delete answer is still ignored as not pending | `useLightboxBoards.test.ts`: Delete A's row, to B, back to A before any answer: a fresh request for A, and its answer shows no deleted row | `9a116948` |
| N-02 | Low / P3 · nonblocking | **Fixed** | `prepareLightboxTileHandoff` and `lightboxBringView` check the earlier rule first, as the standing does, so both Bring surfaces give decision 32's reason when both conditions apply. Every path still refuses | `LightboxOpinionEarlierRule.test.ts`: both marks give the rule's reason in the standing, the host and the webview; control: a text mark alone keeps its own reason | `cfd0f5e1` |

### How each new test was checked against `bc1fdda`

The seven test files ran on an export of `bc1fdda`, with this worktree's
`node_modules` and ts-jest diagnostics off, so the new payload field and
options compile away and each failure is behavioural. 15 failed and 25
passed:
- **F-01: both sequences failed.** The pointer named B's file
  (`drafts-alice-2-md/…`), as you found.
- **F-02: five failed.** The lens press made one more provider call (8,
  not 7); the Opinion press changed FIRST's F group from `not-run`. The
  late push was posted with READ's `same` snapshot after FIRST's
  `changed` one; the request was answered with READ's snapshot. The
  hook's case failed: it took the lower adoption's push.
- **F-03: two failed.** Both stores staged at one path (one staging name,
  not two). The guard failed too: `bc1fdda` failed the save at the first
  taken name, which is safe, but did not try the next.
- **F-04: four failed.** 200 of 206 listed; the colliding sources shared
  `drafts-alice-1-md`; the view and panel had no page.
- **N-01 and N-02: one each failed.**
- **Controls, seven, passed:** the five in `LightboxBoardAdoptions`, the
  copied-file listing, and N-02's text-mark reason.

### Evidence

The host states were rebuilt (file ids in the hashed folder, adoptions on
the shelves; with both mapped back, the earlier states' messages,
estimates included, match `bc1fdda`'s). Two states are new, `history` and
`history-older`, at 1440, 1000 and 500 px. Rendered from `webview.js`
`59b1f612…`: 27 captures, `errors.txt` empty, the 21 earlier captures
byte-identical. Against `bc1fdda`'s bundle the harness writes 9 errors,
all `history`.

### Verification

| Check | Result |
| --- | --- |
| Full Jest | **474 suites / 6,533 tests / 59 snapshots** passed |
| Lint | 0 errors / 1,133 warnings, identical per file, rule and severity to `3e6a156` |
| Typecheck | All three projects pass |
| Build | `npm ci` into a real `node_modules`; `npm run build` with `verify:bundle` passes (the three existing size warnings). `webview.js` SHA-256 `59b1f612774f0d55fae820d1442e733670118dae445c9cb2320702f382150194`, `extension.js` `edf2ea482c5d9d6669dc4e8c4775be96865492b882f40d832d11771f74b41754`, the same on a second build |
| `git diff --check` | Clean |

No live or billable call was made. The fixtures are public-domain *Alice*.

## Independent re-review of the corrections (2026-10-22)

**Reviewed head:** `f3808b40d49c17da97a4ff52ab05802a5f24a14d`. **Base / merge-base:** `3e6a1561cc60c084fa8493c8582ca829d5ca41fe`. **Delta:** four commits after report commit `a741f85c2435aaa35d005cf7900f18da74fde9e0`, 45 files, +2,256 / −482, including the author response and evidence. This review read the amended ADR, slice plan, agents guide and response, rather than treating the author's resolution ledger or green CI as verification.

**Verdict: Request changes. All six original findings are resolved in their reported sequences.** The original ownership failures are not being carried forward under their old ID: F-05 below is a distinct, independently reproduced shelf-freshness gap *within* one adoption. N-03 is a new nonblocking pagination defect. Neither remaining finding loses a saved file. The author response above is preserved verbatim; the first review and its original ledger remain historical evidence.

### Resolution ledger

| ID | Re-review disposition | Independent verification at this head |
| --- | --- | --- |
| F-01 | **Resolved** | A → B → unchanged A moves the pointer to A; a fresh host restores the exact A board, with no duplicate files, both measured-only and fully read |
| F-02 | **Resolved as reported** | Holding Characters or Opinion preparation across a completed same-ID Open sends no extra stub-provider call and leaves FIRST untouched; the old-adoption push cannot erase FIRST's changed-file state. Repeated FIRST → READ opens also invalidate the held press; a held explicit shelf request is rebuilt for the newest of three adoptions |
| F-03 | **Resolved** | Two stores at the same timestamp stage at distinct UUID paths and are both held at the same final destination; the loser retries. Both return different files decoding to their own board IDs, with one correct commit callback each and no staging leftovers |
| F-04 | **Resolved** | All 201 valid files are listed; only the oldest holds the requested text, and dedup finds it without writing. Two hundred neighboring-source files copied into the folder do not hide the owner's file; ordinary neighbor saves choose a different hashed folder |
| N-01 | **Resolved** | Delete A → B → A forces a fresh A request; its answer removes the row, and stale delete/B replies cannot resurrect it |
| N-02 | **Resolved** | The standalone canonical/Bring probe verifies identical earlier-rule refusal on standing, host and UI with both old-rule and text-stale marks; current, text-only, in-flight and all 78 non-Opinion controls retain their behavior |
| F-05 | Medium / P2 · **Open** | An older same-adoption save push overwrites a newer successful changed-file comparison |
| N-03 | Low / P3 · nonblocking · **Open** | Show older can do nothing repeatedly after restoring a board deep in history |

The additional storage controls pass: a collision retry rechecks the commit point and can withdraw without deleting the contender; an ordinary rename failure does not retry; a disappeared staging file cannot produce success; file/selection-range keys are isolated; portable identity does not depend on the old URI; and cache invalidation responds to changed modification times. The deliberate run-priority control also passes: if a run starts before a queued Open actually adopts, Open can be refused by the existing reading guard. That is not confused with the corrected case where Open has already completed.

### F-05 — Order shelf observations within an adoption

**Location:** [`LightboxBoardLibrary.ts:193–196,219–221`](https://github.com/okeylanders/prose-minion-vscode/blob/f3808b40d49c17da97a4ff52ab05802a5f24a14d/packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts#L193-L221), with [`useLightboxBoards.ts:100–119`](https://github.com/okeylanders/prose-minion-vscode/blob/f3808b40d49c17da97a4ff52ab05802a5f24a14d/packages/core/src/presentation/webview/hooks/domain/useLightboxBoards.ts#L100-L119).

**Trigger:** a delayed save-triggered source comparison overlaps a chapter edit and a later rail action, without opening another snapshot. Readings and deletes intentionally retain the adoption number, so the new adoption guard cannot distinguish these observations.

**Verified sequence using the production host/runner/store/library harness, public-domain Alice, and stub responses:**

1. Measure and save FIRST; read and save READ; open READ.
2. Hold the next chapter comparison *after* its old bytes have been read, then run Characters. Its committed save starts the held shelf push.
3. Edit the chapter on disk. Delete FIRST. The deletion succeeds, and its explicit answer correctly says `snapshot.file: 'changed'`, at adoption **2**.
4. Release the older comparison. The last posted message is now `requestId: null`, adoption **2**, `snapshot.file: 'same'`. The deleted row remains absent, but the newer file-change warning has been reversed.

This is not an expectation that the rail continuously watches disk: a newer explicit request has already observed and reported the change. The older answer subsequently replaces that known state. A separate real-hook probe confirms that it takes the equal-adoption push and changes the held snapshot from `changed` to `same`, removing the required warning and **Read the current text** action. Both desired assertions fail on this head. The positive control accepting a genuinely newer save at the *same* adoption passes, so blanket rejection of equal-adoption pushes would be the wrong correction.

**Expected:** give shelf work an ordering/freshness identity within an adoption, and prevent an older observation from superseding a newer one at host post and webview acceptance. Keep legitimate later save pushes working. Add the delayed-save → edit → Delete sequence and its no-interleaving/newer-save controls.

**Impact and limits:** the rail falsely reassures the writer that saved text still matches the file and hides the offered re-read action. Bring continues to validate the source independently; this review does **not** claim unsafe handoff, file loss, live-model use or billing impact.

### N-03 — Advance paging from the rows actually displayed

**Location:** [`LightboxBoardsPanel.ts:173`](https://github.com/okeylanders/prose-minion-vscode/blob/f3808b40d49c17da97a4ff52ab05802a5f24a14d/packages/core/src/presentation/webview/components/lightbox/LightboxBoardsPanel.tsx#L170-L175), paired with [`lightboxBoardsView.ts:91–98`](https://github.com/okeylanders/prose-minion-vscode/blob/f3808b40d49c17da97a4ff52ab05802a5f24a14d/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxBoardsView.ts#L91-L98).

**Trigger:** reload restores a saved board beyond the initial twenty rows. The view correctly extends the visible page to reach it, but the component's private `shown` counter still starts at twenty.

**Verified:** with 65 files and current index 44, the panel displays 45 rows and says **Show 20 older**; one click still displays 45. Its sequence is **45 → 45 → 60 → 65**, not the advertised first jump to 65. With 206 files and current index 204, **Show 1 older** leaves 205 rows unchanged for **nine clicks**; only click ten reveals the last row. Newest-row controls correctly progress 20 → 23 and 20 → 40 → 60 → 65. The desired deep-current assertions fail. The supplied normal first-page screenshots do not exercise restored deep history.

**Expected:** increment from the effective visible count, not a smaller hidden counter. This remains P3: all files are present and repeated clicks eventually reach them; the correction has removed the original silent host-side cutoff.

### Fresh verification and evidence boundaries

All runtime jobs were serialized in the isolated cloud review workspace. The package manifest/lockfile are unchanged; disk-backed dependencies were reused. No implementation or tracked tests were edited.

| Check | Independent result |
| --- | --- |
| Exact-head full Jest | **474 suites / 6,533 tests / 59 snapshots pass**, 396.402 s in this cloud Jest VM |
| External regression/contract probes | **38 pass / 4 fail**, 42 tests in 11 suites, 18.242 s in this cloud Jest VM. Exactly four desired assertions reproduce the two remaining findings: F-05 host and hook; N-03 at 65 and 206 files. No harness failure |
| Standalone canonical/Bring checks | **Pass** in direct Node, including N-02; digest wording and rendered paragraph-cap changes do not alter canonical basis, while cited-data mutations do |
| Typecheck | **Pass**, all three projects |
| Lint | **0 errors / 1,133 warnings**; exact per-relative-file/rule/severity parity with the original reviewed head (which matched the independently checked base) |
| Production build and `verify:bundle` | **Pass**, with the three existing webpack size/performance warnings; rebuilt bytes match the author’s reported hashes |
| Regenerated host states | **Pass**, fresh builder over production host components; `boards.json` is byte-identical to the committed correction fixture |
| Exact rebuilt production bundle in JSDOM | **71 positive assertions pass across nine host-fixture scenes**. Six further assertions independently witness the remaining defects: F-05 removes the changed-file warning/re-read action; N-03 requires ten clicks for the last row in a synthetic 206-row shelf. These witnesses confirm bad behavior, not passing desired guards |
| Supplied pixel evidence | New 500 px history and 1440 px expanded-history captures inspected; no new clipping seen. The 21 earlier PNGs are byte-identical to the initial head; recorded facts cover 27 captures at 500/1000/1440 px, without horizontal overflow |
| Source diff whitespace | Clean; the historical report's existing Markdown hard-break spaces were excluded from the implementation check |

Rebuilt `webview.js` SHA-256: `59b1f612774f0d55fae820d1442e733670118dae445c9cb2320702f382150194`; `extension.js`: `edf2ea482c5d9d6669dc4e8c4775be96865492b882f40d832d11771f74b41754`. Correction-head [pull-request CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39840072681) and [push CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39840065206) were independently confirmed successful. They do not exercise the four failing external assertions above.

The format-1 codec, golden fixture, canonical-basis code and measurement rule IDs are unchanged by these corrections. Fifteen independent codec/salvage/round-trip controls and the full saved-fixture tile/inspector/passage checks pass again. No migration or remeasurement is introduced. The new hashed-folder discovery does not enumerate the old, unmerged development-only slug folders; a known old file ID remains directly readable/deletable. Under this PR's first-shape/no-development-migration contract, that is not reported as a released-data compatibility failure. It must not be described as automatic discovery or migration of those development folders.

Complete history removes the false cap, but warm listings still perform one sequential stat per file and retain cached summaries without a cap. A five-file warm-cache control verifies five stats and zero payload reads, then one changed modification time reloads only that payload. This is a scaling consideration, not a demonstrated latency defect; no native latency inference is drawn from Jest timings.

The author response's writer choices, real-chapter narrative and readiness assertions remain author claims, not independently verified writer acceptance. Native VS Code, a real-chapter checkpoint, actual screen-reader behavior and minimum-Chromium rendering remain outside this cloud JSDOM/supplied-image evidence. Code approval, writer approval and readiness for Slice 5B remain separate. No private manuscript, paid/live provider call, user computer, GitHub comment/formal review, merge, deployment or extension publication was used.

## Author response to the re-review (2026-10-22)

**F-05: fixed. N-03: fixed.** Three commits on top of your re-review
commit `2ec6d56`, then this response:
- `6e0e8524` orders the rail's shelves within an adoption (F-05);
- `e6994a81` makes Show older go on from the rows shown (N-03);
- `5af8be03` records both in the ADR's D12 addendum, the slice plan, the
  agents guide and the epic, adds a Low tech-debt note for listing cost,
  and rebuilds the evidence's host states.

Each regression test failed first on an export of your re-reviewed head
`f3808b4`, and each control passed there. Nothing above this section was
edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-05 | Medium / P2 | **Fixed** | `LightboxBoardLibrary.shelf` takes an observation number, ascending per session, before anything is awaited (before the source comparison), and the answer and `LIGHTBOX_BOARDS` carry it. `LightboxBoardsHandler` records the newest observation it sent of each board and, with nothing awaited before the post, never sends one observed before it: a push is dropped, and a request's answer is built again, as for an adoption that moved (`outdated` = across a newer adoption, or observed before one sent). `useLightboxBoards` orders what it holds by adoption, then observation, and never takes an older one for the same board. Every change the rail must hear starts a newer observation (an adoption's push, a committed save's push, a delete's answer), so dropping an older one loses nothing, and a newer save at the same adoption is posted and taken. Equal-adoption pushes are not rejected wholesale | `LightboxBoardAdoptions.test.ts`: your sequence (READ open; the save's push held after reading the old bytes; the chapter edited; FIRST deleted, its answer `changed` at the same adoption; the push released: nothing more posted, the last shelf still `changed`); a request held the same way, answered again after the Delete with `changed` and a later observation. Controls: no interleaving (the push posted `same`, then the Delete's answer `changed`); a newer save at the same adoption (its push posted after the Delete's answer, one more board listed). `useLightboxBoards.test.ts`: a push observed before the held Delete answer is not taken; control, a newer save at the same adoption is taken | `6e0e8524` |
| N-03 | Low / P3 · nonblocking | **Fixed** | `buildLightboxBoardsView`'s page names `next`, the rows Show older shows: twenty more than are shown, at most every board. The panel sets its count from it, so a page widened to reach the board on screen goes on from there | `LightboxBoardsPanel.test.tsx`: 65 boards with the one on screen at index 44 show 45, then 65; 206 with it at index 204 show 205, then 206, and Show older is gone. `lightboxBoardsView.test.ts`: `next` for the first page, a later page and a widened page | `e6994a81` |

### How the new tests were checked against `f3808b4`

The four test files ran on an export of `f3808b4`, with this worktree's
`node_modules` and ts-jest diagnostics off. 6 failed and 31 passed:
- **F-05, host: both regression tests failed.** After the release, the
  held push was posted at adoption 2 with READ's `same` snapshot; the held
  request was answered with `same`. Both controls passed.
- **F-05, hook: the regression test failed** (it took the equal-adoption
  push, and the held snapshot became `same`); its control passed.
- **N-03: both panel cases failed** (45 rows after a press, and 205), and
  the view's page had no `next`.

### Your other observations

- **Development folders.** Not changed. The slice notes now say that
  folders written by development builds before PR #163, named by slug
  alone, are not listed, discovered or migrated, since format 1 has not
  shipped, and that a known file id there still reads. No doc claims
  otherwise.
- **Warm listings.** Recorded as Low tech debt,
  [`2026-10-22-lightbox-board-listing-scale.md`](../../.todo/tech-debt/2026-10-22-lightbox-board-listing-scale.md):
  one stat per file per listing, and a summary cache with no bound. The
  listing stays complete.

### Evidence

The host states were rebuilt: shelves carry their observation, and with
that field removed `states/boards.json` holds what it held at `f3808b4`;
`log.txt` is unchanged. From `webview.js` `acfc8891…`: 27 captures,
`errors.txt` empty, DOM facts the same apart from request-id prefixes, and
every PNG the same in pixels as the committed one (26 byte-identical), so
the committed PNGs stand. No visual state exercises F-05 or N-03; the
tests above do.

### Verification

| Check | Result |
| --- | --- |
| Full Jest | **474 suites / 6,541 tests / 59 snapshots** passed |
| Lint | 0 errors / 1,133 warnings, identical per file, rule and severity to `3e6a156` |
| Typecheck | All three projects pass |
| Build | `npm ci` into a real `node_modules`; `npm run build` with `verify:bundle` passes (the three existing size warnings). `webview.js` SHA-256 `acfc8891e8225b5a8f96b4411d24fda3819c598e41b03610b15ca3c490321423`, `extension.js` `2738d16b8c7dbf35a2728761536db431711fae71a01e2dcb2cf1b57831bb437c`, the same on a second build |
| `git diff --check` | Clean |

No live or billable call was made. The fixtures are public-domain *Alice*.

## Second independent re-review (2026-10-22)

**Verdict: Approve on code quality.** F-05 and N-03 are resolved at `2d4d35430444c576e24dd4fed9ede4cc304aa012`. The six original clearances remain valid, and this pass found no additional actionable defect. This is a technical review, not writer acceptance, a real-chapter checkpoint or permission to advance Slice 5B.

**Scope:** independently read the current PR body, both author responses, source/tests and contract delta from report commit `2ec6d56db2a88e6c6883891a08ad853eb083cf52`; reviewed the corrections against unchanged base `3e6a1561cc60c084fa8493c8582ca829d5ca41fe`. All prior report and author-response text above is preserved. The implementation delta is the observation ordering and effective-visible-count pagination, plus tests, documentation and host-state evidence. The format-1 codec, canonical citation basis and measurement rule IDs are unchanged.

### Independent resolution ledger

| ID | Disposition | Evidence at this head |
| --- | --- | --- |
| F-05 · P2 | **Resolved** | The exact held-save-push → edit → Delete → release sequence now retains the newer `changed` shelf; the older push is not posted. A hook probe also refuses an older observation at the same adoption. Two independently held explicit requests completed in reverse order are rebuilt against the newer state, retain their own request IDs and receive ascending observations. Positive controls accept a genuinely newer same-adoption save, including a real file revert that legitimately clears the warning and adds a saved row. A disposed handler does not publish its late result; a remounted handler receives the current shelf. |
| N-03 · P3 | **Resolved** | With 65 rows/current index 44, the first click goes **45 → 65**; with 206/current index 204, **205 → 206**, without the former inert clicks. Normal newest-current paging remains correct. Rerender controls cover a newly saved row shifting the deep current position, and an already-mounted page moving to a deep current row, expanding once, then retaining that explicit expansion. |
| F-01, F-02, F-03, F-04 · P2 | **Still resolved** | Fresh external controls recheck the measured/read reload pointers; preparing Characters/Opinion presses and stale adoption responses; distinct two-store staging, forced final-name collision/retry and failure cleanup; complete >200-file history, same-text deduplication and source separation. |
| N-01, N-02 · P3 | **Still resolved** | Fresh Delete/return/request-correlation control passes. Direct-Node old/future citation-rule controls retain the earlier-rule reason even with stale text on both Bring paths, while current-rule/text-only and unrelated-tile controls remain unchanged. |

The F-05 fix takes its observation before any await in `LightboxBoardLibrary.ts:194–220`; `LightboxBoardsHandler.ts:129–172` rejects/rebuilds against the newest observation it has sent, without an await between the check and post. `useLightboxBoards.ts:66–73,113–141` orders adoption before observation. This does **not** blanket-reject equal-adoption saves or freeze a changed-file warning forever. The N-03 count comes from the rows actually shown in `lightboxBoardsView.ts:94–103`, consumed by `LightboxBoardsPanel.tsx:172–177`.

### Fresh independent verification

All runtime checks used the isolated cloud filesystem checkout of exact implementation head `2d4d354`, reused unchanged disk-backed dependencies and serialized execution. Only public-domain *Alice*, synthetic files and stub provider results were used.

| Check | Result |
| --- | --- |
| Full repository Jest | **474 suites / 6,541 tests / 59 snapshots passed**, 436.22 s in this cloud Jest/VM execution context; one worker, 2 GiB Node heap, disk-backed cache. |
| Independent external regressions and controls | **47 tests / 12 suites passed**, 22.33 s. The four previously failing desired-behavior assertions now pass; their expectations were not weakened. Mock messages were given explicit observation values for the new protocol. Five additional lifecycle/order/rerender controls also pass. |
| Canonical basis / Opinion / Bring | Direct-Node production-module probes pass: rendered label wording and paragraph rendering cap do not change bases; canonical-data mutations do; old/future citation rules preserve the board and invalidate the Opinion. Both Bring paths agree, including all 78 non-Opinion fixture-tile controls. |
| Saved format / passages | The 15 codec/salvage/round-trip controls and complete fixture tile/inspector/passage probes pass again. No migration or remeasurement is introduced. |
| Typecheck | All three projects pass. |
| Lint | **0 errors / 1,133 warnings**, identical per relative file, rule and severity to the first correction, which was independently matched to the base. |
| Build / bundle verification | Pass; the three existing size warnings remain. |
| Host evidence | Rebuilt production-host `states/boards.json` and log match the committed evidence exactly. |
| Rebuilt-bundle JSDOM | **77 positive assertions**: the nine existing saved-board fixture scenes plus the formerly failing same-adoption warning/action and deep-current paging cases. No runtime errors. |
| Diff hygiene | Correction delta and report-only patch pass `git diff --check`; no implementation files changed by this review. |

Rebuilt `webview.js` SHA-256: `acfc8891e8225b5a8f96b4411d24fda3819c598e41b03610b15ca3c490321423`; `extension.js`: `2738d16b8c7dbf35a2728761536db431711fae71a01e2dcb2cf1b57831bb437c`. Both match the author's stated hashes. Implementation-head [pull-request CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39846961664) and [push CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39846955599) were independently confirmed successful.

The 27 committed PNGs are byte-identical to those inspected at the first correction. They document the supplied ordinary states, not the F-05/N-03 fixes. Those corrections were independently exercised through host/hook/panel tests and the freshly rebuilt production bundle in JSDOM; no new native screenshot or native VS Code interaction is claimed. Jest timings are not direct-Node or native VS Code latency measurements.

### Remaining boundaries

The documented complete-history listing cost (one stat per file, unbounded summary cache) remains Low tech debt, not a newly demonstrated latency defect. Development-only slug folders are deliberately not discovered/migrated; a known old file ID remains readable/deletable, as the independent control confirms. No released-format migration or data-loss claim is inferred from that pre-release contract. Existing disclosed design tradeoffs remain separate from defects.

Writer choices and the author's real-chapter/readiness assertions remain author claims. Native VS Code, actual screen-reader behavior, minimum-Chromium rendering and writer acceptance have not been independently verified. No private manuscript, live/billable model call, user computer, GitHub comment/formal review, merge, deployment or extension publication was used.
