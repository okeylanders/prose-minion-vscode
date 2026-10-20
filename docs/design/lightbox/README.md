# Lightbox design source

Snapshot of the **Lightbox** design canvas, the source of truth for the
[Lightbox epic](../../../.todo/epics/epic-lightbox-2026-10-19/README.md) and
[ADR 2026-10-19](../../adr/2026-10-19-lightbox-inspiration-board.md).

- **Source:** a Claude Design canvas artifact,
  https://claude.ai/artifact/WMg8LAR2eM9HmCUJ95NkCU (private to its owner).
  Copied here 2026-10-19 at canvas version 3; copied again 2026-10-20 with
  the second board (below).
- **Format:** unlike the other files in `docs/design/`, these are not
  standalone pages. Each `.dc.html` is a Design Component (`<x-dc>` markup,
  `{{hole}}` bindings and a `DCLogic` class) that needs the canvas runtime
  (`./support.js`). `canvas.json` is the canvas index: two artboards and two
  sticky notes. The logo `<img>` points at an asset stored in the artifact,
  so it is broken in a plain browser. Open the artifact link to use the
  prototype.
- **Sync policy:** same as the rest of this folder. Change the design in the
  canvas, then copy the files again. Don't hand-edit them here.

## The boards

| Board | Date | State | What it is |
|---|---|---|---|
| `Main.dc.html` | 2026-10-19 | Approved; built through Slice 4 | The Lightbox editor tab for an illustrative chapter, below |
| `NewLenses.dc.html` | 2026-10-20 | **Draft** | "New sections + Opinion · draft (Alice ch. I)": the writer's seven new sections and the Opinion tile, the source for Slices 4B, 4C and 4D |

## What `Main.dc.html` shows

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

## What `NewLenses.dc.html` shows (draft, 2026-10-20)

One artboard (1440 wide, 4,500 tall), drawn on the public-domain opening of
*Alice's Adventures in Wonderland*, ch. I. It is a draft of tile structure,
layout and copy; the slice specs decide the contracts.

- **Lens strip:** Group D · Craft (Stock & signature, Rhythm, The numbers)
  and Group E · Story (Template, Pressure, Artifacts, Summary & movements),
  each toggling on its own, with the estimate following.
- **Ribbon, new lanes:** Sections (measured), Movements and Engagement
  (read, hatched), and Pressure (open threads per column).
- **Seven sections**, numbered as the writer listed them: 1 Template &
  freshness (template, aligns/subverts, engagement by movement, cognitive
  economy tiers, a freshness reading with its counted basis); 2 Stock &
  signature (signature phrases, familiar phrasing with counts, air-lock
  passages, echoes with an accuracy callout); 3 Rhythm & handoffs (measured
  sentence lengths, how paragraphs end, a handoff sample); 4 Pressure
  (threads planted, escalated, resolved or open); 5 Artifacts (objects, first
  paragraph and mentions counted, a read arc); 6 What stands out in the
  numbers (measured standouts against ranges and the writer's average, with
  how each is used); 7 Summary & movements (synopsis, movements with
  boundary quotes, a measured Sections note).
- **8 Opinion:** the one evaluative tile. Three clickable views
  (Enthusiastic, Neutral, Blunt) over one shared list of observations, each
  citing the board.

**Licensing and data.** Its quotes are verbatim from the public-domain
*Alice* text. Paragraph numbers, counts, ranges, tiers and readings are stub
figures written to show each section's shape.
