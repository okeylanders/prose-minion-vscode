/**
 * ExcerptPanel — the rail's "Working Excerpt" block (PR #67 review #6:
 * extracted from WorkshopApp).
 *
 * Owns the local paste-draft/editing state; the pinned excerpt itself is
 * HOST state (WorkshopSessionService) and arrives via props. Pinning posts
 * WORKSHOP_SET_EXCERPT through the callback; "Pin from file…" (Sprint 3)
 * posts WORKSHOP_PICK_EXCERPT_FILE so the HOST runs the picker, reads the
 * file, and head-slices if huge — this component never talks to the wire
 * directly. Editor-selection seeding arrives through the same host path
 * (context-menu command → WorkshopPanelProvider), so there's nothing to do
 * here for it.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopExcerpt } from '@messages';

interface ExcerptPanelProps {
  excerpt: WorkshopExcerpt | null;
  /** Disables replace/pin while a run is in flight (host guards too). */
  isRunning: boolean;
  onPin: (text: string) => void;
  /** Ask the host to open its file picker and pin the chosen file's content. */
  onPinFromFile: () => void;
}

export const ExcerptPanel: React.FC<ExcerptPanelProps> = ({
  excerpt,
  isRunning,
  onPin,
  onPinFromFile
}) => {
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
        {showPinned ? <span className="pm-ws-pill">Pinned · v{excerpt.version}</span> : null}
      </div>

      {showPinned ? (
        <>
          <div className="pm-ws-excerpt">{excerpt.text}</div>
          {excerpt.truncation && (
            <p className="pm-ws-excerpt-truncated">
              Pinned the first {excerpt.truncation.pinnedWords.toLocaleString()} of{' '}
              {excerpt.truncation.totalWords.toLocaleString()} words in this file.
            </p>
          )}
          <div className="pm-ws-excerpt-actions">
            <button
              className="pm-ws-excerpt-edit"
              type="button"
              onClick={beginEditing}
              disabled={isRunning}
            >
              Replace excerpt…
            </button>
            <button
              className="pm-ws-excerpt-edit"
              type="button"
              onClick={onPinFromFile}
              disabled={isRunning}
              title="Pick a file and pin its content as the working excerpt"
            >
              Pin from file…
            </button>
          </div>
        </>
      ) : (
        <>
          <textarea
            className="pm-ws-excerpt pm-ws-excerpt-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste a passage to work on — it stays pinned here while you iterate. You can also pin a file, or send a selection from the editor's context menu."
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
            <button
              className="pm-ws-excerpt-edit"
              type="button"
              onClick={onPinFromFile}
              disabled={isRunning}
              title="Pick a file and pin its content as the working excerpt"
            >
              Pin from file…
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
