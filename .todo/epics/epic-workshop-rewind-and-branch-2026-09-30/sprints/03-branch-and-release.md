# Sprint 03: Branch and Release Readiness

**Status:** Planned
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
  - [Rewound widget commits: reopen the released config](../../../tech-debt/2026-09-30-workshop-rewound-widget-commit-reopen.md).
  - [Time notices outlive their conversations](../../../tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md). Branch inherits both through the shared transform.

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

## Exit

Branch works from named rooms with the source preserved, and unnamed rooms are asked to save first. All epic completion criteria are checked. Focused tests, full Jest, all TypeScript projects, ESLint, production build and `git diff --check` pass. Manual smoke is recorded.
