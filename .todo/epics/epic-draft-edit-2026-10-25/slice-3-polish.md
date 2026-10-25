# Slice 3: Polish

**Epic:** [Draft Edit](README.md)
**Status:** Planned

## Scope

- A `contributes.submenus` "Prose Minion ▸" group in the editor context menu,
  replacing the flat list.
- `proseMinion.proofread.spellingConvention` (`auto | american | british |
  canadian | australian`), passed to the prompt.
- Summary refinements learned from the manual fixture run. (*Show Problems*
  already shipped in Slice 1.)
- **A selection run replaces only its own flags.** Today a run replaces all
  of a document's flags, per ADR D7. A writer proofreading section by section
  may want earlier sections' flags kept. The annotator knows where shown flags
  now sit, so it would replace those inside the selection's current range.
- Threshold tuning from that run, made in the constants named in the ADR's
  Thresholds table.

## Acceptance

- Each item above ships with a focused test.
- The ADR's Thresholds table records any changed value and why.
