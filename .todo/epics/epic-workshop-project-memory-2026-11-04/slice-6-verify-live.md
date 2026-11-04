# Slice 6: Verify Live

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), all decisions; D11's budgets are tuned here
**Status:** Ready. Every code slice is merged (the epic is at `4d57f52`, with #202 the last). **Needs a human with VS Code** (Extension Development Host) and a real OpenRouter key; billable calls are made by the writer, never by tests.

## Outcome

The feature works in a real Extension Development Host on a real project. The
budgets are tuned from what was seen. The ADR moves to Accepted, the feature
note is archived, and a memory-bank entry records the result.

## Checklist

Use a scratch project with *Alice* text, never the writer's manuscript, for
anything screenshotted or recorded.

### Modes and storage

- [ ] Memory off by default: no folder created, no frame, and `memory.*`
      rejected.
- [ ] Turn on Ask first. The setting lands in the user settings (global), and
      a second project shows memory on with its own, empty folder.
- [ ] No workspace folder, then two folders: the tab says memory is unavailable
      here, the manager is disabled, and the mode cards still work.

### Read path

- [ ] Hand-make three memories, one pinned and one malformed. A new room's first
      request (Output channel, or provider logging) carries the frame. The
      malformed file is absent, and the manager lists it as unreadable.
- [ ] Ask a persona about a memory it can only see by summary. It calls
      `memory.read` and cites it as a saved note, not a memory of its own.
- [ ] A proposed memory with recallable provenance: the persona follows the
      hint with `transcript.read`.
- [ ] Prompt cache: two turns in, change a Conversation setting, take another
      turn. Cache reads continue on the provider's report (ADR 2026-10-03's live
      check), and the frame is byte-identical.

### Update notes (D14)

- [ ] Reopen a saved room after adding a memory in the manager. The writer's next
      message carries one note with only that memory, and the message after it
      carries none.
- [ ] Two windows on one project: save in one, then send a message in the
      other. Its next message carries the note.
- [ ] Turn memory on mid-room. The next message carries the whole catalog as a
      note, and cache reads continue on the provider's report.

### Write path

- [ ] Reach a decision in conversation, and a card appears. The reply text holds
      no trailer, and neither does the next turn's history.
- [ ] Save, Edit then Save, Dismiss. Each save leaves a receipt, and a guest
      mentions the receipt's memory when asked.
- [ ] Save to memory… on a writer bubble.
- [ ] Supersede a memory. The old one shows superseded in the manager and leaves
      the next room's frame.
- [ ] Two windows on one workspace each save a memory at the same moment, and
      both files stand.
- [ ] Close the window during a save, then reopen. The file is whole or absent,
      never torn, and any claim older than the lease is settled on the next
      listing.

### Memory tab and manager (4b-wire, #202)

- [ ] The Memory tab sits between About you and Advanced. It shows the
      "Memory isn't context" well, and its meter shows each memory's
      residency (Loaded in full, Listed or Searchable).
- [ ] Change the mode and Apply: the global setting changes. Edit
      `proseMinion.workshop.projectMemory` in VS Code Settings while the tab
      is open: the tab follows.
- [ ] Manager: search; Always load in full on and off (a memory that doesn't
      fit is refused on its row, with the reason); Archive and Restore (each
      leaves a receipt); Rename; Delete.
- [ ] Edit and New open the sheet over the manager. Close both: the
      Conversation settings' unsaved drafts are still there.
- [ ] Open file and Open memory folder open the right place. Make one fail
      (for example a read-only parent folder): the error shows where it was
      pressed, in the settings tab or the manager.
- [ ] Make a conflict, so a set-aside copy exists. It lists apart from the
      standing file and opens no file of its own.
- [ ] The saved card's Open in manager opens the manager.
- [ ] Save a card while the Memory tab is open: the tab's counts refresh.
- [ ] Remove the workspace folder while the manager is open: the next action
      is refused and nothing is deleted.

### Save and tell me (Slice 5, #201)

- [ ] A proposal saves at once with a receipt. The receipt is collapsed by
      default; its chevron opens the read-only card, which has no buttons.
      Edit and Forget sit on the receipt, and Forget archives.
- [ ] With web research on, a proposal is held with its reason. Save on a
      held card works.
- [ ] The room cap (`autoSavesPerRoom`) holds: the next proposal is held with
      the cap's reason. Rewind past an automatic receipt, and the room can
      save again.
- [ ] Switch to Ask first, or Off, while a reply is finishing: nothing is
      written for it and the card waits.
- [ ] Edit a card and Save it while its reply is still finishing: refused
      with "Wait for the reply to finish, then save to memory.", and the
      draft is kept. Save again once the reply settles: the memory is
      updated, with an updated receipt.
- [ ] New or Open while a reply is finishing: nothing from the old room lands
      in the new one.
- [ ] A screen reader reads a receipt with buttons as a group, named by its
      line (optional; no automated test covers native assistive tech).

### Never-list

- [ ] Steer a conversation toward the writer's mood. No proposal records it, and
      if one is attempted the fence withholds it (the Output channel shows the
      reason, never text).

### Budgets

- [ ] Measure a full frame at the decided ceiling (`pinnedTokens` 5,000 +
      `catalogTokens` 2,000, about 7,000 tokens) on a real model: what it adds to
      the first request's cost and latency, and whether the writer accepts
      it. Record the numbers here.
- [ ] Record the frame's size for 10, 40 and 80 memories, and compare the tab's
      estimate with the provider's prompt tokens.
- [ ] Tune `catalogEntries`, `catalogTokens`, `pinnedTokens`,
      `readCharacters` and `autoSavesPerRoom` if needed. Changes go through
      `PROMPT_BUDGETS` and the sync tests.

## Close-out

- [ ] The ADR's status moves to Accepted, with the writer's answers to the open
      questions and any amendment the live pass needs.
- [ ] The feature note is archived under `.todo/archive/features/` with an archive
      note linking the epic and PRs. Follow-ups are split into `.todo` first
      (anything the live pass defers).
- [ ] A memory-bank entry: `.memory-bank/YYYYMMDD-HHMM-workshop-project-memory.md`.
- [ ] The coordinator updates `AGENTS.md` (tree, inventory, a Project Memory
      section) and `docs/ARCHITECTURE.md`.
