# Slice 5: Verify live

**Status:** Ready for Okey once Slice 4c merges. Slice 4c carries his 2026-11-06 answers below.
**Covers:** the Extension Development Host pass for the whole epic: a persona proposes (D2, D4), the class decides the rules (D5), the baseline and freshness (D6), Apply and Review in editor… (D7, D8), the cards (D9), session state (D10) and the setting (D11). Close-out follows.

The automated suites already prove the contracts:
- **Slices 1 and 2.** The planner, the gateway's staging and its structure modes and ceiling, and `beforeAttempt` on every attempt (PR #229).
- **Slice 3.** The codec, its bounds and the prompt's sync test (PR #230).
- **Slice 4a.** The claim, the durable checkpoint and Astra's acceptance cases on the real coordinator (PR #233).
- **Slice 4b.** The cards' correlation, and the open disclosure across a room change (PR #234).
- **Slice 4c.** Transient refusals return to pending, and the settings row (Okey's answers; see below).

This pass checks what tests can't:
- how a real persona uses the trailer;
- how the cards look and read;
- VS Code's own editor, undo and Refactor Preview.

## Before you start

1. **Build and launch.** Build the epic branch (`npm run build`) after Slice 4c merges, and press F5.
2. **A project with both kinds of file.** Open a single-folder workspace with:
   - at least one chapter under the `chapters` context paths;
   - a few notes, such as a character file and a location file.

   Use a copy, or a project under git, so any edit can be undone.
3. **Keys and logs.**
   - Set an OpenRouter key.
   - Keep the **Prose Minion** output channel open; the log lines are checked below.
4. **The setting.** `proseMinion.workshop.fileEdits` should be `ask` (the default).

## A note (notes rules)

1. **Ask for a note edit.** In the Workshop, ask a persona to add something to a character file, for example "Add to Alice's file that she is afraid of clocks." The reply ends with a card under its bubble. The card shows:
   - the display path;
   - **note** as its class;
   - the persona's *why*;
   - the change: a replace as a word diff, an append or prepend as the added text.

   Its buttons are **Apply**, **Review in editor…** and **Decline**.
2. **Apply.**
   - The file opens in a preview tab if it isn't already showing.
   - The change is there, unsaved (the tab is dirty).
   - The card reads "Applied. The file is not saved yet."
   - Undo removes the whole change in one step.
3. **A rewrite.** Ask for a note to be rewritten whole, for example "Rewrite the location file as a short paragraph."
   - Open the card's **Before and after**. It reads "Reading the file…" briefly, then shows the file's current text and the new text.
   - Apply it, and check the front matter (if the file has any) is untouched.
4. **A rewrite over protected syntax.** Ask for a rewrite of a note that holds a link or a code span. The card is refused, with words that ask for replace edits instead (N-02).

## A chapter (prose rules)

5. **Replace in a chapter.** Ask a persona to tighten a sentence in a chapter.
   - The card says **chapter**.
   - Apply lands it as one undo step, unsaved.
6. **Append.** Ask for a short new paragraph at the end of a chapter. It applies as a plain paragraph.
7. **What prose refuses.** Each of these is refused in the writer's words, and the file is untouched:
   - a rewrite of a chapter;
   - an added heading or list in a chapter;
   - a large replace over one paragraph (more than 300 changed characters, and more than 60% of the paragraphs it touches), which hits the rewrite ceiling.

   It may take a nudge to get a persona to try these.
8. **The excerpt.** Put a passage from a chapter in the room's excerpt and ask for an edit to "the excerpt". The card targets the chapter the excerpt came from, as **chapter**. A typed-in (manual) excerpt is refused.

## Review in editor…

9. **Review, then apply.**
   - **Review in editor…** opens Refactor Preview with the change.
   - Apply it there. The card reads applied.
10. **Untick an entry.** On a card with two or more operations, untick one in the preview and apply.
    - The card reads partial, by operation: "1 of 2 changes applied."
    - Its line must not claim the rest "were not" applied if any are unknown (Astra's #233 note, fixed in #234).
11. **Discard the preview.** Discard it. The card returns to pending, with Apply offered again, since nothing was written.

## Freshness and staleness

12. **A replace whose quote is gone.** Before applying a replace, edit the quoted sentence yourself. Apply reads stale, the file is untouched, and no Apply is offered.
13. **A rewrite after a change.**
    - Change a note after its rewrite card appears, then open **Before and after**. The card turns stale.
    - Apply on a stale rewrite is never offered.
14. **Edits elsewhere don't stale a replace.** Edit another paragraph of the same file. The replace still applies.

## Duplicates, rooms and reloads

15. **Double Apply.** Click Apply twice quickly. One change lands, not two.
16. **A reply running.** Start another reply and press Apply on an earlier card while it streams. The card says "Apply after the current reply finishes." and nothing changes. Once the reply finishes, Apply works.
17. **Save and reopen.**
    - Save the session with applied, declined, stale and pending cards.
    - Open another session, then reopen this one. Each card keeps its state. A pending card can still be applied, and its baseline is checked against the file as it now stands.
18. **Reload during review.** Open **Review in editor…**, then reload the window (Developer: Reload Window) before applying.
    - The card reads unknown after the reload ("The session closed while this was being applied, so it is not known whether it landed. Check the file before asking again."), with no Apply.
    - Note how that reads. Is it clear enough that you'd check the file?
19. **A room change with a disclosure open.** Open a rewrite's **Before and after**, then use New, Open, Branch or Rewind so the same turn shows in the new room. The disclosure reads the file again for the new room and doesn't stick on "Reading the file…" (PR #234 F-01).

## The setting

20. **Off.** Set `proseMinion.workshop.fileEdits` to `off`.
    - Ask for an edit. The persona isn't taught the trailer, so there should be no card. If a reply still carries a frame, it's dropped and counted in the log.
    - On an existing pending card, Apply says "Suggested file edits are turned off in settings, so nothing changed." The card stays pending, and nothing is written.
21. **Back on.** Set it back to `ask`. New replies may propose again.
22. **The settings row (Slice 4c).** The Workshop's Conversation settings show a row for suggested file edits, Off or Ask first.
    - Changing it there changes `proseMinion.workshop.fileEdits` in VS Code's settings, and the other way round, with no reload.
    - Steps 20 and 21 work the same from the row.

## A temporary failure (Slice 4c)

23. **Apply again after a temporary failure.** This is hard to cause on purpose; the tests cover it. If you do meet one ("The project's configured files could not be listed." or "The editor could not make the change."), the card stays pending with that line, and Apply is offered again. Nothing was written, so pressing it again is safe.

## The cards' look and accessibility

24. **The look.** Check the cards in a light, a dark and a high-contrast theme, at a narrow sidebar width and in the full tab. Note anything cramped or hard to read.
    - This is the first visual pass on the CSS.
25. **Keyboard and screen reader.**
    - Tab reaches each button, named with its file ("Apply, edit to …").
    - When an action settles a card, focus moves to its state line, which is read out.

## Logs

26. **No text in the logs.** Every line about staging, Apply, refusals and checkpoints carries ids, counts and kinds, never the writer's text, a quote, a path or a URI.

## Okey's answers (2026-11-06)

- **Transient refusals: retry.** A temporary failure where nothing was written returns the card to pending, with its reason shown, and Apply is offered again. That covers a project file list that couldn't be read at Apply (`catalog-unreadable`) and an editor failure (`host-failed`). Slice 4c builds it and amends ADR D8's "No blind retry".
- **The settings row: yes.** `proseMinion.workshop.fileEdits` gets a row in the Workshop's Conversation settings. Slice 4c builds it and notes it in D11.
- **Feedback after a reload: fine as is.** A refused Apply's reason isn't persisted; after a reload a card that stayed pending reads as plain pending.

## Close-out (after the pass)

- **ADR 2026-11-05** (persona file edits) → **Accepted**, with any changes the pass asks for.
- **Codec.** The session codec's release decision (ADR 2026-07-30): `fileEditProposals` is a new optional field on a turn. Decide at the epic's end whether it needs a `schemaVersion` bump.
- **Memory-bank entry:** decisions, verification, follow-ups.
- **`AGENTS.md`:** a **Workshop Persona File Edits** section, covering:
  - the trailer and its bounds (`PROMPT_BUDGETS.workshopFileEdits`);
  - staging to an identity, a class by identity, and a baseline;
  - the structure modes, and the ceiling on every attempt;
  - the claim keyed by room generation, and the durable checkpoint before any write;
  - the states, with no blind retry;
  - the one words table;
  - D12's seam;
  - `fileEdits.ts` in the message tree.
- **Apply to Draft.** Its feature note is already marked superseded in part. Archive it, or split what's left (Apply Variation through the gateway) into its own `.todo` item.
- **Merging to `main`.** This epic goes to `main` after Bookmark Recall. Whichever of this epic and Helper Agent reaches `main` second merges the other first.

## Notes from the pass

_(Okey's findings go here.)_
