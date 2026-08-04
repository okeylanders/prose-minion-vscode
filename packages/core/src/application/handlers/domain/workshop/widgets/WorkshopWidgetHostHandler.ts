/** Family-generic IPC owner for Workshop widget-host mechanics. */

import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageTransport } from '@/application/handlers/MessageHandlerContracts';
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
    _outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(
      MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      this.handleRequestConfig.bind(this)
    );
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
}
