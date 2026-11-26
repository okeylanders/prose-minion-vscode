# PR #312: Independent Workshop tabs integration review

**Verdict: request changes before merging to `main`.** Independent Astra 6.2 review of `90b60837605297b95b9abb7015cc1ea2f89aca78` against `0d0659f9d4240be7a0d495597d135cd66a380e8b`.

## P1: A saved-session import can leave the writer bio in a prompt after About you is off

The [import](https://github.com/okeylanders/prose-minion-vscode/blob/90b60837605297b95b9abb7015cc1ea2f89aca78/packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts#L1564-L1569) captures the profile before asynchronous prompt construction. [Installing the resulting conversation bindings](https://github.com/okeylanders/prose-minion-vscode/blob/90b60837605297b95b9abb7015cc1ea2f89aca78/packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts#L1594-L1599) does not invalidate the marker that describes the previously installed conversations. The [settings update](https://github.com/okeylanders/prose-minion-vscode/blob/90b60837605297b95b9abb7015cc1ea2f89aca78/packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts#L307-L317) can record the newer setting for the old bindings; the [continuation guard](https://github.com/okeylanders/prose-minion-vscode/blob/90b60837605297b95b9abb7015cc1ea2f89aca78/packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts#L236-L246) trusts the room-wide marker rather than the prompt actually bound to the active conversation. An earlier epic-head review observed this with synthetic data and a fake provider. The current review confirms the path by inspection at the exact PR head; it did not rerun that privacy case or contact a live provider. Rewind and checkpoint hydration share the installation boundary.

Bind the applied profile to the installed conversations or their generation. Before dispatch under newly installed bindings, reconcile the prompt with the effective profile and fail closed if that fails. Test this at the first post-import send using a controlled local transport, and cover the shared Rewind path.

## P2: Retrying a saved Branch can reopen the cut but lose its editable starting text

The [saved branch checkpoint](https://github.com/okeylanders/prose-minion-vscode/blob/90b60837605297b95b9abb7015cc1ea2f89aca78/packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts#L1285-L1321) retains the cut history. The editable composer or widget seed is returned separately for the initial destination and is not part of ordinary reopen. When opening the destination fails, the writer is told to reopen the saved branch from Sessions. An independent activation test with a mock native editor creation failure verified the saved branch reopened correctly and the source stayed byte-identical, but the editable composer text was absent. There was no permanent loss of the original turn. The analogous widget seed is also transient by inspection, not separately exercised.

Persist a destination-scoped pending edit through this interruption and clear it only after the destination consumes it, without creating a duplicate room or touching the source draft.

## Verified in this integration

- #311's attached and dormant primary regressions passed: a later Home selection wins over delayed Recent restore, an already captured Lightbox handoff keeps its target, and a subsequent handoff follows the latest selection.
- 385 checks over 15 focused suites passed on the exact Git tree. Core, webview, and extension TypeScript checks passed. These cover native-host simulations, room ownership, archive persistence and provider routing-key/clock behavior with synthetic transport.
- The writer reported a live cache hit after reload. This review did not independently run interactive VS Code or make metered provider calls.
- No merge or deployment performed.
