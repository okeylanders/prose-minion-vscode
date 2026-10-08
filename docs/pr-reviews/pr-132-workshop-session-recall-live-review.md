# PR Review — Workshop session recall live-pass preparation (Slice 5 phase A)

**Reviewer:** Astra · **Author:** okeylanders · **PR:** [#132](https://github.com/okeylanders/prose-minion-vscode/pull/132)
**Branches:** `claude/workshop-recall-live` → `epic/workshop-session-recall`
**Verified base / merge-base:** `2a391e2971a1431c82a61391f20f75c3fb3fba05`
**Reviewed code head:** `38f5f1d0f81011c7c0b0bea1f57a28c0ce43902e`
**Main at review:** `30b523610a0d5afde78f57db19b2c288e0aaaf0a`
**Scope:** 15 files · +607 / −62 · 10 commits
**Reviewed:** 2026-10-08 · **Mode:** complete delta review, surrounding-call-path inspection, full automated checks, and independent base/head differential and refusal-recovery probes

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| — | — | No actionable regression established in the Slice 5 delta | Full changed-file review, automated gates, and independent probes below | **N/A** |

**Verdict: Approve Slice 5 phase A for integration into `epic/workshop-session-recall`, then the combined reviewed epic into `main`, subject to successful CI on each final integration head.** No Blocking, High, or Standard finding was established. The existing epic-versus-main review is the basis for the earlier slices; this pass reviews every additional commit and reruns the complete suite. This report does not claim that the unfilled live-pass protocol has been completed or that a release has been published.

## Reviewed behavior and regression assessment

### Unknown-window fallback is narrow and correctly accounted

[`WorkshopTranscriptRecallCapability.ts`](https://github.com/okeylanders/prose-minion-vscode/blob/38f5f1d0f81011c7c0b0bea1f57a28c0ce43902e/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallCapability.ts) now selects the per-turn character total from the presence of the engine-provided window. With no window, successful rendered read bodies together share `readCharacters` (150,000); with a window, the existing `readCharactersPerTurn` (300,000) and measured half-window fitting still apply.

- The same character counter is charged after rendering; the fallback does not reset it between reads.
- The minimum-per-session check precedes the service call. A refused oversized batch does not spend the remaining read attempt, so a smaller admissible request can still run.
- Reaching the service continues to spend a read attempt. The two-read ceiling is unchanged.
- A new turn receives a new capability adapter and a fresh total. Discovery and to-do operations are not coupled to the read counter.
- The explanatory note is included in the bounded rendering. The refusal distinguishes a resettable turn total from a context-window refusal.
- The grammar and architecture/ADR text match the new branch. The prompt-sync test pins the unknown-window number to the existing budget key; no new independent constant can drift.
- Inspection of `AgentRunEngine.fulfillCapability` and `executeTurn` confirms the documentation correction: missing live model-window metadata means neither the local read clamp nor local request preflight runs.

The independent probe uses internally coherent windows, including exact minimum boundaries, rather than relying on the repository test's deliberately oversized `ROOMY` fixture. Ten windows from 0 to 800,000 free input tokens exercise six sequential operations each. Head results and delivered-source rows exactly match the epic-base capability for all 60 comparisons, including refusals and the eventual read-attempt ceiling.

### Diagnostic changes do not change room behavior

The only changes to `WorkshopRoomHandler` and `RunWorkshopToolSidePass` add the already prepared catch-up frame's string length to their existing log messages. They do not rebuild or trim the frame, alter its admission, or change what is sent to a persona. Integration assertions compare the logged count to the actual frame included in the outgoing request.

The request-copy helper adds the session IDs supplied to `transcript.read` to the existing request summary log. The codec restricts admitted IDs to its bounded alphanumeric/punctuation grammar, so the new list cannot inject newlines or log delimiters. It does not add transcript bodies, titles, attachment contents, context bodies, or provider archives to logs. Search/to-do request logs already carry their session selector. The change is diagnostic; it does not implement prefix matching.

### Refusal-copy extraction preserves existing semantics

The moved helper has the same two branches and text as the epic's local function. It remains within the Workshop recall slice and takes only the count and existing advice mode. The adapter remains 496 lines; the copy module is 113. No new dependency direction, host import, or generic abstraction was introduced.

### Scope remains contained

There are no Slice 5 changes to session persistence, schema/codec rules, saved-session loading or search, projection/export behavior, webview UI, shared message contracts, composition-root wiring, provider transport, or package/dependency versions. The additional document is a protocol and empty results record, not evidence of completed live acceptance. The ADR explicitly leaves the conditional session-ID-prefix remedy unimplemented unless later evidence warrants it.

## Verification actually run

All local code checks target `38f5f1d0f81011c7c0b0bea1f57a28c0ce43902e`, before this report-only commit. Runtime: **Node v24.19.0 / npm 11.9.0**. Existing dependencies were reused from an isolated cloud checkout with a byte-identical `package-lock.json`; no fresh local install or local Node 18 run is claimed.

| Check | Result |
| --- | --- |
| Remote refs, merge-base, full diff and commit history | Expected refs matched; Slice 5 contains the entire epic and ten additional commits; main is an ancestor |
| `npm test -- --runInBand` | **267 suites / 3,528 tests / 2 snapshots passed**, 101.156 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| `npm run lint` | **0 errors / 1,085 warnings**; no automatic fixes applied |
| `npm run build` | Both production bundles and `verify:bundle` passed; three existing webpack size/performance warnings |
| `git diff --check` | Passed |
| Independent known-window differential probe | **10 passed**, 60 sequential operation/result comparisons against the exact epic-base capability, with delivered-source parity |
| Independent unknown-window recovery probe | **1 passed**: large first read, four-session pre-service refusal, unaffected discovery/to-dos, fresh-turn reset, smaller second read admitted, combined bodies ≤150,000, third read refused |
| Existing code-head GitHub CI | **Success**, [run 37560021805](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37560021805), workflow configured for Node 18 |

Independent probes were temporary review artifacts and are not production or repository-test changes. The only published change from this review is this report. The author-described mutation checks were not independently rerun.

## Remaining verification limits

- The unknown-window fallback reduces exposure; a character cap is not a guarantee that an unknown model context can accommodate its retained history plus the evidence. Provider validation remains authoritative in that case.
- Existing near-full-context failure/continuation hardening and published-evidence catch-up costs are not changed by this delta. This review found no new spillover from Slice 5 into ordinary non-recall operations.
- No live model call, paid provider request, Extension Development Host session, or manual execution of the live-pass protocol was performed. The protocol's behavioral results and budget-coverage map remain open.
- Merging integration code does not settle all live-model behavior questions or complete the ADR's later evidence-recording phase.

## Integration gates

1. Commit this report to the Slice 5 branch, verify that the new head adds only the report, and require successful CI for that exact head and PR integration.
2. Merge PR #132 into the epic through GitHub's normal merge workflow, preserving protections and branches.
3. Verify resulting epic CI and an unchanged reviewed content tree before merging the combined epic into main through its own PR.
4. Verify the resulting main commit and its final CI before reporting integration complete.

No force push, branch deletion, release publication, credential change, or live-model test is part of this integration.
