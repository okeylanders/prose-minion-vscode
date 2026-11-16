# Feature: Send the Editor Selection With Each Message

**Date Identified:** 2026-11-07
**Status:** Idea. Needs a short ADR, for a change to the `EditorContext` platform port and a new message-attachment kind.
**Priority:** Medium
**Origin:** Okey, 2026-11-07

## In Okey's words

> It'd be nice to turn on/off whatever the user has selected in an open
> Markdown file to automatically be sent with the message.

## Problem

While talking with a persona, the writer often means "these lines": the
sentence they just reworked, the paragraph that isn't landing. Today there
are two ways to show it, and neither fits:

- **Paste it** into the message. That costs a copy, a switch and a paste,
  and the persona can't tell pasted text from the writer's own words.
- **Send Selection to Workshop** (`prose-minion.workshopSelection`). This
  *replaces the room's excerpt* with the selection (`seedExcerpt`, source
  kind `editor-selection`). That is a revision of the whole room's working
  passage, for every participant, when the writer only meant to point at a
  few lines.

## Idea

A toggle by the composer: **Include selection**.

- **While it's on,** a chip by the composer shows what is selected right
  now: `alice-ch3.md · lines 40–44 · 62 words`, with the first few words.
  It updates as the writer selects in the editor.
- **On send,** that selection goes with the message as an attachment. It
  is quoted with its file and lines, and marked as the writer's selection,
  not their words. The room's excerpt doesn't change.
- **Nothing selected, nothing sent.** The chip says "Nothing selected", and
  the message goes alone.
- **Off is the default.** The toggle is a composer preference, remembered
  for the window.

## What is already in place

- **The selection port.** `EditorContext.getActiveSelection()` gives text,
  file (`uriString`, `relativePath`) and 1-based lines. Its VS Code
  implementation (`VsCodeEditorContext`) already ignores output panes and
  the debug console. It also falls back to the last selection when a
  webview has focus, which is exactly the writer typing in the Workshop.
- **Staged message attachments.** A Lightbox tile is staged above the
  composer and sent with the message. Its kind lives in
  `WORKSHOP_MESSAGE_ATTACHMENT_KINDS` (`shared/constants/workshopThreadArtifactKinds.ts`),
  which the frame builder, the session codec and the commit check all read.
  Its body is neutralized like any other.
- **A selection as a source.** The excerpt's `editor-selection` source
  already records file and lines.

## Design direction (for the ADR)

- **Fix "last selection" first.** `VsCodeEditorContext` updates
  `lastSelection` only on a non-empty selection. If the writer deselects in
  the file, the old selection stays. For a manual command that is harmless,
  but an automatic send would include text the writer had deselected.
  - The port needs the *current* selection of the last focused text editor,
    empty included.
  - It also needs a change event, so the chip can follow the selection
    instead of polling.
  - Updates are throttled, since a drag fires many events.
  - A selection in a document that has since closed counts as nothing.
- **What you saw is what was sent.** The host keeps each selection as a
  snapshot with an id, and pushes the composer the snapshot's file, lines,
  word count and preview. The composer sends the id it showed, and the host
  attaches that snapshot.
  - The text never goes webview → host.
  - A selection changed in the instant between the chip and the press can't
    swap in unseen text.
  - This is the Lightbox's "send ids only" rule.
- **A new attachment kind,** `editor-selection`, joining
  `WORKSHOP_MESSAGE_ATTACHMENT_KINDS`, with its frame, codec and commit
  check. The frame says the text is the writer's selection from a file at
  given lines, at the moment of sending, so the persona never reads it as
  the writer's message or as the room's excerpt.
- **Never send what the composer can't show.** While the toggle is on, the
  chip is always visible. A selection that's too large is cut to a bound
  (in `PROMPT_BUDGETS`), and the chip says so *before* the send. The sent
  bubble shows the attachment like any other.
- **Visibility.** The selection reaches whoever sees the writer's message,
  by the room's own rule. It is part of the message, not a room-wide frame.

## Open questions

- **Markdown only?** The existing selection commands don't filter by
  language. Markdown only, Markdown and plain text, or any text file?
- **A selection inside the excerpt.** If the writer selects lines the
  pinned excerpt already holds, the persona already has the text. Send a
  pointer ("excerpt lines 40–44") instead of the text again? It is cheaper,
  and it says exactly where in the excerpt the writer means.
- **The bound.** How long a selection may be before it is cut, and whether
  a whole-chapter selection (Ctrl+A) should be refused with "pin it as the
  excerpt instead".
- **Remembered where?** Per window (a composer preference), or per room, so
  it is saved with the session?
- **Rewind and the composer.** Rewind restages a cut message's attachments
  into the composer (`composerRestoreFor`). A selection attachment restages
  as the text it captured, not as the live selection. Say so on the pill?
- **Export and recall.** Attachment text is host-private and never enters
  the transcript projection. The transcript shows the pill ("Selection:
  alice-ch3.md, lines 40–44") without the text. Confirm that.

## Completion Criteria

- [ ] An ADR records the port change (current selection, empty included,
      plus a change event), the snapshot ids, the `editor-selection` kind and
      its frame, and the bound.
- [ ] With the toggle on, the chip follows the editor's selection. Sending
      attaches exactly the snapshot the chip showed, which a test witnesses
      by changing the selection between the chip and the send.
- [ ] Deselecting in the file clears the chip, and nothing is sent.
- [ ] A selection over the bound is cut, and the chip says so before the
      send.
- [ ] The excerpt is unchanged by a send. The persona's frame marks the text
      as the writer's selection, neutralized.
- [ ] The session codec reads the new kind, and Rewind, Branch and export
      handle it.
- [ ] Logs carry counts and the kind, never the selected text or the path.
      Fixtures use *Alice*.

## Related

- [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md)
  D11: staged message attachments and their kinds.
- [ADR 2026-10-05: Workshop Transcript Export](../../../docs/adr/2026-10-05-workshop-transcript-export.md):
  what a transcript shows of an attachment.
- [ADR 2026-09-30: Workshop Rewind and Branch](../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md):
  restaging a cut message's attachments.

## Related Files

- `packages/core/src/platform/EditorContext.ts` (`ActiveSelectionInfo`, `getActiveSelection`)
- `apps/vscode-extension/src/platform/vscode/VsCodeEditorContext.ts` (`lastSelection`)
- `apps/vscode-extension/src/extension.ts` (`handleWorkshopSelection`, `prose-minion.workshopSelection`)
- `packages/core/src/shared/constants/workshopThreadArtifactKinds.ts`
- `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts` (`composerRestoreFor`)
- `packages/core/src/presentation/webview/WorkshopApp.tsx` (the composer)
