# Sprint 03: Branch and Release Readiness

**Status:** Planned
**Branch:** `sprint/workshop-rewind-and-branch-03-branch`
**Depends on:** Sprint 02
**Blocks:** Epic closure

## Goal

Let a writer branch from any rewindable point into a new named session. The source is guaranteed saved and never modified. Then close the epic with docs and release evidence.

## Deliverables

1. **Coordinator operation.** Add `branchFrom(turnId)` following ADR §7:
   - `serializeSessionOperation`, which already waits for queued autosaves;
   - refuse while a run is active or persistence is unavailable;
   - re-check the policy.

   Then:
   1. **Save first.** For an unnamed room, save it as a new named session under `defaultTitle` (decision D2), reusing the `saveNamed` path so identity, association and the rolling mirror follow existing rules. For an associated named room, confirm its latest autosave landed.
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
   - Post session state and an action result naming both sessions, e.g. "Saved “Untitled session — Felix — Sep 30” and opened “… — branch”".
   - Post `WORKSHOP_COMPOSER_DRAFT_RESTORED` for a writer-bubble branch.
   - Refresh the session list so the Sessions menu shows the branch as the active named session.
3. **Webview.**
   - Add a "Branch from here" action beside Rewind on both bubble types, using the existing `branch` icon and the same host rewindability flag.
   - Additionally disable it with a reason when persistence is unavailable (D7).
   - No confirm dialog (D4). Show pending state through `sessionActionPending('branch')`, so `roomMutationLocked` covers the transition.
4. **Docs and release.**
   - **ADR.** Status → Accepted, with any kickoff decision changes folded in.
   - **Docs.** Update `docs/ARCHITECTURE.md` Workshop persistence notes and the AGENTS.md Workshop section, briefly: marks, the transform, and the new routes.
   - **What's New.** Add a notice entry per ADR 2026-08-05.
   - **Parked feature.** Update `.todo/features/feature-workshop-branch-board/README.md` with the lineage follow-up (`branchedFrom`) and a link to this epic.
   - **Memory bank.** Add `.memory-bank/YYYYMMDD-HHMM-workshop-rewind-and-branch.md` with facts, verification run and follow-ups.
   - **Archive.** Move the epic to `.todo/archive/epics/` after merge, with an `ARCHIVE.md` note.

## Tests

- **Unnamed source.**
  - The source is saved as a named session first.
  - The branch opens as the live room.
  - `current.json` now mirrors the branch.
  - The saved source contains the full, uncut conversation.
- **Named source.** The source named file is byte-identical before and after Branch.
- **Branch content.** The branch passes the Sprint 02 equivalence oracle for its cut point, and its summary and search index reflect the cut room.
- **Failures.**
  - An injected failure at save-first leaves the live room unchanged and associated as before.
  - An injected failure at branch write leaves the saved source, with no orphan branch file.
  - An injected failure at promotion triggers rollback, and the branch file remains as an openable named session, reported honestly.
- **Refusals.** Active run, pending session operation, persistence unavailable, and a non-rewindable turn.
- **Route and webview.** The button renders and gates, the payload is correct, the Sessions menu reflects the new active session, and the composer is re-seeded for a writer-bubble branch.

## Manual smoke (Extension Development Host)

Record results in the memory-bank entry. Use cheap models and short rooms.

1. **Guest and capability rewind.** In a host conversation with one capability read and one guest, rewind to the host reply before the guest joined. Confirm the guest is disposed and the host's next reply does not mention anything past the cut.
2. **Writer-bubble edit.** Rewind a writer bubble and check the text and attachments return to the composer. Edit, resend, and confirm the thread continues coherently.
3. **Excerpt revision.** Revise the excerpt, then rewind to before the revision. Confirm the next host reply acknowledges the revised excerpt frame.
4. **Unnamed-room branch.** Branch from an unnamed room. Both sessions appear in the browser; reopen each and verify its content.
5. **Reload.** Reload the window after a rewind and after a branch. Both restore exactly.
6. **Legacy session.** Open a pre-feature session. Earlier turns show the disabled reason; turns after the reopen point rewind.

## Exit

Branch works from named and unnamed rooms with the source preserved. All epic completion criteria are checked. Focused tests, full Jest, all TypeScript projects, ESLint, production build and `git diff --check` pass. Manual smoke is recorded.
