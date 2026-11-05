# Slice 6b: Several Suggestions, and Supersessions Wait

**Status:** In review
**Branch:** `epic/workshop-project-memory-slice-6a-kinds`, restarted from
`epic/workshop-project-memory` at `4d74ac04`. This session may push only
there, as 4b-wire did, so 6b reuses the merged 6a branch's name.
**Decision:** [ADR 2026-11-04, addendum of 2026-11-05: several suggestions, and supersessions wait](../../../docs/adr/2026-11-04-workshop-project-memory.md#addendum-2026-11-05-several-suggestions-and-supersessions-wait)

## Scope

These are Okey's two live-pass decisions:

1. **Up to 10 suggestions per reply.** Each frame is judged on its own, each
   suggestion is its own card, and Save and tell me routes each card in
   order.
2. **Supersessions always wait.** Under Save and tell me, a suggestion that
   names any `<supersedes>` id is never saved automatically.

## What changed

### Extractor (`utils/workshopReplyControls.ts`)

- `memory` is now either `none` or `frames`. `frames` lists the eligible
  proposals in the order written, and one rejection per dropped frame.
- Every frame is still removed from `rest`, `redacted`, retention and
  streaming exactly as before. Each frame is judged on its own:
  - memory off;
  - a stray closing tag (`unopened`);
  - an inexact tag, unclosed or nested;
  - not at the tail (`misplaced`);
  - a decode fault;
  - a title that repeats an earlier one (`duplicate`, case-insensitive);
  - past `proposalsPerReply` (`over-cap`): the frame is dropped whole and
    counted, never cut.
- A malformed frame takes no place under the cap.
- The tail check is one backward pass, linear in the frame count. The old
  per-frame rescan was quadratic.
- Text between two removed frames now joins with one blank line, as text
  after a frame at the tail always did. A frame at the very start, followed
  by later frames, no longer leaves a stray leading newline.

### Budget

- `PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply` is 10. It is
  pinned in `promptBudgets.test.ts` and in the proposal prompt's sync test.

### Prompt (`project-memory-proposals.md`)

- "One reply suggests at most one note" became:
  - most replies suggest none;
  - at most 10;
  - several only when the writer asks, or when several distinct things
    settled;
  - each stands alone and never repeats or overlaps another.
- The prompt says each trailer is checked on its own, that trailers past the
  limit and repeated titles are dropped, and that a note which replaces
  another always waits for the writer.
- The worked example is now two trailers: the canon note with `supersedes`,
  and an idea. Its sync test decodes both through the production extractor.

### Session shape

- `WorkshopTurn.memoryProposals` replaces `memoryProposal`: one to ten items,
  never empty.
- Each item has the discriminant `proposes: 'new'`
  (`WORKSHOP_MEMORY_PROPOSAL_KINDS`). Only new-memory suggestions are built;
  an edit kind can be added later.
- `WorkshopMemoryProposalRecords` validates the list strictly.
- A development checkpoint may still hold the single `memoryProposal`. It is
  checked by the item's own rules, refused beside a list, and refused in the
  current shape.
- `WorkshopSessionCheckpointNormalization` repairs it with
  `listed-single-memory-proposal`, which is named, logged and tested, into a
  one-item list. There is no `schemaVersion` bump.
- The pre-memory fixture still reads and saves byte for byte.

### Routes

- `WORKSHOP_MEMORY_PROPOSAL_ACTION` carries `index`; a non-integer or negative
  index is reported and ignored.
- `setMemoryProposalState` and `holdMemoryProposal` take the index.
- The handler keys its in-flight saves by card
  (`workshopMemoryCardKey(turnId, index)`), so each card has its own join and
  wait.
- Logs name `turnId` and `index`, never text.
- Receipts and D14 delivery stay one per saved memory.

### Save and tell me

- `routeWorkshopMemoryProposal` takes the proposal and the reply's earlier
  admitted count.
- The order of checks is:
  1. web research (every card);
  2. `supersedes` (any id the trailer named, kept or dropped);
  3. the room's cap, counting the receipts, the reservations and this
     reply's earlier admissions;
  4. otherwise, auto.
- Completion hands the turn over with the indexes to save.
- `WorkshopMemoryAutoSaves` reserves every card synchronously at handover,
  and registers each card's save in the in-flight map at once. A writer's
  Save of a later card therefore joins the auto save, and a Dismiss waits it
  out.
- The cards are chained one after another. The run awaits the whole chain as
  its tail (F-03), and each card asks its own live permit (F-01, F-04).

### Held reason

- `supersedes`: "It replaces a saved memory, so it waits for you to save it."
  It matches the wording of the other two reasons.

### Webview

- `WorkshopTurnMemoryCards` renders one card per item.
- With two or more, the cards sit in a `role="group"` stack labelled
  "N memory suggestions", under a small mono eyebrow ("3 suggestions") styled
  like the card heads.
- Busy state and errors are keyed by card.
- The sheet remembers the card's index (`proposalIndex`).
- The auto-receipt view maps receipts to cards by key.
- Checked by screenshot: a pending card, a held supersession and a saved
  line in one stack.

### ADR

- A dated addendum (2026-11-05). One-line pointers from D6's "One per reply"
  and D8's cap bullet lead to it; D6's text is otherwise unchanged.
- The epic README row is added. `slice-6-verify-live.md` gets three
  write-path checks.

## Deviations and choices

- **The cap counts accepted proposals, not frames.** "An 11th frame or later
  is dropped" is read as the 11th well-formed one. A malformed frame drops
  only itself and takes no place, so a reply with one bad frame among eleven
  still gets ten cards.
- **Duplicate titles.** The brief's "never a duplicate of another" is taught
  in the prompt. The host also drops a later frame with the same title (case
  folded) as `duplicate`, keeping that reason's meaning. Near-duplicates are
  left to the prompt.
- **A supersession is held on any id the trailer named**, even one the
  listing didn't hold and the card then drops. A trailer that tried to
  replace something always waits.
- **The order of holds:** web research, then supersedes, then the cap. A
  supersession never uses a cap place.
- **An unclosed frame before good ones takes them with it.** This is
  unchanged from #200: everything after an unclosed opening tag is removed
  and never read. Tested.
- **The discriminant is `proposes`**, not `kind`, because `kind` already
  names the memory's kind.
- **The branch name** is reused, as noted above.

## Tests

- `workshopReplyControls.test.ts` covers:
  - several frames, in order;
  - the cap, with the overflow counted;
  - a malformed frame between good ones, taking no cap place;
  - misplaced, nested and unclosed frames beside good ones;
  - duplicate titles;
  - text between frames;
  - streaming at every prefix of two frames;
  - a retention line for a frames-only reply;
  - 4,000 frames, each decoded once and the rest counted over the cap.
    This is checked by a count, not a clock, as AGENTS.md asks.
- `projectMemoryProposalPromptSync.test.ts` pins the cap of 10, checks the
  several-suggestions wording, and decodes the two-trailer example.
- `WorkshopMemoryAutoSave.test.ts` covers the supersedes hold and its place
  in the order, the batch's admitted count filling the cap, and the held
  wording.
- `WorkshopRunCompletionMemory.test.ts` covers:
  - several cards, with one malformed;
  - the phrasing fence withholding one card of several;
  - no list when every frame dropped;
  - no memory text in any log with several frames.
- `WorkshopMemoryTurns.test.ts` covers:
  - the list shape's refusals (writer turn, empty, over 10, unknown
    `proposes`, a missing `proposes`, the legacy field in the current shape);
  - the legacy repair, its normalization name and its write-back;
  - both shapes together refused.
- `WorkshopMemoryHeldCard.test.ts` covers a supersession held with no save
  asked, and several cards routed by index.
- `WorkshopProjectMemoryMultiProposal.test.ts` (new, through the real router)
  covers:
  - Ask first:
    - cards in order;
    - acting by index in any order;
    - two concurrent saves, each with its own file and receipt;
    - bad indexes.
  - Save and tell me:
    - saves in order with receipts;
    - a batch filling the cap;
    - a later batch taking only the places left;
    - web research holding every card;
    - a supersession held with nothing written;
    - a supersession beside other cards;
    - the writer saving a held supersession;
    - a writer's Save of a later card joining the chain;
    - the send settling with every receipt in place (F-03);
    - a mode switch mid-batch withdrawing the rest (F-01);
    - logs by index, with no text.
- Webview: the stack and count, per-card actions and busy state, no count for
  one card, the supersedes hold's wording, and the hook's per-card busy state
  and sheet index.
- Existing tests were updated for the list and the index.

## Verification

- `npm run typecheck`: clean.
- `npm run lint`: 0 errors and 1,165 warnings, the same as the base.
- Full jest: all passing (counts in the coordinator message).
- No `from 'vscode'` in `packages/core/src`.
- No new or changed TS/TSX module is over 500 lines. The largest source is
  `WorkshopProjectMemoryHandler.ts` at 464. `WorkshopSessionService.ts` was
  already over 500 and grows by a few lines in two existing methods.
- Logs carry turn ids, indexes, memory ids and reasons, never memory text;
  the new tests check with sentinels.
- Fixtures use *Alice* names.
