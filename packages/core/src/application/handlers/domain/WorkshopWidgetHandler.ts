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
  buildGestureDirective
} from '@services/widgets/GesturePlaygroundService';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopCommitWidgetMessage,
  WorkshopGestureDraft,
  WorkshopWidgetActionResultMessage,
  WorkshopWidgetActionResultPayload,
  WorkshopWidgetGenerateMessage,
  CancelWidgetGenerateRequestMessage,
  WorkshopWidgetMenuResultMessage
} from '@messages';
import { isLiveWorkshopWidgetId, workshopWidgetLabel } from '@shared/constants/workshopWidgets';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopMutationRouteRegistrar } from './WorkshopSessionMessageHandler';

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

export class WorkshopWidgetHandler {
  private generateController?: AbortController;

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
    registerMutation(MessageType.WORKSHOP_COMMIT_WIDGET, this.handleCommit.bind(this));
  }

  dispose(): void {
    this.generateController?.abort();
    this.generateController = undefined;
  }

  async handleGenerate(message: WorkshopWidgetGenerateMessage): Promise<void> {
    const { widgetId, token, targetPhrase, contextText, characterNotes } = message.payload;
    if (widgetId !== 'gesture-playground' || !isLiveWorkshopWidgetId(widgetId)) {
      this.postMenuResult({ widgetId, token, ok: false, error: 'That widget is not available yet.' });
      return;
    }
    // A regenerate supersedes the in-flight call; the stale token's result is
    // dropped by the webview even if the abort loses the race.
    this.generateController?.abort();
    const controller = new AbortController();
    this.generateController = controller;
    try {
      const result = await this.gestureService.generateMenu({
        targetPhrase,
        contextText,
        characterNotes,
        signal: controller.signal
      });
      if (controller.signal.aborted) {
        return;
      }
      this.postMenuResult({ widgetId, token, ok: true, menu: result.menu });
      this.outputChannel.appendLine(
        `[WorkshopWidgetHandler] Gesture menu generated (${result.menu.length} groups, token ${token})`
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const details = error instanceof Error ? error.message : String(error);
      this.postMenuResult({ widgetId, token, ok: false, error: details });
      this.outputChannel.appendLine(
        `[WorkshopWidgetHandler] Gesture menu generation failed (token ${token}): ${details}`
      );
    } finally {
      if (this.generateController === controller) {
        this.generateController = undefined;
      }
    }
  }

  async handleCancelGenerate(_message: CancelWidgetGenerateRequestMessage): Promise<void> {
    if (this.generateController) {
      this.outputChannel.appendLine('[WorkshopWidgetHandler] Gesture menu generation cancelled');
      this.generateController.abort();
      this.generateController = undefined;
    }
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
    }.`;

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
      this.session.recordWidgetArtifactDelivery(label, directive.length, target);
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
    if (draft.targetPhrase.trim().length === 0) {
      return 'Gesture Playground needs a target phrase.';
    }
    if (draft.targetPhrase.length > budget.gestureTargetPhraseCharacters) {
      return `The target phrase exceeds ${budget.gestureTargetPhraseCharacters} characters.`;
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
    if (draft.note.length > budget.gestureNoteCharacters) {
      return `The note exceeds ${budget.gestureNoteCharacters} characters.`;
    }
    if (draft.contextText.length > budget.gestureContextCharacters) {
      return `The context exceeds ${budget.gestureContextCharacters} characters.`;
    }
    if (draft.characterNotes.length > budget.gestureCharacterNotesCharacters) {
      return `The character notes exceed ${budget.gestureCharacterNotesCharacters} characters.`;
    }
    return undefined;
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
