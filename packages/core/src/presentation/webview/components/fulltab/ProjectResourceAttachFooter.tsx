/**
 * ProjectResourceAttachFooter — the project picker's footer when it attaches
 * files as context (Workshop Sprint 12 Phase 4; the Lightbox's context list
 * uses it too, 2026-10-20): what is selected, an honest ~word estimate
 * against the words the caller has left, a warning when the estimate is
 * likely over, Cancel and "Add N files".
 *
 * Word counts happen when the host reads the files; rows carry byte sizes,
 * so the running total is an estimate, and the host applies the real limit.
 * Moved unchanged from WorkshopContextSelectorModal.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { ProjectResourcePickerFooterState } from '@components/fulltab/ProjectResourcePickerModal';

/** Honest rough words-per-byte for the running selection estimate only. */
const ESTIMATE_BYTES_PER_WORD = 6;

export interface ProjectResourceAttachFooterProps extends ProjectResourcePickerFooterState {
  /** The words the caller can still take. */
  remainingWords: number;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const ProjectResourceAttachFooter: React.FC<ProjectResourceAttachFooterProps> = ({
  selected,
  confirm,
  close,
  remainingWords
}) => {
  const estimatedWords = Math.round(
    selected.reduce((total, entry) => total + entry.sizeBytes, 0) / ESTIMATE_BYTES_PER_WORD
  );
  const overEstimate = estimatedWords > remainingWords;
  return (
    <div className="pm-ws-ctxsel-foot">
      <span className={`pm-ws-ctxsel-total${overEstimate ? ' pm-ws-ctxsel-total-over' : ''}`}>
        {selected.length === 0
          ? 'Nothing selected'
          : `${selected.length} file${selected.length === 1 ? '' : 's'} · ~${estimatedWords.toLocaleString()} words est.`}
      </span>
      <span className="pm-ws-ctxsel-spacer" />
      {overEstimate ? (
        <span className="pm-ws-ctxsel-overmsg">
          Likely over the remaining {remainingWords.toLocaleString()}-word budget
        </span>
      ) : null}
      <button className="pm-ws-action-btn" type="button" onClick={close}>
        Cancel
      </button>
      <button
        className="pm-ws-primary-btn"
        type="button"
        disabled={selected.length === 0}
        onClick={confirm}
      >
        <Icon name="check" size={13} /> Add {selected.length}{' '}
        file{selected.length === 1 ? '' : 's'}
      </button>
    </div>
  );
};
