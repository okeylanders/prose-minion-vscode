# Epic: Passage Search

**Status:** Slice 0 (this README and the ADR) is merged (`e45d8d1b`). Slice 1 (the engine, PR #293) is merged (`773543f0`). Slice 2 (the sidebar subtab, PR #294) is merged (`8b441e55`). Slice 3 (the organizing pass, PR #295) is in review on `epic/passage-search-organize`. The persona request is not started.
**Priority:** Medium
**Opened:** 2026-11-20
**Branch:** `epic/passage-search`, cut from the tip of `epic/workshop-persona-tools` at `1b3b9239`, so the epic starts with Persona Tools in it. That epic is built and waits for Okey's live pass and its own PR to `main`.
**ADR:** [2026-11-20: Passage Search](../../../docs/adr/2026-11-20-passage-search.md)
**Source note:** `.todo/features/feature-passage-search/README.md` on `main` (read with `git show origin/main:…`). **It is never edited on this branch.** Status and decisions live here and in the ADR.

## Goal

A third Search subtab that reads. The writer asks a question ("Find every
time Jasper adjusts his glasses"), the reads fan out across the scope,
every quote is checked by host code, and a final pass organizes what was
found. A persona can ask for the same search; the writer approves its
price.

| # | Okey's decision | Where |
|---|---|---|
| P1 | A final organizing pass over the checked instances: headline and sections, every claim cited by number. On by default, with a toggle, priced in the estimate. | ADR D12, D13 |
| P2 | Personas can run it: a trailer, a card with calls and price, Run and Cancel; the persona is then started with the results. | ADR D16–D21 |
| P3 | An engine a research agent can call later: host-free, UI-free, callers own consent. | ADR D1, D2, D11 |
| P4 | Any project locations, several at once; a persona names groups or files by catalog key only. | ADR D3, D4, D6 |

## Slices

| # | What | Decisions | Branch | PR | Status |
|---|---|---|---|---|---|
| 0 | Spec: this README and the ADR | | `epic/passage-search-spec` | #292 | Merged (`e45d8d1b`) after three Astra rounds (D2a, D3a, D5a, D9a, D11a, D12a, D19a) |
| 1 | The engine: scopes and the root-aware listing, reading order, chunks, the fan-out, the reply codec, anchoring, the merge, the plan, `planKey` and estimate, the `passageSearch` model scope and run policy, the boundary test. The organizing pass's seam and result field, not the pass. No UI. | D1–D11 with D2a, D3a, D5a, D9a, D11a; D14, D22, D23 | #293 | Merged (`773543f0`) |
| 2 | The sidebar subtab: scope picker, question, plan, Run, progress, Stop, results, open at a line, Copy, Save, the Settings row, help | D15, D24 | `epic/passage-search-sidebar` | #294 | Merged (`8b441e55`) |
| 3 | The organizing pass: its call, codec, citation and quotation checks, its price | D12, D12a, D13 | `epic/passage-search-organize` | #295 | In review |
| 4 | The persona request: trailer, settlement, card, outcome kind, the handler, the directed results run, the directive and its fit, help | D16–D21, D19a, D24 | `…-persona` | | Not started |
| Close | Live-pass checklist, `AGENTS.md`, memory bank | | `…-close` | | Not started |

Slice branches are `epic/passage-search-<slug>`.

## Order

1. **Slice 0.**
2. **Slice 1,** alone: every other slice stands on its types.
3. **Slices 2, 3 and 4 side by side.** They share `promptBudgets.ts`,
   `boundaries.test.ts` and the help files; the later to merge takes the
   others' lines.
   - Slice 2's "Organize the results" toggle sends the option from the
     start; it begins to do something when Slice 3 merges.
   - Slice 4's directive carries the analysis when the result has one.
4. **The closing pass.**

## Defaults taken

Okey's P1–P4 are fixed. Each row below is the orchestrator's, and Okey's to
overturn.

| # | Default | Why |
|---|---|---|
| 1 | The name is **Passage Search**, subtool id `passage`. | The note's recommendation. |
| 2 | **Two layers:** `PassageSearchService` (model work, in `infrastructure/api/services/search/passage/`) and `PassageSearchEngine` (scopes plus the service, in `application/services/passageSearch/`). | Scope resolution needs the context-path pattern rules, which live in the application layer; infrastructure never imports up. Callers hold the engine only. |
| 3 | **`plan` then `run(plan)`**, in place of `estimate` and `run`. The plan holds the model, the files as read and the chunks; `run` reads nothing again. | "The approved model is the model", extended to the text: what was priced is what is searched. |
| 4 | **12,000 words a call**, lowered to fit half the model's window when the catalog knows it; refused under 1,500. | Craft Flags reads 25,000 because a category needs the chapter at once. Finding *every* instance loses recall over long texts, and 12,000 still keeps nearly every chapter whole. A live-pass question (ADR Q2). |
| 5 | **Four calls at a time.** | The note's figure. |
| 6 | **Bounds:** 12 scopes, 200 files, 300 calls, 2 MiB a file, 2,000 instances kept. | Large enough for a long manuscript at one call a chapter; small enough that a typo'd pattern cannot start thousands of calls. |
| 7 | **An ambiguous quote is dropped** and counted, unless its context places it. | Draft Edit's fail-closed rule. The other choice invents a location. ADR Q1. |
| 8 | **A reply cut off at its ceiling keeps its finished instances** (`salvageModelJson`), and the call is counted as cut. | Proofread rejects a cut reply because it would apply edits; a search only lists, so keeping checked quotes loses nothing. |
| 9 | **Overlapping ranges in one file are one moment;** the earliest is kept. | Covers the overlap paragraph and a model listing a moment twice. |
| 10 | **No reasoning setting is sent.** | `AGENTS.md`: only Proofread, Craft Flags and the helper send one. |
| 11 | **The organizing pass samples evenly** when the instances exceed its input budget (24,000 tokens), and says how many it read. | Cutting the tail would bias "across chapters" toward the early ones. |
| 12 | **The sidebar gets no single-file picker.** Its scopes are Active File, Selection, the eight groups and a pattern. | The shared project picker is a full-tab component. The engine takes a file by catalog key, which a persona uses. ADR Q6. |
| 13 | **Bring a sidebar result to the Workshop: later.** | The brief's default 2. |
| 14 | **A persona names scopes as `resource.read` names files:** `<group>` for a whole group, `<path group="…">` for one file, and `<excerpt/>`. | The brief's default 3; the note's P2 lists the excerpt. |
| 15 | **A `text` scope** (a label and a text, by value) carries the room's excerpt. | The engine cannot know what an excerpt is. A research agent can use the same kind. |
| 16 | **The organizing pass runs on the `passageSearch` scope.** | The brief's default 4. |
| 17 | **The trailer is its own outcome kind,** `passageSearch`. The results directive is tallied under a new piece, `room.passage-search`. | The brief's default 5. |
| 18 | **The trailer's grammar is a tool-use prompt section,** held to the codec by a sync test. | The brief's default 6. |
| 19 | **No setting turns persona requests off.** | Nothing is spent until the writer presses Run, as to-do status has no setting. |
| 20 | **The card's estimate is asked when the card is drawn,** not at the reply's commit; Run plans again and runs only on the same `planKey`, else shows the new price. | Pricing reads every file, which would hold up the reply's commit. A stored price would also be stale after a reload. |
| 21 | **A persona's search is the window's:** a reload or a replaced room stops it, and the card reads pending again. | No card today survives host work across a reload; durable runs are a feature of their own. ADR Q3. |
| 22 | **When the search finishes and the room is busy, the card waits** with **Send to <persona>**. | A results run cannot start inside another run. |
| 23 | **Open report saves** the Markdown report under `prose-minion/reports/` and opens it. Results are held per window, newest 4. | The Workshop has no report viewer; the saved report is the one the sidebar saves. |
| 24 | **The results run is an ordinary streamed reply,** through a `WorkshopDirectedRun` union; edit offers keep their branch. | The persona answers the writer in prose, and may propose things. |
| 25 | **`findConfiguredResource` moves to a neutral module;** `formatApproximateUsd` becomes one shared formatter. | The engine may not import a Workshop path. Three copies of the price format already exist. |
| 26 | **`ShellService.openFileInEditor` gains an optional `line`.** | Nothing opens a file at a line today. |
| 27 | **Natural order sets the extension aside and compares path segments.** | Otherwise `6.9.2.md` sorts before `6.9.md`. |
| 28 | **A group is every file its own patterns match,** across every workspace root, even when the picker shows that file under another group. | The browse catalog keeps a file in its first group only and merges same-named files across roots, so a search of "manuscript" could read nothing (PR #292 F2). This is wider than the note's "exactly what the picker shows". |
| 29 | **Stop starts no model call.** A stopped search is not organized and not sent to the persona; **Organize these results** (sidebar) and **Send partial results** (card) are separate presses. | PR #292 F4: Stop must not spend. |
| 30 | **A paragraph over the budget is split at sentence ends;** a file with a sentence over the budget is left out and said so in the estimate. | PR #292 F3. |
| 31 | **The organizing pass is priced as an allowance** (6,000 tokens in) inside the first estimate, and exactly when run afterwards. | PR #292 F6: its input does not exist when the search is priced. |
| 32 | **The quote shown is the source's text,** never the model's spelling. | PR #292 F7. |

## Shared seams

- **`PROMPT_BUDGETS`:** `passageSearch` (Slice 1, with `organize` filled in
  by Slice 3) and `workshopPassageSearch` (Slice 4).
- **`boundaries.test.ts`:** the engine's boundary and module lists
  (Slice 1); `WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES` and "no Workshop
  module constructs a `pattern` scope" (Slice 4).
- **The model path:** `configuration.ts`, `ModelScopeSelections.ts`,
  `AIResourceManager.ts`, `MODEL_KEYS` (Slice 1); the Settings row and the
  manifest (Slice 2).
- **`extractWorkshopReplyControls`,** trailer outcomes and the session
  shape: Slice 4 only.
- **The help reference:** `sidebar-tools.md` and `settings.md` (Slice 2),
  `workshop.md` (Slice 4).
- **`Platform`:** `ShellService.openFileInEditor`'s `line` (Slice 2).

## Rules binding every slice

**Branches and review**
- Slice PRs go into `epic/passage-search`.
- **Astra** reviews each. A slice is merged with a merge commit, and only
  after Astra approves. Findings are fixed on the slice branch, answered in
  the PR and re-reviewed.
- When `epic/workshop-persona-tools` moves, or reaches `main`, it (or
  `main`) is merged into the epic. Never rebase.
- **Nothing targets `main` without Okey,** and not before Persona Tools has
  merged. Never commit to `main` or `claude/idea-inbox`. Never touch
  `epic/workshop-persona-tools` or its PRs.

**Verification**
- `npm run typecheck`.
- `npm run lint`: no new errors.
- The full `npx jest`, with its counts in the PR.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines. A file already over 500 lines gains only the
  call into a new module.
- No live, billable model calls in tests.

**Writer data**
- Logs carry counts, ids and fault kinds only: never the question, a
  quote, a note, a label, a path, a pattern or a group's file names.
- Fixtures use *Alice*-style made-up text.
- A session-codec change is optional and additive (ADR 2026-07-30), with
  an authentic fixture from before the slice that must keep reading.

**Contracts**
- **Help.** A surface is complete only with its section in
  `packages/core/resources/help/`, and its setting mapped in
  `help/index.json`. Run
  `node apps/vscode-extension/scripts/generate-help-tables.js` when the
  manifest changes.
- **Context tally.** The results directive is tallied where it is placed.
- **Trailer outcomes.** The new kind gets typed verdicts, a mapping and
  words; the conservation test must hold.
- Webview hooks are tripartite, with webview-minted request ids; only the
  pending answer is taken.

**At the end**
- A live-pass checklist (`live-pass.md`), with a real model, per surface.
- `AGENTS.md` updated where a rule changed.
- A memory-bank entry.
