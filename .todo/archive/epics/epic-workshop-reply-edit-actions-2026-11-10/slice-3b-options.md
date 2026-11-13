# Slice 3b: Options and a firmer declaration

**Status:** Built and pushed on `epic/workshop-reply-edit-actions-slice-3b-options`, cut from the epic at `1e39168b`. No pull request opened; the coordinator opens it.
**Date:** 2026-11-10
**Decisions:** ADR 2026-11-10, second addendum ("alternative versions get a chip each").
**Why:** Okey's first live run. A persona wrote out three versions of one passage and no chip was drawn.

## What was built

| Piece | Where |
|---|---|
| `<option>` in the offer trailer, and its named faults | `utils/workshopEditOfferProtocol.ts` |
| The two bounds: `optionsPerOffer` (4), `optionCharacters` (40) | `PROMPT_BUDGETS.workshopEditOffers` |
| `options` on an offer; `option` on the request, the answer, the press and its result; `optionStatuses` in the webview's view | `shared/types/messages/workshop/editOffers.ts` |
| The session codec's new shapes | `session/WorkshopEditOfferRecords.ts` |
| The teaching: declaring is the rule; `<option>`; a worked example with three versions | `resources/system-prompts/workshop-personas/reply-edit-offers.md` |
| The per-turn reminder frame | `fileEdits/WorkshopEditOfferReminder.ts`; reserved in `utils/workshopPromptFrames.ts`; wired in `WorkshopRoomHandler` |
| The press with its option, checked against the stored offer | `WorkshopEditOfferHandler.ts` |
| Status per option | `fileEdits/WorkshopEditOfferStatus.ts`, `WorkshopFileEditWebviewView.ts` |
| The directive naming the chosen version | `utils/workshopEditRequestFrame.ts` |
| The host's lines naming it | `shared/constants/workshopEditOfferWords.ts`, `WorkshopEditOfferAnswerCompletion.ts` |
| A chip per option | `WorkshopTurnFoot.tsx`, `WorkshopEditOfferChip.tsx`, `workshopEditOfferChipView.ts`, `useWorkshopEditOffers.ts` |

## How it reads

- **The trailer.** A `rewrites` offer may hold one to four `<option>` elements. Each is trimmed, one line, 1 to 40 characters. The frame is dropped, with a named fault, for:
  - an option on a `fixes` offer (`option-on-fixes`);
  - a fifth option (`too-many-options`);
  - an empty one (`empty-option`);
  - one over 40 characters or holding a line break or control character (`invalid-option`);
  - two alike once case-folded (`duplicate-option`).
- **The teaching.** "Most replies declare nothing" is gone. The opening is the sentence the coordinator probed with, word for word. "Never declare an offer as an invitation for something not written" stays. A new section teaches `<option>`: one per version, labeled as the prose labels it, left out when the rewrites belong together.
- **The reminder.** One line in `<workshop-edit-offer-reminder>`, last of the evidence frames before the writer's message. It names the trailer without writing its tag.
- **The press.** `option` is an index into the stored offer's options. The host reads the label from its own ledger.
- **Status.** A request or answer counts only for the option it names. Pressing one version uses up neither another version nor the fixes.
- **The directive.** `The writer chose "Version 1" from your reply of 2:02 pm, quoted below. Suggest that version only, as file edits.` The middle paragraph asks for that version's prose alone and says to leave the others out.
- **The lines.**
  - Request: "Asked Jill for an edit · Version 1, from that reply."
  - Answer: "Suggested Version 1 as an edit to chapters/…, from the 2:02 pm reply."
  - Nothing to change: "Jill found nothing to change for Version 1: …"
  - Announced: "Jill suggested Version 1 as an edit to chapters/…. It is at the end of the conversation."
- **The footer.** "As edits", the fixes chip, then one chip per option in the order declared. Each chip has the five states, the three waiting reasons and one stable node. Its accessible name is "Version 1. Ask Jill to suggest it as an edit to chapters/…". An offer without options keeps its one "N rewrites" chip.

## Choices taken

1. **When the reminder rides.** All of these must hold:
   - suggested file edits are `ask`;
   - the room's excerpt has a file source (`workshopExcerptSourceUri` is defined). A pasted excerpt and an open conversation get no reminder;
   - the message goes to a host or guest persona's own conversation. A guest's join counts;
   - the run is not a press.

   It never rides a tool run, its synthesis or a direct tool message. A room with catalog files but no file-backed excerpt gets no reminder, though a `<group>`/`<path>` offer would still be kept there; the teaching in the system prompt still applies.
2. **Where the reminder sits.** On a message it rides the thread-artifact frames' slot, last, as the press's directive does. No prompt builder changed. A guest's join has no such slot, so there it shares the reaction invite's slot, after the invite. No Reactions code changed.
3. **A wrong option is `no-offer`.** An option the offer does not have, none when it has them, or one on an offer without them: the turn holds no such offer. An option that is not a whole number from zero up is `invalid-request`. No refusal kind was added.
4. **Status travels as `optionStatuses`.** An offer with options carries one status per option in its view and no `status` of its own. The session codec refuses both keys.
5. **The codec holds `option` to an index within the bound** (0 to 3) and to a rewrites press. Which offer it names is read from the thread, as the source turn id is.
6. **An option chip carries no count.** A version is one thing to ask for. `<count>` beside options is read and kept but not drawn.
7. **A single option is allowed.** The addendum says "up to" four.
8. **The request line drops "their".** With an option it follows the addendum: "…from that reply." The line without an option is unchanged.
9. **Retained history is unchanged.** An answer is still retained as "Suggested N rewrites as file edits."; the label is not written there.
10. **The transcript.** The request and answer lines include the label, since it is in the turn's content: declared, bounded text, as a card's why is. `editOffers` stay omitted, so a version nobody pressed appears nowhere in a transcript, an export or recall. Tested.
11. **Logs carry the option's index, never its label.**
12. **A label is shown as text.** The chip renders it through React; the directive strips quotes, angle brackets and line breaks from it after neutralizing reserved frames.
13. **No checkpoint normalization.** The new fields are optional and additive; no development checkpoint held another shape.

## A requested rewrite lifts the ceiling (added after Okey's second live run)

A press on a rewrites chip worked, and its card was then refused at Apply by ADR 2026-11-05 D5's rewrite ceiling. The card replaced a bracketed placeholder paragraph with written-out prose. The coordinator relayed Okey's decision ("our limit on edits may be too small"); the ADR's second addendum now records it.

- **What changed.** A card staged from a rewrites answer carries `intent: 'rewrites'`. `FILE_EDIT_INTENT_POLICIES.rewrites` is `{ liftsRewriteCeiling: true }`, and the gateway reads its policy through `fileEditPolicyWithIntent`, so the ceiling is skipped at the plan and before every attempt.
- **Size of the change.** A policy lookup. The gateway's two ceiling checks are untouched; they read a policy that has no ceiling. `FileEditIntentPolicy` is now `{ narrows?, liftsRewriteCeiling }`, with the fixes rows under `narrows`.
- **What still refuses a requested rewrite,** for the same reason as a proposal nobody asked for (tested pair by pair):
  - a whole-file `<rewrite>` of prose;
  - a replace that reaches into a link target or inline code;
  - a replace that adds a heading or a list (`markup`), small or whole-passage;
  - an append past `insertWords`;
  - a quote found nowhere, or twice;
  - a replacement past the trailer's `replaceWithCharacters` (the frame is dropped, so the press is `no-answer`).
- **Unchanged.** An ordinary proposal with the identical operations is still refused `rewrite-ceiling`. A fixes card is still `more-than-a-fix`.
- **The intent is the host's.** It is the pressed offer's kind, read from the ledger. A file-edit frame that names an `<intent>` is dropped as malformed, and a press that carries an `intent` field is read as if it did not.
- **The card's mark** still reads `intent ?? the answer's kind`, so a rewrites card saved before this change draws the same and keeps the ceiling.
- **The session codec** takes `intent: 'fixes' | 'rewrites'`. The transcript still carries no intent.
- **The teaching** says a pressed rewrite may replace the whole passage the reply reworded, never the whole file. It does not name the ceiling. A sync test holds that.
- **Tests:** `ProjectFileEditGatewayRewrites.test.ts` (new, the real applier and the retry path), and four cases in `WorkshopEditOfferOptionRoutes.test.ts`.

**This relaxes a guard on writes to the writer's files.** It rests on the coordinator's relay of Okey's decision; it should be confirmed with him at review.

## Things to know

- **One existing assertion changed deliberately.** `WorkshopRoomHandler.roomAndRun.test.ts` expected the host's first message to be the reaction invite and the writer's words. The reminder now sits between them.
- **The existing worked example changed.** It is now two examples: fixes beside three versions, and rewrites that belong together.
- **Not run against a live model here.** No test calls one. Whether the model declares versions with this exact prompt and reminder is for Okey's run and Slice 4.
- **Files already over 500 lines grew by the seam:** `WorkshopRoomHandler.ts` +20 (1,799 to 1,819), `promptBudgets.ts` +6, `ScriptedWorkshopRoom.ts` +3 (a test helper).
- **`AGENTS.md` was not changed.** No guard required it; its update is Slice 4's.

## Tests added

| Suite | Covers |
|---|---|
| `handlers/domain/workshop/WorkshopEditOfferOptionRoutes.test.ts` | Through the real router, room handler and completion: labels stored and sent with a status each; the press by index; the directive, both lines and the result; a second version after the first; each refusal; no reminder on a press; no label in logs |
| `handlers/domain/workshop/WorkshopRoutes.editOfferReminder.test.ts` | The line and frame; the reserved tag; where it rides and where it never does |
| `services/workshop/session/WorkshopEditOfferOptionTurns.test.ts` | The codec's round trip and 19 refused shapes; the transcript, its three exports and recall |
| `components/workshop/editOffers/WorkshopTurnFootOptions.test.tsx` | Through the real bubble: order, labels as text, names, the press, five faces on one focused node, waiting reasons, held refusal words |

Extended: `WorkshopEditOfferWholeRoom.test.ts` (Rewind, Branch and reopen per option), `WorkshopEditOfferStatus.test.ts`, `workshopEditOfferProtocol.test.ts`, `workshopReplyEditOffers.test.ts`, `workshopEditOfferAnswer.test.ts` (the directive, and a hostile label), `workshopEditOfferChipView.test.ts`, `useWorkshopEditOffers.test.ts`, `replyEditOfferPromptSync.test.ts` (the two bounds, the new rules, both examples), `replyEditOfferPressPromptSync.test.ts`.

## Evidence

`node .todo/archive/epics/epic-workshop-reply-edit-actions-2026-11-10/evidence/render-options.js` renders the real `WorkshopTurnBubble` under the Workshop's stylesheets.

| File | Shows |
|---|---|
| `evidence/8-options.png` | The footer with a fixes chip and three option chips |
| `evidence/9-options-answered.png` | One version asked with its siblings waiting; answered; nothing to change and ask again; the press's line and the answer with its card |
| `evidence/10-options-narrow.png` | A 430px column: the chips wrap, the corner sits under them at the right |
| `evidence/layout-options.json` | Measured boxes: chips in order, one row when wide, nothing past the footer's edge when narrow, no horizontal scroll |

## Verification

| Check | Baseline (epic tip `1e39168b`) | After |
|---|---|---|
| `npx jest` | 836 suites / 11,780 tests / 59 snapshots, all passing | 841 suites / 11,889 tests / 59 snapshots, all passing |
| `npm run typecheck` | — | passes |
| `npm run lint` | 0 errors, 1,171 warnings | 0 errors, 1,171 warnings |
| `npm run build` | — | passes |

- The baseline was taken in a clean worktree of the epic's tip, under Node 22.
- `packages/core/src` has no `from 'vscode'` import.
- No new file is over 500 lines; the largest is the route test at 251.
- No test makes a model call.
