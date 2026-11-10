# PR #252: final re-review of deferred retention

- **Reviewed code:** `d7c44f840b31cfd1c495516bcd6783399c4e0baa`.
- **Fix assessed:** `a31ea6c21`, following the re-review of `babdbd516`.
- **Date:** 2026-11-10.
- **Verdict:** **Approved on technical review. No remaining blocking findings.**
- **Scope:** Independent inspection of the staging-race fix, rerun of every changed test suite, and additional deterministic integration probes. This supersedes the changes-requested verdict in [the preceding re-review](./pr-252-reply-edit-press-rereview.md). It does not authorize or perform a merge.

## R1 is resolved

The former failure was reproducible while file staging waited: Stop or disabling edits removed the visible request but left the request and successful-answer line in retained history.

The fix defers the exchange rather than undoing committed history:

1. [AgentRunEngine.ts:615–658](https://github.com/okeylanders/prose-minion-vscode/blob/d7c44f840b31cfd1c495516bcd6783399c4e0baa/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L615-L658) prepares one commit containing the pending messages, context-source rows, and budget snapshot. With `deferRetention`, it passes that commit to the owner without performing it.
2. The final-reply seam carries the callback through both initial and continued persona runs. [WorkshopEditOfferHandler](https://github.com/okeylanders/prose-minion-vscode/blob/d7c44f840b31cfd1c495516bcd6783399c4e0baa/packages/core/src/application/handlers/domain/workshop/WorkshopEditOfferHandler.ts#L116-L153) owns that callback.
3. [Completion](https://github.com/okeylanders/prose-minion-vscode/blob/d7c44f840b31cfd1c495516bcd6783399c4e0baa/packages/core/src/application/services/workshop/fileEdits/WorkshopEditOfferAnswerCompletion.ts#L121-L232) first checks cancellation, reply validity, and the current edits setting. It commits retention only after `session.completeRun` actually adopts the answer, before recording the retained-history mark. No asynchronous gap separates adoption from retention.
4. [Preemption](https://github.com/okeylanders/prose-minion-vscode/blob/d7c44f840b31cfd1c495516bcd6783399c4e0baa/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L1496-L1508) aborts a directed run and rolls back its request before the replacement runs. An obsolete completion cannot retain its exchange or clear a replacement's ownership.
5. The held callback is single-use. It refuses missing conversations or a changed message count. The Workshop also keeps its run ownership through staging; supported settings/directive changes are rejected or deferred while the session is active. The count check is not a general content-revision token, so future users of this seam must preserve its documented exclusive-owner requirement.

No rollback of shared history, pruning of newer marks, or lowering of artifact-id counters is needed. Uncommitted capability reads may consume artifact ids, as cancelled runs already do; those ids remain monotonic.

## Independent checks

All checks below ran against the reviewed code, without live provider calls.

- **Typecheck:** `npm run typecheck` passed all three stages: core host, core webview, and extension.
- **Every changed suite:** 14 suites, **330 tests passed**, clean process exit. This includes the real-engine press integration, final-reply/deferred-retention tests, route and whole-room/session witnesses, bound-excerpt staging, fixes Apply policy, answer/status parsing, prompt synchronization, and architecture boundaries.
- **Additional temporary integration probes:** **8 tests passed**, clean process exit, four scenarios in each transport:
  - Stop during held staging after a capability read leaves the whole message history, source manifest, budget snapshot, committed-history counts, and ledger unchanged. Retrying succeeds, records the new source, and does not reuse the abandoned artifact id.
  - Turning edits off at the same boundary has the same behavior, followed by a successful retry.
  - An accepted answer holds capability metadata and history until adoption, then commits both together.
  - The old press is released while a preempting ordinary message is still waiting for its provider. The newer request remains active, keeps its own exchange when it finishes, and receives no obsolete request/answer from the press.
- **Whitespace:** `git diff --check 603ad3646..d7c44f840` passed.
- Temporary probe files were removed; no production file was modified.

The eight probes used the real engine, conversation manager, router, room handler, and answer completion with controlled provider and staging ports. They checked actual asynchronous boundaries with gates rather than sleeps.

## CI

For exact reviewed head `d7c44f840b31cfd1c495516bcd6783399c4e0baa`:

- [Push CI 42792938227](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42792938227): success.
- [PR CI 42792948622](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42792948622): success. Verified install, typecheck, tests, lint, and both-bundle build steps.

Full-suite tests, lint, and build were not independently rerun locally for this final pass; exact-head CI supplies those aggregate results. This documentation commit may start a new CI run and is not itself covered by the earlier SHA's check status.

## Prior findings and remaining scope

The original truncation/interruption, rejected-prose retention, and bound-excerpt staging/Apply findings remain resolved. Their regression suites passed again. R1's deferred Stop/settings window is now resolved as well.

The separately recorded [ordinary-message retention-before-settlement debt](../../.todo/tech-debt/2026-11-10-workshop-reply-retained-before-settlement.md) is pre-existing, outside the edit-offer fix, and does not block this PR. The earlier re-review's capability reread limitation remains a scope note, not a wrong-file write regression.

No interactive VS Code or billable-model validation was performed. No merge was performed. Because the publishing account is also the PR author, the technical approval is recorded in this report and a COMMENT review rather than a formal self-approval.
