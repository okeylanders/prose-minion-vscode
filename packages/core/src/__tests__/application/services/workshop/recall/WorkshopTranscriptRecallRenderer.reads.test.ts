/**
 * Reads of several sessions (ADR 2026-10-05 D9, D10): fair shares, one
 * framing line, a numbered section per session with its own continuation,
 * and the complete-output bound, swept over budgets and session counts with
 * every saved-file label at its maximum.
 */

import {
  buildWorkshopRecallDocument,
  WorkshopRecallDocument
} from '@/application/services/workshop/recall/WorkshopRecallDocument';
import {
  renderWorkshopRecallRead,
  WorkshopRecallRenderedRead
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import {
  WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS,
  workshopRecallMinimumReadCharacters
} from '@/application/services/workshop/recall/WorkshopRecallReadSection';
import { WORKSHOP_TRANSCRIPT_RECALL_FRAMING } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import { formatWorkshopRecallTurnRanges } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';
import type {
  WorkshopRecallReadDetail,
  WorkshopRecallReadResult,
  WorkshopRecallSessionRead,
  WorkshopRecallTurnRange
} from '@/application/services/workshop/recall/WorkshopTranscriptRecallResults';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  dividerTurn,
  fixtureTurn,
  writerTurn
} from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';
import { recallSession, RecallSessionInput } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';
import type { WorkshopTurn } from '@messages';

const NOW = Date.parse('2026-10-05T14:30:00.000Z');
const MINUTE = 60_000;

const doc = (sessionId: string, turns: WorkshopTurn[], extra: Partial<RecallSessionInput> = {}): WorkshopRecallDocument =>
  buildWorkshopRecallDocument(recallSession({ sessionId, turns, ...extra }));

/** `count` writer turns of `size` characters, a minute apart. */
const room = (prefix: string, count: number, size: number): WorkshopTurn[] =>
  Array.from({ length: count }, (_, index) => writerTurn(`${prefix}-${index + 1}`, {
    content: `${prefix} turn ${index + 1}. ${'tide '.repeat(Math.ceil(size / 5))}`.slice(0, size),
    timestamp: Date.parse('2026-10-03T15:00:00.000Z') + index * MINUTE
  }));

const read = (document: WorkshopRecallDocument, ranges?: WorkshopRecallTurnRange[]): WorkshopRecallSessionRead => ({
  outcome: 'read',
  header: document.header,
  fromStart: ranges === undefined,
  ranges: (ranges ?? [{ from: 1, to: Math.max(1, document.header.turnCount) }]).map((range) => {
    const entries = document.entries.filter((entry) => entry.position >= range.from && entry.position <= range.to);
    return {
      ...range,
      entries,
      ...(entries.length > 0 ? { firstTurnId: entries[0].turnId, lastTurnId: entries.at(-1)!.turnId } : {})
    };
  }),
  cacheHit: false
});

const batch = (sessions: WorkshopRecallSessionRead[], detail: WorkshopRecallReadDetail = 'discussion'): WorkshopRecallReadResult => ({
  available: true,
  outcome: 'read',
  detail,
  sessions,
  bounds: {
    notReadByByteBudget: 0,
    unreadableSessions: 0,
    listingTruncated: false,
    parsedBytes: 0,
    unreadableBytesCharged: 0,
    cacheHits: 0
  }
});

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

describe('a read of several sessions', () => {
  const long = (id: string) => doc(id, room(id, 100, 2_000), { title: `Long ${id}` });
  const short = doc('short', room('short', 3, 80), { title: 'Short chat' });

  it('opens with one framing line, then a numbered section per session, in the order asked', () => {
    const rendered = renderWorkshopRecallRead(batch([read(long('a')), read(short), read(long('c'))]), { now: NOW });
    const lines = rendered.content.split('\n');

    expect(lines[0]).toBe(WORKSHOP_TRANSCRIPT_RECALL_FRAMING);
    expect(lines[1]).toBe(
      "Read of 3 saved sessions, in the order asked, in discussion detail: each tool report is one line, and the writer's " +
      'messages, persona replies, and events are whole. Each session has an equal share of this read; one that needs ' +
      'less leaves the rest to the others.'
    );
    expect(rendered.content.split(WORKSHOP_TRANSCRIPT_RECALL_FRAMING)).toHaveLength(2);
    const first = rendered.content.indexOf('Session 1 of 3 · “Long a” · id a');
    const second = rendered.content.indexOf('Session 2 of 3 · “Short chat” · id short');
    const third = rendered.content.indexOf('Session 3 of 3 · “Long c” · id c');
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(rendered.sessions.map(({ sessionId, outcome }) => [sessionId, outcome]))
      .toEqual([['a', 'read'], ['short', 'read'], ['c', 'read']]);
  });

  it('passes a short chat’s leftover to the long ones', () => {
    const budget = 60_000;
    const rendered = renderWorkshopRecallRead(batch([read(long('a')), read(short), read(long('c'))]), { now: NOW, readCharacters: budget });
    const [a, s, c] = rendered.sessions;
    const alone = renderWorkshopRecallRead(batch([read(long('a'))], 'full'), { now: NOW, readCharacters: budget / 3 });

    expect(s.continuation).toEqual([]);
    expect(s.share).toBeLessThan(budget / 10);
    // The long chats split what the short one left: more than an equal third each.
    expect(a.share).toBeGreaterThan(budget / 3 + 8_000);
    expect(Math.abs(a.share - c.share)).toBeLessThanOrEqual(1);
    expect(sum(rendered.sessions.map((session) => session.share))).toBe(budget);
    expect(rendered.content.length).toBeLessThanOrEqual(budget);
    // So each reads further than an equal third would have taken it.
    expect(a.delivered[0].to).toBeGreaterThan(alone.sessions[0].delivered[0].to);
    expect(rendered.content).toContain('Continue with <session turns="');
  });

  it('gives an unread session one line, and its share to the others', () => {
    const budget = 60_000;
    const rendered = renderWorkshopRecallRead(batch([
      read(long('a')),
      { outcome: 'unreadable', sessionId: 'broken', title: 'Broken chat' },
      { outcome: 'unknown-session', sessionId: 'nope', liveSession: false },
      { outcome: 'unknown-session', sessionId: 'live', liveSession: true },
      { outcome: 'not-read-by-byte-budget', sessionId: 'later', title: 'Later chat' },
      read(long('c'))
    ]), { now: NOW, readCharacters: budget });

    expect(rendered.content).toContain(
      'Session 2 of 6 · The saved session “Broken chat” (id broken) could not be read; its file may be damaged or too large.'
    );
    expect(rendered.content).toContain(
      'Session 3 of 6 · No saved session in this workspace has id nope. transcript.catalog lists the ids.'
    );
    expect(rendered.content).toContain('Session 4 of 6 · Session live is the current session.');
    expect(rendered.content).toContain(
      'Session 5 of 6 · The saved session “Later chat” (id later) was not read: the sessions before it in this read ' +
      'spent its reading budget. Read it on its own.'
    );
    const [a, ...rest] = rendered.sessions;
    const c = rest.at(-1)!;
    expect(rest.slice(0, 4).every((notice) => notice.share < 300 && notice.delivered.length === 0)).toBe(true);
    expect(a.share).toBeGreaterThan(budget / 2 - 1_000);
    expect(c.share).toBeGreaterThan(budget / 2 - 1_000);
    expect(rendered.content.length).toBeLessThanOrEqual(budget);
  });

  it('names each session with its own ranges in its continuation', () => {
    const rendered = renderWorkshopRecallRead(batch([
      read(long('a'), [{ from: 10, to: 60 }, { from: 80, to: 90 }]),
      read(long('c'))
    ]), { now: NOW, readCharacters: 30_000 });
    const [a, c] = rendered.sessions;

    expect(a.continuation.at(-1)).toEqual({ from: 80, to: 90 });
    expect(rendered.content).toContain(
      `Continue with <session turns="${formatWorkshopRecallTurnRanges(a.continuation)}">a</session> <detail>discussion</detail>.`
    );
    expect(rendered.content).toContain(
      `Continue with <session turns="${formatWorkshopRecallTurnRanges(c.continuation)}">c</session> <detail>discussion</detail>.`
    );
    expect(rendered.content).not.toContain('Continue with <turns>');
  });

  it('keeps the read’s detail in every continuation but a one-session full read’s (PR 129 F-01)', () => {
    // Followed together, several sessions default to discussion: a full batch says full.
    const full = renderWorkshopRecallRead(batch([read(long('a')), read(long('c'))], 'full'), { now: NOW, readCharacters: 30_000 });
    expect(full.content).toMatch(/Continue with <session turns="[\d, -]+">a<\/session> <detail>full<\/detail>\./);
    expect(full.content).toMatch(/Continue with <session turns="[\d, -]+">c<\/session> <detail>full<\/detail>\./);
    // Followed alone, one session defaults to full: a discussion read says discussion.
    const one = renderWorkshopRecallRead(batch([read(long('a'))], 'discussion'), { now: NOW, readCharacters: 20_000 });
    expect(one.content).toMatch(/Continue with <turns>\d+-100<\/turns> <detail>discussion<\/detail>\.$/);
  });

  it('reads one session as before: no ordinal, and a <turns> continuation', () => {
    const rendered = renderWorkshopRecallRead(batch([read(long('a'))], 'full'), { now: NOW, readCharacters: 20_000 });

    expect(rendered.content.split('\n').slice(0, 2)).toEqual([WORKSHOP_TRANSCRIPT_RECALL_FRAMING, 'Session “Long a” · id a']);
    expect(rendered.content).toMatch(/Continue with <turns>\d+-100<\/turns>\.$/);
  });

  it('says the listing stopped short when a named id may be among the files it did not list', () => {
    const truncated = (sessions: WorkshopRecallSessionRead[]): WorkshopRecallReadResult => {
      const result = batch(sessions);
      return result.available ? { ...result, bounds: { ...result.bounds, listingTruncated: true } } : result;
    };
    const note = 'This workspace holds more session files than one listing reads; the oldest were not listed.';

    expect(renderWorkshopRecallRead(truncated([read(short), { outcome: 'unknown-session', sessionId: 'old', liveSession: false }]), { now: NOW }).content)
      .toContain(`${note}\nSession 1 of 2 · “Short chat”`);
    // The live room's id was never missing from the listing.
    expect(renderWorkshopRecallRead(truncated([read(short), { outcome: 'unknown-session', sessionId: 'live', liveSession: true }]), { now: NOW }).content)
      .not.toContain(note);
    expect(renderWorkshopRecallRead(batch([read(short), { outcome: 'unknown-session', sessionId: 'old', liveSession: false }]), { now: NOW }).content)
      .not.toContain(note);
  });

  it('says so when a one-session read asks for discussion detail', () => {
    const rendered = renderWorkshopRecallRead(batch([read(short)], 'discussion'), { now: NOW });

    expect(rendered.content.split('\n')[1]).toBe(
      "Discussion detail: each tool report is one line, and the writer's messages, persona replies, and events are whole."
    );
  });

  it('refuses a budget below one minimum share per session named, and the largest read clears it', () => {
    const three = batch([read(short), read(short), read(short)]);

    expect(() => renderWorkshopRecallRead(three, { now: NOW, readCharacters: 3 * WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS - 1 }))
      .toThrow(RangeError);
    expect(renderWorkshopRecallRead(three, { now: NOW, readCharacters: workshopRecallMinimumReadCharacters(3) }).sessions)
      .toHaveLength(3);
    const { readCharacters, readSessions } = PROMPT_BUDGETS.workshopTranscriptRecall;
    expect(workshopRecallMinimumReadCharacters(readSessions)).toBeLessThanOrEqual(readCharacters);
  });

  it('refuses a read that names no session, as the service and codec do, rather than render nothing', () => {
    expect(() => renderWorkshopRecallRead(batch([]), { now: NOW })).toThrow(RangeError);
  });
});

describe('the complete read bound across sessions, with every saved-file label at its maximum', () => {
  /** A session whose every header part and speaker label is as long as a saved file can make it. */
  function maximal(index: number): WorkshopRecallDocument {
    const id = `${String(index).padStart(2, '0')}-${'i'.repeat(5_000)}`;
    const turns: WorkshopTurn[] = [];
    for (let step = 0; step < 12; step += 1) {
      const at = Date.parse('2026-10-01T15:00:00.000Z') + (index * 12 + step) * 7 * 60 * MINUTE;
      const size = 200 + ((index * 7 + step * 13) % 9) * 450;
      const text = `${index}.${step} ${'salt '.repeat(size / 5)}`;
      switch (step % 4) {
        case 0:
          turns.push(writerTurn(`${id}-t${step}`, {
            content: text,
            timestamp: at,
            messageAttachments: Array.from({ length: 30 }, (_, n) => ({ id: `a-${n}`, label: `${'f'.repeat(300)}-${n}.md`, words: 1 }))
          }));
          break;
        case 1:
          turns.push(fixtureTurn(`${id}-t${step}`, {
            participant: 'tool', artifact: 'tool_report', toolLabel: 'K'.repeat(5_000),
            personaId: undefined, personaLabel: undefined, content: text, timestamp: at
          }));
          break;
        case 2:
          turns.push(fixtureTurn(`${id}-t${step}`, { personaLabel: 'P'.repeat(5_000), content: text, timestamp: at }));
          break;
        default:
          turns.push(dividerTurn(`${id}-t${step}`, 'excerpt_revision', `Excerpt revised ${'r'.repeat(300)}`));
      }
    }
    const saved = doc(id, turns, {
      title: `${index} ${'T'.repeat(5_000)}`,
      excerptLabel: `${'e'.repeat(5_000)}.md`,
      contextLabels: Array.from({ length: 2_000 }, (_, n) => `${'c'.repeat(150)}-${n}.md`)
    });
    return {
      ...saved,
      header: {
        ...saved.header,
        host: 'H'.repeat(5_000),
        participants: Array.from({ length: 10_000 }, (_, n) => `${'P'.repeat(300)}-${n}`)
      }
    };
  }

  const documents = Array.from({ length: 10 }, (_, index) => maximal(index));
  /** Every third session asks for scattered single turns; the rest read from turn 1. */
  const sessionsFor = (count: number): WorkshopRecallSessionRead[] => documents.slice(0, count).map((document, index) => {
    if (index % 5 === 4) {
      return { outcome: 'unreadable', sessionId: document.header.sessionId, title: document.header.title };
    }
    return read(document, index % 3 === 1 ? Array.from({ length: 6 }, (_, n) => ({ from: n * 2 + 1, to: n * 2 + 1 })) : undefined);
  });

  /** Every requested visible position is delivered or left to continue, never both. */
  const accounted = (session: WorkshopRecallSessionRead, rendered: WorkshopRecallRenderedRead['sessions'][number]): boolean => {
    if (session.outcome !== 'read') {
      return rendered.delivered.length === 0 && rendered.continuation.length === 0;
    }
    const within = (position: number, ranges: readonly WorkshopRecallTurnRange[]) =>
      ranges.some((range) => position >= range.from && position <= range.to);
    return session.ranges.flatMap((range) => range.entries.map((entry) => entry.position))
      .every((position) => within(position, rendered.delivered) !== within(position, rendered.continuation));
  };

  it('stays within the budget, keeps every session present and making progress, and continues each correctly', () => {
    let renders = 0;
    const outcomes = new Set<string>();
    for (let count = 1; count <= 10; count += 1) {
      const sessions = sessionsFor(count);
      const minimum = workshopRecallMinimumReadCharacters(count);
      const budgets = [
        ...Array.from({ length: 12 }, (_, step) => minimum + step * 7),
        ...Array.from({ length: 12 }, (_, step) => minimum + 97 + step * 3_331),
        PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters
      ];
      for (const readCharacters of budgets) {
        for (const detail of ['discussion', 'full'] as const) {
          const rendered = renderWorkshopRecallRead(batch(sessions, detail), { now: NOW, readCharacters });
          const where = [count, readCharacters, detail];
          renders += 1;

          expect([...where, rendered.content.length <= readCharacters]).toEqual([...where, true]);
          expect([...where, sum(rendered.sessions.map((session) => session.share)) <= readCharacters]).toEqual([...where, true]);
          expect([...where, rendered.sessions.length]).toEqual([...where, count]);
          let after = -1;
          sessions.forEach((session, index) => {
            const out = rendered.sessions[index];
            const label = count > 1 ? `Session ${index + 1} of ${count} · ` : 'Session “';
            const at = rendered.content.indexOf(label, after + 1);
            expect([...where, index, at > after]).toEqual([...where, index, true]);
            after = at;
            expect([...where, index, accounted(session, out)]).toEqual([...where, index, true]);
            if (session.outcome === 'read') {
              // Progress: every read session shows at least one entry, whole or as a readable head.
              expect([...where, index, out.delivered.length > 0]).toEqual([...where, index, true]);
              outcomes.add(out.truncatedEntry ? 'cut' : out.continuation.length > 0 ? 'continued' : 'complete');
            }
            if (out.continuation.length > 0) {
              // A share that fell short of its session's need still clears the minimum.
              expect([...where, index, out.share >= WORKSHOP_RECALL_MINIMUM_READ_CHARACTERS]).toEqual([...where, index, true]);
            }
            if (out.continuation.length > 0) {
              const turns = formatWorkshopRecallTurnRanges(out.continuation);
              const call = count > 1 ? `<session turns="${turns}">${String(index).padStart(2, '0')}-` : `<turns>${turns}</turns>`;
              expect([...where, index, rendered.content.includes(`Continue with ${call}`)]).toEqual([...where, index, true]);
            }
          });
        }
      }
    }
    expect(renders).toBe(10 * 25 * 2);
    // The sweep reaches a cut head, a full window that continues, and a complete section.
    expect([...outcomes].sort()).toEqual(['complete', 'continued', 'cut']);
  });
});
