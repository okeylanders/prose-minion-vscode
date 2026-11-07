/**
 * `transcript.bookmarks` through the real top-level codec (ADR 2026-11-05
 * D2, D4). `WorkshopCapabilityXmlCodec.inspect` has no exhaustiveness guard,
 * so every case here also witnesses that the operation reaches the family's
 * codec rather than falling to `unknown-capability`.
 */

import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const codec = new WorkshopCapabilityXmlCodec();
const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
const SESSION = '6b0f3c9e-5d2a-4c71-9f3e-2a8d1b7c4e10';
const OTHER = '91c2d7aa-3e04-4b6f-8a15-0d6e7f2c9b38';
const BOOKMARK = 'bookmark-3-1759334400000';

const inspect = (body: string) =>
  codec.inspect(`<prose-minion-tool-call name="transcript.bookmarks">${body}</prose-minion-tool-call>`);
const request = (fields: Record<string, unknown>) => ({ kind: 'request', request: { capability: 'transcript.bookmarks', ...fields } });
const refused = (reason: string, field?: string) => ({
  kind: 'invalid',
  reason,
  ...(field !== undefined ? { field } : {}),
  operation: 'transcript.bookmarks'
});

describe('transcript.bookmarks in the capability codec', () => {
  it('reaches the family codec from inspect: an empty call lists everything', () => {
    expect(inspect('')).toEqual(request({}));
  });

  it('reads every list field', () => {
    expect(inspect(
      '<scope>SAVED</scope><recent>5</recent><match>6.7</match><persona>Sister Agnes</persona>' +
      '<query>lighthouse mother</query><speaker>writer</speaker><since>2026-10-01</since><until>2026-11-04</until>'
    )).toEqual(request({
      scope: 'saved',
      match: '6.7',
      personaId: 'agnes',
      query: 'lighthouse mother',
      speaker: 'writer',
      since: '2026-10-01',
      until: '2026-11-04',
      recent: 5
    }));
  });

  it.each([
    ['current', 'current'],
    ['all', 'all'],
    [' Saved ', 'saved']
  ])('reads <scope>%s</scope>', (written, scope) => {
    expect(inspect(`<scope>${written}</scope>`)).toEqual(request({ scope }));
  });

  it('refuses an unknown scope', () => {
    expect(inspect('<scope>room</scope>')).toEqual(refused('invalid-scope', 'scope'));
  });

  it.each(['recent', 'session', 'match', 'persona'])('refuses <%s> with current scope: it chooses saved sessions', (field) => {
    const value = field === 'recent' ? '3' : field === 'session' ? SESSION : field === 'persona' ? 'cliff' : 'tide';
    expect(inspect(`<scope>current</scope><${field}>${value}</${field}>`)).toEqual(refused('conflicting-scope', field));
  });

  it('keeps the bookmark filters with current scope', () => {
    expect(inspect('<scope>current</scope><query>dawn</query><speaker>Cliff</speaker><until>2026-11-05</until>'))
      .toEqual(request({ scope: 'current', query: 'dawn', speaker: 'cliff', until: '2026-11-05' }));
  });

  it(`repeats <session> up to ${budgets.bookmarkSessionsNamed}, distinct, never beside <recent>`, () => {
    const ids = Array.from({ length: budgets.bookmarkSessionsNamed }, (_, index) => `session-${index + 1}`);
    expect(inspect(ids.map((id) => `<session>${id}</session>`).join(''))).toEqual(request({ sessionIds: ids }));
    expect(inspect([...ids, 'session-extra'].map((id) => `<session>${id}</session>`).join('')))
      .toEqual(refused('too-many-sessions', 'session'));
    expect(inspect(`<session>${SESSION}</session><session>${SESSION}</session>`)).toEqual(refused('duplicate-session', 'session'));
    expect(inspect(`<session>${SESSION}</session><recent>2</recent>`)).toEqual(refused('conflicting-session-selection', 'recent'));
    expect(inspect('<session>../sessions/x.json</session>')).toEqual(refused('invalid-session-id', 'session'));
  });

  it(`bounds <recent> at ${budgets.bookmarkSessions}`, () => {
    expect(inspect(`<recent>${budgets.bookmarkSessions}</recent>`)).toEqual(request({ recent: budgets.bookmarkSessions }));
    for (const recent of ['0', String(budgets.bookmarkSessions + 1), 'five', '-1']) {
      expect(inspect(`<recent>${recent}</recent>`)).toEqual(refused('invalid-recent', 'recent'));
    }
  });

  it(`bounds <query> at ${budgets.bookmarkQueryCharacters} characters`, () => {
    expect(inspect(`<query>${'a'.repeat(budgets.bookmarkQueryCharacters)}</query>`))
      .toEqual(request({ query: 'a'.repeat(budgets.bookmarkQueryCharacters) }));
    expect(inspect(`<query>${'a'.repeat(budgets.bookmarkQueryCharacters + 1)}</query>`)).toEqual(refused('oversized-input', 'query'));
  });

  it('reads <speaker> as the writer, a tool id, or a persona by id or label', () => {
    expect(inspect('<speaker>Writer</speaker>')).toEqual(request({ speaker: 'writer' }));
    expect(inspect('<speaker>cliche</speaker>')).toEqual(request({ speaker: 'cliche' }));
    expect(inspect('<speaker>Sister Agnes</speaker>')).toEqual(request({ speaker: 'agnes' }));
    expect(inspect('<speaker>the narrator</speaker>')).toEqual(refused('unknown-speaker', 'speaker'));
  });

  it('reads real calendar days, in order, and refuses the rest as invalid-date', () => {
    expect(inspect('<since>2026-11-04</since><until>2026-11-04</until>')).toEqual(request({ since: '2026-11-04', until: '2026-11-04' }));
    expect(inspect('<since>2028-02-29</since>')).toEqual(request({ since: '2028-02-29' }));
    expect(inspect('<since>2026-11-05</since><until>2026-11-04</until>')).toEqual(refused('invalid-date', 'until'));
    for (const day of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-1-5', 'yesterday', '2026-11-04T00:00']) {
      expect(inspect(`<since>${day}</since>`)).toEqual(refused('invalid-date', 'since'));
      expect(inspect(`<until>${day}</until>`)).toEqual(refused('invalid-date', 'until'));
    }
  });

  it('reads one bookmark by its qualified ref, with an optional <from>', () => {
    expect(inspect(`<bookmark>${SESSION}/${BOOKMARK}</bookmark>`))
      .toEqual(request({ bookmark: { source: 'saved', sessionId: SESSION, bookmarkId: BOOKMARK } }));
    expect(inspect(`<bookmark>current@${OTHER}/${BOOKMARK}</bookmark> <from>4000</from>`))
      .toEqual(request({ bookmark: { source: 'current', liveSessionId: OTHER, bookmarkId: BOOKMARK }, from: 4000 }));
    expect(inspect(`<bookmark>${SESSION}/${BOOKMARK}</bookmark><from>0</from>`))
      .toEqual(request({ bookmark: { source: 'saved', sessionId: SESSION, bookmarkId: BOOKMARK }, from: 0 }));
  });

  it('refuses a malformed ref at the codec', () => {
    for (const ref of [
      BOOKMARK,
      `${SESSION}/bookmark-0-1`,
      `${SESSION}/bookmark-1`,
      `${SESSION}/bookmark-01-5`,
      `current@/${BOOKMARK}`,
      `current@${SESSION}`,
      `../${SESSION}/${BOOKMARK}`,
      `${'a'.repeat(budgets.sessionIdCharacters + 1)}/${BOOKMARK}`,
      `current@current@${SESSION}/${BOOKMARK}`
    ]) {
      expect([ref, inspect(`<bookmark>${ref}</bookmark>`)]).toEqual([ref, refused('invalid-bookmark-ref', 'bookmark')]);
    }
  });

  it(`bounds <from> at ${budgets.bookmarkFromMax}`, () => {
    const ref = `<bookmark>${SESSION}/${BOOKMARK}</bookmark>`;
    expect(inspect(`${ref}<from>${budgets.bookmarkFromMax}</from>`)).toMatchObject(request({ from: budgets.bookmarkFromMax }));
    for (const from of [String(budgets.bookmarkFromMax + 1), '-1', '4.5', 'start', '0400']) {
      expect(inspect(`${ref}<from>${from}</from>`)).toEqual(refused('invalid-from', 'from'));
    }
  });

  it('takes only <from> beside <bookmark>, and <from> only beside it', () => {
    const ref = `<bookmark>${SESSION}/${BOOKMARK}</bookmark>`;
    for (const field of ['scope', 'session', 'recent', 'match', 'persona', 'query', 'speaker', 'since', 'until']) {
      expect(inspect(`${ref}<${field}>x</${field}>`)).toEqual(refused('unexpected-field', field));
    }
    expect(inspect('<from>4000</from>')).toEqual(refused('unexpected-field', 'from'));
    expect(inspect(`${ref}${ref}`)).toEqual(refused('duplicate-field', 'bookmark'));
  });

  it('refuses unknown and empty fields', () => {
    expect(inspect('<status>open</status>')).toEqual(refused('unexpected-field', 'status'));
    expect(inspect('<query></query>')).toEqual(refused('empty-field', 'query'));
    expect(inspect('<bookmark></bookmark>')).toEqual(refused('empty-field', 'bookmark'));
  });
});
