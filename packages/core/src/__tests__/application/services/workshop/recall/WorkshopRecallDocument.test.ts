/**
 * The recall document (ADR 2026-10-05 §3): a saved session's header and its
 * visible entries, each addressed by ledger position.
 */

import {
  buildWorkshopRecallDocument,
  normalizeWorkshopRecallText,
  workshopRecallWords
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { rewindWorkshopSession } from '@/application/services/workshop/session/WorkshopSessionRewind';
import {
  dividerTurn,
  fixtureTurn,
  writerTurn
} from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import { runCanonicalScriptedRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import {
  RECALL_SENTINELS,
  RECALL_VISIBLE_LABELS,
  recallSession,
  saveSentinelCorpus
} from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

describe('buildWorkshopRecallDocument', () => {
  it('addresses each visible turn by its 1-based ledger position, skipping omitted turns', () => {
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 's-1',
      turns: [
        dividerTurn('t-start', 'session_start', 'Session started · Jill hosting'),
        writerTurn('t-ask', { content: 'Where is the lantern?' }),
        dividerTurn('t-context', 'context_change', 'Context updated: added map.md'),
        fixtureTurn('t-reply', { content: 'On the stair.' })
      ]
    }));

    expect(document.entries.map(({ position, turnId }) => [position, turnId])).toEqual([
      [1, 't-start'],
      [2, 't-ask'],
      [4, 't-reply']
    ]);
    expect(document.header.turnCount).toBe(4);
  });

  it('builds the header from session metadata, never the preview or excerpt identity', () => {
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 's-2',
      title: 'Chapter 6-8 bridge',
      updatedAt: '2026-10-04T02:12:00.000Z',
      savedAt: '2026-10-04T02:10:00.000Z',
      timezone: 'America/Chicago',
      hostPersonaId: 'jill',
      participantPersonaIds: ['jill', 'cliff'],
      scope: 'excerpt',
      excerptLabel: 'chapter-6-8.md',
      contextLabels: ['keeper-notes.md', 'Tide tables'],
      turns: [writerTurn('t-1', { content: 'Hello.' })]
    }));

    expect(document.header).toEqual({
      sessionId: 's-2',
      title: 'Chapter 6-8 bridge',
      savedAt: '2026-10-04T02:10:00.000Z',
      startedAt: '2026-10-01T15:00:00.000Z',
      timezone: 'America/Chicago',
      hostPersonaId: 'jill',
      host: 'Jill',
      participantPersonaIds: ['jill', 'cliff'],
      participants: ['Jill', 'Cliff'],
      scope: 'excerpt',
      excerptLabel: 'chapter-6-8.md',
      contextLabels: ['keeper-notes.md', 'Tide tables'],
      turnCount: 1
    });
    expect(document.updatedAt).toBe('2026-10-04T02:12:00.000Z');
    const serialized = JSON.stringify(document);
    expect(serialized).not.toContain('SYNTHETIC-PREVIEW');
    expect(serialized).not.toContain('SYNTHETIC-EXCERPT-IDENTITY');
    expect(serialized).not.toContain('SYNTHETIC-CONTEXT-BODY');
  });

  it('dates an unsaved checkpoint by its last activity', () => {
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 's-3',
      updatedAt: '2026-10-02T09:00:00.000Z',
      turns: []
    }));

    expect(document.header.savedAt).toBe('2026-10-02T09:00:00.000Z');
    expect(document.entries).toEqual([]);
  });

  it('searches what the thread shows: text, attachment and widget labels, and source labels', () => {
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 's-4',
      turns: [
        writerTurn('t-ask', {
          content: 'Café scene: don’t rush it.',
          messageAttachments: [{ id: 'ta-1', label: 'Letters.md', words: 3 }],
          widgetCommit: {
            widgetId: 'creative-variations',
            widgetConfigId: 'wc-1',
            rail: 'thread-artifact',
            artifactId: 'ta-2',
            selectionCount: 2
          }
        }),
        fixtureTurn('t-reply', {
          content: 'Slow it down.',
          citations: [{ url: 'https://example.com/tides', title: 'Tide Atlas' }]
        })
      ]
    }));

    expect(document.entries[0].searchText)
      .toBe('cafe scene dont rush it letters md creative variations explorer 2 variations');
    expect(document.entries[1].searchText).toBe('slow it down tide atlas');
  });

  it('keeps every position a rewound copy retains (U4)', () => {
    const room = runCanonicalScriptedRoom();
    const workshop = room.session.exportCommittedState();
    const conversations = room.archive();
    const full = buildWorkshopRecallDocument(recallSession({ sessionId: 'full', turns: workshop.turns }));
    const cutAt = room.restPoints[Math.floor(room.restPoints.length / 2)].headTurnId;
    const rewound = rewindWorkshopSession({
      workshop,
      conversations,
      cut: { kind: 'afterTurn', turnId: cutAt }
    });
    const copy = buildWorkshopRecallDocument(recallSession({
      sessionId: 'rewound',
      turns: rewound.workshop.turns
    }));

    expect(rewound.summary.removedTurnCount).toBeGreaterThan(0);
    expect(copy.entries.length).toBeGreaterThan(0);
    expect(copy.entries.map(({ position, turnId }) => ({ position, turnId })))
      .toEqual(full.entries.slice(0, copy.entries.length).map(({ position, turnId }) => ({ position, turnId })));
  });

  it('carries labels but no hidden body from a real saved session', async () => {
    const { store, savedSessionId } = await saveSentinelCorpus();
    const saved = await store.readNamed(savedSessionId);
    const document = buildWorkshopRecallDocument(saved!);
    const serialized = JSON.stringify(document);

    // The real summary did copy the last turn's evidence into its preview.
    expect(saved!.summary.preview).toContain(RECALL_SENTINELS.previewEvidence);
    for (const sentinel of Object.values(RECALL_SENTINELS)) {
      expect(serialized).not.toContain(sentinel);
    }
    expect(document.header).toMatchObject({
      title: RECALL_VISIBLE_LABELS.title,
      excerptLabel: RECALL_VISIBLE_LABELS.excerpt,
      contextLabels: [RECALL_VISIBLE_LABELS.contextFile, RECALL_VISIBLE_LABELS.contextNote]
    });
    expect(serialized).toContain(RECALL_VISIBLE_LABELS.attachment);
    expect(serialized).toContain(RECALL_VISIBLE_LABELS.reply);
  });
});

describe('recall words', () => {
  it('folds case, diacritics, compatibility forms, possessives, and apostrophes', () => {
    expect(normalizeWorkshopRecallText('Ég SAW the Ｋeeper’s ﬁre — Jill\'s, 2nd.'))
      .toBe('eg saw the keeper fire jill 2nd');
  });

  it('reports where each word sits in the original text', () => {
    const text = 'The  café́s lamp';
    const words = workshopRecallWords(text);

    expect(words.map(({ start, end }) => text.slice(start, end))).toEqual(['The', 'café́s', 'lamp']);
    expect(words.map((word) => word.normalized)).toEqual(['the', 'cafes', 'lamp']);
  });
});
