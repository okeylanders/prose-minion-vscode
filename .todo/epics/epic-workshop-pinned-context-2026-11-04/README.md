# Epic: Workshop Pinned Context

**Status:** Coding. The spec is done, with all six questions decided, and
Okey approved the design on 2026-11-05. Project Memory was merged in at
`17d52cf`, and Slices 1 and 2a are building in parallel (see
[Threads](#threads)).
**Priority:** Medium
**Created:** 2026-11-04
**Integration branch:** `epic-pinned-context`, cut from `main` at `24d9d6e`.
- **Docs and design go straight on this branch.** That covers the spec, the
  slice docs and the design snapshot. They get no slice branch, and no work
  for this epic goes on a generated (`claude/…`) branch.
- **Code slices** are built on named branches,
  `epic-pinned-context-slice-<N>-<slug>`, and merge in through reviewed PRs.
- **Before the first code slice,** `main` merges in if Project Memory has
  reached it; otherwise `epic/workshop-project-memory` does.
- **The epic merges to `main`** through one PR at the end.

**Decision:** [ADR 2026-11-04: Workshop Pinned Context](../../../docs/adr/2026-11-04-workshop-pinned-context.md) (Proposed; all questions decided; Accepted after Slice 5)
**Design:** [`docs/design/workshop-pinned-context/`](../../../docs/design/workshop-pinned-context/README.md)
(canvas https://claude.ai/artifact/2dZHup6uEFKQML17dJeZqz). **Approved by
Okey on 2026-11-05.** It follows Project Memory's approved settings design.

## Goal

The writer names the project files that every Workshop conversation should
start with, once, in a **Pinned context** tab in Conversation settings. After
that:

- the first room in the project starts with them;
- **New session** keeps what it carries today, re-reads the pinned files and
  adds any that are missing;
- **New session: full reset** clears the room, then attaches them;
- **New session: full reset, empty context** clears the room and attaches
  nothing;
- the context sheet marks which pills are pinned;
- nothing about how context reaches personas changes. Pinned files are
  ordinary attachments, under the same 100,000-word budget.

Okey's motivation: he attaches the same group of about ten files to nearly
every conversation through Choose from project, and wants to stop.

## Slices

| # | Slice | Outcome | Branch | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, this epic, slice docs 0d–5 | `epic-pinned-context` | Done; all six questions decided |
| 0d | Tab design | The Pinned context tab in every state, drawn on the real theme beside the Memory tab, then snapshotted | `epic-pinned-context` | Done: approved by Okey on 2026-11-05 (13 artboards; [doc](slice-0d-tab-design.md)) |
| 1 | Format and store | Shared types and bound, `WorkshopPinnedContextCodec` (format 1, pure) and `WorkshopPinnedContextStore` (claimed writes, workspace identity), with fixtures. No UI, no seeding | `epic-pinned-context-slice-1-format-store` | Built; PR #204 in Astra's review ([doc](slice-1-format-and-store.md)) |
| 2a | Starts and seed port | `start: 'carry' \| 'full-reset' \| 'empty'`, the `WorkshopRoomSeed` port and its calls, `WORKSHOP_NO_ROOM_SEED`, the menu's empty-context item behind `pinnedFileCount` | `epic-pinned-context-slice-2a-starts-seed-port` | **Merged** (#203, `d356d38`) after Astra's review (F01 fixed and cleared) ([doc](slice-2a-starts-and-seed-port.md)) |
| 2b | Room seed | The match rule, `WorkshopPinnedContextLibrary`, the real seed, the result lines' report | `epic-pinned-context-slice-2b-room-seed` | Built; reviewed; its PR follows #204 ([doc](slice-2b-room-seed.md)) |
| 3 | Settings tab | `WorkshopPinnedContextHandler`, its messages, `useWorkshopPinnedContext`, and the panel: add from project, pin what's attached, attach missing, move, unpin, open; the menu's count | `epic-pinned-context-slice-3-settings-tab` | Building, on a branch carrying 2b ([doc](slice-3-settings-tab.md)) |
| 4 | Context sheet marks | The derived pin mark and tooltip on pills, and Pin from a pill | `epic-pinned-context-slice-4-sheet-marks` | Waits on 3 ([doc](slice-4-context-sheet-marks.md)) |
| 5 | Verify live | Extension Development Host pass; ADR to Accepted; memory bank | — | Needs a human with VS Code ([doc](slice-5-verify-live.md)) |

## Order

**The gate is met.** Okey decided the base on 2026-11-04: merge Project
Memory in before coding begins. `epic/workshop-project-memory` was
code-complete at `0a0f1a5` (only its Slice 6 live pass remains) and carries
Wayfinding and `main`. It was merged into this epic as `17d52cf` on
2026-11-05, with no conflicts. That brought what the code slices need:

- Slice 4a's per-tab settings panels (`WORKSHOP_CONVERSATION_SETTINGS_TABS`);
- `StoredFileClaims` / `StoredFileRewrite`;
- `ProjectMemoryWorkspaceIdentity`;
- Wayfinding's context sheet.

Fixes from memory's live pass land on `epic/workshop-project-memory`. The
coordinator merges them in as they come. Because memory merged in before it
reached `main`, this epic's final PR waits for memory's.

**Order of the code slices:**

1. **Slices 1 and 2a, in parallel.** 1 writes `infrastructure/storage/`, the
   shared types and the bound. 2a writes the reset contract, the
   coordinator's port calls and the menu. Neither touches the other's files.
2. **Slice 2b,** once both have merged. It needs 1's store and 2a's port.
3. **Slice 3,** once 2b has merged. It needs 2b's library and match rule.
4. **Slice 4,** once 3 has merged. It needs 3's hook and pin route.
5. **Slice 5,** Okey's live pass.

Line references in the ADR are to `main` at `24d9d6e`. Since the merge, some
have moved; find the symbol rather than the line. For example, the reset
payload is now at `session.ts:720`.

## Threads

The coordinator is `session_01UrwcesKuKZcn9d7YRCX5cY`. Each slice thread is
a Claude Code session tagged `pinned-context`, titled
"Pinned context · Slice *N* · *slug*", and it pushes only to its slice
branch.

| Slice | Session | Branch | Started | State |
|---|---|---|---|---|
| 1 | [`session_01UrwcevSE9xCeoMqBXf9P73`](https://claude.ai/code/session_01UrwcevSE9xCeoMqBXf9P73) | `epic-pinned-context-slice-1-format-store` | 2026-11-05, from `b94fc67` | PR #204: Astra found F-01–F-03 and N-01 at `182fcd1`; fixed at `52da65e` (per-list lock, preserving leftovers, NTFS-style key, C1 controls); waits on re-review |
| 2a | [`session_01UrwcerFSuu47ewLKUezS45`](https://claude.ai/code/session_01UrwcerFSuu47ewLKUezS45) | `epic-pinned-context-slice-2a-starts-seed-port` | 2026-11-05, from `b94fc67` | Merged: PR #203 at `d356d38`. Astra found F01 (no workspace check after the seed's `prepare`), fixed at `db93354`, cleared at `d9c536e` |
| 2b | [`session_01UrwcetPHzVLFpo6ZCkjf1A`](https://claude.ai/code/session_01UrwcetPHzVLFpo6ZCkjf1A) | `epic-pinned-context-slice-2b-room-seed` | 2026-11-05, from `c35c281` (the epic at `94a33df` with Slices 1 and 2a merged in; 696 suites / 9,820 tests green) | Built at `e36526b` (702 / 9,902 green); reviewed; one fix requested (a kept re-read must not read as "not attached"); its PR follows #204 |
| 3 | [`session_01Urwcevx3JATnaqRCJbE4Yb`](https://claude.ai/code/session_01Urwcevx3JATnaqRCJbE4Yb) | `epic-pinned-context-slice-3-settings-tab` | 2026-11-05, from `51b4988` (2b at `e36526b` with the epic merged in) | Building |

## How the Slices Are Built

Project Memory's process, unchanged:

- **One thread per slice,** on that slice's branch, cut from this epic
  branch. It reads this README, the ADR, `AGENTS.md`, and its slice doc,
  then builds, verifies, commits and pushes.
- **Progress goes in the slice's own doc,** never in this README, so
  parallel threads never conflict here. The coordinating thread copies it
  into the progress notes below.
- **Threads leave `AGENTS.md` alone.** The coordinator updates its tree and
  inventory when slices merge. That includes a short **Workshop Pinned
  Context** rules section, written from the ADR, when Slice 3 merges.
- **The coordinating thread opens each PR** into `epic-pinned-context` and
  watches it. Findings are fixed on the slice branch as follow-up commits.
- **Astra reviews; the coordinator merges after Astra approves** (Okey,
  2026-11-05).
  - Astra's review arrives as a report committed to the PR branch,
    `docs/pr-reviews/pr-<N>-<slug>-review.md`, as on the Project Memory
    PRs. It isn't a GitHub review.
  - Findings (F01, N01, …) go to the slice's thread to fix on its branch.
    The coordinator answers each one on the PR and keeps a resolution
    ledger in the report's PR.
  - The coordinator merges only when the report's current verdict is a
    **written approval** that names the PR's head, or a head whose later
    commits touch docs only. A merge is a merge commit, "Merge Workshop
    Pinned Context Slice *N*: … (#PR)", as the memory epic's are.

## Verification (every code slice)

- `npm run typecheck`
- `npm run lint`: no new errors; only new warnings count (the repo carries
  PascalCase `naming-convention` warnings).
- `npx jest`: the full suite passes. Record suite and test counts before and
  after in the slice doc.
- **Baseline after the merge** (`17d52cf`, 2026-11-05, Node 22):
  - `npm run typecheck` passes;
  - `npx jest`: 691 suites / 9,696 tests / 59 snapshots, all passing;
  - `npm run lint`: 0 errors / 1,165 warnings.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines, and a touched file doesn't grow past 500.
  `WorkshopSessionPersistenceCoordinator.ts` (1,797) and
  `WorkshopSessionService.ts` (2,704 since the merge) are already far past
  it. Slice 2a adds only the seed port's calls to the coordinator; the work
  lives in new modules. `WorkshopApp.tsx`, `useWorkshopRoom.ts`,
  `WorkshopRoomHandler.ts` and `session.ts` are past it too: new code goes
  in sibling modules, as the memory slices did.
- Fixtures and tests use *Alice* or made-up names, never a writer's text.
- Logs carry counts and categories, never file paths, names or contents.

## Decisions

**Branch and base (Okey, 2026-11-04).** Everything goes on
`epic-pinned-context`. Before coding, `main` merges in if Project Memory has
landed there, otherwise the memory epic branch does (see
[Order](#order)).

**An empty-context New (Okey, 2026-11-04; ADR question 5).** The sessions
menu gains **New session: full reset, empty context**. It starts a new
conversation with the working set cleared and no pinned context. It shows
only while something is pinned. The reset payload's `clearWorkingSet` flag
becomes `start: 'carry' | 'full-reset' | 'empty'` (ADR D2). Slice 2a builds
it.

**A template well heads the tab (Okey, 2026-11-04).** It explains that
pinned context is a starting template, and that each conversation's context
stays its own and is changed in its Context panel (ADR D8). Slice 3 builds
it from the design.

**The design, and the other five questions (Okey, 2026-11-05).** Okey
approved the third pass and asked for coding to begin. The approved design
draws the recommended answer to each remaining question, so the ADR records
them as [decided](../../../docs/adr/2026-11-04-workshop-pinned-context.md#decided-questions):

1. the tab sits after About you;
2. an ordinary New session tops up;
3. over budget, each file that fits attaches, in order;
4. the bound is 20 files, tuned in Slice 5;
6. Pin from a pill, as drawn; unpinning stays in the tab.

**Merge, then code (Okey, 2026-11-05).** Project Memory merged in (see
[Order](#order)), with its two lessons folded into the ADR: a write belongs
to the workspace it was asked in (D5), and memory's frame still ends the
first message (D3).

### Direction relayed from the Project Memory thread (2026-11-04)

The Project Memory coordinator thread relayed two of Okey's directions while
this spec was being written. This thread could check only the second one in
the repo:

- **The list lives in a project file, not VS Code settings.** The ADR
  reached the same answer on its own evidence (D5, fact 7). Okey confirms
  it when he answers the questions above.
- **The name stays "Pinned context".** Project Memory renames its own "pin"
  in the UI to "Always load in full" to leave the word to this feature. This
  is recorded on PR #196's branch at `aa89e2e`
  (`slice-0d-settings-design.md`, decision 16).

## Progress Notes

- **2026-11-04. Epic opened.** Okey asked for a plan, with docs on a branch
  off `main` named `epic-pinned-context`. This thread read the Workshop's
  context path on `main` and Project Memory's ADR, epic and approved
  settings design (PR #196). It wrote the ADR (Proposed, D1–D9, six open
  questions), this README, and slice docs 0d–5. No production code changed.
- **2026-11-04. Branch and base decided** (Okey):
  - all docs and design work for this epic go on `epic-pinned-context`,
    never a generated `claude/…` branch;
  - before coding, `main` merges in if memory has landed there, otherwise
    the memory epic branch does.
- **2026-11-04. Slice 0d first pass.**
  - The canvas has 12 artboards:
    - the tab in 9 states;
    - the picker in pin mode, and the picker refusing a pin;
    - a Workshop board with the pill mark, the full reset's subtitle and
      the New result.
  - It reuses the approved Memory design's dialog shell by value, and is
    snapshotted in `docs/design/workshop-pinned-context/`.
  - Found while drawing: the `pin` glyph is already on the excerpt's
    "Re-pin" button and marks a Lightbox tile among a message's
    attachments. ADR D1 is corrected, and the glyph is now a question for
    Okey (0d question 3).
- **2026-11-04. Okey's first design notes.**
  - The tab needs to explain that pinned context is a template, and that
    each conversation's context is still managed in its own panel. A
    template well now heads the tab (ADR D8).
  - Add a **Full reset, empty context** New. It decides ADR question 5 as
    yes (ADR D2, D7). The reset payload becomes
    `start: 'carry' | 'full-reset' | 'empty'`.
  - Drawn as Slice 0d's second pass and snapshotted. Slice 2's doc gains the
    payload change, the menu item and their tests; Slice 5 gains a live
    check.
- **2026-11-04. Okey's second design notes** ("This looks good"):
  - the file list moves into a scrollable well, so the dialog doesn't grow
    with it;
  - the template note collapses, starting open. The choice is remembered
    as the hook's one UI preference (ADR D8, D9).

  Drawn as 0d's third pass, with a Collapsed board (13 in all), and
  snapshotted. Slice 3's doc gains the preference and its tests. Waiting on
  Okey's approval.
