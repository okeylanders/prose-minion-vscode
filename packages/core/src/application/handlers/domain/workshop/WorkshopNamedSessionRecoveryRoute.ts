/**
 * The Recover… route (ADR 2026-11-19 D6e), registered by
 * `WorkshopSessionMessageHandler`.
 *
 * - **Ids only.** `WORKSHOP_RECOVER_NAMED_SESSION { requestId, sessionId }`;
 *   the webview confirmed first. The host answers by `requestId`.
 * - **On the coordinator's session-operation queue** (`recoverNamed`), never
 *   behind the room's mutation gate: it writes saved sessions, not the room.
 * - **Host words:** what was restored and kept, busy, or the step that
 *   stopped it, which leaves the lock as it was.
 * - **Logs** carry the request and session ids and the outcome, never a
 *   title or a file name.
 */

import {
  MessageType,
  type WorkshopNamedSessionRecoveryResultMessage,
  type WorkshopRecoverNamedSessionMessage
} from '@messages';
import type { LogSink } from '@/platform';
import type { MessageRouter } from '@handlers/MessageRouter';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import {
  workshopNamedSessionRecoveryWords,
  type WorkshopNamedSessionRecoveryOutcome
} from '@/infrastructure/storage/WorkshopNamedSessionRecovery';

const LOG = '[WorkshopNamedSessionRecoveryRoute]';

export interface WorkshopNamedSessionRecoveryPort {
  recoverNamed(sessionId: string): Promise<WorkshopNamedSessionRecoveryOutcome>;
}

export class WorkshopNamedSessionRecoveryRoute {
  constructor(
    private readonly sessions: WorkshopNamedSessionRecoveryPort,
    private readonly postMessage: MessageTransport,
    private readonly log: LogSink
  ) {}

  register(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_RECOVER_NAMED_SESSION, this.handle.bind(this));
  }

  async handle(message: WorkshopRecoverNamedSessionMessage): Promise<void> {
    const requestId = typeof message.payload?.requestId === 'string' ? message.payload.requestId : '';
    const sessionId = typeof message.payload?.sessionId === 'string' ? message.payload.sessionId.trim() : '';
    if (!requestId || !sessionId) {
      this.log.appendLine(`${LOG} Refused a malformed request.`);
      return;
    }
    try {
      const outcome = await this.sessions.recoverNamed(sessionId);
      this.log.appendLine(`${LOG} Recovered (request=${requestId}, session=${sessionId}, restored=${outcome.restored}, kept=${outcome.copies.length}).`);
      this.answer(requestId, sessionId, true, workshopNamedSessionRecoveryWords(outcome));
    } catch (error) {
      const kind = error instanceof Error ? error.name : 'unknown';
      this.log.appendLine(`${LOG} Recovery refused (request=${requestId}, session=${sessionId}, kind=${kind}).`);
      this.answer(requestId, sessionId, false, error instanceof Error ? error.message : 'Recovery could not run.');
    }
  }

  private answer(requestId: string, sessionId: string, ok: boolean, words: string): void {
    const result: WorkshopNamedSessionRecoveryResultMessage = {
      type: MessageType.WORKSHOP_NAMED_SESSION_RECOVERY_RESULT,
      source: 'extension.workshop.sessionRecovery',
      payload: { requestId, sessionId, ok, message: words },
      timestamp: Date.now()
    };
    void this.postMessage(result);
  }
}
