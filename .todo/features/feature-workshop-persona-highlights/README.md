# Feature: Personas Highlight Passages in the Editor

**Date Identified:** 2026-11-26
**Status:** Idea. Medium. A short ADR: a new reply trailer, and a second door to the editor's annotations, amending ADR 2026-10-21 D10.
**Priority:** Medium
**Origin:** Okey, 2026-11-26

## In Okey's words

> Let the persona highlight (add information notices) to the excerpt, like
> how craft flags does the squigglies with the note in the problems panel.
> For example I might ask, can you highlight all the decorated speech tags
> for me, and tell me which ones to keep?

> Oh, well it's bigger than speech tags. It's really anything like,
> highlight the moments [when] Nate does a roll call. Or highlight the one
> roll call I should remove.

So a highlight marks a **moment**, not just a word: a gesture, a habit, a
beat that repeats, the one that should go.

## What happens today

- **A persona can only point in prose.** "The tag in your third paragraph"
  leaves the writer hunting through the chapter. With twelve places, the
  reply turns into a list of quotes.
- **Craft Flags already draws exactly this.** `IssueAnnotator`
  (`platform/IssueAnnotator.ts`) shows notes as diagnostics: squiggles, the
  Problems panel and F8, with Dismiss and Clear. The adapter keeps each note
  on its text while the writer types.
- **A third family is one line.** `VsCodeFlagFamily`
  (`VsCodeIssueAnnotator.ts`) gives Proofread and Craft Flags each their
  own collection and Problems-panel source. A Workshop family would have
  its own too, so clearing one never clears another.
- **The door is guarded.** `boundaries.test.ts` lets only Draft Edit's runs
  and applier reach `IssueAnnotator` (ADR 2026-10-21 D10). This feature
  opens a second, narrow door: annotations only, never `DocumentEditor` or
  `applyEdits`.

## Idea

### 1. The persona marks places with a trailer

A reply ends with one `<prose-minion-highlights>` frame naming the file and
listing places:

- **the file:** `<excerpt/>`, or `<group>` and `<path>`, as file edits name
  files. A pasted excerpt has no file and can't be highlighted;
- **each place:** a quote, or a span from one quote to another for a
  moment longer than a line (a roll call that runs a paragraph); the text
  just around it when the quote repeats; a stance; and a short note.

It is read in `extractWorkshopReplyControls`' one pass, like the other
trailers, and bounded by `PROMPT_BUDGETS.workshopHighlights` (places per
reply, quote and note lengths). A sync test holds the prompt to the codec.

### 2. Stances: what to do with it (H3)

The writer's "tell me which ones to keep" becomes a closed vocabulary:

| Stance | Problems panel reads |
|---|---|
| `keep` | Jill · keep: this roll call lands; it's the first time Nate counts heads under fire. |
| `change` | Jill · change: this roll call repeats the first one's beat; cut it, or let him skip a name. |
| `note` | Jill · note: roll call, third time in this chapter. |

`change` covers a cut; the note says what to do. "Highlight the one roll
call I should remove" is a single `change`, beside `note`s for the others
if the writer asked to see them all.

Each note is info severity, prefixed with the persona's name, with its
stance as the diagnostic code (`workshop.keep`, `workshop.change`,
`workshop.note`), so the Problems panel can filter by it.

### 3. Host code places every quote

The model never gives offsets or line numbers. As Draft Edit does
(`utils/draftEdit/anchorEdits.ts`):

- **Each quote is anchored by host code in the live file:** found exactly
  once, or placed by its surrounding text.
- **A span is anchored at both ends,** in order, within a bounded number of
  paragraphs (`spanParagraphs`). If either end fails, the place is dropped.
- **A repeated phrase can be marked everywhere** (`occurrences="all"`), for
  "every 'said softly'", within the per-reply bound.
- **A quote not found, ambiguous, or inside protected text** (front matter,
  code, link targets) is dropped and counted, never guessed.
- **The live file wins.** The excerpt the persona read may be older than
  the file. Places are anchored against the file as it is when they land;
  what it no longer holds is dropped.
- **The persona hears back** through trailer outcomes: a `highlights` side
  with counts landed and dropped, by closed reason ("2 quotes weren't found
  in the file"). Counts only.

### 4. Where and when they show (H2)

- **If the file is open, they're drawn at once.** Otherwise the reply's
  footer shows a chip, "Show 12 highlights in chapter-06.md", which opens
  the file and draws them.
- **The chip stays on the bubble.** After a Clear, a close or a reload
  (diagnostics are session-only), it draws them again, anchored afresh
  against the live text.
- **A reply's highlights replace that reply's earlier ones,** never another
  reply's or another persona's.
- **Each note offers Dismiss, and "Clear this reply's highlights".**
- **A Rewind that removes the reply clears its highlights.**

### 5. Read-only, and it pairs with file edits (H4)

Highlights never change the text. For the `change` ones, the persona's
existing reply edit-offer chip ("Apply 5 fixes") turns them into
[Persona File Edits](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md)
cards through that feature's own path. Nothing new writes.

### 6. Recorded on the reply

`highlights` on the reply turn is an optional, exact field (the file, each
place's quote, context, stance and note), so the chip can redraw them.
There is no `schemaVersion` bump, and an authentic session fixture from
before must keep reading. Transcript export shows one event line with a
count, never the quotes.

## Decisions to make

| # | Question | Ada's lean |
|---|---|---|
| H1 | When does a persona highlight? | When the writer asks ("highlight", "mark", "show me where"). Otherwise it may offer: "Want me to highlight them?" Never unasked. |
| H2 | Draw at once, or only on the chip? | At once if the file is open; the chip otherwise, and to redraw. |
| H3 | Stances? | `keep`, `change` and `note`. |
| H4 | Can a highlight carry a quick fix? | No. Fixes go through the edit-offer chip and Persona File Edits' cards, so there is one write path. |
| H5 | Can Passage Search's results be shown as highlights? | Yes, as a follow-up. Its instances are already anchored quotes, so this needs no new engine. |

## Limits, stated

- **"Every" means every one the persona found.** It reads the excerpt; in
  a long chapter it can miss one.
- **Across the manuscript, that's Passage Search's job.** "Highlight every
  roll call in the book" is a question
  [Passage Search](../feature-passage-search/README.md) (#29) already
  answers, file by file, with host-anchored quotes, notes and labels. A
  natural follow-up (H5): show a search's results as highlights, from the
  Search tab or from a persona's passage-search card. It would be a button,
  not a new engine.
- **A file read only through `resource.read`** can be highlighted too, but
  the persona may have read only part of it.

## Completion Criteria

- [ ] A reply's highlights land as info diagnostics in their own collection
      and source, with the persona's name and stance, and neither Proofread's
      nor Craft Flags' Clear touches them (tests).
- [ ] Quotes are anchored by host code in the live file; not found,
      ambiguous and protected quotes are dropped and counted, and the persona
      is told the counts (tests).
- [ ] `occurrences="all"` marks every occurrence within the bound (test).
- [ ] A span from one quote to another highlights the whole moment, and a
      span whose end fails to anchor is dropped (tests).
- [ ] The chip draws a reply's highlights again after Clear, close and
      reload; a Rewind removing the reply clears them (tests).
- [ ] The new door reaches only the annotator, never `DocumentEditor` or
      `applyEdits`, held by `boundaries.test.ts` and an ADR 2026-10-21 D10
      amendment.
- [ ] The session field is optional and exact, and the pre-feature fixture
      still reads.
- [ ] A help section explains asking for highlights, the chip and Clear.
- [ ] Logs carry counts, stances and reasons, never a quote, a note or a
      path.

## Related

- Craft Flags (ADR 2026-10-21, Slice 3c): the annotator and its notes.
- [Reply edit actions](../../archive/features/feature-workshop-reply-edit-actions/README.md)
  and Persona File Edits: how the `change` ones get applied.
- [Passage Search](../feature-passage-search/README.md) (#29): every
  moment across the manuscript, and H5.

## Related Files

- `packages/core/src/platform/IssueAnnotator.ts`
- `apps/vscode-extension/src/platform/vscode/VsCodeIssueAnnotator.ts`
  (`VsCodeFlagFamily`, `CRAFT_FLAGS`)
- `packages/core/src/utils/draftEdit/anchorEdits.ts`
- `packages/core/src/utils/workshopReplyControls.ts` (`extractWorkshopReplyControls`)
- `packages/core/src/application/services/workshop/trailerOutcomes/`
- `packages/core/src/__tests__/architecture/boundaries.test.ts`
  (the Draft Edit document-port rule)
