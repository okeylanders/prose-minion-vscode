# PR Review — Lightbox Saved Boards, Slice 5A

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
