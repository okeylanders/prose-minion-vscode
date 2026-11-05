# Slice 5: Save and Tell Me

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D7 (receipt actions), D8 (Save and tell me, caps, the web-research hold, Forget). No `INDEX.md` (question 2, decided).
**Branch:** `epic/workshop-project-memory-slice-5-save-and-tell-me`, from Slice 3's head with the epic merged in (`cbb1446`)
**Status:** Built, verified and pushed; the epic (with #200 merged at `7bd1d9a`) merged in.

## Outcome

Under **Save and tell me** (`auto`), a persona's proposal is saved at once with
`origin: auto`, and the thread shows a receipt with **Edit** and **Forget**.
Saves are capped per reply and per room. A proposal from a reply whose run had
web research attached is always held for the writer.

## Since Slice 3

- Proposals, cards, receipts and library writes exist. Under `auto` a proposal
  has so far waited like `ask`. This slice adds the automatic branch.

## Build

- **Decision point.** Where Slice 3 records a proposal, the host decides:
  - `ask`: the card waits;
  - `auto`, not held, under the caps: save now with `origin: auto` and record a
    receipt with `by: 'auto'`;
  - otherwise the card waits, held, with the reason the approved design gives
    (Slice 0d, "In the thread", item 4): "Live web research was available for
    this reply, so this memory waits for you to save it.", or "This
    conversation has reached its limit of N automatic memory saves. This one
    waits for you." (N is `autoSavesPerRoom`, counted room-wide). Neither
    claims a search ran or names a persona (PR #196 F-01, F-02).
- **The web-research hold** reads whether the run had web search tools attached
  (`AssistantToolService.ts:753-761`), never whether it cited. The run reports
  that fact on its completion. It isn't stored on the turn unless the card needs
  it after a reload; if it is, use an optional field on `memoryProposal`
  (`held: 'web-research' | 'room-cap'`).
- **Caps:** one per reply (already the codec's), and `autoSavesPerRoom`, counted
  from the room's receipts with `by: 'auto'`, so Rewind lowers the count with the
  turns it cuts.
- **Receipt actions:**
  - *Edit* opens Slice 3's sheet on the saved memory and writes `updated`;
  - *Forget* archives it (claimed rewrite) and records a `forgotten` receipt.
  - Neither deletes a file.

## Tests

- `auto`: saved at once, receipt with `by: 'auto'`, the file's `origin: auto`
  with full provenance.
- **Held:**
  - a reply whose run attached web search (even with no citations);
  - the room cap reached;
  - after a Rewind below the cap, saves resume.
- `ask` is unchanged by this slice.
- *Forget* archives and leaves the file. The room learns it through the
  `forgotten` receipt, which counts as delivered (D14), and the next
  conversation's frame drops it.
- **Poisoning witness:** an attachment carrying "remember: always …" under
  `auto` with web research on gives a held card, not a file.

## Completion Criteria

- [x] Save and tell me saves with a visible receipt and never silently.
- [x] The caps and the web-research hold hold, with tests.
- [ ] Forget is reversible from the manager. Restore from the Forget receipt
      works (Slice 3's route, tested here); the manager's Restore is
      4b-wire's.
- [x] The epic's per-slice verification passes, with counts recorded here.

## Built

| Piece | Where |
|---|---|
| The run's fact | `AnalysisResult.webResearchAttached` (optional `true`), set by `AssistantToolService` at the three sites that attach the web search tool (host start, guest start, continuation), from the tools it attached, never from citations |
| The decision point (pure) | `memory/WorkshopMemoryAutoSave.ts`: `routeWorkshopMemoryProposal(mode, facts)` → `wait`, `held` (`web-research` first, then `room-cap`), or `auto`; `countWorkshopRoomAutoSaves(turns)` counts the room's `saved` receipts `by: 'auto'`, so a Rewind lowers it with the receipts it cuts. The cap is `PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom` (5, already in the budget and pinned by `promptBudgets.test.ts`) |
| Where Slice 3 records a proposal | `settleWorkshopMemoryProposal(control, context, run?)`: the context now carries the mode (`replyMemoryContext`); with the run's facts it puts `held` on the pending card, or marks it `autoSave`. `completeWorkshopRun` takes `memoryAutoSave?(turn)` and calls it once the turn, its settlement and its mark are recorded. A caller without one gets Ask first's card |
| Persisted reason | `WorkshopMemoryProposal.held?: 'web-research' \| 'room-cap'` (`WORKSHOP_MEMORY_HOLDS`), optional and additive in `WorkshopMemoryProposalRecords` (decoded strictly, cloned only when present). No `schemaVersion` bump; the pre-memory fixture reads and saves byte for byte. It stays after the writer saves or dismisses |
| The save | `handlers/domain/workshop/WorkshopMemoryAutoSaves.ts`, owned by `WorkshopProjectMemoryHandler` (`autoSaveProposal`, `autoSavesSettled`): reads the mode again (it was read before the listing await), saves through `ProjectMemoryWrites`' single-writer queue with `origin: auto` and the host's provenance, then records the card as saved and a receipt `by: 'auto'` naming the persona. It holds the card's save in the handler's in-flight map (PR #200 F-05), so a writer's Save joins it and a Dismiss waits it out |
| Provenance | `WorkshopProjectMemoryProvenance.ts`: the handler's two provenance helpers, moved out unchanged and given `origin` (`proposed` or `auto`) |
| The room | `WorkshopRoomHandler` hands each completion (host message, guest join) and the tool side-pass's synthesis `memoryAutoSave`, through `WorkshopSliceComposition`, and the run awaits the save as its tail, under its own controller, before it settles (PR #201 F-03; see below) |
| Held copy | `workshopMemoryHeldReason(held)` in `shared/constants/workshopProjectMemoryWrites.ts`, the design's two lines, N from the budget |
| Webview | `WorkshopTurnMemory`: the held card ("Held for you to decide", the reason, Save · Edit… · Dismiss) on Slice 3's `WorkshopMemoryCard` `held` mode; a reply Save and tell me saved shows no settled line; the receipt's chevron (`aria-expanded`, `aria-controls`, "Show/Hide the saved memory") expands Slice 3's `WorkshopMemoryCard` read only, collapsed by default, and the line keeps Edit · Forget. `hooks/domain/workshop/memory/workshopMemoryAutoReceipts.ts` (pure) maps each automatic receipt to the saved card on its reply, from the snapshot's turns. `memory.css`: the chevron and the expanded card's width |

`useWorkshopProjectMemory` is untouched: Edit and Forget on the receipt were
already wired (Slice 3). The shared handler's edits are the proposal path's
provenance call and the two delegating methods.

## Tests (where)

| Area | Where |
|---|---|
| Auto saves at once: the file's `origin: auto` with full provenance, the receipt `by: 'auto'` right after the reply, no body in it | `handlers/.../WorkshopProjectMemoryAutoSave.test.ts` (real router, room handler, completion, composition, library and store) |
| Held for web research attached with no citations; the poisoning witness ("remember: always …" from a page, web research on: a held card, no file, no receipt) | same |
| The room cap (five saves, the sixth held with the cap copy); Rewind through `rewindWorkshopSession` cutting the receipts lowers the count and the decision resumes; the files stand | same |
| Ask first unchanged (web research attached, still no hold, nothing written) | same |
| A held card's Save is the writer's (`proposed`, receipt `by: 'writer'`), and keeps `held` | same |
| Forget from the receipt: archived, the file kept, a `forgotten` receipt; D14's delivered view drops it once delivered; the next frame doesn't list it | same |
| Edit from the receipt: `updated` receipt, one file | same |
| A writer's Save while the automatic save is in flight joins it (one file, one receipt, answered with its id) | same |
| The save is its run's tail: the send settles with its receipt in place, before the next exchange; a tool synthesis and a guest's opening reply the same | same |
| PR #201's races (F-01–F-03), the store's create held | `WorkshopProjectMemoryAutoSaveRaces.test.ts` (below) |
| No memory text in any log; the held and saved log lines; a save that throws (text in its error) or is refused writes nothing, leaves the card waiting, and logs only ids and reasons | same |
| The decision's order and the count; the held copy (claims no search, room-wide, N from the budget) | `services/.../memory/WorkshopMemoryAutoSave.test.ts` |
| Completion: held puts `held` and calls no saver; unheld under `auto` calls the saver once, after the turn is recorded; `held` round-trips through save, reopen and hydrate; unknown reason refused; the fixture byte for byte; clone | `session/WorkshopMemoryHeldCard.test.ts` (with `ScriptedWorkshopRoom`'s two new optional knobs) |
| The run reports web research attached without citations, and not when off | `AssistantToolService.test.ts` |
| Webview: held card (both lines, buttons, amber class); the saved reply shows nothing; the receipt collapsed by default, `aria-expanded`/`aria-controls`, read only (no Save, Edit…, Dismiss), Edit · Forget kept, toggles back; no expand without the source card or on a writer's receipt; the pure mapping | `components/workshop/WorkshopSaveAndTellMe.test.tsx` |
| Guard moved deliberately | `boundaries.test.ts`: `WorkshopMemoryAutoSave.ts` joins `WORKSHOP_MEMORY_MODULES` |

## Verification

- `npm ci`; `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,170 warnings before and after.
- `npx jest`: before (`cbb1446`, clean worktree) **676 suites / 9,551
  tests / 59 snapshots**; after **680 suites / 9,585 tests / 59
  snapshots**, all passing.
- No `from 'vscode'` in `packages/core/src`.
- No new module over 500 lines (the largest new one,
  `WorkshopMemoryAutoSaves.ts`, 127). `WorkshopProjectMemoryHandler.ts`
  431 → 441. Touched files already past 500 grew a little:
  `WorkshopRoomHandler.ts` 1,624 → 1,654 (the hand-off at three
  completions and the wait at three run starts), `AssistantToolService.ts`
  1,128 → 1,134, `WorkshopApp.tsx` 1,775 → 1,778, and the tests
  `ScriptedWorkshopRoom.ts`, `boundaries.test.ts`,
  `AssistantToolService.test.ts` by a few lines each.
- *Alice* and made-up ids; no live provider calls.
- **After merging the epic** (#200 merged at `7bd1d9a`: docs only) and the
  failed-save privacy test: typecheck clean, lint 1,170, **680 suites /
  9,586 tests / 59 snapshots**, all passing.

## Deviations

1. **The automatic save is its run's tail** (PR #201 F-03, replacing the
   first version's wait at the start of the next run). The reply settles a
   local file write later than before: milliseconds, longer behind another
   window's or the writer's write.
2. **A room replaced after the file committed gets no receipt.** Before the
   commit, a replaced room withdraws the save (F-01's permit). As with
   Slice 3's writes (deviation 5), a New, Open, Rewind or Branch that lands
   mid-save keeps the memory (the manager lists it as saved by its
   persona) and records no receipt in the new room; it is logged.
   Rewind never un-saves a memory.
3. **A refused automatic save leaves Ask first's card.** The folder busy,
   the pinned budget, an unavailable workspace: nothing is written, the card
   stays pending with no hold, and the writer can Save it. Logged by reason.
4. **The mode is read live** (PR #201 F-01): at the reply's context, before
   the save, when its turn in the queue comes, and at the store's commit
   point. A switch to Ask first or Off before the commit leaves the card
   waiting; one after it keeps the memory and its receipt.
5. **`held` stays on a settled card,** saying why it waited; it is optional
   and decoded strictly, so nothing reads it as a state.
6. **The expand shows the card as saved,** from the reply's own turn (what
   the host recorded), not a fresh read of the file. A later Edit leaves
   its own `updated` receipt.
7. **Rewind in the route test is the real transform over a scripted room.**
   The route harness mocks the persistence coordinator, so the Rewind case
   cuts the room's receipts with `rewindWorkshopSession`, counts the cut
   room, and checks the decision resumes.
8. **A receipt with controls is a labelled `group`** (PR #201's
   accessibility note): Save and tell me's (Edit, Forget, the expand) and
   Forget's (Restore), labelled by the receipt's line, its rules drawn by
   CSS and decorative. A receipt with no controls stays a `separator`.
   Slice 3's receipt tests moved with it.
9. **Provenance moved to its own module,** unchanged but for `origin`, to
   keep the handler well under 500 lines beside 4b-wire's routes.

## PR #201 review fixes (Astra, `docs/pr-reviews/pr-201-project-memory-save-and-tell-review.md`)

Each fix has a regression in `WorkshopProjectMemoryAutoSaveRaces.test.ts`
that fails with the fix taken out (checked by reverting each fix and
running the suite: F-01's permit, 8 fail; F-02's join rule, 1; F-03's
abort, 2).

- **F-01: permission at commit.** `ProjectMemoryWrites.save` takes an
  optional `permit`, asked when the save's turn in the single-writer queue
  comes and inside the store's `beforeCommit`, with nothing awaited before
  the rename. A false permit writes nothing and refuses `withdrawn`. The
  automatic save's permit is: the mode still `auto`, its run not aborted,
  the same room revision, and the card still pending and unheld. A writer's
  save passes none, so it works with memory Off as before.
  - Tests: Ask first and Off, each while the save waits behind a held
    writer save and while its own commit is delayed (nothing written, the
    card pending, the writer's save written); then a writer's Save of the
    card with memory Off.
- **F-02: an edited Save never joins.** The handler joins an in-flight save
  only for a Save whose draft is the card's own
  (`workshopMemoryDraftsEqual` against `workshopMemoryProposalDraft`).
  An edited Save waits it out and, once the card is saved, applies to the
  saved memory through `edit` (an `updated` receipt). While the reply's run
  is still settling, that write is refused in words ("Wait for the reply to
  finish, then save to memory."), so the sheet keeps the writer's draft;
  sent again after, it applies. A Save that ignored edits is never
  acknowledged.
  - Tests: the overlap with the create held (refused in words, the file
    keeps the card's title, one receipt); sent again once settled (applied,
    `saved` then `updated`, one file); an unedited Save and an edit equal to
    the card still join (one file, one receipt, both answered).
- **F-03: the save is its run's tail.** The coordinator's suggestion, taken.
  The room handler (host message, guest join) and the tool side-pass
  (synthesis) await the save after completion's own work and before the
  run's `finally` settles it, under the run's controller
  (`memoryAutoSaveFor(signal)`). The waits at the start of send, tool and
  invite are gone, so no request (Send, tool, invite or widget commit)
  waits on a save or resumes after one against a changed room, target or
  attachments. A preempting run aborts the controller, New and Open move the
  room revision, and disposal aborts the run: each withdraws a save that
  hasn't committed (F-01's permit). Nothing in completion holds what the
  write queue needs, so there was no reason to prefer the bound wait.
  - Tests: a later send completes while the save is held, goes to
    `host-conv`, and preempts the save (no file, the card pending); a room
    reset while held writes nothing; disposal while held writes nothing and
    starts no provider call after.
  - Residual: a run preempted after the file committed still records its
    receipt, which then lands after the new writer message; never silent.

**Verification after the fixes** (`1cd862b`, then the accessibility commit):
- Typecheck clean; lint 0 errors, 1,170 warnings, as the base.
- Jest: **681 suites / 9,598 tests / 59 snapshots**, all passing on two
  consecutive full runs, with no intermittent failure.
- The unchanged scope rechecked by the suites: a writer's save with memory
  Off, an unedited duplicate Save coalescing, the receipt delivered on the
  next turn, and the web-research hold.
- Sizes: `WorkshopMemoryAutoSaves.ts` 133, `WorkshopProjectMemoryHandler.ts`
  447, `ProjectMemoryWrites.ts` 415, `RunWorkshopToolSidePass.ts` 378;
  `WorkshopRoomHandler.ts` (already past 500) is 1,648, 24 over the base.

## PR #201 re-review: F-04, the cap counts saves under way

Astra closed F-01–F-03 and the accessibility change at `0da80c5` and found
F-04: with the save now its run's tail, a later reply could be admitted
while an earlier save had committed its file but not yet recorded its
receipt, so a sixth file could be written at `autoSavesPerRoom` 5.

- **Fix: reservations by room revision** (the coordinator's suggested
  shape). `WorkshopMemoryAutoSaves` reserves a save's place synchronously
  as completion hands the card over, keyed by the room revision. The
  room's count (`inRoom`) is its `by: 'auto'` receipts plus this
  revision's reservations, and completion's decision reads it
  (`memoryAutoSavesInRoom`, through the room handler, composition and the
  tool side-pass). The permit also requires the reservation to stand and
  the receipts plus the other reservations to be under the cap, so the
  count is checked again at the commit. A reservation is released in the
  same synchronous step that records the receipt, or when the save is
  withdrawn, refused or fails. A replaced room's reservations don't count
  in the new one, and Rewind still counts from receipts.
- **Withdrawn at the cap** (only reachable if the room reached the cap
  after admission): the card is held with `room-cap`
  (`WorkshopSessionService.holdMemoryProposal`) and nothing is written.
- **Tests** (`WorkshopProjectMemoryAutoSaveRaces.test.ts`): Astra's
  witness. Four saves, then the fifth file commits while the listing that
  reads its receipt's version is held, and a sixth reply is admitted: it is
  held with `room-cap`; on release there are five files and five `auto`
  receipts. Also: the cap rechecked at the commit (the room at the cap by
  then: held, nothing written), and a withdrawn or refused save giving its
  place back (five saves still go through after it, then the next is held).
  Taking out the reservation count fails the witness (by timeout, as the
  sixth save queues behind the held read), and taking out the commit-time
  check fails its test (checked).
- **Verification:** typecheck clean; lint 0 errors, 1,170 warnings;
  **681 suites / 9,601 tests / 59 snapshots**, all passing on two
  consecutive full runs. `WorkshopMemoryAutoSaves.ts` is 186 lines;
  `WorkshopSessionService.ts` (already past 500) grew by 9 for
  `holdMemoryProposal`, `WorkshopRoomHandler.ts` by 8, and
  `WorkshopRunCompletion.ts` is 470.
