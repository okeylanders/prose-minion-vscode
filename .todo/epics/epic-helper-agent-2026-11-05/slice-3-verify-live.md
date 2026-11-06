# Slice 3: Verify live

**Status:** Ready for Okey.
**Covers:** the Extension Development Host pass for D3 (the model scope) and D5 (drafting in the memory sheet). Close-out follows.

The automated suites already prove the contracts: A-01 to A-05, D5.7 and PR #231's F-01. This pass checks what tests can't: how it looks and feels, a real model's drafts, cost and latency, and native VS Code behaviour.

## Before you start

- Build the epic branch (`npm run build`) and press F5.
- Open a workspace that has project memory available (a single folder).
- Have an OpenRouter key set.
- Keep the **Prose Minion** output channel open: the helper's log lines are checked below.

## The model setting (D3)

1. **The row.** Open the Settings overlay (gear). The **Helper** row reads "Same as Proofread (…)" and names Proofread's model.
2. **Following.** Change Proofread's model. The Helper row follows it.
3. **Picking.** Pick a model for the Helper. It stays put when Proofread changes again.
4. **Clearing.** Clear the Helper's model, either in VS Code settings (`proseMinion.helperModel`) or in the overlay. It follows Proofread again.

## Drafting in the memory sheet (D5)

5. **A persona's reply.** On a reply bubble, press **Save to memory…**.
   - The sheet opens at once, its title and summary showing "Drafting…".
   - Within a few seconds they fill in, and the kind is picked.
   - The body is the bubble's text, unchanged.
   - Judge the draft: does the title name the thing to remember, and is the summary one useful line? Is the kind right?
6. **Your own message.** Repeat step 5 on one of your own messages. The kind may differ; check it reads sensibly.
7. **Typing first wins.** Open the sheet again and start typing a title straight away.
   - The draft fills only the summary and kind. Your title stays.
   - Try changing the kind before the draft lands. Your choice stays.
8. **A bookmark.** On a bookmarked turn, use **Remember this**, both from the Bookmarks screen (a saved session) and from the thread. It drafts the same way.
9. **A tool result.** Save a capability card to memory. That's a tool's report, for example after a persona looked something up. There should be no "Drafting…" and no line: the sheet opens with the report as its body, and you fill the rest.
   - Check the other side of this rule too. When the same card is bookmarked and saved from **outside** the thread's window, or from a saved session, the sheet holds the safe preview, so it *does* draft. Both are deliberate (PR #231 F-01).
10. **Closing early.** Open the sheet and close it while it's drafting, then reopen it. Nothing stale fills in, and a fresh draft starts.
11. **Saving early.** Open the sheet and type a valid title and summary yourself before the helper answers, then press **Save** at once. The note saves as you see it, and nothing changes afterwards.

## Off, and failure

12. **Off.** Set `proseMinion.workshop.memory.helperDrafts` to off.
    - Save to memory… shows no "Drafting…" and no line.
    - Turn it back on without reloading. Drafting works again.
    - Open a **new** sheet for each check. The switch stops new requests; it doesn't revoke one already under way.
13. **Failure.** Use a model id that doesn't exist, or remove the key temporarily. The sheet shows one muted line, "Couldn't draft a title and summary.", and you can fill it yourself. Put the model and key back before measuring cost and speed.

## Cost, speed and logs

14. **Usage.** The token widget shows the helper's calls. Note a typical cost and how long a draft takes.
15. **The output ceiling.** It's 1,000 tokens, raised from Slice 1's 400 after the first finding below, with reasoning asked off. If a real draft is ever cut off or refused as malformed, note it, with the log line's reasoning count if it shows one.
16. **Logs.** Each draft logs the task, model, outcome and counts, and never the note's text.

## Close-out (after the pass)

- ADR 2026-11-05 (helper agent) → **Accepted**, with any changes the pass asks for.
- Memory-bank entry: decisions, verification, follow-ups.
- `AGENTS.md`:
  - the `helper` scope in the model list;
  - `services/helper/` and `HELPER_TASK_POLICIES` in the architecture;
  - the rule that the helper only proposes and never writes;
  - `memoryDraft.ts` in the message tree.
- **Later task, not built:** D6 `project-locations` (configuring context paths from a workspace scan) stays in the ADR for a later epic.
- **Merging to `main`:** this epic goes to `main` after Bookmark Recall. Whichever of this epic and Persona File Edits reaches `main` second merges the other first.

## Notes from the pass

### 2026-11-06: the first draft came back cut off

- **What happened.** Okey's first Save to memory… was refused:
  `[Helper] memory-draft on anthropic/claude-sonnet-5.5: rejected, cut-off (840 characters), 1,852 tokens`.
  - `840 characters` is the input passage, not the reply.
  - The reply used all 400 output tokens, where a finished `{title, summary, kind}` is about 100 to 130.
  - The second and third tries worked: it's intermittent.
- **Most likely cause.** The model spent its output reasoning. The helper sent no reasoning setting (D1), so a model that decides per call how long to think could spend the ceiling thinking. The other possibility is that it wrote far past the JSON.
- **The fix** (branch `epic/helper-agent-slice-3-fix-cut-off-drafts`; ADR D1, amended 2026-11-06):
  - every helper call asks for reasoning `off`;
  - a model the live catalog marks as always reasoning gets the `light` budget on top of the ceiling instead, never `off` and never a refusal; a catalog that cannot say sends `off`;
  - the ceiling is raised from 400 to 1,000 tokens; the field bounds and `responseCharacters` still hold drafts to their size, and a cut-off is still refused;
  - the log line adds reasoning tokens when the provider reports them (`, 312 reasoning`).
- **To check on the next pass.** Save to memory… several times on the same model. No `cut-off`; if a line shows a reasoning count, note it.

No other findings so far.
