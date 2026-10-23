/**
 * LightboxBoardNameField — naming a board in place, in the rail (Slice 5A.1;
 * epic decision 33). Props-only. One text field, with the keyboard of the
 * Workshop's session browser rename (`WorkshopSessionBrowserModal`):
 * - **Enter** saves and closes; the panel returns focus to the action that
 *   opened the field.
 * - **Escape** closes without saving, and focus returns the same way; it
 *   goes no further, so the inspector's pin stays.
 * - **Leaving the field** (a click elsewhere, Tab) saves, as the Workshop's
 *   does, and leaves focus where the writer put it.
 *
 * The name is checked by the host's own rule (`lightboxBoardName`) before it
 * is sent: a name with a tab or line break says why in the field, which
 * stays open with the writer's words in it, on Enter and on leaving alike
 * (PR #164 N-01); Escape then cancels. An unchanged name sends nothing; an
 * empty one unnames the board. The field holds at most the rule's
 * characters.
 *
 * **Only the writer's own edit is sent** (PR #164 F-04). Until the writer
 * types, the field follows the name as it stands (`initial`), so a rename's
 * answer that lands while the field is open shows in it, and leaving an
 * untouched field sends nothing, never the name it opened with.
 */
import * as React from 'react';
import {
  LIGHTBOX_BOARD_NAME_CHARACTERS,
  LIGHTBOX_BOARD_NAME_FAULTS,
  checkLightboxBoardName
} from '@shared/constants/lightboxBoardName';

export type LightboxBoardNameClose = 'saved' | 'cancelled' | 'left';

export interface LightboxBoardNameFieldProps {
  /** The field's accessible name: which board it names. */
  label: string;
  /** The name as it stands; empty when the board is unnamed. */
  initial: string;
  /** A new name to send (the writer's words as typed; the host trims them). Not called for an unchanged one. */
  onSave: (name: string) => void;
  /** The field closed: saved with Enter, cancelled with Escape, or left. */
  onClose: (how: LightboxBoardNameClose) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardNameField: React.FC<LightboxBoardNameFieldProps> = ({ label, initial, onSave, onClose }) => {
  const [draft, setDraft] = React.useState(initial);
  // Whether the writer has typed in the field: only then is anything sent.
  const [edited, setEdited] = React.useState(false);
  const [fault, setFault] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement | null>(null);
  // Set once the field has closed, so the blur its closing causes does nothing more.
  const closed = React.useRef(false);
  const faultId = React.useId();

  React.useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  /** An untouched field follows the name as it stands. */
  const followInitial = React.useCallback(() => {
    if (!edited) {
      setDraft(initial);
    }
  }, [edited, initial]);
  React.useEffect(followInitial, [followInitial]);
  /** Still selected once it has followed, so typing replaces the whole name. */
  const keepUntouchedSelected = React.useCallback(() => {
    const field = input.current;
    if (!edited && field && field.ownerDocument.activeElement === field) {
      field.select();
    }
  }, [edited]);
  React.useLayoutEffect(keepUntouchedSelected, [draft, keepUntouchedSelected]);

  /** Save the writer's edit if it is a name and differs from the one standing; whether the field may close. */
  const settle = (): boolean => {
    if (!edited) {
      return true;
    }
    const check = checkLightboxBoardName(draft);
    if (check.kind === 'invalid') {
      setFault(LIGHTBOX_BOARD_NAME_FAULTS[check.fault]);
      return false;
    }
    const next = check.kind === 'named' ? check.name : '';
    if (next !== initial) {
      onSave(next);
    }
    return true;
  };

  const close = (how: LightboxBoardNameClose) => {
    closed.current = true;
    onClose(how);
  };

  return (
    <div className="pm-lb-name-field">
      <input
        ref={input}
        type="text"
        className="pm-lb-name-input"
        aria-label={label}
        aria-invalid={fault ? true : undefined}
        aria-describedby={fault ? faultId : undefined}
        maxLength={LIGHTBOX_BOARD_NAME_CHARACTERS}
        placeholder="Chapter version, model…"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setEdited(true);
          setFault(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (settle()) {
              close('saved');
            }
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close('cancelled');
          }
        }}
        onBlur={() => {
          // Leaving saves a name; one the rule refuses keeps the field open, with the writer's words and the reason.
          if (!closed.current && settle()) {
            close('left');
          }
        }}
      />
      {fault && <p id={faultId} className="pm-lb-name-fault" role="alert">{fault}</p>}
    </div>
  );
};
