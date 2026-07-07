/**
 * ExcerptPanel — the rail's "Working Excerpt" block (PR #67 review #6:
 * extracted from WorkshopApp).
 *
 * Owns the local paste-draft/editing state; the pinned excerpt itself is
 * HOST state (WorkshopSessionService) and arrives via props. Pinning posts
 * WORKSHOP_SET_EXCERPT through the callback — this component never talks to
 * the wire directly. Editor-selection and file-picker seeding land beside
 * the paste path in Sprint 3.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopExcerpt } from '@messages';

interface ExcerptPanelProps {
  excerpt: WorkshopExcerpt | null;
  /** Disables replace/pin while a run is in flight (host guards too). */
  isRunning: boolean;
  onPin: (text: string) => void;
}

export const ExcerptPanel: React.FC<ExcerptPanelProps> = ({ excerpt, isRunning, onPin }) => {
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  const pinDraft = () => {
    if (draft.trim().length === 0) {
      return;
    }
    onPin(draft);
    setEditing(false);
  };

  const beginEditing = () => {
    setDraft(excerpt?.text ?? '');
    setEditing(true);
  };

  const showPinned = excerpt && !editing;

  return (
    <div className="pm-ws-block">
      <div className="pm-ws-block-head">
        <div className="pm-ws-eyebrow">
          <Icon name="pin" size={12} /> Working Excerpt
        </div>
        {showPinned ? <span className="pm-ws-pill">Pinned</span> : null}
      </div>

      {showPinned ? (
        <>
          <div className="pm-ws-excerpt">{excerpt.text}</div>
          <button
            className="pm-ws-excerpt-edit"
            type="button"
            onClick={beginEditing}
            disabled={isRunning}
          >
            Replace excerpt…
          </button>
        </>
      ) : (
        <>
          <textarea
            className="pm-ws-excerpt pm-ws-excerpt-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste a passage to work on — it stays pinned here while you iterate. (Sending a selection from the editor arrives in Sprint 3.)"
            rows={7}
            aria-label="Excerpt to pin"
          />
          <div className="pm-ws-excerpt-actions">
            <button
              className="pm-ws-pin-btn"
              type="button"
              onClick={pinDraft}
              disabled={draft.trim().length === 0 || isRunning}
            >
              <Icon name="pin" size={13} /> Pin excerpt
            </button>
            {editing && (
              <button className="pm-ws-excerpt-edit" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
