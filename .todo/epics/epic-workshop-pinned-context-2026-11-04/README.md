# Epic: Workshop Pinned Context

**Status:** Slice 0 (spec) written, with six questions waiting on Okey. Code
slices are gated on Project Memory reaching `main` (see [Order](#order)).
**Priority:** Medium
**Created:** 2026-11-04
**Integration branch:** `epic-pinned-context`, cut from `main` at `24d9d6e`.
Each slice is built on its own branch,
`epic-pinned-context-slice-<N>-<slug>`, and merges into the epic through a
reviewed PR. The epic merges to `main` through one PR at the end.
**Decision:** [ADR 2026-11-04: Workshop Pinned Context](../../../docs/adr/2026-11-04-workshop-pinned-context.md) (Proposed)
**Design:** `docs/design/workshop-pinned-context/` (Slice 0d, not yet drawn).
It follows Project Memory's approved settings design (PR #196).

## Goal

The writer names the project files that every Workshop conversation should
start with, once, in a **Pinned context** tab in Conversation settings. After
that:

- the first room in the project starts with them;
- **New session** keeps what it carries today, re-reads the pinned files and
  adds any that are missing;
- **New session: full reset** clears the room, then attaches them;
- the context sheet marks which pills are pinned;
- nothing about how context reaches personas changes. Pinned files are
  ordinary attachments, under the same 100,000-word budget.

Okey's motivation: he attaches the same group of about ten files to nearly
every conversation through Choose from project, and wants to stop.

## Slices

| # | Slice | Outcome | Branch | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, this epic, slice docs 0d–5 | `epic-pinned-context` | Written; six questions open for Okey |
| 0d | Tab design | The Pinned context tab in every state, drawn on the real theme beside the Memory tab, for Okey's approval, then snapshotted | `…-slice-0d-tab-design` | Can start now ([doc](slice-0d-tab-design.md)) |
| 1 | Format and store | `WorkshopPinnedContextCodec` (format 1, pure) and `WorkshopPinnedContextStore` (claimed writes), with fixtures. No UI, no seeding | `…-slice-1-format-store` | Codec can start now. The store waits on `StoredFileClaims` on `main` ([doc](slice-1-format-and-store.md)) |
| 2 | Room seed | `WorkshopPinnedContextLibrary`, the `WorkshopRoomSeed` port, seeding on first room / New / full reset, the New result's report, the full reset's copy | `…-slice-2-room-seed` | Waits on 1 ([doc](slice-2-room-seed.md)) |
| 3 | Settings tab | `WorkshopPinnedContextHandler`, its messages, `useWorkshopPinnedContext`, and the panel: add from project, pin what's attached, attach missing, move, unpin, open | `…-slice-3-settings-tab` | Waits on 0d, 2, and 4a on `main` ([doc](slice-3-settings-tab.md)) |
| 4 | Context sheet marks | The derived pin mark and tooltip on pills. Pin and Unpin from a pill if question 6 says so | `…-slice-4-sheet-marks` | Waits on 3, and Wayfinding's context sheet on `main` ([doc](slice-4-context-sheet-marks.md)) |
| 5 | Verify live | Extension Development Host pass; ADR to Accepted; memory bank | — | Needs a human with VS Code ([doc](slice-5-verify-live.md)) |

## Order

**The gate is Project Memory on `main`.** Three things the code slices need
live on `epic/workshop-project-memory`, which is stacked on
`epic/workshop-wayfinding`, and none of them is on `main` yet:

- **Slice 4a's per-tab settings panels** (PR #193). On `main`,
  `WorkshopConversationBehaviorModal` is still one 587-line component. Adding
  a tab there would collide with the split.
- **`StoredFileClaims` / `StoredFileRewrite`,** the shared claimed-file
  primitive (memory Slice 1, PR #194). The store writes through it.
- **Wayfinding's context sheet** (`useWorkshopContextSheet`,
  `utils/workshop/contextSources.ts`). Slice 4 draws its mark there.

So:

1. **Now:** Slice 0 (this). Slice 0d, which is design work and touches no
   code. Slice 1's pure codec and its tests, which are new files only.
2. **When Project Memory merges to `main`,** `main` merges into
   `epic-pinned-context`, before anything else lands. Then Slice 1's store,
   then 2, then 3, then 4.
3. **If Okey wants it sooner,** the alternative is to re-cut the integration
   branch from `epic/workshop-project-memory`, and merge back the way that
   epic does. The cost is that this epic can't reach `main` before memory
   does. Okey decides.

Slices 2 and 3 don't overlap much: 2 is host-side (coordinator, session
message handler, the menu's copy), and 3 is the handler, hook and panel. Once
1 lands, 3's handler and hook can be built against 2's library interface in
parallel.

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

## Verification (every code slice)

- `npm run typecheck`
- `npm run lint`: no new errors; only new warnings count (the repo carries
  PascalCase `naming-convention` warnings).
- `npx jest`: the full suite passes. Record suite and test counts before and
  after in the slice doc.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines, and a touched file doesn't grow past 500.
  `WorkshopSessionPersistenceCoordinator.ts` (1,797) and
  `WorkshopSessionService.ts` (2,555) are already far past it. Slice 2 adds
  only the seed port's calls to them; the work lives in new modules.
- Fixtures and tests use *Alice* or made-up names, never a writer's text.
- Logs carry counts and categories, never file paths, names or contents.

## Decisions

None recorded yet. The ADR's six [open questions](../../../docs/adr/2026-11-04-workshop-pinned-context.md#open-questions)
are for Okey:

1. The tab's position (after About you, recommended).
2. Whether an ordinary New session tops up (yes, recommended).
3. Over budget: attach each file that fits, in order (recommended).
4. The bound: 20 files (recommended).
5. A third New item, "start without pinned context" (not in v1,
   recommended).
6. Pin and Unpin from a pill in Slice 4 (yes, recommended).

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
