/**
 * LightboxBoardsOutcome — what an open, a delete or a rename of a saved board
 * left to say (PR #167 F-03): a rename whose file could not be changed, an
 * open refused while a run reads the board on screen, a delete that did not
 * happen. Shown under the header, where it outlives the name sheet or the
 * browser that asked, until the writer dismisses it or the next such answer
 * replaces it. A source that could not be opened (a malformed or missing
 * file) is said on the board, as any refused source is, never here.
 *
 * Props-only: the host's words, and Dismiss.
 */
import * as React from 'react';
import { Icon } from '@components/shared/Icon';

export interface LightboxBoardsOutcomeProps {
  /** The host's words; nothing is shown without them. */
  text: string | null;
  onDismiss: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardsOutcome: React.FC<LightboxBoardsOutcomeProps> = ({ text, onDismiss }) => {
  if (!text) {
    return null;
  }
  return (
    <div className="pm-lb-boards-outcome" role="alert">
      <Icon name="alert" size={14} />
      <span><strong>Saved boards</strong> {text}</span>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </div>
  );
};
