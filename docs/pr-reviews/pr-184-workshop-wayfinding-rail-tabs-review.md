# PR Review: Workshop Wayfinding Slice 1, Material and Notes rail tabs

**Disposition: Changes requested. One reproduced P2 state-loss regression; two nonblocking P3 accessibility notes.**

**Author:** okeylanders · **PR:** [#184](https://github.com/okeylanders/prose-minion-vscode/pull/184) · **Reviewer:** Chatty · **Reviewed:** 2026-11-03

**Branches:** `epic/workshop-wayfinding-slice-1-rail-tabs` → `epic/workshop-wayfinding`

**Implementation head:** `c888b9800ca93dabcafae63a80d1b6117baadd3a`

**Base and merge-base:** `fddc4849cd7dc418a600116c14752488746b81ff`

**Scope:** 13 files · +1,031 / −200 · implementation tree `8e2d70bb666d8b22ca26fd6d7d861ef8fdf44c7a`

## Summary

The rail extraction preserves the existing panel callbacks, leaves the shared shell components alone, and keeps tools reachable from the composer and empty-thread quick starts. Tab selection, persistence, keyboard navigation, counts and room-generation badge resets pass the focused tests. The badge implementation follows amended D1.

One unsaved editor state still lives below the new unmount boundary. Switching to Material while editing a to-do silently discards the writer's correction. This is independently reproduced despite the existing tests and PR CI passing.

This report is not a formal GitHub review or merge approval. Only this report is published; implementation, tests and dependencies are unchanged.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Switching tabs discards an unsaved to-do edit | **Open; changes requested** |
| N-01 | Low / P3 | Inactive tab references a nonexistent tabpanel | **Open; nonblocking** |
| N-02 | Low / P3 | Empty Notes panel is absent from the keyboard tab sequence | **Open; nonblocking** |

## F-01: Preserve the to-do edit draft across tab switches

**Locations:** [`WorkshopRail.tsx:147–154`](https://github.com/okeylanders/prose-minion-vscode/blob/c888b9800ca93dabcafae63a80d1b6117baadd3a/packages/core/src/presentation/webview/components/workshop/WorkshopRail.tsx#L147-L154), with local state in [`WorkshopTodoList.tsx:16–17`](https://github.com/okeylanders/prose-minion-vscode/blob/c888b9800ca93dabcafae63a80d1b6117baadd3a/packages/core/src/presentation/webview/components/workshop/WorkshopTodoList.tsx#L16-L17).

The new conditional panel unmounts `WorkshopTodoList` when Material is selected. The list still owns `editingId` and `draft` in local React state. Neither is passed from a persistent owner, saved on tab change, nor guarded by a discard confirmation.

**Reproduction:**

1. Open Notes with an existing to-do.
2. Choose **Edit task** and type a correction without saving.
3. Select Material, then return to Notes.
4. The edit input has disappeared and the original task text returns. No edit action was dispatched.

An independent component probe using the production `WorkshopRail` and controller confirms the original text is visible and `onAction` was never called, then fails the preservation assertion because `queryByRole('textbox', { name: 'Edit task text' })` returns `null`. The four existing component controls still pass.

This violates the slice's explicit requirement to keep state above an inactive panel so switching tabs loses nothing ([slice document:55–56](https://github.com/okeylanders/prose-minion-vscode/blob/c888b9800ca93dabcafae63a80d1b6117baadd3a/.todo/epics/epic-workshop-wayfinding-2026-11-03/slice-1-rail-tabs.md#L55-L56)). Before the change, the to-do list stayed mounted while the writer consulted the excerpt or context.

**Requested correction:** lift the edit state above the panel-unmount boundary, consistent with the slice design, and reset it deliberately when its room or task no longer applies. Add a regression that edits a task, visits Material, returns to Notes and saves the same draft. Preserve normal Escape/cancel and explicit save behavior. Do not silently autosave merely to retain navigation state.

## N-01: Keep each tab's ARIA panel relationship valid

**Locations:** [`WorkshopRail.tsx:124`](https://github.com/okeylanders/prose-minion-vscode/blob/c888b9800ca93dabcafae63a80d1b6117baadd3a/packages/core/src/presentation/webview/components/workshop/WorkshopRail.tsx#L124), [`141–145`](https://github.com/okeylanders/prose-minion-vscode/blob/c888b9800ca93dabcafae63a80d1b6117baadd3a/packages/core/src/presentation/webview/components/workshop/WorkshopRail.tsx#L141-L145).

Both tabs advertise distinct `aria-controls` IDs, but only the active ID exists. With Material selected, resolving Notes' `aria-controls` through `document.getElementById` returns `null`; switching tabs reverses which reference is missing. A production-component DOM probe confirms this.

The [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) associates each tab with its tabpanel. Keep stable panel containers and unmount only inactive contents, or use another valid relationship strategy. Extend the ARIA test to resolve both references rather than checking only that the strings are populated and distinct.

This is a nonblocking relationship concern. The active panel relationship and automatic keyboard activation work; no native screen-reader navigation failure is claimed.

## N-02: Make empty panel content reachable in the tab sequence

**Location:** [`WorkshopRail.tsx:141–146`](https://github.com/okeylanders/prose-minion-vscode/blob/c888b9800ca93dabcafae63a80d1b6117baadd3a/packages/core/src/presentation/webview/components/workshop/WorkshopRail.tsx#L141-L146).

With zero to-dos, Notes contains the heading and empty-state instructions but no focusable controls. The panel itself has no `tabIndex`. The production-component DOM probe records `panel.tabIndex === -1` and no descendant button, input, link or explicit tab stop.

The [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) recommends `tabindex="0"` when a panel has no focusable content, or its first meaningful content is not focusable. Provide an appropriate panel focus target and test the empty state. This is nonblocking; no native keyboard or screen-reader acceptance is claimed.

## Independent verification

Read the repository agent guidance, the Wayfinding ADR including amended D1, the slice specification, changed production/tests and adjacent state owners. Rechecked the PR head before publication. Compared this head with the earlier implementation head `bf0e0e6f6809557d639e677bfaca7e12a4a94f81`: `WorkshopRail`, `WorkshopTodoList` and `WorkshopApp` are byte-identical. The controller's source-kind filter removal and unused `.pm-ws-block-grow` cleanup introduce no additional finding.

Local verification used an isolated checkout at the exact implementation head, Node **24.22.1** / npm **11.9.0**. Cached dependencies were reused after confirming external lockfile entries match; TypeScript/Jest aliases resolve this checkout.

| Check | Result |
| --- | --- |
| Focused rail/controller/App Jest on `c888b980` | **3 suites / 23 tests pass** |
| Independent draft-preservation probe on `c888b980` | **1 expected failure; 4 existing component controls pass** |
| Independent accessibility DOM observations on `c888b980` | Missing inactive target and empty-panel tab-stop gap confirmed |
| Fresh `npm run typecheck` on `c888b980` | **Pass**, core, webview and extension |
| Fresh `npm run lint` on `c888b980` | **0 errors / 1,133 warnings** |
| `git diff --check fddc4849 HEAD` | **Pass** |
| PR CI associated with `c888b980` | **Success**, inspected job steps and logs |
| Full local suite / local production build at `c888b980` | **Not rerun locally**; full CI results below |

Focused command:

```sh
npx jest --runInBand --runTestsByPath \
  packages/core/src/__tests__/presentation/webview/WorkshopApp.railTabs.test.tsx \
  packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopRail.test.tsx \
  packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/controllers/useWorkshopRailTabs.test.ts
```

The independent preservation probe reused the component test's `renderRail`, `todo` and `tab` fixtures:

```tsx
const { props } = renderRail([todo('draft')], 'notes');
fireEvent.click(screen.getByRole('button', { name: 'Edit task' }));
fireEvent.change(screen.getByRole('textbox', { name: 'Edit task text' }), {
  target: { value: 'Unsaved writer correction' }
});
fireEvent.click(tab(/^Material/));
fireEvent.click(tab(/^Notes/));
expect(props.todos.onAction).not.toHaveBeenCalled();
expect(screen.getByText('Check the cup in scene draft.')).toBeTruthy();
expect(screen.queryByRole('textbox', { name: 'Edit task text' })).not.toBeNull();
// Fails: received null.
```

Scratch probes were run separately from the repository suite with Jest's `--config`, `--runInBand` and `--runTestsByPath` options. They are not included in the 23 passing repository tests and are not committed.

**CI evidence:** [run 41721379530](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41721379530), [verify job 126214737970](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41721379530/job/126214737970). The workflow is associated with implementation head `c888b980`; its checkout log explicitly shows the synthetic PR merge `18ea21c51214d995b9d3fe18bdec88afa5975bcd`, merging that head into `fddc4849`. On Node 18.20.8, it passes **594 suites / 8,421 tests / 59 snapshots**, typecheck, lint, production build and bundle verification. This distinguishes the CI merge checkout from the exact-head local checks. Legacy commit-status contexts are empty; the inspected Actions result is the evidence for green CI.

## Correction handoff and remaining acceptance

Correct F-01 before accepting Slice 1. N-01 and N-02 are separate nonblocking follow-ups. On the corrected exact head, rerun the preservation case, the focused tests and the normal gates; verify save, cancellation and room replacement without reviving an old draft.

Native VS Code geometry, real browser keyboard default actions, screen-reader behavior and live writer acceptance remain unverified. No provider calls, source changes, formal GitHub approval or merge were made by this review.

## Author response (2026-11-03)

All three findings are fixed in one commit on top of your report's commit
`da59805`. Nothing above this section was edited.

The cause of F-01 was the slice doc itself: it said to keep the inactive
panel unmounted. The fix goes the other way and doesn't lift the draft into
a new owner. **Both panels stay mounted, and the inactive one is `hidden`.**
That is how the to-do list behaved before this slice: mounted while the
writer looked at the excerpt or context. The same change gives each tab's
`aria-controls` a panel that exists (N-01). The draft's reset is
deliberate:
- A new room remounts the to-do list (`key={roomKey}`; first load, New,
  Open, Rewind and Branch each bring a new `roomRevision`).
- A draft whose task leaves the list is dropped
  (`clearDraftWhenTaskGone`), so the id coming back doesn't revive it.

Nothing autosaves.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests |
| --- | --- | --- | --- | --- |
| F-01 | P2 | **Fixed** | `WorkshopRail` renders both `tabpanel`s and hides the inactive one. `.pm-ws-rail-panel[hidden] { display: none }` keeps the flex rule from overriding `hidden`. `WorkshopTodoList` takes `key={roomKey}` and drops a draft whose task is gone. Save, Escape and room replacement keep their explicit behavior. | `WorkshopRail.test.tsx`: **your probe** (edit, Material, Notes: the draft is there and `onAction` is untouched; Save sends that draft); Escape still cancels after a switch, and a switch never autosaves; a new `roomKey` drops the draft, a task leaving the list drops it, and the same id coming back doesn't revive it |
| N-01 | P3 | **Fixed** | Both panel containers always exist, each with its own id and `aria-labelledby`. | The ARIA test resolves **both** tabs' `aria-controls` with `document.getElementById`: each is a `tabpanel` labelled by its tab, and `hidden` exactly when its tab isn't selected |
| N-02 | P3 | **Fixed** | Each `tabpanel` has `tabIndex={0}`, following the WAI-ARIA tabs pattern for panels whose first content isn't focusable. | An empty Notes panel holds no button and has `tabIndex === 0`; so does Material's |

### What fails where

On the reviewed head's `WorkshopRail.tsx` and `WorkshopTodoList.tsx`, with
the new tests in place, 5 of the 8 `WorkshopRail` tests fail: the ARIA
relationship test, N-02, F-01, Escape after a switch, and the room and task
reset. The three earlier controls pass. On the corrected sources, all 8
pass.

### Verification

Recorded on the PR, for the corrected head: the full suite, typecheck,
lint, and `git diff --check`.
