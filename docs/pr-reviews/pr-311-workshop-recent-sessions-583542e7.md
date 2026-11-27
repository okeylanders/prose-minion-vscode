# PR #311: Workshop recent saved sessions

**Verdict: request changes before merging to `epic/workshop-tabs`.** Independent Astra 6.2 review of `583542e7d87fc03793fec1b134566b18e97a1404` against `b9e8e51f47eaa233d98ba36f2bd812728ad78ce6`.

## P2: A delayed Recent selection can override a newer Workshop/Home click

[WorkshopPanelProvider.ts, late reveal](https://github.com/okeylanders/prose-minion-vscode/blob/583542e7d87fc03793fec1b134566b18e97a1404/apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts#L166-L170). The Recent operation waits for dormant native editors and checks its navigation generation before revealing the owner. The explicit Workshop/Home path does not invalidate that operation when it reveals an already attached primary room (see also lines 136–139 and the primary/native focus guard at lines 371–373).

An independent test through the production provider with a mocked native tab host held the secondary room's serializer, clicked Workshop/Home, verified the primary became active, and then released the serializer. The delayed Recent operation reported success, pulled focus back to the secondary, and changed the destination for the next Lightbox handoff. No lost text or redirection of an already captured offer was established. The same test with a newer Plus action preserved the new tab; a workspace change rejected the pending open.

Advance the navigation generation for explicit Workshop/Home actions, while keeping internal native probes from invalidating their own operation. Add coverage for the primary staying active and remaining the next handoff destination after delayed hydration.

## Verification and limits

- Eight checked-in focused suites passed (167 tests), covering the sidebar, extension integration, storage, room registry, and native restoration. The independent witness above used a mocked native tab host, not an interactive VS Code window.
- The PR records the writer's observation of a live provider cache hit after reloading a saved room. This review did not make metered requests or independently measure cache behavior.
- This is a slice review, not clearance of the epic's pre-existing saved-session import preference issue. No merge or deployment performed.
