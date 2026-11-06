# PR #231 review: Helper Agent Slice 2 memory drafting

## Current verdict: correction re-review

**Written approval of correction head `f4b2f0411038f290fd4bc3fd91dcc634ba30b676`. F-01 is independently resolved; no new blocking finding.** This supersedes the original changes-requested verdict below. It is not a formal self-approval or permission to merge.

### What changed and what was checked again

- **F-01 resolved by withholding, not widening.** A capability-card bubble and its in-window bookmark keep the existing report body, but the sheet sets `helperWithheld` and makes no helper request. There is no placeholder or failure line. Ordinary writer/reply bubbles still draft normally.
- **The host independently enforces the source contract.** Live requests name `note: 'bubble' | 'preview'`; absence defaults to strict `bubble`, unknown values are refused. A bubble's bounded original text is compared with the safe projected note, and mismatches answer `withheld` without calling the helper. The comparison never sends the original text. Even a forged `preview` marker can only request the existing safe projection, not capability evidence.
- **Preview paths remain useful.** Outside-window capability bookmarks and saved capability bookmarks still draft from the same safe event their sheet body holds. New independent tests cover both paths. The room revision and recall gates remain unchanged.
- **Replacing sheets preserves lifetime ownership.** A new independent test replaces a pending ordinary sheet with a withheld capability sheet: the previous request is cancelled, its late answer changes nothing and no replacement helper call starts.
- **The earlier engine corrections remain intact.** All eight unchanged handler/service integration probes from the original review pass, including cancellation during preparation and saved reads, preparation errors, stale-owner cleanup and a bounded capability-free real-engine request with mocked transport.
- **The old reproductions are retained as history.** Two original source probes assumed every capability sheet would post a request. That assumption is deliberately no longer true. The [new correction artifact](probes/pr-231-memory-draft-rereview.test.ts.txt) changes those two cases to require abstention, retains their positive controls and adds switch-to-withheld, malformed/default request-marker and saved-capability coverage. This is verification of the accepted alternative, not a claim that the old assertions pass unchanged.
- #228 has merged; the current PR base is `9bd8ac919f6dc350a869afe79578fc2c696e7cf1`. The merge adds its review documentation and no new executable delta beyond the focused F-01 correction.

### Correction-head verification

- All three local typechecks pass; full lint remains **0 errors / 1,165 existing warnings**.
- **34 focused production suites / 529 tests pass**. This includes the seven new production cross-layer regressions and the request-marker defaults/refusals.
- **16 independent probes pass**: eight new/adapted correction probes plus all eight unchanged original host/helper integration probes. Temporary executable copies were removed; archived text remains outside test discovery.
- `git diff --check aea407b f4b2f04`: passed. Safe transcript projection and helper engine/codec remain unchanged by the correction.
- Exact-correction-head CI run 42134770460 (https://github.com/okeylanders/prose-minion-vscode/actions/runs/42134770460), job 127620004909, passed. Checkout identifies 282f2bc merging f4b2f041 into 9bd8ac91. All typechecks; 761 suites / 10,608 tests / 59 snapshots; lint 0 errors / 1,165 warnings; both production bundles and sentinel verification pass. Three existing webview size/performance warnings remain. The new report-publication head is checked separately in the PR conversation.
- No local full-suite or local production-build pass is claimed. No native VS Code visual pass or live provider call was made. The nonblocking toggle-during-flight clarification remains as documented below.
- Only review documentation and the new probe artifact are published. No production edit, merge, auto-merge or deployment is performed; #205 remains deferred.

## Original verdict (superseded by the correction re-review)

**Changes requested at code head `5ae99bd85acfc7ff6cc90dc20555b2b7ba598a9e`: one P2 source-equivalence finding.** The live capability-card sheet and the new helper do not read the same note. The host's safe projection must remain intact; the correction must not send capability evidence to the helper.

This is a written review verdict, not a formal self-`REQUEST_CHANGES` review or permission to merge. The connected GitHub identity is the PR author, so the findings are published as a `COMMENT` review.

- PR: [#231](https://github.com/okeylanders/prose-minion-vscode/pull/231).
- Branch: `epic/helper-agent-slice-2-memory-draft`.
- Base: `epic/helper-agent`, `c040cb6a9fbd2b4ae247bb26416bb2e8dc2b2c18`.
- Reviewed: 2026-11-05.
- Scope: all 36 Slice 2 changed paths relative to corrected Slice 1 `d1b861d`; handler/recall/projection, routing/composition/disposal, settings, sheet/hook correlation, tests and specification. The full stacked diff has 70 paths.
- Duplicate check: no PR comments or reviews existed at initial inspection or immediately before this report was prepared.
- #228 integration: `d1b861df8f745740dca830eeab757f3474c06103` is an ancestor; its service and production regression tests are byte-identical in this head. Both earlier findings are resolved here and were tested through the new handler, not merely assumed from ancestry.

## F-01 · P2 · Draft metadata from the same safe source the sheet actually holds

**Location:** [`WorkshopMemoryDraftHandler.ts:168–170`](https://github.com/okeylanders/prose-minion-vscode/blob/5ae99bd85acfc7ff6cc90dc20555b2b7ba598a9e/packages/core/src/application/handlers/domain/workshop/WorkshopMemoryDraftHandler.ts#L168-L170). Related caller: [`useWorkshopProjectMemory.ts:235–249`](https://github.com/okeylanders/prose-minion-vscode/blob/5ae99bd85acfc7ff6cc90dc20555b2b7ba598a9e/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopProjectMemory.ts#L235-L249).

The new helper call always uses the safe transcript projection, which is correct for privacy. A capability card projects to an event describing the operation and its outcome, not its evidence. But `saveTurn` still prefills the memory sheet with the snapshot turn's original `content`. `rememberRoomBookmark` also takes that path whenever the turn is inside the snapshot window. Capability cards are eligible for both actions (`workshopSaveToMemoryAction` uses bookmark eligibility), and the actual session snapshot preserves their report content.

The resulting automatic title, summary and kind describe an operation-status notice while the body being saved is the substantive report. D5.2 requires the helper to use the same projection as the sheet body; `MemoryDraftInput.text` and the Slice 2 implementation note promise the same invariant. Reusing the same trimming function does not make these two different sources equal.

**Independent reproduction:** create a real `ScriptedWorkshopRoom` capability result, take its turn from `session.getSnapshot()`, open the sheet through the production hook, and pass its actual posted request to the production handler. Both the bubble and in-window bookmark probes fail:

- Sheet note: `Continuity check 1: the cup changes hands twice.`
- Helper passage: `Continuity · Continuity check 1 · requested by Jill · success`

The out-of-window bookmark path passes, because its sheet uses the host preview too. Ordinary writer/reply controls also pass. The new host-only capability test checks that evidence does not leak, but never compares that input with the actual sheet's note, so it misses the functional mismatch.

**Requested correction:** make the sheet and helper agree on the intended safe source for capability cards, or explicitly withhold automatic drafting on a source that cannot be supplied safely. Do not fix equality by passing raw capability evidence to the helper. Preserve the correct ordinary-message and out-of-window/saved-bookmark flows. Add cross-layer regressions for the actual bubble and in-window bookmark actions, testing source equivalence whenever automatic drafting is offered.

**Artifact:** [source-equivalence and touched-field probes](probes/pr-231-memory-draft-source.test.ts.txt). At this head: two failing source-equivalence probes and three passing controls.

This is a newly introduced automatic-metadata correctness issue, not a claim that the previous manual sheet behavior was introduced here, and not a claim that private evidence currently reaches the helper.

## What reviewed cleanly

1. **Source privacy and authority.** The request carries identifiers only. The host ignores extra webview text, checks original bookmark eligibility, reads live turns from its ledger and saved turns only through recall, then copies named preview fields. Attachment bodies, widget payloads and capability evidence are not handed to the helper. Refused sources produce no helper call or write.
2. **Room and sheet ownership.** Live requests carry the opening revision; saved reads recheck the room afterward. Same-ID room replacement and stale saved reads are covered. Each sheet opening has a fresh owner. Close, another opening, mode changes, unmount and Save cancel outstanding drafts, and stale/duplicate replies are ignored. Save freezes the submitted values.
3. **Touched fields.** Current ref-backed state, rather than an earlier render snapshot, wins. Typing then emptying a field and changing a kind back remain touched. A new exhaustive eight-subset probe verifies each title/summary/kind combination; body, supersessions, pin and source stay unchanged. The delayed preview fills the body without erasing accepted metadata.
4. **#228's corrections work through the route.** New integration probes cancel during initialization and prompt loading: zero engine calls and zero replies. Initialization and prompt failures each produce exactly one `failed` result without logging the private error message. This independently verifies F-01/F-02 integration in Slice 2.
5. **Pending-read cancellation.** New probes cancel and dispose while a saved-turn lookup is pending, then resolve it: the helper is never initialized and no answer is posted. An older read settling cannot clear the newer request owner; the newer one still cancels correctly.
6. **Bounded, capability-free provider request.** A new integration probe uses the real handler, helper service, task policy and `AgentRunEngine` with a mocked provider. The actual request contains the expected 8,000-unit bounded passage, pinned helper model, temperature 0 and 400-token ceiling, no tools/reasoning, no retained conversation, exactly one usage event and source-free logs. No live provider is called.
7. **Output and failures.** Slice 1's exact-shape decoder remains the authority. Only a correlated valid draft fills fields. The placeholders are values of `placeholder`, not input values; failure is one muted status line. Loading, in-flight saving, required-field validity and pinned-budget rules still control Save.
8. **Architecture.** The route is a composed sibling, uses injected ports and owns no file writes. Setting watch/push and message unions are wired. New modules remain below 500 lines; existing larger owners receive seams rather than new responsibilities. No `vscode` import was added to core.

### Nonblocking switch-lifetime clarification

The switch is a per-request gate: turning it off prevents the next opening and stray requests received while off make no model call. A request already accepted is not revoked by the setting push (`useWorkshopMemoryHelperDrafts.ts:90–94`); its current placeholders/result can remain. Document and test whether this is the desired toggle-during-flight behavior. This is not elevated to another blocking finding because D5.7 explicitly specifies the gate at request arrival and does not explicitly require revocation of accepted work.

## Verification

Local exact-code-head checkout, Node 24.22.1 / npm 11.9.0. Dependencies were copied from an installed checkout only after verifying a byte-identical lockfile; no dependency or lockfile change was made.

- `git diff --check c040cb6 HEAD`: passed.
- All three typechecks: passed.
- Full lint: **0 errors / 1,165 existing warnings**.
- **33 focused production suites / 519 tests: passed**, including new sheet/handler behavior, existing memory and saved-memory flows, helper service/codec/prompts, room route seams, message router and architecture boundaries.
- **13 independent review probes: 11 passed, 2 failed for F-01.** Eight route/helper integration probes pass. Of five source/sheet probes, both capability-card source-equivalence cases fail and the three controls pass. The probes are archived as text outside test discovery; temporary executable copies were removed.
- Exact-code-head [CI run 42132303550](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42132303550), verify job `127611667004`, **passed**. Its checkout explicitly merges `5ae99bd` into `c040cb6` (`f06a74c`). All three typechecks, **760 suites / 10,598 tests / 59 snapshots**, lint (**0 errors / 1,165 warnings**), both production bundles and bundle-sentinel verification pass. The three existing webview size/performance warnings remain. The report-only publication head receives a separate CI check recorded in the PR conversation.
- No local full-suite or local production-build pass is claimed. No native VS Code visual pass or live billable model call was made. Those remain separate from the automated evidence above.
- Green standard CI would not resolve F-01: it does not discover the archived new failing probes.

[Verification record](probes/pr-231-memory-draft-verification.txt).

### Reproduce the independent probes

From the repository root at the reviewed head:

```sh
cp docs/pr-reviews/probes/pr-231-memory-draft-source.test.ts.txt \
  packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/review231Source.test.ts
cp docs/pr-reviews/probes/pr-231-memory-draft-integration.test.ts.txt \
  packages/core/src/__tests__/application/handlers/domain/workshop/review231Integration.test.ts
npm test -- --runInBand --runTestsByPath \
  packages/core/src/__tests__/presentation/webview/hooks/domain/workshop/review231Source.test.ts \
  packages/core/src/__tests__/application/handlers/domain/workshop/review231Integration.test.ts
```

The reviewed head yields two failures and eleven passes. Remove the temporary `.test.ts` copies afterward.

## Ledger and scope

| Item | Status |
|---|---|
| F-01: live capability sheet/helper sources differ | Resolved and independently verified at `f4b2f041`: mismatched bubbles abstain, safe preview paths still draft |
| #228 F-01/F-02 preparation corrections | Integrated unchanged and independently verified through the route |
| A-01 safe source/bound | Pass at `f4b2f041`; privacy preserved and every offered draft uses the intended safe note |
| A-02/A-03 correlation and touched fields | Pass at reviewed head |
| A-04 output contract | Inherited corrected engine tests pass |
| A-05 caller/service lifetime | Pass, including pending source read and preparation boundaries |
| Toggle-off during an accepted draft | Nonblocking behavior clarification |

Only this report, the verification record and probe text are published. No production edit, merge, auto-merge, deployment or release is performed. #205 remains deferred.
