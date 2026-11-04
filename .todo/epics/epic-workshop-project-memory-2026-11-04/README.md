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
**Decision:** [ADR 2026-11-04: Workshop Project Memory](../../../docs/adr/2026-11-04-workshop-project-memory.md) (Proposed, all six questions decided; Accepted after Slice 6)
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
| 0 | Spec | ADR, slice docs 2–6, open questions put to Okey | `…-slice-0-spec` | Done: PR #192, merged at `912ad58` (Astra: findings closed on re-review) |
| 0d | Settings design | The Memory tab, the memory manager and the suggestion card, designed for Okey's review, then snapshotted under `docs/design/` | `…-slice-0-design` | Done: PR #196, merged at `913e715` (Astra: F-01–F-05 closed, approved) |
| 1 | Store and codec | Format 1 codec (pure), `ProjectMemoryStore` on the shared `StoredFileClaims` primitive, fixtures. No model, no UI | `…-slice-1-store` | In review: PR #194, findings F-01–F-05, N-01 and N-02 fixed at `b8846c4`; waiting on Astra's re-review |
| 2a | Read path | Library, the catalog frame (first user message via `appendContract`), `memory.*` (catalog, search, read), every D12 list widened, budgets | `…-slice-2a-read-path` | Built and green at `7ec50ba` (652 / 9,228 / 59); PR opens after #194 merges |
| 2b | Update notes | D14: memory versions, the per-participant delivery record, the appended update note, mid-room Off→On | `…-slice-2b-update-notes` | In progress (same thread as 2a) |
| 3 | Write path | Tail extractor and redaction, proposal trailer, card, receipts, supersession, the memory sheet, "Save to memory…", library writes and shutdown drain | `…-slice-3-write-path` | In progress from 2a's head; joins receipts to 2b's fold last |
| 4a | Settings panels | `WorkshopConversationBehaviorModal` split into one component per tab, behavior and markup unchanged | `…-slice-4a-settings-panels` | Done: PR #193, merged at `efc2788` |
| 4b-ui | Memory tab and manager, presentation | Tab panel, the "Memory isn't context" well, meters, the manager modal and every design state, as tested components and pure view models; no host wiring | `…-slice-4b-ui` | In progress from 2a's head |
| 4b-wire | Memory tab and manager, wiring | Manager routes on Slice 3's handler, the hook, mounting the tab, the mode draft in apply-together, Slice 3's sheet for Edit and New | — | Waits on Slice 3 and 4b-ui |
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

## Decisions (Okey, 2026-11-04)

The feature note's six open questions, plus the design scope:

1. **Mode scope: global.** One `proseMinion.workshop.projectMemory` switch for
   every project, written globally like the other Conversation settings.
   Memories stay per project. There is no `SettingsStore` port change.
   (Against the recommendation, which was per project.)
2. **`INDEX.md`: not in v1.**
3. **Memory update note.** This is Okey's refinement; it replaces both "not in
   v1" and D8's lookup-only rule.
   - When a persona's conversation is behind the project's memory set
     (reopened, turned on mid-room, saved in another window), the host
     appends one note to the writer's next message: new entries, changed
     entries (the later one wins), and entries no longer in effect.
   - It is computed per participant from a delivered record kept on the
     delivering turn.
   - It is cache-safe and bounded. Past the budget it says "N memories
     changed; call memory.catalog".
   - It lands in Slice 2.
4. **Pinned budget: tokens, with the meter and a refused pin, at
   `pinnedTokens: 5_000`.** `catalogTokens` stays 2,000, so the frame is at
   most about 7,000 tokens. Slice 6 checks that cost.
5. **`memory.read` is published to the room.**
6. **Workshop only in v1.**
7. **Design scope (0d):** the Memory tab, the memory manager, and the
   suggestion card with its receipt line, all in this pass.

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
- **2026-11-04. Astra's reviews.** Astra delivers each review as a report
  committed to the PR branch under `docs/pr-reviews/`.
  - **#193 (4a):** no findings. Merged at `efc2788`.
  - **#192 (spec): changes requested.**
    - F-01: one owner for the reply's tail. The memory frame comes last, and
      its payload is redacted before every diagnostic, the widget rejection
      log included.
    - F-02: an opaque entry handle for manager rows, separate from the
      `mem-` id.
    - F-03: 4b depends on Slice 3.
    - F-04: pinned overflow. Edits are rechecked; when hand edits or races
      overflow, pinned bodies load oldest pin first, the rest show "pinned,
      not loaded", and nothing is unpinned automatically.
    - N-01: Forget versus Delete.

    The coordinator's direction went to the spec thread.
  - **#194 (store): changes requested.** F-01–F-05 are reproduced bugs:
    frontmatter injection, delete revalidation, uppercase claims, paths in
    logs, the byte ceiling at write. There is also N-01 (supersession
    cycles) and N-02. The coordinator decided N-02: a memory under a live
    claim stays listed with its metadata, so D14's update note never
    announces a transient removal.
- **2026-11-04. Slice 2 split.** The slice doc's scope is more than twice
  Slice 1's, so one thread builds it as two PRs:
  - **2a:** library, frame, capability and every D12 list.
  - **2b:** D14 update notes, branched from 2a's head.

  2a starts on the epic with Slice 1's fixed branch merged in, so it isn't
  blocked on Astra's re-review of #194. Its PR opens after #194 merges.
- **2026-11-04. Wayfinding 7b merged in, and 3 and 4b-ui started.**
  - The epic took `epic/workshop-wayfinding` through Slice 7b (#195) at
    `0ad996c`. It merged cleanly; typecheck clean, lint 0 errors, 642 / 9,016
    / 59 passing.
  - Slice 2a is green at `7ec50ba`. Its frame rides the first user message
    through the persona capability's `appendContract`, which the engine calls
    once, at `runInitial` (checked: it builds the first user message, not the
    system prompt).
  - Slice 3 starts from 2a's head and adds receipts to 2b's fold last.
  - 4b is split by the actual dependency: its manager routes live on Slice 3's
    handler. **4b-ui** (presentation only) runs now; **4b-wire** follows
    Slice 3.

