/**
 * The persisted turn ledger is what session recall reads. These guards pin
 * what a saved turn may hold, on the load path (decode) and the save path
 * (the strict writer boundary every autosave runs).
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { messageAttachmentSnapshot } from '@/application/services/workshop/WorkshopSessionRecords';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';

const REQUEST = 'host-request';

/** A saved room with one writer message (one attachment) and one capability artifact. */
const savedRoom = (): WorkshopPersistedSessionV2 => {
  const workshop = new WorkshopSessionService(() => Date.parse('2026-10-05T14:00:00.000Z'));
  workshop.setExcerpt({ text: 'The tide came in.', source: { kind: 'manual' } });
  const added = workshop.addMessageAttachment({
    label: 'letters.md',
    content: 'The full letters.',
    words: 3,
    relativePath: 'drafts/letters.md',
    sourceUri: 'file:///novel/drafts/letters.md'
  });
  if (!added.ok) {
    throw new Error(`fixture attachment refused: ${added.reason}`);
  }
  // The production send path strips the body before the turn sees it.
  workshop.beginPersonaMessage(REQUEST, 'Read the letters.', [messageAttachmentSnapshot(added.attachment)]);
  workshop.recordCapabilityArtifact({
    requestId: REQUEST,
    excerptVersion: workshop.getExcerptVersion(),
    details: {
      operation: 'resource.read',
      status: 'success',
      requestSummary: 'characters/raven.md',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    },
    result: {
      capability: 'resource.read',
      status: 'success',
      requestSummary: 'characters/raven.md',
      content: 'Raven keeps the lighthouse.'
    }
  });
  workshop.completeRun(REQUEST, 'They are about the tide.', undefined, false, 'runtime-host');
  const state = workshop.exportCommittedState();
  const temporal = new WorkshopSessionTimeService({
    now: () => new Date('2026-10-05T13:00:00.000Z'),
    timezone: 'America/Chicago'
  });
  return {
    schemaVersion: 2,
    sessionId: 'session-1',
    title: 'Chapter 6-8',
    createdAt: '2026-10-05T13:00:00.000Z',
    updatedAt: '2026-10-05T14:00:00.000Z',
    temporal: temporal.exportState(),
    summary: {
      hostPersonaId: 'jill',
      participantPersonaIds: ['jill'],
      turnCount: state.turns.length,
      excerptWordCount: 4
    },
    workshop: state,
    conversations: []
  };
};

type MutableTurn = Record<string, unknown> & {
  capability?: Record<string, unknown>;
  messageAttachments?: Array<Record<string, unknown>>;
};

/** A JSON copy of the saved room with one turn edited, as a hand-edited file would be. */
const editedRoom = (edit: (turns: MutableTurn[]) => void): unknown => {
  const raw = JSON.parse(JSON.stringify(savedRoom())) as { workshop: { turns: MutableTurn[] } };
  edit(raw.workshop.turns);
  return raw;
};

const capabilityTurn = (turns: MutableTurn[]): MutableTurn =>
  turns.find((turn) => turn.capability !== undefined)!;

const writerTurnWithAttachment = (turns: MutableTurn[]): MutableTurn =>
  turns.find((turn) => (turn.messageAttachments?.length ?? 0) > 0)!;

describe('persisted Workshop turn guards', () => {
  it('accepts the unedited room on load and save', () => {
    const raw = editedRoom(() => undefined);

    expect(decodeWorkshopPersistedSessionCheckpoint(raw).session.workshop.turns).toHaveLength(3);
    expect(parseWorkshopPersistedSession(raw).workshop.turns).toHaveLength(3);
  });

  it('rejects a capability operation outside the closed list on load and save', () => {
    const raw = editedRoom((turns) => {
      capabilityTurn(turns).capability!.operation = 'transcript.read';
    });

    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(/capability\.operation must be/);
    expect(() => parseWorkshopPersistedSession(raw)).toThrow(/capability\.operation must be/);
  });

  it('rejects a turn artifact outside the closed list on load and save', () => {
    const raw = editedRoom((turns) => {
      capabilityTurn(turns).artifact = 'transcript_read';
    });

    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(/artifact must be/);
    expect(() => parseWorkshopPersistedSession(raw)).toThrow(/artifact must be/);
  });

  it('refuses an attachment body on a saved turn: bodies live only in thread artifacts', () => {
    const raw = editedRoom((turns) => {
      writerTurnWithAttachment(turns).messageAttachments![0].content = 'The full letters.';
    });

    expect(() => decodeWorkshopPersistedSessionCheckpoint(raw)).toThrow(/unknown field/);
    expect(() => parseWorkshopPersistedSession(raw)).toThrow(/unknown field/);
  });
});
