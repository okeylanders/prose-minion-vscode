# Feature: Personas Highlight the Excerpt's File

**Date Identified:** 2026-11-26
**Status:** In development on `epic/workshop-persona-highlights`. See the [architecture runway](runway.md).
**Priority:** Medium
**Origin:** Okey, 2026-11-26

## Sprint branches

Each sprint targets `epic/workshop-persona-highlights`. The common base contains the reply codec, quote placement rules and the editor service contract.

| Branch | Deliverable | Review case |
|---|---|---|
| `sprint/highlights-persona` | Persona instructions and writer help | Ask for any passage or accept an offer in a file-backed room |
| `sprint/highlights-editor` | VS Code diagnostics, per-room ownership and window-wide Clear All | Stack sets in one file, edit their text, then clear one set |
| `sprint/highlights-settlement` | Run binding, committed reply, persistence, projection and outcomes | Switch rooms during a reply, reload an older session and inspect the exported transcript |
| `sprint/highlights-controls` | Footer actions, routing and lifecycle cleanup | Show a retained set after Clear or reload, then rewind away its turn |

## In Okey's words

> I literally just want to say whatever about whatever and the persona can
> highlight whatever about whatever with a note in the open excerpt's file.
> For example, I run a fresh report, a craft steering report, a stock and
> signature report. I make, say, Jill highlight all the signature lines from
> the report, after that highlight the lines that Fresh called boring or
> expected, then highlight the lines that craft steering said was choppy.
> Also, can you highlight [where] it talks about so and so's sweater.

## The idea

**A general tool: the writer asks for anything, and the persona highlights
the passages that answer it, each with its own note, in the excerpt's
file.**
- The request can be about anything in the persona's context: the
  conversation, an attached Lightbox tile or report, a file it read, or its
  own reading of the excerpt.
- The highlights show the way Craft Flags' do: squiggles, notes in the
  Problems panel, and F8 to step through them.

## What exists to build on

- **Craft Flags already draws notes in the editor.** `IssueAnnotator`
  (`platform/IssueAnnotator.ts`) shows them as diagnostics with Dismiss and
  Clear, and the adapter keeps each one on its text while the writer types.
- **A third family is one line.** `VsCodeFlagFamily`
  (`VsCodeIssueAnnotator.ts`) gives Proofread and Craft Flags each their own
  collection and Problems-panel source. The Workshop gets its own, so
  clearing one never clears another.
- **Host code already places quoted text.** Draft Edit anchors a model's
  quotes in the live document (`utils/draftEdit/anchorEdits.ts`). The model
  never gives offsets.
- **The door is guarded.** `boundaries.test.ts` lets only Draft Edit's runs
  and applier reach `IssueAnnotator` (ADR 2026-10-21 D10). This feature
  opens a second, narrow door: annotations only, never `DocumentEditor` or
  `applyEdits`.

## How it works

1. **The persona ends its reply with one highlights frame:**
   - a short **title** for the set (for example "Signature lines" or
     "Fresh: expected");
   - the **places**, each a quote, or a span from one quote to another for
     a longer passage, with the text just around it when a quote repeats;
   - a **note** for each place, in the persona's own words.

   It is read in `extractWorkshopReplyControls`' one pass, like the other
   trailers, and bounded by `PROMPT_BUDGETS.workshopHighlights` (places per
   set, quote, title and note lengths). A sync test holds the prompt to the
   codec.
2. **Host code places every quote in the live file.**
   - A quote is placed if it is found exactly once, or placed by its
     surrounding text. A span is anchored at both ends, in order.
   - A quote not found, or ambiguous, is dropped and counted, never
     guessed. So is one inside protected text (front matter, code, link
     targets).
   - The file as it is now wins over the excerpt the persona read.
3. **The persona hears back** through trailer outcomes: how many landed and
   how many were dropped, by closed reason. Counts only.
4. **Each note reads "Jill · Signature lines: …"** at info severity, so the
   Problems panel can be filtered by persona or set.
5. **Sets stack.** Each request is its own set, so signature lines, Fresh's
   lines and the choppy lines can all show at once.
   - The reply's footer chip names its set: "Signature lines · 9
     highlights", with Show and Clear.
   - A set is cleared on its own, or every set at once.
6. **When they show.**
   - They're drawn at once if the file is open; otherwise the chip opens it
     and draws them.
   - A valid proposed set opens a confirmation over its Workshop chat. **Apply highlights** keeps it. **Show** on a saved reply redraws the set directly.
   - Reopening a session offers to restore its eligible sets for the current excerpt after the startup release notice closes. **Not now** defers for this opening. **Don’t ask again for these highlights** remembers the choice for the displayed sets. Newly kept sets remain eligible on the next opening.
   - A Rewind that removes the reply clears its set.
7. **Read-only.** Highlights never change the text. If the writer then
   wants changes, the persona's existing edit-offer chip and Persona File
   Edits' cards are the one path that writes.
8. **Recorded on the reply.** `highlights` on the reply turn is an optional,
   exact field (title, places, notes), so the chip can redraw the set. There
   is no `schemaVersion` bump, and an authentic session fixture from before
   must keep reading. Transcript export shows one event line with a count.

## Decisions

| # | Decision | By |
|---|---|---|
| H0 | **General purpose.** Any passage, any note, about anything the writer asks, in the open excerpt's file. | Okey, 2026-11-26 |
| H1 | **Confirm before applying.** An express request or a concrete persona proposal may produce a set for the writer to accept in chat. A general offer in prose needs no dialog. | Okey, 2026-11-27 (Ada's lean) |
| H2 | **The excerpt's file first.** Other project files come later, named as file edits name them. | Okey, 2026-11-27 (Ada's lean) |


## Limits, stated

- **"All" means all the persona found.** It reads the excerpt, and in a
  long chapter it can miss one.
- **Across many files,** finding every instance is
  [Passage Search](../../features/feature-passage-search/README.md)'s job. Showing a
  search's results as highlights would be a natural follow-up.

## Completion Criteria

- [ ] A reply's set lands as info diagnostics in their own collection and
      source, each note with the persona's name and the set's title, and
      neither Proofread's nor Craft Flags' Clear touches them (tests).
- [ ] Quotes and spans are anchored by host code in the live file; not
      found, ambiguous and protected places are dropped and counted, and the
      persona is told the counts (tests).
- [ ] Sets from several replies show together; each clears on its own, and
      Clear all clears every set (tests).
- [ ] The chip redraws a set after Clear, close and reload; a Rewind
      removing the reply clears it (tests).
- [ ] The new door reaches only the annotator, never `DocumentEditor` or
      `applyEdits`, held by `boundaries.test.ts` and an ADR 2026-10-21 D10
      amendment.
- [ ] The session field is optional and exact, and the pre-feature fixture
      still reads.
- [ ] A help section explains asking for highlights, the chip and Clear.
- [ ] Logs carry counts and reasons, never a quote, a note, a title or a
      path.

## Related

- Craft Flags (ADR 2026-10-21, Slice 3c): the annotator and its notes.
- [Persona File Edits](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md)
  and [reply edit actions](../../archive/features/feature-workshop-reply-edit-actions/README.md):
  the one write path.
- [Passage Search](../../features/feature-passage-search/README.md) (#29).

## Related Files

- `packages/core/src/platform/IssueAnnotator.ts`
- `apps/vscode-extension/src/platform/vscode/VsCodeIssueAnnotator.ts`
  (`VsCodeFlagFamily`, `CRAFT_FLAGS`)
- `packages/core/src/utils/draftEdit/anchorEdits.ts`
- `packages/core/src/utils/workshopReplyControls.ts` (`extractWorkshopReplyControls`)
- `packages/core/src/application/services/workshop/trailerOutcomes/`
- `packages/core/src/__tests__/architecture/boundaries.test.ts`
  (the Draft Edit document-port rule)
