# Draft Edit: status after v2.12.0

**Date:** 2026-11-04
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox` at
`a9c16ef3`.

## Why

The writer asked whether the docs say where Draft Edit stands, after
v2.12.0 shipped on 2026-11-02. They did not: the epic README, five slice
docs and two feature notes still read as if Slice 3b part 3 were in review
and the release were ahead.

## Facts

- Shipped in v2.12.0: Proofread (Flag, Fix, the word list, the spelling
  convention, names, quotation marks, consistency), Craft Flags (cliché,
  register, gesture, continuity) and the reasoning levels. The tagged
  manifest carries `proofread.reasoning` (`light`) and
  `craftFlags.reasoning` (`standard`), and the quotation and consistency
  modules are in the tag.
- Not built: Slice 4 (the Workshop Proofread button) and Slice 5 (Apply to
  Draft). `WorkshopExcerptWriteTarget` appears only in docs and the ADR.
- `main` is 14 commits ahead of `epic/lightbox` (the release merge, its
  changelog and memory-bank notes). `epic/lightbox` does not contain them.

## Decisions (the writer, 2026-11-04)

- **The fixture run is not scheduled.** The writer will find false positives
  and weak defaults by using the tools, then circle back. Until then every
  new Proofread category stays a flag, and Craft Flags' categories keep
  their defaults.
- **Apply to Draft is the next thing the writer wants.** It needs Slice 4's
  groundwork. Deciding between all of Slice 4 and only its write target
  (`WorkshopExcerptWriteTarget`, `WorkshopExcerptReplacer`, the route owner)
  is the first step; Slice 5's open questions (the model, bubbles with no
  findings, the rewrite ceiling) follow it.

## Not recorded

Whether the writer ran one Proofread chunk at `off` and one at `light`, as
the ADR asked before the release.

## Changed

The epic README (status, table, log), the status lines of slices 1, 2, 3,
3b, 3c and 5, the Proofread and Apply to Draft feature notes, and this
entry. Docs only.
