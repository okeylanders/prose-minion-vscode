/**
 * The Passage Search reply (ADR 2026-11-20 D8): asks, not gates. An
 * instance's fault drops that instance; an unreadable reply is the call's
 * failure; a cut reply keeps what finished. Replies quote *Alice*.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PassageSearchReplyError, readPassageSearchReply } from '@services/search/passage/PassageSearchReplyCodec';

const bounds = PROMPT_BUDGETS.passageSearch;
const RABBIT = { quote: 'looked at its watch', note: 'It checks the time.', label: 'checks its watch' };
const reply = (...instances: unknown[]): string => JSON.stringify({ instances });
const faultOf = (read: () => unknown): string => {
  try {
    read();
  } catch (error) {
    if (error instanceof PassageSearchReplyError) {
      return error.fault;
    }
    throw error;
  }
  return 'read';
};

describe('readPassageSearchReply', () => {
  it('reads instances whole, with optional context', () => {
    const read = readPassageSearchReply(reply(RABBIT, { ...RABBIT, before: 'It', after: ', and was gone' }), false);
    expect(read).toEqual({
      instances: [RABBIT, { ...RABBIT, before: 'It', after: ', and was gone' }],
      malformed: 0,
      ignoredFields: 0,
      notesClipped: 0,
      repairs: [],
      cut: false
    });
  });

  it('takes an empty list as a fine answer', () => {
    expect(readPassageSearchReply('{"instances":[]}', false)).toMatchObject({ instances: [], malformed: 0, cut: false });
  });

  it('never clips a quote over its ask, and drops one over the safety ceiling', () => {
    const long = 'a'.repeat(bounds.quoteCharacters + 1);
    const tooLong = 'a'.repeat(bounds.quoteCharacters * bounds.safetyMultiple + 1);
    const read = readPassageSearchReply(reply({ ...RABBIT, quote: long }, { ...RABBIT, quote: tooLong }), false);
    expect(read.instances.map((instance) => instance.quote)).toEqual([long]);
    expect(read.malformed).toBe(1);
  });

  it('clips only a note past the safety ceiling, with an ellipsis, and counts it', () => {
    const ceiling = bounds.noteCharacters * bounds.safetyMultiple;
    const overAsk = 'n'.repeat(bounds.noteCharacters + 20);
    const read = readPassageSearchReply(reply({ ...RABBIT, note: overAsk }, { ...RABBIT, note: 'n'.repeat(ceiling + 50) }), false);
    expect(read.instances[0].note).toBe(overAsk);
    expect(read.instances[1].note).toBe(`${'n'.repeat(ceiling)}…`);
    expect(read.notesClipped).toBe(1);
    expect(read.malformed).toBe(0);
  });

  it('drops an instance with a missing quote or label, a wrong type, or a label over its ceiling, and keeps the rest', () => {
    const read = readPassageSearchReply(reply(
      { note: 'no quote', label: 'x' },
      { quote: 'no label', note: 'n' },
      { ...RABBIT, quote: 7 },
      { ...RABBIT, before: ['It'] },
      { ...RABBIT, note: 3 },
      { ...RABBIT, label: 'l'.repeat(bounds.labelCharacters * bounds.safetyMultiple + 1) },
      { ...RABBIT, label: '   ' },
      'not an object',
      { quote: 'ran close by her', label: '  runs   past ' }
    ), false);
    expect(read.malformed).toBe(8);
    expect(read.instances).toEqual([{ quote: 'ran close by her', note: '', label: 'runs past' }]);
  });

  it('ignores and counts fields the format does not define', () => {
    const read = readPassageSearchReply(JSON.stringify({ instances: [{ ...RABBIT, line: 4, file: 'x' }], count: 1 }), false);
    expect(read.instances).toEqual([RABBIT]);
    expect(read.ignoredFields).toBe(3);
    expect(read.malformed).toBe(0);
  });

  it('reads through the shared parser, reporting each repair by kind', () => {
    const read = readPassageSearchReply(`\`\`\`json\n{"instances":[${JSON.stringify(RABBIT)},]}\n\`\`\``, false);
    expect(read.instances).toEqual([RABBIT]);
    expect(read.repairs).toEqual(['code-fence', 'trailing-comma']);
  });

  it('fails the call for a reply that is too long, does not parse, or has no list', () => {
    expect(faultOf(() => readPassageSearchReply(' '.repeat(bounds.responseCharacters + 1), false))).toBe('too-long');
    expect(faultOf(() => readPassageSearchReply('Here are the instances I found.', false))).toBe('unparseable');
    expect(faultOf(() => readPassageSearchReply('{"instances":[{"quote":"cut', false))).toBe('unparseable');
    expect(faultOf(() => readPassageSearchReply('{"instances":"none"}', false))).toBe('no-instances');
    expect(faultOf(() => readPassageSearchReply('[]', false))).toBe('no-instances');
    expect(faultOf(() => readPassageSearchReply('{"found":[]}', false))).toBe('no-instances');
  });

  it('keeps the finished instances of a reply cut off at its ceiling', () => {
    const cut = `{"instances":[${JSON.stringify(RABBIT)},${JSON.stringify({ ...RABBIT, quote: 'hurried on' })},{"quote":"Oh dear! Oh de`;
    const read = readPassageSearchReply(cut, true);
    expect(read.cut).toBe(true);
    expect(read.instances.map((instance) => instance.quote)).toEqual(['looked at its watch', 'hurried on']);
    expect(read.repairs).toContain('missing-closing-bracket');
  });

  it('reads a reply cut before any instance finished as none found', () => {
    expect(readPassageSearchReply('{"instances":[{"quote":"Oh dear', true)).toMatchObject({ instances: [], cut: true });
    expect(readPassageSearchReply('{"insta', true)).toMatchObject({ instances: [], cut: true });
  });

  it('fails a cut reply that is not an object at all', () => {
    expect(faultOf(() => readPassageSearchReply('I found the follo', true))).toBe('unparseable');
  });
});
