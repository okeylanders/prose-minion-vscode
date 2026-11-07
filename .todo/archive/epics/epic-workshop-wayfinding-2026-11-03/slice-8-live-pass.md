# Slice 8: Verify Live

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../../docs/adr/2026-11-03-workshop-wayfinding.md), all decisions
**Status:** Closed (2026-11-05). Okey settled all five decisions and approved merging the epic to `main`. He didn't report checklist results item by item, so the boxes below stay unticked. Anything the pass turns up later is filed as a follow-up, the same way as a blocker or as accepted debt.

## Outcome

The epic's features are tried by hand in the Extension Development Host, and
what tests can't see is confirmed or filed. Then the epic closes out: the ADR
moves to Accepted, the four feature notes are archived, a memory-bank entry is
written, and the epic merges to `main` through one PR with the release review.

## Before you start

- Build from `epic/workshop-wayfinding` (`npm install`, `npm run watch`), then
  press F5.
- Use a scratch project with a few Markdown files configured as project
  resources, an OpenRouter key, and two assistant models you can switch
  between.
- Check light and dark themes, and a narrow editor column, wherever a step
  says "look".

## Checklist

Each item names the slice that left it for this pass.

**Record for the pass:**
- the commit tested;
- the VS Code version and OS;
- the screen reader used;
- what happened at each step.

**For each problem found, decide which kind it is:**
- **A blocker** is fixed before the epic merges.
- **Accepted debt** is filed as `.todo/tech-debt/` and linked here, but only when Okey explicitly accepts it.

Filing something doesn't make it acceptable.

**If something changes behavior** (a decision below, or bringing `main` in), rerun the checks it affects and the epic's verification.

### Rail tabs (Slice 1)

- [ ] The rail shows **Material** and **Notes** tabs, and the Tools block is
      gone. No tab switches by itself, whatever arrives.
- [ ] With **Material** showing, add a finding from a reply as a to-do. That
      is the only way a to-do is made (D1 amendment). Notes gets a badge, and
      opening Notes clears it.
- [ ] A half-typed to-do edit survives switching tabs and back.

### Read in and the reader (Slices 2 and 3)

- [ ] Ask a persona to read a file. Its row appears under **Read in**, named
      for that persona. If Material is hidden, the row badges it.
- [ ] Opening the row shows the reader sheet. **Open beside** opens that file
      in the editor column beside the Workshop, and nothing else.
- [ ] Open a rich-Markdown resource in the reader, one with a
      `<details>`/`<summary>` block and a disabled form control inside a
      disabled fieldset. While the sheet is open:
  - [ ] Tab and Shift+Tab reach the summary and skip the inherited-disabled
        controls.
  - [ ] The Workshop behind the sheet stays inert: neither the mouse nor the
        keyboard can reach it.
  - [ ] Note what Tab past the last control does. It may reach VS Code's own
        chrome, as a native modal's does.
  - [ ] Escape returns focus to the row.
- [ ] With a screen reader, move through the rail's tabs, the Read in rows and
      the reader sheet. Each one is named and announced.
- [ ] A ranged read opens on **Source** at the first line read, scrolled
      there, with the band and the "End of … read · line N" marker.
- [ ] Edit the file, then open the row again. The amber "changed since" banner
      shows.
- [ ] **Show where it was read** closes the sheet, scrolls to the card, and
      leaves focus on the card.
- [ ] **Show where it was read** for a card outside the loaded window replaces
      the reader with the turn preview. Focus never lands behind the active
      sheet, and closing the preview returns focus to the rail row.

### Bookmarks (Slices 4 and 5)

- [ ] The Bookmark toggle appears on replies, your own messages and cards, and
      not on dividers or tool-run requests. Look at its pressed state in both
      themes.
- [ ] A bookmark set while Notes is hidden badges Notes.
- [ ] In the list:
  - [ ] Rename and save. Escape cancels. A blank name restores the default.
  - [ ] Remove works.
  - [ ] Jump focuses the bubble.
- [ ] Bookmarks survive a reload, follow Open and Branch, are pruned by
      Rewind, and are cleared by New.
- [ ] In a long session (more than 200 turns), a bookmark outside the window
      opens the read-only preview. A private exchange's preview shows
      "Private · you + …". Escape returns focus to the row.
- [ ] A to-do source, or a read-in card outside the window, opens the same
      preview instead of a notice.
- [ ] Transcript export (Markdown and HTML) marks bookmarked turns.

### Model stamps and slices (Slices 6 and 7)

- [ ] Switch the assistant model between two replies. A "Model · A → B"
      divider appears before the message that prompted the new reply.
  - [ ] Look at the chip's alignment in the divider.
  - [ ] Check that a screen reader names the divider.
- [ ] A dictionary lookup between replies never draws a false slice. A
      dictionary model change reads "Dictionary model · A → B".
- [ ] Every stamped reply's header reads "{participant} · {model}", for
      example "Jill · Opus 5.5" (Slice 7b). Writer turns and turns saved
      before this epic show no model.
  - [ ] With an auto-router model, the header reads
        "Jill · Claude Sonnet 5 via Auto router". No note appears under the
        body.
  - [ ] In a narrow column, the model name is cut short before the
        participant's name is. The label's tooltip names both ids.
  - [ ] Look at the label's muted style in both themes.
- [ ] Markdown and HTML export draw the same slices as the thread, in the
      same places. Their turn headers name the model the way the thread's
      headers do.
- [ ] JSON export has no slice entries, by design. An entry carries `model`
      where its turn has a stamp, and the value matches the thread's stamp.
      An unstamped turn carries none, and that's correct. Unstamped turns
      are:
  - resource and recall cards;
  - a reply the host wrote in the model's place;
  - any turn saved before this epic.

  Check one stamped reply and one unstamped turn.
- [ ] A session saved before this epic opens unchanged and shows no slices.

## Decisions for Okey

Okey settled all five on 2026-11-04.

- [x] **The dictionary slice's wording.** Keep "Dictionary model · A → B"
      (Slice 7), so a lookup's model change doesn't read as the room's.
- [x] **The model in export.**
  - Every stamped reply's header names its model after the participant:
    "Jill · Opus 5.5".
  - When another model served the reply, the header adds "via {requested}".
  - The under-body served-by note is retired.
  - Markdown and HTML export headers use the same rule, and the slices stay.
  - Recorded in the ADR's 2026-11-04 amendment and built in
    [Slice 7b](slice-7b-model-in-header.md) (PR #195).
- [x] **Tool-run requests aren't bookmarkable.** Keep it: the tool report that
      answers a request is bookmarkable (Slice 4).
- [x] **Escape on a pending rename.** Keep option A.
  - Escape closes the field and drops the late answer.
  - The host may still have kept the name; the next snapshot shows it
    (Slice 5).
- [x] **Bring `main` into the epic.** Wait for the epic's final PR.

## Close-out

Once the checklist is done:

1. Move ADR 2026-11-03 to **Accepted**, with the pass's date and anything it
   changed.
2. Archive the four feature notes the ADR realizes:
   - `feature-workshop-rail-tabs`
   - `feature-workshop-rail-read-in`
   - `feature-workshop-thread-bookmarks`
   - `feature-workshop-model-slices`

   Move them under `.todo/archive/`, with a note pointing here. Then archive
   this epic the same way, once its follow-ups are split out.
3. Write a memory-bank entry. It records:
   - the slices and their PRs (#184–#190);
   - the review findings and their fixes;
   - the counts (629 → 636 suites at the end);
   - the open tech debt.
4. Open the epic's PR into `main` with the release review. Its release notes
   must state what D9 accepted:
   - **A session that contains the new provenance, bookmark or model fields
     won't open in v2.12 or earlier.**
   - In practice that is most new work, because every provider reply is
     stamped.
   - An unchanged legacy session still round-trips without those fields.
   - A reply the host wrote in the model's place stays unstamped.

## Follow-up features from this epic

- [Bookmarks personas can read, and a Bookmarks screen](../../features/feature-workshop-bookmark-recall/README.md)
  (Okey, 2026-11-04). It changes D5 and D10, so it needs its own ADR
  amendment. It pairs with project memory.

## Open tech debt from this epic

- [Session codec downgrade tolerance](../../../tech-debt/2026-11-03-workshop-session-codec-downgrade-tolerance.md) (D9)
- [Workshop app root size](../../../tech-debt/2026-11-03-workshop-app-root-size.md)
- [Dictionary normalized-block success](../../../tech-debt/2026-11-03-dictionary-normalized-block-success.md)
- [Workshop modal focus containment](../../../tech-debt/2026-11-03-workshop-modal-focus-containment.md)
- [Lightbox passages wall-clock test](../../../tech-debt/2026-11-03-lightbox-passages-wall-clock-test.md)
- [Markdown positive tabindex](../../../tech-debt/2026-11-04-markdown-positive-tabindex.md)
- [Read-in row identity](../../../tech-debt/2026-11-04-read-in-row-identity.md)
- [Thread divider accessible names](../../../tech-debt/2026-11-04-workshop-thread-divider-accessible-names.md)
