# Epic: Workshop Persona File Edits

**Status:** Slice 0 (spec) in review. Slice 1 starts in parallel.
**Priority:** Medium
**Created:** 2026-11-05
**Integration branch:** `epic/workshop-persona-file-edits`, cut from `epic/workshop-bookmark-recall` at `b4ca7b86` (the feature tip: Bookmark Recall Slices 0–3, #222, and `main` with Project Memory and Pinned Context). Each slice is built on `epic/workshop-persona-file-edits-slice-<N>-<slug>` and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-05: Personas Propose Edits to Project Files](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) (Proposed; defaults taken for Q1–Q5)
**Supersedes in part:** [Workshop Apply to Draft](../../features/feature-workshop-apply-to-draft/README.md). Its target rules are D5's prose policy.
**Downstream of:** Bookmark Recall. Its live-pass fixes are merged in as they land. The epic goes to `main` after Bookmark Recall does.
**Sibling:** [Helper Agent](../epic-helper-agent-2026-11-05/README.md) runs in parallel. Whichever reaches `main` second merges the other first.

## Goal

- **A persona can propose an edit to any text file in the project, and the writer applies it or not.** That covers notes (character, location, theme, thing, brief and general files) and prose (chapters, the manuscript, and the room's excerpt). Each edit is a card under its bubble, with a diff, Apply, Review in editor…, and Decline.
- **One gateway.** Memory edits, persona file edits and Draft Edit share one anchoring vocabulary (a pure planner) and one write path (`DraftEditApplier`):
  - one undo step;
  - a version guard;
  - protected regions;
  - read-back;
  - never saved.
- **Autonomous editing stays additive** (ADR D10). It isn't built here, but nothing here forecloses it.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR and this epic | All | In review |
| 1 | Shared planner | `utils/textEdits/`: the operations and exactly-once anchoring, pure. Memory edits move onto it with no behavior change; their tests run unchanged. | D3 | Built ([slice doc](slice-1-shared-planner.md)) |
| 2 | The gateway | `DocumentEditor.open` (port and VS Code adapter); `ProjectFileEditGateway`: fresh target resolution by catalog key or excerpt, `FILE_EDIT_TARGET_POLICIES`, planning on the live text, apply through `DraftEditApplier`, showing an edited file that isn't visible; boundary pins. Host-only, no persona. | D4–D6, D11 | Built ([slice doc](slice-2-gateway.md)) |
| 3 | The proposal | The `<prose-minion-file-edit>` codec and budgets; the persona prompt section and worked example, with a sync test; reading the trailer out of a reply; `fileEditProposals` on the turn, with the session codec, checkpoint normalization and transcript projection; the `fileEdits` setting | D2, D8, D9 | Not started |
| 4 | Cards and Apply | Thread cards with diffs; Apply, Review in editor… and Decline routes with request ids; re-anchoring at Apply (stale); what landed recorded; refusals in the writer's words | D7, D8 | Not started |
| 5 | Verify live | Extension Development Host pass on notes and a chapter; ADR → Accepted; memory bank; `AGENTS.md`; Apply to Draft's note settled | — | Not started |

**Order:** 1 → (2 ∥ 3) → 4 → 5.
- Slices 2 and 3 both use Slice 1's operation types.
- Slice 4 joins the gateway (2) to the proposals (3).

## Defaults taken (Okey delegated; he may override)

- **Q1, the default:** `proseMinion.workshop.fileEdits` is `ask` (on). Nothing changes without Apply.
- **Q2, new prose in a chapter:**
  - append and prepend are allowed, up to about 400 words each;
  - the rewrite ceiling is 60% of the touched paragraphs' characters;
  - `rewrite` is refused on prose.
- **Q3, Apply:** Apply is direct everywhere, since the card shows the diff. **Review in editor…** sits beside it.
- **Q4:** at most 5 file edits per reply.
- **Q5:** Apply to Draft's "Apply Recommendations" is dropped, since personas propose edits directly. Apply Variation (no model) is a later gateway use.

## How the slices are built

This is the same flow as Project Memory and Bookmark Recall.

- **One implementation thread per slice.** It works on its slice branch, cut from the epic, and reads:
  - this README;
  - the ADR;
  - `AGENTS.md`, mainly Draft Edit (all of it: "One door", "A write is read back", "Protected regions", "Live text wins"), Workshop Project Memory's edit rules, Session Codec Evolution, Transcript Export's one projection, and the presentation patterns.

  It builds, verifies, commits and pushes, then messages the coordinator with its head and counts.
- **The coordinating thread** (`session_01UrwcevhVS535zW3cPqMrv6`) opens each PR into `epic/workshop-persona-file-edits` and watches it. Astra reviews each PR.
- **Findings are fixed on the slice branch**, and answered in the review's ledger.
- **Merging into the epic.** Once a PR is green and its findings are settled, the coordinator merges it into the epic with a merge commit pinned to its head.

## Verification (every slice)

- `npm run typecheck`
- `npm run lint`: no new errors. Only new warnings count.
- `npx jest`: the full suite passes. Record the counts in the progress notes, and take a baseline on the epic's first commit.
- `packages/core/src` has no `from 'vscode'`.
- **File size.**
  - No new file goes over 500 lines.
  - A file already over 500 lines grows only by the seam: `WorkshopApp.tsx` (1,873), `WorkshopSessionService.ts` (2,724), `messages/workshop/session.ts` (1,017), `MessageHandler.ts` (988), `extension.ts` (977), `WorkshopPersonaCapability.ts` (957), `promptBudgets.ts` (817).
- **The writer's text.**
  - Only the gateway and Draft Edit's runs reach `DraftEditApplier`, and only the applier calls `applyEdits` (`boundaries.test.ts`).
  - No Workshop module reaches `DocumentEditor`.
  - Nothing saves a document.
- **Logs** never carry the writer's text or a quote. Fixtures use *Alice*.
- **Completion criteria** are each backed by a named test, or stated as covered by the Slice 5 live pass.

## Completion Criteria

- **Proposals.** A persona's reply can carry up to five file-edit frames. Each becomes a card naming its file, with its why and a diff, and nothing changes until the writer presses Apply.
- **Targets** are catalog keys, looked up in a fresh catalog, or the excerpt's own document. A path or URI from a model or the webview is never trusted, and only text files under the size bound are accepted.
- **Notes** take rewrite, replace, append and prepend. **Prose** takes replace, plus bounded append and prepend. Both keep:
  - protected regions;
  - prose's Markdown structure;
  - prose's rewrite ceiling.
- **Apply plans against the live text.** A quote that isn't there exactly once makes the card stale, with nothing applied.
- **Every apply** is one undo step, checked against its version, read back, and never saved. A file that wasn't visible is shown after it changes.
- **Memory edits run on the shared planner** with no behavior change.
- **The setting** turns proposals off. With it off, the prompt doesn't teach them and a stray frame is dropped and counted.
- **Session state** keeps each card's state and what landed. Export shows a card's file, why and state, never its text.

## Progress Notes

- **2026-11-05. Slice 0.**
  - Okey asked for persona file editing. He chose option B, notes and chapters, and asked whether autonomous editing could follow without rework (yes: ADR D10).
  - He handed the implementation to the coordinator.
  - ADR drafted, defaults taken, epic cut from the Bookmark Recall tip at `b4ca7b86`.
- **2026-11-05. Slice 1 (shared planner).**
  - Baseline on `0ed3ba75`: typecheck clean; lint 0 errors, 1,165 warnings; jest 753 suites, 10,481 tests, 59 snapshots.
  - `utils/textEdits/` built; memory edits plan through it. No memory-edit test changed.
  - After: typecheck clean; lint 0 errors, 1,165 warnings (no new); jest 754 suites, 10,499 tests, 59 snapshots. See [the slice doc](slice-1-shared-planner.md).
- **2026-11-05. Slice 2 (the gateway).**
  - `DocumentEditor.open` / `reveal`, `ProjectFileEditGateway`, `FILE_EDIT_TARGET_POLICIES`, `PROMPT_BUDGETS.workshopFileEdits`, boundary pins.
  - Two Draft Edit fixes the gateway needed: a pure insertion now reads back as applied (`reconcileEdits`), and prose paragraphs may merge, split or be added under "structure preserved" (`paragraphsMayMergeOrSplit`, opt-in).
  - After: typecheck clean; lint 0 errors, 1,165 warnings (no new); jest 758 suites, 10,532 tests, 59 snapshots. See [the slice doc](slice-2-gateway.md).
