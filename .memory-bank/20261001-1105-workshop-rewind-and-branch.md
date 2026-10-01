# Workshop Rewind and Branch — Sprint 03 (Branch and release readiness) implemented

**Date:** 2026-10-01 (CDT)
**Epic:** [Workshop Rewind and Branch](../.todo/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md)
**ADR:** [2026-09-30 Workshop Rewind and Branch](../docs/adr/2026-09-30-workshop-rewind-and-branch.md) (Accepted 2026-10-01, with D1–D7 folded in; amended with Sprint 03 kickoff decisions and findings)
**Branches:** `epic/workshop-rewind-and-branch` (integration); `sprint/workshop-rewind-and-branch-03-branch`
**State:** Sprint 03 is in review as [PR #120](https://github.com/okeylanders/prose-minion-vscode/pull/120) into the integration branch. Its review requested changes, and all three findings are addressed (see [Review round](#review-round-pr-120-2026-10-01)). Still to come, in order:
1. The PR merges.
2. Okey runs the manual smoke below and records the results here.
3. The epic merges to `main` as one unit.
4. The epic is archived.

## What landed

- **Branch.** `WorkshopSessionPersistenceCoordinator.branchFrom(cut, { title? })` (ADR §7):
  1. It refuses while a session operation is pending, then serializes.
  2. It checks:
     - store availability (D7);
     - a named source (D2);
     - that the latest autosave landed;
     - the Rewind policy.
  3. It exports the live room, applies the unchanged `rewindWorkshopSession`, and builds a fresh envelope (`workshopBranchCheckpoint`):
     - new id and times;
     - a fresh temporal start in the source's timezone, with no persona notices;
     - the title `"<source title> — branch"`;
     - a summary rebuilt from the cut room;
     - no lineage key.
  4. It writes the envelope with `store.saveNamed`.
  5. It reads the file back and promotes it through `promoteNamedSession`, Open's path.

  Failures:
  - before promotion: no file and nothing else changes;
  - during promotion: `restoreRollback`, and `WorkshopBranchNotOpenedError` names the branch file that stays openable.

  Branch never writes the source file.
- **One room-replacement transaction.** The private `replaceLiveRoom` captures the rollback, runs the replacement, restores on any throw, and discards the replaced conversations only after success. New, Rewind and `promoteNamedSession` use it, and through `promoteNamedSession` so do Open, refresh and Branch.
- **Time notices end with their conversations.** `WorkshopSessionTimeService.forgetNotices(keys)` and `forgetAllNotices()` are called at three points:
  - the persona keys a rewind drops, inside the operation;
  - guest dismissal;
  - generation loss.

  This closes the Sprint 02 follow-up: a fresh host gets its session-start frame after "Edit from here" on the first message.
- **Rewound widget messages reopen their widget.**
  - The transform reports `summary.releasedWidgetConfigIds` and a `widgetRestore` for a widget-commit message's own cut.
  - The host posts `WORKSHOP_WIDGET_CONFIG_RESTORED`, and the widget host reopens the released config.
  - The bubble action reads "Edit from here".
  - The clone banner says "Reopened from a message you rewound".
- **Contract and route.**
  - `WORKSHOP_BRANCH_SESSION { turnId, title? }` and the `'branch'` session action.
  - `WorkshopSessionMessageHandler.handleBranchSession` is a registered mutation gated by `rejectWhileRunning`.
  - It posts session state, the edit restores (shared with Rewind), an action result naming both sessions, and a refreshed session list.
- **Webview.**
  - "Branch from here" sits beside Rewind in both bubble footers. It reads the unfiltered host verdict map, so the latest reply offers it, plus the room-wide paused reason and D7 reason.
  - An unnamed room gets the "Save before branching" popup, whose "Save session…" opens the Save modal. It posts nothing.
- **What's New.** The startup notice gains a prepended page, "New: rewind, edit, and branch", with the Git-sync note. `WORKSHOP_STARTUP_NOTICE_VERSION` moves from `v3` to `v4`.
- **Docs and release.**
  - ADR accepted.
  - `docs/ARCHITECTURE.md` gains §8, "Workshop Session Persistence, Rewind, and Branch".
  - The AGENTS.md Workshop Rewind and Branch section (edited in `.ai/central-agent-setup.md`, which `AGENTS.md` links to).
  - `[Unreleased]` sections in both changelogs, with the §9 upgrade warning.
  - Branch Board lineage follow-up.
  - PR #119 review: F-01 Addressed, plus a release disposition for both Sprint 02 follow-ups.

## Kickoff decisions (confirmed by Okey, 2026-10-01)

1. One private room-replacement helper. Open uses it too, through promotion. No collaborator class yet.
2. Time notices end with their conversations, at three seams. This amends Sprint 02 kickoff decision 2's last sentence.
3. A rewound widget commit reopens its widget only for the widget message's own cut. Skipped-past configs are released silently, and that residue is accepted.
4. Manual smoke is Okey's: the checklist below.
5. What's New is a prepended page on the existing startup notice, bumped from `v3` to `v4`. ADR 2026-08-05's ledger is not built. Okey changed the recommended append to a prepend.

## Findings (all in the ADR)

1. New's reset prelude ran outside its `try` block, so a throw left a half-reset room. It now rolls back.
2. Branch opens what it wrote: it reads the file back before promoting.
3. The released-config clone banner needed honest copy.
4. Branch verdicts are Rewind verdicts, unfiltered. The host words a non-rest-point refusal "Can't branch from this point".

## Review round (PR #120, 2026-10-01)

The [review](../docs/pr-reviews/pr-120-workshop-branch-16c751b-review.md) requested changes. ADR Sprint 03 findings 5–7 record each fix:

- **F-01 (High), `16ea5f2` and `47979f1`: Branch proves its source on disk.**
  - The problem: the named association and clean revisions did not show the file still existed. If Git deleted, corrupted or replaced it while the room was open, the branch would replace `current.json` and the room would lose its only complete copy.
  - The fix: Branch compares the source file with the accepted checkpoint before writing anything, refusing with `source-changed`. It compares again at the commit of the rolling write, immediately before `current.json` is replaced, through the store's `beforeCommit` seam. A mismatch there removes the temporary file, keeps `current.json`, rolls back and reports the saved branch.
  - Re-review: the first version, `16ea5f2`, checked again after the import instead. The re-review found that a source deletion during the mirror's last reads and writes still slipped through. `47979f1` moved the check to the commit seam, as the reviewer recommended.
  - Regressions: the reviewer's three probes are now permanent tests, and each also proves that Save as new and then Branch works. Deletions are covered during the branch save, the import, the mirror's branch read, and after the rolling temporary write. A store test pins the hook.
  - Mutations caught: no early check (3 failures); the late guard back before the mirror (the two late seams); no late guard (all four mid-branch cases).
- **F-02 (Standard), `ed576c3`: a widget edit goes back to its addressee.**
  - Both edit forms now restore the chat target through `addresseeOf` and `repairedChatTarget`.
  - Regressions: a later guest and a later tool in the transform, and a later guest through Rewind and Branch. The pre-fix condition fails all four.
- **F-03 (Standard), `0af3539`: Rewind also ends the notices of personas whose import degrades.**
  - Regressions: host and guest degradation, write-failure rollback, and a test pinning that Open still queues a resume frame. The pre-fix code fails both degradation cases.
  - The archived debt record's resolution is qualified.

## Proof

- **Key proof** (`WorkshopSessionBranchCoordinator.test.ts`):
  - Branches the canonical scripted room from a named checkpoint at all 17 rest points after the directive floor.
  - Every branch file's `{ workshop, conversations }` equals `expectedRewoundRoom`, the oracle's builder, now shared from `WorkshopRewindOracle.ts`.
  - The envelope is exact, the source file is byte-identical, and the branch is the live, active named session.
- **Coordinator** (37 tests):
  - D2 refusal with the directory unchanged, then success once saved;
  - every refusal;
  - transform and write failures, leaving no orphan and no temporary file;
  - import, hydrate and mirror failures: rollback, the branch openable, an honest error;
  - writer and widget edits;
  - Open's temporal semantics;
  - the browser summary and content search.
- **Mutations caught:**
  - letting an unnamed room through;
  - skipping the unsaved-changes check;
  - writing the source (22 failures);
  - summarizing the source instead of the cut (17 failures);
  - each time-notice seam.
- **Route** (13 tests) and **webview**: bubble, surfaces, sessions hook, confirm copy, widget host and opening, `WorkshopApp` flows, and the seven-page notice.

## Verification (sprint branch, before push)

- `npx jest --no-cache`: 228 suites, 2,704 tests, 2 snapshots passed. Sprint 02 recorded 225 / 2,614.
- `npm run typecheck`: core, webview and extension clean.
- `npm run lint`: 0 errors, 1,030 warnings. The base (`5fb85a0`) had 1,026. The four new warnings follow the repo's existing naming conventions:
  - two `MessageType` enum members: `WORKSHOP_BRANCH_SESSION`, `WORKSHOP_WIDGET_CONFIG_RESTORED`;
  - two PascalCase React components: `WorkshopBranchAction`, `NoticeActions`.
- `npm run build`: webpack plus `verify:bundle` passed.
- `git diff --check`: clean.

## Manual smoke (Extension Development Host) — results pending (Okey)

The cloud container cannot run the Extension Development Host. Use cheap models and short rooms. This covers Sprint 02's Rewind smoke too, and scenario 7 covers the PR #120 review's F-01. Record each result below with the date and build.

| # | Scenario | Steps and expectation | Result |
|---:|---|---|---|
| 1 | Guest and capability rewind | In a host conversation with one capability read and one guest, rewind to the host reply before the guest joined. The guest is disposed, and the host's next reply mentions nothing past the cut. | Pending |
| 2 | Writer-bubble edit | "Edit from here" on a writer bubble returns its text and attachments to the composer. Edit and resend; the thread continues coherently. Also try a widget message sent to the host, then talk to a guest, then edit the widget message: its widget reopens on the released config, and sending it goes to the host. | Pending |
| 3 | Excerpt revision | Revise the excerpt, then rewind to before the revision. The next host reply acknowledges the revised excerpt frame. | Pending |
| 4 | Unnamed-room branch | Click Branch in an unnamed room: the "Save before branching" popup appears and "Save session…" opens the Save modal. Save, then click Branch again: both sessions appear in the browser. Reopen each and verify its content. | Pending |
| 5 | Reload | Reload the window after a rewind and after a branch. Both restore exactly. | Pending |
| 6 | Legacy session | Open a pre-feature session. Earlier turns show the disabled reason; turns after the reopen point rewind and branch. | Pending |
| 7 | Source changed on disk | With a named session open, delete or edit its file outside VS Code (or check out an older version with Git), then click Branch. It is refused with "This session's saved file is missing or changed on disk…", and the room stays. Use Save as new, then Branch: it works. | Pending |

Also glance at the startup notice: it should open once on the new first page.

## Follow-ups

- [Browser lists an unreadable session](../.todo/tech-debt/2026-10-01-workshop-browser-lists-unreadable-session.md) (Low, identified). The PR #120 review noticed it, and a probe confirmed it; it predates this epic.
- [Persistence coordinator ownership](../.todo/tech-debt/2026-10-01-workshop-persistence-coordinator-ownership.md) (Low, deferred). Extract room replacement when the next whole-room operation arrives, for example Side Quests.
- Branch lineage (`branchedFrom`) lives in the parked [Branch Board](../.todo/features/feature-workshop-branch-board/README.md) feature. No lineage is persisted in v1.
- A real screenshot of the bubble actions for the notice page. The page draws them inline today.
- Release preparation names the version: both changelogs carry `[Unreleased]`. The release notes keep the §9 warning: sessions saved by this release can't be opened by older builds, so writers who sync through Git should update every machine first.
- Archive the epic under `.todo/archive/epics/` with an `ARCHIVE.md` note after its merge to `main`, not before.
