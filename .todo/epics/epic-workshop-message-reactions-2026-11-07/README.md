# Epic: Workshop Message Reactions

**Status:** Slices 1–3 merged (PRs #245, #246, #247). Slice 3b (the reaction corner) reviewed as PR #248; its fixes are on the branch. Slice 4 (the live pass) is next and needs Okey. The ADR is Accepted.
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
| 1 | Writer reactions | `…-slice-1-writer-reactions` | D1, D2, D3, D8: registry, `reactions` session key, codec and normalization, ledger and routes, chips and palette by mouse and keyboard, Rewind/Branch/Side Quest handling. No model involved. | Done: PR #245, merged `104595eb` ([review](../../../docs/pr-reviews/workshop-message-reactions-slice-1-writer-reactions-review.md)) |
| 2 | Delivery | `…-slice-2-delivery` | D4, D6: `<workshop-reactions>`, `reactionDelivery` on reply turns, the delivered view; R2 and R3 witnessed; the byte-identical-prefix test | Done: PR #246, merged `af6f3b52` ([review](../../../docs/pr-reviews/workshop-message-reactions-slice-2-delivery-review.md)) |
| 3 | Persona reactions | `…-slice-3-persona-reactions` | D5: the trailer in `extractWorkshopReplyControls`, its outcome table, R1's host line and slim line, the prompt, the live-region announcement, Q8's setting. Q10: the reaction-only reply narrows `isWorkshopReactableTurn` (the writer cannot react to it) and `assertWorkshopReactionIntegrity` (it carries the persona's reaction) together, in one change (PR #245 N3). Reserve `prose-minion-reaction` in `RESERVED_PERSONA_FRAME`, with a test that quoted writer text carrying one is neutralized (PR #246 N4). | Done: PR #247, merged `e540b67a` ([review](../../../docs/pr-reviews/workshop-message-reactions-slice-3-persona-reactions-review.md), [independent review](../../../docs/pr-reviews/pr-247-independent-persona-reactions-review.md)) |
| 3b | Reaction corner | `…-slice-3b-reaction-corner` | Okey's request (2026-11-09): an icon "Add reaction" button (outline smiley with a plus), always shown, in each reactable bubble's bottom-right corner; the bubble's reactions in one cluster to its left, the writer's first; a click on any reaction removes it (a persona's by Hide; the separate Hide button gone). The palette opens up, or down without room above (PR #245 L4). Closes PR #247 F-01 (focus after the last reaction on a writer bubble). Presentation only. | PR #248, review fixes on the branch ([review](../../../docs/pr-reviews/workshop-message-reactions-slice-3b-reaction-corner-review.md), [evidence](../../../docs/pr-reviews/evidence/workshop-reactions-slice-3b-visual/README.md)) |
| 4a | Prompt tuning | `…-slice-4a-prompt-tuning` | Okey's live report (2026-11-10: personas never reacted, and never answered his reactions) and his four decisions, in the ADR's 2026-11-10 addendum: `reactions.md` and the frame say a reaction shapes the reply; `persona-reactions.md` names the moments to react, with worked *Alice* examples; a per-turn `<workshop-reaction-invite>` wherever a reply's trailer has a target; frequency by expression level (supersedes Q7). No live model calls. | Built on its branch |
| 4 | Live pass | `…-slice-4-live-pass` | Tune how often personas react; record counts on an *Alice* fixture conversation per persona and expression level. (The Hide-focus fix, PR #247 F-01, and the palette on the topmost bubble, PR #245 L4, moved to Slice 3b.) | Not started |

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
- **2026-11-07.** PR #245 (Slice 1) reviewed: M1 (persona-reaction
  integrity tightened before Slice 3 writes it), M2 (the host refuses
  reactions during a run), L1–L3, L5 fixed; L4 to the live pass; N1
  deferred; N2 tech debt. Merged `104595eb` at 804 suites / 11,298 tests.
  Slice 2 (delivery) opens on
  `epic/workshop-message-reactions-slice-2-delivery`.
- **2026-11-07.** Slice 2 built on its branch.
  - **Record.** `reactionDelivery` on a persona reply
    (`WorkshopReactionDeliveryRecords`), with a `start`/`update` kind so a
    re-invited guest folds afresh (see the ADR's D6 implementation notes).
  - **Fold, plan and frame.** The fold is `WorkshopReactionDeliveredView`.
    The pure planner is `reactions/WorkshopReactionDelivery`. The frame is
    `WorkshopReactionFrameRenderer`, wired through the room handler for host
    messages, guest messages and guest joins (`WorkshopReactionDeliveryStage`).
  - **Prompt.** `workshop-personas/reactions.md`.
  - **Budgets.** `framePerTurn` 8, `openingCharacters` 80,
    `deliveredPerReply` 1,000.
  - **Full suite.** Before: 804 suites, 11,298 tests, 59 snapshots. After:
    807 suites, 11,334 tests, 59 snapshots.
- **2026-11-07.** PR #246 (Slice 2) reviewed: M1 (a host conversation
  started by tool synthesis now stages an empty `start`), L1 (reactions on
  turns catch-up deferred stay owed), L2–L5, N1–N3 fixed; N4 to Slice 3.
  Merged `af6f3b52` at 807 suites / 11,346 tests. Persona File Edits'
  epic (PR #236 merged, `926190d9`) merged in at `aacc21f5`: 808 suites /
  11,353 tests green. Slice 3 opens on
  `epic/workshop-message-reactions-slice-3-persona-reactions`.
- **2026-11-07.** Slice 3 built on its branch (the ADR's D5 implementation
  notes have the detail and the deviations).
  - **Trailer.** `<prose-minion-reaction>` joins the tail
    (`utils/workshopReplyReaction.ts`), and is redacted as `[reaction removed]`.
  - **Write.** The reaction is written in `completeRun` through the ledger, on
    the run's own writer message.
  - **R1.** `reactionOnly` on the turn; the host's line is decided from the
    text.
  - **Prompt.** The permission is its own resource, `persona-reactions.md`,
    taught only while `proseMinion.workshop.reactions.personas` is on.
  - **Webview.** The slim line, and D8's live region, which announces a
    reaction only when its reply arrived live.
  - **Review carry-overs.** Q10 and N4 are done.
  - **Full suite.** Before: 808 suites, 11,353 tests, 59 snapshots. After:
    815 suites, 11,400 tests, 59 snapshots.
- **2026-11-07.** PR #247 (Slice 3) reviewed: M1 (a dropped reaction is
  never named: "Replied without a message.", `noMessage`, not reactable),
  M2 (the live region keyed by room revision), L1, L3, L4, N1–N4 fixed.
  L2 decided by Okey: **keep** the slim line's glyph after Hide. An
  independent review approved with one non-blocking follow-up (F-01, Hide
  focus on writer bubbles, tracked as tech debt for Slice 4). Merged
  `e540b67a` at 815 suites / 11,411 tests.
- **2026-11-09.** Slice 3b (reaction corner) built on its branch, at
  Okey's request, presentation only (no host, contract or codec change).
  - **The corner.** `WorkshopTurnReactionCorner` replaces the chips and the
    action-row palette: the cluster ("Reactions", left to right, the
    writer's first) and the icon "Add reaction" button, in the bubble's
    flow at its bottom right, so it never covers text and wraps when the
    bubble is narrow. Each reaction is one button named by its meaning
    then its press ("You reacted: fire. Remove", "Jill reacted: heart.
    Remove"); a persona's carries its name.
  - **The palette** opens up, or down when it does not fit above
    (`workshopReactionPalettePlacement`, against the nearest clipping
    ancestor), and focuses its first option only once placed: the visual
    harness caught the browser scrolling the thread toward a palette still
    drawn on the side with no room. Every Slice 1 keyboard rule holds.
  - **F-01 closed** (archived tech debt): focus falls back to the bubble
    itself when its corner has nothing left.
  - **Evidence.** `docs/pr-reviews/evidence/workshop-reactions-slice-3b-visual/`
    (before/after; the Workshop has one palette, so no light theme).
  - **Full suite.** Before: 815 suites, 11,411 tests, 59 snapshots. After:
    815 suites, 11,418 tests, 59 snapshots.
- **2026-11-09.** PR #248 (Slice 3b) reviewed; nothing blocking. Full suite after the fixes: 815 suites, 11,422 tests, 59 snapshots. Fixed:
  - **M1.** After a removal, the corner ignores presses until the host's
    next snapshot, so a double click posts once.
  - **L1.** The corner's extra top margin is gone.
  - **L2.** An unlocked reaction's title is its name.
  - **L3.** A thread scroll closes the palette. Focus returns to + only
    from inside it.
  - **L4.** A refusal's snapshot disarms the focus hand-off.
  - **T1.** Tests for a double activation and for a press while the
    palette is open.
- **2026-11-09.** Slice 3b (Okey's redesign: the icon add-reaction button
  in the bubble's corner, reactions clustered beside it, click to remove;
  PR #247 F-01 fixed) reviewed (M1 double-click guard, L1–L4, T1 fixed)
  and merged as PR #248 (`fa68772f`). On Okey's ask, the Project Memory
  list budget was raised directly on the epic branch (`964bf66f`):
  `catalogTokens` 2,000 → 6,000 and `catalogEntries` 40 → 100 (ADR
  2026-11-04, addendum 2026-11-09). 815 suites / 11,422 tests green.
- **2026-11-10.** Slice 4a (prompt tuning) built on
  `epic/workshop-message-reactions-slice-4a-prompt-tuning`, from Okey's live
  report that personas never reacted and never answered his reactions. The
  ADR's 2026-11-10 addendum records his four decisions:
  - `reactions.md` and the frame's guidance now say a reaction shapes the
    reply, with a check-in for curious or negative ones.
  - `persona-reactions.md` names the moments to react, with four worked
    *Alice* examples.
  - A per-turn `<workshop-reaction-invite>` (`reactions/WorkshopReactionInvite`)
    rides wherever `personaReplyReactionTarget` gives a trailer a target. It
    is reserved, retained with its message, and logged without text.
  - `reaction-frequency/{subtle,full,amplified}.md` (about one reply in six,
    four or three) is taught after `persona-reactions.md`, superseding Q7.
  - **Full suite.** Before: 815 suites, 11,422 tests, 59 snapshots. After:
    817 suites, 11,456 tests, 59 snapshots. Lint: 0 errors. No live model
    calls; Okey tests live, and Slice 4 tunes from his counts.
