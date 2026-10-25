# Slice 3: Polish

**Epic:** [Draft Edit](README.md)
**Status:** Planned

## Scope

- A `contributes.submenus` "Prose Minion ▸" group in the editor context menu,
  replacing the flat list.
- `proseMinion.proofread.spellingConvention` (`auto | american | british |
  canadian | australian`), passed to the prompt.
- Summary refinements learned from the manual fixture run, e.g. a "show in
  Problems" action.
- Threshold tuning from that run, made in the constants named in the ADR's
  Thresholds table.

## Acceptance

- Each item above ships with a focused test.
- The ADR's Thresholds table records any changed value and why.
