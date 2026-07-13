import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { LogSink } from '@/platform';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopToolReportCompletion } from '@/application/services/workshop/WorkshopSessionService';
import {
  AnalysisStreamingOptions,
  AssistantToolService
} from '@services/analysis/AssistantToolService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { trimToWordLimit } from '@/utils/textUtils';
import { WorkshopExcerpt, WorkshopToolId, WorkshopTurn } from '@messages';
import {
  WorkshopCapabilityArtifactDetails,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';

export interface PersonaAnalysisAdoption {
  turn: WorkshopTurn;
  replacedConversationId?: string;
}

/**
 * The one isolated Workshop analysis boundary shared by user-triggered and
 * persona-triggered side passes. It owns tool invocation and sidecar adoption;
 * callers own the surrounding host synthesis/capability loop.
 */
export class WorkshopAnalysisSidePass {
  constructor(
    private readonly assistantToolService: AssistantToolService,
    private readonly session: WorkshopSessionService,
    private readonly outputChannel: LogSink
  ) {}

  run(
    toolId: WorkshopToolId,
    excerpt: WorkshopExcerpt,
    streamingOptions: AnalysisStreamingOptions,
    personaInstructions?: string
  ): Promise<AnalysisResult> {
    const context = this.buildContext(personaInstructions);
    if (toolId === 'dialogue') {
      return this.assistantToolService.analyzeDialogue(
        excerpt.text,
        context,
        excerpt.sourceUri,
        undefined,
        streamingOptions
      );
    }
    if (toolId === 'prose') {
      return this.assistantToolService.analyzeProse(
        excerpt.text,
        context,
        excerpt.sourceUri,
        streamingOptions
      );
    }
    return this.assistantToolService.analyzeWritingTools(
      excerpt.text,
      context,
      excerpt.sourceUri,
      toolId,
      streamingOptions
    );
  }

  adoptWriterReport(input: {
    requestId: string;
    content: string;
    conversationId: string;
    usage?: AnalysisResult['usage'];
    truncated?: boolean;
    toolId: WorkshopToolId;
  }): WorkshopToolReportCompletion | undefined {
    const completion = this.session.completeToolReport(
      input.requestId,
      input.content,
      input.conversationId,
      input.usage,
      input.truncated
    );
    if (completion?.replacedConversationId) {
      this.assistantToolService.discardConversation(completion.replacedConversationId);
      this.outputChannel.appendLine(
        `[WorkshopAnalysisSidePass] Tool sidecar replaced: ${completion.replacedConversationId} → ${input.conversationId} (${input.toolId}, writer-requested)`
      );
    }
    return completion;
  }

  adoptPersonaReport(input: {
    hostRequestId: string;
    excerptVersion: number;
    toolId: WorkshopToolId;
    details: WorkshopCapabilityArtifactDetails;
    result: WorkshopCapabilityResult;
    conversationId?: string;
    truncated?: boolean;
  }): PersonaAnalysisAdoption | undefined {
    const completion = this.session.recordCapabilityArtifact({
      ...input,
      toolId: input.toolId
    });
    if (!completion) {
      if (input.conversationId) {
        this.assistantToolService.discardConversation(input.conversationId);
      }
      this.outputChannel.appendLine(
        `[WorkshopAnalysisSidePass] Refused late persona-requested ${input.toolId} report for ${input.hostRequestId}.`
      );
      return undefined;
    }
    if (completion.replacedConversationId) {
      this.assistantToolService.discardConversation(completion.replacedConversationId);
      this.outputChannel.appendLine(
        `[WorkshopAnalysisSidePass] Tool sidecar replaced: ${completion.replacedConversationId} → ${input.conversationId} (${input.toolId}, persona-requested)`
      );
    }
    return completion;
  }

  discardConversation(conversationId: string): void {
    this.assistantToolService.discardConversation(conversationId);
  }

  private buildContext(personaInstructions?: string): string | undefined {
    const contextBrief = this.session.getContextBrief();
    const boundedBrief = contextBrief
      ? trimToWordLimit(contextBrief, PROMPT_BUDGETS.contextBrief.words).trimmed
      : undefined;
    const instructions = personaInstructions?.trim();
    if (!instructions) return boundedBrief;
    const safeInstructions = instructions.replace(
      /<\/?persona-requested-analysis-focus\b[^>]*>/gi,
      (tag) => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    );
    return [
      boundedBrief,
      '<persona-requested-analysis-focus>',
      safeInstructions,
      '</persona-requested-analysis-focus>'
    ].filter((section): section is string => !!section).join('\n\n');
  }
}
