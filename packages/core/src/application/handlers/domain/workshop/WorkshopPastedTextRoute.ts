import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { MessageType, type WorkshopMessageTextResultPayload, type WorkshopStageMessageTextMessage } from '@messages';

type Effects = { markDirty: (reason: string) => void; postSessionState: () => void };

/** The textarea can send its own text. Reads and mutations address only pending pasted text in the named room. */
export class WorkshopPastedTextRoute {
  constructor(
    private readonly session: WorkshopSessionService,
    private readonly post: MessageTransport,
    private readonly effects: Effects
  ) {}

  async handle(message: WorkshopStageMessageTextMessage, blocked?: string): Promise<void> {
    const request = message.payload;
    if (!request || typeof request.requestId !== 'string' || !request.requestId || request.requestId.length > 200
      || !Number.isSafeInteger(request.roomRevision) || !['stage', 'update', 'read', 'take', 'remove'].includes(request.action)) {
      return;
    }
    const { requestId, roomRevision, action } = request;
    const result = blocked ? { ok: false as const, reason: blocked } : this.session.applyPendingPastedText(request);
    if (result.ok && action !== 'read') {
      this.effects.markDirty('pasted text attachment changed');
      this.effects.postSessionState();
    }
    const payload: WorkshopMessageTextResultPayload = { requestId, roomRevision, action, ...result };
    await this.post({ type: MessageType.WORKSHOP_MESSAGE_TEXT_RESULT, source: 'extension.workshop', timestamp: Date.now(), payload });
  }
}
