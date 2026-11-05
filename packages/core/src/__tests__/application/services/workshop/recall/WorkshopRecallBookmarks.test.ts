/**
 * Bookmarks as recall reads them (ADR 2026-11-05 D1, D5): the recall
 * document's copy, a session saved by the Wayfinding release, and the open
 * room's port.
 *
 * The fixture is the Wayfinding-era room the bookmark and memory tests use
 * (a scripted room recorded by the real aggregate), with one labelled and one
 * unlabelled bookmark, as that release saves them: `{ id, turnId, label?,
 * createdAt }` and nothing else.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { workshopBookmarkDefaultLabel } from '@/application/services/workshop/session/WorkshopBookmarkLedger';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import type { WorkshopTurn } from '@messages';

const fixtureText = (): string => JSON.stringify(require('../../../../fixtures/workshop-session-v2-wayfinding-bookmarks.json'));
const fixture = (): WorkshopPersistedSessionV2 => JSON.parse(fixtureText()) as WorkshopPersistedSessionV2;

describe('a session saved by the Wayfinding release, with labelled and unlabelled bookmarks', () => {
  it('reads and saves byte for byte, with no normalization', () => {
    const text = fixtureText();
    const stored = JSON.parse(text).workshop.bookmarks;
    expect(stored).toEqual([
      { id: 'bookmark-1-2000', turnId: 'turn-4-assistant-1008', label: 'Alice\'s reply', createdAt: 2000 },
      { id: 'bookmark-2-3000', turnId: 'turn-2-user-1004', createdAt: 3000 }
    ]);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
  });

  it('reads into the recall document in thread order, with positions, labels and speakers', () => {
    const session = decodeWorkshopPersistedSessionCheckpoint(fixture()).session;
    const document = buildWorkshopRecallDocument(session);
    const writerTurn = session.workshop.turns[1] as WorkshopTurn;

    expect(document.bookmarks.map(({ entry: _entry, ...bookmark }) => bookmark)).toEqual([
      {
        id: 'bookmark-2-3000',
        turnId: 'turn-2-user-1004',
        createdAt: 3000,
        position: 2,
        displayLabel: workshopBookmarkDefaultLabel(writerTurn),
        speaker: { id: 'writer', label: 'Writer' }
      },
      {
        id: 'bookmark-1-2000',
        turnId: 'turn-4-assistant-1008',
        label: 'Alice\'s reply',
        createdAt: 2000,
        position: 4,
        displayLabel: 'Alice\'s reply',
        speaker: expect.objectContaining({ label: expect.any(String) })
      }
    ]);
    expect(document.bookmarks[0].displayLabel).toBe('You · Why does the jar matter?');
    expect(document.bookmarks.every((bookmark) => bookmark.entry !== undefined)).toBe(true);
    // The stored shape is unchanged: decoding the document never wrote the session.
    expect(JSON.stringify(session)).toBe(fixtureText());
  });

  it('counts the bookmarks in the document’s size', () => {
    const session = decodeWorkshopPersistedSessionCheckpoint(fixture()).session;
    const without = { ...session, workshop: { ...session.workshop, bookmarks: undefined } } as WorkshopPersistedSessionV2;
    const marked = buildWorkshopRecallDocument(session);
    const plain = buildWorkshopRecallDocument(without);
    expect(plain.bookmarks).toEqual([]);
    // Every retained string counts: the difference is the bookmarks' own serialization, less an empty list's.
    expect(marked.characters - plain.characters).toBe(JSON.stringify(marked.bookmarks).length - '[]'.length);
  });
});

describe('the open room’s bookmarks, through the host’s read-only port (D1)', () => {
  const turns = (): WorkshopTurn[] => {
    const session = decodeWorkshopPersistedSessionCheckpoint(fixture()).session;
    return session.workshop.turns.map((turn) => ({ ...(turn as WorkshopTurn) }));
  };
  const reader = (ledger: WorkshopTurn[], bookmarks = fixture().workshop.bookmarks ?? []) =>
    new WorkshopLiveRoomBookmarkReader({ readRoomLedger: () => ledger, readRoomBookmarks: () => [...bookmarks] }, () => 'America/Chicago');

  it('reads every bookmark on a room-visible turn, in thread order, in the room’s zone, and writes nothing', () => {
    const ledger = turns();
    const before = JSON.stringify(ledger);
    const read = reader(ledger).readLiveRoomBookmarks({ kind: 'host' });
    expect(read.timezone).toBe('America/Chicago');
    expect(read.turnCount).toBe(ledger.length);
    expect(read.bookmarks.map((row) => [row.id, row.position, row.roomVisible])).toEqual([
      ['bookmark-2-3000', 2, true],
      ['bookmark-1-2000', 4, true]
    ]);
    expect(JSON.stringify(ledger)).toBe(before);
  });

  it('keeps a private card for its own invoker, by the room’s audience rule, and marks it not room-visible', () => {
    const ledger = turns();
    const card: WorkshopTurn = {
      ...ledger[3],
      id: 'turn-8-assistant-1016',
      artifact: 'transcript_catalog',
      participant: 'guest',
      personaId: 'cliff',
      content: 'catalog',
      capability: {
        operation: 'transcript.catalog',
        status: 'success',
        requestSummary: 'saved-session catalog',
        requestedByPersonaId: 'cliff',
        invokedBy: { kind: 'personaGuest', personaId: 'cliff' }
      }
    };
    ledger.push(card);
    const bookmarks = [{ id: 'bookmark-3-4000', turnId: card.id, createdAt: 4000 }];
    expect(reader(ledger, bookmarks).readLiveRoomBookmarks({ kind: 'personaGuest', personaId: 'cliff' }).bookmarks
      .map((row) => [row.id, row.roomVisible])).toEqual([['bookmark-3-4000', false]]);
    expect(reader(ledger, bookmarks).readLiveRoomBookmarks({ kind: 'host' }).bookmarks).toEqual([]);
    expect(reader(ledger, bookmarks).readLiveRoomBookmarks({ kind: 'personaGuest', personaId: 'margot' }).bookmarks).toEqual([]);
    // No reader: only what the whole room sees.
    expect(reader(ledger, bookmarks).readLiveRoomBookmarks(undefined).bookmarks).toEqual([]);
  });
});
