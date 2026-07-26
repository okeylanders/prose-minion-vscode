/**
 * WorkshopInviteGuestModal — the split-sheet guest picker (Sprint 13C;
 * approved comp "Prose Minion — Invite Guest", synced 2026-07-24).
 *
 * Select, then send: a card click is modal-local selection with a check mark
 * and makes NO provider call. The sticky footer is the commit zone — selected
 * persona, opening message, character count, and the one primary action
 * (`Read in <Persona>`). Exactly one valid submit invites exactly one guest
 * and the parent closes the modal; the comp's reset-in-place serial invite is
 * mock convenience, not the contract.
 *
 * Two nudges fight the skipped field: the amber `Default message` chip
 * (click selects all for overtyping; flips to green `Personalized` once
 * edited) and a one-shot soft confirm when launching an untouched default.
 * Both are announced to assistive technology, never signalled by colour
 * alone. Changing selection rewrites only untouched generated copy —
 * writer-edited text is never overwritten.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';
import { WorkshopPersonaSheetGrid, WorkshopPersonaCardLock } from './WorkshopPersonaSheetGrid';
import type { WorkshopPersonaId } from '@messages';
import {
  WORKSHOP_GUEST_CAPACITY,
  WORKSHOP_PERSONA_CATALOG,
  defaultWorkshopGuestOpening,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

interface WorkshopInviteGuestModalProps {
  open: boolean;
  /** The session host — its card locks with a stated reason. */
  hostPersonaId: WorkshopPersonaId;
  /** Live guests: locked cards, and they count against room capacity. */
  livePersonaGuestIds: WorkshopPersonaId[];
  /** Room-mutation lock (live-run lock included). */
  disabled?: boolean;
  onClose: () => void;
  onInvite: (personaId: WorkshopPersonaId, openingMessage: string) => void;
  /** Open the persona schematic; a separate control that never selects. */
  onMoreInfo?: (personaId: WorkshopPersonaId) => void;
}


export const WorkshopInviteGuestModal: React.FC<WorkshopInviteGuestModalProps> = ({
  open,
  hostPersonaId,
  livePersonaGuestIds,
  disabled = false,
  onClose,
  onInvite,
  onMoreInfo
}) => {
  const [selected, setSelected] = React.useState<WorkshopPersonaId | null>(null);
  const [message, setMessage] = React.useState(() => defaultWorkshopGuestOpening());
  const [edited, setEdited] = React.useState(false);
  const [confirmArmed, setConfirmArmed] = React.useState(false);
  const [flashToken, setFlashToken] = React.useState(0);
  const [flashing, setFlashing] = React.useState(false);
  const messageRef = React.useRef<HTMLTextAreaElement>(null);

  // Selection is discarded on cancel: every open starts from a clean sheet,
  // so no half-invitation can survive a dismissed modal.
  React.useEffect(() => {
    if (open) {
      setSelected(null);
      setMessage(defaultWorkshopGuestOpening());
      setEdited(false);
      setConfirmArmed(false);
    }
  }, [open]);

  // One-shot attention flash on the message dock (selection change / confirm).
  React.useEffect(() => {
    if (flashToken === 0) {
      return undefined;
    }
    setFlashing(true);
    const timer = window.setTimeout(() => setFlashing(false), 1100);
    return () => window.clearTimeout(timer);
  }, [flashToken]);

  const roomFull = livePersonaGuestIds.length >= WORKSHOP_GUEST_CAPACITY;
  const locks = React.useMemo(() => {
    const map: Partial<Record<WorkshopPersonaId, WorkshopPersonaCardLock>> = {};
    for (const persona of WORKSHOP_PERSONA_CATALOG) {
      if (persona.id === hostPersonaId) {
        map[persona.id] = {
          tag: 'Host',
          tone: 'host',
          reason: `${persona.label} is hosting this room`,
          showCheck: true
        };
      } else if (livePersonaGuestIds.includes(persona.id)) {
        map[persona.id] = {
          tag: 'In the room',
          tone: 'guest',
          reason: `${persona.label} is already in the room`,
          showCheck: true
        };
      } else if (roomFull) {
        map[persona.id] = {
          tag: 'Room full',
          tone: 'full',
          reason: 'The room is full — dismiss a guest before inviting another',
          showCheck: false
        };
      }
    }
    return map;
  }, [hostPersonaId, livePersonaGuestIds, roomFull]);

  const trimmed = message.trim();
  const generatedDefault = defaultWorkshopGuestOpening(selected ?? undefined);
  const isUntouchedDefault = !edited && trimmed === generatedDefault.trim();
  const selectedLabel = selected ? workshopPersonaLabel(selected) : null;
  const canLaunch = !disabled && !!selected && trimmed.length > 0 && trimmed.length <= PROMPT_BUDGETS.guestOpening.characters;

  const selectPersona = (personaId: WorkshopPersonaId) => {
    setSelected(personaId);
    setConfirmArmed(false);
    // Rewrite only untouched generated copy; writer-edited text is pinned.
    if (!edited) {
      setMessage(defaultWorkshopGuestOpening(personaId));
    }
    setFlashToken((token) => token + 1);
  };

  const editMessage = (value: string) => {
    setMessage(value);
    setEdited(true);
    setConfirmArmed(false);
  };

  const launch = () => {
    if (!canLaunch || !selected) {
      return;
    }
    if (isUntouchedDefault && !confirmArmed) {
      setConfirmArmed(true);
      setFlashToken((token) => token + 1);
      return;
    }
    onInvite(selected, trimmed);
  };

  const handleSheetKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      launch();
    }
  };

  const focusAndSelectMessage = () => {
    messageRef.current?.focus();
    messageRef.current?.select();
  };

  return (
    <WorkshopModalShell
      open={open}
      variant="sheet"
      titleId="pm-ws-invite-guest-title"
      closeLabel="Close guest invitation"
      className="pm-ws-persona-sheet"
      onClose={onClose}
    >
      <div className="pm-ws-sheet" onKeyDown={handleSheetKeyDown}>
        <header className="pm-ws-sheet-head">
          <div className="pm-ws-eyebrow">Workshop · Guest</div>
          <h2 id="pm-ws-invite-guest-title">Invite another lens</h2>
          <p className="pm-ws-sheet-sub">
            Invite a packaged persona to read the current room. A guest reads beside your
            host — <b>{workshopPersonaLabel(hostPersonaId)}</b> — and never replaces it.
          </p>
          <WorkshopModalShell.CloseButton />
        </header>
        <div className="pm-ws-sheet-body">
          <WorkshopPersonaSheetGrid
            selectedPersonaId={selected}
            locks={locks}
            disabled={disabled}
            onSelect={selectPersona}
            onMoreInfo={onMoreInfo}
          />
        </div>
        <footer className="pm-ws-sheet-foot">
          <div className="pm-ws-invite-foot-head">
            <span className="pm-ws-invite-foot-label" id="pm-ws-invite-opening-label">
              {selectedLabel ? (
                <>
                  <span className="pm-ws-invite-foot-to">Opening message to</span>{' '}
                  <span className="pm-ws-invite-foot-who">{selectedLabel}</span>
                </>
              ) : (
                'Opening message'
              )}
            </span>
            {trimmed.length > 0 && (
              isUntouchedDefault ? (
                <button
                  className="pm-ws-nudge"
                  type="button"
                  onClick={focusAndSelectMessage}
                  title="This is the boilerplate opening — click to personalize it"
                >
                  <i aria-hidden="true" />
                  Default message
                </button>
              ) : (
                <span className="pm-ws-nudge pm-ws-nudge-edited">
                  <i aria-hidden="true" />
                  Personalized
                </span>
              )
            )}
            <span className="pm-ws-invite-count">
              {message.length.toLocaleString()} / {PROMPT_BUDGETS.guestOpening.characters.toLocaleString()}
            </span>
          </div>
          <div className="pm-ws-invite-foot-row">
            <div
              className={`pm-ws-invite-msg-wrap${flashing ? ' pm-ws-invite-flash' : ''}${confirmArmed ? ' pm-ws-invite-confirm' : ''}`}
            >
              <textarea
                ref={messageRef}
                className="pm-ws-invite-msg"
                aria-labelledby="pm-ws-invite-opening-label"
                value={message}
                maxLength={PROMPT_BUDGETS.guestOpening.characters}
                rows={2}
                disabled={disabled}
                onChange={(event) => editMessage(event.target.value)}
              />
              {/* The soft confirm must be ANNOUNCED, not colour-signalled;
                  role=status makes the second-press instruction audible. */}
              <p className="pm-ws-invite-hintline" role="status">
                {confirmArmed && (
                  <>
                    <Icon name="alert" size={13} />
                    <span>
                      You&apos;re sending the default opening — press <b>Read in</b> again to
                      invite, or edit it above.
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="pm-ws-invite-actions">
              <button className="pm-ws-invite-cancel" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="pm-ws-invite-launch"
                type="button"
                disabled={!canLaunch}
                onClick={launch}
              >
                {selectedLabel ? (
                  <>
                    <Icon name="send" size={15} />
                    <span className="pm-ws-invite-launch-label">Read in {selectedLabel}</span>
                  </>
                ) : (
                  <span className="pm-ws-invite-launch-label">Select a persona</span>
                )}
              </button>
            </div>
          </div>
          {/* Nudge state change is announced without stealing focus. */}
          <span className="pm-ws-visually-hidden" role="status">
            {trimmed.length === 0
              ? 'Opening message is empty'
              : isUntouchedDefault
                ? 'Opening message is the default boilerplate'
                : 'Opening message personalized'}
          </span>
        </footer>
      </div>
    </WorkshopModalShell>
  );
};
