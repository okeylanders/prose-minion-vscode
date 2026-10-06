/**
 * Session recall's request codec (ADR 2026-10-05 §1, D6, D8–D10): every
 * accepted shape and every refusal, so the recall service never sees a
 * request it would have to repair.
 */

import { parseWorkshopCapabilityXmlDocument } from '@/application/services/workshop/WorkshopCapabilityXmlDocument';
import {
  inspectWorkshopTranscriptRecallCall,
  isWorkshopTranscriptRecallOperation,
  WORKSHOP_TRANSCRIPT_RECALL_FIELD_POLICY,
  WorkshopTranscriptRecallInspection
} from '@/application/services/workshop/WorkshopTranscriptRecallXmlCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const SESSION = '6b0f3c9e-2a4d-4c1e-9f3b-1d2e3f4a5b6c';
const OTHER = '91ac0d2e-7f6b-4a3c-8e1d-2b3c4d5e6f70';

const call = (operation: string, body: string): string =>
  `<prose-minion-tool-call name="${operation}">${body}</prose-minion-tool-call>`;

const inspect = (operation: string, body: string): WorkshopTranscriptRecallInspection | { kind: string } => {
  const document = parseWorkshopCapabilityXmlDocument(call(operation, body), WORKSHOP_TRANSCRIPT_RECALL_FIELD_POLICY);
  if (document.kind !== 'call' || !isWorkshopTranscriptRecallOperation(document.operation)) {
    return document;
  }
  return inspectWorkshopTranscriptRecallCall(document.operation, document);
};

const request = (operation: string, body: string) => {
  const inspected = inspect(operation, body);
  if (inspected.kind !== 'request') {
    throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
  }
  return (inspected as Extract<WorkshopTranscriptRecallInspection, { kind: 'request' }>).request;
};

const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;

describe('transcript.* requests the codec accepts', () => {
  it.each([
    ['', { capability: 'transcript.catalog' }],
    ['<persona>cliff</persona>', { capability: 'transcript.catalog', personaId: 'cliff' }],
    ['<persona> Sister   Agnes </persona>', { capability: 'transcript.catalog', personaId: 'agnes' }],
    ['<persona>JILL</persona><match>chapter 6.7</match>', { capability: 'transcript.catalog', personaId: 'jill', match: 'chapter 6.7' }],
    [`<match>${'m'.repeat(budgets.todoMatchCharacters)}</match>`, { capability: 'transcript.catalog', match: 'm'.repeat(budgets.todoMatchCharacters) }]
  ])('a catalog: %s', (body, expected) => {
    expect(request('transcript.catalog', body)).toEqual(expected);
  });

  it.each([
    ['<query>lighthouse mother</query>', { capability: 'transcript.search', query: 'lighthouse mother' }],
    [
      `<query>keeper</query><session>${SESSION}</session><persona>Cliff</persona>`,
      { capability: 'transcript.search', query: 'keeper', sessionId: SESSION, personaId: 'cliff' }
    ],
    [`<query>${'q'.repeat(budgets.queryCharacters)}</query>`, { capability: 'transcript.search', query: 'q'.repeat(budgets.queryCharacters) }]
  ])('a search: %s', (body, expected) => {
    expect(request('transcript.search', body)).toEqual(expected);
  });

  it.each([
    [`<session>${SESSION}</session>`, [{ sessionId: SESSION }], undefined],
    [`<session turns="38-46, 52">${SESSION}</session>`, [{ sessionId: SESSION, turns: [{ from: 38, to: 46 }, { from: 52, to: 52 }] }], undefined],
    // The D10 hint and a one-session continuation: a sibling <turns> beside one bare session.
    [`<session>${SESSION}</session><turns>12</turns>`, [{ sessionId: SESSION, turns: [{ from: 12, to: 12 }] }], undefined],
    [`<session>${SESSION}</session><turns> 1 - 3 ,999999 </turns><detail>discussion</detail>`,
      [{ sessionId: SESSION, turns: [{ from: 1, to: 3 }, { from: 999_999, to: 999_999 }] }], 'discussion'],
    [`<session turns="12">${SESSION}</session> <session>${OTHER}</session><detail>Full</detail>`,
      [{ sessionId: SESSION, turns: [{ from: 12, to: 12 }] }, { sessionId: OTHER }], 'full']
  ])('a read: %s', (body, sessions, detail) => {
    expect(request('transcript.read', body)).toEqual({
      capability: 'transcript.read',
      sessions,
      ...(detail ? { detail } : {})
    });
  });

  it('a read of the most sessions one call may name, in the order asked', () => {
    const ids = Array.from({ length: budgets.readSessions }, (_, index) => `session-${index}`);
    expect(request('transcript.read', ids.map((id) => `<session>${id}</session>`).join('')))
      .toEqual({ capability: 'transcript.read', sessions: ids.map((sessionId) => ({ sessionId })) });
  });

  it('a read with the most turn ranges one selection may hold', () => {
    const selection = Array.from({ length: budgets.turnRanges }, (_, index) => `${index * 10 + 1}-${index * 10 + 5}`).join(', ');
    expect(request('transcript.read', `<session turns="${selection}">${SESSION}</session>`)).toMatchObject({
      sessions: [{ sessionId: SESSION, turns: expect.arrayContaining([{ from: 91, to: 95 }]) }]
    });
  });

  it.each([
    ['', { capability: 'transcript.todos' }],
    ['<status>open</status>', { capability: 'transcript.todos', status: 'open' }],
    ['<status>Completed</status>', { capability: 'transcript.todos', status: 'completed' }],
    ['<status>dismissed</status>', { capability: 'transcript.todos', status: 'dismissed' }],
    ['<status>all</status>', { capability: 'transcript.todos', status: 'all' }],
    ['<recent>1</recent>', { capability: 'transcript.todos', recent: 1 }],
    [`<recent>${budgets.todoSessions}</recent>`, { capability: 'transcript.todos', recent: budgets.todoSessions }],
    [`<session>${SESSION}</session>`, { capability: 'transcript.todos', sessionId: SESSION }],
    ['<match>chapter 6-7</match><source>cliche</source>', { capability: 'transcript.todos', match: 'chapter 6-7', source: 'cliche' }],
    ['<source>Jill</source><persona>sister agnes</persona>', { capability: 'transcript.todos', source: 'jill', personaId: 'agnes' }],
    ['<source>Sister Agnes</source>', { capability: 'transcript.todos', source: 'agnes' }]
  ])('a to-do list: %s', (body, expected) => {
    expect(request('transcript.todos', body)).toEqual(expected);
  });
});

describe('transcript.* requests the codec refuses', () => {
  const tooLong = (characters: number): string => 'x'.repeat(characters + 1);

  it.each([
    // Fields
    ['transcript.catalog', '<query>tide</query>', 'unexpected-field', 'query'],
    ['transcript.search', '', 'missing-field', 'query'],
    ['transcript.read', '<detail>full</detail>', 'missing-field', 'session'],
    ['transcript.read', '', 'missing-field', 'session'],
    ['transcript.search', '<query> </query>', 'empty-field', 'query'],
    ['transcript.catalog', '<match></match>', 'empty-field', 'match'],
    ['transcript.read', `<session>${SESSION}</session><session> </session>`, 'empty-field', 'session'],
    ['transcript.read', `<session>${SESSION}</session><detail>full</detail><detail>full</detail>`, 'duplicate-field', 'detail'],
    ['transcript.search', '<query>a</query><query>b</query>', 'duplicate-field', 'query'],
    ['transcript.todos', `<session>${SESSION}</session><session>${OTHER}</session>`, 'duplicate-field', 'session'],
    ['transcript.search', `<query>tide</query><session turns="1">${SESSION}</session>`, 'field-attributes', 'session'],
    ['transcript.read', `<session range="1">${SESSION}</session>`, 'field-attributes', 'session'],
    ['transcript.read', `<session>${SESSION}</session><detail level="2">full</detail>`, 'field-attributes', 'detail'],
    // Lengths
    ['transcript.search', `<query>${tooLong(budgets.queryCharacters)}</query>`, 'oversized-input', 'query'],
    ['transcript.catalog', `<match>${tooLong(budgets.todoMatchCharacters)}</match>`, 'oversized-input', 'match'],
    ['transcript.todos', `<match>${tooLong(budgets.todoMatchCharacters)}</match>`, 'oversized-input', 'match'],
    ['transcript.read', `<session>${tooLong(budgets.sessionIdCharacters)}</session>`, 'oversized-input', 'session'],
    ['transcript.read', `<session turns="${'1,'.repeat(100)}1">${SESSION}</session>`, 'oversized-input', 'turns'],
    // Session ids are never paths
    ['transcript.read', '<session>../current</session>', 'invalid-session-id', 'session'],
    ['transcript.search', '<query>tide</query><session>a/b</session>', 'invalid-session-id', 'session'],
    ['transcript.todos', '<session>-rf</session>', 'invalid-session-id', 'session'],
    ['transcript.read', '<session>two words</session>', 'invalid-session-id', 'session'],
    // Turn selections
    ['transcript.read', `<session turns="0">${SESSION}</session>`, 'invalid-turn-selection', 'turns'],
    ['transcript.read', `<session turns="5-3">${SESSION}</session>`, 'invalid-turn-selection', 'turns'],
    ['transcript.read', `<session turns="1234567">${SESSION}</session>`, 'invalid-turn-selection', 'turns'],
    ['transcript.read', `<session turns="1,,2">${SESSION}</session>`, 'invalid-turn-selection', 'turns'],
    ['transcript.read', `<session turns="">${SESSION}</session>`, 'invalid-turn-selection', 'turns'],
    ['transcript.read', `<session turns="007">${SESSION}</session>`, 'invalid-turn-selection', 'turns'],
    ['transcript.read', `<session>${SESSION}</session><turns>last</turns>`, 'invalid-turn-selection', 'turns'],
    ['transcript.read', `<session turns="${Array.from({ length: budgets.turnRanges + 1 }, (_, index) => index + 1).join(',')}">${SESSION}</session>`,
      'invalid-turn-selection', 'turns'],
    // Decision 1: a sibling <turns> needs exactly one session with no ranges of its own
    ['transcript.read', `<session>${SESSION}</session><session>${OTHER}</session><turns>12</turns>`, 'ambiguous-turns', 'turns'],
    ['transcript.read', `<session turns="3">${SESSION}</session><turns>12</turns>`, 'ambiguous-turns', 'turns'],
    // Session lists
    ['transcript.read', Array.from({ length: budgets.readSessions + 1 }, (_, index) => `<session>s${index}</session>`).join(''),
      'too-many-sessions', 'session'],
    ['transcript.read', `<session>${SESSION}</session><session turns="4">${SESSION}</session>`, 'duplicate-session', 'session'],
    // Closed vocabularies
    ['transcript.read', `<session>${SESSION}</session><detail>summary</detail>`, 'invalid-detail', 'detail'],
    ['transcript.catalog', '<persona>nobody</persona>', 'unknown-persona', 'persona'],
    ['transcript.todos', '<persona>cliche</persona>', 'unknown-persona', 'persona'],
    ['transcript.todos', '<source>bogus</source>', 'unknown-source', 'source'],
    ['transcript.todos', '<status>stale</status>', 'invalid-status', 'status'],
    ['transcript.todos', '<recent>0</recent>', 'invalid-recent', 'recent'],
    ['transcript.todos', `<recent>${budgets.todoSessions + 1}</recent>`, 'invalid-recent', 'recent'],
    ['transcript.todos', '<recent>three</recent>', 'invalid-recent', 'recent'],
    ['transcript.todos', '<recent>1.5</recent>', 'invalid-recent', 'recent'],
    ['transcript.todos', '<recent>-1</recent>', 'invalid-recent', 'recent'],
    ['transcript.todos', `<recent>3</recent><session>${SESSION}</session>`, 'conflicting-session-selection', 'recent'],
    ['transcript.todos', `<recent>99</recent><session>${SESSION}</session>`, 'conflicting-session-selection', 'recent']
  ])('%s %s is refused as %s (%s)', (operation, body, reason, field) => {
    expect(inspect(operation, body)).toEqual({ kind: 'invalid', reason, field, operation });
  });
});
