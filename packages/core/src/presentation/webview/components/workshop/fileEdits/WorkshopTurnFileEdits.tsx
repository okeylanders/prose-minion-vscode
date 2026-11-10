/**
 * A persona reply's suggested file edits (ADR 2026-11-05 D9; epic Slice 4b),
 * rendered by `WorkshopTurnBubble` under the bubble: one card, or several
 * under a small count, each acted on alone and keeping its index on the turn.
 *
 * An answer to an edit offer (ADR 2026-11-10 U4) always draws its cards
 * under "Suggested file edits · fixes" (or "· rewrites"), and each card
 * carries that mark: its own `intent`, or the answer's kind.
 */

import * as React from 'react';
import type { WorkshopTurn } from '@messages';
import { Icon } from '@components/shared/Icon';
import { workshopFileEditStackLabel } from '@hooks/domain/workshop/fileEdits/workshopFileEditCardView';
import { workshopEditOfferCardsLabel } from '../editOffers/WorkshopEditOfferLines';
import { WorkshopFileEditCard, type WorkshopFileEditControls } from './WorkshopFileEditCard';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopTurnFileEdits: React.FC<{ turn: WorkshopTurn; controls: WorkshopFileEditControls }> = ({ turn, controls }) => {
  const proposals = turn.fileEditProposals ?? [];
  if (proposals.length === 0) {
    return null;
  }
  const answerKind = turn.editOfferAnswer?.kind;
  const cards = proposals.map((proposal, index) => (
    <WorkshopFileEditCard
      key={index}
      turnId={turn.id}
      index={index}
      proposal={proposal}
      controls={controls}
      mark={answerKind ? proposal.intent ?? answerKind : undefined}
    />
  ));
  if (proposals.length === 1 && !answerKind) {
    return <>{cards}</>;
  }
  const label = answerKind ? workshopEditOfferCardsLabel(answerKind) : workshopFileEditStackLabel(proposals.length);
  return (
    <div className="pm-ws-file-edit-stack" role="group" aria-label={label}>
      <div className="pm-ws-file-edit-stack-head" aria-hidden="true">
        <Icon name="pen" size={12} /> {label}
      </div>
      {cards}
    </div>
  );
};
