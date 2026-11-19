# Workshop

## Start a conversation

Run **Open Workshop** from the Command Palette. Choose a host, such as Jill, to discuss a passage or start an open chat. Invite a specialist guest for a different perspective and choose the participant you want to address. The thread identifies the speaker and the model that wrote each reply. Tools run a focused writing pass in the room. The host can synthesize its findings and you can keep actions as to-dos.

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

The context gauge in the Workshop shows how much of the selected participant's context window its conversation fills, measured by the provider after its last reply. Open it to see **By part**: a bar and a table that split the total into persona and behavior, tool-use instructions, project memory, to-dos, room notes, the excerpt and context, what the persona requested, and the conversation itself. Select a part to see its sections, such as the interaction mode or the memory start block. Prose Minion estimates each part as it writes it. Conversation is the rest of the measured total, so the parts add up. A conversation started before this version shows some parts as not measured. Each host and guest shows its own conversation. A writing tool's private thread shows the total only.

## Side pane and bookmarks

Use **Side pane** in the Workshop header to fold or reveal the rail. The **Material** tab holds the excerpt, standing context and **Read in** entries for the selected participant. The **Notes** tab holds to-dos and bookmarks. A badge can tell you about additions while a tab is hidden. Attach standing context in the Context panel for the whole conversation, up to its 100,000-word budget. Ask a persona to look up configured project files on demand. One file-read card can cover up to ten files. Large reads may continue across multiple calls as the conversation window allows.

Bookmark a message to find it again. **Sessions → Bookmarks…** includes saved sessions as well as this room. Preview a bookmark, open its session, or use **Remember this** to create a project note. To-dos track actions from the discussion. A persona can read bookmarks visible to it. Open a bookmark on an older message and the thread loads the earlier turns back to it, then scrolls there; while it loads, press Escape on the bookmark to stop. A bookmark more than three pages of earlier turns back opens in a read-only preview instead.

## Earlier turns and saved sessions

At the top of a long conversation, press **Show earlier turns** to load the preceding page. The count tells you how many turns remain hidden. Repeat to reach the start of the thread. Earlier turns stay in the saved conversation and are available to export and recall while off screen.

**Sessions** lets you save, reopen or start a room. Use **Export…** for Markdown, JSON or styled HTML in prose-minion/exports/. To explore a different response, branch at an earlier point to keep the original session, or rewind to that point in this session. Rewind asks for confirmation before removing later turns. You can edit a previous writer message and send again. Ask a persona about earlier work to let it search saved transcripts and cite the session and turns. Session Recall shows a card for the lookup.

## To-dos a persona closes

A host or guest can mark your to-dos **Done** or **Dismissed** once they are handled, here and in saved sessions. Ask it to gather open to-dos from a chapter's sessions, work through them together, and it marks each one as you finish. It copies each to-do's id from the to-do list it was shown, so it never guesses. One reply can change up to 20 to-dos in up to 10 saved sessions. Only you reopen a to-do.

The change lands at once. A receipt under the reply lists each to-do, its session and its new status, with **Undo** beside each. A saved session's change shows **Saving…** until it is written. If that session changed on disk since the persona read it, nothing is overwritten and the receipt says so. A closed to-do then reads, for example, "Done · by Jill in Polish 6.11". Your own tick or reopen clears that line. Undo works only in the room that made the change, and only while the to-do still has the status it set. If a saved session is open in another window, that window's next save is refused rather than writing the old status back; reopen the session there to load the change.

## Suggested file edits

Under **Conversation settings → Behavior**, **Suggested file edits** controls whether a persona may propose changes to project files. Each card shows changes against a specific file. Inspect the card and choose **Apply**, **Review in editor…**, or **Decline**. Apply makes an undoable change. Saving the document remains your choice. When a reply describes small fixes or offers a rewrite, select its footer chip to ask that author to turn the offer into edit cards.

When a persona submits notes or file edits, the host records what appeared as cards, what was refused and what was dropped. A counts-only trailer-outcomes line accompanies the next relevant request to that participant, including a tool-result synthesis. This lets the persona distinguish a suggestion that reached the writer from one that could not become a card.

## Conversation widgets

Choose a widget in the Workshop to explore an idea before committing it to the conversation. **Gesture Playground** explores a gesture's associations and alternatives. **Creative Variations Explorer** compares different versions of a passage while preserving the constraints you specify. **Show vs. Tell Playground** moves a beat between stating and inhabiting it. Select the choices that fit and commit the result to the thread. These actions leave the manuscript for you to edit. The widget model setting controls model-powered widget generation.

## Lexical Gravity

Open **Lexical Gravity** in Widgets to explore how a lens changes which details, vocabulary and associations a passage foregrounds. Preview it, adjust its weight and reach, and install it as a standing influence until you remove it. A lens build can offer the usable candidates even when some returned candidates fail validation. A count tells you how many could not be used. The preview and builder accept supported minor JSON formatting mistakes when the original content can be preserved.

Ask a host or guest what lenses are available. The persona uses lens.catalog to page through built-in and readable project lenses, 50 per page. Built-ins win duplicate slugs. With no usable project folder it can still list built-ins. With a slug, lens.read returns whole requested sections as room permits. These are private reads for the requesting persona. Looking up a lens does not install it.
