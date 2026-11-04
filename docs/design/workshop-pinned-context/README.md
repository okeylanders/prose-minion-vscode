# Workshop Pinned Context design source

Snapshot of the **Workshop Pinned Context Settings** design canvas, for the
[Workshop Pinned Context epic](../../../.todo/epics/epic-workshop-pinned-context-2026-11-04/README.md)
and [ADR 2026-11-04](../../adr/2026-11-04-workshop-pinned-context.md). The
brief, states and open questions are in
[Slice 0d's doc](../../../.todo/epics/epic-workshop-pinned-context-2026-11-04/slice-0d-tab-design.md).

- **Status: first pass, waiting on Okey's review.** Nothing here is approved
  yet. Once it is, the canvas is copied here again and this line says so.
- **Source:** a Claude Design canvas artifact,
  https://claude.ai/artifact/2dZHup6uEFKQML17dJeZqz (private to its owner).
  Drawn on 2026-11-04 and copied here the same day.
- **Format:** the same as `docs/design/workshop-project-memory/` and
  `docs/design/workshop-wayfinding/`.
  - Each `.dc.html` file is a Design Component (`<x-dc>` markup, `{{hole}}`
    bindings, and a `DCLogic` class). It needs the canvas runtime
    (`./support.js`), so it won't run as a plain page.
  - Each state artboard mounts `Main` or `Picker` with fixed props
    (`<dc-import>`).
  - `canvas.json` is the canvas index.
  - To use the prototype, open the artifact link.
- **Sync policy:** change the design in the canvas, then copy the files again.
  Don't hand-edit them here.
- **Theme:** the full tabs' real dark tokens (`styles/fulltab/tokens.css`),
  with the Conversation settings rules copied by value from the approved
  Memory design (PR #196). The picker copies
  `ProjectResourcePickerModal`'s rules (`styles/fulltab/modal.css`), and the
  Workshop board copies the context pill (`styles/workshop/shell.css`) and
  sessions menu rules (`styles/fulltab/savedItems.css`,
  `styles/workshop/session.css`). There is no light theme.

## The boards

| Board | Builds in | What it shows |
|---|---|---|
| `Main.dc.html` | 3 | The tab, with 10 files pinned. Interactive: Move up, Move down and Unpin work. Its `viewState` prop drives every tab state below |
| `Empty.dc.html` | 3 | Nothing pinned yet |
| `Problems.dc.html` | 3 | One pinned file not found, one that can't be read (over the 5 MB file limit). 8 of 10 attach |
| `OverBudget.dc.html` | 3 | An 84,200-word manuscript pinned by a hand edit: about 107,600 of 100,000 words. It doesn't fit, so it's left out, and nothing is unpinned |
| `Changed.dc.html` | 3 | A write refused because another window changed the list. The current list is shown |
| `Running.dc.html` | 3 | A reply is running: Attach missing is disabled and says why. Pinning still works |
| `Unreadable.dc.html` | 3 | `pinned-context.json` itself can't be read (a path listed twice). Only Open file works |
| `NoFolder.dc.html`, `MultiRoot.dc.html` | 3 | Unavailable in this workspace, with the reason |
| `Picker.dc.html` | 3 | Add from project… in pin mode, over the dialog. Interactive: click files. Already-pinned files are disabled and tagged "Pinned" |
| `PickerRefused.dc.html` | 3 | The host refusing a pin past the 100,000-word limit |
| `Workshop.dc.html` | 2, 4 | The context sheet's pin mark and tooltip; a Pin button on an unpinned pill (question 6); the full reset's new subtitle; the New result, full and partial |

## Where the build may differ from the canvas

- **Numbers** are examples (10 files, about 23,400 words). The build reads
  each file's words through the intake service (ADR D3).
- **Files and names** are made up (*Alice*).
- **Icons** are the repo's `ICON_PATHS` glyphs, inlined (`pin`, `doc`,
  `chevDown` rotated for Move up, `alert`, `info`, `check`).
- **Move up and Move down** are always visible here. The build may show them
  on hover and focus, as the memory manager's utilities are.
