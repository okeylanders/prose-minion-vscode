# PR Review — Show vs. Tell commit, chip, exact reopen, and clone-and-recommit (Slice 4)

**Author:** okeylanders · **PR:** [#137](https://github.com/okeylanders/prose-minion-vscode/pull/137) (open, unmerged at review)
**Branches:** `epic/conversation-widgets-sprint-05-slice-4-commit` → `epic/conversation-widgets`
**Verified base / merge-base:** `d425f4c10cdec544b89581b6ce865d4163058c00`
**Initial reviewed code head:** `151ab955adb8b76c081564a97b12efeae032b441`
**Final re-review head:** `ca306ef406dc7b16066849fe79ea8665040ea08a`
**Initial scope:** 38 files · +3,225 / −187 · 4 commits
**Fix-round scope:** 8 files · +329 / −39 · 1 commit after the first report `39db626c`
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent code/spec review, focused host-boundary and webview-lifecycle audits, adversarial synthetic runtime probes, retained Slice 3 regressions, and full deterministic verification; full fix-delta re-review with independent commit-lock and stale-callback challenges

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf. This ledger records the independently verified state at `ca306ef4`; original evidence below remains pinned to `151ab955`.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | Pending commits accept draft changes that lose edits or destroy retry state | Both original witnesses now assert corrected behavior; pointer/keyboard, real delayed clipboard, captured callbacks, refusal/retry, and generation-position controls pass | **Addressed** at `ca306ef4` |

**Verdict: Approved for merge into `epic/conversation-widgets`.** F-01 is independently verified addressed at `ca306ef4`; no open Blocking, High, Standard, or Nit finding remains. The full deterministic gates and fix-head CI pass. Approval remains subject to required checks on the final report-only branch head. This report does not merge the PR; Slices 5 and 6 remain outstanding.

## Final re-review at ca306ef4

The complete [fix commit](https://github.com/okeylanders/prose-minion-vscode/commit/ca306ef406dc7b16066849fe79ea8665040ea08a) was inspected, including the two presentation changes, controller guards, three pure-helper extractions, tests, and documentation. The [developer response](https://github.com/okeylanders/prose-minion-vscode/pull/137#issuecomment-6085210123) was checked against independent execution.

### F-01 is addressed

- The continuum now receives `disabled={commitPending}` through to the shared radio group. Pointer input and directional/Home/End keyboard input cannot change the submitted position while committing. It remains available during generation, as required.
- The controller reads a current `commitPendingRef` in its writer-edit, generation-input, selection-intake, and Generate paths. Callbacks captured before submission also observe the current guard rather than an old boolean closure. This protects the state owner independently of disabled presentation.
- The original delayed-clipboard witness now preserves the submitted beat, workup, keeps, and carry modes. It exercises the real `UIHandler` and synthetic deferred clipboard adapter, including resolution scheduled from the commit-send microtask. The reply is dropped rather than queued. A refusal permits an exact-draft retry with a new token, and subsequent deliberate edits work normally.
- Full-application success/reopen checks retain the submitted position. Wrong/stale acknowledgements and duplicate-submit controls still pass. Generation-time position movement keeps the active attempt and later workup.
- Authoritative source/model invalidation remains active, including during a pending commit. The writer-input lock does not suppress the previously required invalidation when the underlying room/source changes.
- The three extracted source-reference, POV-mode, and carry-mode helpers preserve the prior transformations and defensive source-reference copying. The controller remains **498 lines**, with pure rules at **381 lines**. No host/persistence/transport ownership changed.
- No new actionable finding was established in the fix delta.

### Final re-review verification

All checks below target **`ca306ef406dc7b16066849fe79ea8665040ea08a`**, before this report-only update, with the same Node/npm runtime and unchanged lockfile.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **288 suites / 4,062 tests / 2 snapshots passed**, 145.735 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,105 warnings**, unchanged from the initial review |
| `npm run build`, including `verify:bundle` | Passed; existing three webpack size/performance warnings |
| `git diff --check` over the fix and complete PR deltas | Passed |
| Independent corrected UI/controller regressions | **3 suites / 63 tests passed**, 40.174 seconds; both corrected original witnesses also fail as expected against exact pre-fix modules from `39db626c` |
| Retained independent Slice 3 lifecycle probes | **2 suites / 30 tests passed**, 33.775 seconds |
| Retained independent host adversarial probes | **65 tests passed**, 5.776 seconds |
| Fix-head GitHub CI | **Success**, [PR run 37961185697](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37961185697) |

The original findings below are historical evidence, not claims about the fixed head. Verification remains deterministic/synthetic: no live provider, real clipboard/manuscript, native browser rendering/traversal, or interactive VS Code Extension Development Host was exercised. This review changed only this report and performed no functional correction, real-room widget commit, merge, or release.

## Original finding at 151ab955

## F-01 — Keep pending-commit authoring consistent with the submitted draft

**Evidence:** [WorkshopShowVsTellModal.tsx:155–182](https://github.com/okeylanders/prose-minion-vscode/blob/151ab955adb8b76c081564a97b12efeae032b441/packages/core/src/presentation/webview/components/workshop/widgets/showVsTell/WorkshopShowVsTellModal.tsx#L155-L182), [unlocked continuum at line 312](https://github.com/okeylanders/prose-minion-vscode/blob/151ab955adb8b76c081564a97b12efeae032b441/packages/core/src/presentation/webview/components/workshop/widgets/showVsTell/WorkshopShowVsTellModal.tsx#L312), [changePosition:362–367](https://github.com/okeylanders/prose-minion-vscode/blob/151ab955adb8b76c081564a97b12efeae032b441/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring.ts#L362-L367), and [selection intake:275–286](https://github.com/okeylanders/prose-minion-vscode/blob/151ab955adb8b76c081564a97b12efeae032b441/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring.ts#L275-L286). **Confidence: High; priority: P2.**

The modal computes `interactionLocked = generating || commitPending` and locks the beat, constraints, channels, keeps, carry, note, model selector, and closing controls. The continuum bypasses that lock: it receives no disabled state, and its controller action accepts every position change. A pending editor-selection reply similarly passes the controller's intake guard, which checks only whether the sheet is open and generation is active, not whether a commit is pending.

Those paths alter the displayed draft after `commitDraft` has already submitted a different draft. A matching success acknowledgement then closes the sheet without retaining or committing the newly displayed changes. The position exception is correct **during generation**, when position may change without discarding the workup; it does not make a pending commit's captured position change retroactively.

### Independent reproduction: position change

The probe uses the **real `WorkshopApp`, modal, controller, transport, and message router**, with snapshots/configs from a real `WorkshopSessionService` and a held synthetic host acknowledgement:

1. Open a committed Hinge draft from its chip and click **Commit as new turn**.
2. Confirm the outbound `WORKSHOP_COMMIT_WIDGET` draft has `position: 'hinge'`, and the sheet displays **Committing…** with the beat and Cancel disabled.
3. Click the still-enabled **State it** radio. It becomes selected and updates the local readout/preview, while the outbound draft remains Hinge.
4. Deliver the matching success acknowledgement. The sheet closes.
5. Reopen the draft actually submitted to the host. It is still Hinge; the apparently accepted State it edit is gone.

This is a normal visible control, not a direct invocation of an otherwise inaccessible controller method. It can occur for as long as the host commit acknowledgement is pending.

### Independent reproduction: delayed editor selection

1. Reopen a valid clone and click **Use editor selection** with no active editor selection. The real `UIHandler.handleSelectionRequest` waits on a deferred synthetic clipboard read.
2. Before that read resolves, click **Commit as new turn**.
3. Resolve the clipboard promise to a different synthetic beat. The real handler emits its normal `SELECTION_DATA` response through the application router.
4. The pending sheet changes the beat and clears its generated workup/keeps, even though the submitted draft still contains the previous beat/workup.
5. Deliver a matching host refusal. Instead of retaining the exact valid clone for retry, the sheet now has no workup and Commit is disabled. The writer must regenerate work that the rejected commit was supposed to leave intact.

This is a reachable asynchronous path: [`UIHandler.handleSelectionRequest`](https://github.com/okeylanders/prose-minion-vscode/blob/151ab955adb8b76c081564a97b12efeae032b441/packages/core/src/application/handlers/domain/UIHandler.ts#L323-L370) awaits the clipboard fallback when the editor has no selection. Disabling the intake button after submission does not invalidate that earlier request. This is the same pending-commit draft-ownership gap, not a separate finding.

### Requested correction

Make commit-pending authoring a coherent state across presentation and controller/intake paths. Disable continuum pointer/keyboard changes while a commit is pending, and prevent late selection intake from rewriting that pending draft. Preserve the intentional position-change exception during generation and the existing source/model invalidation rules. On a refusal, the writer should retain the exact submitted draft and be able to edit/retry; on success, the closed sheet must not discard edits it visibly accepted after submission.

Add protective full-app regressions for both witnesses, including keyboard position input, delayed selection delivery, rejection/retry, and the generation-time position exception. The current “locks the sheet” tests assert Cancel, Regenerate, and Commit but never challenge the continuum or a previously requested selection response.

## What is sound

- **Slice boundary and architecture.** The branch is based on the merged Slice 3 epic tip. The new host preparation is feature-owned and joins the existing closed one-shot registry; the shared coordinator remains feature-neutral. Recommendation, prefill, and the Host-preparation door remain Slice 5 work. The authoring controller is 497 lines with coherent transport-free commit/invalidation siblings.
- **Host authority.** The webview sends the full draft, not compiled artifact text. The host validates its closed shape, eligibility, and integrity, then reprojects and remeasures the counted body before mutation. Independent 599/600/601 controls accept exactly at or below the ceiling and reject above it.
- **Passive warnings and bounded projection.** Kept variants ship in workup order. Their typed flags are appended as separate warning lines, outside the frozen 600-character body count, and do not veto a valid 600-character commit. Line-break encoding preserves one artifact line per value. The envelope and warning count remain separate from the shared meter projection.
- **Trust boundary.** `widget:show-vs-tell` is a valid kind under the existing reserved `thread-artifact` envelope, so no new delimiter registration is needed. Nested/case-varied forged reserved tags are neutralized at frame construction. No editor-write operation is introduced.
- **Durable ownership.** Real session/coordinator probes retain exact draft data and defensive copies, mint distinct clone identities, reject invalid clone sources before mutation, preserve unsent composer attachments, and remain hydratable after success, refusal, pre-accept failure, rollback, and post-accept cancellation.
- **Reopen and correlation.** The chip uses presentation-only counts from bounded host summaries; snapshot replacement replaces that map rather than retaining stale counts. Clone reopening preserves the full draft and lineage, including an unresolved source reference. Such a source prevents regeneration but not recommitting the already generated artifact. Wrong/stale acknowledgements cannot settle another commit, duplicate same-tick transport submission is suppressed, and refusal permits a fresh-token retry.
- **Previous protections survive.** All 30 independent Slice 3 source/room lifecycle regressions pass against this head after the hook extraction, including replacement, source edits/refresh, transaction rollback, and stale result handling.

## Initial verification actually run

All checks target **`151ab955adb8b76c081564a97b12efeae032b441`**, before this report-only commit. Runtime: Node **24.19.0** / npm **11.9.0**. The lockfile is unchanged; the isolated review worktree reused the prior lockfile-installed dependency tree. TypeScript, Jest, and webpack resolve repository source through this worktree's path mappings.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **288 suites / 4,053 tests / 2 snapshots passed**, 186.626 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,105 warnings**; one additional naming-convention warning at the new hyphenated registry key |
| `npm run build`, including `verify:bundle` | Passed; existing three webpack size/performance warnings |
| `git diff --check d425f4c1..151ab955` | Passed |
| Independent host adversarial probes | 65 tests passed: exact ceiling, malformed/forged inputs, flags, line breaks, reserved tags, coordinator outcomes, clone provenance, concurrency/retry |
| Independent UI lifecycle probes | **2 suites / 27 tests passed**: two reproduce F-01; 25 controls cover refusal/retry, correlation, exact reopen, summaries, generation-time position changes, and invalidation |
| Retained independent Slice 3 lifecycle probes | **2 suites / 30 tests passed**, 45.696 seconds |
| Code-head GitHub CI | **Success**, [PR run 37958330653](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37958330653) |

A passing bug-witness test means it reproduced the undesirable behavior. Native browser visual rendering, native keyboard traversal, an interactive VS Code Extension Development Host, and live/billable provider calls were **not** independently run. The UI evidence above is JSDOM with real application/controller code and synthetic host messages, including a real selection handler with a deferred synthetic clipboard adapter; the host tests use synthetic adapters and real session/coordinator behavior. No real manuscript was transmitted, and no functional repository edit, widget commit to a real room, merge, or release was performed by this review.

The final re-review above supersedes the initial changes-requested verdict.
