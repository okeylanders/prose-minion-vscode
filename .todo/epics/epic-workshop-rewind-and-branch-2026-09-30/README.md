# Epic: Workshop Rewind and Branch

**Created:** 2026-09-30
**Status:** In progress — Sprint 01 (retained-history marks) complete and merged into the integration branch ([PR #117](https://github.com/okeylanders/prose-minion-vscode/pull/117)); Sprint 02 (Rewind) in progress on `sprint/workshop-rewind-and-branch-02-rewind`. ADR amended with Sprint 01's findings and Sprint 02's kickoff decisions
**Priority:** High
**Integration branch:** `epic/workshop-rewind-and-branch` (cut from `main`)
**Decision:** [ADR 2026-09-30 — Workshop Rewind and Branch](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md)

## Problem

A Workshop conversation can only grow. Writers who want to take a different turn have two options today: start a new session from scratch, or keep going in a room whose later exchanges no longer serve them. Neither lets them return to a good moment and try again, or keep a promising thread while exploring an alternative.

## Goal

Add two actions to the bottom of eligible writer and agent bubbles:

- **Rewind to here.** Return the room, and every participant's memory, to that point and remove everything after it. On a writer bubble, this removes the message and puts it back in the composer for editing.
- **Branch from here.** From a saved session, open a new named session that starts at exactly that point. The source session is untouched. An unsaved room gets a popup asking the writer to save first.

## Why this is an epic, not two buttons

The visible ledger and each participant's retained LLM history are separate ordered records with no shared index. Rewind is the first operation that has to cut both at the same moment. The ADR introduces **retained-history marks** to record where each history stood after each commit. It then applies one pure transform over the persisted session shape and installs the result through the proven Open path.

## Decisions (proposed; confirm at kickoff)

| # | Decision | Default |
|---|---|---|
| D1 | Writer-bubble semantics | Rewind/Branch to *before* the message; its text and one-shot attachments return to the composer |
| D2 | Branching from an unnamed room | Not allowed: a popup explains the session must be saved first and offers "Save session…" (opens the Save modal); the writer then clicks Branch again. The host also refuses. **Confirmed 2026-09-30.** |
| D3 | Branch title | `"<source title> — branch"`, renamable afterwards |
| D4 | Confirmation | Rewind confirms and states how many turns go and that the excerpt and context stay current; Branch does not confirm (non-destructive) |
| D5 | Legacy sessions | Exact from the reopen point onward (baseline marks); earlier turns show a disabled action with a reason; no backfill heuristic |
| D6 | Standing prose directives | Rewind/Branch cannot cross the latest directive change in v1 |
| D7 | Persistence unavailable (no or multi-root workspace) | Rewind follows New-session availability; Branch is disabled with a reason |

## Locked invariants

1. `packages/core` imports no `vscode`. All logic lives in core; the adapter changes only if a command is added.
2. Participant histories are cut only at recorded marks. No provider message format is ever parsed to find a cut.
3. Cuts happen only at real historical rest points: after a committed reply, or immediately before a writer message.
4. Id counters are never lowered, and model-visible ids (`ta-N`, `pd-N`, `art-N`) never recur.
5. Rewind and Branch never run during an active run or a pending session operation. The host re-checks rewindability; webview gating is advisory.
6. Marks are host-private and never cross into the webview. The webview receives only a per-turn display flag and reason.
7. Any failure restores the prior room through `restoreRollback`. A bad mark degrades rewindability, never a session open.
8. Branch never modifies the source session file.

## Delivery sequence

| Sprint | Branch | Purpose | Exit |
|---:|---|---|---|
| [01](sprints/01-retained-history-marks.md) | `sprint/workshop-rewind-and-branch-01-marks` | Record, prune, baseline, persist and validate retained-history marks; publish per-turn rewindability | Marks are exact for scripted rooms across every commit type and survive save/open; no UI yet |
| [02](sprints/02-rewind.md) | `sprint/workshop-rewind-and-branch-02-rewind` | Pure rewind transform, coordinator Rewind operation, route and contract, bubble actions, confirm, composer restore | Rewinding to any rest point reproduces that point's recorded room (the equivalence oracle) and the writer can use it end to end |
| [03](sprints/03-branch-and-release.md) | `sprint/workshop-rewind-and-branch-03-branch` | Branch operation, saved-source requirement, Branch action, docs and release readiness | Branch from a named room opens an exact cut copy while the source survives; unnamed rooms get the save-first popup; full gates green |

Each sprint branch is cut from the integration branch and merged back through its own PR. **Decided 2026-09-30 (Okey): the epic merges to `main` as one unit.** Sprint 01 would have been safe to merge alone, because marks accrue silently, but it stays on the integration branch until Rewind and Branch ship together.

## Epic completion criteria

- [ ] ADR accepted; D1–D7 confirmed or revised in the ADR.
- [x] Marks recorded at every retained-history commit, guarded by an architecture test.
- [x] Marks pruned on every conversation discard; baseline marks recorded on hydration.
- [ ] Per-turn rewindability computed host-side and rendered, never re-derived, by the webview.
- [ ] Rewind reproduces recorded rest-point state for host, guest, sidecar, capability, widget, to-do, excerpt-revision and context-change scenarios.
- [ ] Writer-bubble rewind restores composer text and one-shot attachments.
- [ ] Branch works from named rooms and the source session file is byte-unchanged; unnamed rooms show the save-first popup and the host refuses them.
- [ ] Rollback proven for failures injected at transform, import, hydrate and write.
- [ ] Focused tests, full Jest, all TypeScript projects, ESLint, production build and `git diff --check` pass.
- [ ] Manual Extension Development Host smoke recorded (see Sprint 03).
- [ ] Memory-bank completion entry; parked Branch Board feature updated with lineage follow-up.

## Adjacent feature: Side Quests

[Side Quests](../../features/feature-workshop-side-quests/README.md) are automated rewind: Start pins the current point and End rewinds to it. This epic lays only the foundation. Sprint 01 separates "valid cut point" from bubble eligibility, and Sprint 02 adds the generic `rewindTo(cut, { origin })` operation and a cut summary. No Side Quest state, divider types or UI ship here.

## Out of scope

- Rewinding the working set (excerpt text, context bodies, to-do statuses).
- Crossing standing-directive changes.
- Backfilling marks for turns before a legacy session's reopen point.
- Branch lineage metadata, branch comparison, and the Branch Board.
- Rewind in the sidebar Assistant (non-Workshop) tools.
