/**
 * Conversation Widgets IPC slice for Workshop (ADR 2026-07-22, Sprint 01).
 *
 * WorkshopHandler owns the room and run orchestration. This per-webview
 * collaborator owns only the widget routes: the pre-commit GENERATE call
 * (touches no session state, freely cancellable) and the atomic COMMIT route
 * (persist config → mint artifact → ship through the injected room-send seam
 * → stamp linkage). It is constructed inside WorkshopHandler with closures
 * over the handler's private seams — the WorkshopSessionMessageHandler mold —
 * so the composition root stays ignorant of workshop internals.
 */

import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageTransport } from '@/application/handlers/MessageHandlerContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  GesturePlaygroundService,
  GestureSourceMaterial
} from '@services/widgets/GesturePlaygroundService';
import { buildGestureDirective } from '@/application/services/workshop/WorkshopPromptBuilder';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopCommitWidgetMessage,
  WorkshopGestureDraft,
  WorkshopGestureMenuGroup,
  WorkshopWidgetActionResultMessage,
  WorkshopWidgetActionResultPayload,
  WorkshopWidgetGenerateMessage,
  WorkshopWidgetGenerationProgressMessage,
  WorkshopWidgetSourceReference,
  CancelWidgetGenerateRequestMessage,
  WorkshopWidgetMenuResultMessage,
  WorkshopRequestWidgetConfigMessage,
  WorkshopWidgetConfigDataMessage
} from '@messages';
import { isLiveWorkshopWidgetId, workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopMutationRouteRegistrar } from '@handlers/domain/WorkshopSessionMessageHandler';

export interface WorkshopWidgetHandlerOptions {
  /**
   * The one room-send seam (WorkshopHandler.executeMessage): mints the
   * visible turn, ships the frame, and reports whether the assistant reply
   * actually landed. `includeMessageAttachments` stays false on this path —
   * the writer's staged pills belong to the message they were typing.
   */
  sendRoomMessage: (
    text: string,
    displayText: string,
    executeOptions: {
      includeMessageAttachments: false;
      widgetArtifact: {
        id: string;
        widgetId: 'gesture-playground';
        widgetConfigId: string;
        label: string;
        content: string;
        selectionCount: number;
      };
    }
  ) => Promise<{ committed: boolean; userTurnId?: string }>;
  postSessionState: () => void;
  markDirty: (reason: string) => void;
  reportError: (message: string, details?: string) => void;
}

type GestureGenerationStage =
  WorkshopWidgetGenerationProgressMessage['payload']['stage'];

const GESTURE_PROGRESS_REPORT_INTERVAL_CHARACTERS = 1_000;

export class WorkshopWidgetHandler {
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
    private readonly gestureService: GesturePlaygroundService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly options: WorkshopWidgetHandlerOptions
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    // Generate is a pre-commit preview: no session state, no mutation gate.
    router.register(MessageType.WORKSHOP_WIDGET_GENERATE, this.handleGenerate.bind(this));
    router.register(
      MessageType.CANCEL_WIDGET_GENERATE_REQUEST,
      this.handleCancelGenerate.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      this.handleRequestConfig.bind(this)
    );
    registerMutation(MessageType.WORKSHOP_COMMIT_WIDGET, this.handleCommit.bind(this));
  }

  dispose(): void {
    this.activeGeneration?.controller.abort();
    this.activeGeneration = undefined;
  }

  async handleGenerate(message: WorkshopWidgetGenerateMessage): Promise<void> {
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
    if (widgetId !== 'gesture-playground' || !isLiveWorkshopWidgetId(widgetId)) {
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
          `[WorkshopWidgetHandler] Added gestures to ${menu.length} groups (token ${token})`
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
          `[WorkshopWidgetHandler] Gesture dictionary and menu generated (${result.menu.length} groups, token ${token})`
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
          `[WorkshopWidgetHandler] Gesture dictionary recovered without a usable menu (token ${token}): ${menuError}`
        );
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const details = error instanceof Error ? error.message : String(error);
      this.postMenuResult({ widgetId, token, mode, ok: false, error: details });
      this.outputChannel.appendLine(
        `[WorkshopWidgetHandler] Gesture Dictionary generation failed (token ${token}): ${details}`
      );
    } finally {
      if (this.activeGeneration?.controller === controller) {
        this.activeGeneration = undefined;
      }
    }
  }

  async handleCancelGenerate(message: CancelWidgetGenerateRequestMessage): Promise<void> {
    if (
      this.activeGeneration
      && message.payload.requestId === this.activeGeneration.token
    ) {
      this.cancelActiveGeneration('writer');
    }
  }

  async handleRequestConfig(message: WorkshopRequestWidgetConfigMessage): Promise<void> {
    const configId = message.payload.configId.trim();
    const config = /^wc-[1-9]\d*$/.test(configId)
      ? this.session.getWidgetConfig(configId)
      : undefined;
    const response: WorkshopWidgetConfigDataMessage = {
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      source: 'extension.workshop.widget',
      timestamp: Date.now(),
      payload: config
        ? { configId, config }
        : { configId, error: 'That widget configuration is no longer available.' }
    };
    await this.postMessage(response);
  }

  /**
   * The atomic commit: validate → persist the Draft under a fresh `wc-N`
   * (created BEFORE the send so the visible turn can reference it, and so a
   * failed send leaves a durable retry token instead of an orphaned pill) →
   * mint the `ta-N` artifact → ship → stamp linkage and the writer-origin
   * manifest only when the reply actually lands.
   */
  async handleCommit(message: WorkshopCommitWidgetMessage): Promise<void> {
    const { widgetId, draft, clonedFromConfigId } = message.payload;
    if (widgetId !== 'gesture-playground' || !isLiveWorkshopWidgetId(widgetId)) {
      this.postActionResult({
        action: 'commit',
        widgetId,
        ok: false,
        message: 'That widget is not available yet.'
      });
      return;
    }
    const invalid = this.validateGestureDraft(draft);
    if (invalid) {
      this.postActionResult({ action: 'commit', widgetId, ok: false, message: invalid });
      return;
    }
    const target = this.session.getChatTarget();
    if (target.kind === 'tool') {
      this.postActionResult({
        action: 'commit',
        widgetId,
        ok: false,
        message: 'Switch to a persona target before committing a widget — tool sidecars do not take gesture directions.'
      });
      return;
    }

    const config = this.session.createWidgetConfig({ widgetId, draft, clonedFromConfigId });
    const artifactId = this.session.mintWidgetArtifactId();
    const label = workshopWidgetLabel(widgetId);
    const directive = buildGestureDirective(draft);
    const selectionCount = draft.selections.length;
    const displayText = `For “${draft.targetPhrase.trim()}” — here are the gesture directions I want${
      draft.note.trim().length > 0 ? ` — ${draft.note.trim()}` : ''
    }${draft.includeDictionaryInCommit ? ', with the full Gesture Dictionary shared as reference' : ''}.`;

    this.outputChannel.appendLine(
      `[WorkshopWidgetHandler] Widget commit staged (${config.id} → ${artifactId}, ${selectionCount} selections${clonedFromConfigId ? `, cloned from ${clonedFromConfigId}` : ''})`
    );
    // The config is session truth from this moment; persist it even if the
    // send below fails, so the Draft survives a reload as the retry token.
    this.options.markDirty('widget config created');

    try {
      const outcome = await this.options.sendRoomMessage(displayText, displayText, {
        includeMessageAttachments: false,
        widgetArtifact: {
          id: artifactId,
          widgetId,
          widgetConfigId: config.id,
          label,
          content: directive,
          selectionCount
        }
      });
      if (!outcome.committed || !outcome.userTurnId) {
        this.postActionResult({
          action: 'commit',
          widgetId,
          ok: false,
          widgetConfigId: config.id,
          message: 'The room did not accept the commit. Your selections are kept — try again.'
        });
        return;
      }
      this.session.recordWidgetCommit(config.id, { turnId: outcome.userTurnId, artifactId });
      this.session.recordWidgetArtifactDelivery(
        artifactId,
        label,
        directive.length,
        target
      );
      this.options.markDirty('widget commit landed');
      this.options.postSessionState();
      this.postActionResult({
        action: 'commit',
        widgetId,
        ok: true,
        widgetConfigId: config.id,
        turnId: outcome.userTurnId
      });
      this.outputChannel.appendLine(
        `[WorkshopWidgetHandler] Widget commit landed (${config.id} on turn ${outcome.userTurnId})`
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.postActionResult({
        action: 'commit',
        widgetId,
        ok: false,
        widgetConfigId: config.id,
        message: 'The commit failed before the room replied. Your selections are kept — try again.'
      });
      this.outputChannel.appendLine(
        `[WorkshopWidgetHandler] Widget commit failed (${config.id}): ${details}`
      );
    }
  }

  /** Deterministic pre-flight — the same bounds the generate service enforces. */
  private validateGestureDraft(draft: WorkshopGestureDraft): string | undefined {
    const budget = PROMPT_BUDGETS.workshopWidgets;
    if (typeof draft.includeDictionaryInCommit !== 'boolean') {
      return 'Choose whether the full Gesture Dictionary should be shared with the room.';
    }
    if (draft.targetPhrase.trim().length === 0) {
      return 'Gesture Playground needs a target phrase.';
    }
    if (draft.targetPhrase.length > budget.gestureTargetPhraseCharacters) {
      return `The target phrase exceeds ${budget.gestureTargetPhraseCharacters} characters.`;
    }
    if (draft.writerInstructions.length > budget.gestureWriterInstructionsCharacters) {
      return `The writer instructions exceed ${budget.gestureWriterInstructionsCharacters} characters.`;
    }
    if (draft.contextText.length > budget.gestureContextCharacters) {
      return `The context exceeds ${budget.gestureContextCharacters} characters.`;
    }
    if (draft.characterNotes.length > budget.gestureCharacterNotesCharacters) {
      return `The character notes exceed ${budget.gestureCharacterNotesCharacters} characters.`;
    }
    const invalidSources = this.validateSourceReferences(draft.sourceReferences);
    if (invalidSources) {
      return invalidSources;
    }
    if (draft.dictionaryMarkdown.trim().length === 0) {
      return 'Generate a Gesture Dictionary and alternatives before committing.';
    }
    if (draft.dictionaryMarkdown.length > budget.gestureDictionaryCharacters) {
      return `The Gesture Dictionary exceeds ${budget.gestureDictionaryCharacters} characters.`;
    }
    if (!draft.menu) {
      return 'Generate a valid alternatives menu before committing.';
    }
    const invalidMenu = this.validateGestureMenu(draft.menu);
    if (invalidMenu) {
      return invalidMenu;
    }
    if (draft.selections.length === 0) {
      return 'Keep at least one direction before committing.';
    }
    if (draft.selections.length > budget.gestureSelectionsPerCommit) {
      return `A commit carries at most ${budget.gestureSelectionsPerCommit} directions.`;
    }
    if (draft.selections.some((selection) =>
      selection.trim().length === 0 || selection.length > budget.gestureOptionCharacters
    )) {
      return 'One of the kept directions is empty or too long.';
    }
    if (new Set(draft.selections.map((selection) => selection.trim())).size !== draft.selections.length) {
      return 'The kept directions contain a duplicate.';
    }
    const menuOptions = new Set(draft.menu.flatMap((group) => group.options));
    if (draft.selections.some((selection) => !menuOptions.has(selection))) {
      return 'One of the kept directions is not part of the generated menu.';
    }
    if (draft.note.length > budget.gestureNoteCharacters) {
      return `The note exceeds ${budget.gestureNoteCharacters} characters.`;
    }
    return undefined;
  }

  private validateGestureMenu(
    menu: readonly WorkshopGestureMenuGroup[]
  ): string | undefined {
    const budget = PROMPT_BUDGETS.workshopWidgets;
    if (
      menu.length < budget.gestureMenuGroupsMinimum
      || menu.length > budget.gestureMenuGroups
    ) {
      return `The alternatives menu must carry ${budget.gestureMenuGroupsMinimum}–${budget.gestureMenuGroups} groups.`;
    }

    const seenOptions = new Set<string>();
    for (const [groupIndex, group] of menu.entries()) {
      if (
        group.heading.trim().length === 0
        || group.heading !== group.heading.trim()
        || group.heading.length > budget.gestureOptionCharacters
      ) {
        return `Alternatives group ${groupIndex + 1} has an invalid heading.`;
      }
      if (
        group.options.length < budget.gestureOptionsPerGroupMinimum
        || group.options.length > budget.gestureOptionsPerGroup
      ) {
        return `Alternatives group ${groupIndex + 1} must carry ${budget.gestureOptionsPerGroupMinimum}–${budget.gestureOptionsPerGroup} options.`;
      }
      for (const option of group.options) {
        if (
          option.trim().length === 0
          || option !== option.trim()
          || option.length > budget.gestureOptionCharacters
        ) {
          return `Alternatives group ${groupIndex + 1} contains an invalid option.`;
        }
        if (seenOptions.has(option)) {
          return 'The alternatives menu contains a duplicate option.';
        }
        seenOptions.add(option);
      }
    }
    return undefined;
  }

  private mergeGestureMenus(
    current: readonly WorkshopGestureMenuGroup[],
    additions: readonly WorkshopGestureMenuGroup[]
  ): WorkshopGestureMenuGroup[] {
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

  private postMenuResult(payload: WorkshopWidgetMenuResultMessage['payload']): void {
    const result: WorkshopWidgetMenuResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_MENU_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(result);
  }

  private postGenerationProgress(
    payload: WorkshopWidgetGenerationProgressMessage['payload']
  ): void {
    const progress: WorkshopWidgetGenerationProgressMessage = {
      type: MessageType.WORKSHOP_WIDGET_GENERATION_PROGRESS,
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
      `[WorkshopWidgetHandler] Gesture generation cancelled ` +
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
    const invalid = this.validateSourceReferences(references);
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

  private validateSourceReferences(
    value: unknown
  ): string | undefined {
    const budget = PROMPT_BUDGETS.workshopWidgets;
    const maximum = budget.gestureSourceReferences;
    if (!Array.isArray(value) || value.length > maximum) {
      return `Source material must carry at most ${maximum} references.`;
    }
    const seen = new Set<string>();
    let serializedCharacters = 0;
    for (const referenceValue of value) {
      if (
        typeof referenceValue !== 'object'
        || referenceValue === null
        || Array.isArray(referenceValue)
      ) {
        return 'One of the source material references is invalid.';
      }
      const reference = referenceValue as Record<string, unknown>;
      let key: string;
      if (reference.kind === 'active-excerpt') {
        if (Object.keys(reference).length !== 1) {
          return 'The active excerpt source reference is invalid.';
        }
        key = 'active-excerpt';
      } else if (reference.kind === 'context-attachment') {
        if (
          Object.keys(reference).length !== 2
          || typeof reference.attachmentId !== 'string'
          || !/^ctx-[1-9]\d*$/.test(reference.attachmentId)
        ) {
          return 'One of the context source references is invalid.';
        }
        key = `context-attachment:${reference.attachmentId}`;
      } else {
        return 'One of the source material references is invalid.';
      }
      serializedCharacters += key.length + (seen.size > 0 ? 1 : 0);
      if (serializedCharacters > budget.gestureSourceReferenceCharacters) {
        return `Source material references exceed ${budget.gestureSourceReferenceCharacters} characters.`;
      }
      if (seen.has(key)) {
        return 'The source material references contain a duplicate.';
      }
      seen.add(key);
    }
    return undefined;
  }

  private estimateVisibleTokens(outputCharacters: number): number {
    return Math.ceil(outputCharacters / 4);
  }

  private postActionResult(payload: WorkshopWidgetActionResultPayload): void {
    const result: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(result);
  }
}
