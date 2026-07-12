/** Focused Sprint 06B use case: isolated tool report, then host synthesis. */

import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import {
  buildWorkshopHostMessage,
  buildWorkshopToolEvidence
} from '@/application/services/WorkshopPromptBuilder';
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
    const pendingHandoff = this.session.prepareHostHandoff();

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

      events.streamCompleted(toolRequestId, result.content, false, result.usage, truncated);
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
          `[RunWorkshopToolSidePass] Discarded zombie tool completion: ${toolRequestId} (${toolLabel})`
        );
        events.sessionChanged();
        return;
      }

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
      const hostMessage = buildWorkshopHostMessage(evidence, pendingHandoff, true);
      const hostConversationId = this.session.getHostConversationId();
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
      const synthesisAdopted = this.completeSynthesis(
        synthesis,
        synthesisRequestId,
        hostConversationId,
        toolLabel,
        personaLabel,
        controller,
        events
      );
      if (synthesisAdopted && pendingHandoff) {
        this.session.commitHostHandoff(pendingHandoff);
      }
      events.sessionChanged();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.session.abandonRun(currentRequestId);
      events.streamCompleted(currentRequestId, '', true);
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

  private completeSynthesis(
    synthesis: AnalysisResult,
    requestId: string,
    hostConversationId: string | undefined,
    toolLabel: string,
    personaLabel: string,
    controller: AbortController,
    events: WorkshopToolSidePassEvents
  ): boolean {
    const truncated = synthesis.finishReason === 'length';
    if (controller.signal.aborted) {
      this.session.abandonRun(requestId);
      if (!hostConversationId && synthesis.conversationId) {
        this.assistantToolService.discardConversation(synthesis.conversationId);
      }
      events.streamCompleted(requestId, '', true);
      events.status(`${personaLabel} synthesis cancelled; ${toolLabel}'s report remains available.`);
      return false;
    }
    if (isApiKeyNotConfiguredWarning(synthesis.content)) {
      this.session.abandonRun(requestId);
      events.streamCompleted(requestId, '', true);
      events.error(
        `${toolLabel} completed, but ${personaLabel} could not synthesize it because the OpenRouter API key is not configured.`,
        synthesis.content
      );
      return false;
    }
    if (!hostConversationId && !synthesis.conversationId) {
      this.session.abandonRun(requestId);
      events.streamCompleted(requestId, '', true);
      events.error(
        `${toolLabel} completed, but ${personaLabel} synthesis could not be retained.`,
        'The host response did not return a retained conversation.'
      );
      return false;
    }

    events.streamCompleted(requestId, synthesis.content, false, synthesis.usage, truncated);
    const synthesisTurn = this.session.completeRun(
      requestId,
      synthesis.content,
      synthesis.usage,
      truncated,
      synthesis.conversationId
    );
    if (synthesisTurn) {
      events.turnCompleted(synthesisTurn);
      return true;
    } else if (!hostConversationId && synthesis.conversationId) {
      this.assistantToolService.discardConversation(synthesis.conversationId);
    }
    return false;
  }

  private invokeTool(
    toolId: WorkshopToolId,
    excerpt: WorkshopExcerpt,
    streamingOptions: AnalysisStreamingOptions
  ): Promise<AnalysisResult> {
    if (toolId === 'dialogue') {
      return this.assistantToolService.analyzeDialogue(
        excerpt.text,
        undefined,
        excerpt.sourceUri,
        undefined,
        streamingOptions
      );
    }
    if (toolId === 'prose') {
      return this.assistantToolService.analyzeProse(
        excerpt.text,
        undefined,
        excerpt.sourceUri,
        streamingOptions
      );
    }
    return this.assistantToolService.analyzeWritingTools(
      excerpt.text,
      undefined,
      excerpt.sourceUri,
      toolId,
      streamingOptions
    );
  }
}
