/**
 * WorkshopThread — the accumulated turn history, memoized as a render
 * boundary (PR #67 review #6/#11 consensus, Tim + Parker).
 *
 * WorkshopApp re-renders on every STREAM_CHUNK; without this seam each token
 * re-walked the full `turns.map(...)`. The `turns` array's identity only
 * changes when a turn lands or a snapshot reconciles, so React.memo makes
 * the whole history skip token-clock renders — only the live bubble (kept in
 * the parent) subscribes to per-chunk state.
 */

import * as React from 'react';
import { WorkshopToolId, WorkshopTurn } from '@messages';
import { WorkshopTurnBubble } from './WorkshopTurnBubble';

interface WorkshopThreadProps {
  turns: readonly WorkshopTurn[];
  selectedToolId: WorkshopToolId | null;
  quickActionsDisabled?: boolean;
  onQuickAction: (toolId: WorkshopToolId, label: string) => void;
  onCopyVariation: (content: string, toolId: WorkshopToolId | null) => void;
  onSaveVariation: (content: string, toolId: WorkshopToolId | null) => void;
}

export const WorkshopThread: React.FC<WorkshopThreadProps> = React.memo(({
  turns,
  selectedToolId,
  quickActionsDisabled = false,
  onQuickAction,
  onCopyVariation,
  onSaveVariation
}) => {
  let currentToolId: WorkshopToolId | null = null;

  return (
    <>
      {turns.map((turn) => {
        if (turn.toolId) {
          currentToolId = turn.toolId;
        }

        const actionToolId =
          turn.role === 'assistant' && !turn.personaId
            ? turn.toolId ?? currentToolId ?? selectedToolId
            : null;
        const turnActionsDisabled =
          quickActionsDisabled ||
          (actionToolId !== null && selectedToolId !== null && actionToolId !== selectedToolId);
        return (
          <WorkshopTurnBubble
            key={turn.id}
            turn={turn}
            quickActionToolId={actionToolId}
            quickActionsDisabled={turnActionsDisabled}
            onQuickAction={onQuickAction}
            onCopyVariation={onCopyVariation}
            onSaveVariation={onSaveVariation}
          />
        );
      })}
    </>
  );
});

WorkshopThread.displayName = 'WorkshopThread';
