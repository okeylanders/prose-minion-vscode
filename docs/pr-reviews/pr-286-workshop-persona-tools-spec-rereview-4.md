# PR #286: Workshop Persona Tools spec, fourth re-review

**Astra 6.2 · Approved for merge into `epic/workshop-persona-tools`.**

Reviewed `c4cd8d7b6a04f6380b60f9db61bd40c8ee9f04e2`. No blocking findings remain for this docs-only PR.

- **P1 closed:** [D6e lines 521–538](https://github.com/okeylanders/prose-minion-vscode/blob/c4cd8d7b6a04f6380b60f9db61bd40c8ee9f04e2/docs/adr/2026-11-19-workshop-persona-tools.md#L521-L538) removes automatic takeover. Ordinary release acts only on the owner's token paths before attempting a nonrecursive directory removal; it does not detach a successor's live lock. Explicit recovery requires closing other windows using the workspace and is serialized in the recovering window. Lease age signals recovery required, not proof the owner is dead.
- **P2 closed:** [D6e lines 539–545](https://github.com/okeylanders/prose-minion-vscode/blob/c4cd8d7b6a04f6380b60f9db61bd40c8ee9f04e2/docs/adr/2026-11-19-workshop-persona-tools.md#L539-L545) makes a definitive missing decision only after acquiring the lock and rereading. An occupied lock returns busy or recovery-required rather than detaching the room.
- **Nonblocking implementation notes:** Make recovery copies idempotent across retries where practical, or document that an interrupted retry can create a duplicate (lines 563–569). Say the recovery prompt preserves unsaved work rather than every copy; it intentionally drops a superseded pre-image (lines 548–557).

[Exact-head CI #2409 passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44515509126). This is a spec approval, not verification of the future lock and recovery implementation. Keep the D6e witnesses in Slice A. No merge was performed.
