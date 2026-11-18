# Workshop project memory

## Saving project notes

Open **Conversation settings → Memory** to turn on Project Memory. The mode applies across projects, while each project has its own notes in prose-minion/memory/. **Ask first** offers a card under the reply. Choose **Save** to keep the note. **Save and tell me** can save up to five suggested notes in one conversation, then holds further suggestions as cards. A sensitive suggestion can also wait as a card. Off keeps project notes out of persona conversations.

To keep a message yourself, choose **Save to memory…**. Review the body, title, summary and kind in the sheet. When helper drafts are enabled, a small model call drafts a title, summary and kind. What you have already typed stays. Turn off memory helper drafts to fill the fields yourself. Use **Sessions → Memory…** to browse, edit, archive or delete the project's notes. The kinds include decision, canon, theme, idea, open thread and preference.

## Suggest notes

On the Memory tab choose **Suggest notes** to control how readily a persona proposes new project notes. The global setting proseMinion.workshop.memory.suggestions offers sparingly (default), readily and aggressively. A change applies to the next turn in a room using Project Memory. The level changes frequency only. Suggestions must each stand alone, avoid repeating existing notes and stay within ten per reply. The memory mode still determines which suggestions wait for approval.

## Starting list and catalog

On the Memory tab use **List at the start of each conversation** to choose the starting list size (proseMinion.workshop.memory.listSize). It takes effect in the next conversation. Standard gives the newest notes up to 2,000 tokens and 40 entries of titles and summaries. Larger gives 5,000 and 100. Largest gives 10,000 and 200. After that tier, older notes in effect appear by title alone within an additional 2,000, 3,000 or 4,000 tokens respectively. A count reports notes that could not be listed. Superseded and archived notes are counted separately.

Choose **Always load in full** for the few notes whose whole text the room needs at the start. Their combined 5,000-token allowance stays the same at every list size. For other notes, ask a persona to open the full note on demand. A persona can use memory.catalog to browse entries, 40 per page at every list size. Its optional <page> field selects a later page and a continuation is supplied while another page exists. Use memory.search with status all to look up retired notes.
