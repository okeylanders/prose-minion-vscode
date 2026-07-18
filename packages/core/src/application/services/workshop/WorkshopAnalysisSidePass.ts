import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { LogSink } from '@/platform';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { buildWorkshopContextAttachmentsFrame } from '@/application/services/workshop/WorkshopPromptBuilder';
import type { WorkshopToolReportCompletion } from '@/application/services/workshop/WorkshopSessionService';
import {
  AnalysisStreamingOptions,
  AssistantToolService
} from '@services/analysis/AssistantToolService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { trimToWordLimit } from '@/utils/textUtils';
import { WorkshopExcerpt, WorkshopToolId, WorkshopTurn, workshopExcerptSourceUri } from '@messages';
import {
  WorkshopCapabilityArtifactDetails,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import {
  inspectWorkshopActionableFindings,
  WORKSHOP_ACTIONABLE_FINDINGS_INSTRUCTION
} from './WorkshopActionableFindings';

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
        workshopExcerptSourceUri(excerpt.source),
        undefined,
        streamingOptions
      );
    }
    if (toolId === 'prose') {
      return this.assistantToolService.analyzeProse(
        excerpt.text,
        context,
        workshopExcerptSourceUri(excerpt.source),
        streamingOptions
      );
    }
    return this.assistantToolService.analyzeWritingTools(
      excerpt.text,
      context,
      workshopExcerptSourceUri(excerpt.source),
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
    const actionableFindings = this.inspectActionableFindings(
      input.content,
      `${input.toolId} writer-requested report`
    );
    const completion = this.session.completeToolReport(
      input.requestId,
      input.content,
      input.conversationId,
      input.usage,
      input.truncated,
      actionableFindings
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
    const actionableFindings = this.inspectActionableFindings(
      input.result.content ?? input.result.error ?? '',
      `${input.toolId} persona-requested report`
    );
    const completion = this.session.recordCapabilityArtifact({
      ...input,
      toolId: input.toolId,
      actionableFindings
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

  private inspectActionableFindings(content: string, context: string) {
    const inspection = inspectWorkshopActionableFindings(content);
    if (inspection.outcome !== 'absent') {
      this.outputChannel.appendLine(
        `[WorkshopAnalysisSidePass] Actionable findings ${inspection.outcome} (${context}; ${inspection.findings.length} items${inspection.outcome === 'rejected' ? `; reason=${inspection.rejection}` : ''})`
      );
    }
    return inspection.findings;
  }

  private buildContext(personaInstructions?: string): string | undefined {
    const attachmentsFrame = buildWorkshopContextAttachmentsFrame(
      this.session.getContextAttachments()
    );
    const instructions = personaInstructions?.trim();
    if (!instructions) {
      return [attachmentsFrame, WORKSHOP_ACTIONABLE_FINDINGS_INSTRUCTION]
        .filter((section): section is string => !!section)
        .join('\n\n');
    }
    const safeInstructions = instructions.replace(
      /<\/?persona-requested-analysis-focus\b[^>]*>/gi,
      (tag) => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    );
    return [
      attachmentsFrame,
      WORKSHOP_ACTIONABLE_FINDINGS_INSTRUCTION,
      '<persona-requested-analysis-focus>',
      safeInstructions,
      '</persona-requested-analysis-focus>'
    ].filter((section): section is string => !!section).join('\n\n');
  }
}
