# Workshop Persona File Edits: complete

**Date:** 2026-11-10
**Epic:** [archive](../.todo/archive/epics/epic-workshop-persona-file-edits-2026-11-05/README.md)
**Decision:** [ADR 2026-11-05](../docs/adr/2026-11-05-workshop-persona-file-edits.md), Accepted 2026-11-10
**Branch:** `epic/workshop-persona-file-edits`, cut from `epic/workshop-bookmark-recall` at `b4ca7b86`, `main` synced in (#244), merged to `main` on Okey's approval after his live pass

## Facts

- **What it is.** A Workshop persona can propose an edit to any text file in the project: notes, chapters, the manuscript, or the excerpt's document.
  - Each edit is a card under its bubble, with a diff, Apply, Review in editor… and Decline.
  - Nothing changes in a file until the writer applies it, and nothing is ever saved for them.
- **How it was built.** A spec PR and six code PRs, each reviewed by Astra:
  - #226: the spec, revised after the review;
  - #227: the shared planner;
  - #229: staging and the gateway;
  - #230: the proposal;
  - #233: Apply on the host;
  - #234: the cards;
  - #236: Okey's answers (retry, and the settings row).

  Also #235 (the live-pass checklist) and #244 (`main`, with Bookmark Recall and the Helper Agent, synced in).
- **The live pass** (2026-11-10). Okey: "The file editing works well when I ask the model specifically to prepare it, but I have to ask several times." He approved the merge.

## Decisions

- **Personas propose; the writer applies.** v1 has no `auto`, and no input can name one (D11). D12 keeps autonomous editing additive: the same staging, freshness, gateway and claim.
- **One planner and one write path.**
  - Memory edits and file edits share `utils/textEdits/`, though memory keeps its own persistence.
  - File edits and Draft Edit share `DraftEditApplier`: one undo step, the version guard, protected regions, read-back, never saved.
- **Staged once to a host identity** (D4): `documentUri`, refused when ambiguous, never retargeted. The class (prose or notes) comes from every membership the file has, and is recomputed at Apply. The baseline is a SHA-256 of the content.
- **Prose rules** (D5): no rewrite. Appends and prepends are plain paragraphs within 400 words. Structure mode is `prose-paragraphs`. The rewrite ceiling (more than 300 changed characters and more than 60% of the touched paragraphs) applies on every attempt.
- **The claim and the durable checkpoint** (D8).
  - The claim is keyed by `(roomGeneration, turnId, index)` and taken before any await.
  - `applying` is checkpointed durably before any write.
  - The authority predicate runs in `beforeAttempt`, before every `applyEdits`.
- **No blind retry, except where nothing could have landed** (D8, amended 2026-11-06).
  - `catalog-unreadable` at Apply and `host-failed` before dispatch return the card to `pending`.
  - A failure after dispatch reads `unknown`.
  - A reveal-only failure keeps the settled result.
- **One setting with a row** (D11, amended 2026-11-06). `proseMinion.workshop.fileEdits`, `off` | `ask`, shown as "Suggested file edits" on the Behavior tab. Untouched mode rows submit nothing (#236 F-02).
- **The codec: no `schemaVersion` bump** (ADR 2026-07-30).
  - `fileEditProposals` is a new optional field on a turn. No formerly valid shape becomes invalid, and no field changes meaning.
  - Builds without the field can't open sessions holding cards. That's forward compatibility, which a migration doesn't address.
- **Apply to Draft is settled.** Apply Recommendations is dropped, and its target rules are D5. Apply Variation (no model) remains open as a later use of the gateway.

## Lessons the reviews taught

- **Name the thing that must not drift** (#226 F-02, F-03): an identity, not a group and path; a class by identity, not by the trailer's group.
- **"Applying" must be durable before the write** (#226 F-04 re-review), and authority is checked before every attempt, retries included.
- **Honest outcomes.**
  - A `partial` with an `unknown` in it must not claim the rest "were not" applied (#233 note).
  - A refused write is "unchanged", not "this session only" (#236 F-01).
  - A throw after dispatch is `unknown`, never "nothing written" (#236).
- **Send only what the writer chose** (#236 F-02, two rounds): an untouched row overwrote a newer choice still in flight.
- **Lifecycle edges in the webview** (#234 F-01, F-02): a disclosure that stays mounted across a room change must ask again, and a refused preview must retry on reopen without retrying on its own.
- **A live-pass checklist is code too** (#235 F-01): Refactor Preview opens entries unticked, and touching edits join into one entry.

## Verification

At `926190d9` (#236's merge):
- typecheck clean;
- lint: 0 errors / 1,165 warnings;
- jest: **797 suites / 11,186 tests / 59 snapshots**, all passing;
- `npm run build` succeeds.

CI passed on #236's code and report heads.

## Follow-ups

- **[Personas propose file edits readily](../.todo/features/feature-workshop-file-edit-proposal-readiness/README.md)** (medium): the live pass's finding. Diagnose first.
- **[Reads that fit the window](../.todo/features/feature-workshop-reads-fit-the-window/README.md)** (high): file and memory reads can still fill the context window.
- **Apply Variation (no model),** in [Apply to Draft's note](../.todo/features/feature-workshop-apply-to-draft/README.md).
- **D12's autonomous editing and Revert** stay unbuilt, by Okey's choice.
- **Project Memory's epic close-out** (archive, memory bank, `AGENTS.md` section) is still to do.
- **PR #241** (Creative Variations' legacy advisory field) is open and unmerged at Okey's direction; he repaired his session files by hand.
