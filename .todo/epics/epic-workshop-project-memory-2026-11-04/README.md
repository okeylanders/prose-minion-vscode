# Epic: Workshop Project Memory

**Status:** Slice 0 in review (PR #192, waiting on Okey's six answers).
Slice 1 in review (PR #194). Slice 4a in review (PR #193). Slice 0d (settings
design) is with Okey.
**Priority:** Medium
**Created:** 2026-11-04
**Integration branch:** `epic/workshop-project-memory`, cut from
`epic/workshop-wayfinding` at `6c12df5` (its Slice 7 merge, code-complete;
Slice 8's live pass is docs only), with `main` at `24d9d6e` merged in
(`4280ef2`) for the feature note. When Wayfinding reaches `main`, `main`
merges into this epic again before anything else lands. Each slice is built
on its own branch, `epic/workshop-project-memory-slice-<N>-<slug>`, and merges
into the epic through a reviewed PR.
**Decision:** ADR 2026-11-04: Workshop Project Memory (Proposed; in PR #192)
**Design:** `docs/design/workshop-project-memory/` (Slice 0, not yet
captured)
**Realizes:** [Workshop Project Memory](../../features/feature-workshop-project-memory/README.md)

## Goal

A Workshop persona in any new room knows the project's standing decisions
without being told again:

- the writer turns memory on in Conversation settings;
- a persona proposes a memory, or the writer asks for one, and the writer
  decides whether it is saved;
- every later room starts with a bounded catalog of the project's memories,
  and a persona reads any memory in full on request.

The feature note holds the design this epic starts from: one Markdown file
per memory with frontmatter as the only truth, a derived catalog frame and
`INDEX.md`, the reserved `memory.*` family (read-only), proposals as a reply
trailer, and three modes (Off, Ask first, Save and tell me).

## Slices

| # | Slice | Outcome | Branch | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, slice docs 2–6, open questions put to Okey | `…-slice-0-spec` | In review: PR #192 (green; merges after Okey's answers) |
| 0d | Settings design | The Memory tab and the memory manager designed for Okey's review, then snapshotted under `docs/design/` | `…-slice-0-design` | With Okey: first canvas published |
| 1 | Store and codec | Format 1 codec (pure), `ProjectMemoryStore` on the shared `StoredFileClaims` primitive, fixtures. No model, no UI | `…-slice-1-store` | In review: PR #194 (merges after #192) |
| 2 | Read path | The catalog frame at a room's first turn, `memory.catalog` / `search` / `read`, every list that widens with the family | — | Waits on Slice 0 and 1 |
| 3 | Write path | Proposal trailer, card on the bubble, receipt turns, supersession, "Save to memory…" | — | Waits on Slice 2 |
| 4a | Settings panels | `WorkshopConversationBehaviorModal` split into one component per tab, behavior and markup unchanged | `…-slice-4a-settings-panels` | In review: PR #193 (green) |
| 4b | Memory tab and manager | The approved design built on 4a, wired to the host | — | Waits on 0d, 4a, Slice 2 |
| 5 | Save and tell me | Automatic saves, caps, the web-research hold, derived `INDEX.md` | — | Waits on Slice 3 |
| 6 | Verify live | Extension Development Host pass; ADR → Accepted; feature note archived; memory bank | — | Needs a human with VS Code |

**Order.** Slices 0, 0d, 1 and 4a start together on 2026-11-04. They touch
different files: Slice 0 writes docs, 0d works in a design artifact and then
`docs/design/`, 1 writes `infrastructure/storage/` and its tests, and 4a
refactors one webview component. Slice 1 builds from the feature note's
format section. Where the ADR decides otherwise, Slice 1 follows the ADR
before its PR merges.

## How the Slices Are Built

The Wayfinding epic's process, unchanged:

- **One thread per slice,** on that slice's branch, cut from this epic
  branch. It reads this README, the feature note, the ADR once it exists,
  `AGENTS.md`, and its slice doc, then builds, verifies, commits and pushes.
- **Progress goes in the slice's own doc** (`slice-<N>-<slug>.md` in this
  folder), never in this README, so parallel threads never conflict here.
  The coordinating thread copies it into the progress notes below.
- **Threads leave `AGENTS.md` alone.** The coordinator updates its tree and
  inventory when slices merge.
- **The coordinating thread opens the PR** into `epic/workshop-project-memory`
  and watches it. Findings are fixed on the slice branch as follow-up
  commits, and answered on their threads.
- **To `main`:** the epic merges to `main` through one PR at the end, which
  carries the release review.

## Verification (every code slice)

- `npm run typecheck`
- `npm run lint`: no new errors; only new warnings count (the repo carries
  PascalCase `naming-convention` warnings).
- `npx jest`: the full suite passes. Record suite and test counts before and
  after in the slice doc. Last recorded on the base: 636 suites / 8,977 tests
  / 59 snapshots (Wayfinding Slice 7, `a78afa6`).
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines, and a touched file does not grow past 500.
- Fixtures and tests use *Alice* or made-up names, never a writer's text.

## Open Questions for Okey

From the feature note; Slice 0 puts each to Okey with a recommendation:

1. Memory's mode per project (widen `SettingsStore.update` with a target) or
   global with per-project storage.
2. Whether `INDEX.md` exists at all.
3. A delta frame when a room is reopened after new memories land.
4. The pinned budget: a count or a token budget.
5. Whether `memory.read` results are private to the reader, as
   `transcript.read`'s are.
6. Whether anything outside the Workshop reads memory (not in v1).

## Progress Notes

- **2026-11-04. Epic opened.** Okey asked for an orchestrated start, with
  one thread on the settings design for review and the rest on background
  work. Branch cut from `epic/workshop-wayfinding` at `6c12df5`, `main`
  merged in at `4280ef2`. Threads started: Slice 0 (spec), 0d (settings
  design), 1 (store and codec), 4a (settings panels).
- **2026-11-04. First pass of the threads.**
  - **Slice 0 (spec).** The ADR is Proposed, D1–D13, with a runway and slice
    docs 2–6 (PR #192). It departs from the feature note in several places:
    - the catalog frame goes in the first user message, not the system
      prompt (every settings change rebuilds it);
    - "superseded" is derived, and `origin` is `writer | proposed | auto`;
    - the trailer is stripped like a widget recommendation;
    - receipts are divider turns;
    - the mode defaults to Off;
    - memory turned on mid-room is lookup only (D8);
    - budgets are in tokens (`pinnedTokens` 1,500, `catalogTokens` 2,000).

    Six questions wait on Okey.
  - **Slice 0d (design).** The first canvas is published to Okey, with 9
    artboards of the Memory tab. Unavailable is drawn as off with a reason.
  - **Slice 4a (settings panels).** The modal went from 587 to 234 lines
    plus three panels, driven by `WORKSHOP_CONVERSATION_SETTINGS_TABS`.
    Existing tests pass unedited. Counts: 637 / 8,982 / 59 (PR #193).
  - **Slice 1 (store and codec).**
    - The coordinator kept the thread's behavior-preserving extraction of
      the board store's claims into a neutral `StoredFileClaims` /
      `StoredFileRewrite` (`768b41f`): Lightbox tests are unchanged, and a
      boundary guard keeps the primitive neutral.
    - Format 1 follows the ADR.
    - Counts: 639 / 9,071 / 59 (PR #194).
    - At integration, AGENTS.md's claim rule is reworded to name
      `StoredFileClaims`.

