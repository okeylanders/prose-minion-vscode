# Everyday Conveniences: live pass

**Status:** Ready for Okey. Nothing here has been run.
**Branch:** `epic/everyday-conveniences-close` (the whole epic: E, C, D, A and B)
**Epic:** [README](README.md) · **ADR:** [2026-11-14](../../../docs/adr/2026-11-14-everyday-conveniences.md)

## Why this pass exists

No slice was run in the Extension Development Host, and no test made a
live model call. Each item below starts with what the automated tests
could **not** cover. Those steps matter most.

## Setup

1. `git fetch origin && git checkout epic/everyday-conveniences-close`
2. `npm install`, then F5 ("Run Extension").
3. Open a project with a few chapters and a character sheet configured
   (the examples say `alice-ch1.md`, `alice-ch2.md`, `white-rabbit.md`).
4. Keep **Output → Prose Minion** open. Several steps read it.

Tick a box when the result matches. Write what you saw beside any that
does not.

---

## A. Multi-file reads, fitted to the window (PR #263)

**Not covered by tests:** a real model following the grammar and the
continuation lines; how the card looks; a real small-context model; a
conversation that began before this build.

1. - [ ] In a **new** conversation, ask a persona to "read chapters 1, 2
   and 3 and compare how each opens."
   **Expect:** one capability card, summarized like
   `3 files: alice-ch1.md, alice-ch2.md, +1 more`, not three cards.
2. - [ ] Ask for a chapter and a character sheet together.
   **Expect:** one read across two groups (the `group` attribute).
3. - [ ] Ask for a file long enough to stop early (over 400 lines), beside
   two others.
   **Expect:** that file's section ends with a one-line continuation call.
   Does the persona send that call **alone** on its next step, or does it
   re-ask for all three?
4. - [ ] Open the card for step 3.
   **Expect:** each file is listed. How does the raw continuation line
   render on the card: readable, or a wall of XML? (Nobody has looked at
   the multi-file card; say if it needs work.)
5. - [ ] Switch to a small-context model and ask for six chapters.
   **Expect:** the read's first line says "This read was limited to …
   bytes, half the room left in your context window."
6. - [ ] Name one path that does not exist among two good ones.
   **Expect:** the card reads `partial`; the bad path is reported in its
   own section; the two good files are still read.
7. - [ ] On a small-context model, late in a long conversation, ask for
   ten files.
   **Expect:** a refusal that names the room it had and says to name
   fewer files. No "context window exceeded" from the provider.
8. - [ ] Make a file whose first line is over 64 KiB (one unbroken
   paragraph) and ask for it alone.
   **Expect:** `line-too-long`, no text delivered, and the persona says
   so instead of retrying the same call.
9. - [ ] Ask for that same file beside a small one.
   **Expect:** it **is** delivered (the two share 256 KiB). This is the
   D5 choice; see decision 4 below.
10. - [ ] Open a conversation saved **before** this build and ask it to
    read two files.
    **Expect:** it still works, one path a call (its instruction is
    frozen).
11. - [ ] Read the Output channel after step 1.
    **Expect:** `files=3; groups=…` with counts. No path on a multi-file
    line.

---

## B. Selected Text (PR #264)

**Not covered by tests:** `VsCodeEditorContext`'s real events were only
mocked. Whether VS Code keeps the selection readable once the Workshop
has focus is unknown until you try it.

1. - [ ] **One editor group.** Select five lines in a chapter. Click into
   the Workshop tab (it covers the editor). Turn on **Include selected
   text**.
   **Expect:** a "Selected Text" pill naming the file, lines and words.
2. - [ ] **Two groups.** Chapter on the left, Workshop on the right.
   Select, then click the composer.
   **Expect:** the pill stays. It does not clear when the Workshop takes
   focus.
3. - [ ] Right-click a selection → **Prose Minion**.
   **Expect:** "Send to New Workshop Excerpt", then "Add Selection to
   Workshop Message", in that order, above the Lightbox rows.
4. - [ ] Choose **Add Selection to Workshop Message**.
   **Expect:** a pill above the composer. The excerpt is unchanged.
5. - [ ] Run it again on the same selection.
   **Expect:** one notice: "That selection is already attached to the
   next Workshop message." Still one pill.
6. - [ ] With the toggle on, drag a selection slowly.
   **Expect:** the pill follows, and shows the final selection when you
   let go.
7. - [ ] Click once to deselect. Then select again and close the file.
   **Expect:** the pill clears both times.
8. - [ ] Send a message with the pill. Ask the persona to quote the
   selection back.
   **Expect:** the sent bubble shows the pill; the persona quotes exactly
   those lines, and knows they are not the excerpt.
9. - [ ] Select more than 5,000 words.
   **Expect:** the pill says "first 5,000 of N words" **before** you send.
10. - [ ] Stage seven attachments, then turn the toggle on with a
    selection.
    **Expect:** the live pill is drawn disabled, with the reason.
11. - [ ] Turn the toggle on. Run "Developer: Reload Webviews".
    **Expect:** the toggle is still on.
12. - [ ] Send a message with a pill, then Rewind to before it.
    **Expect:** the pill is restaged once, with the captured text.
13. - [ ] Export the transcript.
    **Expect:** the label "Selected Text" only. No text, path or lines.
14. - [ ] Hard to do by hand: with the live pill showing, press New (or
    Open, Rewind, Branch) and Send as close together as you can.
    **Expect:** if the send loses the race it is refused ("The selected
    text changed before this was sent…") and your draft is back in the
    composer. Never a message in the new room carrying the old selection.
15. - [ ] Read the Output channel.
    **Expect:** kinds, ids and word counts. No text, path or lines.

---

## C. Dictionary history search (PR #262)

**Not covered by tests:** how it looks in the narrow sidebar; real typing
speed; a real 500-entry history; the native search field's own clear
button.

1. - [ ] Open the history popup and type part of a word.
   **Expect:** rows filter as you type, hits are marked, and the line
   under the field reads like "12 of 500 match".
2. - [ ] Type a word from a lookup's context, then part of a file name.
   **Expect:** both find their rows.
3. - [ ] Look up an accented word (say "café"), then search "cafe".
   **Expect:** found.
4. - [ ] Tick **Also search definitions** and search a word that appears
   only inside a definition.
   **Expect:** the row shows a snippet with the hit marked. Check it in
   the narrow sidebar, in a light and a dark theme.
5. - [ ] Type fast, then untick the box mid-search.
   **Expect:** no stale definition rows appear afterwards.
6. - [ ] Keyboard only: `↓` into the rows, `↑` back to the field, Enter in
   the field, Escape twice.
   **Expect:** Enter opens the first match. The first Escape clears the
   query; the second closes the popup.
7. - [ ] Click the field's native clear (×), if your theme shows one.
   **Expect:** it clears once. No double action, and the popup stays open.
8. - [ ] With a large history (toward 500 entries), search definitions.
   **Expect:** no visible stall in the sidebar or the editor.
9. - [ ] While searching, press `‹` and `›`.
   **Expect:** they walk the **whole** history (decision 7 below).
10. - [ ] Read the Output channel.
    **Expect:** counts only. No query, word or snippet.

---

## D. Collapsible rail (PR #261)

**Not covered by tests:** real widths, real focus rings, a screen reader,
and Chromium 114 (VS Code 1.82), which was not exercised.

1. - [ ] At full width, collapse the Workshop's side pane, then expand it.
   **Expect:** an icon strip while collapsed; the thread takes the room.
2. - [ ] Collapse it. Have a persona add a to-do.
   **Expect:** the Notes icon shows a badge.
3. - [ ] Click the Notes icon.
   **Expect:** the rail opens on Notes, with focus on that tab.
4. - [ ] Start an inline edit in the rail (a to-do, say), collapse, expand.
   **Expect:** the edit is still there.
5. - [ ] Collapse, then "Developer: Reload Webviews".
   **Expect:** still collapsed.
6. - [ ] Open the Lightbox.
   **Expect:** no collapse control. Nothing about it changed.
7. - [ ] Narrow the Workshop tab under 900px.
   **Expect:** the rail starts collapsed.
8. - [ ] Open it there.
   **Expect:** it lays over the thread. Escape closes it.
9. - [ ] Widen the tab again.
   **Expect:** the rail is as you left it at full width, not as the
   overlay left it.
10. - [ ] Tab through the collapse control and the strip.
    **Expect:** a sensible order and a visible focus ring on each.
11. - [ ] Screen reader: the control says "Collapse side pane" / "Expand
    side pane" and its state; each strip icon has a name.

---

## E. Re-read in a new room (PR #260)

**Not covered by tests:** a real slow disk, and what the buttons look
like during the read.

1. - [ ] Pin a passage from a file. Press New, keeping the excerpt.
   **Expect:** "Re-read from file" shows before the first message.
2. - [ ] Edit and save the file. Press Re-read from file.
   **Expect:** the excerpt becomes vN+1, with a divider.
3. - [ ] Press it again without editing.
   **Expect:** "Excerpt unchanged on disk". Still the same version.
4. - [ ] New room again. Edit the file. Press **Continue**.
   **Expect:** the room opens on vN+1.
5. - [ ] New room. Do not edit. Press Continue.
   **Expect:** stays vN.
6. - [ ] Paste an excerpt by hand instead.
   **Expect:** no Re-read from file.
7. - [ ] New room, delete the file, press Continue.
   **Expect:** Continue on vN, with one line: "Continued with the passage
   as it was: its file could not be re-read."
8. - [ ] On a slow drive (network or cloud folder): press Continue, then
   Send at once.
   **Expect:** a busy refusal, or a closed composer. **Never** a reply
   about the old text.
9. - [ ] During that read, click Continue a second time.
   **Expect:** the busy refusal. The buttons stay clickable during the
   read. **Question for you:** should they be disabled instead?

---

## Decisions waiting on Okey

Work went ahead on each default. Say "keep" or what to change.

| # | Item | Default taken | The other choice |
|---|---|---|---|
| 1 | B | Several Selected Text pills in one message, by hand | One pill a message |
| 2 | B | A stale send is refused whole and the draft restored | Send without the selection, and say so |
| 3 | B | 5,000 words, cut at capture and said on the pill | Another bound, or refuse a large selection |
| 4 | A | A file's share in a multi-file read is not capped at 64 KiB (A step 9) | Cap each file at the one-file bound |
| 5 | A | `group` on a `<path>`: a chapter and a character sheet in one read | One group a read |
| 6 | A | 256 KiB shared before the fit; also the turn's total when the window is unknown | Another number |
| 7 | C | `‹` `›` walk the whole history while searching | Walk only the matches |
| 8 | C | Text only, no filter chips; the cap stays 500 | Chips; a larger cap |
| 9 | E | Continue always re-reads; no second button | A separate "Continue without re-reading" |
| 10 | E | Continue stays clickable during its read (E step 9) | Disable it |
| 11 | B | The kind is named `selected-text` (not `editor-selection`) | Internal only; no writer effect |
| 12 | B | Any text document; a selection inside the excerpt is sent as text | Prose files only; a pointer into the excerpt |
| 13 | B | Rewind restages the captured text; export shows the label only | Restage the live selection; export the lines |
| 14 | D | Only the Workshop's rail collapses | The Lightbox too |

Not built, still in the notes: the engine backstop and the `memory.read`
fit ([Reads That Fit the Window](../../features/feature-workshop-reads-fit-the-window/README.md));
whole-context search for the Dictionary history (today it searches the
140-character preview).
