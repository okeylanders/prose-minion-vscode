/**
 * Conversation Widgets IPC slice for Workshop (ADR 2026-07-22, Sprint 01).
 *
 * WorkshopRoomHandler owns the room and run orchestration. This per-webview
 * collaborator owns only Gesture Playground's pre-commit GENERATE calls. The
 * family-generic Widget Host owns the one-shot COMMIT route and transaction.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  GesturePlaygroundService,
  GestureSourceMaterial
} from '@services/widgets/GesturePlaygroundService';
import type {
  WorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  gesturePlaygroundSourceReferencesValidationError
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundSourceReferences';
import { LogSink } from '@/platform';
import {
  MessageType,
  CancelGesturePlaygroundGenerateRequestMessage,
  WorkshopGesturePlaygroundGenerateMessage,
  WorkshopGesturePlaygroundGenerationProgressMessage,
  WorkshopGesturePlaygroundMenuResultMessage,
  WorkshopGesturePlaygroundMenuGroup,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

type GestureGenerationStage =
  WorkshopGesturePlaygroundGenerationProgressMessage['payload']['stage'];

const GESTURE_PROGRESS_REPORT_INTERVAL_CHARACTERS = 1_000;

export type WorkshopGesturePlaygroundServicePort = Pick<
  GesturePlaygroundService,
  'generateMenu' | 'generateMore'
>;

export class WorkshopGesturePlaygroundHandler {
  private activeGeneration?: {
    controller: AbortController;
    token: string;
    outputCharacters: number;
    lastReportedCharacters: number;
    markerBuffer: string;
    stage: GestureGenerationStage;
    outputTokenLimit: number;
  };

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly gestureService: WorkshopGesturePlaygroundServicePort,
    private readonly availability: WorkshopWidgetAvailabilityPolicy,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    // Generate is a pre-commit preview: no session state, no mutation gate.
    router.register(
      MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATE,
      this.handleGenerate.bind(this)
    );
    router.register(
      MessageType.CANCEL_GESTURE_PLAYGROUND_GENERATE_REQUEST,
      this.handleCancelGenerate.bind(this)
    );
  }

  dispose(): void {
    this.activeGeneration?.controller.abort();
    this.activeGeneration = undefined;
  }

  async handleGenerate(message: WorkshopGesturePlaygroundGenerateMessage): Promise<void> {
    const {
      widgetId,
      token,
      targetPhrase,
      writerInstructions,
      contextText,
      characterNotes,
      sourceReferences,
      mode
    } = message.payload;
    if (widgetId !== 'gesture-playground' || !this.availability.isAvailable(widgetId)) {
      this.postMenuResult({
        widgetId,
        token,
        mode,
        ok: false,
        error: 'That widget is not available yet.'
      });
      return;
    }
    // A regenerate supersedes the in-flight call; the stale token's result is
    // dropped by the webview even if the abort loses the race.
    this.cancelActiveGeneration('superseded');
    const controller = new AbortController();
    const outputTokenLimit = mode === 'more'
      ? PROMPT_BUDGETS.workshopWidgets.gestureMoreOutputTokens
      : PROMPT_BUDGETS.workshopWidgets.gestureOutputTokens;
    const progress: {
      controller: AbortController;
      token: string;
      outputCharacters: number;
      lastReportedCharacters: number;
      markerBuffer: string;
      stage: GestureGenerationStage;
      outputTokenLimit: number;
    } = {
      controller,
      token,
      outputCharacters: 0,
      lastReportedCharacters: 0,
      markerBuffer: '',
      stage: 'requesting',
      outputTokenLimit
    };
    this.activeGeneration = progress;
    const onToken = (chunk: string): void => {
      if (this.activeGeneration !== progress || controller.signal.aborted) {
        return;
      }
      progress.outputCharacters += chunk.length;
      const markerCandidate = `${progress.markerBuffer}${chunk}`;
      if (markerCandidate.includes('===GESTURE_MENU_V1===')) {
        progress.stage = 'menu';
      } else if (markerCandidate.includes('===GESTURE_DICTIONARY_V1===')) {
        progress.stage = 'dictionary';
      }
      progress.markerBuffer = markerCandidate.slice(-128);
      if (
        progress.outputCharacters - progress.lastReportedCharacters
          < GESTURE_PROGRESS_REPORT_INTERVAL_CHARACTERS
      ) {
        return;
      }
      progress.lastReportedCharacters = progress.outputCharacters;
      this.postGenerationProgress({
        widgetId,
        token,
        phase: 'streaming',
        stage: progress.stage,
        outputCharacters: progress.outputCharacters,
        estimatedOutputTokens: this.estimateVisibleTokens(progress.outputCharacters),
        outputTokenLimit
      });
    };
    try {
      this.postGenerationProgress({
        widgetId,
        token,
        phase: 'started',
        stage: 'requesting',
        outputCharacters: 0,
        estimatedOutputTokens: 0,
        outputTokenLimit
      });
      if (mode === 'more') {
        const result = await this.gestureService.generateMore({
          targetPhrase,
          writerInstructions,
          contextText,
          characterNotes,
          dictionaryMarkdown: message.payload.dictionaryMarkdown,
          menu: message.payload.menu,
          onToken,
          signal: controller.signal
        });
        if (result.cancelled || controller.signal.aborted) {
          return;
        }
        const menu = this.mergeGestureMenus(message.payload.menu, result.additions);
        this.postGenerationProgress({
          widgetId,
          token,
          phase: 'completed',
          stage: 'validating',
          outputCharacters: progress.outputCharacters,
          estimatedOutputTokens: this.estimateVisibleTokens(progress.outputCharacters),
          completionTokens: result.usage?.completionTokens,
          outputTokenLimit
        });
        this.postMenuResult({
          widgetId,
          token,
          mode,
          ok: true,
          dictionaryMarkdown: message.payload.dictionaryMarkdown,
          menu
        });
        this.outputChannel.appendLine(
          `[WorkshopGesturePlaygroundHandler] Added gestures to ${menu.length} groups (token ${token})`
        );
        return;
      }

      const sourceMaterials = this.resolveSourceMaterials(sourceReferences);
      const result = await this.gestureService.generateMenu({
        targetPhrase,
        writerInstructions,
        contextText,
        characterNotes,
        sourceMaterials,
        onToken,
        signal: controller.signal
      });
      if (result.cancelled || controller.signal.aborted) {
        return;
      }
      this.postGenerationProgress({
        widgetId,
        token,
        phase: 'completed',
        stage: 'validating',
        outputCharacters: progress.outputCharacters,
        estimatedOutputTokens: this.estimateVisibleTokens(progress.outputCharacters),
        completionTokens: result.usage?.completionTokens,
        outputTokenLimit
      });
      if (result.menu) {
        this.postMenuResult({
          widgetId,
          token,
          mode,
          ok: true,
          dictionaryMarkdown: result.dictionaryMarkdown,
          menu: result.menu,
          truncated: result.truncated
        });
        this.outputChannel.appendLine(
          `[WorkshopGesturePlaygroundHandler] Gesture dictionary and menu generated (${result.menu.length} groups, token ${token})`
        );
      } else {
        const menuError = result.menuError
          ?? 'The Gesture Dictionary was generated, but its alternatives menu was unusable. Try Generate again.';
        this.postMenuResult({
          widgetId,
          token,
          mode,
          ok: false,
          dictionaryMarkdown: result.dictionaryMarkdown,
          menuError,
          truncated: result.truncated
        });
        this.outputChannel.appendLine(
          `[WorkshopGesturePlaygroundHandler] Gesture dictionary recovered without a usable menu (token ${token}): ${menuError}`
        );
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const details = error instanceof Error ? error.message : String(error);
      this.postMenuResult({ widgetId, token, mode, ok: false, error: details });
      this.outputChannel.appendLine(
        `[WorkshopGesturePlaygroundHandler] Gesture Dictionary generation failed (token ${token}): ${details}`
      );
    } finally {
      if (this.activeGeneration?.controller === controller) {
        this.activeGeneration = undefined;
      }
    }
  }

  async handleCancelGenerate(
    message: CancelGesturePlaygroundGenerateRequestMessage
  ): Promise<void> {
    if (
      this.activeGeneration
      && message.payload.requestId === this.activeGeneration.token
    ) {
      this.cancelActiveGeneration('writer');
    }
  }

  private mergeGestureMenus(
    current: readonly WorkshopGesturePlaygroundMenuGroup[],
    additions: readonly WorkshopGesturePlaygroundMenuGroup[]
  ): WorkshopGesturePlaygroundMenuGroup[] {
    const maximum = PROMPT_BUDGETS.workshopWidgets.gestureOptionsPerGroup;
    return current.map((group, index) => {
      const seen = new Set(group.options.map((option) => option.toLocaleLowerCase()));
      const fresh = (additions[index]?.options ?? []).filter((option) => {
        const key = option.toLocaleLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      return {
        heading: group.heading,
        options: [...group.options, ...fresh].slice(0, maximum)
      };
    });
  }

  private postMenuResult(payload: WorkshopGesturePlaygroundMenuResultMessage['payload']): void {
    const result: WorkshopGesturePlaygroundMenuResultMessage = {
      type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(result);
  }

  private postGenerationProgress(
    payload: WorkshopGesturePlaygroundGenerationProgressMessage['payload']
  ): void {
    const progress: WorkshopGesturePlaygroundGenerationProgressMessage = {
      type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(progress);
  }

  private cancelActiveGeneration(reason: 'writer' | 'superseded'): void {
    const active = this.activeGeneration;
    if (!active) {
      return;
    }
    active.controller.abort();
    this.outputChannel.appendLine(
      `[WorkshopGesturePlaygroundHandler] Gesture generation cancelled ` +
      `(token ${active.token}, reason=${reason})`
    );
    this.postGenerationProgress({
      widgetId: 'gesture-playground',
      token: active.token,
      phase: 'cancelled',
      stage: active.stage,
      outputCharacters: active.outputCharacters,
      estimatedOutputTokens: this.estimateVisibleTokens(active.outputCharacters),
      outputTokenLimit: active.outputTokenLimit
    });
    this.activeGeneration = undefined;
  }

  private resolveSourceMaterials(
    references: WorkshopWidgetSourceReference[]
  ): GestureSourceMaterial[] {
    const invalid = gesturePlaygroundSourceReferencesValidationError(references);
    if (invalid) {
      throw new Error(invalid);
    }
    return references.map((reference): GestureSourceMaterial => {
      if (reference.kind === 'active-excerpt') {
        const excerpt = this.session.getExcerpt();
        if (!excerpt) {
          throw new Error(
            'The active excerpt referenced by this widget is no longer available.'
          );
        }
        return {
          reference,
          label: `Active excerpt v${excerpt.version}`,
          content: excerpt.text
        };
      }
      const attachment = this.session.getContextAttachment(reference.attachmentId);
      if (!attachment) {
        throw new Error(
          `Context item ${reference.attachmentId} is no longer available.`
        );
      }
      return {
        reference,
        label: attachment.label,
        content: attachment.content
      };
    });
  }

  private estimateVisibleTokens(outputCharacters: number): number {
    return Math.ceil(outputCharacters / 4);
  }

}
