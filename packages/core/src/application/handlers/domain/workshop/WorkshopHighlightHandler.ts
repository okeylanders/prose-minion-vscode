import type { MessageRouter } from '@handlers/MessageRouter';
import { MessageType, type WorkshopHighlightIdentity, type WorkshopHighlightMessage } from '@messages';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import type { WorkshopOpenRoomInstancePort } from '@/application/services/workshop/WorkshopOpenRoomInstance';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopHighlightEditor } from '@/application/services/workshop/highlights/WorkshopHighlightEditor';

/** These gestures change the editor's transient sets. No session write is involved. */
export class WorkshopHighlightHandler {
  private readonly pending = new Map<string, symbol>();
  private readonly stopListening: () => void;
  private disposed = false;

  constructor(
    private readonly session: Pick<WorkshopSessionService, 'readRoomRevision' | 'readRoomTurn' | 'readHighlightTurnIds'>,
    room: Pick<WorkshopOpenRoomInstancePort, 'onRoomReplaced'>,
    private readonly intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread'>,
    private readonly editor: WorkshopHighlightEditor | undefined,
    private readonly status: (message: string) => void
  ) {
    this.stopListening = room.onRoomReplaced(({ rewound }) => {
      this.pending.clear();
      // A new room can contain the same IDs as the room it replaces (a branch or reload).
      this.editor?.retain(rewound ? this.session.readHighlightTurnIds() : new Set());
    });
  }

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_SHOW_HIGHLIGHTS, (message: WorkshopHighlightMessage) => this.show(message.payload));
    router.register(MessageType.WORKSHOP_CLEAR_HIGHLIGHTS, async (message: WorkshopHighlightMessage) => {
      const turn = this.lookup(message.payload);
      if (turn?.highlights) {
        this.pending.delete(turn.id);
        this.editor?.clear(turn.id);
      }
    });
  }

  private lookup(identity: WorkshopHighlightIdentity | undefined) {
    if (this.disposed || !identity || identity.roomRevision !== this.session.readRoomRevision()
      || typeof identity.turnId !== 'string'
      || Object.keys(identity).some((key) => key !== 'turnId' && key !== 'roomRevision')) {
      return undefined;
    }
    return this.session.readRoomTurn(identity.turnId);
  }

  private async show(identity: WorkshopHighlightIdentity): Promise<void> {
    const turn = this.lookup(identity);
    if (!turn?.highlights) {
      return;
    }
    const editor = this.editor;
    if (!editor) {
      this.status('Workshop highlights are unavailable in this editor.');
      return;
    }

    const token = Symbol();
    const { source, set } = turn.highlights;
    const generation = editor.clearGeneration;
    this.pending.set(turn.id, token);
    const current = () => this.pending.get(turn.id) === token && generation === editor.clearGeneration
      && !!this.lookup(identity)?.highlights;
    try {
      const authorization = await this.intake.authorizeExcerptReread({ kind: 'file', ...source });
      if (!current()) {
        return;
      }
      if (authorization.kind !== 'authorized') {
        this.status('The excerpt file is no longer available for highlights.');
        return;
      }
      const result = await editor.show(turn.id, authorization.fsPath, turn.personaLabel ?? 'Persona', set, current);
      if (!current()) {
        return;
      }
      if (result) {
        const skipped = set.places.length - result.placed;
        const noun = result.placed === 1 ? 'highlight' : 'highlights';
        this.status(`Shown ${result.placed} ${noun}${skipped ? ` · ${skipped} skipped` : ''}.`);
      } else {
        this.status('The excerpt file could not be opened for highlights.');
      }
    } catch {
      if (current()) {
        this.status('The excerpt file could not be opened for highlights.');
      }
    } finally {
      if (this.pending.get(turn.id) === token) {
        this.pending.delete(turn.id);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopListening();
    this.pending.clear();
    this.editor?.retain(new Set());
  }
}
