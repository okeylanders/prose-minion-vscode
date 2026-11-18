# Everyday Conveniences, Round Two: all eight items built; the live pass and the open decisions are Okey's

**Date:** 2026-11-18
**Epic:** [README](../.todo/epics/epic-everyday-conveniences-round-two-2026-11-17/README.md) (active; not archived)
**Decision:** [ADR 2026-11-17](../docs/adr/2026-11-17-everyday-conveniences-round-two.md) (D1–D25, the D6 amendment of 2026-11-18, the D15 addendum of 2026-11-17)
**Branch:** `epic/everyday-conveniences-round-two`, cut from `main` at `3f99e733`; every slice merged at `caff8379`. The closing pass is `epic/everyday-conveniences-round-two-close`. Nothing has gone to `main`.
**Next step:** Okey's [live pass](../.todo/epics/epic-everyday-conveniences-round-two-2026-11-17/live-pass.md), which ends with the open decisions.

## What shipped

Eight writer features from Okey's idea list, one slice each, plus three follow-ups. Each slice was a PR into the epic, reviewed by Astra, and merged with a merge commit.

| Slice | Item | What the writer gets | PR | Merged | Review |
|---|---|---|---|---|---|
| 0 | Spec | The ADR and the epic README | #269 | `649b9f24` | Two P2 (catalog page ceiling; settlement drops uncounted), both fixed in the ADR |
| A1 | A, part 1 | The hidden-turns notice moved above the first bubble, reworded | #268 | `8a4ac961` | Clear |
| E | E | Lexical Gravity reads JSON through `parseModelJson`, repairs `early-closed-attention`, keeps the good lenses ("1 of 3 lenses couldn't be used.") | #270 | `f9c3dd97` | Clear (it noted the old rejected-body log as pre-existing) |
| G | G | `@` in the composer attaches a configured file to this message | #271 | `45a7a9e5` | One P2 (a send could beat its pick), fixed: `WorkshopMessageAttachmentReads` |
| B | B | "Suggest notes": Sparingly, Readily, Aggressively | #272 | `137039f5` | Clear |
| A2 | A, part 2 | "Show earlier turns", full bubbles, re-read after each state | #273 | `2fd0dfdd` | Clear |
| C | C | Every memory's title (`<title-only>`, `<unlisted>`), `memory.catalog` `<page>` with no ceiling, the list-size setting | #274 | `9e10c53c` | Clear |
| F | F | `lens.catalog` and `lens.read` for personas | #277 | `80175979` | One P2 (lens file names logged), fixed: count-only `listReadable()` |
| D | D | `<workshop-trailer-outcomes>`: a persona hears what became of its notes and file edits | #276 | `5ebe42fe` | One P2 (a lost conversation lost the line), one P3 (counts clipped), both fixed |
| H | H | A Prose Minion reference (`resources/help/`), `help.search` and `help.read` | #279 | `3a6054c3` | Clear |
| H+ | H | Help loads on a version mismatch, retries a failed load, names ignored terms | #280 | `cdfd8358` | Two P2 (ignored terms still ranked; refusals misnamed the version), one minor (caveat direction), all fixed |
| A3 | A | A bookmark outside the window loads up to 3 pages and scrolls to it | #281 | `caff8379` | One P2 (a newer move did not cancel a pending jump), fixed |
| Close | | Live-pass checklist, `AGENTS.md`, this entry, tech debt | pending | pending | pending |

## Decisions Okey made during the epic

- **A has both parts;** part 1 first (README row 1).
- **C's size setting ships here,** and each size grows both buckets (T1, row 9).
- **E is fixes 1–3 only;** fix 4 and the helper's repair stay in the note (row 17).
- **G: the pill is the truth, and a file token holds a `.` or a `/`** (A1, A2; row 21).
- **A tool run's synthesis request carries the trailer-outcomes line** (2026-11-17, PR #276; ADR D15 addendum, row 45). Without it, a tool run right after a reply made the synthesis the latest reply, and the earlier reply's outcomes were never told.
- **Astra built H.** Item H (PR #279) was implemented by Astra, Okey's review agent, rather than an implementation thread.
- **The help version check is a caveat, not a refusal** (PR #280). The reference loads whatever version `overview.md` names and says, direction-neutral, that the versions differ; the sync test stays the hard gate.
- **A bookmark outside the window loads its pages, at most 3** (2026-11-18; ADR D6 amendment, row 4; `PROMPT_BUDGETS.workshopThread.jumpPages`). Past that, the reader opens.

Every other default (README "Defaults taken") was the orchestrator's and is Okey's to overturn. Q1–Q7 stay open.

## What the closing pass found

- **Three gaps in code, filed as tech debt, none fixed here:**
  - Lexical Gravity copies a rejected reply's text into the log (`LexicalGravityModelService.ts` lines 177–181 and 237–243), against the rule that logs never carry text; the widget recommendation's rejection line (`WorkshopRunCompletion.ts` 264–268) does too. PR #270's review saw it and called it pre-existing.
  - `handleAddContextResources` (and `handleAddContextFile`) stage room context after awaiting, with no `roomRevision` check, unlike message attachments since PR #271. The mutation registrar refuses only at arrival, so a room replaced mid-read receives the earlier room's file.
  - A send refused by the session gate (`createMutationRegistrar`, no `onBlocked` for `WORKSHOP_SEND_MESSAGE`) never calls `postComposerDraftRestored`, so its text is lost when the host was mid-save.
- **`AGENTS.md` was behind.** The route-owner count was 23 (the guard lists 24 with `WorkshopEarlierTurnsHandler`); the help section quoted the pre-#280 directional caveat and said nothing of overflow terms leaving the ranking or of refusal headers. New sections: Workshop Earlier Turns, Workshop Memory Index and Suggestion Level, Workshop Trailer Outcomes; the help section was completed.
- **Follow-ups that lived only in the source notes** were split into their own `.todo` entries so the notes can archive: jump from a to-do's source, a Read in card and "Show where it was read"; `lens.search` and recommending a project lens; `@persona`; a guide persona.

## Verification

On `epic/everyday-conveniences-round-two-close` (the epic at `caff8379` plus documentation only):

- `npm run typecheck`: clean (core, webview, extension).
- `npm run lint`: 0 errors, 1,190 warnings.
- `npx jest`: **921 suites / 13,230 tests / 59 snapshots**, all passing.
- `help/index.json` did not change, so the help tables were not regenerated.
- No live model call and no Extension Development Host session: that is the live pass.

## Follow-ups

- **Okey:** the [live pass](../.todo/epics/epic-everyday-conveniences-round-two-2026-11-17/live-pass.md) and its 14 open decisions (Q1–Q7; B's save-at-once rows; D's defaults 45 and 46; G's duplicate-basename pill labels; `partial` for limited help and lens reads; PR #281's two questions).
- Tech debt: [rejected reply text in logs](../.todo/tech-debt/2026-11-18-lexical-gravity-logs-rejected-reply-text.md), [room context reads unbound to their room](../.todo/tech-debt/2026-11-18-workshop-room-context-reads-unbound-to-room.md), [gated send loses its draft](../.todo/tech-debt/2026-11-18-workshop-gated-send-loses-draft.md), [earlier turns' re-read cost](../.todo/tech-debt/2026-11-18-workshop-earlier-turns-reread-cost.md).
- Features: [jump everywhere](../.todo/features/feature-workshop-jump-to-earlier-turn-everywhere/README.md), [lens search and recommend](../.todo/features/feature-workshop-persona-lens-search-and-recommend/README.md), [`@persona`](../.todo/features/feature-workshop-composer-at-persona/README.md), [guide persona](../.todo/features/feature-prose-minion-guide-persona/README.md); still in their notes: [E's fix 4 and the helper's repair](../.todo/tech-debt/2026-11-09-lexical-gravity-reads-json-without-repair.md), [the `memory.read` fit](../.todo/features/feature-workshop-reads-fit-the-window/README.md).
- After the live pass: archive the epic and its eight source notes, and release (the reference's `overview.md` version moves with the manifest).
