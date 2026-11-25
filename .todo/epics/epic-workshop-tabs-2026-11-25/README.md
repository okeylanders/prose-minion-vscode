# Epic — Independent Workshop tabs

**Status** In design on `epic/workshop-tabs`, branched from `main` at `0830be3c` (v2.16.0).
**Priority** Medium, selected for implementation.
**Goal** Keep several live Workshop rooms in one VS Code window, including two unnamed rooms that both restore after a reload. [Feature 9](../../features/feature-multiple-workshop-and-lightbox-tabs/README.md) · [Architecture and acceptance witnesses](../../../docs/adr/2026-11-25-workshop-tabs.md)

## Sprint plan

Each sprint starts from the integrated epic branch. A checked sprint targets the epic and gets a smoke run before integration. Inspect Dot's review when present, reply on its thread and verify any resulting change. Record concrete commands and outcomes in the sprint PR. A PR to main is a separate release decision.

| Sprint | Deliverable | Smoke gate |
|---|---|---|
| 00 · Design | Room ownership, restoration and command routing ADR, this plan and the feature index. | Check source references and persisted-data assumptions against main. |
| 01 · Room ownership | Compose Workshop services for a specific room behind the existing single-panel entry point. Isolate asynchronous mutations and cancellation. | A held read cannot enter a replacement room. Opening a room still hydrates the original checkpoint. |
| 02 · Durable rooms | Independent rolling files, discoverable closed scratch rooms, coordinated named-session ownership and all-room flush. | Restore the existing single-room fixture and two scratch rooms. Race a named open and inject a failed flush. |
| 03 · Multiple panels | Bind native panels, their handlers, seed receivers and restored identities to rooms. Add New Workshop Tab and resolve external commands by Workshop focus. | Exercise two panels with overlapping work; focus, cancel, close and restore independently. |
| 04 · Integration | Follow room-specific readers, cross-tab named operations and hidden-panel behavior through normal entry points. Update Workshop help and run the integrated suite. | Carry distinct excerpts through send, history, export, seed, rewind and reload; record any live-host coverage still pending. |

The sprint numbers describe review boundaries. Coordinate the room factory, slot-store interface and panel lifecycle before overlapping work. Review shared seams again after merging independently verified slices.

## Completion criteria

- Two simultaneously open rooms can both be unsaved. Each retains its own excerpt, history, pending work and cancellation.
- Opening a named session held by another tab reveals its sole live owner. A failed, competing or aborted open preserves committed writer data.
- Reload and close/reopen recover the correct slots, including existing `current.json` data. Shutdown drains every room and shared store.
- The writer can find New Workshop Tab and closed unsaved rooms. Help describes targeting and recovery.
- The index records the Workshop half separately from the queued Lightbox half. Smoke outcomes and any remaining live acceptance are visible in the relevant PRs.
