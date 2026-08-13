/** Cancellable, pre-commit Creative Variations generation routes. */

import { MessageRouter } from '@handlers/MessageRouter';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  CreativeVariationsGenerationRequest,
  CreativeVariationsService,
  CreativeVariationsSourceMaterial
} from '@services/widgets/creativeVariations/CreativeVariationsService';
import type {
  CreativeVariationsWorkupIdFactory
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsWorkupId';
import type {
  WorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import type { LogSink } from '@/platform';
import {
  MessageType,
  type CancelCreativeVariationsGenerateRequestMessage,
  type WorkshopCreativeVariationsGenerateMessage,
  type WorkshopCreativeVariationsGenerationProgressMessage,
  type WorkshopCreativeVariationsResultMessage,
  type WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  assertCreativeVariationsDraftIntegrity,
  assertCreativeVariationsDraftShape
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec';
import {
  creativeVariationsGenerationDraft,
  creativeVariationsSourceReferenceKey
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';
import {
  CREATIVE_VARIATIONS_RESPONSE_START
} from '@services/widgets/creativeVariations/CreativeVariationsResponseCodec';

type CreativeGenerationStage =
  WorkshopCreativeVariationsGenerationProgressMessage['payload']['stage'];

const PROGRESS_REPORT_INTERVAL_CHARACTERS = 1_000;

export type WorkshopCreativeVariationsServicePort = Pick<
  CreativeVariationsService,
  'generate'
>;

interface ActiveGeneration {
  controller: AbortController;
  token: string;
  workupId: string;
  outputCharacters: number;
  lastReportedCharacters: number;
  markerBuffer: string;
  stage: CreativeGenerationStage;
}

export class WorkshopCreativeVariationsHandler {
  private activeGeneration?: ActiveGeneration;

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly service: WorkshopCreativeVariationsServicePort,
    private readonly createWorkupId: CreativeVariationsWorkupIdFactory,
    private readonly availability: WorkshopWidgetAvailabilityPolicy,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(
      MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE,
      this.handleGenerate.bind(this)
    );
    router.register(
      MessageType.CANCEL_CREATIVE_VARIATIONS_GENERATE_REQUEST,
      this.handleCancelGenerate.bind(this)
    );
  }

  dispose(): void {
    this.activeGeneration?.controller.abort();
    this.activeGeneration = undefined;
  }

  async handleGenerate(message: WorkshopCreativeVariationsGenerateMessage): Promise<void> {
    const { widgetId, token } = message.payload;
    const workupId = this.createWorkupId();
    if (widgetId !== 'creative-variations' || !this.availability.isAvailable(widgetId)) {
      this.postResult({
        widgetId,
        token,
        workupId,
        ok: false,
        error: 'That widget is not available yet.'
      });
      return;
    }

    this.cancelActiveGeneration('superseded');
    const controller = new AbortController();
    const progress: ActiveGeneration = {
      controller,
      token,
      workupId,
      outputCharacters: 0,
      lastReportedCharacters: 0,
      markerBuffer: '',
      stage: 'requesting'
    };
    this.activeGeneration = progress;
    const onToken = (chunk: string): void => this.handleToken(progress, chunk);
    this.postProgress(progress, 'started');

    try {
      const transientDraft = creativeVariationsGenerationDraft(message.payload);
      assertCreativeVariationsDraftShape(transientDraft, 'Creative Variations request');
      assertCreativeVariationsDraftIntegrity(transientDraft, 'Creative Variations request');
      const request: CreativeVariationsGenerationRequest = {
        workupId,
        subject: transientDraft.subject,
        surroundingContext: transientDraft.surroundingContext,
        invariants: transientDraft.invariants,
        intent: transientDraft.intent,
        requestedCount: transientDraft.requestedCount,
        sourceMaterials: this.resolveSourceMaterials(
          transientDraft.surroundingContext.sourceReferences
        ),
        onToken,
        signal: controller.signal
      };
      const result = await this.service.generate(request);
      if (
        result.cancelled
        || controller.signal.aborted
        || this.activeGeneration !== progress
      ) {
        return;
      }
      progress.stage = 'validating';
      this.postProgress(progress, 'completed', result.usage?.completionTokens);
      this.postResult({ widgetId, token, workupId, ok: true, workup: result.workup });
      this.outputChannel.appendLine(
        `[WorkshopCreativeVariationsHandler] Generated ${result.workup.cards.length} variations `
        + `(token ${token}, workup ${workupId})`
      );
    } catch (error) {
      if (controller.signal.aborted || this.activeGeneration !== progress) {
        return;
      }
      const details = error instanceof Error ? error.message : String(error);
      this.postResult({ widgetId, token, workupId, ok: false, error: details });
      this.outputChannel.appendLine(
        `[WorkshopCreativeVariationsHandler] Generation failed `
        + `(token ${token}, workup ${workupId}): ${details}`
      );
    } finally {
      if (this.activeGeneration === progress) {
        this.activeGeneration = undefined;
      }
    }
  }

  async handleCancelGenerate(
    message: CancelCreativeVariationsGenerateRequestMessage
  ): Promise<void> {
    if (
      message.payload.domain === 'workshop-creative-variations'
      && this.activeGeneration?.token === message.payload.requestId
    ) {
      this.cancelActiveGeneration('writer');
    }
  }

  private handleToken(progress: ActiveGeneration, chunk: string): void {
    if (this.activeGeneration !== progress || progress.controller.signal.aborted) {
      return;
    }
    progress.outputCharacters += chunk.length;
    const markerCandidate = `${progress.markerBuffer}${chunk}`;
    if (markerCandidate.includes(CREATIVE_VARIATIONS_RESPONSE_START)) {
      progress.stage = 'variations';
    }
    progress.markerBuffer = markerCandidate.slice(-128);
    if (
      progress.outputCharacters - progress.lastReportedCharacters
      < PROGRESS_REPORT_INTERVAL_CHARACTERS
    ) {
      return;
    }
    progress.lastReportedCharacters = progress.outputCharacters;
    this.postProgress(progress, 'streaming');
  }

  private cancelActiveGeneration(reason: 'writer' | 'superseded'): void {
    const active = this.activeGeneration;
    if (!active) {
      return;
    }
    active.controller.abort();
    this.postProgress(active, 'cancelled');
    this.outputChannel.appendLine(
      `[WorkshopCreativeVariationsHandler] Generation cancelled `
      + `(token ${active.token}, workup ${active.workupId}, reason=${reason})`
    );
    this.activeGeneration = undefined;
  }

  private postProgress(
    active: ActiveGeneration,
    phase: WorkshopCreativeVariationsGenerationProgressMessage['payload']['phase'],
    completionTokens?: number
  ): void {
    const message: WorkshopCreativeVariationsGenerationProgressMessage = {
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS,
      source: 'extension.workshop',
      payload: {
        widgetId: 'creative-variations',
        token: active.token,
        workupId: active.workupId,
        phase,
        stage: active.stage,
        outputCharacters: active.outputCharacters,
        estimatedOutputTokens: Math.ceil(active.outputCharacters / 4),
        completionTokens,
        outputTokenLimit: PROMPT_BUDGETS.workshopWidgets.creativeOutputTokens
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private postResult(payload: WorkshopCreativeVariationsResultMessage['payload']): void {
    const message: WorkshopCreativeVariationsResultMessage = {
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private resolveSourceMaterials(
    references: WorkshopWidgetSourceReference[]
  ): CreativeVariationsSourceMaterial[] {
    const seen = new Set<string>();
    return references.map((reference) => {
      const key = creativeVariationsSourceReferenceKey(reference);
      if (seen.has(key)) {
        throw new Error(`Duplicate source material reference: ${key}`);
      }
      seen.add(key);
      if (reference.kind === 'active-excerpt') {
        const excerpt = this.session.getExcerpt();
        if (!excerpt) {
          throw new Error('The active excerpt referenced by this widget is no longer available.');
        }
        return {
          reference,
          label: `Active excerpt v${excerpt.version}`,
          content: excerpt.text
        };
      }
      const attachment = this.session.getContextAttachment(reference.attachmentId);
      if (!attachment) {
        throw new Error(`Context item ${reference.attachmentId} is no longer available.`);
      }
      return { reference, label: attachment.label, content: attachment.content };
    });
  }
}
