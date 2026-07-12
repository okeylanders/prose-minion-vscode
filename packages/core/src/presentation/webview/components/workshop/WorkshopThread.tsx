/** Render completed Workshop history with sidecar-correlated affordances. */

import * as React from 'react';
import {
  WorkshopToolId,
  WorkshopToolSidecarSnapshot,
  WorkshopTurn
} from '@messages';
import { WorkshopTurnBubble } from './WorkshopTurnBubble';

interface WorkshopThreadProps {
  turns: readonly WorkshopTurn[];
  toolSidecars: readonly WorkshopToolSidecarSnapshot[];
  quickActionsDisabled?: boolean;
  onQuickAction: (toolId: WorkshopToolId, reportTurnId: string, label: string) => void;
  onTalkDirectly: (toolId: WorkshopToolId) => void;
  onCopy: (content: string, turn: WorkshopTurn) => void;
  onSave: (content: string, turn: WorkshopTurn) => void;
}

export const WorkshopThread: React.FC<WorkshopThreadProps> = React.memo(({
  turns,
  toolSidecars,
  quickActionsDisabled = false,
  onQuickAction,
  onTalkDirectly,
  onCopy,
  onSave
}) => (
  <>
    {turns.map((turn) => {
      const sidecar = turn.toolId
        ? toolSidecars.find((candidate) => candidate.toolId === turn.toolId)
        : undefined;
      const ownsLiveSidecar = !!(
        sidecar?.availableForDirectFollowUp &&
        turn.reportTurnId &&
        sidecar.latestReportTurnId === turn.reportTurnId
      );
      // Gate on the precise artifact, not the coarse participant: a
      // direct_tool_response is also participant 'tool' but must never grow a
      // report-only quick-action bar (PR #72 review #8).
      const quickActionToolId =
        turn.artifact === 'tool_report' && turn.toolId ? turn.toolId : null;

      return (
        <WorkshopTurnBubble
          key={turn.id}
          turn={turn}
          quickActionToolId={quickActionToolId}
          quickActionsDisabled={quickActionsDisabled || !ownsLiveSidecar}
          canTalkDirectly={turn.artifact === 'tool_report' && ownsLiveSidecar}
          onQuickAction={onQuickAction}
          onTalkDirectly={onTalkDirectly}
          onCopy={onCopy}
          onSave={onSave}
        />
      );
    })}
  </>
));

WorkshopThread.displayName = 'WorkshopThread';
