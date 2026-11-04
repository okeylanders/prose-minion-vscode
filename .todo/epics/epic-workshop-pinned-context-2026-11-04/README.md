# Epic: Workshop Pinned Context

**Status:** Slice 0 (spec) written, with five questions waiting on Okey.
Slice 0d (tab design): second pass drawn after Okey's first notes, waiting
on his review. Code
slices are gated on Project Memory reaching `main` (see [Order](#order)).
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

**Decision:** [ADR 2026-11-04: Workshop Pinned Context](../../../docs/adr/2026-11-04-workshop-pinned-context.md) (Proposed)
**Design:** [`docs/design/workshop-pinned-context/`](../../../docs/design/workshop-pinned-context/README.md)
(canvas https://claude.ai/artifact/2dZHup6uEFKQML17dJeZqz). First pass,
not yet approved. It follows Project Memory's approved settings design
(PR #196).

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
| 0 | Spec | ADR, this epic, slice docs 0d–5 | `epic-pinned-context` | Written; five questions open for Okey |
| 0d | Tab design | The Pinned context tab in every state, drawn on the real theme beside the Memory tab, for Okey's approval, then snapshotted | `epic-pinned-context` | Second pass drawn (12 artboards), waiting on Okey ([doc](slice-0d-tab-design.md)) |
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
2. **Before coding begins** (Okey's decision, 2026-11-04): if Project Memory
   has merged to `main`, `main` merges into `epic-pinned-context`.
   Otherwise `epic/workshop-project-memory` merges in. The branch is not
   re-cut. Then Slice 1's store, then 2, then 3, then 4.
3. **If memory merges in before it reaches `main`,** this epic can't reach
   `main` before memory does. Its final PR waits for memory's.

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

**Branch and base (Okey, 2026-11-04).** Everything goes on
`epic-pinned-context`. Before coding, `main` merges in if Project Memory has
landed there, otherwise the memory epic branch does (see
[Order](#order)).

**An empty-context New (Okey, 2026-11-04; ADR question 5).** The sessions
menu gains **New session: full reset, empty context**. It starts a new
conversation with the working set cleared and no pinned context. It shows
only while something is pinned. The reset payload's `clearWorkingSet` flag
becomes `start: 'carry' | 'full-reset' | 'empty'` (ADR D2). Slice 2 builds
it.

**A template well heads the tab (Okey, 2026-11-04).** It explains that
pinned context is a starting template, and that each conversation's context
stays its own and is changed in its Context panel (ADR D8). Slice 3 builds
it from the design.

Of the ADR's [open questions](../../../docs/adr/2026-11-04-workshop-pinned-context.md#open-questions),
five are still for Okey:

1. The tab's position (after About you, recommended).
2. Whether an ordinary New session tops up (yes, recommended).
3. Over budget: attach each file that fits, in order (recommended).
4. The bound: 20 files (recommended).
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
