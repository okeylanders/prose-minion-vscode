/**
 * LightboxBoardNameModal — "Rename board…" from the Boards menu (Slice
 * 5A.2): one question, what is the board on screen called, in the
 * Workshop's Save-session sheet's frame and classes (its head, field, path
 * note and footer). Mirrored rather than shared: the Workshop's sheet is a
 * checkpoint save with a manifest and "Save as new", which a board's name
 * has no use for.
 *
 * Props-only. The field starts from the board's name and follows it as the
 * host updates it until the writer types (PR #164 F-04): Rename sends only
 * an edit the writer made, and only when it differs from the name standing
 * now. The one name rule (`lightboxBoardName`) checks it: a name it refuses
 * keeps the sheet open, with the rule's words. Enter renames; Escape, Cancel
 * and the close button leave the name as it is. A board no file holds yet
 * takes the name with its next save; session-only, the name lasts as long
 * as the session.
 */
import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import {
  LIGHTBOX_BOARD_NAME_CHARACTERS,
  LIGHTBOX_BOARD_NAME_FAULTS,
  checkLightboxBoardName
} from '@shared/constants/lightboxBoardName';

export interface LightboxBoardNameModalProps {
  open: boolean;
  /** The board's name as the host has it now; empty when it has none yet. */
  name: string;
  /** The file that holds the board on screen, by the host's id; absent when no file holds it yet. */
  fileId?: string;
  /** Boards are kept for the session only. */
  sessionOnly: boolean;
  onRename: (name: string) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardNameModal: React.FC<LightboxBoardNameModalProps> = ({ open, name, fileId, sessionOnly, onRename, onClose }) => {
  const [draft, setDraft] = React.useState(name);
  const [typed, setTyped] = React.useState(false);
  const [fault, setFault] = React.useState<string | undefined>(undefined);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    setTyped(false);
    setFault(undefined);
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  // Until the writer types, the field shows the name the host has now.
  React.useEffect(() => {
    if (!typed) {
      setDraft(name);
    }
  }, [name, typed]);

  const submit = React.useCallback(() => {
    if (!typed) {
      onClose();
      return;
    }
    const check = checkLightboxBoardName(draft);
    if (check.kind === 'invalid') {
      setFault(LIGHTBOX_BOARD_NAME_FAULTS[check.fault]);
      return;
    }
    if (check.kind === 'unnamed') {
      setFault('A board needs a name. Cancel keeps the one it has.');
      return;
    }
    if (check.name !== name) {
      onRename(check.name);
    }
    onClose();
  }, [draft, name, onClose, onRename, typed]);

  return (
    <WorkshopModalShell
      open={open}
      titleId="lightbox-board-name-title"
      closeLabel="Close Rename board"
      className="pm-ws-save-session-modal pm-lb-board-name-modal"
      onClose={onClose}
    >
      <div className="pm-ws-session-sheet-head">
        <div>
          <div className="pm-ws-eyebrow">Lightbox · Board</div>
          <h2 id="lightbox-board-name-title">Rename board</h2>
          <p id="lightbox-board-name-description">
            The name is yours: the chapter&rsquo;s version and the model that read it, say. The board keeps its file;
            only its name changes.
          </p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <div className="pm-ws-save-session-body">
        {sessionOnly && (
          <div className="pm-ws-sessions-unavailable" role="status">
            <Icon name="doc" size={16} /> Boards are kept for this session only, so the name lasts as long as the session.
          </div>
        )}
        <label className="pm-ws-save-session-field">
          <span>Board name</span>
          <input
            ref={inputRef}
            value={draft}
            maxLength={LIGHTBOX_BOARD_NAME_CHARACTERS}
            aria-invalid={fault ? true : undefined}
            aria-describedby={`lightbox-board-name-description lightbox-board-name-path${fault ? ' lightbox-board-name-fault' : ''}`}
            onChange={(event) => {
              setDraft(event.target.value);
              setTyped(true);
              setFault(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        {fault && <p className="pm-lb-board-name-fault" id="lightbox-board-name-fault" role="alert">{fault}</p>}
        <div className="pm-ws-save-session-path" id="lightbox-board-name-path">
          <Icon name="doc" size={12} />
          <span>
            {fileId
              ? <>prose-minion/boards/<strong>{fileId}</strong></>
              : sessionOnly ? 'Not saved: no single folder is open.' : 'Not in a saved file yet: the name is saved with this board’s next save.'}
          </span>
        </div>
        <p className="pm-ws-save-session-identity-note">
          At most {LIGHTBOX_BOARD_NAME_CHARACTERS} characters, on one line. Renaming changes the name, never the file&rsquo;s place.
        </p>
      </div>

      <footer className="pm-ws-session-sheet-foot">
        <span>Saves itself as you read: one file per board.</span>
        <button className="pm-ws-session-secondary" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="pm-ws-session-primary pm-ws-session-primary-large" type="button" onClick={submit}>
          <Icon name="pen" size={14} />
          Rename
        </button>
      </footer>
    </WorkshopModalShell>
  );
};
