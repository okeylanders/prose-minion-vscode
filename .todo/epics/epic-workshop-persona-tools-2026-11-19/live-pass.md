# Workshop Persona Tools: live pass

**Status:** Ready for Okey. Nothing here has been run.
**Candidate:** `epic/workshop-persona-tools` once PR #290 (C2) is merged: the whole epic (Slice 0, B, C1, A, C2). Record the SHA you test.
**Epic:** [README](README.md) · **ADR:** [2026-11-19](../../../docs/adr/2026-11-19-workshop-persona-tools.md)

## Why this pass exists

No slice was run in an Extension Development Host, with more than one
window, or with a real model. No test made a live model call. Every Astra
review (`docs/pr-reviews/pr-286` to `pr-289`, and #290's when it lands)
says it was a static review. Several things the slices rely on were
checked against VS Code's source **from memory**, not from a running
host; those are marked **Checked from memory** and matter most.

## Setup

1. `git fetch origin && git checkout --detach origin/epic/workshop-persona-tools`,
   then record `git rev-parse HEAD`. Note the installed version:
   `node -p "require('./apps/vscode-extension/package.json').version"`
   (*V*; 2.14.1 at `b9b8d302`).
2. `npm install` (the epic adds `diff` 9.0.0 to core), then F5.
3. Open a project that **is a git repository**, with a few chapters and
   notes configured as context, and a few commits touching one chapter
   (the examples say `Drafts/alice-ch1.md`). Give one commit a subject with
   a word like *Alice* in it, so you can see it come back.
4. Have **two saved sessions** with open to-dos (call them *Polish 1* and
   *Polish 2*), and an open room with a few open current-excerpt to-dos.
5. For C, a folder layout like `Cast/` (character notes), `Wonderland/`
   (places), `Drafts/` (chapters), with every `proseMinion.contextPaths.*`
   setting pointing somewhere that matches nothing. Note your user-level
   values first, so you can put them back.
6. Keep **Output → Prose Minion** open. No line may carry a to-do's text,
   a note, a session title, a commit id or subject, an author, a path, a
   folder name or a pattern. Counts, host ids and fault kinds only.
7. A second VS Code window on the **same** workspace for A2–A4 (F5 twice
   from two checkouts, or open the folder in a second Development Host
   window).

Tick a box when the result matches. Write what you saw beside any that
does not.

---

## A. Personas close to-dos (PR #289)

**Not covered by tests:** a real model writing the trailer; two real
windows; a real crash; the receipt and notices on screen.

### A1. The persona flow

1. - [ ] In the open room, finish a task with a persona and ask her to mark
   the matching to-do done.
   **Expect:** the snapshot frame now carries `Id:` lines; the reply ends
   with a `<prose-minion-todo-status>` trailer that is never shown; a
   receipt card under the reply reads "Marked 1 to-do: 1 done", with the
   to-do, the room's name and Undo. The to-do reads "Done · by *persona* in
   *room title*".
2. - [ ] Ask her to dismiss a to-do in *Polish 1* (she should call
   `transcript.todos` first and copy its ids).
   **Expect:** the row reads "Saving…" briefly, then applied. Open
   *Polish 1*: the to-do is dismissed, "Dismissed · by …", and *Polish 1*
   moved up the Sessions list (its `updatedAt` moved).
3. - [ ] A reply that is only status changes.
   **Expect:** the bubble reads "Updated to-dos."
4. - [ ] Undo each row (open room, then saved).
   **Expect:** each to-do reopens and loses its "by …" line; the row reads
   undone. Undo after you changed the to-do yourself says it changed since.
5. - [ ] Send the next message. In the persona's reply, or in the request
   (Output), the `<workshop-trailer-outcomes>` line counts the changes.
   An undone row is not told.
6. - [ ] Ask her to close a to-do id she never saw (make one up).
   **Expect:** dropped, no row; the next outcome line says the to-do
   wasn't found.
7. - [ ] Transcript export of the room: one line, "Marked 2 to-dos…", no
   to-do text, no session title.

### A2. Two windows (Checked from memory: no multi-window run)

1. - [ ] Open *Polish 1* in window 1 and window 2. Edit in window 1 and
   save; then edit in window 2 and save.
   **Expect:** window 2's save is refused in host words; its work is kept
   at once as "*Polish 1* (local recovery)" in Sessions (D6c), told once.
2. - [ ] While window 1 is saving a large session, save the same session
   from window 2 (or have a persona in window 2 write to it).
   **Expect:** window 2 reads "This saved session is being written by
   another window. Try again in a moment." The receipt row, if any, reads
   "Not saved: another window was writing the session." Nothing is lost.
3. - [ ] Rename and delete a saved session, from each window.
   **Expect:** both work as before the epic; the other window's list
   follows on refresh.

### A3. A lock left behind (Checked from memory)

1. - [ ] Leave a stale lock in `prose-minion/sessions/`: kill a window
   mid-save, or make `.<file>.json.lock/` by hand beside a session file,
   holding `owner-test.json` with `{ "token": "test", "at": 0 }`. A lock
   is stale once its `at` is older than 30 s (`STORED_FILE_CLAIM_LEASE_MS`).
   **Expect:** the Sessions browser row reads "Recovery required" with
   **Recover…**; opening or saving it shows the notice "This saved session
   was left mid-save, probably by a window that closed. Recover it to use
   it again." Nothing in the lock is touched until you press Recover….
2. - [ ] Press Recover….
   **Expect:** the confirm reads "Close any other Prose Minion window on
   this workspace first. Recovery puts the saved session back and keeps
   any unsaved work as a "(local recovery)" session." Confirm: the session
   opens; any differing staged copy is a "(local recovery)" session; the
   lock folder is gone.
3. - [ ] Press Recover… again after a failed recovery (make one copy
   unreadable, then fix it).
   **Expect:** the retry reuses its earlier copy; no duplicate
   "(local recovery)" session (copies are keyed by the lock's token).
4. - [ ] The notice does not overlap the toast, in a narrow window too.

### A4. Quit mid-save (Checked from memory)

1. - [ ] Have the persona close a saved session's to-do and quit VS Code
   while the row reads "Saving…". Reopen.
   **Expect:** the row settles read-only: applied (with Undo) if the file
   carries the stamp, "Not written: Prose Minion closed before this was
   saved." if it doesn't, or "not yet confirmed" if the file can't be read
   yet. It is never written twice.
2. - [ ] Hold *Polish 1* busy from window 2 while window 1 reloads with a
   `saving` row for it.
   **Expect:** unverified, Undo disabled; once window 2 lets go, the row
   becomes applied and Undo works.
3. - [ ] Output for all of A: ids, counts, states and reasons; never a
   to-do, note or title, and never a session file name.

## B. A file's git history (PR #287)

**Not covered by tests:** the real Git extension. **Checked from
memory:** that the Git API at the 1.82 floor offers `buffer`,
`getObjectDetails` and `Repository.rootUri`, and that `log({ path })`
forwards a `:(literal)` pathspec unchanged.

1. - [ ] Ask a persona what changed in `Drafts/alice-ch1.md` over its last
   few commits.
   **Expect:** a `history.log` card listing commits newest first (10-character
   id, date, author, subject), then a `history.diff` card. The manifest
   gains a "File history" row naming the file and two commits.
2. - [ ] `history.diff` to `current` with unsaved edits in the editor.
   **Expect:** "current (the file as saved on disk; unsaved changes in the
   editor are not included)".
3. - [ ] Read the diff marks as the persona sees them (the card's body):
   "Change 3 · ¶ 12 (was ¶ 11), changed: …" with `~~…~~` for removed and
   `**…**` for added words. Do they read naturally to the persona? Ask her
   to summarize one change.
4. - [ ] A file with more than 20 commits.
   **Expect:** the page ends "More commits follow. The next page: …" with
   no count, and the persona's next call (which carries full commit ids)
   works.
5. - [ ] A file name with `*`, `[` or a leading `:` (e.g. `Drafts/[draft] alice.md`).
   **Expect:** only that file's commits, never another file's (the
   literal pathspec).
6. - [ ] On macOS or Linux, a file whose name holds a backslash.
   **Expect:** "This file's name can't be looked up in git history."
   (`unaddressable`), before any git call.
7. - [ ] Diff from a commit before the file existed.
   **Expect:** that side reads "…, where the file did not exist". This
   relies on Git's error wording matching `Path not known by git` (or
   "does not exist in" / "exists on disk, but not in"): **checked from
   memory.** If the card says "Git couldn't read this file's history just
   now", the wording differs; note git's version.
8. - [ ] A non-UTF-8 file in history (save a Latin-1 version and commit).
   **Expect:** the diff is refused in words, not shown as a whole-file
   change.
9. - [ ] Turn off `git.enabled` and ask again; then reload and ask while
   Git is still starting.
   **Expect:** "Git is turned off in VS Code (the git.enabled setting), so
   no file history can be read." and "Git hasn't finished starting in VS
   Code yet. Try again in a moment." (after up to 5 s).
10. - [ ] A project folder that isn't a repository.
    **Expect:** "This file isn't in a git repository, so it has no history
    to read."
11. - [ ] A real model makes a **native** call to `history.diff` (a Claude
    model with web research on).
    **Expect:** it is translated to XML and runs like a typed call.
12. - [ ] Output: operation, counts and closed outcomes; never an id,
    subject, author, path or diff text.

## C1. Context paths from Settings (PR #288)

**Not covered by tests:** the sheet on screen; a real helper call; a
real workspace-level setting.

1. - [ ] Settings → context paths, with every group matching nothing.
   **Expect:** the line "None of these paths finds a file in this project
   yet. Suggest from my folders can propose some from your folder names."
   above the button. Does it read as intended?
2. - [ ] Press **Suggest from my folders** (one paid helper call).
   **Expect:** a sheet per group: current and proposed patterns, counts,
   up to 3 examples, a ticked checkbox where something was kept, files
   shared with another group flagged on both, and "Applies to all your
   projects."
3. - [ ] Check the sheet's layout and wording in the sidebar, in a **light**
   and a **dark** theme.
4. - [ ] Apply.
   **Expect:** only ticked groups are written, at user level
   (`settings.json`, not the workspace's); the textareas refresh at once.
5. - [ ] Set one group in `.vscode/settings.json`, then suggest again.
   **Expect:** that row reads "Set for this workspace in its settings
   file, so Apply can't change it here." with its checkbox off and
   **disabled**.
6. - [ ] Edit a group's setting by hand after the sheet appeared, then
   Apply.
   **Expect:** that group is left, "changed since this was suggested".
7. - [ ] A project with no Markdown or text files; one too large for the
   scan.
   **Expect:** "no folders", and for the large one, the scan-incomplete
   words, never "none".
8. - [ ] Output: counts and outcomes; never a folder, file name, path or
   pattern.
9. - [ ] Put your user-level context paths back.

## C2. A persona sets up context paths (PR #290)

**Not covered by tests:** the whole persona flow with a real model.

1. - [ ] Ask a persona to set up the project's context paths.
   **Expect:** she calls `locations.current`, then `locations.folders`
   (paged if needed), then `locations.check` with candidate patterns, and
   ends her reply with a proposal. None of these cards is shared with the
   room's other participants, and none adds a manifest row.
2. - [ ] The card under her reply.
   **Expect:** the same per-group rows as the Settings sheet (they share
   `ContextPathGroupRow`), ticked where kept, a workspace-set group
   disabled, "Applies to all your projects."
3. - [ ] Apply.
   **Expect:** user settings change for the ticked groups only; the card
   reads applied, left (with why) or declined per group.
4. - [ ] On a second proposal, Decline.
   **Expect:** nothing is written.
5. - [ ] Send the next message.
   **Expect:** the persona's outcome line reports the proposal (card shown,
   patterns kept / unmatched / incomplete / refused). Apply and Decline are
   never told.
6. - [ ] A proposal every pattern of which matches nothing.
   **Expect:** no card; the next outcome line says nothing was kept.
7. - [ ] The card's look in the Workshop, light and dark: it reuses the
   Settings sheet's styles.
8. - [ ] Rewind past the reply, then Branch from before it.
   **Expect:** the card goes with the reply; nothing is re-applied.
9. - [ ] Transcript export: "Proposed context paths for *n* groups", no
   pattern or path.
10. - [ ] Output: counts and reasons; never a pattern, path or folder name.

---

## Open decisions for Okey

Each was taken for you so work could proceed, and each is yours to
overturn. Rows refer to the README's "Defaults taken".

1. **Q1. A saved row still `saving` when the next message is built** is
   told as "being saved" (row 9). The alternative waits for it.
2. **Q2. Rewind past a receipt keeps the to-dos closed** (row 10). The
   alternative reopens the open room's to-dos the reply closed.
3. **Q3. `history.log` does not follow renames** (row 22). Following needs
   `git log --follow`, which the Git extension's API does not offer.
4. **Q4. A group the workspace sets is shown, not offered** (row 38). The
   alternative is the workspace-level write L1 defers.
5. **A: an unknown session id now answers "not found, try again"**
   (row 55). Reading or deleting a session this window has never seen,
   with no lock present, says "This saved session wasn't found. If another
   window is saving it, try again in a moment." rather than a plain
   not-found, so it can never detach a room. Keep the wording?
6. **A: an unreadable recovery copy blocks Recover…** (row 56; PR #289
   deviation 3). Recovery stops at that copy's read and leaves the lock
   "Recovery required", which is safe for the data but has no in-app way
   out. Add one (e.g. "Recover and set the unreadable copy aside"), or
   keep?
7. **B: "More commits follow" carries no count** (row 61). Fine, or fetch
   further to count?
8. **B: textconv may run inside `show`** (row 23; the adapter's comment
   now confirms `buffer` reads with `--textconv`). Workspace trust covers
   it; confirm you are content with that boundary.
9. **C1: Apply leaves a group if any kept pattern now matches nothing**
   (`matches-changed`, row 64), stricter than the ADR. Keep?
10. **C2: the prompt sits between help and history** in the persona chain
    (row 69), because the history and lens sync tests pin those two to the
    end. Only matters if the persona seems to favor one family's grammar.
