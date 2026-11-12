/**
 * A press and its answer in the thread (ADR 2026-11-10 U3, U4 and its
 * addendum; epic Slice 3).
 *
 * - **The request line** (U3): the writer pressed and wrote nothing, so the
 *   press is a divider line, the way a direct tool run is, never a bubble.
 * - **The answer line** (U4): the host's sentence in place of the persona's
 *   prose, which never shows.
 *
 * Both hold the host's own words (the turn's content: no pronoun, the
 * source reply's time) and one link that moves focus to the source bubble.
 * Focus moves only on that press.
 */

import * as React from 'react';
import type { WorkshopEditOfferKind, WorkshopTurn } from '@messages';

const SOURCE_LINK_NAME = 'Go to the reply these edits were asked from';

interface SourceLinkProps {
  sourceTurnId: string;
  onGoToTurn?: (turnId: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SourceLink: React.FC<SourceLinkProps> = ({ sourceTurnId, onGoToTurn }) => onGoToTurn
  ? (
      <button
        type="button"
        className="pm-ws-offer-source-link"
        aria-label={`That reply. ${SOURCE_LINK_NAME}`}
        title={SOURCE_LINK_NAME}
        onClick={() => onGoToTurn(sourceTurnId)}
      >
        <span aria-hidden="true">That reply ↑</span>
      </button>
    )
  : null;

export interface WorkshopEditOfferRequestLineProps {
  turn: WorkshopTurn;
  request: NonNullable<WorkshopTurn['editOfferRequest']>;
  identity: Record<string, string>;
  onGoToTurn?: (turnId: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopEditOfferRequestLine: React.FC<WorkshopEditOfferRequestLineProps> = ({ turn, request, identity, onGoToTurn }) => (
  <div className="pm-ws-revision-divider pm-ws-offer-request" {...identity} tabIndex={-1}>
    <span>
      {turn.content}{' '}
      <SourceLink sourceTurnId={request.sourceTurnId} onGoToTurn={onGoToTurn} />
    </span>
  </div>
);

export interface WorkshopEditOfferAnswerLineProps {
  turn: WorkshopTurn;
  answer: NonNullable<WorkshopTurn['editOfferAnswer']>;
  onGoToTurn?: (turnId: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopEditOfferAnswerLine: React.FC<WorkshopEditOfferAnswerLineProps> = ({ turn, answer, onGoToTurn }) => (
  <p className={`pm-ws-offer-answer-line pm-ws-offer-answer-${answer.outcome}`}>
    {turn.content}{' '}
    <SourceLink sourceTurnId={answer.sourceTurnId} onGoToTurn={onGoToTurn} />
  </p>
);

/** "Suggested file edits · fixes": the heading over an answer's cards. */
export function workshopEditOfferCardsLabel(kind: WorkshopEditOfferKind): string {
  return `Suggested file edits · ${kind}`;
}
