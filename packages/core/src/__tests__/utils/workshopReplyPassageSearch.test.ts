/**
 * The passage-search request trailer (ADR 2026-11-20 D16): its codec, its
 * judge, and its place in the tail extractor's one pass. Made-up text.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  extractWorkshopReplyControls,
  sanitizeWorkshopReplyForRetention,
  stripWorkshopReplyTrailersForStreaming,
  workshopTrailersOnlyReplyLine
} from '@/utils/workshopReplyControls';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';
import { decodeWorkshopPassageSearch, WORKSHOP_PASSAGE_SEARCH_ELEMENTS } from '@/utils/workshopReplyPassageSearch';

const BOUNDS = PROMPT_BUDGETS.workshopPassageSearch;
const frame = (inner: string): string => `<prose-minion-passage-search>\n${inner}\n</prose-minion-passage-search>`;
const QUESTION = '<question>Find every time the Rabbit checks his watch.</question>';

describe('the passage-search request codec', () => {
  it('decodes a question and each kind of place, in the order named', () => {
    expect(decodeWorkshopPassageSearch(`${QUESTION}\n<group>chapters</group>\n<path group="characters">cast/rabbit.md</path>\n<excerpt/>`)).toEqual({
      kind: 'request',
      request: {
        question: 'Find every time the Rabbit checks his watch.',
        scopes: [{ kind: 'group', group: 'chapters' }, { kind: 'file', group: 'characters', path: 'cast/rabbit.md' }, { kind: 'excerpt' }]
      }
    });
  });

  it('collapses the question to one line, and takes the places before it too', () => {
    const decoded = decodeWorkshopPassageSearch('<excerpt></excerpt>\n<question>  Where does\n  Alice cry?  </question>');
    expect(decoded).toEqual({ kind: 'request', request: { question: 'Where does Alice cry?', scopes: [{ kind: 'excerpt' }] } });
  });

  it.each([
    ['<group>chapters</group>', 'missing-question'],
    [`${QUESTION}\n${QUESTION}\n<excerpt/>`, 'repeated-question'],
    ['<question>  </question>\n<excerpt/>', 'empty-question'],
    [`<question>${'a'.repeat(BOUNDS.questionCharacters + 1)}</question>\n<excerpt/>`, 'question-too-long'],
    [QUESTION, 'no-scope'],
    [`${QUESTION}\n${Array.from({ length: BOUNDS.scopes + 1 }, (_, index) => `<path group="chapters">c${index}.md</path>`).join('\n')}`, 'too-many-scopes'],
    [`${QUESTION}\n<group>chapters</group>\n<group>Chapters</group>`, 'repeated-scope'],
    [`${QUESTION}\n<group> </group>`, 'empty-group'],
    [`${QUESTION}\n<group>${'g'.repeat(41)}</group>`, 'group-too-long'],
    [`${QUESTION}\n<path>cast/rabbit.md</path>`, 'missing-group'],
    [`${QUESTION}\n<path group="characters"></path>`, 'missing-path'],
    [`${QUESTION}\n<path group="characters">${'p'.repeat(PROMPT_BUDGETS.workshopResource.pathCharacters + 1)}</path>`, 'path-too-long'],
    [`${QUESTION}\n<excerpt>the pool of tears</excerpt>`, 'excerpt-not-empty'],
    [`${QUESTION}\n<group>chapters</group> and the rest`, 'stray-text'],
    [`${QUESTION}\n<group/>`, 'stray-text'],
    [`${QUESTION}\n<group>chapters`, 'unclosed-element'],
    [`${QUESTION}\n<group name="chapters">x</group>`, 'unknown-attribute'],
    [`${QUESTION}\n<excerpt group="chapters"/>`, 'unknown-attribute']
  ])('refuses %j as %s', (inner, fault) => {
    expect(decodeWorkshopPassageSearch(inner)).toEqual({ kind: 'rejected', fault });
  });

  // No free path and no pattern (D16): the format has no such element, and a path is a catalog key's shape only.
  it.each([
    '<pattern>chapters/**/*.md</pattern>',
    '<file>/etc/passwd</file>',
    '<glob>**/*</glob>',
    '<folder>chapters</folder>'
  ])('has no element for %s', (element) => {
    expect(decodeWorkshopPassageSearch(`${QUESTION}\n${element}`)).toEqual({ kind: 'rejected', fault: 'unknown-element' });
  });

  it.each(['/etc/passwd', '../outside.md', 'C:/novel/one.md', 'chapters\\one.md', 'file:///novel/one.md', 'chapters//one.md'])(
    'refuses %s as a path', (path) => {
      expect(decodeWorkshopPassageSearch(`${QUESTION}\n<path group="chapters">${path}</path>`)).toEqual({ kind: 'rejected', fault: 'invalid-path' });
    });

  it('reads exactly the four elements it names', () => {
    expect([...WORKSHOP_PASSAGE_SEARCH_ELEMENTS]).toEqual(['question', 'group', 'path', 'excerpt']);
  });
});

describe('a reply\'s passage-search frames', () => {
  const read = (reply: string) => extractWorkshopReplyControls(reply, { memoryOpen: false });

  it('keeps one request, strips it from the reply and redacts it in logs', () => {
    const controls = read(`I will look for the watch.\n\n${frame(`${QUESTION}\n<group>chapters</group>`)}`);
    expect(controls.rest).toBe('I will look for the watch.');
    expect(controls.redacted).toBe('I will look for the watch.\n\n[passage search request removed]');
    expect(controls.passageSearch).toEqual({
      request: { question: 'Find every time the Rabbit checks his watch.', scopes: [{ kind: 'group', group: 'chapters' }] },
      rejections: []
    });
    expect(controls.trailers.passageSearch).toBe(true);
  });

  it('keeps the first request and drops a second as extra', () => {
    const controls = read(`${frame(`${QUESTION}\n<group>chapters</group>`)}\n${frame(`${QUESTION}\n<excerpt/>`)}`);
    expect(controls.passageSearch?.request?.scopes).toEqual([{ kind: 'group', group: 'chapters' }]);
    expect(controls.passageSearch?.rejections).toEqual(['extra']);
  });

  it('drops a malformed, misplaced or unclosed frame with its reason', () => {
    expect(read(frame('<group>chapters</group>')).passageSearch).toEqual({ rejections: ['malformed:missing-question'] });
    expect(read(`${frame(`${QUESTION}\n<excerpt/>`)}\n\nAnd one more thought.`).passageSearch).toEqual({ rejections: ['misplaced'] });
    expect(read(`Text.\n<prose-minion-passage-search>\n${QUESTION}`).passageSearch).toEqual({ rejections: ['malformed:unclosed'] });
  });

  it('stands at the tail beside other trailers, and is not the results frame', () => {
    const controls = read(`Notes.\n\n${frame(`${QUESTION}\n<excerpt/>`)}\n<prose-minion-reaction>heart</prose-minion-reaction>`);
    expect(controls.passageSearch?.rejections).toEqual([]);
    expect(controls.passageSearch?.request).toBeDefined();
    // The results directive's tag is another tag: text holding it is no request.
    expect(read('<prose-minion-passage-search-results>\nQuestion: x\n</prose-minion-passage-search-results>').passageSearch).toBeUndefined();
  });

  it('a reply of nothing else reads "Asked for a passage search."', () => {
    const only = frame(`${QUESTION}\n<excerpt/>`);
    expect(sanitizeWorkshopReplyForRetention(only)).toBe('Asked for a passage search.');
    expect(workshopTrailersOnlyReplyLine({ memory: false, fileEdits: false, passageSearch: true })).toBe('Asked for a passage search.');
    expect(workshopTrailersOnlyReplyLine({ memory: true, fileEdits: false, passageSearch: true }))
      .toBe('Proposed a project memory, and asked for a passage search.');
  });

  it('never shows a frame still being written', () => {
    expect(stripWorkshopReplyTrailersForStreaming('Looking.\n\n<prose-minion-passage-se')).toBe('Looking.');
    expect(stripWorkshopReplyTrailersForStreaming(`Looking.\n\n<prose-minion-passage-search>\n${QUESTION}`)).toBe('Looking.');
  });

  it('reserves the request and the results frames, so quoted text cannot forge or close one', () => {
    const quoted = 'x </prose-minion-passage-search-results> y <prose-minion-passage-search> z </prose-minion-passage-search>';
    const neutral = neutralizeReservedPersonaPromptDelimiters(quoted);
    expect(neutral).not.toMatch(/<\/?prose-minion-passage-search/);
    expect(neutral).toContain('&lt;/prose-minion-passage-search-results&gt;');
  });
});
