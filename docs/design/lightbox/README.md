# Lightbox design source

Snapshot of the **Lightbox** design canvas, the source of truth for the
[Lightbox epic](../../../.todo/epics/epic-lightbox-2026-10-19/README.md) and
[ADR 2026-10-19](../../adr/2026-10-19-lightbox-inspiration-board.md).

- **Source:** a Claude Design canvas artifact,
  https://claude.ai/artifact/WMg8LAR2eM9HmCUJ95NkCU (private to its owner).
  Copied here 2026-10-19 at canvas version 3.
- **Format:** unlike the other files in `docs/design/`, these are not
  standalone pages. `Main.dc.html` is a Design Component (`<x-dc>` markup,
  `{{hole}}` bindings and a `DCLogic` class) that needs the canvas runtime
  (`./support.js`). `canvas.json` is the canvas index: one artboard and two
  sticky notes. The logo `<img>` points at an asset stored in the artifact,
  so it is broken in a plain browser. Open the artifact link to use the
  prototype.
- **Sync policy:** same as the rest of this folder. Change the design in the
  canvas, then copy both files again. Don't hand-edit them here.

## What the prototype shows

One interactive artboard (1440 wide, fluid): the Lightbox editor tab for an
illustrative chapter, `Drafts/chapter-6.12.md`.

- **Shell:** the Workshop tab's header and left rail (Excerpt, Context), with
  the rail's Tools block replaced by **Lenses** (per-lens toggles that change
  the call count and cost estimate) and **Boards** (saved boards and Compare).
- **Two registers:** *measured* tiles (solid, orange, counted by code) and
  *read* tiles (dashed, periwinkle, serif claims), plus a neutral
  *counted · read* style for tiles where code counts the words and a reading
  groups or names them.
- **The paragraph ribbon:** a sticky strip, one column per paragraph, with
  rhythm, dialogue, tension (read) and focus lanes. Hovering any item lights
  the paragraphs it touches.
- **Tiles:** headline stats, top words, palette, lexical gravity (orbit,
  borrowed fields, degree bars, collision, a field set aside as literal),
  motifs, characters, lineage, genre neighborhood, voice, subtext, parts of
  speech and repeated phrases, and the Spark lane.
- **Inspector:** register badge, claim, the paragraphs it lives in, quotes
  "found verbatim" with ¶ addresses, a withheld claim, counted support, the
  "where this reading strains" block, and actions (Bring to Workshop, Reveal,
  Go deeper / Build as a lens, Re-read this tile).
- **Run states:** the **Phase** tweak (fresh, streaming, complete) and the
  Re-read button show measured tiles first and readings arriving in three
  groups.

**All data in the prototype is illustrative.** The counts come from a metrics
screenshot of one chapter. Every quote, paragraph address, reading and
character note was invented to show the shape and is not drawn from any
manuscript.
