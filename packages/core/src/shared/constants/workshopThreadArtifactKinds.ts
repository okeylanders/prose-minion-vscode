/**
 * The closed set of thread-artifact frame kinds (ADR 2026-07-22; Lightbox
 * Slice 4, ADR 2026-10-19 D11).
 *
 * A frame's `kind` is derived mechanically from what the artifact is, never
 * from its words: a widget commit's `widget:<registry id>`, or a message
 * attachment's own kind. A file or note attachment has none. The frame
 * builder, the session codec and the session's own commit check all read
 * this one registry, so a kind the registry does not name is refused
 * everywhere at once.
 */

import {
  workshopWidgetArtifactKind,
  workshopWidgetIdFromArtifactKind
} from '@shared/constants/workshopWidgets';

/** Message-attachment kinds: a staged attachment that is not a file. */
export const WORKSHOP_MESSAGE_ATTACHMENT_KINDS = ['lightbox-tile', 'selected-text'] as const;

export type WorkshopMessageAttachmentKind = (typeof WORKSHOP_MESSAGE_ATTACHMENT_KINDS)[number];

export function isWorkshopMessageAttachmentKind(kind: unknown): kind is WorkshopMessageAttachmentKind {
  return WORKSHOP_MESSAGE_ATTACHMENT_KINDS.some((known) => known === kind);
}

/** Whether a frame may carry `kind`: a widget kind that round-trips through its registry, or an attachment kind. */
export function isWorkshopThreadArtifactKind(kind: string): boolean {
  if (isWorkshopMessageAttachmentKind(kind)) {
    return true;
  }
  const widgetId = workshopWidgetIdFromArtifactKind(kind);
  return widgetId !== undefined && workshopWidgetArtifactKind(widgetId) === kind;
}

/** What `isWorkshopThreadArtifactKind` accepts, in an error message. */
export const WORKSHOP_THREAD_ARTIFACT_KIND_EXPECTED =
  `widget:<registry id> or ${WORKSHOP_MESSAGE_ATTACHMENT_KINDS.join(', ')}`;

/** The kind a message attachment's frame carries, from its host-owned shape; undefined for a file or note. */
export function workshopMessageAttachmentKind(
  attachment: { lightboxTile?: unknown; selectedText?: unknown }
): WorkshopMessageAttachmentKind | undefined {
  if (attachment.lightboxTile !== undefined) {
    return 'lightbox-tile';
  }
  // `selected-text` is named apart from `editor-selection`, the excerpt's source kind (ADR 2026-11-14 D13).
  return attachment.selectedText !== undefined ? 'selected-text' : undefined;
}

/** What a kind's preamble reads of its attachment: never its body. */
export interface WorkshopMessageAttachmentFrameContext {
  /** A Selected Text attachment's lines, from its meta (1-based, inclusive). */
  selectedText?: { startLine: number; endLine: number };
}

/** The frame context of one artifact, from the message attachments of the turn it rode. */
export function workshopMessageAttachmentFrameContext(
  artifactId: string,
  attachments: readonly { id: string; selectedText?: { startLine: number; endLine: number } }[] | undefined
): WorkshopMessageAttachmentFrameContext {
  const selectedText = attachments?.find((attachment) => attachment.id === artifactId)?.selectedText;
  return selectedText ? { selectedText: { startLine: selectedText.startLine, endLine: selectedText.endLine } } : {};
}

/**
 * What each attachment kind's frame tells the persona before its body, in
 * the extension's words. The body itself stays quoted material. A kind whose
 * preamble names where its text came from (Selected Text's lines) reads that
 * from the attachment's meta, through the frame context.
 */
export const WORKSHOP_MESSAGE_ATTACHMENT_KIND_PREAMBLES: Readonly<
  Record<WorkshopMessageAttachmentKind, (context: WorkshopMessageAttachmentFrameContext) => string>
> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- attachment kinds are kebab-case protocol literals.
  'lightbox-tile': () =>
    'A reading the writer brought from the Lightbox. Its claim is a model\'s reading of the chapter, offered to discuss, ' +
    'not a finding. Its quotes were found in the chapter when it was brought.',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- attachment kinds are kebab-case protocol literals.
  'selected-text': (context) => {
    const lines = context.selectedText;
    if (!lines || !Number.isSafeInteger(lines.startLine) || !Number.isSafeInteger(lines.endLine)) {
      // The lines are the meta's, host-written; a frame that cannot say them is never built.
      throw new Error('A selected-text thread artifact needs its lines');
    }
    const where = lines.startLine === lines.endLine
      ? `at line ${lines.startLine}`
      : `at lines ${lines.startLine}–${lines.endLine}`;
    return `Text the writer selected in this file, ${where}, when the message was sent. ` +
      'It is the passage the message is about: not the writer\'s own words in this message, and not the room\'s excerpt.';
  }
};
