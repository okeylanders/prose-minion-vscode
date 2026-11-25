# Workshop

## Start a conversation

Run **Open Workshop** from the Command Palette. Choose a host, such as Jill, to discuss a passage or start an open chat. Invite a specialist guest for a different perspective and choose the participant you want to address. The thread identifies the speaker and the model that wrote each reply. Tools run a focused writing pass in the room. The host can synthesize its findings and you can keep actions as to-dos.

## Multiple Workshop tabs

To discuss two chapters side by side, run **New Workshop Tab** from the Command Palette. Each tab has its own room, excerpt, conversation history and reply in progress. You can send a message or stop a reply in one room while the other keeps working. **Open Workshop** brings the most recently focused open Workshop tab to the front.

Before using **Add Selection to Workshop Message**, **Send to New Workshop Excerpt**, or a Lightbox action that sends material to Workshop, focus the tab you want to receive it. You can then return to the editor or Lightbox to send. If you have no Workshop tab open, the command opens one.

You can leave both rooms unnamed. With a single project folder open in VS Code, each room keeps its own checkpoint. Reloading VS Code restores each open tab from its checkpoint. To recover an unnamed room after closing its tab, run **Reopen Closed Workshop Room…** and choose the room. With no folder or with several workspace folders, closed rooms stay available in that picker while the extension is running. Reloading or closing that window ends those in-memory rooms. Opening a named session already open elsewhere in the same window takes you to its tab. **Branch** opens the branch in the tab where you made it.

If two VS Code windows write to the same room checkpoint, the first successful save stays in place. Workshop preserves the other window’s edits in a separate local recovery session. If the recovery write also fails, keep the window open and reopen the room to retry. When you close that tab, choose **Open saved recovery** to continue in a fresh tab. You can also open the preserved session by name from Workshop Sessions.

If an interrupted write left a closed room locked, run **Reopen Closed Workshop Room…**. When the picker offers **Open a recovery copy**, choose it to continue from the last saved checkpoint in a separate room.

Each reply’s footer shows how many tokens its own turn processed. The header’s cumulative usage and last-request cost cover activity across the whole extension window, including other Workshop tabs.

## Hosts and guests

Choose a host when opening the room. Use **Invite guest** beside the participants to bring in a second perspective. Select a participant under **Talking to** to address your next message to them. Use the close button on a guest's chip to dismiss them once a reply finishes.

Jill works across developmental and line craft. Sister Agnes reads theme and symbolism, Cliff cliché and repetition, Dev dialogue and microbeats, Edna reader-breaking logic, and Felix rhythm and pacing. Harper draws craft lessons from the passage, Margot tracks voice and point of view, Penny reports the reader experience, Quinn follows continuity, Theo tests stakes and engagement, and Wren works at the sentence level.

## Writing tools and private follow-ups

Use **Tools** to select an analysis. **Primary** includes Dialogue & Beats, Prose and Gestures. In **Craft & Voice**, choose Cliché for stock phrasing, Repetition for echoes, Decision Points for stakes, Show & Tell for narrative distance, Choreography for movement, Stock & Signature for distinctive habits, Craft Steering for sound and rhythm, or Placeholders for unfinished seams. **Technical** includes Style, Editor, Continuity and Fresh for a first-time reader's response.

A tool run posts its report to the room. To ask about that report privately, select the tool under **Instruments**. The direct follow-up thread is between you and that tool. It cannot read your other conversations, and persona voice and writer profile settings do not apply there. Select your host or guest under **Talking to** to return to the room. Hosts and guests can look up Prose Minion help. A tool's private thread has its own analysis instructions.

## Conversation settings

Open Conversation settings in the Workshop. **Behavior** sets durable preferences for interaction, expression, relational depth, carrying cues through a session and proactive help. **About you** holds an optional global profile with your preferred address and bio for personas. **Pinned context** sets the project template for new conversations. **Memory** controls whether to use project notes, suggestion frequency, the starting list size and helper drafts. **Advanced** includes **Allow live web research**. Optional web research can share active conversation context with OpenRouter and search providers. Set the web research option for the window if a persona needs current web sources.

You can react to a message with an emoji. The reply's author hears about your reaction with your next message. A persona can occasionally react to a writer's message. Turn off Workshop persona reactions to disable those responses. Adding a reaction alone makes no model call.

## Excerpts and message attachments

Select text in the editor, open the Prose Minion submenu and choose **Send to New Workshop Excerpt** to make it the room's excerpt. **Add Selection to Workshop Message** stages a Selected Text pill for just your next message. In the composer, **Include selected text** lets you stage a selection directly. Review the pills before sending. When continuing with a chapter carried into another room, **Continue** re-reads it from file. Use **Re-read from file** to pick up subsequent edits.

Type @ in the composer and start a file name. The list groups matching configured files and offers **Browse project…** for the full picker. Use Up or Down to move, Enter or Tab to pick, or Escape to close. Picking adds a text token and stages a pill for that message. Picking an already staged file inserts its token again without duplicating the pill. To remove the attachment, remove its pill. Deleting only the token leaves the attachment staged.

## Pinned context

To pin a file, open **Conversation settings → Pinned context** in the Workshop. Choose **Add from project…**, select the file, then press **Pin 1 file**. For files already attached to the room, choose **Pin what’s attached now**. Pin files from this project only. Changes save as you make them. Use the arrows beside a row to change attachment order, or **Unpin** to remove it from the template.

Each new conversation copies these files once, in order, subject to its context limits. The project list holds up to 50 files in prose-minion/pinned-context.json. To bring newly pinned files into the current room, choose **Attach missing to this conversation** after the current reply finishes. Removing a room attachment leaves the pin in place. Unpinning leaves existing conversations as they were. **New session: full reset, empty context** skips the template.

## What a participant's context holds

The context gauge in the Workshop shows how much of the selected participant's context window its conversation fills, measured by the provider after its last reply. Open it to see **By part**: a bar and a table that split the total into persona and behavior, tool-use instructions, project memory, to-dos, room notes, the excerpt and context, what the persona requested, and the conversation itself. Select a part to see its sections, such as the interaction mode or the memory start block. Prose Minion estimates each part as it writes it. Conversation is the rest of the measured total, so the parts add up. In conversations started before 2.15.0, some parts can appear as unmeasured. Each host and guest shows its own conversation. A writing tool's private thread shows the total only.

## Side pane and bookmarks

Use **Side pane** in the Workshop header to fold or reveal the rail. The **Material** tab holds the excerpt, standing context and **Read in** entries for the selected participant. The **Notes** tab holds to-dos and bookmarks. A badge can tell you about additions while a tab is hidden. Attach standing context in the Context panel for the whole conversation, up to its 100,000-word budget. Ask a persona to look up configured project files on demand. One file-read card can cover up to ten files. Large reads may continue across multiple calls as the conversation window allows.

Bookmark a message to find it again. **Sessions → Bookmarks…** includes saved sessions as well as this room. Preview a bookmark, open its session, or use **Remember this** to create a project note. To-dos track actions from the discussion. A persona can read bookmarks visible to it. Open a bookmark on an older message and the thread loads the earlier turns back to it, then scrolls there; while it loads, press Escape on the bookmark to stop. A bookmark more than three pages of earlier turns back opens in a read-only preview instead.

## Earlier turns and saved sessions

At the top of a long conversation, press **Show earlier turns** to load the preceding page. The count tells you how many turns remain hidden. Repeat to reach the start of the thread. Earlier turns stay in the saved conversation and are available to export and recall while off screen.

**Sessions** lets you save, reopen or start a room. Use **Export…** for Markdown, JSON or styled HTML in prose-minion/exports/. To explore a different response, branch at an earlier point to keep the original session, or rewind to that point in this session. Rewind asks for confirmation before removing later turns. You can edit a previous writer message and send again. Ask a persona about earlier work to let it search saved transcripts and cite the session and turns. Session Recall shows a card for the lookup.

Prose Minion 2.16.0 opens sessions from earlier versions. If you sync or share sessions, update each installation that opens them. A session that records a persona’s to-do changes, Git lookups, context-path proposal, or Passage Search request or delivery can require 2.16.0 or later.

A saved session left mid-save, usually by a window that closed, reads **Recovery required** in Sessions, and saving or opening it says so. Close any other Prose Minion window on this workspace, then press **Recover…** on that notice or on the session's row and confirm. Recovery puts the saved session back and keeps any unsaved work as a session named "(local recovery)"; an older copy that a finished save already replaced is dropped. A session another window is writing reads busy until that window finishes.

## To-dos a persona closes

A host or guest can mark your to-dos **Done** or **Dismissed** once they are handled, here and in saved sessions. Ask it to gather open to-dos from a chapter's sessions, work through them together, and it marks each one as you finish. It copies each to-do's id from the to-do list it was shown, so it never guesses. One reply can change up to 20 to-dos in up to 10 saved sessions. Only you reopen a to-do.

The change lands at once. A receipt under the reply lists each to-do, its session and its new status, with **Undo** beside each. A saved session's change shows **Saving…** until it is written. If that session changed on disk since the persona read it, or another window is writing it, nothing is overwritten and the receipt says so. If Prose Minion closed before the change was saved, the receipt says so when the room opens again; the change is never retried. A closed to-do then reads, for example, "Done · by Jill in Polish 6.11". Your own tick or reopen clears that line. Undo works only in the room that made the change, and only while the to-do still has the status it set. If a saved session is open in another window, that window's next save is refused rather than writing the old status back; reopen the session there to load the change.

## A passage search a persona asks for

A host or guest can ask for a passage search when a question needs many files read for moments, not words: every time a character does something, each place a motif returns. The persona names where to look: context groups, single files in them, or this room's excerpt. It can narrow a group with up to 8 patterns, written as you write a context path in Settings and separated by commas, so it can search only Book 1's chapters, say. A narrowed group still reads only that group's files, and a request with a pattern that finds none of them is dropped. The persona cannot name a folder or a file outside your groups, so set your context paths first if the files are not in a group.

Ask a persona to list a group's files, such as every chapter. It lists exactly the files a search of that group reads, 100 to a page, and can narrow the list by the same patterns, showing how many files each pattern finds before it asks for a search.

Nothing runs when it asks. A card under the reply shows the question, where it would look (a narrowed group with its patterns), and a line such as "23 calls · ≈ $0.42 · model": the number of calls, an estimated price, and the model. The price is an estimate, and it covers the search only; the persona's reply to the results is an ordinary turn. The search runs on the **Passage Search** model from Settings, which follows the Category Search model until you pick one. The persona's own model never reads the files.

Press **Run** to start it, or **Cancel** to turn it down. If the files or the price changed since the card was shown, Run shows the new price and waits for another press. While it runs the card shows progress and **Stop**. A Workshop room runs one passage search at a time. Closing its tab, replacing its session or pressing **Stop** ends the search. Calls already made may still be billed.

When the search has read every file it planned, in full, and the room is free, the results go to the persona, who replies as on any turn. If a reply was in progress, or a session is being saved or opened, the card waits with **Send to** the persona. A search that did not read everything is never sent for you: one you stopped, one cut short by a changed API key or a provider that refused its calls, or one where a read failed, a reply was cut off, or a read did not fit the model's window and was not sent. The card shows what was found and what was not searched, with **Send partial results to** the persona, **Open report** and **Discard**. If sending fails, the results stay on the card and you can send them again without searching again.

**Open report** saves a Markdown report in prose-minion/reports/ and opens it: what was read, the labels with their counts, and every instance with its file, line and quote. When there are more instances than fit in the persona's message, it is sent an even spread of them and told so; the report has them all. If not even a summary of the results fits in what is left of the persona's conversation, nothing is sent and the card says so; open the report instead.

Each Workshop room can hold up to four results that have not been sent. With four waiting, **Run** on another card says so and searches nothing: send or discard one first. The results stay with their room while its tab is open, even when you switch tabs. A rewind that keeps the card unchanged keeps its results, so they can be sent again; opening a session, even the same one again, starting a new room or branching drops them. After a reload the card can be run again, and a delivered card says the report is no longer held.

## Suggested file edits

Under **Conversation settings → Behavior**, **Suggested file edits** controls whether a persona may propose changes to project files. Each card shows changes against a specific file. Inspect the card and choose **Apply**, **Review in editor…**, or **Decline**. Apply makes an undoable change. Saving the document remains your choice. When a reply describes small fixes or offers a rewrite, select its footer chip to ask that author to turn the offer into edit cards.

When a persona proposes a memory note, file edit, context-path change or Passage Search, the Workshop tells that persona on its next relevant turn how many proposals reached you and why any were dropped. For to-do changes it can also report how many were made, are still being saved, or could not be written. For a Passage Search, the first feedback tells the persona whether you received the request card. The search findings arrive in a later turn.

## Conversation widgets

Choose a widget in the Workshop to explore an idea before committing it to the conversation. **Gesture Playground** explores a gesture's associations and alternatives. **Creative Variations Explorer** compares different versions of a passage while preserving the constraints you specify. **Show vs. Tell Playground** moves a beat between stating and inhabiting it. Select the choices that fit and commit the result to the thread. These actions leave the manuscript for you to edit. The widget model setting controls model-powered widget generation.

## Lexical Gravity

Open **Lexical Gravity** in Widgets to explore how a lens changes which details, vocabulary and associations a passage foregrounds. Preview it, adjust its weight and reach, and install it as a standing influence until you remove it. A lens build can offer the usable candidates even when some returned candidates fail validation. A count tells you how many could not be used. The preview and builder accept supported minor JSON formatting mistakes when the original content can be preserved.

Ask a host or guest what lenses are available. The persona uses lens.catalog to page through built-in and readable project lenses, 50 per page. Built-ins win duplicate slugs. With no usable project folder it can still list built-ins. With a slug, lens.read returns whole requested sections as room permits. These are private reads for the requesting persona. Looking up a lens does not install it.

## A file's git history

If the project is a git repository, a host or guest can read the history of the excerpt's file or of any configured project file. There is no setting: ask, for example, what you cut from a chapter since last week, or how a new ending differs from the one you committed in March. The persona uses history.log to list a file's commits, newest first, 20 per page, with each commit's short id, date, author and subject. It uses history.diff to compare two commits, or a commit with the file as currently saved on disk. Unsaved changes in the editor are not included. A diff matches paragraphs first, then marks the words that changed inside a paragraph, and continues across calls when the conversation window is short. A diff is shared with the room when the reply commits and appears under **Read in**; the list of commits stays private to the persona. History is read through VS Code's built-in Git extension, so git must be installed and enabled, and the workspace must be trusted. The history does not follow a file across a rename: a renamed file's history starts at its rename.
