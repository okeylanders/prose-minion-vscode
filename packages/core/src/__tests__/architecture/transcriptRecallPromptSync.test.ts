/**
 * Guard the session-recall grammar prompt (ADR 2026-10-05 §8) against drift
 * from the code it teaches:
 *
 * - every number it quotes is pinned to PROMPT_BUDGETS, and it quotes no
 *   other number;
 * - every XML example decodes through the real codec to the request the
 *   prose describes, and every example shown as refused gets the reason the
 *   prose names;
 * - the continuation and hint forms it teaches are exactly the forms the
 *   renderers emit over real saved sessions, both ways, and each followed as
 *   the prompt says decodes to the read it promises.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallRead,
  renderWorkshopRecallSearch
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import type { WorkshopCapabilityInspection } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WORKSHOP_RECALL_READ_DETAILS, type WorkshopRecallReadDetail } from '@shared/types/workshopCapabilities';
import { RECALL_ROOT, saveRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/transcript-recall-capability.md'), 'utf8');
const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
const codec = new WorkshopCapabilityXmlCodec();

/** The session ids the prompt's examples use. */
const A = '6b0f3c9e-5d2a-4c71-9f3e-2a8d1b7c4e10';
const B = '91c2d7aa-3e04-4b6f-8a15-0d6e7f2c9b38';

const call = (body: string): string =>
  `<prose-minion-tool-call name="transcript.read">${body}</prose-minion-tool-call>`;
const number = (quoted: string): number => Number(quoted.replace(/,/g, ''));

/** Prose only: no fenced XML examples. */
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');

describe('session-recall prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/at most ([\d,]+) `transcript\.read` calls in one user turn/, [budgets.readsPerTurn]],
    [/One read holds at most ([\d,]+) characters, and all the reads in one user turn share ([\d,]+)\./,
      [budgets.readCharacters, budgets.readCharactersPerTurn]],
    [/One read may name at most ([\d,]+) sessions/, [budgets.readSessions]],
    [/It takes at most ([\d,]+) ranges/, [budgets.turnRanges]],
    [/`<recent>` reads the newest N sessions that `<match>` and `<persona>` keep, at most ([\d,]+); without it, the newest ([\d,]+)\./,
      [budgets.todoSessions, budgets.todoSessions]]
  ];

  it.each(pinned)('quotes %s from PROMPT_BUDGETS', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(match!.slice(1).map(number)).toEqual(expected);
  });

  it('quotes no number it does not pin', () => {
    // Code spans quote XML and hints, whose turn numbers are examples; so are
    // "turn 1" and the "6.7" a writer might match. None of them is a limit.
    const examples = [/`[^`\n]*`/, /\bturn 1\b/, /\b6\.7\b/];
    const unpinned = [...pinned.map(([pattern]) => pattern), ...examples]
      .reduce((text, pattern) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
  });
});

describe('session-recall prompt examples, through the real codec', () => {
  const blocks = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((block) => ({
    xml: block[1].trim(),
    // The prose line just before the block, which names a refusal when it shows one.
    lead: PROMPT.slice(0, block.index).trimEnd().split('\n').at(-1)!
  }));

  const expected: WorkshopCapabilityInspection[] = [
    { kind: 'request', request: { capability: 'transcript.catalog', match: '6.7', personaId: 'cliff' } },
    { kind: 'request', request: { capability: 'transcript.search', query: 'lighthouse mother', personaId: 'margot' } },
    {
      kind: 'request',
      request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 38, to: 46 }, { from: 52, to: 52 }] }] }
    },
    {
      kind: 'request',
      request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 1, to: 30 }] }, { sessionId: B }] }
    },
    { kind: 'request', request: { capability: 'transcript.todos', status: 'open', recent: 5, match: '6.7' } },
    { kind: 'invalid', reason: 'duplicate-session', field: 'session', operation: 'transcript.read' },
    {
      kind: 'request',
      request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 12, to: 12 }, { from: 15, to: 15 }] }], detail: 'full' }
    },
    { kind: 'invalid', reason: 'conflicting-detail', field: 'detail', operation: 'transcript.read' }
  ];

  it('shows exactly the examples this test decodes', () => {
    expect(blocks).toHaveLength(expected.length);
  });

  it.each(expected.map((inspection, index) => [index + 1, inspection] as const))(
    'example %i decodes to the request it describes, or the refusal it names',
    (ordinal, inspection) => {
      const { xml, lead } = blocks[ordinal - 1];
      expect(codec.inspect(xml)).toEqual(inspection);
      const named = /refused as `([a-z-]+)`/.exec(lead)?.[1];
      expect(named).toBe(inspection.kind === 'invalid' ? inspection.reason : undefined);
    }
  );

  it('names persona labels the codec accepts', () => {
    for (const persona of ['agnes', 'Sister Agnes']) {
      expect(PROMPT).toContain(`\`${persona}\``);
      expect(codec.inspect(`<prose-minion-tool-call name="transcript.catalog"><persona>${persona}</persona></prose-minion-tool-call>`))
        .toEqual({ kind: 'request', request: { capability: 'transcript.catalog', personaId: 'agnes' } });
    }
  });

  it('teaches the to-do statuses the codec accepts', () => {
    for (const status of ['open', 'completed', 'dismissed', 'all']) {
      expect(PROMPT).toContain(`\`${status}\``);
      expect(codec.inspect(`<prose-minion-tool-call name="transcript.todos"><status>${status}</status></prose-minion-tool-call>`))
        .toMatchObject({ kind: 'request', request: { status } });
    }
  });
});

describe('session-recall prompt hints, against the renderers', () => {
  /**
   * "Continue with …", "read it in full with …", and "Read around a hit …" as
   * the prompt quotes them, without a closing period.
   */
  const taught = [...PROMPT.matchAll(/^- `((?:Continue with|read it in full with|Read around a hit)[^`]*?)\.?`/gm)]
    .map(([, form]) => form);

  /** A taught form as a whole-line pattern: any session id, any turn numbers. */
  const pattern = (form: string): RegExp => new RegExp(`^${
    form
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(new RegExp(`${A}|${B}`, 'g'), '[A-Za-z0-9._:-]+')
      .replace(/\d+(?:-\d+)?/g, '\\d+(?:-\\d+)?')
  }$`);

  /** A report, then more discussion than one small read holds. */
  const chat = (session: WorkshopSessionService, advance: (milliseconds: number) => void, tag: string): void => {
    session.setExcerpt({
      text: 'The laughter was raucous.',
      source: { kind: 'file', sourceUri: `file://${RECALL_ROOT}/drafts/${tag}.md`, relativePath: `drafts/${tag}.md` }
    });
    session.setSessionScope('excerpt');
    advance(60_000);
    session.beginToolRun('stock-and-signature', `${tag}-report`);
    session.completeToolReport(`${tag}-report`, `Lighthouse report. ${'The beat lands on a stock gesture. '.repeat(40)}`,
      `conv-${tag}-report`, undefined, false, []);
    for (let reply = 1; reply <= 6; reply += 1) {
      advance(60_000);
      session.beginPersonaMessage(`${tag}-${reply}`, `Where does the lighthouse scene go, part ${reply}?`);
      advance(60_000);
      session.completeRun(`${tag}-${reply}`, `Reply ${reply}. ${'word '.repeat(400)}`, undefined, false, `runtime-${tag}`);
    }
  };

  let emitted: string[];
  /** Each read's rendered text, by its session count and detail. */
  const reads = new Map<string, string>();

  beforeAll(async () => {
    const first = await saveRecallRoom('First chat', (session, advance) => chat(session, advance, 'first'), { idPrefix: 'first' });
    const second = await saveRecallRoom('Second chat', (session, advance) => chat(session, advance, 'second'),
      { fs: first.fs, idPrefix: 'second' });
    const recall = new WorkshopTranscriptRecallService(second.store, second.coordinator, second.log);
    const signal = new AbortController().signal;
    const now = Date.parse('2026-10-06T12:00:00.000Z');
    const read = async (sessionIds: string[], detail: WorkshopRecallReadDetail) => renderWorkshopRecallRead(
      await recall.read({ sessions: sessionIds.map((sessionId) => ({ sessionId })), detail }, signal),
      { now, readCharacters: 6_000 * sessionIds.length + 2_000 }
    ).content;
    // Every combination the renderers tell apart, one session or several, in
    // every detail, so no read's forms go unsampled (PR 131 review F-01).
    for (const sessionIds of [[first.savedSessionId], [first.savedSessionId, second.savedSessionId]]) {
      for (const detail of WORKSHOP_RECALL_READ_DETAILS) {
        reads.set(`${sessionIds.length}:${detail}`, await read(sessionIds, detail));
      }
    }
    const outputs = [
      ...reads.values(),
      renderWorkshopRecallSearch(await recall.search({ query: 'lighthouse scene' }, signal), { now })
    ];
    emitted = outputs.flatMap((output) => [
      ...output.matchAll(/Continue with [^\n]*?(?=\.$|\.\n|, then)/gm),
      ...output.matchAll(/read it in full with [^\]]*/g),
      ...output.matchAll(/Read around a hit with transcript\.read, for example [^\n]*?(?=\.$)/gm)
    ].map(([form]) => form));
  });

  it('teaches seven forms', () => {
    expect(taught).toHaveLength(7);
  });

  it('teaches only forms the renderers emit', () => {
    for (const form of taught) {
      expect(emitted.some((line) => pattern(form).test(line))).toBe(true);
    }
  });

  it('teaches every form the renderers emit', () => {
    expect(emitted.length).toBeGreaterThanOrEqual(taught.length);
    for (const line of emitted) {
      expect(taught.some((form) => pattern(form).test(line))).toBe(true);
    }
  });

  it('decodes each taught form, followed as the prompt says, to the read it promises', () => {
    const fragment = (form: string): string =>
      form.replace(/^(Continue with|read it in full with|Read around a hit with transcript\.read, for example) /, '');
    // A form without a session belongs beside the one session it came from.
    const followed = taught.map((form) => {
      const written = fragment(form);
      return codec.inspect(call(written.includes('<session') ? written : `<session>${A}</session>${written}`));
    });
    expect(followed).toEqual([
      { kind: 'request', request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 41, to: 72 }] }] } },
      {
        kind: 'request',
        request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 41, to: 72 }] }], detail: 'discussion' }
      },
      { kind: 'request', request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 12, to: 12 }] }], detail: 'full' } },
      {
        kind: 'request',
        request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 41, to: 72 }] }], detail: 'discussion' }
      },
      { kind: 'request', request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 41, to: 72 }] }], detail: 'full' } },
      { kind: 'request', request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 12, to: 12 }] }], detail: 'full' } },
      { kind: 'request', request: { capability: 'transcript.read', sessions: [{ sessionId: A, turns: [{ from: 10, to: 15 }] }] } }
    ]);
  });

  it.each(WORKSHOP_RECALL_READ_DETAILS)(
    'keeps %s detail explicit when a read of several sessions’ continuations are followed alone or together',
    (detail) => {
      const continuations = [...reads.get(`2:${detail}`)!.matchAll(/Continue with (<session turns="[^"]+">[^<]+<\/session> <detail>\w+<\/detail>)\./g)]
        .map(([, written]) => written);
      expect(continuations).toHaveLength(2);
      for (const written of continuations) {
        expect(codec.inspect(call(written))).toMatchObject({ kind: 'request', request: { sessions: [expect.anything()], detail } });
      }
      expect(codec.inspect(call(continuations.join(' '))))
        .toMatchObject({ kind: 'request', request: { sessions: [expect.anything(), expect.anything()], detail } });
    }
  );
});
