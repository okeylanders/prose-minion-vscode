/**
 * A persona reply's suggested file edits (ADR 2026-11-05 D9; epic Slice 4b),
 * rendered by `WorkshopTurnBubble` under the bubble: one card, or several
 * under a small count, each acted on alone and keeping its index on the turn.
 */

import * as React from 'react';
import type { WorkshopTurn } from '@messages';
import { Icon } from '@components/shared/Icon';
import { workshopFileEditStackLabel } from '@hooks/domain/workshop/fileEdits/workshopFileEditCardView';
import { WorkshopFileEditCard, type WorkshopFileEditControls } from './WorkshopFileEditCard';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopTurnFileEdits: React.FC<{ turn: WorkshopTurn; controls: WorkshopFileEditControls }> = ({ turn, controls }) => {
  const proposals = turn.fileEditProposals ?? [];
  if (proposals.length === 0) {
    return null;
  }
  const cards = proposals.map((proposal, index) => (
    <WorkshopFileEditCard key={index} turnId={turn.id} index={index} proposal={proposal} controls={controls} />
  ));
  if (proposals.length === 1) {
    return <>{cards}</>;
  }
  const label = workshopFileEditStackLabel(proposals.length);
  return (
    <div className="pm-ws-file-edit-stack" role="group" aria-label={label}>
      <div className="pm-ws-file-edit-stack-head" aria-hidden="true">
        <Icon name="pen" size={12} /> {label}
      </div>
      {cards}
    </div>
  );
};
