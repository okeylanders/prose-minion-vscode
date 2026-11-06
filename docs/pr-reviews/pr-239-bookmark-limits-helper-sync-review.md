# PR #239 review: Bookmark Recall limits into Helper Agent

## Verdict

**Written code approval at `56b2b06a59e57ac062ef76a245225c167a3dc04c`. No blocking implementation finding.** This is approval of the synchronization, not a claim that window-fitting reads have shipped or that the native/live-model pass is complete. The aggregate CI gate is recorded separately below and in the PR conversation.

- PR: [#239](https://github.com/okeylanders/prose-minion-vscode/pull/239).
- Base: `epic/helper-agent`, `81a609600b6978ce2a5428e7815a014674d94828`.
- Head branch: `claude/vibrant-shannon-croyue`.
- Reviewed: 2026-11-06.
- Scope: all 17 changed files, merge provenance, the persona engine and capability adapters, Helper policy/service/input paths, prompt synchronization, and relevant tests.
- Duplicate check: no existing #239 report, comments, or submitted reviews at the start or immediately before report preparation. Earlier #228/#231/#232 review reports were read as prior evidence, not reissued.

## What checked out

1. **The merge contains the intended upstream change.** The merge base of Helper `81a60960` and Bookmark Recall `835120c2` is `b4ca7b86`. The stable patch ID of both `b4ca7b86..835120c2` and `81a60960..56b2b06a` is `7c9b7ef9512f551dd7c13620f62704b10cc104bf`. #237 merge `0a3a3daf`, #238 merge `4464c8a4`, and the two planning commits are ancestors of the reviewed head. This is the upstream delta applied without unrelated Helper changes.

2. **The limits and their enforcement agree.** [promptBudgets.ts](../../packages/core/src/shared/constants/promptBudgets.ts) sets 15 persona calls, 10 transcript reads, 5 memory reads, 3 full dictionary entries, and 2 analysis runs. The host and capability-bearing guests resolve to `workshopHost`, which reads the call constant. Other capability-bearing policies retain their two-round ceilings. Full-entry/analysis guards refuse beyond their individual ceiling before dispatch, and the engine still stops fulfillment at the shared ceiling and requests final prose.

3. **More transcript calls do not multiply the character total.** [WorkshopRecallReadOperation.ts](../../packages/core/src/application/services/workshop/recall/WorkshopRecallReadOperation.ts) still shares 300,000 characters across known-window reads, clamps each result to half the remaining window, and shares 150,000 when the window is unknown. Per-call limits remain 150,000 characters and 10 sessions. The tests retain total-budget, minimum-share, unknown-window, and clamp coverage alongside the new count.

4. **Instructions track runtime.** The capability instruction and fresh-turn reminder use the constants. Both read-capability prompts state the new counts and their unchanged per-read bounds. Prompt-sync tests hold their wording to those constants. Plural refusal text correctly reports 3 full entries and 2 analysis passes.

5. **Helper is not granted persona capabilities.** [AgentRunPolicies.ts](../../packages/core/src/infrastructure/api/orchestration/AgentRunPolicies.ts) keeps Helper at zero capability/correction rounds, catalog `none`, and discarded history; [HelperAgentService.ts](../../packages/core/src/infrastructure/api/services/helper/HelperAgentService.ts) dispatches explicitly under that policy. Its separate 8,000-character input, 400-token output, 4,000-character response, and 20-second timeout are unchanged. Live/saved source projection, room-revision checks, capability-body withholding, quoted task data, and cancellation behavior are unchanged and covered by the focused suites.

## Nonblocking correction

### N-01: Correct the upstream review provenance in the PR description

The verification bullet says the changes were “already reviewed and merged in #237 and #238.” Both upstream descriptions explicitly say they were merged **without a review round**, at the writer's direction. Their review and comment lists are empty at this review's check.

Suggested replacement: “The changes were already merged in #237 and #238 without a review round, at the writer's direction; this PR receives an independent integration review.”

This report supplies an independent review of the imported change and its Helper integration. No upstream approval is inferred from the merge alone.

## Known limitation, not fixed by this sync

[ADR D11](../adr/2026-11-05-workshop-bookmark-recall.md#d11-a-personas-turn-allows-15-capability-calls-and-more-reads-2026-11-06) and the [window-fitting plan](../../.todo/features/feature-workshop-reads-fit-the-window/README.md) accurately distinguish the increased limits from future protection.

`WorkshopPersonaCapability.dispatch` passes the live window only to recall, not file or memory reads. Five memory reads can contribute about 200,000 characters; fifteen maximum-size file reads can contribute about 960 KiB, before framing. The engine's existing preflight still throws `context-window-exceeded` when the next request cannot fit, rather than substituting a notice or guaranteeing a final answer. Unknown windows still depend on provider validation for these read kinds.

The import does not silently claim otherwise, and there is no additional sync-specific defect here. Keep the planned fitting/backstop work separate and do not describe the raised call ceiling as a guarantee that a persona can consume all fifteen reads successfully. Native/live-model latency, cost, and context pressure remain live-pass work.

## Verification

All local checks below ran at the exact reviewed head, with no production or test edits:

- `git diff --check 81a60960 HEAD`: passed.
- `npm run typecheck`: passed for core host, core webview, and extension.
- Focused Jest: **23 suites / 539 tests passed**:
  `npm test -- --runInBand --testPathPattern='(AgentRunEngine\.test|RunWorkshopToolSidePass\.integration|WorkshopCapabilityXmlCodec|WorkshopPersonaCapability\.test|WorkshopProjectMemoryCapability|WorkshopTranscriptRecallCapability|WorkshopTranscriptRecallWiring|promptBudgets|AgentRunPolicies|HelperAgent|MemoryDraft|helperPromptSync|projectMemoryPromptSync|transcriptRecallPromptSync|WorkshopResourceCapability|WorkshopRecallWindowClamp|boundaries\.test)'`
- Helper sheet/hook follow-up: `npm test -- --runInBand --testPathPattern='HelperDraft'`: **2 suites / 26 tests passed**. Combined focused coverage is **25 suites / 565 tests**, with no overlap between these two commands.
- `npm run lint`: passed, **0 errors / 1,165 warnings**, matching the preceding Helper review's warning count.
- `npm run build`: both bundles and sentinel verification passed; the three existing webview size/performance warnings remain.
- Dependencies installed with `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/pr-239-npm-cache`; lockfile unchanged. The default-cache attempt first failed because its cache directory was unavailable. Local runtime was Node 24.22.1, whereas CI is configured for Node 18.
- Exact reviewed-head PR CI [42278274688](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42278274688) was still running at report preparation: typechecks passed, full tests running, lint/build pending. No local full-suite pass is claimed. Final original-head and report-publication-head CI results belong in the PR conversation; earlier green results are not substituted for them.
- No Extension Development Host visual check or live/billable provider request was made. The native checklist and ADR acceptance remain pending.

Only this report is published. No production fixes, merge, auto-merge, deployment, or ADR acceptance. #236 work remains untouched and blocked pending confirmation; #205 remains deferred.
