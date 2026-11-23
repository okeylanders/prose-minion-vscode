# Feature: A Long Paste Becomes a "Pasted Text" Pill

**Date Identified:** 2026-11-23 (planned 2026-09-03 as Sprint 02 of the Multimodal Composer epic; split out here)
**Status:** Idea. Small to medium. Buildable now on the message-attachment kinds Selected Text added, without the epic's schema-v3 work. Short ADR section, or an addendum to ADR 2026-11-14.
**Priority:** Medium
**Origin:** Okey, 2026-11-23 ("do we already have pasted text showing up as a pill instead of filling up the message bubble?")

## What happens today

- **A paste goes straight into the composer.** The Workshop composer has no
  paste handling: a 3,000-word paste fills the textarea and then the sent
  bubble.
- **The pill was planned in September.** [The Multimodal Composer
  epic](../../epics/epic-workshop-multimodal-composer-2026-09-03/epic-workshop-multimodal-composer.md),
  [Sprint 02](../../epics/epic-workshop-multimodal-composer-2026-09-03/sprints/02-long-paste-composer-flow.md),
  is still a Draft. That sprint depends on Sprint 01's typed artifacts and
  a schema-v3 session format, built for images, audio and video.

## Why it can stand alone now

Selected Text (Everyday Conveniences, ADR 2026-11-14 D9–D17) built the
pieces a text pill needs:
- **a registry of attachment kinds** (`workshopThreadArtifactKinds`:
  `lightbox-tile`, `selected-text`) that the frame builder, the session
  codec and the commit check all read;
- **an optional, additive meta key** on a pending attachment and a turn's
  attachment reference, with no `schemaVersion` bump;
- **identity rules** (`WorkshopMessageAttachmentIdentity`), so Rewind's
  restage and hydration never stage a pill twice;
- **export and recall that show the label only.**

A `pasted-text` kind is one more entry in that registry. The epic's media
work (binary assets, multipart messages) keeps its own path.

## Idea (Sprint 02's plan, adapted)

1. **Paste at or past the threshold becomes a pill.** A `text/plain` paste
   of **500 characters or more** (Okey's choice, P1) is not inserted. Whatever was already typed stays as it is, and a **"Pasted
   text"** pill joins the tray with its word count. A shorter paste is the
   textarea's own behavior, byte for byte.
2. **The host owns it.** `WORKSHOP_STAGE_MESSAGE_TEXT`, a correlated
   request:
   - the host bounds the text, labels it, mints its `ta-N` and marks the
     session dirty;
   - until it answers, the pill shows as pending and Send waits;
   - a refusal (a run active, the tray full) says why and leaves the
     clipboard alone.

   The text does travel from the webview here, as a message's own text
   does: the writer pasted it.
3. **Bounds:** words and characters in `PROMPT_BUDGETS`. A paste over the
   bound is cut at staging, and the pill says so before the send, as
   Selected Text does.
4. **Inspect and edit before sending.** Clicking the pill opens the text
   sheet (`WorkshopTextSheet`, its paste case) to read or edit it. An edit
   keeps the same `ta-N`.
5. **After the send,** the bubble shows the pill, not the text.
   [Click a sent pill](../feature-workshop-sent-attachment-viewer/README.md)
   (#34) then shows what was sent.
6. **A message can be only an attachment.** If the draft is empty, the
   bubble says "Shared 1 attachment", and the persona receives the pasted
   text alone, with no instruction invented for it.
7. **The frame marks the text as the writer's pasted material,**
   neutralized like every attachment body, never read as instructions.
8. **Each paste is its own pill.** Pasting the same text twice stages two,
   unless the ADR chooses to deduplicate.
9. **"Insert into message" moves it back** (P2). The pill offers an action
   that puts its text into the composer at the cursor, as if pasted
   normally, and removes the pill. For the paste the writer did want in the
   textarea.
   - It goes through the composer's restore rule: never replacing newer
     typing (`workshopComposerDraftAfterSeed`).
   - The host releases the staged text in the same step, so nothing is
     staged twice.

## Decisions (Okey, 2026-11-23)

| # | Decision | Notes |
|---|---|---|
| P1 | **The threshold is 500 characters.** | Lower than the epic's 2,000: about a paragraph, which keeps the composer for the message itself. A shorter paste stays native. It lives in `PROMPT_BUDGETS`, not a setting. |
| P2 | **The pill has an "Insert into message" action** that moves the text back into the composer. | Ada's lean, taken. It replaces any modifier key for "paste as text". |

## Completion Criteria

- [ ] A paste under 500 characters behaves natively. One at or over it
      stages one host-owned "Pasted text" pill and leaves the draft alone
      (tests at 499 and 500).
- [ ] "Insert into message" puts the text into the composer at the cursor
      without replacing newer typing, and releases the pill (test).
- [ ] The pill can be inspected, edited, removed, sent, and kept through a
      refused or failed send, without losing it (tests).
- [ ] `pasted-text` joins `workshopThreadArtifactKinds`. The session codec
      change is optional and additive, and an authentic fixture from before
      it still reads.
- [ ] Export and recall show the label only.
- [ ] Logs carry counts only, never the pasted text.

## Related

- [Multimodal Composer epic](../../epics/epic-workshop-multimodal-composer-2026-09-03/epic-workshop-multimodal-composer.md),
  Sprint 02: the original plan. Its media sprints stay there.
- [Click a sent pill](../feature-workshop-sent-attachment-viewer/README.md) (#34).
- [ADR 2026-11-14](../../../docs/adr/2026-11-14-everyday-conveniences.md):
  Selected Text, the pattern this follows.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx`
- `packages/core/src/presentation/webview/components/workshop/WorkshopComposerAttachments.tsx`
- `packages/core/src/shared/constants/workshopThreadArtifactKinds.ts`
- `packages/core/src/application/services/workshop/WorkshopThreadArtifactFrame.ts`
- `packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx`
