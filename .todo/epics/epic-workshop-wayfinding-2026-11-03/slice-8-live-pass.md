# Slice 8: Verify Live

**Epic:** [Workshop Wayfinding](README.md)
**Decision:** [ADR 2026-11-03](../../../docs/adr/2026-11-03-workshop-wayfinding.md), all decisions
**Status:** Waiting on Okey. Slices 1–7 are merged into the epic (last merge `6c12df5`). This slice needs a human with VS Code.

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

Each item names the slice that left it for this pass. Tick it, or file what
you find as `.todo/tech-debt/` and link it here.

### Rail tabs (Slice 1)

- [ ] The rail shows **Material** and **Notes** tabs, and the Tools block is
      gone. No tab switches by itself, whatever arrives.
- [ ] A to-do the host adds while Notes is hidden badges Notes. Opening Notes
      clears it.
- [ ] A half-typed to-do edit survives switching tabs and back.

### Read in and the reader (Slices 2 and 3)

- [ ] Ask a persona to read a file. Its row appears under **Read in**, named
      for that persona. If Material is hidden, the row badges it.
- [ ] Opening the row shows the reader sheet. **Open beside** opens that file
      in the editor column beside the Workshop, and nothing else.
- [ ] While the sheet is open, Tab stays inside it. Note what Tab past the last
      control does: it may reach VS Code's own chrome, as a native modal's
      does. Escape returns focus to the row.
- [ ] A ranged read opens on **Source** at the first line read, scrolled
      there, with the band and the "End of … read · line N" marker.
- [ ] Edit the file, then open the row again. The amber "changed since" banner
      shows.
- [ ] **Show where it was read** closes the sheet, scrolls to the card, and
      leaves focus on the card.

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
- [ ] With an auto-router model, a reply served by another model shows
      "served by …" under its body. The participant label's tooltip names
      both ids.
- [ ] Export (Markdown, HTML, JSON) shows the same slices as the thread, and
      JSON turns carry `model`.
- [ ] A session saved before this epic opens unchanged and shows no slices.

## Decisions for Okey

Each one has a default already built, and each is a small change.

- [ ] **The dictionary slice's wording.** It reads "Dictionary model · …"
      (Slice 7), so a lookup's model change doesn't read as the room's. Keep
      it, or use the plain "Model · …"?
- [ ] **The served-by note in export.** It is thread-only today; Markdown and
      HTML don't print it, and JSON carries the ids (Slice 7). Should Markdown
      and HTML print it too?
- [ ] **Tool-run requests aren't bookmarkable.** The tool report that answers
      one is (Slice 4). Keep that, or allow the request too?
- [ ] **Escape on a pending rename.** It cancels the field and drops the late
      answer; the host may still have kept the name (Slice 5). Keep that, or
      have Escape do nothing until the answer comes back?
- [ ] **Bring `main` into the epic.** Do it before this pass (one merge PR), or
      in the epic's final PR? The default is the final PR.

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
   must say what D9 accepted: **builds up to v2.12 won't open a session this
   build saves.** Model stamps land on every new reply.

## Open tech debt from this epic

- [Session codec downgrade tolerance](../../tech-debt/2026-11-03-workshop-session-codec-downgrade-tolerance.md) (D9)
- [Workshop app root size](../../tech-debt/2026-11-03-workshop-app-root-size.md)
- [Dictionary normalized-block success](../../tech-debt/2026-11-03-dictionary-normalized-block-success.md)
- [Workshop modal focus containment](../../tech-debt/2026-11-03-workshop-modal-focus-containment.md)
- [Lightbox passages wall-clock test](../../tech-debt/2026-11-03-lightbox-passages-wall-clock-test.md)
- [Markdown positive tabindex](../../tech-debt/2026-11-04-markdown-positive-tabindex.md)
- [Read-in row identity](../../tech-debt/2026-11-04-read-in-row-identity.md)
- [Thread divider accessible names](../../tech-debt/2026-11-04-workshop-thread-divider-accessible-names.md)
