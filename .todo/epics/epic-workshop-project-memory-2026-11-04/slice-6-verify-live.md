# Slice 6: Verify Live

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), all decisions; D11's budgets are tuned here
**Status:** Waiting on Slices 2–5. **Needs a human with VS Code** (Extension Development Host) and a real OpenRouter key; billable calls are made by the writer, never by tests.

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
- [ ] Turn on Ask first (in the scope question 1 chose); the setting lands where
      expected.
- [ ] No workspace folder, then two folders: the tab says memory is unavailable.

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

### Save and tell me

- [ ] Saves at once with a receipt. Forget archives.
- [ ] With web research on, a proposal is held with its reason.
- [ ] The room cap holds.

### Never-list

- [ ] Steer a conversation toward the writer's mood. No proposal records it, and
      if one is attempted the fence withholds it (the Output channel shows the
      reason, never text).

### Budgets

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
      (INDEX.md or the delta frame, if deferred).
- [ ] A memory-bank entry: `.memory-bank/YYYYMMDD-HHMM-workshop-project-memory.md`.
- [ ] The coordinator updates `AGENTS.md` (tree, inventory, a Project Memory
      section) and `docs/ARCHITECTURE.md`.
