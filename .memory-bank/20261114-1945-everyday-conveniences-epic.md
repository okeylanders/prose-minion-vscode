# Everyday Conveniences: all five items built; the live pass and the defaults are Okey's

**Date:** 2026-11-14
**Epic:** [README](../.todo/epics/epic-everyday-conveniences-2026-11-14/README.md) (active; not archived)
**Decision:** [ADR 2026-11-14](../docs/adr/2026-11-14-everyday-conveniences.md) (items A and B), and the [2026-11-14 amendment](../docs/adr/2026-10-14-dictionary-lookup-history.md#amendment-2026-11-14-searching-the-history) to the Dictionary history ADR (item C)
**Branch:** `epic/everyday-conveniences`, cut from `main` at `964aa0e4`. Nothing has gone to `main`.
**Next step:** Okey's [live pass](../.todo/epics/epic-everyday-conveniences-2026-11-14/live-pass.md).

## Facts

- **What it is.** Five writer conveniences from Okey's idea list, built as one epic while he was away:
  - **A (his #4):** a persona reads up to 10 files in one `resource.read`, and every file read is fitted to half the room left in the context window.
  - **B (#6):** the editor's selection as a "Selected Text" pill on one Workshop message, by command or by an "Include selected text" toggle.
  - **C (#7):** search in the Dictionary's history popup, with "Also search definitions" on the host.
  - **D (#10):** the Workshop's side pane collapses to an icon strip.
  - **E (#21):** Re-read from file in a new room that kept its excerpt; Continue re-reads.
- **How it was built.** One implementation thread per slice, on its own branch; a PR into the epic; Astra reviewed each; merged with a merge commit.

| Slice | PR | Merged into the epic | Review |
|---|---|---|---|
| 0, the ADR | #259 | `5cfbaa64` | One finding (F-01), fixed as D2a |
| E, re-read | #260 | `13fa4165` | One finding (F-01), fixed |
| C, history search | #262 | `c1c9e2be` | No blocking findings |
| D, collapsible rail | #261 | `565a43e0` | No blocking findings |
| A, multi-file reads | #263 | `0f152152` | No blocking findings; one request (below). Its report is not in the repo. |
| B, Selected Text | #264 | pending (in review) | pending |
| Close | none yet | pending (`epic/everyday-conveniences-close`, stacked on B) | not reviewed |

## Decisions

**Okey's** (relayed by Ada, 2026-11-14, or earlier):
- A is built with the `resource.read` window fit, not multi-file alone. The engine backstop and the `memory.read` fit stay out.
- Half the room left; no per-turn byte total when the window is known (2026-11-06).
- B is two commands. The new one is "Add Selection to Workshop Message". The existing `prose-minion.workshopSelection` keeps replacing the excerpt and is retitled "Send to New Workshop Excerpt".
- B's toggle is off by default and remembered per window.

**Defaults taken for him** (each his to overturn; the live-pass checklist ends with the list):
- B: several pills a message by hand; a stale send is refused whole and the draft restored; 5,000 words, cut at capture; the kind is `selected-text`; any text document; Rewind restages the captured text; export shows the label only.
- A: `readPaths` 10; 256 KiB shared before the fit, and the turn's total when the window is unknown; `group` on a `<path>`; duplicate paths refused; a file's share in a multi-file read is not capped at the one-file 64 KiB.
- C: `‹` `›` still walk the whole history; text only; the cap stays 500.
- D: only the Workshop opts in.
- E: Continue always re-reads; no second button.

## Review findings and how they were settled

- **#259 F-01 (Medium): a whole-line read could make no progress.** A valid file can open with a 70 KiB line; the read would deliver nothing and hint the same `startLine` forever. Settled as **D2a**: a line is never cut, the file's outcome is `line-too-long` with nothing delivered, and every hint must name a later line or the same line with fewer files. A test follows every hint to the end.
- **#259, clarifications:** the snapshot cache is the window's, and the send is bound to its room by `roomRevision` (D11, D14); the duplicate-path rule is stricter than the lookup, on purpose (D4); `selectedText` is forward only (D13).
- **#260 F-01 (P2): Continue's read could lose to a send.** Two webview messages (choose the path, then read) let a message go out on the old passage. Settled as **one host operation**: `WORKSHOP_SET_SESSION_SCOPE { rereadFile }`, run by `WorkshopExcerptContinuation` through `runContextRefresh`, read first; a send during the read is refused in the room's busy words.
- **#263, a request, not a finding:** make the D5 share choice explicit. Done in the closing slice: `WorkshopResourceReadMultiFileShareNotCappedAtReadBytes.test.ts` and a dated addendum to D5.

## What the closing pass found

- **The route-owner count in `AGENTS.md` was already wrong.** It said 16; the guard's list (`WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES`) holds 23 with `WorkshopSelectedTextHandler`. The guide now says 23 and names the list. The ADR's "seventeenth composed route owner" was counting from the stale number.
- **A one-path `resource.read` still logs its path.** Only the multi-file log line is counts and groups (ADR D7 keeps the one-path line). `AGENTS.md` says so plainly.
- **The resource family is not a folder.** Its eight `WorkshopResource*.ts` modules sit in `application/services/workshop/`; only the shared fit is under `reads/`.

## Verification

On `epic/everyday-conveniences-close`, 2026-11-14, run locally:
- `npm run typecheck`: clean (core, webview, extension).
- `npm run lint`: 0 errors / 1,172 warnings.
- `npx jest --maxWorkers=3`: **870 suites / 12,312 tests / 59 snapshots**, all passing (B's count plus the one new suite of 6 tests).
- `npm run build` was not run in the closing pass.
- B's branch with the whole epic merged in (`5e398001`) measured 869 suites / 12,306 tests / 59 snapshots.

**Not verified, by anyone:**
- Nothing was run in the Extension Development Host.
- No live model call was made. Whether a persona follows a per-file continuation alone rests on the live pass.
- `VsCodeEditorContext`'s real selection events were only mocked.
- No screen reader pass, and Chromium 114 was not exercised.
- The definitions search was not timed on a realistic 500-entry history.

## Follow-ups

- **The engine backstop and the `memory.read` fit:** still in [Reads That Fit the Window](../.todo/features/feature-workshop-reads-fit-the-window/README.md). Until then "context window exceeded" is rarer, not gone.
- **Whole-context search for the Dictionary history:** search reads the 140-character context preview, not the whole context.
- **The multi-file card row:** the card's metadata lists each file, but how the card draws those rows and a raw continuation line has not been looked at; the live pass asks whether it needs work.
- **Continue's buttons** stay clickable during the read; the live pass asks Okey whether to disable them.
- **Files over 500 lines the slices touched:** [tech debt](../.todo/tech-debt/2026-11-14-everyday-conveniences-oversized-files.md).
- **Release notes** must say sessions holding `selectedText` are forward only.

## Links

- Reviews: [#259](../docs/pr-reviews/pr-259-everyday-conveniences-adr-review.md), [#260](../docs/pr-reviews/pr-260-reread-excerpt-review.md), [#261](../docs/pr-reviews/pr-261-collapsible-rail-review.md), [#262](../docs/pr-reviews/pr-262-dictionary-history-search-review.md)
- `AGENTS.md`: Workshop File Reads, Workshop Selected Text, Workshop Excerpt Re-read, Dictionary History Search, and the Full-tab shell's collapse rules
