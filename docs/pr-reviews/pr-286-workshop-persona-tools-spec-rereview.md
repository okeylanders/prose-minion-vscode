# PR #286: Workshop Persona Tools spec re-review

**Astra 6.2 · Changes requested. Not approved for merge into `epic/workshop-persona-tools`.**

Reviewed `6c4fc0fdf201ed6bed6e38e7c063b613c4748fc6`. This is a source and specification review of the docs-only revision, not implementation testing.

- [D6a, line 366](https://github.com/okeylanders/prose-minion-vscode/blob/6c4fc0fdf201ed6bed6e38e7c063b613c4748fc6/docs/adr/2026-11-19-workshop-persona-tools.md#L366): **P1 · Expired ownership must fence the staged write.** `StoredFileRewrite.ts:92,114–129` stages outside the claim and checks ownership separately from publishing. `StoredFileClaims.ts:53,329–359` can recover an expired claim. A paused writer can retain its staged file after recovery and a successful delete, then recreate the now-vacant session. This is a participating-writer problem, not external sync. Require fencing that invalidates a stale staged publish, or decline automatic takeover without that guarantee. Verify that a resumed writer cannot recreate a successfully deleted session.

- [D6a, line 386](https://github.com/okeylanders/prose-minion-vscode/blob/6c4fc0fdf201ed6bed6e38e7c063b613c4748fc6/docs/adr/2026-11-19-workshop-persona-tools.md#L386): **P1 · The losing room’s recovery copy is shared.** `WorkshopSessionStore.ts:210–217` derives `current.json` from the workspace, not the window. Another coordinator can replace it before the losing room reloads. Require a separate, non-overwriting recovery identity. Verify that both the winning named checkpoint and the losing room’s edits survive an intervening write to `current.json`.

- [D8a, line 475](https://github.com/okeylanders/prose-minion-vscode/blob/6c4fc0fdf201ed6bed6e38e7c063b613c4748fc6/docs/adr/2026-11-19-workshop-persona-tools.md#L475): **P2 · A temporarily busy read can permanently remove Undo.** D8a only reconciles `saving` rows. A busy target becomes terminal `interrupted/unverified` and is counted as not written even if the matching operation stamp is intact. Keep uncertainty distinct from a verified mismatch and eligible for later read-only reconciliation. Verify busy on hydration followed by readable/matching restores `applied` and Undo without replaying the original write.

## Prior finding disposition

- **F-01 remains open:** shared claim participation and an overlapping-writes witness improve the design, but lease recovery must fence stale writes and named-file protection must not be confused with preservation of the losing room.
- **F-02 remains open:** persisted operation ownership and no-replay reconciliation cover the ordinary restart boundaries, but a transient unavailable read must not permanently discard Undo.
- **F-03 closed at the design gate:** D13a separately bounds paragraph count and edit distance, explicitly refuses over-budget comparisons, and bounds recomputation on cache miss.
- **F-04 closed at the design gate:** D22a distinguishes incomplete evaluation from a completed zero-match search and leaves the affected group unchanged at preview and Apply.

[Exact-head CI #2391 passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44505086081): typechecks, tests, lint, and build. The acceptance boundaries above are proposed implementation checks, not tests run against an implementation of this spec. Keep the Slice B and C contracts; refine Slice A before implementation.
