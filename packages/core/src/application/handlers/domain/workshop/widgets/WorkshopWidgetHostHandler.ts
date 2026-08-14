/** Family-generic IPC owner for Workshop widget-host mechanics. */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import type {
  WorkshopMutationRouteRegistrar
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  prepareWorkshopOneShotWidgetCommit,
  supportsWorkshopOneShotWidgetCommit,
  type WorkshopOneShotWidgetId
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';
import type {
  WorkshopOneShotWidgetCommitCoordinator,
  WorkshopOneShotWidgetCommitOutcome
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator';
import type {
  WorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopCommitWidgetMessage,
  WorkshopRequestWidgetConfigMessage,
  WorkshopWidgetActionResultMessage,
  WorkshopWidgetActionResultPayload,
  WorkshopWidgetConfigDataMessage
} from '@messages';

export interface WorkshopWidgetHostHandlerOptions {
  /** Backend race guard; the webview also disables commit while a room run owns the slot. */
  isRoomRunActive: () => boolean;
  /** Named generation owners report only whether their one-shot rail is busy. */
  isWidgetGenerationActive: (widgetId: WorkshopOneShotWidgetId) => boolean;
}

type WorkshopWidgetCommitRefusalReason =
  | 'widget-unavailable'
  | 'unsupported-one-shot-widget'
  | 'invalid-draft'
  | 'generation-in-flight'
  | 'commit-in-flight'
  | 'tool-target'
  | 'room-run-active'
  | 'route-failed';

const DEFAULT_TOOL_TARGET_REFUSAL_MESSAGE =
  'Switch to a persona target before committing a widget.';

export class WorkshopWidgetHostHandler {
  private commitInProgress = false;

  constructor(
    private readonly session: WorkshopSessionService,
    private readonly oneShotCommitCoordinator: WorkshopOneShotWidgetCommitCoordinator,
    private readonly availability: WorkshopWidgetAvailabilityPolicy,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly options: WorkshopWidgetHostHandlerOptions
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    router.register(
      MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      this.handleRequestConfig.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_COMMIT_WIDGET,
      this.handleCommit.bind(this),
      undefined,
      (reason, message: WorkshopCommitWidgetMessage) => {
        void this.postActionResult({
          action: 'commit',
          requestToken: message.payload.requestToken,
          widgetId: message.payload.widgetId,
          ok: false,
          message: reason
        }).catch((error: unknown) => this.logActionResultFailure(error));
      }
    );
  }

  async handleRequestConfig(message: WorkshopRequestWidgetConfigMessage): Promise<void> {
    const configId = message.payload.configId.trim();
    const isValidConfigId = /^wc-[1-9]\d*$/.test(configId);
    const config = isValidConfigId
      ? this.session.getWidgetConfig(configId)
      : undefined;
    if (!config) {
      this.outputChannel.appendLine(
        isValidConfigId
          ? `[WorkshopWidgetHostHandler] Widget config ${configId} is unavailable`
          : '[WorkshopWidgetHostHandler] Rejected an invalid widget config id'
      );
    }
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

  async handleCommit(message: WorkshopCommitWidgetMessage): Promise<void> {
    const { widgetId, requestToken } = message.payload;
    try {
      if (!this.availability.isAvailable(widgetId)) {
        await this.refuseCommit(
          requestToken,
          widgetId,
          'widget-unavailable',
          'That widget is not available yet.'
        );
        return;
      }
      if (!supportsWorkshopOneShotWidgetCommit(widgetId)) {
        await this.refuseCommit(
          requestToken,
          widgetId,
          'unsupported-one-shot-widget',
          'That widget does not support one-shot commits.'
        );
        return;
      }
      if (this.options.isWidgetGenerationActive(widgetId)) {
        await this.refuseCommit(
          requestToken,
          widgetId,
          'generation-in-flight',
          'Wait for the current widget generation to finish before committing.'
        );
        return;
      }
      if (this.commitInProgress) {
        await this.refuseCommit(
          requestToken,
          widgetId,
          'commit-in-flight',
          'Wait for the current widget commit to finish before committing again.'
        );
        return;
      }

      const preparation = prepareWorkshopOneShotWidgetCommit(message.payload);
      if (!preparation.ok) {
        await this.refuseCommit(
          requestToken,
          widgetId,
          preparation.reason,
          preparation.message
        );
        return;
      }

      const target = this.session.getChatTarget();
      if (target.kind === 'tool') {
        await this.refuseCommit(
          requestToken,
          widgetId,
          'tool-target',
          preparation.commit.toolTargetRefusalMessage
            ?? DEFAULT_TOOL_TARGET_REFUSAL_MESSAGE
        );
        return;
      }
      if (this.options.isRoomRunActive()) {
        await this.refuseCommit(
          requestToken,
          widgetId,
          'room-run-active',
          'Wait for the current Workshop response to finish before committing another widget.'
        );
        return;
      }

      this.commitInProgress = true;
      let outcome: WorkshopOneShotWidgetCommitOutcome;
      try {
        outcome = await this.oneShotCommitCoordinator.commit(
          preparation.commit,
          target,
          () => undefined
        );
      } finally {
        this.commitInProgress = false;
      }
      if (outcome.status === 'accepted') {
        try {
          await this.postActionResult({
            action: 'commit',
            requestToken,
            widgetId,
            ok: true,
            widgetConfigId: outcome.widgetConfigId,
            turnId: outcome.turnId
          });
        } catch (error) {
          this.logActionResultFailure(error);
        }
        return;
      }
      if (outcome.status === 'not-accepted') {
        await this.postActionResult({
          action: 'commit',
          requestToken,
          widgetId,
          ok: false,
          widgetConfigId: outcome.widgetConfigId,
          message: outcome.reason
            ?? 'The room did not accept the commit. Your draft is still open — try again.'
        });
      } else if (outcome.status === 'failed') {
        await this.postActionResult({
          action: 'commit',
          requestToken,
          widgetId,
          ok: false,
          widgetConfigId: outcome.widgetConfigId,
          message: outcome.reason
            ?? 'The commit failed before the room accepted it. Your draft is still open — try again.'
        });
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopWidgetHostHandler] Commit route failed before acknowledgement: ${details}`
      );
      try {
        await this.refuseCommit(
          requestToken,
          widgetId,
          'route-failed',
          'The commit could not be processed. Your draft is still open — try again.'
        );
      } catch (postError) {
        this.logActionResultFailure(postError);
      }
    }
  }

  private refuseCommit(
    requestToken: string,
    widgetId: WorkshopCommitWidgetMessage['payload']['widgetId'],
    reason: WorkshopWidgetCommitRefusalReason,
    message: string
  ): Promise<void> {
    const boundedToken = typeof requestToken === 'string'
      ? requestToken.slice(0, 160)
      : '<invalid>';
    this.outputChannel.appendLine(
      `[WorkshopWidgetHostHandler] Commit refused `
      + `(reason=${reason}, requestToken=${JSON.stringify(boundedToken)})`
    );
    return this.postActionResult({
      action: 'commit',
      requestToken,
      widgetId,
      ok: false,
      message
    });
  }

  private async postActionResult(payload: WorkshopWidgetActionResultPayload): Promise<void> {
    const result: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      payload,
      timestamp: Date.now()
    };
    await this.postMessage(result);
  }

  private logActionResultFailure(error: unknown): void {
    const details = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(
      `[WorkshopWidgetHostHandler] Failed to post widget action result: ${details}`
    );
  }
}
