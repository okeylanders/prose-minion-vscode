import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { LogSink } from '@/platform';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  buildWorkshopContextAttachmentsFrame,
  buildWorkshopExcerptSourceFrame
} from '@/application/services/workshop/WorkshopPromptBuilder';
import type { WorkshopToolReportCompletion } from '@/application/services/workshop/WorkshopSessionService';
import {
  AnalysisStreamingOptions,
  AssistantToolService
} from '@services/analysis/AssistantToolService';
import {
  countWords
} from '@/utils/textUtils';
import {
  WorkshopConfiguredResourceRef,
  WorkshopExcerpt,
  WorkshopToolId,
  WorkshopTurn
} from '@messages';
import {
  WorkshopAnalysisInputProvenance,
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

export interface WorkshopPersonaAnalysisRunInputs {
  excerptText: string;
  context?: string;
  excerptSourceFrame?: string;
  workshopSource?: WorkshopConfiguredResourceRef;
  provenance: {
    excerpt: WorkshopAnalysisInputProvenance;
    context: WorkshopAnalysisInputProvenance;
  };
}

export interface WorkshopAnalysisRunResult extends AnalysisResult {
  inputProvenance: WorkshopPersonaAnalysisRunInputs['provenance'];
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

  /**
   * The raw `file:` sourceUri deliberately never reaches this prompt path
   * (Sprint 12 Phase 6): the display-safe `<workshop-excerpt-source>` frame
   * carries provenance, and the composite tool catalog carries read access.
   */
  async run(
    toolId: WorkshopToolId,
    excerpt: WorkshopExcerpt,
    streamingOptions: AnalysisStreamingOptions
  ): Promise<WorkshopAnalysisRunResult> {
    const attachments = this.session.getContextAttachments();
    const context = this.buildContext(
      buildWorkshopExcerptSourceFrame(excerpt.source),
      buildWorkshopContextAttachmentsFrame(attachments)
    );
    const truncations = attachments
      .filter((attachment) => attachment.truncation)
      .map((attachment) =>
        `${attachment.label}: ${attachment.truncation!.keptWords.toLocaleString('en-US')} of ` +
        `${attachment.truncation!.totalWords.toLocaleString('en-US')} words`
      );
    const result = await this.execute(
      toolId,
      excerpt.text,
      context,
      {
        ...streamingOptions,
        workshopSource: excerpt.source.kind !== 'manual'
          ? excerpt.source.configuredResource
          : undefined
      }
    );
    return {
      ...this.withDeliveredContextProvenance(result),
      inputProvenance: {
      excerpt: {
        mode: 'inherit',
        material: `pinned excerpt v${excerpt.version}`,
        chosenBy: 'Writer',
        words: countWords(excerpt.text),
        truncation: excerpt.truncation
          ? `${excerpt.truncation.pinnedWords.toLocaleString('en-US')} of ${excerpt.truncation.totalWords.toLocaleString('en-US')} words pinned`
          : undefined
      },
      context: {
        mode: 'inherit',
        material: attachments.length === 0
          ? 'no context attachments'
          : `${attachments.length} context ${attachments.length === 1 ? 'attachment' : 'attachments'} (${attachments.map((attachment) => attachment.label).join(', ')})`,
        chosenBy: 'Writer',
        words: attachments.reduce((total, attachment) => total + attachment.words, 0),
        truncation: truncations.length > 0 ? truncations.join('; ') : undefined
      }
      }
    };
  }

  /** Execute one persona-selected analysis without changing session inputs. */
  async runWithInputs(
    toolId: WorkshopToolId,
    inputs: WorkshopPersonaAnalysisRunInputs,
    streamingOptions: AnalysisStreamingOptions
  ): Promise<WorkshopAnalysisRunResult> {
    const context = this.buildContext(
      inputs.excerptSourceFrame,
      inputs.context
    );
    const result = await this.execute(
      toolId,
      inputs.excerptText,
      context,
      { ...streamingOptions, workshopSource: inputs.workshopSource }
    );
    return {
      ...this.withDeliveredContextProvenance(result),
      inputProvenance: inputs.provenance
    };
  }

  private async execute(
    toolId: WorkshopToolId,
    excerptText: string,
    context: string | undefined,
    options: AnalysisStreamingOptions
  ): Promise<AnalysisResult> {
    const result = toolId === 'dialogue'
      ? await this.assistantToolService.analyzeDialogue(
          excerptText,
          context,
          undefined,
          undefined,
          options
        )
      : toolId === 'prose'
        ? await this.assistantToolService.analyzeProse(
            excerptText,
            context,
            undefined,
            options
          )
        : await this.assistantToolService.analyzeWritingTools(
            excerptText,
            context,
            undefined,
            toolId,
            options
          );
    return result;
  }

  /**
   * Deterministic delivered-resource provenance in the visible report
   * (Sprint 12 Phase 6): what the run actually received is stated by the
   * host, never claimed by the model. The footer opens with its own heading
   * so the strict `### Next steps` section scan is terminated, not polluted.
   */
  private withDeliveredContextProvenance(result: AnalysisResult): AnalysisResult {
    const resources = result.requestedResources ?? [];
    const guides = result.usedGuides ?? [];
    if (resources.length === 0 && guides.length === 0) {
      return result;
    }
    const footer = [
      '### Context delivered to this run',
      ...(resources.length > 0 ? [`- Project resources: ${resources.join(', ')}`] : []),
      ...(guides.length > 0 ? [`- Craft guides: ${guides.join(', ')}`] : [])
    ].join('\n');
    return { ...result, content: `${result.content}\n\n${footer}` };
  }

  adoptWriterReport(input: {
    requestId: string;
    content: string;
    conversationId: string;
    usage?: AnalysisResult['usage'];
    truncated?: boolean;
    toolId: WorkshopToolId;
    inputProvenance?: WorkshopAnalysisRunResult['inputProvenance'];
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
      actionableFindings,
      input.inputProvenance
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

  private buildContext(
    excerptSourceFrame: string | undefined,
    inputContext: string | undefined
  ): string | undefined {
    return [excerptSourceFrame, inputContext, WORKSHOP_ACTIONABLE_FINDINGS_INSTRUCTION]
      .filter((section): section is string => !!section)
      .join('\n\n');
  }
}
