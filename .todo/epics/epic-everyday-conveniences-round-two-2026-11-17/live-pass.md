# Everyday Conveniences, Round Two: live pass

**Status:** Ready for Okey. Nothing here has been run.
**Branch:** `epic/everyday-conveniences-round-two-close` (the whole epic: A1, A2, A3, B, C, D, E, F, G, H, H+)
**Epic:** [README](README.md) · **ADR:** [2026-11-17](../../../docs/adr/2026-11-17-everyday-conveniences-round-two.md)

## Why this pass exists

No slice was run in an Extension Development Host with a real model, and
no test made a live model call. Every review (`docs/pr-reviews/pr-268` to
`pr-281`) says so. Each item starts with what the automated tests could
**not** cover; those steps matter most.

## Setup

1. `git fetch origin && git checkout epic/everyday-conveniences-round-two-close`
2. `npm install`, then F5 ("Run Extension").
3. Open a project with a few chapters and notes configured as context
   (the examples say `alice-ch1.md` … `alice-ch3.md`, `white-rabbit.md`, and
   two files named `notes.md` in `characters/` and `locations/`).
4. Set `proseMinion.workshop.projectMemory` to `ask` (items B, C, D).
   Keep `proseMinion.workshop.fileEdits` at `ask` (item D).
5. Keep **Output → Prose Minion** open. Several steps read it; none of its
   lines should ever carry your text, a note's text, a lens's text, a path
   in a persona's read, or a query.
6. For A, have a saved session with **at least 600 turns** (Okey's long
   room is 273; a 600-turn room is easiest made by script). A3's past-cap
   case needs a target 400 turns before a 200-turn window, so 600 is the
   least that works. Note its turn count: `N`. Save it under a name you can
   reopen (A3 reopens it between cases).

Tick a box when the result matches. Write what you saw beside any that
does not.

---

## A, part 1. The notice at the top (PR #268)

**Not covered by tests:** how it reads in a real thread.

1. - [ ] Open a room with more than 200 turns.
   **Expect:** above the first bubble, "`N − 200` earlier turns aren't
   shown here. They're kept in full: export, bookmarks and the personas
   still have them." No "coming soon"; nothing below the newest bubble.

## A, part 2. Show earlier turns (PR #273)

**Not covered by tests:** real scrolling, a real 1 MiB page, a screen
reader. Bounds: `PROMPT_BUDGETS.workshopThread.pageTurns` (100) and
`pageBytes` (1 MiB); the window is `WORKSHOP_SNAPSHOT_TURN_WINDOW` (200).

1. - [ ] At the top: "Show earlier turns (`N − 200` not shown)". Press it.
   **Expect:** while waiting it reads "Loading earlier turns…" and is
   `aria-disabled`; then up to 100 turns appear above, and the bubble that
   was at the top of the view stays where it was (no jump).
2. - [ ] Screen reader (or the live region in DevTools): one announcement,
   "100 earlier turns shown." Not one per bubble.
3. - [ ] Press until the room's first turn shows.
   **Expect:** the control and the notice go at the first turn.
4. - [ ] On a loaded (earlier) bubble: Copy, Bookmark, Save to memory, a
   reaction, Rewind and Branch.
   **Expect:** each works as in the window. Rewind and Branch are offered
   exactly where they would be in the window. Write down any that is
   missing or refused.
5. - [ ] With pages loaded, send a message.
   **Expect:** the loaded turns stay on screen while the host re-reads
   them (ADR D5, Q7). Output shows the page reads, counts only. Does the
   re-read feel heavy on a 500-turn run (five page reads per state)?
6. - [ ] With pages loaded, choose New, then Open the same session again.
   **Expect:** the loaded pages are gone; the window shows alone.
7. - [ ] Reload the window (Developer: Reload Window).
   **Expect:** the window shows again; nothing loaded was kept.

## A3. Bookmark jump (PR #281)

**Not covered by tests:** the real scroll and focus, a real page of mixed
sizes, a screen reader hearing a refusal.

**The numbers.** The window is `WORKSHOP_SNAPSHOT_TURN_WINDOW` (200, in
`WorkshopSessionService.ts`). A page is `PROMPT_BUDGETS.workshopThread.pageTurns`
(100) turns or `pageBytes` (1 MiB), whichever comes first. A jump loads at
most `jumpPages` (3) pages: the host refuses a target more than
`jumpPages × pageTurns` (300, `WORKSHOP_JUMP_TURNS`) turns before the
**oldest turn the thread holds**, and the webview stops after 3 pages.

**Cold, then warm.** The distance is counted from the oldest turn held,
and a held turn lands with no request. So every case marked **cold**
starts from a cold thread: Open the saved session again (Sessions → Open),
which drops every loaded page, and check the top of the thread shows the
hidden-turns notice with `N − 200` before you begin. Only the case marked
**warm** keeps pages on purpose.

In the ≥600-turn room, with the window holding the newest 200 turns, make
five bookmarks: **W** in the window; **B50**, about 50 turns before the
window's first turn; **B250**, about 250 before it; **B280**, about 280
before it; **B400**, about 400 before it. Save the session.

1. - [ ] **In window (cold).** Open W from the Notes rail.
   **Expect:** scrolls to and focuses its bubble at once, as before.
2. - [ ] **Within one page (cold).** Reopen the session. B50's row is
   marked "earlier in thread" and named "…: show it in the thread". Open
   it.
   **Expect:** the row reads "loading earlier turns…" (busy, disabled),
   then the thread scrolls to and focuses B50. One announcement: "`n`
   earlier turns shown. Showing bookmark: `label`."
3. - [ ] **Within 3 pages (cold).** Reopen the session. Open B250.
   **Expect:** up to 3 pages load, then it lands as in step 2. A second
   press on the row while it loads does nothing.
4. - [ ] **Already loaded (warm).** Straight after step 3, without
   reopening, open B50.
   **Expect:** lands at once, with no "loading" state and no new page read
   in Output.
5. - [ ] **Past the cap (cold).** Reopen the session. Open B400.
   **Expect:** no page loads; the reader (the read-only preview) opens for
   that turn; the announcement is the reason ("The turn is too far back to
   load into the thread, so the reader shows it instead."). Does a screen
   reader hear the reason before the sheet takes focus? (Open question 13.)
   If any page had been loaded first, B400 might lie within 300 of the
   oldest held turn and land instead: that is why this case is cold.
6. - [ ] **Cancel by choosing another bookmark (cold).** Reopen the
   session. Open B280, and **only while its row still reads "loading
   earlier turns…"**, open W.
   **Expect:** focus goes to W and stays there; a late page does not pull
   it back, and no reader opens. Pages already shown stay. If the row never
   shows "loading" long enough to press W (pages come back too fast), say
   so: the case was not exercised. A fixture whose earlier turns are long
   (near the 1 MiB page bound) slows each page.
7. - [ ] **Escape (cold).** Reopen the session. Open B280 and, while its
   row reads "loading earlier turns…", press Escape on it.
   **Expect:** the walk stops before B280; the pages already shown stay;
   no scroll, no reader.
8. - [ ] **Other moves supersede it (cold).** Reopen the session. Open
   B280 and, while it is loading, use a to-do's source, a Read in card, or
   an edit offer's link.
   **Expect:** the newer move wins; the jump never takes focus back.
9. - [ ] **Bookmarks screen (cold).** Reopen the session. In Bookmarks,
   press Show in thread on B250, then (reopen again) on B400.
   **Expect:** the screen closes, then the walk runs and lands on B250;
   for B400 the reader opens.
10. - [ ] **New room (cold).** Reopen the session. Open B280 and, while it
    is loading, choose New.
    **Expect:** nothing settles; no scroll, no reader.
11. - [ ] **Re-read first (warm).** Reopen the session, press "Show earlier
    turns" once (one page held), then send a message and at once open B250.
    **Expect:** the re-read finishes, then the jump runs from the run it
    read and lands. (It restarts with a fresh 3-page allowance: open
    question 14.)
12. - [ ] Output after the steps above: ids, counts and refusal reasons
    only, never a label or a turn's text.

---

## B. How readily personas suggest notes (PR #272)

**Not covered by tests:** whether a real model's suggestion count moves
with the level. This is the item's evidence, which the review could not
give (`pr-272` review, "Limits").

Bounds that hold at every level: `PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply`
(10; frames past it are dropped as `over-cap`) and `autoSavesPerRoom` (5).
Prompt anchors: Sparingly "Most replies suggest none."
(`project-memory-proposals.md`, unedited); Readily "about one reply in
three suggests a note." (`memory-suggestions/readily.md`); Aggressively
"most replies suggest at least one note" (`memory-suggestions/aggressively.md`).

Use one fixture conversation: the same excerpt, the same persona, the same
expression level, and the same eight writer messages (for example: settle
a character's eye colour, state a style preference, leave a question open,
float an idea, ask a craft question, two small talk turns, ask for notes
explicitly). Start a **new** conversation for each level.

| Level | Replies with ≥ 1 suggestion (of 8) | Total suggestions | Most in one reply | Any `over-cap` in D's line? |
|---|---|---|---|---|
| Sparingly | | | | |
| Readily | | | | |
| Aggressively | | | | |

1. - [ ] Conversation settings → Memory: "Suggest notes" shows Sparingly,
   Readily, Aggressively. Picking one saves at once (no Apply), and the
   selected card moves when the host answers. (Open question 8.)
2. - [ ] Under it: "With Save and tell me, at most 5 notes are saved in one
   conversation; the rest wait as cards."
3. - [ ] Run the fixture at each level and fill the table.
   **Expect:** Sparingly ≤ Readily ≤ Aggressively. Sparingly should look
   like the build before this epic.
4. - [ ] **Mid-room change.** In the Readily conversation, switch to
   Aggressively and send two more messages.
   **Expect:** the change applies from the next turn (one prompt-cache
   miss), with no rebuild error.
5. - [ ] **Auto mode.** Set the memory mode to `auto` and run Aggressively.
   **Expect:** at most 5 notes saved in the conversation; the rest wait as
   held cards.
6. - [ ] **Off stays off.** Set memory to `off`.
   **Expect:** no suggestions at any level.
7. - [ ] **Reset for C and D.** B5 and B6 changed settings that persist
   across conversations and windows. Set `proseMinion.workshop.projectMemory`
   back to `ask` (the Memory tab's "Ask first" card, applied) and "Suggest
   notes" back to Sparingly. Then start a **new** conversation for C: a
   conversation built while memory was off has no memory frame, and the
   frame is built once per conversation.
   **Expect:** the Memory tab shows `ask` and Sparingly before you go on.
   (Or run C and D in a separate VS Code profile whose memory mode was
   never changed.)

## C. Every memory's title (PR #274)

**Before you start:** memory is `ask` (B7). Each C and D step that says
"new conversation" starts one; the rest continue the current one.

**Not covered by tests:** a persona actually using a title to decide to
read a note; the meters against a real model's tokenizer.

Sizes (`PROMPT_BUDGETS.workshopProjectMemory.listSizes`): Standard 2,000 /
40 / 2,000 titles; Larger 5,000 / 100 / 3,000; Largest 10,000 / 200 /
4,000. Loaded in full is 5,000 at every size. A catalog page is 40 notes.

Make a project with about 120 notes in effect (script them), a few
superseded or archived, and one note whose title alone names something
the writer will ask about ("The Hatter might know the Rabbit").

1. - [ ] Memory tab: a row "List at the start of each conversation"
   (Standard, Larger, Largest, each with its token sizes), "Applies from
   the next conversation.", and three meters including "Titles only".
2. - [ ] **Standard.** New conversation; ask about the Hatter and the
   Rabbit.
   **Expect:** the persona reads that note (a `memory.read` card) because
   its title was listed, not by search. Did it?
3. - [ ] Ask the persona to list every note it can.
   **Expect:** `memory.catalog` pages: "Notes 1–40 of 120 in effect", a
   next call naming page 2, … page 3 writes none. Did it follow each hint
   exactly?
4. - [ ] Ask for a page past the end (say page 9).
   **Expect:** words, not a refusal: "Page 9 is past the end: … 3 pages."
5. - [ ] **Larger, then Largest.** Change the size mid-conversation.
   **Expect:** this conversation's list does not change; a new
   conversation's does. The meters match what the frame held (the tab and
   the frame read the same budgets).
6. - [ ] With Largest on a small-context model: does the first message
   (up to 19,000 tokens of memory) cause trouble? (Open question 2.)
7. - [ ] The "searchable only" line counts notes no tier shows.

## D. What became of its notes (PR #276)

**Not covered by tests:** a real model reading the frame and acting on it
without repeating itself.

The frame is `<workshop-trailer-outcomes>`, one phrase per reason
(`shared/constants/workshopTrailerOutcomeWords.ts`).

1. - [ ] Ask a persona to suggest a note and an edit to an existing note
   whose find text is not in that note.
   **Expect (next message):** "Your last reply's notes: 1 shown as a card,
   1 dropped (its find text is not in the note)." The persona does not
   claim the edit landed.
2. - [ ] Ask for 12 notes in one reply.
   **Expect:** "… 10 shown as cards, 2 dropped (past the number one reply
   may carry)."
3. - [ ] With file edits on, ask for an edit to a prose chapter that
   rewrites it.
   **Expect:** "Your last reply's file edits: … refused before the writer
   could apply it." No reason given (open question 5).
4. - [ ] Send a second message.
   **Expect:** the line is not repeated.
5. - [ ] **Tool run.** Right after a reply with outcomes, run a writing
   tool.
   **Expect:** the synthesis request carries the line (default 45); the
   writer's next message does not repeat it.
6. - [ ] **Rewind** to before the message that carried the line, then send.
   **Expect:** the line goes out again.
7. - [ ] **Guest.** Invite a guest; only its own outcomes reach it.
8. - [ ] **Lost conversation** (switch the model so the provider
   conversation restarts, or reopen a session whose conversation is gone).
   **Expect:** the fresh conversation's first message carries the line in
   the same words. Does "Your last reply" read oddly to a model that cannot
   see that reply? (Open question 10.)
9. - [ ] Output: counts and reason ids; a memory edit's target id only in
   its existing "Memory edit dropped" line.

## E. Lexical Gravity JSON (PR #270)

**Not covered by tests:** a live model's slips.

1. - [ ] Build lenses for several subjects with the widget model (try a
   cheap model; it slips more).
   **Expect:** builds succeed. Output shows "Lens reply JSON repaired: …"
   by repair kind only, for example `early-closed-attention` with "(1
   attention object(s) closed again)".
2. - [ ] When one candidate is invalid: the two good lenses are offered
   with "1 of 3 lenses couldn't be used." Output: "Lens reply held 3
   lens(es) for an ask of 3; kept 2 (invalid 1, …)".
3. - [ ] Run a preview on each lens.
   **Expect:** previews work; a repaired preview logs "Preview reply JSON
   repaired: …".
4. - [ ] Note it if Output ever prints "Rejected lens response body BEGIN"
   or "Rejected preview response body BEGIN": that block holds the reply's
   text (tech debt
   [2026-11-18-lexical-gravity-logs-rejected-reply-text](../../tech-debt/2026-11-18-lexical-gravity-logs-rejected-reply-text.md)).

## F. Lens reads (PR #277)

**Not covered by tests:** a persona choosing to look, following the
section call, and naming a lens in prose.

1. - [ ] Save two project lenses (Alice-style subjects). Ask: "What lenses
   have I built?"
   **Expect:** one `lens.catalog` card (private to that persona): project
   lenses first, then the built-ins, the installed lens marked.
2. - [ ] Ask about one lens's clichés and substitutions.
   **Expect:** a `lens.read` with `<section>cliches</section>` and
   `<section>substitutions</section>`, not the whole lens.
3. - [ ] On a small-context model, late in a long room, ask for a whole
   lens.
   **Expect:** "This read was limited to `k` of 7 sections" and a call
   naming fewer sections. Does the persona send it? The card reads success,
   not partial (open question 12).
4. - [ ] Ask the persona to recommend one of your lenses.
   **Expect:** it names it in prose; no recommendation chip for a project
   lens (built-in starters only).
5. - [ ] Make one lens file unreadable (break its JSON).
   **Expect:** "… lens file(s) couldn't be read", counted; no file name in
   the card or Output.
6. - [ ] A guest can do the same; a writing tool's sidecar cannot.

## G. `@` in the composer (PR #271)

**Not covered by tests:** real layout and widths, a real IME, a screen
reader, how a persona reads a token.

1. - [ ] Type `@` in the composer.
   **Expect:** a list above the composer, as wide as it is, under
   **Files**, grouped by context group, then **Browse project…**. The
   screen reader hears the count ("6 files").
2. - [ ] Type `rab`, ↓, Enter.
   **Expect:** `@white-rabbit.md` in the text and a pill above the
   composer. Tab picks the same way; Escape closes and keeps the text.
3. - [ ] With nothing matching, Enter sends as always.
4. - [ ] Type `@notes`.
   **Expect:** two rows; picking gives `@characters/notes.md` and
   `@locations/notes.md`. Each pill is still labelled `notes.md` (open
   question 11). Ask the persona which file is which: does it tell them
   apart?
5. - [ ] Delete a token: the pill stays. Remove a pill: the text stays.
6. - [ ] Pick a file already staged: the token is written, nothing is
   staged twice.
7. - [ ] **Send waits for a pick.** Pick a large file and press Enter
   at once.
   **Expect:** "Attaching the picked file before sending…", then the
   message goes with the file. With a file that cannot be read, the send
   is refused whole and the draft comes back. (The wait is
   `WORKSHOP_MESSAGE_ATTACHMENT_READ_WAIT_MS`, 10 s.)
8. - [ ] Japanese or another IME: nothing picks or sends during
   composition.
9. - [ ] Browse project… opens today's picker in message mode.

## H and H+. The Prose Minion reference (PRs #279, #280)

**Not covered by tests:** whether the prose is right (the sync tests only
catch a missing command, setting or tab), and a persona answering from it.

1. - [ ] Ask the host: "How do I pin a file?"
   **Expect:** a `help.search` card, then `help.read` of
   `workshop#pinned-context`, and an answer that names that section.
2. - [ ] Ask three more how-to questions, one per area you know well
   (Lightbox, Draft Edit, a sidebar tool). For each, note whether the
   answer was **right**, and whether the section it named says so.
3. - [ ] Ask about something the reference does not cover.
   **Expect:** the persona says the reference does not cover it; it does
   not invent a control.
4. - [ ] Ask a craft question.
   **Expect:** no help call.
5. - [ ] **9+ terms.** Ask the persona to search with a nine-word query
   (or more; the limit is `WORKSHOP_QUERY_TERMS`, 8).
   **Expect:** "Not searched, past the 8-term limit: `word`. Ask with fewer
   words." The ignored word changes neither the hits nor their order.
6. - [ ] **Version caveat.** Edit `packages/core/resources/help/overview.md`'s
   "Reference version: 2.14.0" to `2.13.0` (revert afterwards; the sync
   test fails while it is changed), rebuild, ask a help question.
   **Expect:** it still loads. The first line: "Prose Minion reference,
   version 2.13.0. The installed version is 2.14.0; these versions differ,
   so features or controls may not match." Output logs the mismatch once,
   versions only. A malformed or over-limit help call names 2.13.0 too.
7. - [ ] **Retry.** `WorkshopHelpReference` keeps a successful load for
   the reader's whole life (the Development Host session), so a reader that
   has already answered a help call never reads the files again; renaming
   the folder under it changes nothing. This case needs a **fresh reader to
   fail first**, then the **same reader to recover**:
   1. **Reset before.** Undo H6: put "Reference version: 2.14.0" back in
      `packages/core/resources/help/overview.md`, then `npm run build` so
      the staged copy (`apps/vscode-extension/resources/help`) is the
      bundled one again. Stop `npm run watch` if it is running: a rebuild
      re-stages the folder.
   2. Close the Extension Development Host and start a **new** one (F5).
      Make no help call yet.
   3. Rename `apps/vscode-extension/resources/help` (for example to
      `help.off`). Then, in a Workshop room, ask a "how do I…" question.
      **Expect:** the help card says "The Prose Minion reference for
      version 2.14.0 is unavailable. Tell the writer you cannot check
      it.", the persona says it cannot check, and Output logs
      "[WorkshopHelpReference] reference unavailable" once.
   4. **Preserve during.** Rename the folder back to `help`. Do **not**
      restart or reload the Development Host. Ask again.
      **Expect:** the same reader reads it now (a failed load is never
      kept) and answers from a section. Output logs no second
      "unavailable".
8. - [ ] A limited help read (small-context model, three sections):
   "This read was limited to the first `k` of 3 sections." and a call for
   the rest. The card reads success (open question 12).
9. - [ ] Output: operation, counts and section ids; never the query.

---

## Open decisions for Okey

Each was taken for you so work could proceed, and each is yours to
overturn. The ADR's open questions are in its "Open questions" section;
the rest are in the README's "Defaults taken" or the PRs.

1. **Q1. The memory list's entry cap per size** (default 40 / 100 / 200;
   README row 30). The strict reading keeps 40 everywhere.
2. **Q2. Largest costs up to 19,000 tokens** a conversation, with no
   warning (row 13).
3. **Q3. `lens.read` by section** (row 41), or whole-or-refuse.
4. **Q4. Lens and help reads stay private** in v1 (row 42).
5. **Q5. A refused file-edit card's reason** is not told to the persona,
   only the count (row 36).
6. **Q6. Every command and setting owned by a hand-written help section**
   (row 44), not only a generated table row.
7. **Q7. Earlier turns re-read after every state change** (row 38), or
   loaded once and marked "as of when loaded".
8. **B: "Suggest notes" saves at once,** unlike the mode cards beside it,
   which are a draft applied with the other tabs. The list-size row does
   the same. Keep, or make both drafts?
9. **D, default 45** (taken as your decision of 2026-11-17): the tool
   run's synthesis request carries the line. Listed only so you can
   confirm it reads right in step D5.
10. **D, default 46: a lost conversation.** The fresh conversation's first
    message carries the line in the same words, though it cannot see "your
    last reply". A different frame `note` there was proposed, not taken.
11. **G: duplicate-basename tokens.** Two `notes.md` get
    `@characters/notes.md` and `@locations/notes.md`, but each pill (and
    its attachment frame) is labelled by its base name, `notes.md`
    (`readAndStageMessageResources`, `label: baseName(item.path)`). The
    feature note asked for the frame label to match the token. Keep, or
    label a pill by its token when its base name is shared?
12. **Help and lens limited reads are `success`, not `partial`.** A
    `resource.read` that leaves something out reads `partial`. Should a
    help or lens read the window limited read `partial` too?
13. **#281: should the reader sheet carry a refused jump's reason?** The
    reason is announced in the thread's live region, and the sheet makes
    the thread inert right after, so some screen readers may miss it; the
    sheet still says "Outside the loaded window".
14. **#281: a re-read restarts a waiting jump with a fresh 3-page
    allowance.** Fine, or should the allowance count pages already walked?
15. **H: `help.search` puts an exact heading match first.** A section
    whose heading is the query ranks first, so every section is reachable
    by its own heading (ADR D22; recorded in PR #269). The rule came from
    the build agent, and PR #279 left it "awaiting Okey's confirmation".
    Keep, or rank by the term rules alone?
