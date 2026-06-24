/**
 * AccountBalanceHandler - routes OpenRouter balance requests to the
 * AccountBalanceService and posts sanitized balances back to the webview.
 *
 * Thin handler: no business logic — it delegates to the service and never
 * throws to the router. On unexpected failure it posts a payload marked
 * `unavailable` so the webview always gets a usable shape. Keys never reach
 * here; the service fetches host-side and returns only sanitized numbers/enums.
 */

import {
  MessageType,
  AccountBalancePayload,
  RequestAccountBalanceMessage
} from '@messages';
import { LogSink } from '@/platform';
import { AccountBalanceService } from '@/infrastructure/account';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '../MessageRouter';

export class AccountBalanceHandler {
  constructor(
    private readonly postMessage: MessageTransport,
    private readonly service: AccountBalanceService,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.REQUEST_ACCOUNT_BALANCE, this.handleRequest.bind(this));
  }

  async handleRequest(message: RequestAccountBalanceMessage): Promise<void> {
    const forceRefresh = message.payload?.forceRefresh ?? false;
    try {
      const payload = await this.service.getBalances(forceRefresh);
      this.post(payload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[AccountBalanceHandler] Failed to resolve balances: ${msg}`);
      this.post({
        openrouter: { status: 'unavailable', creditsStatus: 'unavailable', reason: 'Request failed.' },
        fetchedAt: Date.now()
      });
    }
  }

  /** Broadcast a payload to the webview (used by the request route AND the
   *  service's post-AI-request refresh listener registered in MessageHandler). */
  post(payload: AccountBalancePayload): void {
    void Promise.resolve(
      this.postMessage({
        type: MessageType.ACCOUNT_BALANCE_DATA,
        source: 'extension.account',
        payload,
        timestamp: Date.now()
      })
    ).catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[AccountBalanceHandler] Failed to post balance to webview: ${msg}`);
    });
  }
}
