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
 *
 * Deliberately NOT a persona picker (ADR §1): the persona chip is the
 * return-to-host affordance, never a persona-browser trigger. The rail hides
 * until the first sidecar exists — with only the host in the room, the
 * composer placeholder and header already name the recipient.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  WorkshopChatTarget,
  WorkshopPersonaId,
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
  chatTarget: WorkshopChatTarget;
  onSetChatTarget: (target: WorkshopChatTarget) => void;
}

export const WorkshopParticipantRail: React.FC<WorkshopParticipantRailProps> = ({
  personaId,
  personaLabel,
  toolSidecars,
  chatTarget,
  onSetChatTarget
}) => {
  if (toolSidecars.length === 0) {
    return null;
  }

  const hostActive = chatTarget.kind === 'host';
  const activeToolLabel = chatTarget.kind === 'tool'
    ? workshopToolLabel(chatTarget.toolId)
    : null;

  return (
    <div className="pm-ws-participant-rail" role="toolbar" aria-label="Conversation participants">
      <span className="pm-ws-rail-label" aria-hidden="true">Talking to</span>
      <button
        className={`pm-ws-participant-chip ${hostActive ? 'pm-ws-chip-active' : ''}`}
        type="button"
        aria-pressed={hostActive}
        onClick={() => {
          if (!hostActive) {
            onSetChatTarget({ kind: 'host' });
          }
        }}
        title={hostActive ? `Messages go to ${personaLabel}` : `Back to ${personaLabel}`}
      >
        <Icon name={WORKSHOP_PERSONA_FOCUS_ICONS[personaId]} size={12} /> {personaLabel}
      </button>
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
            disabled={unavailable}
            onClick={() => {
              if (!active) {
                onSetChatTarget({ kind: 'tool', toolId: sidecar.toolId });
              }
            }}
            title={
              unavailable
                ? `${label}'s conversation is no longer available`
                : active
                  ? `Talking directly to ${label}`
                  : `Talk directly to ${label} about its latest report`
            }
          >
            <Icon name={workshopToolIcon(sidecar.toolId)} size={12} /> {label}
          </button>
        );
      })}
      {/* The banner this rail replaced was role="status" — keep direct-mode
          switches audible to screen readers, not just visible as chip state. */}
      <span className="pm-ws-visually-hidden" role="status">
        {activeToolLabel
          ? `Talking directly to ${activeToolLabel}`
          : `Talking to ${personaLabel}`}
      </span>
    </div>
  );
};
