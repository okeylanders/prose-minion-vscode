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
export const WORKSHOP_MESSAGE_ATTACHMENT_KINDS = ['lightbox-tile'] as const;

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
  attachment: { lightboxTile?: unknown }
): WorkshopMessageAttachmentKind | undefined {
  return attachment.lightboxTile !== undefined ? 'lightbox-tile' : undefined;
}

/**
 * What each attachment kind's frame tells the persona before its body, in
 * the extension's words. The body itself stays quoted material.
 */
export const WORKSHOP_MESSAGE_ATTACHMENT_KIND_PREAMBLES: Readonly<Record<WorkshopMessageAttachmentKind, string>> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- attachment kinds are kebab-case protocol literals.
  'lightbox-tile':
    'A reading the writer brought from the Lightbox. Its claim is a model\'s reading of the chapter, offered to discuss, ' +
    'not a finding. Its quotes were found in the chapter when it was brought.'
};
