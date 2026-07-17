/**
 * WorkshopParticipantRail — "who's in the room" chips in the composer band
 * (feature-workshop-participant-rail; ADR 2026-07-09 §3–4).
 *
 * Presentation-only over WorkshopParticipantsSnapshot: the persona chip
 * returns to host (replacing the old "Back to <persona>" banner link), tool
 * chips enter direct mode via WORKSHOP_SET_CHAT_TARGET, and the active chip
 * IS the mode indicator — this rail subsumes the direct-mode banner. Chips
 * render only live sidecars; the host snapshot drops disposed ones, so a
 * chip can never target a dead conversation.
 * During an active response, the rail stays mounted as a stable participant
 * map while every routing control is temporarily locked.
 *
 * Deliberately NOT a host persona picker (ADR §1): the persona chip is the
 * return-to-host affordance. The explicit Invite guest chip is the one
 * discoverable entry point for adding a sidecar.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  WorkshopChatTarget,
  WorkshopPersonaId,
  WorkshopPersonaGuestSnapshot,
  WorkshopToolSidecarSnapshot
} from '@messages';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import { WORKSHOP_PERSONA_FOCUS_ICONS } from './workshopPersonaIcons';
import { workshopToolIcon } from './workshopToolIcons';

interface WorkshopParticipantRailProps {
  /** Session host (locked mid-session; rendered as the return-to-host chip). */
  personaId: WorkshopPersonaId;
  personaLabel: string;
  /** Live retained sidecars, in run order (host snapshot truth). */
  toolSidecars: WorkshopToolSidecarSnapshot[];
  personaGuests?: WorkshopPersonaGuestSnapshot[];
  chatTarget: WorkshopChatTarget;
  onSetChatTarget: (target: WorkshopChatTarget) => void;
  /** Disables every rail control without changing whether the rail renders. */
  disabled?: boolean;
  showInviteGuest?: boolean;
  onInviteGuest?: () => void;
  onDismissGuest?: (personaId: WorkshopPersonaId) => void;
}

export const WorkshopParticipantRail: React.FC<WorkshopParticipantRailProps> = ({
  personaId,
  personaLabel,
  toolSidecars,
  personaGuests = [],
  chatTarget,
  onSetChatTarget,
  disabled = false,
  showInviteGuest = false,
  onInviteGuest = () => undefined,
  onDismissGuest = () => undefined
}) => {
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (disabled && railRef.current?.contains(document.activeElement)) {
      railRef.current.focus();
    }
  }, [disabled]);

  if (toolSidecars.length === 0 && personaGuests.length === 0 && !showInviteGuest) {
    return null;
  }

  const hostActive = chatTarget.kind === 'host';
  const activeToolLabel = chatTarget.kind === 'tool'
    ? workshopToolLabel(chatTarget.toolId)
    : null;
  const activeGuestLabel = chatTarget.kind === 'personaGuest'
    ? personaGuests.find((guest) => guest.personaId === chatTarget.personaId)?.personaLabel
      ?? chatTarget.personaId
    : null;
  const lockedControlTitle = 'Available once the response finishes';

  return (
    <div
      ref={railRef}
      className="pm-ws-participant-rail"
      role="toolbar"
      aria-label="Conversation participants"
      tabIndex={-1}
    >
      <span className="pm-ws-rail-label" aria-hidden="true">Talking to</span>
      <button
        className={`pm-ws-participant-chip ${hostActive ? 'pm-ws-chip-active' : ''}`}
        type="button"
        aria-pressed={hostActive}
        disabled={disabled}
        onClick={() => {
          if (!hostActive) {
            onSetChatTarget({ kind: 'host' });
          }
        }}
        title={disabled
          ? lockedControlTitle
          : hostActive
            ? `Messages go to ${personaLabel}`
            : `Back to ${personaLabel}`}
      >
        <Icon name={WORKSHOP_PERSONA_FOCUS_ICONS[personaId]} size={12} /> {personaLabel}
      </button>
      {personaGuests.map((guest) => {
        const active = guest.activeTarget && guest.liveness === 'live';
        const unavailable = guest.liveness !== 'live' || !guest.hasConversation;
        return (
          <span key={guest.personaId} className="pm-ws-participant-guest">
            <button
              className={`pm-ws-participant-chip ${active ? 'pm-ws-chip-active pm-ws-chip-guest' : ''}`}
              type="button"
              aria-pressed={active}
              disabled={disabled || unavailable}
              onClick={() => {
                if (!active) {
                  onSetChatTarget({ kind: 'personaGuest', personaId: guest.personaId });
                }
              }}
              title={unavailable
                ? `${guest.personaLabel}'s conversation is no longer available`
                : disabled
                  ? lockedControlTitle
                  : active
                    ? `Talking to ${guest.personaLabel}`
                    : `Talk to ${guest.personaLabel}`}
            >
              <Icon name={WORKSHOP_PERSONA_FOCUS_ICONS[guest.personaId]} size={12} /> {guest.personaLabel}
            </button>
            {guest.liveness === 'live' && (
              <button
                className="pm-ws-participant-dismiss"
                type="button"
                aria-label={disabled
                  ? `Dismiss ${guest.personaLabel} — available once the response finishes`
                  : `Dismiss ${guest.personaLabel}`}
                disabled={disabled}
                onClick={() => onDismissGuest(guest.personaId)}
              >
                <Icon name="x" size={10} />
              </button>
            )}
          </span>
        );
      })}
      {toolSidecars.map((sidecar) => {
        const label = workshopToolLabel(sidecar.toolId);
        const active = sidecar.activeTarget;
        const unavailable = !sidecar.availableForDirectFollowUp;
        return (
          <button
            key={sidecar.toolId}
            className={`pm-ws-participant-chip ${active ? 'pm-ws-chip-active pm-ws-chip-direct' : ''}`}
            type="button"
            aria-pressed={active}
            disabled={disabled || unavailable}
            onClick={() => {
              if (!active) {
                onSetChatTarget({ kind: 'tool', toolId: sidecar.toolId });
              }
            }}
            title={
              unavailable
                ? `${label}'s conversation is no longer available`
                : disabled
                  ? lockedControlTitle
                  : active
                    ? `Talking directly to ${label}`
                    : `Talk directly to ${label} about its latest report`
            }
          >
            <Icon name={workshopToolIcon(sidecar.toolId)} size={12} /> {label}
          </button>
        );
      })}
      {showInviteGuest && (
        <button
          className="pm-ws-participant-chip pm-ws-chip-invite"
          type="button"
          disabled={disabled}
          onClick={onInviteGuest}
          title={disabled ? lockedControlTitle : 'Invite a persona guest into the room'}
        >
          <Icon name="person" size={12} /> Invite guest
        </button>
      )}
      {/* The banner this rail replaced was role="status" — keep direct-mode
          switches audible to screen readers, not just visible as chip state. */}
      <span className="pm-ws-visually-hidden" role="status">
        {activeToolLabel
          ? `Talking directly to ${activeToolLabel}`
          : activeGuestLabel
            ? `Talking to ${activeGuestLabel}`
            : `Talking to ${personaLabel}`}
      </span>
    </div>
  );
};
