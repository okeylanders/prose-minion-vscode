/**
 * A persona's context-paths proposal (ADR 2026-11-19 D23, D27), rendered by
 * `WorkshopTurnBubble` under the reply beside its other cards: the same
 * group rows, checkboxes and Apply the Settings sheet draws
 * (`ContextPathGroupRow`), and a Decline.
 *
 * - **Pending:** every offered group starts ticked. Apply writes the ticked
 *   groups for every project (L1); Decline answers the card with none.
 * - **Answered:** what each offered group came to, in the host's words.
 * - Apply posts ids and groups only, through the controls; the host's
 *   refusal words stay beside the card.
 */

import * as React from 'react';
import type { WorkshopLocationsGroupAnswer, WorkshopTurn } from '@messages';
import type { ContextPathGroup } from '@shared/types';
import {
  CONTEXT_PATH_APPLIES_TO_ALL,
  CONTEXT_PATH_GROUP_LABELS,
  contextPathDeclinedWords,
  contextPathLeftWords
} from '@shared/constants/contextPathSuggestionWords';
import { ContextPathGroupRow } from '@components/settings/ContextPathGroupRow';

export interface WorkshopLocationsProposalControls {
  applying: ReadonlySet<string>;
  feedback: ReadonlyMap<string, string>;
  /** True while the room's mutation lock is held. */
  locked: boolean;
  onApply: (turnId: string, groups: readonly ContextPathGroup[]) => void;
}

/** The lines an answered card shows: the groups applied, then each one left or declined, with why. */
export function workshopLocationsAnswerLines(answers: readonly WorkshopLocationsGroupAnswer[]): string[] {
  const applied = answers.filter((answer) => answer.outcome === 'applied').map((answer) => CONTEXT_PATH_GROUP_LABELS[answer.group]);
  return [
    applied.length > 0 ? `Applied to all your projects: ${applied.join(', ')}.` : 'Nothing was applied; your context paths are as they were.',
    ...answers.flatMap((answer) => answer.outcome === 'left'
      ? [contextPathLeftWords(answer.group, answer.reason)]
      : answer.outcome === 'declined' ? [contextPathDeclinedWords(answer.group)] : [])
  ];
}

export const WorkshopLocationsProposalCard: React.FC<{ turn: WorkshopTurn; controls: WorkshopLocationsProposalControls }> = ({ turn, controls }) => {
  const card = turn.locationsProposal;
  const offered = React.useMemo(
    () => card?.view.groups.filter((group) => group.offer.offered).map((group) => group.group) ?? [],
    [card]
  );
  const [ticked, setTicked] = React.useState<ReadonlySet<ContextPathGroup>>(() => new Set(offered));
  if (!card) {
    return null;
  }
  const proposed = card.view.groups.filter((group) => group.proposed);
  const busy = controls.applying.has(turn.id);
  const disabled = busy || controls.locked;
  const note = controls.feedback.get(turn.id);
  const toggle = (group: ContextPathGroup) => setTicked((current) => {
    const next = new Set(current);
    if (!next.delete(group)) {
      next.add(group);
    }
    return next;
  });
  const chosen = offered.filter((group) => ticked.has(group));
  return (
    <section className="pm-cps-sheet pm-ws-locations-card" aria-label="Proposed context paths">
      <div className="pm-cps-applies">Proposed context paths. {CONTEXT_PATH_APPLIES_TO_ALL}</div>
      <ul className="pm-cps-groups">
        {proposed.map((group) => (
          <ContextPathGroupRow
            key={group.group}
            group={group}
            ticked={card.state === 'pending' && ticked.has(group.group)}
            disabled={card.state !== 'pending' || disabled}
            onToggle={() => toggle(group.group)}
          />
        ))}
      </ul>
      {card.state === 'answered' ? (
        <div className="pm-cps-applied" role="status">
          {workshopLocationsAnswerLines(card.answers ?? []).map((line) => <div key={line}>{line}</div>)}
        </div>
      ) : (
        <div className="pm-cps-actions">
          <button type="button" className="settings-button" onClick={() => controls.onApply(turn.id, chosen)} disabled={disabled || chosen.length === 0}>
            {busy ? 'Applying…' : 'Apply'}
          </button>
          <button type="button" className="settings-button" onClick={() => controls.onApply(turn.id, [])} disabled={disabled}>
            Decline
          </button>
          {note && <span className="pm-cps-status" role="status">{note}</span>}
        </div>
      )}
    </section>
  );
};
