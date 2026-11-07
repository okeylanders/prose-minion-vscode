import {
  isWorkshopPublishableCapabilityEvidence,
  isWorkshopTurnAlreadyVisibleToPrincipal,
  isWorkshopTurnVisibleToParticipant,
  workshopCapabilityPublicationWithheld,
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

  // Reads and to-do lists of saved sessions publish as resource.read does;
  // the catalog and search are private discovery (ADR 2026-10-05 §7, D6).
  it.each([
    ['transcript.read', 'transcript_read', 'success', true],
    ['transcript.read', 'transcript_read', 'partial', true],
    ['transcript.todos', 'transcript_todos', 'success', true],
    ['transcript.todos', 'transcript_todos', 'partial', true],
    ['transcript.read', 'transcript_read', 'failed', false],
    ['transcript.read', 'transcript_read', 'rejected', false],
    ['transcript.todos', 'transcript_todos', 'cancelled', false],
    // A bookmark list publishes like a to-do list unless the host withheld it (ADR 2026-11-05 D7).
    ['transcript.bookmarks', 'transcript_bookmarks', 'success', true],
    ['transcript.bookmarks', 'transcript_bookmarks', 'rejected', false],
    ['transcript.catalog', 'transcript_catalog', 'success', false],
    ['transcript.search', 'transcript_search', 'success', false]
  ] as const)('a published %s (%s, %s) reaches the room: %s', (operation, artifact, status, room) => {
    const recalled = turn({
      participant: 'tool',
      artifact,
      capability: {
        operation,
        status,
        requestSummary: '“Chapter 6.7” · turns 1-12',
        requestedByPersonaId: 'felix',
        invokedBy: { kind: 'personaGuest', personaId: 'felix' },
        publishedWithTurnId: 'turn-2'
      }
    });
    const guest = { kind: 'private', principal: { kind: 'personaGuest', personaId: 'felix' } };

    expect(workshopTurnAudience(recalled)).toEqual(room ? { kind: 'room' } : guest);
    expect(workshopTurnAudience({ ...recalled, capability: { ...recalled.capability!, publishedWithTurnId: undefined } }))
      .toEqual(guest);
  });
});

describe('a result the host stamped withheld (ADR 2026-11-05 D7, PR #214 F-05)', () => {
  const card = (metadata?: Record<string, unknown>) => turn({
    participant: 'guest',
    artifact: 'transcript_bookmarks',
    capability: {
      operation: 'transcript.bookmarks',
      status: 'success',
      requestSummary: 'bookmarks in this conversation',
      requestedByPersonaId: 'cliff',
      invokedBy: { kind: 'personaGuest', personaId: 'cliff' },
      ...(metadata ? { metadata } : {}),
      publishedWithTurnId: 'turn-2'
    }
  });

  it('is never publishable, and stays with its invoker even beside a publication fact', () => {
    const withheld = card({ publicationWithheld: 'open-room-private-turn', withheldBookmarks: ['bookmark-1-1'] });
    expect(workshopCapabilityPublicationWithheld(withheld.capability!.metadata)).toBe('open-room-private-turn');
    expect(isWorkshopPublishableCapabilityEvidence(withheld.capability!)).toBe(false);
    expect(workshopTurnAudience(withheld)).toEqual({ kind: 'private', principal: { kind: 'personaGuest', personaId: 'cliff' } });
  });

  it('reads the stamp alone: an unstamped result publishes, and any other metadata changes nothing', () => {
    for (const metadata of [undefined, { outcome: 'bookmarks' }, { publicationWithheld: true }]) {
      expect(isWorkshopPublishableCapabilityEvidence(card(metadata).capability!)).toBe(true);
      expect(workshopTurnAudience(card(metadata))).toEqual({ kind: 'room' });
    }
  });
});

describe('isWorkshopTurnVisibleToParticipant', () => {
  const privateCard = (invokedBy: { kind: 'host' } | { kind: 'personaGuest'; personaId: 'cliff' }) => turn({
    artifact: 'transcript_catalog',
    capability: {
      operation: 'transcript.catalog',
      status: 'success',
      requestSummary: 'saved-session catalog',
      requestedByPersonaId: 'cliff',
      invokedBy
    }
  });

  it('shows a room turn to everyone, private work only to its own participant, and a sidecar to none', () => {
    const readers = [{ kind: 'host' }, { kind: 'personaGuest', personaId: 'cliff' }, { kind: 'personaGuest', personaId: 'margot' }] as const;
    const sidecar = turn({ participant: 'tool', artifact: 'direct_tool_response', toolId: 'prose' });
    expect(readers.map((reader) => isWorkshopTurnVisibleToParticipant(turn(), reader))).toEqual([true, true, true]);
    expect(readers.map((reader) => isWorkshopTurnVisibleToParticipant(privateCard({ kind: 'personaGuest', personaId: 'cliff' }), reader)))
      .toEqual([false, true, false]);
    expect(readers.map((reader) => isWorkshopTurnVisibleToParticipant(privateCard({ kind: 'host' }), reader)))
      .toEqual([true, false, false]);
    expect(readers.map((reader) => isWorkshopTurnVisibleToParticipant(sidecar, reader))).toEqual([false, false, false]);
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
