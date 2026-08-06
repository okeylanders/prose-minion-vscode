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
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  isApiKeyNotConfiguredWarning,
  TokenUsage,
  WorkshopTurn,
  WorkshopWidgetRecommendation
} from '@messages';
import { inspectWorkshopActionableFindings } from './WorkshopActionableFindings';
import {
  inspectWorkshopWidgetRecommendation,
  WorkshopWidgetRecommendationInspection
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import {
  stripWorkshopWidgetRecommendationControl
} from '@/utils/workshopWidgetRecommendationProtocol';
import { boundedLogText } from '@/utils/boundedLogText';

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
  log: (line: string) => void;
  events: WorkshopRunCompletionEvents;
}

const WIDGET_FIELD_LABELS = Object.freeze({
  targetPhrase: 'Target phrase',
  writerInstructions: 'Writer instructions',
  contextText: 'Surrounding context',
  sourceReferences: 'Source references',
  characterNotes: 'Character notes',
  lensSlug: 'Lens',
  weight: 'Weight',
  reach: 'Reach',
  metaphorPull: 'Metaphor pull'
});

const INVALID_WIDGET_FIELD_COPY = Object.freeze({
  empty: 'was empty',
  target_missing_from_context: 'did not contain the exact target phrase',
  invalid_source_references: 'contained unavailable or malformed source references',
  unsupported_lens: 'named a lens that personas are not allowed to seed',
  invalid_weight: 'was outside the allowed weight steps',
  invalid_reach: 'was outside the allowed reach values',
  invalid_metaphor_pull: 'was not true or false'
});

function widgetRecommendationRejectionReason(
  inspection: Extract<WorkshopWidgetRecommendationInspection, { outcome: 'rejected' }>
): string {
  if (inspection.rejection === 'field_too_long') {
    return `${inspection.rejection}:${inspection.field}:`
      + `${inspection.actualCharacters}/${inspection.maximumCharacters}`;
  }
  if (inspection.rejection === 'frame_too_long') {
    return `${inspection.rejection}:${inspection.actualCharacters}/${inspection.maximumCharacters}`;
  }
  if (inspection.rejection === 'invalid_field') {
    return `${inspection.rejection}:${inspection.field}:${inspection.reason}`;
  }
  return inspection.rejection;
}

function widgetRecommendationRejectionNotice(
  label: string,
  inspection: Extract<WorkshopWidgetRecommendationInspection, { outcome: 'rejected' }>
): { message: string; details: string } {
  const message = `${label}'s widget recommendation could not be prepared.`;
  if (inspection.rejection === 'field_too_long') {
    return {
      message,
      details: `${WIDGET_FIELD_LABELS[inspection.field]} used `
        + `${inspection.actualCharacters.toLocaleString('en-US')} characters; the limit is `
        + `${inspection.maximumCharacters.toLocaleString('en-US')}. Ask ${label} to try again.`
    };
  }
  if (inspection.rejection === 'frame_too_long') {
    return {
      message,
      details: `The generated setup used ${inspection.actualCharacters.toLocaleString('en-US')} `
        + `characters; the complete-frame limit is `
        + `${inspection.maximumCharacters.toLocaleString('en-US')}. Ask ${label} to try again.`
    };
  }
  if (inspection.rejection === 'invalid_field') {
    return {
      message,
      details: `${WIDGET_FIELD_LABELS[inspection.field]} `
        + `${INVALID_WIDGET_FIELD_COPY[inspection.reason]}. Ask ${label} to try again.`
    };
  }
  return {
    message,
    details: `The generated setup was incomplete or invalid. Ask ${label} to try again.`
  };
}

/**
 * Settle a resolved provider result against the session. Returns the adopted
 * turn, or undefined when the result was cancelled, unusable, or refused.
 */
export function completeWorkshopRun(input: WorkshopRunCompletionInput): WorkshopTurn | undefined {
  const { session, requestId, label, result, copy, events } = input;
  const truncated = result.finishReason === 'length';

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
  const actionableFindings = inspectWorkshopActionableFindings(result.content);
  if (actionableFindings.outcome !== 'absent') {
    input.log(
      `Actionable findings ${actionableFindings.outcome}: ${actionableFindings.findings.length} items (${label}${actionableFindings.outcome === 'rejected' ? `; reason=${actionableFindings.rejection}` : ''})`
    );
  }
  const widgetRecommendation = inspectWorkshopWidgetRecommendation(result.content);
  const unavailableWidgetSource = widgetRecommendation.outcome === 'accepted'
    ? unavailableWidgetSourceReference(session, widgetRecommendation.recommendation)
    : undefined;
  const recommendationRejected = widgetRecommendation.outcome === 'rejected'
    || unavailableWidgetSource !== undefined;
  if (widgetRecommendation.outcome !== 'absent') {
    const rejectionReason = unavailableWidgetSource
      ? `unavailable_source_reference:${unavailableWidgetSource}`
      : widgetRecommendation.outcome === 'rejected'
        ? widgetRecommendationRejectionReason(widgetRecommendation)
        : undefined;
    input.log(
      `Widget recommendation ${unavailableWidgetSource ? 'rejected' : widgetRecommendation.outcome} `
      + `(${label}${
        rejectionReason ? `; reason=${rejectionReason}` : ''
      })`
    );
    if (recommendationRejected) {
      input.log(
        `Rejected widget recommendation response (${label}; ${result.content.length} characters):\n`
        + boundedLogText(result.content)
      );
    }
  }
  const strippedDisplayContent = widgetRecommendation.outcome !== 'absent'
    ? stripWorkshopWidgetRecommendationControl(result.content)
    : result.content;
  const displayContent = recommendationRejected && strippedDisplayContent.trim().length === 0
    ? `${label}'s widget setup could not be displayed on that pass. Ask ${label} to try again.`
    : strippedDisplayContent;
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
      : undefined
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

  if (widgetRecommendation.outcome === 'rejected') {
    const notice = widgetRecommendationRejectionNotice(label, widgetRecommendation);
    events.widgetRecommendationRejected(notice.message, notice.details);
  } else if (unavailableWidgetSource) {
    const notice = {
      message: `${label}'s widget recommendation could not be prepared.`,
      details: `It referenced context that is no longer available (${unavailableWidgetSource}). Ask ${label} to try again.`
    };
    events.widgetRecommendationRejected(notice.message, notice.details);
  }

  events.streamCompleted(requestId, displayContent, false, result.usage, truncated);
  events.turnCompleted(turn);
  return turn;
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
  if (recommendation.widgetId !== 'gesture-playground') {
    return undefined;
  }
  const references = recommendation.seed?.sourceReferences ?? [];
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
