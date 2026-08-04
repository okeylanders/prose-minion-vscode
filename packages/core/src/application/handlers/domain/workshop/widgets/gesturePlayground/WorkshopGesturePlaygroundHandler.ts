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
import {
  buildGestureDirective
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundDirective';
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
  WorkshopWidgetMenuResultMessage
} from '@messages';
import { isLiveWorkshopWidgetId, workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopMutationRouteRegistrar } from '@handlers/domain/WorkshopSessionMessageHandler';

export interface WorkshopGesturePlaygroundHandlerOptions {
  /**
   * The one room-send seam (WorkshopHandler.executeMessage). Acceptance is a
   * separate milestone from the participant reply: `onRoomAccepted` fires
   * once the writer turn and artifact are room truth, so the authoring sheet
   * never waits on model latency or loses its Draft on a preflight rejection.
   * `includeMessageAttachments` stays false on this path — the writer's
   * staged pills belong to the message they were typing.
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
      onRoomAccepted: (userTurnId: string) => void;
    }
  ) => Promise<{ committed: boolean; userTurnId?: string }>;
  postSessionState: () => void;
  markDirty: (reason: string) => void;
  reportError: (message: string, details?: string) => void;
  /** Backend race guard; the webview also disables commit while a room run owns the slot. */
  isRoomRunActive: () => boolean;
}

type GestureGenerationStage =
  WorkshopWidgetGenerationProgressMessage['payload']['stage'];

const GESTURE_PROGRESS_REPORT_INTERVAL_CHARACTERS = 1_000;

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
    private readonly gestureService: GesturePlaygroundService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly options: WorkshopGesturePlaygroundHandlerOptions
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
    registerMutation(
      MessageType.WORKSHOP_COMMIT_WIDGET,
      this.handleCommit.bind(this),
      undefined,
      (message) => this.postActionResult({
        action: 'commit',
        widgetId: 'gesture-playground',
        ok: false,
        message
      })
    );
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

  async handleCancelGenerate(message: CancelWidgetGenerateRequestMessage): Promise<void> {
    if (
      this.activeGeneration
      && message.payload.requestId === this.activeGeneration.token
    ) {
      this.cancelActiveGeneration('writer');
    }
  }

  /**
   * The two-phase commit: validate → stage config/artifact → let the room
   * atomically publish the writer turn and artifact → acknowledge the sheet.
   * The participant reply is deliberately later and independent: its failure
   * belongs to the Workshop run surface and cannot revoke an accepted widget.
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
    if (this.options.isRoomRunActive()) {
      this.postActionResult({
        action: 'commit',
        widgetId,
        ok: false,
        message: 'Wait for the current Workshop response to finish before committing another widget.'
      });
      return;
    }

    let accepted = false;
    let configId: string | undefined;
    try {
      const config = this.session.createWidgetConfig({ widgetId, draft, clonedFromConfigId });
      configId = config.id;
      const artifactId = this.session.mintWidgetArtifactId();
      const label = workshopWidgetLabel(widgetId);
      const directive = buildGestureDirective(draft);
      const selectionCount = draft.selections.length;
      const displayText = `For “${draft.targetPhrase.trim()}” — here are the gesture directions I want${
        draft.note.trim().length > 0 ? ` — ${draft.note.trim()}` : ''
      }${draft.includeDictionaryInCommit ? ', with the full Gesture Dictionary shared as reference' : ''}.`;

      this.outputChannel.appendLine(
        `[WorkshopGesturePlaygroundHandler] Widget commit staged (${config.id} → ${artifactId}, ${selectionCount} selections${clonedFromConfigId ? `, cloned from ${clonedFromConfigId}` : ''})`
      );
      this.options.markDirty('widget config created');

      const outcome = await this.options.sendRoomMessage(displayText, displayText, {
        includeMessageAttachments: false,
        widgetArtifact: {
          id: artifactId,
          widgetId,
          widgetConfigId: config.id,
          label,
          content: directive,
          selectionCount
        },
        onRoomAccepted: (userTurnId) => {
          this.session.recordWidgetCommit(config.id, { turnId: userTurnId, artifactId });
          this.session.recordWidgetArtifactDelivery(
            artifactId,
            label,
            directive.length,
            target
          );
          accepted = true;
          this.options.markDirty('widget commit accepted');
          this.options.postSessionState();
          this.postActionResult({
            action: 'commit',
            widgetId,
            ok: true,
            widgetConfigId: config.id,
            turnId: userTurnId
          });
          this.outputChannel.appendLine(
            `[WorkshopGesturePlaygroundHandler] Widget commit accepted (${config.id} on turn ${userTurnId})`
          );
        }
      });
      if (!accepted) {
        this.postActionResult({
          action: 'commit',
          widgetId,
          ok: false,
          widgetConfigId: config.id,
          message: 'The room did not accept the commit. Your draft is still open — try again.'
        });
        return;
      }
      if (!outcome.committed) {
        this.outputChannel.appendLine(
          `[WorkshopGesturePlaygroundHandler] Widget ${config.id} remained committed after the participant response failed`
        );
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      if (!accepted) {
        this.postActionResult({
          action: 'commit',
          widgetId,
          ok: false,
          widgetConfigId: configId,
          message: 'The commit failed before the room accepted it. Your draft is still open — try again.'
        });
      }
      this.outputChannel.appendLine(
        `[WorkshopGesturePlaygroundHandler] Widget commit failed (${configId ?? 'before-config'}): ${details}`
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
      source: 'extension.workshop.widget',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(result);
  }
}
