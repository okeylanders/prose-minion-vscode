/** Family-generic IPC owner for Workshop standing-directive mechanics. */

import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageTransport } from '@/application/handlers/MessageHandlerContracts';
import { WorkshopMutationRouteRegistrar } from '@handlers/domain/workshop/WorkshopHandlerContracts';
import { WorkshopStandingDirectiveService } from
  '@/application/services/workshop/directives/WorkshopStandingDirectiveService';
import {
  WORKSHOP_STANDING_DIRECTIVE_OPERATIONS,
  WorkshopStandingDirectiveOperations
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveOperations';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopApplyStandingWidgetMessage,
  WorkshopRemoveStandingWidgetMessage,
  WorkshopTurn,
  WorkshopWidgetActionResultMessage
} from '@messages';

export interface WorkshopStandingDirectiveHandlerOptions {
  postSessionState: () => void;
  postTurn: (turn: WorkshopTurn) => void;
  markDirty: (reason: string) => void;
}

export class WorkshopStandingDirectiveHandler {
  constructor(
    private readonly directives: WorkshopStandingDirectiveService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink,
    private readonly options: WorkshopStandingDirectiveHandlerOptions,
    private readonly operations: WorkshopStandingDirectiveOperations =
      WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    registerMutation(
      MessageType.WORKSHOP_APPLY_STANDING_WIDGET,
      this.handleApply.bind(this),
      undefined,
      (reason, message: WorkshopApplyStandingWidgetMessage) => void this.postBlockedAction(
        reason,
        {
          action: 'apply-standing',
          requestToken: message.payload.requestToken,
          widgetId: message.payload.widgetId,
          ok: false,
          message: reason
        }
      )
    );
    registerMutation(
      MessageType.WORKSHOP_REMOVE_STANDING_WIDGET,
      this.handleRemove.bind(this),
      undefined,
      (reason, message: WorkshopRemoveStandingWidgetMessage) => void this.postBlockedAction(
        reason,
        {
          action: 'remove-standing',
          requestToken: message.payload.requestToken,
          widgetId: message.payload.family,
          ok: false,
          message: reason
        }
      )
    );
  }

  async handleApply(message: WorkshopApplyStandingWidgetMessage): Promise<void> {
    const { requestToken } = message.payload;
    try {
      const request = this.operations.prepareApply(message.payload);
      const result = await this.directives.apply(request);
      this.options.postTurn(result.turn);
      this.options.postSessionState();
      this.options.markDirty(`${request.widgetId} ${result.action}`);
      if (result.config.widgetId !== request.widgetId) {
        throw new Error(`Standing directive ${request.family} produced the wrong widget config`);
      }
      this.outputChannel.appendLine(
        `[WorkshopStandingDirectiveHandler] ${request.family} ${result.action}: ${result.directiveId} -> ${result.config.id} (revision ${result.config.revision}, ${this.operations.describe({ directive: result.directive, config: result.config })})`
      );
      await this.postAction({
        action: 'apply-standing',
        requestToken,
        widgetId: request.widgetId,
        ok: true,
        widgetConfigId: result.config.id,
        directiveId: result.directiveId,
        turnId: result.turn.id
      });
    } catch (error) {
      await this.postAction({
        action: 'apply-standing',
        requestToken,
        widgetId: message.payload.widgetId,
        ok: false,
        message: this.errorMessage(error)
      });
    }
  }

  async handleRemove(message: WorkshopRemoveStandingWidgetMessage): Promise<void> {
    const { family, requestToken } = message.payload;
    let widgetId = family;
    try {
      widgetId = this.operations.widgetIdForFamily(family);
      const result = await this.directives.remove(family);
      if (result.turn) {this.options.postTurn(result.turn);}
      if (result.removed) {
        this.options.postSessionState();
        this.options.markDirty(`${family} removed`);
      }
      this.outputChannel.appendLine(
        `[WorkshopStandingDirectiveHandler] ${family} ${result.removed ? 'removed' : 'remove no-op'}${result.directiveId ? `: ${result.directiveId}` : ''}`
      );
      await this.postAction({
        action: 'remove-standing',
        requestToken,
        widgetId,
        ok: true,
        removed: result.removed,
        directiveId: result.directiveId,
        turnId: result.turn?.id
      });
    } catch (error) {
      await this.postAction({
        action: 'remove-standing',
        requestToken,
        widgetId,
        ok: false,
        message: this.errorMessage(error)
      });
    }
  }

  private async postBlockedAction(
    reason: string,
    payload: WorkshopWidgetActionResultMessage['payload']
  ): Promise<void> {
    this.outputChannel.appendLine(
      `[WorkshopStandingDirectiveHandler] ${payload.action} blocked: ${reason}`
    );
    await this.postAction(payload);
  }

  private async postAction(
    payload: WorkshopWidgetActionResultMessage['payload']
  ): Promise<void> {
    await this.postMessage({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: Date.now(),
      payload
    } satisfies WorkshopWidgetActionResultMessage);
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    this.outputChannel.appendLine(`[WorkshopStandingDirectiveHandler] ${message}`);
    return message;
  }
}
