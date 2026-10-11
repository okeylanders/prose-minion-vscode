/**
 * Cancellable, pre-commit Show vs. Tell generation routes.
 *
 * One generation is active at a time. Every attempt gets a fresh host-minted
 * workup id, and a result is posted only while its attempt is still the active
 * one, so a late reply for a superseded or cancelled token is dropped rather
 * than shown as current. Generation reads the session for source text and
 * never writes it.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  ShowVsTellGenerationRequest,
  ShowVsTellService,
  ShowVsTellSourceMaterial
} from '@services/widgets/showVsTell/ShowVsTellService';
import type {
  ShowVsTellWorkupIdFactory
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellWorkupId';
import type {
  WorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import type { LogSink } from '@/platform';
import {
  MessageType,
  type CancelShowVsTellGenerateRequestMessage,
  type WorkshopShowVsTellGenerateMessage,
  type WorkshopShowVsTellGenerationProgressMessage,
  type WorkshopShowVsTellResultMessage,
  type WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  assertShowVsTellDraftShape
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  assertShowVsTellDraftIntegrity
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity';
import {
  showVsTellGenerationDraft,
  showVsTellSourceReferenceKey
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  SHOW_VS_TELL_RESPONSE_START
} from '@services/widgets/showVsTell/ShowVsTellResponseCodec';

type ShowVsTellGenerationStage =
  WorkshopShowVsTellGenerationProgressMessage['payload']['stage'];

const PROGRESS_REPORT_INTERVAL_CHARACTERS = 1_000;

export type WorkshopShowVsTellServicePort = Pick<ShowVsTellService, 'generate'>;

interface ActiveGeneration {
  controller: AbortController;
  token: string;
  workupId: string;
  outputCharacters: number;
  lastReportedCharacters: number;
  markerBuffer: string;
  stage: ShowVsTellGenerationStage;
}

export class WorkshopShowVsTellHandler {
  private activeGeneration?: ActiveGeneration;

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly service: WorkshopShowVsTellServicePort,
    private readonly createWorkupId: ShowVsTellWorkupIdFactory,
    private readonly availability: WorkshopWidgetAvailabilityPolicy,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(
      MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE,
      this.handleGenerate.bind(this)
    );
    router.register(
      MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST,
      this.handleCancelGenerate.bind(this)
    );
  }

  dispose(): void {
    this.activeGeneration?.controller.abort();
    this.activeGeneration = undefined;
  }

  isGenerationActive(): boolean {
    return this.activeGeneration !== undefined;
  }

  async handleGenerate(message: WorkshopShowVsTellGenerateMessage): Promise<void> {
    const { widgetId, token } = message.payload;
    const workupId = this.createWorkupId();
    if (widgetId !== 'show-vs-tell' || !this.availability.isAvailable(widgetId)) {
      // Refused before any attempt starts, so an unrelated active run is untouched.
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
    const attempt: ActiveGeneration = {
      controller,
      token,
      workupId,
      outputCharacters: 0,
      lastReportedCharacters: 0,
      markerBuffer: '',
      stage: 'requesting'
    };
    this.activeGeneration = attempt;
    const onToken = (chunk: string): void => this.handleToken(attempt, chunk);
    this.postProgress(attempt, 'started');

    try {
      const transientDraft = showVsTellGenerationDraft(message.payload);
      assertShowVsTellDraftShape(transientDraft, 'Show vs. Tell request');
      assertShowVsTellDraftIntegrity(transientDraft, 'Show vs. Tell request');
      const request: ShowVsTellGenerationRequest = {
        workupId,
        beat: transientDraft.beat,
        surroundingContext: transientDraft.surroundingContext,
        pov: transientDraft.pov,
        invariants: transientDraft.invariants,
        channels: transientDraft.channels,
        lengthBudget: transientDraft.lengthBudget,
        position: transientDraft.position,
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
        || this.activeGeneration !== attempt
      ) {
        return;
      }
      attempt.stage = 'validating';
      this.postProgress(attempt, 'completed', result.usage?.completionTokens);
      this.postResult({ widgetId, token, workupId, ok: true, workup: result.workup });
      this.outputChannel.appendLine(
        `[WorkshopShowVsTellHandler] Generated workup with ${
          result.workup.groups.reduce((total, group) => total + group.variants.length, 0)
        } variants (token ${token}, workup ${workupId})`
      );
    } catch (error) {
      if (controller.signal.aborted || this.activeGeneration !== attempt) {
        return;
      }
      const details = error instanceof Error ? error.message : String(error);
      // The failed attempt still ends its progress stream, then reports why.
      this.postProgress(attempt, 'completed');
      this.postResult({ widgetId, token, workupId, ok: false, error: details });
      this.outputChannel.appendLine(
        `[WorkshopShowVsTellHandler] Generation failed (token ${token}, workup ${workupId}): ${details}`
      );
    } finally {
      if (this.activeGeneration === attempt) {
        this.activeGeneration = undefined;
      }
    }
  }

  async handleCancelGenerate(
    message: CancelShowVsTellGenerateRequestMessage
  ): Promise<void> {
    if (
      message.payload.domain === 'workshop-show-vs-tell'
      && this.activeGeneration?.token === message.payload.requestId
    ) {
      this.cancelActiveGeneration('writer');
    }
  }

  private handleToken(attempt: ActiveGeneration, chunk: string): void {
    if (this.activeGeneration !== attempt || attempt.controller.signal.aborted) {
      return;
    }
    attempt.outputCharacters += chunk.length;
    const markerCandidate = `${attempt.markerBuffer}${chunk}`;
    if (markerCandidate.includes(SHOW_VS_TELL_RESPONSE_START)) {
      attempt.stage = 'workup';
    }
    attempt.markerBuffer = markerCandidate.slice(-128);
    if (
      attempt.outputCharacters - attempt.lastReportedCharacters
      < PROGRESS_REPORT_INTERVAL_CHARACTERS
    ) {
      return;
    }
    attempt.lastReportedCharacters = attempt.outputCharacters;
    this.postProgress(attempt, 'streaming');
  }

  private cancelActiveGeneration(reason: 'writer' | 'superseded'): void {
    const active = this.activeGeneration;
    if (!active) {
      return;
    }
    active.controller.abort();
    this.postProgress(active, 'cancelled');
    this.outputChannel.appendLine(
      `[WorkshopShowVsTellHandler] Generation cancelled `
      + `(token ${active.token}, workup ${active.workupId}, reason=${reason})`
    );
    this.activeGeneration = undefined;
  }

  private postProgress(
    active: ActiveGeneration,
    phase: WorkshopShowVsTellGenerationProgressMessage['payload']['phase'],
    completionTokens?: number
  ): void {
    const message: WorkshopShowVsTellGenerationProgressMessage = {
      type: MessageType.WORKSHOP_SHOW_VS_TELL_GENERATION_PROGRESS,
      source: 'extension.workshop',
      payload: {
        widgetId: 'show-vs-tell',
        token: active.token,
        workupId: active.workupId,
        phase,
        stage: active.stage,
        outputCharacters: active.outputCharacters,
        estimatedOutputTokens: Math.ceil(active.outputCharacters / 4),
        completionTokens,
        outputTokenLimit: PROMPT_BUDGETS.workshopWidgets.showVsTellOutputTokens
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private postResult(payload: WorkshopShowVsTellResultMessage['payload']): void {
    const message: WorkshopShowVsTellResultMessage = {
      type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  /** Reads the session only; a missing source fails the attempt before any spend. */
  private resolveSourceMaterials(
    references: WorkshopWidgetSourceReference[]
  ): ShowVsTellSourceMaterial[] {
    const seen = new Set<string>();
    return references.map((reference) => {
      const key = showVsTellSourceReferenceKey(reference);
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
