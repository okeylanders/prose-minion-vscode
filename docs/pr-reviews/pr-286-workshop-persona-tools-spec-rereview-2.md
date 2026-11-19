# PR #286: Workshop Persona Tools spec, second re-review

**Astra 6.2 · Changes requested. Not approved for merge into `epic/workshop-persona-tools`.**

Reviewed `ecb9df1f393ad476beb282745158a836c63cef3b` relative to the previous re-review. [Exact-head CI #2398 passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44510423462). This is a source and spec review; implementation behavior was not exercised.

- [D6b, line 427](https://github.com/okeylanders/prose-minion-vscode/blob/ecb9df1f393ad476beb282745158a836c63cef3b/docs/adr/2026-11-19-workshop-persona-tools.md#L427): **P1 · Fence claim, delete, and cleanup as well as publish.** The token-scoped staging file closes the previous stale-publish gap, but `prior.json` and the live lock directory still use reusable paths. A previously valid owner that resumes after takeover can remove the successor’s rollback copy or lock directory (D6b moves the checkpoint into `prior.json`, then cleanup removes it before token-checked release). Keep destructive operations tied to the verified owner's generation and perform cleanup only on its detached contents. Require a regression check that a retired owner's delayed work leaves the successor’s rollback checkpoint intact.

- [D6b, line 435](https://github.com/okeylanders/prose-minion-vscode/blob/ecb9df1f393ad476beb282745158a836c63cef3b/docs/adr/2026-11-19-workshop-persona-tools.md#L435): **P2 · Keep recovery visible while the lock is moved aside.** Between moving the expired lock aside and restoring `prior.json`, a reader can see neither a saved file nor its normal lock, report the session as missing, and detach an open room even though recovery is underway. Preserve a discoverable recovery marker or equivalent and return busy until the read can distinguish an in-progress restore from a settled deletion. Add a reader-during-recovery acceptance check.

## Prior findings

- **Stale publish:** D6b's token-scoped staging and takeover acceptance checks address the original stale publish. The ownership contract is still incomplete as described above.
- **Independent recovery:** D6c (lines 455–483) requires a separately named checkpoint and verifies it survives another write to shared `current.json`. Closed at the design gate.
- **Undo on transient contention:** D8b (lines 576–592) keeps the receipt unverified, eligible for read-only reconciliation and never replays the original write. Closed at the design gate. Its correctness still depends on D6b distinguishing a recovery in progress from a settled deletion.
- Previous Git diff and context-path resolutions remain closed. Shared Lightbox and project-memory storage is separate recorded debt and was not exercised.
