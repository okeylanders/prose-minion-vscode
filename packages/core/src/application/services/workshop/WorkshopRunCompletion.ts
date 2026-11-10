/**
 * The single Workshop run-completion decision tree, shared by the composer
 * path (WorkshopRoomHandler.executeMessage) and the synthesis leg of the tool
 * side-pass (RunWorkshopToolSidePass).
 *
 * PR #72 review #7: the two inline copies of this four-branch machine had
 * already drifted (one sent a cancellation status, the other didn't; their
 * zombie-discard predicates disagreed). This is now the one implementation:
 * cancelled → api-key-missing → retention-failure → adopt, where a refused
 * (zombie) completion is discarded WITHOUT streaming its content to the
 * webview and always leaves a log trail (reviews #5/#10).
 */

import { AnalysisResult } from '@/domain/models/AnalysisResult';
import {
  WorkshopSessionService,
  type WorkshopPersonaReactionOutcome
} from '@/application/services/workshop/WorkshopSessionService';
import {
  isApiKeyNotConfiguredWarning,
  TokenUsage,
  WorkshopTurn,
  WorkshopWidgetRecommendation,
  WorkshopWidgetSourceReference
} from '@messages';
import { inspectWorkshopActionableFindings } from './WorkshopActionableFindings';
import { workshopTurnModelOf } from '@/application/services/workshop/WorkshopTurnModel';
import {
  inspectWorkshopWidgetRecommendation,
  type WorkshopWidgetRecommendationInspection
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import {
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  widgetRecommendationRejectionNotice,
  widgetRecommendationRejectionReason
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationRejectionCopy';
import {
  stripWorkshopWidgetRecommendationControl
} from '@/utils/workshopWidgetRecommendationProtocol';
import { boundedLogText } from '@/utils/boundedLogText';
import {
  extractWorkshopReplyControls,
  workshopTrailersOnlyReplyLine
} from '@/utils/workshopReplyControls';
import { reportWorkshopEditOffers, settleWorkshopReplyEditOffers, type WorkshopReplyEditsContext } from '@/application/services/workshop/fileEdits/WorkshopReplyEditOffers';
import { workshopReplyReactionDropLog } from '@/utils/workshopReplyReaction';
import {
  settleWorkshopMemoryProposals,
  WORKSHOP_REPLY_MEMORY_CLOSED,
  type WorkshopReplyMemoryContext
} from '@/application/services/workshop/memory/WorkshopReplyMemory';
import { countWorkshopRoomAutoSaves } from '@/application/services/workshop/memory/WorkshopMemoryAutoSave';
import { isAgentRunIncomplete } from '@orchestration/AgentRunContracts';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import {
  recordWorkshopRetainedHistoryCommit,
  WorkshopRetainedHistoryReader
} from '@/application/services/workshop/WorkshopRetainedHistoryCommit';

export interface WorkshopRunCompletionCopy {
  cancelledStatus: string;
  apiKeyMissingError: string;
  retentionFailedError: string;
}

/** Copy for the host-synthesis leg of a tool side-pass. */
export function workshopSynthesisCompletionCopy(
  personaLabel: string,
  toolLabel: string
): WorkshopRunCompletionCopy {
  return {
    cancelledStatus: `${personaLabel} synthesis cancelled; ${toolLabel}'s report remains available.`,
    apiKeyMissingError: `${toolLabel} completed, but ${personaLabel} could not synthesize it because the OpenRouter API key is not configured.`,
    retentionFailedError: `${toolLabel} completed, but ${personaLabel} synthesis could not be retained.`
  };
}

/** Copy for an ordinary composer message (host or direct-tool target). */
export function workshopMessageCompletionCopy(label: string): WorkshopRunCompletionCopy {
  return {
    cancelledStatus: `${label} cancelled`,
    apiKeyMissingError: 'OpenRouter API key not configured.',
    retentionFailedError: `Failed to retain ${label}'s conversation.`
  };
}

export interface WorkshopRunCompletionEvents {
  streamCompleted(
    requestId: string,
    content: string,
    cancelled: boolean,
    usage?: TokenUsage,
    truncated?: boolean
  ): void;
  turnCompleted(turn: WorkshopTurn): void;
  status(message: string): void;
  error(message: string, details?: string): void;
  widgetRecommendationRejected(message: string, details?: string): void;
}

export interface WorkshopRunCompletionInput {
  session: WorkshopSessionService;
  requestId: string;
  /** Display label for log lines ("Jill", "Prose"). */
  label: string;
  result: AnalysisResult;
  /** The run's abort signal state at completion time. */
  aborted: boolean;
  /**
   * True when this run creates a NEW retained conversation (fresh host).
   * Continuations of an existing retained conversation must never discard it
   * on failure — the sidecar/host still owns that id.
   */
  createsRetainedConversation: boolean;
  copy: WorkshopRunCompletionCopy;
  discardConversation: (conversationId: string) => void;
  /**
   * Committed history counts of the retained conversation this run wrote,
   * for its retained-history mark (ADR 2026-09-30 §3). Supplied through the
   * application seam; the aggregate never reaches into provider history.
   */
  readRetainedHistory: WorkshopRetainedHistoryReader;
  /**
   * Caller-owned bookkeeping that belongs to this run's commit: room-delivery
   * acknowledgement, pending host updates, shipped attachments. It runs once
   * the reply is adopted and announced, and before the mark is recorded, so
   * the mark describes the settled participant — its manifest rows and room
   * offset — rather than the instant of adoption.
   */
  settleCommittedRun?: (turn: WorkshopTurn) => void;
  /**
   * Whether personas may propose a project memory now, and what is listed
   * (ADR 2026-11-04 D6), resolved before completion. Absent reads as closed:
   * a trailer is still stripped, and dropped.
   */
  memory?: WorkshopReplyMemoryContext;
  /**
   * Save and tell me (Slice 5): the recorded reply, and the indexes of its
   * cards to save at once, in order (Slice 6b); absent, every card waits.
   */
  memoryAutoSave?: (turn: WorkshopTurn, indexes: readonly number[]) => void;
  /** The room's automatic saves, landed and in flight (PR #201 F-04); absent, its landed receipts. */
  memoryAutoSavesInRoom?: () => number;
  /**
   * The reply's file edits, staged before completion (ADR 2026-11-05 D4,
   * D11; `resolveWorkshopReplyFileEdits`), with the setting read when the
   * reply was read. Used only for the reply it was resolved from. Absent, a
   * frame is still stripped, and dropped and counted (`not-staged`). It
   * carries the reply's edit offers too, resolved (ADR 2026-11-10 D2).
   */
  fileEdits?: WorkshopReplyEditsContext;
  /**
   * Whether personas may react (`proseMinion.workshop.reactions.personas`,
   * read with the reply; ADR 2026-11-07 Q8). Absent reads as off: a trailer
   * is still stripped, and dropped as `reactions-off`.
   */
  reactionsOpen?: boolean;
  log: (line: string) => void;
  events: WorkshopRunCompletionEvents;
}

/**
 * Settle a resolved provider result against the session. Returns the adopted
 * turn, or undefined when the result was cancelled, unusable, or refused.
 */
export function completeWorkshopRun(input: WorkshopRunCompletionInput): WorkshopTurn | undefined {
  const { session, requestId, label, result, copy, events } = input;
  const truncated = isAgentRunIncomplete(result.finishReason);

  if (input.aborted) {
    input.log(`Run cancelled: ${requestId} (${label}, ${result.content.length} chars discarded)`);
    session.abandonRun(requestId);
    if (input.createsRetainedConversation && result.conversationId) {
      input.discardConversation(result.conversationId);
    }
    events.streamCompleted(requestId, '', true);
    events.status(copy.cancelledStatus);
    return undefined;
  }

  if (isApiKeyNotConfiguredWarning(result.content)) {
    session.abandonRun(requestId);
    events.streamCompleted(requestId, '', true);
    events.error(copy.apiKeyMissingError, result.content);
    return undefined;
  }

  if (input.createsRetainedConversation && !result.conversationId) {
    session.abandonRun(requestId);
    events.streamCompleted(requestId, '', true);
    events.error(
      copy.retentionFailedError,
      'The participant response did not return a retained conversation.'
    );
    return undefined;
  }

  // Adopt BEFORE announcing completion: a zombie (session reset or run
  // preempted after dispatch) must not stream its full content to the webview
  // as if it landed, and it always leaves a log trail before the API-billed
  // turn evaporates.
  //
  // The reply's tail has one owner (ADR 2026-11-04 D6, PR #192 F-01): the
  // project-memory frame is split off first, and every other reader takes
  // the rest; every log takes the redacted copy, never the memory's text.
  const memoryContext = input.memory ?? WORKSHOP_REPLY_MEMORY_CLOSED;
  const controls = extractWorkshopReplyControls(result.content, {
    memoryOpen: memoryContext.open,
    reactions: { open: input.reactionsOpen === true, hasTarget: session.personaReplyReactionTarget(requestId) !== undefined }
  });
  const memory = settleWorkshopMemoryProposals(controls.memory, memoryContext, input.memoryAutoSave && {
    webResearchAttached: result.webResearchAttached === true,
    autoSavesInRoom: input.memoryAutoSavesInRoom ?? (() => countWorkshopRoomAutoSaves(session.readRoomLedger()))
  });
  const fileEdits: Pick<WorkshopReplyEditsContext, 'proposals' | 'logs' | 'editOffers'> = input.fileEdits?.reply === result.content
    ? input.fileEdits
    : {
      proposals: [],
      logs: (controls.fileEdits ? [...controls.fileEdits.proposals, ...controls.fileEdits.rejections] : [])
        .map(() => 'File edit proposal dropped (reason=not-staged)')
    };
  for (const line of [...memory.logs, ...fileEdits.logs, ...(controls.reaction?.rejections ?? []).map(workshopReplyReactionDropLog)]) {
    input.log(`${line} (${label})`);
  }
  const reply = controls.rest;
  const actionableFindings = inspectWorkshopActionableFindings(reply);
  if (actionableFindings.outcome !== 'absent') {
    input.log(
      `Actionable findings ${actionableFindings.outcome}: ${actionableFindings.findings.length} items (${label}${actionableFindings.outcome === 'rejected' ? `; reason=${actionableFindings.rejection}` : ''})`
    );
  }
  const widgetRecommendation = inspectWorkshopWidgetRecommendation(
    reply,
    WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
  );
  const unavailableWidgetSource = widgetRecommendation.outcome === 'accepted'
    ? unavailableWidgetSourceReference(session, widgetRecommendation.recommendation)
    : undefined;
  const recommendationRejected = widgetRecommendation.outcome === 'rejected'
    || unavailableWidgetSource !== undefined;
  const recommendationWidgetId = widgetRecommendation.outcome === 'accepted'
    ? widgetRecommendation.recommendation.widgetId
    : widgetRecommendation.outcome === 'rejected'
      ? widgetRecommendation.widgetId
      : undefined;
  if (recommendationRejected) {
    const rejectionReason = unavailableWidgetSource
      ? `unavailable_source_reference:${unavailableWidgetSource}`
      : widgetRecommendation.outcome === 'rejected'
        ? widgetRecommendationRejectionReason(widgetRecommendation)
        : undefined;
    input.log(
      'Widget recommendation rejected '
      + `(${label}${recommendationWidgetId ? `; widget=${recommendationWidgetId}` : ''}${
        rejectionReason ? `; reason=${rejectionReason}` : ''
      })`
    );
    input.log(
      `Rejected widget recommendation response (${label}`
      + `${recommendationWidgetId ? `; widget=${recommendationWidgetId}` : ''}; `
      + `${result.content.length} characters):\n${boundedLogText(controls.redacted)}`
    );
  }
  const strippedDisplayContent = widgetRecommendation.outcome !== 'absent'
    ? stripWorkshopWidgetRecommendationControl(reply)
    : reply;
  // A control-only reply (a widget, a memory proposal, a file edit, or any
  // of them together) leaves no provider prose to show, so completion
  // writes the displayed note itself, and the turn must not be attributed
  // to a model (Astra F-02, completion-stage note; ADR 2026-11-04 D6).
  const { trailers } = controls;
  // A reply of edit offers alone names nothing: it reads "Replied without a message." (ADR 2026-11-10 addendum).
  const hostWritesDisplay = (widgetRecommendation.outcome !== 'absent' || trailers.memory || trailers.fileEdits
    || trailers.reaction !== undefined || controls.editOffers !== undefined) && strippedDisplayContent.trim().length === 0;
  // R1: a reply that was only its reaction is drawn as a slim line; with cards or a widget it is a reply.
  // The ledger's line names only a reaction that lands (PR #247 M1); retention keeps the reply's intent.
  const kept = controls.reaction?.reaction;
  const hostLine = hostWritesDisplay && widgetRecommendation.outcome === 'absent';
  const reaction = controls.reaction && {
    reaction: kept,
    only: hostLine && !trailers.memory && !trailers.fileEdits,
    ...(hostLine ? { unlandedContent: workshopTrailersOnlyReplyLine({ memory: trailers.memory, fileEdits: trailers.fileEdits }) } : {}),
    outcome: (outcome: WorkshopPersonaReactionOutcome) => input.log(outcome === 'added'
      ? `Persona reaction kept (reaction=${kept}; ${label})`
      : `Persona reaction dropped (reason=${outcome}; reaction=${kept}; ${label})`)
  };
  const displayContent = !hostWritesDisplay
    ? strippedDisplayContent
    : widgetRecommendation.outcome === 'absent'
      ? workshopTrailersOnlyReplyLine({ memory: trailers.memory, fileEdits: trailers.fileEdits, ...(kept ? { reaction: kept } : {}) })
      : recommendationRejected
        ? `${label}'s widget setup could not be displayed on that pass. Ask ${label} to try again.`
        : `${label} returned a widget setup without an accompanying note.`;
  // An offer says what the reply's prose holds (ADR 2026-11-10 D1): settled once the display is known.
  const editOffers = settleWorkshopReplyEditOffers(controls.editOffers, fileEdits.editOffers,
    { content: displayContent, hostWritten: hostWritesDisplay }, (line) => input.log(`${line} (${label})`));
  const turn = session.completeRun(
    requestId,
    displayContent,
    result.usage,
    truncated,
    result.conversationId,
    actionableFindings.findings,
    result.citations,
    widgetRecommendation.outcome === 'accepted' && !unavailableWidgetSource
      ? widgetRecommendation.recommendation
      : undefined,
    hostWritesDisplay ? undefined : workshopTurnModelOf(result),
    memory.proposals,
    fileEdits.proposals,
    editOffers,
    undefined,
    reaction
  );
  if (!turn) {
    if (input.createsRetainedConversation && result.conversationId) {
      input.discardConversation(result.conversationId);
    }
    events.streamCompleted(requestId, '', true);
    input.log(
      `Discarded zombie completion: ${requestId} (${label}) — session was reset or the run preempted mid-stream`
    );
    return undefined;
  }
  reportWorkshopEditOffers(editOffers, turn, (line) => input.log(`${line} (${label})`));

  try {
    announceCommittedRun(input, turn, {
      widgetRecommendation,
      unavailableWidgetSource,
      // The session may have rewritten the host's line when a reaction did not land.
      displayContent: turn.content,
      truncated
    });
    input.settleCommittedRun?.(turn);
  } finally {
    // The history is committed whether or not settlement finished, so the
    // mark is always recorded: it describes whatever the participant now is.
    recordWorkshopRetainedHistoryCommit({
      session,
      turn,
      conversationId: result.conversationId,
      readRetainedHistory: input.readRetainedHistory,
      log: input.log
    });
  }
  if (memory.autoSave.length > 0 && turn.memoryProposals) {
    input.memoryAutoSave?.(turn, memory.autoSave);
  }
  return turn;
}

function announceCommittedRun(
  input: WorkshopRunCompletionInput,
  turn: WorkshopTurn,
  completion: {
    widgetRecommendation: ReturnType<typeof inspectWorkshopWidgetRecommendation>;
    unavailableWidgetSource: string | undefined;
    displayContent: string;
    truncated: boolean;
  }
): void {
  const { label, requestId, result, events } = input;
  const { widgetRecommendation, unavailableWidgetSource, displayContent, truncated } = completion;
  if (widgetRecommendation.outcome === 'accepted' && !unavailableWidgetSource) {
    const attached = turn.widgetRecommendation !== undefined;
    input.log(
      `Widget recommendation ${attached ? 'accepted' : 'rejected'} `
      + `(${label}; widget=${widgetRecommendation.recommendation.widgetId}`
      + `${attached ? '' : '; reason=participant_not_persona'})`
    );
  }

  if (widgetRecommendation.outcome === 'rejected') {
    const notice = widgetRecommendationRejectionNotice(label, widgetRecommendation);
    events.widgetRecommendationRejected(notice.message, notice.details);
  } else if (unavailableWidgetSource && widgetRecommendation.outcome === 'accepted') {
    const notice = {
      message: `${label}'s ${workshopWidgetLabel(
        widgetRecommendation.recommendation.widgetId
      )} setup could not be prepared.`,
      details: `It referenced context that is no longer available (${unavailableWidgetSource}). Ask ${label} to try again.`
    };
    events.widgetRecommendationRejected(notice.message, notice.details);
  }

  events.streamCompleted(requestId, displayContent, false, result.usage, truncated);
  events.turnCompleted(turn);
}

/**
 * Persona output may name only source addresses the current session minted.
 * Syntax is validated in the pure frame parser; availability belongs here,
 * where the session aggregate is in scope. A later removal still fails
 * visibly at Generate, because source bodies are deliberately resolved live.
 */
function unavailableWidgetSourceReference(
  session: WorkshopSessionService,
  recommendation: WorkshopWidgetRecommendation
): string | undefined {
  let references: readonly WorkshopWidgetSourceReference[];
  switch (recommendation.widgetId) {
    case 'gesture-playground':
    case 'creative-variations':
      references = recommendation.seed?.sourceReferences ?? [];
      break;
    case 'show-vs-tell':
      references = recommendation.seed.sourceReferences;
      break;
    case 'lexical-gravity':
      references = [];
      break;
    default:
      return assertNeverWidgetRecommendation(recommendation);
  }
  for (const reference of references) {
    if (reference.kind === 'active-excerpt') {
      if (!session.getExcerpt()) {
        return 'active-excerpt';
      }
      continue;
    }
    if (!session.getContextAttachment(reference.attachmentId)) {
      return `context-attachment:${reference.attachmentId}`;
    }
  }
  return undefined;
}

function assertNeverWidgetRecommendation(value: never): never {
  throw new Error(`Unhandled Workshop widget recommendation: ${JSON.stringify(value)}`);
}
