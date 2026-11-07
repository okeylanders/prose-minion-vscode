# Workshop Wayfinding design source

Snapshot of the **Workshop Rail Planning** design canvas, the source of truth for
the [Workshop Wayfinding epic](../../../.todo/archive/epics/epic-workshop-wayfinding-2026-11-03/README.md)
and [ADR 2026-11-03](../../adr/2026-11-03-workshop-wayfinding.md).

- **Source:** a Claude Design canvas artifact,
  https://claude.ai/artifact/UBUrNmVPeZkeT5MEXf4T6M (private to its owner).
  Drawn 2026-10-27 and copied here 2026-11-03, unchanged since then.
- **Format:** same as `docs/design/lightbox/`. Each `.dc.html` file is a Design
  Component (`<x-dc>` markup, `{{hole}}` bindings, and a `DCLogic` class) that
  needs the canvas runtime (`./support.js`), so it won't run as a plain page.
  `canvas.json` is the canvas index. To use the prototype, open the artifact
  link.
- **Sync policy:** change the design in the canvas, then copy the files again.
  Don't hand-edit them here.

## The boards

| Board | State | What it shows |
|---|---|---|
| `Today.dc.html` | Reference | Today's rail: Excerpt, Context, Tools (marked for retirement), To-dos |
| `Main.dc.html` | Approved for Slices 1–5 and 7 | The Workshop with the two-tab rail. Clicking the tabs switches them. Clicking Bookmark on the second reply adds a bookmark and badges Notes |
| `Reader.dc.html` | Approved for Slices 2–3 | The read-only reader sheet: range bar, end-of-read marker, "changed since" banner, Open beside |
| `Slices.dc.html` | Approved for Slice 7 | Time slice, model slice, the hover title naming the model, and the served-by note |

## Where the build differs from the canvas

- **"Changed since" on the rail row:** optional (Slice 3). The reader's banner
  is required.
- **Header model chip:** the canvas shows a model button in the header. The
  Workshop's real header model control is unchanged by this epic.
