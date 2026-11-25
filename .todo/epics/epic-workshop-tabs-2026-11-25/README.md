# Epic — Independent Workshop tabs

**Status** In design on `epic/workshop-tabs`, branched from `main` at `0830be3c` (v2.16.0).
**Priority** Medium, selected for implementation.
**Goal** Keep several live Workshop rooms in one VS Code window, including two unnamed rooms that both restore after a reload. [Feature 9](../../features/feature-multiple-workshop-and-lightbox-tabs/README.md) · [Architecture and acceptance witnesses](../../../docs/adr/2026-11-25-workshop-tabs.md)

## Sprint plan

Each sprint starts from the integrated epic branch. A checked sprint targets the epic and gets a smoke run before integration. Inspect Dot's review when present, reply on its thread and verify any resulting change. Record concrete commands and outcomes in the sprint PR. A PR to main is a separate release decision.

| Sprint | Deliverable | Smoke gate |
|---|---|---|
| 00 · Design | Room ownership, restoration and command routing ADR, this plan and the feature index. | Check source references and persisted-data assumptions against main. |
| 01 · Async reads and assistants | Bind attachment reads to their initiating room revision and give each room its own assistant prompt and run bindings. | Hold a picker/catalog read across a room replacement. Exercise independent assistants with shared provider resources. |
| 02 · Durable rooms | Rolling storage for legacy and UUID slots, cross-window scratch conflict handling, named-session ownership and a close result backed by disk state. | Use independent registries and stores over one filesystem. Race legacy and UUID slots, a named open and a real failed close. Preserve both writers' work and retry the latest edit. |
| 03 · Room composition and native tabs | Wire each room's service factory, panel and seed receiver. Implement closed-room picker, scoped Lightbox handoffs, ephemeral rooms, usage and shutdown. | Run two rooms; focus, close, recover, cancel and reload. Exercise no folder/two roots, lost acknowledgements with identical tiles, a late global usage subscriber and shutdown with a failed write. |
| 04 · Integration | Follow room-specific readers, cross-tab named operations and hidden-panel behavior through normal entry points. Update Workshop help and run the integrated suite. | Carry distinct excerpts through send, history, export, seed, rewind and reload. Record live-host smoke results and distinguish simulated provider usage. |

The sprint numbers describe review boundaries. Coordinate the room factory, slot-store interface and panel lifecycle before overlapping work. Review shared seams again after merging independently verified slices.

## Completion criteria

- Two simultaneously open rooms can both be unsaved. Each retains its own excerpt, history, pending work and cancellation.
- Opening a named session held by another tab reveals its sole live owner. A failed, competing or aborted open preserves committed writer data.
- In a single-folder workspace, reload and close/reopen recover the correct slots, including existing `current.json` data. In folderless and multi-root windows, closed rooms remain available in the same host. Shutdown drains every room and shared store.
- The writer can find New Workshop Tab and closed unsaved rooms. Help describes targeting and recovery.
- The index records the Workshop half separately from the queued Lightbox half. Smoke outcomes and any remaining live acceptance are visible in the relevant PRs.
