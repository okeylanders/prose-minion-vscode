# Feature: Click a Sent Attachment Pill to See What Was Sent

**Date Identified:** 2026-11-23
**Status:** Implemented with the paste pill on `sprint/highlights-attachment-conveniences`. A sent pill in the live room or its earlier pages opens a read-only text sheet.
**Priority:** Medium
**Origin:** Okey, 2026-11-23

## In Okey's words

> The selection text bubble on the thread after submitting a message: I
> would like to make that clickable so the user can see the text that was
> sent up in a popup.

## What happens today

- **A sent message shows its attachments as plain labels** under the
  writer's bubble (`WorkshopTurnBubble`, `.pm-ws-turn-attachment`): a
  "Selected Text" pill, a file, or a Lightbox tile, each with its size.
  Nothing happens on a click.
- **The text that went with the message is kept on the host.** Each
  attachment is a thread artifact (`ta-N`) in the room's session, with its
  bounded body (`WorkshopThreadArtifact.content`). The webview only ever
  gets display-safe metadata (`WorkshopMessageAttachmentSnapshot`).
- **So once the selection changes in the editor,** the writer has no way to
  see what the persona actually received.

## What already exists to build on

- **A read-only text sheet.** `WorkshopTextSheet` already shows an attached
  file, a file a persona read (Read in), and a turn outside the loaded
  window. It previews through the shared sanitized `MarkdownRenderer`.
- **A content route to copy.** The context panel asks for one attachment's
  body by id (`WORKSHOP_REQUEST_CONTEXT_ATTACHMENT` →
  `WORKSHOP_CONTEXT_ATTACHMENT_CONTENT`).

## Idea

1. **Every sent attachment pill becomes a button.** That covers Selected
   Text first, and files and Lightbox tiles too, since all three are
   thread artifacts and take the same route. Clicking opens the text sheet
   read-only, showing:
   - **the text exactly as it was sent:** the stored body, not the file or
     selection as it is now;
   - **where it came from:** for Selected Text, the file and lines; for a
     file, its path; for a tile, its board and tile;
   - **whether it was cut** at send, and how much was kept ("first 2,000
     of 3,400 words");
   - **for a file, "Open current file"** as the escape hatch, labeled so
     it's clear the file may have changed since.
2. **A correlated read, ids only.** `WORKSHOP_REQUEST_MESSAGE_ATTACHMENT`
   carries `{ requestId, roomRevision, artifactId }`. The host:
   - checks the revision against the live room;
   - finds the artifact in the room's `threadArtifacts`;
   - checks that it is a message attachment, by its kind in
     `workshopThreadArtifactKinds`, never a widget commit (widget payloads
     stay host-private);
   - answers with the body, or a refusal in host words ("That message was
     rewound away.").

   The webview takes only the answer it is waiting for, and persists
   nothing.
3. **Earlier turns work the same way.** A page of earlier turns holds full
   bubbles, and their artifacts are still in the room.
4. **Nothing else changes.**
   - Transcript export and recall still show the label only ("Selected
     Text"), never the text (ADR 2026-11-14 D16).
   - The read-only turn reader (a bookmark from a saved session) keeps
     labels only.

## Decisions (Okey, 2026-11-23)

| # | Decision | Notes |
|---|---|---|
| V1 | **Show the writer's text with neutralized frame markers decoded,** and say so in the sheet's header. | The stored body may hold markers encoded before it went to the persona. "The text that was sent" means the writer's own words, so the sheet undoes the encoding for display. The header says, for example, "As sent with your message; protective markers shown as you wrote them." |

## Open questions

- **Saved sessions' bubbles.** Opening a saved session puts its turns back
  in the live room, so this works there too. Only the bookmark reader for
  a session that isn't open would lack it, and that is fine for now.

## Completion Criteria

- [x] Every message attachment pill on a sent bubble is a button with an
      accessible name ("Show the Selected Text that was sent"), and opens
      the read-only sheet (test).
- [x] The sheet shows the stored body, its source (file and lines, path,
      or tile) and any cut, never the current file or selection (test).
- [x] Neutralized frame markers are decoded for display, through the same
      rule that encoded them, and the header says so (V1, test).
- [x] The route carries ids only, compares `roomRevision`, refuses a
      widget artifact and a rewound turn in host words, and only the
      pending answer is taken (tests).
- [x] Export and recall are unchanged: label only (the existing projection
      test still passes).
- [x] Logs carry ids, kinds and counts, never the text, a path or lines.

## Implementation and verification

The host checks the request id, room revision, owning turn and artifact together. Only successful room deliveries publish a retained copy. Private instrument messages and messages without a committed body explain why no copy is available. Configured files and safely identified files under a single workspace root offer **Open current file**. Historical external picks identified only by a display name and ambiguous workspace paths cannot be reopened by that name.

The retained body already holds the original bounded characters. The send-time frame encodes reserved delimiters separately. The sheet therefore preserves both literal tags and deliberately typed HTML entities. It shows the bounded body as selectable plain text.

`WorkshopSentAttachmentRoutes.test.ts` covers normal file, selection and Lightbox sends, restored data, source authorization, and rejected private, widget and stale requests. `WorkshopApp.earlierTurns.test.tsx` covers clicking a pill on an earlier page and literal rendering. `useWorkshopSentAttachments.test.ts` covers overlapping requests, closing, reopening and room replacement. The transcript projection still exposes the label only.

## Related

- [ADR 2026-11-14: Everyday Conveniences](../../../docs/adr/2026-11-14-everyday-conveniences.md)
  D9–D17: Selected Text, its frame and its export rule.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
  (the pills)
- `packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx`
  (the read-only cases)
- `packages/core/src/application/services/workshop/WorkshopThreadArtifactFrame.ts`
  (`WorkshopThreadArtifact`)
- `packages/core/src/shared/constants/workshopThreadArtifactKinds.ts`
- `packages/core/src/shared/types/messages/workshop/context.ts`
  (`WorkshopMessageAttachmentSnapshot`, the context-attachment route to copy)
- `packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts`
  (the existing content route)
