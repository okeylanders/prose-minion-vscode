/**
 * A reply cut off at the output ceiling while it wrote its frame's ending
 * (PR #165 F-02): every block had finished, and only the closing sentinel,
 * or the closing fence of a fence the reply opened, was part written. That
 * part is set aside, so the blocks read as the whole reply's do; a reply
 * that stopped normally gets no such allowance, and any other last line is
 * still refused. The replies are the worked examples' (the opening of
 * "Alice's Adventures in Wonderland", Lewis Carroll, 1865, public domain).
 */
import type { LightboxReadingGroupId } from '@messages';
import { LIGHTBOX_READING_GROUPS } from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { LightboxGroupFrameError, lightboxGroupSentinels } from '@/infrastructure/lightbox/LightboxReadingWire';
import { readWorkedExample } from './lightboxReadingFixtures';

const contextOf = (group: LightboxReadingGroupId) => {
  const example = readWorkedExample(group);
  return { group, lenses: example.lenses, columnCount: group === 'F' ? 0 : example.paragraphs.length };
};
const atCeiling = (group: LightboxReadingGroupId) => ({ ...contextOf(group), end: 'ceiling' as const });

/** The frame error a reply throws, or a failure when it reads. */
function refusedBy(read: () => unknown): LightboxGroupFrameError {
  try {
    read();
  } catch (error) {
    if (error instanceof LightboxGroupFrameError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a LightboxGroupFrameError');
}

describe('a reply cut off inside its closing sentinel', () => {
  it.each([...LIGHTBOX_READING_GROUPS])('reads group %s\'s finished blocks as the whole reply\'s, the sentinel one character short', (group) => {
    const { response } = readWorkedExample(group);
    const { end } = lightboxGroupSentinels(group);
    expect(response.endsWith(end)).toBe(true);
    const whole = decodeLightboxGroup(response, contextOf(group));
    const cut = decodeLightboxGroup(response.slice(0, -1), atCeiling(group));
    expect(cut.blocks).toEqual(whole.blocks);
    expect(cut.withheld).toEqual(whole.withheld);
    expect(cut.report?.cutOff).toBe(true);
    expect(cut.report?.repairs).toEqual(['missing-closing-sentinel']);
  });

  it.each([...LIGHTBOX_READING_GROUPS])('reads group %s\'s finished blocks with no closing sentinel at all (control)', (group) => {
    const { response } = readWorkedExample(group);
    const { end } = lightboxGroupSentinels(group);
    const whole = decodeLightboxGroup(response, contextOf(group));
    expect(decodeLightboxGroup(response.slice(0, -end.length), atCeiling(group)).blocks).toEqual(whole.blocks);
  });

  it('reads them the same wherever inside the sentinel the reply stopped', () => {
    const { response } = readWorkedExample('E');
    const { end } = lightboxGroupSentinels('E');
    const whole = decodeLightboxGroup(response, contextOf('E'));
    for (let written = 1; written < end.length; written++) {
      const cut = response.slice(0, response.length - end.length + written);
      expect(decodeLightboxGroup(cut, atCeiling('E')).blocks).toEqual(whole.blocks);
    }
  });
});

describe('a reply cut off inside the closing fence of a fence it opened', () => {
  const { response } = readWorkedExample('E');
  const { start, end } = lightboxGroupSentinels('E');
  const whole = decodeLightboxGroup(response, contextOf('E'));
  const json = response.slice(start.length + 1, -(end.length + 1));

  it.each([['two', '``'], ['one', '`']])('reads a fenced frame cut %s backtick(s) into its closing fence', (_count, partial) => {
    const cut = decodeLightboxGroup(`\`\`\`json\n${response}\n${partial}`, atCeiling('E'));
    expect(cut.blocks).toEqual(whole.blocks);
    // Its sentinel was written whole, so nothing else is missing: only the fence is set aside.
    expect(cut.report).toEqual({ repairs: ['code-fence'], clipped: 0, cutOff: false });
  });

  it.each([['two', '``'], ['one', '`']])('reads JSON fenced inside the sentinels, cut %s backtick(s) into its closing fence', (_count, partial) => {
    const cut = decodeLightboxGroup(`${start}\n\`\`\`json\n${json}\n${partial}`, atCeiling('E'));
    expect(cut.blocks).toEqual(whole.blocks);
    expect(cut.report?.repairs).toEqual(['missing-closing-sentinel', 'code-fence']);
  });
});

describe('what is still refused', () => {
  const { response } = readWorkedExample('E');
  const { start, end } = lightboxGroupSentinels('E');
  const json = response.slice(start.length + 1, -(end.length + 1));

  it('refuses a part-written sentinel from a reply that stopped normally', () => {
    expect(refusedBy(() => decodeLightboxGroup(response.slice(0, -1), contextOf('E'))).message)
      .toBe(`The group E response must contain exactly one ${end}`);
  });

  it('refuses a part-written closing fence from a reply that stopped normally', () => {
    expect(refusedBy(() => decodeLightboxGroup(`\`\`\`json\n${response}\n\`\``, contextOf('E'))).message)
      .toBe('The group E closing sentinel must be the final line');
  });

  it.each([
    ['prose after the finished JSON', `${start}\n${json}\nThat is the whole reading.`],
    ['backticks when no fence was opened', `${start}\n${json}\n\`\``],
    ['the start of another group\'s sentinel', `${start}\n${json}\n===END_LIGHTBOX_GROUP_A`],
    ['a sentinel written past its own', `${start}\n${json}\n${end}=`]
  ])('refuses %s at the output ceiling, its whole group saved for recovery as before', (_case, text) => {
    const error = refusedBy(() => decodeLightboxGroup(text, atCeiling('E')));
    expect(error.message).toMatch(/^The group E (reply reached the output ceiling and could not be read|closing sentinel must be the final line|response must contain exactly one ===END_LIGHTBOX_GROUP_E_V1===)$/);
    expect(`${error.message} ${error.diagnostic ?? ''}`).not.toMatch(/whole reading|Portal descent/);
  });
});
