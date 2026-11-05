# Workshop Wayfinding: complete

**Date:** 2026-11-05
**Epic:** [`.todo/epics/epic-workshop-wayfinding-2026-11-03/`](../.todo/epics/epic-workshop-wayfinding-2026-11-03/README.md)
**Decision:** [ADR 2026-11-03](../docs/adr/2026-11-03-workshop-wayfinding.md), now Accepted, with amendments of 2026-11-03 (D1, D9) and 2026-11-04 (D8, D10)
**Branch:** `epic/workshop-wayfinding`, from `main` at `cfac12b` (v2.12.0), merged to `main` in one PR

## What shipped

- **Rail tabs** (Slice 1, PR #184). The Workshop rail has a Material tab and a Notes tab, and the Tools block is retired. A tab whose content arrives while it's hidden gets a badge. Nothing switches tabs on its own.
- **Read in** (Slices 2–3, PRs #186 and #187). Material lists what the chat target fetched. Resource rows open in a read-only reader. The reader marks the lines that were read and says when the file has changed since. Card-backed rows jump to their card. A host-only SHA-256 fingerprint never reaches the webview.
- **Bookmarks** (Slices 4–5, PRs #188 and #189).
  - Bookmarks are host-owned and saved as an optional session key. They follow New, Open, Rewind and Branch.
  - In the UI: a toggle on the bubble, and a Notes list with rename (confirmed by the host), remove and jump.
  - Turns outside the window open in a read-only preview bound to their room. Export marks bookmarked turns.
  - Recall and prompts never carry bookmarks.
- **Model stamps** (Slice 6, PR #185). Every provider reply records its scope, the model requested and the models served. Host-written fallbacks are unstamped.
- **Model slices** (Slice 7, PR #190). A divider marks where a scope's requested model changes. One shared derivation serves both the thread and the export.
- **Model in the header** (Slice 7b, PR #195). A reply's header reads "Jill · Opus 5.5", with "via {requested}" when another model served it. Export headers use the same rule.
- **Slice 8** (PR #191) holds the live-pass checklist, the writer's decisions and this close-out.

## Writer decisions (Okey)

- **D9 is forward-only (2026-11-03).** A session that contains the new fields won't open in v2.12 or earlier. Every provider reply is stamped, so in practice that's most new work. Unchanged legacy sessions still round-trip.
- **D1's badge rule (2026-11-03).** Whatever lands in a hidden tab badges it, and nothing toasts.
- **Slice 8 decisions (2026-11-04):**
  - keep "Dictionary model · …";
  - put the model in every header, in the thread and in export (Slice 7b);
  - tool-run requests stay unbookmarkable;
  - Escape on a pending rename cancels;
  - bring `main` in at the final PR.
- **Merge (2026-11-05).** Okey approved merging the epic to `main`.

## Review and verification

- **Reviews.** Astra reviewed every slice PR, and each finding was fixed on its slice branch before it merged. Her ledgers are in `docs/pr-reviews/` (PRs #184–#191 and #195). Her aggregate integration review at `6c12df5` found no actionable issue.
- **Counts.** 591 suites / 8,394 tests at the epic's start (`AGENTS.md` inventory), rising to 641 suites / 9,011 tests / 59 snapshots at `4578b71`. Typecheck was clean and lint had 0 errors.
- **The live pass.** Okey approved the merge without a recorded item-by-item pass. What the in-editor checks cover (narrow-column header, both themes, native focus and screen readers) is listed in the Slice 8 doc. Anything found there is a follow-up.

## Follow-ups

- **[Bookmark recall and a Bookmarks screen](../.todo/features/feature-workshop-bookmark-recall/README.md).** It will be cut from `epic-pinned-context` once Pinned Context and the final Project Memory work land. It needs a D5/D10 amendment and reads today's bookmarks unchanged.
- **Tech debt filed during the epic:**
  - codec downgrade tolerance;
  - the WorkshopApp root's size;
  - dictionary normalized-block success;
  - modal focus containment;
  - the Lightbox passages wall-clock test;
  - Markdown positive tabindex;
  - read-in row identity;
  - thread divider accessible names.
- **Archive this epic and its four feature notes** after Project Memory, Pinned Context and bookmark recall have merged. Fix the links in the same pass.

## Downstream

Project Memory (`epic/workshop-project-memory`) and Pinned Context (`epic-pinned-context`) were both cut from Wayfinding's tip, `4578b71`. Pinned Context also merges Project Memory. Neither epic edited a Wayfinding doc.
