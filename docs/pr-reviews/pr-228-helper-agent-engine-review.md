# PR #228 review: Helper Agent Slice 1 engine

## Current verdict: correction re-review

**Written approval of correction head `d1b861df8f745740dca830eeab757f3474c06103`. F-01 and F-02 are independently resolved; no new blocking finding.** This supersedes the original changes-requested verdict below. It is not a formal self-approval or permission to merge.

### What changed and what was checked again

- **F-01 resolved.** `prepareHelperRun` checks cancellation before work, after resource initialization and after the prompt read. The service also checks immediately before dispatch, after attaching the listener, covering its additional asynchronous return boundaries. The original two deferred-preparation probes now return `failed/cancelled` with zero engine calls.
- **F-02 resolved.** Both preparation awaits are caught and converted to the tagged failure result. An already-aborted caller remains cancelled when a pending preparation operation rejects. The original two rejection probes pass unchanged; a new delayed prompt-rejection probe verifies cancellation takes precedence and error text is not logged.
- **Ownership survives the correction.** A 12-position microtask sweep covers before-dispatch and after-dispatch cancellation: no call starts after the abort, and an already-started call receives it. Additional probes verify no timer/listener remains after successful, rejected-output or failed calls, and a cancelled prompt read never reaches the real engine's mocked transport.
- **Other contracts remain intact.** The unchanged original controls still prove selected-model pinning, capability-free execution, discarded conversation, single usage emission and source-free logs. No model/codec/prompt/budget/composition change is hidden in this fix; the executable delta is the service and its regression tests.

### Correction-head verification

- All **six original probes pass unchanged**. All **four additional independent correction probes pass**: [new probe artifact](probes/pr-228-helper-engine-rereview.test.ts.txt).
- Focused run: **14 suites / 210 tests pass**, comprising 13 production suites / 204 tests plus the original six-probe suite. The new four-probe suite also passes separately. Temporary executable copies were removed; both probe artifacts remain text outside ordinary test discovery.
- `git diff --check ae80d4d d1b861d`: passed. All three local correction-head typechecks pass; full lint reports **0 errors / 1,165 existing warnings**.
- Exact-correction-head [CI run 42131541776](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42131541776), verify job `127609110595`, **passed**. Its checkout explicitly merges `d1b861d` into `c040cb6` (`0c93ab9`). All typechecks, **757 suites / 10,536 tests / 59 snapshots**, lint, both production bundles and sentinel verification passed; the same three webview size/performance warnings remain.
- [Correction verification record](probes/pr-228-helper-engine-verification.txt). The new report-only publication head receives a separate CI check recorded in the PR conversation.
- Full local suite and local build were not rerun for this narrow correction; exact-head CI supplies both. The original review's local build results apply to its original head, not this correction.
- Safe source projection, room/sheet lifetime, touched-field preservation and other Slice 2 checks remain future acceptance work. No live provider call or native VS Code visual pass was made.
- Only review documentation and the additional probe artifact are published by this re-review. No production edit, merge, auto-merge or deployment was performed; #205 remains deferred.

## Original verdict (superseded by the correction re-review)

**Changes requested at code head `5e49fc81ba6467ba695f6d7e5bb0c264d75c2861`: two P2 lifecycle findings.** The task-policy architecture, memory codec and model-following integration review cleanly, but A-05 is not complete: cancellation during preparation is lost, and preparation failures escape the declared result contract.

This is a written review verdict, not a formal self-`REQUEST_CHANGES` review or permission to merge. The connected GitHub identity is the PR author; the verdict and inline findings are published as a `COMMENT` review.

- PR: [#228](https://github.com/okeylanders/prose-minion-vscode/pull/228).
- Branch: `epic/helper-agent-slice-1-engine`.
- Base: `epic/helper-agent`, `c040cb6a9fbd2b4ae247bb26416bb2e8dc2b2c18`.
- Reviewed: 2026-11-05.
- Scope: all 36 changed paths; helper service and codecs, prompt contract, engine/transport lifecycle, model selections and following, composition and settings wiring, tests and acceptance documentation.
- Duplicate check: no PR conversation comments, inline comments or submitted reviews existed when the review began; checked again before publication. #225's committed specification review and its A-01–A-05 acceptance checks were read. #225 has already merged into this PR's base, so this is the engine delta, not a duplicate specification review.

## Findings

### F-01 · P2 · Recheck cancellation after awaited preparation, before dispatch

**Location:** [`HelperAgentService.ts:81–89`](https://github.com/okeylanders/prose-minion-vscode/blob/5e49fc81ba6467ba695f6d7e5bb0c264d75c2861/packages/core/src/infrastructure/api/services/helper/HelperAgentService.ts#L81-L89); the initial check is at lines 69–73.

`run` checks the caller's signal only before `ensureInitialized()`, then awaits both resource initialization and prompt loading before attaching its abort listener. If the caller aborts during either await, that abort event has already fired. `addEventListener` does not replay it, so the newly created `stop.signal` remains live and `runInitial` still sends the request. On a normal reply the final check also misses the caller's signal, so this cancelled invocation can return `drafted`.

**Reproduction:** defer `ensureInitialized` or `loadPrompts`, start a run with an `AbortController`, abort while the deferred work is pending, then resolve it. Both independent probes observe **one dispatch and a drafted result**, instead of zero dispatches and `{ kind: 'failed', reason: 'cancelled' }`. Existing tests cover an abort before entry and one after dispatch, but neither preparation interval.

**Impact:** Close, replacement or disposal can still start an avoidable paid request after the caller cancels. A later UI correlation guard would hide the reply but would not prevent this dispatch. This violates A-05's cancellation ownership before the model call.

**Requested correction:** own cancellation across preparation and recheck the caller's current state after awaited preparation and immediately before dispatch. An already-cancelled call must never start the engine. Preserve listener/timer cleanup on every exit. Add both pending-initialization and pending-prompt regressions, not only the existing before-entry/after-dispatch cases.

### F-02 · P2 · Normalize initialization and prompt-load failures through the result contract

**Location:** [`HelperAgentService.ts:73–81`](https://github.com/okeylanders/prose-minion-vscode/blob/5e49fc81ba6467ba695f6d7e5bb0c264d75c2861/packages/core/src/infrastructure/api/services/helper/HelperAgentService.ts#L73-L81); the catch begins only at lines 95–110.

The `try` covers `engine.runInitial`, but not `ensureInitialized` or `loadPrompts`. Those are real rejecting operations: `AIResourceManager.startRebuild` rethrows failed initialization, and `PromptLoader.loadPrompt` rethrows a failed resource read. Consequently, a secret-store/resource initialization failure or unreadable bundled prompt rejects `run()` outright instead of returning the advertised `{ kind: 'failed', reason: 'error' }` result.

**Reproduction:** make `ensureInitialized` reject, then independently make `loadPrompts` reject. Both probes fail their `.resolves.toEqual({ kind: 'failed', reason: 'error' })` assertion because the promise rejects. No engine call is needed to trigger either case.

**Impact:** callers cannot use the documented result union to implement the quiet failure path for these ordinary operational failures. Slice 2 would need a second exception path around an API that otherwise represents provider errors as data, or could leave its request without a terminal result. No current UI failure is claimed: this slice has no helper request route yet.

**Requested correction:** include preparation in the service's operational error boundary; return the appropriate failed result without logging source/prompt/provider text. Cover failures at both awaits and make sure a cancelled preparation still reports cancellation. Keep programming-contract errors separate if that distinction is intentional and documented.

## What reviewed cleanly

1. **Task-owned policy, one engine path.** The service does not branch on the task. Prompt sections, input building/counts, decoder and call settings remain in each policy. The two-task production test exercises this boundary, and helper modules stay below 500 lines with no Workshop/Lightbox/Draft Edit/application imports.
2. **No write authority or retained conversation.** The helper policy is capability-free, has zero capability/correction rounds and discards its conversation. An independent test using the real `AgentRunEngine` confirms no tools/reasoning option, temperature 0, the 400-token ceiling, zero retained conversations and exactly one usage callback. No live provider was contacted.
3. **Model ownership and pinning.** The scope follows Proofread, not the assistant; a helper pick stays independent, clearing it follows again, and API-key refresh retires the old engine's provider. An independent deferred-prompt test proves that a model change while loading the prompt does not change the model passed by this run.
4. **End-to-end scope wiring.** The setting, manifest default, setting watcher, resource bundle, `MODEL_DATA.following`, Settings row and Workshop scope label agree. Existing Lightbox following behavior uses the shared map rather than a hard-coded assistant lookup.
5. **A-04 output contract.** Exact fields, known kind, nonempty/one-line title and summary, shared 120/280 UTF-16 limits and rejection without clipping are covered. The shared one-line rule includes controls and Unicode separators. The worked request is byte-identical to the builder, and the example response goes through the production reader. Cut-off and overlong replies are rejected before decoding.
6. **Bounded input and controlled decoding.** The memory task bounds passage text to the sheet's 8,000 UTF-16 units. The generic JSON wrapper treats strings as task data. Structural JSON repairs are named in logs; arbitrary extra output fields are refused. The safe source projection itself remains Slice 2's responsibility.
7. **Post-dispatch stop and timeout.** The existing deterministic transport test verifies that the policy's 20-second timeout aborts the request. Explicit post-dispatch caller cancellation returns `cancelled`. These passing cases do not cover F-01's preparation window.

## Verification

Local checkout at the exact code head, Node 24.22.1 / npm 11.9.0. Dependencies were copied from an existing installed checkout with a byte-identical `package-lock.json`; no dependency or lockfile change was made. CI independently installs under Node 18.

- Local `git diff --check c040cb6 HEAD`: passed.
- All three local typechecks: passed.
- **13 focused production suites / 198 tests: passed**, covering helper codecs/service/prompts, scope following/resource lifecycle, run policies, Settings/Lightbox model controls and architecture boundaries.
- **Six independent review probes: four fail for F-01/F-02, two pass** for real-engine capability/retention/usage behavior and model pinning. The probes are archived as text, not installed as failing production tests: [probe artifact](probes/pr-228-helper-engine-review.test.ts.txt). Reproduction instructions and observed outcomes are below.
- Local full lint: **0 errors / 1,165 existing warnings**. The standard local build was killed during webpack (exit 137); a bounded retry (`--max-old-space-size=2048`, `--parallelism 1`) passed both production bundles and bundle-sentinel verification, with the same three size/performance warnings. [Commands and results](probes/pr-228-helper-engine-verification.txt).
- Exact-code-head [CI run 42127331285](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42127331285), `verify` job `127594739136`: **passed**. Its checkout log identifies merge candidate `b794500df6bf7a271835560743e8853b7cf8f45c`, merging reviewed head `5e49fc81ba6467ba695f6d7e5bb0c264d75c2861` into base `c040cb6a9fbd2b4ae247bb26416bb2e8dc2b2c18`.
- CI: all three typechecks; **757 suites / 10,530 tests / 59 snapshots**; lint **0 errors / 1,165 warnings**; both webpack bundles and bundle-sentinel verification passed, with three existing webview size/performance warnings. Green production CI does not include the new independent failing probes.
- No duplicate full local suite was run: the exact-head CI full suite supplies that evidence. No native VS Code visual/accessibility pass or billable model call was made. The 400-token live-model quality/latency check remains a live-pass item, not a claim of this review.
- The documentation-only publication head needs its own CI result; that result will be recorded in the PR conversation rather than creating an endless series of CI-only report commits.

### Reproduce the independent probes

From the repository root at the reviewed code head:

```sh
cp docs/pr-reviews/probes/pr-228-helper-engine-review.test.ts.txt \
  packages/core/src/__tests__/infrastructure/api/services/helper/HelperAgentService.review228.test.ts
npm test -- --runInBand --runTestsByPath \
  packages/core/src/__tests__/infrastructure/api/services/helper/HelperAgentService.review228.test.ts
```

The reviewed version yields four failing and two passing tests. Remove the temporary `.test.ts` copy after reproducing; the archived `.txt` is deliberately outside normal test discovery.

## Scope and follow-ups

- A-01's source privacy, A-02's room/sheet ownership, A-03's touched-field history and the UI half of A-05 are still Slice 2 acceptance requirements. This review does not approve their future implementation.
- `AIResourceManager.ts` grows from 503 to 508 lines through the standard bundle seam. This is pre-existing size debt plus scope wiring, not a new helper responsibility; a focused extraction remains desirable before further growth.
- Only this report, its verification record and probe text are published. No production fix, merge, auto-merge, deployment or release was performed. #205 remains deferred.

## Ledger

| Item | Priority | Status |
|---|---|---|
| F-01: abort during preparation is lost | P2 | Resolved and independently verified at `d1b861d`; original probes and new boundary/transport probes pass |
| F-02: preparation errors escape result union | P2 | Resolved and independently verified at `d1b861d`; original probes and delayed cancellation/error probe pass |
| A-04: memory output contract | Acceptance | Passed at reviewed code head |
| A-05: service cancellation/failure lifecycle | Acceptance | Engine/service checks pass at `d1b861d`; caller/UI lifetime remains Slice 2 work |
| A-01–A-03 and UI lifecycle | Acceptance | Carry into Slice 2 |
