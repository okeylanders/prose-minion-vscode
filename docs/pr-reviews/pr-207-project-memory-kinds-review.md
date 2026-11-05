# PR #207 review: Project Memory Theme and Idea kinds

- **Reviewed:** 2026-11-05
- **PR:** https://github.com/okeylanders/prose-minion-vscode/pull/207
- **Implementation head:** `6aedc5539071799894f64f7cc6208b5e0130f8f8`
- **Base:** `0a0f1a5b3533c08ce187602148673ad3fa60c67e` (`epic/workshop-project-memory`)
- **Verdict:** **Approved within the tested review scope. N-01 is closed; no open implementation or documentation finding.** This is a written review verdict, not a formal GitHub approval or a merge. The live persona and Extension Development Host checks remain open.

## Re-review at `1ab8fb27238f1ffa7172d77036276b1ffa7c4087` (2026-11-05)

**N-01 closed.** Read the complete two-file correction commit and both current files. The slice now quotes the unreadable-kind list in the correct order, and the ADR includes the 760px two-by-three exception. The additional slice note records the retained 940px threshold. No source, test, dependency or build configuration changed; the implementation evidence below still applies. The correction head's CI run [41952687161](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41952687161) was still running at re-review and is being watched. Actual rendered-layout and live-persona acceptance checks remain as disclosed below.

## Scope and source integrity

Reviewed all 19 changed files against the epic, Slice 6a, its ADR addendum, the repository's writer-data evolution rules, and the actual proposal, persisted-session, storage, library, frame and presentation consumers. Materialized the complete head and verified all **3,828 tracked blobs** against Git blob SHA-1, including repository symlinks. Reused the installed dependencies for the unchanged lockfile.

The accepted order is **decision → canon → theme → idea → open-thread → preference**. The format remains 1 because this memory format has not shipped; this widening does not justify a development-shape migration. Existing four-kind files remain valid. This does not promise that an older pre-Slice-6a build can read a newly created Theme or Idea file.

## Verified implementation

### Closed vocabulary, persistence and retrieval

The [single constant](https://github.com/okeylanders/prose-minion-vscode/blob/6aedc5539071799894f64f7cc6208b5e0130f8f8/packages/core/src/shared/types/projectMemory.ts#L18-L37) reaches the actual consumers, rather than only updating the sheet:

- File codec validation and canonical format-1 serialization.
- Draft validation and the library's guarded save/edit paths.
- Proposal trailer decoding and persisted proposal shape validation/cloning.
- `memory.catalog` request validation, filter propagation and rendered catalog selection.
- Initial room frames and full-memory reads.

**Executed independent witnesses:** for each of the six kinds, passed a proposal through the actual decoder, checked and cloned its persisted proposal, checked its draft, saved through the real library/store with the in-memory filesystem port, decoded the saved record, read it from the store, requested and rendered its filtered catalog alongside a different kind, checked its frame's `kind` attribute, read it whole, edited it, archived it, and restored it. All six paths retained the kind correctly.

A seventh independent witness saved a Canon note superseding an existing Idea. The original Idea's file bytes were unchanged, its full read reported it superseded, and its id left the next room's frame. This verifies that the new semantic guidance uses the existing supersession behavior correctly; choosing an idea is not an implicit rewrite of its original file.

### Grouping, labels and prompt boundaries

- The manager's [groups derive their order from the constant](https://github.com/okeylanders/prose-minion-vscode/blob/6aedc5539071799894f64f7cc6208b5e0130f8f8/packages/core/src/presentation/webview/hooks/domain/workshop/memory/workshopMemoryWords.ts#L37-L58). The reversed-input regression verifies all six groups in the intended order.
- Sheet, card and row label maps cover both new kinds. The `orbit` and `sparkle` names resolve to existing icon paths.
- The unreadable-kind explanation derives from the same list.
- Both persona prompts name all six kinds and distinguish what happens from what it means, an unsettled candidate from a settled choice, and an idea from the question it may answer. Prompt-sync tests pin these boundaries and order.
- The frame already emits the stored kind unchanged. The independent frame witness confirms Theme and Idea reach it; duplicating prompt guidance into every entry is unnecessary.

This is evidence about code and prompt delivery, not a claim that a live model always obeys those boundaries.

### Responsive kind field

The [actual CSS](https://github.com/okeylanders/prose-minion-vscode/blob/6aedc5539071799894f64f7cc6208b5e0130f8f8/packages/core/src/presentation/webview/styles/workshop/memory.css#L562-L582) uses three fixed columns by default and six only when the named kind field reaches 940px. The later, existing 760px viewport rule gives two columns on narrow panels. No `auto-fit`/`auto-fill` rule can create 5+1 or 4+2 rows. The sheet places the radio group inside the named container. The production structural tests and Chromium-floor guard pass.

The narrow two-column exception and possible description wrapping are disclosed in the slice and PR. The fixed track counts and unchanged equal-height grid behavior are consistent with that stated scope.

**Verification limit:** a real React/CSS review bundle compiled successfully, but local Chromium could not start because this execution sandbox disallows the required Unix socket. A reviewed escalation produced the same failure. Therefore this review does **not** independently confirm the author's browser measurements, actual font wrapping, keyboard interactions in Chromium, or the Extension Development Host layout. JSDOM component tests cover the six labels and new-kind selection. Keep the existing live pass for actual widths, editor fonts and zoom.

## N-01 · P3 · Closed at `1ab8fb27`: align two current documentation details with the implementation

This is nonblocking and does not require a product change.

1. [Slice 6a lines 35–36](https://github.com/okeylanders/prose-minion-vscode/blob/6aedc5539071799894f64f7cc6208b5e0130f8f8/.todo/epics/epic-workshop-project-memory-2026-11-04/slice-6a-kinds.md#L35-L36) quotes the unreadable-kind reason in the earlier order: “decision, canon, theme, preference, idea or open-thread.” The implementation and tests correctly use “decision, canon, theme, idea, open-thread or preference.” Update the quoted example.
2. The [ADR addendum's final sentence](https://github.com/okeylanders/prose-minion-vscode/blob/6aedc5539071799894f64f7cc6208b5e0130f8f8/docs/adr/2026-11-04-workshop-project-memory.md#L931-L933) says six across or three by two without mentioning the documented narrow-screen two-by-three exception. Add that exception so the decision and slice describe the same responsive behavior.

The historical four-kind design snapshot and original feature note are intentionally retained and are not this nit.

## Verification results

- **Local:** all three typechecks passed.
- **Local lint:** 0 errors / 1,165 warnings.
- **Local focused production tests:** **40 suites / 543 tests passed**, including codecs, read/write services, proposal and prompt boundaries, manager/sheet components, grouping and CSS floor.
- **Independent reviewer probes:** **1 suite / 7 tests passed**, covering the six seam-spanning lifecycle witnesses and Idea → Canon supersession.
- **Local full-suite attempt:** killed by the execution environment before completion, so it is not counted as a pass. An initial overlapping focused attempt was also killed; rerunning the focused suite with one worker and worker memory recycling passed as above.
- **Exact-head CI:** [run 41951307724](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41951307724), `verify` succeeded. Read its job steps and logs: **692 suites / 9,707 tests / 59 snapshots passed**, typechecks passed, lint was 0 errors / 1,165 warnings, and both webpack bundles built.
- No live provider call, manual VS Code pass, formal GitHub approval or merge was performed. Reviewer-only probes and the browser harness are not implementation changes.

## Remaining live-pass work

Use the slice's existing checklist to propose and save a Theme and an Idea, ask a persona about the Idea and verify it remains explicitly unsettled, then choose it and verify the resulting Canon/Decision supersedes it. Check the six-, three- and two-column layouts at the actual editor's font, width and zoom. These remain product acceptance checks, not hidden claims in this approval.
