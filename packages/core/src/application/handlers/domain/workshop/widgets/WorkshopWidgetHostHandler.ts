/** Family-generic IPC owner for Workshop widget-host mechanics. */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { LogSink } from '@/platform';
import {
  MessageType,
  WorkshopRequestWidgetConfigMessage,
  WorkshopWidgetConfigDataMessage
} from '@messages';

export class WorkshopWidgetHostHandler {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(
      MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      this.handleRequestConfig.bind(this)
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
}
