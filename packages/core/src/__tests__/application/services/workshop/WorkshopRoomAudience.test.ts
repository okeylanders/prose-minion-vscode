import {
  isWorkshopTurnAlreadyVisibleToPrincipal,
  workshopTurnAudience,
} from '@/application/services/workshop/WorkshopRoomAudience';
import { WorkshopTurn } from '@messages';

const turn = (overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id: 'turn-1',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  excerptVersion: 1,
  content: 'Room evidence.',
  timestamp: 1,
  ...overrides
});

describe('workshopTurnAudience', () => {
  it('keeps room conversation and room-commissioned reports public', () => {
    expect(workshopTurnAudience(turn())).toEqual({ kind: 'room' });
    expect(workshopTurnAudience(turn({
      participant: 'tool',
      artifact: 'tool_report',
      toolId: 'prose',
      capability: undefined
    }))).toEqual({ kind: 'room' });
  });

  it('keeps direct-tool sidecar exchanges private', () => {
    expect(workshopTurnAudience(turn({
      participant: 'writer',
      artifact: 'direct_tool_message',
      toolId: 'prose'
    }))).toEqual({
      kind: 'private',
      principal: { kind: 'toolSidecar', toolId: 'prose' }
    });
  });

  it('publishes evidence-bearing capability results only with a committed reply fact', () => {
    const resourceRead = turn({
      participant: 'tool',
      artifact: 'resource_read',
      capability: {
        operation: 'resource.read',
        status: 'success',
        requestSummary: 'chapters/five.md',
        requestedByPersonaId: 'felix',
        invokedBy: { kind: 'personaGuest', personaId: 'felix' }
      }
    });

    expect(workshopTurnAudience(resourceRead)).toEqual({
      kind: 'private',
      principal: { kind: 'personaGuest', personaId: 'felix' }
    });
    expect(workshopTurnAudience({
      ...resourceRead,
      capability: {
        ...resourceRead.capability!,
        publishedWithTurnId: 'turn-2'
      }
    })).toEqual({ kind: 'room' });
  });

  it.each([
    ['resource.catalog', 'success'],
    ['resource.search', 'partial'],
    ['resource.read', 'failed'],
    ['dictionary.lookup', 'cancelled']
  ] as const)('keeps %s/%s capability work private despite a publication stamp', (
    operation,
    status
  ) => {
    expect(workshopTurnAudience(turn({
      participant: 'tool',
      artifact: operation === 'resource.catalog'
        ? 'resource_catalog'
        : operation === 'resource.search'
          ? 'resource_search'
          : operation === 'resource.read'
            ? 'resource_read'
            : 'dictionary_lookup',
      capability: {
        operation,
        status,
        requestSummary: 'evidence',
        requestedByPersonaId: 'jill',
        invokedBy: { kind: 'host' },
        publishedWithTurnId: 'turn-2'
      }
    }))).toEqual({
      kind: 'private',
      principal: { kind: 'host' }
    });
  });
});

describe('isWorkshopTurnAlreadyVisibleToPrincipal', () => {
  it('recognizes both sides of each participant conversation', () => {
    expect(isWorkshopTurnAlreadyVisibleToPrincipal(turn(), { kind: 'host' })).toBe(true);
    expect(isWorkshopTurnAlreadyVisibleToPrincipal(turn({
      role: 'user',
      participant: 'writer',
      personaId: undefined
    }), { kind: 'host' })).toBe(true);
    expect(isWorkshopTurnAlreadyVisibleToPrincipal(turn({
      participant: 'guest',
      personaId: 'felix'
    }), { kind: 'personaGuest', personaId: 'felix' })).toBe(true);
    expect(isWorkshopTurnAlreadyVisibleToPrincipal(turn({
      role: 'user',
      participant: 'writer',
      personaId: 'felix'
    }), { kind: 'personaGuest', personaId: 'felix' })).toBe(true);
  });

  it('does not treat another participant conversation as already materialized', () => {
    expect(isWorkshopTurnAlreadyVisibleToPrincipal(turn({
      participant: 'guest',
      personaId: 'margot'
    }), { kind: 'personaGuest', personaId: 'felix' })).toBe(false);
  });
});
