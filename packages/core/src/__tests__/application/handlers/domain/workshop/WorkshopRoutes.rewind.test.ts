import { MessageType, WorkshopTurn } from '@messages';
import {
  WorkshopRewindOutcome,
  WorkshopRewindRefusedError
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

/**
 * The Rewind route (ADR 2026-09-30 §6): the bubble maps to its cut, the
 * coordinator re-checks and performs it, and the webview hears the room,
 * the result, and — for a writer message — the composer edit.
 */
describe('Workshop Rewind route', () => {
  const outcome = (overrides: Partial<WorkshopRewindOutcome> = {}): WorkshopRewindOutcome => ({
    summary: {
      keptThroughTurnId: 'turn-1-system-1',
      removedTurnCount: 2,
      droppedConversationKeys: ['host'],
      removedTodoCount: 0
    },
    degradedConversationKeys: [],
    degradedConversations: [],
    ...overrides
  });

  const sentRoom = async () => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    await harness.router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Open the room.' }
    ) as any);
    const turns = harness.session.readRoomLedger();
    const writerTurn = turns.find((turn) => turn.participant === 'writer')!;
    const reply = turns.find((turn) => turn.participant === 'host')!;
    harness.postMessage.mockClear();
    return { ...harness, writerTurn, reply };
  };

  const rewind = (harness: Awaited<ReturnType<typeof sentRoom>>, turn: Pick<WorkshopTurn, 'id'>) =>
    harness.router.route(message(MessageType.WORKSHOP_REWIND_SESSION, { turnId: turn.id }) as any);

  const lastResult = (harness: Awaited<ReturnType<typeof sentRoom>>) =>
    harness.posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT).at(-1)?.payload;

  it('rewinds a writer message as an edit: the text returns to the composer', async () => {
    const harness = await sentRoom();
    harness.persistence.rewindTo.mockResolvedValue(outcome({
      composerRestore: { text: 'Open the room.', attachmentIds: [], unrestoredAttachmentLabels: [] }
    }));

    await rewind(harness, harness.writerTurn);

    expect(harness.persistence.rewindTo).toHaveBeenCalledWith(
      { kind: 'beforeTurn', turnId: harness.writerTurn.id },
      { origin: 'writer' }
    );
    expect(harness.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED).map((entry) => entry.payload))
      .toEqual([{ text: 'Open the room.' }]);
    expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE).length).toBeGreaterThan(0);
    expect(lastResult(harness)).toEqual({
      action: 'rewind',
      ok: true,
      message: 'Rewound: 2 turns removed. The host starts fresh from here.'
    });
  });

  it('rewinds to an agent reply without touching the composer', async () => {
    const harness = await sentRoom();
    harness.persistence.rewindTo.mockResolvedValue(outcome({
      summary: {
        keptThroughTurnId: 'reply',
        removedTurnCount: 1,
        droppedConversationKeys: ['guest:margot', 'tool:prose'],
        removedTodoCount: 0
      }
    }));

    await rewind(harness, harness.reply);

    expect(harness.persistence.rewindTo).toHaveBeenCalledWith(
      { kind: 'afterTurn', turnId: harness.reply.id },
      { origin: 'writer' }
    );
    expect(harness.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED)).toEqual([]);
    expect(lastResult(harness)?.message).toBe(
      'Rewound: 1 turn removed. Margot left the room. ' +
      "The Prose tool's conversation was set aside; run it again for a fresh report."
    );
  });

  it('names attachments the writer must re-attach', async () => {
    const harness = await sentRoom();
    harness.persistence.rewindTo.mockResolvedValue(outcome({
      composerRestore: {
        text: 'Open the room.',
        attachmentIds: [],
        unrestoredAttachmentLabels: ['draft-notes.md']
      }
    }));

    await rewind(harness, harness.writerTurn);

    expect(lastResult(harness)?.message)
      .toContain('Re-attach draft-notes.md before you send it again.');
  });

  it('reports the host re-check\'s refusal in writer terms and republishes the room', async () => {
    const harness = await sentRoom();
    harness.persistence.rewindTo.mockRejectedValue(
      new WorkshopRewindRefusedError('before-rewind-support')
    );

    await rewind(harness, harness.reply);

    expect(lastResult(harness)).toEqual({
      action: 'rewind',
      ok: false,
      message: 'Saved before rewind support.'
    });
    expect(harness.posted(MessageType.WORKSHOP_SESSION_STATE).length).toBeGreaterThan(0);
    expect(harness.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED)).toEqual([]);
  });

  it('refuses a bubble that offers no rewind without asking the coordinator', async () => {
    const harness = await sentRoom();
    const marker = harness.session.readRoomLedger().find((turn) => turn.participant === 'session');

    await harness.router.route(message(
      MessageType.WORKSHOP_REWIND_SESSION,
      { turnId: marker?.id ?? 'turn-unknown' }
    ) as any);

    expect(harness.persistence.rewindTo).not.toHaveBeenCalled();
    expect(lastResult(harness)).toEqual({
      action: 'rewind',
      ok: false,
      message: "Can't rewind to this point."
    });
  });

  it('is gated like every room mutation while another session operation is pending', async () => {
    const harness = await sentRoom();
    harness.persistence.isSessionOperationPending.mockReturnValue(true);

    await rewind(harness, harness.reply);

    expect(harness.persistence.rewindTo).not.toHaveBeenCalled();
    expect(lastResult(harness)).toMatchObject({ action: 'rewind', ok: false });
  });

  it('surfaces a failed rewind\'s reason when the prior room was restored', async () => {
    const harness = await sentRoom();
    harness.persistence.rewindTo.mockRejectedValue(new Error('The saved session changed.'));

    await rewind(harness, harness.reply);

    expect(lastResult(harness)).toEqual({
      action: 'rewind',
      ok: false,
      message: 'The saved session changed.'
    });
  });
});
