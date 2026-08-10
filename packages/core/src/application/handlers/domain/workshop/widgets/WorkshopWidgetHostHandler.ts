/** Family-generic IPC owner for Workshop widget-host mechanics. */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import type {
  WorkshopMutationRouteRegistrar
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  prepareWorkshopOneShotWidgetCommit,
  supportsWorkshopOneShotWidgetCommit
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';
import type {
  WorkshopOneShotWidgetCommitCoordinator
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
}

export class WorkshopWidgetHostHandler {
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
      (reason, message: WorkshopCommitWidgetMessage) => this.postActionResult({
        action: 'commit',
        requestToken: message.payload.requestToken,
        widgetId: message.payload.widgetId,
        ok: false,
        message: reason
      })
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
    if (
      !supportsWorkshopOneShotWidgetCommit(widgetId)
      || !this.availability.isAvailable(widgetId)
    ) {
      this.postActionResult({
        action: 'commit',
        requestToken,
        widgetId,
        ok: false,
        message: 'That widget is not available yet.'
      });
      return;
    }

    const preparation = prepareWorkshopOneShotWidgetCommit(message.payload);
    if (!preparation.ok) {
      this.postActionResult({
        action: 'commit',
        requestToken,
        widgetId,
        ok: false,
        message: preparation.message
      });
      return;
    }

    const target = this.session.getChatTarget();
    if (target.kind === 'tool') {
      this.postActionResult({
        action: 'commit',
        requestToken,
        widgetId,
        ok: false,
        message: preparation.commit.toolTargetRefusalMessage
      });
      return;
    }
    if (this.options.isRoomRunActive()) {
      this.postActionResult({
        action: 'commit',
        requestToken,
        widgetId,
        ok: false,
        message: 'Wait for the current Workshop response to finish before committing another widget.'
      });
      return;
    }

    const outcome = await this.oneShotCommitCoordinator.commit(
      preparation.commit,
      target,
      ({ widgetConfigId, turnId }) => this.postActionResult({
        action: 'commit',
        requestToken,
        widgetId,
        ok: true,
        widgetConfigId,
        turnId
      })
    );
    if (outcome.status === 'not-accepted') {
      this.postActionResult({
        action: 'commit',
        requestToken,
        widgetId,
        ok: false,
        widgetConfigId: outcome.widgetConfigId,
        message: 'The room did not accept the commit. Your draft is still open — try again.'
      });
    } else if (outcome.status === 'failed') {
      this.postActionResult({
        action: 'commit',
        requestToken,
        widgetId,
        ok: false,
        widgetConfigId: outcome.widgetConfigId,
        message: 'The commit failed before the room accepted it. Your draft is still open — try again.'
      });
    }
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
