# Workshop Rewind and Branch Epic Archive

**Archive prepared:** 2026-10-01
**Effective:** When the epic's PR into `main` merges
**Release state:** Unreleased. Both changelogs carry `[Unreleased]`; [release preparation](../../../tech-debt/2026-10-01-workshop-rewind-and-branch-release-preparation.md) names the version after the [manual smoke](../../../tech-debt/2026-10-01-workshop-rewind-and-branch-main-smoke.md)
**Integration branch:** `epic/workshop-rewind-and-branch`
**Decision:** [ADR 2026-09-30 — Workshop Rewind and Branch](../../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md) (Accepted 2026-10-01)

## Summary

A Workshop conversation no longer only grows. Writers can return the room to an earlier moment, or try another direction from it and keep the original:

- **Rewind to here** returns the room to a reply, including what every participant remembers, and removes everything after it.
- **Edit from here** removes one of the writer's messages and everything after it. The message goes back to the composer, or its widget reopens, so the writer can change it and send it again to the same participant.
- **Branch from here** saves a named session's room, cut at that point, as a new named session and opens it. The source session file is never written. An unsaved room is asked to save first.

The excerpt, context and to-do statuses stay as they are now.

Underneath, retained-history marks record where each participant's history stood after each commit. One pure transform cuts the ledger and every history together at a real rest point, and the cut room installs through Open's promotion path, with rollback on any failure. A branch is that same cut room in a new envelope, held to the Rewind oracle's expected room at all 17 rest points after the directive floor.

The epic was built on its integration branch and reviewed sprint by sprint. It merges to `main` as one unit (decided 2026-09-30).

## Sprints, PRs and reviews

| Sprint | PR | Merged as | Review |
|---|---|---|---|
| [01 — Retained-history marks](sprints/01-retained-history-marks.md) | [#117](https://github.com/okeylanders/prose-minion-vscode/pull/117) | `b1497d8` | [Approved](../../../../docs/pr-reviews/pr-117-retained-history-marks-3ca270d-review.md) with nonblocking findings. F-01 (marks that skip or misplace a commit) addressed; F-02 (broaden the scripted oracle) partially addressed there and closed in Sprint 02 |
| [02 — Rewind](sprints/02-rewind.md) | [#119](https://github.com/okeylanders/prose-minion-vscode/pull/119) | `5fb85a0` | [Approved](../../../../docs/pr-reviews/pr-119-workshop-rewind-ca93f7e-review.md) with no blocking, high or standard finding. F-01 (the confirmation recommended Branch before it existed) addressed when Branch landed |
| [03 — Branch and release readiness](sprints/03-branch-and-release.md) | [#120](https://github.com/okeylanders/prose-minion-vscode/pull/120) | `a7c24bd` | [Changes requested, then approved](../../../../docs/pr-reviews/pr-120-workshop-branch-16c751b-review.md) after two re-reviews. F-01 (High: Branch proves its source file on disk), F-02 (a widget edit's addressee) and F-03 (time notices after a degraded import) fixed and independently verified |

Both Sprint 02 debt records are resolved and archived: [rewound widget commits](../../tech-debt/2026-09-30-workshop-rewound-widget-commit-reopen.md) and [time notices that outlived their conversations](../../tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md).

## Verification at archive preparation

The closure commits change only Markdown on top of `a7c24bd`. Each check ran at `a7c24bd` and again on the closure commits, with the same results:

- `npx jest --no-cache`: 228 suites / 2,722 tests / 2 snapshots passed.
- `npm run typecheck`: core, webview and extension clean.
- `npm run lint`: 0 errors / 1,030 warnings; `main` (`53ebaa6`) has 1,024. The six new warnings are `@typescript-eslint/naming-convention` hits that follow the repo's existing conventions: three `MessageType` members and three PascalCase components.
- `npm run build`: webpack and `verify:bundle` passed.
- `git diff --check`: clean.
- Markdown links: the archive move repointed 39 links, including the moved files' own outbound links. A resolving check over every Markdown file found no new dangling link.
- Manual Extension Development Host smoke: **not run yet.** Okey deferred it to the `main` build after the merge (2026-10-01). It gates the release, and it is the one unchecked criterion in this epic's README.

## Follow-ups retained outside this archive

- [Manual smoke on the `main` build](../../../tech-debt/2026-10-01-workshop-rewind-and-branch-main-smoke.md) (High, planned): the release gate.
- [Release preparation](../../../tech-debt/2026-10-01-workshop-rewind-and-branch-release-preparation.md) (Medium, blocked on the smoke): names the version and keeps the Git-sync upgrade warning.
- [Persistence coordinator ownership](../../../tech-debt/2026-10-01-workshop-persistence-coordinator-ownership.md) (Low, deferred).
- [The browser lists an unreadable session](../../../tech-debt/2026-10-01-workshop-browser-lists-unreadable-session.md) (Low, identified).
- [A real screenshot for the notice's Rewind and Branch page](../../../tech-debt/2026-10-01-workshop-rewind-and-branch-notice-screenshot.md) (Low, identified).
- Branch lineage (`branchedFrom`), in the parked [Branch Board](../../../features/feature-workshop-branch-board/README.md) feature.
- [Side Quests](../../../features/feature-workshop-side-quests/README.md) (planned), on Sprint 02's generic `rewindTo`.

Recorded in the ADR's [Follow-ups](../../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#follow-ups) but not scheduled: crossing standing-directive changes, and an optional verified backfill of marks for pre-baseline turns.

The detailed record lives in [`.memory-bank/20261001-1105-workshop-rewind-and-branch.md`](../../../../.memory-bank/20261001-1105-workshop-rewind-and-branch.md): what landed, the proof, the verification and the smoke checklist. Sprints 01 and 02 have their own entries: [marks](../../../../.memory-bank/20260930-1347-workshop-rewind-sprint-01-marks.md) and [Rewind](../../../../.memory-bank/20260930-1721-workshop-rewind-sprint-02-rewind.md).

## Historical docs

The README and sprint files in this folder are the original execution record. Their status lines are historical; prefer this note for the final state.
