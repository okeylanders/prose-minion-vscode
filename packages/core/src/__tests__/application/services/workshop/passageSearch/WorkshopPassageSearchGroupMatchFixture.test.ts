/**
 * A session saved before a card's group could be narrowed (ADR 2026-11-20
 * S45) keeps reading: the fixture was written by the codec of the build
 * before Slice 5, holding a card with a group, a file and the excerpt, and
 * it reads and writes back byte for byte. Made-up text: Alice.
 */
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopTurn } from '@messages';

const FIXTURE = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-group-match.json'));

describe('a session saved before a group could be narrowed', () => {
  it('holds a card and no narrowing', () => {
    expect(FIXTURE).toContain('passageSearchRequest');
    expect(FIXTURE).not.toContain('"match"');
  });

  it('reads, and writes back byte for byte', () => {
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(FIXTURE)))).toBe(FIXTURE);
    const turns = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(FIXTURE)).session.workshop.turns as WorkshopTurn[];
    expect(turns.find((turn) => turn.passageSearchRequest)?.passageSearchRequest).toEqual({
      question: 'Find every time the White Rabbit looks at his pocket watch.',
      scopes: [
        { kind: 'group', group: 'chapters' },
        { kind: 'file', group: 'characters', path: 'cast/white-rabbit.md' },
        { kind: 'excerpt' }
      ]
    });
  });
});
