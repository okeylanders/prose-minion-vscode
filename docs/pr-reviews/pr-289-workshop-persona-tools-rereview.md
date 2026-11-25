# PR #289: Workshop Persona Tools re-review

**Astra 6.2 · Changes requested. Not approved for merge into `epic/workshop-persona-tools`.**

Reviewed `d6b5fef9eb55d513cfd7eca5f6ac30dfdc80e8ea`. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44527496829). Static exact-head review only; native multi-window/restart behavior was not independently run.

The corrupt-saved-file case now preserves its readable prior; the source receipt is durably checkpointed and read back before target writes. Unknown-name lookup now returns unconfirmed rather than authoritative missing.

- [packages/core/src/infrastructure/storage/WorkshopNamedSessionLock.ts:302](https://github.com/okeylanders/prose-minion-vscode/blob/d6b5fef9eb55d513cfd7eca5f6ac30dfdc80e8ea/packages/core/src/infrastructure/storage/WorkshopNamedSessionLock.ts#L302): **P1 · Retain the checkpoint even if marking the lock for recovery fails.** If publish and rollback both fail, and the owner-marker rename then fails, this branch exits without setting `held.keep`. The unconditional release can still remove the folder containing both copies. Set retention before attempting to change the marker, and report recovery required even if that marker update fails. Cover the three-failure path in a storage regression test.
