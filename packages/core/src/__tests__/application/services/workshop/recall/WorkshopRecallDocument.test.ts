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
import type { WorkshopStoredTodoItemV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
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
import {
  saveTodoCorpus,
  TODO_SENTINELS
} from '@/__tests__/application/services/workshop/recall/workshopRecallTodoFixtures';

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
      turnCount: 1,
      excerptVersion: 0,
      openTodos: 0,
      completedTodos: 0
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

  it('indexes a tool reply’s speaker, never a persona’s (Slice 2B)', () => {
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 's-speakers',
      turns: [
        fixtureTurn('t-tool', {
          participant: 'tool',
          artifact: 'tool_report',
          toolId: 'cliche',
          toolLabel: 'Cliché',
          personaId: undefined,
          personaLabel: undefined,
          content: 'Three stock phrases.'
        }),
        fixtureTurn('t-host', { content: 'Agreed.' }),
        fixtureTurn('t-guest', { participant: 'guest', personaId: 'felix', personaLabel: 'Felix', content: 'Mostly.' })
      ]
    }));

    expect(document.entries.map((entry) => entry.searchText))
      .toEqual(['cliche three stock phrases', 'agreed', 'mostly']);
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

  it('charges every retained string, not only the searchable ones (PR 126 F-03)', () => {
    const url = `https://example.com/${'u'.repeat(8_000)}`;
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 's-urls',
      title: 'T'.repeat(500),
      contextLabels: ['L'.repeat(700)],
      turns: [fixtureTurn('t-1', {
        content: 'Cited.',
        personaLabel: 'P'.repeat(300),
        citations: [{ url, title: 'Source' }]
      })]
    }));
    const retained = JSON.stringify({ header: document.header, entries: document.entries });

    expect(document.characters).toBeGreaterThanOrEqual(retained.length);
    expect(document.characters).toBeGreaterThan(url.length + 500 + 700 + 300);
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

describe('the recall document’s to-dos (Slice 2B, D5)', () => {
  it('copies what the sidebar shows, resolves each source turn, and marks staleness against the final excerpt', async () => {
    const { store, sessionIds, todos } = await saveTodoCorpus();
    const saved = (await store.readNamed(sessionIds[0]))!;
    const document = buildWorkshopRecallDocument(saved);
    const positionOf = (turnId: string) => saved.workshop.turns.findIndex((turn) => turn.id === turnId) + 1;

    expect(saved.workshop.revisions.excerpt).toBe(2);
    expect(document.header).toMatchObject({ excerptVersion: 2, openTodos: 3, completedTodos: 1 });
    expect(document.todos).toEqual([
      {
        id: todos.laughter.id,
        text: 'Convert the "raucous laughter" reaction into a prop-based event.',
        status: 'open',
        priority: 'medium',
        source: { kind: 'tool_report', label: 'Stock & Signature', toolId: 'stock-and-signature' },
        turnId: todos.laughter.source.turnId,
        position: positionOf(todos.laughter.source.turnId),
        excerptVersion: 1,
        stale: true,
        createdAt: todos.laughter.createdAt
      },
      expect.objectContaining({ id: todos.shapped.id, status: 'open', priority: 'low', excerptVersion: 1, stale: true }),
      expect.objectContaining({
        id: todos.very.id,
        text: 'Cut the second "very".',
        status: 'completed',
        source: { kind: 'host_turn', label: 'Jill', personaId: 'jill', reportDerived: true },
        stale: true
      }),
      expect.objectContaining({
        id: todos.cadence.id,
        status: 'open',
        source: { kind: 'host_turn', label: 'Jill', personaId: 'jill', reportDerived: false },
        excerptVersion: 2,
        stale: false
      }),
      expect.objectContaining({ id: todos.semicolon.id, status: 'dismissed', stale: false })
    ]);
    expect(document.todos.map((todo) => todo.position))
      .toEqual(document.todos.map((todo) => positionOf(todo.turnId)));
    expect(document.todos.find((todo) => todo.id === todos.cadence.id)).not.toHaveProperty('priority');
  });

  it('keeps no finding key, finding text, or original wording', async () => {
    const { store, sessionIds } = await saveTodoCorpus();
    const documents = await Promise.all(sessionIds.map(async (id) => buildWorkshopRecallDocument((await store.readNamed(id))!)));

    // The fixture really holds the sentinels the document must leave behind.
    const raw = JSON.stringify((await store.readNamed(sessionIds[0]))!.workshop.todos);
    expect(raw).toContain(TODO_SENTINELS.findingKey);
    expect(raw).toContain(`"originalText":"${TODO_SENTINELS.findingText}`);
    for (const document of documents) {
      expect(JSON.stringify(document)).not.toMatch(/SENTINEL-FINDING|findingKey|findingText|originalText|writerEdit/);
    }
  });

  it('names a guest source, and leaves a to-do whose turn is gone without a position', () => {
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 's-guest',
      excerptVersion: 1,
      turns: [fixtureTurn('t-guest', { participant: 'guest', personaId: 'margot', personaLabel: 'Margot' })],
      todos: [
        guestTodo('todo-1-1', 't-guest'),
        guestTodo('todo-2-2', 't-missing')
      ]
    }));

    expect(document.todos).toEqual([
      expect.objectContaining({
        id: 'todo-1-1',
        source: { kind: 'guest_turn', label: 'Margot', personaId: 'margot' },
        position: 1,
        stale: false
      }),
      expect.not.objectContaining({ position: expect.anything() })
    ]);
    expect(document.header).toMatchObject({ excerptVersion: 1, openTodos: 2, completedTodos: 0 });
  });
});

function guestTodo(id: string, turnId: string): WorkshopStoredTodoItemV1 {
  return {
    id,
    text: 'Let her wait one beat longer.',
    status: 'open',
    source: {
      kind: 'guest_turn',
      turnId,
      participantLabel: 'Margot',
      personaId: 'margot',
      findingKey: 'finding-1',
      findingText: 'Let her wait one beat longer.',
      excerptVersion: 1
    },
    createdAt: 0
  };
}

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
