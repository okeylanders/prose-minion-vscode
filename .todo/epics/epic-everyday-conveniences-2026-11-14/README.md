# Epic: Everyday Conveniences

**Status:** All slices built. Slice 0, E, C, D and A are merged into the epic (PRs #259, #260, #262, #261, #263). B is in review (PR #264). The closing slice (docs, the live-pass checklist and one test) is on `epic/everyday-conveniences-close`, stacked on B. Nothing has gone to `main`; the [live pass](live-pass.md) and the product defaults are Okey's.
**Priority:** Medium
**Opened:** 2026-11-14
**Branch:** `epic/everyday-conveniences`, cut from `main` at `964aa0e4`
(Merge PR #258; `main` had not moved).
**ADR:** [2026-11-14: Everyday Conveniences](../../../docs/adr/2026-11-14-everyday-conveniences.md)
(items A and B; C, D and E are settled here).

## Goal

Five small-to-medium writer conveniences, built as one epic:

| Item | What the writer gets | Okey's # | Feature note |
|---|---|---|---|
| A | A persona reads several files in one request, and file reads fit the context window | 4 | [Reads That Fit the Window](../../features/feature-workshop-reads-fit-the-window/README.md), parts 1 (`resource.read` only) and 3 |
| B | "Selected Text" as a pill in the Workshop composer, by command or by an "Include selected text" toggle | 6 | [Send the Selection With Each Message](../../features/feature-workshop-send-selection-with-message/README.md) |
| C | Search the Dictionary's lookup history | 7 | [Dictionary History Search](../../features/feature-dictionary-history-search/README.md) |
| D | Collapse the Workshop's side pane to an icon strip | 10 | [Collapsible Rail](../../features/feature-workshop-collapsible-rail/README.md) |
| E | Re-read from file in a new room that kept its excerpt | 21 | [Re-read in a New Room](../../features/feature-workshop-reread-excerpt-in-new-room/README.md) |

The four notes for B–E came from `claude/idea-inbox` in this branch's first
commit (`4ca74710`), byte-identical, and are **never edited here**, so the
inbox's own add merges cleanly. A's note is `main`'s. Status and decisions
live in this README and the ADR.

## Slices

| # | Slice | Branch | Outcome | Status |
|---|---|---|---|---|
| 0 | Spec | `epic/everyday-conveniences-spec` | The ADR (A and B) | Done: PR #259, merged `5cfbaa64` ([review](../../../docs/pr-reviews/pr-259-everyday-conveniences-adr-review.md): one finding, fixed as D2a) |
| E | Re-read in a new room | `…-reread-excerpt` | Re-read from file on any file-backed excerpt; Continue re-reads, as one host operation | Done: PR #260, merged `13fa4165` ([review](../../../docs/pr-reviews/pr-260-reread-excerpt-review.md): one finding, fixed) |
| D | Collapsible rail | `…-collapsible-rail` | `FullTabShell` opt-in; the Workshop's rail collapses to an icon strip | Done: PR #261, merged `565a43e0` ([review](../../../docs/pr-reviews/pr-261-collapsible-rail-review.md): no blocking findings) |
| C | Dictionary history search | `…-dictionary-history-search` | Filter in the popup; "Also search definitions" on the host | Done: PR #262, merged `c1c9e2be` ([review](../../../docs/pr-reviews/pr-262-dictionary-history-search-review.md): no blocking findings) |
| A | Multi-file reads | `…-multi-file-reads` | Shared window fit; `resource.read` fitted; repeated `<path>` | Done: PR #263, merged `0f152152` (review: no blocking findings; its report is not in the repo) |
| B | Selected Text | `…-selected-text` | Port fix, snapshots by id, `selected-text` attachment, command and toggle; the old command retitled | PR #264, in review |
| Close | Closing pass | `…-close` | `AGENTS.md` where a rule changed, the [live-pass checklist](live-pass.md), the D5 share test and ADR note, a memory-bank entry | Pushed; stacked on B, no PR yet |

Slice branches are `epic/everyday-conveniences-<slug>`.

## Defaults taken

Okey is away; these were decided for him, by his notes' leanings or the
brief's defaults. Each is his to overturn.

| # | Item | Question | Default taken | Source |
|---|---|---|---|---|
| 1 | A | Scope beyond multi-file | Build part 1's **`resource.read` window fit** too (shared fitting module, half the room left, one read's worth with no window). Ten files in one unfitted call would make "context window exceeded" more likely. | **Okey's decision** (relayed by Ada, 2026-11-14) |
| 2 | A | Out of scope | The engine backstop (part 2) and the `memory.read` fit stay in the feature note. | **Okey's decision** (relayed by Ada, 2026-11-14) |
| 3 | A | The share, and a per-turn total | Half the room left; no per-turn total when the window is known. | Okey, 2026-11-06 |
| 4 | B | How a selection is added by hand | Two separate commands. A new one, **Add Selection to Workshop Message**, stages the pill. The existing `prose-minion.workshopSelection` keeps replacing the excerpt and is retitled **Send to New Workshop Excerpt**, everywhere the old title appears. | **Okey's decision** (relayed by Ada, 2026-11-14) |
| 5 | B | Which documents | Any text document, like the existing selection commands. | Brief default |
| 6 | B | A selection inside the excerpt | Sent as text. A pointer can come later. | Brief default |
| 7 | B | Rewind | Restages the captured text, not the live selection. | Brief default |
| 8 | B | Transcript export | Shows the pill's label, never its text. | Brief default |
| 9 | B | The toggle | Off by default; remembered per window as a UI preference. | Okey, 2026-11-14 |
| 10 | C | ‹ › while searching | Still walks the full history. | Note's leaning |
| 11 | C | Filters beyond text | Text only; no chips. | Brief default |
| 12 | C | The cap | Stays 500. | Brief default |
| 13 | D | Who opts in | Only the Workshop. The Lightbox's markup is unchanged. | Brief default |
| 14 | E | Continue on a file-backed carried passage | Always re-reads: edits land as vN+1, and an unchanged file says so and stays vN. No second button. | Note's leaning |

Taken while writing the ADR (its Q1–Q7 carry the detail):

| # | Item | Question | Default taken | Source |
|---|---|---|---|---|
| 15 | B | The attachment kind's name | `selected-text`, not the brief's `editor-selection`: that literal is already the excerpt's source kind. | ADR D13 |
| 16 | B | Several selections in one message | Allowed by hand, as ordinary pills. The live pill hides only when its own snapshot is already staged. | ADR Q2 |
| 17 | B | A send whose snapshot is gone | Refuse the whole send and keep the draft; never send the live selection unseen. | ADR Q3 |
| 18 | B | The selection bound | 5,000 words, cut at capture, said on the pill. No refusal of a whole-file selection. | ADR D15 |
| 19 | A | The bounds | `readPaths` 10; a multi-file read shares 256 KiB before the fit; a one-path read keeps 64 KiB. Duplicate paths are refused. | ADR D4, D5 |
| 20 | A | `group` on a `<path>` | Allowed, so a chapter and a character sheet are one read. | ADR Q5 |

Taken while building:

| # | Item | Question | Decision | Source |
|---|---|---|---|---|
| 21 | A | A file's share inside a multi-file read | Not capped at the one-file 64 KiB: the files share 256 KiB, so a line a one-file read can never deliver can land beside a small file. The window fit still bounds it. A permanent test and a note are owed, to make the choice explicit. **Done in the closing slice:** `WorkshopResourceReadMultiFileShareNotCappedAtReadBytes.test.ts` and D5's addendum. | ADR D5 as written; Astra, PR #263 |
| 22 | E | Continue's re-read | One host operation, read first; a send during the read is refused in the room's busy words. | PR #260 F-01 |

## How the slices are built

- **One implementation thread per slice**, on its slice branch cut from the
  epic. It reads this README, the ADR, its feature note and `AGENTS.md`,
  then builds, verifies, commits and pushes.
- **The orchestrator** opens each PR into `epic/everyday-conveniences` and
  subscribes to it. **Astra** reviews.
- **Approved:** merged into the epic with a merge commit.
  **Findings:** fixed on the slice branch, answered in the PR, and
  re-reviewed before merging. Nothing merges without Astra's approval.
- **Nothing targets `main`** without Okey. Never commit to
  `claude/idea-inbox` or `main`. Merge between branches; never rebase a
  shared one.

## Verification (every slice)

- `npm run typecheck` and `npm run lint`: no new errors.
- The full `npx jest`, counts recorded in the slice's PR and below.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines.
- No live, billable model calls in tests.
- Logs never carry writer text, paths or selections; fixtures use *Alice*.
- Shared components keep their parity tests.

## Test counts

| When | Suites | Tests | Snapshots |
|---|---|---|---|
| Baseline (`main` at `964aa0e4`) | not run | | |
| E's branch at `0cf83f13` (PR #260) | 844 | 11,964 | 59 |
| C's branch at `67a7222e` (PR #262) | 850 | 12,041 | 59 |
| D's branch at `df13e220` (PR #261) | 847 | 11,978 | 59 |
| The epic at `08542fad` (E, C and D together) | 853 | 12,093 | 59 |
| A's branch at `206aa837`, epic merged in (PR #263) | 860 | 12,195 | 59 |
| The epic with A at merge (`0f152152`) | not measured separately | | |
| B's branch at `5e398001`, the whole epic merged in (PR #264) | 869 | 12,306 | 59 |
| The closing slice (`…-close`, on B) | 870 | 12,312 | 59 |

## Completion Criteria

Built and covered by automated tests. **None of it has been run in the
Extension Development Host or against a live model**: that is the
[live-pass checklist](live-pass.md), and an item is finished for the writer
only once Okey has run its part.

- [x] The ADR for A and B passed its technical review and is merged (PR #259). Its product defaults stay proposed until Okey accepts them.
- [x] A: `resource.read` fits the window and reads up to `readPaths` files
      in one call, each under its own header with its own continuation; a
      bad path is reported in its own section; the grammar prompt is pinned.
      (PR #263, merged.)
- [x] B: the command and the toggle both stage a "Selected Text" pill; what
      the pill showed is what is sent; the excerpt is unchanged.
      (PR #264, **in review, not merged**.)
- [x] C: the popup filters by word, context and file; definitions search
      runs on the host, correlated; the keyboard path works. (PR #262.)
- [x] D: the Workshop's rail collapses and reopens, remembered per window;
      the Lightbox's markup is unchanged. (PR #261.)
- [x] E: Re-read from file shows on any file-backed excerpt; Continue
      re-reads. (PR #260.)
- [x] A [live-pass checklist](live-pass.md) for Okey, `AGENTS.md` updated,
      and a [memory-bank entry](../../../.memory-bank/20261114-1945-everyday-conveniences-epic.md).
- [ ] Okey's live pass, and his word on the defaults (the checklist's
      "Decisions waiting on Okey").
- [ ] B merged into the epic, then this closing slice.

## Notes

- **PR #263's review report is not in the repo.** `docs/pr-reviews/` holds
  #259–#262 only. The review's one request (the D5 share test and note) is
  recorded in "Taken while building", row 21.
- **Follow-ups** stay in their notes: the engine backstop and the
  `memory.read` fit in [Reads That Fit the Window](../../features/feature-workshop-reads-fit-the-window/README.md);
  the files over 500 lines these slices touched in
  [tech debt](../../tech-debt/2026-11-14-everyday-conveniences-oversized-files.md).
