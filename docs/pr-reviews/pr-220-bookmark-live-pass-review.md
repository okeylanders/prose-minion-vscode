# PR #220 review: Bookmark Recall live-pass checklist

## Verdict

**Changes requested at `d49e94dea706a0c1b6cebcad8b02dcfba7bdc6ca`: one P2 documentation finding.** The new saved-turn race step gives an incorrect expected result after the write has been admitted. Narrow that step to the source-read phase and record the later-write outcome separately. This does not reopen the resolved product findings in #219 or request changing its accepted write semantics.

- PR: [#220](https://github.com/okeylanders/prose-minion-vscode/pull/220)
- Base: `epic/workshop-bookmark-recall`, `298c17dc63e0a609da4d73e93ed0bdd28ea24fd4`
- Head branch: `epic/workshop-bookmark-recall-slice-4-live-pass`
- Reviewed: 2026-11-05
- Scope: both changed documentation files, all newly added acceptance steps, ADR D1–D10, the #216 and #219 findings/corrections, corresponding host/UI code and regression tests, and CI. No production code changes are in this PR.

This is the review's disposition, not a formal self-review `REQUEST_CHANGES` state or permission to merge. The actual VS Code live pass remains pending.

## F-01 — P2: distinguish a source-read interruption from an admitted write

**Anchor:** [slice-4-live-pass.md:42](https://github.com/okeylanders/prose-minion-vscode/blob/d49e94dea706a0c1b6cebcad8b02dcfba7bdc6ca/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-4-live-pass.md#L42). The PR description repeats the same unconditional statement.

The checklist says: “Reopen the same session, or Rewind, while a saved-turn save is in flight. The save is refused, with no memory and no receipt.” That is true during the asynchronous saved-source read, but not throughout the save.

`WorkshopSavedTurnMemoryHandler` captures the room revision before `recall.savedTurn`. The shared writer checks that revision **before** calling the library. A replacement during that source read returns `ok: false` and writes nothing, exactly as #219 F-02 requires.

Once the write has been admitted, however, the existing writer intentionally permits a same-ID write to finish. Its post-write room check returns `ok: true`, the memory ID and `WORKSHOP_MEMORY_ROOM_CHANGED`, while withholding the receipt from the replacement room. See [WorkshopProjectMemoryHandler.ts:427–444](https://github.com/okeylanders/prose-minion-vscode/blob/d49e94dea706a0c1b6cebcad8b02dcfba7bdc6ca/packages/core/src/application/handlers/domain/workshop/WorkshopProjectMemoryHandler.ts#L427-L444). The #219 independent correction review explicitly recorded this distinction.

**Independently reproduced on this exact head**, using the existing real-store/coordinator/library [recheck probes](probes/pr-219-saved-memory-rereview.test.ts.txt):

1. Hold `readNamed('saved-source')`, reopen the same `live-room` (and separately Rewind), then release the read: refusal, zero memories, zero receipts.
2. Instead hold the memory file's `writeFile`, reopen the same `live-room`, then release: success with the room-changed warning, **one saved memory**, zero receipts.
3. Hold completion after `ProjectMemoryStore.create` has committed, replace the room, then release: the committed memory remains, with the warning and no misplaced receipt.

All ten existing recheck probes pass. The current checklist would nevertheless mark cases 2 and 3 as failed, encouraging a false regression report or an unintended rollback of accepted persistence behavior.

**Requested correction:** say “while the saved source is still being read, before the memory write is admitted” for the no-memory assertion. Add a separate admitted/committed-write control that expects a retained memory and no receipt in the replacement room. Point to the named deterministic tests or debugger pause points so the tester can tell which phase was interrupted; clicking quickly is not evidence of that phase. Correct the matching PR-description sentence too. No production fix is requested.

## N-01 — P3, nonblocking: make the duplicate-session fixture and states explicit

**Anchor:** [slice-4-live-pass.md:30–33](https://github.com/okeylanders/prose-minion-vscode/blob/d49e94dea706a0c1b6cebcad8b02dcfba7bdc6ca/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-4-live-pass.md#L30-L33).

These checks name the right regressions, but their setup leaves several observations untestable or ambiguous:

- The quoted “Shared session ids are checked…” sentence appears only when `unreadable > 0`. More than 25 ordinary readable sessions alone produces the normal “Bookmarks from N of M saved sessions” line, not that warning. Name both states and include the unreadable-file fixture for the warning.
- Put the two valid files on **different pages**, so the first row is present before the second file reveals the conflict. On one page both files are omitted as ambiguous, so there is no earlier visible row on which to test retroactive disabling.
- Test Open's conflict refusal **before** loading the duplicate's page, or with the valid oversized/index-less duplicate that the browser cannot summarize. Once the row has the badge, both Open buttons are disabled and cannot produce the requested refusal. Preview remains enabled and can be checked after the badge appears.
- Give the files different titles and different safe bookmarked text, retaining the same session ID and embedded `updatedAt`. Warm the first row, discover the duplicate, remove the previously cached file, and reopen without reloading the extension. An unchanged copy has identical content, so “never the deleted file's” cannot distinguish the historical #216 F-05 failure. Reloading the extension would clear the cache and also conceal it.

`WorkshopSessionStorePage.identity.test.ts` already provides these exact fixture patterns, including the 24-filler cross-page survivor witness and the valid 6 MiB unreadable-identity witness. `WorkshopApp.bookmarkBrowser.test.tsx` covers the actual refusal and retroactive badge/button states. Run these manipulations only in a disposable test workspace, not on the writer's only session copies.

## What reviewed cleanly

- **History and scope:** all four slice merge commits in the README are ancestors of this head. The diff contains only the checklist and README. `WorkshopProjectMemoryHandler.ts` is exactly 500 lines, as stated. All 18 relative file links in the two documents resolve.
- **Paging and cancellation:** the consolidated list covers Load more, page coverage, cross-page ambiguity, exact-action conflict refusal, cache-safe survivor recovery, cancellation on close and a fresh walk on reopen. The bounded pager, source-keyed document cache and host/webview cancellation paths match those goals, with the setup clarifications above.
- **Interrupted Open:** the Ctrl+Shift+N confirmation replacement followed by an ordinary Open is the existing real-App #216 F-02 witness. The controller follows only its own Open and drops superseded jumps. This is not merely an explicit-Cancel test.
- **Remember this:** in-window live, full-ledger/out-of-window live, saved reply and saved capability-card paths are represented. The host derives capability eligibility from the original turn, uses only its safe projection, and keeps the saved session/turn provenance. The “Session's reply” label is correctly carried forward as a nonblocking wording decision, not reported as a new data leak.
- **D10:** cited sources are checked at save against the open ledger and the proposer's visibility, survive persistence, and are bounded/deduplicated. Edit citations are refused as `edit-cites`. The tests also retain the no-citation control and the deferred saved-session-reference drop. Native provider prompting cannot guarantee a malformed trailer, so the named deterministic codec/provenance tests are the reliable negative controls.
- **Acceptance remains open:** the checklist still calls for the commit, VS Code/OS/screen-reader details and observed results, and does not claim that JSDOM tests complete native accessibility/layout/provider acceptance. The ADR is still Proposed; acceptance, archival and the final integration PR remain later close-out work. No deferred PR work was undertaken.

## Verification

- Local Node `24.22.1`, exact reviewed head, isolated worktree. No production edits.
- **15 production suites / 140 tests passed** in one serial run: real-App browser/Remember this, bookmark page routes, source-memory handlers, cited-turn persistence, paged store/identity, recall paging, browser hook/view/Open controller, sheet correlation, button eligibility and proposal-prompt sync.
- **10 independent recheck probes passed**, copied unchanged from the committed #219 recheck artifact into temporary Jest discovery and removed afterward. These are separate from the production-test count and demonstrate both sides of F-01's write boundary.
- `git diff --check` passed. Relative-link targets and stated ancestry/file length were independently checked.
- Original-head [CI run 42086767818](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42086767818) passed all three typechecks, **751 suites / 10,465 tests / 59 snapshots**, lint **0 errors / 1,165 baseline warnings**, both webpack bundles and bundle verification. Its log checks out merge candidate `150f65e027499d9ef9fc0e01d24591732eb7c775`, combining exactly the reviewed head and base. The webview retains its three baseline size/performance warnings.
- The report-only publication head's own CI will be checked and its terminal result recorded in the PR conversation, without creating repeated CI-only report commits.

No native VS Code live pass, live provider call, product change, merge or deployment was performed. A green automated run does not resolve F-01's incorrect manual expectation or complete the live pass.

## Author response (2026-11-05)

### F-01: fixed

The race step now names its two phases.
- **During the saved-source read,** before the writer has taken the save, the save is refused and nothing is written.
- **After admission,** a same-session reopen may finish the save, with `WORKSHOP_MEMORY_ROOM_CHANGED` and no receipt in the replacement room. This matches `WorkshopProjectMemoryHandler.write`'s pre-write rejection and post-write warning.

The step points to the real-coordinator probes for the phase that is hard to hit by hand. The PR description's "Remember this" bullet now says the same.

### N-01: folded in

**Paging.** The checklist names both states of the coverage line. It also says the shared-id warning needs an unreadable file.

**Shared session ids.** The check now runs as you laid it out:
- in a disposable workspace;
- with two distinguishable copies split across pages;
- trying Open's refusal before the duplicate's page loads;
- checking Preview's refusal after the badge appears;
- checking the survivor in the same extension session, with no reload.

Docs only. No product code changed.
