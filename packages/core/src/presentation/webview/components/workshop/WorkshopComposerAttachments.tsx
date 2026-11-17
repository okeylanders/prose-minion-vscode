/**
 * The pills above the Workshop composer: what rides the next message. Staged
 * attachments (host truth) each with a remove button, then the live Selected
 * Text pill when the toggle is on (ADR 2026-11-14 D14). Moved out of
 * `WorkshopComposer` unchanged, to keep that file within its size.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { workshopAttachmentSize, workshopAttachmentTitle } from '@components/workshop/workshopAttachmentPills';
import {
  WorkshopLiveSelectedTextPill,
  type WorkshopComposerSelectedText
} from '@components/workshop/WorkshopSelectedTextControls';
import type { WorkshopMessageAttachmentSnapshot } from '@messages';

interface WorkshopComposerAttachmentsProps {
  /** Staged one-shot attachments for the next message (host truth). */
  attachments: readonly WorkshopMessageAttachmentSnapshot[];
  livePill: WorkshopComposerSelectedText['livePill'];
  onRemove: (id: string) => void;
}

export const WorkshopComposerAttachments: React.FC<WorkshopComposerAttachmentsProps> = ({
  attachments,
  livePill,
  onRemove
}) => {
  if (attachments.length === 0 && !livePill) {
    return null;
  }
  return (
    <div className="pm-ws-comp-attachments" aria-label="Attachments for this message">
      {attachments.map((attachment) => (
        <span
          key={attachment.id}
          className={`pm-ws-comp-attachment${attachment.lightboxTile ? ' pm-ws-comp-attachment-lightbox' : ''}${attachment.selectedText ? ' pm-ws-comp-attachment-selected' : ''}`}
          title={workshopAttachmentTitle(attachment)}
        >
          <Icon name={attachment.lightboxTile ? 'pin' : 'doc'} size={11} />
          <span className="pm-ws-comp-attachment-label">{attachment.label}</span>
          <span className="pm-ws-comp-attachment-size">{workshopAttachmentSize(attachment, 'composer')}</span>
          <button
            type="button"
            className="pm-ws-comp-attachment-remove"
            title={`Remove ${attachment.label} from this message`}
            aria-label={`Remove ${attachment.label} from this message`}
            onClick={() => onRemove(attachment.id)}
          >
            <Icon name="x" size={10} />
          </button>
        </span>
      ))}
      {attachments.length > 0 && <span className="pm-ws-comp-attachment-hint">rides the next message only</span>}
      {livePill && <WorkshopLiveSelectedTextPill live={livePill} />}
    </div>
  );
};
