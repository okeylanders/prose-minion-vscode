# Epic — Independent Workshop tabs

**Status** Workshop tabs implemented on `epic/workshop-tabs`, branched from `main` at `0830be3c` (v2.16.0).
**Priority** Medium, selected for implementation.
**Goal** Keep several live Workshop rooms in one VS Code window, including two unnamed rooms that both restore after a reload. [Feature 9](../../features/feature-multiple-workshop-and-lightbox-tabs/README.md) · [Architecture and acceptance witnesses](../../../docs/adr/2026-11-25-workshop-tabs.md)

## Sprint plan

Sprint PRs target the epic and get a smoke run before integration. Dependent work can start on stacked branches while earlier sprints are under review. Inspect Dot's review when present, reply on its thread and verify any resulting change. Record concrete commands and outcomes in the sprint PR. A PR to main is a separate release decision.

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


## Verification

| Exercise | Result |
|---|---|
| Two independent rooms | Two VS Code Workshop editors kept different excerpts. A window reload restored each slot, its rendered text and its own rolling file. |
| Named sessions | Opening the same named session in a second tab revealed its owner. The second tab kept its previous excerpt. Save and Rename updated the native tab title. |
| Upgrade and closed rooms | A pre-tabs native editor and existing writer checkpoint reopened as the legacy slot, with the same excerpt and turn IDs. The native picker reopened a closed UUID room. |
| Two windows on one project | Separate VS Code processes edited the same legacy slot. The committed checkpoint retained the first edit. A separate recovery file held the second edit. |
| Memory-only rooms | Two roots in a real VS Code window kept two rooms separate. Reopening a closed room displayed the original excerpt and wrote no checkpoint to either root. A folderless VS Code window also recovered both closed rooms with their original slot IDs and excerpts. |
| Recent saved sessions | VS Code showed the three most recently updated of five saved sessions above the unsaved rooms. Selecting an open session revealed the same native tab and kept both composer drafts. After a window reload, selecting the dormant session restored its original tab. |
| Saved-session cache | The writer confirmed a live provider cache hit after reloading a saved Workshop session. |
| Concurrent model work | The extension activation tests use a controlled provider transport and real retained conversation state. They cover overlapping turns, cancellation, rewind and transcript export. When two replies completed out of order, each retained its own token usage and cost, and a newly opened tab showed the correct window totals. |

Sprint PRs record review responses and CI. [Design](https://github.com/okeylanders/prose-minion-vscode/pull/301) · [Room operations](https://github.com/okeylanders/prose-minion-vscode/pull/302) · [Durability](https://github.com/okeylanders/prose-minion-vscode/pull/303) · [Native panels](https://github.com/okeylanders/prose-minion-vscode/pull/304) · [Integration](https://github.com/okeylanders/prose-minion-vscode/pull/305)

## Sidebar launcher and recovery

**Workshop** opens or reveals the primary room. **+** opens that room if it is the first Workshop tab, and opens a fresh room when any Workshop tab already exists.

The dropdown shows the three most recently updated named sessions first. Choosing one reveals its open tab or opens it in a separate Workshop tab.

**Unsaved Sessions** lists closed secondary rooms with recoverable work, most recent first. **Manage…** leads to the scrollable list at the bottom of Settings with Open and Delete actions per room. Closing a blank room or a room whose work is fully recoverable from its named session can release its scratch checkpoint. Later edits remain recoverable. The primary room keeps its own checkpoint.
