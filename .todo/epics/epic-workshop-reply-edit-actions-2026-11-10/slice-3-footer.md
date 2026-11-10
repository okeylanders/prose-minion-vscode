# Slice 3: The footer and chips

**Status:** Built and pushed on `epic/workshop-reply-edit-actions-slice-3-footer`, cut from the epic at `e250a6d7` (Message Reactions merged). No pull request opened; the coordinator opens it.
**Date:** 2026-11-10
**Decisions:** ADR 2026-11-10 U1–U6, with the addendum of 2026-11-10 (`askAgain` drawn, no pronoun in host lines), and the addendum's last item (an offer-only reply's line).
**Scope:** The webview: one hook, the footer's components and stylesheet, and seams in the bubble, thread, router and app. Host side: two lines, for the offer-only reply.

## What was built

| Piece | Where |
|---|---|
| The footer row: offers at the left, the reaction corner at the right | `components/workshop/editOffers/WorkshopTurnFoot.tsx` |
| One chip, every state | `components/workshop/editOffers/WorkshopEditOfferChip.tsx` |
| What a chip reads and does, pure | `hooks/domain/workshop/editOffers/workshopEditOfferChipView.ts` |
| The press's line and the answer's line, each with a link to the source reply | `components/workshop/editOffers/WorkshopEditOfferLines.tsx` |
| The transport: the press, its correlated answer, held refusal words, the announcement | `hooks/domain/workshop/useWorkshopEditOffers.ts` |
| The styles (flex and wrap only, the full tabs' tokens, no new color) | `styles/workshop/editOffers.css`, imported after `reactions.css` |
| The answer's heading and each card's mark | `fileEdits/WorkshopTurnFileEdits.tsx` (the heading), `WorkshopFileEditCard.tsx` (an optional `mark`) |
| The seams | `WorkshopTurnBubble.tsx`, `WorkshopThread.tsx`, `useWorkshopAppMessageRouter.ts`, `WorkshopApp.tsx` |
| An offer-only reply reads "Replied without a message." | `WorkshopRunCompletion.ts` (display), `utils/workshopReplyControls.ts` (retained history) |

## How it reads

- **The footer (U1).** A reply's last row is `.pm-ws-turn-foot`. At the left: a quiet lead "As edits" with the pen icon, the fixes chip, the rewrites chip, then the widget recommendation chip, which no longer has a row of its own. At the right: the reaction corner, composed unchanged. The row wraps; in a narrow column the corner sits under the offers at the right. A writer's message keeps its corner as it was.
- **A chip (U2).** One `<button>` keyed by its kind. It never unmounts or moves, so it keeps focus through every status.

  | Host status | The chip reads | A press |
  |---|---|---|
  | `open` | "**3** fixes" | asks |
  | `asked`, or this webview's press is out | "Asking Jill for 3 fixes…" (`aria-busy`) | nothing |
  | `answered` | "✓ 3 fixes suggested ⌄" | goes to the answer's bubble |
  | `nothing-to-change` | "**3** fixes · nothing to change · ask again" | asks |
  | `ask-again` | "**3** fixes · ask again" | asks |

- **Waiting (U5).** A chip that would ask but cannot stays focusable with `aria-disabled`, keeps its face, and carries the reason as its description (`aria-describedby`) and title: the author left ("Jill isn’t in this room now"), a run is going, or the room's lock is held (the refusal table's words). A chip that goes to its answer never waits.
- **The press (U3).** A turn with `editOfferRequest` is a divider line holding the host's sentence and a "That reply ↑" link. It is never a writer bubble, and offers no Rewind or reactions.
- **The answer (U4).** A turn with `editOfferAnswer` shows the host's sentence as plain text in place of the body, with the same link. Its cards sit under "Suggested file edits · fixes" (or "· rewrites") even when there is one, and each card carries a mark: its `intent`, or the answer's kind. A `none` answer is the host's line with the persona's why, and no cards.
- **Announced once (U6).** The hook owns one polite live region (`data-pm-edit-offer-announcer`, beside the reactions' own). It says the host's words for the result of this webview's own press: the answer, or why there is none.
- **Focus.** It moves only on a press: an answered chip to the answer's bubble, and either link to the source bubble, through the thread's existing `jumpToTurn` (a turn outside the window opens in the read-only preview, as a bookmark does).

## Choices taken

1. **The footer is its own component.** `WorkshopTurnFoot` renders the offers, the widget chip the bubble hands it, and the corner. The bubble grew by the seam (823 to 838 lines).
2. **An empty footer takes no row.** A tool report nobody reacted to has an empty corner and no offer; the row gets `pm-ws-turn-foot-bare` (hidden), with the corner still mounted inside, as its focus rules need. This is worked out from the corner's own rule (`isWorkshopReactableTurn`) without `:has()`.
3. **One Message Reactions assertion changed, deliberately.** `WorkshopApp.reactions.test.tsx` asserted the corner's parent is the bubble. U1's row makes that the footer, so the assertion now reads: the corner's parent is `.pm-ws-turn-foot`, whose parent is the bubble. The corner's component, hook and focus rules are untouched.
4. **`askAgain` is drawn as words on the chip.** "nothing to change · ask again" and "· ask again"; an `answered` status that carried `askAgain` would read "suggested · ask again" and ask. The ADR's table sent a nothing-to-change press to the answer line; the addendum's second press takes its place.
5. **A chip reads asked from its own press, too.** The host's `asked` arrives only with a snapshot, so the chip also reads asked while this webview's request is out, until its result lands. One request per chip at a time.
6. **A refusal's words are a description, and are announced.** They stay as the chip's description until the next snapshot or the next press of that chip. They are not drawn beside the chip, which would move its neighbors.
7. **The links read "That reply ↑".** The host's sentence already names the persona and, in the answer, the reply's time; the link adds no pronoun and no second time. Its accessible name is "That reply. Go to the reply these edits were asked from".
8. **The answered chip goes to the answer's bubble,** not to a card: bubbles are the focusable targets the thread already has.
9. **The answer's line is plain text,** never Markdown: a display path with underscores or asterisks reads as written.
10. **The widget chip keeps its class and behavior.** In the footer it takes the offers' height and pill shape by one scoped rule; its dashed accent stays. Its existing tests pass unchanged; the new footer tests pin its new place.
11. **An offer-only reply.** A reply that held only edit-offer frames is displayed and retained as `WORKSHOP_NO_MESSAGE_REPLY_LINE`, host-written (no model stamp). Its offers are still dropped (`no-prose`). It does not take `noMessage`, which stays the mark of a dropped reaction alone. `workshopTrailersOnlyReplyLine` learned no new kind.
12. **No export change.** No thread rule the HTML export mirrors changed (`shell.css`, `session.css` and `standingDirectiveRail.css` are untouched), so the mirror was not regenerated and its pin test passes as it was.
13. **`jest.config.js`** stubs the new stylesheet with the three it already stubbed.

## Things to know

- **Chips need the host's view.** With file edits off the host sends no offers, so nothing is drawn; the live pass should toggle the setting with a declared reply on screen.
- **The sibling chip between a press and the run's first status** is briefly pressable; the host refuses that press with `run-active`, and the chip says so.
- **The request line carries no Rewind.** Rewinding to the source reply removes the press and its answer together.
- **Not built:** nothing in U1–U6 is left out. The mockups' "her" is not built, per the addendum.

## Tests added

| Suite | Covers |
|---|---|
| `hooks/domain/workshop/useWorkshopEditOffers.test.ts` | The press's payload (ids only); one request per chip; its own answer taken once; another chip's, another room's and a duplicate ignored; refusal words held until the next snapshot; the announcement's serial; a new room; no persistence |
| `hooks/domain/workshop/editOffers/workshopEditOfferChipView.test.ts` | Each status's label and accessible name; counts and singulars; `askAgain` on each answered state; the three waiting reasons and their order; a chip that goes to its answer never waits |
| `components/workshop/editOffers/WorkshopTurnFoot.test.tsx` | The row with and without reactions, a widget chip and offers; the group's name; tab order; the widget chip's move; the empty footer; each state's class, text and name; one node and its focus across every status; presses; waiting chips; the press's line; the answer's line, heading and marks; an ordinary reply's cards unchanged |
| `WorkshopApp.editOffers.test.tsx` | Through the real app: chips from the snapshot; the posted press; node and focus kept from press to answer; the live region saying the outcome once (not again on a duplicate result or a later snapshot); the answered chip's and both links' focus moves; refusal words until the next snapshot; another room's result; nothing persisted |

Updated: `WorkshopApp.reactions.test.tsx` (choice 3), `workshopStyles.test.ts` (the new sheet in the cascade), `WorkshopEditOfferTurns.test.ts` and `workshopReplyEditOffers.test.ts` (an offer-only reply's line, displayed and retained).

## Evidence

`evidence/render.js` renders the real `WorkshopTurnBubble` under the Workshop's real stylesheets and screenshots it with Playwright (`node .todo/epics/epic-workshop-reply-edit-actions-2026-11-10/evidence/render.js`).

| File | Shows |
|---|---|
| `1-footer.png` | The footer: lead, both chips, the widget chip, the corner |
| `2-chip-states.png` | Open, asked with a waiting sibling, answered, nothing to change, ask again, author left |
| `3-answer.png` | The press's line and the answer with its marked card |
| `4-nothing-to-change.png` | A `none` answer |
| `5-narrow.png` | A 430px column: the row wrapped, the corner under the offers at the right |
| `6-without.png` | A plain reply, and a widget chip with no edit offer |
| `7-chip-focus.png` | A chip's keyboard focus ring |
| `layout.json` | Measured boxes: one row when wide, the corner under the offers when narrow, no horizontal scroll |

## Verification

| Check | Baseline (epic tip `e250a6d7`) | After |
|---|---|---|
| `npx jest` | 832 suites / 11,724 tests / 59 snapshots, all passing | 836 suites / 11,779 tests / 59 snapshots, all passing |
| `npm run typecheck` | — | passes |
| `npm run lint` | 0 errors, 1,171 warnings | 0 errors, 1,171 warnings |
| `npm run build` | — | passes |

- The baseline was taken in a clean worktree of the epic's tip, under Node 22. No test failed on the merge commit.
- `packages/core/src` has no `from 'vscode'` import (the only matches are the guards' own string literals).
- No new source or test file is over 500 lines; the largest is the footer's test at 417. Files already over grew only by the seam: `WorkshopTurnBubble.tsx` +15 (823 to 838), `WorkshopApp.tsx` +20.
- `webviewCssFloor.test.ts` and `workshopStyles.test.ts` pass with the new sheet.
- No test makes a model call.
