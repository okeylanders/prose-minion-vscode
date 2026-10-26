/**
 * Reading a Craft Flags reply (ADR 2026-10-21, Amendment 2026-10-26: Slice
 * 3c): the shared frame, and the codec's rule (forgiving per reply,
 * fail-closed per flag), with every note held to the phrasing fence. Replies
 * are about public-domain *Alice*.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  CRAFT_FLAGS_CLOSING_SENTINEL,
  CRAFT_FLAGS_OPENING_SENTINEL,
  craftFlagHostWhy,
  decodeCraftFlagsReply,
  readCraftFlagsFrame
} from '@services/craftFlags/CraftFlagsResponseCodec';
import { DraftEditFrameError } from '@services/draftEdit/DraftEditResponseFrame';

const CHILL = {
  original: 'a chill ran down her spine',
  before: 'of its waistcoat-pocket,',
  after: ', and burning',
  kind: 'cliche',
  why: 'A borrowed shiver stands in for what the watch means to her.',
  suggestion: 'the drowsy afternoon falling away from her all at once'
};
const frameOf = (body: unknown) =>
  `${CRAFT_FLAGS_OPENING_SENTINEL}\n${typeof body === 'string' ? body : JSON.stringify(body)}\n${CRAFT_FLAGS_CLOSING_SENTINEL}`;
const read = (flags: unknown[], extra: Record<string, unknown> = {}) =>
  decodeCraftFlagsReply(readCraftFlagsFrame(frameOf({ version: 1, flags, ...extra })).root, 'cliche');

describe('readCraftFlagsFrame', () => {
  it('reads its own sentinels through the shared frame reader, with its tolerances', () => {
    expect(readCraftFlagsFrame(frameOf({ version: 1, flags: [] }))).toEqual({ root: { version: 1, flags: [] }, repairs: [] });
    expect(readCraftFlagsFrame(`\`\`\`\n${frameOf({ version: 1, flags: [] })}\n\`\`\``).repairs).toEqual(['code-fence']);
    expect(readCraftFlagsFrame(`${CRAFT_FLAGS_OPENING_SENTINEL}\n{"version":1,"flags":[]}`).repairs).toEqual(['missing-closing-sentinel']);
    expect(() => readCraftFlagsFrame('===PROOFREAD_V1===\n{"version":1,"issues":[]}\n===END_PROOFREAD_V1===')).toThrow(DraftEditFrameError);
    expect(() => readCraftFlagsFrame('x'.repeat(PROMPT_BUDGETS.craftFlags.responseCharacters + 1))).toThrow('runs past');
  });
});

describe('decodeCraftFlagsReply', () => {
  it('reads a well-formed flag, its context clipped nearest the quote', () => {
    const long = 'x'.repeat(PROMPT_BUDGETS.craftFlags.contextCharacters + 20);
    expect(read([{ ...CHILL, before: `${long}end`, after: `start${long}` }])).toEqual({
      findings: [{
        anchor: {
          quote: CHILL.original,
          before: `${long}end`.slice(-PROMPT_BUDGETS.craftFlags.contextCharacters),
          after: `start${long}`.slice(0, PROMPT_BUDGETS.craftFlags.contextCharacters)
        },
        category: 'cliche',
        kind: 'cliche',
        why: CHILL.why,
        suggestion: CHILL.suggestion
      }],
      malformed: 0,
      notesWithheld: 0,
      ignoredFields: 0
    });
  });

  it('ignores and counts a field the format does not define, a replacement among them: a flag never carries an edit', () => {
    const reply = read([{ ...CHILL, replacement: 'a shiver', confidence: 0.9 }], { model: 'x' });
    expect(reply.ignoredFields).toBe(3);
    expect(reply.findings[0]).not.toHaveProperty('replacement');
  });

  it.each([
    ['a kind outside its category (an idiom is familiar, not a fault)', { ...CHILL, kind: 'idiom' }],
    ['a stock phrase', { ...CHILL, kind: 'stock' }],
    ['no kind', { ...CHILL, kind: undefined }],
    ['an empty quote', { ...CHILL, original: '  ' }],
    ['a quote longer than a phrase', { ...CHILL, original: 'x'.repeat(PROMPT_BUDGETS.craftFlags.quoteCharacters + 1) }],
    ['no why', { ...CHILL, why: ' ' }],
    ['a context that is not a string', { ...CHILL, before: 3 }],
    ['a suggestion that is not a string', { ...CHILL, suggestion: ['the eyes'] }],
    ['not an object', 'a chill']
  ])('drops and counts a flag with %s', (_case, flag) => {
    expect(read([flag, CHILL])).toMatchObject({ malformed: 1, findings: [{ anchor: { quote: CHILL.original } }] });
  });

  it('reads a weighted phrase as a cliché flag\'s kind', () => {
    expect(read([{ ...CHILL, original: 'burning with curiosity', kind: 'weighted' }]).findings[0].kind).toBe('weighted');
  });

  it('replaces a why that breaks the fence with the host\'s line for its kind, and keeps the flag', () => {
    const reply = read([{ ...CHILL, why: 'You should name the cold.' }, { ...CHILL, original: 'burning with curiosity', kind: 'weighted', why: 'It appears 3 times.' }]);
    expect(reply.findings.map((finding) => finding.why)).toEqual([craftFlagHostWhy('cliche'), craftFlagHostWhy('weighted')]);
    expect(craftFlagHostWhy('cliche')).toBe('A phrase worn smooth by use, standing in for something the scene could name exactly.');
    expect(reply.notesWithheld).toBe(2);
  });

  it('withholds a suggestion that breaks the fence, and keeps the flag and its why', () => {
    const reply = read([{ ...CHILL, suggestion: 'Try “the drowsy afternoon”.' }]);
    expect(reply.findings[0]).toEqual(expect.objectContaining({ why: CHILL.why }));
    expect(reply.findings[0]).not.toHaveProperty('suggestion');
    expect(reply.notesWithheld).toBe(1);
  });

  it('counts a flag whose why and suggestion both break the fence once', () => {
    expect(read([{ ...CHILL, why: 'It must go.', suggestion: 'Cut it.' }]).notesWithheld).toBe(1);
  });

  it('reads an empty or absent suggestion as none, and clips long notes', () => {
    const why = `A borrowed shiver ${'and more '.repeat(60)}`;
    const [blank, long] = read([{ ...CHILL, suggestion: '  ' }, { ...CHILL, original: 'time stood still', why }]).findings;
    expect(blank).not.toHaveProperty('suggestion');
    expect(long.why).toHaveLength(PROMPT_BUDGETS.craftFlags.whyCharacters);
    expect(long.why.endsWith('…')).toBe(true);
  });

  it('rejects only a root of the wrong shape', () => {
    expect(() => read([], { version: 2 })).toThrow('version 1');
    expect(() => decodeCraftFlagsReply({ version: 1, issues: [] }, 'cliche')).toThrow('a flags array');
    expect(read([], {}).findings).toEqual([]);
  });
});
