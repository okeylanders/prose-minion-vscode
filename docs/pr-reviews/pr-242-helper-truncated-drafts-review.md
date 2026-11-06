# PR #242 review: Helper Agent truncated memory drafts

**Current disposition: approve the code after the F-01 correction at `4906f1cc`.** The original request-changes verdict below is superseded by the re-review at the end of this report. Live-provider acceptance remains a separate, unverified step. This review does not authorize a merge.

- **PR:** [#242](https://github.com/okeylanders/prose-minion-vscode/pull/242)
- **Initially reviewed code head:** `ab65c3e58e38040e2d5bd58fbca07817e44241da`
- **Base:** `7271a6b15c98628829d514efa174ca3298d61ccc` (`epic/helper-agent`)
- **Branch:** `epic/helper-agent-slice-3-fix-cut-off-drafts`
- **Reviewed:** 2026-11-06
- **Posted verdict:** [review](https://github.com/okeylanders/prose-minion-vscode/pull/242#pullrequestreview-5808394408)
- **Inline finding:** [F-01](https://github.com/okeylanders/prose-minion-vscode/pull/242#discussion_r4498698188)

## Reconciliation and scope

At the start of this pass there were no existing #242 comments, reviews, or review report in its tree. Reviewed all 19 changed paths, the helper's preparation and dispatch, decoder, task budgets, the moved catalog reader, Draft Edit callers, engine-to-client forwarding, composition-root wiring, architecture guards, and the ADR/live-pass notes. The source change is one implementation commit on the stated base.

## F-01 [P2]: restore the caller-signal check across the preparation handoff

**Location:** [`HelperAgentService.ts:123-126`](https://github.com/okeylanders/prose-minion-vscode/blob/ab65c3e58e38040e2d5bd58fbca07817e44241da/packages/core/src/infrastructure/api/services/helper/HelperAgentService.ts#L123-L126), with the forwarding listener installed at line 112.

The previous dispatch guard checked `options.signal?.aborted`. The replacement checks only the newly created `stop` controller. There is an asynchronous handoff between `prepareHelperRun`'s last caller-signal check and `run` installing its forwarding listener. If the caller aborts during that handoff, adding an `abort` listener afterward does not replay the event. The internal signal stays live.

Consequences depend on the catalog:

- If the catalog resolves, the cancelled call reaches `engine.runInitial` and may consume provider tokens. The helper can return `drafted` despite its caller already having cancelled it.
- If the catalog never settles, the same cancelled call waits for the 20-second task timer and reports `timeout`, rather than ending promptly as `cancelled`.

### Deterministic reproduction

With the existing `HelperAgentService.test.ts` harness, queue the abort two or three microtask turns after the prompt loader resolves:

```ts
it.each([2, 3])('preserves a stop after %s microtask turns', async (turns) => {
  const { service, runInitial, promptLoader } = harness([
    { content: '{"echo": "Alice"}' }
  ]);
  const stop = new AbortController();
  promptLoader.loadPrompts.mockImplementationOnce(async () => {
    const later = (remaining: number) => queueMicrotask(() =>
      remaining === 1 ? stop.abort() : later(remaining - 1)
    );
    later(turns);
    return 'SYSTEM';
  });
  const result = await service.run('echo', { word: 'Alice' }, { signal: stop.signal });
  expect(stop.signal.aborted).toBe(true);
  expect({ result, dispatches: runInitial.mock.calls.length }).toEqual({
    result: { kind: 'failed', reason: 'cancelled' }, dispatches: 0
  });
});
```

Both probes fail on the reviewed head: **one dispatch and a `drafted` result**, instead of zero dispatches and `cancelled`. The 25 checked-in helper tests pass alongside them. The existing single-microtask test stops before preparation's own last check and therefore misses this gap.

A third independent probe uses the real memory task, an unresolved catalog promise, and fake timers with native `queueMicrotask`. It reproduces **`timeout` instead of `cancelled` after 20,000 ms**.

**Requested repair:** reconcile an already-aborted caller signal immediately after preparation, before waiting on the catalog; retain an effective caller check before dispatch and report cancellation correctly. Keep both handoff timing cases and the stalled-catalog case as regressions. Restoring the caller check and its cancellation classification made the two completed-catalog probes pass in a temporary local experiment (27/27 helper tests); that experiment is not a complete repair for an already-aborted call waiting on a stalled catalog. No implementation change was retained or published by this review.

## What checked out

1. **Reasoning and output room reach the wire.** Three independent integration probes used the production helper, `AgentRunEngine`, `OpenRouterClient`, `liveCatalogReasoning` and task policy, with only `fetch` mocked. Optional and unknown reasoning metadata send `max_tokens: 1000` with `reasoning: { effort: 'none' }`. A mandatory-reasoning model sends `max_tokens: 2024` with `reasoning: { max_tokens: 1024 }`. The selected model remains pinned and no tools are sent.
2. **Reported reasoning remains separate from persisted usage.** Those probes carried the provider's reasoning count through the engine into the helper's log, while keeping it out of `TokenUsage`. Existing client tests also cover malformed/missing counts and streaming normalization.
3. **Decoding remains bounded.** Raising the output budget does not change title/summary limits, exact fields, the kind vocabulary, the 4,000-character response limit, or the refusal of `finishReason: 'length'`. A cutoff is still rejected even if the visible JSON happens to be complete. No retry or salvage is introduced.
4. **The catalog move has the right owner.** The shared reader is in orchestration; the helper does not import Draft Edit. Proofread and Craft Flags keep the same refusal rule, unknown-catalog behavior and log sequence. The composition root injects the existing catalog instance, and only the two intended neutral imports are added to the helper's boundary allow-list.
5. **The new wait is bounded once forwarding is active.** The catalog wait uses the same timer as inference, so it does not obtain a fresh output-call timeout after catalog work. The supplied tests cover timeout during a stalled catalog and cancellation during that wait. Aborting the wait does not abort the underlying catalog fetch; it may settle later, but that abandoned continuation cannot dispatch inference. F-01 concerns cancellation before forwarding exists.

## Verification

Independent checks used Node `v24.22.1` and a dependency installation with an identical `package-lock.json`:

- `npm run typecheck`: all three stages passed.
- `npm run lint`: **0 errors / 1,165 warnings**.
- `npm run build`: both webpack bundles and `verify:bundle` passed; existing bundle-size warnings remain.
- Checked-in helper suite: **25/25 passed**.
- Independent handoff probes: **3 reproduced failures** on this head (two unwanted dispatches; one cancellation misreported as timeout).
- Temporary caller-check experiment: **27/27 helper tests passed**, limited as described under F-01.
- Independent real-client/mocked-fetch integration probes: **3/3 passed**.
- `git diff 7271a6b1...ab65c3e5 --check`: passed.
- Full repository suite: **761 suites / 10,617 tests / 59 snapshots passed** on the unmodified implementation.

Temporary probes and the local experiment were removed before publication. This publication contains only the review report.

### Exact-head CI

[CI run 42310935559](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42310935559), job `verify`, passed for reviewed head `ab65c3e5` against base `7271a6b1`. The checkout log identifies synthetic merge `c4d2201a4739606e5f6c8da93aea6977c5ed779b`. All typechecks passed; tests were **761 suites / 10,617 tests / 59 snapshots**; lint was **0 errors / 1,165 warnings**; both bundles and the bundle verification gate passed. This green run does not cover the three independent failing handoff probes, which are absent from the checked-in suite. Any CI triggered by publishing this documentation is a later run and is not claimed by this result.

## Live-provider acceptance remains open

The reported 400-token failure establishes exhaustion of the old output allowance, not the number of tokens spent reasoning. Reasoning is a plausible cause, and running past the JSON is another; the ADR correctly records the uncertainty. Neither the PR's tests nor these independent probes reach a live provider.

After F-01 is fixed, repeat Save to memory several times on the affected `anthropic/claude-sonnet-5.5` configuration, recording the outcome, total/completion usage and reasoning count when supplied. A requested reasoning setting is not proof the upstream provider honors it, and the increased budget does not guarantee every response will complete. The live pass must establish whether this particular intermittent cutoff is resolved.

**Initial conclusion (superseded by the re-review below):** address F-01 and rerun the cancellation regressions before approval. Keep the live-model repetition check as a separate acceptance step. No merge, auto-merge, deployment, or unrelated PR changes were performed.


## Re-review: F-01 resolved (2026-11-06)

**Re-reviewed code head:** `4906f1cc5b4a64b9292975bf4b8ab19fe1a4412a`.

**Verdict: approve the scoped code change; no remaining blocking findings.** The correction changes only the helper service and its regression tests. The reasoning policy, budgets, decoder and provider wiring remain as reviewed above.

### Why F-01 is closed

- Immediately after installing the forwarding listener, the service checks whether the caller is already aborted and forwards that state. An abort in the preparation handoff therefore reaches the internal controller before the catalog wait.
- The dispatch guard again checks the caller's own signal, and its result prioritizes that caller cancellation over timeout classification.
- Both original two- and three-microtask dispatch reproductions pass unchanged. The independent unresolved-catalog reproduction also passes unchanged, returning `cancelled` rather than `timeout`.
- The three checked-in regressions cover both handoff timings and the stalled catalog. The stalled test advances no timer, so it proves prompt cancellation rather than merely a different label after the timeout.

The free underlying catalog read can still begin or settle after the wait has been cancelled. This is the existing shared-catalog limitation described above; it cannot start the cancelled inference. No extra production changes were made during this review.

### Re-review verification

- **7 related suites / 105 tests passed**, covering the current helper tests, architecture boundaries, shared reasoning catalog/request, Draft Edit integration, and four independent temporary probes (three real-client/mocked-fetch cases and the original stalled-catalog case).
- **30/30 helper tests passed** in a separate run with both original independent handoff probes appended unchanged to the 28 checked-in helper tests.
- All three `npm run typecheck` stages passed.
- `npm run lint`: **0 errors / 1,165 warnings** after temporary probes were removed.
- The working tree was restored clean before the report update. The only published follow-up is this documentation.
- [CI run 42312539886](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42312539886), job `verify`, passed for code head `4906f1cc` merged into base `7271a6b1` (checkout `078a0c8`). **761 suites / 10,620 tests / 59 snapshots**, all typechecks, lint (0 errors / 1,165 warnings), both webpack bundles and `verify:bundle` passed. Any CI caused by this report update is a separate later run; it is not covered by this result.

These local runs are focused re-review coverage, not a second full local suite. Full current-code coverage is the exact-head CI result above. The first full local run remains attributed to `ab65c3e5`.

**F-01 is resolved.** Repeated live Save to memory checks on the affected model remain outstanding; no mocked result in either review establishes that upstream provider behavior. No merge, auto-merge or deployment was performed.
