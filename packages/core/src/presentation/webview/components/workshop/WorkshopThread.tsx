/** Render completed Workshop history with sidecar-correlated affordances. */

import * as React from 'react';
import {
  WorkshopToolId,
  WorkshopToolSidecarSnapshot,
  WorkshopTodoItem,
  WorkshopTurn,
  WorkshopTurnRewindability,
  WorkshopPersonaId,
  WorkshopWidgetConfigSummary
} from '@messages';
import { WorkshopTurnBubble } from './WorkshopTurnBubble';

interface WorkshopThreadProps {
  turns: readonly WorkshopTurn[];
  toolSidecars: readonly WorkshopToolSidecarSnapshot[];
  todos?: readonly WorkshopTodoItem[];
  currentExcerptVersion: number;
  quickActionsDisabled?: boolean;
  onQuickAction: (toolId: WorkshopToolId, reportTurnId: string, label: string) => void;
  onTalkDirectly: (toolId: WorkshopToolId) => void;
  onAddTodo?: (sourceTurnId: string, findingKey: string) => void;
  onCopy: (content: string, turn: WorkshopTurn) => void;
  onSave: (content: string, turn: WorkshopTurn) => void;
  /** Widget chips (ADR 2026-07-22): clone-and-recommit + persona recommend. */
  onOpenWidgetConfig?: (widgetConfigId: string) => void;
  /** Bounded config summaries for the visible window, keyed by config id. */
  widgetConfigSummaries?: Readonly<Record<string, WorkshopWidgetConfigSummary>>;
  onOpenWidgetRecommendation?: (
    recommendation: NonNullable<WorkshopTurn['widgetRecommendation']>,
    personaLabel?: string,
    personaId?: WorkshopPersonaId
  ) => void;
  /** Host verdicts for eligible bubbles (ADR 2026-09-30 §4), keyed by turn id. */
  turnRewindability?: Readonly<Record<string, WorkshopTurnRewindability>>;
  /** Why rewinding is paused for the whole room right now, if it is. */
  rewindPausedReason?: string;
  onRewind?: (turn: WorkshopTurn) => void;
  /** The same host verdicts for Branch, which also offers the latest reply. */
  turnBranchability?: Readonly<Record<string, WorkshopTurnRewindability>>;
  /** Why branching is paused for the whole room right now, if it is. */
  branchPausedReason?: string;
  onBranch?: (turn: WorkshopTurn) => void;
}

export const WorkshopThread: React.FC<WorkshopThreadProps> = React.memo(({
  turns,
  toolSidecars,
  todos = [],
  currentExcerptVersion,
  quickActionsDisabled = false,
  onQuickAction,
  onTalkDirectly,
  onAddTodo = () => undefined,
  onCopy,
  onSave,
  onOpenWidgetConfig,
  widgetConfigSummaries = {},
  onOpenWidgetRecommendation,
  turnRewindability = {},
  rewindPausedReason,
  onRewind,
  turnBranchability = {},
  branchPausedReason,
  onBranch
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
          promotedFindingKeys={new Set(
            todos
              .filter((todo) => todo.source.turnId === turn.id)
              .map((todo) => todo.source.findingKey)
          )}
          findingsStale={turn.excerptVersion !== currentExcerptVersion}
          onQuickAction={onQuickAction}
          onTalkDirectly={onTalkDirectly}
          onAddTodo={onAddTodo}
          onCopy={onCopy}
          onSave={onSave}
          onOpenWidgetConfig={onOpenWidgetConfig}
          widgetConfigSummary={turn.widgetCommit
            ? widgetConfigSummaries[turn.widgetCommit.widgetConfigId]
            : undefined}
          onOpenWidgetRecommendation={onOpenWidgetRecommendation}
          rewindability={turnRewindability[turn.id]}
          rewindPausedReason={rewindPausedReason}
          onRewind={onRewind}
          branchability={turnBranchability[turn.id]}
          branchPausedReason={branchPausedReason}
          onBranch={onBranch}
        />
      );
    })}
  </>
));

WorkshopThread.displayName = 'WorkshopThread';
