# Slice 3: Polish

**Epic:** [Draft Edit](README.md)
**Status:** Built; in review (2026-10-26)

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

## As built

The decisions are in the ADR's
[Amendment 2026-10-26: Slice 3, polish](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md#amendment-2026-10-26-slice-3-polish).

- **The submenu.** The editor context menu holds one **Prose Minion**
  submenu (`prose-minion.editorContext`) in three groups: Word Lookup and
  Assistant; Send Selection to Workshop and the Lightbox entry; Proofread
  and Flag and Proofread and Fix. Each keeps its own `when` clause.
  - **Beyond the plan:** every contributed command takes
    `"category": "Prose Minion"` and a short title. Menus show the short
    title, and the Command Palette reads "Prose Minion: …" as before.
  - **A consequence:** the Explorer's and the editor title's Open File in
    Lightbox now read "Open File in Lightbox".
  - **Tests:** `editorContextMenu.test.ts` evaluates each `when` clause as
    VS Code 1.82.0 does, so its table is what a writer sees on right-click,
    in four editor states. It failed against the flat list.
- **The spelling convention.** `proseMinion.proofread.spellingConvention`
  defaults to `auto`.
  - It is read at the gesture and carried on the pass as `spelling`
    (absent for `auto`, or for a value outside the list).
  - It is sent in each chunk's request beside the passage, and the prompt
    gains a section on it.
  - **Tests:** the command rules, the use case and the service each carry
    it. A sync test holds the prompt to the domain's list, and a manifest
    test holds the setting's enum to `auto` plus that list.
- **A selection run replaces only its own flags.**
  - At the gesture, the use case notes the shown flags wholly outside the
    selection. When it shows its own, it keeps those still shown, where
    they now sit, with their ids and quick fixes.
  - Deciding at the gesture, against the text the selection's offsets
    name, means no range is moved through the writer's edits.
  - A flag the writer dismissed, edited or cleared during the run is not
    brought back.
  - The outcome counts the kept flags (`kept`). The summary says "N earlier
    flags outside the selection kept", or "no issues found in the
    selection", and offers *Show Problems* when any flag is shown.
  - **Tests:** `DraftEditSelection.test.ts` covers the fakes, and
    `draftEditSelection.integration.test.ts` the production adapters. Six of
    the eight core cases failed with the keep decision disabled; the Clear
    case and the whole-file control pass either way, as they should.
- **Summary refinements and thresholds.** None beyond the kept count. The
  writer's runs raised no problem, but no fixture run with a rate was
  recorded, so the Thresholds table stands. The wider coverage the writer
  asked for is [Slice 3b](slice-3b-proofread-coverage.md), queued next.
- **Not built:** Clear Proofread Flags stays out of the submenu. Shown
  without a context key for "this file has flags", it would sit there
  doing nothing on most files.
