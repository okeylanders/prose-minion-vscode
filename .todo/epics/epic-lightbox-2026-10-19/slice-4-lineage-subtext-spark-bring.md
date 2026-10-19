# Slice 4: Lineage, Subtext, Spark, and Bring to Workshop

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3 (kinds), D7, D11
**Status:** Planned

## Outcome

Three lenses join the board, and any tile can be carried into the Workshop.

- **Lineage:** adjacent myths and stories, each marked matches, departs or
  subverts against quoted evidence. It includes a "checked and set aside"
  line, and an empty result is allowed.
- **Subtext:** said and meant pairs anchored on dialogue lines.
- **Spark:** a separate lane of offers phrased as questions. Each has
  counted support and paragraph addresses. "Not for me" dismisses it, with
  undo.

**Bring to Workshop** stages any pinned tile above the Workshop composer. A
header tray counts the tiles bound for the Workshop and opens it.

## Host

- Prompts: `22-subtext.md`, `31-lineage.md`, `32-spark.md`; updated worked
  examples for groups B and C. Spark rules: questions or offers only, never
  instructions, and no claim without a paragraph address.
- Codec kinds: `lineage` (stance enum `matches | departs | subverts`),
  `subtext`, `spark`.
- **Handoff (ADR D11):**
  - `LIGHTBOX_HAND_OFF` with `{ kind: 'tile', tileKind, title, claim, quotes, friction }`;
  - quotes are re-verified against the current source before the handoff;
  - `WorkshopPanelProvider.stageLightboxTile(item)` routes a synthetic
    `WORKSHOP_STAGE_LIGHTBOX_TILE` through the Workshop panel's own handler;
  - the Workshop renders it as a pending message attachment (the thread
    artifact frame), which the writer sends or removes;
  - the attachment carries the claim and the verified quotes only, never the
    whole board;
  - it is bounded by `PROMPT_BUDGETS.workshopThreadArtifacts`.
- Architecture: the new Workshop route joins the ledger, and the attachment
  kind registers with the frame neutralizer in the same change.

## Webview

- `LightboxLineage`, `LightboxSubtext`, `LightboxSparkLane`.
- Header tray (`n tiles bound for Workshop · Open Workshop →`) and the
  inspector's Bring and Bound states.

## Tests

- Codec: a stance outside the enum; a spark phrased as an instruction is
  rejected by a validator rule (imperative opener list, tuned on fixtures);
  an empty lineage block is valid.
- Handoff:
  - staging reaches the Workshop only through its handler;
  - a stale tile is refused;
  - the attachment payload stays within its budget;
  - the Workshop shows the staged item, and removing it sends nothing.

## Done when

A pinned motif, lineage item or spark appears above the Workshop composer
with its quotes, and nothing is sent until the writer sends it.
