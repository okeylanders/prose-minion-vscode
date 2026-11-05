# Epic: Workshop Bookmark Recall

**Status:** Slice 0 (spec) in review. The branch `epic/workshop-bookmark-recall` was cut from `epic-pinned-context` at `f298098` on 2026-11-05, after Pinned Context finished its code (Project Memory 6a–6c merged in at `b668782`). `main` was merged in for the Wayfinding close-out docs.
**Priority:** Medium
**Created:** 2026-11-05
**Integration branch:** `epic/workshop-bookmark-recall`. Each slice is built on its own branch, `epic/workshop-bookmark-recall-slice-<N>-<slug>`, and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-05: Bookmarks Personas Can Read, and a Bookmarks Screen](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md) (Proposed; Okey answered Q1–Q6 on 2026-11-05)
**Realizes:** [Bookmarks personas can read, and a Bookmarks screen](../../features/feature-workshop-bookmark-recall/README.md)
**Downstream of:** Wayfinding (on `main`), Project Memory, and Pinned Context. Fixes from those two epics' live passes are merged in as they land.

## Goal

Two outcomes:
- **For personas:** read the writer's bookmarks on request, in the open room and in saved sessions. That means a fast list, filtered by scope, session, date, text and speaker, with each bookmark's full message, plus marks on bookmarked turns in a read.
  - Okey's own use case is "can you see what I bookmarked in this session and propose any new memories?" A memory proposed that way cites the bookmarked turns (ADR D10).
- **For the writer:** one screen of every bookmark, with preview, Open, Open at bookmark, and "Remember this".

Every bookmark saved since Wayfinding reads unchanged.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, this epic, slice docs, open questions | All | In review |
| 1 | [Recall reads bookmarks](slice-1-recall-operation.md) | `transcript.bookmarks` end to end, the open room through a read-only live port, read marks, and the Wayfinding D10 pin rewritten | D1–D7 | Planned |
| 2 | [The Bookmarks screen](slice-2-bookmarks-screen.md) | Read-only browser across sessions: preview, Open, Open at bookmark | D8 | Planned |
| 3 | [Remember this, and proposals that cite bookmarks](slice-3-remember-this.md) | A saved bookmark becomes a memory citing its session and turn, and a persona's proposal cites the bookmarked turns | D9, D10 | Planned |
| 4 | [Verify live](slice-4-live-pass.md) | Extension Development Host pass; ADR → Accepted; memory bank | — | Pending (needs a human with VS Code) |

**Order:** 1 → 2 → 3.
- Slice 2 needs the recall document's bookmarks from Slice 1.
- Slice 3 builds on Slice 2's screen.

## How the slices are built

This is the same flow as Wayfinding, Project Memory and Pinned Context.

- **One implementation thread per slice.** It works on its slice branch, cut from the epic. It reads:
  - this README;
  - the ADR;
  - `AGENTS.md`, mainly Session Recall, Transcript Export and the presentation patterns;
  - its slice doc.

  Then it builds, verifies, commits and pushes. When the slice is done, it updates its slice doc and this README's progress notes, then stops.
- **The coordinating thread opens each slice's PR** into `epic/workshop-bookmark-recall` and watches it. Astra reviews each PR.
- **Findings are fixed on the slice branch**, and answered in the review's ledger.
- **Merging into the epic.** Once a PR is green and its findings are settled, the coordinator merges it into the epic with a merge commit and starts the next slice.
- **Merging to `main`.** The epic goes to `main` in one PR, after Project Memory and Pinned Context have merged to `main`.

## Verification (every slice)

- `npm run typecheck`
- `npm run lint`: no new errors. Only new warnings count.
- `npx jest`: the full suite passes. Record the counts in the progress notes. The baseline at `f298098` is 728 suites / 10,239 tests.
- `packages/core/src` has no `from 'vscode'`.
- **File size.**
  - No new file goes over 500 lines.
  - A file already over 500 lines grows only by the seam, that is, the calls into new modules. The files this applies to: `WorkshopApp.tsx` (1,828), `WorkshopSessionService.ts` (2,717), `WorkshopPersonaCapability.ts` (951) and `promptBudgets.ts` (791).
  - `recall/WorkshopTranscriptRecallCapability.ts` is at 496 lines, so it is split before it grows.
- **Personas and data.**
  - No bookmark reaches a persona except through recall (ADR D1).
  - The stored bookmark shape is unchanged. A session saved by the Wayfinding release reads unchanged (fixture).
- **Completion criteria** are each backed by a named test, or stated as covered by the Slice 4 live pass.

## Completion Criteria

- `transcript.bookmarks` returns bookmarks from the open room and saved sessions, with full messages, within stated bounds and with hints that decode as written.
  - Its filters are scope, session, recent, match, persona, query, speaker and the dates.
  - From the open room, a persona sees only bookmarks on turns it could see.
- `transcript.read` marks bookmarked turns. Export and the turn preview are unchanged.
- The Bookmarks screen lists every bookmark across saved sessions and the live room. It can preview, open the session, and jump to the turn.
- "Remember this" saves a saved session's bookmarked message as a memory, citing its session and turn.
- Bookmarks never enter a room frame, a catch-up or provider history. A persona reads them only on request.
- A persona's memory proposal from bookmarks cites the bookmarked turns, and the host checks every one.
- Every bookmark saved since Wayfinding reads unchanged.

## Close-out (with the final PR)

- Add a "Superseded in part by ADR 2026-11-05" line to ADR 2026-11-03's D5 and D10. That file lives on `main`; editing it now would cut across the downstream epics.
- Archive the feature note, and Wayfinding's epic and feature notes, once nothing downstream links to them. Fix the links in the same pass.
- Remind Okey about PR #205 (Workshop settings user-only) when this epic is done. It is still open into `main`, its tech-debt README conflicts with Wayfinding, and its new scope test will need a `proseMinion.workshop.projectMemory` row.

## Progress Notes

- **2026-11-05. Slice 0.**
  - Okey asked for this epic at the Wayfinding Slice 8 review, then said to branch it from Pinned Context once that epic finished development.
  - The branch was cut from `epic-pinned-context` at `f298098`.
  - A survey of the code (recall's `transcript.todos` template, Project Memory's D12 lists, its provenance, and the shared browser) shaped the ADR. It corrected three things in the feature note:
    - the call syntax is `<prose-minion-tool-call name="…">`;
    - the bounds belong in `PROMPT_BUDGETS.workshopTranscriptRecall`;
    - `<match>` and `<persona>` choose sessions, so bookmark filters need their own fields.
- **2026-11-05. Okey's answers to Q1–Q6.** All six are recorded in the ADR.
  - **Q1 changed the design.** The open room's bookmarks are visible to personas, on request, through `<scope>` and a read-only live port, filtered by what the asking persona could see. His use case added D10: a memory proposed from bookmarks cites them.
  - **Q4 is a follow-up.** Catalog counts went to [their own feature note](../../features/feature-workshop-recall-bookmark-counts/README.md).
  - **Q2, Q3, Q5 and Q6 stand as proposed.**
