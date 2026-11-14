# Epic: Everyday Conveniences

**Status:** In progress. Slice 0, E, D and C are in review (PRs #259–#262); A and B wait on Slice 0.
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
| 0 | Spec | `epic/everyday-conveniences-spec` | The ADR (A and B) | PR #259: changes requested, answered (`0a511734`); awaiting re-review |
| E | Re-read in a new room | `…-reread-excerpt` | Re-read from file on any file-backed excerpt; Continue re-reads, as one host operation | PR #260: changes requested, fixed (`0cf83f13`); awaiting re-review |
| D | Collapsible rail | `…-collapsible-rail` | `FullTabShell` opt-in; the Workshop's rail collapses to an icon strip | PR #261, in review |
| C | Dictionary history search | `…-dictionary-history-search` | Filter in the popup; "Also search definitions" on the host | PR #262, in review |
| A | Multi-file reads | `…-multi-file-reads` | Shared window fit; `resource.read` fitted; repeated `<path>` | After Slice 0 |
| B | Selected Text | `…-selected-text` | Port fix, snapshots by id, `editor-selection` attachment, command and toggle | After Slice 0 |

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

Decisions made while building are added below as they are taken.

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
| Baseline (`main` at `964aa0e4`) | — | — | — |

## Completion Criteria

- [ ] The ADR for A and B is Accepted.
- [ ] A: `resource.read` fits the window and reads up to `readPaths` files
      in one call, each under its own header with its own continuation; a
      bad path is reported in its own section; the grammar prompt is pinned.
- [ ] B: the command and the toggle both stage a "Selected Text" pill; what
      the pill showed is what is sent; the excerpt is unchanged.
- [ ] C: the popup filters by word, context and file; definitions search
      runs on the host, correlated; the keyboard path works.
- [ ] D: the Workshop's rail collapses and reopens, remembered per window;
      the Lightbox's markup is unchanged.
- [ ] E: Re-read from file shows on any file-backed excerpt; Continue
      re-reads.
- [ ] A live-pass checklist for Okey, `AGENTS.md` updated, and a
      memory-bank entry.
