# Workshop Project Memory design source

Snapshot of the **Workshop Memory Settings** design canvas. It is the approved
design for the
[Workshop Project Memory epic](../../../.todo/epics/epic-workshop-project-memory-2026-11-04/README.md)
and [ADR 2026-11-04](../../adr/2026-11-04-workshop-project-memory.md). The
decisions, states and copy are written out in
[Slice 0d's doc](../../../.todo/epics/epic-workshop-project-memory-2026-11-04/slice-0d-settings-design.md).

- **Source:** a Claude Design canvas artifact,
  https://claude.ai/artifact/NYB5iZWgaJB4BJdPuN3hwF (private to its owner).
  Drawn and approved by Okey on 2026-11-04, and copied here the same day.
- **Format:** the same as `docs/design/workshop-wayfinding/`.
  - Each `.dc.html` file is a Design Component (`<x-dc>` markup, `{{hole}}`
    bindings, and a `DCLogic` class). It needs the canvas runtime
    (`./support.js`), so it won't run as a plain page.
  - Each state artboard mounts `Main`, `Manager` or `EditSheet` with fixed
    props (`<dc-import>`).
  - `canvas.json` is the canvas index.
  - To use the prototype, open the artifact link.
- **Sync policy:** change the design in the canvas, then copy the files again.
  Don't hand-edit them here.
- **Theme:** the artboards use the full tabs' real tokens
  (`styles/fulltab/tokens.css`) and the Conversation settings, session-browser
  and thread rules, copied by value. The two light artboards are a proposal
  only: full tabs are dark-only today.

## The boards

| Board | Builds in | What it shows |
|---|---|---|
| `Main.dc.html` | 4b | The Memory tab, on, with memories, Ask first. Interactive: click the mode cards. Its `viewState` and `theme` props drive every tab state below |
| `Off.dc.html` | 4b | Memory off: nothing loads, and the manager still works |
| `Empty.dc.html` | 4b | On, with no memories yet |
| `OverBudget.dc.html` | 4b | The list over its 2,000 tokens: "25 of 37 fit", "12 more are searchable" |
| `Unreadable.dc.html` | 4b | Two unreadable files listed with their reasons, and Show in manager |
| `NoFolder.dc.html`, `MultiRoot.dc.html` | 4b | Memory unavailable in this workspace, with the reason. The mode cards stay choosable |
| `LightMemories.dc.html`, `LightOver.dc.html` | — | Light-theme proposal, not built |
| `Manager.dc.html` | 4b | The memory manager. Interactive: Group by Kind / Date |
| `ManagerOverPinned.dc.html` | 4b | Memories set to load in full over 5,000 tokens: "Doesn't fit in full" |
| `Thread.dc.html` | 3 | The suggestion card and its settled states, receipts (the Save-and-tell-me receipt expands; click the chevron), the held card, the update note, and Save to memory… |
| `EditSheet.dc.html` | 3 | The Save to memory… / Edit… / New memory sheet |
| `EditRefused.dc.html` | 3 | The sheet refusing an edit that would push memories loaded in full past their budget |

## Words

The UI never says "pin": a pinned memory is **Always load in full** (the
action and switch) and **Loaded in full** (the badge). The format keeps
`pinned:` (Slice 0d decision 16, ADR D5).

## Where the build may differ from the canvas

- **Numbers** are examples (12 memories, about 1,800 tokens). The build
  computes them with the catalog builder's own estimator (ADR D5).
- **Persona names and memory text** are made up (*Alice*).
- **Icons** are the repo's `ICON_PATHS` glyphs, inlined. The archive glyph and
  the Off card's slashed circle are new, and Slice 4b adds them to
  `iconPaths.ts`.
