# Sprint 03: Branch and Release Readiness

**Status:** In review — delivered 2026-10-01 on `sprint/workshop-rewind-and-branch-03-branch`, [PR #120](https://github.com/okeylanders/prose-minion-vscode/pull/120) into `epic/workshop-rewind-and-branch` (see [Delivery notes](#delivery-notes-2026-10-01)). Manual smoke waits on Okey
**Branch:** `sprint/workshop-rewind-and-branch-03-branch`
**Depends on:** Sprint 02
**Blocks:** Epic closure

## Goal

Let a writer branch from any rewindable point of a saved (named) session into a new named session. The source is never modified. Unnamed rooms are asked to save first. Then close the epic with docs and release evidence.

## Deliverables

1. **Coordinator operation.** Add `branchFrom(turnId)` following ADR §7:
   - `serializeSessionOperation`, which already waits for queued autosaves;
   - refuse while a run is active or persistence is unavailable;
   - re-check the policy.

   Then:
   1. **Require a saved source (D2).** Refuse unless the live room is associated with a named session (`activeNamedSessionId`), with the message "Save this session before branching." For an associated room, confirm its latest autosave landed.
   2. Export the live room and apply `rewindWorkshopSession`.
   3. Build a new V2 persisted session:
      - fresh `sessionId` and `createdAt` / `updatedAt` / `savedAt`;
      - fresh `temporal.startedAt` and `lastActivityAt`, keeping the timezone;
      - title `"<source title> — branch"` via `requireTitle`;
      - summary rebuilt through the coordinator's summary builder, so browser turn count, preview and search index describe the cut room, not the source.
   4. Write it with `store.saveNamed`.
   5. Promote the new session into the live room through the open/promotion path shared in Sprint 02.
   6. On failure before promotion, remove nothing and report. On failure during promotion, `restoreRollback`. The source file is never written by Branch after step 1.
2. **Contract and route.**
   - Add `MessageType.WORKSHOP_BRANCH_SESSION` with payload `{ turnId: string; title?: string }`.
   - Add `'branch'` to `WorkshopSessionAction`.
   - Register the handler via `registerMutation` + `rejectWhileRunning`.
   - Post session state and an action result naming both sessions, e.g. "Branched “Chapter 3 — Felix” into “Chapter 3 — Felix — branch”".
   - Post `WORKSHOP_COMPOSER_DRAFT_RESTORED` for a writer-bubble branch.
   - Refresh the session list so the Sessions menu shows the branch as the active named session.
3. **Webview.**
   - Add a "Branch from here" action beside Rewind on both bubble types, using the existing `branch` icon and the same host rewindability flag.
   - Additionally disable it with a reason when persistence is unavailable (D7).
   - No confirm dialog for a named room (D4). Show pending state through `sessionActionPending('branch')`, so `roomMutationLocked` covers the transition.
   - **Unnamed room (D2).** Clicking Branch posts nothing. It opens a `WorkshopConfirmDialog` popup: title "Save before branching", body "Branching creates a new session from this point. Save this session first so it isn't replaced.", confirm label "Save session…", which opens the existing Save modal, plus Cancel. Add the case to the `sessionConfirm` union. Whether the room is named comes from the existing `activeNamedSessionSummary`.
4. **Docs and release.**
   - **ADR.** Status → Accepted, with any kickoff decision changes folded in.
   - **Docs.** Update `docs/ARCHITECTURE.md` Workshop persistence notes and the AGENTS.md Workshop section, briefly: marks, the transform, and the new routes.
   - **What's New.** Add a notice entry per ADR 2026-08-05.
   - **Release notes.** State that sessions saved by this release cannot be opened by earlier versions, so writers who sync sessions through Git should update every machine first (ADR §9).
   - **Parked feature.** Update `.todo/features/feature-workshop-branch-board/README.md` with the lineage follow-up (`branchedFrom`) and a link to this epic.
   - **Memory bank.** Add `.memory-bank/YYYYMMDD-HHMM-workshop-rewind-and-branch.md` with facts, verification run and follow-ups.
   - **Archive.** Move the epic to `.todo/archive/epics/` after merge, with an `ARCHIVE.md` note.

## Inputs from Sprint 02

- **Cut and export.** `rewindWorkshopSession` (in `session/WorkshopSessionRewind.ts`) is the §7 step 4 transform, unchanged. Its `summary` already counts what the branch leaves out. The coordinator's `exportLiveRoom()` is the export `capture()` uses.
- **Promotion core.** `installRoom(workshop, conversations)` is the import-and-hydrate core that `hydrate()` (and so Open) and Rewind share. Branch promotes a *new named* session, so it also takes a new identity, `activeNamedSessionId` and accepted checkpoint, as `promoteNamedSession` does. Build on that path rather than on Rewind's in-place install.
- **Refusals and copy.**
  - `WorkshopRewindRefusedError` (re-exported by the coordinator, because handlers may not import session collaborators) and `workshopRewindUnavailableReason` cover Branch's policy refusals.
  - `rewindCutForBubble(turnId)` maps a bubble to its cut.
  - Add the save-first popup to `workshopSessionConfirmCopy.ts`, beside the rewind copy.
- **Webview.**
  - Branch sits beside `WorkshopRewindAction` in both footers and reads the same host verdict and room-wide paused reason.
  - The latest reply offers Branch but not Rewind (ADR Sprint 02 finding 5). `WorkshopApp.threadRewindability` drops that bubble's verdict today, so pass Branch the unfiltered map.
  - A writer-bubble branch re-seeds the composer exactly as the rewind route does.
- **Kickoff consideration: coordinator size.** Sprint 02 took `WorkshopSessionPersistenceCoordinator` from 1,364 to 1,574 lines. Branch is its fourth room-replacement operation (New, Open, Rewind, Branch), and all four share rollback, installation and a durable write. Decide at kickoff whether Branch lands in the coordinator or in an extracted room-replacement collaborator.
- **Open follow-ups to schedule or defer.**
  - [Rewound widget commits: reopen the released config](../../../archive/tech-debt/2026-09-30-workshop-rewound-widget-commit-reopen.md).
  - [Time notices outlive their conversations](../../../archive/tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md). Branch inherits both through the shared transform.
- **PR #119 review carry-over** ([review](../../../../docs/pr-reviews/pr-119-workshop-rewind-ca93f7e-review.md)).
  - **F-01.** The Rewind confirmation ends "To keep this conversation too, use Branch instead.", and `WorkshopApp.test.tsx` asserts it. Branch makes the sentence true, so keep both and mark F-01 Addressed in the review ledger when Branch lands.
  - **Release disposition.** The review asks that both follow-ups above stay visible at release. The release notes or the epic's archive note must record each one as fixed or explicitly accepted.

## Kickoff decisions (2026-10-01)

Confirmed with Okey before `branchFrom` was written. The ADR records each one in its [Sprint 03 kickoff decisions](../../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#sprint-03-kickoff-decisions).

1. **One room-replacement transaction.** A private coordinator helper owns the sequence every room replacement shares:
   - capture the rollback;
   - prepare, install and write the new room durably;
   - restore the prior room on any failure;
   - discard the replaced conversations only after success.

   New, Rewind and `promoteNamedSession` use it. Open, refresh and Branch reach it through `promoteNamedSession`. No new collaborator class yet.
2. **Time notices end with their conversation.** `WorkshopSessionTimeService.forgetNotices(keys)` removes a persona key's notice entry and any pending resume notice. It is called at three seams where a persona conversation ends with no replacement history:
   - the persona keys a rewind drops, inside the operation and before the durable write, so rollback covers it;
   - guest dismissal;
   - generation loss (`clearAllConversations`).

   Surviving participants keep their entries. This amends the last sentence of Sprint 02 kickoff decision 2.
3. **A rewound widget commit reopens its widget.** The transform reports `summary.releasedWidgetConfigIds`.
   - When the cut bubble is a widget-commit message (a `beforeTurn` cut), a writer's Rewind or Branch reopens that widget's sheet on the released config. This is the widget twin of the composer re-seed.
   - The bubble's action reads "Edit from here".
   - A cut that skips past a commit releases its config silently. That residue is accepted.
4. **Manual smoke is Okey's.** The cloud container cannot run the Extension Development Host. The memory-bank entry carries the six-scenario checklist, and the epic criterion stays unchecked until the results are recorded.
5. **What's New uses the existing startup notice.** ADR 2026-08-05's ledger is not implemented. A Rewind and Branch page is *prepended* to the Workshop startup notice, and `WORKSHOP_STARTUP_NOTICE_VERSION` moves from `v3` to `v4`, following that mechanism's documented workflow. Every machine sees the tour once more, opening on the new page.

Also decided as implementation calls within the plan:

- `branchFrom(cut, …)` takes a cut, as `rewindTo` does, and the route maps the bubble through `rewindCutForBubble`. The key proof branches at dividers, which offer no bubble.
- The branch file's temporal state is fresh: `startedAt` and `lastActivityAt` are the branch time, the timezone is the source's, and there are no persona notices. Promotion is Open's path, so retained personas get a resume frame and the first interaction records "Session resumed".
- A named room whose latest autosave has not landed is refused with "Save this session's latest changes before branching." Branch never writes the source file, so it cannot flush it either.
- The branch title is `"<source title> — branch"`, with the source title trimmed so the suffix fits the 160-character limit.
- Release notes go in an `[Unreleased]` section of both changelogs; release preparation names the version.

## Tests

- **Unnamed source.**
  - The webview shows the save-first popup and posts no branch request; "Save session…" opens the Save modal.
  - The host refuses a branch request for an unnamed room and leaves the room, `current.json` and every named file unchanged.
  - After saving, Branch succeeds from the now-named room.
- **Named source.** The source named file is byte-identical before and after Branch.
- **Branch content.** The branch passes the Sprint 02 equivalence oracle for its cut point, and its summary and search index reflect the cut room.
- **Failures.**
  - An injected failure at branch write leaves the saved source, with no orphan branch file.
  - An injected failure at promotion triggers rollback, and the branch file remains as an openable named session, reported honestly.
- **Refusals.** Active run, pending session operation, persistence unavailable, and a non-rewindable turn.
- **Route and webview.** The button renders and gates, the payload is correct, the Sessions menu reflects the new active session, and the composer is re-seeded for a writer-bubble branch.

## Manual smoke (Extension Development Host)

Record results in the memory-bank entry. Use cheap models and short rooms.

1. **Guest and capability rewind.** In a host conversation with one capability read and one guest, rewind to the host reply before the guest joined. Confirm the guest is disposed and the host's next reply does not mention anything past the cut.
2. **Writer-bubble edit.** Rewind a writer bubble and check the text and attachments return to the composer. Edit, resend, and confirm the thread continues coherently.
3. **Excerpt revision.** Revise the excerpt, then rewind to before the revision. Confirm the next host reply acknowledges the revised excerpt frame.
4. **Unnamed-room branch.** Click Branch in an unnamed room: the save-first popup appears. Save, click Branch again; both sessions appear in the browser. Reopen each and verify its content.
5. **Reload.** Reload the window after a rewind and after a branch. Both restore exactly.
6. **Legacy session.** Open a pre-feature session. Earlier turns show the disabled reason; turns after the reopen point rewind.
7. **Source changed on disk** (added after the PR #120 review). With a named session open, delete or edit its file outside VS Code, then click Branch. It is refused, and the room stays. Use Save as new, then Branch: it works.

## Exit

Branch works from named rooms with the source preserved, and unnamed rooms are asked to save first. PR #119 review F-01 is addressed. All epic completion criteria are checked. Focused tests, full Jest, all TypeScript projects, ESLint, production build and `git diff --check` pass. Manual smoke is recorded.

## Delivery notes (2026-10-01)

Every deliverable landed except the manual smoke, which waits on Okey (kickoff decision 4). The corrections below are also recorded in the ADR's [Sprint 03 implementation findings](../../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#sprint-03-implementation-findings).

**Plan deviations.**
- **Coordinator API.** `branchFrom(cut, { title? })` takes a cut, as `rewindTo` does, and the route maps the bubble. It has no `origin`, because only a writer branches.
- **Saved-source preflight.** It also refuses a named room whose latest autosave did not land, with "Save this session's latest changes before branching."
- **Read-back promotion.** The branch is read back from its file and promoted from that decode result, exactly as Sessions would open it (finding 2).
- **What's New.** A page is prepended to the existing startup notice, now `v4`, instead of an entry in ADR 2026-08-05's unbuilt ledger (kickoff decision 5). No screenshot of the bubble actions exists, so the page draws them inline with the notice's call-out badges.
- **New's transaction.** New joined the shared transaction too, so a failure in its reset prelude now rolls back (finding 1).
- **Released-config banner.** The widget sheets' clone banner now names a rewound message (finding 3).

**Modules.**
- `WorkshopSessionTitles.ts`: the title limit, `requireWorkshopSessionTitle` and `workshopBranchTitle`.
- `WorkshopSessionBranch.ts`: the branch envelope (`workshopBranchCheckpoint`), `WorkshopBranchRefusedError` and `WorkshopBranchNotOpenedError`. The coordinator re-exports both errors for handlers.
- `WorkshopSessionPersistenceCoordinator`: `replaceLiveRoom`, used by New, Rewind and the named-session promotion; `branchFrom`; and `describeWorkshopCut`, shared by the Rewind and Branch log lines.
- `WorkshopSessionTimeService`: `forgetNotices` and `forgetAllNotices`.
- The transform: `summary.releasedWidgetConfigIds` and `widgetRestore`.
- Contracts: `WORKSHOP_BRANCH_SESSION { turnId, title? }`, the `'branch'` action and `WORKSHOP_WIDGET_CONFIG_RESTORED`.
- `WorkshopSessionMessageHandler`: `handleBranchSession`, plus `postEditRestores`, which Rewind shares.
- Webview:
  - `WorkshopBranchAction` beside Rewind, fed the unfiltered verdict map;
  - `useWorkshopSessions.branchFrom`;
  - `useWorkshopSessionSurfaces.requestBranch` and the `save-before-branch` popup;
  - the widget reopen through `useWorkshopWidgetHost` and `useWorkshopWidgetOpening`;
  - the notice page.

**Proof.**
- **Key proof** (`WorkshopSessionBranchCoordinator.test.ts`):
  - Branches the canonical room from a named checkpoint at all 17 rest points after the directive floor.
  - Each branch file's `{ workshop, conversations }` equals `expectedRewoundRoom`, the oracle's builder, now shared from `WorkshopRewindOracle.ts`.
  - The envelope is exact: fresh id and times, fresh temporal start in the source's timezone, the title, a rebuilt summary, and no lineage keys.
  - The source file is byte-identical, and the branch is the live, active named session.
- **Coordinator** (37 tests):
  - D2 refusal with the session directory unchanged, then a branch once saved;
  - refusals: a run, a pending operation, no workspace, a position inside a run, the directive floor, unsaved changes;
  - failures at the transform and the branch write, leaving no file and no temporary file;
  - failures at import, hydrate and the `current.json` mirror: rollback, the branch openable, an honest error;
  - writer and widget edits;
  - Open's temporal semantics;
  - the browser summary and content search.
- **Mutations.** Each is caught:
  - letting an unnamed room through;
  - skipping the unsaved-changes check;
  - writing the source (22 failures);
  - summarizing the source instead of the cut (17 failures).
- **Time notices.** Unit, coordinator (a fresh host's session-start frame; rollback restores the notice) and route (re-invite after dismissal; generation loss). Each seam is mutation-checked.
- **Route** (13 tests) and **webview**: the bubble, surfaces, sessions hook, confirm copy, `WorkshopApp` flows and the seven-page notice.

**Verification** (before the PR push):
- `npx jest --no-cache`: 228 suites, 2,704 tests, 2 snapshots.
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,030 warnings. The base had 1,026; the four new warnings follow the repo's naming conventions: two `MessageType` members and two PascalCase components.
- `npm run build`: passed.
- `git diff --check`: clean.

**Review round** ([PR #120 review](../../../../docs/pr-reviews/pr-120-workshop-branch-16c751b-review.md)). The review requested changes. All three findings were fixed before integration, each with mutation-checked regressions; ADR findings 5–7 record them.
- **F-01 (High).** Branch proves its source file still holds the room. It checks before writing anything, refusing with `source-changed`. It checks again at the commit that replaces `current.json`, through the store's `beforeCommit` seam; the re-review moved this check there from after the import.
- **F-02.** A widget edit goes back to the participant its message addressed.
- **F-03.** Rewind also ends the time notices of personas whose import degrades.

**Follow-ups captured.**
- [Persistence coordinator ownership](../../../tech-debt/2026-10-01-workshop-persistence-coordinator-ownership.md) (Low, deferred).
- Branch lineage (`branchedFrom`), in the parked [Branch Board](../../../features/feature-workshop-branch-board/README.md) feature.
- A real screenshot of the bubble actions for the notice page.
- Release preparation names the version (both changelogs carry `[Unreleased]`).
- Archive the epic after its merge to `main`.
