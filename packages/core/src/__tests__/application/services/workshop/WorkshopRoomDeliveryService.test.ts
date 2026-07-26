import {
  guardWorkshopRoomDelivery,
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
    })).toThrow('not a contiguous prefix');
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
