# Epic: Workshop Persona File Edits

**Status:** Slice 0 (spec) in review. Slice 1 starts in parallel.
**Priority:** Medium
**Created:** 2026-11-05
**Integration branch:** `epic/workshop-persona-file-edits`, cut from `epic/workshop-bookmark-recall` at `b4ca7b86` (the feature tip: Bookmark Recall Slices 0–3, #222, and `main` with Project Memory and Pinned Context). Each slice is built on `epic/workshop-persona-file-edits-slice-<N>-<slug>` and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-05: Personas Propose Edits to Project Files](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) (Proposed; defaults taken for Q1–Q5)
**Supersedes in part:** [Workshop Apply to Draft](../../features/feature-workshop-apply-to-draft/README.md). Its target rules are D5's prose policy.
**Downstream of:** Bookmark Recall. Its live-pass fixes are merged in as they land. The epic goes to `main` after Bookmark Recall does.
**Sibling:** Helper Agent runs in parallel on its own epic branch, `epic/helper-agent` (spec: [PR #225](https://github.com/okeylanders/prose-minion-vscode/pull/225)); its README joins this tree when the two epics meet. Whichever reaches `main` second merges the other first.

## Goal

- **A persona can propose an edit to any text file in the project, and the writer applies it or not.** That covers notes (character, location, theme, thing, brief and general files) and prose (chapters, the manuscript, and the room's excerpt). Each edit is a card under its bubble, with a diff, Apply, Review in editor…, and Decline.
- **One vocabulary, one document write path.** Memory edits and persona file edits share one operation vocabulary and planner. Memory keeps its own persistence. Persona file edits and Draft Edit share one document write path (`DraftEditApplier`):
  - one undo step;
  - a version guard;
  - protected regions;
  - read-back;
  - never saved.
- **Edits never drift.** A card is staged to a host-owned identity, a class (prose or notes) decided by every membership the file has, and a baseline. One host claim lets it land at most once (ADR D4–D8, from the PR #226 review).
- **Autonomous editing stays additive** (ADR D10). It isn't built here, but nothing here forecloses it.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR and this epic | All | In review |
| 1 | Shared planner | `utils/textEdits/`: the operations and exactly-once anchoring, pure. Memory edits move onto it with no behavior change; their tests run unchanged. | D3 | Built ([slice doc](slice-1-shared-planner.md)) |
| 2 | Staging and the gateway | The resolver's every-candidate read; `FileEditStaging` implemented (identity, ambiguity refusal, class by identity, baseline); `DocumentEditor.open` (port and VS Code adapter); the applier's `structure` mode (`strict` / `prose-paragraphs` / `free`) and `beforeAttempt` immediately before every `applyEdits` (authority predicate and text checks); the `FileEditAuthorityEpoch` port; `ProjectFileEditGateway` (re-authorize, recompute class, plan, freshness, ceiling, the last-boundary predicate, apply, report by operation, show the document); boundary pins. Host-only, no persona, no routes. | D4–D7, D13 | Built ([slice doc](slice-2-gateway.md)) |
| 3 | The proposal | The `<prose-minion-file-edit>` codec and D2's bounds; the persona prompt section and worked example, with a sync test; reading frames out of a reply and staging each through the `FileEditStaging` port (a fake in tests); `fileEditProposals` (D10's shape) on the turn, with the session codec, checkpoint normalization and transcript projection; the `fileEdits` setting | D2, D10, D11 | In progress |
| 4 | Cards and Apply | The handler's claim keyed by room generation, and outcomes (D8: join, replay, `checkpointFileEdit` acknowledged durable in every recoverable checkpoint before dispatch, `partial`, `unknown`); Apply, Review in editor…, Decline and Preview routes with request ids; the real staging joined; thread cards with diffs; `landed` records; refusals in the writer's words | D8, D9, D10 | Not started |
| 5 | Verify live | Extension Development Host pass on notes and a chapter; ADR → Accepted; memory bank; `AGENTS.md`; Apply to Draft's note settled | — | Not started |

**Order:** 1 → (2 ∥ 3) → 4 → 5.
- Slices 2 and 3 both use Slice 1's operation types.
- Slice 3 defines the `FileEditStaging` port's interface. Slice 2 implements it.
- Slice 4 joins the gateway and staging (2) to the proposals (3).

## Defaults taken (Okey delegated; he may override)

- **Q1, the default:** `proseMinion.workshop.fileEdits` is `ask` (on). Nothing changes without Apply.
- **Q2, new prose in a chapter:**
  - append and prepend are allowed, up to 400 words each;
  - the rewrite ceiling is 60% of the touched paragraphs' characters, and applies only above 300 replaced characters (added after the review, ADR D5);
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
- **Targets** are staged to a host-owned identity (ADR D4):
  - an ambiguous target is refused;
  - an excerpt is bound to the document it was staged from;
  - the identity is re-authorized at Apply (containment, symlinks, catalog membership);
  - a path or URI from a model or the webview is never trusted, and only text files under the size bound are accepted.
- **The class comes from identity.** A file with any chapters or manuscript membership, through any root, or an excerpt document, gets prose rules whichever group the trailer named.
- **A rewrite needs its baseline.** A note changed since staging makes the card stale, and nothing is overwritten.
- **Apply lands at most once.** Each of these produces one truthful receipt and no duplicate edit:
  - a double Apply;
  - Apply racing Decline;
  - a room replaced mid-apply;
  - the same session reopened while an old action is paused;
  - a preview with entries unticked;
  - a reopened `applying` card;
  - a failed or deferred `applying` checkpoint, which writes nothing.
- **Authority is checked before every write attempt.** The setting turned off, the room replaced, or roots or context paths changed between the applier's first attempt and its retry: the retry writes nothing.
- **Every attempt is checked again.** The applier's internal retry re-runs freshness, the ceiling (witness: a quote over the 300-character floor; control: one below it) and the structure mode.
- **Notes** take rewrite, replace, append and prepend. A rewrite over protected syntax is refused, with a reason.
- **Prose** takes replace, plus bounded append and prepend. Plain paragraphs may split, merge or be added; every other structure is kept, and the ceiling holds.
- **Both** keep protected regions. Proofread's strict structure check is unchanged.
- **Apply plans against the live text.** A quote that isn't there exactly once makes the card stale, with nothing applied.
- **Every apply** is one undo step, checked against its version, read back, and never saved. A file that wasn't visible is shown after it changes.
- **Memory edits run on the shared planner** with no behavior change.
- **The setting** turns proposals off. With it off, the prompt doesn't teach them and a stray frame is dropped and counted.
- **Session state** keeps each card's identity, class, baseline, state and what landed (bounded for a future Revert). Export shows a card's display path, why and state, never its text or URI.

## Progress Notes

- **2026-11-05. PR #226 review (Astra): changes requested at spec level.**
  - **Findings:**
    - P1: F-01 (rewrite baseline), F-02 (target identity), F-03 (prose by identity);
    - P2: F-04 (claim and outcomes), F-05 (paragraph structure), F-06 (ceiling on retry);
    - N-01 to N-03.
  - **The revision.** The ADR is revised: D4 staging, D5 classes, structure modes and the exact ceiling, D6 baseline, D7 the gateway with `revalidate`, D8 the claim, D10 the session shape, D13 guards. Its ledger maps each finding.
  - **Slices re-scoped.** Slice 2 now includes staging, the resolver's every-candidate read, and the applier's structure mode and `revalidate`. Slice 3 stages through a port. Slice 4 owns the claim.
  - **Threads informed.** The Slice 2 and 3 threads hold their contract-dependent parts until this revision lands.
- **2026-11-05. PR #226 re-review (Astra).**
  - **Closed:** F-01, F-02, F-03, F-05, F-06 and N-01–N-03.
  - **F-04 had three refinements, now settled in D7 and D8:**
    - `applying` must be acknowledged durable before any write (`checkpointFileEdit`);
    - the claim and its outcomes are keyed by room generation (`readRoomRevision()`);
    - the authority predicate runs before every `applyEdits`, the retry included, with an authority epoch for roots and context paths.
  - **The F-06 witness** moves above the 300-character floor.

- **2026-11-05. Slice 0.**
  - Okey asked for persona file editing. He chose option B, notes and chapters, and asked whether autonomous editing could follow without rework (yes: ADR D10).
  - He handed the implementation to the coordinator.
  - ADR drafted, defaults taken, epic cut from the Bookmark Recall tip at `b4ca7b86`.
- **2026-11-05. Slice 1 (shared planner).**
  - Baseline on `0ed3ba75`: typecheck clean; lint 0 errors, 1,165 warnings; jest 753 suites, 10,481 tests, 59 snapshots.
  - `utils/textEdits/` built; memory edits plan through it. No memory-edit test changed.
  - After: typecheck clean; lint 0 errors, 1,165 warnings (no new); jest 754 suites, 10,499 tests, 59 snapshots. See [the slice doc](slice-1-shared-planner.md).
- **2026-11-05. Slice 2 (staging and the gateway).**
  - First built to the original ADR, then reworked to the revised contracts (PR #226 F-02, F-03, F-05, F-06).
  - Built: the resolver's every-candidate read; `FileEditStagingService`; the applier's `structure` mode and `beforeAttempt`; the `FileEditAuthorityEpoch` port; `ProjectFileEditGateway` (D7); `DocumentEditor.open` / `peek` / `reveal`; budgets; boundary pins.
  - One Draft Edit read-back fix: a pure insertion now reads as applied.
  - After: typecheck clean; lint 0 errors, 1,165 warnings (no new); jest 761 suites, 10,560 tests, 59 snapshots. See [the slice doc](slice-2-gateway.md).
- **2026-11-05. Slice 2 review fixes (PR #229).**
  - F-01: the candidate read fails closed.
  - F-02: plain paragraphs appear and go at structural boundaries.
  - F-03: a refused retry keeps earlier `unknown` and landed outcomes.
  - N-01: the write path's resolver logs counts only.
  - Astra's reproductions are ported as regression tests. After: typecheck clean; lint 0 errors, 1,165 warnings (no new); jest 762 suites, 10,585 tests, 59 snapshots.
