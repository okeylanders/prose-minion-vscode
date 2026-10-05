import { WorkshopTurn } from '@messages';

/** Epoch for every fixture turn: 2026-10-05T14:30:00Z. */
export const FIXTURE_EPOCH = Date.UTC(2026, 9, 5, 14, 30, 0);

export const fixtureTurn = (
  id: string,
  overrides: Partial<WorkshopTurn> = {}
): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: `${id} content`,
  timestamp: FIXTURE_EPOCH,
  excerptVersion: 1,
  ...overrides
});

export const writerTurn = (id: string, overrides: Partial<WorkshopTurn> = {}): WorkshopTurn =>
  fixtureTurn(id, {
    role: 'user',
    kind: 'message',
    participant: 'writer',
    artifact: 'persona_message',
    personaId: undefined,
    personaLabel: undefined,
    ...overrides
  });

export const dividerTurn = (
  id: string,
  artifact: WorkshopTurn['artifact'],
  content: string
): WorkshopTurn =>
  fixtureTurn(id, {
    role: 'system',
    kind: 'divider',
    participant: 'session',
    artifact,
    personaId: undefined,
    personaLabel: undefined,
    content
  });

/** A small room that touches every projection rule once. */
export const representativeRoom = (): WorkshopTurn[] => [
  dividerTurn('s-1', 'session_start', 'Session started · Jill hosting'),
  writerTurn('u-1', {
    content: 'Does the dock scene earn its length?\nBe blunt.',
    messageAttachments: [
      { id: 'ta-1', label: 'chapter-3.md', words: 1200, relativePath: 'drafts/chapter-3.md' }
    ] as WorkshopTurn['messageAttachments']
  }),
  fixtureTurn('a-1', {
    content: '## Verdict\n\nMostly, yes.\n\n1. Trim the vendor catalogue\n2. Keep the coin\n\n### Next steps\n- [high] Cut the second paragraph',
    usage: { promptTokens: 900, completionTokens: 100, totalTokens: 1000 },
    citations: [
      { url: 'https://example.com/docks', title: 'Dock history' },
      { url: 'https://example.com/docks', title: 'Dock history (dupe)' },
      { url: 'https://example.org/markets', title: '2' }
    ]
  }),
  dividerTurn('c-1', 'context_change', 'Context updated: added secret-notes.md (900 words)'),
  writerTurn('u-2', {
    content: 'Try these gestures.',
    widgetCommit: {
      widgetId: 'gesture-playground',
      widgetConfigId: 'wc-1',
      rail: 'thread-artifact',
      artifactId: 'ta-2',
      selectionCount: 3
    }
  }),
  fixtureTurn('a-2', {
    participant: 'guest',
    personaId: 'felix',
    personaLabel: 'Felix',
    content: 'The hands are doing too much.',
    truncated: true
  }),
  fixtureTurn('cap-1', {
    artifact: 'dictionary_lookup',
    participant: 'tool',
    personaId: undefined,
    personaLabel: undefined,
    content: 'FULL DICTIONARY EVIDENCE BODY',
    capability: {
      operation: 'dictionary.lookup',
      status: 'success',
      requestSummary: '“liminal”',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    } as WorkshopTurn['capability']
  }),
  dividerTurn('e-1', 'excerpt_revision', 'Excerpt updated to v2'),
  writerTurn('u-3', {
    kind: 'tool_run',
    toolId: 'prose',
    toolLabel: 'Prose Assistant',
    content: 'Run prose analysis',
    excerptVersion: 2
  }),
  fixtureTurn('a-3', {
    participant: 'tool',
    artifact: 'tool_report',
    toolId: 'prose',
    toolLabel: 'Prose Assistant',
    personaId: undefined,
    personaLabel: undefined,
    content: 'Report body.'
  }),
  writerTurn('u-4', {
    artifact: 'direct_tool_message',
    toolId: 'prose',
    toolLabel: 'Prose Assistant',
    content: 'Why the pacing flag?'
  }),
  fixtureTurn('a-4', {
    participant: 'tool',
    artifact: 'direct_tool_response',
    toolId: 'prose',
    toolLabel: 'Prose Assistant',
    personaId: undefined,
    personaLabel: undefined,
    content: 'Three long sentences in a row.'
  })
];
