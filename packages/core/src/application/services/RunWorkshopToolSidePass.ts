/** Focused Sprint 06B use case: isolated tool report, then host synthesis. */

import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import {
  buildWorkshopDirectHandoff,
  buildWorkshopHostMessage,
  buildWorkshopHostUpdateFrame,
  describeWorkshopPendingHostUpdates,
  buildWorkshopToolEvidence
} from '@/application/services/WorkshopPromptBuilder';
import {
  completeWorkshopRun,
  workshopSynthesisCompletionCopy
} from '@/application/services/WorkshopRunCompletion';
import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { LogSink } from '@/platform';
import { AssistantToolService, AnalysisStreamingOptions } from '@services/analysis/AssistantToolService';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import {
  isApiKeyNotConfiguredWarning,
  TokenUsage,
  WorkshopExcerpt,
  WorkshopToolId,
  WorkshopTurn
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { trimToWordLimit } from '@/utils/textUtils';

let sidePassRequestCounter = 0;
const createRequestId = (type: string) => `${type}-${Date.now()}-${++sidePassRequestCounter}`;

export interface WorkshopToolSidePassEvents {
  activatePhase: (
    requestId: string,
    label: string,
    toolId: WorkshopToolId,
    controller: AbortController
  ) => void;
  streamStarted: (requestId: string) => void;
  streamChunk: (requestId: string, token: string) => void;
  streamCompleted: (
    requestId: string,
    content: string,
    cancelled: boolean,
    usage?: TokenUsage,
    truncated?: boolean
  ) => void;
  turnCompleted: (turn: WorkshopTurn) => void;
  sessionChanged: () => void;
  status: (message: string) => void;
  error: (message: string, details?: string) => void;
  settled: (requestId: string) => void;
}

export class RunWorkshopToolSidePass {
  constructor(
    private readonly assistantToolService: AssistantToolService,
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink
  ) {}

  async run(
    toolId: WorkshopToolId,
    excerpt: WorkshopExcerpt,
    controller: AbortController,
    events: WorkshopToolSidePassEvents
  ): Promise<void> {
    const toolLabel = workshopToolLabel(toolId);
    const personaId = this.session.getSelectedPersonaId();
    const personaLabel = workshopPersonaLabel(personaId);
    const toolRequestId = createRequestId(`workshop_${toolId}`);
    let currentRequestId = toolRequestId;
    let reportAdopted = false;
    let hostDeliveryAttempted = false;
    const hadHostConversation = this.session.hasHostConversation();
    const pendingHandoff = buildWorkshopDirectHandoff(this.session.collectUnseenDirectExchanges());
    const pendingHostUpdates = this.session.collectPendingHostUpdates();
    const hostUpdateFrame = hadHostConversation
      ? buildWorkshopHostUpdateFrame(pendingHostUpdates)
      : undefined;
    if (pendingHostUpdates) {
      this.outputChannel.appendLine(
        `[RunWorkshopToolSidePass] Pending host update prepared for synthesis (${describeWorkshopPendingHostUpdates(pendingHostUpdates)}; ${hadHostConversation ? 'retained delta frame' : 'fresh-host initial envelope'})`
      );
    }
    if (pendingHandoff) {
      this.outputChannel.appendLine(
        `[RunWorkshopToolSidePass] Direct handoff prepared for synthesis: ${pendingHandoff.unseenTurns} unseen → ${pendingHandoff.includedTurns} included, ${pendingHandoff.omittedTurns} omitted, ${pendingHandoff.truncatedCharacters} chars truncated`
      );
    }

    events.activatePhase(toolRequestId, toolLabel, toolId, controller);
    const userTurn = this.session.beginToolRun(toolId, toolRequestId);
    events.turnCompleted(userTurn);
    events.sessionChanged();
    events.streamStarted(toolRequestId);
    events.status(`${personaLabel} is having ${toolLabel} look at that now…`);

    try {
      const result = await this.invokeTool(toolId, excerpt, {
        signal: controller.signal,
        onToken: (token: string) => events.streamChunk(toolRequestId, token),
        retainConversation: true
      });
      const truncated = result.finishReason === 'length';

      if (controller.signal.aborted) {
        this.outputChannel.appendLine(
          `[RunWorkshopToolSidePass] Tool cancelled: ${toolRequestId} (${toolLabel}, ${result.content.length} chars discarded)`
        );
        this.session.abandonRun(toolRequestId);
        if (result.conversationId) {
          this.assistantToolService.discardConversation(result.conversationId);
        }
        events.streamCompleted(toolRequestId, '', true);
        return;
      }
      if (isApiKeyNotConfiguredWarning(result.content)) {
        this.session.abandonRun(toolRequestId);
        events.streamCompleted(toolRequestId, '', true);
        events.error('OpenRouter API key not configured.', result.content);
        return;
      }
      if (!result.conversationId) {
        this.session.abandonRun(toolRequestId);
        events.streamCompleted(toolRequestId, '', true);
        events.error(
          `Failed to retain ${toolLabel}`,
          'The completed tool response did not return a retained conversation.'
        );
        return;
      }

      // Adopt BEFORE announcing completion: a zombie report must not stream
      // its full content to the webview as a finished turn that then never
      // lands (PR #72 review #10).
      const completion = this.session.completeToolReport(
        toolRequestId,
        result.content,
        result.conversationId,
        result.usage,
        truncated
      );
      if (!completion) {
        this.assistantToolService.discardConversation(result.conversationId);
        this.outputChannel.appendLine(
          `[RunWorkshopToolSidePass] Discarded zombie tool completion: ${toolRequestId} (${toolLabel}) — session was reset or the run preempted mid-stream`
        );
        events.streamCompleted(toolRequestId, '', true);
        events.sessionChanged();
        return;
      }

      events.streamCompleted(toolRequestId, result.content, false, result.usage, truncated);
      events.turnCompleted(completion.turn);
      reportAdopted = true;
      if (completion.replacedConversationId) {
        this.assistantToolService.discardConversation(completion.replacedConversationId);
        this.outputChannel.appendLine(
          `[RunWorkshopToolSidePass] Tool sidecar replaced: ${completion.replacedConversationId} → ${result.conversationId} (${toolLabel})`
        );
      }
      events.sessionChanged();

      const synthesisRequestId = createRequestId(`workshop_${toolId}_synthesis`);
      currentRequestId = synthesisRequestId;
      events.activatePhase(synthesisRequestId, personaLabel, toolId, controller);
      this.session.beginPersonaSynthesis(synthesisRequestId, completion.turn.id);
      events.streamStarted(synthesisRequestId);
      events.status(`Waiting for ${personaLabel} to synthesize ${toolLabel}…`);

      const evidence = buildWorkshopToolEvidence({
        toolId,
        originatingRequest: userTurn.content,
        report: result.content,
        usage: result.usage,
        truncated
      });
      const hostMessage = buildWorkshopHostMessage(evidence, {
        handoff: pendingHandoff,
        writerMessageIsTrustedEnvelope: true,
        hostUpdate: hostUpdateFrame
      });
      const hostConversationId = this.session.getHostConversationId();
      hostDeliveryAttempted = true;
      const synthesis = hostConversationId
        ? await this.assistantToolService.continueConversation(hostConversationId, hostMessage, {
            signal: controller.signal,
            onToken: (token: string) => events.streamChunk(synthesisRequestId, token)
          })
        : await this.assistantToolService.startWorkshopPersonaConversation({
            personaId,
            excerpt,
            message: hostMessage,
            messageIsTrustedEnvelope: true,
            contextBrief: this.session.getContextBrief()
          }, {
            signal: controller.signal,
            onToken: (token: string) => events.streamChunk(synthesisRequestId, token)
          });
      const synthesisTurn = completeWorkshopRun({
        session: this.session,
        requestId: synthesisRequestId,
        label: `${personaLabel} synthesis`,
        result: synthesis,
        aborted: controller.signal.aborted,
        createsRetainedConversation: !hostConversationId,
        copy: workshopSynthesisCompletionCopy(personaLabel, toolLabel),
        discardConversation: (id) => this.assistantToolService.discardConversation(id),
        log: (line) => this.outputChannel.appendLine(`[RunWorkshopToolSidePass] ${line}`),
        events: {
          streamCompleted: events.streamCompleted,
          turnCompleted: events.turnCompleted,
          status: events.status,
          error: events.error
        }
      });
      if (synthesisTurn && pendingHandoff) {
        this.session.commitHostHandoff(pendingHandoff.deliveredTurnIds);
      }
      if (synthesisTurn && pendingHostUpdates) {
        this.session.commitPendingHostUpdates(pendingHostUpdates);
        this.outputChannel.appendLine(
          `[RunWorkshopToolSidePass] Pending host update committed (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
        );
      } else if (pendingHostUpdates) {
        this.outputChannel.appendLine(
          `[RunWorkshopToolSidePass] Pending host update retained after incomplete synthesis (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
        );
      }
      events.sessionChanged();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.session.abandonRun(currentRequestId);
      events.streamCompleted(currentRequestId, '', true);
      if (hostDeliveryAttempted && pendingHostUpdates) {
        this.outputChannel.appendLine(
          `[RunWorkshopToolSidePass] Pending host update retained after failed synthesis (${describeWorkshopPendingHostUpdates(pendingHostUpdates)}): ${details}`
        );
      }
      if (error instanceof Error && error.name === 'AbortError') {
        events.status(
          reportAdopted
            ? `${personaLabel} synthesis cancelled; ${toolLabel}'s report remains available.`
            : `${toolLabel} cancelled`
        );
      } else {
        events.error(
          reportAdopted
            ? `${toolLabel} completed, but ${personaLabel} synthesis failed`
            : `Failed to run ${toolLabel}`,
          details
        );
      }
      events.sessionChanged();
    } finally {
      // Every exit publishes the authoritative no-longer-active snapshot;
      // cancelled/error branches otherwise leave a rehydrated activeToolId
      // stranded in the webview after STREAM_COMPLETE clears its live bubble.
      events.sessionChanged();
      events.settled(currentRequestId);
    }
  }

  private invokeTool(
    toolId: WorkshopToolId,
    excerpt: WorkshopExcerpt,
    streamingOptions: AnalysisStreamingOptions
  ): Promise<AnalysisResult> {
    const contextBrief = this.session.getContextBrief();
    const boundedContextBrief = contextBrief
      ? trimToWordLimit(contextBrief, PROMPT_BUDGETS.contextBrief.words).trimmed
      : undefined;
    if (toolId === 'dialogue') {
      return this.assistantToolService.analyzeDialogue(
        excerpt.text,
        boundedContextBrief,
        excerpt.sourceUri,
        undefined,
        streamingOptions
      );
    }
    if (toolId === 'prose') {
      return this.assistantToolService.analyzeProse(
        excerpt.text,
        boundedContextBrief,
        excerpt.sourceUri,
        streamingOptions
      );
    }
    return this.assistantToolService.analyzeWritingTools(
      excerpt.text,
      boundedContextBrief,
      excerpt.sourceUri,
      toolId,
      streamingOptions
    );
  }
}
