# PR #297: Passage Search closeout re-review

Astra 6.2 reviewed `2bb0422392557e801575a373a738e95d2e55a412` against `epic/passage-search` at `5b747f6bb02b283707007782bea7fb26511e5b6a`. **One documentation correction remains before using Section D for a paid live pass.** No runtime blocker is asserted.

## P2: A prior refusal does not establish the next card’s planning conditions

`.todo/epics/epic-passage-search-2026-11-20/live-pass.md:165–170` uses an earlier sidebar refusal on the same model to gate a fresh Workshop card. This shows the earlier dispatch knew the window, not that the new card starts with an unknown window. Workshop also replans on Run (`WorkshopPassageSearchHandler.ts:213–227`), so newly learned facts can re-chunk/reprice or avoid refusal. The deterministic combined acceptance fixture deliberately separates pricing and dispatch catalog views (`WorkshopPassageSearchCombinedAcceptance.test.tsx:8–13,98–117,185–198`).

Keep the exact refusal verification in that fixture. For the live pass, record the scenario as not reproduced unless this card’s own estimate and Run re-plan use an unknown window and a local refusal actually occurs at dispatch. Do not spend trying to force the condition. One dispatched read plus one organizing pass, and a separate persona response after Send, are fixture/observed-scenario counts, not a generic live expectation.

## Resolved

- The checklist isolates the intended sidebar scope and resets persistent selections.
- The ADR and agent guide now distinguish thrown invocation failures from returned unusable replies that include provider usage.
- The optional all-claims-dropped check distinguishes the UI fallback from detailed logs.

Static inspection only. Six Markdown files in the pinned comparison, including the prior review report. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45091823043). No live test, spend, or merge.
