# Epic: Workshop Wayfinding

**Status:** Slice 0 (spec) on `epic/workshop-wayfinding`, from `main` at `cfac12b` (v2.12.0). Okey approved starting on 2026-11-03 and confirmed D9 the same day. Slice 1 is in review as a PR into the epic.
**Priority:** Medium
**Created:** 2026-11-03
**Integration branch:** `epic/workshop-wayfinding`. Each slice is built on its own branch, `epic/workshop-wayfinding-slice-<N>-<slug>`, and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-03: Workshop Wayfinding](../../../docs/adr/2026-11-03-workshop-wayfinding.md) (Proposed)
**Design:** [`docs/design/workshop-wayfinding/`](../../../docs/design/workshop-wayfinding/README.md), a snapshot of the planning canvas
**Realizes:** [Two-Tab Rail](../../features/feature-workshop-rail-tabs/README.md), [Read-In Material](../../features/feature-workshop-rail-read-in/README.md), [Thread Bookmarks](../../features/feature-workshop-thread-bookmarks/README.md), [Model Slices](../../features/feature-workshop-model-slices/README.md)

## Goal

In a long Workshop session, the writer can find their way around:

- what the room is working on,
- what each persona read on its own,
- which replies they meant to come back to,
- and where the model changed.

```
┌ Material · 10 ┬ Notes  2 new ┐ │ ── SESSION RESUMED TUESDAY … AFTER 49H 6M ──
│ Excerpt  v3 · session live    │ You: Can you look at the lantern beat again?
│ Context  3 attachments        │ Jill: Right now her reaction lands…  [Bookmarked]
│ Read in  by Jill              │ ── MODEL · CLAUDE SONNET 5 → GPT-5 ──
│  ▸ notes/lantern-symbolism.md │ You: Try the beat from her father's side.
│    lines 1–64 · changed since │ Jill: From his side the lantern is an interruption…
│  ▸ Dialogue & Beats report    │
└───────────────────────────────┘ │ [Context] [Tools] [Widgets] … [Send]
```

## Decisions Taken From the Brainstorm

These were settled with Okey on 2026-10-27 and 2026-10-28, and are recorded in
the ADR:

- **Names:** Bookmarks (not pins), and the tabs Material and Notes.
- **Rail:** retire the Tools block. The composer's tool button covers it.
- **Badges:** an inactive tab badges whatever lands in it while it's hidden,
  whoever added it. There's no toast (ADR D1, amended 2026-11-03 to match the
  canvas, because every to-do today comes from a writer's click).
- **Reader:** the text sheet plus "Open beside" first. A docked reader is a
  follow-up.
- **Compatibility:** option A, forward-only (ADR D9). Okey confirmed it on
  2026-11-03.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, this epic, slice docs, design snapshot, feature notes linked | All | Done |
| 1 | [Rail tabs](slice-1-rail-tabs.md) | `WorkshopRail` with Material and Notes tabs, the Tools block retired, a Notes badge for to-dos added while it's hidden | D1 | In review (PR); built in `94d6b86`, `e188ea9` |
| 2 | [Read in and the reader](slice-2-read-in-and-reader.md) | The Read in block, badging Material while it's hidden; resource rows open in the reader sheet and beside the Workshop | D1, D2, D3, D4 (access) | Planned |
| 3 | [Read-in provenance](slice-3-read-in-provenance.md) | Rows record their card, line range, and fingerprint; jump to the card; "changed since" | D3, D4, D9 | Planned (D9 confirmed 2026-11-03) |
| 4 | [Bookmarks on the host](slice-4-bookmarks-host.md) | Bookmark ledger, routes, persistence, whole-room operations, export | D5, D6, D9, D10 | Planned |
| 5 | [Bookmarks in the rail and thread](slice-5-bookmarks-ui.md) | Bubble toggle, Notes list, rename, jump, out-of-window reader | D5, D6 | Planned |
| 6 | [Model stamps](slice-6-model-stamps.md) | Every reply records requested and served models | D7, D9 | Planned |
| 7 | [Model slices](slice-7-model-slices.md) | Derived slices in the thread and in export; served-by note | D8, D10 | Planned |
| 8 | Verify live | Extension Development Host pass; ADR → Accepted; feature notes archived; memory bank | — | Pending (needs a human with VS Code) |

**Order.** Two chains run side by side:

- **The rail chain, 1 → 2 → 3 → 4 → 5.** Slice 1 has no contract change, and
  every later rail slice renders inside its tabs. Slices 2 and 3 come before
  bookmarks because Slice 5's out-of-window reader reuses Slice 2's sheet mode.
- **The model chain, 6 → 7.** It doesn't depend on the rail, so Slice 6 starts
  while Slice 1 is in review. Slice 7 lands after Slice 5, because both change
  the bubble and the export.

## How the Slices Are Built

- **One implementation thread per slice.** It works on that slice's branch,
  `epic/workshop-wayfinding-slice-<N>-<slug>`, cut from the epic branch. It
  reads this README, the ADR, `AGENTS.md`, and its slice doc, then builds,
  verifies, commits, and pushes. When the slice is done, it updates the slice
  doc's status and the progress notes below, then stops.
- **The coordinating thread opens the PR** into `epic/workshop-wayfinding` and
  watches it. Astra reviews each PR automatically.
- **Findings are fixed on the slice branch**, as follow-up commits, and answered
  on their threads.
- **Merging:** once a PR is green and Astra's findings are settled, the
  coordinator merges it into the epic and starts the next slice in that chain.
- **To `main`:** the epic merges to `main` through one PR at the end, which
  carries the release review.

## Verification (every slice)

- `npm run typecheck`
- `npm run lint`: no new errors. The repo already carries PascalCase
  `naming-convention` warnings, so only new warnings count.
- `npx jest`: the full suite passes. Record the suite and test counts in the
  progress notes.
- `packages/core/src` has no `from 'vscode'` (the architecture tests guard
  this).
- No new file over 500 lines, and the files a slice touches don't grow past
  500 lines.
- The slice doc's completion criteria are checked off, each one backed by a test
  or stated as covered by the Slice 8 live pass.

## Completion Criteria

- The rail has Material and Notes tabs; the Tools block is gone; host-added
  to-dos badge the Notes tab; no tab switches by itself.
- The Read in block lists the chat target's fetched material. Each row opens in
  the reader, jumps to its card, or offers nothing, by an exhaustive switch.
- The reader marks the lines read and says when the file has changed. Open
  beside opens the configured file and nothing else.
- Bookmarks persist with the session, follow New, Open, Rewind, and Branch, list
  in thread order, rename, jump, and open in the reader when out of the window.
- Every reply records its requested and served models. Slices appear only for a
  same-scope change, in the thread and in export alike.
- Sessions without the new fields load and render unchanged (fixture tests).
- Nothing new reaches a persona's prompt.

## Progress Notes

- **2026-11-03. Slice 0.** Spec written from the four feature notes (captured
  2026-10-27) and the planning canvas. Findings that reshaped the notes:
  - The rail is now the shared `FullTabRail` (Lightbox epic), so the tabs live
    inside the Workshop's rail content and the shell doesn't change.
  - A manifest row's `artifactId` names message attachments, not capability
    cards. Jump-to-card needs a new `turnId` on the row (Slice 3).
  - The webview can read only attached files. Read-in resources need two new
    messages (Slice 2).
  - Dictionary history already records served models as `modelIds`; the model
    stamp follows that naming.
  - Baseline on `main` at `cfac12b`: typecheck clean; 591 suites / 8,398 tests
    / 59 snapshots, all passing.
- **2026-11-03. Flow change.** Okey asked for a PR per slice into the epic,
  reviewed by Astra, and confirmed D9. Slice 1 had been built straight onto the
  epic (`da7f28f`, `4a25d5c`, `bf0e0e6`). Those commits are reverted here
  (`6716f37`) and come back through Slice 1's PR. D1 is amended:
  - Every to-do today comes from the writer adding a finding
    (`addTodoFromFinding`), so "badge only what the host added" would badge
    nothing.
  - The canvas Okey approved badges whatever lands in a hidden tab, so that is
    the rule now, with no toast.
- **2026-11-03. Slice 1 (rail tabs).** Landed in `94d6b86` (the
  `useWorkshopRailTabs` controller) and `e188ea9` (`WorkshopRail`, the
  `WorkshopApp` rewire, the Tools block and its styles deleted). These are
  cherry-picks of `da7f28f` and `4a25d5c` on the PR branch.
  - **Counts.** Before, at `1f8becb8`: 591 suites / 8,398 tests / 59
    snapshots. After: 594 / 8,422 / 59, all passing. `npm run typecheck`
    clean. `npm run lint`: 0 errors; warnings 1,130 → 1,133, all three the
    PascalCase `naming-convention` kind (`WorkshopRail`, the test's
    `StatefulRail` and `PmLogo` mock). No `from 'vscode'` in core.
  - **Sizes.** `WorkshopApp.tsx` 1,743 → 1,671 (it was already over 500;
    [tech debt](../../tech-debt/2026-11-03-workshop-app-root-size.md)).
    `WorkshopRail.tsx` 158, `useWorkshopRailTabs.ts` 159. `styles/workshop/shell.css`
    is already 2,600+ lines; the slice doc put the tab rules there, so it grew
    by 23 net lines (tools rules out, tab rules in).
  - **Deviations.**
    - *Restoring the tab.* No sibling Workshop hook restores webview state, and
      a controller may not call `useVSCodeApi`. `WorkshopApp` reads the stored
      value with `usePersistedState` and passes it in as `initialTab`; the
      controller parses it (`parseWorkshopRailTab`).
    - *When a reload counts as seen.* The doc says "on mount", but the
      to-dos arrive with the first session snapshot, after mount. The
      controller takes a `roomKey` (`pending` until the session is ready,
      then `room:<roomRevision>`) and marks everything seen whenever it
      changes. That also keeps New, Open, Rewind and Branch from badging the
      room they bring in.
    - *Badge eligibility.* Built as open, not stale, and host-sourced
      (`isHostSourcedTodo`); the review fix drops the host-sourced check, per
      amended D1. Stale is excluded so the badge is never larger than the
      tab's open count.
    - *Accessible names.* Material is "Material, N items"; Notes is "Notes,
      N open" plus ", N new" (the doc's example omitted the open count).
    - *Copy.* The empty thread said "run a tool from the left"; it now says
      "run a tool below".
    - *No rail entry points yet.* D1's "select the tab first" rule has no
      caller today (nothing targets a rail panel); `selectTab` is the seam
      for Slices 2 and 5.
  - **Coordinator's answers (2026-11-03).**
    - *Badge vs. toast:* D1 is amended to the canvas's rule. An inactive tab
      badges whatever lands in it while hidden, whoever added it, and nothing
      toasts. `isHostSourcedTodo` goes, and any open, current to-do that
      arrives while Notes is hidden badges.
    - *`.pm-ws-block-grow`:* deleted. Nothing uses it, and the Read in block
      doesn't need to grow.
