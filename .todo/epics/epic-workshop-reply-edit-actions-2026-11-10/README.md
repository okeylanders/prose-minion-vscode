# Epic: Workshop Reply Edit Actions

**Status:** Design approved (Okey, 2026-11-10); he took all eight recommendations. Slice 1 is merged (#251, `32a0a84c`). Slice 2 is merged (#252, `fb0a86e6`). The host side is complete. Message Reactions is merged into the epic (`e250a6d7`). Slice 3 is merged (#253, `b7870e79`). All three build slices are in the epic. Okey's first live run found that written-out alternative versions drew no chip; Slice 3b fixes that. Nothing targets `main` without his word.
**Priority:** Medium
**Created:** 2026-11-10
**Integration branch:** `epic/workshop-reply-edit-actions`, cut at `c0a6e497` ("Merge Workshop Persona File Edits into main (#249)"), which is `main`'s tip on 2026-11-10. The brief named `926190d9`, the tip of `epic/workshop-persona-file-edits`; that epic had already reached `main`, so the branch was fast-forwarded from `926190d9` to `main` before its first commit. Each slice is built on `epic/workshop-reply-edit-actions-slice-<N>-<slug>` and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-10: A Reply Offers Its Fixes and Rewrites as Edits](../../../docs/adr/2026-11-10-workshop-reply-edit-actions.md) (Proposed; design approved 2026-11-10, Accepted after the live pass)
**Idea as filed:** [feature note](../../features/feature-workshop-reply-edit-actions/README.md). It is a byte-identical copy of the file on `claude/idea-inbox`, and is never edited here. Status is tracked in this README.
**Upstream of this epic:** Persona File Edits (on `main`). Message Reactions (`epic/workshop-message-reactions`, ADR 2026-11-07) was merged into this epic at its tip `3e2b6b8a` (`e250a6d7`, 2026-11-10, at Okey's request, ahead of its reaching `main`). So this epic carries Reactions: it goes to `main` after Reactions does, or with it, on Okey's word.

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
| 1 | The declaration | The offer tag, codec and bounds; its place in `extractWorkshopReplyControls`; resolving its file; `editOffers` on the turn, in the session codec and omitted from the transcript; the persona prompt, a worked example and sync tests. No route, no UI. | D1, D2, D8 | Done (PR #251, `32a0a84c`; [notes](slice-1-declaration.md); [review](../../../docs/pr-reviews/pr-251-reply-edit-offers-declaration-review.md), no findings) |
| 2 | The press | The action and result routes; the request turn and the directive frame; the engine's `finalReplyCheck`; reading the answer; `intent` and the fixes policy; the derived status in the turn's view; Rewind, Branch and reopen witnesses. No UI. | D3–D7, D9 | Done (PR #252, `fb0a86e6`; [notes](slice-2-press.md); reviews: [first](../../../docs/pr-reviews/pr-252-reply-edit-press-review.md), [re-review](../../../docs/pr-reviews/pr-252-reply-edit-press-rereview.md), [approval](../../../docs/pr-reviews/pr-252-reply-edit-press-final-approval.md)) |
| 3 | The footer | The footer row, the chips and their states, the widget chip's move, the request line, the answer's line and card marks, the live region; an offer-only reply's line. | U1–U6 | Done (PR #253, `b7870e79`; [notes](slice-3-footer.md); [evidence](evidence/); [review](../../../docs/pr-reviews/pr-253-reply-edit-footer-review.md), N1 fixed) |
| 3b | Options and a firmer declaration | From Okey's first live run: a rewrites offer names up to four alternative versions, each with its own chip, press, request, answer and status; the teaching makes declaring the rule; a per-turn reminder frame | The ADR's second addendum of 2026-11-10 | Built and pushed on `epic/workshop-reply-edit-actions-slice-3b-options`; no pull request yet ([notes](slice-3b-options.md); [evidence](evidence/)) |
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
- **2026-11-10, PR #251.** Reviewed at `7b8f63ca` with no findings; merged at `5f18a019` as `32a0a84c`, green. Carried forward: an offer-only reply reads as an empty reply until Message Reactions' "Replied without a message." line is here (settle at the Reactions merge); `completeRun`'s new positional argument meets Reactions' in the same slot.
- **2026-11-10, Slice 2.** The press, host and contracts only. Baseline on the epic's tip (`603ad364`): 802 suites / 11,284 tests. After: 810 suites / 11,415 tests, typecheck clean, lint unchanged at 0 errors, build passing. Choices and details are in [slice-2-press.md](slice-2-press.md). For Slice 3: every answered status carries `askAgain` (a `none` answer may be asked again, by D7), and the view leaves offers out while file edits are off.
- **2026-11-10, PR #252.** Reviewed at `6841476c`: three P2 findings and a test teardown. All reproduced and are fixed in `087bc158`: a cut-off answer is refused before anything is retained; a rejected reply is retained only in the host's form; an excerpt offer keeps its bound document through the directive and staging. After: 812 suites / 11,440 tests.
- **2026-11-10, PR #252 re-review.** F-01 to F-03 checked out; one P2 remained (R1), the limit the first ledger declared. Fixed in `a31ea6c2`: the engine holds a press's exchange until its answer is adopted, so a press stopped or refused while its edits are staged retains nothing. After: 812 suites / 11,454 tests. The same order for ordinary messages is filed in `.todo/tech-debt/2026-11-10-workshop-reply-retained-before-settlement.md`.
- **2026-11-10, PR #252.** Three reviews. F-01 (a cut-off or interrupted answer), F-02 (rejected prose retained), F-03 (an excerpt offer's bound file) fixed in `087bc158`; R1 (Stop or file-edits-off during staging) fixed in `a31ea6c2` by deferring retention. Approved at `d7c44f84`, merged at `453087a7` as `fb0a86e6`, green. The ADR's addendum of 2026-11-10 records what the build settled. Follow-up filed: [a reply retained before settlement](../../tech-debt/2026-11-10-workshop-reply-retained-before-settlement.md), for ordinary messages.
- **2026-11-10, Slice 3.** The footer and chips, webview only but for the offer-only reply's line. Baseline on the epic's tip (`e250a6d7`, Message Reactions merged): 832 suites / 11,724 tests. After: 836 suites / 11,779 tests, typecheck clean, lint unchanged at 0 errors and 1,171 warnings, build passing. Choices and details are in [slice-3-footer.md](slice-3-footer.md); rendered evidence is in [`evidence/`](evidence/). One Message Reactions assertion changed deliberately: the corner's parent is now the footer row. An offer-only reply reads "Replied without a message.", displayed and retained, which settles the item carried from PR #251.
- **2026-11-10, PR #253.** Approved on review with one non-blocking note, N1 (chips drew in the reply's declared order): fixed in `8be7c0b0` (fixes first, always) and verified. Merged at `1f2c230f` as `b7870e79`, green. Not yet run in the Extension Development Host or against a live model: that is Slice 4.
- **2026-11-10, first live run (Okey, Sonnet 5.5).** A reply with three written-out versions of one passage drew no chip. Reproduced against the live model with the shipped teaching and an *Alice* excerpt (two diagnostic calls, then two with the changed wording, through the session's OpenRouter connection): the typos were declared, the versions were not; with a firmer rule and per-version options, both were declared, twice out of two. The ADR's second addendum records the change; Slice 3b builds it.
- **2026-11-10, Slice 3b.** Options and a firmer declaration, from the first live run. Baseline on the epic's tip (`1e39168b`): 836 suites / 11,780 tests. After: 841 suites / 11,889 tests, typecheck clean, lint unchanged at 0 errors and 1,171 warnings, build passing. Choices and details are in [slice-3b-options.md](slice-3b-options.md); evidence is `evidence/8-options.png` to `10-options-narrow.png`. The reminder frame rides a host or guest persona's message (a guest's join included) while file edits are `ask` and the room's excerpt came from a file; never a press, never a tool. One existing assertion changed deliberately (the host's first message now carries the reminder). Not run against a live model in this slice: that is Okey's test and Slice 4.
- **2026-11-10, Slice 3b, after the second live run.** A requested rewrite lifts the prose rewrite ceiling: a card from a rewrites answer carries `intent: 'rewrites'`, and the gateway skips the ceiling for it alone. Every other rule of the class still refuses it, and an ordinary proposal keeps the ceiling. Recorded in the ADR's second addendum and in [slice-3b-options.md](slice-3b-options.md). It relaxes a guard on writes on the relay of Okey's decision; confirm with him at review.
