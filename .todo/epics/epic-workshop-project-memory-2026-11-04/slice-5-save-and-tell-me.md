# Slice 5: Save and Tell Me

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D7 (receipt actions), D8 (Save and tell me, caps, the web-research hold, Forget). No `INDEX.md` (question 2, decided).
**Branch:** `epic/workshop-project-memory-slice-5-save-and-tell-me`, from Slice 3's head with the epic merged in (`cbb1446`)
**Status:** Built, verified and pushed. Waits on PR #200 (Slice 3) to merge, then merges the epic in.

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
| The room | `WorkshopRoomHandler` hands each completion (host message, guest join) and the tool side-pass's synthesis `memoryAutoSave`, through `WorkshopSliceComposition`. A new run (send, tool, invite) waits for saves in flight first, and only when there are any, so the receipt lands right after its reply and the next delivery carries it |
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
| The next message waits for a save in flight (receipt before the next exchange); fails with the wait removed (checked) | same |
| No memory text in any log; the held and saved log lines | same |
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

## Deviations

1. **A new run waits for an automatic save in flight.** Slice 3 refuses a
   writer's save mid-reply so a receipt never lands inside an exchange.
   An automatic save starts as its reply completes, so instead the room's
   next send, tool run or invite waits for it (no await when none is out).
2. **A room replaced while the file is written gets no receipt.** As with
   Slice 3's writes (deviation 5), a New, Open, Rewind or Branch that lands
   mid-save keeps the memory (the manager lists it as saved by its
   persona) and records no receipt in the new room; it is logged.
   Rewind never un-saves a memory.
3. **A refused automatic save leaves Ask first's card.** The folder busy,
   the pinned budget, an unavailable workspace: nothing is written, the card
   stays pending with no hold, and the writer can Save it. Logged by reason.
4. **The mode is read twice.** At the reply's context (before the listing
   await) and again just before saving; a switch to Ask first in between
   leaves the card waiting.
5. **`held` stays on a settled card,** saying why it waited; it is optional
   and decoded strictly, so nothing reads it as a state.
6. **The expand shows the card as saved,** from the reply's own turn (what
   the host recorded), not a fresh read of the file. A later Edit leaves
   its own `updated` receipt.
7. **Rewind in the route test is the real transform over a scripted room.**
   The route harness mocks the persistence coordinator, so the Rewind case
   cuts the room's receipts with `rewindWorkshopSession`, counts the cut
   room, and checks the decision resumes.
8. **The receipt stays `role="separator"`.** Slice 3's receipt already holds
   its Edit · Forget and Restore buttons inside the separator; the chevron
   joins them, and the expanded card is a sibling outside it. Whether a
   receipt with actions should be a `group` instead is left for review,
   since changing it moves Slice 3's markup and tests.
9. **Provenance moved to its own module,** unchanged but for `origin`, to
   keep the handler well under 500 lines beside 4b-wire's routes.
