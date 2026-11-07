# Epic: Workshop Message Reactions

**Status:** Slice 1 (writer reactions) built, awaiting its PR. The ADR is Accepted.
**Priority:** Medium
**Opened:** 2026-11-07
**Branch:** `epic/workshop-message-reactions`, cut from
`epic/workshop-persona-file-edits-slice-4c-retry-and-setting` at `9bfce925`
(the tip of the in-flight Persona File Edits epic: `epic/workshop-persona-file-edits`
at `9dfa293f`, its sync-main branch, `main` at `859517b6` with Helper Agent
#243 and Bookmark Recall #240, and Slice 4c with its PR #236 fixes).
**ADR:** [2026-11-07: Workshop Message Reactions](../../../docs/adr/2026-11-07-workshop-message-reactions.md)
**Feature note:** [Workshop Message Reactions](../../features/feature-workshop-message-reactions/README.md)
(from the idea inbox; never edited on this branch, so the inbox's identical
add merges cleanly. Status lives here.)

## Goal

The writer reacts to a persona's reply with a chip from a closed palette of
19, and the persona hears it on its next turn. A persona may react to the
writer's message it is answering, at most once a reply, and rarely. No
reaction starts a model call or edits retained history.

## Slices

| # | Slice | Branch | Outcome | Status |
|---|---|---|---|---|
| 0 | Spec | `epic/workshop-message-reactions` | The ADR and this README | Done (`f25c2ea7`; Accepted 2026-11-07) |
| 1 | Writer reactions | `…-slice-1-writer-reactions` | D1, D2, D3, D8: registry, `reactions` session key, codec and normalization, ledger and routes, chips and palette by mouse and keyboard, Rewind/Branch/Side Quest handling. No model involved. | Built; awaiting review |
| 2 | Delivery | `…-slice-2-delivery` | D4, D6: `<workshop-reactions>`, `reactionDelivery` on reply turns, the delivered view; R2 and R3 witnessed; the byte-identical-prefix test | Not started |
| 3 | Persona reactions | `…-slice-3-persona-reactions` | D5: the trailer in `extractWorkshopReplyControls`, its outcome table, R1's host line and slim line, the prompt, the live-region announcement, Q8's setting | Not started |
| 4 | Live pass | `…-slice-4-live-pass` | Tune how often personas react; record counts on an *Alice* fixture conversation per persona and expression level | Not started |

Slice branches are `epic/workshop-message-reactions-slice-<N>-<slug>`.

## How the slices are built

The same flow as Helper Agent, Project Memory and Bookmark Recall.

- **One implementation thread per slice**, on its slice branch cut from the
  epic. It reads this README, the ADR and `AGENTS.md` (the Workshop sections:
  Rewind and Branch, Seed Delivery, Transcript Export, Session Recall,
  Pinned Context; and Helper Agent), then builds, verifies, commits, pushes,
  and reports its head and counts to the coordinator.
- **The coordinating thread** (this epic's orchestrator) opens each PR into
  `epic/workshop-message-reactions` and watches it. Each PR gets a review
  ledger in `docs/pr-reviews/`.
- **Findings are fixed on the slice branch** and answered in the ledger.
- **Merging into the epic** is a merge commit pinned to the slice's head,
  once the PR is green and its findings are settled.
- **Nothing targets `main`** without Okey. This epic goes to `main` after
  Persona File Edits does.

## Staying current with Persona File Edits

The base is still under review (PR #236). When a File Edits slice or epic
branch moves, or it merges to `main`, merge it into this epic (merge, never
rebase a shared branch). Read only: never commit to
`epic/workshop-persona-file-edits*`, `claude/idea-inbox` or `main`.

## Verification (every slice)

- `npm run typecheck` and `npm run lint`: no new errors.
- The full `npx jest`, counts recorded in the slice's PR and below.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines.
- No live, billable model calls in tests.
- Logs never carry writer text; fixtures and tests use *Alice*.

## Completion Criteria

- [x] The ADR settles Q1–Q10 and is Accepted.
- [ ] The writer adds and removes reactions on a persona bubble, by mouse
      and keyboard; they survive save, open and reload.
- [ ] On its next turn the persona receives the reactions since its last
      reply in a frame; earlier retained messages are byte-identical before
      and after (test).
- [ ] A persona's trailer becomes a chip on the writer's bubble. Only listed
      ids, at most one per reply; the trailer is gone from display,
      retention, streaming and logs.
- [ ] No reaction starts a model call on its own.
- [ ] R1: a reaction-only reply draws a slim line; retained history holds
      the host's line, never an empty message.
- [ ] R2: a guest receives a reaction exactly when the visibility predicate
      shows it the turn, with whose message it was.
- [ ] R3: Rewind, Branch and Side Quests drop reactions with cut turns; a
      reaction whose delivery was cut arrives again on the next turn (test).
- [ ] `projectWorkshopTranscript` / `projectWorkshopTranscriptTurn` omit
      reactions, with a test.
- [ ] Logs carry reaction ids and counts, never message text.
- [ ] The live pass's counts are recorded, and the prompt tuned.

## Progress Notes

- **2026-11-07.** Epic branch cut from `9bfce925`. The feature note comes
  in unchanged from `claude/idea-inbox`; the ADR is Proposed with R1–R3 as
  decided and Q1–Q10 put to Okey.
- **2026-11-07.** Okey took every recommendation (Q1–Q10); the ADR is
  Accepted. Slice 1 opens on
  `epic/workshop-message-reactions-slice-1-writer-reactions`.
- **2026-11-07.** Slice 1 built on its branch: the registry
  (`shared/constants/workshopReactions.ts`), the `reactions` session key
  (`WorkshopReactionRecords`, `WorkshopReactionLedger`, the
  `dropped-dangling-reactions` normalization), `workshopReactionsWithin` in
  the rewind transform, `WorkshopReactionHandler`'s two mutation routes
  (`WORKSHOP_SET_TURN_REACTION`, `WORKSHOP_HIDE_TURN_REACTION`), and the
  bubble's palette and chips. The full suite: 802 suites, 11,263 tests,
  59 snapshots.
