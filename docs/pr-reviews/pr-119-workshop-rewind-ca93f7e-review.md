# PR Review — Workshop Rewind and Branch: Sprint 02 Rewind

**Author:** okeylanders · **PR:** [#119](https://github.com/okeylanders/prose-minion-vscode/pull/119) (Open)
**Branches:** `sprint/workshop-rewind-and-branch-02-rewind` → `epic/workshop-rewind-and-branch`
**Base:** `96dd0dff53c8be4cb23c53673da7240eb2b90e25` · **Head:** `ca93f7ea6ad8b63bab10828a58a92d4357081ad3`
**Scope:** 57 files · +4,020 / −239 · 12 commits
**Reviewed:** 2026-10-01 · **Mode:** quick Ada Forge review with an independent Blake correctness pass over the transform and persistence coordinator. Format follows the recent reviews in this directory. This is a focused review, not the full specialist panel.

## Resolution ledger

Status legend: **Open** = actionable recommendation with the deadline stated below · **Deferred** = an explicitly accepted follow-up · **Addressed** = fixed · **N/A** = praise or no action. No follow-up has been accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🔵 Nit | Rewind confirmation recommends Branch before that action exists | Confirmation helper and WorkshopApp test compared with Sprint 03's delivery plan | **Open** — resolve when the UI is released: implement Branch in Sprint 03, or omit the recommendation if Rewind ships independently. *Tracking:* the epic merges to `main` as one unit, so Rewind never ships without Branch. The sentence and its test stay, and Sprint 03's exit criteria close F-01 once Branch lands |
| F-02 | 🟢 Praise | The pure transform cuts both room representations together and validates its output | Source tracing, equivalence oracle, transform tests, and independent correctness review | N/A — preserve |
| F-03 | 🟢 Praise | Ordinary write failures retain a usable rollback room; named mirror failures have separate retry semantics | Coordinator/install/rollback source tracing and passing coordinator/persistence tests | N/A — preserve |

**Verdict:** Approve for integration into the epic branch. No Blocking, High, or new Standard correctness finding was identified. F-01 is an interim UI-copy nit. Branch delivery, recorded manual smoke, and the already tracked follow-ups remain part of the epic's release assessment.

---

## Verification actually run

Checks performed against the reviewed implementation head, before adding this report:

| Check | Result |
| --- | --- |
| Local checkout equals live PR head `ca93f7ea6ad8b63bab10828a58a92d4357081ad3` | ✅ |
| GitHub `verify` check at that head | ✅ Success; no existing issue comments or submitted PR reviews were present when checked |
| `npm test -- --runInBand` | ✅ 225 suites / 2,614 tests / 2 snapshots passed |
| `npm run typecheck` | ✅ Core, webview, and extension projects passed |
| `npm run lint` | ✅ Exit 0; 0 errors / 1,026 warnings. Baseline lint was not rerun; no independent warning-delta claim is made |
| `npm run build` | ✅ Extension and webview webpack builds plus `verify:bundle` passed; webpack reported bundle-size warnings |
| `git diff --check 96dd0dff...ca93f7ea` | ✅ |
| Independent Blake pass | ✅ No substantive correctness findings; source review only, no additional test run |
| Live provider calls, Extension Development Host smoke, visual/accessibility inspection | Not performed in this review |

The working tree initially had only the existing untracked prompt-cache feature directory, ZIP, and conversation-ownership document. Those are outside the review and publication scope. No implementation files were changed.

Governing material reviewed: `AGENTS.md`, the PR metadata and description, changed production code and relevant tests, [ADR 2026-09-30](../adr/2026-09-30-workshop-rewind-and-branch.md), the epic's Sprint 02/Sprint 03 plans, the two new debt records, and the prior PR #117 review. Inspection concentrated on cut exactness, participant lifetimes, pending deliveries, persistence failure boundaries, and the host-to-webview edit flow.

---

## Executive briefing

The implementation earns the central promise: one pure function cuts the ledger and retained provider histories together, and a coordinator installs that pair through the same import/hydration core Open uses. The transform uses retained-history marks instead of interpreting provider messages. Removed memberships are handled explicitly, counters stay current, and the next host interaction receives any current excerpt/context update missing from its cut history.

The failure boundary is sensible. The prior runtime conversations remain available while transformation, import, hydration, and the authoritative write run. A failure restores the prior aggregate and bindings; successful replacement retires the old conversations afterward. The protected-`current.json` case is an explicit exception: the rewind remains in memory and emits a save error. That behavior is documented and tested, so this review does not describe every successful rewind as durably saved.

The webview waits for the authoritative snapshot, then restores edited text through the existing composer route. Nothing cuts the local thread optimistically. The host maps the requested bubble to its cut and rechecks policy independently of the displayed button.

---

## Findings

### F-01 · 🔵 Nit · The confirmation points to an action supplied by the next sprint

**File:** `packages/core/src/presentation/webview/components/workshop/workshopSessionConfirmCopy.ts:13-14`.

Both rewind confirmation variants end with “To keep this conversation too, use Branch instead.” At this head, the thread has Rewind/Edit actions, while Branch belongs to Sprint 03. A writer who cancels to look for the suggested alternative cannot find it. `WorkshopApp.test.tsx` explicitly checks the same sentence, so the passing UI tests preserve the mismatch.

This matches the current sprint's planned copy; it is a sequencing issue rather than an implementation deviation. It does not block merging into the epic. **Recommendation:** retain it when Sprint 03 supplies the action before release; if Sprint 02 is exposed independently, omit the Branch sentence until that action is available. No feature flag or broader UI abstraction is needed.

### F-02 · 🟢 Praise · The equivalence proof protects the two halves of the room

`WorkshopSessionRewind.ts` selects per-participant marks, slices histories and manifests, restores offsets, drops unavailable memberships, repairs the target, releases removed one-shot commit linkage, and validates the resulting pair. Append-and-stale source delivery makes row counts meaningful again: slicing a prefix no longer leaves a row with metadata from a later delivery.

The oracle starts from recorded rest-point snapshots and judges surviving histories by prefix equality independently of mark selection. Its explicit intended differences and vacuity guard are useful evidence. The additional real-`AgentRunEngine` test exercises the multi-round commit-to-count seam the prior PR #117 review requested. The oracle and engine test serve different purposes; neither is presented as live-provider proof.

### F-03 · 🟢 Praise · Rollback preserves the conversations it needs

The shared `installRoom` imports and hydrates without retiring the old runtime histories. Rewind commits the installed room before discarding those histories. Failed installation imports are cleaned up, and `restoreRollback` protects the original binding IDs from disposal. The coordinator tests inject failures at transform, import, hydration, and named write, and compare the prior room, bindings, histories, and stored checkpoints.

Named authority remains identity-checked. Once the named write succeeds, its rolling mirror is separately retryable; mirror failure does not pretend the named write failed. The protected-current exception is preserved explicitly rather than overwriting a checkpoint the writer has not chosen to replace.

> “The rollback protects the histories that matter. No blocker here.” — 🔥 Blake

---

## Plan corrections and existing follow-ups

| Item | Assessment |
| --- | --- |
| Append context-source re-deliveries and recompute the stale chain after slicing | Correct prerequisite for exact historical source rows |
| Record host-held `contextRevision` instead of inferring delivery from dividers | Correctly covers undelivered context changes and silent file refreshes; the transform asks whether the retained host holds the current revision |
| Leave absent offsets absent for participants without a retained conversation | Necessary: a fresh host must receive the kept thread as catch-up. The coordinator regression exercises that path |
| Write inside Rewind, sharing Open's installation core | Gives the operation a real write-failure rollback boundary and avoids a second promotion implementation |
| Name deliberately dropped participants in the action result | Distinguishes a chosen cut from degraded hydration |
| Restore direct-tool text but name attachments for manual re-attach | Respects the existing private-tool boundary; no provider-history parsing was introduced |
| Keep the working set and temporal state current | Consistent with the recorded kickoff decision; the time-notice lifetime limitation remains tracked below |

Two known limitations are already documented in this PR; they are not new findings or silently accepted deferrals:

- [Released widget configs have no reopening entry point](../../.todo/tech-debt/2026-09-30-workshop-rewound-widget-commit-reopen.md). The retained draft survives host-side, but the removed commit bubble was its UI entry point. A writer cannot currently retry that draft through the thread. Keep this visible in the epic's release disposition.
- [Time notices outlive discarded conversations](../../.todo/archive/tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md). A fresh host or re-invited guest can miss its initial time frame until the hourly interval expires. This is per-conversation delivery bookkeeping, and the debt record gives a focused correction that preserves current temporal state.

Sprint 03 also records the coordinator's size as a kickoff decision. Its growth merits that planned ownership discussion before adding Branch, but the extracted transform and shared installation core are coherent here; line count alone is not a merge blocker.

---

## Report card

| Dimension | Assessment |
| --- | --- |
| Correctness / retained history | A — no new defect found in the inspected cut and lifetime paths |
| Persistence / rollback | A — authoritative write, rollback, named identity, and protected-current semantics are explicit |
| Tests | A — full suite passes; recorded-room oracle, real engine seam, and fault injection give complementary evidence |
| Presentation / delivery | B+ — authoritative replacement and edit flow are covered; Branch copy is ahead of the available UI |
| Architecture | A — transform and policy remain separate, and Open/Rewind share installation; coordinator ownership is tracked for Sprint 03 |

These assessments apply to the inspected head and review scope. Manual host behavior and visual accessibility remain unverified here.
