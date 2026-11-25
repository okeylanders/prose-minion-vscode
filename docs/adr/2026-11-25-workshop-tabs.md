# ADR 2026-11-25 — Independent Workshop tabs

**Status** Proposed for the Workshop tabs epic. T1, multiple unsaved rooms, is the writer's decision. The remaining choices below are implementation defaults for review.

**Scope** Each VS Code Workshop tab can hold its own room, run and recoverable manuscript discussion. The Lightbox continues to hand material to Workshop through its existing commands. [Epic and sprint gates](../../.todo/epics/epic-workshop-tabs-2026-11-25/README.md) · [Feature 9 and T1](../../.todo/features/feature-multiple-workshop-and-lightbox-tabs/README.md)

## Ownership at a glance

| Lifetime | Responsibilities |
|---|---|
| Extension window | Panel and room registry, recent Workshop focus, named-session ownership, shared workspace stores and their write coordination, provider resources, user settings. |
| Durable room slot | Rolling checkpoint location, workspace identity, association with the panel's restore state. The same slot can host a different session after New or Open. |
| Loaded room | Session aggregate, retained conversation bindings, projected settings and time, persistence coordinator, replacement revision, recall's open-room reader, run cancellation and deferred operations. |
| Attached panel | Webview, message handler with its own reply function, visibility, subscriptions and seed delivery. A new webview attachment has a new receiver. |

Today the path is panel → handler → shared room. Each panel already supplies its own reply function in [WorkshopPanelProvider.attachPanel](../../apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts). The single session is captured during [activation](../../apps/vscode-extension/src/extension.ts) by delivery, settings, persistence, transcript recall, capability execution, project memory provenance and export. A reply routed back to the correct tab can therefore still report a mutation of the wrong room.

### D1. Bind the destination when attaching the panel

The composition root provides a room factory and window registry. Attach the handler to a particular slot's services and that panel's reply function once. Incoming messages cannot select a different room. Shared commands that start outside a panel choose their destination at the gesture and keep it through awaits. Window-wide services may continue publishing truly global events such as account balance changes. Retain real room-replacement checks within a slot, including the [existing asynchronous context-read case](../../.todo/tech-debt/2026-11-18-workshop-room-context-reads-unbound-to-room.md).

The registry chooses where to open or reveal a room. It never reassigns in-flight replies by looking at focus. Adding a return-tab field to every message duplicates the trusted destination supplied by the adapter. An outbound-only proxy cannot isolate the session aggregate, persistence, or listeners. The room factory keeps those choices at the composition boundary.

### D2. Capture room dependencies together

Each room owns an independent coordinator, operation queue, active run and its asynchronous work. Each settings reader or callback whose result depends on the live session binds to that room. This includes the assistant prompt grammar callbacks registered in activation, conversation-history export/import, session timezone, recall bookmarks, persona tools and Passage Search's pending approval and result delivery. Shared providers and file-backed libraries can serve multiple rooms through room-scoped callers. A saved-session operation initiated in A must respect any active owner of its target in B. Named revisions and the store's compare-and-swap still protect writes from separate windows.

**Witness.** A starts a delayed turn or file read. The writer focuses B and starts or cancels work there. A's completion updates A, B keeps its own history, and a replacement or close of A invalidates A's stale work. Rewind uses its existing revision rules. [Room replacement contract](../../packages/core/src/application/services/workshop/WorkshopOpenRoomInstance.ts) · [Workshop teardown order](../../packages/core/src/application/handlers/domain/workshop/WorkshopSliceComposition.ts)

### D3. Give every scratch room a durable address

Reserve the host slot id `legacy` for the existing `current.json` so an upgrade and an old serialized panel can reopen genuine writer data through the existing decoder. Other slots get host-generated UUIDs with private rolling checkpoint locations. Use a dedicated scratch storage namespace or explicitly exclude rolling files and their sidecars from named-session scans. Keep the persisted conversation format and existing recovery/atomic-write rules. Validate serialized slot identifiers before resolving them to host-controlled paths. A malformed or duplicate restore cannot take possession of another panel's scratch checkpoint.

VS Code restores a panel's slot identity. The host reads authoritative content from that slot's disk checkpoint. Closing a tab quiesces its work and flushes committed state. A closed scratch room remains reopenable. A command picker lists closed scratch rooms and reopens the chosen slot. Keep checkpoint data if a close or shutdown flush fails and surface the failure for retry. Shutdown stops all producers, then awaits every room's owed writes and the existing shared-store drains, even when one fails. [Current storage and named listing](../../packages/core/src/infrastructure/storage/WorkshopSessionStore.ts) · [Extension shutdown](../../apps/vscode-extension/src/application/extensionShutdown.ts) · [Session codec compatibility](2026-07-30-workshop-session-codec-evolution.md)

### D4. One open writer per named session per window

Use workspace and durable named-session id for ownership; tab titles and paths can change. Reserve the destination before an asynchronous open, so simultaneous opens converge on one owner. A second open reveals that owner. Retain the original ownership until a replacement commits. Release a provisional claim on failure and preserve the original room. Serialize or coordinate restore, promotion to named, reload, rename, branch, and writes from the saved-session to-do tool at the same boundary. A tab closing a named session holds its claim through its final flush. A dirty rolling copy displaced by an authoritative named checkpoint follows the coordinator's existing recovery-copy rule before adoption. Two tabs restoring the same named checkpoint must converge without overwriting either scratch copy. [Persistence coordinator](../../packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts) · [Rewind and Branch](2026-09-30-workshop-rewind-and-branch.md)

### D5. Give external commands predictable targets

Open Workshop reveals the most recently focused live Workshop tab. When none is open, preserve the existing reopen behavior. New Workshop Tab creates a fresh, independent room. Send Selection, excerpt seeding and Lightbox handoffs choose the most recently focused Workshop panel when invoked, or open one if necessary. A mount, a reveal or a restored hidden panel cannot steal a delivery already offered to another panel. Tab titles distinguish concurrent rooms, including unnamed ones. Keep the existing Branch command's destination behavior. A separate Branch into New Tab command can be considered after ordinary independent tabs work. Show Workshop run and usage feedback in the initiating room.

## Review and release witnesses

- Start two unsaved rooms with distinguishable excerpts and turns. Pin, rewind, abort and export in A; check B's history, pins, export, and active run.
- Hold a read, switch tabs, replace the initiating room, then resolve the read. Inspect both ledgers, including the durable checkpoint after reload.
- Open the same named session through two tabs concurrently, then exercise a rejected open and retry. One named owner and a recoverable originating room survive each outcome.
- Reload with both tabs present, including an old panel state and a pre-feature `current.json` fixture. Close, reopen and shut down with pending writes. One failing flush must still let every other flush settle.
- Exercise the installed extension's menu commands and help entry. Sprints record the smoke actions actually exercised and distinguish fixture checks from real Extension Development Host runs.
