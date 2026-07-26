import {
  guardWorkshopRoomDelivery,
  hasWorkshopConversationalCatchUp,
  projectWorkshopJoinSnapshotTurns,
  projectWorkshopRoomTurns,
  WorkshopRoomDeliveryService
} from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopTurn } from '@messages';

const turn = (
  id: string,
  overrides: Partial<WorkshopTurn> = {}
): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'message',
  participant: 'guest',
  artifact: 'persona_message',
  personaId: 'margot',
  personaLabel: 'Margot',
  excerptVersion: 1,
  content: id,
  timestamp: 1,
  ...overrides
});

describe('WorkshopRoomDeliveryService', () => {
  it('distinguishes lifecycle-only delivery from conversational catch-up', () => {
    expect(hasWorkshopConversationalCatchUp([
      turn('start', { participant: 'session', artifact: 'session_start' }),
      turn('resume', { participant: 'session', artifact: 'session_resume' })
    ])).toBe(false);
    expect(hasWorkshopConversationalCatchUp([
      turn('start', { participant: 'session', artifact: 'session_start' }),
      turn('guest-reply')
    ])).toBe(true);
  });

  it('projects room turns after the offset without quoting the reader to itself', () => {
    const turns = [
      turn('host-1', { participant: 'host', personaId: 'jill' }),
      turn('margot-1'),
      turn('writer-quinn', {
        role: 'user',
        participant: 'writer',
        personaId: 'quinn'
      }),
      turn('quinn-1', { personaId: 'quinn', personaLabel: 'Quinn' })
    ];

    expect(projectWorkshopRoomTurns(
      turns,
      { kind: 'personaGuest', personaId: 'quinn' },
      'host-1'
    ).map((candidate) => candidate.id)).toEqual(['margot-1']);
  });

  it('skips private ledger rows without turning them into delivery holes', () => {
    const turns = [
      turn('margot-1'),
      turn('private-search', {
        participant: 'tool',
        artifact: 'resource_search',
        capability: {
          operation: 'resource.search',
          status: 'success',
          requestSummary: 'search',
          requestedByPersonaId: 'margot',
          invokedBy: { kind: 'personaGuest', personaId: 'margot' }
        }
      }),
      turn('quinn-1', { personaId: 'quinn' })
    ];

    expect(projectWorkshopRoomTurns(
      turns,
      { kind: 'host' }
    ).map((candidate) => candidate.id)).toEqual(['margot-1', 'quinn-1']);
  });

  it('replays a re-invited guest own prior exchange without leaking another private exchange', () => {
    const turns = [
      turn('writer-margot', {
        role: 'user',
        participant: 'writer',
        personaId: 'margot'
      }),
      turn('margot-1'),
      turn('margot-private-search', {
        participant: 'tool',
        artifact: 'resource_search',
        capability: {
          operation: 'resource.search',
          status: 'success',
          requestSummary: 'search',
          requestedByPersonaId: 'margot',
          invokedBy: { kind: 'personaGuest', personaId: 'margot' }
        }
      }),
      turn('quinn-private-search', {
        participant: 'tool',
        artifact: 'resource_search',
        personaId: 'quinn',
        capability: {
          operation: 'resource.search',
          status: 'success',
          requestSummary: 'search',
          requestedByPersonaId: 'quinn',
          invokedBy: { kind: 'personaGuest', personaId: 'quinn' }
        }
      })
    ];

    expect(projectWorkshopJoinSnapshotTurns(
      turns,
      { kind: 'personaGuest', personaId: 'margot' }
    ).map((candidate) => candidate.id)).toEqual([
      'writer-margot',
      'margot-1',
      'margot-private-search'
    ]);
  });

  it('builds a cold re-invitation snapshot from room history including the guest own prior turns', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Passage.', source: { kind: 'manual' } });
    session.adoptPersonaGuest('margot', 'margot-conv');
    session.beginPersonaGuestMessage('margot', 'margot-run', 'Question.');
    session.completeRun('margot-run', 'Answer.');
    session.dismissPersonaGuest('margot');
    const invitation = session.beginPersonaGuestJoin(
      'margot',
      'margot-rejoin',
      'Read the room again.'
    );

    const snapshot = new WorkshopRoomDeliveryService(session).prepareJoinSnapshot({
      kind: 'personaGuest',
      personaId: 'margot'
    }, invitation.id);

    expect(snapshot.map((candidate) => candidate.content)).toEqual([
      'Question.',
      'Answer.'
    ]);
  });

  it('keeps whole turns and defers the remainder oldest-first', () => {
    const pending = [
      turn('one', { content: '123456' }),
      turn('two', { content: '123456' }),
      turn('three', { content: '123456' })
    ];
    expect(guardWorkshopRoomDelivery(pending, 12).map((candidate) => candidate.id))
      .toEqual(['one', 'two']);
    expect(guardWorkshopRoomDelivery([turn('oversized', { content: 'x'.repeat(25) })], 10)[0].content)
      .toHaveLength(25);
  });

  it('rejects a hole instead of advancing to the newest delivered turn', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Passage.', source: { kind: 'manual' } });
    session.adoptPersonaGuest('margot', 'margot-conv');
    session.beginPersonaGuestMessage('margot', 'margot-run', 'Question.');
    session.completeRun('margot-run', 'Answer.');

    const delivery = new WorkshopRoomDeliveryService(session);
    const prepared = delivery.prepare({ kind: 'host' });
    expect(prepared.deliveredTurnIds).toHaveLength(2);
    expect(() => delivery.commit({
      ...prepared,
      deliveredTurnIds: [prepared.deliveredTurnIds[1]]
    })).toThrow(
      new RegExp(
        `not a contiguous prefix for host .*` +
        `offset=<start>.*expected=${prepared.deliveredTurnIds[0]}.*` +
        `actual=${prepared.deliveredTurnIds[1]}`
      )
    );
    expect(delivery.prepare({ kind: 'host' }).deliveredTurnIds)
      .toEqual(prepared.deliveredTurnIds);
  });

  it('acknowledges the exact prefix and leaves a guarded suffix pending', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Passage.', source: { kind: 'manual' } });
    session.adoptPersonaGuest('margot', 'margot-conv');
    session.beginPersonaGuestMessage('margot', 'margot-run', 'Question.');
    session.completeRun('margot-run', 'Answer.');

    const delivery = new WorkshopRoomDeliveryService(session);
    const prepared = delivery.prepare({ kind: 'host' });
    delivery.commit({ ...prepared, deliveredTurnIds: [prepared.deliveredTurnIds[0]] });

    expect(delivery.prepare({ kind: 'host' }).deliveredTurnIds)
      .toEqual([prepared.deliveredTurnIds[1]]);
  });

  it('advances through the delivered prefix rather than a newer ineligible ledger tail', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Passage.', source: { kind: 'manual' } });
    session.adoptPersonaGuest('margot', 'margot-conv');
    session.beginPersonaGuestMessage('margot', 'margot-run', 'Question.');
    session.completeRun('margot-run', 'Answer.');

    const delivery = new WorkshopRoomDeliveryService(session);
    const prepared = delivery.prepare({ kind: 'host' });
    session.beginPersonaMessage('host-run', 'My follow-up.');
    session.completeRun('host-run', 'My answer.', undefined, false, 'host-conv');

    delivery.commit(prepared);

    expect(session.readRoomDeliveryState({ kind: 'host' }).lastSeenRoomTurnId)
      .toBe(prepared.deliveredTurnIds.at(-1));
  });

  it.each([
    { label: 'one 25k-character reply', exchanges: 1, replyCharacters: 25_000 },
    { label: 'five short exchanges', exchanges: 5, replyCharacters: 24 },
    { label: 'four 6k-character exchanges', exchanges: 4, replyCharacters: 6_000 }
  ])('delivers and acknowledges $label without skipping history', ({
    exchanges,
    replyCharacters
  }) => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'Passage.', source: { kind: 'manual' } });
    session.adoptPersonaGuest('margot', 'margot-conv');
    for (let index = 0; index < exchanges; index += 1) {
      session.beginPersonaGuestMessage('margot', `guest-${index}`, `Question ${index}.`);
      session.completeRun(`guest-${index}`, `${index}:${'x'.repeat(replyCharacters)}`);
    }

    const delivery = new WorkshopRoomDeliveryService(session);
    const prepared = delivery.prepare({ kind: 'host' });
    expect(prepared.turns).toHaveLength(exchanges * 2);
    expect(prepared.turns.at(-1)?.content).toHaveLength(replyCharacters + 2);
    delivery.commit(prepared);
    expect(delivery.prepare({ kind: 'host' }).turns).toEqual([]);
  });
});
