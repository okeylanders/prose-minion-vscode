# Helper Agent: complete

**Date:** 2026-11-07
**Epic:** [archive](../.todo/archive/epics/epic-helper-agent-2026-11-05/README.md)
**Decision:** [ADR 2026-11-05](../docs/adr/2026-11-05-helper-agent.md), Accepted 2026-11-07
**Branch:** `epic/helper-agent`, cut from `epic/workshop-bookmark-recall` at `b4ca7b86`, merged to `main` on Okey's approval after his live pass

## Facts

- **What it is.** One agent for small model jobs: a generic system prompt, tasks as policies (`HELPER_TASK_POLICIES`), its own `helper` model scope, and no tools or writes of its own.
- **Its first job: `memory-draft`, automatic.**
  - Save to memory… on a bubble, or Remember this on a bookmark, opens the sheet at once, and the title, summary and kind fill in while the writer looks.
  - Anything the writer types first wins.
  - The body is never changed.
  - Failure is one quiet line.
  - Off (`proseMinion.workshop.memory.helperDrafts`) is silence.
- **How it was built.** A spec PR and two code PRs, each reviewed by Astra:
  - #225: the spec and ADR;
  - #228: the engine;
  - #231: drafting in the memory sheet.

  Then #232 (the live-pass checklist), #239 (Bookmark Recall's raised limits, synced in) and #242 (the live pass's fix).
- **The live pass** (2026-11-06).
  - **One finding:** an intermittent cut-off at the 400-token ceiling on `anthropic/claude-sonnet-5.5`.
  - **The fix (#242):**
    - every helper call asks for reasoning off;
    - a model that always reasons gets the light budget on top of the ceiling, never a refusal;
    - the ceiling rises to 1,000 tokens;
    - reasoning tokens are logged as a count.
  - Okey found nothing else.

## Decisions

- **`helper` follows Proofread's model** until the writer picks one (Q1). The draft also chooses the kind (Q2). Remember this drafts too (Q3).
- **The helper proposes; it never writes.** It imports no Workshop, Lightbox or Draft Edit module (`boundaries.test.ts`). Handlers read the turn host-side and hand it plain data.
- **A capability card's sheet is withheld** (#231 F-01). Its body is the tool's report, while the safe projection holds a status line, so the two would read different notes.
- **Reasoning is the request's, as in Draft Edit, with one difference** (#242): where a Draft Edit pass refuses a model that always reasons, the helper sends it the light budget. Drafting is automatic, so a refusal would only ever show the failure line.
- **`ReasoningCatalog` lives in `orchestration/`.** The helper and Draft Edit both read it, and neither imports the other.

## Lessons the reviews taught

- **A stop must be checked where it can land.**
  - A stop during preparation was lost (#228 F-01), and so was one between preparation and the forwarding listener (#242 F-01).
  - The fix: forward an abort that already fired as soon as the listener is installed, and check the caller's signal again immediately before dispatch.
- **A catalog read inside an automatic call needs the call's own clock.** `fetchModels` has no timeout, so it runs inside the helper's timed window (#242).
- **Two readers of one note must read the same text** (#231 F-01).
- **Size the ceiling for the model, not the answer.** A 100-token answer needed room for thinking the request didn't ask for.

## Verification

At `7604c8e1` (#242's merge):
- typecheck clean;
- lint: 0 errors / 1,165 warnings;
- jest: **761 suites / 10,620 tests / 59 snapshots**, all passing.

CI passed on #242's code head `4906f1cc` and report head `39c21190`.

## Follow-ups

- **D6 `project-locations`** (configuring context paths from a workspace scan) stays in the ADR for a later epic.
- **Persona File Edits** goes to `main` next. It merges `main`, with this epic, first.
- **Project Memory's epic** (`.todo/epics/epic-workshop-project-memory-2026-11-04/`) is on `main`, but its close-out (archive, memory bank, `AGENTS.md` section) hasn't been done.
