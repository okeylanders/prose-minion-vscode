/**
 * `transcript.todos` text (ADR 2026-10-05 D5–D7): the framing line, every
 * D5 field paired in one block per to-do, disclosure of every bound, and a
 * hard `todoCharacters` cap that holds whatever a saved file contains.
 */

import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { WORKSHOP_TRANSCRIPT_RECALL_FRAMING } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import {
  renderWorkshopRecallTodos,
  WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS
} from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import { parseWorkshopRecallQuery } from '@/application/services/workshop/recall/WorkshopTranscriptRecallSearch';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type {
  WorkshopRecallTodosBounds,
  WorkshopRecallTodosResult
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import type { WorkshopStoredTodoItemV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { fixtureTurn } from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import { RECALL_ROOT, recallSession } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import {
  RecallTodoCorpus,
  saveTodoCorpus,
  TODO_SENTINELS
} from '@/__tests__/application/services/workshop/recall/workshopRecallTodoFixtures';

type Listed = Extract<WorkshopRecallTodosResult, { outcome: 'todos' }>;

const NOW = Date.parse('2026-10-06T15:00:00.000Z');
const TODO_CHARACTERS = PROMPT_BUDGETS.workshopTranscriptRecall.todoCharacters;

const NO_BOUNDS: WorkshopRecallTodosBounds = {
  corpusSessions: 0,
  sessionLimit: 50,
  sessionsScanned: 0,
  notScannedBySessionLimit: 0,
  notScannedByByteBudget: 0,
  omittedByItemLimit: 0,
  notShownByStatus: { open: 0, completed: 0, dismissed: 0 },
  notShownBySource: 0,
  unreadableSessions: 0,
  listingTruncated: false,
  parsedBytes: 0,
  unreadableBytesCharged: 0,
  cacheHits: 0
};

const emptyList = (overrides: Partial<Listed> = {}): Listed => ({
  available: true,
  outcome: 'todos',
  status: 'open',
  sessions: [],
  bounds: NO_BOUNDS,
  ...overrides
});

/** Every to-do line is followed by its metadata; the text shows exactly the to-dos `shown` names. */
function expectPaired(content: string, shown: ReadonlyArray<{ sessionId: string; todoId: string }>): void {
  const lines = content.split('\n');
  const items = lines.flatMap((line, index) => (line.startsWith('- [') ? [index] : []));
  expect(items).toHaveLength(shown.length);
  for (const index of items) {
    expect(lines[index + 1]).toMatch(/^ {2}id \S.* in session \S.* · from .+ \((tool|persona) \S+, (tool report|host turn|guest turn)[^)]*\) · (turn \d+|source turn not in this session) · excerpt v\S+.* · created .+$/);
  }
}

describe('renderWorkshopRecallTodos over real to-dos', () => {
  let corpus: RecallTodoCorpus;
  let render: (request?: Parameters<WorkshopTranscriptRecallService['todos']>[0]) => Promise<ReturnType<typeof renderWorkshopRecallTodos>>;

  beforeAll(async () => {
    corpus = await saveTodoCorpus();
    render = async (request = {}) => renderWorkshopRecallTodos(
      await new WorkshopTranscriptRecallService(corpus.store, corpus.coordinator, corpus.log).todos(request),
      { now: NOW }
    );
  });

  it('frames the list, groups it newest first, and shows every D5 field of each to-do together', async () => {
    const { content, shown, notShownForSpace } = await render();
    const [first, second, third] = corpus.sessionIds;
    const { todos } = corpus;

    expect(content.split('\n')).toEqual([
      WORKSHOP_TRANSCRIPT_RECALL_FRAMING,
      'Open to-dos (stale ones marked) from 3 sessions, newest first.',
      '',
      `“Endings chat” · id ${third} · saved Monday, October 5, 2026, 2:00 PM (America/Chicago), 20 hours ago · open conversation · 1 open, 0 completed`,
      '- [open] List three quiet endings you admire.',
      `  id ${todos.endings.id} in session ${third} · from Jill (persona jill, host turn) · turn 3 · excerpt v0 · created Monday, October 5, 2026`,
      '',
      `“Cliché pass” · id ${second} · saved Sunday, October 4, 2026, 2:00 PM (America/Chicago), 2 days ago · excerpt chapter-6-7.md · 1 open, 0 completed`,
      '- [open · high] Replace "cold as ice".',
      `  id ${todos.cliche.id} in session ${second} · from Cliché (tool cliche, tool report) · turn 3 · excerpt v1 · created Sunday, October 4, 2026`,
      '',
      `“Chapter 6-7 stock signature” · id ${first} · saved Saturday, October 3, 2026, 2:04 PM (America/Chicago), 3 days ago · excerpt chapter-6-7.md · 3 open, 1 completed`,
      '- [open · medium · stale] Convert the "raucous laughter" reaction into a prop-based event.',
      `  id ${todos.laughter.id} in session ${first} · from Stock & Signature (tool stock-and-signature, tool report) · turn 3 · excerpt v1 (session ended on v2) · created Saturday, October 3, 2026`,
      '- [open · low · stale] Correct "shapped" to "shaped".',
      `  id ${todos.shapped.id} in session ${first} · from Stock & Signature (tool stock-and-signature, tool report) · turn 3 · excerpt v1 (session ended on v2) · created Saturday, October 3, 2026`,
      '- [open] Vary the cadence of the last paragraph.',
      `  id ${todos.cadence.id} in session ${first} · from Jill (persona jill, host turn) · turn 7 · excerpt v2 · created Saturday, October 3, 2026`,
      '',
      'Scanned 3 of 3 saved sessions; the current session is never listed.',
      '1 completed and 1 dismissed to-dos not shown (status: open).'
    ]);
    expect(shown).toEqual([
      { sessionId: third, todoId: todos.endings.id },
      { sessionId: second, todoId: todos.cliche.id },
      { sessionId: first, todoId: todos.laughter.id },
      { sessionId: first, todoId: todos.shapped.id },
      { sessionId: first, todoId: todos.cadence.id }
    ]);
    expect(notShownForSpace).toBe(0);
  });

  it('marks a report-derived host source, and states its filters', async () => {
    const { content, shown } = await render({ status: 'completed', match: 'chapter 6-7 lighthouse', source: 'jill', personaId: 'jill' });

    expect(content).toContain('Completed to-dos from 1 session, newest first.');
    expect(content).toContain(
      'Filters: sessions that include Jill; title or excerpt label matching “chapter 6-7 lighthouse” ' +
      '(terms: chapter, 6, 7, lighthouse; no session matched every term; these match some); from source jill.'
    );
    expect(content).toContain('- [completed · high · stale] Cut the second "very".');
    expect(content).toContain('from Jill (persona jill, host turn, report-derived) · turn 4');
    expectPaired(content, shown);
  });

  it('holds its cap through the real store when a saved file holds an enormous to-do and source label', async () => {
    const edited = await saveTodoCorpus();
    const directory = `${RECALL_ROOT}/prose-minion/sessions`;
    const file = [...edited.fs.files.keys()].find((name) =>
      name.startsWith(directory) && name.endsWith('.json') && !name.endsWith('.summary.json') &&
      new TextDecoder().decode(edited.fs.files.get(name)!).includes(`"sessionId": "${edited.sessionIds[0]}"`))!;
    const session = JSON.parse(new TextDecoder().decode(edited.fs.files.get(file)));
    for (const todo of session.workshop.todos) {
      todo.text = 'word '.repeat(100_000);
      todo.source.participantLabel = 'P'.repeat(100_000);
    }
    edited.fs.files.set(file, new TextEncoder().encode(JSON.stringify(session, undefined, 2)));

    const result = await new WorkshopTranscriptRecallService(edited.store, edited.coordinator, edited.log).todos({ status: 'all' });
    const rendered = renderWorkshopRecallTodos(result, { now: NOW });

    expect(result).toMatchObject({ outcome: 'todos', bounds: { unreadableSessions: 0 } });
    expect(rendered.content.length).toBeLessThanOrEqual(TODO_CHARACTERS);
    expect(rendered.shown).toHaveLength(7);
    expect(rendered.content).toContain(`from ${'P'.repeat(199)}… (tool stock-and-signature, tool report)`);
    expect(rendered.content).toMatch(/- \[open · medium · stale\] (word ){99}word…\n/);
    expectPaired(rendered.content, rendered.shown);
  });
});

describe('<match> terms past the eight-term limit (PR 127 review F-01)', () => {
  const NINE_TERMS = 'alpha beta gamma delta epsilon zeta eta theta lighthouse';
  let service: WorkshopTranscriptRecallService;
  let renamed: string;

  beforeAll(async () => {
    const corpus = await saveTodoCorpus();
    renamed = corpus.sessionIds[0];
    // A real rename through the store: no saved file is edited by hand.
    await corpus.store.renameNamed(renamed, 'alpha beta gamma delta epsilon zeta eta theta');
    service = new WorkshopTranscriptRecallService(corpus.store, corpus.coordinator, corpus.log);
  });

  const filtersFor = async (match: string) => {
    const result = await service.todos({ match });
    const content = renderWorkshopRecallTodos(result, { now: NOW }).content;
    return { result, filters: content.split('\n').find((line) => line.startsWith('Filters: ')) };
  };

  it('names the term it never evaluated, and says every evaluated term matched', async () => {
    expect(NINE_TERMS.length).toBeLessThan(PROMPT_BUDGETS.workshopTranscriptRecall.todoMatchCharacters);

    const { result, filters } = await filtersFor(NINE_TERMS);

    expect(result).toMatchObject({
      outcome: 'todos',
      match: { mode: 'all-terms', query: { overflowTerms: ['lighthouse'] } },
      sessions: [{ header: { sessionId: renamed } }]
    });
    expect(filters).toBe(
      `Filters: title or excerpt label matching “${NINE_TERMS}” ` +
      '(terms: alpha, beta, gamma, delta, epsilon, zeta, eta, theta; every evaluated term matched; ' +
      'not evaluated, past the eight-term limit: lighthouse).'
    );
  });

  it('names the term it never evaluated when sessions match only some terms', async () => {
    const { result, filters } = await filtersFor('alpha beta gamma delta epsilon zeta eta cliche lighthouse');

    expect(result).toMatchObject({ match: { mode: 'any-term', query: { overflowTerms: ['lighthouse'] } } });
    expect(filters).toContain(
      '(terms: alpha, beta, gamma, delta, epsilon, zeta, eta, cliche; no session matched every term; these match some; ' +
      'not evaluated, past the eight-term limit: lighthouse).'
    );
  });

  it('names the term it never evaluated when no session matched', async () => {
    const { result, filters } = await filtersFor('one two three four five six seven eight lighthouse');

    expect(result).toMatchObject({ sessions: [], match: { query: { overflowTerms: ['lighthouse'] } } });
    expect(filters).toContain(
      '(terms: one, two, three, four, five, six, seven, eight; no session matched; ' +
      'not evaluated, past the eight-term limit: lighthouse).'
    );
  });

  it('lists the terms it matched on when nothing was left out', async () => {
    const { filters } = await filtersFor('chapter 6-7');

    expect(filters).toBe('Filters: title or excerpt label matching “chapter 6-7” (terms: chapter, 6, 7; every term matched).');
  });
});

describe('renderWorkshopRecallTodos disclosure', () => {
  it('states every bound the service reported, and how to narrow the list', () => {
    const document = buildWorkshopRecallDocument(recallSession({
      sessionId: 'older',
      title: 'Older',
      turns: [fixtureTurn('t-1')],
      todos: Array.from({ length: 12 }, (_, index) => storedTodo(`todo-${index + 1}-1`, 't-1', 'x'.repeat(500)))
    }));
    const { content, shown, notShownForSpace } = renderWorkshopRecallTodos(emptyList({
      recent: 4,
      source: 'cliche',
      sessions: [{ header: document.header, todos: document.todos }],
      bounds: {
        ...NO_BOUNDS,
        corpusSessions: 9,
        sessionLimit: 4,
        sessionsScanned: 2,
        notScannedBySessionLimit: 5,
        notScannedByByteBudget: 1,
        unreadableSessions: 1,
        listingTruncated: true,
        omittedByItemLimit: 7,
        notShownByStatus: { open: 0, completed: 2, dismissed: 1 },
        notShownBySource: 4
      }
    }), { now: NOW, todoCharacters: WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS + 1_000 });

    expect(notShownForSpace).toBe(12 - shown.length);
    expect(notShownForSpace).toBeGreaterThan(0);
    expect(content.split('\n\n').at(-1)!.split('\n')).toEqual([
      'Scanned 2 of 9 saved sessions; the current session is never listed.',
      'Not scanned: 5 older past <recent>4</recent>; 1 past this call\'s reading budget.',
      '1 session could not be read and was skipped.',
      'This workspace holds more session files than one listing reads; the oldest were not listed.',
      '1 scanned session had no to-do to show.',
      '2 completed and 1 dismissed to-dos not shown (status: open).',
      '4 to-dos from other sources not shown (source: cliche).',
      `7 more to-dos past the ${PROMPT_BUDGETS.workshopTranscriptRecall.todoItems}-item limit.`,
      `${notShownForSpace} more to-dos did not fit in this listing.`,
      'Narrow the list with <session>, <recent>, <match>, <source>, or <status>, for example <session>older</session>.'
    ]);
  });

  it('says plainly when nothing is left to show, and why', () => {
    const query = parseWorkshopRecallQuery('lighthouse');
    const content = renderWorkshopRecallTodos(emptyList({
      status: 'all',
      match: { text: 'lighthouse', query },
      bounds: { ...NO_BOUNDS, corpusSessions: 0 }
    }), { now: NOW }).content;

    expect(content.split('\n')).toEqual([
      WORKSHOP_TRANSCRIPT_RECALL_FRAMING,
      'No to-dos of every status (stale ones marked) to show.',
      'Filters: title or excerpt label matching “lighthouse” (terms: lighthouse; no session matched).',
      '',
      'Scanned 0 of 0 saved sessions the filters admitted; the current session is never listed.'
    ]);
  });

  it('frames a refusal, and names the live room', () => {
    for (const result of [
      { available: false, reason: 'workspace-changed' },
      { available: true, outcome: 'unknown-session', sessionId: 'live', liveSession: true },
      { available: true, outcome: 'unknown-session', sessionId: 'x'.repeat(10_000), liveSession: false }
    ] as const) {
      const { content, shown } = renderWorkshopRecallTodos(result, { now: NOW });
      expect(content.split('\n')[0]).toBe(WORKSHOP_TRANSCRIPT_RECALL_FRAMING);
      expect(content.length).toBeLessThan(600);
      expect(shown).toEqual([]);
    }
    expect(renderWorkshopRecallTodos({ available: true, outcome: 'unknown-session', sessionId: 'live', liveSession: true }, { now: NOW }).content)
      .toContain('Session live is the current session.');
  });

  it('refuses a cap below the minimum, and the production budget clears it', () => {
    expect(() => renderWorkshopRecallTodos(emptyList(), { now: NOW, todoCharacters: WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS - 1 }))
      .toThrow(RangeError);
    expect(TODO_CHARACTERS).toBeGreaterThanOrEqual(WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS);
  });
});

describe('the to-do list bound, with every saved-file label at its maximum', () => {
  const HUGE = 20_000;
  /** Forty distinct 300-character words: both of `<match>`'s term lists at their bounds. */
  const MANY_TERMS = Array.from({ length: 40 }, (_, index) => `w${index}${'m'.repeat(300)}`).join(' ');

  /** Thirty sessions of three to-dos each, every label and number from a saved file at its worst. */
  function maxedOut(): Listed {
    const sessions = Array.from({ length: 30 }, (_, index) => {
      const document = buildWorkshopRecallDocument(recallSession({
        sessionId: `s${index}-${'i'.repeat(HUGE)}`,
        title: 'T'.repeat(HUGE),
        excerptLabel: 'L'.repeat(HUGE),
        scope: 'excerpt',
        timezone: 'America/Argentina/Buenos_Aires',
        excerptVersion: Number.MAX_VALUE,
        turns: [fixtureTurn('t-1')],
        todos: Array.from({ length: 3 }, (_, item) => ({
          ...storedTodo(`todo-${'9'.repeat(HUGE)}-${item}`, 't-1', 'x '.repeat(HUGE)),
          status: 'dismissed' as const,
          priority: 'medium' as const,
          createdAt: 1e20,
          source: {
            kind: 'host_turn' as const,
            turnId: item === 0 ? 't-1' : 't-missing',
            participantLabel: 'P'.repeat(HUGE),
            personaId: 'margot' as const,
            upstreamReportTurnId: 't-0',
            findingKey: TODO_SENTINELS.findingKey,
            findingText: TODO_SENTINELS.findingText,
            excerptVersion: -Number.MAX_VALUE
          },
          writerEdit: { originalText: TODO_SENTINELS.findingText, editedAt: 0 }
        }))
      }));
      return { header: document.header, todos: document.todos };
    });
    const big = Number.MAX_SAFE_INTEGER;
    return emptyList({
      status: 'all',
      sessionId: 'S'.repeat(HUGE),
      recent: 50,
      personaId: 'margot',
      match: { text: MANY_TERMS, query: parseWorkshopRecallQuery(MANY_TERMS), mode: 'any-term' },
      source: 'stock-and-signature',
      sessions,
      bounds: {
        corpusSessions: big,
        sessionLimit: big,
        sessionsScanned: big,
        notScannedBySessionLimit: big,
        notScannedByByteBudget: big,
        omittedByItemLimit: big,
        notShownByStatus: { open: big, completed: big, dismissed: big },
        notShownBySource: big,
        unreadableSessions: big,
        listingTruncated: true,
        parsedBytes: big,
        unreadableBytesCharged: big,
        cacheHits: big
      }
    });
  }

  it('never exceeds the cap, always shows a whole to-do, and accounts for every one', () => {
    const result = maxedOut();
    const total = result.sessions.reduce((sum, session) => sum + session.todos.length, 0);
    const caps = [
      WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS,
      ...Array.from({ length: 20 }, (_, step) => WORKSHOP_RECALL_MINIMUM_TODO_CHARACTERS + 1 + step * 2_999),
      TODO_CHARACTERS,
      1_000_000
    ];

    for (const todoCharacters of caps) {
      const { content, shown, notShownForSpace } = renderWorkshopRecallTodos(result, { now: NOW, todoCharacters });
      expect(content.length).toBeLessThanOrEqual(todoCharacters);
      expect(shown.length).toBeGreaterThanOrEqual(1);
      expect(shown.length + notShownForSpace).toBe(total);
      expectPaired(content, shown);
      expect(content).not.toMatch(/SENTINEL-FINDING/);
      // The filters survive whole, the never-evaluated terms included (PR 127 review F-01).
      expect(content).not.toContain('[filters shortened]');
      expect(content).toMatch(/; not evaluated, past the eight-term limit: w8m+…, .+ and \d+ more\); from source stock-and-signature\.\n/);
    }
    expect(renderWorkshopRecallTodos(result, { now: NOW, todoCharacters: 1_000_000 }).notShownForSpace).toBe(0);
  });

  it('clips each part of an item to its own bound, and dates an impossible time without throwing', () => {
    const { content } = renderWorkshopRecallTodos(maxedOut(), { now: NOW });
    const [itemLine, metadata] = content.split('\n').filter((line) => line.startsWith('- [') || line.startsWith('  id ')).slice(0, 2);

    expect(itemLine).toMatch(/^- \[dismissed · medium · stale\] (x ){249}x…$/);
    expect(metadata).toContain(`id todo-${'9'.repeat(194)}… in session s0-${'i'.repeat(196)}…`);
    expect(metadata).toContain(`from ${'P'.repeat(199)}… (persona margot, host turn, report-derived) · turn 1`);
    expect(metadata).toContain('created an unknown date');
    expect(content.split('\n').filter((line) => line.startsWith('  id ')).at(1)).toContain('source turn not in this session');
  });
});

function storedTodo(id: string, turnId: string, text: string): WorkshopStoredTodoItemV1 {
  return {
    id,
    text,
    status: 'open',
    source: {
      kind: 'tool_report',
      turnId,
      participantLabel: 'Cliché',
      toolId: 'cliche',
      findingKey: 'finding-1',
      findingText: text,
      excerptVersion: 0
    },
    createdAt: Date.parse('2026-10-04T12:00:00.000Z')
  };
}
