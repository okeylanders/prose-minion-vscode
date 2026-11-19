# Workshop Persona Tools: all three items built; the live pass and the open decisions are Okey's

**Date:** 2026-11-19
**Epic:** [README](../.todo/epics/epic-workshop-persona-tools-2026-11-19/README.md) (active; not archived)
**Decision:** [ADR 2026-11-19](../docs/adr/2026-11-19-workshop-persona-tools.md) (D1–D28, with the review amendments D6a–D6e, D8a, D8b, D13a, D22a); amends [ADR 2026-11-05](../docs/adr/2026-11-05-helper-agent.md) D6
**Branch:** `epic/workshop-persona-tools`, cut from `main` at `478157d`. Slice 0, B, C1 and A merged at `b9b8d302`; C2 is PR #290, merged before the closing pass lands. The closing pass is `epic/workshop-persona-tools-close`. Nothing has gone to `main`.
**Next step:** Okey's [live pass](../.todo/epics/epic-workshop-persona-tools-2026-11-19/live-pass.md), which ends with the open decisions; then a PR from the epic to `main`.

## What shipped

Three medium features that let the Workshop's personas act for the writer. Each slice was a PR into the epic, reviewed by Astra, and merged with a merge commit.

| Slice | Item | What the writer gets | PR | Merged | Review |
|---|---|---|---|---|---|
| 0 | Spec | The ADR and the epic README | #286 | `bed0a836` | Four rounds. F-01 (named-session compare not atomic), F-02 (`saving` across a restart), F-03 (paragraph alignment unbounded), F-04 (failed search read as zero) → D6a, D8a, D13a, D22a; then a stalled writer, the shared `current.json` and transient Undo loss → D6b, D6c, D8b; then reusable owner paths and a recovery gap → D6d; then release moving a successor's lock and straddling reads → D6e (no automatic takeover). Approved at `c4cd8d7b` |
| B | B (#28) | `history.log` and `history.diff`: a file's commits and a prose-aware diff, through VS Code's Git extension | #287 | `b23719c6` | P1 literal pathspec; P2 one decoder; P2 size preflight; then P1 backslash names (`unaddressable`). All fixed |
| C1 | C (#26), Settings | "Suggest from my folders": names-only scan, the helper's `project-locations`, a review sheet, Apply at user level | #288 | `0e688c46` | P1 re-read value and level before each write; P2 overlap from effective patterns; P2 partial scans; then P2 an empty truncated scan (`scan-incomplete`). All fixed |
| A | A (#30) | A persona marks to-dos done or dismissed, here and in saved sessions, with a receipt and Undo; named sessions gain a lock and Recover… | #289 | `b9b8d302` | P1 keep copies on a failed rollback; P1 never drop the last readable prior; P1 receipt durable first; then P1 keep copies when the marker move fails. All fixed; the integration re-review (after B and C1 merged in) was clear |
| C2 | C (#26), persona | `locations.current`, `locations.folders`, `locations.check`, a proposal trailer and its card, Apply and Decline in the room | #290 | pending | In review at the time of writing |
| Close | | Live-pass checklist, `AGENTS.md`, this entry, tech debt | | pending | |

## Decisions

**Okey's:** T1 (apply at once, with Undo), G1 (no setting; available in any git repository), G2 (`diff`/jsdiff as a new runtime dependency of core, pinned at 9.0.0), G3 (authors shown to the persona, never logged), L1 (Apply writes at the user level), L2 (a persona path), L3 (no `locations.suggest`).

**Review amendments to the ADR (PR #286):**
- **D6a:** every named-session writer takes a per-file lock; of two overlapping writers exactly one commits, the other is `busy`.
- **D6b:** the lock is a directory, and the staged checkpoint lives inside it, so a stalled writer's publish finds no source.
- **D6c:** a refused room's work goes at once to its own "(local recovery)" session, never `current.json` (the workspace's, not the window's).
- **D6d:** every owner artifact under its own `<token>/` folder; destructive steps act only on what the owner detached.
- **D6e:** no automatic takeover. A lock past its lease is `recovery-required`; release deletes only token-named paths, then the directory non-recursively; "missing" is decided only under the lock; recovery is the writer's **Recover…**. Supersedes the takeover parts of D6b and D6d.
- **D8a:** an `operationId` on each row and in `closedBy`; reconciliation reads `applied` or `interrupted`, never replays.
- **D8b:** `unverified` (target unreadable) is not terminal and is reconciled again read-only.
- **D13a:** the paragraph alignment has its own ceilings (`alignParagraphs`, `paragraphEditLength`); past either, refused; a per-window cache so a continuation never realigns.
- **D22a:** `matchPatterns` reports `incomplete` apart from `unmatched`; such a group is left unchanged at review and Apply.

**Deviations the slices reported** are rows 52–70 of the README's "Defaults taken". The ones worth remembering: the to-do port is its own class (`WorkshopSavedSessionTodoStore`); `receipt-not-saved`; an unknown-name read answers "not found, try again" (`WorkshopNamedSessionUnconfirmedError`), never missing; recovery copies keyed by lock token; `show` returns bytes, decoded strict UTF-8, with `size` added for a preflight; `unaddressable`; full commit ids in continuations; Apply's `matches-changed`, `unchanged` and `scan-incomplete`; C2's `incomplete` outcome count.

Every other default was the orchestrator's and is Okey's to overturn. Q1–Q4 stay open.

## What the closing pass found

- **`AGENTS.md` had none of the epic.** Only two message-tree lines had been added. New sections: Workshop To-do Status (with the named-session lock), Workshop File History, Context Path Suggestions and the `locations.*` Family. The trees, the Platform port list, the domain-mirroring table and the route-owner count (24 → 25, `WorkshopLocationsProposalHandler`) were updated, and the Trailer Outcomes and Helper Agent sections point to the new kinds and task.
- **The Lightbox passage linear-time test failed CI twice** (#286 at `1e024cdb`, #289 at `5a4b81f5`), both on unrelated heads, passing on re-run. Two Low notes on the same test already existed (2026-11-03, 2026-11-05); a Medium one supersedes them.
- **One planned guard is missing.** ADR D6a says `boundaries.test.ts` holds that only the store renames over a named session file. No such check exists (the lock has its own tests: `WorkshopNamedSessionLock.test.ts`, `WorkshopNamedSessionOverlappingWrites.test.ts`). `AGENTS.md` says so; adding it is a small follow-up.
- **"Checked from memory"** items (Git API at the 1.82 floor, the `:(literal)` pathspec through `log`, the "Path not known by git" wording, multi-window and crash behavior, the sheet's look, a real helper call) are each a step in the live pass.

## Verification

- Full `npx jest --maxWorkers=50%` on the epic at `b9b8d302` (before C2) plus documentation only: **962 suites / 13,643 tests / 59 snapshots**, all passing.
- The same run with PR #290 (C2, head `f299273a`) merged in, as the epic will stand: **966 suites / 13,690 tests / 59 snapshots**, all passing. This is the `AGENTS.md` inventory.
- Each slice's PR records typecheck clean, lint 0 errors, no `from 'vscode'` in core, no new file over 500 lines.
- No live model call, no Extension Development Host, no second window: that is the live pass.

## Follow-ups

- **Okey:** the [live pass](../.todo/epics/epic-workshop-persona-tools-2026-11-19/live-pass.md) and its 10 open decisions (Q1–Q4; the "not found, try again" wording; an unreadable recovery copy with no in-app way out; "More commits follow" without a count; `textconv` inside a blob read; Apply's `matches-changed`; C2's prompt order).
- Tech debt: [the shared stored-file rewrite's stalled writer](../.todo/tech-debt/2026-11-19-stored-file-rewrite-stalled-writer-fence.md) (Medium), [the Lightbox passages wall-clock test](../.todo/tech-debt/2026-11-19-lightbox-passages-wall-clock-test.md) (Medium).
- Out of v1, still in their notes: `history.read` and the Lightbox's "compare with an earlier commit" ([git history](../.todo/features/feature-workshop-file-git-history/README.md)); a workspace-level context-path write ([context paths](../.todo/features/feature-helper-project-locations/README.md)).
- After the live pass: the PR to `main`, then archive the epic and its three source notes, and release.
