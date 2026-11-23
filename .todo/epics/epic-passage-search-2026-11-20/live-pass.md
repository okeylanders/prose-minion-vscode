# Passage Search: live pass

**Status:** Ready for Okey. Nothing here has been run.
**Candidate:** `epic/passage-search` at or after `5b747f6b`: every slice is in. Record the SHA you test.
**Epic:** [README](README.md) · **ADR:** [2026-11-20](../../../docs/adr/2026-11-20-passage-search.md)

## Why this pass exists

- **Nothing has run in an Extension Development Host or against a real model.** No test made a live call. Every Astra review (`docs/pr-reviews/pr-292` to `pr-296`) was offline: static reading, mocked transports, React/jsdom probes.
- **The things only a live pass can show:**
  - how well a real model finds moments and quotes them exactly;
  - whether the 12,000-word budget per call is right (ADR Q2);
  - how many quotes the host drops as ambiguous (ADR Q1);
  - how often the organizing pass loses claims to the quotation check;
  - what the panel and the card look like.

## Setup

1. `git fetch origin && git checkout --detach origin/epic/passage-search`, then record `git rev-parse HEAD`. The version is 2.14.1. The branch also carries all of Workshop Persona Tools, which it was cut from.
2. `npm install`, then F5.
3. **A project to search: a disposable one.** Every run sends its text to the provider, so use made-up chapters or a copy you would be content to share, never the working manuscript. A dozen chapters or more in a `chapters` (or `manuscript`) context group, named so natural order matters: `6.9.md`, `6.9.2.md`, `6.10.md`. Add a `characters` group with one character note. Pick a character with a habit you can check by hand, such as a gesture written several ways or a phrase they repeat. The examples call them *Jasper*.
4. **One long chapter, over 12,000 words** (paste a chapter twice if need be), so a file is split.
5. **An inexpensive model** in Settings → **Passage Search** for the first runs. Note what the estimate says, then compare with the OpenRouter dashboard afterwards.
6. **Keep Output → Prose Minion open.** No line may carry the question, a quote, a note, a label, a headline, a claim, a path, a pattern or a file name. Counts, ids and fault kinds only.
7. **Reset the scopes before every search** (PR #297 F1). The sidebar keeps its scope choices between searches, and **Active file** starts ticked. Each search reads every scope ticked, so a leftover tick reads an unrelated open file, or refuses the search when no editor is focused. Before each search below: untick Active file and Selection, untick every group, clear the pattern, then tick only what the step names and set **Organize the results** as it says (on, unless it says otherwise). Before you press Run, check that the line under the estimate ("N files to read") counts only the files you meant.

Tick a box when the result matches. Write what you saw beside any that does not.

---

## A. The sidebar search (Slices 1 and 2)

**Not covered by tests:** a real model; the panel's layout and focus; opening a file at a line in the real editor; the real clipboard and file write.

### A1. Estimate and Run

1. - [ ] **Search → Passage Search.** Reset the scopes (Setup 7), tick only `chapters`, leave **Organize the results** on, ask "Find every time Jasper adjusts his glasses", and press **Estimate**.
   **Expect:**
   - "N files to read" under the estimate, N being the number of `chapters` files, with no active file added;
   - "N calls · ≈ $… · *model*". The call count is one per chapter, plus one for the long chapter's extra piece, plus one for organizing. A model with a small window splits long chapters further, so count pieces only on a large-window model;
   - if any file was left out, the lines say so.
2. - [ ] Change one word of the question.
   **Expect:** the estimate clears, and Run is unavailable until you estimate again.
3. - [ ] Estimate again and press **Run**.
   **Expect:** progress reads "Reading 3 of N · 2 found" and moves; Stop is available.
4. - [ ] When it finishes, check the result.
   **Expect:**
   - "Results for: *your question*";
   - a headline and an analysis whose `[#4]` cites jump to their instances;
   - a label table (label, count, files);
   - every instance, with file · line, the quote with a little context, and a note;
   - what was dropped and why.
5. - [ ] Read five instances against the files.
   **Expect:** every quote is word for word in the file, curly marks and all, at that line. Note any instance that is real but mislabelled, and any moment you know exists that is missing.
6. - [ ] Press a file · line.
   **Expect:** the file opens with that line revealed and selected.
7. - [ ] Check reading order.
   **Expect:** `6.9` before `6.9.2` before `6.10`.

### A2. Scopes

Reset the scopes (Setup 7) before each step, then tick only what it names.

1. - [ ] **Active file** alone, then **Selection** alone (select one scene first).
   **Expect:** each searches only that. With no editor focused, Active file is refused in words; with nothing selected, Selection is.
2. - [ ] Tick `chapters` and `manuscript` together, where some files match both groups.
   **Expect:** each file is read once, and the call count reflects it.
3. - [ ] A pattern such as `chapters/6.*.md`.
   **Expect:** only those files. An unsafe pattern (`../x`, `/abs`, `~`) is refused in words.
4. - [ ] Open a file **outside the workspace** and search it as Active file.
   **Expect:** the panel and the saved report show its name only, never its full path.

### A3. Stop, keys and failures

1. - [ ] Run a search over all chapters and press **Stop** after two or three calls.
   **Expect:**
   - what was found stays;
   - the result says how many files were not searched or only partly searched, and how many calls were stopped in flight ("may still have been charged");
   - no total cost is shown;
   - no analysis, and **Organize these results** is offered with its own "1 call · ≈ $…".
2. - [ ] Press **Organize these results**, then **Organize**.
   **Expect:** a headline and analysis appear over what was found.
3. - [ ] Start a search and change the API key in Settings partway through.
   **Expect:** it stops starting calls and ends "key changed", with what was found kept.
4. - [ ] *(Optional, needs a model with a small window.)* Estimate with the window unknown, then run once it is known.
   **Expect:** a call too large for the window is not sent: "1 call did not fit the model's window and was not sent…", with no charge for it.

### A4. Copy and Save

1. - [ ] **Copy**, then paste into a scratch file.
   **Expect:** the Markdown report: headline, analysis, table, instances with context, what was dropped and why.
2. - [ ] **Save**.
   **Expect:** `prose-minion/reports/passage-search-YYYYMMDD-HHMMSS.md` is written and opened.

---

## B. The organizing pass (Slice 3)

**Not covered by tests:** how a real model follows the quoting rules; how often the host drops claims.

1. - [ ] Ask a question that wants synthesis: "How do Jasper's gestures change across the chapters?"
   **Expect:** sections that follow the chapters, each claim citing instance numbers.
2. - [ ] Read every claim that puts words in quotation marks.
   **Expect:** each quoted phrase is in a cited instance's quote. Count any that are not; that would be a bug.
3. - [ ] Look at the "left out" lines under the analysis, and at the Output line that starts "[PassageSearch] Organizing pass".
   **Expect:**
   - under the analysis, a count of claims dropped (uncited, misquoted, malformed);
   - if **every** claim was dropped, no analysis, and the one line "The results were not organized: nothing the organizing reply said could be checked against the instances." The counts are then in the Output line only ("kept nothing … dropped N claim(s) (uncited …, misquoted …, malformed …)");
   - **note the numbers.** If many claims are dropped for quoting, the prompt or the single-quote rule needs tuning; the rule fails closed on purpose.
4. - [ ] On a search with many instances (a common word-level habit, or a broad question):
   **Expect:** "The analysis read 400 of 1,240 instances." The list and table still hold them all.
5. - [ ] Turn **Organize the results** off and estimate.
   **Expect:** one call fewer, and no allowance line.

---

## C. A persona asks for a search (Slice 4, PR #296)

**Not covered by tests:** a real model writing the trailer; the card on screen; a real Rewind of a delivered reply; closing a real panel mid-search.

1. - [ ] In the Workshop, ask a persona something that needs reading many files: "Can you find every time Jasper adjusts his glasses across the chapters and tell me what it says about him?"
   **Expect:**
   - the reply ends with a card, never showing the raw `<prose-minion-passage-search>` tag;
   - the card shows the question, where it would look, and "N calls · ≈ $… · *model*. The search only. *Persona*'s reply to the results is an ordinary turn.";
   - **Run** and **Cancel**.
2. - [ ] Press **Run**.
   **Expect:**
   - progress and Stop on the card;
   - when it read everything in full, the results go to the persona, who replies in prose about them, citing what was found;
   - the card then reads delivered, with counts and **Open report**.
3. - [ ] Check the counts.
   **Expect:** "Found N instances in M files. K files were searched."
4. - [ ] Start another, and press **Stop** partway.
   **Expect:** nothing is sent for you. The card offers **Send partial results to** *persona*, **Open report** and **Discard**, and says what was not searched.
5. - [ ] **Send partial results**.
   **Expect:** the persona replies knowing the search was partial.
6. - [ ] **Open report**.
   **Expect:** the same Markdown report as the sidebar's, under `prose-minion/reports/`.
7. - [ ] Ask for a search, then press **Cancel**.
   **Expect:** "Cancelled." Nothing was sent to a model.
8. - [ ] Change the files the card names (edit one chapter), then press **Run** on a card priced before the edit.
   **Expect:** the new price shows and nothing runs until you press again.

### C2. Rooms, panels and Rewind

1. - [ ] While a persona's search runs, open another saved session.
   **Expect:** the search stops at once. The new room's cards price and run normally; nothing from the old search appears.
2. - [ ] While a search runs, close the Workshop panel. Reopen it.
   **Expect:** no results turn appears without a reply, and nothing was sent to the persona.
3. - [ ] Close the panel while the persona is replying to delivered results. Reopen it.
   **Expect:** no orphan "results" turn in the thread.
4. - [ ] After a delivered search, **Rewind** to just before the persona's reply to the results.
   **Expect:** the card reads ready with **Send** again, and Send delivers without searching again.
5. - [ ] Rewind past the card.
   **Expect:** the card and its results are gone.
6. - [ ] Reopen the same saved session (Open → it).
   **Expect:** held results are dropped; the card can be run again.
7. - [ ] Leave four stopped searches unsent, then Run a fifth.
   **Expect:** refused before anything is sent, telling you to Send or Discard one first.

---

## D. The combined case Astra asked for (record only)

**Its verification is the deterministic test's** (`WorkshopPassageSearchCombinedAcceptance.test.tsx`), which prices with no window known and then dispatches with one (PR #297). The live pass does not try to reproduce it, and **spends nothing to force it**. A live refusal needs the card's own plan, at Estimate and again at Run (Run plans again, D20), to see no window, and the window to be known when the read goes out. Nothing in this pass sets that up, and an earlier refusal elsewhere (A3.4) does not carry over to a new card. The live check of manual Send is C4 and C5, on a stopped search.

1. - [ ] Record "not reproduced", unless a persona's card hit it on its own during the pass. If one did, note what that card showed: the refusal line ("1 call did not fit the model's window and was not sent…", with no charge for it), "1 of 2 files was searched." or the like, coverage incomplete, and "Send partial results" offered rather than sent. Note too whether the report, the card after a reload, and the persona's message after Send agree. Call counts are that run's own, not a fixed expectation.

---

## E. Settings and help

1. - [ ] Settings → **Passage Search** model, left empty.
   **Expect:** it follows the Category Search model. Change Category Search and the estimate's model follows. Pick a Passage Search model and it stops following; Category Search is unchanged.
2. - [ ] Ask a persona "How do I use Passage Search?"
   **Expect:** it reads the help reference and describes the sidebar search and the persona request accurately.

---

## Decisions to make after the pass

- **Q1, ambiguous quotes:** keep dropping a quote its chunk holds twice, or keep the first occurrence?
- **Q2, words per call:** keep 12,000, or change it?
- **Partial results:** keep manual Send for any incomplete search, or auto-send a clearly labelled partial result?
- **The single-quote rule:** if real analyses lose too many claims, loosen the prompt or the rule.
- **Bring a sidebar result to the Workshop:** still later?
