# Epic: Helper Agent

**Status:** Slice 0 (spec) in review. Slice 1 starts in parallel.
**Priority:** Medium
**Created:** 2026-11-05
**Integration branch:** `epic/helper-agent`, cut from `epic/workshop-bookmark-recall` at `b4ca7b86` (the feature tip: Bookmark Recall Slices 0–3, #222, and `main` with Project Memory and Pinned Context). Each slice is built on `epic/helper-agent-slice-<N>-<slug>` and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-05: A Helper Agent for Small Tasks](../../../docs/adr/2026-11-05-helper-agent.md) (Proposed; defaults taken for Q1–Q3)
**Downstream of:** Bookmark Recall. Its live-pass fixes are merged in as they land. The epic goes to `main` after Bookmark Recall does.
**Sibling:** [Workshop Persona File Edits](../epic-workshop-persona-file-edits-2026-11-05/README.md) runs in parallel. Whichever reaches `main` second merges the other first.

## Goal

- **One agent for small model jobs.** It has a generic system prompt, tasks as policies, and its own model scope. It never writes anything itself.
- **Its first job is automatic.** When the writer presses **Save to memory…** on a bubble (or **Remember this** on a bookmark), the sheet opens at once, and the title, summary and kind fill in while the writer looks. Anything the writer types first wins.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR and this epic | All | In review |
| 1 | Engine | `helper` model scope end to end; `HelperAgentService` with the task registry, the generic prompt, and the `memory-draft` task (prompt section, worked example, codec, budgets, sync tests); composition root and `CoreServices`. No routes, no UI. | D1–D4, D5's codec | Built ([slice doc](slice-1-engine.md)) |
| 2 | Drafting in the memory sheet | Draft request and result routes; the handler reads the turn host-side (live turn, or a saved turn through recall's `savedTurn`); the hook's correlation and untouched-field fill; the "Drafting…" placeholders; the quiet failure line; the `helperDrafts` setting | D5 | Not started |
| 3 | Verify live | Extension Development Host pass; ADR → Accepted; memory bank; `AGENTS.md` | — | Not started |

**Order:** 1 → 2 → 3. One thread builds 1 and then 2, as two PRs.

## Defaults taken (Okey delegated; he may override)

- **Model:** `helper` follows **Proofread's** model until the writer picks one.
- **Kind:** the draft chooses the memory's kind too.
- **Remember this:** a bookmark's Remember this gets a draft too.
- **Setting:** `proseMinion.workshop.memory.helperDrafts`, default on. Slice 2 decides whether the Memory tab also shows it, following the settings pattern.

## How the slices are built

This is the same flow as Project Memory and Bookmark Recall.

- **One implementation thread per slice.** It works on its slice branch, cut from the epic, and reads:
  - this README;
  - the ADR;
  - `AGENTS.md`, mainly the model-setting steps ("A model setting"), Draft Edit's passes-as-policies and reasoning levels, and Workshop Project Memory's rules.

  It builds, verifies, commits and pushes, then messages the coordinator with its head and counts.
- **The coordinating thread** (`session_01UrwcevhVS535zW3cPqMrv6`) opens each PR into `epic/helper-agent` and watches it. Astra reviews each PR.
- **Findings are fixed on the slice branch**, and answered in the review's ledger.
- **Merging into the epic.** Once a PR is green and its findings are settled, the coordinator merges it into the epic with a merge commit pinned to its head.

## Verification (every slice)

- `npm run typecheck`
- `npm run lint`: no new errors. Only new warnings count.
- `npx jest`: the full suite passes. Record the counts in the progress notes, and take a baseline on the epic's first commit.
- `packages/core/src` has no `from 'vscode'`.
- **File size.**
  - No new file goes over 500 lines.
  - A file already over 500 lines grows only by the seam: `WorkshopApp.tsx` (1,873), `MessageHandler.ts` (988), `extension.ts` (977), `promptBudgets.ts` (817).
  - `useWorkshopProjectMemory.ts` is at 498 lines, so the draft's correlation goes into its own module, never into the hook's body.
- **Model calls.** Tests use a mocked transport. No live, billable call.
- **Logs** never carry the writer's text. Fixtures use *Alice*.
- **Completion criteria** are each backed by a named test, or stated as covered by the Slice 3 live pass.

## Completion Criteria

- `helper` is a model scope like the others: a setting, a row in the Settings overlay, `MODEL_DATA` selections, and following Proofread's model until picked.
- Adding a task means a policy, a prompt section, a worked example and a sync test. The engine has no task-specific branch.
- **The helper writes nothing.** `boundaries.test.ts` pins that it imports no Workshop, Lightbox or Draft Edit module.
- **Opening the sheet from a bubble** fills the title, summary and kind from the helper's answer, without waiting on anything:
  - only the answer to the sheet's own request is taken;
  - a field the writer touched is never overwritten;
  - the body is never changed.
- **Remember this** on a bookmark drafts the same way, from the saved turn.
- **Failure leaves the sheet as it is today**, with one quiet line: no key, an error, a timeout, a malformed answer, or the setting off.

## Progress Notes

- **2026-11-05. Slice 0.**
  - Okey asked for a general assist agent with a generic prompt. Its first job is titling and summarizing a memory on Save to memory…, and a later job is configuring project locations from a workspace scan.
  - He chose automatic drafting, then handed the implementation to the coordinator.
  - ADR drafted, defaults taken, epic cut from the Bookmark Recall tip at `b4ca7b86`.
- **2026-11-05. Slice 1 (Engine).** See [slice-1-engine.md](slice-1-engine.md).
  - Baseline at `a02d785d` (Node 22 in this container): 753 suites / 10,481 tests / 59 snapshots, all passing; lint 0 errors, 1,165 warnings.
  - `helper` is a following scope (`MODEL_SCOPE_FOLLOWS.helper = 'proofread'`). Following was already keyed by that map; only comments and one header chip assumed the assistant model.
  - `HelperAgentService` with `HELPER_TASK_POLICIES` (`memory-draft`), the generic prompt, the task's section and worked example, its codec and budgets. Built in `extension.ts`, in `CoreServices`; no routes or UI yet.
  - Verification: typecheck clean; lint 0 errors and no new warnings; jest 757 suites / 10,520 tests / 59 snapshots, all passing; no `from 'vscode'` in `packages/core/src`.
