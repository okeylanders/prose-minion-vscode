/**
 * The pills above the Workshop composer: what rides the next message. Staged
 * attachments (host truth) each with a remove button, then the live Selected
 * Text pill when the toggle is on (ADR 2026-11-14 D14). Pasted text can also be edited or moved into the draft.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { workshopAttachmentSize, workshopAttachmentTitle } from '@components/workshop/workshopAttachmentPills';
import {
  WorkshopLiveSelectedTextPill,
  type WorkshopComposerSelectedText
} from '@components/workshop/WorkshopSelectedTextControls';
import type { WorkshopComposerPastedText } from '@hooks/domain/workshop/useWorkshopPastedText';
import type { WorkshopMessageAttachmentSnapshot } from '@messages';

interface WorkshopComposerAttachmentsProps {
  /** Staged one-shot attachments for the next message (host truth). */
  attachments: readonly WorkshopMessageAttachmentSnapshot[];
  livePill: WorkshopComposerSelectedText['livePill'];
  onRemove: (id: string) => void;
  pastedText?: WorkshopComposerPastedText;
  locked?: boolean;
  onInsert?: (id: string) => void;
}

export const WorkshopComposerAttachments: React.FC<WorkshopComposerAttachmentsProps> = ({
  attachments,
  livePill,
  onRemove, pastedText, locked, onInsert
}) => {
  if (attachments.length === 0 && !livePill && !pastedText?.pendingStages.length && !pastedText?.error) {
    return null;
  }
  return (
    <div className="pm-ws-comp-attachments" aria-label="Attachments for this message">
      {attachments.map((attachment, index) => (
        <span
          key={attachment.id}
          role={attachment.pastedText ? 'group' : undefined}
          aria-label={attachment.pastedText ? `Attachment ${index + 1}: ${attachment.label}` : undefined}
          className={`pm-ws-comp-attachment${attachment.pastedText ? ' pm-ws-comp-attachment-paste' : ''}${attachment.lightboxTile ? ' pm-ws-comp-attachment-lightbox' : ''}${attachment.selectedText ? ' pm-ws-comp-attachment-selected' : ''}`}
          title={workshopAttachmentTitle(attachment)}
        >
          {attachment.pastedText && pastedText ? (
            <button type="button" className="pm-ws-comp-paste-action" onClick={() => pastedText.inspect(attachment.id)}
              aria-label={`Inspect or edit ${attachment.label}`} aria-describedby={`workshop-paste-size-${attachment.id}`} disabled={pastedText.isBusy(attachment.id)}>
              <Icon name="doc" size={11} /> {attachment.label}{' '}
              <span className="pm-ws-comp-attachment-size" id={`workshop-paste-size-${attachment.id}`}>{workshopAttachmentSize(attachment, 'composer')}</span>
            </button>
          ) : (
            <>
              <Icon name={attachment.lightboxTile ? 'pin' : 'doc'} size={11} />
              <span className="pm-ws-comp-attachment-label">{attachment.label}</span>
              <span className="pm-ws-comp-attachment-size">{workshopAttachmentSize(attachment, 'composer')}</span>
            </>
          )}
          {attachment.pastedText && pastedText && (
            <button type="button" className="pm-ws-comp-paste-action" disabled={locked || pastedText.isBusy(attachment.id) || pastedText.inserting()}
              onClick={() => onInsert?.(attachment.id)}>Insert into message</button>
          )}
          <button
            type="button"
            disabled={attachment.pastedText && (locked || pastedText?.isBusy(attachment.id))}
            className="pm-ws-comp-attachment-remove"
            title={`Remove ${attachment.label} from this message`}
            aria-label={`Remove ${attachment.label} from this message`}
            onClick={() => attachment.pastedText && pastedText ? pastedText.remove(attachment.id) : onRemove(attachment.id)}
          >
            <Icon name="x" size={10} />
          </button>
        </span>
      ))}
      {pastedText?.pendingStages.map((id) => (
        <span key={id} className="pm-ws-comp-attachment" role="status">Staging pasted text…</span>
      ))}
      {pastedText?.error && <span className="pm-ws-comp-attachment-hint" role="alert">{pastedText.error}</span>}
      {attachments.length > 0 && <span className="pm-ws-comp-attachment-hint">rides the next message only</span>}
      {livePill && <WorkshopLiveSelectedTextPill live={livePill} />}
    </div>
  );
};
