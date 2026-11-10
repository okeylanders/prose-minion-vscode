# Epic: Workshop Reply Edit Actions

**Status:** Design approved (Okey, 2026-11-10); he took all eight recommendations. Slice 1 is built and awaits its PR.
**Priority:** Medium
**Created:** 2026-11-10
**Integration branch:** `epic/workshop-reply-edit-actions`, cut at `c0a6e497` ("Merge Workshop Persona File Edits into main (#249)"), which is `main`'s tip on 2026-11-10. The brief named `926190d9`, the tip of `epic/workshop-persona-file-edits`; that epic had already reached `main`, so the branch was fast-forwarded from `926190d9` to `main` before its first commit. Each slice is built on `epic/workshop-reply-edit-actions-slice-<N>-<slug>` and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-10: A Reply Offers Its Fixes and Rewrites as Edits](../../../docs/adr/2026-11-10-workshop-reply-edit-actions.md) (Proposed; design approved 2026-11-10, Accepted after the live pass)
**Idea as filed:** [feature note](../../features/feature-workshop-reply-edit-actions/README.md). It is a byte-identical copy of the file on `claude/idea-inbox`, and is never edited here. Status is tracked in this README.
**Upstream of this epic:** Persona File Edits (on `main`). Message Reactions (`epic/workshop-message-reactions`, ADR 2026-11-07) reaches `main` first; this epic merges `main` after it lands, and builds its bubble slice only then.

## Goal

A persona's reply that holds simple fixes or rewrites shows a chip for each. One press asks that persona to suggest exactly those as file edits, and the answer comes back as edit cards that name the reply they came from. The bubble gains no row.

## The design in brief

- **The reply declares.** A small `<prose-minion-edit-offer>` trailer per kind (`fixes`, `rewrites`), naming one file and an optional count. The host strips it, checks it and resolves its file once.
- **The bubble's last row becomes its footer.** Offers sit at the left end of the row the reaction corner already takes, and the widget chip moves in beside them.
- **A press sends ids only.** The host reads the reply from its ledger and sends its author a framed directive that quotes it.
- **The answer is trailers or nothing.** File-edit trailers become ordinary cards. Otherwise the host says there was nothing to change. The persona's prose never shows.
- **Fixes are held to a fix's size** by host code: find-and-replace only, a few characters, no line breaks.
- **"Used" is derived** from the thread, so Rewind, Branch and reopen need no rule of their own.

Mockups are in [`mockups/`](mockups/): four PNGs and their HTML source. Render them again with `node .todo/epics/epic-workshop-reply-edit-actions-2026-11-10/mockups/render.js`.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, this README, mockups, the idea note | All | Done (`1cc96d73`); approved by Okey 2026-11-10 |
| 1 | The declaration | The offer tag, codec and bounds; its place in `extractWorkshopReplyControls`; resolving its file; `editOffers` on the turn, in the session codec and omitted from the transcript; the persona prompt, a worked example and sync tests. No route, no UI. | D1, D2, D8 | Built on its slice branch; awaiting its PR ([notes](slice-1-declaration.md)) |
| 2 | The press | The action and result routes; the request turn and the directive frame; the engine's `finalReplyCheck`; reading the answer; `intent` and the fixes policy; the derived status in the turn's view; Rewind, Branch and reopen witnesses. No UI. | D3–D7, D9 | Not started |
| 3 | The footer | The footer row, the chips and their states, the widget chip's move, the request line, the answer's line and card marks, the live region. **Starts after Message Reactions is on `main` and merged here.** | U1–U6 | Not started |
| 4 | Verify live | Extension Development Host pass with Okey; tune the fix bound; ADR → Accepted; the codec's release decision; `AGENTS.md`; memory bank | — | Not started |

**Order:** 1 → 2 → 3 → 4.

## How the slices are built

The same flow as Helper Agent and Message Reactions.

- **One implementation thread per slice.** It works on its slice branch, cut from the epic, and reads this README, the ADR, and `AGENTS.md`: the Workshop sections, Draft Edit and Helper Agent. It builds, verifies, commits and pushes, then reports its head and counts to the coordinator.
- **The coordinating thread** (`session_01UrwceshsAzjhqRxfnXZu3z`) opens each PR into `epic/workshop-reply-edit-actions` and watches it. Each PR is reviewed, with its ledger in `docs/pr-reviews/`.
- **Findings are fixed on the slice branch,** and answered in the ledger.
- **Merging into the epic** is a merge commit pinned to the PR's head, once it is green and its findings are settled.
- **Nothing targets `main`** without Okey's word.

## Hands off

- Never commit to `claude/idea-inbox`, `epic/workshop-persona-file-edits*`, `epic/workshop-message-reactions*` or `main`.
- Never edit the idea note.

## Verification (every slice)

- `npm run typecheck`
- `npm run lint`: no new errors.
- `npx jest`: the full suite passes, with counts recorded in the progress notes. Slice 1 takes the baseline on the epic's tip.
- `packages/core/src` has no `from 'vscode'`.
- No new file goes over 500 lines. A file already over grows only by the seam (`WorkshopTurnBubble.tsx` is 809 lines; `WorkshopRoomHandler.ts` is 1,694).
- Tests make no live, billable model call.
- Logs never carry the writer's text. Fixtures use *Alice*.

## Completion Criteria

- Chips are drawn only from the host's view of a declared, checked offer, never from the reply's prose.
- A press carries a turn id and a kind, and nothing else.
- Every answer names its source reply and kind, and its cards show both.
- A press yields edit cards, or a host-worded "nothing to change", never the persona's prose.
- A fixes card over the bound is refused by host code.
- A cut that removes an answer reopens its offer, with no stored state to repair.
- No bubble has more footer rows than it has today.
- A reply's "Add a next step" rows and the to-do list behave exactly as before, with and without an offer.
- Each criterion is backed by a named test, or stated as covered by the Slice 4 live pass.

## Decisions taken (Okey, 2026-11-10)

All eight of [the ADR's questions](../../../docs/adr/2026-11-10-workshop-reply-edit-actions.md#the-questions-as-put-okey-took-each-recommendation-2026-11-10), as recommended:

1. The footer row is the home, with the widget chip moved in.
2. Fixes go through the persona, held to the fixes policy; not Proofread.
3. An answer shows no persona prose.
4. The fix bound is 40 changed characters, tuned in the live pass.
5. One press at a time, never queued.
6. The action row is not thinned in this epic; it gets its own feature note after this is live.
7. Ask again, under D7's rule.
8. No "both" press.

**To-dos are untouched** (Okey asked, 2026-11-10): the offer trailer is stripped before the findings reader runs, the footer sits below "Add a next step", an answer adds no findings, and the to-do evidence frame is delivered as on any message.

## Progress Notes

- **2026-11-10, Slice 0.** Branch cut at `c0a6e497`. The idea note copied unchanged from `claude/idea-inbox` (blob `4bee4019`, identical). ADR, README and mockups written. No code changed, so no test run was taken; Slice 1 records the baseline.
- **2026-11-10.** Okey approved the design and took all eight recommendations. Added the to-do rules to the ADR (U1, D4, D5) after his question.
- **2026-11-10, Slice 1.** The declaration, host only. Baseline on the epic's tip: 797 suites / 11,186 tests. After: 802 suites / 11,284 tests, typecheck clean, lint unchanged at 0 errors. Choices and details are in [slice-1-declaration.md](slice-1-declaration.md).
