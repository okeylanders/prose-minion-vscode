# Workshop Rewind and Branch — Sprint 02 (Rewind) implemented

**Date:** 2026-09-30 (CDT)
**Epic:** [Workshop Rewind and Branch](../.todo/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md)
**ADR:** [2026-09-30 Workshop Rewind and Branch](../docs/adr/2026-09-30-workshop-rewind-and-branch.md) (Proposed; amended with Sprint 02 kickoff decisions and findings)
**Branches:** `epic/workshop-rewind-and-branch` (integration); `sprint/workshop-rewind-and-branch-02-rewind`
**State:** Sprint 02 merged into the integration branch via PR #119 (`5fb85a0`). Sprint 03 (Branch) not started, by request: pause for review after each sprint.

## What landed

- **Pure transform.** `session/WorkshopSessionRewind.ts` exports `rewindWorkshopSession` and `WorkshopRewindRefusedError`.
  - It cuts the persisted pair `{ workshop, conversations }` at an evaluated cut and returns the cut pair, a cut `summary`, an optional `composerRestore` and `unverifiedConversationKeys`.
  - It performs no I/O and reads no clock. Its output is strictly validated before it returns.
- **Coordinator.** `WorkshopSessionPersistenceCoordinator.rewindTo(cut, { origin })` runs in this order:
  1. refuse while a session operation is pending;
  2. serialize;
  3. check store availability (D7) and re-check the policy;
  4. `captureRollback`;
  5. export, transform, `installRoom`;
  6. `commitRewoundRoom`, the durable write: an identity-checked named update plus the rolling mirror, or `current.json`;
  7. discard the replaced conversations, then log one line.

  `restoreRollback` runs on any failure. `installRoom`, `exportLiveRoom` and `acceptNamedWrite` were extracted so Open, capture and the named write path share them.
- **Contract and route.** `WORKSHOP_REWIND_SESSION { turnId }` and the `'rewind'` session action.
  - `WorkshopSessionMessageHandler.handleRewindSession` is a registered mutation gated by `rejectWhileRunning`.
  - The writer-facing reason copy lives in `shared/constants/workshopRewind.ts`.
  - The coordinator re-exports the rewind vocabulary, because handlers may not import session collaborators.
- **Webview.**
  - "Rewind to here" on agent replies; "Edit from here" on writer messages; a widget commit's message rewinds without an edit.
  - Disabled actions carry the host's reason, and one room-wide paused reason covers busy and D7 states.
  - The latest reply offers no Rewind.
  - Confirm copy lives in `workshopSessionConfirmCopy.ts`.
  - The composer is re-seeded through `WORKSHOP_COMPOSER_DRAFT_RESTORED`, and pills are restaged through the snapshot.

## Decisions and findings (all in the ADR)

**Kickoff, confirmed by Okey:**
- Context-source re-delivery appends a row and stales the superseded one.
- Temporal state stays current.
- `lastActivity` is an intended oracle difference.
- Host marks record `contextRevision`: the ADR's divider rule was inexact.
- Rewind writes inside the operation.

**Findings:**
1. The `headed-missing-room-offsets` normalization would have denied a fresh host its catch-up after a cut before its first reply. It is now narrowed to participants that retain a conversation. The named-room coordinator test found it.
2. Dropped participants are named in the action result, not the degraded banner.
3. A direct tool message's attachments are named for re-attach. Their bodies exist only in provider history.
4. A writer edit returns the chat target to the addressee.
5. The latest reply offers no Rewind; the head verdict stays for Branch.
6. The transform returns a `summary`, not loose fields.
7. D7 gating in the webview.
8. The coordinator re-exports the rewind vocabulary.

## Proof

- **Equivalence oracle.** Every canonical rest point after the directive floor rewinds to its recorded room, modulo eight named intended differences, with a vacuity guard. Mutation checks: the ADR's original divider rule fails it, and so does dropping the stale-chain recompute. The pre-fix normalization fails the new regression tests.
- **F-02 closed.**
  - The canonical room installs a standing directive before the host's first reply, commits a one-shot widget and re-delivers a resource.
  - A real `AgentRunEngine` integration case proves marks across two multi-round commits with the production count reader.

## Verification (sprint branch, before push)

- `npx jest --no-cache`: 225 suites, 2,614 tests, 2 snapshots passed. The Sprint 01 entry recorded 219 / 2,528 before its review round.
- `npm run typecheck`: core, webview and extension clean.
- `npm run lint`: 0 errors, 1,026 warnings. The base had 1,024; the two new warnings are the repo's existing naming conventions (the `MessageType.WORKSHOP_REWIND_SESSION` enum member and the PascalCase `WorkshopRewindAction` component).
- `npm run build`: webpack plus `verify:bundle` passed.
- `git diff --check`: clean.

## Follow-ups

- [Rewound widget commits: reopen the released config](../.todo/tech-debt/2026-09-30-workshop-rewound-widget-commit-reopen.md) (Medium).
- [Time notices outlive their conversations](../.todo/tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md) (Medium). After "Edit from here" on the first message, the fresh host gets no time frame for up to an hour. The proposal amends kickoff decision 2's last sentence.
- Sprint 03 kickoff: decide whether Branch lands in the coordinator (now 1,574 lines) or in an extracted room-replacement collaborator. See the Sprint 03 plan's "Inputs from Sprint 02".
- Manual Extension Development Host smoke is recorded with Sprint 03's.
