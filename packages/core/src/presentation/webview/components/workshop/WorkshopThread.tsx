/** Render completed Workshop history with sidecar-correlated affordances. */

import type { WorkshopTurnMemoryControls } from './memory/WorkshopTurnMemory';
import type { WorkshopFileEditControls } from './fileEdits/WorkshopFileEditCard';
import type { WorkshopTodoReceiptControls } from './todos/WorkshopTodoReceipt';
import type { WorkshopLocationsProposalControls } from './locations/WorkshopLocationsProposalCard';
import type { WorkshopPassageSearchControls } from './passageSearch/WorkshopPassageSearchCard';
import type { WorkshopReactionControls } from './reactions/WorkshopTurnReactions';
import type { WorkshopEditOfferControls } from './editOffers/WorkshopEditOfferChip';
import type { WorkshopHighlightAction } from '@hooks/domain/workshop/useWorkshopHighlightAction';
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
import { WORKSHOP_TURN_ID_ATTRIBUTE, WorkshopTurnBubble } from './WorkshopTurnBubble';
import { WorkshopEarlierTurnsControl } from './WorkshopEarlierTurnsControl';
import type { WorkshopEarlierTurnsThreadView } from '@hooks/domain/workshop/useWorkshopEarlierTurns';
import { WorkshopModelSliceDivider } from './WorkshopModelSliceDivider';
import { modelOptionLabel } from '@utils/modelOptionLabel';
import {
  deriveWorkshopModelSlices,
  type WorkshopModelSlice,
  type WorkshopModelsBeforeWindow
} from '@shared/workshop/workshopModelSlices';

interface WorkshopThreadProps {
  turns: readonly WorkshopTurn[];
  /** Turns older than the snapshot window, kept by the host but not sent. */
  hiddenTurns?: number;
  /**
   * The earlier turns loaded so far and their control (ADR 2026-11-17 D7).
   * `turns` then already leads with them; this carries the host's parts for
   * them, which the window's own props do not hold. Absent, the thread shows
   * the plain notice.
   */
  earlier?: WorkshopEarlierTurnsThreadView;
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
  /** A persona's to-do receipt and its Undo (ADR 2026-11-19 D8). */
  todoReceipt?: WorkshopTodoReceiptControls;
  /** A persona's context-paths card and its Apply (ADR 2026-11-19 D27). */
  locationsProposal?: WorkshopLocationsProposalControls;
  /** A persona's passage-search card (ADR 2026-11-20 D19). */
  passageSearch?: WorkshopPassageSearchControls;
  onHighlightAction?: WorkshopHighlightAction;
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
  hiddenTurns = 0,
  earlier,
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
  todoReceipt,
  locationsProposal,
  passageSearch, onHighlightAction,
  reactions,
  editOffers
}) => {
  // Every turn the thread holds, seeded from the window: the same derivation
  // the transcript export runs over the full ledger.
  // With earlier turns drawn, the seed is the one for the first of them.
  const modelsBeforeThread = earlier && earlier.turns.length > 0 ? earlier.modelsBefore : modelsBeforeWindow;
  const slices = React.useMemo(
    () => slicesByTurn(deriveWorkshopModelSlices(turns, { modelsBeforeWindow: modelsBeforeThread })),
    [turns, modelsBeforeThread]
  );
  // An earlier turn's reactions are the page's; the window's are the snapshot's.
  const earlierReactions = earlier?.reactionsByTurn;
  const threadReactions = React.useMemo(
    () => (reactions && earlierReactions && earlierReactions.size > 0
      ? { ...reactions, reactionsOf: (turnId: string) => earlierReactions.get(turnId) ?? reactions.reactionsOf(turnId) }
      : reactions),
    [reactions, earlierReactions]
  );
  const modelLabel = React.useCallback(
    (modelId: string) => modelOptionLabel(modelOptions, modelId),
    [modelOptions]
  );
  return (
    <>
      {/* The hidden turns are the oldest, so their notice leads the thread.
          A plain block: it is present at load, so it is not announced. */}
      {earlier && <WorkshopEarlierTurnsControl earlier={earlier} rowAttribute={WORKSHOP_TURN_ID_ATTRIBUTE} />}
      {!earlier && hiddenTurns > 0 && (
        <div className="pm-ws-thread-hidden">
          {hiddenTurns.toLocaleString()} earlier {hiddenTurns === 1 ? 'turn isn\'t' : 'turns aren\'t'} shown here.{' '}
          {hiddenTurns === 1 ? 'It\'s' : 'They\'re'} kept in full: export, bookmarks and the personas still have{' '}
          {hiddenTurns === 1 ? 'it' : 'them'}.
        </div>
      )}
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
                  ?? earlier?.widgetConfigSummaries[turn.widgetCommit.widgetConfigId]
                : undefined}
              onOpenWidgetRecommendation={onOpenWidgetRecommendation}
              rewindability={turnRewindability[turn.id] ?? earlier?.turnRewindability[turn.id]}
              rewindPausedReason={rewindPausedReason}
              onRewind={onRewind}
              branchability={turnBranchability[turn.id] ?? earlier?.turnRewindability[turn.id]}
              branchPausedReason={branchPausedReason}
              onBranch={onBranch}
              bookmarked={bookmarkedTurnIds.has(turn.id)}
              bookmarkDisabled={bookmarkDisabled}
              onToggleBookmark={onToggleBookmark}
              modelLabel={modelLabel}
              memory={memory}
              fileEdits={fileEdits}
              todoReceipt={todoReceipt}
              locationsProposal={locationsProposal}
              passageSearch={passageSearch}
              onHighlightAction={onHighlightAction}
              reactions={threadReactions}
              editOffers={editOffers}
            />
          </React.Fragment>
        );
      })}
    </>
  );
});

WorkshopThread.displayName = 'WorkshopThread';
