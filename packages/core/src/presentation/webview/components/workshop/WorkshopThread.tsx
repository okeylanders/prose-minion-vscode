/** Render completed Workshop history with sidecar-correlated affordances. */

import type { WorkshopTurnMemoryControls } from './memory/WorkshopTurnMemory';
import type { WorkshopFileEditControls } from './fileEdits/WorkshopFileEditCard';
import type { WorkshopReactionControls } from './reactions/WorkshopTurnReactions';
import type { WorkshopEditOfferControls } from './editOffers/WorkshopEditOfferChip';
import * as React from 'react';
import {
  ModelOption,
  WorkshopToolId,
  WorkshopToolSidecarSnapshot,
  WorkshopTodoItem,
  WorkshopTurn,
  WorkshopTurnRewindability,
  WorkshopPersonaId,
  WorkshopWidgetConfigSummary
} from '@messages';
import { WorkshopTurnBubble } from './WorkshopTurnBubble';
import { WorkshopModelSliceDivider } from './WorkshopModelSliceDivider';
import { modelOptionLabel } from '@utils/modelOptionLabel';
import {
  deriveWorkshopModelSlices,
  type WorkshopModelSlice,
  type WorkshopModelsBeforeWindow
} from '@shared/workshop/workshopModelSlices';

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
  /** Turns that carry a bookmark (ADR 2026-11-03 D5). */
  bookmarkedTurnIds?: ReadonlySet<string>;
  /** True while the room's mutation lock is held. */
  bookmarkDisabled?: boolean;
  onToggleBookmark?: (turnId: string, bookmarked: boolean) => void;
  /** The options (`MODEL_DATA`) that name a slice's models; a raw id when absent. */
  modelOptions?: readonly ModelOption[];
  /** The snapshot's model-slice seed (ADR 2026-11-03 D8). */
  modelsBeforeWindow?: WorkshopModelsBeforeWindow;
  /** Project memory's card, receipts and Save to memory… (ADR 2026-11-04 D6, D7). */
  memory?: WorkshopTurnMemoryControls;
  /** A persona's suggested file edits (ADR 2026-11-05 D9). */
  fileEdits?: WorkshopFileEditControls;
  /** Reaction chips and the palette (ADR 2026-11-07 D8). */
  reactions?: WorkshopReactionControls;
  /** A reply's edit-offer chips and their lines (ADR 2026-11-10 U1–U4). */
  editOffers?: WorkshopEditOfferControls;
}

const NO_BOOKMARKS: ReadonlySet<string> = new Set();
const NO_MODEL_OPTIONS: readonly ModelOption[] = [];

/** The derived slices, keyed by the turn each is drawn before. */
function slicesByTurn(slices: readonly WorkshopModelSlice[]): ReadonlyMap<string, WorkshopModelSlice[]> {
  const byTurn = new Map<string, WorkshopModelSlice[]>();
  for (const slice of slices) {
    byTurn.set(slice.beforeTurnId, [...(byTurn.get(slice.beforeTurnId) ?? []), slice]);
  }
  return byTurn;
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
  onBranch,
  bookmarkedTurnIds = NO_BOOKMARKS,
  bookmarkDisabled = false,
  onToggleBookmark,
  modelOptions = NO_MODEL_OPTIONS,
  modelsBeforeWindow,
  memory,
  fileEdits,
  reactions,
  editOffers
}) => {
  // Every turn the thread holds, seeded from the window: the same derivation
  // the transcript export runs over the full ledger.
  const slices = React.useMemo(
    () => slicesByTurn(deriveWorkshopModelSlices(turns, { modelsBeforeWindow })),
    [turns, modelsBeforeWindow]
  );
  const modelLabel = React.useCallback(
    (modelId: string) => modelOptionLabel(modelOptions, modelId),
    [modelOptions]
  );
  return (
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
          <React.Fragment key={turn.id}>
            {slices.get(turn.id)?.map((slice) => (
              <WorkshopModelSliceDivider key={`${slice.scope}-${slice.replyTurnId}`} slice={slice} modelLabel={modelLabel} />
            ))}
            <WorkshopTurnBubble
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
              bookmarked={bookmarkedTurnIds.has(turn.id)}
              bookmarkDisabled={bookmarkDisabled}
              onToggleBookmark={onToggleBookmark}
              modelLabel={modelLabel}
              memory={memory}
              fileEdits={fileEdits}
              reactions={reactions}
              editOffers={editOffers}
            />
          </React.Fragment>
        );
      })}
    </>
  );
});

WorkshopThread.displayName = 'WorkshopThread';
